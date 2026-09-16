'use client'

import { Megaphone } from 'lucide-react'

/**
 * Espacio publicitario del plan Hogar (gratuito).
 *
 * Se renderiza como un slot vacío y honesto: cuando haya red de anuncios, acá
 * va el `<ins>` del proveedor. Está marcado como "Publicidad" para que nunca
 * se confunda con un dato de la app, y no usa colores de estado.
 */
export function AdSlot({ etiqueta = 'Publicidad' }: { etiqueta?: string }) {
  return (
    <div className="mt-5 overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/60">
      <div className="flex items-center gap-3 px-4 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-surface-2 text-ink-faint">
          <Megaphone className="size-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
            {etiqueta}
          </p>
          <p className="mt-0.5 text-[13px] text-ink-muted">
            Pasate a Comercial y sacá los anuncios.
          </p>
        </div>
      </div>
    </div>
  )
}
