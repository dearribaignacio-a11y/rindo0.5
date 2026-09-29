'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share, SquarePlus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { esIOS, esStandalone } from '@/lib/push'

/** Chrome/Android disparan este evento cuando la app cumple los requisitos
 *  para poder instalarse; no viene tipado en el DOM estándar. */
interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** `sessionStorage`, no `localStorage`: cerrar el aviso lo oculta sólo por
 *  esta visita — la próxima vez que entre a la web (pestaña nueva) vuelve a
 *  aparecer, igual que en Turno, mientras no tenga la app instalada. */
const OCULTO_KEY = 'rindo.instalar.oculto'

/**
 * Banner para instalar Rindo en la pantalla de inicio. En Android/Chrome usa
 * el prompt nativo del navegador; en iPhone no existe ese prompt, así que
 * ofrece los pasos a mano (Compartir → Agregar a inicio).
 */
export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [modoIOS, setModoIOS] = useState(false)
  const [ayudaIOS, setAyudaIOS] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (esStandalone() || sessionStorage.getItem(OCULTO_KEY)) return

    if (esIOS()) {
      setModoIOS(true)
      setVisible(true)
      return
    }

    function onPrompt(e: Event) {
      e.preventDefault()
      setEvento(e as EventoInstalacion)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  function cerrar() {
    sessionStorage.setItem(OCULTO_KEY, '1')
    setVisible(false)
  }

  async function instalar() {
    if (modoIOS) {
      setAyudaIOS(true)
      return
    }
    if (!evento) return
    await evento.prompt()
    await evento.userChoice
    cerrar()
  }

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 34 }}
            className="app-col fixed inset-x-0 top-0 z-40"
          >
            <div className="flex items-center gap-3 border-b border-line bg-surface/95 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] shadow-[0_8px_24px_rgba(0,0,0,0.25)] backdrop-blur-xl">
              <span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-accent text-accent-ink shadow-[0_1px_0_0_rgba(255,255,255,0.08)_inset]">
                <span className="text-[15px] font-bold leading-none tracking-tight">R</span>
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink">Instalá Rindo en tu celular</p>
                <p className="truncate text-[11.5px] text-ink-faint">Acceso directo y notificaciones, sin ocupar espacio de más</p>
              </div>
              <Button size="sm" onClick={instalar}>
                Instalar
              </Button>
              <button
                type="button"
                aria-label="Cerrar aviso de instalación"
                onClick={cerrar}
                className="grid size-9 shrink-0 place-items-center rounded-xl text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                <X className="size-[18px]" strokeWidth={1.9} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet
        open={ayudaIOS}
        onClose={() => setAyudaIOS(false)}
        title="Instalar Rindo"
        subtitle="En Safari, agregala a tu pantalla de inicio en dos pasos"
      >
        <div className="space-y-3 pb-4">
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
              <Share className="size-[18px]" strokeWidth={1.9} />
            </span>
            <p className="text-[13.5px] text-ink">
              Tocá el ícono de <span className="font-medium">Compartir</span> en la barra de abajo
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-3 text-ink-muted">
              <SquarePlus className="size-[18px]" strokeWidth={1.9} />
            </span>
            <p className="text-[13.5px] text-ink">
              Elegí <span className="font-medium">&ldquo;Agregar a inicio&rdquo;</span> y confirmá
            </p>
          </div>
          <Button full size="lg" onClick={() => setAyudaIOS(false)}>
            Entendido
          </Button>
        </div>
      </Sheet>
    </>
  )
}
