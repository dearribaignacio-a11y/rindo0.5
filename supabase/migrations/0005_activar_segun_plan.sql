-- Rindo — el trigger de alta de usuario tiene que dejar `suscripcion_activa`
-- en false para quien elige un plan pago en el signup, si no la cuenta queda
-- usando ese plan gratis para siempre (el default de la columna es `true`,
-- pensado para no romper cuentas ya existentes al agregar la columna, pero
-- una cuenta nueva con un plan pago tiene que arrancar bloqueada hasta
-- cargar la tarjeta).

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre_apellido, nombre_negocio, telefono, plan, suscripcion_activa)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre_apellido',
    new.raw_user_meta_data ->> 'nombre_negocio',
    new.raw_user_meta_data ->> 'telefono',
    new.raw_user_meta_data ->> 'plan',
    (new.raw_user_meta_data ->> 'plan') = 'hogar'
  );
  return new;
end;
$$;
