'use client'

import { CreditCard, PencilLine, Receipt, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Empty, Row } from '@/components/ui/Bits'
import { IconChip } from '@/components/ui/Icon'
import { agruparPorFecha } from '@/lib/calc'
import { fechaRelativa, hora, money } from '@/lib/format'
import type { DB, MetodoPago } from '@/lib/types'

const ICONO_METODO: Record<MetodoPago, typeof Wallet> = {
  efectivo: Wallet,
  tarjeta: CreditCard,
  transferencia: Receipt,
}

export function ComercialMovimientos({ db }: { db: DB }) {
  const grupos = agruparPorFecha(db.ventas)

  return (
    <Screen pad="tab">
      <header className="mb-4 pt-2">
        <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Ventas</h1>
      </header>

      {grupos.length === 0 ? (
        <Empty
          icon={PencilLine}
          title="Sin ventas registradas"
          hint="Las ventas que cargues desde Resumen van a aparecer acá, agrupadas por día."
        />
      ) : (
        grupos.map(([dia, ventas]) => (
          <div key={dia}>
            <SectionTitle>{fechaRelativa(dia)}</SectionTitle>
            <Card className="py-1">
              {ventas.map((v) => (
                <Row
                  key={v.id}
                  leading={<IconChip icon={ICONO_METODO[v.metodo]} size="sm" />}
                  title={v.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(', ')}
                  subtitle={hora(v.fecha)}
                  trailing={<span className="tabular text-[14.5px] font-semibold text-ink">{money(v.total)}</span>}
                />
              ))}
            </Card>
          </div>
        ))
      )}
    </Screen>
  )
}
