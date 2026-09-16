'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, ReceiptText, Trash2 } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field, MoneyInput, Select } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Empty, Badge } from '@/components/ui/Bits'
import { IconChip } from '@/components/ui/Icon'
import { Fab } from '@/components/ui/Fab'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addImpuesto, marcarPagado, removeImpuesto, updateImpuesto } from '@/lib/storage'
import { money, textoVencimiento } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB, Impuesto } from '@/lib/types'

export function Impuestos({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Impuesto | null>(null)

  const ordenados = [...db.impuestos].sort((a, b) => a.vence.localeCompare(b.vence))

  return (
    <>
      <Screen pad="fab">
        <TopBar title="Impuestos" onBack={nav.pop} />

        {db.impuestos.length === 0 ? (
          <Empty
            icon={ReceiptText}
            title="Sin impuestos cargados"
            hint="Agregá los vencimientos del negocio con el + para no perderte ninguno."
          />
        ) : (
          <Card className="py-1">
            {ordenados.map((i) => {
              const vencido = i.estado === 'pendiente' && textoVencimiento(i.vence).startsWith('venció')
              return (
                <div key={i.id} className="flex items-center gap-3 border-b border-line py-2.5 last:border-0">
                  <button
                    type="button"
                    onClick={() => setEditando(i)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    <IconChip icon={ReceiptText} size="sm" color={i.estado === 'pagado' ? 'pos' : vencido ? 'neg' : 'warn'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium text-ink">{i.nombre}</p>
                      <p className={cn('truncate text-[12.5px]', vencido ? 'text-neg' : 'text-ink-faint')}>
                        {i.estado === 'pagado' ? 'Pagado' : textoVencimiento(i.vence)}
                      </p>
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className="tabular text-[14.5px] font-semibold text-ink">{money(i.monto)}</p>
                    {i.estado === 'pendiente' ? (
                      <button
                        type="button"
                        onClick={() => {
                          marcarPagado(i.id)
                          toast('Marcado como pagado')
                        }}
                        className="text-[11.5px] font-medium text-accent-hi transition-colors hover:text-ink"
                      >
                        Marcar pagado
                      </button>
                    ) : (
                      <Badge tone="pos" icon={CheckCircle2}>
                        Al día
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </Screen>

      <Fab label="Agregar impuesto" onClick={() => setCreando(true)} />

      <ImpuestoSheet open={creando} onClose={() => setCreando(false)} />
      <ImpuestoSheet open={Boolean(editando)} onClose={() => setEditando(null)} impuesto={editando} />
    </>
  )
}

function ImpuestoSheet({
  open,
  onClose,
  impuesto,
}: {
  open: boolean
  onClose: () => void
  impuesto?: Impuesto | null
}) {
  const toast = useToast()
  const editando = Boolean(impuesto)
  const [confirmando, setConfirmando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState<number | null>(null)
  const [vence, setVence] = useState('')
  const [periodicidad, setPeriodicidad] = useState<Impuesto['periodicidad']>('mensual')
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setError(undefined)
    if (impuesto) {
      setNombre(impuesto.nombre)
      setMonto(impuesto.monto)
      setVence(impuesto.vence)
      setPeriodicidad(impuesto.periodicidad)
    } else {
      setNombre('')
      setMonto(null)
      setVence('')
      setPeriodicidad('mensual')
    }
  }, [open, impuesto])

  function guardar() {
    if (!nombre.trim()) return setError('Ponele un nombre, ej. Ingresos Brutos')
    if (!monto || monto <= 0) return setError('El monto tiene que ser mayor a cero')
    if (!vence) return setError('Elegí la fecha de vencimiento')

    const datos = {
      nombre: nombre.trim(),
      monto,
      vence,
      periodicidad,
      estado: 'pendiente' as const,
      pagos: impuesto?.pagos ?? [],
    }

    if (impuesto) {
      updateImpuesto(impuesto.id, datos)
      toast('Impuesto actualizado')
    } else {
      addImpuesto(datos)
      toast('Impuesto agregado')
    }
    onClose()
  }

  function eliminar() {
    if (!impuesto) return
    removeImpuesto(impuesto.id)
    onClose()
    toast('Impuesto eliminado', { tono: 'aviso' })
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editando ? 'Editar impuesto' : 'Nuevo impuesto'}
        footer={
          <div className="flex gap-2.5">
            {editando && (
              <Button variant="danger" size="lg" onClick={() => setConfirmando(true)} aria-label="Eliminar impuesto">
                <Trash2 className="size-[18px]" strokeWidth={1.9} />
              </Button>
            )}
            <Button full size="lg" onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Agregar impuesto'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          <Input label="Nombre" placeholder="Ej. Ingresos Brutos" value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} />
          <MoneyInput label="Monto del período" value={monto} onChange={setMonto} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Vence">
              <input
                type="date"
                value={vence}
                onChange={(e) => setVence(e.target.value)}
                className="h-12 w-full rounded-input border border-line-strong bg-surface-2 px-3.5 text-[15px] text-ink focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
              />
            </Field>
            <Select
              label="Periodicidad"
              opciones={[
                { value: 'mensual', label: 'Mensual' },
                { value: 'bimestral', label: 'Bimestral' },
                { value: 'anual', label: 'Anual' },
              ]}
              value={periodicidad}
              onChange={(e) => setPeriodicidad(e.target.value as Impuesto['periodicidad'])}
            />
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={eliminar}
        title="¿Eliminar este impuesto?"
        description={impuesto ? `Se va a borrar “${impuesto.nombre}” de la lista.` : undefined}
      />
    </>
  )
}
