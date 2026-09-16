'use client'

import { useId, type ReactNode, type SelectHTMLAttributes } from 'react'
import { motion } from 'framer-motion'
import { ChevronDown, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'

/** Etiqueta + control + mensaje. Lo comparten Select, MoneyInput y los grupos
 *  de opciones, para que todos los formularios tengan el mismo ritmo. */
export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label?: string
  hint?: string
  error?: string
  children: ReactNode
  htmlFor?: string
}) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium text-ink-muted">
          {label}
        </label>
      )}
      {children}
      {(error || hint) && (
        <p className={cn('mt-1.5 text-xs', error ? 'text-neg' : 'text-ink-faint')}>{error ?? hint}</p>
      )}
    </div>
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  hint?: string
  error?: string
  opciones: readonly string[] | { value: string; label: string }[]
  placeholder?: string
}

export function Select({ label, hint, error, opciones, placeholder, className, id, ...rest }: SelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const items = opciones.map((o) => (typeof o === 'string' ? { value: o, label: o } : o))

  return (
    <Field label={label} hint={hint} error={error} htmlFor={selectId}>
      <div className="relative">
        <select
          id={selectId}
          className={cn(
            'h-12 w-full appearance-none rounded-input border bg-surface-2 pl-3.5 pr-10 text-[15px] text-ink',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-soft)]',
            'focus:bg-surface-3 focus:outline-none',
            error
              ? 'border-neg/70 focus:border-neg'
              : 'border-line-strong focus:border-accent-hi focus:shadow-[0_0_0_3px_var(--color-accent-dim)]',
            className,
          )}
          {...rest}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {items.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-[18px] -translate-y-1/2 text-ink-faint" />
      </div>
    </Field>
  )
}

/**
 * Input de plata. Guarda un número, muestra el separador de miles mientras se
 * escribe y arranca vacío en vez de con un 0 que hay que borrar.
 */
export function MoneyInput({
  value,
  onChange,
  label,
  hint,
  error,
  autoFocus,
  placeholder = '0',
}: {
  value: number | null
  onChange: (v: number | null) => void
  label?: string
  hint?: string
  error?: string
  autoFocus?: boolean
  placeholder?: string
}) {
  const id = useId()
  const texto = value === null || Number.isNaN(value) ? '' : value.toLocaleString('es-AR')

  return (
    <Field label={label} hint={hint} error={error} htmlFor={id}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] font-medium text-ink-faint">
          $
        </span>
        <input
          id={id}
          inputMode="numeric"
          autoFocus={autoFocus}
          value={texto}
          placeholder={placeholder}
          onChange={(e) => {
            const limpio = e.target.value.replace(/[^\d]/g, '')
            onChange(limpio === '' ? null : Number(limpio))
          }}
          className={cn(
            'tabular h-14 w-full rounded-input border bg-surface-2 pl-8 pr-3.5 text-[22px] font-semibold text-ink',
            'font-display placeholder:font-normal placeholder:text-ink-faint',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-soft)]',
            'focus:bg-surface-3 focus:outline-none',
            error
              ? 'border-neg/70 focus:border-neg'
              : 'border-line-strong focus:border-accent-hi focus:shadow-[0_0_0_3px_var(--color-accent-dim)]',
          )}
        />
      </div>
    </Field>
  )
}

/** Contador − / valor / + para cantidades. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 9999,
  size = 'md',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  size?: 'sm' | 'md'
}) {
  const boton = size === 'sm' ? 'size-8 [&>svg]:size-4' : 'size-10 [&>svg]:size-[18px]'

  return (
    <div className="flex items-center gap-1">
      <motion.button
        type="button"
        aria-label="Restar"
        whileTap={{ scale: 0.9 }}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className={cn(
          'grid place-items-center rounded-[10px] border border-line-strong bg-surface-2 text-ink-muted',
          'transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-35 disabled:hover:bg-surface-2',
          boton,
        )}
      >
        <Minus strokeWidth={2.2} />
      </motion.button>

      <span
        className={cn(
          'tabular min-w-9 text-center font-semibold text-ink',
          size === 'sm' ? 'text-sm' : 'text-[15px]',
        )}
      >
        {value}
      </span>

      <motion.button
        type="button"
        aria-label="Sumar"
        whileTap={{ scale: 0.9 }}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className={cn(
          'grid place-items-center rounded-[10px] border border-line-strong bg-surface-2 text-ink-muted',
          'transition-colors hover:bg-surface-3 hover:text-ink disabled:opacity-35 disabled:hover:bg-surface-2',
          boton,
        )}
      >
        <Plus strokeWidth={2.2} />
      </motion.button>
    </div>
  )
}

/** Grupo de opciones tipo "pills" para elegir una entre pocas. */
export function OptionGroup<T extends string>({
  label,
  value,
  onChange,
  opciones,
  columnas = 2,
}: {
  label?: string
  value: T | null
  onChange: (v: T) => void
  opciones: readonly T[]
  columnas?: 1 | 2 | 3
}) {
  const grid = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }[columnas]

  return (
    <Field label={label}>
      <div className={cn('grid gap-2', grid)}>
        {opciones.map((o) => {
          const activo = o === value
          return (
            <motion.button
              key={o}
              type="button"
              whileTap={{ scale: 0.98 }}
              onClick={() => onChange(o)}
              className={cn(
                'rounded-input border px-3 py-3 text-[14px] font-medium transition-colors duration-200',
                activo
                  ? 'border-accent-hi bg-accent-dim text-ink'
                  : 'border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3 hover:text-ink',
              )}
            >
              {o}
            </motion.button>
          )
        })}
      </div>
    </Field>
  )
}
