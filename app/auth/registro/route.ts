import { NextResponse } from 'next/server'
import { adminOpcional, confirmarPorEmail } from '@/lib/server/cuentas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Cuerpo {
  email?: string
  password?: string
  data?: Record<string, unknown>
}

/**
 * Crea la cuenta ya confirmada (ver `lib/server/cuentas.ts`). No abre sesión:
 * eso lo hace el navegador con `signInWithPassword()` para que las cookies
 * queden escritas donde corresponde.
 *
 * Respuestas:
 * - 200 `{ ok: true }`: cuenta creada, o ya existía (y quedó confirmada). En
 *   el segundo caso el login posterior decide si la contraseña es la suya.
 * - 503 `{ error: 'sin-admin' }`: falta la Service Role Key; el navegador
 *   cae al `signUp()` de siempre.
 */
export async function POST(req: Request) {
  const { email, password, data } = (await req.json()) as Cuerpo
  if (!email || !password) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  const admin = adminOpcional()
  if (!admin) return NextResponse.json({ error: 'sin-admin' }, { status: 503 })

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: data ?? {},
  })

  if (!error) return NextResponse.json({ ok: true, nueva: true })

  const msg = error.message.toLowerCase()
  if (msg.includes('already') || error.status === 422) {
    await confirmarPorEmail(admin, email)
    return NextResponse.json({ ok: true, nueva: false })
  }

  // `status` viene en 0 cuando ni siquiera se pudo llegar a Supabase.
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502
  return NextResponse.json({ error: error.message }, { status })
}
