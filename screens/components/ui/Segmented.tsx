'use client'

import { useRef } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/cn'

/**
 * Control segmentado (Mensual/Anual, Día/Semana/Mes). El fondo activo se
 * desliza con `layoutId` en lugar de saltar entre opciones.
 *
 * Semántica: por defecto `tablist`, que es lo correcto cuando cada opción
 * muestra un panel distinto. Cuando el control elige un *valor* y no una
 * vista — el ciclo de facturación, por ejemplo — hay que pasar
 * `semantica="radio"`, porque un tab sin tabpanel asociado le miente al
 * lector de pantalla.
 *
 * En ambos modos el estado activo se comunica por rol ARIA y no sólo por
 * color, y se puede recorrer con las flechas del teclado.
 */
export function Segmented<T extends string>({
  value,
  onChange,
  opciones,
  size = 'md',
  layoutId,
  className,
  semantica = 'tabs',
  etiqueta,
}: {
  value: T
  onChange: (v: T) => void
  opciones: { id: T; label: string }[]
  size?: 'sm' | 'md'
  /** Único por instancia montada a la vez: es el id de la animación compartida. */
  layoutId: string
  className?: string
  semantica?: 'tabs' | 'radio'
  /** Nombre accesible del grupo. Obligatorio en modo radio. */
  etiqueta?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const esRadio = semantica === 'radio'

  /** Flechas mueven la selección, Inicio/Fin van a los extremos. */
  function onKeyDown(e: React.KeyboardEvent, i: number) {
    const ultimo = opciones.length - 1
    let destino: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') destino = i === ultimo ? 0 : i + 1
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') destino = i === 0 ? ultimo : i - 1
    else if (e.key === 'Home') destino = 0
    else if (e.key === 'End') destino = ultimo
    if (destino === null) return
    e.preventDefault()
    onChange(opciones[destino].id)
    refs.current[destino]?.focus()
  }

  return (
    <div
      role={esRadio ? 'radiogroup' : 'tablist'}
      aria-label={etiqueta}
      className={cn('grid gap-1 rounded-input border border-line bg-surface p-1', className)}
      style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
    >
      {opciones.map((o, i) => {
        const activo = o.id === value
        return (
          <button
            key={o.id}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role={esRadio ? 'radio' : 'tab'}
            {...(esRadio ? { 'aria-checked': activo } : { 'aria-selected': activo })}
            // Un solo punto de tabulación para todo el grupo; adentro se
            // navega con flechas, como manda el patrón ARIA.
            tabIndex={activo ? 0 : -1}
            onKeyDown={(e) => onKeyDown(e, i)}
            onClick={() => onChange(o.id)}
            className={cn(
              'relative rounded-[10px] font-medium transition-colors duration-200',
              // 40px de alto mínimo: con el padding del contenedor el objetivo
              // táctil real queda en 44px.
              size === 'sm' ? 'min-h-9 py-1.5 text-[13px]' : 'min-h-10 py-2 text-sm',
              activo ? 'text-ink' : 'text-ink-muted hover:text-ink',
            )}
          >
            {activo && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                className="absolute inset-0 rounded-[10px] bg-surface-3"
              />
            )}
            <span className="relative">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}
