/**
 * Service worker de Rindo.
 *
 * Dos trabajos, nada más:
 *  1) Estar presente es uno de los requisitos del navegador para poder
 *     "Instalar" la app (agregarla a la pantalla de inicio) — no hace falta
 *     que cachee nada para eso, así que no cachea nada: cada carga sigue
 *     pidiendo todo de la red, para no mostrar nunca una versión vieja de la
 *     app ni de los datos.
 *  2) Mostrar las notificaciones push que llegan del servidor (ver
 *     lib/server/push.ts) y llevar al usuario al dashboard si toca una.
 */

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Passthrough explícito: sin esto, algunos navegadores no consideran a la
// app "instalable" aunque el resto de los requisitos estén.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})

self.addEventListener('push', (event) => {
  if (!event.data) return
  let datos
  try {
    datos = event.data.json()
  } catch {
    datos = { title: 'Rindo', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(datos.title || 'Rindo', {
      body: datos.body,
      icon: '/icon-192',
      badge: '/icon-192',
      data: { url: datos.url || '/dashboard' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((lista) => {
      const abierta = lista.find((c) => c.url.includes(url))
      if (abierta) return abierta.focus()
      return self.clients.openWindow(url)
    }),
  )
})
