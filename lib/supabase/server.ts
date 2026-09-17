import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './types'

/** Cliente de Supabase para Server Components, Server Actions y Route
 *  Handlers. Se crea uno nuevo por request: lee y escribe las cookies de
 *  sesión de ese request puntual. */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Un Server Component no puede escribir cookies — el middleware
            // ya se encarga de refrescar la sesión en cada request.
          }
        },
      },
    },
  )
}
