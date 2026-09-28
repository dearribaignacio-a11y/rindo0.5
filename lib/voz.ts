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

/** 'cancelado' = lo cortó el propio usuario o la app; no hace falta avisar. */
export type MotivoErrorVoz = 'permiso' | 'silencio' | 'cancelado' | 'otro'

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
 * una pausa entrega el texto final por `onResultado`. Mientras tanto va
 * pasando lo que entiende por `onParcial`, para mostrarlo en vivo y que se
 * note que está escuchando.
 */
export function useReconocimientoVoz(opts: {
  onResultado: (texto: string) => void
  onParcial?: (texto: string) => void
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
  const onParcialRef = useRef(opts.onParcial)
  onParcialRef.current = opts.onParcial

  useEffect(() => {
    setSoportado(ctorDisponible() !== null)
  }, [])

  const iniciar = useCallback(() => {
    const Ctor = ctorDisponible()
    if (!Ctor) return

    const motor = new Ctor()
    motor.lang = 'es-AR'
    motor.continuous = false
    motor.interimResults = true
    motor.maxAlternatives = 1

    let entregado = false
    motor.onresult = (ev) => {
      let texto = ''
      let final = false
      for (let i = 0; i < ev.results.length; i++) {
        texto += ev.results[i]?.[0]?.transcript ?? ''
        if (ev.results[i]?.isFinal) final = true
      }
      texto = texto.trim()
      if (!texto) return
      if (final && !entregado) {
        entregado = true
        onResultadoRef.current(texto)
      } else if (!final) {
        onParcialRef.current?.(texto)
      }
    }
    motor.onerror = (ev) => {
      setEscuchando(false)
      const motivo: MotivoErrorVoz =
        ev.error === 'not-allowed' || ev.error === 'service-not-allowed'
          ? 'permiso'
          : ev.error === 'no-speech'
            ? 'silencio'
            : ev.error === 'aborted'
              ? 'cancelado'
              : 'otro'
      onErrorRef.current?.(motivo)
    }
    motor.onend = () => setEscuchando(false)

    // Si el asistente estaba hablando, se calla: si no, el micrófono se
    // escucharía a sí mismo.
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel()

    motorRef.current = motor
    setEscuchando(true)
    try {
      motor.start()
    } catch {
      // `start()` tira si ya había una escucha abierta (doble toque rápido).
      setEscuchando(false)
    }
  }, [])

  const detener = useCallback(() => {
    motorRef.current?.stop()
  }, [])

  // Si el componente se desmonta a mitad de una escucha (se cambió de
  // pantalla), no queremos que el micrófono del teléfono siga prendido.
  useEffect(() => () => motorRef.current?.stop(), [])

  return { escuchando, soportado, iniciar, detener }
}

/* ── Respuestas en voz alta ────────────────────────────────────────────────
   Síntesis de voz del propio navegador (speechSynthesis): anda en Chrome,
   Safari (también iPhone) y Firefox, sin servidor ni costo. */

/** Saca lo que no se lee bien en voz alta: emojis, asteriscos, "$". */
function paraLeer(texto: string) {
  return texto
    .replace(/[*_#`>]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '')
    .replace(/\$\s?([\d.,]+)/g, '$1 pesos')
    .trim()
}

function elegirVoz(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices()
  return (
    voces.find((v) => v.lang === 'es-AR') ??
    voces.find((v) => v.lang === 'es-US' || v.lang === 'es-419' || v.lang === 'es-MX') ??
    voces.find((v) => v.lang.toLowerCase().startsWith('es'))
  )
}

export function useLecturaEnVoz() {
  const [soportado, setSoportado] = useState(false)
  const [hablando, setHablando] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setSoportado(true)
    // En Chrome la lista de voces llega tarde; pedirla la dispara.
    window.speechSynthesis.getVoices()
    return () => window.speechSynthesis.cancel()
  }, [])

  /**
   * iPhone sólo deja hablar si la primera lectura sale de un toque del
   * usuario. La respuesta del asistente llega después de un `fetch`, fuera de
   * ese toque, así que "desbloqueamos" la voz en el toque con una lectura muda.
   */
  const preparar = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const u = new SpeechSynthesisUtterance('')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }, [])

  const hablar = useCallback((texto: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const limpio = paraLeer(texto)
    if (!limpio) return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(limpio)
    u.lang = 'es-AR'
    const voz = elegirVoz()
    if (voz) u.voice = voz
    u.rate = 1.05
    u.onstart = () => setHablando(true)
    u.onend = () => setHablando(false)
    u.onerror = () => setHablando(false)
    window.speechSynthesis.speak(u)
  }, [])

  const callar = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    setHablando(false)
  }, [])

  return { soportado, hablando, preparar, hablar, callar }
}
