import { MercadoPagoConfig, PreApproval } from 'mercadopago'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLANES } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

/** SOLO se importa desde `app/api/mercadopago/**` (código de servidor). El
 *  Access Token nunca viaja al navegador. */
function cliente(): MercadoPagoConfig | null {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) return null
  return new MercadoPagoConfig({ accessToken })
}

function urlBase(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL
  if (!url) throw new Error('Falta NEXT_PUBLIC_SITE_URL en el servidor')
  return url.replace(/\/$/, '')
}

/** Arma la suscripción en Mercado Pago para un plan pago y devuelve el link
 *  de pago (`init_point`) al que hay que mandar al usuario a autorizarla. */
export async function crearSuscripcion(opts: {
  userId: string
  email: string
  plan: Extract<PlanId, 'comercial' | 'comercial-pro'>
  ciclo: 'mensual' | 'anual'
}): Promise<string> {
  const mp = cliente()
  if (!mp) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en el servidor')

  const plan = PLANES[opts.plan]
  const monto = opts.ciclo === 'anual' ? plan.anual : plan.mensual

  // `payer_email` es obligatorio para crear una preapproval "suelta" (sin
  // `preapproval_plan_id`). Con credenciales de PRUEBA tiene que ser el mail
  // de un "usuario de prueba" comprador generado en el panel de Mercado
  // Pago — un mail real (de una cuenta real) hace fallar la creación con
  // "Payer is associated with a different site". En producción, en cambio,
  // acá sí va el mail real del usuario: es el flujo normal.
  const preapproval = new PreApproval(mp)
  const res = await preapproval.create({
    body: {
      reason: `Rindo — Plan ${plan.nombre} (${opts.ciclo === 'anual' ? 'anual' : 'mensual'})`,
      external_reference: opts.userId,
      payer_email: opts.email,
      back_url: `${urlBase()}/dashboard`,
      auto_recurring: {
        frequency: opts.ciclo === 'anual' ? 12 : 1,
        frequency_type: 'months',
        transaction_amount: monto,
        currency_id: 'ARS',
      },
      status: 'pending',
    },
  })

  if (!res.init_point) throw new Error('Mercado Pago no devolvió un link de pago')

  // Se guarda el id ya acá (no recién en el webhook) para poder mostrar
  // "activando tu suscripción" si el usuario vuelve antes de que MP avise.
  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      mp_preapproval_id: res.id ?? null,
      mp_estado: res.status ?? 'pending',
      suscripcion_activa: false,
      suscripcion_actualizada_at: new Date().toISOString(),
    })
    .eq('id', opts.userId)

  return res.init_point
}

/** Trae el estado real de una suscripción desde la API de Mercado Pago (el
 *  webhook sólo manda un id — nunca hay que confiar en el resto del body) y
 *  actualiza `profiles` acorde. Se llama tanto desde el webhook como, si
 *  hiciera falta, a mano para reconciliar una cuenta puntual. */
export async function sincronizarSuscripcion(preapprovalId: string): Promise<void> {
  const mp = cliente()
  if (!mp) throw new Error('Falta MERCADOPAGO_ACCESS_TOKEN en el servidor')

  const preapproval = new PreApproval(mp)
  const res = await preapproval.get({ id: preapprovalId })

  const userId = res.external_reference
  if (!userId) return

  const admin = createAdminClient()
  await admin
    .from('profiles')
    .update({
      mp_preapproval_id: preapprovalId,
      mp_estado: res.status ?? null,
      suscripcion_activa: res.status === 'authorized',
      suscripcion_actualizada_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

/** Valida la firma `x-signature` que manda Mercado Pago en cada webhook,
 *  siguiendo su algoritmo (manifest `id:...;request-id:...;ts:...;` con
 *  HMAC-SHA256). Sin `MERCADOPAGO_WEBHOOK_SECRET` configurada no se puede
 *  validar — se deja pasar igual (como sin `ANTHROPIC_API_KEY`, la app no
 *  se cae por no tener la variable) pero es indispensable configurarla en
 *  producción, si no cualquiera podría "avisar" un pago falso. */
export function firmaValida(opts: {
  xSignature: string | null
  xRequestId: string | null
  dataId: string
}): boolean {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return true
  if (!opts.xSignature) return false

  const partes = Object.fromEntries(
    opts.xSignature.split(',').map((p) => {
      const [k, v] = p.split('=')
      return [k?.trim(), v?.trim()]
    }),
  )
  const ts = partes.ts
  const v1 = partes.v1
  if (!ts || !v1) return false

  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId ?? ''};ts:${ts};`
  const esperado = Buffer.from(crypto.createHmac('sha256', secret).update(manifest).digest('hex'))
  const recibido = Buffer.from(v1)

  // `timingSafeEqual` tira una excepción (en vez de devolver false) si los
  // buffers no miden lo mismo — un header con la firma recortada o corrupta
  // no puede tumbar el endpoint.
  if (esperado.length !== recibido.length) return false
  return crypto.timingSafeEqual(esperado, recibido)
}

/** Cancela la suscripción activa de la cuenta (se usa al bajar a Hogar, para
 *  no seguir cobrando un plan que el usuario ya dejó). No hace nada si no
 *  hay ninguna cargada — bajar de un plan gratuito no tiene nada que cancelar. */
export async function cancelarSuscripcion(preapprovalId: string): Promise<void> {
  const mp = cliente()
  if (!mp) return
  const preapproval = new PreApproval(mp)
  await preapproval.update({ id: preapprovalId, body: { status: 'cancelled' } })
}
