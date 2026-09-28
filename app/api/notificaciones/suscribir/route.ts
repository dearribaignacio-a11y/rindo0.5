import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Cuerpo {
  endpoint?: string
  keys?: { p256dh?: string; auth?: string }
}

/** Guarda la suscripción push del dispositivo actual. `upsert` por
 *  `endpoint` (es único): si el mismo navegador se vuelve a suscribir, sólo
 *  actualiza en vez de duplicar. */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as Cuerpo | null
  if (!cuerpo?.endpoint || !cuerpo.keys?.p256dh || !cuerpo.keys?.auth) {
    return NextResponse.json({ error: 'Suscripción inválida' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      endpoint: cuerpo.endpoint,
      p256dh: cuerpo.keys.p256dh,
      auth: cuerpo.keys.auth,
    },
    { onConflict: 'endpoint' },
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
