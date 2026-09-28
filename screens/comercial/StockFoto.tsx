'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Images, Loader2, Plus, RotateCcw, ScanLine, X } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addReposicion } from '@/lib/storage'
import { ahoraISO, money } from '@/lib/format'
import { leerComprobante, type ItemDetectado } from '@/lib/vision'
import { comprimirFoto } from '@/lib/imagen'
import { cn } from '@/lib/cn'
import type { DB } from '@/lib/types'

type Etapa = 'captura' | 'leyendo' | 'confirmar'

const NUEVO = '__nuevo__'

/**
 * Carga de stock a partir de la foto de una factura o remito de proveedor.
 * Mismo flujo en dos etapas que el ticket del hogar: capturar y confirmar.
 *
 * Cada renglón leído se asocia a un producto del catálogo (lo propone la IA,
 * que recibe el catálogo junto con la foto) o queda como producto nuevo. Antes
 * sólo se asociaba si el nombre de la factura era idéntico al del catálogo, y
 * como casi nunca lo es ("YERBA PLAYADITO 1KG X10" vs "Yerba 1kg") cada
 * factura duplicaba productos en vez de sumar stock a los existentes.
 */
export function StockFoto({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('captura')
  const [foto, setFoto] = useState<string>()
  const [items, setItems] = useState<ItemDetectado[]>([])
  const [proveedor, setProveedor] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  /** Motivo por el que la foto no se pudo leer, si pasó. */
  const [errorLectura, setErrorLectura] = useState<string>()

  const catalogo = useMemo(
    () => [...db.productos].sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [db.productos],
  )

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function procesar(file?: File) {
    if (!file) return
    const dataUrl = await comprimirFoto(file)
    if (!dataUrl) {
      toast('No pudimos abrir esa imagen. Probá sacando la foto con la cámara.', 'aviso')
      return
    }
    setFoto(dataUrl)
    setEtapa('leyendo')

    const res = await leerComprobante(
      dataUrl,
      'factura',
      db.productos.map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo })),
    )
    setErrorLectura(res.error)
    setItems(res.datos.items)
    setProveedor(res.datos.comercio ?? '')
    const sumado = res.datos.items.reduce((s, i) => s + i.costo * i.cantidad, 0)
    setTotal(res.datos.total ?? (sumado > 0 ? sumado : null))
    setEtapa('confirmar')
  }

  function otraFoto() {
    setEtapa('captura')
    setFoto(undefined)
    setItems([])
    setErrorLectura(undefined)
  }

  function actualizarItem(i: number, patch: Partial<ItemDetectado>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  function agregarRenglon() {
    setItems((arr) => [...arr, { nombre: '', cantidad: 1, costo: 0, confiable: true, productoId: null }])
  }

  function quitarRenglon(i: number) {
    setItems((arr) => arr.filter((_, idx) => idx !== i))
  }

  const validos = items.filter((i) => i.nombre.trim() && i.cantidad > 0)
  const sumaRenglones = validos.reduce((s, i) => s + i.costo * i.cantidad, 0)

  async function guardar() {
    if (validos.length === 0) return toast('Agregá al menos un renglón con nombre', 'aviso')
    try {
      await addReposicion({
        fecha: ahoraISO(),
        items: validos.map((i) => ({
          productoId: i.productoId,
          nombre: i.nombre.trim(),
          cantidad: i.cantidad,
          costo: i.costo,
          autoDetectado: i.confiable,
        })),
        total: total ?? sumaRenglones,
        origen: 'foto',
      })
      const nuevos = validos.filter((i) => !i.productoId).length
      toast(
        nuevos > 0
          ? `Stock actualizado · ${nuevos} producto${nuevos > 1 ? 's' : ''} nuevo${nuevos > 1 ? 's' : ''}`
          : 'Stock actualizado',
      )
      nav.pop()
    } catch {
      toast('No pudimos aplicar la reposición al stock. Probá de nuevo.', 'aviso')
    }
  }

  return (
    <Screen pad="none">
      <TopBar
        title="Cargar factura por foto"
        subtitle={etapa === 'confirmar' ? 'Revisá lo que leímos antes de aplicar al stock' : undefined}
        onBack={nav.pop}
      />

      {etapa === 'captura' && (
        <div className="pb-4">
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-card border border-line bg-bg-sunken">
            <div className="absolute inset-6 rounded-xl border-2 border-dashed border-line-strong" />
            <div className="relative flex flex-col items-center gap-2 text-center">
              <ScanLine className="size-9 text-ink-faint" strokeWidth={1.5} />
              <p className="max-w-[26ch] text-[13px] leading-relaxed text-ink-faint">
                Encuadrá la factura o el remito completo, con buena luz.
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
          <p className="text-[14px] font-medium text-ink">Leyendo la factura…</p>
          <p className="text-[13px] text-ink-faint">Puede tardar unos segundos: estamos leyendo cada renglón.</p>
        </div>
      )}

      {etapa === 'confirmar' && (
        <div className="space-y-4 pb-8">
          <div className="flex gap-3">
            {foto && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={foto} alt="Factura" className="size-20 shrink-0 rounded-xl border border-line object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <Input label="Proveedor" placeholder="Ej. Distribuidora Cuyo" value={proveedor} onChange={(e) => setProveedor(e.target.value)} />
            </div>
          </div>

          {errorLectura && (
            <div className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2.5">
              <p className="text-[12.5px] leading-relaxed text-warn">{errorLectura}</p>
              <button
                type="button"
                onClick={otraFoto}
                className="mt-1.5 inline-flex min-h-9 items-center gap-1.5 text-[12.5px] font-medium text-ink transition-colors hover:text-accent-hi"
              >
                <RotateCcw className="size-3.5" strokeWidth={2} />
                Probar con otra foto
              </button>
            </div>
          )}

          <Field label={`Renglones (${items.length})`}>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    'space-y-2 rounded-xl border px-3 py-2.5',
                    item.confiable ? 'border-line bg-surface-2' : 'border-warn/45 bg-warn-dim',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      aria-label={`Nombre del renglón ${i + 1}`}
                      placeholder="Nombre del producto"
                      value={item.nombre}
                      onChange={(e) => actualizarItem(i, { nombre: e.target.value })}
                      className="min-w-0 flex-1 truncate bg-transparent text-[13.5px] font-medium text-ink placeholder:text-placeholder focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => quitarRenglon(i)}
                      aria-label={`Quitar ${item.nombre || 'renglón'}`}
                      className="-mr-1.5 grid size-9 shrink-0 place-items-center rounded-lg text-ink-faint transition-colors hover:bg-surface-3 hover:text-neg"
                    >
                      <X className="size-4" strokeWidth={2} />
                    </button>
                  </div>

                  <select
                    aria-label={`Producto del catálogo para ${item.nombre || 'el renglón'}`}
                    value={item.productoId ?? NUEVO}
                    onChange={(e) =>
                      actualizarItem(i, { productoId: e.target.value === NUEVO ? null : e.target.value })
                    }
                    className="h-9 w-full rounded-lg border border-line-strong bg-surface px-2 text-[12.5px] text-ink focus:border-accent-hi focus:outline-none"
                  >
                    <option value={NUEVO}>+ Dar de alta como producto nuevo</option>
                    {catalogo.map((p) => (
                      <option key={p.id} value={p.id}>
                        Sumar a: {p.nombre} (stock {p.stock})
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      Cant.
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(i, { cantidad: Math.max(1, Math.round(Number(e.target.value)) || 1) })}
                        className="tabular w-14 rounded-lg border border-line-strong bg-surface px-1.5 py-1 text-center text-[12.5px] text-ink focus:outline-none"
                      />
                    </label>
                    <label className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      Costo u.
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={item.costo || ''}
                        placeholder="0"
                        onChange={(e) =>
                          actualizarItem(i, { costo: Math.max(0, Math.round(Number(e.target.value)) || 0), confiable: true })
                        }
                        className="tabular w-20 rounded-lg border border-line-strong bg-surface px-1.5 py-1 text-center text-[12.5px] text-ink focus:outline-none"
                      />
                    </label>
                    <span className="tabular ml-auto shrink-0 text-[13px] font-medium text-ink">
                      {money(item.costo * item.cantidad)}
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={agregarRenglon}
                className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-line-strong text-[13px] text-ink-muted transition-colors hover:border-accent-hi hover:text-ink"
              >
                <Plus className="size-4" strokeWidth={2} />
                Agregar renglón
              </button>

              {items.some((i) => !i.confiable) && (
                <p className="pt-1 text-[12px] text-warn">
                  Los renglones en amarillo no se leyeron bien. Corregilos si hace falta.
                </p>
              )}
            </div>
          </Field>

          <MoneyInput
            label="Total de la factura"
            value={total}
            onChange={setTotal}
            hint={
              sumaRenglones > 0 && total !== null && Math.abs(sumaRenglones - total) > 1
                ? `La suma de los renglones da ${money(sumaRenglones)}`
                : undefined
            }
          />

          <motion.div initial={false}>
            <Button full size="lg" disabled={validos.length === 0} confirm confirmLabel="Aplicado" onConfirmed={guardar}>
              Confirmar y aplicar al stock {total ? `· ${money(total)}` : ''}
            </Button>
          </motion.div>
        </div>
      )}
    </Screen>
  )
}
