'use client'

import { useEffect, useState } from 'react'
import { CardPayment, initMercadoPago } from '@mercadopago/sdk-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { PLANES } from '@/lib/plans'
import { hidratarPerfil } from '@/lib/storage'
import { money } from '@/lib/format'
import type { PlanId } from '@/lib/types'

let inicializado = false

/**
 * Alta de la tarjeta para un plan pago. El formulario en sí (número, CVV,
 * vencimiento) es el Brick de Mercado Pago — nada de eso pasa por nuestro
 * código ni por nuestro servidor, sólo el token de un solo uso que devuelve
 * al terminar. Ver `lib/server/mercadopago.ts` para lo que pasa después.
 */
export function PagarConTarjeta() {
  const nav = useNav()
  const toast = useToast()
  const params = nav.actual.params as { plan?: PlanId; ciclo?: 'mensual' | 'anual' } | undefined
  const plan = params?.plan && params.plan !== 'hogar' ? params.plan : 'comercial'
  const ciclo = params?.ciclo === 'anual' ? 'anual' : 'mensual'
  const def = PLANES[plan]
  const monto = ciclo === 'anual' ? def.anual : def.mensual

  const [listo, setListo] = useState(false)
  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
    if (!key) return
    if (!inicializado) {
      initMercadoPago(key, { locale: 'es-AR' })
      inicializado = true
    }
    setListo(true)
  }, [])

  if (!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY) {
    return (
      <Screen pad="none">
        <TopBar title="Pagar" onBack={nav.pop} />
        <p className="text-[13.5px] leading-relaxed text-warn">
          Falta configurar el pago con tarjeta en el servidor (NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY).
        </p>
      </Screen>
    )
  }

  return (
    <Screen pad="none">
      <TopBar title={`Pagar plan ${def.nombre}`} subtitle={`${money(monto)} / ${ciclo === 'anual' ? 'año' : 'mes'}`} onBack={nav.pop} />

      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-faint">
        Cargá tu tarjeta una sola vez — el próximo cobro se hace solo cada {ciclo === 'anual' ? 'año' : 'mes'}, sin
        que tengas que volver a hacer nada. El número de tarjeta nunca pasa por nuestros servidores.
      </p>

      {listo && (
        <CardPayment
          initialization={{ amount: monto }}
          locale="es-AR"
          onSubmit={async (datos) => {
            setProcesando(true)
            try {
              const res = await fetch('/api/mercadopago/guardar-tarjeta', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  token: datos.token,
                  paymentMethodId: datos.payment_method_id,
                  issuerId: datos.issuer_id,
                  identificacion: datos.payer?.identification,
                  plan,
                  ciclo,
                }),
              })
              const data = await res.json()
              if (!res.ok) throw new Error(data.detalle || data.error || 'error')
              await hidratarPerfil().catch(() => {})
              toast(`¡Listo! Ahora estás en el plan ${def.nombre}`)
              nav.reset('tabs')
            } catch (err) {
              const detalle = err instanceof Error ? err.message : undefined
              toast(detalle ? `No pudimos procesar el pago: ${detalle}` : 'No pudimos procesar el pago. Probá de nuevo.', {
                tono: 'aviso',
              })
            } finally {
              setProcesando(false)
            }
          }}
          onError={() => {
            toast('Revisá los datos de la tarjeta e intentá de nuevo.', { tono: 'aviso' })
          }}
        />
      )}

      {procesando && (
        <p className="mt-3 text-center text-[13px] text-ink-faint">Procesando el pago…</p>
      )}
    </Screen>
  )
}
