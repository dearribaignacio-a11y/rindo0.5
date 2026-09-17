import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ActualizarPassword } from '@/screens/ActualizarPassword'

/** Llega acá sólo después de tocar el link de "recuperar contraseña": el
 *  Route Handler de `/auth/confirm` ya abrió una sesión temporal al validar
 *  el token. Sin esa sesión no hay nada que actualizar. */
export default async function ActualizarPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <div className="min-h-dvh bg-bg-sunken">
      <div className="app-col min-h-dvh bg-bg shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <ActualizarPassword />
      </div>
    </div>
  )
}
