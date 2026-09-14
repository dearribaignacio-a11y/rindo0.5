import { cn } from '@/lib/cn'

/** Shimmering placeholder. Uses surface tones only — never a grey wash. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-[10px] bg-surface-2',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-[rd-shimmer_1.5s_infinite]',
        'after:bg-gradient-to-r after:from-transparent after:via-surface-3 after:to-transparent',
        className,
      )}
    />
  )
}
