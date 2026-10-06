import 'server-only'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { planDesdeDB } from '@/lib/supabase/types'
import { esComercial } from '@/lib/plans'
import type { PlanId } from '@/lib/types'
import { hayCupoIA } from './limites'

type Resultado = { ok: true; userId: string } | { ok: false; respuesta: NextResponse }

const negar = (status: number, error: string): Resultado => ({
  ok: false,
  respuesta: NextResponse.json({ error }, { status }),
})

/**
 * Chequeo común de las rutas que usan la IA (cada llamada se paga en la
 * cuenta de Anthropic): sesión válida, cuenta no pausada, el plan que pide
 * la función y que no se haya pasado del tope de uso. Antes estas rutas no
 * miraban nada de esto — sólo las frenaba, de casualidad, el middleware.
 */
export async function autorizarIA(opts: {
  /** Planes que pueden usar esta función. Sin especificar: cualquiera. */
  planes?: PlanId[]
  /** `false` cuando no se va a llamar a la IA (modo simulado): no gasta cupo. */
  consumeCupo: boolean
}): Promise<Resultado> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return negar(401, 'Iniciá sesión para usar esta función.')

  const { data: perfil } = await supabase
    .from('profiles')
    .select('plan, suscripcion_activa')
    .eq('id', user.id)
    .maybeSingle()
  if (!perfil) return negar(403, 'No encontramos tu cuenta.')

  const plan = planDesdeDB(perfil.plan)
  if (esComercial(plan) && !perfil.suscripcion_activa) {
    return negar(403, 'Tu cuenta está pausada. Pagá el plan para seguir usando esta función.')
  }
  if (opts.planes && !opts.planes.includes(plan)) {
    return negar(403, 'Esta función no está incluida en tu plan.')
  }

  if (opts.consumeCupo && !(await hayCupoIA(user.id))) {
    return negar(429, 'Llegaste al tope de usos de la IA por ahora. Probá de nuevo en un rato.')
  }

  return { ok: true, userId: user.id }
}
