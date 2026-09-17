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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
