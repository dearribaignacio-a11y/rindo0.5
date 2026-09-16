'use client'

import { useMemo, useState } from 'react'
import { Search, ShoppingBag } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, Stepper } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Empty } from '@/components/ui/Bits'
import { IconChip, iconoRubro } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { addVenta } from '@/lib/storage'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { MetodoPago, Producto } from '@/lib/types'

/**
 * Alta de una venta manual. El carrito vive en un mapa productoId → cantidad
 * mientras la hoja está abierta: nada se toca en `storage` hasta confirmar.
 */
export function VentaSheet({
  open,
  onClose,
  productos,
}: {
  open: boolean
  onClose: () => void
  productos: Producto[]
}) {
  const toast = useToast()
  const [busqueda, setBusqueda] = useState('')
  const [carrito, setCarrito] = useState<Record<string, number>>({})
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return productos
    return productos.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [productos, busqueda])

  const items = Object.entries(carrito)
    .filter(([, cant]) => cant > 0)
    .map(([pid, cantidad]) => {
      const producto = productos.find((p) => p.id === pid)
      return producto ? { producto, cantidad } : null
    })
    .filter((x): x is { producto: Producto; cantidad: number } => Boolean(x))

  const total = items.reduce((s, i) => s + i.producto.precio * i.cantidad, 0)

  function resetear() {
    setBusqueda('')
    setCarrito({})
    setMetodo('efectivo')
  }

  function confirmar() {
    if (items.length === 0) return toast('Agregá al menos un producto', 'aviso')
    addVenta({
      fecha: new Date().toISOString(),
      items: items.map((i) => ({
        productoId: i.producto.id,
        nombre: i.producto.nombre,
        cantidad: i.cantidad,
        precio: i.producto.precio,
      })),
      total,
      metodo,
    })
    toast('Venta registrada')
    resetear()
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        resetear()
        onClose()
      }}
      title="Registrar venta"
      subtitle={items.length > 0 ? `${items.length} producto${items.length > 1 ? 's' : ''} · ${money(total)}` : undefined}
      footer={
        <Button full size="lg" disabled={items.length === 0} confirm confirmLabel="Registrada" onConfirmed={confirmar}>
          Confirmar venta {items.length > 0 ? `· ${money(total)}` : ''}
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Input
          leading={<Search className="size-[17px]" strokeWidth={1.9} />}
          placeholder="Buscar producto…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />

        {productos.length === 0 ? (
          <Empty
            icon={ShoppingBag}
            title="Todavía no cargaste productos"
            hint="Andá a Productos para dar de alta el catálogo antes de vender."
          />
        ) : (
          <div className="space-y-1.5">
            {filtrados.map((p) => {
              const cantidad = carrito[p.id] ?? 0
              return (
                <div
                  key={p.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
                    cantidad > 0 ? 'border-accent-hi/45 bg-accent-dim/25' : 'border-line bg-surface-2',
                  )}
                >
                  <IconChip icon={iconoRubro(p.categoria)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{p.nombre}</p>
                    <p className="tabular truncate text-[12px] text-ink-faint">
                      {money(p.precio)} · stock {p.stock}
                    </p>
                  </div>
                  <Stepper
                    size="sm"
                    value={cantidad}
                    max={Math.max(p.stock, cantidad)}
                    onChange={(v) => setCarrito((c) => ({ ...c, [p.id]: v }))}
                  />
                </div>
              )
            })}
          </div>
        )}

        <Field label="Método de pago">
          <Segmented
            layoutId="metodo-venta"
            value={metodo}
            onChange={setMetodo}
            opciones={[
              { id: 'efectivo', label: 'Efectivo' },
              { id: 'tarjeta', label: 'Tarjeta' },
              { id: 'transferencia', label: 'Transf.' },
            ]}
          />
        </Field>
      </div>
    </Sheet>
  )
}
