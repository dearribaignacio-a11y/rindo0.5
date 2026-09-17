'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { ScreenTransition } from '@/components/ScreenTransition'
import { Login } from '@/screens/Login'
import { SetupWizard } from '@/screens/SetupWizard'
import { ConfirmaCorreo } from '@/screens/ConfirmaCorreo'
import type { PlanId } from '@/lib/types'

type Fase =
  | { tipo: 'login' }
  | { tipo: 'setup'; plan: PlanId; email: string; password: string }
  | { tipo: 'confirmar'; email: string }

/**
 * Orquesta el flujo público de autenticación dentro de la ruta `/login`:
 * credenciales → (si es alta) plan → datos del negocio → confirmación de
 * email. El alta real y el login contra Supabase viven en `Login` y
 * `SetupWizard`; acá sólo se decide qué pantalla mostrar.
 */
export function AuthFlow() {
  const router = useRouter()
  const [fase, setFase] = useState<Fase>({ tipo: 'login' })

  function irAlDashboard() {
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {fase.tipo === 'login' && (
        <ScreenTransition key="login">
          <Login
            onIngreso={irAlDashboard}
            onCrearCuenta={(plan, email, password) => setFase({ tipo: 'setup', plan, email, password })}
          />
        </ScreenTransition>
      )}

      {fase.tipo === 'setup' && (
        <ScreenTransition key="setup">
          <SetupWizard
            plan={fase.plan}
            email={fase.email}
            password={fase.password}
            onVolver={() => setFase({ tipo: 'login' })}
            onCreada={(necesitaConfirmar) =>
              necesitaConfirmar ? setFase({ tipo: 'confirmar', email: fase.email }) : irAlDashboard()
            }
          />
        </ScreenTransition>
      )}

      {fase.tipo === 'confirmar' && (
        <ScreenTransition key="confirmar">
          <ConfirmaCorreo email={fase.email} onVolverLogin={() => setFase({ tipo: 'login' })} />
        </ScreenTransition>
      )}
    </AnimatePresence>
  )
}
