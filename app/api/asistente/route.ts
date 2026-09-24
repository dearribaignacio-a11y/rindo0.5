import { NextResponse } from 'next/server'
import { MODELO, clienteIA, jsonDe, textoDe } from '@/lib/server/anthropic'

/**
 * Asistente por chat del plan Comercial.
 *
 * Igual que `/api/vision`: Route Handler serverless, con la clave del lado del
 * servidor y una simulación por reglas cuando no está configurada. La UI del
 * chat no distingue entre las dos: consume siempre esta misma respuesta.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Contexto {
  negocio?: string
  productos?: { id: string; nombre: string; codigo?: string; precio: number; stock: number }[]
  ventasHoy?: number
  ticketsHoy?: number
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

  return items.length ? { tipo: 'venta', items } : undefined
}

const SISTEMA = `Sos el asistente de Rindo, una app de gestión para comercios chicos de San Juan, Argentina.
Hablás en español rioplatense, en segunda persona ("vos"), en tono directo y breve: dos o tres oraciones como máximo.

Devolvés SIEMPRE un único objeto JSON, sin texto alrededor, con esta forma:
{"texto": string, "confirmacion": {"titulo": string, "lineas": [{"etiqueta": string, "valor": string}]} | null, "operacion": {"tipo": "venta", "items": [{"productoId": string, "cantidad": number}]} | null}

Usás "confirmacion" solamente cuando el usuario pide registrar algo concreto (una venta, una reposición, un gasto): ahí resumís lo entendido en líneas cortas para que lo confirme antes de impactar los datos. Para preguntas de consulta, "confirmacion" va en null.

Cuando la operación es una venta de productos del catálogo, además de "confirmacion" completás "operacion" con el "id" EXACTO de cada producto tal como figura en el contexto y la cantidad como número entero. No inventes ids: si no encontrás el producto en el contexto, dejá "operacion" en null y pedí el nombre en "texto".
Algunos productos del contexto traen "codigo", un código corto que el comerciante les asignó (ej. "20" para el Fernet). Si el mensaje menciona un número o código corto (típico al dictar una venta rápido: "20, uno" = un Fernet), priorizá matchear por "codigo" exacto antes que por nombre — es una señal más confiable, sobre todo si el mensaje viene de una transcripción de audio.
Nunca inventás cifras que no estén en el contexto que te pasan. Si falta un dato para registrar la operación, lo pedís en "texto" y dejás "confirmacion" y "operacion" en null.`

const PESOS = (n: number) => `$${n.toLocaleString('es-AR')}`

/**
 * Simulación por reglas. Cubre los tres pedidos más frecuentes del mostrador:
 * registrar una venta, preguntar cuánto se vendió y consultar stock.
 */
function simular(mensaje: string, ctx: Contexto): Respuesta {
  const texto = mensaje.toLowerCase()
  const productos = ctx.productos ?? []

  const nombrado = productos.find((p) => texto.includes(p.nombre.toLowerCase().split(' ')[0]))
  const cantidad = Number(/(\d+)/.exec(texto)?.[1] ?? 1)

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
        ],
      },
      operacion: { tipo: 'venta', items: [{ productoId: nombrado.id, cantidad }] },
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
  let cuerpo: { mensaje?: string; contexto?: Contexto }
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const mensaje = (cuerpo.mensaje ?? '').trim().slice(0, 2000)
  const contexto = cuerpo.contexto ?? {}
  if (!mensaje) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const cliente = clienteIA()
  if (!cliente) {
    return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
  }

  try {
    const respuesta = await cliente.messages.create({
      model: MODELO,
      max_tokens: 4000,
      output_config: { effort: 'low' },
      system: SISTEMA,
      messages: [
        {
          role: 'user',
          content: `Contexto del negocio (JSON):\n${JSON.stringify(contexto).slice(0, 6000)}\n\nMensaje del comerciante:\n${mensaje}`,
        },
      ],
    })

    if (respuesta.stop_reason === 'refusal') {
      return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
    }

    const datos = jsonDe<Respuesta>(textoDe(respuesta))
    if (!datos?.texto) {
      return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
    }

    return NextResponse.json({
      fuente: 'ia',
      texto: datos.texto,
      confirmacion: datos.confirmacion ?? undefined,
      operacion: operacionValida(datos.operacion, contexto),
    })
  } catch (error) {
    console.error('[asistente]', error)
    return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
  }
}
