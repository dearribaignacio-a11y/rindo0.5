'use client'

/** Cliente del Route Handler `/api/vision`. Es el único punto por donde la app
 *  habla con el lector de comprobantes; si mañana cambia el proveedor, cambia
 *  el handler y esto queda igual. */

export interface ItemDetectado {
  nombre: string
  cantidad: number
  costo: number
  /** false = el modelo no lo leyó con confianza; la UI lo marca en amarillo. */
  confiable: boolean
}

export interface Deteccion {
  comercio: string | null
  fecha: string | null
  total: number | null
  items: ItemDetectado[]
}

export interface ResultadoVision {
  /** 'ia' = lo leyó un modelo real; 'simulado' = no hay clave configurada. */
  fuente: 'ia' | 'simulado'
  datos: Deteccion
  /**
   * Mensaje para mostrar cuando la lectura no se pudo hacer.
   *
   * Antes cualquier falla devolvía una detección vacía con
   * `fuente: 'simulado'`, así que la pantalla no podía distinguir "no hay red"
   * de "la foto no tenía nada legible": en los dos casos mostraba una lista
   * vacía sin explicar nada. La carga manual siempre sigue disponible, pero el
   * comerciante tiene que saber por qué la foto no sirvió.
   */
  error?: string
}

const VACIO: Deteccion = { comercio: null, fecha: null, total: null, items: [] }

/** Leer una foto y esperar al modelo puede tardar; más de esto es una falla. */
const TIMEOUT_MS = 45_000

export async function leerComprobante(
  imagen: string,
  modo: 'ticket' | 'factura',
): Promise<ResultadoVision> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imagen, modo }),
      signal: abort.signal,
    })

    if (!res.ok) {
      const detalle = await res
        .json()
        .then((j: { error?: string }) => j?.error)
        .catch(() => undefined)
      return {
        fuente: 'simulado',
        datos: VACIO,
        error:
          detalle ??
          (res.status === 413
            ? 'La foto es muy grande. Probá con una más liviana.'
            : 'No pudimos leer el comprobante. Cargalo a mano.'),
      }
    }

    const json = (await res.json()) as ResultadoVision
    return { fuente: json.fuente ?? 'simulado', datos: json.datos ?? VACIO }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        fuente: 'simulado',
        datos: VACIO,
        error: 'La lectura tardó demasiado. Probá de nuevo o cargalo a mano.',
      }
    }
    return {
      fuente: 'simulado',
      datos: VACIO,
      error: 'Sin conexión: no pudimos leer la foto. Podés cargarlo a mano.',
    }
  } finally {
    clearTimeout(timer)
  }
}
