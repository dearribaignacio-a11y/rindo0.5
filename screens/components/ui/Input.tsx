'use client'

import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leading?: ReactNode
  /** Renders a show/hide toggle and manages the type swap itself. */
  reveal?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leading, reveal, className, id, type = 'text', ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const [shown, setShown] = useState(false)
  const resolvedType = reveal ? (shown ? 'text' : 'password') : type

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className="mb-1.5 block text-[13px] font-medium text-ink-muted"
        >
          {label}
        </label>
      )}

      <div className="relative">
        {leading && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint">
            {leading}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          type={resolvedType}
          aria-invalid={!!error}
          aria-describedby={error || hint ? `${inputId}-msg` : undefined}
          className={cn(
            'h-12 w-full rounded-input border bg-surface-2 text-[15px] text-ink',
            'placeholder:text-placeholder',
            'transition-[border-color,box-shadow,background-color] duration-200 ease-[var(--ease-out-soft)]',
            'focus:bg-surface-3 focus:outline-none',
            leading ? 'pl-11' : 'pl-3.5',
            reveal ? 'pr-12' : 'pr-3.5',
            error
              ? 'border-neg/70 focus:border-neg focus:shadow-[0_0_0_3px_var(--color-neg-dim)]'
              : 'border-line-strong focus:border-accent-hi focus:shadow-[0_0_0_3px_var(--color-accent-dim)]',
            className,
          )}
          {...rest}
        />

        {reveal && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-3 hover:text-ink"
          >
            {shown ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        )}
      </div>

      {(error || hint) && (
        <p
          id={`${inputId}-msg`}
          className={cn('mt-1.5 text-xs', error ? 'text-neg' : 'text-ink-faint')}
        >
          {error ?? hint}
        </p>
      )}
    </div>
  )
})