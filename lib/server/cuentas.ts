import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Altas sin correo de confirmación.
 *
 * El correo que manda Supabase por defecto (plan gratuito, sin SMTP propio)
 * casi nunca llega, y sin confirmar no se puede entrar. Para no depender de
 * eso, las cuentas se crean y se confirman del lado del servidor con la
 * Service Role Key. La contraseña la sigue validando Supabase en el
 * `signInWithPassword()` que hace el navegador después.
 */

/** `null` si el servidor no tiene la Service Role Key cargada. */
export function adminOpcional(): SupabaseClient | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  return createAdminClient() as unknown as SupabaseClient
}

/**
 * Marca como confirmado el email de una cuenta existente. `generateLink` se
 * usa sólo para obtener el usuario a partir del email: no manda ningún correo.
 * Va con `recovery` y no `magiclink` porque este último crea el usuario si no
 * existe. Devuelve `false` si no hay cuenta con ese email.
 */
export async function confirmarPorEmail(admin: SupabaseClient, email: string): Promise<boolean> {
  try {
    const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
    const user = data?.user
    if (error || !user) return false
    if (user.email_confirmed_at) return true

    const { error: errUpd } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true })
    return !errUpd
  } catch {
    return false
  }
}
