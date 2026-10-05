'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatOneDReader, type IScannerControls } from '@zxing/browser'
import { Sheet } from '@/components/ui/Sheet'
import { cn } from '@/lib/cn'

/**
 * Lee un código de barras con la cámara del celular — para cuando no hay un
 * lector físico a mano. Usa ZXing (decodifica en el propio navegador, cuadro
 * a cuadro) en vez de la API nativa `BarcodeDetector`: esa todavía no anda en
 * Safari/iPhone, y acá necesitamos que funcione en cualquier celular.
 */
export function EscanearCamara({
  open,
  onClose,
  onDetectado,
}: {
  open: boolean
  onClose: () => void
  /** Se llama una sola vez, con el texto del código ya leído. */
  onDetectado: (codigo: string) => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string>()
  const [enfocando, setEnfocando] = useState(false)

  /** No todos los celulares reenfocan solos cuando acercás el código — tocar
   *  la pantalla fuerza un ciclo de enfoque nuevo, igual que tocar para
   *  enfocar en la app de cámara de siempre. Si el navegador no expone este
   *  control (no es parte del estándar, cada uno lo soporta como puede) no
   *  pasa nada: el tocar simplemente no hace efecto visible. */
  function forzarEnfoque() {
    setEnfocando(true)
    window.setTimeout(() => setEnfocando(false), 350)

    const stream = video.current?.srcObject
    if (!(stream instanceof MediaStream)) return
    const track = stream.getVideoTracks()[0]
    const capacidades = track?.getCapabilities?.() as { focusMode?: string[] } | undefined
    const modos = capacidades?.focusMode
    if (!modos?.length) return

    const modo = modos.includes('single-shot') ? 'single-shot' : modos.includes('continuous') ? 'continuous' : undefined
    if (!modo) return
    track
      .applyConstraints({ advanced: [{ focusMode: modo } as MediaTrackConstraintSet] })
      .catch(() => {})
  }

  useEffect(() => {
    if (!open) return
    setError(undefined)

    let controles: IScannerControls | undefined
    let detenido = false
    const lector = new BrowserMultiFormatOneDReader()

    lector
      .decodeFromConstraints(
        {
          video: {
            facingMode: 'environment',
            // Sin esto el navegador suele arrancar en una resolución baja
            // (640x480), insuficiente para distinguir las barras finas de un
            // código EAN/UPC a una distancia cómoda — "ideal", no "exacta",
            // para que igual funcione en celulares que no llegan a tanto.
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        },
        video.current!,
        (resultado, _err, controls) => {
          controles = controls
          if (detenido || !resultado) return
          detenido = true
          controls.stop()
          onDetectado(resultado.getText())
        },
      )
      .catch(() => {
        setError('No pudimos acceder a la cámara. Revisá que le hayas dado permiso al navegador.')
      })

    return () => {
      detenido = true
      controles?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onClose={onClose} title="Escanear con la cámara">
      <div className="space-y-3 pb-4">
        {error ? (
          <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
            {error}
          </p>
        ) : (
          <>
            <button
              type="button"
              onClick={forzarEnfoque}
              aria-label="Tocar para forzar el enfoque"
              className="relative block aspect-[4/3] w-full overflow-hidden rounded-xl bg-black"
            >
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={video} className="size-full object-cover" muted playsInline />
              <div
                className={cn(
                  'pointer-events-none absolute inset-x-10 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 transition-colors',
                  enfocando ? 'border-white' : 'border-accent-hi/80',
                )}
              />
            </button>
            <p className="text-[12.5px] leading-relaxed text-ink-faint">
              Que el código ocupe el recuadro de arriba, derecho y con buena luz. Si lo tenés muy
              pegado a la cámara se ve borroso: alejalo despacio hasta que enfoque — el punto justo
              suele estar a unos 10-15 cm. Si tarda en verse nítido, tocá la pantalla para forzar el
              enfoque.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
