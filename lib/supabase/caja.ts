import { createClient } from './client'
import type { AperturaCaja } from '@/lib/types'

async function usuarioActual() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa')
  return { supabase, user }
}

/** Trae la apertura de caja de una fecha puntual (normalmente hoy), o `null`
 *  si todavía no se cargó ninguna ese día. */
export async function fetchApertura(fecha: string): Promise<AperturaCaja | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('aperturas_caja')
    .select('*')
    .eq('fecha', fecha)
    .maybeSingle()
  if (error) throw error
  return data ? { fecha: data.fecha, montoInicial: Number(data.monto_inicial) } : null
}

/** Guarda (o corrige) la apertura de una fecha — una por cuenta y día, así
 *  que volver a guardarla el mismo día actualiza en vez de duplicar. */
export async function guardarApertura(fecha: string, montoInicial: number): Promise<AperturaCaja> {
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('aperturas_caja')
    .upsert(
      { user_id: user.id, fecha, monto_inicial: montoInicial },
      { onConflict: 'user_id,fecha' },
    )
    .select()
    .single()
  if (error) throw error
  return { fecha: data.fecha, montoInicial: Number(data.monto_inicial) }
}
