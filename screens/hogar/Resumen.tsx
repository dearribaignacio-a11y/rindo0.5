'use client'

import { useState } from 'react'
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  Camera,
  PencilLine,
  Wallet,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Fab } from '@/components/ui/Fab'
import { Avatar, Empty, Row } from '@/components/ui/Bits'
import { IconChip, iconoDe } from '@/components/ui/Icon'
import { AdSlot } from '@/components/AdSlot'
import { MovimientoSheet } from '@/components/hogar/MovimientoSheet'
import { TicketSheet } from '@/components/hogar/TicketSheet'
import { resumenMes, usoPorCategoria } from '@/lib/calc'
import { fechaCorta, fechaRelativa, money, moneySigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB } from '@/lib/types'

export function HogarResumen({ db, onVerTodo }: { db: DB; onVerTodo: () => void }) {
  const [sheet, setSheet] = useState<'ninguno' | 'manual' | 'ticket'>('ninguno')

  const { ingresos, gastos, balance } = resumenMes(db.movimientos)
  const usos = usoPorCategoria(db.movimientos, db.categorias).slice(0, 4)
  const ultimos = db.movimientos.slice(0, 4)
  const nombre = db.perfil?.nombre?.split(' ')[0] ?? 'de nuevo'
  const sueldo = db.perfil?.ingresoMensual ?? 0

  return (
    <>
      <Screen pad="fab">
        <header className="mb-5 flex items-center gap-3 pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-faint">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="truncate text-[21px] font-semibold tracking-[-0.025em] text-ink">
              Hola, {nombre}
            </h1>
          </div>
          <Avatar nombre={db.perfil?.nombre ?? 'R'} />
        </header>

        {/* Tarjeta principal: el balance es el número más grande de la pantalla. */}
        <Card className="p-5">
          <p className="text-[13px] font-medium text-ink-muted">Balance del mes</p>
          <p
            className={cn(
              'tabular mt-1 font-display text-[40px] font-bold leading-none tracking-[-0.035em]',
              balance >= 0 ? 'text-pos' : 'text-neg',
            )}
          >
            {money(balance)}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-pos">
                <ArrowUpRight className="size-4" strokeWidth={2.3} />
                <span className="text-[11.5px] font-semibold uppercase tracking-wide">Ingresos</span>
              </div>
              <p className="tabular mt-1 text-[16px] font-semibold text-ink">{money(ingresos)}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-neg">
                <ArrowDownLeft className="size-4" strokeWidth={2.3} />
                <span className="text-[11.5px] font-semibold uppercase tracking-wide">Gastos</span>
              </div>
              <p className="tabular mt-1 text-[16px] font-semibold text-ink">{money(gastos)}</p>
            </div>
          </div>
        </Card>

        {sueldo > 0 && (
          <Card className="mt-3 flex items-center gap-3">
            <IconChip icon={Wallet} color="pos" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">Ingreso fijo mensual</p>
              <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-ink-faint">
                <CalendarClock className="size-3.5" strokeWidth={1.9} />
                Próximo el {fechaCorta(proximoSueldo())}
              </p>
            </div>
            <span className="tabular shrink-0 text-[15px] font-semibold text-ink">
              {money(sueldo)}
            </span>
          </Card>
        )}

        <SectionTitle
          action={
            usos.length > 0 ? (
              <span className="tabular text-[12px] text-ink-faint">
                {usos.filter((u) => u.ratio >= 1).length > 0
                  ? `${usos.filter((u) => u.ratio >= 1).length} excedida${usos.filter((u) => u.ratio >= 1).length > 1 ? 's' : ''}`
                  : 'Al día'}
              </span>
            ) : undefined
          }
        >
          Presupuestos
        </SectionTitle>

        {usos.length === 0 ? (
          <Card>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Todavía no definiste límites por categoría. Andá a Presupuestos para armar el primero.
            </p>
          </Card>
        ) : (
          <Card className="space-y-3.5">
            {usos.map(({ categoria, gastado, ratio }) => (
              <div key={categoria.id}>
                <div className="mb-1.5 flex items-center gap-2.5">
                  <IconChip icon={iconoDe(categoria.icono)} color={categoria.color} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">
                    {categoria.nombre}
                  </span>
                  <span className="tabular shrink-0 text-[12.5px] text-ink-faint">
                    {money(gastado)} / {money(categoria.limite)}
                  </span>
                </div>
                <Progress value={ratio} autoTone />
              </div>
            ))}
          </Card>
        )}

        <SectionTitle
          action={
            <button
              type="button"
              onClick={onVerTodo}
              className="text-[12.5px] text-ink-muted transition-colors hover:text-ink"
            >
              Ver todos
            </button>
          }
        >
          Últimos movimientos
        </SectionTitle>

        <Card className="py-1">
          {ultimos.length === 0 ? (
            <Empty
              icon={PencilLine}
              title="Sin movimientos todavía"
              hint="Tocá el + para cargar el primero, a mano o con la foto del ticket."
            />
          ) : (
            ultimos.map((m) => {
              const cat = db.categorias.find((c) => c.id === m.categoriaId)
              return (
                <Row
                  key={m.id}
                  leading={
                    <IconChip
                      icon={iconoDe(cat?.icono ?? 'otros')}
                      color={cat?.color ?? 'accent'}
                    />
                  }
                  title={m.descripcion}
                  subtitle={`${cat?.nombre ?? 'Sin categoría'} · ${fechaRelativa(m.fecha)}`}
                  trailing={
                    <span
                      className={cn(
                        'tabular text-[14.5px] font-semibold',
                        m.tipo === 'ingreso' ? 'text-pos' : 'text-ink',
                      )}
                    >
                      {moneySigned(m.tipo === 'ingreso' ? m.monto : -m.monto)}
                    </span>
                  }
                />
              )
            })
          )}
        </Card>

        <AdSlot />
      </Screen>

      <Fab
        acciones={[
          {
            id: 'ticket',
            label: 'Cargar ticket con foto',
            icon: Camera,
            onSelect: () => setSheet('ticket'),
          },
          {
            id: 'manual',
            label: 'Agregar manualmente',
            icon: PencilLine,
            onSelect: () => setSheet('manual'),
          },
        ]}
      />

      <MovimientoSheet
        open={sheet === 'manual'}
        onClose={() => setSheet('ninguno')}
        categorias={db.categorias}
        miembros={db.miembros}
      />
      <TicketSheet
        open={sheet === 'ticket'}
        onClose={() => setSheet('ninguno')}
        categorias={db.categorias}
        miembroId={db.miembros[0]?.id}
      />
    </>
  )
}

/** El día 1 del mes que viene: es cuando cae el próximo ingreso fijo. */
function proximoSueldo() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1, 1)
  return d.toISOString().slice(0, 10)
}

