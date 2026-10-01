-- Rindo — "Enviar al contador". Correr en el SQL Editor de Supabase,
-- después de 0011.
--
-- 1) Datos de la factura que el Excel del contador necesita y hoy no se
--    guardaban: proveedor, número de comprobante y la foto. Son opcionales:
--    las reposiciones ya cargadas quedan con null.

alter table public.reposiciones
  add column if not exists proveedor text,
  add column if not exists comprobante text,
  add column if not exists foto text;

-- 2) Bucket PRIVADO para los Excel que se mandan por WhatsApp. Nadie puede
--    leer un archivo por su ruta: el contador lo baja con un link firmado que
--    vence a los 7 días (ver `lib/supabase/envios.ts`). Límite de 10 MB y
--    sólo .xlsx.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'envios-contador',
  'envios-contador',
  false,
  10485760,
  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
)
on conflict (id) do nothing;

-- Cada cuenta sube y lee sólo dentro de su carpeta (`<user_id>/archivo`).
-- Leer hace falta para que la propia cuenta pueda firmar el link.

create policy "envios-contador: subir a la carpeta propia"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'envios-contador'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "envios-contador: leer la carpeta propia"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'envios-contador'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
