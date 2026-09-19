import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * TEMPORAL — solo para conseguir un usuario de prueba real de Mercado Pago
 * (comprador) sin adivinar el formato del email a mano. Usa el
 * MERCADOPAGO_ACCESS_TOKEN ya cargado para pedirle uno nuevo a la API de MP.
 * Se borra una vez que sirvió para probar el pago end-to-end.
 */
export async function GET() {
  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!accessToken) {
    return NextResponse.json({ error: 'Falta MERCADOPAGO_ACCESS_TOKEN' }, { status: 500 })
  }

  const res = await fetch('https://api.mercadopago.com/users/test_user', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ site_id: 'MLA' }),
  })

  const data = await res.json()
  if (!res.ok) {
    return NextResponse.json({ error: data }, { status: res.status })
  }

  return NextResponse.json({
    email: data.email,
    password: data.password,
    nickname: data.nickname,
  })
}
