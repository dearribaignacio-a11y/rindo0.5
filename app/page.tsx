import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/** Sólo decide a dónde mandar según haya o no sesión — el contenido real
 *  vive en `/login` (público) y `/dashboard` (protegido). */
export default async function Page() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? '/dashboard' : '/login')
}
