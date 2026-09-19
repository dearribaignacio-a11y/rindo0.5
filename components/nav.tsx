'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Navegación interna de la app.
 *
 * Rindo es una app de una sola página con una pila de pantallas: entrar
 * "empuja" y volver "saca". Se resuelve acá y no con rutas de Next porque las
 * transiciones animadas necesitan que la pantalla saliente y la entrante
 * convivan un instante (AnimatePresence), y porque el estado vive entero en
 * el cliente. Los Route Handlers de `app/api` siguen siendo los de Next.
 */
export type Ruta =
  /* Entrada */
  | 'login'
  | 'setup'
  | 'onboarding'
  /* Contenedor con tab bar */
  | 'tabs'
  /* Pantallas apiladas — Hogar */
  | 'planes'
  | 'perfil'
  | 'tema'
  | 'ayuda'
  | 'comentarios'
  | 'password'
  /* Pantallas apiladas — Comercial */
  | 'venta-manual'
  | 'stock-foto'
  | 'chat'
  | 'mi-negocio'
  | 'empleados'
  | 'impuestos'
  | 'mov-comercio'
  | 'pagar-tarjeta'
  /* Comercial Pro */
  | 'pro'
  | 'pro-impuestos'
  | 'pro-personal'
  | 'pro-precios'

export interface Entrada {
  ruta: Ruta
  /** Datos sueltos que la pantalla destino necesita (id a abrir, tab inicial…). */
  params?: Record<string, unknown>
}

export type Direccion = 'forward' | 'back' | 'none'

interface NavAPI {
  actual: Entrada
  direccion: Direccion
  push: (ruta: Ruta, params?: Record<string, unknown>) => void
  pop: () => void
  /** Vacía la pila y arranca de nuevo — se usa al entrar y al cerrar sesión. */
  reset: (ruta: Ruta, params?: Record<string, unknown>) => void
  puedeVolver: boolean
}

const NavCtx = createContext<NavAPI | null>(null)

export function useNav() {
  const ctx = useContext(NavCtx)
  if (!ctx) throw new Error('useNav fuera de <NavProvider>')
  return ctx
}

export function NavProvider({ inicial, children }: { inicial: Entrada; children: ReactNode }) {
  const [pila, setPila] = useState<Entrada[]>([inicial])
  const [direccion, setDireccion] = useState<Direccion>('none')

  const push = useCallback((ruta: Ruta, params?: Record<string, unknown>) => {
    setDireccion('forward')
    setPila((p) => [...p, { ruta, params }])
  }, [])

  const pop = useCallback(() => {
    setDireccion('back')
    setPila((p) => (p.length > 1 ? p.slice(0, -1) : p))
  }, [])

  const reset = useCallback((ruta: Ruta, params?: Record<string, unknown>) => {
    setDireccion('forward')
    setPila([{ ruta, params }])
  }, [])

  const value = useMemo<NavAPI>(
    () => ({
      actual: pila[pila.length - 1],
      direccion,
      push,
      pop,
      reset,
      puedeVolver: pila.length > 1,
    }),
    [pila, direccion, push, pop, reset],
  )

  return <NavCtx.Provider value={value}>{children}</NavCtx.Provider>
}
