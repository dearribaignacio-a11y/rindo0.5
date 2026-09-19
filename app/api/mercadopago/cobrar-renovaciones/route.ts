import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cobrarRenovacion, type CuentaARenovar } from '@/lib/server/mercadopago'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Cron mensual (ver `vercel.json`): revisa qué cuentas comerciales tienen
 * `proximo_cobro` vencido y les cobra la renovación con la tarjeta guardada,
 * sin que el usuario tenga que hacer nada. Protegido con `CRON_SECRET` —
 * Vercel lo manda solo en el header `Authorization` de sus propios crons.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const admin = createAdminClient()
  const hoy = new Date().toISOString().slice(0, 10)

  const { data: cuentas, error } = await admin
    .from('profiles')
    .select('id, mp_customer_id, mp_card_id, plan')
    .in('plan', ['comercial', 'comercial_pro'])
    .not('mp_card_id', 'is', null)
    .lte('proximo_cobro', hoy)

  if (error) {
    console.error('cobrar-renovaciones: búsqueda', error)
    return NextResponse.json({ error: 'Error al buscar cuentas' }, { status: 500 })
  }

  const resultados: { id: string; aprobado: boolean }[] = []

  for (const cuenta of cuentas ?? []) {
    if (!cuenta.mp_customer_id || !cuenta.mp_card_id) continue
    try {
      const { data: usuario } = await admin.auth.admin.getUserById(cuenta.id)
      const email = usuario.user?.email
      if (!email) continue
      const aprobado = await cobrarRenovacion(cuenta as CuentaARenovar, email)
      resultados.push({ id: cuenta.id, aprobado })
    } catch (err) {
      console.error('cobrar-renovaciones: cuenta', cuenta.id, err)
      resultados.push({ id: cuenta.id, aprobado: false })
    }
  }

  return NextResponse.json({ procesadas: resultados.length, resultados })
}
