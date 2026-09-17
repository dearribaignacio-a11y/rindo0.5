'use client'

import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { addProducto, removeProducto, updateProducto } from '@/lib/storage'
import { money, pct1 } from '@/lib/format'
import { margen } from '@/lib/calc'
import type { Producto } from '@/lib/types'

export function ProductoSheet({
  open,
  onClose,
  producto,
  productos = [],
}: {
  open: boolean
  onClose: () => void
  producto?: Producto | null
  /** Catálogo completo, para no dejar dos productos con el mismo nombre. */
  productos?: Producto[]
}) {
  const toast = useToast()
  const editando = Boolean(producto)
  const [confirmando, setConfirmando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [categoria, setCategoria] = useState('')
  const [costo, setCosto] = useState<number | null>(null)
  const [precio, setPrecio] = useState<number | null>(null)
  const [stock, setStock] = useState<number | null>(null)
  const [stockMin, setStockMin] = useState<number | null>(null)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setError(undefined)
    if (producto) {
      setNombre(producto.nombre)
      setCategoria(producto.categoria)
      setCosto(producto.costo)
      setPrecio(producto.precio)
      setStock(producto.stock)
      setStockMin(producto.stockMin)
    } else {
      setNombre('')
      setCategoria('')
      setCosto(null)
      setPrecio(null)
      setStock(null)
      setStockMin(5)
    }
  }, [open, producto])

  const margenPreview = costo && precio && precio > 0 ? margen({ costo, precio } as Producto) : null
  /** Vender por debajo del costo es legítimo (liquidación), pero no puede
   *  pasar por descuido: se avisa sin bloquear el guardado. */
  const pierdePlata = costo !== null && precio !== null && precio > 0 && precio < costo

  async function guardar() {
    const limpio = nombre.trim()
    if (!limpio) return setError('Ponele un nombre al producto')
    if (precio === null || precio <= 0) return setError('El precio de venta tiene que ser mayor a cero')

    // Dos productos con el mismo nombre rompen al asistente, que los resuelve
    // justamente por nombre, y confunden la lista de stock.
    const repetido = productos.some(
      (x) => x.id !== producto?.id && x.nombre.trim().toLowerCase() === limpio.toLowerCase(),
    )
    if (repetido) return setError('Ya tenés un producto con ese nombre')

    const datos = {
      nombre: limpio,
      categoria: categoria.trim() || 'Sin categoría',
      costo: costo ?? 0,
      precio,
      stock: stock ?? 0,
      stockMin: stockMin ?? 5,
    }

    try {
      if (producto) {
        await updateProducto(producto.id, datos)
        toast('Producto actualizado')
      } else {
        await addProducto(datos)
        toast('Producto agregado')
      }
      onClose()
    } catch {
      toast('No pudimos guardar el producto. Probá de nuevo.', { tono: 'aviso' })
    }
  }

  async function eliminar() {
    if (!producto) return
    try {
      await removeProducto(producto.id)
      onClose()
      toast('Producto eliminado', { tono: 'aviso' })
    } catch {
      toast('No pudimos eliminar el producto. Probá de nuevo.', { tono: 'aviso' })
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editando ? 'Editar producto' : 'Nuevo producto'}
        footer={
          <div className="flex gap-2.5">
            {editando && (
              <Button
                variant="danger"
                size="lg"
                onClick={() => setConfirmando(true)}
                aria-label="Eliminar producto"
              >
                <Trash2 className="size-[18px]" strokeWidth={1.9} />
              </Button>
            )}
            <Button full size="lg" onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Agregar producto'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          <Input
            label="Nombre"
            placeholder="Ej. Yerba 1kg"
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value)
              // Un error de nombre repetido que no se va al corregirlo es peor
              // que no mostrarlo: se limpia en cuanto el usuario escribe.
              if (error) setError(undefined)
            }}
            error={error}
          />
          <Input
            label="Categoría"
            placeholder="Ej. Almacén"
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <MoneyInput label="Costo" value={costo} onChange={setCosto} />
            <MoneyInput label="Precio de venta" value={precio} onChange={setPrecio} />
          </div>
          {margenPreview !== null && !pierdePlata && (
            <p className="text-[12.5px] text-ink-faint">
              Margen: <span className="font-medium text-ink">{pct1(margenPreview)}</span>
              {costo && precio ? ` · ganás ${money(precio - costo)} por unidad` : ''}
            </p>
          )}
          {pierdePlata && (
            <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
              El precio está por debajo del costo: perdés {money(costo! - precio!)} por unidad.
              Podés guardarlo igual si es una liquidación.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock actual">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={stock ?? ''}
                onChange={(e) => setStock(e.target.value === '' ? null : Number(e.target.value))}
                className="h-12 w-full rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
              />
            </Field>
            <Field label="Stock mínimo" hint="Aviso de reponer por debajo de esto">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={stockMin ?? ''}
                onChange={(e) => setStockMin(e.target.value === '' ? null : Number(e.target.value))}
                className="h-12 w-full rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
              />
            </Field>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={eliminar}
        title="¿Eliminar este producto?"
        description={producto ? `Se va a borrar “${producto.nombre}” del catálogo.` : undefined}
      />
    </>
  )
}
