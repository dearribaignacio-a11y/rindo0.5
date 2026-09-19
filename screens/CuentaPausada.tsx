'use client'

import { useState } from 'react'
import { AlertTriangle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { useToast } from '@/components/ui/Toast'
import { PLANES } from '@/lib/plans'
import { cambiarPlan } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { money } from '@/lib/format'
import type { Perfil } from '@/lib/types'

/**
 * Pantalla que reemplaza toda la app cuando `cuentaBloqueada(perfil)` da
 * true (ver `lib/plans.ts`): plan pago con la suscripción de Mercado Pago
 * sin autorizar o cancelada. No hay forma de esquivarla desde acá — se
 * renderiza en vez del shell normal en `screens/Rindo.tsx`, no como una
 * pantalla más de la navegación interna.
 */
export function CuentaPausada({
  perfil,
  onCerrarSesion,
}: {
  perfil: Perfil
  onCerrarSesion: () => void
}) {
  const toast = useToast()
  const [cargando, setCargando] = useState(false)
  const [volviendo, setVolviendo] = useState(false)
  const plan = PLANES[perfil.plan]

  async function reactivar() {
    setCargando(true)
    try {
      const res = await fetch('/api/mercadopago/crear-suscripcion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: perfil.plan, ciclo: 'mensual' }),
      })
      const data = await res.json()
      if (!res.ok || !data.initPoint) throw new Error(data.detalle || data.error || 'sin init_point')
      window.location.href = data.initPoint
    } catch (err) {
      const detalle = err instanceof Error ? err.message : undefined
      toast(
        detalle ? `No pudimos iniciar el pago: ${detalle}` : 'No pudimos iniciar el pago. Probá de nuevo en un momento.',
        { tono: 'aviso' },
      )
      setCargando(false)
    }
  }

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onCerrarSesion()
  }

  /** Para quien abrió el pago y se arrepintió, o simplemente no quiere pagar
   *  más: vuelve a Hogar (gratis) y cancela la suscripción pendiente. */
  async function volverAHogar() {
    setVolviendo(true)
    try {
      await fetch('/api/mercadopago/cancelar-suscripcion', { method: 'POST' })
      await cambiarPlan('hogar')
      toast('Volviste al plan Hogar')
    } catch {
      toast('No pudimos cambiar de plan. Probá de nuevo.', { tono: 'aviso' })
      setVolviendo(false)
    }
  }

  return (
    <Screen pad="none">
      <div className="flex min-h-dvh flex-col items-center justify-center text-center">
        <span className="mb-4 grid size-16 place-items-center rounded-2xl border border-warn/40 bg-warn-dim text-warn">
          <AlertTriangle className="size-7" strokeWidth={1.7} />
        </span>
        <h1 className="text-[20px] font-semibold text-ink">Tu cuenta está pausada</h1>
        <p className="mt-2 max-w-[32ch] text-[14px] leading-relaxed text-ink-faint">
          No pudimos confirmar el pago del plan {plan.nombre}. Reactivalo para volver a usar Rindo
          — tus datos siguen ahí, no se borró nada.
        </p>

        <Card className="mt-6 w-full max-w-sm p-4">
          <p className="text-[13px] text-ink-faint">Plan {plan.nombre}</p>
          <p className="tabular mt-1 text-[22px] font-bold text-ink">
            {money(plan.mensual)} <span className="text-[13px] font-normal text-ink-faint">/mes</span>
          </p>
        </Card>

        <Button full size="lg" className="mt-6 max-w-sm" loading={cargando} onClick={reactivar}>
          Reactivar suscripción
        </Button>

        <button
          type="button"
          disabled={volviendo}
          onClick={volverAHogar}
          className="mt-3 text-[13.5px] text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          Prefiero volver al plan Hogar (gratis)
        </button>

        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-5 flex items-center gap-2 text-[13.5px] text-ink-muted transition-colors hover:text-ink"
        >
          <LogOut className="size-4" strokeWidth={1.9} />
          Cerrar sesión
        </button>
      </div>
    </Screen>
  )
}
