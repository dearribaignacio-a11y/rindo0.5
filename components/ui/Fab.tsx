'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface AccionFab {
  id: string
  label: string
  icon: LucideIcon
  onSelect: () => void
}

/**
 * Botón de acción flotante, anclado sobre la tab bar dentro de la columna.
 *
 * Con `acciones` despliega un menú corto hacia arriba; sin ellas es un botón
 * directo. El ícono por defecto es un "+" — nunca un rayo: el FAB agrega
 * cosas, no lanza algo mágico.
 *
 * Toda pantalla que lo monte tiene que usar `<Screen pad="fab">`, si no el
 * último ítem de la lista queda debajo del botón.
 */
export function Fab({
  onClick,
  acciones,
  icon: Icon = Plus,
  label = 'Agregar',
}: {
  onClick?: () => void
  acciones?: AccionFab[]
  icon?: LucideIcon
  label?: string
}) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    window.addEventListener('mousedown', fuera)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', fuera)
      window.removeEventListener('keydown', esc)
    }
  }, [abierto])

  return (
    <>
      {/* Velo suave para que el menú desplegado se lea sobre la lista. */}
      <AnimatePresence>
        {abierto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-bg-sunken/70"
          />
        )}
      </AnimatePresence>

      <div className="app-col pointer-events-none fixed inset-x-0 bottom-0 z-40">
        <div
          ref={ref}
          className="pointer-events-auto absolute bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-5 flex flex-col items-end gap-2 sm:right-6"
        >
          <AnimatePresence>
            {abierto &&
              acciones?.map((accion, i) => (
                <motion.button
                  key={accion.id}
                  type="button"
                  initial={{ opacity: 0, y: 12, scale: 0.94 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.96 }}
                  transition={{
                    duration: 0.2,
                    delay: i * 0.045,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  onClick={() => {
                    setAbierto(false)
                    accion.onSelect()
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-input border border-line-strong bg-surface-2 py-2.5 pl-3.5 pr-4',
                    'text-sm font-medium text-ink shadow-lg transition-colors hover:bg-surface-3',
                  )}
                >
                  <accion.icon className="size-[18px] text-accent-hi" strokeWidth={1.9} />
                  {accion.label}
                </motion.button>
              ))}
          </AnimatePresence>

          <motion.button
            type="button"
            aria-label={label}
            aria-expanded={acciones ? abierto : undefined}
            whileTap={{ scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 520, damping: 28 }}
            onClick={() => (acciones ? setAbierto((a) => !a) : onClick?.())}
            className={cn(
              'grid size-14 place-items-center rounded-[18px] bg-accent text-accent-ink',
              'shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-colors hover:bg-accent-hi',
            )}
          >
            <motion.span
              animate={{ rotate: abierto ? 45 : 0 }}
              transition={{ type: 'spring', stiffness: 520, damping: 30 }}
              className="grid place-items-center"
            >
              <Icon className="size-6" strokeWidth={2.1} />
            </motion.span>
          </motion.button>
        </div>
      </div>
    </>
  )
}
