import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Rindo } from '@/screens/Rindo'

/**
 * Única página del dashboard. Todo el estado de la app vive en el cliente
 * (localStorage) por ahora — ver `screens/Rindo.tsx` — pero llegar hasta acá
 * ya requiere una sesión real de Supabase, verificada en el servidor.
 */
export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-dvh bg-bg-sunken">
      <div className="app-col min-h-dvh bg-bg shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <Rindo />
      </div>
    </div>
  )
}
