import { cn } from '@/lib/cn'

/**
 * The "Rindo" wordmark.
 * Hard rule: one uniform colour for the whole word — the mark never mixes
 * per-letter colours. The glyph beside it is the only tinted element.
 */
export function Logo({
  size = 'md',
  mark = true,
  className,
}: {
  size?: 'sm' | 'md' | 'lg'
  mark?: boolean
  className?: string
}) {
  const text = { sm: 'text-lg', md: 'text-2xl', lg: 'text-[34px]' }[size]
  const box = { sm: 'size-7 rounded-[8px]', md: 'size-9 rounded-[11px]', lg: 'size-12 rounded-[14px]' }[size]
  const glyph = { sm: 'text-[13px]', md: 'text-[17px]', lg: 'text-[22px]' }[size]

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      {mark && (
        <span
          className={cn(
            'grid shrink-0 place-items-center bg-accent text-accent-ink',
            'shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]',
            box,
          )}
        >
          <span className={cn('font-bold leading-none tracking-tight', glyph)}>R</span>
        </span>
      )}
      <span
        className={cn(
          'font-semibold leading-none tracking-[-0.03em] text-ink',
          text,
        )}
      >
        Rindo
      </span>
    </div>
  )
}
