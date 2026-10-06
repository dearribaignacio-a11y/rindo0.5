# Auditoría de seguridad — guía para Rindo

Esto viene de la auditoría completa que se le hizo a **Turnia**
(`dearribaignacio-a11y/turnia.01`), que comparte stack con Rindo: Next.js 15
(App Router) + Supabase (`@supabase/ssr`, RLS) + Mercado Pago + Vercel.

En Turnia aparecieron **dos agujeros críticos y una docena de medios** que el
código parecía no tener a simple vista. Como el stack y los patrones son los
mismos (mismos `lib/supabase/{client,server,admin,middleware}.ts`, mismas
políticas de RLS, mismo tipo de rutas de API), **conviene correr los mismos
chequeos en Rindo**. Varios de los agujeros de Turnia venían del patrón
copiado de la documentación de Supabase, no de un descuido puntual, así que
es muy probable que Rindo tenga los mismos.

Faustino es no técnico: cualquier hallazgo hay que explicárselo en
consecuencias concretas (qué podría hacer un atacante y qué perdería él), no
en nombres de vulnerabilidades.

---

## Cómo auditar (el método, que es lo que más sirve)

1. **Leer el código entero, archivo por archivo.** En Turnia los dos
   críticos NO aparecieron con grep: salieron de leer el flujo completo de
   OAuth y el de checkout. Son ~5.600 líneas; se hace en una pasada.
2. **Probar los arreglos de verdad, no asumir.** Se levantó un Postgres 16
   local con un stub del entorno de Supabase (`auth.uid()`, `auth.role()`,
   `storage.objects`, `storage.foldername()`), se corrieron **todas** las
   migraciones en orden y se escribió un script que **intenta cada ataque**.
   El stub está al final de este documento, listo para copiar.
3. **Cada ataque va con su control legítimo.** No alcanza con que el ataque
   rebote: hay que confirmar en la misma corrida que el flujo normal sigue
   andando (que el doctor pueda editar su perfil, que el chat ande, etc.).
   Así no se "arregla" rompiendo la app.
4. **Probar también las rutas de API con la app corriendo**
   (`npx next start` + curl): sesiones ausentes, parámetros basura,
   callbacks falsificados.
5. **Las migraciones se las corre Faustino a mano** en el SQL Editor de
   Supabase. Hay que mandarle el archivo con `SendUserFile` (copiar y pegar
   del chat le falló varias veces) y avisarle si va a ver warnings normales
   (ej. `trigger does not exist, skipping`).

---

## 1. Lo que un usuario puede escribir directo en la base (lo más grave)

**Esto fue lo más productivo de toda la auditoría.** Con RLS activado uno
asume que está cubierto, pero una política como
`for update using (auth.uid() = id)` deja al usuario editar **cualquier
columna de su propia fila**, incluidas las que decide si pagó.

En Turnia esto permitía:

- Un doctor se ponía `has_paid_signup_fee = true` y
  `signup_paid_until = '2099-01-01'` desde la consola del navegador: **Turnia
  gratis para siempre**.
- Un paciente creaba una consulta con `status = 'abierta'`, `paid_at = now()`
  y `price = 0`: **consulta gratis sin pasar por el cobro**.
- Un paciente mandaba un mensaje con `sender_role = 'doctor'`:
  **se hacía pasar por el médico**.

**Cómo se arregló:** triggers `before insert/update` que, cuando
`auth.role()` es `anon` o `authenticated` (o sea, viene del navegador),
pisan los campos sensibles con el valor correcto — el precio sale de la
tabla, no del cliente — y dejan pasar libre al `service_role` (las rutas del
servidor). Más quitar la política de `update` que no usaba nadie.

**Qué revisar en Rindo:**
- `supabase/migrations/*`: listar todas las políticas de `update` e `insert`
  y preguntarse, columna por columna, *"¿qué pasa si el usuario pone acá lo
  que quiera?"*. Campos sospechosos: estado del plan, fecha de vencimiento,
  plan contratado, si pagó, montos, totales, `user_id`/`empresa_id` (para no
  escribir en la empresa de otro), roles de empleados.
- Rindo tiene empresas con empleados (`0002_empresa_empleados.sql`): revisar
  que un empleado no pueda ascenderse a dueño, ni leer/escribir datos de
  otra empresa, ni cambiarse de empresa.
- `0005_activar_segun_plan.sql`: si el plan activo se decide con una columna
  que el cliente puede escribir, es el mismo agujero que el de Turnia.

---

## 2. OAuth de Mercado Pago (crítico en Turnia)

El callback de OAuth recibía `state=<id del doctor>` y guardaba los tokens
**para el id que viniera en la URL**, sin mirar quién estaba logueado. Es
decir: alguien armaba un link con el id de otro doctor, conectaba **su
propia** cuenta de Mercado Pago, y **los cobros de los pacientes de ese
doctor le caían al atacante**.

**Cómo se arregló:** `state` pasó a ser un valor aleatorio de un solo uso
guardado en una cookie `httpOnly`; el callback compara ambos y **el usuario
sale de la sesión, nunca de la URL**.

**Qué revisar en Rindo:** si hay cualquier flujo OAuth o callback externo,
aplicar la misma regla: *nada que venga en la URL decide a qué cuenta se
asocia algo*.

---

## 3. "Modo simulado" vivo en producción (crítico en Turnia)

Turnia tenía un atajo de desarrollo: si faltaba configuración de Mercado
Pago, confirmaba el pago igual "para poder probar". Eso quedó **activo en
producción**: un doctor sin Mercado Pago conectado recibía consultas gratis,
y figuraban como cobradas.

**Cómo se arregló:** el atajo ahora exige una variable explícita
(`TURNIA_MODO_PRUEBA_PAGOS=true`), que nunca se carga en Vercel. Sin ella, el
flujo falla con un mensaje claro en vez de regalar el servicio.

**Qué revisar en Rindo:** buscar cualquier `if (!isConfigured)`,
`if (!token)`, modo demo, datos de prueba o bypass que termine **activando
algo pago**. El criterio: *un atajo de desarrollo nunca puede activarse solo
por falta de configuración; tiene que pedir una variable a propósito.*

---

## 4. Webhooks de pago

El webhook de Mercado Pago abría la consulta con solo ver
`status === 'approved'` y el `external_reference`.

**Cómo se arregló:** ahora, además, exige que el monto pagado alcance el
precio, que la moneda sea ARS y que **el `collector_id` del pago coincida con
la cuenta de Mercado Pago del doctor de esa consulta** (si no, alguien pagaba
$1 a otra cuenta y abría la consulta).

**Qué revisar en Rindo:** `app/api/mercadopago/cobrar/route.ts` y cualquier
webhook: ¿se vuelve a consultar el pago contra Mercado Pago (no confiar en el
body que llega)? ¿Se compara monto, moneda y destinatario? ¿Se verifica que
el pago no se haya usado ya para activar otra cosa?

---

## 5. Cobros automáticos / tareas programadas (propio de Rindo)

`app/api/mercadopago/cobrar-renovaciones/route.ts` **no existe en Turnia**,
así que esto no está auditado: hay que mirarlo con especial cuidado.

Es una ruta pública que **cobra tarjetas**. Chequear:

- ¿Exige un secreto? (`Authorization: Bearer $CRON_SECRET` comparado con
  `timingSafeEqual`, o el header de Vercel Cron). Si cualquiera puede
  llamarla desde el navegador, puede **disparar cobros a todos los clientes
  cuando quiera**.
- ¿Es idempotente? Si se llama dos veces seguidas, ¿cobra dos veces? Conviene
  marcar el período ya cobrado antes de cobrar, o usar `external_reference`
  único por período y verificar si ya existe.
- ¿Qué pasa si falla a la mitad de la lista? ¿Reintenta los ya cobrados?
- ¿Queda registro de cada intento (éxito y error) para poder reclamar?

---

## 6. Rutas que usan la API de Claude (propio de Rindo)

`app/api/asistente/route.ts` y `app/api/vision/route.ts` tampoco existen en
Turnia. Riesgos específicos:

- **Sin sesión válida = cualquiera gasta tu saldo de la API.** Verificar
  `auth.getUser()` al principio de la ruta, sí o sí.
- **Límite de uso por usuario.** Aunque pidan sesión, alguien puede crearse
  una cuenta y hacer miles de llamadas. Conviene un tope (ej. N llamadas por
  hora por usuario, con un trigger o una tabla de contador, como el antispam
  que se hizo en Turnia).
- **Tamaño de entrada.** Limitar largo de texto y peso/tipo de imagen *antes*
  de mandarlo a la API, si no una imagen gigante se traduce en costo.
- **La `ANTHROPIC_API_KEY` solo en el servidor.** Que no tenga prefijo
  `NEXT_PUBLIC_` y que el archivo que la usa no sea importable desde un
  componente cliente (ver punto 8).
- **Inyección de prompt:** lo que escribe el usuario no puede cambiar las
  instrucciones del sistema, y la respuesta del modelo no debe ejecutarse ni
  insertarse como HTML.

---

## 7. Datos sensibles que se escapan sin que uno lo note

En Turnia (datos de salud) se encontró que:

- El **motivo de la consulta** viajaba a Mercado Pago como descripción del
  cobro: quedaba en los comprobantes y mails de las dos partes.
- Ese mismo motivo aparecía en la **notificación push**, visible en la
  pantalla bloqueada del celular.
- Un doctor podía leer el **perfil completo** de su paciente (DNI, teléfono,
  PINs de todas sus obras sociales) por una política de RLS demasiado
  amplia, aunque ninguna pantalla lo mostrara.
- Un doctor podía leer sus propios **tokens de Mercado Pago** desde el
  navegador (si hubiera un XSS, se los roban). Se revocó con
  `revoke select ... / grant select (columnas puntuales)`.

**Qué revisar en Rindo:** qué datos financieros salen hacia afuera
(descripciones de cobros, mails, notificaciones) y qué puede leer de más
cada rol. Pregunta guía: *"si esta pantalla no lo muestra, ¿por qué la base
lo deja leer?"*.

---

## 8. Credenciales que llegan al navegador sin querer

En Turnia, un componente cliente importaba dos funciones de precios desde
`lib/mercadopago.ts` — el mismo archivo con el SDK y las credenciales. Las
variables secretas no se filtran (Next no las inyecta sin `NEXT_PUBLIC_`),
pero **todo el archivo se empaquetaba igual al navegador**: esa pantalla
pesaba 140 kB de más.

**Cómo se arregló:** los precios se movieron a `lib/pricing.ts` (sin
dependencias de servidor) y se agregó `import "server-only"` arriba de
`lib/mercadopago.ts`, `lib/push.ts` y `lib/supabase/admin.ts`: si alguien los
importa desde un componente cliente, **el build falla** en vez de pasar
desapercibido.

**Qué revisar en Rindo:** poner `import "server-only"` en `lib/supabase/admin.ts`,
`lib/asistente.ts`, `lib/vision.ts` y cualquier archivo que toque
`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` o tokens de Mercado Pago. Si
el build falla, ahí hay una fuga de código servidor hacia el cliente.

---

## 9. Subida de archivos y buckets de Storage

En Turnia el bucket no tenía **ninguna** restricción: cualquier usuario
logueado subía cualquier archivo, de cualquier tamaño. Un SVG puede llevar
JavaScript adentro (XSS clásico al abrirlo). Además:

- Las fotos privadas estaban en un bucket **público**: con el link las veía
  cualquiera sin iniciar sesión.
- Cualquiera podía **pisar la foto de otro** (la política de update no
  miraba de quién era el archivo) y **listar todos los archivos** del bucket.
- Al borrar los datos, los **archivos quedaban huérfanos** en el storage para
  siempre.

**Cómo se arregló:** `allowed_mime_types` + `file_size_limit` en el bucket
(se aplica del lado de Supabase, no depende del cliente); mismo chequeo en el
código, con la extensión derivada del tipo MIME y no del nombre del archivo;
bucket privado + URLs firmadas para lo sensible; ruta que codifica al dueño
(`avatars/{uid}/...`) y políticas que la comparan con `auth.uid()`; y borrado
de archivos en tandas al eliminar el dato.

**Qué revisar en Rindo:** `lib/storage.ts` y el bucket de comprobantes/fotos
de operaciones. Los comprobantes de gastos son datos financieros: ¿son
públicos? ¿Alguien puede pisar o listar los de otro?

---

## 10. Validación de entradas

- Largos máximos **en la base** (`check constraint`), no solo en el
  formulario: un `textarea` sin `maxLength` llena la base.
- Formatos con regex donde importa (slugs, URLs de fotos que solo pueden
  apuntar al propio Supabase).
- Fechas de los reportes: en Turnia una fecha basura daba **500**; ahora
  valida formato y responde 400.
- `endpoint` de notificaciones push: aceptaba **cualquier URL**, y el
  servidor después le hacía POST (SSRF — se podía usar a Turnia para pegarle
  a direcciones internas). Ahora solo acepta los dominios de push reales.

**Qué revisar en Rindo:** `lib/validacion.ts` ya existe, buenísimo — chequear
que **todas** las rutas de API la usen y que los mismos límites estén también
en la base.

---

## 11. Redirección abierta en el login

`?next=` se usaba tal cual: un link legítimo de Rindo podía terminar
mandándote a una copia falsa después de iniciar sesión. Se arregló con un
helper que **solo acepta rutas internas** (`lib/utils.ts#rutaInternaSegura`,
copiable tal cual).

---

## 12. Cabeceras de seguridad y configuración de Next

En `next.config.ts`: HSTS, `frame-ancestors 'none'` (que no se pueda meter la
app en un iframe), `nosniff`, `Referrer-Policy`, `Permissions-Policy`,
`poweredByHeader: false`.

Ojo con el CSP de scripts: **no** se puso `script-src` porque el SDK de
Mercado Pago carga desde dominios que cambian y rompería el cobro.

Además, `images.remotePatterns` estaba en `hostname: "**"`: cualquiera podía
usar el optimizador de imágenes de Vercel como proxy gratis, a costa de la
cuota. Se limitó a `*.supabase.co`.

---

## 13. Antispam

Las vías que **no cobran** son las que se abusan. En Turnia, la consulta por
obra social no pasa por Mercado Pago, así que alguien podía llenar la bandeja
de un doctor. Se pusieron topes con triggers: 5 consultas por hora por
paciente, 20 mensajes por minuto.

**Qué revisar en Rindo:** operaciones creadas por minuto, llamadas al
asistente/vision, invitaciones a empleados.

---

## 14. Bots

Campo trampa invisible (honeypot) en todos los formularios públicos:
registro, login, recuperar contraseña. Gratis, sin fricción para gente real,
frena a la mayoría de los bots simples.
Archivo copiable: `components/ui/honeypot.tsx` de Turnia.
Captcha quedó como siguiente capa, si hiciera falta.

---

## 15. Resiliencia (no es seguridad, pero tiró el sitio entero)

El middleware llamaba a Supabase en **todas** las páginas sin límite de
tiempo. Cuando el proyecto de Supabase se pausó (plan gratis se pausa solo a
la semana de inactividad), **toda la app devolvía un 504 en negro**, sin nada
propio en pantalla.

Se le puso un timeout de 5s al middleware (si Supabase no responde, la página
carga igual sin renovar la sesión) y 8s en las páginas, con un `app/error.tsx`
con botón de reintentar.

También: consultas sin `.limit()` que traían **todo el historial** en cada
carga y se iban poniendo más lentas con el uso real.

**Qué revisar en Rindo:** `lib/supabase/middleware.ts` (mismo patrón), y
buscar `.select(` sin `.limit(` en listados que crecen (operaciones,
movimientos, historial).

---

## Lo que NO hace falta programar

Estos puntos los cubren las plataformas; conviene decírselo a Faustino para
que no pague trabajo al pedo:

- **Contraseñas hasheadas** y **límite de intentos de login**: Supabase Auth.
  El largo mínimo se configura en Authentication → Providers → Email (se
  recomienda subirlo a 8, y acompañarlo con `minLength={8}` en los
  formularios).
- **HTTPS forzado**: Vercel.
- **Cifrado en tránsito y en reposo**: Supabase/Vercel.
- **Escapado de HTML**: React lo hace solo, mientras no haya
  `dangerouslySetInnerHTML` (verificar con grep que no haya ninguno).
- **Monitoreo de consultas**: panel de Supabase.

---

## Apéndice: stub de Supabase para probar migraciones en local

Levanta un Postgres, corré esto **antes** de las migraciones y después el
script de ataques. Permite probar RLS y triggers sin tocar producción.

```sql
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

create schema auth;
create table auth.users (id uuid primary key);

create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claim.role', true), '')
$$;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  allowed_mime_types text[],
  file_size_limit bigint
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null
);
alter table storage.objects enable row level security;

create function storage.foldername(name text) returns text[] language plpgsql as $$
declare _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1:array_length(_parts, 1) - 1];
end $$;

create publication supabase_realtime;

grant usage on schema auth, storage, public to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant execute on all functions in schema storage to anon, authenticated, service_role;
grant all on all tables in schema storage to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
```

Para simular a cada actor dentro del script de ataques:

```sql
-- usuario común desde el navegador
set role authenticated;
set request.jwt.claim.sub = '<uuid del usuario>';
set request.jwt.claim.role = 'authenticated';

-- el servidor (rutas de API con service role)
set role service_role;
set request.jwt.claim.role = 'service_role';

reset role;
```

En Turnia se escribieron **21 ataques** con sus controles legítimos. Todos
rebotan y la app sigue funcionando. Lo mismo debería quedar documentado en
Rindo al terminar.

---

## Resultado en Turnia, como referencia

| Severidad | Encontrados |
|---|---|
| Críticos | 2 (robo de cobros vía OAuth, servicio gratis por modo simulado) |
| Altos | 6 (escritura directa de campos de pago, perfil completo del paciente, tokens de MP legibles, subida de archivos sin restricción, fotos privadas en bucket público, SSRF en push) |
| Medios | ~8 (redirección abierta, datos sensibles hacia afuera, pisar avatares ajenos, antispam, validaciones, cabeceras, PDF que se rompía, archivos huérfanos) |

Ninguno se había detectado en dos pasadas anteriores más superficiales:
**aparecieron leyendo el código completo**.
