import { claveMes, desdeISO, diaCorto, hoyISO, isoLocal } from './format'
import type { Categoria, Empleado, Movimiento, Producto, Venta } from './types'

/* ══════════════════════════════════════════════════════════════════════════
   Derivaciones puras sobre los datos guardados.

   Todo lo que las pantallas muestran como "resumen" se calcula acá y no en el
   componente: así el mismo número sale igual en Resumen, en Movimientos y en
   los paneles de IA, y se puede probar sin montar React.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Hogar ─────────────────────────────────────────────────────────────── */

export interface ResumenMes {
  ingresos: number
  gastos: number
  balance: number
}

export function resumenMes(movs: Movimiento[], mes = claveMes(hoyISO())): ResumenMes {
  let ingresos = 0
  let gastos = 0
  for (const m of movs) {
    if (claveMes(m.fecha) !== mes) continue
    if (m.tipo === 'ingreso') ingresos += m.monto
    else gastos += m.monto
  }
  return { ingresos, gastos, balance: ingresos - gastos }
}

export interface UsoCategoria {
  categoria: Categoria
  gastado: number
  /** gastado / límite. Infinito evitado: sin límite devuelve 0. */
  ratio: number
  restante: number
}

/** Gasto del mes por categoría, ordenado por cuánto se consumió del límite. */
export function usoPorCategoria(
  movs: Movimiento[],
  cats: Categoria[],
  mes = claveMes(hoyISO()),
): UsoCategoria[] {
  const gastoPorCat = new Map<string, number>()
  for (const m of movs) {
    if (m.tipo !== 'gasto' || claveMes(m.fecha) !== mes) continue
    gastoPorCat.set(m.categoriaId, (gastoPorCat.get(m.categoriaId) ?? 0) + m.monto)
  }

  return cats
    .filter((c) => c.limite > 0)
    .map((categoria) => {
      const gastado = gastoPorCat.get(categoria.id) ?? 0
      return {
        categoria,
        gastado,
        ratio: categoria.limite > 0 ? gastado / categoria.limite : 0,
        restante: categoria.limite - gastado,
      }
    })
    .sort((a, b) => b.ratio - a.ratio)
}

/** Total gastado en el mes, incluidas las categorías sin presupuesto. */
export function gastoDelMes(movs: Movimiento[], mes = claveMes(hoyISO())) {
  return movs
    .filter((m) => m.tipo === 'gasto' && claveMes(m.fecha) === mes)
    .reduce((s, m) => s + m.monto, 0)
}

/** Agrupa movimientos por día conservando el orden descendente. */
export function agruparPorFecha<T extends { fecha: string }>(items: T[]) {
  const mapa = new Map<string, T[]>()
  for (const item of items) {
    const dia = item.fecha.slice(0, 10)
    const lista = mapa.get(dia)
    if (lista) lista.push(item)
    else mapa.set(dia, [item])
  }
  return [...mapa.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

/* ── Comercial ─────────────────────────────────────────────────────────── */

export const totalVentas = (ventas: Venta[]) => ventas.reduce((s, v) => s + v.total, 0)

export const ventasDelDia = (ventas: Venta[], dia: string) =>
  ventas.filter((v) => v.fecha.slice(0, 10) === dia)

export type PeriodoRanking = 'hoy' | 'semana' | 'mes' | 'todo'

/** Ventas de los últimos N días corridos, incluido hoy — "todo" no filtra
 *  nada. Se usa para el ranking de más vendidos con distintas ventanas. */
export function ventasEnPeriodo(ventas: Venta[], periodo: PeriodoRanking): Venta[] {
  if (periodo === 'todo') return ventas
  if (periodo === 'hoy') return ventasDelDia(ventas, hoyISO())
  const dias = periodo === 'semana' ? 7 : 30
  const desde = new Date()
  desde.setHours(0, 0, 0, 0)
  desde.setDate(desde.getDate() - (dias - 1))
  return ventas.filter((v) => new Date(v.fecha) >= desde)
}

/** Serie de los últimos `dias` días, del más viejo al más nuevo. */
export function serieVentas(ventas: Venta[], dias = 7) {
  const salida: { label: string; value: number; iso: string; highlight?: boolean }[] = []
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const iso = isoLocal(d)
    salida.push({
      label: diaCorto(d),
      iso,
      value: totalVentas(ventasDelDia(ventas, iso)),
      highlight: i === 0,
    })
  }
  return salida
}

/** Ventas por hora de un día, de 8 a 22. */
export function ventasPorHora(ventas: Venta[], dia: string) {
  const delDia = ventasDelDia(ventas, dia)
  const horas = Array.from({ length: 15 }, (_, k) => 8 + k)
  const totales = horas.map((h) => ({
    hora: h,
    total: delDia
      .filter((v) => new Date(v.fecha).getHours() === h)
      .reduce((s, v) => s + v.total, 0),
  }))
  const pico = totales.reduce((mejor, t) => (t.total > mejor.total ? t : mejor), totales[0])
  return {
    barras: totales.map((t) => ({
      label: `${t.hora}`,
      value: t.total,
      highlight: t.total > 0 && t.hora === pico.hora,
    })),
    pico: pico.total > 0 ? pico : null,
  }
}

export interface RankingProducto {
  producto: Producto | undefined
  productoId: string
  nombre: string
  unidades: number
  facturado: number
  /** Facturado menos el costo ACTUAL del producto × unidades — estimado con
   *  el costo de hoy, no el que tenía en cada venta (no se guarda un
   *  histórico de costo por venta), igual que ya hace `margen()`. */
  ganancia: number
}

/** Qué se vendió más en un conjunto de ventas. */
export function rankingProductos(ventas: Venta[], productos: Producto[]): RankingProducto[] {
  const acum = new Map<string, RankingProducto>()
  for (const v of ventas) {
    for (const i of v.items) {
      const producto = productos.find((p) => p.id === i.productoId)
      const costoUnit = producto?.costo ?? 0
      const previo = acum.get(i.productoId)
      if (previo) {
        previo.unidades += i.cantidad
        previo.facturado += i.cantidad * i.precio
        previo.ganancia += i.cantidad * (i.precio - costoUnit)
      } else {
        acum.set(i.productoId, {
          productoId: i.productoId,
          nombre: i.nombre,
          producto,
          unidades: i.cantidad,
          facturado: i.cantidad * i.precio,
          ganancia: i.cantidad * (i.precio - costoUnit),
        })
      }
    }
  }
  return [...acum.values()].sort((a, b) => b.unidades - a.unidades)
}

export const margen = (p: Producto) => (p.precio > 0 ? (p.precio - p.costo) / p.precio : 0)

export const stockCritico = (productos: Producto[]) =>
  productos.filter((p) => p.stock <= p.stockMin).sort((a, b) => a.stock - b.stock)

/** Nivel de stock 0–1 contra un objetivo de 3× el mínimo (o 10 unidades). */
export function nivelStock(p: Producto) {
  const objetivo = Math.max(p.stockMin * 3, 10)
  return Math.min(1, p.stock / objetivo)
}

/** Costo mensual real de un empleado: sueldo + ~38% de cargas y aportes.
 *  El sueldo es opcional (no todos los negocios lo quieren cargar) — sin
 *  dato, el costo es 0 en vez de romper el cálculo. */
export const CARGAS_SOCIALES = 0.38
export const costoEmpleado = (e: Empleado) =>
  e.sueldo == null ? 0 : Math.round(e.sueldo * (1 + CARGAS_SOCIALES))

/** Ticket promedio del conjunto. */
export const ticketPromedio = (ventas: Venta[]) =>
  ventas.length ? totalVentas(ventas) / ventas.length : 0

/** Variación relativa entre dos valores; 0 si el anterior era 0. */
export const variacion = (actual: number, anterior: number) =>
  anterior > 0 ? (actual - anterior) / anterior : 0

/** Ventas del mes en curso. */
export function ventasDelMes(ventas: Venta[], mes = claveMes(hoyISO())) {
  return ventas.filter((v) => claveMes(v.fecha) === mes)
}

/** Costo de la mercadería vendida en un conjunto de ventas. */
export function costoMercaderia(ventas: Venta[], productos: Producto[]) {
  let total = 0
  for (const v of ventas) {
    for (const i of v.items) {
      const p = productos.find((x) => x.id === i.productoId)
      if (p) total += p.costo * i.cantidad
    }
  }
  return total
}

/** Días transcurridos del mes en curso, mínimo 1 (para proyectar). */
export function diasDelMesTranscurridos() {
  return Math.max(1, new Date().getDate())
}

export function diasDelMes(fecha = new Date()) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + 1, 0).getDate()
}

/** Cuántas unidades de un producto se vendieron en los últimos `dias` días. */
export function unidadesVendidas(ventas: Venta[], productoId: string, dias = 30) {
  const desde = new Date()
  desde.setDate(desde.getDate() - dias)
  return ventas
    .filter((v) => desdeISO(v.fecha) >= desde)
    .flatMap((v) => v.items)
    .filter((i) => i.productoId === productoId)
    .reduce((s, i) => s + i.cantidad, 0)
}
