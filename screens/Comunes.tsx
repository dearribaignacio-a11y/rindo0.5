'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Check,
  CircleHelp,
  Lock,
  Mail,
  MessageSquareText,
  Send,
} from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Screen, TopBar } from '@/components/ui/Screen'
import { Segmented } from '@/components/ui/Segmented'
import { Badge } from '@/components/ui/Bits'
import { Select } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useNav } from '@/components/nav'
import { ORDEN_PLANES, PLANES } from '@/lib/plans'
import { TEMAS } from '@/lib/temas'
import { aplicarTema, sembrar, sembrarOperacionesDemo, updatePerfil } from '@/lib/storage'
import { money } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { DB, PlanId, ThemeId } from '@/lib/types'

/* ══════════════════════════════════════════════════════════════════════════
   Pantallas apiladas compartidas por los tres planes.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Tema de color ─────────────────────────────────────────────────────── */

export function PantallaTema({ db }: { db: DB }) {
  const nav = useNav()
  const actual = db.ajustes.tema

  return (
    <Screen pad="none">
      <TopBar title="Tema de color" onBack={nav.pop} />

      <p className="mb-4 text-[13.5px] leading-relaxed text-ink-muted">
        El cambio se aplica al instante en toda la app y queda guardado en este dispositivo.
      </p>

      <div className="space-y-2.5">
        {TEMAS.map((t) => (
          <TarjetaTema key={t.id} tema={t.id} activo={t.id === actual} />
        ))}
      </div>
    </Screen>
  )
}

function TarjetaTema({ tema, activo }: { tema: ThemeId; activo: boolean }) {
  const def = TEMAS.find((t) => t.id === tema)!

  return (
    <Card interactive selected={activo} onClick={() => aplicarTema(tema)}>
      <div className="flex items-center gap-3.5">
        {/* Preview con colores literales: muestra el tema sin aplicarlo. */}
        <div
          className="grid size-14 shrink-0 place-items-center rounded-[14px] border border-line-strong"
          style={{ background: def.preview.fondo }}
        >
          <div
            className="flex size-9 items-center justify-center gap-1 rounded-[9px]"
            style={{ background: def.preview.superficie }}
          >
            <span className="h-4 w-1.5 rounded-full" style={{ background: def.preview.acento }} />
            <span
              className="h-4 w-1.5 rounded-full opacity-60"
              style={{ background: def.preview.texto }}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-ink">{def.nombre}</p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-faint">{def.descripcion}</p>
        </div>

        {activo && (
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 520, damping: 26 }}
            className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-ink"
          >
            <Check className="size-4" strokeWidth={2.6} />
          </motion.span>
        )}
      </div>
    </Card>
  )
}

/* ── Editar perfil ─────────────────────────────────────────────────────── */

export function PantallaPerfil({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const perfil = db.perfil
  const comercial = perfil?.plan !== 'hogar'

  const [nombre, setNombre] = useState(perfil?.nombre ?? '')
  const [email, setEmail] = useState(perfil?.email ?? '')
  const [negocio, setNegocio] = useState(perfil?.negocio ?? '')
  const [ciudad, setCiudad] = useState(perfil?.ciudad ?? '')

  return (
    <Screen pad="none">
      <TopBar title="Editar perfil" onBack={nav.pop} />

      <div className="space-y-4">
        <Input label="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input
          label="Email"
          type="email"
          leading={<Mail className="size-[18px]" strokeWidth={1.9} />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        {comercial && (
          <>
            <Input
              label="Nombre del negocio"
              value={negocio}
              onChange={(e) => setNegocio(e.target.value)}
            />
            <Input label="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
          </>
        )}
      </div>

      <Button
        full
        size="lg"
        className="mt-6"
        onClick={() => {
          updatePerfil({
            nombre,
            email,
            ...(comercial ? { negocio, ciudad } : {}),
          })
          toast('Perfil actualizado')
          nav.pop()
        }}
      >
        Guardar cambios
      </Button>
    </Screen>
  )
}

/* ── Cambiar contraseña ────────────────────────────────────────────────── */

export function PantallaPassword() {
  const nav = useNav()
  const toast = useToast()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string>()

  function guardar() {
    if (actual.length < 6) return setError('Ingresá tu contraseña actual')
    if (nueva.length < 8) return setError('La nueva contraseña necesita 8 caracteres o más')
    if (nueva !== repetir) return setError('Las contraseñas nuevas no coinciden')
    // Sin backend de autenticación no hay nada que persistir todavía: acá va
    // el PUT a /api/auth/password cuando exista.
    toast('Contraseña actualizada')
    nav.pop()
  }

  return (
    <Screen pad="none">
      <TopBar title="Cambiar contraseña" onBack={nav.pop} />

      <div className="space-y-4">
        <Input
          label="Contraseña actual"
          reveal
          leading={<Lock className="size-[18px]" strokeWidth={1.9} />}
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
        <Input
          label="Nueva contraseña"
          reveal
          hint="Mínimo 8 caracteres."
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
        <Input
          label="Repetir nueva contraseña"
          reveal
          value={repetir}
          onChange={(e) => setRepetir(e.target.value)}
          error={error}
        />
      </div>

      <Button full size="lg" className="mt-6" onClick={guardar}>
        Guardar contraseña
      </Button>
    </Screen>
  )
}

/* ── Centro de ayuda ───────────────────────────────────────────────────── */

const PREGUNTAS = [
  {
    q: '¿Mis datos se guardan en algún servidor?',
    a: 'Por ahora no: todo queda en este teléfono. Si borrás los datos del navegador o cambiás de equipo, la información no viaja con vos.',
  },
  {
    q: '¿Cómo cargo un gasto con la foto del ticket?',
    a: 'Tocá el botón + y elegí "Cargar ticket con foto". Sacás la foto, revisás los renglones que detectamos y confirmás.',
  },
  {
    q: '¿El stock se descuenta solo?',
    a: 'Sí. Cada venta que registrás descuenta las unidades vendidas del producto correspondiente.',
  },
  {
    q: '¿Las estimaciones de impuestos reemplazan a mi contador?',
    a: 'No. Son un cálculo automático sobre tus ventas cargadas, pensado para que llegues con los números ordenados a tu contador.',
  },
  {
    q: '¿Puedo cambiar de plan cuando quiera?',
    a: 'Sí, desde Ajustes → Cambiar plan. Los datos que ya cargaste se mantienen.',
  },
]

export function PantallaAyuda() {
  const nav = useNav()
  const [abierta, setAbierta] = useState<number | null>(0)

  return (
    <Screen pad="none">
      <TopBar title="Centro de ayuda" onBack={nav.pop} />

      <div className="space-y-2.5">
        {PREGUNTAS.map((p, i) => {
          const abierto = abierta === i
          return (
            <Card key={p.q} interactive onClick={() => setAbierta(abierto ? null : i)}>
              <div className="flex items-start gap-3">
                <CircleHelp className="mt-0.5 size-[18px] shrink-0 text-accent-hi" strokeWidth={1.9} />
                <p className="flex-1 text-[14px] font-medium leading-snug text-ink">{p.q}</p>
              </div>
              <motion.div
                initial={false}
                animate={{ height: abierto ? 'auto' : 0, opacity: abierto ? 1 : 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <p className="pl-[30px] pt-2 text-[13px] leading-relaxed text-ink-muted">{p.a}</p>
              </motion.div>
            </Card>
          )
        })}
      </div>

      <p className="mt-6 text-center text-[12.5px] leading-relaxed text-ink-faint">
        ¿No encontrás lo que buscabas?
        <br />
        Escribinos desde &ldquo;Enviar comentarios&rdquo;.
      </p>
    </Screen>
  )
}

/* ── Enviar comentarios ────────────────────────────────────────────────── */

const TEMAS_COMENTARIO = ['Reportar un problema', 'Sugerir una mejora', 'Consulta de facturación', 'Otro']

export function PantallaComentarios() {
  const nav = useNav()
  const toast = useToast()
  const [tema, setTema] = useState(TEMAS_COMENTARIO[1])
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)

  function enviar() {
    if (texto.trim().length < 10) {
      toast('Contanos un poco más para poder ayudarte', 'aviso')
      return
    }
    setEnviando(true)
    // Acá iría el POST a /api/comentarios (o al proveedor de soporte).
    setTimeout(() => {
      setEnviando(false)
      toast('¡Gracias! Recibimos tu comentario')
      nav.pop()
    }, 700)
  }

  return (
    <Screen pad="none">
      <TopBar title="Enviar comentarios" onBack={nav.pop} />

      <div className="space-y-4">
        <Select label="Tema" opciones={TEMAS_COMENTARIO} value={tema} onChange={(e) => setTema(e.target.value)} />

        <div>
          <label
            htmlFor="comentario"
            className="mb-1.5 block text-[13px] font-medium text-ink-muted"
          >
            Tu mensaje
          </label>
          <textarea
            id="comentario"
            rows={6}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Contanos qué pasó o qué te gustaría que Rindo haga."
            className="w-full resize-none rounded-input border border-line-strong bg-surface-2 p-3.5 text-[15px] leading-relaxed text-ink placeholder:text-ink-faint focus:border-accent-hi focus:bg-surface-3 focus:outline-none"
          />
        </div>
      </div>

      <Button full size="lg" className="mt-5" loading={enviando} onClick={enviar}>
        <Send className="size-[18px]" strokeWidth={1.9} />
        Enviar comentario
      </Button>

      <div className="mt-5 flex items-start gap-2.5 rounded-card border border-line bg-surface-2/60 p-3.5">
        <MessageSquareText className="mt-px size-4 shrink-0 text-ink-faint" strokeWidth={1.9} />
        <p className="text-[12.5px] leading-relaxed text-ink-faint">
          Leemos todo lo que llega. Si reportás un problema, contanos qué estabas haciendo justo
          antes: ayuda muchísimo a encontrarlo.
        </p>
      </div>
    </Screen>
  )
}

/* ── Cambiar de plan ───────────────────────────────────────────────────── */

export function PantallaPlanes({ db }: { db: DB }) {
  const nav = useNav()
  const toast = useToast()
  const actual = db.perfil?.plan ?? 'hogar'
  const [ciclo, setCiclo] = useState<'mensual' | 'anual'>('mensual')
  const [cambiando, setCambiando] = useState<PlanId | null>(null)

  function cambiar(pid: PlanId) {
    if (pid === actual) return
    if (!db.perfil) {
      // No debería pasar en uso normal: `perfil` se crea en el setup inicial.
      // Si igual falta (otro navegador, datos borrados), al menos avisamos en
      // vez de quedarnos mudos — antes esto no hacía nada ni decía por qué.
      toast('No encontramos tu perfil en este navegador. Cerrá sesión y volvé a entrar.', {
        tono: 'aviso',
      })
      return
    }
    setCambiando(pid)
    setTimeout(async () => {
      updatePerfil({ plan: pid })
      // Si el usuario pasa de Hogar a Comercial (o al revés) las colecciones
      // del plan nuevo están vacías: se siembran para que las pantallas tengan
      // con qué trabajar. Lo ya cargado en el otro plan no se toca.
      const necesitaSemilla =
        (pid === 'hogar' && db.categorias.length === 0) ||
        (pid !== 'hogar' && db.productos.length === 0)
      if (necesitaSemilla) {
        const perfilNuevo = { ...db.perfil!, plan: pid }
        sembrar(perfilNuevo)
        if (pid !== 'hogar') await sembrarOperacionesDemo(perfilNuevo).catch(() => {})
      }
      setCambiando(null)
      toast(`Ahora estás en el plan ${PLANES[pid].nombre}`)
      nav.reset('tabs')
    }, 700)
  }

  return (
    <Screen pad="none">
      <TopBar title="Cambiar plan" onBack={nav.pop} />

      <Segmented
        layoutId="ciclo-cambio-plan"
        value={ciclo}
        onChange={setCiclo}
        opciones={[
          { id: 'mensual', label: 'Mensual' },
          { id: 'anual', label: 'Anual · 2 meses gratis' },
        ]}
      />

      <div className="mt-4 space-y-3">
        {ORDEN_PLANES.map((pid) => {
          const p = PLANES[pid]
          const esActual = pid === actual
          const precio = ciclo === 'mensual' ? p.mensual : p.anual
          const Icon = p.icon

          return (
            <Card
              key={pid}
              selected={esActual}
              className={cn(p.recomendado && !esActual && 'border-accent-hi/50')}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'grid size-11 shrink-0 place-items-center rounded-xl border',
                    esActual
                      ? 'border-accent-hi/40 bg-accent-dim text-accent-hi'
                      : 'border-line-strong bg-surface-2 text-ink-muted',
                  )}
                >
                  <Icon className="size-[22px]" strokeWidth={1.5} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[16px] font-semibold text-ink">{p.nombre}</h3>
                    {esActual && <Badge tone="pos">Tu plan</Badge>}
                  </div>
                  <p className="mt-0.5 text-[12.5px] text-ink-faint">{p.bajada}</p>
                </div>

                <span className="tabular shrink-0 text-right font-display text-[17px] font-bold text-ink">
                  {precio === 0 ? 'Gratis' : money(precio)}
                </span>
              </div>

              <ul className="mt-3.5 space-y-1.5">
                {p.features.slice(0, 4).map((f) => (
                  <li key={f.texto} className="flex items-center gap-2.5">
                    <f.icon className="size-4 shrink-0 text-accent-hi" strokeWidth={1.8} />
                    <span className="text-[13px] text-ink-muted">{f.texto}</span>
                  </li>
                ))}
              </ul>

              {!esActual && (
                <Button
                  full
                  className="mt-4"
                  loading={cambiando === pid}
                  onClick={() => cambiar(pid)}
                >
                  Cambiar a {p.nombre}
                </Button>
              )}
            </Card>
          )
        })}
      </div>

      <p className="mt-5 text-center text-[12px] leading-relaxed text-ink-faint">
        Es una demo: no se cobra nada y el cambio de plan es inmediato.
      </p>
    </Screen>
  )
}
