'use client'

import { forwardRef, useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-accent-ink hover:bg-accent-hi active:bg-accent-lo shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]',
  secondary:
    'bg-surface-2 text-ink border border-line-strong hover:bg-surface-3 active:bg-surface-2',
  ghost: 'bg-transparent text-ink-muted hover:bg-surface-2 hover:text-ink',
  danger: 'bg-neg-dim text-neg border border-neg/40 hover:bg-neg/20',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-4 text-sm gap-2',
  lg: 'h-14 px-5 text-[15px] gap-2',
}

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant
  size?: Size
  full?: boolean
  loading?: boolean
  /**
   * Play a brief check-mark confirmation before running `onConfirmed`.
   * Used by the high-stakes actions ("Confirmar venta", "Confirmar y aplicar
   * al stock") so the commit is acknowledged *before* the screen changes.
   */
  confirm?: boolean
  onConfirmed?: () => void
  confirmLabel?: string
  icon?: ReactNode
  children?: ReactNode
}

const CONFIRM_MS = 620

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    full,
    loading,
    confirm,
    onConfirmed,
    confirmLabel = 'Listo',
    icon,
    className,
    children,
    onClick,
    disabled,
    ...rest
  },
  ref,
) {
  const [done, setDone] = useState(false)
  const timer = useRef<number | null>(null)
  const busy = Boolean(loading) || done

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e as never)
    if (!confirm) return
    setDone(true)
    // Long enough to read the check, short enough not to feel like a wait.
    timer.current = window.setTimeout(() => {
      setDone(false)
      onConfirmed?.()
    }, CONFIRM_MS)
  }

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled || busy}
      onClick={handleClick}
      whileTap={disabled || busy ? undefined : { scale: 0.972 }}
      transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      className={cn(
        'relative inline-flex select-none items-center justify-center overflow-hidden rounded-input font-medium',
        'transition-colors duration-150 ease-[var(--ease-out-soft)]',
        'disabled:pointer-events-none',
        disabled && !busy && 'opacity-45',
        variants[variant],
        sizes[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {/* Two stacked layers cross-fade instead of swapping nodes. The button
          keeps its exact width through the whole interaction, and the
          confirmation can't get stuck waiting on an exit animation. */}
      <motion.span
        initial={false}
        animate={{ opacity: done ? 0 : 1, y: done ? -8 : 0 }}
        transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center gap-2"
      >
        {loading ? <Loader2 className="size-[18px] animate-spin" /> : icon}
        {children}
      </motion.span>

      <motion.span
        aria-hidden={!done}
        initial={false}
        animate={{ opacity: done ? 1 : 0, y: done ? 0 : 8 }}
        transition={{ duration: 0.17, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 inline-flex items-center justify-center gap-2"
      >
        <motion.span
          initial={false}
          animate={{ scale: done ? 1 : 0.3 }}
          transition={{ type: 'spring', stiffness: 600, damping: 18, delay: done ? 0.05 : 0 }}
          className="inline-flex"
        >
          <Check className="size-[18px]" strokeWidth={2.75} />
        </motion.span>
        {confirmLabel}
      </motion.span>
    </motion.button>
  )
})