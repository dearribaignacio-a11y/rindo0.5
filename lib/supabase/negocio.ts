import { createClient } from './client'
import { planADB, planDesdeDB } from './types'
import type { EmpresaRow, EmpleadoRow } from './types'
import type { Empresa, Empleado, PlanId } from '@/lib/types'

/* ── Mapeo fila de Supabase ↔ tipo que usa la UI ──────────────────────────
   La UI sigue hablando en español/camelCase (Empresa, Empleado) tal como
   estaba antes de migrar; sólo esta capa conoce los nombres de columna. */

function empresaDesdeRow(row: EmpresaRow): Empresa {
  return {
    id: row.id,
    razonSocial: row.razon_social ?? '',
    cuitCuil: row.cuit_cuil ?? undefined,
    direccion: row.direccion ?? undefined,
    rubro: row.rubro ?? undefined,
    logoUrl: row.logo_url ?? undefined,
    moneda: row.moneda,
  }
}

function empleadoDesdeRow(row: EmpleadoRow): Empleado {
  return {
    id: row.id,
    nombre: row.nombre_apellido,
    puesto: row.puesto ?? '',
    telefono: row.telefono ?? undefined,
    ingreso: row.fecha_ingreso ?? '',
    sueldo: row.salario,
    activo: row.activo,
  }
}

async function usuarioActual() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('No hay sesión activa')
  return { supabase, user }
}

/* ── Perfil (tabla `profiles`) ─────────────────────────────────────────────
   `Perfil` en el resto de la app vive sólo en localStorage — por eso "Cambiar
   plan"/"Mi Negocio" quedaban mudos al entrar desde otro navegador o
   dispositivo donde ese perfil nunca se creó. El plan en concreto SÍ tiene
   un lugar en Supabase desde el prompt de login (tabla `profiles`, creada
   por el trigger `handle_new_user`), simplemente nunca se leía de vuelta.
   Esto no migra el perfil entero (nombre de fantasía, ciudad, logo, etc.
   siguen sin vivir en el servidor) pero al menos el plan —lo que decide qué
   pantallas ve cada cuenta— ya no depende de qué navegador se esté usando. */

export interface PerfilRemoto {
  nombre: string
  negocio?: string
  plan: PlanId
  email: string
}

export async function fetchPerfilRemoto(): Promise<PerfilRemoto | null> {
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  return {
    nombre: data.nombre_apellido,
    negocio: data.nombre_negocio ?? undefined,
    plan: planDesdeDB(data.plan),
    email: user.email ?? '',
  }
}

export async function actualizarPlanRemoto(plan: PlanId): Promise<void> {
  const { supabase, user } = await usuarioActual()
  const { error } = await supabase.from('profiles').update({ plan: planADB(plan) }).eq('id', user.id)
  if (error) throw error
}

/* ── Empresa ───────────────────────────────────────────────────────────── */

export async function fetchEmpresa(): Promise<Empresa | null> {
  const supabase = createClient()
  const { data, error } = await supabase.from('empresas').select('*').maybeSingle()
  if (error) throw error
  return data ? empresaDesdeRow(data) : null
}

export interface DatosEmpresa {
  razonSocial: string
  cuitCuil?: string
  direccion?: string
  rubro?: string
  logoUrl?: string
  moneda: string
}

/** Una empresa por cuenta: si ya existe la actualiza, si no la crea —
 *  `onConflict: 'user_id'` aprovecha la columna unique de la migración. */
export async function guardarEmpresa(datos: DatosEmpresa): Promise<Empresa> {
  const { supabase, user } = await usuarioActual()

  const { data, error } = await supabase
    .from('empresas')
    .upsert(
      {
        user_id: user.id,
        razon_social: datos.razonSocial,
        cuit_cuil: datos.cuitCuil || null,
        direccion: datos.direccion || null,
        rubro: datos.rubro || null,
        logo_url: datos.logoUrl || null,
        moneda: datos.moneda,
      },
      { onConflict: 'user_id' },
    )
    .select()
    .single()

  if (error) throw error
  return empresaDesdeRow(data)
}

/* ── Empleados ─────────────────────────────────────────────────────────── */

export async function fetchEmpleados(empresaId: string): Promise<Empleado[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('empleados')
    .select('*')
    .eq('empresa_id', empresaId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(empleadoDesdeRow)
}

export async function crearEmpleado(
  empresaId: string,
  datos: Omit<Empleado, 'id'>,
): Promise<Empleado> {
  const { supabase, user } = await usuarioActual()

  const { data, error } = await supabase
    .from('empleados')
    .insert({
      user_id: user.id,
      empresa_id: empresaId,
      nombre_apellido: datos.nombre,
      puesto: datos.puesto || null,
      telefono: datos.telefono || null,
      salario: datos.sueldo,
      fecha_ingreso: datos.ingreso || null,
      activo: datos.activo,
    })
    .select()
    .single()

  if (error) throw error
  return empleadoDesdeRow(data)
}

export async function guardarEmpleado(id: string, patch: Partial<Empleado>): Promise<Empleado> {
  const supabase = createClient()
  const cambios: Partial<EmpleadoRow> = {}
  if (patch.nombre !== undefined) cambios.nombre_apellido = patch.nombre
  if (patch.puesto !== undefined) cambios.puesto = patch.puesto || null
  if (patch.telefono !== undefined) cambios.telefono = patch.telefono || null
  if (patch.sueldo !== undefined) cambios.salario = patch.sueldo
  if (patch.ingreso !== undefined) cambios.fecha_ingreso = patch.ingreso || null
  if (patch.activo !== undefined) cambios.activo = patch.activo

  const { data, error } = await supabase
    .from('empleados')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return empleadoDesdeRow(data)
}

export async function borrarEmpleado(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('empleados').delete().eq('id', id)
  if (error) throw error
}
