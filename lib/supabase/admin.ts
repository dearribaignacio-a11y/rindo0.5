import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Cliente de Supabase con la Service Role Key: ignora RLS y los grants de
 * columna de `profiles` (ver `0004_suscripcion.sql`).
 *
 * SOLO se importa desde el webhook de Mercado Pago (`app/api/mercadopago/**`),
 * nunca desde código que corra en el navegador — es lo único que puede
 * marcar una cuenta como "al día" o "bloqueada" después de un cobro real.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('Falta SUPABASE_SERVICE_ROLE_KEY en el servidor')

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
