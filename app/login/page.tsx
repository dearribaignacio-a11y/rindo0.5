import { redirect } from 'next/navigation'
import { usuarioDeLaSesion } from '@/lib/supabase/server'
import { AuthFlow } from '@/screens/AuthFlow'

export default async function LoginPage() {
  const user = await usuarioDeLaSesion()
  if (user) redirect('/dashboard')

  return (
    <div className="min-h-dvh bg-bg-sunken">
      <div className="app-col min-h-dvh bg-bg shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <AuthFlow />
      </div>
    </div>
  )
}
