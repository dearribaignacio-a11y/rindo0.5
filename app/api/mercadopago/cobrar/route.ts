import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cobrarPlan } from '@/lib/server/mercadopago'
import { esComercial } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recibe el token de tarjeta que generaron los Secure Fields en el
 * navegador (`@mercadopago/sdk-react`) y cobra el plan elegido por la
 * cantidad de meses que haya pedido el usuario. Si se aprueba, activa el
 * plan por esos meses; si no, no toca nada.
 */
export async function POST(req: Request) {
  const { token, identificacion, plan, meses } = (await req.json()) as {
    token?: string
    identificacion?: { type?: string; number?: string }
    plan?: PlanId
    meses?: number
  }

  if (!token) {
    return NextResponse.json({ error: 'Falta el token de la tarjeta' }, { status: 400 })
  }
  if (!plan || !esComercial(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }
  const mesesValidos = [1, 3, 6, 12]
  if (!meses || !mesesValidos.includes(meses)) {
    return NextResponse.json({ error: 'Cantidad de meses inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  try {
    await cobrarPlan({
      userId: user.id,
      email: user.email,
      token,
      identificacion,
      plan,
      meses,
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('cobrar', err)
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: 'No pudimos procesar el pago', detalle }, { status: 500 })
  }
}
