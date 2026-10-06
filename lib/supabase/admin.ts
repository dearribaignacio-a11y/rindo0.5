import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Cliente de Supabase con la Service Role Key: ignora RLS, los grants de
 * columna de `profiles` (0004) y el trigger `proteger_perfil` (0014).
 *
 * SOLO para código de servidor (`import 'server-only'` hace fallar el build
 * si algún componente del navegador lo llega a importar) — es lo único que
 * puede marcar una cuenta como "al día" o "bloqueada" después de un cobro.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor')

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
