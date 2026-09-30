import type { Metadata } from 'next'
import { DemoContador } from './DemoContador'

export const metadata: Metadata = {
  title: 'Enviar al contador — demostración | Rindo',
  robots: { index: false, follow: false },
}

/**
 * Demo pública de "Enviar al contador", sin login, con los datos de ejemplo
 * de Print. Sirve para mostrarle la función a contadores y comerciantes sin
 * crearles una cuenta. Pública a propósito (ver `lib/supabase/middleware.ts`).
 */
export default function Page() {
  return (
    <div className="min-h-dvh bg-bg-sunken">
      <div className="app-col min-h-dvh bg-bg shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <DemoContador />
      </div>
    </div>
  )
}
