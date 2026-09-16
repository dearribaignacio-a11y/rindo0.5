'use client'

/** Cliente del Route Handler `/api/asistente`. Único punto por donde la app
 *  habla con el asistente; si cambia el proveedor, cambia el handler. */

export interface LineaConfirmacion {
  etiqueta: string
  valor: string
}

export interface Confirmacion {
  titulo: string
  lineas: LineaConfirmacion[]
}

/** Operación aplicable a los datos. Referencia productos por id: el cliente
 *  recalcula precios contra su propio catálogo antes de guardar. */
export interface Operacion {
  tipo: 'venta'
  items: { productoId: string; cantidad: number }[]
}

export interface ContextoAsistente {
  negocio?: string
  productos?: { id: string; nombre: string; precio: number; stock: number }[]
  ventasHoy?: number
  ticketsHoy?: number
}

export type RespuestaAsistente =
  | {
      ok: true
      /** 'ia' = respondió un modelo real; 'simulado' = no hay clave configurada. */
      fuente: 'ia' | 'simulado'
      texto: string
      confirmacion?: Confirmacion
      operacion?: Operacion
    }
  | { ok: false; error: string }

/** Si el servidor no responde en este plazo, cortamos y avisamos. Sin esto la
 *  burbuja de "escribiendo…" se queda girando para siempre. */
const TIMEOUT_MS = 20_000

export async function preguntarAlAsistente(
  mensaje: string,
  contexto: ContextoAsistente,
): Promise<RespuestaAsistente> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('/api/asistente', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mensaje, contexto }),
      signal: abort.signal,
    })

    if (!res.ok) {
      // Los 4xx del handler traen un motivo legible; los 5xx no.
      const detalle = await res
        .json()
        .then((j: { error?: string }) => j?.error)
        .catch(() => undefined)
      return {
        ok: false,
        error:
          detalle ??
          (res.status >= 500
            ? 'El asistente no está disponible en este momento. Probá de nuevo en un rato.'
            : 'No pudimos procesar el mensaje.'),
      }
    }

    const json = (await res.json()) as {
      fuente?: 'ia' | 'simulado'
      texto?: string
      confirmacion?: Confirmacion
      operacion?: Operacion
    }

    if (!json?.texto) {
      return { ok: false, error: 'El asistente devolvió una respuesta vacía.' }
    }

    return {
      ok: true,
      fuente: json.fuente ?? 'simulado',
      texto: json.texto,
      confirmacion: json.confirmacion,
      operacion: json.operacion,
    }
  } catch (error) {
    // Distinguir el corte por tiempo de la falta de red: son dos problemas
    // distintos y el comerciante puede hacer algo distinto con cada uno.
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { ok: false, error: 'El asistente tardó demasiado en responder. Probá de nuevo.' }
    }
    return { ok: false, error: 'Sin conexión. Revisá la red y volvé a intentar.' }
  } finally {
    clearTimeout(timer)
  }
}
