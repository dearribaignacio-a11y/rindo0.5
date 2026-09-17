'use client'

import { useEffect, useState } from 'react'
import { Logo } from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'

/**
 * Destino de los links de confirmación de email y recuperación de contraseña
 * en el plan gratuito de Supabase.
 *
 * El plan gratuito no deja editar el HTML de los templates de correo (el
 * editor de "Source" queda bloqueado), así que no podemos armar un link con
 * `token_hash` como recomienda Supabase para el flujo por servidor. En vez de
 * eso usamos el link por defecto (`{{ .ConfirmationURL }}`) con el flujo PKCE
 * que fuerza `@supabase/ssr`: ese link pega primero contra el servidor de
 * Supabase, que valida el token y redirige acá con un `?code=...` en la URL.
 *
 * Importante: NO hay que canjear ese `code` a mano. El cliente de Supabase ya
 * lo detecta y lo canjea solo apenas se crea (`detectSessionInUrl`), porque
 * el flujo es PKCE. Un segundo canje manual falla siempre, porque el código
 * sirve una sola vez. Sólo hace falta escuchar cuándo la sesión quedó lista.
 *
 * Para saber si es un link de recuperación (y mandar a poner contraseña
 * nueva) usamos el evento `PASSWORD_RECOVERY` que dispara `onAuthStateChange`
 * — es la señal propia de Supabase para esto. Antes usábamos un parámetro
 * `?next=recovery` agregado a mano en el link, pero no sobrevivía el
 * redirect intermedio por el servidor de Supabase.
 *
 * Como es PKCE, el link sólo funciona si se abre en el mismo navegador donde
 * se inició el trámite — ahí es donde vive el "code verifier" guardado.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) return
      // Navegación dura (no router.push): así el servidor recibe la cookie
      // de sesión recién escrita en esta misma carga, no una request en caché.
      window.location.href = event === 'PASSWORD_RECOVERY' ? '/auth/actualizar-password' : '/dashboard'
    })

    const timeout = setTimeout(() => setError(true), 6000)

    return () => {
      sub.subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  if (error) {
    return (
      <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-3 px-5 text-center">
        <Logo size="lg" />
        <p className="max-w-[36ch] text-[15px] leading-relaxed text-ink-muted">
          El link no es válido, ya venció, o se abrió en un navegador distinto al que usaste para
          registrarte. Volvé al login e intentá de nuevo desde el mismo navegador.
        </p>
      </div>
    )
  }

  return (
    <div className="grid min-h-dvh place-items-center">
      <Logo size="lg" />
    </div>
  )
}
