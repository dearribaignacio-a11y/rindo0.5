import Anthropic from '@anthropic-ai/sdk'

/**
 * Cliente de Claude para los Route Handlers.
 *
 * IMPORTANTE: este módulo sólo se importa desde `app/api/**` (código de
 * servidor). La clave nunca viaja al navegador. Si `ANTHROPIC_API_KEY` no está
 * cargada, `clienteIA()` devuelve null y cada endpoint lo avisa con un motivo
 * claro en vez de inventar datos.
 */

export const MODELO = 'claude-opus-5-5'

/**
 * Si el filtro de seguridad del modelo rechaza un pedido (pasa muy rara vez,
 * y a veces con pedidos inocentes), la API lo reintenta sola en el modelo que
 * Anthropic recomienda para ese caso en vez de devolvernos el rechazo.
 */
export const REINTENTO_EN_RECHAZO = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default',
} satisfies Pick<Anthropic.Beta.Messages.MessageCreateParamsNonStreaming, 'betas' | 'fallbacks'>

let cache: Anthropic | null = null

export function clienteIA(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!cache) cache = new Anthropic()
  return cache
}

/** Junta los bloques de texto de una respuesta de la Messages API. */
export function textoDe(mensaje: Anthropic.Beta.BetaMessage): string {
  return mensaje.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
}

/**
 * Extrae el primer objeto JSON de un texto.
 * Con salida estructurada el texto ya es JSON puro; esto igual tolera un
 * ```json … ``` alrededor por si algún día se usa sin esquema.
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
  return {
    mediaType: m[1].toLowerCase() as 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif',
    datos: m[2],
  }
}

/** Motivo legible (y status HTTP) para una falla al hablar con el modelo. */
export function motivoDeFalla(error: unknown): { mensaje: string; status: number } {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return {
      mensaje: 'La clave de IA configurada en el servidor no es válida. Revisá ANTHROPIC_API_KEY en Vercel.',
      status: 502,
    }
  }
  if (error instanceof Anthropic.RateLimitError) {
    return { mensaje: 'Hay mucha demanda en este momento. Probá de nuevo en unos segundos.', status: 503 }
  }
  if (error instanceof Anthropic.BadRequestError) {
    return { mensaje: 'La IA no pudo procesar este pedido. Probá con otra foto o reformulalo.', status: 502 }
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { mensaje: 'El servidor no pudo conectarse con la IA. Probá de nuevo.', status: 503 }
  }
  if (error instanceof Anthropic.APIError) {
    return { mensaje: 'La IA no está disponible en este momento. Probá de nuevo en un rato.', status: 503 }
  }
  return { mensaje: 'Algo falló del lado del servidor. Probá de nuevo.', status: 500 }
}

export const SIN_CLAVE =
  'La IA todavía no está activada: falta cargar ANTHROPIC_API_KEY en Vercel (Settings → Environment Variables) y volver a desplegar.'
