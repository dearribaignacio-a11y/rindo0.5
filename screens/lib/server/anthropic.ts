import Anthropic from '@anthropic-ai/sdk'

/**
 * Cliente de Claude para los Route Handlers.
 *
 * IMPORTANTE: este módulo sólo se importa desde `app/api/**` (código de
 * servidor). La clave nunca viaja al navegador. Si `ANTHROPIC_API_KEY` no está
 * cargada, `clienteIA()` devuelve null y cada endpoint responde con su
 * simulación — la app funciona en Vercel sin ninguna variable de entorno.
 */

export const MODELO = 'claude-opus-5'

let cache: Anthropic | null = null

export function clienteIA(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cache) cache = new Anthropic()
  return cache
}

/** Junta los bloques de texto de una respuesta de la Messages API. */
export function textoDe(mensaje: Anthropic.Message): string {
  return mensaje.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/**
 * Extrae el primer objeto JSON de un texto.
 * El modelo puede envolver la respuesta en ```json … ```; esto lo tolera sin
 * depender de un formato exacto.
 */
export function jsonDe<T>(texto: string): T | null {
  const limpio = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const desde = limpio.indexOf('{')
  const hasta = limpio.lastIndexOf('}')
  if (desde === -1 || hasta <= desde) return null
  try {
    return JSON.parse(limpio.slice(desde, hasta + 1)) as T
  } catch {
    return null
  }
}

/** Separa un dataURL en su media type y su base64. */
export function partirDataUrl(dataUrl: string) {
  const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/i.exec(dataUrl)
  if (!m) return null
  return { mediaType: m[1] as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif', datos: m[2] }
}
