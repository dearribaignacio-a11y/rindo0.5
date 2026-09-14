'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  description?: string
  disabled?: boolean
}

/** Spring-animated knob — the track colour cross-fades rather than snapping. */
export function Switch({ checked, onChange, label, description, disabled }: SwitchProps) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-7 w-[46px] shrink-0 rounded-full border p-0.5',
        'transition-colors duration-250 ease-[var(--ease-out-soft)]',
        'disabled:pointer-events-none disabled:opacity-45',
        checked ? 'border-accent-hi bg-accent' : 'border-line-strong bg-surface-3',
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 620, damping: 34 }}
        className={cn(
          'block size-[22px] rounded-full shadow-sm',
          checked ? 'bg-accent-ink' : 'bg-ink-muted',
        )}
        style={{ marginLeft: checked ? 18 : 0 }}
      />
    </button>
  )

  if (!label) return control

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{label}</p>
        {description && <p className="mt-0.5 text-xs text-ink-faint">{description}</p>}
      </div>
      {control}
    </div>
  )
}