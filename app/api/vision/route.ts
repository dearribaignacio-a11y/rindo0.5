import { NextResponse } from 'next/server'
import {
  MODELO,
  REINTENTO_EN_RECHAZO,
  SIN_CLAVE,
  clienteIA,
  jsonDe,
  motivoDeFalla,
  partirDataUrl,
  textoDe,
} from '@/lib/server/anthropic'

/**
 * Lectura de tickets (Hogar) y de facturas de proveedor (Comercial).
 *
 * Route Handler serverless de Next.js: no hay ningún servidor propio corriendo
 * de forma persistente, así que Vercel lo despliega como función sin
 * configuración extra.
 *
 * · Con `ANTHROPIC_API_KEY` cargada en Vercel → lee la foto de verdad.
 * · Sin la variable, o si la lectura falla → responde un error con el motivo.
 *
 * Antes, cualquier falla devolvía una detección de EJEMPLO ("Supermercado del
 * Centro", "Distribuidora Cuyo") que la pantalla mostraba como si fuera la
 * foto: el ticket real nunca se cargaba y, en el comercio, confirmar esa
 * factura inventada metía stock falso. Ahora no se inventa nada: o se lee la
 * foto, o se explica por qué no y queda la carga a mano.
 */

export const runtime = 'nodejs'
/** Las fotos llegan en base64: el handler no se puede cachear. */
export const dynamic = 'force-dynamic'
/** Leer una foto con el modelo tarda más que los 10 s que Vercel da por
 *  defecto en algunos proyectos; sin esto la función se cortaba a mitad. */
export const maxDuration = 60

type Modo = 'ticket' | 'factura'

interface ProductoCatalogo {
  id: string
  nombre: string
  codigo?: string
}

interface ItemDetectado {
  nombre: string
  cantidad: number
  costo: number
  /** false cuando el modelo no pudo leerlo bien y hay que revisarlo a mano. */
  confiable: boolean
  /** Sólo facturas: producto del catálogo al que corresponde el renglón. */
  productoId: string | null
}

interface Deteccion {
  comercio: string | null
  fecha: string | null
  total: number | null
  items: ItemDetectado[]
}

/** Salida estructurada: la API garantiza que la respuesta cumple este esquema,
 *  así no dependemos de que el modelo "se acuerde" del formato. */
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['comercio', 'fecha', 'total', 'items'],
  properties: {
    comercio: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    fecha: { anyOf: [{ type: 'string', format: 'date' }, { type: 'null' }] },
    total: { anyOf: [{ type: 'number' }, { type: 'null' }] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['nombre', 'cantidad', 'costo', 'confiable', 'productoId'],
        properties: {
          nombre: { type: 'string' },
          cantidad: { type: 'number' },
          costo: { type: 'number' },
          confiable: { type: 'boolean' },
          productoId: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
  },
}

const PROMPTS: Record<Modo, string> = {
  ticket: `Sos un lector de tickets de compra argentinos. Leés la foto y devolvés el comercio, la fecha (yyyy-mm-dd), el total y cada renglón del ticket.
"costo" es el precio UNITARIO en pesos, como número (sin símbolo ni separadores de miles; los centavos van con punto decimal). "cantidad" es la cantidad comprada; si el renglón es por peso (ej. 0,450 kg), usá 1 y poné en "costo" el importe del renglón.
Ignorá subtotales, descuentos generales, vueltos y medios de pago como renglones: el "total" es lo que se pagó al final.
Si un renglón está borroso o dudoso, incluilo igual con "confiable": false. Si no se lee el total, poné null. "productoId" siempre null.
Si la imagen no es un ticket o no tiene nada legible, devolvé "items" vacío y el resto en null.`,
  factura: `Sos un lector de facturas y remitos de proveedores argentinos para cargar stock. Leés la foto y devolvés el proveedor (en "comercio"), la fecha (yyyy-mm-dd), el total y cada renglón de mercadería.
"cantidad" son las UNIDADES que entran al stock: si el renglón dice bultos o cajas y aclara cuántas unidades trae cada uno (ej. "caja x 12"), multiplicá. "costo" es el precio unitario de compra por unidad, como número, sin IVA si el IVA aparece discriminado aparte.
Ignorá renglones que no son mercadería (IVA, percepciones, fletes, subtotales).
Si un renglón está borroso o dudoso, incluilo igual con "confiable": false.
Te paso el catálogo del comercio. Para cada renglón, si corresponde claramente a un producto del catálogo (mismo producto aunque esté escrito distinto, ej. "YERBA PLAYADITO 1KG" = "Yerba 1kg"), poné su "id" EXACTO en "productoId". Si no estás seguro o es un producto nuevo, poné null. Nunca inventes ids.
Si la imagen no es una factura o no tiene nada legible, devolvé "items" vacío y el resto en null.`,
}

export async function POST(request: Request) {
  let cuerpo: { imagen?: string; modo?: Modo; catalogo?: ProductoCatalogo[] }
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const modo: Modo = cuerpo.modo === 'factura' ? 'factura' : 'ticket'

  const imagen = cuerpo.imagen ? partirDataUrl(cuerpo.imagen) : null
  if (!imagen) {
    return NextResponse.json(
      { error: 'No pudimos abrir esa imagen. Probá sacando la foto de nuevo o con una JPG/PNG.' },
      { status: 400 },
    )
  }

  const cliente = clienteIA()
  if (!cliente) return NextResponse.json({ error: SIN_CLAVE }, { status: 503 })

  const catalogo = modo === 'factura' && Array.isArray(cuerpo.catalogo) ? cuerpo.catalogo.slice(0, 800) : []
  const idsValidos = new Set(catalogo.map((p) => p.id))

  const instruccion =
    modo === 'factura' && catalogo.length
      ? `Catálogo del comercio (JSON):\n${JSON.stringify(
          catalogo.map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo })),
        )}\n\nLeé esta factura.`
      : modo === 'factura'
        ? 'El comercio todavía no tiene productos cargados. Leé esta factura.'
        : 'Leé este ticket.'

  try {
    const respuesta = await cliente.beta.messages.create({
      ...REINTENTO_EN_RECHAZO,
      model: MODELO,
      max_tokens: 16000,
      // Extracción acotada: no necesita razonamiento profundo, y bajar el
      // esfuerzo acorta bastante la espera del usuario.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      system: PROMPTS[modo],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: imagen.mediaType, data: imagen.datos },
            },
            { type: 'text', text: instruccion },
          ],
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'La IA no pudo leer esta foto. Cargala a mano o probá con otra.' },
        { status: 422 },
      )
    }

    const datos = jsonDe<Deteccion>(textoDe(respuesta))
    if (!datos || !Array.isArray(datos.items)) {
      return NextResponse.json(
        { error: 'No pudimos interpretar la lectura. Probá de nuevo con más luz.' },
        { status: 502 },
      )
    }

    // Saneado: la UI asume números enteros de pesos y ids que existen.
    const items = datos.items
      .map((i) => ({
        nombre: String(i.nombre ?? '').trim().slice(0, 80) || 'Sin nombre',
        cantidad: Math.max(1, Math.round(Number(i.cantidad) || 1)),
        costo: Math.max(0, Math.round(Number(i.costo) || 0)),
        confiable: i.confiable !== false && Number(i.costo) > 0,
        productoId: typeof i.productoId === 'string' && idsValidos.has(i.productoId) ? i.productoId : null,
      }))
      .slice(0, 200)

    const total = Number(datos.total)

    return NextResponse.json({
      fuente: 'ia',
      datos: {
        comercio: datos.comercio?.trim() || null,
        fecha: typeof datos.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(datos.fecha) ? datos.fecha : null,
        total: Number.isFinite(total) && total > 0 ? Math.round(total) : null,
        items,
      } satisfies Deteccion,
    })
  } catch (error) {
    console.error('[vision]', error)
    const { mensaje, status } = motivoDeFalla(error)
    return NextResponse.json({ error: mensaje }, { status })
  }
}
