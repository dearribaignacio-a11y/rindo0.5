import type { PlanId } from '@/lib/types'

/** Fila de la tabla `profiles`. El plan se guarda con guion bajo en la base
 *  (`comercial_pro`) porque así lo pide el `check` de la migración; `PlanId`
 *  en el resto de la app usa guion medio (`comercial-pro`), así que las
 *  funciones de mapeo de abajo son las únicas que conocen la diferencia.
 *
 *  IMPORTANTE: estos tipos de fila van como `type`, no `interface` — con
 *  `interface`, `.insert()/.update()/.upsert()` de `@supabase/postgrest-js`
 *  infieren `never` y cualquier objeto real da error de tipos. Es un detalle
 *  fino de cómo TypeScript resuelve los tipos condicionales anidados de esa
 *  librería contra una interfaz "abierta" (ampliable) en vez de un `type`
 *  cerrado — no toca `interface` acá sin volver a probar `.insert()`. */
export type ProfileRow = {
  id: string
  nombre_apellido: string
  nombre_negocio: string | null
  telefono: string
  plan: 'hogar' | 'comercial' | 'comercial_pro'
  /** Si la cuenta puede usar un plan pago o está bloqueada por falta de
   *  pago. Sólo la escribe el webhook de Mercado Pago (Service Role Key) —
   *  ver `supabase/migrations/0004_suscripcion.sql`. */
  suscripcion_activa: boolean
  mp_preapproval_id: string | null
  /** Último estado crudo que mandó Mercado Pago (`authorized`, `paused`,
   *  `cancelled`, `pending`) — no se usa para decidir nada, es para poder
   *  ver en la base qué pasó sin tener que ir a buscarlo a la API de MP. */
  mp_estado: string | null
  suscripcion_actualizada_at: string | null
  created_at: string
  updated_at: string
}

export type Profile = ProfileRow

export function planADB(plan: PlanId): ProfileRow['plan'] {
  return plan === 'comercial-pro' ? 'comercial_pro' : plan
}

export function planDesdeDB(plan: ProfileRow['plan']): PlanId {
  return plan === 'comercial_pro' ? 'comercial-pro' : plan
}

/** Fila de la tabla `empresas` — una por cuenta (`user_id` es unique). */
export type EmpresaRow = {
  id: string
  user_id: string
  razon_social: string | null
  cuit_cuil: string | null
  direccion: string | null
  rubro: string | null
  logo_url: string | null
  moneda: string
  created_at: string
  updated_at: string
}

/** Fila de la tabla `empleados` — varias por cuenta, referenciando su empresa. */
export type EmpleadoRow = {
  id: string
  user_id: string
  empresa_id: string
  nombre_apellido: string
  puesto: string | null
  telefono: string | null
  salario: number | null
  fecha_ingreso: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

/** Fila de la tabla `productos`. */
export type ProductoRow = {
  id: string
  user_id: string
  nombre: string
  categoria: string
  costo: number
  precio: number
  stock: number
  stock_min: number
  created_at: string
  updated_at: string
}

/** Item de una venta o reposición — se guarda como jsonb, no como filas
 *  propias: es un detalle chico y de sólo lectura una vez cargado. */
export type ItemVentaJSON = {
  productoId: string
  nombre: string
  cantidad: number
  precio: number
}

export type ItemReposicionJSON = {
  productoId: string | null
  nombre: string
  cantidad: number
  costo: number
  autoDetectado?: boolean
}

/** Fila de la tabla `ventas`. */
export type VentaRow = {
  id: string
  user_id: string
  fecha: string
  items: ItemVentaJSON[]
  total: number
  metodo: 'efectivo' | 'tarjeta' | 'transferencia'
  created_at: string
}

/** Fila de la tabla `reposiciones`. */
export type ReposicionRow = {
  id: string
  user_id: string
  fecha: string
  items: ItemReposicionJSON[]
  total: number
  origen: 'manual' | 'foto'
  created_at: string
}

/** Tipado mínimo de la base para el cliente tipado de Supabase. Sólo declara
 *  lo que las migraciones crean; se amplía a medida que se agreguen tablas.
 *  `Relationships`, `Views` y `Functions` están vacíos a propósito — nada acá
 *  los usa todavía, pero `@supabase/postgrest-js` exige que existan para que
 *  el tipado genérico de `.from(...)` funcione (si no, infiere `never`). */
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      empresas: {
        Row: EmpresaRow
        Insert: Partial<EmpresaRow> & { user_id: string }
        Update: Partial<EmpresaRow>
        Relationships: []
      }
      empleados: {
        Row: EmpleadoRow
        Insert: Partial<EmpleadoRow> & { user_id: string; empresa_id: string; nombre_apellido: string }
        Update: Partial<EmpleadoRow>
        Relationships: []
      }
      productos: {
        Row: ProductoRow
        Insert: Partial<ProductoRow> & { user_id: string; precio: number }
        Update: Partial<ProductoRow>
        Relationships: []
      }
      ventas: {
        Row: VentaRow
        Insert: Partial<VentaRow> & { user_id: string; fecha: string; metodo: VentaRow['metodo'] }
        Update: Partial<VentaRow>
        Relationships: []
      }
      reposiciones: {
        Row: ReposicionRow
        Insert: Partial<ReposicionRow> & { user_id: string; fecha: string; origen: ReposicionRow['origen'] }
        Update: Partial<ReposicionRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
