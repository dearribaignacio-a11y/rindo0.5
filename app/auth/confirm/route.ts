import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Ruta alternativa para el link de confirmación/recuperación, para cuando el
 * proyecto de Supabase esté en un plan que permita editar el HTML de los
 * emails (el plan gratuito bloquea el editor de "Source" de los templates).
 * Ahí sí conviene este flujo por servidor con `token_hash`, cambiando la
 * plantilla del correo para que apunte acá:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}
 *
 * Mientras el proyecto esté en el plan gratuito, el flujo activo es
 * `app/auth/callback/page.tsx`, que usa el link por defecto sin tocar el
 * template.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  if (token_hash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })

    if (!error) {
      const destino = type === 'recovery' ? '/auth/actualizar-password' : '/dashboard'
      return NextResponse.redirect(new URL(destino, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login?error=confirmacion', request.url))
}
