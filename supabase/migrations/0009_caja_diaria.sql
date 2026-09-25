-- Rindo — apertura de caja diaria: con cuánto efectivo arranca el día el
-- comercio, para poder mostrar después "deberías tener $X en la caja"
-- sumando ese monto a las ventas en efectivo del día (ver lib/calc.ts).
-- Una fila por día por cuenta — `unique (user_id, fecha)` hace que guardarla
-- de nuevo el mismo día actualice en vez de duplicar.

create table if not exists public.aperturas_caja (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fecha date not null,
  monto_inicial numeric not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, fecha)
);

create index if not exists aperturas_caja_user_id_idx on public.aperturas_caja (user_id);

alter table public.aperturas_caja enable row level security;

create policy "aperturas_caja: leer las propias"
  on public.aperturas_caja for select
  using (auth.uid() = user_id);

create policy "aperturas_caja: crear las propias"
  on public.aperturas_caja for insert
  with check (auth.uid() = user_id);

create policy "aperturas_caja: actualizar las propias"
  on public.aperturas_caja for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
