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
import { asignarCodigo } from '@/lib/codigos'
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
  const [subcategoria, setSubcategoria] = useState('')
  const [codigo, setCodigo] = useState('')
  const [costo, setCosto] = useState<number | null>(null)
  const [precio, setPrecio] = useState<number | null>(null)
  const [stock, setStock] = useState<number | null>(null)
  const [stockMin, setStockMin] = useState<number | null>(null)
  const [error, setError] = useState<string>()

  // Categorías y, dentro de la elegida, subcategorías: se sugieren a partir
  // de lo que ya se usó en el resto del catálogo, no hay una lista fija de
  // Rindo — cada comerciante arma la suya con lo que va cargando.
  const categoriasUsadas = [...new Set(productos.map((p) => p.categoria).filter(Boolean))].sort()
  const subcategoriasDeLaCategoria = [
    ...new Set(
      productos
        .filter((p) => p.categoria.trim().toLowerCase() === categoria.trim().toLowerCase())
        .map((p) => p.subcategoria)
        .filter((s): s is string => Boolean(s)),
    ),
  ].sort()

  useEffect(() => {
    if (!open) return
    setError(undefined)
    if (producto) {
      setNombre(producto.nombre)
      setCategoria(producto.categoria)
      setSubcategoria(producto.subcategoria ?? '')
      // Los productos cargados antes de este código no tenían uno: se les
      // asigna recién acá, la primera vez que se vuelven a abrir para editar.
      setCodigo(producto.codigo ?? asignarCodigo(productos))
      setCosto(producto.costo)
      setPrecio(producto.precio)
      setStock(producto.stock)
      setStockMin(producto.stockMin)
    } else {
      setNombre('')
      setCategoria('')
      setSubcategoria('')
      // Automático: nadie tiene que pensar un código al cargar un producto.
      setCodigo(asignarCodigo(productos))
      setCosto(null)
      setPrecio(null)
      setStock(null)
      setStockMin(5)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      subcategoria: subcategoria.trim() || undefined,
      codigo,
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
          <div className="flex items-start gap-3">
            <Input
              label="Nombre"
              placeholder="Ej. Yerba 1kg"
              value={nombre}
              onChange={(e) => {
                setNombre(e.target.value)
                // Un error de nombre repetido que no se va al corregirlo es
                // peor que no mostrarlo: se limpia en cuanto el usuario escribe.
                if (error) setError(undefined)
              }}
              error={error}
              className="flex-1"
            />
            <Field label="Código" hint="Automático">
              <div className="tabular flex h-12 w-[70px] items-center justify-center rounded-input border border-line-strong bg-surface-2 text-[15px] font-semibold text-ink-muted">
                #{codigo}
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Categoría"
              placeholder="Ej. Almacén"
              list="categorias-existentes"
              value={categoria}
              onChange={(e) => {
                setCategoria(e.target.value)
                // Cambiar de categoría grande vacía la subcategoría: la que
                // tenía cargada era de la categoría anterior, no de ésta.
                setSubcategoria('')
              }}
            />
            <Input
              label="Subcategoría"
              placeholder="Ej. Bebidas blancas"
              list="subcategorias-de-la-categoria"
              value={subcategoria}
              onChange={(e) => setSubcategoria(e.target.value)}
              disabled={!categoria.trim()}
              hint={!categoria.trim() ? 'Elegí primero una categoría' : undefined}
            />
            <datalist id="categorias-existentes">
              {categoriasUsadas.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
            <datalist id="subcategorias-de-la-categoria">
              {subcategoriasDeLaCategoria.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>
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
