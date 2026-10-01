-- Rindo — código de barras real (EAN/UPC) por producto, para vender
-- escaneándolo con un lector en vez de buscarlo por nombre. Es un campo
-- aparte de `codigo` (el número cortito que Rindo asigna solo): el código de
-- barras lo trae impreso el producto de fábrica y lo carga el comerciante a
-- mano, una vez por producto.

alter table public.productos add column if not exists codigo_barras text;

-- Único por cuenta: dos comerciantes distintos pueden tener productos con el
-- mismo código de barras (por ejemplo si venden la misma marca). Parcial
-- porque el campo es opcional.
create unique index if not exists productos_user_id_codigo_barras_idx
  on public.productos (user_id, codigo_barras)
  where codigo_barras is not null;
