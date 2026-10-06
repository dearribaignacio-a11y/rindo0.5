# Rindo

App de gestión financiera mobile-first para el mercado de San Juan, Argentina.
Tres planes: **Hogar** (gratis, con anuncios), **Comercial** y **Comercial Pro**
(con asistente de IA).

Next.js (App Router) + TypeScript + Tailwind v4, animaciones con Framer Motion,
íconos con Lucide.

```bash
npm install
npm run dev      # desarrollo en http://localhost:3000
npm run build    # build de producción
npm start        # servir el build
```

## Deploy en Vercel

1. Subí el repo a GitHub.
2. En Vercel: **Add New → Project → Import** el repo.
3. No toques nada más. Vercel detecta Next.js solo: build `next build`, sin
   configuración de rutas, sin comando custom, sin directorio de salida a mano.
4. Deploy. Cada push a `main` redespliega.

**No hacen falta variables de entorno para el MVP.** La app arranca y funciona
completa sin ninguna clave configurada.

### Registro sin correo de confirmación: `SUPABASE_SERVICE_ROLE_KEY`

Las cuentas nuevas se crean ya confirmadas desde el servidor
(`app/auth/registro`), así nadie depende del correo de confirmación de
Supabase, que en el plan gratuito casi nunca llega. Las cuentas que quedaron
sin confirmar se confirman solas la próxima vez que inician sesión
(`app/auth/confirmar-cuenta`).

Para eso Vercel necesita `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project
Settings → API Keys → `service_role`). Sin esa variable la app vuelve al alta
clásica con correo de confirmación.

### Variable opcional: `ANTHROPIC_API_KEY`

Los dos Route Handlers que hablan con un modelo
(`app/api/vision/route.ts` y `app/api/asistente/route.ts`) funcionan en dos modos:

| `ANTHROPIC_API_KEY` | Comportamiento |
|---|---|
| sin cargar | Devuelven una detección/respuesta simulada coherente. La interfaz es idéntica y completamente usable. |
| cargada | Leen la foto del ticket o de la factura de verdad y responden el chat con el modelo. |

Para activarlo: en Vercel, **Settings → Environment Variables → Add**, nombre
`ANTHROPIC_API_KEY`, valor tu clave, y redeploy. La clave vive sólo del lado del
servidor (`lib/server/anthropic.ts`), nunca se incluye en el bundle del cliente.

### Notificaciones push: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y `VAPID_PRIVATE_KEY`

Rindo es instalable (manifest en `app/manifest.ts`, service worker en
`public/sw.js`) y puede mandar notificaciones push reales: stock bajo y
vencimiento del plan, revisado una vez al día por el cron de
`app/api/notificaciones/verificar`. Sin las claves VAPID cargadas, la app
sigue siendo instalable pero el interruptor de "Notificaciones" en Ajustes no
hace nada.

Las claves son un par fijo, se generan **una sola vez** para todo el proyecto
(no una por usuario):

```bash
npx web-push generate-vapid-keys
```

Cargá la pública como `NEXT_PUBLIC_VAPID_PUBLIC_KEY` y la privada como
`VAPID_PRIVATE_KEY` en Vercel (**Settings → Environment Variables**) y en
`.env.local` para desarrollo. La privada nunca sale de `lib/server/push.ts`.

### Proteger los cron diarios: `CRON_SECRET`

Dos Route Handlers los dispara Vercel Cron una vez al día (ver `vercel.json`):
`app/api/mercadopago/cobrar-renovaciones` (bloquea cuentas pagas vencidas) y
`app/api/notificaciones/verificar` (manda los avisos de stock bajo y
vencimiento de plan). Los dos chequean `CRON_SECRET` contra el header
`Authorization` que Vercel manda solo en sus propios crons — **sin la
variable cargada, igual funcionan, pero cualquiera que conozca la URL podría
dispararlos a mano**.

Para activar la protección: en Vercel, **Settings → Environment Variables →
Add**, nombre `CRON_SECRET`, valor cualquier cadena larga al azar (por
ejemplo `openssl rand -hex 32`), y redeploy. Vercel manda ese mismo valor
solo cuando ejecuta sus crons — no hace falta configurar nada más.

## Enviar al contador (prototipo)

Pantalla de los planes comerciales (Resumen → "Enviar al contador", o
Ajustes → Cuenta) que arma un Excel con ventas, compras y stock del período
y lo manda por WhatsApp.

- **Columnas del Excel:** se definen en un solo lugar,
  `lib/contador/columnas.ts`. El formato (encabezado azul, fila congelada,
  filtros, pesos, fechas, anchos) lo aplica `lib/contador/excel.ts` según el
  tipo de cada columna.
- **Envío:** `lib/contador/envio.ts`. (A) sube el archivo al bucket privado
  `envios-contador` de Supabase Storage y abre `wa.me` con un link firmado
  que vence a los 7 días; (B) si eso falla, menú de compartir del celular con
  el archivo adjunto; (C) si tampoco hay, descarga + WhatsApp con el mensaje.
- **Para activar la opción A:** correr `supabase/migrations/0012_envios_contador.sql`
  (crea el bucket, sus permisos y las columnas proveedor/comprobante/foto de
  `reposiciones`). Sin la migración la app sigue funcionando con B o C.
- **Demo sin login:** `/demo/contador`, con datos de ejemplo de Print (una
  librería). No lee ni escribe datos de ninguna cuenta y no necesita claves
  de Supabase para correr.

## Por qué Next.js y no un servidor propio

Vercel es serverless: **no ejecuta procesos persistentes**. Un
`http.createServer` propio sirviendo archivos y endpoints no arranca ahí, y esa
fue exactamente la causa del despliegue vacío del proyecto anterior.

En Next.js:

- las páginas se generan estáticas en el build (`app/page.tsx`);
- todo lo que necesita una clave o una API externa vive en
  `app/api/**/route.ts`, que Vercel despliega como **funciones serverless** sin
  configuración manual.

No hay ningún servidor propio en el repo, y no debe haberlo.

## Arquitectura

```
app/
  layout.tsx           fuentes (Manrope + Space Grotesk) y bootstrap del tema
  globals.css          tokens de diseño y variantes de tema
  page.tsx             monta el shell del cliente
  api/vision/          lectura de tickets y facturas por foto
  api/asistente/       chat del asistente comercial
components/            sistema de diseño (ui/) + piezas de dominio
screens/               una pantalla por archivo, agrupadas por plan
lib/
  storage.ts           persistencia (localStorage) — único punto de acceso
  calc.ts              derivaciones puras: balances, rankings, márgenes
  seed.ts              datos de ejemplo por plan y rubro
  server/anthropic.ts  cliente de IA, sólo para Route Handlers
```

### Persistencia

Todavía no hay base de datos. Todo se guarda en `localStorage` bajo la clave
`rindo.db`, como un único documento JSON versionado.

La UI **nunca** toca `localStorage` directamente: habla con las funciones de
`lib/storage.ts` (`getMovimientos()`, `addMovimiento()`, `addVenta()`, …).
Migrar a un backend real es reimplementar ese archivo, no reescribir pantallas.
Cada entidad ya tiene `id` propio y se referencia por id, así que el documento
mapea 1:1 a tablas.

## Sistema de diseño

- Fondo `#121212`, superficies `#1A1A1A`, texto `#F2F2F2` / `#9A9A9A`. Nunca
  blanco ni negro puros.
- Acento azul petróleo `#1D5C6E`. Verde `#22C55E`, rojo `#EF4444`, amarillo
  `#F59E0B`.
- **Cero violeta, magenta o púrpura** en toda la paleta, ni siquiera como matiz.
- Manrope para texto, Space Grotesk para los números destacados.
- Tres temas (Petróleo, Medianoche, Grafito) que sobrescriben las mismas
  variables CSS, se aplican en vivo y persisten.


### Acciones destructivas

Toda acción que borra datos pasa por `ConfirmDialog`, que nombra el dato en el
texto, y cuando el borrado es reversible deja un `toast(..., { deshacer })` con
botón "Deshacer" durante 6 segundos. Nunca se borra con un solo toque.

Para que "Deshacer" funcione, `lib/storage.ts` expone `restoreMovimiento` y
`restoreCategoria`, que reinsertan con el **id original** — crear uno nuevo
dejaría huérfanas las referencias que apuntaban al viejo.

### Accesibilidad

- `Sheet` aporta `role="dialog"`, `aria-modal`, foco inicial en el primer campo,
  trampa de foco con Tab, cierre con Escape y devolución del foco al control que
  lo abrió. Su efecto depende **sólo de `open`**: `onClose` va por ref, porque
  suele llegar como arrow inline y cambiaría de identidad en cada render,
  pisando el elemento de origen del foco.
- `Segmented` acepta `semantica="tabs"` (por defecto) o `"radio"`. Si el control
  elige un *valor* y no una vista — el ciclo de facturación, por ejemplo — va
  `radio`: un tab sin tabpanel asociado le miente al lector de pantalla. Se
  navega con flechas e Inicio/Fin.
- Los formularios validan **todos** los campos de una vez, mandan el foco al
  primero que falla y anuncian los errores por un contenedor `aria-live`.
- Objetivo táctil mínimo de 44px en los controles chicos: ojo de mostrar
  contraseña, links secundarios, botón "Deshacer".
- `--color-placeholder` existe aparte de `ink-faint` porque este último daba
  ~3,3:1 sobre `surface-2`, por debajo del 4,5:1 que pide WCAG AA.

### Precios

El descuento anual **se deriva de los importes** (`1 - anual / (mensual * 12)`),
nunca se escribe a mano: así la etiqueta no puede quedar desfasada de los
precios si mañana cambian. Hoy el anual equivale a 10 meses, o sea ~17%.

### Pantalla pública vs. dashboard

El dashboard vive siempre en la columna de 440px. La pantalla pública (login y
planes) se marca con `data-pantalla="publica"` y `.app-col` la deja crecer hasta
1100px en desktop, para mostrar los tres planes lado a lado en vez de apilados.

### Dos reglas que es fácil romper

1. **FAB sobre listas scrolleables**: toda pantalla con FAB usa
   `<Screen pad="fab">`, que reserva 176px abajo. Sin eso el último ítem queda
   tapado para siempre.
2. **Elementos `fixed`**: la app vive en una columna de 440px. Tab bar, FAB y
   barras de acción usan la clase `.app-col`, si no se derraman a lo ancho en
   desktop.
