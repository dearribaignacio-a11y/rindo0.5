import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { endpointPushValido } from '@/lib/server/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Cuerpo {
  endpoint?: unknown
  keys?: { p256dh?: unknown; auth?: unknown }
}

/** Guarda la suscripción push del dispositivo actual. `upsert` por
 *  `endpoint` (es único): si el mismo navegador se vuelve a suscribir, sólo
 *  actualiza en vez de duplicar. */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as Cuerpo | null
  const endpoint = cuerpo?.endpoint
  const p256dh = cuerpo?.keys?.p256dh
  const auth = cuerpo?.keys?.auth
  if (
    typeof endpoint !== 'string' ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    !endpointPushValido(endpoint) ||
    p256dh.length > 200 ||
    auth.length > 100
  ) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ user_id: user.id, endpoint, p256dh, auth }, { onConflict: 'endpoint' })
  if (error) {
    console.error('[suscribir]', error.message)
    return NextResponse.json({ error: 'No pudimos guardar la suscripción' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
