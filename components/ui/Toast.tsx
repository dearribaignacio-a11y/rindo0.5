'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check, Info, Undo2 } from 'lucide-react'
import { cn } from '@/lib/cn'

type Tono = 'ok' | 'aviso' | 'info'

interface Aviso {
  id: number
  texto: string
  tono: Tono
  /** Si viene, el aviso muestra un botón "Deshacer". */
  deshacer?: () => void
}

interface Opciones {
  tono?: Tono
  /** Callback del botón "Deshacer". Alarga la vida del aviso. */
  deshacer?: () => void
}

type Push = (texto: string, opciones?: Tono | Opciones) => void

const Ctx = createContext<Push>(() => {})

/**
 * `toast('Movimiento guardado')` desde cualquier pantalla.
 * Con red de seguridad: `toast('Movimiento eliminado', { tono: 'aviso', deshacer })`.
 */
export const useToast = () => useContext(Ctx)

const ICONOS = { ok: Check, aviso: AlertTriangle, info: Info }
const TONOS = {
  ok: 'border-pos/35 text-pos',
  aviso: 'border-warn/35 text-warn',
  info: 'border-line-strong text-accent-hi',
}

/** Un aviso con acción vive más: hay que darle tiempo al usuario a leerlo y decidir. */
const MS_SIMPLE = 2600
const MS_CON_ACCION = 6000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const seq = useRef(0)
  const timers = useRef(new Map<number, number>())

  const cerrar = useCallback((id: number) => {
    const t = timers.current.get(id)
    if (t) window.clearTimeout(t)
    timers.current.delete(id)
    setAvisos((a) => a.filter((x) => x.id !== id))
  }, [])

  const push = useCallback<Push>(
    (texto, opciones) => {
      const o: Opciones = typeof opciones === 'string' ? { tono: opciones } : (opciones ?? {})
      const id = ++seq.current
      setAvisos((a) => [...a, { id, texto, tono: o.tono ?? 'ok', deshacer: o.deshacer }])
      const vida = o.deshacer ? MS_CON_ACCION : MS_SIMPLE
      timers.current.set(
        id,
        window.setTimeout(() => cerrar(id), vida),
      )
    },
    [cerrar],
  )

  const value = useMemo(() => push, [push])

  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        // Los avisos se anuncian solos a los lectores de pantalla.
        role="status"
        aria-live="polite"
        className="app-col pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 px-5 pt-3"
      >
        <AnimatePresence>
          {avisos.map((a) => {
            const Icon = ICONOS[a.tono]
            return (
              <motion.div
                key={a.id}
                layout
                initial={{ opacity: 0, y: -14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.97 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'pointer-events-auto flex max-w-full items-center gap-2 rounded-input border bg-surface-2 px-3.5 py-2.5',
                  'text-[13px] font-medium text-ink shadow-[0_10px_30px_rgba(0,0,0,0.5)]',
                  TONOS[a.tono],
                )}
              >
                <Icon className="size-4 shrink-0" strokeWidth={2.2} />
                <span className="min-w-0 flex-1 text-ink">{a.texto}</span>

                {a.deshacer && (
                  <button
                    type="button"
                    onClick={() => {
                      a.deshacer?.()
                      cerrar(a.id)
                    }}
                    className={cn(
                      // Objetivo táctil de 44px de alto sin engordar el aviso:
                      // el margen negativo compensa el padding vertical.
                      '-my-2.5 ml-1 flex min-h-11 shrink-0 items-center gap-1.5 rounded-[10px] px-2.5',
                      'text-[13px] font-semibold text-accent-hi transition-colors hover:bg-surface-3',
                    )}
                  >
                    <Undo2 className="size-[15px]" strokeWidth={2.2} />
                    Deshacer
                  </button>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
