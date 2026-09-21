'use client'

import { useEffect, useState } from 'react'
import { CardNumber, ExpirationDate, SecurityCode, createCardToken, initMercadoPago } from '@mercadopago/sdk-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Field } from '@/components/ui/Field'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Segmented } from '@/components/ui/Segmented'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { PLANES, montoPorMeses } from '@/lib/plans'
import { hidratarPerfil } from '@/lib/storage'
import { money } from '@/lib/format'
import type { PlanId } from '@/lib/types'

const OPCIONES_MESES = [
  { id: '1', label: '1 mes' },
  { id: '3', label: '3 meses' },
  { id: '6', label: '6 meses' },
  { id: '12', label: '12 meses' },
] as const

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
  const params = nav.actual.params as { plan?: PlanId; diferencia?: number } | undefined
  const plan = params?.plan && params.plan !== 'hogar' ? params.plan : 'comercial'
  const def = PLANES[plan]
  // Si viene `diferencia`, es un cambio entre dos planes pagos a mitad de
  // período: se cobra ese monto fijo (ya prorrateado) en vez de elegir meses.
  const esDiferencia = typeof params?.diferencia === 'number'

  const [listo, setListo] = useState(false)
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [meses, setMeses] = useState<'1' | '3' | '6' | '12'>('1')
  const [procesando, setProcesando] = useState(false)
  const monto = esDiferencia ? (params!.diferencia as number) : montoPorMeses(plan, Number(meses))

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
          ...(esDiferencia ? { diferencia: params!.diferencia } : { meses: Number(meses) }),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detalle || data.error || 'error')
      await hidratarPerfil().catch(() => {})
      toast(
        esDiferencia
          ? `¡Listo! Ahora estás en el plan ${def.nombre}`
          : meses === '1'
            ? `¡Listo! Ahora estás en el plan ${def.nombre}`
            : `¡Listo! Plan ${def.nombre} pagado por ${meses} meses`,
      )
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
        title={esDiferencia ? `Cambiar a ${def.nombre}` : `Pagar plan ${def.nombre}`}
        subtitle={esDiferencia ? 'Diferencia por lo que ya pagaste' : money(def.mensual) + ' / mes'}
        onBack={nav.pop}
      />

      <p className="mb-4 text-[12.5px] leading-relaxed text-ink-faint">
        {esDiferencia
          ? 'Ya pagaste días del plan anterior, así que sólo se cobra la diferencia por lo que queda del período — no todo de nuevo. El número de tarjeta nunca pasa por nuestros servidores.'
          : 'El número de tarjeta nunca pasa por nuestros servidores. Como no queda guardada, vas a tener que volver a cargarla cuando toque pagar de nuevo — para no hacerlo tan seguido, podés pagar varios meses de una vez.'}
      </p>

      {listo && (
        <div className="space-y-4">
          {!esDiferencia && (
            <Field label="¿Cuántos meses querés pagar?">
              <Segmented
                layoutId="meses-pago"
                value={meses}
                onChange={setMeses}
                opciones={[...OPCIONES_MESES]}
                semantica="radio"
                etiqueta="Cantidad de meses a pagar"
              />
            </Field>
          )}

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

          {!esDiferencia && (
            <p className="text-center text-[12.5px] text-ink-faint">
              {meses === '1'
                ? `Válido por 1 mes — próximo pago en 1 mes.`
                : `Válido por ${meses} meses — próximo pago recién dentro de ${meses} meses.`}
              {meses === '12' && ' Precio anual con 2 meses gratis.'}
            </p>
          )}

          <Button full size="lg" loading={procesando} onClick={pagar}>
            Pagar {money(monto)}
          </Button>
        </div>
      )}
    </Screen>
  )
}
