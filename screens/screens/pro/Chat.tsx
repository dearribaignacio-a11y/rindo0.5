'use client'

import { Mic, MessageSquareText, Camera } from 'lucide-react'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Badge } from '@/components/ui/Bits'
import { useNav } from '@/components/nav'

/**
 * El asistente por chat (interpretar audio y fotos) depende de la misma
 * clave de IA que el escaneo de tickets y facturas. Hasta que esa etapa esté
 * lista, la pantalla es honesta sobre el estado en vez de simular respuestas.
 */
export function ProChat() {
  const nav = useNav()

  return (
    <Screen pad="tab">
      <TopBar title="Asistente" onBack={nav.pop} />

      <div className="flex flex-col items-center gap-4 rounded-card border border-line bg-surface-2/60 p-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-accent-hi">
          <MessageSquareText className="size-6" strokeWidth={1.6} />
        </span>
        <div>
          <p className="text-[15px] font-medium text-ink">Todavía no está activo</p>
          <p className="mt-1.5 max-w-[34ch] text-[13px] leading-relaxed text-ink-faint">
            El asistente va a poder escuchar un audio o mirar una foto y cargar la venta o el gasto
            solo, con tu confirmación antes de aplicarlo. Se activa en la próxima etapa, junto con la
            lectura real de tickets y facturas.
          </p>
        </div>
        <div className="flex gap-2">
          <Badge tone="neutral" icon={Mic}>
            Audio
          </Badge>
          <Badge tone="neutral" icon={Camera}>
            Fotos
          </Badge>
        </div>
      </div>
    </Screen>
  )
}
