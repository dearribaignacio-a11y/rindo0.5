'use client'

import { useMemo, useState } from 'react'
import { Info } from 'lucide-react'
import { Logo } from '@/components/ui/Logo'
import { ToastProvider } from '@/components/ui/Toast'
import { useMontado } from '@/lib/hooks'
import { fuenteDemo } from '@/lib/contador/demo'
import { EnviarContador } from '@/screens/comercial/EnviarContador'
import type { Contador } from '@/lib/types'

/* Clave propia: el contador de la demo no se mezcla con el de una cuenta
   real abierta en el mismo navegador (`rindo.db`). */
const KEY = 'rindo.demo.contador'

function leerContador(): Contador | null {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Contador) : null
  } catch {
    return null
  }
}

export function DemoContador() {
  const montado = useMontado()
  // Las fechas de la demo dependen de "hoy": se arma recién en el cliente
  // para no desajustar la hidratación.
  if (!montado) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Logo size="lg" />
      </div>
    )
  }
  return <Demo />
}

function Demo() {
  const fuente = useMemo(() => fuenteDemo(), [])
  const [contador, setContador] = useState<Contador | null>(leerContador)

  return (
    <ToastProvider>
      <EnviarContador
        fuente={fuente}
        contador={contador}
        onGuardarContador={(c) => {
          setContador(c)
          try {
            window.localStorage.setItem(KEY, JSON.stringify(c))
          } catch {
            /* modo privado: queda sólo en memoria */
          }
        }}
        aviso={
          <div className="mb-4 flex items-start gap-2.5 rounded-card border border-line bg-surface px-4 py-3">
            <Info className="mt-0.5 size-4 shrink-0 text-accent-hi" strokeWidth={2} />
            <p className="text-[12.5px] leading-relaxed text-ink-muted">
              Demostración con datos de ejemplo de Print, una librería de San Juan.
            </p>
          </div>
        }
      />
    </ToastProvider>
  )
}
