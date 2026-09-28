import { NextResponse } from 'next/server'
import { avisarStockYVencimientos } from '@/lib/server/notificaciones'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cron diario (ver `vercel.json`): manda las notificaciones push de stock
 * bajo y vencimiento de plan. Protegido con `CRON_SECRET`, igual que el cron
 * de renovaciones de Mercado Pago.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
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
