'use client'

import { useState } from 'react'
import { Camera, Landmark, PackageSearch, PencilLine, Receipt, TrendingUp } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { BarChart } from '@/components/ui/BarChart'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Fab } from '@/components/ui/Fab'
import { Avatar, Badge, Empty, Row } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { VentaSheet } from '@/components/comercial/VentaSheet'
import { AbrirCajaSheet } from '@/components/comercial/AbrirCajaSheet'
import { useNav } from '@/components/nav'
import { rankingProductos, stockCritico, ticketPromedio, totalVentas, ventasDelDia, ventasPorHora } from '@/lib/calc'
import { hora, hoyISO, money, moneyCorto } from '@/lib/format'
import type { DB } from '@/lib/types'

export function ComercialResumen({ db, onVerTodo }: { db: DB; onVerTodo: () => void }) {
  const nav = useNav()
  const [sheet, setSheet] = useState<'ninguno' | 'venta' | 'caja'>('ninguno')

  const hoy = hoyISO()
  const ventasHoy = ventasDelDia(db.ventas, hoy)
  const totalHoy = totalVentas(ventasHoy)
  const { barras, pico } = ventasPorHora(db.ventas, hoy)
  const top = rankingProductos(ventasHoy, db.productos).slice(0, 4)
  const critico = stockCritico(db.productos)
  const ultimas = db.ventas.slice(0, 4)
  const negocio = db.perfil?.negocio || db.perfil?.nombre || 'tu negocio'

  // No descuenta gastos ni reposiciones: esas todavía no registran con qué
  // se pagaron, así que sólo se puede sumar lo que sí se sabe con certeza.
  const efectivoHoy = ventasHoy.filter((v) => v.metodo === 'efectivo').reduce((s, v) => s + v.total, 0)
  const cajaEstimada = (db.cajaHoy?.montoInicial ?? 0) + efectivoHoy

  return (
    <>
      <Screen pad="fab">
        <header className="mb-5 flex items-center gap-3 pt-2">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-faint">
              {new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
            <h1 className="truncate text-[21px] font-semibold tracking-[-0.025em] text-ink">{negocio}</h1>
          </div>
          <Avatar nombre={negocio} src={db.perfil?.logo} />
        </header>

        <Card className="p-5">
          <p className="text-[13px] font-medium text-ink-muted">Ventas de hoy</p>
          <p className="tabular mt-1 font-display text-[40px] font-bold leading-none tracking-[-0.035em] text-ink">
            {money(totalHoy)}
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-ink-muted">
                <Receipt className="size-4" strokeWidth={2.3} />
                <span className="text-[11.5px] font-semibold uppercase tracking-wide">Ventas</span>
              </div>
              <p className="tabular mt-1 text-[16px] font-semibold text-ink">{ventasHoy.length}</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <div className="flex items-center gap-1.5 text-ink-muted">
                <TrendingUp className="size-4" strokeWidth={2.3} />
                <span className="text-[11.5px] font-semibold uppercase tracking-wide">Ticket prom.</span>
              </div>
              <p className="tabular mt-1 text-[16px] font-semibold text-ink">{money(ticketPromedio(ventasHoy))}</p>
            </div>
          </div>
        </Card>

        <SectionTitle
          action={
            db.cajaHoy && (
              <button
                type="button"
                onClick={() => setSheet('caja')}
                className="text-[12.5px] text-ink-muted transition-colors hover:text-ink"
              >
                Corregir
              </button>
            )
          }
        >
          Caja
        </SectionTitle>
        {db.cajaHoy ? (
          <Card className="flex items-center gap-3">
            <IconChip icon={Landmark} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-ink-faint">
                Apertura {money(db.cajaHoy.montoInicial)} + {money(efectivoHoy)} en efectivo hoy
              </p>
              <p className="tabular mt-0.5 text-[19px] font-semibold text-ink">{money(cajaEstimada)}</p>
            </div>
          </Card>
        ) : (
          <Card
            interactive
            onClick={() => setSheet('caja')}
            className="flex items-center gap-3 border-accent-hi/40 bg-accent-dim/20"
          >
            <IconChip icon={Landmark} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">Todavía no abriste la caja hoy</p>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">Tocá para cargar con cuánto arrancás</p>
            </div>
            <Badge tone="accent">Abrir</Badge>
          </Card>
        )}

        <SectionTitle
          action={pico ? <span className="tabular text-[12px] text-ink-faint">Pico {pico.hora}hs</span> : undefined}
        >
          Ventas por hora
        </SectionTitle>
        <Card>
          <BarChart data={barras} format={moneyCorto} caption="Tocá una barra para ver el detalle de esa hora" />
        </Card>

        {critico.length > 0 && (
          <>
            <SectionTitle>Stock</SectionTitle>
            <Card
              interactive
              onClick={() => nav.push('tabs', { tab: 'stock' })}
              className="flex items-center gap-3 border-warn/40 bg-warn-dim/40"
            >
              <IconChip icon={PackageSearch} color="warn" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium text-ink">
                  {critico.length} producto{critico.length > 1 ? 's' : ''} para reponer
                </p>
                <p className="mt-0.5 truncate text-[12.5px] text-ink-faint">
                  {critico.slice(0, 3).map((p) => p.nombre).join(', ')}
                  {critico.length > 3 ? '…' : ''}
                </p>
              </div>
              <Badge tone="warn">Ver</Badge>
            </Card>
          </>
        )}

        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => nav.push('mas-vendidos')}
              className="text-[12.5px] text-ink-muted transition-colors hover:text-ink"
            >
              Ver todo
            </button>
          }
        >
          Más vendido hoy
        </SectionTitle>
        {top.length === 0 ? (
          <Card>
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              Todavía no cargaste ventas hoy. Registrá la primera con el botón +.
            </p>
          </Card>
        ) : (
          <Card className="py-1">
            {top.map((r) => (
              <Row
                key={r.productoId}
                leading={<IconChip icon={iconoRubro(r.producto?.categoria ?? '')} size="sm" />}
                title={r.nombre}
                subtitle={`${r.unidades} unidad${r.unidades > 1 ? 'es' : ''}`}
                trailing={<span className="tabular text-[14.5px] font-semibold text-ink">{money(r.facturado)}</span>}
              />
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
              Ver todas
            </button>
          }
        >
          Últimas ventas
        </SectionTitle>
        <Card className="py-1">
          {ultimas.length === 0 ? (
            <Empty
              icon={PencilLine}
              title="Sin ventas todavía"
              hint="Tocá el + para registrar la primera venta del día."
            />
          ) : (
            ultimas.map((v) => (
              <Row
                key={v.id}
                leading={<IconChip icon={Receipt} size="sm" />}
                title={v.items.map((i) => i.nombre).join(', ')}
                subtitle={hora(v.fecha)}
                trailing={<span className="tabular text-[14.5px] font-semibold text-ink">{money(v.total)}</span>}
              />
            ))
          )}
        </Card>
      </Screen>

      <Fab
        acciones={[
          {
            id: 'foto',
            label: 'Cargar factura por foto',
            icon: Camera,
            onSelect: () => nav.push('stock-foto'),
          },
          {
            id: 'manual',
            label: 'Registrar venta',
            icon: PencilLine,
            onSelect: () => setSheet('venta'),
          },
        ]}
      />

      <VentaSheet open={sheet === 'venta'} onClose={() => setSheet('ninguno')} productos={db.productos} />
      <AbrirCajaSheet
        open={sheet === 'caja'}
        onClose={() => setSheet('ninguno')}
        montoActual={db.cajaHoy?.montoInicial}
      />
    </>
  )
}
