import { NextResponse } from 'next/server'
import { adminOpcional, confirmarPorEmail } from '@/lib/server/cuentas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Confirma una cuenta que quedó creada sin confirmar (altas de antes de que
 * se sacara el correo de confirmación). Lo usa el login cuando Supabase
 * responde "email not confirmed"; después el navegador reintenta el login,
 * así que sin la contraseña correcta esto no da acceso a nada.
 */
export async function POST(req: Request) {
  const { email } = (await req.json()) as { email?: string }
  if (!email) return NextResponse.json({ error: 'Falta el email' }, { status: 400 })

  const admin = adminOpcional()
  if (!admin) return NextResponse.json({ error: 'sin-admin' }, { status: 503 })

  const ok = await confirmarPorEmail(admin, email)
  return NextResponse.json({ ok }, { status: ok ? 200 : 404 })
}
