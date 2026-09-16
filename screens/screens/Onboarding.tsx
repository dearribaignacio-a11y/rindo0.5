'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/Button'
import { Ilustracion, type IlustracionId } from '@/components/Ilustracion'
import { cn } from '@/lib/cn'
import type { PlanId } from '@/lib/types'

interface Paso {
  ilustracion: IlustracionId
  titulo: string
  bajada: string
}

const GUIONES: Record<PlanId, Paso[]> = {
  hogar: [
    {
      ilustracion: 'casa',
      titulo: 'Bienvenido a Rindo',
      bajada: 'Ordená las cuentas de tu hogar sin planillas ni Excel.',
    },
    {
      ilustracion: 'ticket',
      titulo: 'Sacale una foto a tus tickets',
      bajada: 'Rindo reconoce automáticamente lo que compraste y lo carga por vos.',
    },
    {
      ilustracion: 'barras',
      titulo: 'Controlá tu presupuesto mensual',
      bajada: 'Definí un límite por categoría y recibí avisos antes de pasarte.',
    },
  ],
  comercial: [
    {
      ilustracion: 'caja',
      titulo: 'Registrá cada venta en segundos',
      bajada: 'Buscás el producto, elegís cómo te pagaron y listo. El stock se descuenta solo.',
    },
    {
      ilustracion: 'estanteria',
      titulo: 'Nunca más te quedás sin mercadería',
      bajada: 'Rindo te avisa qué está por agotarse antes de que un cliente te lo pregunte.',
    },
    {
      ilustracion: 'reporte',
      titulo: 'Mirá qué se vende de verdad',
      bajada: 'Ventas por día, por hora y por producto. Sabés qué reponer y qué dejar de comprar.',
    },
  ],
  'comercial-pro': [
    {
      ilustracion: 'ia-impuestos',
      titulo: 'Tus impuestos, estimados solos',
      bajada: 'El Asistente calcula cuánto vas a pagar este mes con tus ventas reales.',
    },
    {
      ilustracion: 'ia-personal',
      titulo: 'Cuánto te cuesta cada persona',
      bajada: 'Sueldos y cargas comparados con lo que genera cada empleado en el mostrador.',
    },
    {
      ilustracion: 'ia-precio',
      titulo: 'El precio justo de cada producto',
      bajada: 'Son sugerencias para decidir mejor, no un reemplazo de tu contador ni de tu criterio.',
    },
  ],
}

/**
 * Onboarding visual — tres pantallas, sólo la primera vez.
 *
 * El bloque ilustración + texto se centra junto, con un gap fijo: repartir el
 * espacio sobrante entre los dos dejaba un pozo de aire en el medio en
 * pantallas altas.
 */
export function Onboarding({ plan, onListo }: { plan: PlanId; onListo: () => void }) {
  const pasos = GUIONES[plan]
  const [i, setI] = useState(0)
  const ultimo = i === pasos.length - 1
  const paso = pasos[i]

  return (
    <div className="flex min-h-dvh w-full flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
      <div className="flex h-10 items-center justify-end">
        <AnimatePresence>
          {!ultimo && (
            <motion.button
              type="button"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onListo}
              className="rounded-lg px-2 py-1 text-[13px] text-ink-muted transition-colors hover:text-ink"
            >
              Omitir
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 26 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -22 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-1 flex-col justify-center gap-7"
          >
            {/* La ilustración y el texto van juntos y centrados como un solo
                bloque: separarlos con `flex-1` dejaba un pozo de aire en el
                medio en pantallas altas. */}
            <div className="flex items-center justify-center">
              <div className="w-full max-w-[360px]">
                <Ilustracion id={paso.ilustracion} />
              </div>
            </div>

            <div>
              <h1 className="text-[27px] font-semibold leading-[1.15] tracking-[-0.025em] text-ink">
                {paso.titulo}
              </h1>
              <p className="mt-3 max-w-[34ch] text-[15.5px] leading-relaxed text-ink-muted">
                {paso.bajada}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-6 flex items-center justify-center gap-2">
        {pasos.map((_, k) => (
          <button
            key={k}
            type="button"
            aria-label={`Ir al paso ${k + 1}`}
            onClick={() => setI(k)}
            className="p-1.5"
          >
            <motion.span
              className={cn('block h-1.5 rounded-full', k === i ? 'bg-accent-hi' : 'bg-surface-3')}
              animate={{ width: k === i ? 24 : 8 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          </button>
        ))}
      </div>

      <Button
        full
        size="lg"
        className="mt-4"
        onClick={() => (ultimo ? onListo() : setI((v) => v + 1))}
      >
        {ultimo ? 'Empezar a usar Rindo' : 'Siguiente'}
      </Button>
    </div>
  )
}
