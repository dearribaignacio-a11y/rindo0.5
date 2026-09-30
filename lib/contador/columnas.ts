/**
 * ─────────────────────────────────────────────────────────────────────────
 *  Columnas del Excel para el contador — ÚNICO lugar a tocar.
 *
 *  Cada hoja es una lista de columnas: título, tipo y de dónde sale el
 *  valor. Para sumar, sacar o reordenar una columna después de hablar con
 *  otro contador, se edita el array de acá y listo: el formato (pesos,
 *  fechas, ancho, filtros) lo pone `excel.ts` según el `tipo`.
 * ─────────────────────────────────────────────────────────────────────────
 */

import { hora, isoLocal } from '@/lib/format'
import type { ItemReposicion, ItemVenta, MetodoPago, Producto, Reposicion, Venta } from '@/lib/types'
import { fechaAR, type DatosContador } from './periodo'

/** Define el formato de la celda en el Excel. */
export type TipoColumna =
  | 'texto'
  /** Cantidades: número tal cual. */
  | 'numero'
  /** $ 1.234,56 */
  | 'moneda'
  /** dd/mm/aaaa — el valor es un ISO corto 'yyyy-mm-dd'. */
  | 'fecha'

export type Valor = string | number | null

export interface Columna<Fila> {
  titulo: string
  tipo: TipoColumna
  valor: (fila: Fila) => Valor
}

export interface HojaTabla<Fila> {
  nombre: string
  filas: (datos: DatosContador) => Fila[]
  columnas: Columna<Fila>[]
}

const METODOS: Record<MetodoPago, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
}

/* ── Hoja "Resumen" ───────────────────────────────────────────────────────
   Es una hoja de dos columnas (Concepto | Valor), así que en vez de columnas
   se configuran los renglones. Un renglón con valor null no se escribe. */

export interface RenglonResumen {
  concepto: string
  tipo: TipoColumna
  valor: (datos: DatosContador) => Valor
}

export const HOJA_RESUMEN = {
  nombre: 'Resumen',
  titulos: ['Concepto', 'Valor'] as const,
  renglones: [
    { concepto: 'Comercio', tipo: 'texto', valor: (d) => d.fuente.comercio },
    { concepto: 'Razón social', tipo: 'texto', valor: (d) => d.fuente.razonSocial || null },
    { concepto: 'CUIT', tipo: 'texto', valor: (d) => d.fuente.cuit || null },
    { concepto: 'Período', tipo: 'texto', valor: (d) => d.periodo.etiqueta },
    { concepto: 'Desde', tipo: 'fecha', valor: (d) => d.periodo.desde },
    { concepto: 'Hasta', tipo: 'fecha', valor: (d) => d.periodo.hasta },
    { concepto: 'Total vendido', tipo: 'moneda', valor: (d) => d.totalVendido },
    { concepto: 'Total comprado', tipo: 'moneda', valor: (d) => d.totalComprado },
    { concepto: 'Diferencia (vendido − comprado)', tipo: 'moneda', valor: (d) => d.diferencia },
    { concepto: 'Cantidad de ventas', tipo: 'numero', valor: (d) => d.cantidadVentas },
    { concepto: 'Cantidad de facturas de compra', tipo: 'numero', valor: (d) => d.cantidadFacturas },
    {
      concepto: 'Facturación acumulada últimos 12 meses',
      tipo: 'moneda',
      valor: (d) => d.acumulado12,
    },
    {
      concepto: 'Ventana de los 12 meses',
      tipo: 'texto',
      valor: (d) => `${fechaAR(d.acumuladoDesde)} al ${fechaAR(d.acumuladoHasta)}`,
    },
    {
      concepto: 'Nota',
      tipo: 'texto',
      valor: () =>
        'Montos calculados sobre las ventas y compras registradas en Rindo. Verificar contra los comprobantes emitidos.',
    },
    {
      concepto: 'Generado',
      tipo: 'texto',
      valor: (d) => `${fechaAR(isoLocal(d.generado))} con Rindo`,
    },
  ] satisfies RenglonResumen[],
}

/* ── Hoja "Ventas": un renglón por producto vendido ───────────────────── */

export interface FilaVenta {
  venta: Venta
  item: ItemVenta
}

export const HOJA_VENTAS: HojaTabla<FilaVenta> = {
  nombre: 'Ventas',
  filas: (d) => d.ventas.flatMap((venta) => venta.items.map((item) => ({ venta, item }))),
  columnas: [
    { titulo: 'Fecha', tipo: 'fecha', valor: (f) => f.venta.fecha.slice(0, 10) },
    { titulo: 'Hora', tipo: 'texto', valor: (f) => hora(f.venta.fecha) },
    { titulo: 'Producto', tipo: 'texto', valor: (f) => f.item.nombre },
    { titulo: 'Cantidad', tipo: 'numero', valor: (f) => f.item.cantidad },
    { titulo: 'Precio unitario', tipo: 'moneda', valor: (f) => f.item.precio },
    { titulo: 'Total', tipo: 'moneda', valor: (f) => f.item.precio * f.item.cantidad },
    { titulo: 'Medio de pago', tipo: 'texto', valor: (f) => METODOS[f.venta.metodo] ?? f.venta.metodo },
  ],
}

/* ── Hoja "Compras": un renglón por ítem de cada factura ──────────────── */

export interface FilaCompra {
  compra: Reposicion
  item: ItemReposicion
}

export const HOJA_COMPRAS: HojaTabla<FilaCompra> = {
  nombre: 'Compras',
  filas: (d) => d.compras.flatMap((compra) => compra.items.map((item) => ({ compra, item }))),
  columnas: [
    { titulo: 'Fecha', tipo: 'fecha', valor: (f) => f.compra.fecha.slice(0, 10) },
    { titulo: 'Proveedor', tipo: 'texto', valor: (f) => f.compra.proveedor || null },
    { titulo: 'N.º de comprobante', tipo: 'texto', valor: (f) => f.compra.comprobante || null },
    { titulo: 'Detalle', tipo: 'texto', valor: (f) => f.item.nombre },
    { titulo: 'Cantidad', tipo: 'numero', valor: (f) => f.item.cantidad },
    { titulo: 'Costo unitario', tipo: 'moneda', valor: (f) => f.item.costo },
    { titulo: 'Total', tipo: 'moneda', valor: (f) => f.item.costo * f.item.cantidad },
    {
      titulo: 'Foto de la factura',
      tipo: 'texto',
      valor: (f) => f.compra.foto || (f.compra.origen === 'foto' ? 'Cargada por foto' : null),
    },
  ],
}

/* ── Hoja "Stock": foto del catálogo al momento de generar ────────────── */

export const HOJA_STOCK: HojaTabla<Producto> = {
  nombre: 'Stock',
  filas: (d) => [...d.fuente.productos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
  columnas: [
    { titulo: 'Producto', tipo: 'texto', valor: (p) => p.nombre },
    { titulo: 'Stock actual', tipo: 'numero', valor: (p) => p.stock },
    { titulo: 'Costo', tipo: 'moneda', valor: (p) => p.costo },
    { titulo: 'Precio de venta', tipo: 'moneda', valor: (p) => p.precio },
  ],
}

/** Orden de las hojas tabulares, después de "Resumen". Cada hoja tiene su
 *  propio tipo de fila; `excel.ts` las recorre sin necesitar saber cuál. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const HOJAS_TABLA: HojaTabla<any>[] = [HOJA_VENTAS, HOJA_COMPRAS, HOJA_STOCK]
