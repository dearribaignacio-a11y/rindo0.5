'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Receipt,
  Send,
  ShoppingCart,
  UserRound,
  type LucideIcon,
} from 'lucide-react'
import { Screen, SectionTitle, TopBar } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Sheet } from '@/components/ui/Sheet'
import { IconChip } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { updateAjustes } from '@/lib/storage'
import { subirEnvio } from '@/lib/supabase/envios'
import { hoyISO, isoLocal, money, moneySigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import {
  armarDatos,
  calcularPeriodo,
  nombreArchivo,
  type DatosContador,
  type FuenteContador,
  type TipoPeriodo,
} from '@/lib/contador/periodo'
import { generarExcel } from '@/lib/contador/excel'
import { descargar, enviarAlContador, normalizarWhatsApp, whatsappLegible } from '@/lib/contador/envio'
import type { Contador, DB } from '@/lib/types'

const OPCIONES_PERIODO: { id: TipoPeriodo; label: string }[] = [
  { id: 'actual', label: 'Este mes' },
  { id: 'anterior', label: 'Mes anterior' },
  { id: 'rango', label: 'Personalizado' },
]

const CLASE_FECHA =
  'h-12 w-full rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink focus:border-accent-hi focus:bg-surface-3 focus:outline-none'

/* ── Versión conectada a la cuenta ─────────────────────────────────────── */

/** La pantalla dentro de la app: datos de la cuenta, contador guardado en
 *  Ajustes y envío con link privado (opción A). */
export function EnviarContadorApp({ db }: { db: DB }) {
  const nav = useNav()

  const fuente = useMemo<FuenteContador>(
    () => ({
      comercio: db.perfil?.negocio || db.empresa?.razonSocial || db.perfil?.nombre || 'Mi comercio',
      razonSocial: db.empresa?.razonSocial,
      cuit: db.empresa?.cuitCuil,
      ventas: db.ventas,
      reposiciones: db.reposiciones,
      productos: db.productos,
    }),
    [db.perfil, db.empresa, db.ventas, db.reposiciones, db.productos],
  )

  return (
    <EnviarContador
      fuente={fuente}
      contador={db.ajustes.contador ?? null}
      onGuardarContador={(contador) => updateAjustes({ contador })}
      subir={subirEnvio}
      onBack={nav.pop}
    />
  )
}

/* ── Pantalla ─────────────────────────────────────────────────────────── */

/**
 * "Enviar al contador": elegir período, ver los totales, generar el Excel y
 * mandarlo por WhatsApp. No sabe de dónde vienen los datos — la usan igual
 * la app (`EnviarContadorApp`) y la demo pública (`/demo/contador`).
 */
export function EnviarContador({
  fuente,
  contador,
  onGuardarContador,
  subir,
  onBack,
  aviso,
}: {
  fuente: FuenteContador
  contador: Contador | null
  onGuardarContador: (c: Contador) => void
  /** Opción A del envío. Sin esto (demo) se usa compartir o descarga. */
  subir?: (archivo: Blob, nombre: string) => Promise<string>
  onBack?: () => void
  /** Franja opcional arriba de todo (ej. "Datos de ejemplo"). */
  aviso?: ReactNode
}) {
  const toast = useToast()
  const [tipo, setTipo] = useState<TipoPeriodo>('actual')
  const [rango, setRango] = useState(() => ({
    desde: `${hoyISO().slice(0, 8)}01`,
    hasta: hoyISO(),
  }))
  const [editando, setEditando] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [enviando, setEnviando] = useState(false)

  const periodo = useMemo(
    () => calcularPeriodo(tipo, rango),
    [tipo, rango],
  )
  const datos = useMemo(() => armarDatos(fuente, periodo), [fuente, periodo])
  const nombre = nombreArchivo(fuente.comercio, periodo)

  /* El Excel se arma en segundo plano apenas cambia el período. Así, al tocar
     "Enviar", el archivo ya está listo y el menú de compartir del celular se
     abre en el mismo toque (los navegadores lo exigen). */
  const cache = useRef<{ datos: DatosContador; archivo: Promise<Blob> } | null>(null)
  const archivo = () => {
    if (cache.current?.datos !== datos) {
      const promesa = generarExcel(datos)
      cache.current = { datos, archivo: promesa }
      // Si falla, que el próximo intento lo vuelva a generar.
      promesa.catch(() => {
        if (cache.current?.archivo === promesa) cache.current = null
      })
    }
    return cache.current.archivo
  }
  useEffect(() => {
    const t = window.setTimeout(() => archivo().catch(() => {}), 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datos])

  async function generar() {
    setGenerando(true)
    try {
      descargar(await archivo(), nombre)
      toast('Excel descargado')
    } catch {
      toast('No pudimos generar el Excel. Probá de nuevo.', 'aviso')
    } finally {
      setGenerando(false)
    }
  }

  async function enviar() {
    if (!contador) {
      toast('Primero cargá el nombre y el WhatsApp de tu contador', 'info')
      setEditando(true)
      return
    }
    setEnviando(true)
    try {
      const via = await enviarAlContador({
        archivo,
        nombre,
        contador,
        comercio: fuente.comercio,
        periodo,
        subir,
      })
      if (via === 'link') toast('Abrimos WhatsApp con el link de descarga. Vence en 7 días.')
      if (via === 'compartir') toast('Archivo listo para enviar')
      if (via === 'descarga') toast('Descargamos el Excel. Adjuntalo en el chat de WhatsApp.', 'info')
    } catch (err) {
      const cancelado = err instanceof DOMException && err.name === 'AbortError'
      if (!cancelado) toast('No pudimos enviar el Excel. Probá de nuevo.', 'aviso')
    } finally {
      setEnviando(false)
    }
  }

  const sinMovimientos = datos.cantidadVentas === 0 && datos.cantidadFacturas === 0

  return (
    <>
      <Screen pad="none">
        <TopBar title="Enviar al contador" subtitle="Ventas, compras y stock en Excel" onBack={onBack} />

        {aviso}

        <Segmented
          layoutId="periodo-contador"
          value={tipo}
          onChange={setTipo}
          opciones={OPCIONES_PERIODO}
          semantica="radio"
          etiqueta="Período del resumen"
        />

        {tipo === 'rango' && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="contador-desde">
              <input
                id="contador-desde"
                type="date"
                value={rango.desde}
                max={isoLocal()}
                onChange={(e) => e.target.value && setRango((r) => ({ ...r, desde: e.target.value }))}
                className={CLASE_FECHA}
              />
            </Field>
            <Field label="Hasta" htmlFor="contador-hasta">
              <input
                id="contador-hasta"
                type="date"
                value={rango.hasta}
                onChange={(e) => e.target.value && setRango((r) => ({ ...r, hasta: e.target.value }))}
                className={CLASE_FECHA}
              />
            </Field>
          </div>
        )}

        <Card className="mt-4 p-5">
          <p className="text-[13px] font-medium text-ink-muted">
            Ventas <span className="text-ink-faint">· {periodo.etiqueta}</span>
          </p>
          <p className="tabular mt-1 font-display text-[36px] font-bold leading-none tracking-[-0.035em] text-ink">
            {money(datos.totalVendido)}
          </p>
          <p className="tabular mt-1.5 text-[12.5px] text-ink-faint">
            {datos.cantidadVentas} {datos.cantidadVentas === 1 ? 'venta registrada' : 'ventas registradas'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <Dato icon={ShoppingCart} etiqueta="Compras" valor={money(datos.totalComprado)} />
            <Dato icon={FileText} etiqueta="Facturas" valor={String(datos.cantidadFacturas)} />
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
            <span className="text-[13px] text-ink-muted">Diferencia</span>
            <span
              className={cn(
                'tabular text-[15px] font-semibold',
                datos.diferencia >= 0 ? 'text-pos' : 'text-neg',
              )}
            >
              {moneySigned(datos.diferencia)}
            </span>
          </div>
        </Card>

        {sinMovimientos && (
          <p className="mt-2.5 px-1 text-[12.5px] leading-relaxed text-ink-faint">
            No hay ventas ni compras cargadas en este período. El Excel igual incluye el stock actual.
          </p>
        )}

        <SectionTitle>Contador</SectionTitle>
        {contador ? (
          <Card className="flex items-center gap-3">
            <IconChip icon={UserRound} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium text-ink">{contador.nombre}</p>
              <p className="tabular truncate text-[12.5px] text-ink-faint">{whatsappLegible(contador.whatsapp)}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="-mr-1 min-h-11 px-2 text-[12.5px] text-accent-hi transition-colors hover:text-ink"
            >
              Editar
            </button>
          </Card>
        ) : (
          <Card interactive onClick={() => setEditando(true)} className="flex items-center gap-3">
            <IconChip icon={UserRound} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="text-[14.5px] font-medium text-ink">Agregar contador</p>
              <p className="mt-0.5 text-[12.5px] text-ink-faint">Nombre y WhatsApp. Se cargan una sola vez.</p>
            </div>
            <ChevronRight className="size-[18px] shrink-0 text-ink-faint" />
          </Card>
        )}

        <div className="mt-6 space-y-2.5">
          <Button
            full
            size="lg"
            loading={generando}
            disabled={enviando}
            onClick={generar}
            icon={<FileSpreadsheet className="size-[18px]" strokeWidth={1.9} />}
          >
            Generar Excel
          </Button>
          <Button
            full
            size="lg"
            variant="secondary"
            loading={enviando}
            disabled={generando}
            onClick={enviar}
            icon={<Send className="size-[18px]" strokeWidth={1.9} />}
          >
            Enviar por WhatsApp
          </Button>
        </div>

        <div className="mt-3 flex items-start gap-2 px-1 text-[12px] leading-relaxed text-ink-faint">
          <Receipt className="mt-0.5 size-[14px] shrink-0" strokeWidth={1.9} />
          <p>
            <span className="break-all text-ink-muted">{nombre}</span>
            <br />
            Hojas: Resumen, Ventas, Compras y Stock.
            {subir ? ' Por WhatsApp se envía un link privado que vence a los 7 días.' : ''}
          </p>
        </div>
      </Screen>

      <ContadorSheet
        open={editando}
        onClose={() => setEditando(false)}
        contador={contador}
        onGuardar={(c) => {
          onGuardarContador(c)
          setEditando(false)
          toast('Contador guardado')
        }}
      />
    </>
  )
}

function Dato({ icon: Icon, etiqueta, valor }: { icon: LucideIcon; etiqueta: string; valor: string }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="flex items-center gap-1.5 text-ink-muted">
        <Icon className="size-4" strokeWidth={2.3} />
        <span className="text-[11.5px] font-semibold uppercase tracking-wide">{etiqueta}</span>
      </div>
      <p className="tabular mt-1 truncate text-[16px] font-semibold text-ink">{valor}</p>
    </div>
  )
}

/* ── Datos del contador ───────────────────────────────────────────────── */

function ContadorSheet({
  open,
  onClose,
  contador,
  onGuardar,
}: {
  open: boolean
  onClose: () => void
  contador: Contador | null
  onGuardar: (c: Contador) => void
}) {
  const [nombre, setNombre] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [errores, setErrores] = useState<{ nombre?: string; whatsapp?: string }>({})

  useEffect(() => {
    if (!open) return
    setNombre(contador?.nombre ?? '')
    setWhatsapp(contador?.whatsapp ?? '')
    setErrores({})
  }, [open, contador])

  function guardar() {
    const numero = normalizarWhatsApp(whatsapp)
    const nuevos = {
      nombre: nombre.trim() ? undefined : 'Escribí el nombre del contador',
      whatsapp: numero ? undefined : 'Revisá el número. Ej. 5492644123456',
    }
    setErrores(nuevos)
    if (nuevos.nombre || nuevos.whatsapp || !numero) return
    onGuardar({ nombre: nombre.trim(), whatsapp: numero })
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={contador ? 'Editar contador' : 'Agregar contador'}
      footer={
        <Button full size="lg" onClick={guardar}>
          Guardar
        </Button>
      }
    >
      <div className="space-y-4 pb-2">
        <Input
          label="Nombre"
          placeholder="Ej. Marcela Pérez"
          autoComplete="name"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={errores.nombre}
        />
        <Input
          label="WhatsApp"
          placeholder="549264XXXXXXX"
          inputMode="tel"
          autoComplete="tel"
          value={whatsapp}
          onChange={(e) => setWhatsapp(e.target.value)}
          error={errores.whatsapp}
          hint="54 + 9 + código de área + número, sin 0 ni 15."
        />
      </div>
    </Sheet>
  )
}
