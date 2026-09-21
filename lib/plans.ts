import {
  Boxes,
  Brain,
  Calculator,
  Camera,
  ChartColumn,
  Coins,
  House,
  ReceiptText,
  ScanLine,
  Store,
  Tags,
  Users,
  UsersRound,
  Wallet,
  Warehouse,
  type LucideIcon,
} from 'lucide-react'
import type { PlanId, Perfil } from './types'

export interface FeaturePlan {
  /** Cada línea lleva su propio ícono: nada de diez checks iguales. */
  icon: LucideIcon
  texto: string
}

export interface Plan {
  id: PlanId
  nombre: string
  bajada: string
  /** Precio mensual en pesos. 0 = gratis. */
  mensual: number
  /** Precio anual (equivale a 10 meses: dos meses bonificados). */
  anual: number
  icon: LucideIcon
  features: FeaturePlan[]
  badge?: string
  /** El plan gratuito lleva espacios publicitarios. */
  conAnuncios: boolean
  /** El recomendado se destaca con borde, sombra y escala. */
  recomendado?: boolean
}

export const PLANES: Record<PlanId, Plan> = {
  hogar: {
    id: 'hogar',
    nombre: 'Hogar',
    bajada: 'Para las cuentas de casa',
    mensual: 0,
    anual: 0,
    icon: House,
    conAnuncios: true,
    features: [
      { icon: Wallet, texto: 'Ingresos y gastos del mes' },
      { icon: Camera, texto: 'Cargá tickets con una foto' },
      { icon: ChartColumn, texto: 'Presupuesto por categoría' },
      { icon: UsersRound, texto: 'Cuenta familiar compartida' },
    ],
  },
  comercial: {
    id: 'comercial',
    nombre: 'Comercial',
    bajada: 'Para tu negocio',
    // TEMPORAL: precio real es 8900/89000 — bajado para probar el cobro con
    // tarjeta real sin gastar de más. Volver a subirlo cuando el usuario avise.
    mensual: 100,
    anual: 100,
    icon: Store,
    badge: 'Recomendado',
    recomendado: true,
    conAnuncios: false,
    features: [
      { icon: Coins, texto: 'Ventas y caja del día' },
      { icon: Boxes, texto: 'Stock con alertas de faltante' },
      { icon: Tags, texto: 'Catálogo con costos y margen' },
      { icon: Users, texto: 'Empleados y permisos' },
      { icon: ReceiptText, texto: 'Impuestos y vencimientos' },
    ],
  },
  'comercial-pro': {
    id: 'comercial-pro',
    nombre: 'Comercial Pro',
    bajada: 'Con Asistente IA',
    // TEMPORAL: mismo motivo que Comercial — precio real es 14900/149000.
    mensual: 100,
    anual: 100,
    icon: Warehouse,
    badge: 'IA',
    conAnuncios: false,
    features: [
      { icon: Store, texto: 'Todo lo del plan Comercial' },
      { icon: Calculator, texto: 'Estimación de impuestos con IA' },
      { icon: Users, texto: 'Análisis de costos de personal' },
      { icon: Tags, texto: 'Precio óptimo por producto' },
      { icon: ScanLine, texto: 'Carga de facturas por foto' },
      { icon: Brain, texto: 'Asistente por chat y audio' },
    ],
  },
}

export const ORDEN_PLANES: PlanId[] = ['hogar', 'comercial', 'comercial-pro']

export const esComercial = (plan: PlanId): plan is 'comercial' | 'comercial-pro' =>
  plan === 'comercial' || plan === 'comercial-pro'
export const esPro = (plan: PlanId) => plan === 'comercial-pro'

/** true si la cuenta tiene un plan pago sin el cobro mensual al día — el
 *  Hogar nunca se bloquea, es gratis siempre. `perfil` puede venir null
 *  mientras se hidrata desde Supabase: se trata como no bloqueada para no
 *  tapar la app con el aviso de pago durante ese instante inicial. */
export function cuentaBloqueada(perfil: Perfil | null): boolean {
  if (!perfil) return false
  return esComercial(perfil.plan) && !perfil.suscripcionActiva
}

/** Precio total por pagar `meses` de un plan de una sola vez. 12 meses usa
 *  el precio anual ya con descuento ("2 meses gratis"); cualquier otra
 *  cantidad es lineal (precio mensual × meses) — pagar varios meses juntos
 *  es sólo para evitar tener que volver a cargar la tarjeta seguido, no
 *  hace falta un descuento propio para eso. Sin dependencias de servidor:
 *  la usan tanto la pantalla de pago como `lib/server/mercadopago.ts`. */
export function montoPorMeses(plan: PlanId, meses: number): number {
  const def = PLANES[plan]
  if (meses >= 12) return def.anual
  return def.mensual * meses
}

/** Diferencia a cobrar al cambiar de un plan pago a otro a mitad de período
 *  (ej. Comercial → Comercial Pro con días ya pagados de Comercial). Se
 *  prorratea por día: días que quedan hasta `proximoCobro` × la diferencia
 *  entre el precio diario de cada plan (mensual / 30). Si el plan nuevo es
 *  más barato (o igual) el resultado da 0 — nunca se devuelve plata, sólo se
 *  cobra la diferencia cuando corresponde subir de plan. */
export function diferenciaProrrateada(
  planActual: PlanId,
  planNuevo: PlanId,
  proximoCobro: string,
): number {
  const hoy = new Date()
  const fin = new Date(`${proximoCobro}T00:00:00`)
  const diasRestantes = Math.max(0, Math.ceil((fin.getTime() - hoy.getTime()) / 86_400_000))
  const diarioActual = PLANES[planActual].mensual / 30
  const diarioNuevo = PLANES[planNuevo].mensual / 30
  return Math.max(0, Math.round(diasRestantes * (diarioNuevo - diarioActual)))
}
