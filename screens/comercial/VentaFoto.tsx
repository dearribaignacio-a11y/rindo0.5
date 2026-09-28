'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Images, Loader2, NotebookPen, Trash2 } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Field, MoneyInput, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addVenta } from '@/lib/storage'
import { ahoraISO, money } from '@/lib/format'
import { leerComprobante } from '@/lib/vision'
import { comprimirImagen } from '@/lib/imagen'
import { buscarPorCodigo } from '@/lib/codigos'
import { cn } from '@/lib/cn'
import type { DB, MetodoPago } from '@/lib/types'

type Etapa = 'captura' | 'leyendo' | 'confirmar'

interface ItemVentaFoto {
  productoId: string | null
  /** Lo que se leyó en la foto, tal cual — se muestra como pista si no se
   *  pudo resolver contra el catálogo solo. */
  nombreDetectado: string
  cantidad: number
  precio: number
  confiable: boolean
}

/**
 * Carga de ventas a partir de la foto de una nota escrita a mano (un
 * cuaderno donde el comerciante anota lo que va vendiendo). A diferencia de
 * `StockFoto` (que da de alta productos nuevos solos), acá cada renglón
 * tiene que quedar atado a un producto real del catálogo — no se puede
 * vender algo que no existe — así que la revisión pide elegir el producto
 * cuando la lectura no matchea un nombre exacto del catálogo.
 */
export function VentaFoto({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('captura')
  const [foto, setFoto] = useState<string>()
  const [items, setItems] = useState<ItemVentaFoto[]>([])
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [simulado, setSimulado] = useState(false)
  const [errorLectura, setErrorLectura] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function procesar(file?: File) {
    if (!file) return
    const dataUrl = await comprimirImagen(file)
    setFoto(dataUrl)
    setEtapa('leyendo')

    const res = await leerComprobante(dataUrl, 'venta')
    setSimulado(res.fuente === 'simulado')
    setErrorLectura(res.error)

    setItems(
      res.datos.items.map((i) => {
        // Algunos anotan el código corto del producto en vez del nombre
        // ("3" en vez de "Yerba") — se prueba primero por nombre exacto y,
        // si no matchea, por código.
        const porNombre = db.productos.find((p) => p.nombre.toLowerCase() === i.nombre.toLowerCase())
        const match = porNombre ?? buscarPorCodigo(db.productos, i.nombre)
        return {
          productoId: match?.id ?? null,
          nombreDetectado: i.nombre,
          cantidad: i.cantidad,
          precio: match?.precio ?? i.costo,
          confiable: i.confiable && Boolean(match),
        }
      }),
    )
    setEtapa('confirmar')
  }

  function actualizarItem(i: number, patch: Partial<ItemVentaFoto>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function elegirProducto(i: number, productoId: string) {
    const producto = db.productos.find((p) => p.id === productoId)
    actualizarItem(i, { productoId: producto?.id ?? null, precio: producto?.precio ?? items[i].precio })
  }

  function quitarItem(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i))
  }

  const resueltos = items.filter((i) => i.productoId)
  const totalResueltos = resueltos.reduce((s, i) => s + i.precio * i.cantidad, 0)

  async function guardar() {
    if (resueltos.length === 0) return toast('Asigná el producto a al menos un renglón', 'aviso')
    setGuardando(true)
    try {
      // Secuencial y no en paralelo: dos renglones pueden vender el mismo
      // producto, y el descuento de stock de cada uno depende del anterior.
      for (const item of resueltos) {
        const producto = db.productos.find((p) => p.id === item.productoId)
        if (!producto) continue
        await addVenta({
          fecha: ahoraISO(),
          items: [{ productoId: producto.id, nombre: producto.nombre, cantidad: item.cantidad, precio: item.precio }],
          total: item.precio * item.cantidad,
          metodo,
        })
      }
      toast(resueltos.length === 1 ? 'Venta registrada' : `${resueltos.length} ventas registradas`)
      nav.pop()
    } catch {
      toast('No pudimos registrar las ventas. Probá de nuevo.', { tono: 'aviso' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Screen pad="none">
      <TopBar
        title="Cargar venta por foto"
        subtitle={etapa === 'confirmar' ? 'Revisá y asigná el producto de cada renglón' : undefined}
        onBack={nav.pop}
      />

      {etapa === 'captura' && (
        <div className="pb-4">
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-card border border-line bg-bg-sunken">
            <div className="absolute inset-6 rounded-xl border-2 border-dashed border-line-strong" />
            <div className="relative flex flex-col items-center gap-2 text-center">
              <NotebookPen className="size-9 text-ink-faint" strokeWidth={1.5} />
              <p className="max-w-[26ch] text-[13px] leading-relaxed text-ink-faint">
                Encuadrá la hoja o el cuaderno donde anotaste las ventas, con buena luz.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-[1fr_auto] gap-2.5">
            <Button full size="lg" onClick={() => inputCamara.current?.click()}>
              <Camera className="size-[18px]" strokeWidth={1.9} />
              Sacar foto
            </Button>
            <Button size="lg" variant="secondary" onClick={() => inputGaleria.current?.click()}>
              <Images className="size-[18px]" strokeWidth={1.9} />
              Galería
            </Button>
          </div>

          <input ref={inputCamara} type="file" accept="image/*" capture="environment" hidden onChange={(e) => procesar(e.target.files?.[0])} />
          <input ref={inputGaleria} type="file" accept="image/*" hidden onChange={(e) => procesar(e.target.files?.[0])} />
        </div>
      )}

      {etapa === 'leyendo' && (
        <div className="flex flex-col items-center gap-3 py-14">
          <Loader2 className="size-7 animate-spin text-accent-hi" />
          <p className="text-[14px] font-medium text-ink">Leyendo la nota…</p>
          <p className="text-[13px] text-ink-faint">Un segundo, estamos descifrando la letra.</p>
        </div>
      )}

      {etapa === 'confirmar' && (
        <div className="space-y-4 pb-8">
          {foto && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto} alt="Nota de ventas" className="h-24 w-full rounded-xl border border-line object-cover" />
          )}

          {errorLectura ? (
            <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
              {errorLectura}
            </p>
          ) : (
            simulado && (
              <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
                Esto es un ejemplo: todavía no leyó tu foto de verdad porque falta configurar la
                lectura por IA en el servidor. Mientras tanto, corregí los renglones a mano acá abajo.
              </p>
            )
          )}

          {items.length === 0 ? (
            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              No detectamos ningún renglón. Volvé y probá con otra foto, o cargá la venta a mano.
            </p>
          ) : (
            <div className="space-y-2.5">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'space-y-2 rounded-xl border p-3',
                    item.productoId ? 'border-line bg-surface-2' : 'border-warn/45 bg-warn-dim',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[12px] text-ink-faint">
                      Decía: &ldquo;{item.nombreDetectado}&rdquo;
                    </p>
                    <button
                      type="button"
                      aria-label="Quitar renglón"
                      onClick={() => quitarItem(i)}
                      className="shrink-0 text-ink-faint transition-colors hover:text-neg"
                    >
                      <Trash2 className="size-4" strokeWidth={1.9} />
                    </button>
                  </div>

                  <Select
                    aria-label="Producto"
                    placeholder="Elegí el producto…"
                    opciones={db.productos.map((p) => ({ value: p.id, label: p.nombre }))}
                    value={item.productoId ?? ''}
                    onChange={(e) => elegirProducto(i, e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Cantidad">
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                        className="h-10 w-full rounded-input border border-line-strong bg-surface px-3 text-[14px] text-ink focus:border-accent-hi focus:outline-none"
                      />
                    </Field>
                    <MoneyInput label="Precio" value={item.precio} onChange={(v) => actualizarItem(i, { precio: v ?? 0 })} />
                  </div>
                </div>
              ))}

              {items.some((i) => !i.productoId) && (
                <p className="text-[12px] text-warn">
                  Los renglones en amarillo necesitan que elijas el producto antes de confirmar.
                </p>
              )}
            </div>
          )}

          <Field label="Método de pago">
            <Segmented
              layoutId="metodo-venta-foto"
              value={metodo}
              onChange={setMetodo}
              opciones={[
                { id: 'efectivo', label: 'Efectivo' },
                { id: 'tarjeta', label: 'Tarjeta' },
                { id: 'transferencia', label: 'Transf.' },
              ]}
            />
          </Field>

          <motion.div initial={false}>
            <Button
              full
              size="lg"
              loading={guardando}
              disabled={resueltos.length === 0}
              confirm
              confirmLabel="Registradas"
              onConfirmed={guardar}
            >
              Confirmar {resueltos.length > 0 ? `· ${money(totalResueltos)}` : ''}
            </Button>
          </motion.div>
        </div>
      )}
    </Screen>
  )
}
