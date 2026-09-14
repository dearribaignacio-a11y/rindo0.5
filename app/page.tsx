import { Rindo } from '@/screens/Rindo'

/**
 * Única página de la app. Todo el estado vive en el cliente (localStorage),
 * así que la ruta sólo monta el shell; las funciones serverless de Vercel
 * son los Route Handlers de `app/api`.
 */
export default function Page() {
  return (
    <div className="min-h-dvh bg-bg-sunken">
      <div className="app-col min-h-dvh bg-bg shadow-[0_0_80px_rgba(0,0,0,0.45)]">
        <Rindo />
      </div>
    </div>
  )
}
