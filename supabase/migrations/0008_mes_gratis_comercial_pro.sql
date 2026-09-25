-- Rindo — toda cuenta nueva arranca con un mes gratis del plan Comercial Pro
-- (el más completo), para poder probar la app a fondo antes de decidir si se
-- paga o se pasa al plan Hogar, gratis para siempre. El formulario de alta ya
-- no pregunta qué plan querés (ver screens/Login.tsx), así que el trigger
-- deja de leer el "plan" que mandaba el cliente en los metadatos del signUp()
-- y lo fija acá directamente — de paso, nadie puede mandar un valor
-- manipulado llamando a signUp() a mano.
--
-- Al mes, si no se pagó, el cron de /api/mercadopago/cobrar-renovaciones
-- bloquea la cuenta igual que a cualquier plan pago vencido (ver
-- lib/server/mercadopago.ts) — la pantalla de "cuenta pausada" ya sabe
-- ofrecer pagar o volver a Hogar gratis.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (
    id, nombre_apellido, nombre_negocio, telefono, plan, suscripcion_activa, proximo_cobro
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre_apellido',
    new.raw_user_meta_data ->> 'nombre_negocio',
    new.raw_user_meta_data ->> 'telefono',
    'comercial_pro',
    true,
    (current_date + interval '1 month')::date
  );
  return new;
end;
$$;
