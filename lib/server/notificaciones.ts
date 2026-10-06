import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { enviarPush } from './push'

/** Días que faltan hasta una fecha ISO corta — copia mínima de
 *  `diasHasta` (lib/format.ts, que es 'use client' y no se puede importar
 *  acá) para no mezclar código de servidor con el del navegador. */
function diasHasta(iso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const objetivo = new Date(y, (m ?? 1) - 1, d ?? 1)
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000)
}

/**
 * Cron diario (ver vercel.json): manda un push a cada comercio con stock por
 * debajo del mínimo, y otro a quien tenga el plan por vencer en 3 días o
 * vencido hoy mismo. Sólo mira cuentas con al menos un dispositivo suscripto
 * — no tiene sentido consultar productos de alguien que no puede recibir
 * nada. No manda nada dos veces el mismo día porque el cron corre una vez al
 * día y el aviso de vencimiento sólo dispara en esos dos días puntuales
 * (3 días antes y el día en que vence), no todos los días que falten.
 */
export async function avisarStockYVencimientos(): Promise<{ stock: number; vencimiento: number }> {
  const admin = createAdminClient()

  const { data: perfiles, error } = await admin
    .from('profiles')
    .select('id, suscripcion_activa, proximo_cobro')
    .neq('plan', 'hogar')
  if (error) throw error

  let avisosStock = 0
  let avisosVencimiento = 0

  for (const perfil of perfiles ?? []) {
    const { data: subs } = await admin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('user_id', perfil.id)
    if (!subs || subs.length === 0) continue

    const { data: productos } = await admin
      .from('productos')
      .select('nombre, stock, stock_min')
      .eq('user_id', perfil.id)
    const bajos = (productos ?? []).filter((p) => Number(p.stock) <= Number(p.stock_min))

    if (bajos.length > 0) {
      const cuerpo =
        bajos.length === 1
          ? `${bajos[0].nombre} está por quedarse sin stock.`
          : `${bajos.length} productos están por quedarse sin stock.`
      await Promise.all(
        subs.map((s) => enviarPush(s, { title: 'Rindo — Stock bajo', body: cuerpo, url: '/dashboard' })),
      )
      avisosStock++
    }

    if (perfil.suscripcion_activa && perfil.proximo_cobro) {
      const dias = diasHasta(perfil.proximo_cobro)
      if (dias === 3 || dias === 0) {
        const cuerpo =
          dias === 0
            ? 'Hoy vence el pago de tu plan. Pagalo para que no se pause tu cuenta.'
            : 'En 3 días vence el pago de tu plan.'
        await Promise.all(
          subs.map((s) => enviarPush(s, { title: 'Rindo — Vencimiento del plan', body: cuerpo, url: '/dashboard' })),
        )
        avisosVencimiento++
      }
    }
  }

  return { stock: avisosStock, vencimiento: avisosVencimiento }
}
