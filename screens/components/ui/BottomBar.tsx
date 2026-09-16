import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Fixed action bar pinned to the bottom of the app column.
 *
 * Two things it gets right that a plain `fixed inset-x-0` does not:
 * · it stays inside the app's 440px column instead of bleeding across a
 *   wide viewport;
 * · it carries a gradient scrim, so content scrolling underneath fades out
 *   rather than colliding with the button.
 *
 * Screens using it must reserve space at the end of their scroll area —
 * `pb-40` for a single button, more if the bar is taller.
 */
export function BottomBar({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className="app-col pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div className="pointer-events-none h-10 bg-gradient-to-t from-bg to-transparent" />
      <div
        className={cn(
          'pointer-events-auto border-t border-line bg-bg/95 px-5 pt-3 backdrop-blur-xl sm:px-8',
          'pb-[max(1rem,env(safe-area-inset-bottom))]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  )
}
