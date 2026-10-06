import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { CobroInvalido, cobrarPlan } from '@/lib/server/mercadopago'
import { esComercial } from '@/lib/plans'
import type { PlanId } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Recibe el token de tarjeta que generaron los Secure Fields en el
 * navegador (`@mercadopago/sdk-react`) y cobra el plan elegido — ya sea por
 * la cantidad de meses que pidió el usuario, o por una `diferencia` fija
 * cuando es un cambio entre dos planes pagos a mitad de período (ver
 * `diferenciaProrrateada` en lib/plans.ts). Si se aprueba, activa el plan;
 * si no, no toca nada.
 */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as {
    token?: string
    identificacion?: { type?: string; number?: string }
    plan?: PlanId
    meses?: number
    diferencia?: number
  } | null
  if (!cuerpo) return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  const { token, identificacion, plan, meses, diferencia } = cuerpo

  if (!token || typeof token !== 'string' || token.length > 200) {
    return NextResponse.json({ error: 'Falta el token de la tarjeta' }, { status: 400 })
  }
  if (!plan || !esComercial(plan)) {
    return NextResponse.json({ error: 'Plan inválido' }, { status: 400 })
  }

  const esDiferencia = typeof diferencia === 'number'
  if (esDiferencia) {
    // El monto real lo recalcula `cobrarPlan` con los datos de la base.
    if (!Number.isFinite(diferencia) || !(diferencia > 0)) {
      return NextResponse.json({ error: 'Diferencia inválida' }, { status: 400 })
    }
  } else {
    const mesesValidos = [1, 3, 6, 12]
    if (!meses || !mesesValidos.includes(meses)) {
      return NextResponse.json({ error: 'Cantidad de meses inválida' }, { status: 400 })
    }
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
      identificacion: identificacion?.number
        ? { type: 'DNI', number: String(identificacion.number).replace(/\D/g, '').slice(0, 15) }
        : undefined,
      plan,
      ...(esDiferencia ? { diferencia } : { meses }),
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof CobroInvalido) {
      return NextResponse.json({ error: err.message, detalle: err.message }, { status: 400 })
    }
    console.error('cobrar', err)
    const detalle = err instanceof Error ? err.message : 'Error desconocido'
    return NextResponse.json({ error: 'No pudimos procesar el pago', detalle }, { status: 500 })
  }
}
