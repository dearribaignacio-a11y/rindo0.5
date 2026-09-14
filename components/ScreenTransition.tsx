'use client'

import type { ReactNode } from 'react'
import { motion } from 'framer-motion'

export type Direction = 'forward' | 'back' | 'none'

/**
 * Wraps a screen so route changes slide/fade instead of snapping.
 * `forward` pushes in from the right, `back` from the left, `none`
 * cross-fades (used for lateral tab switches inside one plan).
 */
export function ScreenTransition({
  children,
  direction = 'forward',
}: {
  children: ReactNode
  direction?: Direction
}) {
  const offset = direction === 'forward' ? 28 : direction === 'back' ? -28 : 0

  return (
    <motion.div
      initial={{ opacity: 0, x: offset }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -offset * 0.5 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  )
}

/** Staggered fade-in for lists — content settles in instead of popping. */
export function Stagger({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="shown"
      variants={{
        hidden: {},
        shown: { transition: { staggerChildren: 0.045, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        shown: { opacity: 1, y: 0, transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}