'use client'

import { useState } from 'react'
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
import { Login } from '@/screens/Login'
import { SetupWizard } from '@/screens/SetupWizard'
import { Onboarding } from '@/screens/Onboarding'
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
import { Impuestos } from '@/screens/comercial/Impuestos'
import { ProHub } from '@/screens/pro/Hub'
import { ProPrecios } from '@/screens/pro/Precios'
import { ProPersonal } from '@/screens/pro/Personal'
import { ProImpuestos } from '@/screens/pro/Impuestos'
import { ProChat } from '@/screens/pro/Chat'
import { useDB, useMontado } from '@/lib/hooks'
import { aplicarTema, sembrar, updateFlags } from '@/lib/storage'
import { esPro } from '@/lib/plans'
import type { DB, Perfil, PlanId } from '@/lib/types'

/* ══════════════════════════════════════════════════════════════════════════
   Shell de la app.

   Rindo corre entera en el cliente sobre localStorage, así que el árbol vive
   dentro de un único Client Component. Las rutas de Next quedan reservadas
   para los Route Handlers de `app/api`, que son los que sí necesitan servidor.
   ══════════════════════════════════════════════════════════════════════════ */

export function Rindo() {
  const db = useDB()
  const montado = useMontado()
  /** Plan y email elegidos en el login, hasta que el setup crea el perfil. */
  const [pendiente, setPendiente] = useState<{ plan: PlanId; email: string } | null>(null)

  // Antes de montar no sabemos qué hay en localStorage: renderizar cualquier
  // pantalla acá provocaría un desajuste de hidratación.
  if (!montado) return <Splash />

  const fase = faseActual(db)

  return (
    <ToastProvider>
      <AnimatePresence mode="wait" initial={false}>
        {fase === 'login' && (
          <ScreenTransition key="login">
            <Login
              planActual={db.perfil?.plan}
              onEntrar={(plan, email) => {
                setPendiente({ plan, email })
                updateFlags({ sesionIniciada: true })
              }}
            />
          </ScreenTransition>
        )}

        {fase === 'setup' && (
          <ScreenTransition key="setup">
            <SetupWizard
              plan={pendiente?.plan ?? 'hogar'}
              email={pendiente?.email ?? ''}
              onVolver={() => updateFlags({ sesionIniciada: false })}
              onListo={(perfil: Perfil) => {
                sembrar(perfil)
                updateFlags({ setupHecho: true })
              }}
            />
          </ScreenTransition>
        )}

        {fase === 'onboarding' && (
          <ScreenTransition key="onboarding">
            <Onboarding
              plan={db.perfil?.plan ?? 'hogar'}
              onListo={() => updateFlags({ onboardingVisto: true })}
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

type Fase = 'login' | 'setup' | 'onboarding' | 'app'

function faseActual(db: DB): Fase {
  if (!db.flags.sesionIniciada) return 'login'
  if (!db.flags.setupHecho || !db.perfil) return 'setup'
  if (!db.flags.onboardingVisto) return 'onboarding'
  return 'app'
}

/* ── Navegación interna ────────────────────────────────────────────────── */

function Interna({ db }: { db: DB }) {
  const nav = useNav()
  const { ruta, params } = nav.actual
  const plan = db.perfil?.plan ?? 'hogar'

  return (
    <AnimatePresence mode="wait" initial={false}>
      <ScreenTransition key={ruta} direction={nav.direccion}>
        {ruta === 'tabs' && <Tabs db={db} tabInicial={params?.tab as string | undefined} />}
        {ruta === 'tema' && <PantallaTema db={db} />}
        {ruta === 'perfil' && <PantallaPerfil db={db} />}
        {ruta === 'password' && <PantallaPassword />}
        {ruta === 'ayuda' && <PantallaAyuda />}
        {ruta === 'comentarios' && <PantallaComentarios />}
        {ruta === 'planes' && <PantallaPlanes db={db} />}
        {/* Pantallas apiladas — Comercial y Comercial Pro */}
        {ruta === 'stock-foto' && <StockFoto />}
        {ruta === 'empleados' && <Empleados db={db} />}
        {ruta === 'impuestos' && <Impuestos db={db} />}
        {ruta === 'pro-precios' && esPro(plan) && <ProPrecios db={db} />}
        {ruta === 'pro-personal' && esPro(plan) && <ProPersonal db={db} />}
        {ruta === 'pro-impuestos' && esPro(plan) && <ProImpuestos db={db} />}
        {ruta === 'chat' && esPro(plan) && <ProChat />}
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

function Tabs({ db, tabInicial }: { db: DB; tabInicial?: string }) {
  const plan = db.perfil?.plan ?? 'hogar'

  if (plan === 'hogar') return <TabsHogar db={db} tabInicial={tabInicial} />
  return <TabsComercial db={db} plan={plan} tabInicial={tabInicial} />
}

function TabsHogar({ db, tabInicial }: { db: DB; tabInicial?: string }) {
  const [tab, setTab] = useState<TabHogar>((tabInicial as TabHogar) ?? 'resumen')

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
function TabsComercial({ db, plan, tabInicial }: { db: DB; plan: PlanId; tabInicial?: string }) {
  const pro = esPro(plan)
  const [tab, setTab] = useState<TabComercial>((tabInicial as TabComercial) ?? 'resumen')
  const tabs = pro ? TABS_COMERCIAL_PRO : TABS_COMERCIAL

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
        <ScreenTransition key={tab} direction="none">
          {tab === 'resumen' && (
            <ComercialResumen db={db} onVerTodo={() => setTab('movimientos')} />
          )}
          {tab === 'movimientos' && <ComercialMovimientos db={db} />}
          {tab === 'productos' && <ComercialProductos db={db} />}
          {tab === 'stock' && <ComercialStock db={db} />}
          {tab === 'ia' && pro && <ProHub db={db} />}
          {tab === 'ajustes' && (
            <Ajustes db={db} onCerrarSesion={() => aplicarTema(db.ajustes.tema)} />
          )}
        </ScreenTransition>
      </AnimatePresence>

      <TabBar tabs={tabs} value={tab} onChange={setTab} />
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
