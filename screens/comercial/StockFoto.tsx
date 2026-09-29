'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Images, Loader2, ScanLine, Sparkles, SlidersHorizontal } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { IconChip } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addReposicion } from '@/lib/storage'
import { ahoraISO, money } from '@/lib/format'
import { leerComprobante, type ItemDetectado } from '@/lib/vision'
import { comprimirImagen } from '@/lib/imagen'
import { cn } from '@/lib/cn'
import type { DB } from '@/lib/types'

type Etapa = 'captura' | 'leyendo' | 'elegir' | 'confirmar'

/** Precio sugerido con el margen por defecto (60% sobre el costo). */
const precioSugerido = (costo: number) => Math.round((costo * 1.6) / 10) * 10

/**
 * Carga de stock a partir de la foto de una factura o remito de proveedor.
 * Mismo flujo en dos etapas que el ticket del hogar: capturar y confirmar,
 * con un paso intermedio para los productos nuevos que trae la factura —
 * porque a diferencia de uno ya conocido, a esos hay que ponerles precio de
 * venta y categoría por primera vez.
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
  const [simulado, setSimulado] = useState(false)
  /** Motivo por el que la foto no se pudo leer, si pasó. */
  const [errorLectura, setErrorLectura] = useState<string>()
  /** null hasta que el comerciante elige, en la pantalla intermedia. */
  const [modoPrecios, setModoPrecios] = useState<'automatico' | 'manual' | null>(null)
  const [preciosManual, setPreciosManual] = useState<Record<number, number>>({})
  const [categoriasManual, setCategoriasManual] = useState<Record<number, string>>({})

  const esNuevo = (nombre: string) =>
    !db.productos.some((p) => p.nombre.toLowerCase() === nombre.toLowerCase())
  const categoriasUsadas = [...new Set(db.productos.map((p) => p.categoria).filter(Boolean))].sort()

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

    const res = await leerComprobante(dataUrl, 'factura')
    setSimulado(res.fuente === 'simulado')
    setErrorLectura(res.error)
    setItems(res.datos.items)
    setProveedor(res.datos.comercio ?? '')
    const sumado = res.datos.items.reduce((s, i) => s + i.costo * i.cantidad, 0)
    setTotal(res.datos.total ?? (sumado > 0 ? sumado : null))
    setModoPrecios(null)
    setPreciosManual({})
    setCategoriasManual({})
    // Sólo hace falta preguntar cómo poner precio y categoría cuando la
    // factura trae algún producto que todavía no está en el stock — a uno
    // que ya existe no hay nada que preguntarle, se le suma cantidad y listo.
    const hayNuevos = res.datos.items.some((i) => esNuevo(i.nombre))
    setEtapa(hayNuevos ? 'elegir' : 'confirmar')
  }

  function actualizarItem(i: number, patch: Partial<ItemDetectado>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  async function guardar() {
    if (items.length === 0) return toast('No hay renglones para cargar', 'aviso')
    try {
      await addReposicion({
        fecha: ahoraISO(),
        items: items.map((i, idx) => ({
          productoId: null,
          nombre: i.nombre,
          cantidad: i.cantidad,
          costo: i.costo,
          autoDetectado: i.confiable,
          ...(modoPrecios === 'manual' && esNuevo(i.nombre)
            ? { precioManual: preciosManual[idx] ?? precioSugerido(i.costo), categoriaManual: categoriasManual[idx] }
            : {}),
        })),
        total: total ?? items.reduce((s, i) => s + i.costo * i.cantidad, 0),
        origen: 'foto',
      })
      toast('Stock actualizado')
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
          <p className="text-[13px] text-ink-faint">Un segundo, estamos reconociendo los renglones.</p>
        </div>
      )}

      {etapa === 'elegir' && (
        <div className="space-y-4 pb-8">
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            Hay productos de la factura que todavía no están en tu stock. ¿Cómo querés ponerles el
            precio de venta y la categoría antes de agregarlos?
          </p>

          <Card
            interactive
            onClick={() => {
              setModoPrecios('automatico')
              setEtapa('confirmar')
            }}
            className="flex items-center gap-3 border-accent-hi/40 bg-accent-dim/20"
          >
            <IconChip icon={Sparkles} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">Precios automáticos · Sugerido</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                Les ponemos un 60% de margen sobre el costo. Después lo podés cambiar cuando
                quieras desde Stock.
              </p>
            </div>
          </Card>

          <Card
            interactive
            onClick={() => {
              setModoPrecios('manual')
              setEtapa('confirmar')
            }}
            className="flex items-center gap-3"
          >
            <IconChip icon={SlidersHorizontal} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-ink">Los configuro yo</p>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">
                Elegís el precio de venta y la categoría de cada producto nuevo antes de aplicarlo
                al stock.
              </p>
            </div>
          </Card>
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

          {errorLectura ? (
            <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
              {errorLectura}
            </p>
          ) : (
            simulado && (
              <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
                Esto es un ejemplo: todavía no leyó tu foto de verdad porque falta configurar la
                lectura por IA en el servidor. Mientras tanto, cargá los datos reales a mano acá abajo.
              </p>
            )
          )}

          <Field label={`Renglones detectados (${items.length})`}>
            <div className="space-y-1.5">
              {items.map((item, i) => {
                const nuevo = esNuevo(item.nombre)
                return (
                  <div key={i} className="space-y-1.5">
                    <div
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-3 py-2',
                        item.confiable ? 'border-line bg-surface-2' : 'border-warn/45 bg-warn-dim',
                      )}
                    >
                      <input
                        value={item.nombre}
                        onChange={(e) => actualizarItem(i, { nombre: e.target.value })}
                        className="min-w-0 flex-1 truncate bg-transparent text-[13px] text-ink focus:outline-none"
                      />
                      <input
                        type="number"
                        min={1}
                        value={item.cantidad}
                        onChange={(e) => actualizarItem(i, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                        className="tabular w-12 shrink-0 rounded-lg border border-line-strong bg-surface px-1.5 py-1 text-center text-[12px] text-ink focus:outline-none"
                      />
                      <span className="tabular shrink-0 text-[13px] font-medium text-ink">
                        {money(item.costo * item.cantidad)}
                      </span>
                    </div>

                    {nuevo && modoPrecios === 'manual' && (
                      <div className="grid grid-cols-2 gap-2 pl-1">
                        <MoneyInput
                          label="Precio de venta"
                          value={preciosManual[i] ?? precioSugerido(item.costo)}
                          onChange={(v) => setPreciosManual((m) => ({ ...m, [i]: v ?? 0 }))}
                        />
                        <div>
                          <Input
                            label="Categoría"
                            placeholder="Ej. Almacén"
                            list="categorias-existentes-stock-foto"
                            value={categoriasManual[i] ?? ''}
                            onChange={(e) => setCategoriasManual((m) => ({ ...m, [i]: e.target.value }))}
                          />
                        </div>
                      </div>
                    )}
                    {nuevo && modoPrecios === 'automatico' && (
                      <p className="pl-1 text-[12px] text-ink-faint">
                        Nuevo · precio sugerido {money(precioSugerido(item.costo))}
                      </p>
                    )}
                  </div>
                )
              })}
              <datalist id="categorias-existentes-stock-foto">
                {categoriasUsadas.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
              {items.some((i) => !i.confiable) && (
                <p className="pt-1 text-[12px] text-warn">
                  Los renglones en amarillo no se leyeron bien. Corregilos si hace falta.
                </p>
              )}
            </div>
          </Field>

          <MoneyInput label="Total de la factura" value={total} onChange={setTotal} />

          <motion.div initial={false}>
            <Button full size="lg" confirm confirmLabel="Aplicado" onConfirmed={guardar}>
              Confirmar y aplicar al stock {total ? `· ${money(total)}` : ''}
            </Button>
          </motion.div>
        </div>
      )}
    </Screen>
  )
}
