import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { crearSuscripcion } from '@/lib/server/mercadopago'
import { esComercial } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Arranca el alta de una suscripción paga: crea la preapproval en Mercado
 * Pago para el usuario logueado y devuelve el link de pago. El cliente
 * redirige el navegador entero ahí — no hay checkout embebido.
 */
export async function POST(req: Request) {
  const { plan, ciclo } = (await req.json()) as { plan?: PlanId; ciclo?: 'mensual' | 'anual' }

  if (!plan || !esComercial(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  try {
    const initPoint = await crearSuscripcion({
      userId: user.id,
      email: user.email,
      plan,
      ciclo: ciclo === 'anual' ? 'anual' : 'mensual',
    })
    return NextResponse.json({ initPoint })
  } catch (err) {
    console.error('crear-suscripcion', err)
    // El detalle (ej. "Payer is associated with a different site") viaja al
    // cliente para no depender de ir a mirar los logs de Vercel en cada
    // prueba — no es información sensible, es un mensaje de validación de
    // la propia API de Mercado Pago.
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: 'No pudimos iniciar el pago', detalle }, { status: 500 })
  }
}
