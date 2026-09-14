'use client'

import { motion } from 'framer-motion'

/**
 * Ilustraciones de línea para el onboarding.
 *
 * Dibujadas a mano en SVG en vez de agrandar un ícono: a 220px de alto un
 * ícono de librería se ve como un ícono estirado. Todas comparten el mismo
 * grosor de trazo y guardan un detalle en el azul de acento — nunca son
 * monocromáticas planas.
 */

export type IlustracionId =
  | 'casa'
  | 'ticket'
  | 'barras'
  | 'caja'
  | 'estanteria'
  | 'reporte'
  | 'ia-impuestos'
  | 'ia-personal'
  | 'ia-precio'

const trazo = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

const acento = {
  fill: 'none',
  stroke: 'var(--color-accent-hi)',
  strokeWidth: 2.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function Marco({ children }: { children: React.ReactNode }) {
  return (
    <motion.svg
      viewBox="0 0 240 190"
      className="h-full w-full text-ink-muted"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    >
      {children}
    </motion.svg>
  )
}

const DIBUJOS: Record<IlustracionId, React.ReactNode> = {
  /* Casa con techo a dos aguas y una ventana encendida en acento. */
  casa: (
    <>
      <path {...trazo} d="M40 92 120 34l80 58" />
      <path {...trazo} d="M58 82v72h124V82" />
      <path {...trazo} d="M58 154h124" />
      <rect {...trazo} x="104" y="112" width="32" height="42" rx="4" />
      <rect {...acento} x="76" y="100" width="26" height="24" rx="4" />
      <path {...acento} d="M89 100v24M76 112h26" />
      <rect {...trazo} x="138" y="100" width="26" height="24" rx="4" />
      <path {...trazo} d="M160 34h16v22" />
      <path {...trazo} d="M30 154h180" />
    </>
  ),

  /* Ticket de compra saliendo del visor de una cámara. */
  ticket: (
    <>
      <path
        {...trazo}
        d="M78 40h84v112l-12-8-12 8-12-8-12 8-12-8-12 8-12-8V40Z"
      />
      <path {...trazo} d="M96 66h48M96 84h48M96 102h30" />
      <path {...acento} d="M96 122h34" />
      <circle {...acento} cx="168" cy="126" r="26" />
      <path {...acento} d="m158 126 7 8 14-16" />
      <path {...trazo} d="M52 58h14M46 84h20M52 110h14" />
    </>
  ),

  /* Gráfico de barras con la última barra en acento y una línea de límite. */
  barras: (
    <>
      <path {...trazo} d="M42 40v112h158" />
      <rect {...trazo} x="62" y="106" width="24" height="46" rx="4" />
      <rect {...trazo} x="98" y="86" width="24" height="66" rx="4" />
      <rect {...trazo} x="134" y="118" width="24" height="34" rx="4" />
      <rect {...acento} x="170" y="62" width="24" height="90" rx="4" />
      <path {...acento} strokeDasharray="7 7" d="M42 72h158" />
      <circle {...acento} cx="182" cy="48" r="7" />
    </>
  ),

  /* Mostrador con caja registradora y ticket que sale. */
  caja: (
    <>
      <path {...trazo} d="M46 152h148" />
      <path {...trazo} d="M62 152v-38h116v38" />
      <rect {...trazo} x="78" y="72" width="84" height="42" rx="6" />
      <path {...trazo} d="M78 90h84" />
      <path {...acento} d="M96 102h22" />
      <path {...acento} d="M120 72V44h34l-8 10 8 10h-34" />
      <circle {...trazo} cx="90" cy="132" r="6" />
      <circle {...trazo} cx="150" cy="132" r="6" />
      <path {...trazo} d="M112 132h26" />
    </>
  ),

  /* Estantería con cajas: una vacía y marcada en acento. */
  estanteria: (
    <>
      <path {...trazo} d="M46 36v122M194 36v122" />
      <path {...trazo} d="M46 78h148M46 118h148M46 158h148" />
      <rect {...trazo} x="62" y="48" width="34" height="30" rx="4" />
      <rect {...trazo} x="104" y="48" width="34" height="30" rx="4" />
      <rect {...trazo} x="62" y="88" width="34" height="30" rx="4" />
      <rect {...trazo} x="146" y="88" width="34" height="30" rx="4" />
      <rect {...trazo} x="62" y="128" width="34" height="30" rx="4" />
      <rect {...acento} strokeDasharray="6 6" x="104" y="88" width="34" height="30" rx="4" />
      <path {...acento} d="M121 96v10M121 112v1" />
    </>
  ),

  /* Reporte: hoja con línea de tendencia en acento. */
  reporte: (
    <>
      <path {...trazo} d="M64 30h78l34 34v96H64z" />
      <path {...trazo} d="M142 30v34h34" />
      <path {...trazo} d="M84 92h72M84 110h72M84 128h44" />
      <path {...acento} d="m84 74 18-16 16 14 22-26" />
      <circle {...acento} cx="140" cy="46" r="5" />
    </>
  ),

  /* Impuestos con IA: calculadora + chispa. */
  'ia-impuestos': (
    <>
      <rect {...trazo} x="66" y="28" width="88" height="134" rx="10" />
      <rect {...trazo} x="82" y="44" width="56" height="24" rx="4" />
      <path {...acento} d="M92 56h36" />
      <circle {...trazo} cx="90" cy="90" r="6" />
      <circle {...trazo} cx="110" cy="90" r="6" />
      <circle {...trazo} cx="130" cy="90" r="6" />
      <circle {...trazo} cx="90" cy="114" r="6" />
      <circle {...trazo} cx="110" cy="114" r="6" />
      <circle {...trazo} cx="130" cy="114" r="6" />
      <circle {...trazo} cx="90" cy="138" r="6" />
      <circle {...trazo} cx="110" cy="138" r="6" />
      <path {...acento} d="M176 54l6 16 16 6-16 6-6 16-6-16-16-6 16-6z" />
      <path {...acento} d="M160 112l3.5 9 9 3.5-9 3.5-3.5 9-3.5-9-9-3.5 9-3.5z" />
    </>
  ),

  /* Costos de personal: tres siluetas, una destacada. */
  'ia-personal': (
    <>
      <circle {...trazo} cx="72" cy="72" r="16" />
      <path {...trazo} d="M46 138c0-16 12-28 26-28s26 12 26 28" />
      <circle {...acento} cx="120" cy="60" r="19" />
      <path {...acento} d="M90 142c0-19 13-33 30-33s30 14 30 33" />
      <circle {...trazo} cx="168" cy="72" r="16" />
      <path {...trazo} d="M142 138c0-16 12-28 26-28s26 12 26 28" />
      <path {...trazo} d="M46 158h148" />
      <path {...acento} d="M186 40l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
    </>
  ),

  /* Precio óptimo: etiqueta con flecha de ajuste hacia arriba. */
  'ia-precio': (
    <>
      <path {...trazo} d="M116 34H62a12 12 0 0 0-12 12v54a12 12 0 0 0 3.5 8.5l58 58a12 12 0 0 0 17 0l50-50a12 12 0 0 0 0-17l-58-58A12 12 0 0 0 116 34Z" />
      <circle {...trazo} cx="82" cy="66" r="9" />
      <path {...acento} d="M110 118l16-16 16 16" />
      <path {...acento} d="M126 102v38" />
      <path {...acento} strokeDasharray="5 6" d="M158 40h44M180 18v44" />
    </>
  ),
}

export function Ilustracion({ id }: { id: IlustracionId }) {
  return <Marco>{DIBUJOS[id]}</Marco>
}
