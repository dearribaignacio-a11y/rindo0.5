'use client'

import { useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import {
  Bell,
  ChevronRight,
  CircleHelp,
  Coins,
  CreditCard,
  Languages,
  LogOut,
  MessageSquareText,
  Palette,
  ReceiptText,
  ShieldCheck,
  Store,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Switch } from '@/components/ui/Switch'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Avatar, Badge } from '@/components/ui/Bits'
import { Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { AdSlot } from '@/components/AdSlot'
import { useNav } from '@/components/nav'
import { PLANES, esComercial } from '@/lib/plans'
import { resetDB, updateAjustes, updateFlags } from '@/lib/storage'
import { createClient } from '@/lib/supabase/client'
import { TEMAS } from '@/lib/temas'
import { cn } from '@/lib/cn'
import type { DB } from '@/lib/types'

export function Ajustes({ db, onCerrarSesion }: { db: DB; onCerrarSesion: () => void }) {
  const nav = useNav()
  const router = useRouter()
  const toast = useToast()
  const [borrando, setBorrando] = useState(false)
  const [cerrando, setCerrando] = useState(false)

  async function cerrarSesion() {
    setCerrando(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    updateFlags({ sesionIniciada: false })
    onCerrarSesion()
    router.push('/login')
    router.refresh()
  }

  const perfil = db.perfil
  const plan = perfil?.plan ?? 'hogar'
  const esHogar = plan === 'hogar'
  const comercial = esComercial(plan)
  const tema = TEMAS.find((t) => t.id === db.ajustes.tema) ?? TEMAS[0]

  return (
    <>
      <Screen pad="tab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Ajustes</h1>
        </header>

        <Card className="flex items-center gap-3.5 p-4">
          <Avatar
            nombre={perfil?.negocio || perfil?.nombre || 'R'}
            src={perfil?.logo}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-ink">
              {perfil?.negocio || perfil?.nombre || 'Tu cuenta'}
            </p>
            <p className="truncate text-[13px] text-ink-faint">{perfil?.email}</p>
            <button
              type="button"
              onClick={() => nav.push('perfil')}
              className="mt-1.5 text-[12.5px] text-accent-hi transition-colors hover:text-ink"
            >
              Editar perfil
            </button>
          </div>
          <Badge tone="accent">{PLANES[plan].nombre}</Badge>
        </Card>

        <SectionTitle>Preferencias</SectionTitle>
        <Card className="px-0 py-0">
          <Fila
            icon={<Palette className="size-[18px]" strokeWidth={1.9} />}
            label="Tema de color"
            valor={tema.nombre}
            onClick={() => nav.push('tema')}
          />
          <Fila
            icon={<Coins className="size-[18px]" strokeWidth={1.9} />}
            label="Moneda"
            control={
              <Select
                aria-label="Moneda"
                className="h-9 w-[104px] text-[13px]"
                opciones={['ARS', 'USD']}
                value={db.ajustes.moneda}
                onChange={(e) => updateAjustes({ moneda: e.target.value })}
              />
            }
          />
          <Fila
            icon={<Bell className="size-[18px]" strokeWidth={1.9} />}
            label="Notificaciones"
            control={
              <Switch
                checked={db.ajustes.notificaciones}
                onChange={(v) => updateAjustes({ notificaciones: v })}
                label="Notificaciones"
              />
            }
          />
          <Fila
            icon={<Languages className="size-[18px]" strokeWidth={1.9} />}
            label="Idioma"
            valor={db.ajustes.idioma}
            ultimo
          />
        </Card>

        <SectionTitle>Cuenta</SectionTitle>
        <Card className="px-0 py-0">
          <Fila
            icon={<ShieldCheck className="size-[18px]" strokeWidth={1.9} />}
            label="Cambiar contraseña"
            onClick={() => nav.push('password')}
          />
          <Fila
            icon={<CreditCard className="size-[18px]" strokeWidth={1.9} />}
            label="Cambiar plan"
            valor={PLANES[plan].nombre}
            onClick={() => nav.push('planes')}
          />
          {esHogar && (
            <Fila
              icon={<UsersRound className="size-[18px]" strokeWidth={1.9} />}
              label="Cuenta familiar"
              valor={`${db.miembros.length} integrantes`}
              onClick={() => nav.push('tabs', { tab: 'familia' })}
              ultimo
            />
          )}
          {comercial && (
            <>
              <Fila
                icon={<Store className="size-[18px]" strokeWidth={1.9} />}
                label="Mi Negocio"
                valor={db.empresa?.razonSocial || 'Sin cargar'}
                onClick={() => nav.push('mi-negocio')}
              />
              <Fila
                icon={<UsersRound className="size-[18px]" strokeWidth={1.9} />}
                label="Empleados"
                valor={`${db.empleados.length}`}
                onClick={() => nav.push('empleados')}
              />
              <Fila
                icon={<ReceiptText className="size-[18px]" strokeWidth={1.9} />}
                label="Impuestos"
                valor={`${db.impuestos.length}`}
                onClick={() => nav.push('impuestos')}
                ultimo
              />
            </>
          )}
        </Card>

        <SectionTitle>Soporte</SectionTitle>
        <Card className="px-0 py-0">
          <Fila
            icon={<CircleHelp className="size-[18px]" strokeWidth={1.9} />}
            label="Centro de ayuda"
            onClick={() => nav.push('ayuda')}
          />
          <Fila
            icon={<MessageSquareText className="size-[18px]" strokeWidth={1.9} />}
            label="Enviar comentarios"
            onClick={() => nav.push('comentarios')}
            ultimo
          />
        </Card>

        <SectionTitle>Datos</SectionTitle>
        <Card className="px-0 py-0">
          <Fila
            icon={<Trash2 className="size-[18px]" strokeWidth={1.9} />}
            label="Borrar todos los datos"
            tono="neg"
            onClick={() => setBorrando(true)}
            ultimo
          />
        </Card>

        <button
          type="button"
          disabled={cerrando}
          onClick={cerrarSesion}
          className="mt-6 flex w-full items-center justify-center gap-2 py-3 text-[14px] text-ink-muted transition-colors hover:text-ink disabled:opacity-50"
        >
          <LogOut className="size-[17px]" strokeWidth={1.9} />
          Cerrar sesión
        </button>

        <p className="mt-2 text-center text-[11.5px] text-ink-faint">Rindo · versión 0.1.3</p>

        {esHogar && <AdSlot />}
      </Screen>

      <ConfirmDialog
        open={borrando}
        onClose={() => setBorrando(false)}
        onConfirm={async () => {
          await resetDB()
          toast('Datos borrados', 'aviso')
          onCerrarSesion()
        }}
        title="¿Borrar todos los datos?"
        description="Se eliminan productos, ventas y movimientos de tu cuenta (en todos los dispositivos), y la configuración de este dispositivo. Esta acción no se puede deshacer."
        confirmLabel="Borrar todo"
      />
    </>
  )
}

/* ── Fila de ajuste ────────────────────────────────────────────────────── */

function Fila({
  icon,
  label,
  valor,
  control,
  onClick,
  ultimo,
  tono = 'normal',
}: {
  icon: ReactNode
  label: string
  valor?: string
  control?: ReactNode
  onClick?: () => void
  ultimo?: boolean
  tono?: 'normal' | 'neg'
}) {
  const contenido = (
    <>
      <span className={cn('shrink-0', tono === 'neg' ? 'text-neg' : 'text-ink-muted')}>{icon}</span>
      <span
        className={cn(
          'min-w-0 flex-1 truncate text-left text-[14.5px]',
          tono === 'neg' ? 'text-neg' : 'text-ink',
        )}
      >
        {label}
      </span>
      {valor && <span className="shrink-0 truncate text-[13px] text-ink-faint">{valor}</span>}
      {control}
      {onClick && <ChevronRight className="size-[18px] shrink-0 text-ink-faint" />}
    </>
  )

  const clases = cn(
    'flex w-full items-center gap-3 px-4 py-3.5',
    !ultimo && 'border-b border-line',
  )

  if (!onClick) return <div className={clases}>{contenido}</div>

  return (
    <button type="button" onClick={onClick} className={cn(clases, 'transition-colors hover:bg-surface-2')}>
      {contenido}
    </button>
  )
}
