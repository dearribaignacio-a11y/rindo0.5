'use client'

import { useEffect, useState } from 'react'
import { Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MoneyInput } from '@/components/ui/Field'
import { Switch } from '@/components/ui/Switch'
import { Sheet } from '@/components/ui/Sheet'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Empty, Badge, Avatar } from '@/components/ui/Bits'
import { Fab } from '@/components/ui/Fab'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { addEmpleado, removeEmpleado, updateEmpleado } from '@/lib/storage'
import { costoEmpleado } from '@/lib/calc'
import { fechaCorta, hoyISO, money } from '@/lib/format'
import type { DB, Empleado } from '@/lib/types'

export function Empleados({ db }: { db: DB }) {
  const nav = useNav()
  const [creando, setCreando] = useState(false)
  const [editando, setEditando] = useState<Empleado | null>(null)

  return (
    <>
      <Screen pad="fab">
        <TopBar title="Empleados" onBack={nav.pop} />

        {db.empleados.length === 0 ? (
          <Empty
            icon={UsersRound}
            title="Sin empleados cargados"
            hint="Agregalos con el + para llevar el costo de personal ordenado."
          />
        ) : (
          <Card className="py-1">
            {db.empleados.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setEditando(e)}
                className="flex w-full items-center gap-3 border-b border-line py-2.5 text-left last:border-0"
              >
                <Avatar nombre={e.nombre} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14.5px] font-medium text-ink">{e.nombre}</p>
                  <p className="truncate text-[12.5px] text-ink-faint">{e.puesto}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="tabular text-[14.5px] font-semibold text-ink">{money(costoEmpleado(e))}</p>
                  {!e.activo && (
                    <Badge tone="neutral" className="mt-0.5">
                      Inactivo
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </Card>
        )}
      </Screen>

      <Fab label="Agregar empleado" icon={UserPlus} onClick={() => setCreando(true)} />

      <EmpleadoSheet open={creando} onClose={() => setCreando(false)} />
      <EmpleadoSheet open={Boolean(editando)} onClose={() => setEditando(null)} empleado={editando} />
    </>
  )
}

function EmpleadoSheet({
  open,
  onClose,
  empleado,
}: {
  open: boolean
  onClose: () => void
  empleado?: Empleado | null
}) {
  const toast = useToast()
  const editando = Boolean(empleado)
  const [confirmando, setConfirmando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [nombre, setNombre] = useState('')
  const [puesto, setPuesto] = useState('')
  const [telefono, setTelefono] = useState('')
  const [sueldo, setSueldo] = useState<number | null>(null)
  const [activo, setActivo] = useState(true)
  const [error, setError] = useState<string>()

  useEffect(() => {
    if (!open) return
    setError(undefined)
    if (empleado) {
      setNombre(empleado.nombre)
      setPuesto(empleado.puesto)
      setTelefono(empleado.telefono ?? '')
      setSueldo(empleado.sueldo)
      setActivo(empleado.activo)
    } else {
      setNombre('')
      setPuesto('')
      setTelefono('')
      setSueldo(null)
      setActivo(true)
    }
  }, [open, empleado])

  async function guardar() {
    if (!nombre.trim()) return setError('Ponele un nombre')

    const datos = {
      nombre: nombre.trim(),
      puesto: puesto.trim() || 'Empleado',
      telefono: telefono.trim() || undefined,
      sueldo,
      activo,
      ingreso: empleado?.ingreso ?? hoyISO(),
    }

    setGuardando(true)
    try {
      if (empleado) {
        await updateEmpleado(empleado.id, datos)
        toast('Empleado actualizado')
      } else {
        await addEmpleado(datos)
        toast('Empleado agregado')
      }
      onClose()
    } catch {
      toast('No pudimos guardar el empleado. Probá de nuevo.', { tono: 'aviso' })
    } finally {
      setGuardando(false)
    }
  }

  async function eliminar() {
    if (!empleado) return
    try {
      await removeEmpleado(empleado.id)
      onClose()
      toast('Empleado eliminado', { tono: 'aviso' })
    } catch {
      toast('No pudimos eliminar el empleado. Probá de nuevo.', { tono: 'aviso' })
    }
  }

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editando ? 'Editar empleado' : 'Nuevo empleado'}
        footer={
          <div className="flex gap-2.5">
            {editando && (
              <Button variant="danger" size="lg" onClick={() => setConfirmando(true)} aria-label="Eliminar empleado">
                <Trash2 className="size-[18px]" strokeWidth={1.9} />
              </Button>
            )}
            <Button full size="lg" loading={guardando} onClick={guardar}>
              {editando ? 'Guardar cambios' : 'Agregar empleado'}
            </Button>
          </div>
        }
      >
        <div className="space-y-4 pb-2">
          <Input label="Nombre" placeholder="Ej. Martina Gómez" value={nombre} onChange={(e) => setNombre(e.target.value)} error={error} />
          <Input label="Puesto" placeholder="Ej. Vendedora" value={puesto} onChange={(e) => setPuesto(e.target.value)} />
          <Input label="Teléfono" placeholder="Ej. 264 555 1234" inputMode="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          <MoneyInput label="Sueldo mensual (opcional)" value={sueldo} onChange={setSueldo} hint="Sin cargas sociales — se calculan solas en el resumen de costos" />
          {editando && (
            <div className="flex items-center justify-between rounded-input border border-line-strong bg-surface-2 px-3.5 py-3">
              <span className="text-[14px] text-ink">Activo</span>
              <Switch checked={activo} onChange={setActivo} label="Empleado activo" />
            </div>
          )}
          {sueldo && sueldo > 0 && (
            <p className="text-[12.5px] text-ink-faint">
              Costo real estimado (con cargas sociales): <span className="font-medium text-ink">{money(sueldo * 1.38)}</span> por mes
            </p>
          )}
          {empleado && (
            <p className="text-[12px] text-ink-faint">Ingresó el {fechaCorta(empleado.ingreso)}</p>
          )}
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={eliminar}
        title="¿Eliminar este empleado?"
        description={empleado ? `Se va a borrar a “${empleado.nombre}” de la lista.` : undefined}
      />
    </>
  )
}
