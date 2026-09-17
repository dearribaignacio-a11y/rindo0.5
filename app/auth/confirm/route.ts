import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Destino de los links de confirmación de email y de recuperación de
 * contraseña que manda Supabase. Requiere que la plantilla de cada correo
 * (Authentication → Email Templates, en el dashboard de Supabase) use
 * `token_hash` en vez de `ConfirmationURL`:
 *
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}
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
