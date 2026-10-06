import 'server-only'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

/** SOLO se importa desde código de servidor — la clave privada nunca viaja
 *  al navegador. `null` si no están las variables de entorno cargadas
 *  (ver README): en ese caso, mandar una notificación no hace nada. */
function cliente(): typeof webpush | null {
  const publica = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privada = process.env.VAPID_PRIVATE_KEY
  if (!publica || !privada) return null
  // El "subject" es sólo un dato de contacto que exigen los servicios de
  // push (Chrome/Firefox) para avisar en caso de abuso — no se le muestra a
  // nadie. Reusa el mismo dominio placeholder que ya usa Familia.tsx para
  // los links de invitación.
  webpush.setVapidDetails('https://rindo.app', publica, privada)
  return webpush
}

export interface SuscripcionPush {
  endpoint: string
  p256dh: string
  auth: string
}

/** Servicios de push de los navegadores (Chrome/Android, Firefox, Safari,
 *  Edge). El servidor le hace un POST a cada endpoint guardado: aceptar
 *  cualquier dirección dejaba usar a Rindo para pegarle a otras máquinas.
 *  Mismo patrón que el `check` de la migración 0014. */
const ENDPOINT_PUSH =
  /^https:\/\/(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com)\//

export function endpointPushValido(endpoint: string): boolean {
  return endpoint.length <= 1000 && ENDPOINT_PUSH.test(endpoint)
}

/**
 * Manda una notificación a una suscripción puntual. Si el navegador ya no
 * existe del otro lado (410/404 — se desinstaló la app, se revocó el
 * permiso, etc.) borra la suscripción sola en vez de seguir intentando para
 * siempre en cada corrida del cron.
 */
export async function enviarPush(
  sub: SuscripcionPush,
  payload: { title: string; body: string; url?: string },
): Promise<void> {
  const wp = cliente()
  if (!wp || !endpointPushValido(sub.endpoint)) return

  try {
    await wp.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
    )
  } catch (err) {
    const status = (err as { statusCode?: number } | undefined)?.statusCode
    if (status === 404 || status === 410) {
      const admin = createAdminClient()
      await admin.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    }
  }
}
