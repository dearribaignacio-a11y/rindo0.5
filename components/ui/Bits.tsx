'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'
import { inicial } from '@/lib/format'

/* ── Estado vacío ──────────────────────────────────────────────────────── */

export function Empty({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="mb-3.5 grid size-14 place-items-center rounded-2xl border border-line bg-surface text-ink-faint">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <p className="text-[15px] font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 max-w-[30ch] text-[13px] leading-relaxed text-ink-faint">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ── Badge ─────────────────────────────────────────────────────────────── */

const TONOS_BADGE = {
  neutral: 'border-line-strong bg-surface-2 text-ink-muted',
  accent: 'border-accent-hi/45 bg-accent-dim text-accent-hi',
  pos: 'border-pos/35 bg-pos-dim text-pos',
  warn: 'border-warn/35 bg-warn-dim text-warn',
  neg: 'border-neg/35 bg-neg-dim text-neg',
}

export function Badge({
  children,
  tone = 'neutral',
  icon: Icon,
  className,
}: {
  children: ReactNode
  tone?: keyof typeof TONOS_BADGE
  icon?: LucideIcon
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold',
        TONOS_BADGE[tone],
        className,
      )}
    >
      {Icon && <Icon className="size-3" strokeWidth={2.2} />}
      {children}
    </span>
  )
}

/** Distintivo PRO — mismo azul de acento, con un borde apenas degradado.
 *  Ni dorado ni violeta: no queremos el "premium" de plantilla. */
export function ProBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-[7px] py-[3px] text-[10px] font-bold tracking-[0.09em]',
        'bg-gradient-to-br from-accent-hi/25 to-accent/10 text-accent-hi',
        'ring-1 ring-inset ring-accent-hi/40',
        className,
      )}
    >
      PRO
    </span>
  )
}

/* ── Variación vs. período anterior ────────────────────────────────────── */

export function Delta({
  value,
  suffix,
  invertido,
}: {
  /** Variación relativa (0.12 = +12%). */
  value: number
  suffix?: string
  /** Para métricas donde subir es malo (gastos, costos). */
  invertido?: boolean
}) {
  const sube = value >= 0
  const bueno = invertido ? !sube : sube
  const Icon = sube ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className={cn(
        'tabular inline-flex items-center gap-0.5 text-[13px] font-semibold',
        bueno ? 'text-pos' : 'text-neg',
      )}
    >
      <Icon className="size-4" strokeWidth={2.4} />
      {Math.abs(Math.round(value * 100))}%{suffix ? ` ${suffix}` : ''}
    </span>
  )
}

/* ── Avatar ────────────────────────────────────────────────────────────── */

export function Avatar({
  nombre,
  src,
  size = 'md',
  className,
}: {
  nombre: string
  src?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = {
    sm: 'size-8 text-[13px] rounded-[10px]',
    md: 'size-10 text-[15px] rounded-xl',
    lg: 'size-14 text-xl rounded-2xl',
  }[size]

  if (src) {
    return (
      // Logo/foto subida por el usuario: es un dataURL local, no una URL remota.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={nombre}
        className={cn('shrink-0 border border-line object-cover', box, className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center border border-accent-hi/25 bg-accent-dim font-semibold text-accent-hi',
        box,
        className,
      )}
    >
      {inicial(nombre)}
    </span>
  )
}

/* ── Aviso legal ───────────────────────────────────────────────────────── */

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <div className="mt-5 flex gap-2.5 rounded-card border border-line bg-surface-2/60 p-3.5">
      <Info className="mt-px size-4 shrink-0 text-ink-faint" strokeWidth={1.9} />
      <p className="text-[12.5px] leading-relaxed text-ink-faint">{children}</p>
    </div>
  )
}

/* ── Indicador de pasos del wizard ─────────────────────────────────────── */

export function Steps({ total, actual }: { total: number; actual: number }) {
  return (
    <div className="flex items-center gap-1.5" role="progressbar" aria-valuenow={actual + 1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <motion.span
          key={i}
          className={cn('h-1.5 rounded-full', i <= actual ? 'bg-accent-hi' : 'bg-surface-3')}
          animate={{ width: i === actual ? 26 : 10 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        />
      ))}
    </div>
  )
}

/* ── Fila de lista genérica ────────────────────────────────────────────── */

export function Row({
  leading,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const contenido = (
    <>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14.5px] font-medium text-ink">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-[12.5px] text-ink-faint">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0 text-right">{trailing}</div>}
    </>
  )

  if (!onClick) {
    return <div className={cn('flex items-center gap-3 py-2.5', className)}>{contenido}</div>
  }

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 520, damping: 34 }}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl py-2.5 text-left transition-colors',
        'hover:bg-surface-2/70',
        className,
      )}
    >
      {contenido}
    </motion.button>
  )
}
