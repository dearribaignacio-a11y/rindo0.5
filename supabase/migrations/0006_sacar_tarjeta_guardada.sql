-- Rindo — se abandona el enfoque de tarjeta guardada (ver commits e6b97c7 en
-- adelante): la función de Mercado Pago para vincular la tarjeta a un
-- cliente fallaba siempre con "security_code_id can't be null", sin
-- resolverse. Ahora cada cobro es manual (ver `lib/server/mercadopago.ts`,
-- `cobrarPlan`/`bloquearVencidos`) y no hace falta guardar ninguna
-- referencia de tarjeta — sólo `suscripcion_activa` y `proximo_cobro`.

alter table public.profiles
  drop column if exists mp_customer_id,
  drop column if exists mp_card_id;
