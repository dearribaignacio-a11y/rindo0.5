'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ChevronDown, Lock, Mail } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { Badge } from '@/components/ui/Bits'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { ORDEN_PLANES, PLANES } from '@/lib/plans'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import { createClient } from '@/lib/supabase/client'
import { mapAuthError } from '@/lib/supabase/errores'
import { PASS_MIN, emailValido, errorPassword, passwordValida } from '@/lib/validacion'
import type { PlanId } from '@/lib/types'

type Ciclo = 'mensual' | 'anual'
type Modo = 'ingresar' | 'crear'
type Paso = 'datos' | 'plan'

interface Errores {
  email?: string
  password?: string
  password2?: string
  general?: string
}

/**
 * Pantalla pública: iniciar sesión o crear una cuenta.
 *
 * Los dos flujos están separados a propósito. Antes la misma vista mezclaba
 * login, alta y elección de plan, y el alta recién se resolvía al tocar
 * "Elegir plan": quien ya tenía cuenta veía precios sin motivo y quien no la
 * tenía no entendía qué iba a pasar al tocar el botón. Ahora "Ingresar" pide
 * sólo credenciales, y "Crear cuenta" es un paso de datos seguido del paso de
 * elección de plan.
 *
 * El alta real (`supabase.auth.signUp()`) no ocurre acá: recién se dispara al
 * final de `SetupWizard`, que es donde se termina de juntar nombre, negocio y
 * teléfono para mandarlos como metadatos del `signUp()`. Esta pantalla sólo
 * junta credenciales y, si es alta nueva, el plan elegido.
 */
export function Login({
  onIngreso,
  onCrearCuenta,
}: {
  /** Login con cuenta existente confirmado contra Supabase. */
  onIngreso: () => void
  /** Datos + plan listos: falta el paso de `SetupWizard` antes del alta real. */
  onCrearCuenta: (plan: PlanId, email: string, password: string) => void
}) {
  const [modo, setModo] = useState<Modo>('ingresar')
  const [paso, setPaso] = useState<Paso>('datos')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [ciclo, setCiclo] = useState<Ciclo>('mensual')
  const [plan, setPlan] = useState<PlanId>('comercial')
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
      setPaso('plan')
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

  function elegirPlan(pid: PlanId) {
    setPlan(pid)
    // El alta real se dispara al final de SetupWizard, una vez juntados
    // nombre/negocio/teléfono: ahí recién hay metadatos completos para el
    // signUp(). Acá sólo pasamos la posta con lo que ya tenemos.
    onCrearCuenta(pid, email, password)
  }

  return (
    <div
      // Marca que habilita el ancho extra en desktop (ver .app-col en globals.css).
      data-pantalla="publica"
      className="min-h-dvh w-full px-5 pb-16 pt-14 sm:px-6 lg:px-10"
    >
      <div className="mx-auto w-full max-w-[440px] lg:max-w-none">
        <Logo size="lg" />

        <AnimatePresence mode="wait" initial={false}>
          {paso === 'datos' ? (
            <motion.div
              key="datos"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
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

                <AnimatePresence initial={false}>
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
                </AnimatePresence>

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
                  {modo === 'crear' ? 'Continuar' : 'Iniciar sesión'}
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
                  En el próximo paso elegís tu plan. El plan Hogar es gratis.
                </p>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="plan"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            >
              <PasoPlanes
                email={email}
                ciclo={ciclo}
                onCiclo={setCiclo}
                plan={plan}
                onPlan={setPlan}
                onElegir={elegirPlan}
                onVolver={() => setPaso('datos')}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <RecuperarSheet
        open={recuperando}
        onClose={() => setRecuperando(false)}
        emailInicial={email}
      />
    </div>
  )
}

/* ── Paso 2: elección de plan ──────────────────────────────────────────── */

function PasoPlanes({
  email,
  ciclo,
  onCiclo,
  plan,
  onPlan,
  onElegir,
  onVolver,
}: {
  email: string
  ciclo: Ciclo
  onCiclo: (c: Ciclo) => void
  plan: PlanId
  onPlan: (p: PlanId) => void
  onElegir: (p: PlanId) => void
  onVolver: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onVolver}
        className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Volver
      </button>

      <div className="lg:flex lg:items-end lg:justify-between lg:gap-8">
        <div>
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">Elegí tu plan</h2>
          <p className="mt-1 text-[13.5px] text-ink-muted">
            Creando la cuenta de <span className="text-ink">{email}</span>. Podés cambiar de plan
            cuando quieras.
          </p>
        </div>

        <Segmented
          className="mt-4 lg:mt-0 lg:w-[340px] lg:shrink-0"
          layoutId="ciclo-plan"
          semantica="radio"
          etiqueta="Ciclo de facturación"
          value={ciclo}
          onChange={onCiclo}
          opciones={[
            { id: 'mensual', label: 'Mensual' },
            { id: 'anual', label: 'Anual · 2 meses gratis' },
          ]}
        />
      </div>

      <div className="mt-5 grid gap-3.5 lg:grid-cols-3 lg:items-start lg:gap-5">
        {ORDEN_PLANES.map((pid) => (
          <TarjetaPlan
            key={pid}
            plan={pid}
            ciclo={ciclo}
            seleccionado={plan === pid}
            onSeleccionar={() => onPlan(pid)}
            onElegir={() => onElegir(pid)}
          />
        ))}
      </div>

      <div className="mx-auto mt-6 max-w-[640px]">
        <DetallesFacturacion />

        <p className="mt-4 text-center text-xs leading-relaxed text-ink-faint">
          El plan Hogar es gratis y se financia con anuncios. Los planes pagos no muestran
          publicidad.
        </p>
      </div>
    </>
  )
}

function TarjetaPlan({
  plan,
  ciclo,
  seleccionado,
  onSeleccionar,
  onElegir,
}: {
  plan: PlanId
  ciclo: Ciclo
  seleccionado: boolean
  onSeleccionar: () => void
  onElegir: () => void
}) {
  const p = PLANES[plan]
  const Icon = p.icon
  const precio = ciclo === 'mensual' ? p.mensual : p.anual
  const gratis = p.mensual === 0

  // El descuento se deriva de los precios en vez de escribirse a mano: así la
  // etiqueta no puede quedar desfasada de los importes si mañana cambian.
  const anualLleno = p.mensual * 12
  const ahorro = anualLleno - p.anual
  const dtoPct = anualLleno > 0 ? Math.round((ahorro / anualLleno) * 100) : 0
  const equivalenteMensual = p.anual / 12

  return (
    <motion.div
      onClick={onSeleccionar}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      className={cn(
        'flex cursor-pointer flex-col rounded-card border bg-surface p-4 transition-colors duration-200',
        'lg:h-full',
        p.recomendado
          ? 'border-accent-hi/60 shadow-[0_10px_34px_rgba(0,0,0,0.45)]'
          : 'border-line',
        seleccionado && 'border-accent-hi bg-accent-dim/25',
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'grid size-12 shrink-0 place-items-center rounded-[14px] border',
            p.recomendado || seleccionado
              ? 'border-accent-hi/40 bg-accent-dim text-accent-hi'
              : 'border-line-strong bg-surface-2 text-ink-muted',
          )}
        >
          <Icon className="size-6" strokeWidth={1.5} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-ink">{p.nombre}</h3>
            {p.badge && <Badge tone="accent">{p.badge}</Badge>}
          </div>
          <p className="mt-0.5 text-[13px] text-ink-faint">{p.bajada}</p>
        </div>

        <div className="shrink-0 text-right">
          {gratis ? (
            <span className="font-display text-[20px] font-bold tracking-[-0.02em] text-pos">
              Gratis
            </span>
          ) : (
            <>
              <span className="tabular font-display text-[20px] font-bold tracking-[-0.02em] text-ink">
                {money(precio)}
              </span>
              <span className="block text-[11px] text-ink-faint">
                {ciclo === 'mensual' ? 'por mes' : 'por año'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Modalidad de cobro y ahorro real, en pesos. Antes el plan anual sólo
          mostraba el total: no quedaba claro cuánto se ahorraba ni que el
          cobro es de una sola vez por los doce meses. */}
      {!gratis && (
        <p className="mt-3 rounded-[10px] bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
          {ciclo === 'anual' ? (
            <>
              Se factura <span className="tabular text-ink">{money(p.anual)}</span> una vez por año
              — equivale a <span className="tabular text-ink">{money(equivalenteMensual)}</span> por
              mes.
              <br />
              <span className="text-pos">
                Ahorrás <span className="tabular">{money(ahorro)}</span> ({dtoPct}%)
              </span>{' '}
              frente a pagar mes a mes.
            </>
          ) : (
            <>
              Se factura <span className="tabular text-ink">{money(p.mensual)}</span> por mes.
              Pasando a anual ahorrás <span className="tabular text-pos">{money(ahorro)}</span> (
              {dtoPct}%).
            </>
          )}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {p.features.map((f) => (
          <li key={f.texto} className="flex items-center gap-2.5">
            <f.icon className="size-[17px] shrink-0 text-accent-hi" strokeWidth={1.8} />
            <span className="text-[13.5px] text-ink-muted">{f.texto}</span>
          </li>
        ))}
      </ul>

      <Button
        full
        size="md"
        className="mt-4 lg:mt-auto"
        // Los tres botones decían "Elegir plan": fuera de contexto, un lector
        // de pantalla escuchaba tres veces lo mismo sin saber cuál era cuál.
        aria-label={`Elegir plan ${p.nombre}`}
        onClick={(e) => {
          e.stopPropagation()
          onElegir()
        }}
      >
        Elegir {p.nombre}
      </Button>
    </motion.div>
  )
}

/* ── Detalles de facturación ───────────────────────────────────────────── */

function DetallesFacturacion() {
  const [abierto, setAbierto] = useState(false)

  return (
    <div className="rounded-card border border-line bg-surface">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="text-[13.5px] font-medium text-ink">Ver detalles de facturación</span>
        <ChevronDown
          className={cn(
            'size-[18px] shrink-0 text-ink-muted transition-transform duration-200',
            abierto && 'rotate-180',
          )}
        />
      </button>

      <AnimatePresence initial={false}>
        {abierto && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            {/* TODO: confirmar con el cliente. Los plazos y la política de
                reembolso están puestos con los valores más habituales del
                mercado local; hay que validarlos antes de salir a producción. */}
            <dl className="space-y-3 px-4 pb-4 text-[12.5px] leading-relaxed">
              <div>
                <dt className="font-medium text-ink">Cuándo se cobra</dt>
                <dd className="text-ink-muted">
                  El primer cobro se hace al confirmar el plan. Los planes mensuales se renuevan el
                  mismo día de cada mes; los anuales, una vez al año.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Renovación</dt>
                <dd className="text-ink-muted">
                  La suscripción se renueva sola. Te avisamos por email antes de cada renovación.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Cancelación</dt>
                <dd className="text-ink-muted">
                  Podés cancelar cuando quieras desde Ajustes. Seguís con el plan activo hasta el
                  final del período ya pagado, sin cobros nuevos.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Cambio de plan</dt>
                <dd className="text-ink-muted">
                  Al subir de plan se cobra la diferencia proporcional. Al bajar a Hogar tus datos
                  no se borran: las funciones de comercio quedan sin acceso hasta que vuelvas a un
                  plan pago.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-ink">Medios de pago</dt>
                <dd className="text-ink-muted">
                  Tarjeta de crédito o débito. Los precios están en pesos e incluyen IVA.
                </dd>
              </div>
            </dl>

            <div className="border-t border-line px-4 py-3">
              <p className="text-[12px] text-ink-faint">
                Al continuar aceptás los{' '}
                <a href="/terminos" className="text-accent-hi underline-offset-2 hover:underline">
                  Términos y Condiciones
                </a>{' '}
                y la{' '}
                <a href="/privacidad" className="text-accent-hi underline-offset-2 hover:underline">
                  Política de Privacidad
                </a>
                .
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
