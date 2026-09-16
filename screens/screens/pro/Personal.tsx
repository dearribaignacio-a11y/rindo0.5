'use client'

import { Users } from 'lucide-react'
import { Screen, TopBar, SectionTitle } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Empty, Avatar } from '@/components/ui/Bits'
import { useNav } from '@/components/nav'
import { CARGAS_SOCIALES, costoEmpleado, totalVentas, ventasDelMes } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import type { DB } from '@/lib/types'

export function ProPersonal({ db }: { db: DB }) {
  const nav = useNav()
  const activos = db.empleados.filter((e) => e.activo)
  const costoTotal = activos.reduce((s, e) => s + costoEmpleado(e), 0)
  const facturado = totalVentas(ventasDelMes(db.ventas))
  const ratio = facturado > 0 ? costoTotal / facturado : 0

  return (
    <Screen pad="tab">
      <TopBar title="Costos de personal" onBack={nav.pop} />

      {activos.length === 0 ? (
        <Empty
          icon={Users}
          title="Sin empleados activos"
          hint="Cargalos desde Ajustes → Empleados para ver el análisis acá."
        />
      ) : (
        <>
          <Card className="p-5">
            <p className="text-[13px] font-medium text-ink-muted">Personal sobre lo facturado este mes</p>
            <p className="tabular mt-1 font-display text-[36px] font-bold leading-none tracking-[-0.03em] text-ink">
              {facturado > 0 ? pct(ratio) : '—'}
            </p>
            {facturado > 0 && <Progress className="mt-4" value={ratio} tone={ratio > 0.35 ? 'warn' : 'pos'} />}
            <p className="mt-3 text-[12.5px] text-ink-faint">
              Costo total de personal (sueldos + {pct(CARGAS_SOCIALES)} de cargas sociales):{' '}
              <span className="font-medium text-ink">{money(costoTotal)}</span> por mes.
            </p>
          </Card>

          <SectionTitle>Por empleado</SectionTitle>
          <Card className="py-1">
            {activos.map((e) => (
              <div key={e.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                <Avatar nombre={e.nombre} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-ink">{e.nombre}</p>
                  <p className="truncate text-[12px] text-ink-faint">{e.puesto} · sueldo {money(e.sueldo)}</p>
                </div>
                <span className="tabular shrink-0 text-[14px] font-semibold text-ink">{money(costoEmpleado(e))}</span>
              </div>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}
