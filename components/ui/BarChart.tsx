'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/cn'

export interface Bar {
  label: string
  value: number
  /** The one bar worth calling out — today, or the peak hour. */
  highlight?: boolean
}

interface BarChartProps {
  data: Bar[]
  /** Formats the tooltip value. Defaults to the raw number. */
  format?: (v: number) => string
  height?: number
  className?: string
  /** Caption shown under the chart when no bar is being touched. */
  caption?: string
}

/**
 * Vertical bars with rounded tops, a grow-in animation and tap-to-read
 * tooltips. Only the highlighted bar takes the accent colour — everything
 * else stays neutral grey so the callout actually reads as one.
 */
export function BarChart({ data, format, height = 148, className, caption }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  const fmt = format ?? ((v: number) => String(v))

  return (
    <div className={cn('w-full', className)}>
      <div className="relative flex items-end gap-1.5" style={{ height }}>
        {data.map((bar, i) => {
          const ratio = bar.value / max
          const isActive = active === i
          return (
            <button
              key={bar.label + i}
              type="button"
              onPointerDown={() => setActive(i)}
              onPointerUp={() => setActive(null)}
              onPointerLeave={() => setActive((p) => (p === i ? null : p))}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((p) => (p === i ? null : p))}
              aria-label={`${bar.label}: ${fmt(bar.value)}`}
              className="group relative flex h-full flex-1 cursor-pointer flex-col justify-end"
            >
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.94 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 4, scale: 0.94 }}
                    transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                    className={cn(
                      'tabular pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2',
                      'whitespace-nowrap rounded-[9px] border border-line-strong bg-surface-3 px-2 py-1',
                      'text-[11px] font-semibold text-ink shadow-lg',
                    )}
                  >
                    {fmt(bar.value)}
                  </motion.span>
                )}
              </AnimatePresence>

              <motion.span
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(ratio * 100, 2)}%` }}
                transition={{
                  duration: 0.62,
                  delay: i * 0.045,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className={cn(
                  // Rounded top corners, square base — bars grow out of the axis.
                  'block w-full rounded-t-[6px] transition-colors duration-200',
                  bar.highlight
                    ? 'bg-accent-hi'
                    : isActive
                      ? 'bg-surface-3'
                      : 'bg-surface-2 group-hover:bg-surface-3',
                )}
              />
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {data.map((bar, i) => (
          <span
            key={bar.label + i}
            className={cn(
              'flex-1 text-center text-[10px] font-medium transition-colors duration-200',
              bar.highlight || active === i ? 'text-ink-muted' : 'text-ink-faint',
            )}
          >
            {bar.label}
          </span>
        ))}
      </div>

      {caption && (
        <p className="mt-2.5 text-xs text-ink-faint">
          {active !== null ? `${data[active].label} · ${fmt(data[active].value)}` : caption}
        </p>
      )}
    </div>
  )
}