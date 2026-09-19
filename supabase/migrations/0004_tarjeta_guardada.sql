-- Rindo — Cobro automático con tarjeta guardada (Mercado Pago). Reemplaza el
-- enfoque anterior de "Suscripciones" (ver historial de git): acá el cliente
-- carga la tarjeta una sola vez, sin necesitar cuenta de Mercado Pago, y el
-- cobro de los meses siguientes lo dispara nuestro propio cron job.
--
-- Igual que antes: estas columnas SOLO las escribe el servidor (con la
-- Service Role Key, que ignora RLS y los grants de columna de abajo) —
-- nunca el cliente. El cliente jamás toca ni ve el número de tarjeta: eso
-- vive únicamente del lado de Mercado Pago, acá sólo se guardan referencias
-- (customer_id, card_id) que no sirven para nada fuera de nuestra cuenta.

alter table public.profiles
  add column if not exists mp_customer_id text,
  add column if not exists mp_card_id text,
  add column if not exists suscripcion_activa boolean not null default true,
  add column if not exists proximo_cobro date,
  add column if not exists mp_ultimo_pago_id text;

-- Restringe qué columnas puede tocar el usuario dueño de la fila (idempotente
-- si ya se corrió antes): sin esto, la policy "profiles: actualizar la propia
-- fila" (auth.uid() = id) deja escribir cualquier columna, billing incluido.
revoke update on public.profiles from authenticated;
grant update (nombre_apellido, nombre_negocio, telefono, plan) on public.profiles to authenticated;

create index if not exists profiles_proximo_cobro_idx on public.profiles (proximo_cobro);
