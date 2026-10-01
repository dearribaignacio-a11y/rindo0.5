/**
 * Período y totales de "Enviar al contador". Todo puro: recibe los datos y
 * devuelve números, sin tocar el store — así lo usan igual la app real y la
 * demo con datos de ejemplo.
 */

import { desdeISO, isoLocal, mesLargo } from '@/lib/format'
import type { Producto, Reposicion, Venta } from '@/lib/types'

export type TipoPeriodo = 'actual' | 'anterior' | 'rango'

export interface Periodo {
  /** ISO corto, inclusive. */
  desde: string
  /** ISO corto, inclusive. */
  hasta: string
  /** Para mostrar: "septiembre 2026" o "01/09/2026 al 15/09/2026". */
  etiqueta: string
  /** Para el mensaje: "de septiembre 2026" o "del 01/09/2026 al 15/09/2026". */
  enTexto: string
  /** AAAA-MM del inicio del período, para el nombre del archivo. */
  clave: string
}

/** Lo que el Excel necesita saber del comercio. */
export interface FuenteContador {
  /** Nombre comercial (el que se ve en la app). */
  comercio: string
  razonSocial?: string
  cuit?: string
  ventas: Venta[]
  reposiciones: Reposicion[]
  productos: Producto[]
}

export interface DatosContador {
  fuente: FuenteContador
  periodo: Periodo
  ventas: Venta[]
  compras: Reposicion[]
  totalVendido: number
  totalComprado: number
  diferencia: number
  cantidadVentas: number
  cantidadFacturas: number
  /** Ventas de los 12 meses que terminan en el mes del período (recategorización del Monotributo). */
  acumulado12: number
  acumuladoDesde: string
  acumuladoHasta: string
  generado: Date
}

const dd = (n: number) => String(n).padStart(2, '0')

/** "dd/mm/aaaa" de un ISO corto. */
export function fechaAR(iso: string) {
  const d = desdeISO(iso)
  return `${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}`
}

const primeroDeMes = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
const ultimoDeMes = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

function periodoMes(d: Date): Periodo {
  const etiqueta = mesLargo(d)
  return {
    desde: isoLocal(primeroDeMes(d)),
    hasta: isoLocal(ultimoDeMes(d)),
    etiqueta,
    enTexto: `de ${etiqueta}`,
    clave: isoLocal(d).slice(0, 7),
  }
}

export function calcularPeriodo(
  tipo: TipoPeriodo,
  rango?: { desde: string; hasta: string },
  hoy: Date = new Date(),
): Periodo {
  if (tipo === 'actual') return periodoMes(hoy)
  if (tipo === 'anterior') return periodoMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))

  // Rango: si vienen dados vuelta, se ordenan en vez de dar un período vacío.
  const a = rango?.desde || isoLocal(primeroDeMes(hoy))
  const b = rango?.hasta || isoLocal(hoy)
  const [desde, hasta] = a <= b ? [a, b] : [b, a]
  const etiqueta = `${fechaAR(desde)} al ${fechaAR(hasta)}`
  return { desde, hasta, etiqueta, enTexto: `del ${etiqueta}`, clave: desde.slice(0, 7) }
}

const enRango = (fecha: string, desde: string, hasta: string) => {
  const dia = fecha.slice(0, 10)
  return dia >= desde && dia <= hasta
}

const suma = <T extends { total: number }>(xs: T[]) => xs.reduce((s, x) => s + x.total, 0)

const porFecha = <T extends { fecha: string }>(a: T, b: T) => a.fecha.localeCompare(b.fecha)

export function armarDatos(fuente: FuenteContador, periodo: Periodo): DatosContador {
  const ventas = fuente.ventas.filter((v) => enRango(v.fecha, periodo.desde, periodo.hasta)).sort(porFecha)
  const compras = fuente.reposiciones
    .filter((r) => enRango(r.fecha, periodo.desde, periodo.hasta))
    .sort(porFecha)

  // 12 meses calendario completos que terminan en el mes donde cierra el
  // período: es la ventana que mira ARCA para recategorizar el Monotributo.
  const fin = desdeISO(periodo.hasta)
  const acumuladoDesde = isoLocal(new Date(fin.getFullYear(), fin.getMonth() - 11, 1))
  const acumuladoHasta = periodo.hasta
  const acumulado12 = suma(fuente.ventas.filter((v) => enRango(v.fecha, acumuladoDesde, acumuladoHasta)))

  const totalVendido = suma(ventas)
  const totalComprado = suma(compras)

  return {
    fuente,
    periodo,
    ventas,
    compras,
    totalVendido,
    totalComprado,
    diferencia: totalVendido - totalComprado,
    cantidadVentas: ventas.length,
    cantidadFacturas: compras.length,
    acumulado12,
    acumuladoDesde,
    acumuladoHasta,
    generado: new Date(),
  }
}

/** Rindo_[NombreComercio]_[AAAA-MM].xlsx, sin tildes ni caracteres raros. */
export function nombreArchivo(comercio: string, periodo: Periodo) {
  const limpio =
    comercio
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'Comercio'
  return `Rindo_${limpio}_${periodo.clave}.xlsx`
}
