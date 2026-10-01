import { createClient } from './client'

/** Bucket privado creado en la migración 0012. */
const BUCKET = 'envios-contador'

/** El link que recibe el contador deja de funcionar a los 7 días. */
export const VENCIMIENTO_LINK_SEG = 7 * 24 * 60 * 60

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Sube el Excel a la carpeta de la cuenta y devuelve un link firmado de
 * descarga que vence a los 7 días. El bucket es privado: sin este link nadie
 * puede bajar el archivo, ni siquiera conociendo la ruta.
 */
export async function subirEnvio(archivo: Blob, nombre: string): Promise<string> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa')

  // Marca de tiempo adelante: dos envíos del mismo mes no se pisan.
  const ruta = `${user.id}/${Date.now()}-${nombre}`
  const subida = await supabase.storage.from(BUCKET).upload(ruta, archivo, {
    contentType: XLSX_MIME,
    upsert: false,
  })
  if (subida.error) throw subida.error

  // `download` hace que el link baje el archivo con su nombre en vez de la ruta interna.
  const firma = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, VENCIMIENTO_LINK_SEG, { download: nombre })
  if (firma.error || !firma.data) throw firma.error ?? new Error('No se pudo generar el link')
  return firma.data.signedUrl
}
