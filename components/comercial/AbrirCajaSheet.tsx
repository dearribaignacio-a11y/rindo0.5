'use client'

import { useEffect, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { MoneyInput } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { abrirCaja } from '@/lib/storage'

/**
 * Apertura (o corrección) de la caja del día: cuánto efectivo hay al
 * arrancar. Una vez cargada, `ComercialResumen` la usa para calcular "caja
 * estimada" sumando las ventas en efectivo del día — no descuenta gastos ni
 * reposiciones porque esas todavía no registran con qué se pagaron.
 */
export function AbrirCajaSheet({
  open,
  onClose,
  montoActual,
}: {
  open: boolean
  onClose: () => void
  /** Si ya se abrió la caja hoy, precarga el monto para corregirlo. */
  montoActual?: number
}) {
  const toast = useToast()
  const [monto, setMonto] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (open) setMonto(montoActual ?? null)
  }, [open, montoActual])

  async function guardar() {
    setGuardando(true)
    try {
      await abrirCaja(monto ?? 0)
      toast('Caja abierta')
      onClose()
    } catch {
      toast('No pudimos guardar la apertura. Probá de nuevo.', { tono: 'aviso' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={montoActual !== undefined ? 'Corregir apertura de caja' : 'Abrir caja'}
      subtitle="¿Con cuánto efectivo arrancás hoy?"
      footer={
        <Button full size="lg" loading={guardando} onClick={guardar}>
          Guardar
        </Button>
      }
    >
      <div className="pb-2">
        <MoneyInput label="Monto inicial" autoFocus value={monto} onChange={setMonto} />
      </div>
    </Sheet>
  )
}
