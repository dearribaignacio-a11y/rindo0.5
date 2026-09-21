'use client'

import { useEffect, useState } from 'react'
import { CardNumber, ExpirationDate, SecurityCode, createCardToken, initMercadoPago } from '@mercadopago/sdk-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Screen, TopBar } from '@/components/ui/Screen'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { PLANES } from '@/lib/plans'
import { hidratarPerfil } from '@/lib/storage'
import { money } from '@/lib/format'
import type { PlanId } from '@/lib/types'

let inicializado = false

/** Estilo de los campos seguros de Mercado Pago (número, vencimiento, CVV):
 *  son iframes de otro dominio, así que no heredan el CSS de la página —
 *  hay que pasarles los valores a mano para que no desentonen. Sin
 *  `height`/`padding` explícitos, el iframe no llena la cajita del
 *  contenedor y el texto queda mal ubicado. */
const ESTILO_CAMPO = {
  color: '#e8e8ea',
  fontSize: '15px',
  placeholderColor: '#6b6b70',
  height: '46px',
  width: '100%',
  padding: '0 14px',
}

/**
 * Pago de un plan pago (alta o renovación mensual/anual). Los tres campos
 * sensibles (número, vencimiento, CVV) son "Secure Fields" de Mercado Pago
 * — iframes que se montan acá pero viven en su dominio, así que ese dato
 * nunca pasa por nuestro código ni por nuestro servidor. `createCardToken`
 * lee esos campos montados y devuelve una ficha de un solo uso, que el
 * servidor usa para cobrar directo (ver `lib/server/mercadopago.ts`).
 *
 * No queda ninguna tarjeta guardada de un mes a otro — hay que volver a
 * cargarla cada vez que toca pagar. Se intentó guardarla para cobrar sola,
 * pero esa función de Mercado Pago (`customer.createCard`) fallaba siempre
 * con "security_code_id can't be null" sin que se pudiera resolver.
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
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
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

  async function pagar() {
    if (!nombre.trim()) return toast('Poné el nombre del titular', 'aviso')
    if (dni.trim().length < 6) return toast('Poné el DNI del titular', 'aviso')

    setProcesando(true)
    try {
      const token = await createCardToken({
        cardholderName: nombre.trim(),
        identificationType: 'DNI',
        identificationNumber: dni.trim(),
      })
      if (!token?.id) throw new Error('No pudimos leer los datos de la tarjeta')

      const res = await fetch('/api/mercadopago/cobrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token.id,
          identificacion: { type: 'DNI', number: dni.trim() },
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
  }

  return (
    <Screen pad="none">
      <TopBar
        title={`Pagar plan ${def.nombre}`}
        subtitle={`${money(monto)} / ${ciclo === 'anual' ? 'año' : 'mes'}`}
        onBack={nav.pop}
      />

      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-faint">
        El número de tarjeta nunca pasa por nuestros servidores. Vas a tener que volver a cargarla
        cada vez que toque pagar (cada {ciclo === 'anual' ? 'año' : 'mes'}) — te vamos a avisar acá en la app.
      </p>

      {listo && (
        <div className="space-y-4">
          <Field label="Número de tarjeta">
            <div className="h-[46px] overflow-hidden rounded-input border border-line-strong bg-surface-2">
              <CardNumber placeholder="1234 1234 1234 1234" style={ESTILO_CAMPO} />
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vencimiento">
              <div className="h-[46px] overflow-hidden rounded-input border border-line-strong bg-surface-2">
                <ExpirationDate mode="short" placeholder="MM/AA" style={ESTILO_CAMPO} />
              </div>
            </Field>
            <Field label="Código de seguridad">
              <div className="h-[46px] overflow-hidden rounded-input border border-line-strong bg-surface-2">
                <SecurityCode placeholder="123" mode="mandatory" style={ESTILO_CAMPO} />
              </div>
            </Field>
          </div>

          <Input
            label="Nombre del titular (como figura en la tarjeta)"
            placeholder="Ej. Juan Pérez"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
          />
          <Input
            label="DNI del titular"
            placeholder="Ej. 30123456"
            inputMode="numeric"
            value={dni}
            onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
          />

          <Button full size="lg" loading={procesando} onClick={pagar}>
            Pagar {money(monto)}
          </Button>
        </div>
      )}
    </Screen>
  )
}
