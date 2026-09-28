'use client'

import { useMemo, useState } from 'react'
import { Package, Printer, Search } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Fab } from '@/components/ui/Fab'
import { Empty } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { ProductoSheet } from '@/components/comercial/ProductoSheet'
import { margen } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB, Producto } from '@/lib/types'

/** Agrupa el catálogo entero (sin filtrar por búsqueda) en categoría →
 *  subcategoría → productos, para la lista que se imprime — es la misma
 *  jerarquía que el comerciante armó al cargar cada producto. */
function agruparParaImprimir(productos: Producto[]) {
  const porCategoria = new Map<string, { sinSub: Producto[]; subs: Map<string, Producto[]> }>()
  for (const p of productos) {
    const cat = p.categoria || 'Sin categoría'
    if (!porCategoria.has(cat)) porCategoria.set(cat, { sinSub: [], subs: new Map() })
    const grupo = porCategoria.get(cat)!
    if (p.subcategoria) {
      if (!grupo.subs.has(p.subcategoria)) grupo.subs.set(p.subcategoria, [])
      grupo.subs.get(p.subcategoria)!.push(p)
    } else {
      grupo.sinSub.push(p)
    }
  }
  const porNombre = (a: Producto, b: Producto) => a.nombre.localeCompare(b.nombre)
  return [...porCategoria.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([categoria, { sinSub, subs }]) => ({
      categoria,
      sinSub: [...sinSub].sort(porNombre),
      subs: [...subs.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([subcategoria, items]) => ({ subcategoria, items: [...items].sort(porNombre) })),
    }))
}

export function ComercialProductos({ db }: { db: DB }) {
  const [busqueda, setBusqueda] = useState('')
  const [editando, setEditando] = useState<Producto | null>(null)
  const [creando, setCreando] = useState(false)

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    const base = q
      ? db.productos.filter(
          (p) => p.nombre.toLowerCase().includes(q) || p.codigo?.toLowerCase() === q,
        )
      : db.productos
    return [...base].sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [db.productos, busqueda])

  const agrupados = useMemo(() => agruparParaImprimir(db.productos), [db.productos])
  const negocio = db.perfil?.negocio || db.perfil?.nombre || 'Mi negocio'

  return (
    <>
      <Screen pad="fab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Productos</h1>
        </header>

        {db.productos.length > 0 && (
          <Button
            full
            size="lg"
            variant="secondary"
            className="mb-4"
            onClick={() => window.print()}
          >
            <Printer className="size-[18px]" strokeWidth={1.9} />
            Descargar / imprimir lista completa
          </Button>
        )}

        {db.productos.length > 0 && (
          <Input
            leading={<Search className="size-[17px]" strokeWidth={1.9} />}
            placeholder="Buscar por nombre o código…"
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
                    <p className="truncate text-[14.5px] font-medium text-ink">
                      {p.nombre}
                      {p.codigo && (
                        <span className="tabular ml-1.5 text-[11.5px] font-normal text-ink-faint">
                          #{p.codigo}
                        </span>
                      )}
                    </p>
                    <p className="tabular truncate text-[12.5px] text-ink-faint">
                      {p.categoria}
                      {p.subcategoria ? ` › ${p.subcategoria}` : ''} · stock {p.stock}
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

      <ProductoSheet open={creando} onClose={() => setCreando(false)} productos={db.productos} />
      <ProductoSheet
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        producto={editando}
        productos={db.productos}
      />

      {/* Oculta en pantalla, sólo se ve al imprimir (ver .hoja-imprimir en
          app/globals.css) — agrupada por categoría y subcategoría, como las
          armó el comerciante, no por orden alfabético plano. */}
      <div className="hoja-imprimir hidden bg-white text-black print:block">
        <h1 className="text-[20px] font-bold">{negocio}</h1>
        <p className="mt-1 text-[12px] text-neutral-600">
          Lista de productos · {new Date().toLocaleDateString('es-AR')}
        </p>
        {agrupados.map((grupo) => (
          <div key={grupo.categoria} className="mt-4 break-inside-avoid">
            <h2 className="border-b border-neutral-300 pb-1 text-[15px] font-semibold">
              {grupo.categoria}
            </h2>
            {grupo.sinSub.length > 0 && <TablaImprimir items={grupo.sinSub} />}
            {grupo.subs.map((sub) => (
              <div key={sub.subcategoria} className="mt-2">
                <h3 className="text-[13px] font-medium text-neutral-700">{sub.subcategoria}</h3>
                <TablaImprimir items={sub.items} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}

function TablaImprimir({ items }: { items: Producto[] }) {
  return (
    <table className="mt-1 w-full border-collapse text-[12px]">
      <tbody>
        {items.map((p) => (
          <tr key={p.id} className="border-b border-neutral-200">
            <td className="w-10 py-1 pr-2 text-neutral-500">{p.codigo ? `#${p.codigo}` : ''}</td>
            <td className="py-1 pr-2">{p.nombre}</td>
            <td className="w-24 py-1 pr-2 text-right">{money(p.precio)}</td>
            <td className="w-20 py-1 text-right text-neutral-600">stock {p.stock}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
