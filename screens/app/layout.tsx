import type { Metadata, Viewport } from 'next'
import { Manrope, Space_Grotesk } from 'next/font/google'
import './globals.css'

// Manrope para todo el texto, Space Grotesk sólo para los números grandes.
// Ninguna de las dos es Inter ni Sora — la app no tiene que oler a plantilla.
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const grotesk = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Rindo — tus números, ordenados',
  description:
    'Gestión de gastos del hogar y de tu comercio en una sola app. Pensada para San Juan, Argentina.',
  applicationName: 'Rindo',
}

export const viewport: Viewport = {
  themeColor: '#121212',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

/**
 * Aplica el tema guardado antes del primer pintado. Sin esto la app arranca
 * siempre en "petroleo" y pega un flash al hidratar.
 */
const THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('rindo.theme');if(t&&t!=='petroleo'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR" className={`${manrope.variable} ${grotesk.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
