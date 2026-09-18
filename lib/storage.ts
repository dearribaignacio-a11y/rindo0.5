'use client'

/**
 * Capa de persistencia de Rindo.
 *
 * Hoy: un único documento JSON en localStorage bajo la clave `rindo.db`.
 * Mañana: ese mismo documento es la fila del usuario en una base real. Por eso
 * toda la UI habla con las funciones de este módulo y nunca con `localStorage`
 * directamente — migrar es reimplementar este archivo, no tocar pantallas.
 *
 * El estado vive además en memoria (`cache`) para que `useDB()` pueda devolver
 * siempre la misma referencia y `useSyncExternalStore` no entre en loop.
 */

import type {
  Ajustes,
  Categoria,
  DB,
  Empleado,
  Empresa,
  Flags,
  Impuesto,
  Invitacion,
  Mensaje,
  Miembro,
  Movimiento,
  Perfil,
  Producto,
  Reposicion,
  ThemeId,
  Venta,
} from './types'
import { ahoraISO, hoyISO } from './format'
import * as negocio from './supabase/negocio'
import * as operaciones from './supabase/operaciones'

const KEY = 'rindo.db'
const THEME_KEY = 'rindo.theme'
const VERSION = 1

export const dbVacia = (): DB => ({
  version: VERSION,
  perfil: null,
  empresa: null,
  categorias: [],
  movimientos: [],
  miembros: [],
  invitacion: null,
  productos: [],
  ventas: [],
  reposiciones: [],
  empleados: [],
  impuestos: [],
  mensajes: [],
  preciosIgnorados: [],
  ajustes: { tema: 'petroleo', moneda: 'ARS', notificaciones: true, idioma: 'Español (AR)' },
  flags: { setupHecho: false, onboardingVisto: false, sesionIniciada: false },
})

/* ── Núcleo del store ──────────────────────────────────────────────────── */

let cache: DB | null = null
const listeners = new Set<() => void>()

function leerDisco(): DB {
  if (typeof window === 'undefined') return dbVacia()
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return dbVacia()
    const parsed = JSON.parse(raw) as Partial<DB>
    // Merge contra el default: si mañana se agrega una colección, las bases
    // viejas no explotan por venir sin esa clave.
    return {
      ...dbVacia(),
      ...parsed,
      // Empresa, empleados, productos, ventas y reposiciones viven en
      // Supabase, no acá — arrancan vacíos hasta que `hidratarNegocio()` /
      // `hidratarOperaciones()` los traen, aunque una versión vieja de este
      // mismo documento los tuviera guardados.
      empresa: null,
      empleados: [],
      productos: [],
      ventas: [],
      reposiciones: [],
      version: VERSION,
    }
  } catch {
    return dbVacia()
  }
}

function escribirDisco(db: DB) {
  if (typeof window === 'undefined') return
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { empresa, empleados, productos, ventas, reposiciones, ...persistible } = db
    window.localStorage.setItem(KEY, JSON.stringify(persistible))
  } catch {
    // Cuota llena o modo privado: la app sigue andando en memoria.
  }
}

export function getDB(): DB {
  if (!cache) cache = leerDisco()
  return cache
}

/** Aplica un cambio inmutable, persiste y avisa a los suscriptores. */
export function setDB(patch: (db: DB) => DB) {
  const next = patch(getDB())
  cache = next
  escribirDisco(next)
  listeners.forEach((l) => l())
}

export function subscribe(fn: () => void) {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}

/** Snapshot estable para SSR: el shell no renderiza datos hasta montar. */
const SNAPSHOT_SSR = dbVacia()
export const getServerSnapshot = () => SNAPSHOT_SSR

const id = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const nuevoId = id

/* ── Perfil, ajustes y flags ───────────────────────────────────────────── */

export const getPerfil = () => getDB().perfil

export function setPerfil(perfil: Perfil) {
  setDB((db) => ({ ...db, perfil }))
}

export function updatePerfil(patch: Partial<Perfil>) {
  setDB((db) => (db.perfil ? { ...db, perfil: { ...db.perfil, ...patch } } : db))
}

/**
 * Trae el plan (y nombre/negocio como respaldo) desde la tabla `profiles` de
 * Supabase. Si ya hay un perfil local, sólo confía el `plan` del servidor —
 * el resto de los campos locales (ciudad, logo, etc.) no se pisan, porque
 * todavía no tienen dónde vivir en el servidor. Si no hay perfil local en
 * absoluto (otro navegador o dispositivo), arma uno mínimo con lo que sí
 * está en Supabase, para que "Cambiar plan" y "Mi Negocio" dejen de quedar
 * mudos por falta de perfil.
 */
export async function hidratarPerfil() {
  const remoto = await negocio.fetchPerfilRemoto()
  if (!remoto) return
  setDB((db) => ({
    ...db,
    perfil: db.perfil
      ? { ...db.perfil, plan: remoto.plan }
      : { nombre: remoto.nombre, email: remoto.email, plan: remoto.plan, moneda: 'ARS', negocio: remoto.negocio },
  }))
}

/** Cambia de plan local y en Supabase, para que el plan de la cuenta no
 *  dependa de en qué navegador se lo cambiaste. */
export async function cambiarPlan(plan: Perfil['plan']) {
  updatePerfil({ plan })
  await negocio.actualizarPlanRemoto(plan)
}

export const getAjustes = () => getDB().ajustes

export function updateAjustes(patch: Partial<Ajustes>) {
  setDB((db) => ({ ...db, ajustes: { ...db.ajustes, ...patch } }))
}

export function updateFlags(patch: Partial<Flags>) {
  setDB((db) => ({ ...db, flags: { ...db.flags, ...patch } }))
}

/** El tema vive también en su propia clave: el script del <head> lo lee antes
 *  de que exista React, así no hay flash del tema anterior. */
export function aplicarTema(tema: ThemeId) {
  updateAjustes({ tema })
  if (typeof document === 'undefined') return
  if (tema === 'petroleo') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.setAttribute('data-theme', tema)
  try {
    window.localStorage.setItem(THEME_KEY, tema)
  } catch {
    /* ignorado */
  }
}

/* ── Categorías ────────────────────────────────────────────────────────── */

export const getCategorias = () => getDB().categorias
export const getCategoria = (cid: string) => getDB().categorias.find((c) => c.id === cid)

export function addCategoria(cat: Omit<Categoria, 'id'>) {
  const nueva: Categoria = { ...cat, id: id() }
  setDB((db) => ({ ...db, categorias: [...db.categorias, nueva] }))
  return nueva
}

export function updateCategoria(cid: string, patch: Partial<Categoria>) {
  setDB((db) => ({
    ...db,
    categorias: db.categorias.map((c) => (c.id === cid ? { ...c, ...patch } : c)),
  }))
}

export function removeCategoria(cid: string) {
  setDB((db) => ({ ...db, categorias: db.categorias.filter((c) => c.id !== cid) }))
}

/**
 * Reinserta una categoría con su id original — es el "Deshacer" del borrado.
 * Conservar el id importa: los movimientos la referencian por ahí, así que
 * volver a crearla con uno nuevo los dejaría huérfanos.
 */
export function restoreCategoria(cat: Categoria) {
  setDB((db) =>
    db.categorias.some((c) => c.id === cat.id)
      ? db
      : { ...db, categorias: [...db.categorias, cat] },
  )
}

/* ── Movimientos ───────────────────────────────────────────────────────── */

export const getMovimientos = () => getDB().movimientos

export function addMovimiento(mov: Omit<Movimiento, 'id'>) {
  const nuevo: Movimiento = { ...mov, id: id() }
  // Orden descendente por fecha: la lista se consume siempre así.
  setDB((db) => ({
    ...db,
    movimientos: [nuevo, ...db.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
  }))
  return nuevo
}

export function updateMovimiento(mid: string, patch: Partial<Movimiento>) {
  setDB((db) => ({
    ...db,
    movimientos: db.movimientos.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
  }))
}

export function removeMovimiento(mid: string) {
  setDB((db) => ({ ...db, movimientos: db.movimientos.filter((m) => m.id !== mid) }))
}

/** Reinserta un movimiento con su id original, respetando el orden por fecha. */
export function restoreMovimiento(mov: Movimiento) {
  setDB((db) =>
    db.movimientos.some((m) => m.id === mov.id)
      ? db
      : {
          ...db,
          movimientos: [mov, ...db.movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)),
        },
  )
}

/* ── Familia ───────────────────────────────────────────────────────────── */

export const getMiembros = () => getDB().miembros

export function addMiembro(m: Omit<Miembro, 'id'>) {
  const nuevo: Miembro = { ...m, id: id() }
  setDB((db) => ({ ...db, miembros: [...db.miembros, nuevo] }))
  return nuevo
}

export function removeMiembro(mid: string) {
  setDB((db) => ({ ...db, miembros: db.miembros.filter((m) => m.id !== mid) }))
}

/** Genera (o reusa) el código de invitación de la cuenta familiar. */
export function getInvitacion(): Invitacion {
  const actual = getDB().invitacion
  if (actual) return actual
  const codigo = Array.from({ length: 6 }, () =>
    'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'.charAt(Math.floor(Math.random() * 32)),
  ).join('')
  const inv: Invitacion = { codigo, creada: ahoraISO(), estado: 'pendiente' }
  setDB((db) => ({ ...db, invitacion: inv }))
  return inv
}

/* ── Productos, Ventas y Reposiciones (Supabase) ──────────────────────────
   Igual que Empresa/Empleados: no viven en localStorage, se leen y escriben
   directo contra Supabase (ver `lib/supabase/operaciones.ts`) para que estén
   disponibles en cualquier dispositivo. `hidratarOperaciones()` los trae al
   entrar, y `suscribirseAOperaciones()` los mantiene al día en tiempo real
   si el mismo usuario tiene la app abierta en dos dispositivos a la vez. */

export const getProductos = () => getDB().productos
export const getProducto = (pid: string) => getDB().productos.find((p) => p.id === pid)
export const getVentas = () => getDB().ventas
export const getReposiciones = () => getDB().reposiciones

/** Trae productos, ventas y reposiciones de Supabase y los carga en el store. */
export async function hidratarOperaciones() {
  const [productos, ventas, reposiciones] = await Promise.all([
    operaciones.fetchProductos(),
    operaciones.fetchVentas(),
    operaciones.fetchReposiciones(),
  ])
  setDB((db) => ({ ...db, productos, ventas, reposiciones }))
}

/** Se suscribe a cambios remotos de productos/ventas y re-hidrata al vuelo.
 *  Devuelve la función para cortar la suscripción (llamarla al desmontar). */
export function suscribirseAOperaciones() {
  return operaciones.suscribirseAOperaciones(() => {
    hidratarOperaciones().catch(() => {
      // Un evento de Realtime que llega justo cuando se cae la red no debería
      // tirar un error a la consola del usuario final.
    })
  })
}

export async function addProducto(p: Omit<Producto, 'id'>) {
  const nuevo = await operaciones.crearProducto(p)
  setDB((db) => ({ ...db, productos: [...db.productos, nuevo] }))
  return nuevo
}

export async function updateProducto(pid: string, patch: Partial<Producto>) {
  const actualizado = await operaciones.actualizarProducto(pid, patch)
  setDB((db) => ({
    ...db,
    productos: db.productos.map((p) => (p.id === pid ? actualizado : p)),
  }))
  return actualizado
}

export async function removeProducto(pid: string) {
  await operaciones.borrarProducto(pid)
  setDB((db) => ({ ...db, productos: db.productos.filter((p) => p.id !== pid) }))
}

/** Suma (o resta, con delta negativo) unidades sin bajar de cero. */
export async function ajustarStock(pid: string, delta: number) {
  const actual = getDB().productos.find((p) => p.id === pid)
  if (!actual) return
  await updateProducto(pid, { stock: Math.max(0, actual.stock + delta) })
}

/**
 * Registra la venta y descuenta el stock de cada ítem. No es una única
 * transacción atómica (son varias llamadas a Supabase en secuencia), pero
 * para una sola cuenta cargando sus propias ventas el riesgo de carrera es
 * despreciable. Secuencial y no en paralelo para no perder un descuento si
 * la misma venta repite el mismo producto en dos renglones.
 */
export async function addVenta(venta: Omit<Venta, 'id'>) {
  const nueva = await operaciones.crearVenta(venta)

  let productos = getDB().productos
  for (const item of nueva.items) {
    const actual = productos.find((p) => p.id === item.productoId)
    if (!actual) continue
    const actualizado = await operaciones.actualizarProducto(item.productoId, {
      stock: Math.max(0, actual.stock - item.cantidad),
    })
    productos = productos.map((p) => (p.id === actualizado.id ? actualizado : p))
  }

  setDB((db) => ({ ...db, ventas: [nueva, ...db.ventas], productos }))
  return nueva
}

export async function removeVenta(vid: string) {
  await operaciones.borrarVenta(vid)
  setDB((db) => ({ ...db, ventas: db.ventas.filter((v) => v.id !== vid) }))
}

/** Aplica una reposición: suma stock a lo conocido y da de alta lo nuevo. */
export async function addReposicion(rep: Omit<Reposicion, 'id'>) {
  let productos = getDB().productos
  const items: Reposicion['items'] = []

  for (const item of rep.items) {
    const idx = item.productoId
      ? productos.findIndex((p) => p.id === item.productoId)
      : productos.findIndex((p) => p.nombre.toLowerCase() === item.nombre.toLowerCase())

    if (idx >= 0) {
      const actualizado = await operaciones.actualizarProducto(productos[idx].id, {
        stock: productos[idx].stock + item.cantidad,
        costo: item.costo || productos[idx].costo,
      })
      productos = productos.map((p) => (p.id === actualizado.id ? actualizado : p))
      items.push({ ...item, productoId: actualizado.id })
    } else {
      // Producto desconocido: se da de alta con un margen inicial del 60%.
      const nuevo = await operaciones.crearProducto({
        nombre: item.nombre,
        categoria: 'Sin categoría',
        costo: item.costo,
        precio: Math.round((item.costo * 1.6) / 10) * 10,
        stock: item.cantidad,
        stockMin: 5,
      })
      productos = [...productos, nuevo]
      items.push({ ...item, productoId: nuevo.id })
    }
  }

  const nueva = await operaciones.crearReposicion({ ...rep, items })
  setDB((db) => ({ ...db, productos, reposiciones: [nueva, ...db.reposiciones] }))
  return nueva
}

/* ── Empresa y empleados (Supabase) ───────────────────────────────────────
   A diferencia del resto de este archivo, estas colecciones no viven en
   localStorage: se leen y escriben directo contra Supabase (ver
   `lib/supabase/negocio.ts`) para que estén disponibles en cualquier
   dispositivo donde el usuario inicie sesión. `cache.empresa`/`empleados`
   son sólo un espejo en memoria para que las pantallas sigan leyendo de
   `useDB()` como con cualquier otra colección. */

export const getEmpresa = () => getDB().empresa
export const getEmpleados = () => getDB().empleados

/** Trae empresa y empleados de Supabase y los carga en el store. Se llama
 *  una vez al entrar al dashboard (ver `screens/Rindo.tsx`). */
export async function hidratarNegocio() {
  const empresa = await negocio.fetchEmpresa()
  const empleados = empresa ? await negocio.fetchEmpleados(empresa.id) : []
  setDB((db) => ({ ...db, empresa, empleados }))
}

export async function guardarEmpresa(datos: negocio.DatosEmpresa) {
  const empresa = await negocio.guardarEmpresa(datos)
  setDB((db) => ({ ...db, empresa }))
  return empresa
}

export async function addEmpleado(e: Omit<Empleado, 'id'>) {
  const empresa = getDB().empresa
  if (!empresa) throw new Error('Todavía no cargaste los datos de la empresa')
  const nuevo = await negocio.crearEmpleado(empresa.id, e)
  setDB((db) => ({ ...db, empleados: [...db.empleados, nuevo] }))
  return nuevo
}

export async function updateEmpleado(eid: string, patch: Partial<Empleado>) {
  const actualizado = await negocio.guardarEmpleado(eid, patch)
  setDB((db) => ({
    ...db,
    empleados: db.empleados.map((e) => (e.id === eid ? actualizado : e)),
  }))
  return actualizado
}

export async function removeEmpleado(eid: string) {
  await negocio.borrarEmpleado(eid)
  setDB((db) => ({ ...db, empleados: db.empleados.filter((e) => e.id !== eid) }))
}

/* ── Impuestos ─────────────────────────────────────────────────────────── */

export const getImpuestos = () => getDB().impuestos

export function addImpuesto(i: Omit<Impuesto, 'id'>) {
  const nuevo: Impuesto = { ...i, id: id() }
  setDB((db) => ({ ...db, impuestos: [...db.impuestos, nuevo] }))
  return nuevo
}

export function updateImpuesto(iid: string, patch: Partial<Impuesto>) {
  setDB((db) => ({
    ...db,
    impuestos: db.impuestos.map((i) => (i.id === iid ? { ...i, ...patch } : i)),
  }))
}

export function removeImpuesto(iid: string) {
  setDB((db) => ({ ...db, impuestos: db.impuestos.filter((i) => i.id !== iid) }))
}

/** Marca pagado el período actual y lo agrega al historial. */
export function marcarPagado(iid: string) {
  const hoy = hoyISO()
  setDB((db) => ({
    ...db,
    impuestos: db.impuestos.map((i) =>
      i.id === iid
        ? { ...i, estado: 'pagado' as const, pagos: [{ fecha: hoy, monto: i.monto }, ...i.pagos] }
        : i,
    ),
  }))
}

/* ── Chat del asistente ────────────────────────────────────────────────── */

export const getMensajes = () => getDB().mensajes

export function addMensaje(m: Omit<Mensaje, 'id'>) {
  const nuevo: Mensaje = { ...m, id: id() }
  setDB((db) => ({ ...db, mensajes: [...db.mensajes, nuevo] }))
  return nuevo
}

export function updateMensaje(mid: string, patch: Partial<Mensaje>) {
  setDB((db) => ({
    ...db,
    mensajes: db.mensajes.map((m) => (m.id === mid ? { ...m, ...patch } : m)),
  }))
}

/* ── Sugerencias de precio descartadas ─────────────────────────────────── */

export function ignorarPrecio(pid: string) {
  setDB((db) => ({ ...db, preciosIgnorados: [...new Set([...db.preciosIgnorados, pid])] }))
}

export function limpiarPreciosIgnorados() {
  setDB((db) => ({ ...db, preciosIgnorados: [] }))
}

/* ── Ciclo de vida ─────────────────────────────────────────────────────── */

/** Fija el perfil de la cuenta. Se llama al terminar el setup inicial. No
 *  carga datos de ejemplo: una cuenta nueva arranca vacía, como cualquier
 *  cuenta real — antes sembraba productos/ventas/movimientos de mentira,
 *  pero confundía a un comerciante real ver actividad que nunca cargó. */
export function sembrar(perfil: Perfil) {
  setDB((db) => ({ ...db, perfil }))
}

export function cerrarSesion() {
  updateFlags({ sesionIniciada: false })
}

/** Borrado total — usado por "Borrar todos los datos" en Ajustes. */
export async function resetDB() {
  await operaciones.borrarTodo().catch(() => {
    // Si falla el borrado remoto (sin red, etc.) igual limpiamos localmente
    // para no dejar la app en un estado peor que antes de tocar el botón.
  })
  cache = dbVacia()
  escribirDisco(cache)
  if (typeof document !== 'undefined') document.documentElement.removeAttribute('data-theme')
  try {
    window.localStorage.removeItem(THEME_KEY)
  } catch {
    /* ignorado */
  }
  listeners.forEach((l) => l())
}
