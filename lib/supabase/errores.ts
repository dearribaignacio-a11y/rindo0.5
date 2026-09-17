import type { AuthError } from '@supabase/supabase-js'

/** Traduce los errores más comunes de Supabase Auth a mensajes serios en
 *  español. Nunca se muestra el error crudo de la API al usuario. */
export function mapAuthError(error: AuthError): string {
  const msg = error.message.toLowerCase()

  if (msg.includes('invalid login credentials')) {
    return 'El email o la contraseña no son correctos.'
  }
  if (msg.includes('email not confirmed')) {
    return 'Todavía no confirmaste tu correo. Revisá tu bandeja de entrada.'
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return 'Ya existe una cuenta con ese email.'
  }
  if (msg.includes('password') && (msg.includes('weak') || msg.includes('short'))) {
    return 'La contraseña es muy débil. Probá con otra combinación.'
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Hiciste demasiados intentos. Esperá un momento y volvé a probar.'
  }
  if (msg.includes('fetch') || msg.includes('network')) {
    return 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.'
  }

  return 'No pudimos completar la operación. Intentá de nuevo.'
}
