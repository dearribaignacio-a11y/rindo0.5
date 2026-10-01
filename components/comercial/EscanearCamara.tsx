'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatOneDReader, type IScannerControls } from '@zxing/browser'
import { Sheet } from '@/components/ui/Sheet'

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

  useEffect(() => {
    if (!open) return
    setError(undefined)

    let controles: IScannerControls | undefined
    let detenido = false
    const lector = new BrowserMultiFormatOneDReader()

    lector
      .decodeFromConstraints(
        { video: { facingMode: 'environment' } },
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
    <Sheet
      open={open}
      onClose={onClose}
      title="Escanear con la cámara"
      subtitle={error ? undefined : 'Apuntá al código de barras, bien de cerca y con luz'}
    >
      <div className="pb-4">
        {error ? (
          <p className="rounded-[10px] border border-warn/40 bg-warn-dim px-3 py-2 text-[12.5px] leading-relaxed text-warn">
            {error}
          </p>
        ) : (
          <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={video} className="size-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-10 top-1/2 h-16 -translate-y-1/2 rounded-lg border-2 border-accent-hi/80" />
          </div>
        )}
      </div>
    </Sheet>
  )
}
