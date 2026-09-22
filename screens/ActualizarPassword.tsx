'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/supabase/errores'
import { errorPassword, passwordValida } from '@/lib/validacion'

/** Paso final de "olvidé mi contraseña": ya hay una sesión temporal abierta
 *  por el link de recuperación, así que sólo hace falta pedir la nueva. */
export function ActualizarPassword() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [error, setError] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  async function guardar(ev: React.FormEvent) {
    ev.preventDefault()
    const err = errorPassword(password)
    if (err) return setError(err)
    if (password !== password2) return setError('Las contraseñas no coinciden')

    setError(undefined)
    setGuardando(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setGuardando(false)

    if (updateError) {
      setError(mapAuthError(updateError))
      return
    }

    // Navegación dura (no router.push): el cliente de Supabase escribe la
    // cookie de sesión nueva de forma asíncrona (en su propio listener de
    // onAuthStateChange), no dentro de esta misma promesa — una navegación
    // por el router de Next puede llegar a /dashboard antes de que esa
    // cookie se haya escrito, y el middleware, viendo la sesión vieja de
    // recuperación, te manda de vuelta al login. Con navegación dura el
    // servidor recibe la cookie ya escrita.
    window.location.href = '/dashboard'
  }

  return (
    <div className="flex min-h-dvh w-full flex-col px-5 pb-16 pt-14 sm:px-6">
      <div className="mx-auto w-full max-w-[440px]">
        <Logo size="lg" />

        <h1 className="mt-7 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">
          Elegí tu nueva contraseña
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Después de guardarla vas a entrar directo a tu cuenta.
        </p>

        <form onSubmit={guardar} noValidate className="mt-6 space-y-3.5">
          <Input
            label="Nueva contraseña"
            reveal
            required
            autoComplete="new-password"
            leading={<Lock className="size-[18px]" strokeWidth={1.9} />}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              if (error) setError(undefined)
            }}
            hint={!error ? 'Al menos 8 caracteres, con letras y números' : undefined}
          />
          <Input
            label="Repetir contraseña"
            reveal
            required
            autoComplete="new-password"
            leading={<Lock className="size-[18px]" strokeWidth={1.9} />}
            value={password2}
            onChange={(e) => {
              setPassword2(e.target.value)
              if (error) setError(undefined)
            }}
            error={error}
          />

          <Button
            full
            size="lg"
            type="submit"
            loading={guardando}
            disabled={!passwordValida(password)}
          >
            Guardar y entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
