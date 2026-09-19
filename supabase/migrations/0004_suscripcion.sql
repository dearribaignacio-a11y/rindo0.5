-- Rindo — Suscripción paga (Mercado Pago). Correr en el SQL Editor de
-- Supabase, después de 0001-0003.
--
-- `suscripcion_activa` es lo único que decide si una cuenta con plan
-- Comercial/Comercial Pro puede usar la app (ver `esCuentaBloqueada` en
-- `lib/plans.ts`). El plan Hogar nunca la consulta: es gratis siempre.
--
-- Por seguridad, estas columnas SOLO las puede escribir el webhook de
-- Mercado Pago (con la Service Role Key, que ignora RLS y los grants de
-- columna de abajo) — nunca el cliente. Si un usuario pudiera poner
-- `suscripcion_activa = true` a mano desde el navegador, se saltearía el
-- cobro por completo.

alter table public.profiles
  add column if not exists suscripcion_activa boolean not null default true,
  add column if not exists mp_preapproval_id text,
  add column if not exists mp_estado text,
  add column if not exists suscripcion_actualizada_at timestamptz;

-- Restringe qué columnas puede tocar el usuario dueño de la fila: sin esto,
-- la policy "profiles: actualizar la propia fila" (auth.uid() = id) deja
-- escribir cualquier columna, billing incluido.
revoke update on public.profiles from authenticated;
grant update (nombre_apellido, nombre_negocio, telefono, plan) on public.profiles to authenticated;

create index if not exists profiles_mp_preapproval_id_idx on public.profiles (mp_preapproval_id);
