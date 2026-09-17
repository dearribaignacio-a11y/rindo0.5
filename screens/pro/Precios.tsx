'use client'

import { Sparkles, Tags } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Disclaimer, Empty } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { ignorarPrecio, updateProducto } from '@/lib/storage'
import { margen } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import type { DB } from '@/lib/types'

/** Margen mínimo objetivo. Es un valor de referencia, editable a futuro. */
const MARGEN_OBJETIVO = 0.4

export function ProPrecios({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()

  const candidatos = db.productos
    .filter((p) => p.costo > 0 && !db.preciosIgnorados.includes(p.id) && margen(p) < MARGEN_OBJETIVO)
    .map((p) => ({
      producto: p,
      sugerido: Math.round((p.costo / (1 - MARGEN_OBJETIVO)) / 10) * 10,
    }))
    .sort((a, b) => margen(a.producto) - margen(b.producto))

  return (
    <Screen pad="none">
      <TopBar title="Precio óptimo" onBack={nav.pop} />

      <Disclaimer>
        Sugerencia calculada con un margen objetivo del {pct(MARGEN_OBJETIVO)} sobre el costo cargado. No
        contempla la competencia ni la demanda: es un punto de partida para revisar, no una recomendación
        cerrada.
      </Disclaimer>

      <div className="mt-4">
        {candidatos.length === 0 ? (
          <Empty
            icon={Sparkles}
            title="Sin sugerencias por ahora"
            hint="Todos tus productos con costo cargado ya están por encima del margen objetivo."
          />
        ) : (
          <div className="space-y-3">
            {candidatos.map(({ producto, sugerido }) => (
              <Card key={producto.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <IconChip icon={iconoRubro(producto.categoria)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-ink">{producto.nombre}</p>
                    <p className="tabular truncate text-[12.5px] text-ink-faint">
                      Precio actual {money(producto.precio)} · margen {pct(margen(producto))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <Tags className="size-[16px] text-accent-hi" strokeWidth={1.9} />
                    <span className="tabular text-[15px] font-semibold text-ink">{money(sugerido)}</span>
                  </div>
                  <span className="tabular text-[12px] text-ink-faint">margen {pct(MARGEN_OBJETIVO)}</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    full
                    onClick={() => {
                      ignorarPrecio(producto.id)
                      toast('Sugerencia descartada')
                    }}
                  >
                    Ignorar
                  </Button>
                  <Button
                    size="sm"
                    full
                    onClick={async () => {
                      try {
                        await updateProducto(producto.id, { precio: sugerido })
                        toast('Precio actualizado')
                      } catch {
                        toast('No pudimos actualizar el precio. Probá de nuevo.', 'aviso')
                      }
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}
