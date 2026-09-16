import { NextResponse } from 'next/server'
import { MODELO, clienteIA, jsonDe, partirDataUrl, textoDe } from '@/lib/server/anthropic'

/**
 * Lectura de tickets (Hogar) y de facturas de proveedor (Comercial).
 *
 * Route Handler serverless de Next.js: no hay ningún servidor propio corriendo
 * de forma persistente, así que Vercel lo despliega como función sin
 * configuración extra.
 *
 * · Con `ANTHROPIC_API_KEY` cargada en Vercel → lee la foto de verdad.
 * · Sin la variable → devuelve una detección simulada coherente y marca
 *   `fuente: 'simulado'` para que la UI lo pueda avisar.
 */

export const runtime = 'nodejs'
/** Las fotos llegan en base64: el handler no se puede cachear. */
export const dynamic = 'force-dynamic'

type Modo = 'ticket' | 'factura'

interface ItemDetectado {
  nombre: string
  cantidad: number
  costo: number
  /** false cuando el modelo no pudo leerlo bien y hay que revisarlo a mano. */
  confiable: boolean
}

interface Deteccion {
  comercio: string | null
  fecha: string | null
  total: number | null
  items: ItemDetectado[]
}

const PROMPTS: Record<Modo, string> = {
  ticket: `Sos un lector de tickets de compra argentinos. Devolvés únicamente un objeto JSON, sin texto alrededor, con esta forma exacta:
{"comercio": string|null, "fecha": "yyyy-mm-dd"|null, "total": number|null, "items": [{"nombre": string, "cantidad": number, "costo": number, "confiable": boolean}]}
"costo" es el precio unitario en pesos, sin símbolo ni separadores. Si un renglón está borroso o dudoso, igual incluilo con "confiable": false. Si no podés leer el total, poné null.`,
  factura: `Sos un lector de facturas y remitos de proveedores argentinos. Devolvés únicamente un objeto JSON, sin texto alrededor, con esta forma exacta:
{"comercio": string|null, "fecha": "yyyy-mm-dd"|null, "total": number|null, "items": [{"nombre": string, "cantidad": number, "costo": number, "confiable": boolean}]}
"cantidad" son las unidades que ingresan al stock y "costo" el precio unitario de compra sin IVA discriminado si aparece por separado. Si un renglón está borroso o dudoso, igual incluilo con "confiable": false.`,
}

/** Detección de ejemplo para cuando no hay clave de IA configurada. */
function simular(modo: Modo): Deteccion {
  const hoy = new Date().toISOString().slice(0, 10)
  if (modo === 'ticket') {
    return {
      comercio: 'Supermercado del Centro',
      fecha: hoy,
      total: 48350,
      items: [
        { nombre: 'Leche entera 1L', cantidad: 2, costo: 1850, confiable: true },
        { nombre: 'Pan lactal', cantidad: 1, costo: 3200, confiable: true },
        { nombre: 'Fideos 500g', cantidad: 3, costo: 1500, confiable: true },
        { nombre: 'Yerba 1kg', cantidad: 1, costo: 4700, confiable: true },
        { nombre: 'Art. no identificado', cantidad: 1, costo: 0, confiable: false },
      ],
    }
  }
  return {
    comercio: 'Distribuidora Cuyo S.A.',
    fecha: hoy,
    total: 186400,
    items: [
      { nombre: 'Gaseosa 2,25L', cantidad: 24, costo: 2600, confiable: true },
      { nombre: 'Yerba 1kg', cantidad: 12, costo: 3200, confiable: true },
      { nombre: 'Aceite girasol 900ml', cantidad: 12, costo: 2400, confiable: true },
      { nombre: 'Papel higiénico x4', cantidad: 10, costo: 2800, confiable: true },
      { nombre: 'Renglón ilegible', cantidad: 1, costo: 0, confiable: false },
    ],
  }
}

export async function POST(request: Request) {
  let cuerpo: { imagen?: string; modo?: Modo }
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const modo: Modo = cuerpo.modo === 'factura' ? 'factura' : 'ticket'
  const cliente = clienteIA()

  // Sin clave configurada: la interfaz sigue siendo completamente funcional
  // contra datos de ejemplo.
  if (!cliente) {
    return NextResponse.json({ fuente: 'simulado', datos: simular(modo) })
  }

  const imagen = cuerpo.imagen ? partirDataUrl(cuerpo.imagen) : null
  if (!imagen) {
    return NextResponse.json({ error: 'Se esperaba una imagen en dataURL' }, { status: 400 })
  }

  try {
    const respuesta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 8000,
      // Extracción estructurada y acotada: no necesita razonamiento profundo,
      // y bajar el esfuerzo acorta bastante la espera del usuario.
      output_config: { effort: 'low' },
      system: PROMPTS[modo],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imagen.mediaType, data: imagen.datos },
            },
            { type: 'text', text: 'Leé este comprobante y devolvé el JSON.' },
          ],
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') {
      return NextResponse.json({ fuente: 'simulado', datos: simular(modo) })
    }

    const datos = jsonDe<Deteccion>(textoDe(respuesta))
    if (!datos || !Array.isArray(datos.items)) {
      return NextResponse.json({ fuente: 'simulado', datos: simular(modo) })
    }

    // Saneado: la UI asume números, no strings.
    datos.items = datos.items.map((i) => ({
      nombre: String(i.nombre ?? '').slice(0, 80) || 'Sin nombre',
      cantidad: Math.max(1, Math.round(Number(i.cantidad) || 1)),
      costo: Math.max(0, Math.round(Number(i.costo) || 0)),
      confiable: i.confiable !== false && Number(i.costo) > 0,
    }))

    return NextResponse.json({ fuente: 'ia', datos })
  } catch (error) {
    console.error('[vision]', error)
    // Un fallo del proveedor no puede dejar al usuario sin poder cargar nada.
    return NextResponse.json({ fuente: 'simulado', datos: simular(modo) })
  }
}
