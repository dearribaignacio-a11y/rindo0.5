import { NextResponse } from 'next/server'
import { bloquearVencidos } from '@/lib/server/mercadopago'
import { esCronAutorizado } from '@/lib/server/limites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron diario (ver `vercel.json`): bloquea las cuentas pagas cuyo
 * `proximo_cobro` ya venció y no pagaron de nuevo. No intenta cobrar nada
 * solo — no hay tarjeta guardada — el usuario vuelve a pagar desde la
 * pantalla de "Cuenta pausada". Sólo lo puede disparar Vercel, que manda
 * `CRON_SECRET` en el header `Authorization` de sus propios crons.
 */
export async function GET(req: Request) {
  if (!esCronAutorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const bloqueadas = await bloquearVencidos()
    return NextResponse.json({ bloqueadas })
  } catch (err) {
    console.error('cobrar-renovaciones', err)
    return NextResponse.json({ error: 'Error al bloquear cuentas vencidas' }, { status: 500 })
  }
}
