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
  productos?: { nombre: string; precio: number; stock: number }[]
  ventasHoy?: number
  ticketsHoy?: number
}

interface Respuesta {
  texto: string
  /** Tarjeta de confirmación embebida, cuando el pedido implica registrar algo. */
  confirmacion?: {
    titulo: string
    lineas: { etiqueta: string; valor: string }[]
  }
}

const SISTEMA = `Sos el asistente de Rindo, una app de gestión para comercios chicos de San Juan, Argentina.
Hablás en español rioplatense, en segunda persona ("vos"), en tono directo y breve: dos o tres oraciones como máximo.

Devolvés SIEMPRE un único objeto JSON, sin texto alrededor, con esta forma:
{"texto": string, "confirmacion": {"titulo": string, "lineas": [{"etiqueta": string, "valor": string}]} | null}

Usás "confirmacion" solamente cuando el usuario pide registrar algo concreto (una venta, una reposición, un gasto): ahí resumís lo entendido en líneas cortas para que lo confirme antes de impactar los datos. Para preguntas de consulta, "confirmacion" va en null.
Nunca inventás cifras que no estén en el contexto que te pasan. Si falta un dato para registrar la operación, lo pedís en "texto" y dejás "confirmacion" en null.`

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
    }
  }

  if (/cu[aá]nto.*(vend|factur)|c[oó]mo (vengo|voy)|ventas? de hoy/.test(texto)) {
    const total = ctx.ventasHoy ?? 0
    const tickets = ctx.ticketsHoy ?? 0
    return {
      texto:
        tickets > 0
          ? `Hoy llevás ${PESOS(total)} en ${tickets} ${tickets === 1 ? 'ticket' : 'tickets'}, con un promedio de ${PESOS(Math.round(total / tickets))} por venta.`
          : 'Todavía no hay ventas cargadas hoy.',
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
    })
  } catch (error) {
    console.error('[asistente]', error)
    return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
  }
}
