'use client'

import { useState } from 'react'
import { Check, Copy, Link2, Trash2, UserPlus, UsersRound } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Screen, SectionTitle } from '@/components/ui/Screen'
import { Sheet } from '@/components/ui/Sheet'
import { Avatar, Badge, Empty, Row } from '@/components/ui/Bits'
import { IconChip, iconoDe } from '@/components/ui/Icon'
import { useToast } from '@/components/ui/Toast'
import { AdSlot } from '@/components/AdSlot'
import { addMiembro, getInvitacion, removeMiembro } from '@/lib/storage'
import { useCopiar } from '@/lib/hooks'
import { fechaRelativa, moneySigned } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB } from '@/lib/types'

export function HogarFamilia({ db }: { db: DB }) {
  const toast = useToast()
  const { copiado, copiar } = useCopiar()
  const [invitando, setInvitando] = useState(false)
  const [nombreNuevo, setNombreNuevo] = useState('')

  const invitacion = db.invitacion
  const actividad = db.movimientos.slice(0, 8)

  function generarYCopiar(comoLink: boolean) {
    const inv = invitacion ?? getInvitacion()
    const texto = comoLink
      ? `${typeof window !== 'undefined' ? window.location.origin : 'https://rindo.app'}/unirme/${inv.codigo}`
      : inv.codigo
    copiar(texto)
    toast(comoLink ? 'Link copiado' : 'Código copiado')
  }

  function agregar() {
    if (nombreNuevo.trim().length < 2) return
    addMiembro({ nombre: nombreNuevo.trim(), rol: 'miembro' })
    setNombreNuevo('')
    setInvitando(false)
    toast('Integrante agregado')
  }

  return (
    <>
      <Screen pad="tab">
        <header className="mb-4 pt-2">
          <h1 className="text-[21px] font-semibold tracking-[-0.025em] text-ink">Familia</h1>
          <p className="mt-0.5 text-[13px] text-ink-faint">
            {db.miembros.length} {db.miembros.length === 1 ? 'integrante' : 'integrantes'} en la
            cuenta compartida
          </p>
        </header>

        <Card className="p-5">
          <div className="flex items-center gap-3">
            <IconChip icon={UsersRound} color="accent" size="lg" />
            <div className="min-w-0 flex-1">
              <p className="font-display text-[26px] font-bold leading-none text-ink">
                {db.miembros.length}
              </p>
              <p className="mt-1 text-[13px] text-ink-muted">
                {db.miembros.length === 1
                  ? 'Sólo vos por ahora'
                  : 'Cargan gastos en la misma cuenta'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <Button variant="secondary" onClick={() => generarYCopiar(true)}>
              <Link2 className="size-[18px]" strokeWidth={1.9} />
              Compartir link
            </Button>
            <Button variant="secondary" onClick={() => generarYCopiar(false)}>
              {copiado ? (
                <Check className="size-[18px] text-pos" strokeWidth={2.2} />
              ) : (
                <Copy className="size-[18px]" strokeWidth={1.9} />
              )}
              Copiar código
            </Button>
          </div>

          {invitacion && (
            <div className="mt-3 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Código de invitación
              </p>
              <p className="tabular mt-0.5 font-display text-[19px] font-bold tracking-[0.14em] text-ink">
                {invitacion.codigo}
              </p>
            </div>
          )}
        </Card>

        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => setInvitando(true)}
              className="flex items-center gap-1 text-[12.5px] text-ink-muted transition-colors hover:text-ink"
            >
              <UserPlus className="size-3.5" strokeWidth={2} />
              Agregar
            </button>
          }
        >
          Integrantes
        </SectionTitle>

        <Card className="py-1">
          {db.miembros.map((m) => (
            <Row
              key={m.id}
              leading={<Avatar nombre={m.nombre} />}
              title={m.nombre}
              subtitle={m.rol === 'admin' ? 'Creó la cuenta' : 'Puede cargar movimientos'}
              trailing={
                <div className="flex items-center gap-2">
                  <Badge tone={m.rol === 'admin' ? 'accent' : 'neutral'}>
                    {m.rol === 'admin' ? 'Administrador' : 'Miembro'}
                  </Badge>
                  {m.rol !== 'admin' && (
                    <button
                      type="button"
                      aria-label={`Quitar a ${m.nombre}`}
                      onClick={() => {
                        removeMiembro(m.id)
                        toast('Integrante quitado', 'aviso')
                      }}
                      className="grid size-8 place-items-center rounded-[10px] text-ink-faint transition-colors hover:bg-surface-2 hover:text-neg"
                    >
                      <Trash2 className="size-4" strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              }
            />
          ))}
        </Card>

        <SectionTitle>Actividad reciente</SectionTitle>

        <Card className="py-1">
          {actividad.length === 0 ? (
            <Empty
              icon={UsersRound}
              title="Todavía no hay actividad"
              hint="Cuando alguien cargue un gasto, aparece acá con su nombre."
            />
          ) : (
            actividad.map((m) => {
              const cat = db.categorias.find((c) => c.id === m.categoriaId)
              const autor = db.miembros.find((x) => x.id === m.autorId)
              return (
                <Row
                  key={m.id}
                  leading={
                    <IconChip icon={iconoDe(cat?.icono ?? 'otros')} color={cat?.color ?? 'accent'} />
                  }
                  title={m.descripcion}
                  subtitle={`${autor?.nombre ?? 'Alguien'} · ${fechaRelativa(m.fecha)}`}
                  trailing={
                    <span
                      className={cn(
                        'tabular text-[14px] font-semibold',
                        m.tipo === 'ingreso' ? 'text-pos' : 'text-ink',
                      )}
                    >
                      {moneySigned(m.tipo === 'ingreso' ? m.monto : -m.monto)}
                    </span>
                  }
                />
              )
            })
          )}
        </Card>

        <p className="mt-4 px-1 text-[12px] leading-relaxed text-ink-faint">
          Por ahora los integrantes se administran en este dispositivo. El código de invitación ya
          queda guardado para cuando conectemos las cuentas entre teléfonos.
        </p>

        <AdSlot />
      </Screen>

      <Sheet
        open={invitando}
        onClose={() => setInvitando(false)}
        title="Agregar integrante"
        subtitle="Sumalo a la cuenta para poder atribuirle movimientos."
        footer={
          <Button full size="lg" onClick={agregar}>
            Agregar integrante
          </Button>
        }
      >
        <div className="pb-2">
          <Input
            label="Nombre"
            placeholder="Ej. Martina"
            autoFocus
            value={nombreNuevo}
            onChange={(e) => setNombreNuevo(e.target.value)}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-ink-faint">
            Si preferís que se sume con su propio teléfono, compartile el código de invitación
            desde la tarjeta de arriba.
          </p>
        </div>
      </Sheet>
    </>
  )
}

