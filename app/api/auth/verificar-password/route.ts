import { NextResponse } from 'next/server'
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { TOPES, hayCupo } from '@/lib/server/limites'

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
  const { password } = ((await req.json().catch(() => ({}))) ?? {}) as { password?: unknown }
  if (typeof password !== 'string' || !password || password.length > 72) {
    return NextResponse.json({ error: 'Falta la contraseña' }, { status: 400 })
  }

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })
  }

  // Todos estos intentos le llegan a Supabase desde la misma IP (la de
  // Vercel): sin tope, alguien probando contraseñas acá podía hacer que
  // Supabase frene los logins de todos.
  if (!(await hayCupo(`password:${user.id}`, TOPES.passwordPorHora, 3600))) {
    return NextResponse.json({ error: 'Demasiados intentos. Probá de nuevo en un rato.' }, { status: 429 })
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
