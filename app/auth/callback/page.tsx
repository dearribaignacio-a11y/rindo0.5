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
 * eso usamos el link por defecto (`{{ .ConfirmationURL }}`): ese link pega
 * primero contra el propio servidor de Supabase, que valida el token y
 * redirige acá con la sesión en el fragmento de la URL
 * (`#access_token=...&type=signup`). El cliente de `@supabase/ssr` detecta
 * ese fragmento solo al crearse y guarda la sesión en cookies — sólo hay que
 * esperar a que dispare el evento y mandar a cada quien a donde corresponda.
 */
export default function AuthCallbackPage() {
  const [error, setError] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) return
      const params = new URLSearchParams(window.location.hash.slice(1))
      const tipo = params.get('type')
      // Navegación dura (no router.push): así el servidor recibe la cookie
      // de sesión recién escrita en esta misma carga, no una request en caché.
      window.location.href = tipo === 'recovery' ? '/auth/actualizar-password' : '/dashboard'
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
          El link no es válido o ya venció. Volvé al login e intentá de nuevo.
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
