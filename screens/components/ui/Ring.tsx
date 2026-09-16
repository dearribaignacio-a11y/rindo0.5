'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * Anillo de progreso. Crece desde 0 al aparecer (stroke-dashoffset animado) y
 * cambia de tono según cuánto del presupuesto se consumió.
 */
export function Ring({
  value,
  size = 132,
  grosor = 11,
  children,
  className,
}: {
  /** 0–1. Por encima de 1 se llena entero pero queda en rojo. */
  value: number
  size?: number
  grosor?: number
  children?: ReactNode
  className?: string
}) {
  const clamped = Math.max(0, Math.min(1, value))
  const r = (size - grosor) / 2
  const circ = 2 * Math.PI * r
  const tono = value >= 1 ? 'var(--color-neg)' : value >= 0.75 ? 'var(--color-warn)' : 'var(--color-pos)'

  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-surface-3)"
          strokeWidth={grosor}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={tono}
          strokeWidth={grosor}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - clamped) }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  )
}
