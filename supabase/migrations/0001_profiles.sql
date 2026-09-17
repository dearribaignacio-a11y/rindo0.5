-- Rindo — alta de usuarios: tabla `profiles`, trigger de creación automática
-- y RLS. Correr una sola vez en el SQL Editor del proyecto de Supabase
-- (Project → SQL Editor → New query → pegar y ejecutar).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre_apellido text not null,
  -- Nulo para el plan Hogar: no hay negocio que nombrar.
  nombre_negocio text,
  telefono text not null,
  plan text not null check (plan in ('hogar', 'comercial', 'comercial_pro')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: leer la propia fila"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: actualizar la propia fila"
  on public.profiles for update
  using (auth.uid() = id);

-- Sin policy de insert para el cliente: el insert lo hace el trigger de abajo
-- con permisos de `security definer`, no un usuario autenticado.

-- Crea la fila de `profiles` a partir de los metadatos mandados en el
-- `signUp()` del cliente (`options.data`). Corre con los permisos del dueño
-- de la función (`security definer`), no con los del usuario nuevo, porque
-- en ese instante todavía no hay policy de insert que se lo permita.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, nombre_apellido, nombre_negocio, telefono, plan)
  values (
    new.id,
    new.raw_user_meta_data ->> 'nombre_apellido',
    new.raw_user_meta_data ->> 'nombre_negocio',
    new.raw_user_meta_data ->> 'telefono',
    new.raw_user_meta_data ->> 'plan'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
