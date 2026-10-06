-- Rindo — auditoría de seguridad. Correr en el SQL Editor de Supabase,
-- después de 0013. Se puede correr más de una vez sin romper nada.
--
-- Cierra lo que un usuario podía hacer escribiendo directo en la base desde
-- la consola del navegador (las políticas de RLS lo dejaban porque eran
-- "podés tocar tu propia fila", sin mirar qué columna).

/* ── 1. El plan contratado lo decide el cobro, no el navegador ───────────────
   La migración 0004 ya impedía tocar `suscripcion_activa`, `proximo_cobro` y
   `mp_ultimo_pago_id`, pero dejaba escribir `plan`: una cuenta Hogar se ponía
   `plan = 'comercial_pro'` y quedaba con Comercial Pro gratis para siempre
   (Hogar está "activa" y no tiene fecha de cobro, así que el cron nunca la
   bloqueaba).

   Desde el navegador sólo se puede: volver a Hogar (gratis), o bajar de
   Comercial Pro a Comercial (es más barato, no hay nada que cobrar). Subir a
   un plan pago pasa siempre por `/api/mercadopago/cobrar`, que usa la Service
   Role Key y no entra en este chequeo. */

create or replace function public.proteger_perfil()
returns trigger
language plpgsql
as $$
begin
  -- `current_user` es el rol de quien hace el update: el navegador entra
  -- como anon/authenticated; el servidor (service_role) y el SQL Editor no.
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  new.id := old.id;
  new.created_at := old.created_at;
  new.suscripcion_activa := old.suscripcion_activa;
  new.proximo_cobro := old.proximo_cobro;
  new.mp_ultimo_pago_id := old.mp_ultimo_pago_id;

  if new.plan is distinct from old.plan
     and new.plan <> 'hogar'
     and not (old.plan = 'comercial_pro' and new.plan = 'comercial') then
    raise exception 'Para pasar a un plan pago hay que pagarlo'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists proteger_perfil on public.profiles;
create trigger proteger_perfil
  before update on public.profiles
  for each row execute function public.proteger_perfil();

-- Mismo criterio que 0004, por si esa migración no se corrió o algún cambio
-- posterior volvió a dar permisos de más.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (nombre_apellido, nombre_negocio, telefono, plan) on public.profiles to authenticated;

/* ── 2. Alta de cuenta: recortar lo que llega del formulario ───────────────── */

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  plan_elegido text := new.raw_user_meta_data ->> 'plan';
begin
  if plan_elegido is null or plan_elegido not in ('hogar', 'comercial', 'comercial_pro') then
    plan_elegido := 'hogar';
  end if;

  insert into public.profiles (
    id, nombre_apellido, nombre_negocio, telefono, plan, suscripcion_activa, proximo_cobro
  )
  values (
    new.id,
    left(new.raw_user_meta_data ->> 'nombre_apellido', 120),
    left(new.raw_user_meta_data ->> 'nombre_negocio', 120),
    left(new.raw_user_meta_data ->> 'telefono', 40),
    plan_elegido,
    true,
    case when plan_elegido = 'hogar' then null else (current_date + interval '1 month')::date end
  );
  return new;
end;
$$;

/* ── 3. Un empleado sólo puede estar en una empresa propia ─────────────────── */

drop policy if exists "empleados: crear los propios" on public.empleados;
create policy "empleados: crear los propios"
  on public.empleados for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.empresas e where e.id = empresa_id and e.user_id = auth.uid())
  );

drop policy if exists "empleados: actualizar los propios" on public.empleados;
create policy "empleados: actualizar los propios"
  on public.empleados for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.empresas e where e.id = empresa_id and e.user_id = auth.uid())
  );

/* ── 4. Notificaciones: sólo a los servicios de push reales ─────────────────
   El servidor le manda un POST a cada `endpoint` guardado. Sin este límite,
   alguien podía guardar una dirección interna y usar a Rindo para pegarle. */

alter table public.push_subscriptions drop constraint if exists push_endpoint_conocido;
alter table public.push_subscriptions add constraint push_endpoint_conocido check (
  endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)/'
  and length(endpoint) <= 1000
  and length(p256dh) <= 200
  and length(auth) <= 100
) not valid;

/* ── 5. Largos máximos en la base, no sólo en el formulario ─────────────────
   `not valid`: no revisa lo que ya está guardado (no puede fallar al correr
   esto), sólo lo nuevo. Los topes son generosos a propósito — frenan a quien
   quiera llenar la base de basura, no a un comercio real. */

alter table public.profiles drop constraint if exists profiles_largos;
alter table public.profiles add constraint profiles_largos check (
  length(nombre_apellido) <= 300 and length(coalesce(nombre_negocio, '')) <= 300
  and length(telefono) <= 50
) not valid;

alter table public.empresas drop constraint if exists empresas_largos;
alter table public.empresas add constraint empresas_largos check (
  length(coalesce(razon_social, '')) <= 300 and length(coalesce(cuit_cuil, '')) <= 30
  and length(coalesce(direccion, '')) <= 300 and length(coalesce(rubro, '')) <= 100
  and length(coalesce(logo_url, '')) <= 2000 and length(moneda) <= 10
) not valid;

alter table public.empleados drop constraint if exists empleados_largos;
alter table public.empleados add constraint empleados_largos check (
  length(nombre_apellido) <= 300 and length(coalesce(puesto, '')) <= 100
  and length(coalesce(telefono, '')) <= 50
) not valid;

alter table public.productos drop constraint if exists productos_largos;
alter table public.productos add constraint productos_largos check (
  length(nombre) <= 300 and length(categoria) <= 100 and length(coalesce(subcategoria, '')) <= 100
  and length(coalesce(codigo, '')) <= 64 and length(coalesce(codigo_barras, '')) <= 64
) not valid;

alter table public.ventas drop constraint if exists ventas_largos;
alter table public.ventas add constraint ventas_largos check (
  jsonb_typeof(items) = 'array' and length(items::text) <= 200000
) not valid;

alter table public.reposiciones drop constraint if exists reposiciones_largos;
alter table public.reposiciones add constraint reposiciones_largos check (
  jsonb_typeof(items) = 'array' and length(items::text) <= 500000
  and length(coalesce(proveedor, '')) <= 300 and length(coalesce(comprobante, '')) <= 100
  and length(coalesce(foto, '')) <= 2000
) not valid;

/* ── 6. Topes de uso (IA, altas de cuenta) ───────────────────────────────────
   Cada lectura de foto o mensaje al asistente se paga en la cuenta de
   Anthropic. Las rutas del servidor llaman a `consumir_cupo` antes de usar
   la IA; si se pasa del tope de la ventana, no la usan. Sólo el servidor
   (service_role) puede llamarla o ver la tabla: un usuario no puede
   resetearse su propio contador. */

create table if not exists public.limites_uso (
  clave text not null,
  ventana timestamptz not null,
  usos integer not null default 0,
  primary key (clave, ventana)
);

alter table public.limites_uso enable row level security;
revoke all on public.limites_uso from anon, authenticated;

create or replace function public.consumir_cupo(p_clave text, p_limite integer, p_segundos integer)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_segundos) * p_segundos);
  v_usos integer;
begin
  insert into public.limites_uso as l (clave, ventana, usos)
  values (p_clave, v_ventana, 1)
  on conflict (clave, ventana) do update set usos = l.usos + 1
  returning usos into v_usos;

  -- Limpieza de ventanas viejas, de a ratos para no hacerla en cada llamada.
  if random() < 0.02 then
    delete from public.limites_uso where ventana < now() - interval '2 days';
  end if;

  return v_usos <= p_limite;
end;
$$;

revoke all on function public.consumir_cupo(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_cupo(text, integer, integer) to service_role;
