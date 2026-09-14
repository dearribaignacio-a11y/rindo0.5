'use client'

import { useMemo, useState } from 'react'
import { House, Plus, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Progress } from '@/components/ui/Progress'
import { Ring } from '@/components/ui/Ring'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Field, MoneyInput } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Bits'
import {
  COLORES_CATEGORIA,
  ICONOS_ELEGIBLES,
  IconChip,
  iconoDe,
} from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { AdSlot } from '@/components/AdSlot'
import {
  addCategoria,
  removeCategoria,
  restoreCategoria,
  updateCategoria,
} from '@/lib/storage'
import { gastoDelMes, usoPorCategoria } from '@/lib/calc'
import { money, pct } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Categoria, CategoriaColor, DB } from '@/lib/types'

export function HogarPresupuestos({ db }: { db: DB }) {
  const [editando, setEditando] = useState<Categoria | null>(null)
  const [creando, setCreando] = useState(false)

  const usos = useMemo(
    () => usoPorCategoria(db.movimientos, db.categorias),
    [db.movimientos, db.categorias],
  )

  const limiteTotal = usos.reduce((s, u) => s + u.categoria.limite, 0)
  const gastadoEnPresupuestos = usos.reduce((s, u) => s + u.gastado, 0)
  const gastadoTotal = gastoDelMes(db.movimientos)
  const ratio = limiteTotal > 0 ? gastadoEnPresupuestos / limiteTotal : 0
  const excedidas = usos.filter((u) => u.ratio >= 1).length

  return (
    <>
      <Screen pad="tab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Presupuestos</h1>
          <p className="mt-0.5 text-[13px] text-ink-faint">
            {new Date().toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}
          </p>
        </header>

        <Card className="flex items-center gap-5 p-5">
          <Ring value={ratio}>
            {/* La casa adentro del anillo: sutil, sin competir con el número. */}
            <div className="flex flex-col items-center">
              <House className="mb-0.5 size-4 text-ink-faint" strokeWidth={1.7} />
              <span className="tabular font-display text-[22px] font-bold leading-none text-ink">
                {pct(Math.min(ratio, 9.99))}
              </span>
              <span className="mt-0.5 text-[10.5px] text-ink-faint">usado</span>
            </div>
          </Ring>

          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-medium uppercase tracking-wide text-ink-faint">
              Gastado del presupuesto
            </p>
            <p className="tabular mt-1 text-[22px] font-semibold leading-tight text-ink">
              {money(gastadoEnPresupuestos)}
            </p>
            <p className="tabular mt-0.5 text-[13px] text-ink-muted">de {money(limiteTotal)}</p>

            <div className="mt-3">
              {excedidas > 0 ? (
                <Badge tone="neg">
                  {excedidas} categoría{excedidas > 1 ? 's' : ''} excedida{excedidas > 1 ? 's' : ''}
                </Badge>
              ) : (
                <Badge tone="pos">Dentro del límite</Badge>
              )}
            </div>
          </div>
        </Card>

        {gastadoTotal > gastadoEnPresupuestos && (
          <p className="mt-2.5 px-1 text-[12.5px] leading-relaxed text-ink-faint">
            Además gastaste {money(gastadoTotal - gastadoEnPresupuestos)} en categorías sin
            presupuesto asignado.
          </p>
        )}

        <SectionTitle>Por categoría</SectionTitle>

        <div className="space-y-2.5">
          {usos.map(({ categoria, gastado, ratio: r, restante }) => (
            <Card key={categoria.id} onClick={() => setEditando(categoria)} interactive>
              <div className="flex items-center gap-3">
                <IconChip icon={iconoDe(categoria.icono)} color={categoria.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-ink">{categoria.nombre}</p>
                  <p className="tabular mt-0.5 text-[12.5px] text-ink-faint">
                    {money(gastado)} de {money(categoria.limite)}
                  </p>
                </div>
                <span
                  className={cn(
                    'tabular shrink-0 text-[13px] font-semibold',
                    r >= 1 ? 'text-neg' : r >= 0.75 ? 'text-warn' : 'text-pos',
                  )}
                >
                  {pct(Math.min(r, 9.99))}
                </span>
              </div>

              <Progress value={r} autoTone className="mt-3" />

              <p
                className={cn(
                  'mt-2 text-[12.5px]',
                  restante < 0 ? 'text-neg' : 'text-ink-faint',
                )}
              >
                {restante < 0
                  ? `Te pasaste ${money(Math.abs(restante))}`
                  : `Te quedan ${money(restante)} este mes`}
              </p>
            </Card>
          ))}
        </div>

        <Button full variant="secondary" size="lg" className="mt-3" onClick={() => setCreando(true)}>
          <Plus className="size-[18px]" strokeWidth={2.1} />
          Agregar categoría
        </Button>

        <AdSlot />
      </Screen>

      <CategoriaSheet open={creando} onClose={() => setCreando(false)} />
      <CategoriaSheet
        open={Boolean(editando)}
        onClose={() => setEditando(null)}
        categoria={editando}
      />
    </>
  )
}

/* ── Alta y edición de categoría ───────────────────────────────────────── */

function CategoriaSheet({
  open,
  onClose,
  categoria,
}: {
  open: boolean
  onClose: () => void
  categoria?: Categoria | null
}) {
  const toast = useToast()
  const editando = Boolean(categoria)
  const [confirmando, setConfirmando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [icono, setIcono] = useState('carrito')
  const [color, setColor] = useState<CategoriaColor>('accent')
  const [limite, setLimite] = useState<number | null>(null)
  const [error, setError] = useState<string>()

  // `key` en el Sheet fuerza el remonte, pero el estado vive acá: sincronizamos
  // al abrir para que editar dos categorías seguidas no arrastre la anterior.
  const [ultimoId, setUltimoId] = useState<string | null>(null)
  const idActual = categoria?.id ?? null
  if (open && idActual !== ultimoId) {
    setUltimoId(idActual)
    setNombre(categoria?.nombre ?? '')
    setIcono(categoria?.icono ?? 'carrito')
    setColor(categoria?.color ?? 'accent')
    setLimite(categoria?.limite ?? null)
    setError(undefined)
  }

  function guardar() {
    if (nombre.trim().length < 2) return setError('Poné un nombre')
    const datos = { nombre: nombre.trim(), icono, color, limite: limite ?? 0 }
    if (categoria) {
      updateCategoria(categoria.id, datos)
      toast('Categoría actualizada')
    } else {
      addCategoria(datos)
      toast('Categoría creada')
    }
    onClose()
  }

  function eliminar() {
    if (!categoria) return
    const copia = categoria
    removeCategoria(copia.id)
    onClose()
    toast('Categoría eliminada', {
      tono: 'aviso',
      deshacer: () => restoreCategoria(copia),
    })
  }

  return (
    <>
    <Sheet
      open={open}
      onClose={onClose}
      title={editando ? 'Editar categoría' : 'Nueva categoría'}
      footer={
        <div className="flex gap-2.5">
          {editando && (
            <Button
              variant="danger"
              size="lg"
              onClick={() => setConfirmando(true)}
              aria-label="Eliminar categoría"
            >
              <Trash2 className="size-[18px]" strokeWidth={1.9} />
            </Button>
          )}
          <Button full size="lg" onClick={guardar}>
            {editando ? 'Guardar cambios' : 'Crear categoría'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Input
          label="Nombre"
          placeholder="Ej. Mascotas"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          error={error}
        />

        <MoneyInput
          label="Límite mensual"
          hint="Dejalo vacío si no querés que tenga presupuesto."
          value={limite}
          onChange={setLimite}
        />

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {COLORES_CATEGORIA.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => setColor(c)}
                className={cn(
                  'rounded-xl p-0.5 transition-shadow',
                  color === c && 'ring-2 ring-accent-hi ring-offset-2 ring-offset-surface',
                )}
              >
                <IconChip icon={iconoDe(icono)} color={c} size="sm" />
              </button>
            ))}
          </div>
        </Field>

        <Field label="Ícono">
          <div className="grid grid-cols-6 gap-2">
            {ICONOS_ELEGIBLES.map((nombreIcono) => {
              const Icon = iconoDe(nombreIcono)
              const activo = nombreIcono === icono
              return (
                <button
                  key={nombreIcono}
                  type="button"
                  aria-label={nombreIcono}
                  onClick={() => setIcono(nombreIcono)}
                  className={cn(
                    'grid aspect-square place-items-center rounded-xl border transition-colors',
                    activo
                      ? 'border-accent-hi bg-accent-dim text-accent-hi'
                      : 'border-line bg-surface-2 text-ink-faint hover:bg-surface-3 hover:text-ink-muted',
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.9} />
                </button>
              )
            })}
          </div>
        </Field>
      </div>
    </Sheet>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={eliminar}
        title="¿Eliminar esta categoría?"
        description={
          categoria
            ? `Se va a borrar “${categoria.nombre}”. Los movimientos que la usaban quedan sin categoría. Vas a poder deshacerlo por unos segundos desde el aviso.`
            : undefined
        }
        confirmLabel="Eliminar"
      />
    </>
  )
}
