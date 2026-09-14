'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Camera, Images, Loader2, ScanLine, Sparkles } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Bits'
import { IconChip, iconoDe } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { addMovimiento } from '@/lib/storage'
import { hoyISO, money } from '@/lib/format'
import { leerComprobante, type ItemDetectado } from '@/lib/vision'
import { cn } from '@/lib/cn'
import type { Categoria } from '@/lib/types'

type Etapa = 'captura' | 'leyendo' | 'confirmar'

/**
 * Carga de un gasto del hogar a partir de la foto del ticket.
 *
 * Dos estados, como el flujo de stock del comercio: capturar y confirmar. La
 * lectura pasa por `/api/vision` (Route Handler), nunca por el cliente: la
 * clave del modelo no puede estar en el bundle.
 */
export function TicketSheet({
  open,
  onClose,
  categorias,
  miembroId,
}: {
  open: boolean
  onClose: () => void
  categorias: Categoria[]
  miembroId?: string
}) {
  const toast = useToast()
  const inputCamara = useRef<HTMLInputElement>(null)
  const inputGaleria = useRef<HTMLInputElement>(null)

  const [etapa, setEtapa] = useState<Etapa>('captura')
  const [foto, setFoto] = useState<string>()
  const [items, setItems] = useState<ItemDetectado[]>([])
  const [comercio, setComercio] = useState('')
  const [total, setTotal] = useState<number | null>(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [simulado, setSimulado] = useState(false)

  useEffect(() => {
    if (open) return
    // Reset al cerrar, para que la próxima apertura arranque en captura.
    setEtapa('captura')
    setFoto(undefined)
    setItems([])
    setComercio('')
    setTotal(null)
    setSimulado(false)
  }, [open])

  useEffect(() => {
    if (!categoriaId && categorias.length) {
      const compras = categorias.find((c) => /super|almac|comida/i.test(c.nombre))
      setCategoriaId((compras ?? categorias[0]).id)
    }
  }, [categorias, categoriaId])

  async function procesar(file?: File) {
    if (!file) return
    const dataUrl = await comprimir(file)
    setFoto(dataUrl)
    setEtapa('leyendo')

    const res = await leerComprobante(dataUrl, 'ticket')
    setSimulado(res.fuente === 'simulado')
    setItems(res.datos.items)
    setComercio(res.datos.comercio ?? '')
    const sumado = res.datos.items.reduce((s, i) => s + i.costo * i.cantidad, 0)
    setTotal(res.datos.total ?? (sumado > 0 ? sumado : null))
    setEtapa('confirmar')
  }

  function guardar() {
    if (!total || total <= 0) return toast('Revisá el total del ticket', 'aviso')
    addMovimiento({
      tipo: 'gasto',
      monto: total,
      categoriaId: categoriaId || categorias[0]?.id || '',
      descripcion: comercio.trim() || 'Compra con ticket',
      fecha: hoyISO(),
      autorId: miembroId,
      origen: 'ticket',
    })
    toast('Ticket cargado')
    onClose()
  }

  const categoria = categorias.find((c) => c.id === categoriaId)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cargar ticket con foto"
      subtitle={etapa === 'confirmar' ? 'Revisá lo que leímos antes de guardar' : undefined}
      footer={
        etapa === 'confirmar' ? (
          <Button full size="lg" confirm confirmLabel="Guardado" onConfirmed={guardar}>
            Confirmar gasto {total ? `· ${money(total)}` : ''}
          </Button>
        ) : undefined
      }
    >
      {etapa === 'captura' && (
        <div className="pb-4">
          {/* Visor con guía punteada: encuadrar el ticket adentro. */}
          <div className="relative grid aspect-[4/5] place-items-center overflow-hidden rounded-card border border-line bg-bg-sunken">
            <div className="absolute inset-6 rounded-xl border-2 border-dashed border-line-strong" />
            <div className="relative flex flex-col items-center gap-2 text-center">
              <ScanLine className="size-9 text-ink-faint" strokeWidth={1.5} />
              <p className="max-w-[26ch] text-[13px] leading-relaxed text-ink-faint">
                Poné el ticket dentro del recuadro, con buena luz y sin doblar.
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

          <input
            ref={inputCamara}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => procesar(e.target.files?.[0])}
          />
          <input
            ref={inputGaleria}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => procesar(e.target.files?.[0])}
          />
        </div>
      )}

      {etapa === 'leyendo' && (
        <div className="flex flex-col items-center gap-3 py-14">
          <Loader2 className="size-7 animate-spin text-accent-hi" />
          <p className="text-[14px] font-medium text-ink">Leyendo el ticket…</p>
          <p className="text-[13px] text-ink-faint">Un segundo, estamos reconociendo los renglones.</p>
        </div>
      )}

      {etapa === 'confirmar' && (
        <div className="space-y-4 pb-2">
          <div className="flex gap-3">
            {foto && (
              // Miniatura local (dataURL), no una imagen remota.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={foto}
                alt="Ticket"
                className="size-20 shrink-0 rounded-xl border border-line object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <Input
                label="Comercio"
                placeholder="Ej. Supermercado del Centro"
                value={comercio}
                onChange={(e) => setComercio(e.target.value)}
              />
            </div>
          </div>

          {simulado && (
            <p className="text-[12px] leading-relaxed text-ink-faint">
              Lectura de ejemplo: todavía no hay una clave de IA configurada en el servidor. Podés
              editar todo a mano igual.
            </p>
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
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.nombre}</span>
                  <span className="tabular shrink-0 text-[12px] text-ink-faint">
                    ×{item.cantidad}
                  </span>
                  <span className="tabular shrink-0 text-[13px] font-medium text-ink">
                    {money(item.costo * item.cantidad)}
                  </span>
                </div>
              ))}
              {items.some((i) => !i.confiable) && (
                <p className="pt-1 text-[12px] text-warn">
                  Los renglones en amarillo no se leyeron bien. Ajustá el total si hace falta.
                </p>
              )}
            </div>
          </Field>

          <MoneyInput label="Total del ticket" value={total} onChange={setTotal} />

          <Field label="Categoría">
            <div className="grid grid-cols-4 gap-2">
              {categorias
                .filter((c) => c.limite > 0)
                .map((c) => {
                  const activa = c.id === categoriaId
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setCategoriaId(c.id)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-input border p-2 transition-colors',
                        activa
                          ? 'border-accent-hi bg-accent-dim/40'
                          : 'border-line bg-surface-2 hover:bg-surface-3',
                      )}
                    >
                      <IconChip icon={iconoDe(c.icono)} color={c.color} size="sm" />
                      <span
                        className={cn(
                          'w-full truncate text-center text-[10.5px] font-medium',
                          activa ? 'text-ink' : 'text-ink-faint',
                        )}
                      >
                        {c.nombre}
                      </span>
                    </motion.button>
                  )
                })}
            </div>
          </Field>

          {categoria && (
            <div className="flex items-center gap-2">
              <Badge tone="accent" icon={Sparkles}>
                Detectado automáticamente
              </Badge>
              <span className="text-[12px] text-ink-faint">Podés cambiar todo antes de guardar.</span>
            </div>
          )}
        </div>
      )}
    </Sheet>
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
