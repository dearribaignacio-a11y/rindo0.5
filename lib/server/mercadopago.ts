import 'server-only'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createAdminClient } from '@/lib/supabase/admin'
import { planADB, planDesdeDB } from '@/lib/supabase/types'
import type { ProfileRow } from '@/lib/supabase/types'
import { PLANES, diferenciaProrrateada, esComercial, montoPorMeses } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

/** Pedido de cobro que no tiene sentido (no es un error del servidor): la
 *  ruta lo contesta con 400 y el mensaje tal cual. */
export class CobroInvalido extends Error {}

const hoyISO = () => new Date().toISOString().slice(0, 10)

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
 *
 * Todo monto se calcula acá, con el plan y la fecha de cobro guardados en la
 * base. Antes la diferencia la mandaba el navegador y se cobraba tal cual:
 * alguien mandaba "diferencia: 1" y pasaba a Comercial Pro por $1.
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

  const admin = createAdminClient()
  const { data: perfil, error: errPerfil } = await admin
    .from('profiles')
    .select('plan, suscripcion_activa, proximo_cobro')
    .eq('id', opts.userId)
    .single()
  if (errPerfil || !perfil) throw new Error('No encontramos tu cuenta')

  const actual = planDesdeDB(perfil.plan)
  const alDia = perfil.suscripcion_activa && !!perfil.proximo_cobro && perfil.proximo_cobro >= hoyISO()

  const plan = PLANES[opts.plan]
  const esDiferencia = typeof opts.diferencia === 'number'
  const meses = opts.meses ?? 1
  let monto: number

  if (esDiferencia) {
    if (!esComercial(actual) || actual === opts.plan || !alDia || !perfil.proximo_cobro) {
      throw new CobroInvalido('Este cambio de plan no corresponde a tu cuenta. Volvé a elegir el plan.')
    }
    const esperado = diferenciaProrrateada(actual, opts.plan, perfil.proximo_cobro)
    if (esperado <= 0) throw new CobroInvalido('Este cambio de plan no tiene nada que cobrar.')
    // El navegador y el servidor pueden contar los días con una diferencia
    // de horario (Argentina vs. UTC): se acepta hasta un día de diferencia y
    // se cobra lo que el usuario vio en pantalla. Fuera de eso, se rechaza.
    const unDia = Math.ceil((PLANES[opts.plan].mensual - PLANES[actual].mensual) / 30) + 1
    if (Math.abs((opts.diferencia as number) - esperado) > unDia) {
      throw new CobroInvalido('El monto del cambio de plan cambió. Volvé a abrir la pantalla de pago.')
    }
    monto = Math.round(opts.diferencia as number)
  } else {
    monto = montoPorMeses(opts.plan, meses)
  }

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

  const cambios: Partial<ProfileRow> = {
    plan: planADB(opts.plan),
    suscripcion_activa: true,
    mp_ultimo_pago_id: String(pago.id ?? ''),
  }
  if (!esDiferencia) {
    // Si paga por adelantado el mismo plan que ya tiene al día (incluido el
    // mes de prueba), los meses se suman desde su fecha de cobro, no desde
    // hoy: si no, perdía los días que le quedaban.
    const desde =
      alDia && actual === opts.plan && perfil.proximo_cobro
        ? new Date(`${perfil.proximo_cobro}T12:00:00Z`)
        : new Date()
    desde.setMonth(desde.getMonth() + meses)
    cambios.proximo_cobro = desde.toISOString().slice(0, 10)
  }

  const { error } = await admin.from('profiles').update(cambios).eq('id', opts.userId)
  if (error) throw error
}

/**
 * Revisa qué cuentas pagas tienen `proximo_cobro` vencido y las bloquea —
 * la llama el cron de `/api/mercadopago/cobrar-renovaciones` una vez al día.
 * No intenta cobrar sola (no hay tarjeta guardada): sólo avisa/bloquea, y el
 * usuario vuelve a pagar desde la pantalla de "Cuenta pausada".
 *
 * Una cuenta de Comercio activa SIN fecha de cobro también cuenta como
 * vencida: hoy no hay forma legítima de llegar a ese estado (pagar y el mes
 * de prueba siempre ponen fecha), y era justo como quedaba quien se pasaba
 * de Hogar a un plan pago desde la consola del navegador.
 */
export async function bloquearVencidos(): Promise<number> {
  const admin = createAdminClient()
  const hoy = hoyISO()

  const { data, error } = await admin
    .from('profiles')
    .update({ suscripcion_activa: false })
    .in('plan', ['comercial', 'comercial_pro'])
    .eq('suscripcion_activa', true)
    .or(`proximo_cobro.is.null,proximo_cobro.lt.${hoy}`)
    .select('id')

  if (error) throw error
  return data?.length ?? 0
}
