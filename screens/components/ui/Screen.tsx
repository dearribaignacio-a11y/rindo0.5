'use client'

import type { ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Contenedor de pantalla.
 *
 * Su única responsabilidad no obvia es el `padding-bottom`: la tab bar y el
 * FAB son `fixed`, así que el scroll tiene que reservar su alto o el último
 * ítem de la lista queda tapado para siempre. `pad="fab"` deja 176px —
 * bastante más que los 100px mínimos — porque además del FAB está la tab bar.
 */
const PADS = {
  none: 'pb-8',
  /** Sólo tab bar. */
  tab: 'pb-28',
  /** Tab bar + FAB flotante encima. */
  fab: 'pb-44',
  /** Barra de acción anclada abajo (sin tab bar). */
  bar: 'pb-40',
}

export function Screen({
  children,
  pad = 'tab',
  className,
}: {
  children: ReactNode
  pad?: keyof typeof PADS
  className?: string
}) {
  return (
    <div className={cn('min-h-dvh w-full px-5 pt-4 sm:px-6', PADS[pad], className)}>
      {children}
    </div>
  )
}

/** Encabezado de pantalla interna: volver + título + acción opcional. */
export function TopBar({
  title,
  onBack,
  action,
  subtitle,
}: {
  title: string
  onBack?: () => void
  action?: ReactNode
  subtitle?: string
}) {
  return (
    <header className="mb-5 flex items-center gap-3 pt-2">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          aria-label="Volver"
          className="-ml-2 grid size-10 shrink-0 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
        >
          <ChevronLeft className="size-5" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {subtitle && <p className="truncate text-xs text-ink-faint">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}

/** Título de sección dentro de una pantalla. */
export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-2.5 mt-6 flex items-end justify-between gap-3', className)}>
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.07em] text-ink-faint">
        {children}
      </h2>
      {action}
    </div>
  )
}
