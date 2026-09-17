-- Rindo — empresa y empleados. Correr en el SQL Editor del proyecto de
-- Supabase (Project → SQL Editor → New query → pegar y ejecutar), después de
-- 0001_profiles.sql.

create table if not exists public.empresas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade unique,
  razon_social text,
  cuit_cuil text,
  direccion text,
  rubro text,
  -- Para cuando se sume subida de logo (Supabase Storage); nulo = se usa la
  -- inicial del negocio, como ya hace el resto de la app.
  logo_url text,
  moneda text not null default 'ARS',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.empresas enable row level security;

create policy "empresas: leer la propia"
  on public.empresas for select
  using (auth.uid() = user_id);

create policy "empresas: crear la propia"
  on public.empresas for insert
  with check (auth.uid() = user_id);

create policy "empresas: actualizar la propia"
  on public.empresas for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "empresas: borrar la propia"
  on public.empresas for delete
  using (auth.uid() = user_id);

create table if not exists public.empleados (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  empresa_id uuid not null references public.empresas (id) on delete cascade,
  nombre_apellido text not null,
  puesto text,
  telefono text,
  -- Opcional: no todos los negocios quieren cargar el sueldo real de entrada.
  salario numeric,
  fecha_ingreso date,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists empleados_empresa_id_idx on public.empleados (empresa_id);

alter table public.empleados enable row level security;

create policy "empleados: leer los propios"
  on public.empleados for select
  using (auth.uid() = user_id);

create policy "empleados: crear los propios"
  on public.empleados for insert
  with check (auth.uid() = user_id);

create policy "empleados: actualizar los propios"
  on public.empleados for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "empleados: borrar los propios"
  on public.empleados for delete
  using (auth.uid() = user_id);
