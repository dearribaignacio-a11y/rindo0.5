'use client'

import { Camera, PackageCheck } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Progress } from '@/components/ui/Progress'
import { Empty } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { useNav } from '@/components/nav'
import { nivelStock } from '@/lib/calc'
import { cn } from '@/lib/cn'
import type { DB, Producto } from '@/lib/types'

export function ComercialStock({ db }: { db: DB }) {
  const nav = useNav()
  const productos = [...db.productos].sort((a, b) => nivelStock(a) - nivelStock(b))
  const criticos = productos.filter((p) => p.stock <= p.stockMin)
  const resto = productos.filter((p) => p.stock > p.stockMin)

  return (
    <Screen pad="tab">
      <header className="mb-4 flex items-center justify-between gap-3 pt-2">
        <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Stock</h1>
        <Button size="sm" variant="secondary" onClick={() => nav.push('stock-foto')}>
          <Camera className="size-[16px]" strokeWidth={1.9} />
          Factura
        </Button>
      </header>

      {productos.length === 0 ? (
        <Empty
          icon={PackageCheck}
          title="Sin productos todavía"
          hint="Cargá el catálogo desde la pestaña Productos para ver los niveles acá."
        />
      ) : (
        <>
          {criticos.length > 0 && (
            <>
              <SectionTitle>Para reponer</SectionTitle>
              <Card className="space-y-3.5">
                {criticos.map((p) => (
                  <FilaStock key={p.id} producto={p} />
                ))}
              </Card>
            </>
          )}

          <SectionTitle>Todo el catálogo</SectionTitle>
          <Card className="space-y-3.5">
            {resto.map((p) => (
              <FilaStock key={p.id} producto={p} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}

function FilaStock({ producto }: { producto: Producto }) {
  const nivel = nivelStock(producto)
  const critico = producto.stock <= producto.stockMin

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-2.5">
        <IconChip icon={iconoRubro(producto.categoria)} size="sm" color={critico ? 'warn' : 'accent'} />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{producto.nombre}</span>
        <span className={cn('tabular shrink-0 text-[12.5px]', critico ? 'text-warn' : 'text-ink-faint')}>
          {producto.stock} en stock
        </span>
      </div>
      <Progress value={nivel} tone={critico ? 'warn' : 'pos'} />
    </div>
  )
}
