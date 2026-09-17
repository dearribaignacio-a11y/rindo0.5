'use client'

import { useEffect, useState } from 'react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { guardarEmpresa } from '@/lib/storage'
import { RUBROS } from '@/lib/seed'
import type { DB } from '@/lib/types'

const MONEDAS = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar (USD)' },
]

/**
 * Datos de la empresa — se completan una sola vez al empezar a usar Rindo y
 * se pueden editar después. A diferencia de Productos/Movimientos/Stock
 * (todavía locales), esto ya vive en Supabase: se guarda directo al
 * confirmar, sin paso de revisión manual, porque es configuración de cuenta,
 * no un movimiento financiero.
 */
export function MiNegocio({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const empresa = db.empresa

  const [razonSocial, setRazonSocial] = useState('')
  const [cuitCuil, setCuitCuil] = useState('')
  const [direccion, setDireccion] = useState('')
  const [rubro, setRubro] = useState('Almacén')
  const [moneda, setMoneda] = useState('ARS')
  const [error, setError] = useState<string>()
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!empresa) return
    setRazonSocial(empresa.razonSocial)
    setCuitCuil(empresa.cuitCuil ?? '')
    setDireccion(empresa.direccion ?? '')
    setRubro(empresa.rubro ?? 'Almacén')
    setMoneda(empresa.moneda)
  }, [empresa])

  async function guardar() {
    if (razonSocial.trim().length < 2) {
      setError('Poné el nombre o razón social del negocio')
      return
    }
    setError(undefined)
    setGuardando(true)
    try {
      await guardarEmpresa({
        razonSocial: razonSocial.trim(),
        cuitCuil: cuitCuil.trim() || undefined,
        direccion: direccion.trim() || undefined,
        rubro,
        moneda,
      })
      toast('Datos del negocio guardados')
    } catch {
      toast('No pudimos guardar los cambios. Probá de nuevo.', { tono: 'aviso' })
    } finally {
      setGuardando(false)
    }
  }

  return (
    <Screen pad="none">
      <TopBar title="Mi Negocio" onBack={nav.pop} />

      <div className="space-y-4">
        <Input
          label="Razón social / nombre del negocio"
          placeholder="Ej. Almacén Don Pedro"
          value={razonSocial}
          onChange={(e) => {
            setRazonSocial(e.target.value)
            if (error) setError(undefined)
          }}
          error={error}
        />
        <Input
          label="CUIT / CUIL"
          placeholder="Ej. 20-12345678-9"
          value={cuitCuil}
          onChange={(e) => setCuitCuil(e.target.value)}
        />
        <Select
          label="Rubro"
          opciones={RUBROS}
          value={rubro}
          onChange={(e) => setRubro(e.target.value)}
        />
        <Input
          label="Dirección"
          placeholder="Ej. San Martín 450, San Juan"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
        />
        <Select
          label="Moneda"
          opciones={MONEDAS}
          value={moneda}
          onChange={(e) => setMoneda(e.target.value)}
        />
      </div>

      <Button full size="lg" className="mt-6" loading={guardando} onClick={guardar}>
        Guardar datos del negocio
      </Button>

      <p className="mt-4 text-center text-[12px] leading-relaxed text-ink-faint">
        Estos datos quedan guardados en tu cuenta — vas a verlos igual desde cualquier
        dispositivo donde inicies sesión.
      </p>
    </Screen>
  )
}
