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
  /** Sólo facturas: producto del catálogo al que corresponde, o null si es
   *  nuevo. El comerciante lo puede cambiar antes de aplicar al stock. */
  productoId: string | null
}

export interface Deteccion {
  comercio: string | null
  fecha: string | null
  total: number | null
  items: ItemDetectado[]
}

export interface ResultadoVision {
  datos: Deteccion
  /**
   * Motivo para mostrar cuando la lectura no se pudo hacer (sin clave de IA,
   * sin red, foto ilegible…). En ese caso `datos` llega vacío y la pantalla
   * deja cargar todo a mano: nunca se muestran datos inventados.
   */
  error?: string
}

export interface ProductoParaMatchear {
  id: string
  nombre: string
  codigo?: string
}

const VACIO: Deteccion = { comercio: null, fecha: null, total: null, items: [] }

/** Leer una foto y esperar al modelo puede tardar; más de esto es una falla.
 *  Un poco más que el `maxDuration` del handler, para que gane su mensaje. */
const TIMEOUT_MS = 65_000

export async function leerComprobante(
  imagen: string,
  modo: 'ticket' | 'factura',
  catalogo?: ProductoParaMatchear[],
): Promise<ResultadoVision> {
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)

  try {
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imagen, modo, catalogo }),
      signal: abort.signal,
    })

    if (!res.ok) {
      const detalle = await res
        .json()
        .then((j: { error?: string }) => j?.error)
        .catch(() => undefined)
      return {
        datos: VACIO,
        error:
          detalle ??
          (res.status === 413
            ? 'La foto es muy grande. Probá con una más liviana.'
            : res.status === 504
              ? 'La lectura tardó demasiado. Probá de nuevo o cargalo a mano.'
              : 'No pudimos leer el comprobante. Cargalo a mano.'),
      }
    }

    const json = (await res.json()) as { datos?: Deteccion }
    const datos = json.datos ?? VACIO
    return {
      datos,
      error:
        datos.items.length === 0 && !datos.total
          ? 'No encontramos nada legible en la foto. Probá con más luz y el comprobante entero, o cargalo a mano.'
          : undefined,
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        datos: VACIO,
        error: 'La lectura tardó demasiado. Probá de nuevo o cargalo a mano.',
      }
    }
    return {
      datos: VACIO,
      error: 'Sin conexión: no pudimos leer la foto. Podés cargarlo a mano.',
    }
  } finally {
    clearTimeout(timer)
  }
}
