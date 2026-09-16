/** Formateo de plata, fechas y porcentajes. Todo en es-AR. */

const ars = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

/** $1.250.400 — sin centavos: a simple vista son ruido. */
export const money = (n: number) => ars.format(Math.round(n))

/** Versión con signo explícito para las filas de movimientos. */
export const moneySigned = (n: number) =>
  `${n < 0 ? '−' : '+'}${ars.format(Math.abs(Math.round(n)))}`

/** Compacta para ejes de gráficos: $1,2M / $340k */
export function moneyCorto(n: number) {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`
  if (abs >= 1_000) return `$${Math.round(n / 1000)}k`
  return `$${Math.round(n)}`
}

export const pct = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 0 }).format(n)

export const pct1 = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'percent', maximumFractionDigits: 1 }).format(n)

/* ── Fechas ────────────────────────────────────────────────────────────── */

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/* ── Fechas locales ────────────────────────────────────────────────────────
   Todo lo que se guarda es "ISO local": 'yyyy-mm-dd' o
   'yyyy-mm-ddTHH:mm:ss', sin sufijo Z y sin offset.

   Es a propósito. La app agrupa y compara días con `fecha.slice(0, 10)`
   (`mismoDia`, `ventasDelDia`, `claveMes`), así que ese prefijo tiene que ser
   el día del calendario del comerciante. `new Date().toISOString()` convierte
   a UTC, y al oeste de Greenwich eso adelanta el día: en San Juan (UTC−3) una
   venta de las 21:15 se guardaba como 00:15 del día siguiente y aparecía
   agrupada en mañana. Un comercio que cierra a las 21 tenía mal cargada la
   última hora de cada jornada.

   Un string sin zona además lo parsea `new Date(...)` como hora local, así que
   `hora(iso)` y `desdeISO(iso)` siguen funcionando igual.
   ────────────────────────────────────────────────────────────────────────── */

const dosDigitos = (n: number) => String(n).padStart(2, '0')

/** 'yyyy-mm-dd' de un Date, en hora local. */
export function isoLocal(d: Date = new Date()) {
  return `${d.getFullYear()}-${dosDigitos(d.getMonth() + 1)}-${dosDigitos(d.getDate())}`
}

/** 'yyyy-mm-ddTHH:mm:ss' de un Date, en hora local. Para marcas de tiempo. */
export function isoLocalConHora(d: Date = new Date()) {
  return `${isoLocal(d)}T${dosDigitos(d.getHours())}:${dosDigitos(d.getMinutes())}:${dosDigitos(d.getSeconds())}`
}

/** El día de hoy según el reloj del usuario. */
export const hoyISO = () => isoLocal()

/** Marca de tiempo de ahora, en hora local. Es lo que se guarda en `fecha`. */
export const ahoraISO = () => isoLocalConHora()

/** Convierte 'yyyy-mm-dd' a Date local (evita el corrimiento de zona de `new Date(str)`). */
export function desdeISO(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export const mismoDia = (a: string, b: string) => a.slice(0, 10) === b.slice(0, 10)

/** "Hoy" / "Ayer" / "mar 14 de mayo" */
export function fechaRelativa(iso: string) {
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(ayer.getDate() - 1)
  const s = iso.slice(0, 10)
  if (s === isoLocal(hoy)) return 'Hoy'
  if (s === isoLocal(ayer)) return 'Ayer'
  const d = desdeISO(s)
  return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** "14 de mayo" */
export function fechaCorta(iso: string) {
  const d = desdeISO(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]}`
}

/** "14/05" */
export function fechaNumerica(iso: string) {
  const d = desdeISO(iso)
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** "mayo 2025" */
export function mesLargo(d: Date) {
  return `${MESES[d.getMonth()]} ${d.getFullYear()}`
}

export const diaCorto = (d: Date) => DIAS[d.getDay()]

/** "14:35" a partir de un ISO con hora. */
export function hora(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Días que faltan (negativo si ya venció). */
export function diasHasta(iso: string) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const objetivo = desdeISO(iso)
  return Math.round((objetivo.getTime() - hoy.getTime()) / 86_400_000)
}

/** "vence en 3 días" / "vence hoy" / "venció hace 2 días" */
export function textoVencimiento(iso: string) {
  const d = diasHasta(iso)
  if (d === 0) return 'vence hoy'
  if (d === 1) return 'vence mañana'
  if (d > 1) return `vence en ${d} días`
  if (d === -1) return 'venció ayer'
  return `venció hace ${Math.abs(d)} días`
}

/** Clave 'yyyy-mm' de un ISO. */
export const claveMes = (iso: string) => iso.slice(0, 7)

/** Segundos → "0:34" */
export function duracion(seg: number) {
  return `${Math.floor(seg / 60)}:${String(Math.round(seg % 60)).padStart(2, '0')}`
}

export const inicial = (nombre: string) => (nombre.trim()[0] ?? '?').toUpperCase()
