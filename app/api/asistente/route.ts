import { NextResponse } from 'next/server'
import { MODELO, clienteIA, jsonDe, textoDe } from '@/lib/server/anthropic'
import { autorizarIA } from '@/lib/server/sesion'

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

/** La tarjeta de confirmación sale tal cual del modelo: se acota la forma y
 *  los largos para que una respuesta rara no rompa la pantalla del chat. */
function confirmacionValida(c: unknown): Respuesta['confirmacion'] {
  if (!c || typeof c !== 'object') return undefined
  const { titulo, lineas } = c as { titulo?: unknown; lineas?: unknown }
  if (typeof titulo !== 'string' || !Array.isArray(lineas)) return undefined
  return {
    titulo: titulo.slice(0, 80),
    lineas: lineas
      .filter(
        (l): l is { etiqueta: string; valor: string } =>
          !!l && typeof l.etiqueta === 'string' && typeof l.valor === 'string',
      )
      .slice(0, 10)
      .map((l) => ({ etiqueta: l.etiqueta.slice(0, 60), valor: l.valor.slice(0, 120) })),
  }
}

const SISTEMA = `Sos el asistente de Rindo, una app de gestión para comercios chicos de San Juan, Argentina.
Hablás en español rioplatense, en segunda persona ("vos"), en tono directo y breve: dos o tres oraciones como máximo.

Devolvés SIEMPRE un único objeto JSON, sin texto alrededor, con esta forma:
{"texto": string, "confirmacion": {"titulo": string, "lineas": [{"etiqueta": string, "valor": string}]} | null, "operacion": {"tipo": "venta", "items": [{"productoId": string, "cantidad": number}], "metodo": "efectivo" | "tarjeta" | "transferencia"} | null}

Usás "confirmacion" solamente cuando el usuario pide registrar algo concreto (una venta, una reposición, un gasto): ahí resumís lo entendido en líneas cortas para que lo confirme antes de impactar los datos. Para preguntas de consulta, "confirmacion" va en null.

Cuando la operación es una venta de productos del catálogo, además de "confirmacion" completás "operacion" con el "id" EXACTO de cada producto tal como figura en el contexto y la cantidad como número entero. No inventes ids: si no encontrás el producto en el contexto, dejá "operacion" en null y pedí el nombre en "texto".
Algunos productos del contexto traen "codigo", un código corto que el comerciante les asignó (ej. "20" para el Fernet). Si el mensaje menciona un número o código corto (típico al dictar una venta rápido: "20, uno" = un Fernet), priorizá matchear por "codigo" exacto antes que por nombre — es una señal más confiable, sobre todo si el mensaje viene de una transcripción de audio.
En "metodo" completás cómo pagaron si el mensaje lo dice: "tarjeta" para tarjeta/débito/crédito/posnet, "transferencia" para transferencia/QR/Mercado Pago/alias/CBU, "efectivo" para efectivo. Si no lo menciona, usá "efectivo" — es lo más común en un mostrador y no hace falta preguntarlo siempre. Reflejá el método elegido como una línea más en "confirmacion" (etiqueta "Método de pago").
Nunca inventás cifras que no estén en el contexto que te pasan. Si falta un dato para registrar la operación, lo pedís en "texto" y dejás "confirmacion" y "operacion" en null.`

const PESOS = (n: number) => `$${n.toLocaleString('es-AR')}`

/** Efectivo por defecto si no se menciona nada — es lo más común y así no
 *  hace falta preguntarlo en cada venta. */
function detectarMetodo(texto: string): MetodoPago {
  if (/tarjeta|d[eé]bito|cr[eé]dito|posnet|point/.test(texto)) return 'tarjeta'
  if (/transferencia|\bqr\b|mercado ?pago|\bmp\b|alias|cbu/.test(texto)) return 'transferencia'
  return 'efectivo'
}

const UNIDADES: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5,
  seis: 6, siete: 7, ocho: 8, nueve: 9,
}
const ESPECIALES: Record<string, number> = {
  diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, dieciséis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintidós: 22,
  veintitres: 23, veintitrés: 23, veinticuatro: 24, veinticinco: 25,
  veintiseis: 26, veintiséis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29,
}
const DECENAS: Record<string, number> = {
  treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90,
}

/** Convierte números dichos como palabra ("tres", "veinte") a dígitos — el
 *  habla a texto de Android casi siempre transcribe los números chicos como
 *  palabras, nunca como cifras, y sin esto el resto del reconocimiento de
 *  código/cantidad no tenía ningún dígito para encontrar. Cubre 0-99, de
 *  sobra para un código de hasta 3 cifras dictado con alguna palabra. */
function palabrasANumeros(texto: string): string {
  let normalizado = texto.replace(
    /\b(treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa)\s+y\s+(un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve)\b/g,
    (_, decena: string, unidad: string) => String(DECENAS[decena] + UNIDADES[unidad]),
  )
  normalizado = normalizado.replace(/\b[a-záéíóúñ]+\b/g, (palabra) => {
    if (palabra in ESPECIALES) return String(ESPECIALES[palabra])
    if (palabra in DECENAS) return String(DECENAS[palabra])
    if (palabra in UNIDADES) return String(UNIDADES[palabra])
    return palabra
  })
  return normalizado
}

/**
 * Busca el producto y la cantidad que menciona el mensaje. Un mensaje puede
 * traer dos números a la vez (cantidad y código: "vendí 3 del 1"), así que
 * primero se busca una marca explícita ("del 1", "código 1", "cod 1", "#1")
 * que diga sin ambigüedad cuál de los dos números es el código — el resto de
 * los números quedan libres para ser la cantidad. La marca se busca sobre el
 * texto con los números-palabra ya convertidos ("del tres" → "del 3"), porque
 * la palabra "del"/"código" ya saca la ambigüedad.
 *
 * Sin marca, el escaneo de números contra los códigos existentes usa sólo
 * los dígitos que YA eran dígitos en el mensaje original — un número dicho
 * como palabra suelta ("vendí dos gaseosas") es casi siempre una cantidad,
 * no un código, y tratarlo como código rompería ese caso mucho más común que
 * el de dictar el código sin decir la palabra "código"/"del" antes.
 */
function buscarProductoYCantidad(texto: string, productos: Contexto['productos']) {
  const textoNumerico = palabrasANumeros(texto)
  const numerosConvertidos = textoNumerico.match(/\d+/g) ?? []
  const numerosOriginales = texto.match(/\d+/g) ?? []

  const marca = /(?:c[oó]digo|cod\.?|del|#)\s*(\d+)/.exec(textoNumerico)
  if (marca) {
    const producto = productos?.find((p) => p.codigo === marca[1])
    if (producto) {
      const resto = numerosConvertidos.filter((n) => n !== marca[1])
      return { producto, cantidad: Number(resto[0] ?? 1) }
    }
  }

  for (const n of numerosOriginales) {
    const producto = productos?.find((p) => p.codigo && p.codigo === n)
    if (producto) {
      const resto = numerosOriginales.filter((x) => x !== n)
      return { producto, cantidad: Number(resto[0] ?? 1) }
    }
  }

  const producto = productos?.find((p) => texto.includes(p.nombre.toLowerCase().split(' ')[0]))
  return { producto, cantidad: Number(numerosConvertidos[0] ?? 1) }
}

/**
 * Simulación por reglas. Cubre los tres pedidos más frecuentes del mostrador:
 * registrar una venta, preguntar cuánto se vendió y consultar stock.
 */
function simular(mensaje: string, ctx: Contexto): Respuesta {
  const texto = mensaje.toLowerCase()
  const productos = ctx.productos ?? []

  const { producto: nombrado, cantidad } = buscarProductoYCantidad(texto, productos)
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
  let cuerpo: { mensaje?: string; contexto?: Contexto }
  try {
    cuerpo = await request.json()
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  const mensaje = (typeof cuerpo.mensaje === 'string' ? cuerpo.mensaje : '').trim().slice(0, 2000)
  const contexto = cuerpo.contexto && typeof cuerpo.contexto === 'object' ? cuerpo.contexto : {}
  if (!mensaje) return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 })

  const cliente = clienteIA()

  // El asistente es del plan Comercial Pro.
  const permiso = await autorizarIA({ planes: ['comercial-pro'], consumeCupo: Boolean(cliente) })
  if (!permiso.ok) return permiso.respuesta

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
      texto: String(datos.texto).slice(0, 1500),
      confirmacion: confirmacionValida(datos.confirmacion),
      operacion: operacionValida(datos.operacion, contexto),
    })
  } catch (error) {
    console.error('[asistente]', error)
    return NextResponse.json({ fuente: 'simulado', ...simular(mensaje, contexto) })
  }
}
