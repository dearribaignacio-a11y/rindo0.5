import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { guardarTarjetaYCobrar } from '@/lib/server/mercadopago'
import { esComercial } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recibe el token de tarjeta que generó el Brick de pago en el navegador
 * (`@mercadopago/sdk-react`), guarda la tarjeta en Mercado Pago y cobra el
 * primer mes. Si el cobro no se aprueba, no se activa el plan.
 */
export async function POST(req: Request) {
  const { token, plan, ciclo } = (await req.json()) as {
    token?: string
    plan?: PlanId
    ciclo?: 'mensual' | 'anual'
  }

  if (!token) {
    return NextResponse.json({ error: 'Falta el token de la tarjeta' }, { status: 400 })
  }
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
    await guardarTarjetaYCobrar({
      userId: user.id,
      email: user.email,
      token,
      plan,
      ciclo: ciclo === 'anual' ? 'anual' : 'mensual',
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('guardar-tarjeta', err)
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: 'No pudimos procesar el pago', detalle }, { status: 500 })
  }
}
