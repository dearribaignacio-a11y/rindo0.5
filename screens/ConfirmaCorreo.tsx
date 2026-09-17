'use client'

import { MailCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Logo } from '@/components/ui/Logo'

/**
 * Pantalla mostrada después de un alta exitosa cuando Supabase todavía no
 * abrió sesión — es decir, cuando el proyecto tiene la confirmación de email
 * activada y hace falta que el usuario toque el link que le llegó por correo.
 */
export function ConfirmaCorreo({
  email,
  onVolverLogin,
}: {
  email: string
  onVolverLogin: () => void
}) {
  return (
    <div className="flex min-h-dvh w-full flex-col items-center justify-center px-5 pb-16 pt-14 text-center sm:px-6">
      <Logo size="lg" />

      <div className="mt-10 grid size-16 place-items-center rounded-full border border-accent-hi/30 bg-accent-dim text-accent-hi">
        <MailCheck className="size-7" strokeWidth={1.8} />
      </div>

      <h1 className="mt-6 text-[24px] font-semibold leading-tight tracking-[-0.025em] text-ink">
        Confirmá tu correo
      </h1>
      <p className="mt-3 max-w-[38ch] text-[15px] leading-relaxed text-ink-muted">
        Te mandamos un link de confirmación a <span className="text-ink">{email}</span>. Tocalo
        para activar tu cuenta y después iniciá sesión.
      </p>

      <Button size="lg" className="mt-8" onClick={onVolverLogin}>
        Volver a ingresar
      </Button>

      <p className="mt-4 text-[12.5px] leading-relaxed text-ink-faint">
        Si no lo ves, revisá también la carpeta de correo no deseado.
      </p>
    </div>
  )
}
