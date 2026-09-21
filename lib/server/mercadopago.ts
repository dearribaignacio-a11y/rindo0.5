import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { planADB } from '@/lib/supabase/types'
import type { ProfileRow } from '@/lib/supabase/types'
import { PLANES, montoPorMeses } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

/** SOLO se importa desde `app/api/mercadopago/**` (código de servidor). El
 *  Access Token nunca viaja al navegador. */
function cliente(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) return null
  return new MercadoPagoConfig({ accessToken })
}

/**
 * Cobra un plan pago con el token que generaron los Secure Fields (número,
 * vencimiento, CVV) montados en el navegador — ni el número ni el CVV pasan
 * nunca por este servidor, sólo esta ficha de un solo uso.
 *
 * A diferencia del intento anterior (tarjeta guardada), acá no se intenta
 * vincular la tarjeta a un "customer" de Mercado Pago para cobrar sola el
 * mes que viene — esa función (`customer.createCard`) fallaba siempre con
 * "security_code_id can't be null", algo puntual de esa API que no se pudo
 * resolver. En cambio, se cobra directo con el token (el mecanismo que
 * probamos un montón de veces y siempre anduvo bien), y cada mes el usuario
 * vuelve a esta misma pantalla a pagar de nuevo — no es 100% automático,
 * pero es confiable.
 *
 * Cuando `diferencia` viene seteada, es un cambio entre dos planes pagos ya
 * al día a mitad de período (ver `diferenciaProrrateada` en lib/plans.ts):
 * se cobra ese monto fijo en vez de calcularlo por `meses`, y no se toca
 * `proximo_cobro` — el ciclo de pago sigue siendo el mismo, sólo cambió a
 * qué plan corresponde.
 */
export async function cobrarPlan(opts: {
  userId: string
  email: string
  token: string
  identificacion?: { type?: string; number?: string }
  plan: Extract<PlanId, 'comercial' | 'comercial-pro'>
  meses?: number
  diferencia?: number
}): Promise<void> {
  const mp = cliente()
  if (!mp) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en el servidor')

  const plan = PLANES[opts.plan]
  const esDiferencia = typeof opts.diferencia === 'number'
  const meses = opts.meses ?? 1
  const monto = esDiferencia ? (opts.diferencia as number) : montoPorMeses(opts.plan, meses)

  const payment = new Payment(mp)
  const pago = await payment.create({
    body: {
      transaction_amount: monto,
      token: opts.token,
      description: esDiferencia
        ? `Rindo — Cambio a plan ${plan.nombre} (diferencia prorrateada)`
        : `Rindo — Plan ${plan.nombre} (${meses} ${meses === 1 ? 'mes' : 'meses'})`,
      installments: 1,
      external_reference: opts.userId,
      payer: { email: opts.email, identification: opts.identificacion },
    },
  })

  if (pago.status === 'pending' || pago.status === 'in_process') {
    // No es un rechazo: Mercado Pago puso el pago en revisión manual por su
    // propio sistema antifraude (común en pagos reales nuevos). Puede
    // resolverse solo en minutos u horas — no hay nada que hacer acá.
    throw new Error(
      'Mercado Pago puso este pago en revisión por seguridad (no lo rechazó). Probá de nuevo más tarde.',
    )
  }
  if (pago.status !== 'approved') {
    throw new Error(`El pago no se aprobó: ${pago.status_detail ?? pago.status}`)
  }

  const admin = createAdminClient()
  const cambios: Partial<ProfileRow> = {
    plan: planADB(opts.plan),
    suscripcion_activa: true,
    mp_ultimo_pago_id: String(pago.id ?? ''),
  }
  if (!esDiferencia) {
    const proximoCobro = new Date()
    proximoCobro.setMonth(proximoCobro.getMonth() + meses)
    cambios.proximo_cobro = proximoCobro.toISOString().slice(0, 10)
  }

  const { error } = await admin.from('profiles').update(cambios).eq('id', opts.userId)
  if (error) throw error
}

/**
 * Revisa qué cuentas pagas tienen `proximo_cobro` vencido y las bloquea —
 * la llama el cron de `/api/mercadopago/cobrar-renovaciones` una vez al día.
 * No intenta cobrar sola (no hay tarjeta guardada): sólo avisa/bloquea, y el
 * usuario vuelve a pagar desde la pantalla de "Cuenta pausada".
 */
export async function bloquearVencidos(): Promise<number> {
  const admin = createAdminClient()
  const hoy = new Date().toISOString().slice(0, 10)

  const { data, error } = await admin
    .from('profiles')
    .update({ suscripcion_activa: false })
    .in('plan', ['comercial', 'comercial_pro'])
    .eq('suscripcion_activa', true)
    .lt('proximo_cobro', hoy)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}
