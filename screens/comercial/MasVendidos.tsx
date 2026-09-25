'use client'

import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Segmented } from '@/components/ui/Segmented'
import { Empty, Row } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { useNav } from '@/components/nav'
import { rankingProductos, ventasEnPeriodo, type PeriodoRanking } from '@/lib/calc'
import { money } from '@/lib/format'
import type { DB } from '@/lib/types'

const OPCIONES_PERIODO = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'semana', label: '7 días' },
  { id: 'mes', label: '30 días' },
  { id: 'todo', label: 'Todo' },
] as const

/**
 * Ranking completo de productos vendidos, con período elegible — el Resumen
 * sólo muestra el top 4 de hoy, esta pantalla es el detalle. La ganancia es
 * una estimación con el costo ACTUAL de cada producto (no se guarda el costo
 * histórico de cada venta), igual que el margen que ya se muestra en Precios.
 */
export function MasVendidos({ db }: { db: DB }) {
  const nav = useNav()
  const [periodo, setPeriodo] = useState<PeriodoRanking>('hoy')

  const ventas = ventasEnPeriodo(db.ventas, periodo)
  const ranking = rankingProductos(ventas, db.productos)

  return (
    <Screen pad="none">
      <TopBar title="Más vendidos" onBack={nav.pop} />

      <Segmented
        layoutId="periodo-ranking"
        value={periodo}
        onChange={setPeriodo}
        opciones={[...OPCIONES_PERIODO]}
        semantica="radio"
        etiqueta="Período del ranking"
      />

      <div className="mt-4">
        {ranking.length === 0 ? (
          <Card>
            <Empty
              icon={Trophy}
              title="Sin ventas en este período"
              hint="Probá con otro período, o cargá una venta primero."
            />
          </Card>
        ) : (
          <Card className="py-1">
            {ranking.map((r, i) => (
              <Row
                key={r.productoId}
                leading={
                  <div className="relative">
                    <IconChip icon={iconoRubro(r.producto?.categoria ?? '')} size="sm" />
                    <span className="tabular absolute -bottom-1 -right-1 grid size-[18px] place-items-center rounded-full border border-line-strong bg-surface text-[10px] font-bold text-ink-faint">
                      {i + 1}
                    </span>
                  </div>
                }
                title={r.nombre}
                subtitle={`${r.unidades} unidad${r.unidades > 1 ? 'es' : ''} · ganancia ${money(r.ganancia)}`}
                trailing={<span className="tabular text-[14.5px] font-semibold text-ink">{money(r.facturado)}</span>}
              />
            ))}
          </Card>
        )}
      </div>
    </Screen>
  )
}
