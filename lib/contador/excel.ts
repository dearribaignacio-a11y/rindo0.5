/**
 * Arma el .xlsx para el contador con ExcelJS. Qué columnas van en cada hoja
 * se define en `columnas.ts`; acá sólo vive el formato, que se aplica igual
 * a todas las hojas:
 *
 *  · encabezado con el azul petróleo de Rindo y texto claro
 *  · primera fila congelada y filtros activados
 *  · montos como número con formato de pesos ($ 1.234,56)
 *  · fechas como fecha real con formato dd/mm/aaaa
 *  · ancho de columna calculado según el contenido
 *
 * Montos y fechas se escriben como valores (no como texto), así el contador
 * puede sumar, filtrar y ordenar sin convertir nada.
 */

import type { Cell, Workbook, Worksheet } from 'exceljs'
import { HOJA_RESUMEN, HOJAS_TABLA, type TipoColumna, type Valor } from './columnas'
import type { DatosContador } from './periodo'

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/* Colores de la marca (ARGB). Son los de `app/globals.css`, tema Petróleo:
   el archivo sale siempre igual, sin importar el tema que use cada comercio. */
const ACENTO = 'FF1D5C6E' // --color-accent
const ACENTO_TINTA = 'FFEAF6FA' // --color-accent-ink
const LINEA = 'FFD5DEE1'

/* Formatos numéricos. El separador de miles/decimales lo pone Excel según el
   idioma de la compu que lo abre: en una en español queda $ 1.234,56. */
const FORMATO: Record<TipoColumna, string | undefined> = {
  texto: undefined,
  numero: '#,##0',
  moneda: '"$ "#,##0.00;-"$ "#,##0.00',
  fecha: 'dd/mm/yyyy',
}

const MIN_ANCHO = 9
const MAX_ANCHO = 60

/** ISO corto a Date en UTC: ExcelJS serializa en UTC, así el día no se corre por el huso horario. */
function fechaExcel(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

const pesos = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** Largo aproximado de lo que se ve en la celda, para calcular el ancho. */
function largoVisible(valor: Valor, tipo: TipoColumna) {
  if (valor === null) return 0
  if (tipo === 'fecha') return 10
  if (tipo === 'moneda' && typeof valor === 'number') return `$ ${pesos.format(valor)}`.length
  return String(valor).length
}

function escribirCelda(celda: Cell, valor: Valor, tipo: TipoColumna) {
  if (valor === null) return
  celda.value = tipo === 'fecha' && typeof valor === 'string' ? fechaExcel(valor) : valor
  const formato = FORMATO[tipo]
  if (formato) celda.numFmt = formato
  if (tipo === 'texto') celda.alignment = { vertical: 'middle', wrapText: false }
}

/** Encabezado, fila congelada, filtros y anchos: lo común a todas las hojas. */
function darFormato(hoja: Worksheet, anchos: number[]) {
  const encabezado = hoja.getRow(1)
  encabezado.height = 22
  encabezado.eachCell((celda) => {
    celda.font = { bold: true, color: { argb: ACENTO_TINTA } }
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ACENTO } }
    celda.alignment = { vertical: 'middle', horizontal: 'left' }
    celda.border = { bottom: { style: 'thin', color: { argb: ACENTO } } }
  })

  hoja.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: anchos.length } }

  anchos.forEach((largo, i) => {
    // +4: margen y la flechita del filtro, que ocupa lugar en el encabezado.
    hoja.getColumn(i + 1).width = Math.min(MAX_ANCHO, Math.max(MIN_ANCHO, largo + 4))
  })

  // Separador suave entre renglones: se lee mejor impreso.
  hoja.eachRow((fila, n) => {
    if (n === 1) return
    fila.eachCell((celda) => {
      celda.border = { bottom: { style: 'hair', color: { argb: LINEA } } }
    })
  })
}

function hojaResumen(libro: Workbook, datos: DatosContador) {
  const hoja = libro.addWorksheet(HOJA_RESUMEN.nombre)
  hoja.addRow([...HOJA_RESUMEN.titulos])
  const anchos = HOJA_RESUMEN.titulos.map((t) => t.length)

  for (const renglon of HOJA_RESUMEN.renglones) {
    const valor = renglon.valor(datos)
    if (valor === null) continue
    const fila = hoja.addRow([renglon.concepto])
    fila.getCell(1).font = { bold: true }
    escribirCelda(fila.getCell(2), valor, renglon.tipo)
    anchos[0] = Math.max(anchos[0], renglon.concepto.length)
    // La nota es larga: no la dejamos ensanchar la columna, que se corte.
    if (renglon.concepto !== 'Nota') anchos[1] = Math.max(anchos[1], largoVisible(valor, renglon.tipo))
  }

  darFormato(hoja, anchos)
}

function hojaTabla(libro: Workbook, datos: DatosContador, def: (typeof HOJAS_TABLA)[number]) {
  const hoja = libro.addWorksheet(def.nombre)
  hoja.addRow(def.columnas.map((c) => c.titulo))
  const anchos = def.columnas.map((c) => c.titulo.length)

  for (const f of def.filas(datos)) {
    const fila = hoja.addRow([])
    def.columnas.forEach((col, i) => {
      const valor = col.valor(f)
      escribirCelda(fila.getCell(i + 1), valor, col.tipo)
      anchos[i] = Math.max(anchos[i], largoVisible(valor, col.tipo))
    })
  }

  darFormato(hoja, anchos)
}

/** Genera el Excel completo. ExcelJS pesa: se carga recién cuando hace falta. */
export async function generarExcel(datos: DatosContador): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs')
  const libro = new ExcelJS.Workbook()
  libro.creator = 'Rindo'
  libro.created = datos.generado
  libro.title = `Resumen ${datos.periodo.etiqueta} — ${datos.fuente.comercio}`

  hojaResumen(libro, datos)
  for (const def of HOJAS_TABLA) hojaTabla(libro, datos, def)

  const buffer = await libro.xlsx.writeBuffer()
  return new Blob([buffer], { type: XLSX_MIME })
}
