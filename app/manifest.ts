import type { MetadataRoute } from 'next'

/**
 * Manifest de la PWA — lo que hace que el navegador ofrezca "Instalar app" /
 * "Agregar a la pantalla de inicio". Usa el color de acento del tema
 * "petroleo" (el default) como identidad fija: la app tiene tres temas
 * cambiables en tiempo real, pero el ícono/color de instalación tiene que
 * ser uno solo, no puede depender de qué tema tenía elegido quien instala.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Rindo — tus números, ordenados',
    short_name: 'Rindo',
    description:
      'Gestión de gastos del hogar y de tu comercio en una sola app. Pensada para San Juan, Argentina.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    icons: [
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
