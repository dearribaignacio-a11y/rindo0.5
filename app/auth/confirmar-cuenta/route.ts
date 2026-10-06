import { NextResponse } from 'next/server'
import { adminOpcional, confirmarPorEmail } from '@/lib/server/cuentas'
import { TOPES, hayCupo, ipDe } from '@/lib/server/limites'
import { emailValido } from '@/lib/validacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Confirma una cuenta que quedó creada sin confirmar (altas de antes de que
 * se sacara el correo de confirmación). Lo usa el login cuando Supabase
 * responde "email not confirmed"; después el navegador reintenta el login,
 * así que sin la contraseña correcta esto no da acceso a nada.
 *
 * Contesta siempre lo mismo, exista o no la cuenta: antes devolvía 404 si el
 * email no estaba registrado, y eso servía para averiguar quién usa Rindo.
 */
export async function POST(req: Request) {
  const { email } = ((await req.json().catch(() => ({}))) ?? {}) as { email?: unknown }
  if (typeof email !== 'string' || !emailValido(email) || email.length > 254) {
    return NextResponse.json({ error: 'Falta el email' }, { status: 400 })
  }

  const admin = adminOpcional()
  if (!admin) return NextResponse.json({ error: 'sin-admin' }, { status: 503 })

  if (!(await hayCupo(`confirmar:${ipDe(req)}`, TOPES.altasPorHora, 3600))) {
    return NextResponse.json({ error: 'demasiados intentos' }, { status: 429 })
  }

  await confirmarPorEmail(admin, email.trim().toLowerCase())
  return NextResponse.json({ ok: true })
}
