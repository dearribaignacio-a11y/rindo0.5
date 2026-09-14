'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

interface CardProps {
  children: ReactNode
  className?: string
  /** Adds press feedback — only for cards that are actually tappable. */
  interactive?: boolean
  selected?: boolean
  onClick?: () => void
  as?: 'div' | 'button'
}

export function Card({
  children,
  className,
  interactive,
  selected,
  onClick,
  as,
}: CardProps) {
  const Tag = (as ?? (onClick ? 'button' : 'div')) as 'div'
  const El = motion[Tag] as typeof motion.div

  return (
    <El
      onClick={onClick}
      whileTap={interactive || onClick ? { scale: 0.985 } : undefined}
      transition={{ type: 'spring', stiffness: 520, damping: 32 }}
      className={cn(
        'rounded-card border bg-surface p-4 text-left',
        'transition-colors duration-200 ease-[var(--ease-out-soft)]',
        selected
          ? 'border-accent-hi bg-accent-dim/40'
          : 'border-line hover:border-line-strong',
        (interactive || onClick) && 'w-full cursor-pointer',
        className,
      )}
    >
      {children}
    </El>
  )
}

export function CardHeader({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold tracking-tight text-ink">{title}</h3>
          {hint && <p className="mt-0.5 truncate text-xs text-ink-faint">{hint}</p>}
        </div>
      </div>
      {action}
    </div>
  )
}