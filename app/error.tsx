'use client'

import { useEffect } from 'react'
import { Logo } from '@/components/ui/Logo'
import { Button } from '@/components/ui/Button'

/** Pantalla propia para cuando una página del servidor falla (por ejemplo,
 *  Supabase no responde) — antes se veía un 504 en negro, sin nada de Rindo. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center gap-4 px-5 text-center">
      <Logo size="lg" />
      <p className="max-w-[34ch] text-[15px] leading-relaxed text-ink-muted">
        No pudimos conectarnos en este momento. Revisá tu conexión y probá de nuevo en unos segundos.
      </p>
      <Button size="lg" onClick={reset}>
        Reintentar
      </Button>
    </div>
  )
}
