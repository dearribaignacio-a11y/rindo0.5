'use client'

import { useEffect, useMemo, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { IconChip, iconoDe } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import {
  addMovimiento,
  removeMovimiento,
  restoreMovimiento,
  updateMovimiento,
} from '@/lib/storage'
import { hoyISO } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Categoria, Miembro, Movimiento, TipoMovimiento } from '@/lib/types'

/**
 * Alta y edición de un movimiento del hogar. La misma hoja sirve para los dos
 * casos: si viene `movimiento` edita, si no, crea.
 */
export function MovimientoSheet({
  open,
  onClose,
  movimiento,
  categorias,
  miembros,
  tipoInicial = 'gasto',
  categoriaInicial,
}: {
  open: boolean
  onClose: () => void
  movimiento?: Movimiento | null
  categorias: Categoria[]
  miembros: Miembro[]
  tipoInicial?: TipoMovimiento
  categoriaInicial?: string
}) {
  const toast = useToast()
  const editando = Boolean(movimiento)
  const [confirmando, setConfirmando] = useState(false)

  const [tipo, setTipo] = useState<TipoMovimiento>(tipoInicial)
  const [monto, setMonto] = useState<number | null>(null)
  const [categoriaId, setCategoriaId] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(hoyISO())
  const [autorId, setAutorId] = useState('')
  const [error, setError] = useState<string>()

  // Al abrir, sincroniza el formulario con lo que se está editando (o lo
  // resetea para un alta nueva).
  useEffect(() => {
    if (!open) return
    setError(undefined)
    if (movimiento) {
      setTipo(movimiento.tipo)
      setMonto(movimiento.monto)
      setCategoriaId(movimiento.categoriaId)
      setDescripcion(movimiento.descripcion)
      setFecha(movimiento.fecha)
      setAutorId(movimiento.autorId ?? miembros[0]?.id ?? '')
    } else {
      setTipo(tipoInicial)
      setMonto(null)
      setCategoriaId(categoriaInicial ?? '')
      setDescripcion('')
      setFecha(hoyISO())
      setAutorId(miembros[0]?.id ?? '')
    }
  }, [open, movimiento, tipoInicial, categoriaInicial, miembros])

  // Los ingresos y los gastos no comparten categorías útiles: "Sueldo" no es
  // un gasto y "Supermercado" no es un ingreso. Se filtra por heurística de
  // límite (las de ingreso no llevan presupuesto).
  const disponibles = useMemo(() => {
    if (tipo === 'ingreso') {
      const sinLimite = categorias.filter((c) => c.limite === 0)
      return sinLimite.length ? sinLimite : categorias
    }
    return categorias
  }, [categorias, tipo])

  useEffect(() => {
    if (!disponibles.some((c) => c.id === categoriaId)) {
      setCategoriaId(disponibles[0]?.id ?? '')
    }
  }, [disponibles, categoriaId])

  function guardar() {
    if (!monto || monto <= 0) return setError('Poné un monto mayor a cero')
    if (!categoriaId) return setError('Elegí una categoría')

    const datos = {
      tipo,
      monto,
      categoriaId,
      descripcion: descripcion.trim() || (tipo === 'ingreso' ? 'Ingreso' : 'Gasto'),
      fecha,
      autorId: autorId || undefined,
      origen: 'manual' as const,
    }

    if (movimiento) {
      updateMovimiento(movimiento.id, datos)
      toast('Movimiento actualizado')
    } else {
      addMovimiento(datos)
      toast('Movimiento guardado')
    }
    onClose()
  }

  function eliminar() {
    if (!movimiento) return
    // Copia previa: es lo que restaura el "Deshacer".
    const copia = movimiento
    removeMovimiento(copia.id)
    onClose()
    toast('Movimiento eliminado', {
      tono: 'aviso',
      deshacer: () => restoreMovimiento(copia),
    })
  }

  return (
    <>
    <Sheet
      open={open}
      onClose={onClose}
      title={editando ? 'Editar movimiento' : 'Nuevo movimiento'}
      footer={
        <div className="flex gap-2.5">
          {editando && (
            <Button
              variant="danger"
              size="lg"
              onClick={() => setConfirmando(true)}
              aria-label="Eliminar movimiento"
            >
              <Trash2 className="size-[18px]" strokeWidth={1.9} />
            </Button>
          )}
          <Button full size="lg" onClick={guardar}>
            {editando ? 'Guardar cambios' : 'Agregar movimiento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 pb-2">
        <Segmented
          layoutId="tipo-movimiento"
          value={tipo}
          onChange={setTipo}
          opciones={[
            { id: 'gasto', label: 'Gasto' },
            { id: 'ingreso', label: 'Ingreso' },
          ]}
        />

        <MoneyInput label="Monto" value={monto} onChange={setMonto} error={error} autoFocus />

        <Field label="Categoría">
          <div className="grid grid-cols-4 gap-2">
            {disponibles.map((c) => {
              const activa = c.id === categoriaId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoriaId(c.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-input border p-2 transition-colors duration-200',
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
                </button>
              )
            })}
          </div>
        </Field>

        <Input
          label="Descripción"
          placeholder="Ej. Compra semanal"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha">
            <input
              type="date"
              value={fecha}
              max={hoyISO()}
              onChange={(e) => setFecha(e.target.value)}
              className="h-12 w-full rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
            />
          </Field>

          {miembros.length > 1 ? (
            <Select
              label="Cargado por"
              opciones={miembros.map((m) => ({ value: m.id, label: m.nombre }))}
              value={autorId}
              onChange={(e) => setAutorId(e.target.value)}
            />
          ) : (
            <div />
          )}
        </div>
      </div>
    </Sheet>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={eliminar}
        title="¿Eliminar este movimiento?"
        description={
          movimiento
            ? `Se va a borrar “${movimiento.descripcion}”. Vas a poder deshacerlo por unos segundos desde el aviso.`
            : undefined
        }
        confirmLabel="Eliminar"
      />
    </>
  )
}
