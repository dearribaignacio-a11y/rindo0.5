import { redirect } from 'next/navigation'
import { usuarioDeLaSesion } from '@/lib/supabase/server'

/** Sólo decide a dónde mandar según haya o no sesión — el contenido real
 *  vive en `/login` (público) y `/dashboard` (protegido). */
export default async function Page() {
  const user = await usuarioDeLaSesion()
  redirect(user ? '/dashboard' : '/login')
}
