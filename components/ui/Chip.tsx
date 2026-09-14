'use client'

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Chip de filtro. Seleccionado = relleno de acento; el resto, contorno. */
export function Chip({
  children,
  active,
  onClick,
  icon: Icon,
  count,
  tone = 'accent',
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  icon?: LucideIcon
  count?: number
  tone?: 'accent' | 'warn' | 'neg'
}) {
  const activo = {
    accent: 'border-accent-hi bg-accent text-accent-ink',
    warn: 'border-warn/60 bg-warn-dim text-warn',
    neg: 'border-neg/60 bg-neg-dim text-neg',
  }[tone]

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5',
        'text-[13px] font-medium transition-colors duration-200 ease-[var(--ease-out-soft)]',
        active ? activo : 'border-line-strong bg-surface text-ink-muted hover:bg-surface-2 hover:text-ink',
      )}
    >
      {Icon && <Icon className="size-[15px]" strokeWidth={1.9} />}
      {children}
      {count !== undefined && (
        <span className={cn('tabular text-[11px]', active ? 'opacity-80' : 'text-ink-faint')}>
          {count}
        </span>
      )}
    </button>
  )
}

/** Riel horizontal scrolleable, con los bordes sangrados para que los chips
 *  entren y salgan por fuera del padding de la pantalla. */
export function ChipRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 sm:-mx-6 sm:px-6',
        className,
      )}
    >
      {children}
    </div>
  )
}
