import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Corre en todas las rutas menos assets estáticos y las de Next: ahí no
     * hay sesión que refrescar y sólo suma latencia. El manifest, los
     * íconos y el service worker (ver app/manifest.ts, app/icon*.tsx,
     * public/sw.js) también quedan afuera a propósito: el navegador los
     * pide sin sesión para decidir si la app es instalable, y si el
     * middleware los redirigía a /login, nunca se podía instalar.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
