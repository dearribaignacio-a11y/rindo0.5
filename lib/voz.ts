'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/* ── Tipos mínimos de la Web Speech API ───────────────────────────────────
   TypeScript no la incluye en lib.dom: sólo declaramos lo que se usa acá. */

interface ResultadoDeVoz {
  transcript: string
}

interface ListaDeResultados {
  length: number
  [index: number]: { length: number; isFinal: boolean; [alt: number]: ResultadoDeVoz }
}

interface EventoResultado extends Event {
  results: ListaDeResultados
}

interface EventoErrorVoz extends Event {
  error: string
}

interface MotorReconocimiento extends EventTarget {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start(): void
  stop(): void
  onresult: ((ev: EventoResultado) => void) | null
  onerror: ((ev: EventoErrorVoz) => void) | null
  onend: (() => void) | null
}

function ctorDisponible(): (new () => MotorReconocimiento) | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: new () => MotorReconocimiento
    webkitSpeechRecognition?: new () => MotorReconocimiento
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export type MotivoErrorVoz = 'permiso' | 'silencio' | 'otro'

/**
 * Dictado por voz para cargar ventas rápido en el mostrador, con el
 * reconocimiento de voz del propio navegador (Web Speech API) — sin costo ni
 * servidor propio para transcribir. Sólo anda en navegadores con motor
 * Chromium (Chrome y el navegador de Android en particular, que es el uso
 * real esperado: un celular atrás del mostrador). En el resto (Firefox,
 * Safari de escritorio), `soportado` da `false` y quien use esto no debería
 * mostrar el botón de micrófono.
 *
 * En `es-AR`, una sola tanda por vez (no queda escuchando en continuo): se
 * toca el micrófono, se dice una frase, y en cuanto el navegador reconoce
 * una pausa entrega el texto final por `onResultado`.
 */
export function useReconocimientoVoz(opts: {
  onResultado: (texto: string) => void
  onError?: (motivo: MotivoErrorVoz) => void
}) {
  const [escuchando, setEscuchando] = useState(false)
  const [soportado, setSoportado] = useState(false)
  const motorRef = useRef<MotorReconocimiento | null>(null)

  // Refs para no tener que recrear `iniciar` cada vez que cambian las props.
  const onResultadoRef = useRef(opts.onResultado)
  onResultadoRef.current = opts.onResultado
  const onErrorRef = useRef(opts.onError)
  onErrorRef.current = opts.onError

  useEffect(() => {
    setSoportado(ctorDisponible() !== null)
  }, [])

  const iniciar = useCallback(() => {
    const Ctor = ctorDisponible()
    if (!Ctor) return

    const motor = new Ctor()
    motor.lang = 'es-AR'
    motor.continuous = false
    motor.interimResults = false
    motor.maxAlternatives = 1

    motor.onresult = (ev) => {
      const ultimo = ev.results[ev.results.length - 1]
      const texto = ultimo?.[0]?.transcript
      if (texto?.trim()) onResultadoRef.current(texto.trim())
    }
    motor.onerror = (ev) => {
      setEscuchando(false)
      const motivo: MotivoErrorVoz =
        ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
          ? 'permiso'
          : ev.error === 'no-speech'
            ? 'silencio'
            : 'otro'
      onErrorRef.current?.(motivo)
    }
    motor.onend = () => setEscuchando(false)

    motorRef.current = motor
    setEscuchando(true)
    motor.start()
  }, [])

  const detener = useCallback(() => {
    motorRef.current?.stop()
  }, [])

  // Si el componente se desmonta a mitad de una escucha (se cambió de
  // pantalla), no queremos que el micrófono del teléfono siga prendido.
  useEffect(() => () => motorRef.current?.stop(), [])

  return { escuchando, soportado, iniciar, detener }
}
