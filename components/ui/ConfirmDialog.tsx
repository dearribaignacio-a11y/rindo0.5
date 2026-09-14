'use client'

import type { ReactNode } from 'react'
import { Sheet } from './Sheet'
import { Button } from './Button'

/**
 * Confirmación para acciones destructivas.
 *
 * Toda acción que borra datos del usuario pasa por acá. Nada de borrar con un
 * solo toque: el patrón es confirmar primero y, cuando el borrado se puede
 * revertir, ofrecer además "Deshacer" en el aviso posterior.
 *
 * Hereda de `Sheet` el rol de diálogo, la trampa de foco, el cierre con
 * Escape y la devolución del foco al control que lo abrió.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  /** Texto del botón destructivo. Que nombre la acción, no "Aceptar". */
  confirmLabel = 'Eliminar',
  cancelLabel = 'Cancelar',
  children,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  children?: ReactNode
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="flex gap-2.5">
          <Button full variant="secondary" size="lg" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            full
            variant="danger"
            size="lg"
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {description && (
        <p className="pb-2 text-[13.5px] leading-relaxed text-ink-muted">{description}</p>
      )}
      {children}
    </Sheet>
  )
}
