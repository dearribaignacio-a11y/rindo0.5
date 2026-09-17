import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './types'

/** Cliente de Supabase para Client Components. Una instancia por import: el
 *  propio paquete cachea la conexión, no hace falta memoizarla nosotros. */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
