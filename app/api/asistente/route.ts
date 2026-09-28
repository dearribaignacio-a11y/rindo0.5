import { NextResponse } from 'next/server'
import type Anthropic from '@anthropic-ai/sdk'
import {
  MODELO,
  REINTENTO_EN_RECHAZO,
  clienteIA,
  jsonDe,
  motivoDeFalla,
  textoDe,
} from '@/lib/server/anthropic'

/**
 * Asistente por chat del plan Comercial.
 *
 * Igual que `/api/vision`: Route Handler serverless, con la clave del lado del
 * servidor. Recibe la conversación entera (no sólo el último mensaje), así se
 * puede charlar de verdad: "¿y ayer?", "sumale otra", "¿por qué?" se entienden
 * por lo que se dijo antes.
 *
 * Sin clave configurada responde con un modo básico por reglas y lo marca
 * como `fuente: 'simulado'`, para que la pantalla avise que la IA no está
 * activa. Si hay clave y el modelo falla, devuelve el error: nunca cambia en
 * silencio a respuestas por reglas haciéndolas pasar por la IA.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Cuántos mensajes previos de la charla se mandan al modelo. */
const MAX_HISTORIAL = 30

interface Contexto {
  negocio?: string
  fecha?: string
  productos?: {
    id: string
    nombre: string
    codigo?: string
    categoria?: string
    precio: number
    costo?: number
    stock: number
    stockMin?: number
  }[]
  ventasHoy?: number
  ticketsHoy?: number
  /** Ventas de los últimos días, para preguntas como "¿cómo vengo esta semana?". */
  ultimosDias?: { dia: string; total: number; tickets: number }[]
  /** Más vendidos del mes: unidades y facturado. */
  masVendidosMes?: { nombre: string; unidades: number; facturado: number }[]
  ventasMes?: number
}

interface MensajeChat {
  rol: 'usuario' | 'asistente'
  texto: string
}

type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'
const METODOS: MetodoPago[] = ['efectivo', 'tarjeta', 'transferencia']
const ETIQUETA_METODO: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

/**
 * Operación que el asistente propone aplicar sobre los datos.
 *
 * Va aparte de `confirmacion` a propósito: esa es la versión para mostrar
 * (etiquetas y valores ya formateados como "$1.500") y no sirve para escribir
 * en la base — habría que volver a parsear moneda desde un string. Esto, en
 * cambio, referencia productos por id y cantidades como números, y el cliente
 * recalcula precios y total contra su propio catálogo antes de guardar.
 */
interface Operacion {
  tipo: 'venta'
  items: { productoId: string; cantidad: number }[]
  /** Efectivo si no se dice nada — es lo más común en el mostrador y así no
   *  hace falta preguntarlo siempre. */
  metodo: MetodoPago
}

interface Respuesta {
  texto: string
  /** Tarjeta de confirmación embebida, cuando el pedido implica registrar algo. */
  confirmacion?: {
    titulo: string
    lineas: { etiqueta: string; valor: string }[]
  }
  operacion?: Operacion
}

/**
 * Sólo deja pasar operaciones cuyos productos existen en el contexto que nos
 * mandó el cliente, con cantidades enteras y positivas. El modelo puede
 * alucinar un id; si lo hiciera, la tarjeta de confirmación se muestra sin
 * acción aplicable en vez de escribir basura.
 */
function operacionValida(op: unknown, ctx: Contexto): Operacion | undefined {
  if (!op || typeof op !== 'object') return undefined
  const o = op as Partial<Operacion>
  if (o.tipo !== 'venta' || !Array.isArray(o.items) || o.items.length === 0) return undefined

  const validos = new Set((ctx.productos ?? []).map((p) => p.id))
  const items = o.items
    .filter(
      (i): i is { productoId: string; cantidad: number } =>
        !!i &&
        typeof i.productoId === 'string' &&
        validos.has(i.productoId) &&
        Number.isFinite(i.cantidad) &&
        i.cantidad > 0,
    )
    .map((i) => ({ productoId: i.productoId, cantidad: Math.floor(i.cantidad) }))
    .filter((i) => i.cantidad > 0)

  const metodo = METODOS.includes(o.metodo as MetodoPago) ? (o.metodo as MetodoPago) : 'efectivo'

  return items.length ? { tipo: 'venta', items, metodo } : undefined
}

const SISTEMA = `Sos el asistente de Rindo, una app de gestión para comercios chicos de San Juan, Argentina. Charlás con el dueño o el empleado del comercio, que te escribe o te habla por voz desde el celular (los mensajes dictados pueden venir con errores de transcripción: interpretalos con sentido común).
Hablás en español rioplatense, en segunda persona ("vos"), cálido y directo. Respondés corto (una a cuatro oraciones) porque la respuesta se puede leer en voz alta; si te piden detalle o una lista, podés extenderte un poco. No uses markdown, asteriscos ni viñetas: texto plano.

Podés:
- Registrar ventas de productos del catálogo (con confirmación del usuario).
- Responder cómo viene el negocio (hoy, la semana, el mes), qué se vende más, stock, qué reponer, márgenes y precios, usando SÓLO los datos del contexto.
- Charlar y dar consejos prácticos de gestión de un comercio chico.
Recordás lo que se habló antes en la conversación: "sumale otra", "¿y ayer?", "cambialo a tarjeta" se refieren a lo anterior.

Formato de respuesta: "texto" es lo que le decís al usuario.
Usás "confirmacion" solamente cuando el usuario pide registrar una venta concreta: ahí resumís lo entendido en líneas cortas (Producto, Cantidad, Precio unitario, Total, Método de pago) para que lo confirme antes de impactar los datos. Si la venta tiene varios productos, una línea por producto con "cantidad × precio" y al final Total y Método de pago. Para todo lo demás, "confirmacion" y "operacion" van en null.
Cuando la operación es una venta, además de "confirmacion" completás "operacion" con el "id" EXACTO de cada producto tal como figura en el contexto y la cantidad como número entero. No inventes ids: si no encontrás el producto en el catálogo, dejá "operacion" en null y preguntá en "texto" cuál es.
Si el usuario corrige una venta que propusiste antes y todavía no confirmó ("no, eran dos"), devolvé la venta completa corregida.
Algunos productos traen "codigo", un código corto que el comerciante les asignó (ej. "20" para el Fernet). Si el mensaje menciona un número o código corto (típico al dictar rápido: "20, uno" = un Fernet), priorizá matchear por "codigo" exacto antes que por nombre.
En "metodo" va cómo pagaron: "tarjeta" para tarjeta/débito/crédito/posnet, "transferencia" para transferencia/QR/Mercado Pago/alias/CBU, "efectivo" para efectivo o si no se menciona.
Nunca inventás cifras que no estén en el contexto. Si algo no está en los datos, decilo.`

/** Salida estructurada: la API garantiza que la respuesta cumple el esquema. */
const ESQUEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['texto', 'confirmacion', 'operacion'],
  properties: {
    texto: { type: 'string' },
    confirmacion: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['titulo', 'lineas'],
          properties: {
            titulo: { type: 'string' },
            lineas: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['etiqueta', 'valor'],
                properties: { etiqueta: { type: 'string' }, valor: { type: 'string' } },
              },
            },
          },
        },
      ],
    },
    operacion: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['tipo', 'items', 'metodo'],
          properties: {
            tipo: { type: 'string', enum: ['venta'] },
            items: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['productoId', 'cantidad'],
                properties: { productoId: { type: 'string' }, cantidad: { type: 'integer' } },
              },
            },
            metodo: { type: 'string', enum: METODOS },
          },
        },
      ],
    },
  },
}

/**
 * Arma la conversación para la Messages API: tiene que empezar con el usuario
 * y alternar roles. Los datos del negocio van en el ÚLTIMO mensaje, así están
 * frescos en cada turno y el resto de la charla queda igual entre pedidos.
 */
function armarConversacion(historial: MensajeChat[], contexto: Contexto): Anthropic.Beta.BetaMessageParam[] {
  const mensajes: Anthropic.Beta.BetaMessageParam[] = []
  for (const m of historial) {
    const role = m.rol === 'asistente' ? 'assistant' : 'user'
    if (mensajes.length === 0 && role === 'assistant') continue
    const previo = mensajes[mensajes.length - 1]
    if (previo && previo.role === role) {
      previo.content = `${previo.content as string}\n\n${m.texto}`
    } else {
      mensajes.push({ role, content: m.texto })
    }
  }

  const ultimo = mensajes[mensajes.length - 1]
  const datos = `Datos actuales del negocio (JSON):\n${JSON.stringify(contexto).slice(0, 24_000)}`
  ultimo.content = `${datos}\n\nMensaje del usuario:\n${ultimo.content as string}`
  return mensajes
}

const PESOS = (n: number) => `$${n.toLocaleString('es-AR')}`

/** Efectivo por defecto si no se menciona nada — es lo más común y así no
 *  hace falta preguntarlo en cada venta. */
function detectarMetodo(texto: string): MetodoPago {
  if (/tarjeta|d[eé]bito|cr[eé]dito|posnet|point/.test(texto)) return 'tarjeta'
  if (/transferencia|\bqr\b|mercado ?pago|\bmp\b|alias|cbu/.test(texto)) return 'transferencia'
  return 'efectivo'
}

/**
 * Simulación por reglas. Cubre los tres pedidos más frecuentes del mostrador:
 * registrar una venta, preguntar cuánto se vendió y consultar stock.
 */
function simular(mensaje: string, ctx: Contexto): Respuesta {
  const texto = mensaje.toLowerCase()
  const productos = ctx.productos ?? []

  const nombrado = productos.find((p) => texto.includes(p.nombre.toLowerCase().split(' ')[0]))
  const cantidad = Number(/(\d+)/.exec(texto)?.[1] ?? 1)
  const metodo = detectarMetodo(texto)

  /* La consulta va ANTES de la venta a propósito. "¿Cuánto vendí hoy?"
     contiene "vendí" y caía en la rama de registrar una venta: el asistente
     respondía pidiendo el nombre del producto en vez de contestar la pregunta.
     Una pregunta por un total nunca es una orden de registrar algo. */
  if (/cu[aá]nt[oa]|c[oó]mo (vengo|voy|vamos)|ventas? de hoy|factur/.test(texto)) {
    const total = ctx.ventasHoy ?? 0
    const tickets = ctx.ticketsHoy ?? 0
    return {
      texto:
        tickets > 0
          ? `Hoy llevás ${PESOS(total)} en ${tickets} ${tickets === 1 ? 'ticket' : 'tickets'}, con un promedio de ${PESOS(Math.round(total / tickets))} por venta.`
          : 'Todavía no hay ventas cargadas hoy.',
    }
  }

  if (/vend[ií]|salió|se llevó|cobr[ée]/.test(texto)) {
    if (!nombrado) {
      return {
        texto: 'Te entendí que fue una venta, pero no reconozco el producto. ¿Cómo se llama en tu catálogo?',
      }
    }
    const total = nombrado.precio * cantidad
    return {
      texto: `Anoté una venta de ${cantidad} × ${nombrado.nombre}. Revisá que esté bien y confirmá.`,
      confirmacion: {
        titulo: 'Registrar venta',
        lineas: [
          { etiqueta: 'Producto', valor: nombrado.nombre },
          { etiqueta: 'Cantidad', valor: String(cantidad) },
          { etiqueta: 'Precio unitario', valor: PESOS(nombrado.precio) },
          { etiqueta: 'Total', valor: PESOS(total) },
          { etiqueta: 'Método de pago', valor: ETIQUETA_METODO[metodo] },
        ],
      },
      operacion: { tipo: 'venta', items: [{ productoId: nombrado.id, cantidad }], metodo },
    }
  }

  if (/stock|queda|reponer|falta/.test(texto)) {
    if (nombrado) {
      return {
        texto: `De ${nombrado.nombre} te quedan ${nombrado.stock} unidades.`,
      }
    }
    const bajos = productos.filter((p) => p.stock <= 5).slice(0, 3)
    return {
      texto: bajos.length
        ? `Lo que está más justo: ${bajos.map((p) => `${p.nombre} (${p.stock})`).join(', ')}.`
        : 'No veo faltantes urgentes en el stock.',
    }
  }

  return {
    texto:
      'Puedo anotarte una venta ("vendí 3 gaseosas"), decirte cómo venís hoy o revisar el stock de un producto. ¿Qué necesitás?',
  }
}

export async function POST(request: Request) {
  let cuerpo: { mensajes?: MensajeChat[]; mensaje?: string; contexto?: Contexto }
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // `mensaje` suelto queda por compatibilidad con clientes viejos cacheados.
  const historial: MensajeChat[] = (
    Array.isArray(cuerpo.mensajes) ? cuerpo.mensajes : cuerpo.mensaje ? [{ rol: 'usuario', texto: cuerpo.mensaje }] : []
  )
    .filter(
      (m): m is MensajeChat =>
        !!m && (m.rol === 'usuario' || m.rol === 'asistente') && typeof m.texto === 'string' && !!m.texto.trim(),
    )
    .map((m) => ({ rol: m.rol, texto: m.texto.trim().slice(0, 2000) }))
    .slice(-MAX_HISTORIAL)

  const ultimo = historial[historial.length - 1]
  if (!ultimo || ultimo.rol !== 'usuario') {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })
  }
  const contexto = cuerpo.contexto ?? {}

  const cliente = clienteIA()
  if (!cliente) {
    return NextResponse.json({ fuente: 'simulado', ...simular(ultimo.texto, contexto) })
  }

  try {
    const respuesta = await cliente.beta.messages.create({
      ...REINTENTO_EN_RECHAZO,
      model: MODELO,
      max_tokens: 8000,
      // Charla de mostrador: la velocidad pesa más que el razonamiento largo,
      // sobre todo cuando la respuesta se escucha en voz alta.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: ESQUEMA } },
      system: SISTEMA,
      messages: armarConversacion(historial, contexto),
    })

    if (respuesta.stop_reason === 'refusal') {
      return NextResponse.json({
        fuente: 'ia',
        texto: 'Eso no te lo puedo responder. ¿Te ayudo con algo del negocio?',
      })
    }

    const datos = jsonDe<Respuesta>(textoDe(respuesta))
    if (!datos?.texto) {
      return NextResponse.json(
        { error: 'El asistente no pudo armar una respuesta. Probá de nuevo.' },
        { status: 502 },
      )
    }

    return NextResponse.json({
      fuente: 'ia',
      texto: datos.texto,
      confirmacion: datos.confirmacion ?? undefined,
      operacion: operacionValida(datos.operacion, contexto),
    })
  } catch (error) {
    console.error('[asistente]', error)
    const { mensaje, status } = motivoDeFalla(error)
    return NextResponse.json({ error: mensaje }, { status })
  }
}
