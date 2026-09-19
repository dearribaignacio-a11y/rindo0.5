import { NextResponse } from 'next/server'
import { firmaValida, sincronizarSuscripcion } from '@/lib/server/mercadopago'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Notificaciones de Mercado Pago. Se configura esta URL
 * (`/api/mercadopago/webhook`) en el panel de la aplicación de Mercado Pago.
 *
 * Sólo nos interesa `subscription_preapproval`: cubre alta, pausa y
 * cancelación de la suscripción, que es lo único que decide si la cuenta
 * queda bloqueada. El body que manda MP es mínimo a propósito (básicamente
 * un id) — nunca hay que confiar en sus campos más allá de eso; el estado
 * real se vuelve a pedir a la API con `sincronizarSuscripcion`.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const dataId = body?.data?.id ? String(body.data.id) : null
  const tipo = body?.type ?? body?.topic

  // Siempre 200 salvo firma inválida: si devolvemos error por un tipo de
  // evento que no nos interesa, Mercado Pago lo reintenta sin parar.
  if (!dataId || tipo !== 'subscription_preapproval') {
    return NextResponse.json({ recibido: true })
  }

  const valida = firmaValida({
    xSignature: req.headers.get('x-signature'),
    xRequestId: req.headers.get('x-request-id'),
    dataId,
  })
  if (!valida) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  try {
    await sincronizarSuscripcion(dataId)
  } catch (err) {
    console.error('webhook mercadopago', err)
    // 200 igual: si el error es nuestro (ej. Supabase caído un instante), que
    // MP reintente solo generaría más ruido que dejarlo para la próxima
    // notificación o una reconciliación manual.
  }

  return NextResponse.json({ recibido: true })
}
