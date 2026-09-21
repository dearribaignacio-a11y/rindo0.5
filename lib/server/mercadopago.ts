import { MercadoPagoConfig, Customer, CardToken, Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { planADB } from '@/lib/supabase/types'
import { PLANES } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

/** SOLO se importa desde `app/api/mercadopago/**` (código de servidor). El
 *  Access Token nunca viaja al navegador. */
function cliente(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) return null
  return new MercadoPagoConfig({ accessToken })
}

/** Un cliente de Mercado Pago por email, reusado entre pagos — sin esto,
 *  cada alta de tarjeta crearía un "customer" nuevo para la misma persona. */
async function buscarOCrearCliente(mp: MercadoPagoConfig, email: string): Promise<string> {
  const customer = new Customer(mp)
  const encontrados = await customer.search({ options: { email } })
  const existente = encontrados.results?.[0]?.id
  if (existente) return existente

  const creado = await customer.create({ body: { email } })
  if (!creado.id) throw new Error('Mercado Pago no devolvió un customer_id')
  return creado.id
}

/** Cobra un monto usando una tarjeta ya guardada, generando primero un token
 *  nuevo a partir del `card_id` — así se puede cobrar sin que el cliente
 *  tenga que volver a escribir el número ni el CVV. Se usa tanto para el
 *  primer cobro (justo después de guardar la tarjeta) como para cada
 *  renovación mensual: es el mismo mecanismo en los dos casos. */
async function cobrarConTarjetaGuardada(
  mp: MercadoPagoConfig,
  opts: { customerId: string; cardId: string; email: string; monto: number; descripcion: string; externalReference: string },
): Promise<{ id: string; aprobado: boolean; detalle: string }> {
  const cardToken = new CardToken(mp)
  const token = await cardToken.create({
    body: { card_id: opts.cardId, customer_id: opts.customerId },
  })
  if (!token.id) throw new Error('Mercado Pago no devolvió un token de cobro')

  const payment = new Payment(mp)
  const pago = await payment.create({
    body: {
      transaction_amount: opts.monto,
      token: token.id,
      description: opts.descripcion,
      installments: 1,
      external_reference: opts.externalReference,
      payer: { type: 'customer', id: opts.customerId, email: opts.email },
    },
  })

  return {
    id: String(pago.id ?? ''),
    aprobado: pago.status === 'approved',
    detalle: pago.status_detail ?? pago.status ?? 'desconocido',
  }
}

/** Alta de la tarjeta + primer cobro. El `token` viene de los Secure Fields
 *  (número, vencimiento, CVV) montados en el navegador — ni el número ni el
 *  CVV pasan nunca por este servidor, sólo esta ficha de un solo uso.
 *
 *  Importante: el token de Secure Fields SÍ sirve para `customer.createCard`
 *  (a diferencia del que arma el Brick de pago, que Mercado Pago rechaza ahí
 *  con "security_code_id can't be null" — ver commits anteriores). Por eso
 *  acá primero se guarda la tarjeta y recién después se cobra, con el mismo
 *  mecanismo que usan las renovaciones (`cobrarConTarjetaGuardada`): así, si
 *  el cobro fallara, la tarjeta ya quedó guardada para reintentar. */
export async function guardarTarjetaYCobrar(opts: {
  userId: string
  email: string
  token: string
  plan: Extract<PlanId, 'comercial' | 'comercial-pro'>
  ciclo: 'mensual' | 'anual'
}): Promise<void> {
  const mp = cliente()
  if (!mp) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en el servidor')

  const customerId = await buscarOCrearCliente(mp, opts.email)

  const customer = new Customer(mp)
  const tarjeta = await customer.createCard({ customerId, body: { token: opts.token } })
  if (!tarjeta.id) throw new Error('Mercado Pago no devolvió un card_id')

  const plan = PLANES[opts.plan]
  const monto = opts.ciclo === 'anual' ? plan.anual : plan.mensual

  const pago = await cobrarConTarjetaGuardada(mp, {
    customerId,
    cardId: tarjeta.id,
    email: opts.email,
    monto,
    descripcion: `Rindo — Plan ${plan.nombre} (${opts.ciclo === 'anual' ? 'anual' : 'mensual'})`,
    externalReference: opts.userId,
  })

  if (pago.detalle === 'pending_review_manual' || pago.detalle === 'pending' || pago.detalle === 'in_process') {
    // No es un rechazo: Mercado Pago puso el pago en revisión manual por su
    // propio sistema antifraude (común en pagos reales nuevos, más todavía
    // después de varios intentos seguidos). La tarjeta ya quedó guardada —
    // cuando se resuelva, el cron de renovaciones la va a volver a intentar.
    throw new Error(
      'Mercado Pago puso este pago en revisión por seguridad (no lo rechazó). Tu tarjeta ya quedó guardada — probá de nuevo más tarde.',
    )
  }
  if (!pago.aprobado) {
    throw new Error(`El pago no se aprobó: ${pago.detalle}`)
  }

  const proximoCobro = new Date()
  proximoCobro.setMonth(proximoCobro.getMonth() + (opts.ciclo === 'anual' ? 12 : 1))

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .update({
      plan: planADB(opts.plan),
      mp_customer_id: customerId,
      mp_card_id: tarjeta.id,
      suscripcion_activa: true,
      proximo_cobro: proximoCobro.toISOString().slice(0, 10),
      mp_ultimo_pago_id: pago.id,
    })
    .eq('id', opts.userId)
  if (error) throw error
}

/** Fila mínima de `profiles` que necesita el cron de renovación mensual. */
export interface CuentaARenovar {
  id: string
  mp_customer_id: string
  mp_card_id: string
  plan: 'comercial' | 'comercial_pro'
}

/** Cobra la renovación mensual de una cuenta puntual — la llama el cron de
 *  `/api/mercadopago/cobrar-renovaciones`, nunca el cliente. Actualiza
 *  `suscripcion_activa` acorde al resultado: no tira si el cobro falla, eso
 *  es una cuenta más que queda bloqueada, no un error del proceso entero. */
export async function cobrarRenovacion(cuenta: CuentaARenovar, email: string): Promise<boolean> {
  const mp = cliente()
  if (!mp) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en el servidor')

  const plan = PLANES[cuenta.plan === 'comercial_pro' ? 'comercial-pro' : 'comercial']
  const admin = createAdminClient()

  const pago = await cobrarConTarjetaGuardada(mp, {
    customerId: cuenta.mp_customer_id,
    cardId: cuenta.mp_card_id,
    email,
    monto: plan.mensual,
    descripcion: `Rindo — Renovación plan ${plan.nombre}`,
    externalReference: cuenta.id,
  })

  if (pago.aprobado) {
    const proximoCobro = new Date()
    proximoCobro.setMonth(proximoCobro.getMonth() + 1)
    await admin
      .from('profiles')
      .update({
        suscripcion_activa: true,
        proximo_cobro: proximoCobro.toISOString().slice(0, 10),
        mp_ultimo_pago_id: pago.id,
      })
      .eq('id', cuenta.id)
  } else {
    await admin.from('profiles').update({ suscripcion_activa: false }).eq('id', cuenta.id)
  }

  return pago.aprobado
}
