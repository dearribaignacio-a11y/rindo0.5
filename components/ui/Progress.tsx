'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

type Tone = 'accent' | 'pos' | 'warn' | 'neg'

const fills: Record<Tone, string> = {
  accent: 'bg-accent-hi',
  pos: 'bg-pos',
  warn: 'bg-warn',
  neg: 'bg-neg',
}

interface ProgressProps {
  /** 0–1. Values above 1 are clamped but keep the "over budget" tone. */
  value: number
  tone?: Tone
  className?: string
  /** Derive the tone from budget usage: <0.75 ok, <1 warning, >=1 over. */
  autoTone?: boolean
}

export function Progress({ value, tone = 'accent', className, autoTone }: ProgressProps) {
  const clamped = Math.max(0, Math.min(1, value))
  const resolved: Tone = autoTone
    ? value >= 1
      ? 'neg'
      : value >= 0.75
        ? 'warn'
        : 'pos'
    : tone

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-surface-3', className)}
    >
      <motion.div
        className={cn('h-full rounded-full', fills[resolved])}
        initial={{ width: 0 }}
        animate={{ width: `${clamped * 100}%` }}
        transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  )
}