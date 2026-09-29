-- Rindo — el alta de cuenta vuelve a preguntar qué plan querés (ver
-- screens/Login.tsx): el trigger deja de fijar siempre "comercial_pro" (esa
-- lógica venía de la migración 0008) y vuelve a leer el "plan" que manda el
-- cliente en los metadatos del signUp(), como en 0005 — con la diferencia de
-- que ahora, sea cual sea el plan de Comercio elegido, arranca con 30 días
-- gratis en vez de exigir tarjeta al toque. El plan Hogar sigue siendo
-- gratis para siempre, sin fecha de cobro.
--
-- Se valida el plan contra los tres valores permitidos por si llega algo
-- inesperado (un cliente viejo en caché, o alguien llamando a signUp() a
-- mano): ante la duda, arranca en Hogar en vez de regalar un plan pago.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  plan_elegido text := new.raw_user_meta_data ->> 'plan';
begin
  if plan_elegido not in ('hogar', 'comercial', 'comercial_pro') then
    plan_elegido := 'hogar';
  end if;

  insert into public.profiles (
    id, nombre_apellido, nombre_negocio, telefono, plan, suscripcion_activa, proximo_cobro
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre_apellido',
    new.raw_user_meta_data ->> 'nombre_negocio',
    new.raw_user_meta_data ->> 'telefono',
    plan_elegido,
    true,
    case when plan_elegido = 'hogar' then null else (current_date + interval '1 month')::date end
  );
  return new;
end;
$$;
