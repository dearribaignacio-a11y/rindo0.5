'use client'

import { useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ImagePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Logo } from '@/components/ui/Logo'
import { Select, MoneyInput, OptionGroup, Field } from '@/components/ui/Field'
import { Steps, Avatar } from '@/components/ui/Bits'
import { BottomBar } from '@/components/ui/BottomBar'
import { ANTIGUEDADES, RANGOS_EMPLEADOS, RUBROS } from '@/lib/seed'
import { PLANES } from '@/lib/plans'
import { cn } from '@/lib/cn'
import type { Perfil, PlanId } from '@/lib/types'

const MONEDAS = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar (USD)' },
]

/**
 * Configuración inicial, después de elegir plan y antes del onboarding.
 *
 * Es un wizard de tres pasos y no un formulario largo: son datos que el
 * usuario tipea con una mano, parado en el mostrador. Cada paso pide como
 * mucho dos cosas y el avance está bloqueado sólo por lo imprescindible.
 */
export function SetupWizard({
  plan,
  email,
  onListo,
  onVolver,
}: {
  plan: PlanId
  email: string
  onListo: (perfil: Perfil) => void
  onVolver: () => void
}) {
  const comercial = plan !== 'hogar'
  const [paso, setPaso] = useState(0)
  const [guardando, setGuardando] = useState(false)

  /* Hogar */
  const [nombre, setNombre] = useState('')
  const [integrantes, setIntegrantes] = useState(2)
  const [ingreso, setIngreso] = useState<number | null>(null)

  /* Comercial */
  const [negocio, setNegocio] = useState('')
  const [rubro, setRubro] = useState<string>('Almacén')
  const [antiguedad, setAntiguedad] = useState<string | null>('1-2 años')
  const [empleadosRango, setEmpleadosRango] = useState<string | null>('1-3')
  const [ciudad, setCiudad] = useState('San Juan')
  const [logo, setLogo] = useState<string | undefined>()

  const [moneda, setMoneda] = useState('ARS')
  const [error, setError] = useState<string>()

  const total = 3

  /** Qué falta para poder avanzar desde el paso actual. */
  const bloqueo = useMemo(() => {
    if (comercial) {
      if (paso === 0 && negocio.trim().length < 2) return 'Poné el nombre de tu negocio'
      if (paso === 1 && (!antiguedad || !empleadosRango)) return 'Elegí una opción en cada pregunta'
      if (paso === 2 && ciudad.trim().length < 2) return 'Indicá tu ciudad o localidad'
      return null
    }
    if (paso === 0 && nombre.trim().length < 2) return 'Escribí tu nombre'
    return null
  }, [comercial, paso, negocio, antiguedad, empleadosRango, ciudad, nombre])

  function avanzar() {
    if (bloqueo) {
      setError(bloqueo)
      return
    }
    setError(undefined)
    if (paso < total - 1) {
      setPaso((p) => p + 1)
      return
    }

    setGuardando(true)
    const perfil: Perfil = comercial
      ? {
          nombre: nombre.trim() || 'Dueño/a',
          email,
          plan,
          moneda,
          negocio: negocio.trim(),
          rubro,
          antiguedad: antiguedad ?? undefined,
          empleadosRango: empleadosRango ?? undefined,
          ciudad: ciudad.trim(),
          logo,
        }
      : {
          nombre: nombre.trim(),
          email,
          plan,
          moneda,
          integrantes,
          ingresoMensual: ingreso ?? undefined,
        }
    setTimeout(() => onListo(perfil), 420)
  }

  function retroceder() {
    setError(undefined)
    if (paso === 0) onVolver()
    else setPaso((p) => p - 1)
  }

  return (
    <div className="flex min-h-dvh w-full flex-col px-5 pb-40 pt-6 sm:px-6">
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={retroceder}
          aria-label="Volver"
          className="-ml-2 grid size-10 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
        <Logo size="sm" mark={false} />
        <span className="ml-auto text-[12px] font-medium text-ink-faint">
          Plan {PLANES[plan].nombre}
        </span>
      </header>

      <div className="mt-6 flex items-center gap-3">
        <Steps total={total} actual={paso} />
        <span className="tabular text-[12px] text-ink-faint">
          Paso {paso + 1} de {total}
        </span>
      </div>

      <div className="relative mt-6 flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={paso}
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            {comercial ? (
              <PasosComercio
                paso={paso}
                negocio={negocio}
                setNegocio={setNegocio}
                rubro={rubro}
                setRubro={setRubro}
                antiguedad={antiguedad}
                setAntiguedad={setAntiguedad}
                empleadosRango={empleadosRango}
                setEmpleadosRango={setEmpleadosRango}
                ciudad={ciudad}
                setCiudad={setCiudad}
                logo={logo}
                setLogo={setLogo}
                nombre={nombre}
                setNombre={setNombre}
                moneda={moneda}
                setMoneda={setMoneda}
              />
            ) : (
              <PasosHogar
                paso={paso}
                nombre={nombre}
                setNombre={setNombre}
                integrantes={integrantes}
                setIntegrantes={setIntegrantes}
                ingreso={ingreso}
                setIngreso={setIngreso}
                moneda={moneda}
                setMoneda={setMoneda}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <BottomBar>
        {error && <p className="mb-2 text-center text-xs text-neg">{error}</p>}
        <Button full size="lg" loading={guardando} onClick={avanzar}>
          {paso < total - 1 ? 'Continuar' : 'Crear mi cuenta'}
        </Button>
      </BottomBar>
    </div>
  )
}

/* ── Título de paso ────────────────────────────────────────────────────── */

function Titulo({ children, bajada }: { children: string; bajada: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">
        {children}
      </h1>
      <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{bajada}</p>
    </div>
  )
}

/* ── Hogar ─────────────────────────────────────────────────────────────── */

function PasosHogar({
  paso,
  nombre,
  setNombre,
  integrantes,
  setIntegrantes,
  ingreso,
  setIngreso,
  moneda,
  setMoneda,
}: {
  paso: number
  nombre: string
  setNombre: (v: string) => void
  integrantes: number
  setIntegrantes: (v: number) => void
  ingreso: number | null
  setIngreso: (v: number | null) => void
  moneda: string
  setMoneda: (v: string) => void
}) {
  if (paso === 0) {
    return (
      <>
        <Titulo bajada="Lo usamos para saludarte y para firmar los movimientos que cargues.">
          ¿Cómo te llamás?
        </Titulo>
        <Input
          label="Nombre y apellido"
          placeholder="Ej. Ana Pérez"
          autoFocus
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
      </>
    )
  }

  if (paso === 1) {
    return (
      <>
        <Titulo bajada="Con esto preparamos la cuenta familiar compartida.">
          ¿Cuántos viven en tu hogar?
        </Titulo>
        <Field label="Integrantes">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <motion.button
                key={n}
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => setIntegrantes(n)}
                className={cn(
                  'tabular rounded-input border py-4 font-display text-[19px] font-bold transition-colors duration-200',
                  integrantes === n
                    ? 'border-accent-hi bg-accent-dim text-ink'
                    : 'border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
                )}
              >
                {n === 6 ? '6+' : n}
              </motion.button>
            ))}
          </div>
        </Field>
        <p className="mt-3 text-[13px] leading-relaxed text-ink-faint">
          Después vas a poder invitar a cada integrante desde la sección Familia.
        </p>
      </>
    )
  }

  return (
    <>
      <Titulo bajada="Es opcional: si todavía no lo tenés claro, seguí y cargalo más adelante.">
        ¿Cuánto entra por mes?
      </Titulo>
      <div className="space-y-4">
        <MoneyInput
          label="Ingreso mensual fijo"
          hint="Sueldo, jubilación o lo que entre todos los meses."
          value={ingreso}
          onChange={setIngreso}
        />
        <Select
          label="Moneda"
          opciones={MONEDAS}
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
        />
      </div>
    </>
  )
}

/* ── Comercio ──────────────────────────────────────────────────────────── */

function PasosComercio({
  paso,
  negocio,
  setNegocio,
  rubro,
  setRubro,
  antiguedad,
  setAntiguedad,
  empleadosRango,
  setEmpleadosRango,
  ciudad,
  setCiudad,
  logo,
  setLogo,
  nombre,
  setNombre,
  moneda,
  setMoneda,
}: {
  paso: number
  negocio: string
  setNegocio: (v: string) => void
  rubro: string
  setRubro: (v: string) => void
  antiguedad: string | null
  setAntiguedad: (v: string) => void
  empleadosRango: string | null
  setEmpleadosRango: (v: string) => void
  ciudad: string
  setCiudad: (v: string) => void
  logo?: string
  setLogo: (v: string | undefined) => void
  nombre: string
  setNombre: (v: string) => void
  moneda: string
  setMoneda: (v: string) => void
}) {
  if (paso === 0) {
    return (
      <>
        <Titulo bajada="El rubro define el catálogo con el que arrancás cargado.">
          Contanos de tu negocio
        </Titulo>
        <div className="space-y-4">
          <Input
            label="Nombre del negocio"
            placeholder="Ej. Almacén Don Pedro"
            autoFocus
            value={negocio}
            onChange={(e) => setNegocio(e.target.value)}
          />
          <Select
            label="Rubro"
            opciones={RUBROS}
            value={rubro}
            onChange={(e) => setRubro(e.target.value)}
          />
        </div>
      </>
    )
  }

  if (paso === 1) {
    return (
      <>
        <Titulo bajada="Sirve para ajustar los reportes y preparar la sección de Empleados.">
          ¿Hace cuánto trabajás?
        </Titulo>
        <div className="space-y-6">
          <OptionGroup
            label="Años funcionando"
            value={antiguedad}
            onChange={setAntiguedad}
            opciones={ANTIGUEDADES}
          />
          <OptionGroup
            label="Cantidad de empleados"
            value={empleadosRango}
            onChange={setEmpleadosRango}
            opciones={RANGOS_EMPLEADOS}
            columnas={2}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <Titulo bajada="El logo es opcional: si no subís ninguno usamos la inicial del negocio.">
        Últimos detalles
      </Titulo>
      <div className="space-y-4">
        <Input
          label="Ciudad o localidad"
          placeholder="Ej. Rivadavia, San Juan"
          value={ciudad}
          onChange={(e) => setCiudad(e.target.value)}
        />
        <Input
          label="Tu nombre (opcional)"
          placeholder="Ej. Pedro"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
        />
        <Select
          label="Moneda"
          opciones={MONEDAS}
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
        />
        <CargaLogo nombre={negocio || 'Negocio'} logo={logo} setLogo={setLogo} />
      </div>
    </>
  )
}

/**
 * Subida del logo. La imagen se reescala a 256px en un canvas antes de
 * guardarse: un JPG de cámara en base64 revienta la cuota de localStorage.
 */
function CargaLogo({
  nombre,
  logo,
  setLogo,
}: {
  nombre: string
  logo?: string
  setLogo: (v: string | undefined) => void
}) {
  const input = useRef<HTMLInputElement>(null)

  function elegir(file?: File) {
    if (!file) return
    const lector = new FileReader()
    lector.onload = () => {
      const img = new Image()
      img.onload = () => {
        const lado = 256
        const canvas = document.createElement('canvas')
        canvas.width = lado
        canvas.height = lado
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        // Recorte cuadrado centrado.
        const min = Math.min(img.width, img.height)
        ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, lado, lado)
        setLogo(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = String(lector.result)
    }
    lector.readAsDataURL(file)
  }

  return (
    <Field label="Logo del negocio (opcional)">
      <div className="flex items-center gap-3 rounded-input border border-line-strong bg-surface-2 p-3">
        <Avatar nombre={nombre} src={logo} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-medium text-ink">
            {logo ? 'Logo cargado' : 'Sin logo'}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-faint">JPG o PNG, se recorta cuadrado.</p>
        </div>
        {logo ? (
          <button
            type="button"
            aria-label="Quitar logo"
            onClick={() => setLogo(undefined)}
            className="grid size-10 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-3 hover:text-neg"
          >
            <Trash2 className="size-[18px]" strokeWidth={1.9} />
          </button>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => input.current?.click()}>
            <ImagePlus className="size-4" strokeWidth={1.9} />
            Subir
          </Button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => elegir(e.target.files?.[0])}
        />
      </div>
    </Field>
  )
}
