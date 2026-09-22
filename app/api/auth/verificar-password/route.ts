import { NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Confirma que `password` es la contraseña actual del usuario logueado, sin
 * tocar su sesión real — la usa "Cambiar contraseña" (Ajustes) antes de
 * aplicar la nueva. Antes esto se hacía en el navegador llamando
 * `signInWithPassword` sobre el mismo cliente de la sesión activa, pero eso
 * la reemplaza por una sesión nueva y, si se cruzaba con el refresco
 * automático de esa misma sesión (el token viejo queda invalidado al toque),
 * Supabase lo tomaba como un intento de reusar un refresh token y cerraba la
 * sesión por seguridad — el usuario quedaba deslogueado justo al cambiar la
 * contraseña. Verificando con un cliente aislado (sin persistir nada) la
 * sesión real de las cookies nunca se toca.
 */
export async function POST(req: Request) {
  const { password } = (await req.json()) as { password?: string }
  if (!password) {
    return NextResponse.json({ error: 'Falta la contraseña' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  const aislado = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await aislado.auth.signInWithPassword({ email: user.email, password })
  if (error) {
    return NextResponse.json({ error: 'incorrecta' }, { status: 401 })
  }

  return NextResponse.json({ ok: true })
}
