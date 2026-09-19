'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import {
  Boxes,
  Brain,
  ChartColumn,
  House,
  ListOrdered,
  Package,
  Receipt,
  Settings,
  UsersRound,
} from 'lucide-react'
import { ScreenTransition } from '@/components/ScreenTransition'
import { TabBar, type TabDef } from '@/components/ui/TabBar'
import { ToastProvider } from '@/components/ui/Toast'
import { Logo } from '@/components/ui/Logo'
import { NavProvider, useNav } from '@/components/nav'
import { Onboarding } from '@/screens/Onboarding'
import { CuentaPausada } from '@/screens/CuentaPausada'
import { Ajustes } from '@/screens/Ajustes'
import {
  PantallaAyuda,
  PantallaComentarios,
  PantallaPassword,
  PantallaPerfil,
  PantallaPlanes,
  PantallaTema,
} from '@/screens/Comunes'
import { HogarResumen } from '@/screens/hogar/Resumen'
import { HogarMovimientos } from '@/screens/hogar/Movimientos'
import { HogarPresupuestos } from '@/screens/hogar/Presupuestos'
import { HogarFamilia } from '@/screens/hogar/Familia'
import { ComercialResumen } from '@/screens/comercial/Resumen'
import { ComercialMovimientos } from '@/screens/comercial/Movimientos'
import { ComercialProductos } from '@/screens/comercial/Productos'
import { ComercialStock } from '@/screens/comercial/Stock'
import { StockFoto } from '@/screens/comercial/StockFoto'
import { Empleados } from '@/screens/comercial/Empleados'
import { MiNegocio } from '@/screens/comercial/MiNegocio'
import { Impuestos } from '@/screens/comercial/Impuestos'
import { ProHub } from '@/screens/pro/Hub'
import { ProPrecios } from '@/screens/pro/Precios'
import { ProPersonal } from '@/screens/pro/Personal'
import { ProImpuestos } from '@/screens/pro/Impuestos'
import { ProChat } from '@/screens/pro/Chat'
import { useDB, useMontado } from '@/lib/hooks'
import {
  aplicarTema,
  hidratarNegocio,
  hidratarOperaciones,
  hidratarPerfil,
  suscribirseAOperaciones,
  updateFlags,
} from '@/lib/storage'
import { cuentaBloqueada, esPro } from '@/lib/plans'
import type { DB, PlanId } from '@/lib/types'

/* ══════════════════════════════════════════════════════════════════════════
   Shell de la app, montado detrás de `/dashboard` — ahí ya hay una sesión
   real de Supabase verificada en el servidor. Login, alta y elección de
   plan viven aparte, en `/login` (ver `screens/AuthFlow.tsx`).

   La app en sí sigue corriendo entera en el cliente sobre localStorage: el
   árbol vive dentro de un único Client Component. Las rutas de Next quedan
   para lo que sí necesita servidor (auth, y los Route Handlers de `app/api`).
   ══════════════════════════════════════════════════════════════════════════ */

export function Rindo() {
  const db = useDB()
  const montado = useMontado()

  // Empresa, empleados, productos y ventas no viven en localStorage — se
  // traen de Supabase una vez que hay sesión (que acá ya la hay, `/dashboard`
  // la exige). Productos/Ventas además se mantienen al día en tiempo real:
  // si el mismo usuario tiene la app abierta en dos dispositivos, un cambio
  // en uno se refleja en el otro sin recargar.
  useEffect(() => {
    // El plan se hidrata primero: si no hay perfil local (otro navegador o
    // dispositivo), es lo único que permite saber qué plan tiene la cuenta.
    hidratarPerfil()
      .catch(() => {})
      .then(() => {
        hidratarNegocio().catch(() => {
          // Sin red o sesión vencida a mitad de carga: la pantalla de Empresa
          // vuelve a intentarlo la próxima vez que se monte.
        })
        hidratarOperaciones().catch(() => {})
      })

    const cortar = suscribirseAOperaciones()
    return cortar
  }, [])

  // Antes de montar no sabemos qué hay en localStorage: renderizar cualquier
  // pantalla acá provocaría un desajuste de hidratación.
  if (!montado) return <Splash />

  const fase = faseActual(db)

  return (
    <ToastProvider>
      <AnimatePresence mode="wait" initial={false}>
        {fase === 'onboarding' && (
          <ScreenTransition key="onboarding">
            <Onboarding
              plan={db.perfil?.plan ?? 'hogar'}
              onListo={() => updateFlags({ onboardingVisto: true })}
            />
          </ScreenTransition>
        )}

        {fase === 'bloqueada' && db.perfil && (
          <ScreenTransition key="bloqueada">
            <CuentaPausada
              perfil={db.perfil}
              onCerrarSesion={() => aplicarTema(db.ajustes.tema)}
            />
          </ScreenTransition>
        )}

        {fase === 'app' && (
          <ScreenTransition key="app">
            <NavProvider inicial={{ ruta: 'tabs' }}>
              <Interna db={db} />
            </NavProvider>
          </ScreenTransition>
        )}
      </AnimatePresence>
    </ToastProvider>
  )
}

type Fase = 'onboarding' | 'bloqueada' | 'app'

function faseActual(db: DB): Fase {
  if (cuentaBloqueada(db.perfil)) return 'bloqueada'
  if (!db.flags.onboardingVisto) return 'onboarding'
  return 'app'
}

/* ── Navegación interna ────────────────────────────────────────────────── */

function Interna({ db }: { db: DB }) {
  const nav = useNav()
  const entrada = nav.actual
  const { ruta } = entrada
  const plan = db.perfil?.plan ?? 'hogar'

  /**
   * La pestaña activa vive acá y no dentro de `Tabs`, por dos motivos:
   *
   * · `Tabs` se desmonta al abrir una pantalla apilada (la `key` del
   *   `ScreenTransition` es la ruta). Con el estado adentro, volver de
   *   Empleados te dejaba en Resumen en vez de en Ajustes, que es de donde
   *   habías salido.
   * · `nav.push('tabs', { tab: 'familia' })` no cambiaba nada: la ruta sigue
   *   siendo 'tabs', así que no hay remonte y el inicializador de `useState`
   *   no se vuelve a leer. El botón "Cuenta familiar" de Ajustes no hacía nada.
   */
  const [tab, setTab] = useState<string>('resumen')

  // Cada `push` crea una entrada nueva, así que la identidad de `entrada`
  // alcanza para detectar una navegación que pide una pestaña puntual. Al
  // volver con `pop`, la entrada no trae `tab` y la pestaña actual se respeta.
  useEffect(() => {
    const pedida = entrada.params?.tab
    if (entrada.ruta === 'tabs' && typeof pedida === 'string') setTab(pedida)
  }, [entrada])

  return (
    <AnimatePresence mode="wait" initial={false}>
      <ScreenTransition key={ruta} direction={nav.direccion}>
        {ruta === 'tabs' && <Tabs db={db} tab={tab} onTab={setTab} />}
        {ruta === 'tema' && <PantallaTema db={db} />}
        {ruta === 'perfil' && <PantallaPerfil db={db} />}
        {ruta === 'password' && <PantallaPassword />}
        {ruta === 'ayuda' && <PantallaAyuda />}
        {ruta === 'comentarios' && <PantallaComentarios />}
        {ruta === 'planes' && <PantallaPlanes db={db} />}
        {/* Pantallas apiladas — Comercial y Comercial Pro */}
        {ruta === 'stock-foto' && <StockFoto />}
        {ruta === 'mi-negocio' && <MiNegocio db={db} />}
        {ruta === 'empleados' && <Empleados db={db} />}
        {ruta === 'impuestos' && <Impuestos db={db} />}
        {ruta === 'pro-precios' && esPro(plan) && <ProPrecios db={db} />}
        {ruta === 'pro-personal' && esPro(plan) && <ProPersonal db={db} />}
        {ruta === 'pro-impuestos' && esPro(plan) && <ProImpuestos db={db} />}
        {ruta === 'chat' && esPro(plan) && <ProChat db={db} />}
      </ScreenTransition>
    </AnimatePresence>
  )
}

/* ── Contenedor con tab bar ────────────────────────────────────────────── */

type TabHogar = 'resumen' | 'movimientos' | 'presupuestos' | 'familia' | 'ajustes'
type TabComercial = 'resumen' | 'movimientos' | 'productos' | 'stock' | 'ia' | 'ajustes'

const TABS_HOGAR: TabDef<TabHogar>[] = [
  { id: 'resumen', label: 'Resumen', icon: House },
  { id: 'movimientos', label: 'Movimientos', icon: ListOrdered },
  { id: 'presupuestos', label: 'Presupuestos', icon: ChartColumn },
  { id: 'familia', label: 'Familia', icon: UsersRound },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]

/** El plan Comercial (sin Pro) no lleva la pestaña "ia". */
const TABS_COMERCIAL: TabDef<TabComercial>[] = [
  { id: 'resumen', label: 'Resumen', icon: House },
  { id: 'movimientos', label: 'Ventas', icon: Receipt },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]

const TABS_COMERCIAL_PRO: TabDef<TabComercial>[] = [
  { id: 'resumen', label: 'Resumen', icon: House },
  { id: 'movimientos', label: 'Ventas', icon: Receipt },
  { id: 'productos', label: 'Productos', icon: Package },
  { id: 'stock', label: 'Stock', icon: Boxes },
  { id: 'ia', label: 'Asistente', icon: Brain },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
]

/**
 * Devuelve `candidata` sólo si es una pestaña que este plan realmente muestra;
 * si no, cae en la primera.
 *
 * Sin esto, una pestaña de otro plan —o un plan que baja de Pro a Comercial
 * con "Asistente" seleccionada— deja el contenido en blanco con el tab bar sin
 * nada marcado, porque ninguna rama del render coincide.
 */
function tabValida<T extends string>(tabs: TabDef<T>[], candidata: string | undefined): T {
  const existe = tabs.some((t) => t.id === candidata)
  return (existe ? candidata : tabs[0].id) as T
}

interface TabsProps {
  db: DB
  /** Pestaña activa. El estado vive en `Interna` para sobrevivir al apilado. */
  tab: string
  onTab: (t: string) => void
}

function Tabs({ db, tab, onTab }: TabsProps) {
  const plan = db.perfil?.plan ?? 'hogar'

  if (plan === 'hogar') return <TabsHogar db={db} tab={tab} onTab={onTab} />
  return <TabsComercial db={db} plan={plan} tab={tab} onTab={onTab} />
}

function TabsHogar({ db, tab: pedida, onTab }: TabsProps) {
  const tab = tabValida(TABS_HOGAR, pedida)
  const setTab = onTab as (t: TabHogar) => void

  return (
    <>
      {/* Los cambios de pestaña usan un cross-fade corto, no un slide: son
          movimientos laterales dentro del mismo nivel de navegación. */}
      <AnimatePresence mode="wait" initial={false}>
        <ScreenTransition key={tab} direction="none">
          {tab === 'resumen' && (
            <HogarResumen db={db} onVerTodo={() => setTab('movimientos')} />
          )}
          {tab === 'movimientos' && <HogarMovimientos db={db} />}
          {tab === 'presupuestos' && <HogarPresupuestos db={db} />}
          {tab === 'familia' && <HogarFamilia db={db} />}
          {tab === 'ajustes' && (
            <Ajustes db={db} onCerrarSesion={() => aplicarTema(db.ajustes.tema)} />
          )}
        </ScreenTransition>
      </AnimatePresence>

      <TabBar tabs={TABS_HOGAR} value={tab} onChange={setTab} />
    </>
  )
}

/** Pestañas de Comercial y Comercial Pro: mismo esqueleto, la pestaña extra
 *  "Asistente" sólo aparece si el plan la incluye. */
function TabsComercial({ db, plan, tab: pedida, onTab }: TabsProps & { plan: PlanId }) {
  const pro = esPro(plan)
  const tabs = pro ? TABS_COMERCIAL_PRO : TABS_COMERCIAL
  const setTab = onTab as (t: TabComercial) => void

  // Si el plan baja de Pro a Comercial, la pestaña "Asistente" desaparece del
  // tab bar. Se deriva en el render en vez de corregir el estado: así no hay
  // un frame con el contenido vacío.
  const activa = tabValida(tabs, pedida)

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <ScreenTransition key={activa} direction="none">
          {activa === 'resumen' && (
            <ComercialResumen db={db} onVerTodo={() => setTab('movimientos')} />
          )}
          {activa === 'movimientos' && <ComercialMovimientos db={db} />}
          {activa === 'productos' && <ComercialProductos db={db} />}
          {activa === 'stock' && <ComercialStock db={db} />}
          {activa === 'ia' && pro && <ProHub db={db} />}
          {activa === 'ajustes' && (
            <Ajustes db={db} onCerrarSesion={() => aplicarTema(db.ajustes.tema)} />
          )}
        </ScreenTransition>
      </AnimatePresence>

      <TabBar tabs={tabs} value={activa} onChange={setTab} />
    </>
  )
}

/* ── Splash ────────────────────────────────────────────────────────────── */

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <Logo size="lg" />
    </div>
  )
}
