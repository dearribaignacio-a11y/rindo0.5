'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Images, Loader2, ScanLine } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addReposicion } from '@/lib/storage'
import { ahoraISO, money } from '@/lib/format'
import { leerComprobante, type ItemDetectado } from '@/lib/vision'
import { cn } from '@/lib/cn'

type Etapa = 'captura' | 'leyendo' | 'confirmar'

/**
 * Carga de stock a partir de la foto de una factura o remito de proveedor.
 * Mismo flujo en dos etapas que el ticket del hogar: capturar y confirmar.
 */
export function StockFoto() {
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

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  async function procesar(file?: File) {
    if (!file) return
    const dataUrl = await comprimir(file)
    setFoto(dataUrl)
    setEtapa('leyendo')

    const res = await leerComprobante(dataUrl, 'factura')
    setSimulado(res.fuente === 'simulado')
    setErrorLectura(res.error)
    setItems(res.datos.items)
    setProveedor(res.datos.comercio ?? '')
    const sumado = res.datos.items.reduce((s, i) => s + i.costo * i.cantidad, 0)
    setTotal(res.datos.total ?? (sumado > 0 ? sumado : null))
    setEtapa('confirmar')
  }

  function actualizarItem(i: number, patch: Partial<ItemDetectado>) {
    setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  }

  async function guardar() {
    if (items.length === 0) return toast('No hay renglones para cargar', 'aviso')
    try {
      await addReposicion({
        fecha: ahoraISO(),
        items: items.map((i) => ({
          productoId: null,
          nombre: i.nombre,
          cantidad: i.cantidad,
          costo: i.costo,
          autoDetectado: i.confiable,
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
              <p className="text-[12px] leading-relaxed text-ink-faint">
                Lectura de ejemplo: todavía no hay una clave de IA configurada en el servidor. Podés
                editar todo a mano igual.
              </p>
            )
          )}

          <Field label={`Renglones detectados (${items.length})`}>
            <div className="space-y-1.5">
              {items.map((item, i) => (
                <div
                  key={i}
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
              ))}
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

/** Reduce la foto antes de mandarla: una imagen de cámara son varios MB. */
async function comprimir(file: File, lado = 1280): Promise<string> {
  const dataUrl = await new Promise<string>((res) => {
    const lector = new FileReader()
    lector.onload = () => res(String(lector.result))
    lector.readAsDataURL(file)
  })

  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return res(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      res(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => res(dataUrl)
    img.src = dataUrl
  })
}
