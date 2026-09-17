/**
 * Política de contraseñas. Rindo maneja plata de un negocio, así que el
 * mínimo de 6 sin exigencia de composición se quedaba corto.
 *
 * TODO: confirmar con el cliente. Se eligió 8 caracteres con al menos una
 * letra y un número — el piso habitual sin volverse hostil en un teclado de
 * celular. Esta misma regla está reflejada en el `check` de Supabase Auth
 * (mínimo de caracteres configurado en el proyecto).
 */
export const PASS_MIN = 8
const tieneLetra = (s: string) => /[a-zA-Z]/.test(s)
const tieneNumero = (s: string) => /\d/.test(s)
export const passwordValida = (s: string) => s.length >= PASS_MIN && tieneLetra(s) && tieneNumero(s)

export function errorPassword(s: string) {
  if (s.length < PASS_MIN) return `Mínimo ${PASS_MIN} caracteres`
  if (!tieneLetra(s) || !tieneNumero(s)) return 'Combiná letras y números'
  return undefined
}

export const emailValido = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s)
