-- Rindo — Productos, Ventas y Reposiciones (Stock y "Movimientos" del plan
-- Comercial). Correr en el SQL Editor de Supabase, después de 0001 y 0002.

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  nombre text not null,
  categoria text not null default 'Sin categoría',
  costo numeric not null default 0,
  precio numeric not null,
  stock numeric not null default 0,
  stock_min numeric not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists productos_user_id_idx on public.productos (user_id);

alter table public.productos enable row level security;

create policy "productos: leer los propios"
  on public.productos for select
  using (auth.uid() = user_id);

create policy "productos: crear los propios"
  on public.productos for insert
  with check (auth.uid() = user_id);

create policy "productos: actualizar los propios"
  on public.productos for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "productos: borrar los propios"
  on public.productos for delete
  using (auth.uid() = user_id);

-- `items` guarda el detalle de la venta (productoId, nombre, cantidad,
-- precio al momento de vender) como jsonb: es una lista chica y de sólo
-- lectura una vez cargada, no hace falta una tabla aparte para eso.
create table if not exists public.ventas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha timestamptz not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  metodo text not null check (metodo in ('efectivo', 'tarjeta', 'transferencia')),
  created_at timestamptz not null default now()
);

create index if not exists ventas_user_id_idx on public.ventas (user_id);
create index if not exists ventas_fecha_idx on public.ventas (fecha);

alter table public.ventas enable row level security;

create policy "ventas: leer las propias"
  on public.ventas for select
  using (auth.uid() = user_id);

create policy "ventas: crear las propias"
  on public.ventas for insert
  with check (auth.uid() = user_id);

create policy "ventas: borrar las propias"
  on public.ventas for delete
  using (auth.uid() = user_id);

create table if not exists public.reposiciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha timestamptz not null,
  items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,
  origen text not null check (origen in ('manual', 'foto')),
  created_at timestamptz not null default now()
);

create index if not exists reposiciones_user_id_idx on public.reposiciones (user_id);

alter table public.reposiciones enable row level security;

create policy "reposiciones: leer las propias"
  on public.reposiciones for select
  using (auth.uid() = user_id);

create policy "reposiciones: crear las propias"
  on public.reposiciones for insert
  with check (auth.uid() = user_id);

-- Habilita Realtime en Productos (para Stock) y Ventas (para "Movimientos"):
-- sin esto, `postgres_changes` no manda ningún evento aunque la tabla exista.
alter publication supabase_realtime add table public.productos;
alter publication supabase_realtime add table public.ventas;
