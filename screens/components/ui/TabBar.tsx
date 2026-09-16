'use client'

import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface TabDef<T extends string> {
  id: T
  label: string
  icon: LucideIcon
  /** Punto de aviso (stock crítico, impuesto vencido…). */
  alerta?: boolean
}

/**
 * Barra de navegación inferior. Fija a la columna de la app, con un indicador
 * que se desliza entre pestañas usando `layoutId` en vez de saltar.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: TabDef<T>[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <nav className="app-col fixed inset-x-0 bottom-0 z-40">
      <div className="pointer-events-none h-6 bg-gradient-to-t from-bg to-transparent" />
      <div
        className={cn(
          'flex items-stretch gap-0.5 border-t border-line bg-bg/95 px-2 pt-1.5 backdrop-blur-xl',
          'pb-[max(0.5rem,env(safe-area-inset-bottom))]',
        )}
      >
        {tabs.map((tab) => {
          const activo = tab.id === value
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={activo ? 'page' : undefined}
              className="relative flex flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1.5"
            >
              {activo && (
                <motion.span
                  layoutId="tab-activa"
                  transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  className="absolute inset-0 rounded-xl bg-surface-2"
                />
              )}
              <span className="relative">
                <Icon
                  className={cn(
                    'size-[21px] transition-colors duration-200',
                    activo ? 'text-accent-hi' : 'text-ink-faint',
                  )}
                  strokeWidth={activo ? 2.15 : 1.8}
                />
                {tab.alerta && (
                  <span className="absolute -right-0.5 -top-0.5 size-[7px] rounded-full bg-warn ring-2 ring-bg" />
                )}
              </span>
              <span
                className={cn(
                  'relative text-[10.5px] font-medium leading-none transition-colors duration-200',
                  activo ? 'text-ink' : 'text-ink-faint',
                )}
              >
                {tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
