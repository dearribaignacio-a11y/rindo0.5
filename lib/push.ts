'use client'

/** Cliente de notificaciones push. Único lugar donde la app le habla a las
 *  APIs de push del navegador y a `/api/notificaciones/*`. */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

/** El navegador pide la clave pública en bytes, no en el texto base64url que
 *  entrega `web-push` — esta es la conversión estándar entre las dos. */
function comoBytes(base64Url: string): Uint8Array {
  const base64 = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const cruda = window.atob(base64)
  return Uint8Array.from([...cruda].map((c) => c.charCodeAt(0)))
}

export function soportaNotificaciones(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    Boolean(VAPID_PUBLIC_KEY)
  )
}

/** iPhone/iPad — incluye el iPad moderno, que desde iOS 13 se identifica
 *  como "MacIntel" en el user agent pero tiene pantalla táctil (una Mac de
 *  verdad no). */
function esIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

/** true si la app ya se abrió como instalada (agregada a la pantalla de
 *  inicio), no como una pestaña más de Safari/Chrome. `standalone` es la
 *  propiedad específica de iOS; el resto de los navegadores usan el media
 *  query de abajo. */
function esStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone
  return window.matchMedia('(display-mode: standalone)').matches || iosStandalone === true
}

/** Registra el service worker — necesario tanto para poder instalar la app
 *  como para recibir notificaciones. Se llama una vez al cargar cualquier
 *  pantalla (ver `components/PwaRegistro.tsx`), no hace falta pedir permiso
 *  de notificaciones para esto. */
export async function registrarServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    // Sin service worker la app sigue andando normal, sólo no se puede
    // instalar ni recibir push — no hace falta molestar con un error.
  }
}

export async function suscripcionActual(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const registro = await navigator.serviceWorker.ready
  return registro.pushManager.getSubscription()
}

/** Pide permiso y activa las notificaciones en este dispositivo. */
export async function activarNotificaciones(): Promise<{ ok: boolean; error?: string }> {
  // En iPhone/iPad, Apple sólo deja recibir notificaciones si la app ya está
  // agregada a la pantalla de inicio y se abrió desde ahí — abierta en una
  // pestaña normal de Safari, ni siquiera existe la API. Este chequeo va
  // antes que `soportaNotificaciones()` porque es un caso más específico y
  // el error tiene que decir qué hacer, no sólo que "no funciona".
  if (esIOS() && !esStandalone()) {
    return {
      ok: false,
      error:
        'En iPhone hay que agregar Rindo a la pantalla de inicio primero: tocá Compartir y "Agregar a inicio", y abrila desde ese ícono.',
    }
  }

  if (!soportaNotificaciones()) {
    return { ok: false, error: 'Tu navegador no soporta notificaciones.' }
  }

  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') {
    return { ok: false, error: 'No diste permiso para las notificaciones.' }
  }

  const registro = await navigator.serviceWorker.ready
  const suscripcion = await registro.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: comoBytes(VAPID_PUBLIC_KEY!) as BufferSource,
  })

  const res = await fetch('/api/notificaciones/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(suscripcion.toJSON()),
  })
  if (!res.ok) return { ok: false, error: 'No pudimos guardar la suscripción. Probá de nuevo.' }

  return { ok: true }
}

/** Apaga las notificaciones en este dispositivo. */
export async function desactivarNotificaciones(): Promise<void> {
  const suscripcion = await suscripcionActual()
  if (!suscripcion) return
  const endpoint = suscripcion.endpoint
  await suscripcion.unsubscribe()
  await fetch('/api/notificaciones/desuscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint }),
  }).catch(() => {})
}
