import { NextResponse } from 'next/server'
import { adminOpcional, confirmarPorEmail } from '@/lib/server/cuentas'
import { TOPES, hayCupo, ipDe } from '@/lib/server/limites'
import { emailValido, passwordValida } from '@/lib/validacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Cuerpo {
  email?: unknown
  password?: unknown
  data?: Record<string, unknown>
}

const PLANES_DB = ['hogar', 'comercial', 'comercial_pro']

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : undefined)

/**
 * Crea la cuenta ya confirmada (ver `lib/server/cuentas.ts`). No abre sesión:
 * eso lo hace el navegador con `signInWithPassword()` para que las cookies
 * queden escritas donde corresponde.
 *
 * Como usa la Service Role Key, esto se saltea el límite de altas que
 * Supabase aplica por su cuenta: por eso el tope por IP y la validación de
 * contraseña viven acá (si no, un bot creaba miles de cuentas, cada una con
 * su mes gratis de Comercial Pro y acceso a la IA).
 *
 * Respuestas:
 * - 200 `{ ok: true }`: cuenta creada, o ya existía (y quedó confirmada). En
 *   el segundo caso el login posterior decide si la contraseña es la suya.
 * - 429: demasiadas altas desde la misma conexión.
 * - 503 `{ error: 'sin-admin' }`: falta la Service Role Key; el navegador
 *   cae al `signUp()` de siempre.
 */
export async function POST(req: Request) {
  const cuerpo = (await req.json().catch(() => null)) as Cuerpo | null
  const email = texto(cuerpo?.email, 254)?.toLowerCase()
  const password = typeof cuerpo?.password === 'string' ? cuerpo.password : ''

  if (!email || !emailValido(email)) {
    return NextResponse.json({ error: 'email inválido' }, { status: 400 })
  }
  // 72: el máximo que Supabase guarda de una contraseña.
  if (!passwordValida(password) || password.length > 72) {
    return NextResponse.json({ error: 'password débil' }, { status: 400 })
  }

  const admin = adminOpcional()
  if (!admin) return NextResponse.json({ error: 'sin-admin' }, { status: 503 })

  if (!(await hayCupo(`alta:${ipDe(req)}`, TOPES.altasPorHora, 3600))) {
    return NextResponse.json({ error: 'demasiados intentos' }, { status: 429 })
  }

  // Sólo los datos que lee el trigger `handle_new_user`, recortados.
  const data = cuerpo?.data ?? {}
  const plan = typeof data.plan === 'string' && PLANES_DB.includes(data.plan) ? data.plan : 'hogar'
  const metadatos = {
    nombre_apellido: texto(data.nombre_apellido, 120) ?? '',
    nombre_negocio: texto(data.nombre_negocio, 120) || null,
    telefono: texto(data.telefono, 40) ?? '',
    plan,
  }

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadatos,
  })

  if (!error) return NextResponse.json({ ok: true, nueva: true })

  const msg = error.message.toLowerCase()
  if (msg.includes('already') || error.status === 422) {
    await confirmarPorEmail(admin, email)
    return NextResponse.json({ ok: true, nueva: false })
  }

  console.error('[registro]', error.message)
  // `status` viene en 0 cuando ni siquiera se pudo llegar a Supabase.
  const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502
  return NextResponse.json({ error: 'No pudimos crear la cuenta' }, { status })
}
