'use client'

import { useMemo, useState } from 'react'
import { Package, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Fab } from '@/components/ui/Fab'
import { Empty } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { ProductoSheet } from '@/components/comercial/ProductoSheet'
import { margen } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB, Producto } from '@/lib/types'

export function ComercialProductos({ db }: { db: DB }) {
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = q ? db.productos.filter((p) => p.nombre.toLowerCase().includes(q)) : db.productos
    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [db.productos, busqueda])

  return (
    <>
      <Screen pad="fab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Productos</h1>
        </header>

        {db.productos.length > 0 && (
          <Input
            leading={<Search className="size-[17px]" strokeWidth={1.9} />}
            placeholder="Buscar producto…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="mb-4"
          />
        )}

        {db.productos.length === 0 ? (
          <Empty
            icon={Package}
            title="Sin productos cargados"
            hint="Agregalos a mano con el + o cargá una factura de tu proveedor y se dan de alta solos."
          />
        ) : (
          <Card className="py-1">
            {filtrados.map((p) => {
              const m = margen(p)
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setEditando(p)}
                  className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0"
                >
                  <IconChip icon={iconoRubro(p.categoria)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-medium text-ink">{p.nombre}</p>
                    <p className="tabular truncate text-[12.5px] text-ink-faint">
                      {p.categoria} · stock {p.stock}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[14.5px] font-semibold text-ink">{money(p.precio)}</p>
                    <p className={cn('tabular text-[11.5px]', m >= 0.3 ? 'text-pos' : 'text-warn')}>
                      {pct(m)} margen
                    </p>
                  </div>
                </button>
              )
            })}
          </Card>
        )}
      </Screen>

      <Fab label="Agregar producto" onClick={() => setCreando(true)} />

      <ProductoSheet open={creando} onClose={() => setCreando(false)} />
      <ProductoSheet open={Boolean(editando)} onClose={() => setEditando(null)} producto={editando} />
    </>
  )
}
