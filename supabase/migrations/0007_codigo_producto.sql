-- Rindo — Código corto por producto y subcategoría.
--
-- `codigo`: número corto (hasta 3 cifras) que Rindo le asigna solo a cada
-- producto al crearlo — sirve para venderlo más rápido y para que el
-- asistente de ventas lo identifique sin ambigüedad en vez de adivinar por
-- nombre. Los productos que ya existían quedan sin código hasta la próxima
-- vez que se editen (se les asigna uno recién ahí, ver lib/codigos.ts).
--
-- `subcategoria`: catálogo de dos niveles — `categoria` sigue siendo la
-- "categoría grande" (Almacén, Bebidas, Fiambres...) y `subcategoria` es la
-- que arma cada comerciante debajo de una categoría puntual (ej. "Bebidas" >
-- "Bebidas blancas"). No hace falta una tabla aparte: son dos columnas de
-- texto libre en el propio producto, y la UI arma la jerarquía sugiriendo
-- las subcategorías ya usadas dentro de la categoría elegida.

alter table public.productos add column if not exists codigo text;
alter table public.productos add column if not exists subcategoria text;

-- Único por cuenta (no global): dos comerciantes distintos pueden usar el
-- mismo código para cosas distintas. Parcial porque `codigo` es opcional —
-- un índice único normal rechazaría más de un NULL.
create unique index if not exists productos_user_id_codigo_idx
  on public.productos (user_id, codigo)
  where codigo is not null;
