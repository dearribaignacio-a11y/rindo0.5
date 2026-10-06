import { NextResponse } from 'next/server'
import { avisarStockYVencimientos } from '@/lib/server/notificaciones'
import { esCronAutorizado } from '@/lib/server/limites'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron diario (ver `vercel.json`): manda las notificaciones push de stock
 * bajo y vencimiento de plan. Sólo lo puede disparar Vercel (`CRON_SECRET`),
 * igual que el cron de renovaciones — si no, cualquiera podía mandarle
 * notificaciones a todos los comercios cuando quisiera.
 */
export async function GET(req: Request) {
  if (!esCronAutorizado(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const resultado = await avisarStockYVencimientos()
    return NextResponse.json(resultado)
  } catch (err) {
    console.error('notificaciones/verificar', err)
    return NextResponse.json({ error: 'Error al mandar notificaciones' }, { status: 500 })
  }
}
