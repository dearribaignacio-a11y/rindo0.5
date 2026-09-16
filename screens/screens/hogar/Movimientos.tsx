'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Search, SearchX } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Chip, ChipRow } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Input'
import { Screen } from '@/components/ui/Screen'
import { Fab } from '@/components/ui/Fab'
import { Empty, Row } from '@/components/ui/Bits'
import { IconChip, iconoDe } from '@/components/ui/Icon'
import { MovimientoSheet } from '@/components/hogar/MovimientoSheet'
import { agruparPorFecha } from '@/lib/calc'
import { claveMes, fechaRelativa, mesLargo, money, moneySigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB, Movimiento, TipoMovimiento } from '@/lib/types'

type Filtro = 'todos' | TipoMovimiento

export function HogarMovimientos({ db }: { db: DB }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [catId, setCatId] = useState<string | null>(null)
  const [offsetMes, setOffsetMes] = useState(0)
  const [editando, setEditando] = useState<Movimiento | null>(null)
  const [creando, setCreando] = useState(false)

  const mesRef = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - offsetMes, 1)
    return d
  }, [offsetMes])
  const mes = claveMes(mesRef.toISOString())

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return db.movimientos.filter((m) => {
      if (claveMes(m.fecha) !== mes) return false
      if (filtro !== 'todos' && m.tipo !== filtro) return false
      if (catId && m.categoriaId !== catId) return false
      if (q && !m.descripcion.toLowerCase().includes(q)) return false
      return true
    })
  }, [db.movimientos, mes, filtro, catId, busqueda])

  const totales = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const m of filtrados) {
      if (m.tipo === 'ingreso') ingresos += m.monto
      else gastos += m.monto
    }
    return { ingresos, gastos, neto: ingresos - gastos }
  }, [filtrados])

  const grupos = useMemo(() => agruparPorFecha(filtrados), [filtrados])

  return (
    <>
      <Screen pad="fab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Movimientos</h1>
        </header>

        <Input
          placeholder="Buscar por descripción"
          leading={<Search className="size-[18px]" strokeWidth={1.9} />}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {/* Selector de período. El mes actual no permite avanzar. */}
        <div className="mt-3 flex items-center justify-between rounded-input border border-line bg-surface px-1.5 py-1.5">
          <button
            type="button"
            aria-label="Mes anterior"
            onClick={() => setOffsetMes((o) => o + 1)}
            className="grid size-9 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
          >
            <ChevronLeft className="size-[18px]" />
          </button>
          <span className="text-[14px] font-medium capitalize text-ink">{mesLargo(mesRef)}</span>
          <button
            type="button"
            aria-label="Mes siguiente"
            disabled={offsetMes === 0}
            onClick={() => setOffsetMes((o) => Math.max(0, o - 1))}
            className="grid size-9 place-items-center rounded-[10px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <ChevronRight className="size-[18px]" />
          </button>
        </div>

        <div className="mt-3">
          <ChipRow>
            <Chip active={filtro === 'todos'} onClick={() => setFiltro('todos')}>
              Todos
            </Chip>
            <Chip active={filtro === 'ingreso'} onClick={() => setFiltro('ingreso')}>
              Ingresos
            </Chip>
            <Chip active={filtro === 'gasto'} onClick={() => setFiltro('gasto')}>
              Gastos
            </Chip>
            <span className="my-1 w-px shrink-0 bg-line" />
            <Chip active={catId === null} onClick={() => setCatId(null)}>
              Todas
            </Chip>
            {db.categorias.map((c) => (
              <Chip key={c.id} active={catId === c.id} onClick={() => setCatId(c.id)}>
                {c.nombre}
              </Chip>
            ))}
          </ChipRow>
        </div>

        {/* Resumen del período filtrado. */}
        <Card className="mt-3 flex items-center justify-between gap-2 py-3">
          <Total etiqueta="Ingresos" valor={money(totales.ingresos)} tono="pos" />
          <span className="h-8 w-px bg-line" />
          <Total etiqueta="Gastos" valor={money(totales.gastos)} tono="neg" />
          <span className="h-8 w-px bg-line" />
          <Total
            etiqueta="Neto"
            valor={money(totales.neto)}
            tono={totales.neto >= 0 ? 'pos' : 'neg'}
          />
        </Card>

        {grupos.length === 0 ? (
          <Empty
            icon={SearchX}
            title="No hay movimientos"
            hint="Probá cambiando el mes, los filtros o la búsqueda."
          />
        ) : (
          <div className="mt-5 space-y-5">
            {grupos.map(([dia, items]) => (
              <section key={dia}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 px-1">
                  <h2 className="text-[13px] font-semibold text-ink-muted">{fechaRelativa(dia)}</h2>
                  <span className="tabular text-[12px] text-ink-faint">
                    {money(
                      items.reduce((s, m) => s + (m.tipo === 'ingreso' ? m.monto : -m.monto), 0),
                    )}
                  </span>
                </div>

                <Card className="py-1">
                  {items.map((m) => {
                    const cat = db.categorias.find((c) => c.id === m.categoriaId)
                    const autor = db.miembros.find((x) => x.id === m.autorId)
                    return (
                      <Row
                        key={m.id}
                        onClick={() => setEditando(m)}
                        leading={
                          <IconChip
                            icon={iconoDe(cat?.icono ?? 'otros')}
                            color={cat?.color ?? 'accent'}
                          />
                        }
                        title={m.descripcion}
                        subtitle={[cat?.nombre, autor && db.miembros.length > 1 ? autor.nombre : null]
                          .filter(Boolean)
                          .join(' · ')}
                        trailing={
                          <span
                            className={cn(
                              'tabular text-[14.5px] font-semibold',
                              m.tipo === 'ingreso' ? 'text-pos' : 'text-neg',
                            )}
                          >
                            {moneySigned(m.tipo === 'ingreso' ? m.monto : -m.monto)}
                          </span>
                        }
                      />
                    )
                  })}
                </Card>
              </section>
            ))}
          </div>
        )}
      </Screen>

      <Fab onClick={() => setCreando(true)} label="Agregar movimiento" />

      <MovimientoSheet
        open={creando}
        onClose={() => setCreando(false)}
        categorias={db.categorias}
        miembros={db.miembros}
      />
      <MovimientoSheet
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        movimiento={editando}
        categorias={db.categorias}
        miembros={db.miembros}
      />
    </>
  )
}

function Total({
  etiqueta,
  valor,
  tono,
}: {
  etiqueta: string
  valor: string
  tono: 'pos' | 'neg'
}) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{etiqueta}</p>
      <p
        className={cn(
          'tabular mt-0.5 truncate text-[15px] font-semibold',
          tono === 'pos' ? 'text-pos' : 'text-neg',
        )}
      >
        {valor}
      </p>
    </div>
  )
}

