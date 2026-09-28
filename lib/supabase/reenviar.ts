import type { AuthError } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

/**
 * Vuelve a mandar el correo de confirmación de alta. El link aterriza en el
 * mismo callback que el del `signUp()` original (ver `app/auth/callback`).
 */
export async function reenviarConfirmacion(email: string): Promise<AuthError | null> {
  const supabase = createClient()
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
  })
  return error
}
