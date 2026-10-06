import { createClient } from './client'
import type { ItemReposicionJSON, ItemVentaJSON, ProductoRow, ReposicionRow, VentaRow } from './types'
import type { Producto, Reposicion, Venta } from '@/lib/types'

/* ── Mapeo fila de Supabase ↔ tipo que usa la UI ────────────────────────── */

function productoDesdeRow(row: ProductoRow): Producto {
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    subcategoria: row.subcategoria ?? undefined,
    costo: Number(row.costo),
    precio: Number(row.precio),
    stock: Number(row.stock),
    stockMin: Number(row.stock_min),
    codigo: row.codigo ?? undefined,
    codigoBarras: row.codigo_barras ?? undefined,
  }
}

function ventaDesdeRow(row: VentaRow): Venta {
  return {
    id: row.id,
    fecha: row.fecha,
    items: row.items,
    total: Number(row.total),
    metodo: row.metodo,
  }
}

function reposicionDesdeRow(row: ReposicionRow): Reposicion {
  return {
    id: row.id,
    fecha: row.fecha,
    items: row.items,
    total: Number(row.total),
    origen: row.origen,
    proveedor: row.proveedor ?? undefined,
    comprobante: row.comprobante ?? undefined,
    foto: row.foto ?? undefined,
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

/** Supabase corta cada respuesta en 1000 filas (configuración por defecto
 *  del proyecto). Sin pedir de a páginas, pasadas las 1000 ventas las más
 *  viejas dejaban de cargarse sin ningún aviso — y con ellas el mes anterior,
 *  el Excel del contador y el acumulado de 12 meses para el Monotributo. */
const PAGINA = 1000

async function todasLasFilas<T>(
  pedir: (desde: number, hasta: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await pedir(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) return filas
  }
}

/* ── Productos ─────────────────────────────────────────────────────────── */

export async function fetchProductos(): Promise<Producto[]> {
  const supabase = createClient()
  const filas = await todasLasFilas((desde, hasta) =>
    supabase.from('productos').select('*').order('nombre', { ascending: true }).order('id').range(desde, hasta),
  )
  return filas.map(productoDesdeRow)
}

export async function crearProducto(datos: Omit<Producto, 'id'>): Promise<Producto> {
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('productos')
    .insert({
      user_id: user.id,
      nombre: datos.nombre,
      categoria: datos.categoria,
      subcategoria: datos.subcategoria || null,
      costo: datos.costo,
      precio: datos.precio,
      stock: datos.stock,
      stock_min: datos.stockMin,
      codigo: datos.codigo || null,
      codigo_barras: datos.codigoBarras || null,
    })
    .select()
    .single()
  if (error) throw error
  return productoDesdeRow(data)
}

export async function actualizarProducto(id: string, patch: Partial<Producto>): Promise<Producto> {
  const supabase = createClient()
  const cambios: Partial<ProductoRow> = {}
  if (patch.nombre !== undefined) cambios.nombre = patch.nombre
  if (patch.categoria !== undefined) cambios.categoria = patch.categoria
  if (patch.subcategoria !== undefined) cambios.subcategoria = patch.subcategoria || null
  if (patch.costo !== undefined) cambios.costo = patch.costo
  if (patch.precio !== undefined) cambios.precio = patch.precio
  if (patch.stock !== undefined) cambios.stock = patch.stock
  if (patch.stockMin !== undefined) cambios.stock_min = patch.stockMin
  if (patch.codigo !== undefined) cambios.codigo = patch.codigo || null
  if (patch.codigoBarras !== undefined) cambios.codigo_barras = patch.codigoBarras || null

  const { data, error } = await supabase
    .from('productos')
    .update(cambios)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return productoDesdeRow(data)
}

export async function borrarProducto(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) throw error
}

/** Inserta varios productos de una — se usa para la semilla de ejemplo. */
export async function crearProductosEnLote(items: Omit<Producto, 'id'>[]): Promise<Producto[]> {
  if (items.length === 0) return []
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('productos')
    .insert(
      items.map((p) => ({
        user_id: user.id,
        nombre: p.nombre,
        categoria: p.categoria,
        subcategoria: p.subcategoria || null,
        costo: p.costo,
        precio: p.precio,
        stock: p.stock,
        stock_min: p.stockMin,
        codigo: p.codigo || null,
      })),
    )
    .select()
  if (error) throw error
  return (data ?? []).map(productoDesdeRow)
}

/* ── Ventas ────────────────────────────────────────────────────────────── */

export async function fetchVentas(): Promise<Venta[]> {
  const supabase = createClient()
  const filas = await todasLasFilas((desde, hasta) =>
    supabase.from('ventas').select('*').order('fecha', { ascending: false }).order('id').range(desde, hasta),
  )
  return filas.map(ventaDesdeRow)
}

export async function crearVenta(datos: Omit<Venta, 'id'>): Promise<Venta> {
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('ventas')
    .insert({
      user_id: user.id,
      fecha: datos.fecha,
      items: datos.items as unknown as ItemVentaJSON[],
      total: datos.total,
      metodo: datos.metodo,
    })
    .select()
    .single()
  if (error) throw error
  return ventaDesdeRow(data)
}

export async function borrarVenta(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('ventas').delete().eq('id', id)
  if (error) throw error
}

/** Inserta varias ventas de una — se usa para la semilla de ejemplo. */
export async function crearVentasEnLote(items: Omit<Venta, 'id'>[]): Promise<Venta[]> {
  if (items.length === 0) return []
  const { supabase, user } = await usuarioActual()
  const { data, error } = await supabase
    .from('ventas')
    .insert(
      items.map((v) => ({
        user_id: user.id,
        fecha: v.fecha,
        items: v.items as unknown as ItemVentaJSON[],
        total: v.total,
        metodo: v.metodo,
      })),
    )
    .select()
  if (error) throw error
  return (data ?? []).map(ventaDesdeRow)
}

/* ── Reposiciones ──────────────────────────────────────────────────────── */

export async function fetchReposiciones(): Promise<Reposicion[]> {
  const supabase = createClient()
  const filas = await todasLasFilas((desde, hasta) =>
    supabase.from('reposiciones').select('*').order('fecha', { ascending: false }).order('id').range(desde, hasta),
  )
  return filas.map(reposicionDesdeRow)
}

export async function crearReposicion(datos: Omit<Reposicion, 'id'>): Promise<Reposicion> {
  const { supabase, user } = await usuarioActual()
  const base = {
    user_id: user.id,
    fecha: datos.fecha,
    items: datos.items as unknown as ItemReposicionJSON[],
    total: datos.total,
    origen: datos.origen,
  }
  // Proveedor, comprobante y foto sólo viajan si vienen con dato: así una
  // base sin la migración 0012 sigue aceptando las reposiciones de siempre.
  const extras = {
    ...(datos.proveedor ? { proveedor: datos.proveedor } : {}),
    ...(datos.comprobante ? { comprobante: datos.comprobante } : {}),
    ...(datos.foto ? { foto: datos.foto } : {}),
  }

  let res = await supabase.from('reposiciones').insert({ ...base, ...extras }).select().single()
  // PGRST204: columna desconocida — la migración 0012 todavía no se corrió.
  // Mejor perder el proveedor que dejar la factura sin cargar al stock.
  if (res.error?.code === 'PGRST204' && Object.keys(extras).length > 0) {
    res = await supabase.from('reposiciones').insert(base).select().single()
  }
  if (res.error) throw res.error
  return reposicionDesdeRow(res.data)
}

/** Borra productos, ventas y reposiciones de la cuenta — usado por "Borrar
 *  todos los datos" en Ajustes. RLS ya limita el alcance a la fila del
 *  usuario logueado, así que el filtro de abajo sólo necesita ser "cualquier
 *  fila" (Postgres exige algún `where` para el `delete`). */
export async function borrarTodo(): Promise<void> {
  const supabase = createClient()
  const [r1, r2, r3] = await Promise.all([
    supabase.from('productos').delete().not('id', 'is', null),
    supabase.from('ventas').delete().not('id', 'is', null),
    supabase.from('reposiciones').delete().not('id', 'is', null),
  ])
  const error = r1.error ?? r2.error ?? r3.error
  if (error) throw error
}

/* ── Realtime ──────────────────────────────────────────────────────────── */

/** Suscribe a cambios de `productos`/`ventas` de la cuenta actual. Devuelve
 *  una función para cortar la suscripción (llamarla al desmontar). */
export function suscribirseAOperaciones(onCambio: () => void): () => void {
  const supabase = createClient()

  const canal = supabase
    .channel('operaciones-cuenta')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'productos' }, onCambio)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'ventas' }, onCambio)
    .subscribe()

  return () => {
    supabase.removeChannel(canal)
  }
}
