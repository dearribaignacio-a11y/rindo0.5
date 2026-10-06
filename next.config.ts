import type { NextConfig } from 'next'

/**
 * Cabeceras de seguridad para todas las páginas.
 *
 * No se pone `script-src`: el SDK de Mercado Pago (pantalla de pago con
 * tarjeta) carga scripts desde dominios que van cambiando y se rompería el
 * cobro. La cámara y el micrófono quedan habilitados sólo para la propia app
 * (escanear códigos de barras y dictar ventas).
 */
const CABECERAS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Que nadie pueda meter Rindo adentro de otra página (para engañar clics).
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'" },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), browsing-topics=()' },
]

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: CABECERAS }]
  },
}

export default nextConfig
