'use client'

import { Brain, Calculator, MessageSquareText, Tags, Users } from 'lucide-react'
import { Screen } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { ProBadge } from '@/components/ui/Bits'
import { IconChip } from '@/components/ui/Icon'
import { useNav } from '@/components/nav'
import type { DB } from '@/lib/types'

export function ProHub({ db }: { db: DB }) {
  const nav = useNav()

  return (
    <Screen pad="tab">
      <header className="mb-1 pt-2">
        <div className="flex items-center gap-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Asistente</h1>
          <ProBadge />
        </div>
        <p className="mt-1 text-[13px] text-ink-faint">Las herramientas extra de tu plan Comercial Pro.</p>
      </header>

      <div className="mt-4 space-y-3">
        <ItemHub
          icon={Tags}
          titulo="Precio óptimo por producto"
          bajada="Sugerencias para los productos con el margen más bajo del catálogo"
          onClick={() => nav.push('pro-precios')}
        />
        <ItemHub
          icon={Users}
          titulo="Análisis de costos de personal"
          bajada="Cuánto pesa la nómina sobre lo que factura el negocio"
          onClick={() => nav.push('pro-personal')}
        />
        <ItemHub
          icon={Calculator}
          titulo="Estimación de impuestos"
          bajada="Una primera lectura de lo que viene acumulando el mes"
          onClick={() => nav.push('pro-impuestos')}
        />
        <ItemHub
          icon={MessageSquareText}
          titulo="Asistente por chat y audio"
          bajada="Cargá ventas o gastos hablando o mandando una foto"
          onClick={() => nav.push('chat')}
        />
      </div>

      {db.productos.length === 0 && (
        <p className="mt-6 text-center text-[12.5px] text-ink-faint">
          Cargá tu catálogo en Productos para que estas herramientas tengan con qué trabajar.
        </p>
      )}
    </Screen>
  )
}

function ItemHub({
  icon: Icon,
  titulo,
  bajada,
  onClick,
}: {
  icon: typeof Brain
  titulo: string
  bajada: string
  onClick: () => void
}) {
  return (
    <Card interactive onClick={onClick} className="flex items-center gap-3.5">
      <IconChip icon={Icon} color="accent" />
      <div className="min-w-0 flex-1">
        <p className="text-[14.5px] font-medium text-ink">{titulo}</p>
        <p className="mt-0.5 text-[12.5px] leading-snug text-ink-faint">{bajada}</p>
      </div>
    </Card>
  )
}
