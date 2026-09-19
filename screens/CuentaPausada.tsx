'use client'

import { useState } from 'react'
import { AlertTriangle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Screen } from '@/components/ui/Screen'
import { useToast } from '@/components/ui/Toast'
import { NavProvider, useNav } from '@/components/nav'
import { PagarConTarjeta } from '@/screens/PagarConTarjeta'
import { PLANES } from '@/lib/plans'
import { cambiarPlan } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { money } from '@/lib/format'
import type { Perfil } from '@/lib/types'

/**
 * Reemplaza toda la app cuando `cuentaBloqueada(perfil)` da true (ver
 * `lib/plans.ts`): el cobro mensual con la tarjeta guardada falló (vencida,
 * sin fondos, etc.). Se renderiza en vez del shell normal en
 * `screens/Rindo.tsx`, no como una pantalla más de la navegación interna.
 */
export function CuentaPausada({
  perfil,
  onCerrarSesion,
}: {
  perfil: Perfil
  onCerrarSesion: () => void
}) {
  return (
    <NavProvider inicial={{ ruta: 'tabs' }}>
      <Interna perfil={perfil} onCerrarSesion={onCerrarSesion} />
    </NavProvider>
  )
}

function Interna({ perfil, onCerrarSesion }: { perfil: Perfil; onCerrarSesion: () => void }) {
  const nav = useNav()

  // Reintentar el cobro reusa la misma pantalla de carga de tarjeta que usa
  // "Cambiar plan" — es la única otra ruta que esta navegación chica conoce.
  if (nav.actual.ruta === 'pagar-tarjeta') {
    return <PagarConTarjeta />
  }

  return <AvisoBloqueo perfil={perfil} onCerrarSesion={onCerrarSesion} />
}

function AvisoBloqueo({ perfil, onCerrarSesion }: { perfil: Perfil; onCerrarSesion: () => void }) {
  const nav = useNav()
  const toast = useToast()
  const [volviendo, setVolviendo] = useState(false)
  const plan = PLANES[perfil.plan]

  async function cerrarSesion() {
    const supabase = createClient()
    await supabase.auth.signOut()
    onCerrarSesion()
  }

  /** Para quien no quiere seguir pagando: vuelve a Hogar (gratis). La
   *  tarjeta guardada en Mercado Pago queda ahí sin que se le vuelva a
   *  cobrar nada — nada la usa una vez que el plan deja de ser pago. */
  async function volverAHogar() {
    setVolviendo(true)
    try {
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
          No pudimos cobrar el plan {plan.nombre} con tu tarjeta guardada. Actualizala para volver a
          usar Rindo — tus datos siguen ahí, no se borró nada.
        </p>

        <Card className="mt-6 w-full max-w-sm p-4">
          <p className="text-[13px] text-ink-faint">Plan {plan.nombre}</p>
          <p className="tabular mt-1 text-[22px] font-bold text-ink">
            {money(plan.mensual)} <span className="text-[13px] font-normal text-ink-faint">/mes</span>
          </p>
        </Card>

        <Button
          full
          size="lg"
          className="mt-6 max-w-sm"
          onClick={() => nav.push('pagar-tarjeta', { plan: perfil.plan, ciclo: 'mensual' })}
        >
          Actualizar tarjeta y pagar
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
