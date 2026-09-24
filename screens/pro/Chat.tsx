'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowUp, Check, Mic, Sparkles, Square } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addVenta } from '@/lib/storage'
import { ventasDelDia } from '@/lib/calc'
import { ahoraISO, hoyISO, money } from '@/lib/format'
import { preguntarAlAsistente, type Confirmacion, type Operacion } from '@/lib/asistente'
import { useReconocimientoVoz } from '@/lib/voz'
import { cn } from '@/lib/cn'
import type { DB, ItemVenta } from '@/lib/types'

interface Burbuja {
  id: number
  de: 'usuario' | 'asistente'
  texto: string
  confirmacion?: Confirmacion
  operacion?: Operacion
  /** Una vez aplicada, la tarjeta queda marcada y el botón desaparece. */
  aplicada?: boolean
  /** Mensaje de error de red o del servidor, en vez de una respuesta. */
  error?: boolean
}

const SUGERENCIAS = ['Vendí 3 gaseosas', '¿Cómo vengo hoy?', '¿Qué stock me queda?']

/**
 * Asistente por chat del plan Comercial Pro.
 *
 * Habla contra `/api/asistente`, que responde con un modelo real si hay clave
 * configurada y con una simulación por reglas si no. La pantalla no distingue
 * entre las dos: sólo muestra de dónde vino la respuesta.
 *
 * Lo que el asistente propone nunca se escribe solo. Cuando la respuesta trae
 * una operación, aparece una tarjeta con el detalle y un botón de confirmar;
 * los importes que se guardan se recalculan acá contra el catálogo local, no
 * se toman de la respuesta del servidor.
 */
export function ProChat({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const [mensajes, setMensajes] = useState<Burbuja[]>([])
  const [borrador, setBorrador] = useState('')
  const [esperando, setEsperando] = useState(false)
  const seq = useRef(0)
  const finDeLista = useRef<HTMLDivElement>(null)

  const contexto = useMemo(() => {
    const hoy = ventasDelDia(db.ventas, hoyISO())
    return {
      negocio: db.perfil?.negocio,
      productos: db.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        precio: p.precio,
        stock: p.stock,
      })),
      ventasHoy: hoy.reduce((s, v) => s + v.total, 0),
      ticketsHoy: hoy.length,
    }
  }, [db.perfil?.negocio, db.productos, db.ventas])

  // Mantener la conversación pegada al último mensaje.
  useEffect(() => {
    finDeLista.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, esperando])

  async function enviar(texto: string) {
    const limpio = texto.trim()
    if (!limpio || esperando) return

    const propio: Burbuja = { id: ++seq.current, de: 'usuario', texto: limpio }
    setMensajes((m) => [...m, propio])
    setBorrador('')
    setEsperando(true)

    const res = await preguntarAlAsistente(limpio, contexto)
    setEsperando(false)

    setMensajes((m) => [
      ...m,
      res.ok
        ? {
            id: ++seq.current,
            de: 'asistente',
            texto: res.texto,
            confirmacion: res.confirmacion,
            operacion: res.operacion,
          }
        : { id: ++seq.current, de: 'asistente', texto: res.error, error: true },
    ])
  }

  // Dictado por voz: al reconocer la frase completa, se manda sola — no hay
  // que revisarla a mano antes. No es riesgoso porque nada se escribe en los
  // datos todavía en este paso: el asistente responde con una tarjeta de
  // confirmación y hace falta un toque más ("Confirmar y aplicar al stock")
  // para que la venta impacte de verdad, así que una transcripción rara
  // como mucho pide de nuevo el producto en vez de cargar algo mal.
  const voz = useReconocimientoVoz({
    onResultado: (texto) => enviar(texto),
    onError: (motivo) => {
      if (motivo === 'silencio') return toast('No te escuché. Probá de nuevo.', 'aviso')
      if (motivo === 'permiso') return toast('Rindo necesita permiso para usar el micrófono.', 'aviso')
      toast('No pudimos usar el micrófono. Probá de nuevo.', 'aviso')
    },
  })

  /**
   * Aplica la venta propuesta. Resuelve cada producto contra el catálogo local
   * y calcula precio unitario y total desde ahí: si el producto cambió de
   * precio o desapareció entre la respuesta y la confirmación, manda el dato
   * bueno y no el que viajó por la red.
   */
  async function aplicar(burbuja: Burbuja) {
    const op = burbuja.operacion
    if (!op) return

    const items: ItemVenta[] = []
    const faltantes: string[] = []

    for (const linea of op.items) {
      const producto = db.productos.find((p) => p.id === linea.productoId)
      if (!producto) {
        faltantes.push(linea.productoId)
        continue
      }
      items.push({
        productoId: producto.id,
        nombre: producto.nombre,
        cantidad: linea.cantidad,
        precio: producto.precio,
      })
    }

    if (items.length === 0) {
      toast('Ese producto ya no está en el catálogo', 'aviso')
      return
    }
    if (faltantes.length > 0) {
      toast('Algún producto ya no existe: se registró el resto', 'aviso')
    }

    const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0)

    try {
      await addVenta({ fecha: ahoraISO(), items, total, metodo: 'efectivo' })
    } catch {
      toast('No pudimos registrar la venta. Probá de nuevo.', 'aviso')
      return
    }

    setMensajes((m) => m.map((x) => (x.id === burbuja.id ? { ...x, aplicada: true } : x)))

    const sinStock = items.filter((i) => {
      const p = db.productos.find((x) => x.id === i.productoId)
      return p && p.stock < i.cantidad
    })
    toast(
      sinStock.length
        ? `Venta registrada · ${sinStock[0].nombre} quedó en cero`
        : `Venta registrada · ${money(total)}`,
    )
  }

  return (
    <Screen pad="none" className="flex min-h-dvh flex-col">
      <TopBar title="Asistente" onBack={nav.pop} />

      <div className="flex-1 space-y-3 pb-4">
        {mensajes.length === 0 && (
          <div className="rounded-card border border-line bg-surface-2/60 p-5">
            <span className="grid size-11 place-items-center rounded-2xl border border-line bg-surface text-accent-hi">
              <Sparkles className="size-5" strokeWidth={1.7} />
            </span>
            <p className="mt-3 text-[15px] font-medium text-ink">
              {voz.soportado
                ? 'Cargá una venta escribiendo o por voz, como se lo dirías a un empleado'
                : 'Cargá una venta escribiendo, como se lo dirías a un empleado'}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
              Te muestro el detalle y aplicás el stock sólo si está bien. También puedo decirte cómo
              venís hoy o qué te está faltando.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGERENCIAS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => enviar(s)}
                  className="min-h-9 rounded-full border border-line-strong bg-surface px-3 text-[12.5px] text-ink-muted transition-colors hover:border-accent-hi hover:text-ink"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {mensajes.map((m) => (
          <Mensaje key={m.id} burbuja={m} onAplicar={() => aplicar(m)} />
        ))}

        <AnimatePresence>
          {esperando && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5"
              role="status"
              aria-label="El asistente está escribiendo"
            >
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="size-1.5 rounded-full bg-ink-faint"
                  animate={{ opacity: [0.25, 1, 0.25] }}
                  transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={finDeLista} />
      </div>

      {/* Barra de escritura. Pegada abajo, alineada a la columna de la app. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          enviar(borrador)
        }}
        className="app-col sticky bottom-0 -mx-5 border-t border-line bg-bg/95 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur-xl sm:-mx-6 sm:px-6"
      >
        <div className="flex items-end gap-2">
          <label htmlFor="chat-mensaje" className="sr-only">
            Mensaje para el asistente
          </label>
          <input
            id="chat-mensaje"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            placeholder={voz.escuchando ? 'Escuchando…' : 'Vendí 2 kilos de azúcar…'}
            autoComplete="off"
            className="h-12 min-w-0 flex-1 rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink placeholder:text-placeholder focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
          />
          {voz.soportado && (
            <Button
              type="button"
              variant={voz.escuchando ? 'danger' : 'secondary'}
              size="md"
              aria-label={voz.escuchando ? 'Dejar de escuchar' : 'Cargar venta por voz'}
              disabled={esperando}
              onClick={() => (voz.escuchando ? voz.detener() : voz.iniciar())}
              className="size-12 shrink-0 px-0"
            >
              <motion.span
                animate={voz.escuchando ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 1.1, repeat: voz.escuchando ? Infinity : 0 }}
                className="inline-flex"
              >
                {voz.escuchando ? (
                  <Square className="size-[17px]" strokeWidth={2} fill="currentColor" />
                ) : (
                  <Mic className="size-[19px]" strokeWidth={1.9} />
                )}
              </motion.span>
            </Button>
          )}
          <Button
            type="submit"
            size="md"
            aria-label="Enviar mensaje"
            disabled={!borrador.trim() || esperando}
            className="size-12 shrink-0 px-0"
          >
            <ArrowUp className="size-[19px]" strokeWidth={2.2} />
          </Button>
        </div>
      </form>
    </Screen>
  )
}

function Mensaje({ burbuja, onAplicar }: { burbuja: Burbuja; onAplicar: () => void }) {
  const propio = burbuja.de === 'usuario'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={cn('flex', propio ? 'justify-end' : 'justify-start')}
    >
      <div className={cn('max-w-[85%]', propio && 'flex justify-end')}>
        <div
          className={cn(
            'rounded-card px-4 py-3 text-[14px] leading-relaxed',
            propio
              ? 'bg-accent text-accent-ink'
              : burbuja.error
                ? 'border border-neg/40 bg-neg-dim text-neg'
                : 'border border-line bg-surface text-ink',
          )}
        >
          {burbuja.error && (
            <AlertTriangle className="mb-1 inline size-4 shrink-0 align-[-2px]" strokeWidth={2} />
          )}{' '}
          {burbuja.texto}
        </div>

        {burbuja.confirmacion && (
          <div className="mt-2 overflow-hidden rounded-card border border-accent-hi/45 bg-accent-dim/25">
            <p className="border-b border-accent-hi/25 px-4 py-2.5 text-[13px] font-semibold text-ink">
              {burbuja.confirmacion.titulo}
            </p>
            <dl className="px-4 py-1">
              {burbuja.confirmacion.lineas.map((l) => (
                <div
                  key={l.etiqueta}
                  className="flex items-center justify-between gap-4 border-b border-line/60 py-2 last:border-0"
                >
                  <dt className="text-[12.5px] text-ink-muted">{l.etiqueta}</dt>
                  <dd className="tabular text-[13px] font-medium text-ink">{l.valor}</dd>
                </div>
              ))}
            </dl>

            <div className="px-4 pb-3 pt-1">
              {burbuja.aplicada ? (
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-pos">
                  <Check className="size-4" strokeWidth={2.5} />
                  Aplicado al stock
                </p>
              ) : burbuja.operacion ? (
                <Button
                  full
                  size="md"
                  confirm
                  confirmLabel="Aplicado"
                  onConfirmed={onAplicar}
                >
                  Confirmar y aplicar al stock
                </Button>
              ) : (
                // Llegó una tarjeta sin operación aplicable: la mostramos pero
                // no ofrecemos un botón que no puede hacer nada.
                <p className="text-[12px] leading-relaxed text-ink-faint">
                  Para aplicarlo necesito el producto del catálogo. Decime el nombre como lo tenés
                  cargado.
                </p>
              )}
            </div>
          </div>
        )}

        {!propio && !burbuja.error && burbuja.confirmacion === undefined && (
          <div className="mt-1.5" />
        )}
      </div>
    </motion.div>
  )
}

