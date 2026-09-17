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
 * Hay que canjear ese code por una sesión con `exchangeCodeForSession` —
 * necesita el "code verifier" que el propio navegador guardó en una cookie
 * al llamar `signUp()`/`resetPasswordForEmail()`, así que el link sólo
 * funciona si se abre en el mismo navegador donde se inició el trámite.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const esRecovery = params.get('next') === 'recovery'

    if (!code) {
      setError(true)
      return
    }

    const supabase = createClient()
    supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
      if (exchangeError || !data.session) {
        setError(true)
        return
      }
      // Navegación dura (no router.push): así el servidor recibe la cookie
      // de sesión recién escrita en esta misma carga, no una request en caché.
      window.location.href = esRecovery ? '/auth/actualizar-password' : '/dashboard'
    })
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
