import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/supabase/errores'

/**
 * Alta de cuenta desde el navegador.
 *
 * Primero intenta el alta por servidor (`app/auth/registro`), que deja la
 * cuenta confirmada sin mandar ningún correo, y enseguida inicia sesión. Si
 * el servidor no tiene la Service Role Key cae al `signUp()` de siempre, que
 * depende del correo de confirmación de Supabase.
 */
export async function crearCuenta(
  email: string,
  password: string,
  datos: Record<string, unknown>,
): Promise<{ error?: string; conSesion: boolean }> {
  const supabase = createClient()

  let res: Response | null = null
  try {
    res = await fetch('/auth/registro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, data: datos }),
    })
  } catch {
    return { error: 'No pudimos conectarnos. Revisá tu conexión e intentá de nuevo.', conSesion: false }
  }

  if (res.status !== 503) {
    const cuerpo = (await res.json().catch(() => ({}))) as { ok?: boolean; nueva?: boolean; error?: string }
    if (!res.ok || !cuerpo.ok) {
      return { error: traducir(cuerpo.error, res.status), conSesion: false }
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      // La cuenta ya existía y la contraseña no es la de esa cuenta.
      return {
        error: cuerpo.nueva
          ? mapAuthError(error)
          : 'Ya existe una cuenta con ese email. Volvé e iniciá sesión, o usá "¿Olvidaste tu contraseña?".',
        conSesion: false,
      }
    }
    return { conSesion: true }
  }

  // Sin Service Role Key en el servidor: alta clásica con correo.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: datos,
    },
  })
  if (error) return { error: mapAuthError(error), conSesion: false }

  // Email ya registrado: Supabase no da error ni manda correo, devuelve un
  // usuario sin identidades.
  if (data.user && data.user.identities?.length === 0) {
    return {
      error: 'Ya existe una cuenta con ese email. Volvé e iniciá sesión, o usá "¿Olvidaste tu contraseña?".',
      conSesion: false,
    }
  }
  return { conSesion: Boolean(data.session) }
}

/**
 * Si el login falla porque la cuenta no está confirmada, la confirma por
 * servidor. Devuelve `true` si vale la pena reintentar el login.
 */
export async function confirmarPendiente(email: string): Promise<boolean> {
  try {
    const res = await fetch('/auth/confirmar-cuenta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    return res.ok
  } catch {
    return false
  }
}

function traducir(msg?: string, status?: number): string {
  if (status === 429) return 'Demasiados intentos desde esta conexión. Probá de nuevo en un rato.'
  const m = (msg ?? '').toLowerCase()
  if (m.includes('password')) return 'La contraseña es muy débil. Probá con otra combinación.'
  if (m.includes('email')) return 'Ese email no es válido.'
  return 'No pudimos crear la cuenta. Intentá de nuevo.'
}
