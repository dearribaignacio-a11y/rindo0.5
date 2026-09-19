import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cancelarSuscripcion } from '@/lib/server/mercadopago'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Se llama al bajar de un plan pago a Hogar, para no seguir cobrando una
 *  suscripción de un plan que el usuario ya dejó. */
export async function POST() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No hay sesión activa' }, { status: 401 })

  const { data: perfil } = await supabase
    .from('profiles')
    .select('mp_preapproval_id')
    .eq('id', user.id)
    .maybeSingle()

  if (perfil?.mp_preapproval_id) {
    try {
      await cancelarSuscripcion(perfil.mp_preapproval_id)
    } catch (err) {
      console.error('cancelar-suscripcion', err)
      // No es bloqueante: si falla la cancelación en Mercado Pago, igual se
      // deja bajar de plan localmente — se puede cancelar a mano después.
    }
  }

  return NextResponse.json({ ok: true })
}
