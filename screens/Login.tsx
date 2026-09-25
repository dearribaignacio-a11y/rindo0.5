'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/supabase/errores'
import { PASS_MIN, emailValido, errorPassword } from '@/lib/validacion'
import type { PlanId } from '@/lib/types'

type Modo = 'ingresar' | 'crear'

interface Errores {
  email?: string
  password?: string
  password2?: string
  general?: string
}

/**
 * Pantalla pública: iniciar sesión o crear una cuenta.
 *
 * Ya no hay un paso de "elegí tu plan": toda cuenta nueva arranca directo con
 * un mes gratis del plan más completo (Comercial Pro), para que se pueda
 * probar la app a fondo antes de decidir si se paga o se pasa al plan Hogar,
 * gratis para siempre. Quién arranca con qué plan de acá en más lo define el
 * trigger `handle_new_user` del lado del servidor (ver migración 0008), no
 * este formulario.
 *
 * El alta real (`supabase.auth.signUp()`) no ocurre acá: recién se dispara al
 * final de `SetupWizard`, que es donde se termina de juntar nombre, negocio y
 * teléfono para mandarlos como metadatos del `signUp()`. Esta pantalla sólo
 * junta las credenciales.
 */
export function Login({
  onIngreso,
  onCrearCuenta,
}: {
  /** Login con cuenta existente confirmado contra Supabase. */
  onIngreso: () => void
  /** Credenciales listas: falta el paso de `SetupWizard` antes del alta real. */
  onCrearCuenta: (plan: PlanId, email: string, password: string) => void
}) {
  const [modo, setModo] = useState<Modo>('ingresar')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [cargando, setCargando] = useState<'sesion' | null>(null)
  const [recuperando, setRecuperando] = useState(false)

  const refEmail = useRef<HTMLInputElement>(null)
  const refPass = useRef<HTMLInputElement>(null)
  const refPass2 = useRef<HTMLInputElement>(null)

  /**
   * Valida todos los campos de una sola vez — nada de ir revelando un error
   * por intento — y manda el foco al primero que falla.
   */
  function validarDatos(): boolean {
    const e: Errores = {}
    if (!emailValido(email)) e.email = 'Ingresá un email válido'

    if (modo === 'crear') {
      e.password = errorPassword(password)
      if (password2 !== password) e.password2 = 'Las contraseñas no coinciden'
    } else if (password.length === 0) {
      e.password = 'Ingresá tu contraseña'
    }

    setErrores(e)

    const primero = e.email ? refEmail : e.password ? refPass : e.password2 ? refPass2 : null
    primero?.current?.focus()
    return !e.email && !e.password && !e.password2
  }

  async function enviarDatos(ev: React.FormEvent) {
    ev.preventDefault()
    if (!validarDatos()) return

    if (modo === 'crear') {
      // Ya no se elige plan en el alta: toda cuenta nueva arranca con el mes
      // gratis de Comercial Pro (ver comentario de arriba). El alta real se
      // dispara al final de SetupWizard, una vez juntados nombre/negocio/
      // teléfono.
      onCrearCuenta('comercial-pro', email, password)
      return
    }

    setCargando('sesion')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setCargando(null)

    if (error) {
      setErrores({ general: mapAuthError(error) })
      return
    }

    onIngreso()
  }

  return (
    <div
      // Marca que habilita el ancho extra en desktop (ver .app-col en globals.css).
      data-pantalla="publica"
      className="min-h-dvh w-full px-5 pb-16 pt-14 sm:px-6 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[440px] lg:max-w-none">
        <Logo size="lg" />

        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto w-full max-w-[440px]"
        >
          <h1 className="mt-7 text-[27px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
            Tus números, ordenados.
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-muted">
            Gastos del hogar o gestión de tu comercio, en una sola app.
          </p>

          <Segmented
            className="mt-7"
            layoutId="modo-acceso"
            semantica="radio"
            etiqueta="¿Ya tenés cuenta?"
            value={modo}
            onChange={(m) => {
              setModo(m)
              setErrores({})
            }}
            opciones={[
              { id: 'ingresar', label: 'Ingresar' },
              { id: 'crear', label: 'Crear cuenta' },
            ]}
          />

          {/* Form real: validación nativa del navegador, autocompletado y
              Enter para enviar sin depender de un onKeyDown a mano. */}
          <form onSubmit={enviarDatos} noValidate className="mt-5 space-y-3.5">
            <Input
              ref={refEmail}
              name="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              required
              placeholder="tunombre@email.com"
              leading={<Mail className="size-[18px]" strokeWidth={1.9} />}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (errores.email) setErrores((x) => ({ ...x, email: undefined }))
              }}
              error={errores.email}
            />

            <Input
              ref={refPass}
              name="password"
              label="Contraseña"
              reveal
              required
              autoComplete={modo === 'crear' ? 'new-password' : 'current-password'}
              placeholder="Tu contraseña"
              leading={<Lock className="size-[18px]" strokeWidth={1.9} />}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (errores.password) setErrores((x) => ({ ...x, password: undefined }))
              }}
              error={errores.password}
              hint={
                modo === 'crear' && !errores.password
                  ? `Al menos ${PASS_MIN} caracteres, con letras y números`
                  : undefined
              }
            />

            {modo === 'crear' && (
              <motion.div
                key="password2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <Input
                  ref={refPass2}
                  name="password2"
                  label="Repetir contraseña"
                  reveal
                  required
                  autoComplete="new-password"
                  placeholder="Repetí la contraseña"
                  leading={<Lock className="size-[18px]" strokeWidth={1.9} />}
                  value={password2}
                  onChange={(e) => {
                    setPassword2(e.target.value)
                    if (errores.password2) setErrores((x) => ({ ...x, password2: undefined }))
                  }}
                  error={errores.password2}
                />
              </motion.div>
            )}

            {/* Los errores se anuncian a los lectores de pantalla apenas
                aparecen, sin robarle el foco a nadie. */}
            <div aria-live="polite" className="sr-only">
              {[errores.email, errores.password, errores.password2, errores.general]
                .filter(Boolean)
                .join('. ')}
            </div>

            {errores.general && (
              <p className="rounded-input border border-neg/40 bg-neg-dim px-3.5 py-2.5 text-[13px] leading-relaxed text-neg">
                {errores.general}
              </p>
            )}

            <Button full size="lg" type="submit" loading={cargando === 'sesion'}>
              {modo === 'crear' ? 'Crear mi cuenta' : 'Iniciar sesión'}
            </Button>
          </form>

          {modo === 'ingresar' && (
            <div className="mt-2 text-center">
              <button
                type="button"
                onClick={() => setRecuperando(true)}
                // Objetivo táctil de 44px de alto: el texto sigue chico,
                // el área tocable no.
                className="inline-flex min-h-11 items-center px-3 text-[13px] text-ink-muted transition-colors hover:text-ink"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          )}

          {modo === 'crear' && (
            <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
              Arrancás con 30 días gratis del plan Comercial Pro, para probar todo. Después elegís si
              seguís pagando o pasás al plan Hogar, gratis para siempre.
            </p>
          )}
        </motion.div>
      </div>

      <RecuperarSheet open={recuperando} onClose={() => setRecuperando(false)} emailInicial={email} />
    </div>
  )
}

/* ── Recuperar contraseña ──────────────────────────────────────────────── */

function RecuperarSheet({
  open,
  onClose,
  emailInicial,
}: {
  open: boolean
  onClose: () => void
  emailInicial: string
}) {
  const [email, setEmail] = useState(emailInicial)
  const [error, setError] = useState<string | undefined>()
  const [enviado, setEnviado] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!open) return
    setEmail(emailInicial)
    setError(undefined)
    setEnviado(false)
  }, [open, emailInicial])

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    if (!emailValido(email)) {
      setError('Ingresá un email válido')
      return
    }
    setError(undefined)
    setEnviando(true)
    const supabase = createClient()
    // La respuesta de Supabase no revela si el email existe o no — el mensaje
    // de "enviado" es siempre el mismo, así no se filtra qué cuentas existen.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    setEnviando(false)
    setEnviado(true)
  }

  return (
    // Sheet ya aporta role="dialog", aria-modal, cierre con Escape, trampa de
    // foco, foco inicial en el primer campo y devolución del foco al cerrar.
    <Sheet
      open={open}
      onClose={onClose}
      title="¿Olvidaste tu contraseña?"
      subtitle={enviado ? undefined : 'Te mandamos un link para restablecerla.'}
    >
      {enviado ? (
        <div className="pb-4">
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Si <span className="text-ink">{email}</span> tiene una cuenta en Rindo, va a recibir un
            correo con el link para restablecer la contraseña. Revisá también el correo no deseado.
          </p>
          <Button full size="lg" className="mt-4" onClick={onClose}>
            Entendido
          </Button>
        </div>
      ) : (
        <form onSubmit={enviar} noValidate className="pb-4">
          <Input
            name="email"
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            placeholder="tunombre@email.com"
            leading={<Mail className="size-[18px]" strokeWidth={1.9} />}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              if (error) setError(undefined)
            }}
            error={error}
          />
          <div aria-live="polite" className="sr-only">
            {error}
          </div>
          <Button full size="lg" type="submit" loading={enviando} className="mt-4">
            Enviar link
          </Button>
        </form>
      )}
    </Sheet>
  )
}
