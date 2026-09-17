import type { PlanId } from '@/lib/types'

/** Fila de la tabla `profiles`. El plan se guarda con guion bajo en la base
 *  (`comercial_pro`) porque así lo pide el `check` de la migración; `PlanId`
 *  en el resto de la app usa guion medio (`comercial-pro`), así que las
 *  funciones de mapeo de abajo son las únicas que conocen la diferencia. */
export interface ProfileRow {
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

/** Tipado mínimo de la base para el cliente tipado de Supabase. Sólo declara
 *  lo que esta migración crea; se amplía a medida que se agreguen tablas. */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Partial<ProfileRow> & { id: string }
        Update: Partial<ProfileRow>
      }
    }
  }
}
