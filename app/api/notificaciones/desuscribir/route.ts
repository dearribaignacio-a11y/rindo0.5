import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Borra la suscripción push de este dispositivo. La política de RLS ya
 *  limita el borrado a filas del usuario logueado, aunque acá sólo se
 *  filtre por `endpoint`. */
export async function POST(req: Request) {
  const { endpoint } = ((await req.json().catch(() => ({}))) ?? {}) as { endpoint?: unknown }
  if (typeof endpoint !== 'string' || !endpoint || endpoint.length > 1000) {
    return NextResponse.json({ error: 'Falta el endpoint' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

  const { error } = await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint)
  if (error) {
    console.error('[desuscribir]', error.message)
    return NextResponse.json({ error: 'No pudimos borrar la suscripción' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
