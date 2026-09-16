'use client'

import { Calculator, Sparkles } from 'lucide-react'
import { Screen, TopBar, SectionTitle } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Disclaimer, Empty } from '@/components/ui/Bits'
import { useNav } from '@/components/nav'
import { totalVentas, ventasDelMes } from '@/lib/calc'
import { money } from '@/lib/format'
import type { DB } from '@/lib/types'

export function ProImpuestos({ db }: { db: DB }) {
  const nav = useNav()
  const facturado = totalVentas(ventasDelMes(db.ventas))

  return (
    <Screen pad="tab">
      <TopBar title="Estimación de impuestos" onBack={nav.pop} />

      <Card className="p-5">
        <p className="text-[13px] font-medium text-ink-muted">Facturado este mes</p>
        <p className="tabular mt-1 font-display text-[32px] font-bold leading-none tracking-[-0.03em] text-ink">
          {money(facturado)}
        </p>
      </Card>

      <SectionTitle>Vencimientos cargados</SectionTitle>
      {db.impuestos.length === 0 ? (
        <Empty icon={Calculator} title="Sin impuestos cargados" hint="Agregalos desde Ajustes → Impuestos." />
      ) : (
        <Card className="py-1">
          {db.impuestos.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b border-line py-2.5 last:border-0">
              <span className="text-[14px] text-ink">{i.nombre}</span>
              <span className="tabular text-[14px] font-semibold text-ink">{money(i.monto)}</span>
            </div>
          ))}
        </Card>
      )}

      <div className="mt-6 flex flex-col items-center gap-3 rounded-card border border-line bg-surface-2/60 p-5 text-center">
        <Sparkles className="size-6 text-accent-hi" strokeWidth={1.6} />
        <p className="text-[14px] font-medium text-ink">La estimación asistida por IA llega en la próxima etapa</p>
        <p className="max-w-[32ch] text-[12.5px] leading-relaxed text-ink-faint">
          Junto con la lectura real de tickets y facturas, vamos a sumar acá una proyección de
          Monotributo / Ingresos Brutos a partir de lo que factura tu negocio. Por ahora podés cargar y
          seguir los vencimientos a mano en Impuestos.
        </p>
        <Button variant="secondary" size="sm" onClick={() => nav.push('impuestos')}>
          Ir a Impuestos
        </Button>
      </div>

      <Disclaimer>
        Esto no reemplaza el asesoramiento de un contador ni constituye asesoramiento impositivo.
      </Disclaimer>
    </Screen>
  )
}
