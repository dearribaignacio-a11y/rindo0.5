'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowUp, Camera, Check, Mic, Sparkles, Square, Volume2, VolumeX } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addVenta } from '@/lib/storage'
import { rankingProductos, totalVentas, ventasDelDia, ventasDelMes } from '@/lib/calc'
import { ahoraISO, hoyISO, isoLocal, money } from '@/lib/format'
import {
  preguntarAlAsistente,
  type Confirmacion,
  type MensajeHistorial,
  type Operacion,
} from '@/lib/asistente'
import { useLecturaEnVoz, useReconocimientoVoz } from '@/lib/voz'
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

const SUGERENCIAS = [
  'Vendí 3 gaseosas',
  '¿Cómo vengo esta semana?',
  '¿Qué tengo que reponer?',
  '¿Qué es lo que más se vende?',
]

/** Silenciar la voz del asistente es una preferencia del dispositivo. */
const CLAVE_SILENCIO = 'rindo.asistente.silencio'

/**
 * Asistente por chat del plan Comercial Pro.
 *
 * Se puede escribir o hablar. La charla tiene memoria: cada pedido manda la
 * conversación entera a `/api/asistente`, así "sumale otra" o "¿y ayer?" se
 * entienden. Cuando el mensaje se dictó por voz, la respuesta también se lee
 * en voz alta (se puede silenciar arriba a la derecha).
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
  /** true si el servidor respondió en modo básico (sin clave de IA). */
  const [modoBasico, setModoBasico] = useState(false)
  const [silencio, setSilencio] = useState(false)
  const seq = useRef(0)
  const finDeLista = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      setSilencio(localStorage.getItem(CLAVE_SILENCIO) === '1')
    } catch {
      // Sin almacenamiento (modo privado): queda con voz.
    }
  }, [])

  const contexto = useMemo(() => {
    const hoy = hoyISO()
    const deHoy = ventasDelDia(db.ventas, hoy)
    const delMes = ventasDelMes(db.ventas)

    const ultimosDias = Array.from({ length: 7 }, (_, k) => {
      const d = new Date()
      d.setDate(d.getDate() - k)
      const dia = isoLocal(d)
      const ventas = ventasDelDia(db.ventas, dia)
      return { dia, total: totalVentas(ventas), tickets: ventas.length }
    })

    return {
      negocio: db.perfil?.negocio,
      fecha: ahoraISO(),
      productos: db.productos.map((p) => ({
        id: p.id,
        nombre: p.nombre,
        codigo: p.codigo,
        categoria: p.categoria,
        precio: p.precio,
        costo: p.costo,
        stock: p.stock,
        stockMin: p.stockMin,
      })),
      ventasHoy: totalVentas(deHoy),
      ticketsHoy: deHoy.length,
      ultimosDias,
      ventasMes: totalVentas(delMes),
      masVendidosMes: rankingProductos(delMes, db.productos)
        .slice(0, 10)
        .map((r) => ({ nombre: r.nombre, unidades: r.unidades, facturado: r.facturado })),
    }
  }, [db.perfil?.negocio, db.productos, db.ventas])

  // Mantener la conversación pegada al último mensaje.
  useEffect(() => {
    finDeLista.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensajes, esperando])

  const lectura = useLecturaEnVoz()

  /** Lo que se le manda al modelo como historia de la charla. Las propuestas
   *  de venta van resumidas con su estado, para que sepa si ya se aplicaron. */
  function historial(burbujas: Burbuja[]): MensajeHistorial[] {
    return burbujas
      .filter((b) => !b.error)
      .map((b) => {
        if (b.de === 'usuario' || !b.confirmacion) return { rol: b.de, texto: b.texto }
        const detalle = b.confirmacion.lineas.map((l) => `${l.etiqueta}: ${l.valor}`).join('; ')
        const estado = b.aplicada ? 'el usuario la confirmó y quedó registrada' : 'todavía sin confirmar'
        return {
          rol: b.de,
          texto: `${b.texto}\n[Propuesta "${b.confirmacion.titulo}" — ${detalle} — ${estado}]`,
        }
      })
  }

  async function enviar(texto: string, opciones: { porVoz?: boolean } = {}) {
    const limpio = texto.trim()
    if (!limpio || esperando) return

    const propio: Burbuja = { id: ++seq.current, de: 'usuario', texto: limpio }
    const conversacion = [...mensajes, propio]
    setMensajes(conversacion)
    setBorrador('')
    setEsperando(true)

    const res = await preguntarAlAsistente(historial(conversacion), contexto)
    setEsperando(false)

    if (res.ok) {
      setModoBasico(res.fuente === 'simulado')
      if (opciones.porVoz && !silencio) lectura.hablar(res.texto)
    } else if (opciones.porVoz && !silencio) {
      lectura.hablar(res.error)
    }

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

  // Dictado por voz: mientras se habla, lo que se va entendiendo aparece en
  // la caja de texto; al terminar la frase se manda sola. No es riesgoso
  // porque nada se escribe en los datos en este paso: una venta siempre pide
  // un toque más en "Confirmar y aplicar al stock".
  const voz = useReconocimientoVoz({
    onParcial: (texto) => setBorrador(texto),
    onResultado: (texto) => enviar(texto, { porVoz: true }),
    onError: (motivo) => {
      setBorrador('')
      if (motivo === 'cancelado') return
      if (motivo === 'silencio') return toast('No te escuché. Probá de nuevo.', 'aviso')
      if (motivo === 'permiso') return toast('Rindo necesita permiso para usar el micrófono.', 'aviso')
      toast('No pudimos usar el micrófono. Probá de nuevo.', 'aviso')
    },
  })

  function tocarMicrofono() {
    if (voz.escuchando) return voz.detener()
    // Este toque "habilita" la voz del asistente en iPhone para la respuesta.
    if (!silencio) lectura.preparar()
    setBorrador('')
    voz.iniciar()
  }

  function alternarSilencio() {
    const nuevo = !silencio
    setSilencio(nuevo)
    if (nuevo) lectura.callar()
    try {
      localStorage.setItem(CLAVE_SILENCIO, nuevo ? '1' : '0')
    } catch {
      // Preferencia sólo por esta visita.
    }
    toast(nuevo ? 'Respuestas en voz alta desactivadas' : 'Las respuestas a tus audios se leen en voz alta')
  }

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
      await addVenta({ fecha: ahoraISO(), items, total, metodo: op.metodo ?? 'efectivo' })
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
      <TopBar
        title="Asistente"
        subtitle={lectura.hablando ? 'Hablando…' : voz.escuchando ? 'Escuchando…' : undefined}
        onBack={nav.pop}
        action={
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => nav.push('stock-foto')}
              aria-label="Cargar factura por foto"
              className="grid size-10 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <Camera className="size-[19px]" strokeWidth={1.9} />
            </button>
            {lectura.soportado && (
              <button
                type="button"
                onClick={alternarSilencio}
                aria-pressed={!silencio}
                aria-label={silencio ? 'Activar respuestas en voz alta' : 'Silenciar respuestas en voz alta'}
                className="grid size-10 place-items-center rounded-xl text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink"
              >
                {silencio ? (
                  <VolumeX className="size-[19px]" strokeWidth={1.9} />
                ) : (
                  <Volume2 className={cn('size-[19px]', lectura.hablando && 'text-accent-hi')} strokeWidth={1.9} />
                )}
              </button>
            )}
          </div>
        }
      />

      <div className="flex-1 space-y-3 pb-4">
        {modoBasico && (
          <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12px] leading-relaxed text-warn">
            Modo básico: la IA todavía no está activada en el servidor (falta ANTHROPIC_API_KEY en
            Vercel). Puedo anotar ventas simples y responder lo básico.
          </p>
        )}

        {mensajes.length === 0 && (
          <div className="rounded-card border border-line bg-surface-2/60 p-5">
            <span className="grid size-11 place-items-center rounded-2xl border border-line bg-surface text-accent-hi">
              <Sparkles className="size-5" strokeWidth={1.7} />
            </span>
            <p className="mt-3 text-[15px] font-medium text-ink">
              {voz.soportado
                ? 'Escribime o hablame, como le hablarías a un empleado'
                : 'Escribime como le escribirías a un empleado'}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-faint">
              Te anoto ventas (las aplicás sólo si están bien), te digo cómo venís, qué se vende más y
              qué reponer. Si me hablás con el micrófono, te respondo en voz alta.
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
          <Mensaje
            key={m.id}
            burbuja={m}
            onAplicar={() => aplicar(m)}
            onEscuchar={lectura.soportado && !m.error && m.de === 'asistente' ? () => lectura.hablar(m.texto) : undefined}
          />
        ))}

        <AnimatePresence>
          {esperando && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex w-fit gap-1.5 rounded-card border border-line bg-surface px-4 py-3.5"
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
          if (!voz.escuchando) enviar(borrador)
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
            readOnly={voz.escuchando}
            placeholder={voz.escuchando ? 'Escuchando… hablá tranquilo' : 'Escribí o tocá el micrófono…'}
            autoComplete="off"
            enterKeyHint="send"
            className={cn(
              'h-12 min-w-0 flex-1 rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink placeholder:text-placeholder focus:border-accent-hi focus:bg-surface-3 focus:outline-none',
              voz.escuchando && 'border-accent-hi italic text-ink-muted',
            )}
          />
          {voz.soportado && (
            <Button
              type="button"
              variant={voz.escuchando ? 'danger' : 'secondary'}
              size="md"
              aria-label={voz.escuchando ? 'Dejar de escuchar' : 'Hablarle al asistente'}
              disabled={esperando}
              onClick={tocarMicrofono}
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
            disabled={!borrador.trim() || esperando || voz.escuchando}
            className="size-12 shrink-0 px-0"
          >
            <ArrowUp className="size-[19px]" strokeWidth={2.2} />
          </Button>
        </div>
      </form>
    </Screen>
  )
}

function Mensaje({
  burbuja,
  onAplicar,
  onEscuchar,
}: {
  burbuja: Burbuja
  onAplicar: () => void
  onEscuchar?: () => void
}) {
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
            'whitespace-pre-line rounded-card px-4 py-3 text-[14px] leading-relaxed',
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

        {onEscuchar && (
          <button
            type="button"
            onClick={onEscuchar}
            className="mt-1 inline-flex min-h-8 items-center gap-1 px-1 text-[11.5px] text-ink-faint transition-colors hover:text-ink"
          >
            <Volume2 className="size-3.5" strokeWidth={2} />
            Escuchar
          </button>
        )}

        {burbuja.confirmacion && (
          <div className="mt-2 overflow-hidden rounded-card border border-accent-hi/45 bg-accent-dim/25">
            <p className="border-b border-accent-hi/25 px-4 py-2.5 text-[13px] font-semibold text-ink">
              {burbuja.confirmacion.titulo}
            </p>
            <dl className="px-4 py-1">
              {burbuja.confirmacion.lineas.map((l, i) => (
                <div
                  key={`${l.etiqueta}-${i}`}
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
                <Button full size="md" confirm confirmLabel="Aplicado" onConfirmed={onAplicar}>
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
      </div>
    </motion.div>
  )
}
