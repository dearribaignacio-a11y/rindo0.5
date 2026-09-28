'use client'

import { useEffect } from 'react'
import { registrarServiceWorker } from '@/lib/push'

/** No renderiza nada — sólo registra el service worker apenas carga
 *  cualquier pantalla, público o privado. Es uno de los requisitos del
 *  navegador para poder "Instalar" la app; no pide permiso de notificaciones
 *  (eso lo hace `activarNotificaciones()`, a pedido explícito en Ajustes). */
export function PwaRegistro() {
  useEffect(() => {
    registrarServiceWorker()
  }, [])

  return null
}
