'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getDB, getServerSnapshot, subscribe } from './storage'
import type { DB } from './types'

/** Suscribe el componente al documento completo. `getDB()` devuelve siempre la
 *  misma referencia hasta que hay una escritura, así que no hay re-render de más. */
export function useDB(): DB {
  return useSyncExternalStore(subscribe, getDB, getServerSnapshot)
}

/** `true` recién después del primer render en el cliente. Todo lo que dependa
 *  de localStorage tiene que esperar esto para no romper la hidratación. */
export function useMontado() {
  const [montado, setMontado] = useState(false)
  useEffect(() => setMontado(true), [])
  return montado
}

/** Copia al portapapeles y devuelve un flag que se apaga solo a los 2s. */
export function useCopiar() {
  const [copiado, setCopiado] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copiar = useCallback(async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
    } catch {
      // Sin permiso de portapapeles igual damos feedback: el usuario puede
      // seleccionar el código a mano.
    }
    setCopiado(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopiado(false), 2000)
  }, [])

  return { copiado, copiar }
}
