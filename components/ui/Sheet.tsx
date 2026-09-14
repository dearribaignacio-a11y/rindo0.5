'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

/**
 * Hoja inferior modal. Se usa para todos los detalles y formularios cortos
 * (movimiento, producto, empleado, categoría) en vez de navegar a otra
 * pantalla: el contexto de la lista queda visible detrás.
 *
 * Igual que el resto de lo `fixed`, se alinea a la columna de la app.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean
  onClose: () => void
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  const origen = useRef<HTMLElement | null>(null)

  // `onClose` suele llegar como arrow inline, así que cambia de identidad en
  // cada render del padre. Si el efecto dependiera de ella se desmontaría y
  // volvería a montar todo el tiempo, pisando `origen` con el elemento que
  // estuviera enfocado dentro de la hoja y devolviendo el foco a destiempo.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  // Escape, bloqueo del scroll de fondo y trampa de foco.
  // Depende sólo de `open`: se arma al abrir y se desarma al cerrar.
  useEffect(() => {
    if (!open) return

    origen.current = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(
        panel.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => el.offsetParent !== null || el === document.activeElement)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return

      // Trampa de foco: mientras la hoja está abierta, Tab no puede salir.
      const items = focusables()
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const primero = items[0]
      const ultimo = items[items.length - 1]
      const activo = document.activeElement

      if (e.shiftKey && (activo === primero || !panel.current?.contains(activo))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && activo === ultimo) {
        e.preventDefault()
        primero.focus()
      }
    }

    // El foco entra al primer campo (o al primer control) de la hoja.
    const t = window.setTimeout(() => {
      const items = focusables()
      const campo = items.find((el) => el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)
      ;(campo ?? items[0])?.focus()
    }, 60)

    const previo = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      window.clearTimeout(t)
      document.body.style.overflow = previo
      window.removeEventListener('keydown', onKey)
      // Devolver el foco a quien abrió la hoja.
      origen.current?.focus?.()
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="absolute inset-0 bg-bg-sunken/80 backdrop-blur-[2px]"
          />

          <div className="app-col pointer-events-none absolute inset-x-0 bottom-0">
            <motion.div
              ref={panel}
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className={cn(
                'pointer-events-auto max-h-[88dvh] overflow-hidden rounded-t-sheet',
                'border border-b-0 border-line bg-surface shadow-[0_-16px_50px_rgba(0,0,0,0.55)]',
              )}
            >
              <div className="flex justify-center pb-1 pt-2.5">
                <span className="h-1 w-10 rounded-full bg-line-strong" />
              </div>

              {title && (
                <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-1">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold tracking-[-0.02em] text-ink">
                      {title}
                    </h2>
                    {subtitle && <p className="mt-0.5 truncate text-[13px] text-ink-faint">{subtitle}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Cerrar"
                    className="-mr-1.5 -mt-1 grid size-9 shrink-0 place-items-center rounded-[10px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
                  >
                    <X className="size-[18px]" />
                  </button>
                </div>
              )}

              <div className="max-h-[62dvh] overflow-y-auto px-5 pb-2">{children}</div>

              {footer && (
                <div className="border-t border-line bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
                  {footer}
                </div>
              )}
              {!footer && <div className="pb-[max(1rem,env(safe-area-inset-bottom))]" />}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}

/** Fila etiqueta / valor para los detalles dentro de una hoja. */
export function SheetRow({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 border-b border-line py-3 last:border-0', className)}>
      <span className="text-[13px] text-ink-muted">{label}</span>
      <span className="tabular text-right text-sm font-medium text-ink">{children}</span>
    </div>
  )
}
