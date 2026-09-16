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
}

const VACIO: Deteccion = { comercio: null, fecha: null, total: null, items: [] }

export async function leerComprobante(
  imagen: string,
  modo: 'ticket' | 'factura',
): Promise<ResultadoVision> {
  try {
    const res = await fetch('/api/vision', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imagen, modo }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const json = (await res.json()) as ResultadoVision
    return { fuente: json.fuente ?? 'simulado', datos: json.datos ?? VACIO }
  } catch {
    // Sin red la app no puede leer la foto, pero el flujo de carga manual sigue.
    return { fuente: 'simulado', datos: VACIO }
  }
}
