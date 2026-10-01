/**
 * Datos de ejemplo para la demo de "Enviar al contador": Print, una librería
 * de San Juan. SÓLO los usa `/demo/contador` — ninguna cuenta real los ve
 * (ver la nota de `lib/seed.ts` sobre por qué se sacaron de la app).
 *
 * Todo sale de un generador pseudoaleatorio con semilla fija, así la demo
 * muestra siempre los mismos números para la misma fecha. Las fechas son
 * relativas a hoy: el mes actual y el anterior nunca quedan vacíos.
 */

import { isoLocal, isoLocalConHora } from '@/lib/format'
import type { MetodoPago, Producto, Reposicion, Venta } from '@/lib/types'
import type { FuenteContador } from './periodo'

/** mulberry32: chico, rápido y determinístico. */
function generador(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Catalogo = [nombre: string, categoria: string, costo: number, precio: number, stock: number, peso: number]

/** Precios de hoy. [nombre, categoría, costo, precio, stock, qué tanto se vende] */
const CATALOGO: Catalogo[] = [
  ['Fotocopia simple B/N', 'Servicios', 45, 150, 0, 14],
  ['Impresión color A4', 'Servicios', 180, 600, 0, 6],
  ['Anillado hasta 100 hojas', 'Servicios', 900, 2800, 0, 3],
  ['Plastificado A4', 'Servicios', 500, 1500, 0, 2],
  ['Birome Bic Cristal azul', 'Escritura', 520, 1100, 140, 9],
  ['Lápiz negro Faber-Castell HB', 'Escritura', 380, 850, 96, 6],
  ['Resaltador Stabilo Boss', 'Escritura', 1350, 2600, 38, 4],
  ['Marcadores Simball x12', 'Escritura', 3900, 7400, 14, 2],
  ['Lápices de colores Faber-Castell x12', 'Escritura', 4600, 8900, 18, 2],
  ['Goma Staedtler Mars plastic', 'Escritura', 650, 1400, 60, 3],
  ['Cuaderno Rivadavia ABC 50 hojas', 'Cuadernos', 3300, 5900, 45, 5],
  ['Cuaderno Gloria tapa dura 42 hojas', 'Cuadernos', 2600, 4800, 52, 4],
  ['Repuesto N.º 3 Rivadavia x96 hojas', 'Cuadernos', 5200, 9400, 22, 3],
  ['Carpeta N.º 3 con anillos', 'Cuadernos', 3800, 7200, 16, 2],
  ['Resma A4 Autor 500 hojas', 'Papelería', 6400, 10900, 30, 3],
  ['Block de dibujo N.º 5 El Nene', 'Papelería', 1900, 3600, 25, 2],
  ['Cinta adhesiva 18 mm', 'Papelería', 700, 1500, 40, 2],
  ['Voligoma 30 ml', 'Papelería', 900, 1900, 35, 2],
  ['Tijera escolar punta redonda', 'Papelería', 1300, 2700, 20, 1],
  ['Calculadora Casio fx-82', 'Tecnología', 19500, 32000, 6, 1],
  ['Pendrive 32 GB', 'Tecnología', 7800, 13500, 9, 1],
  ['Mochila escolar', 'Mochilas', 21000, 38000, 7, 1],
]

const PROVEEDORES: { nombre: string; categorias: string[]; tipo: 'A' | 'B' }[] = [
  { nombre: 'Distribuidora Cuyo Papelera S.R.L.', categorias: ['Papelería', 'Cuadernos'], tipo: 'A' },
  { nombre: 'Librería Mayorista San Juan', categorias: ['Escritura', 'Cuadernos'], tipo: 'A' },
  { nombre: 'Papelera del Oeste S.A.', categorias: ['Papelería', 'Servicios'], tipo: 'A' },
  { nombre: 'Tecno Insumos Rawson', categorias: ['Tecnología', 'Mochilas'], tipo: 'B' },
]

/* Una librería vende muchísimo más en el inicio de clases (febrero-marzo) y
   casi nada en enero. Índice 0 = enero. */
const ESTACIONALIDAD = [0.55, 1.9, 1.6, 1.05, 1, 0.95, 0.8, 1.1, 1, 1, 0.95, 1.15]

/* Inflación mensual aproximada: los precios de hace un año eran más bajos. */
const INFLACION_MENSUAL = 0.022

const METODOS: [MetodoPago, number][] = [
  ['efectivo', 0.45],
  ['transferencia', 0.35],
  ['tarjeta', 0.2],
]

/* San Juan: horario cortado, con siesta. */
const HORAS = [9, 10, 10, 11, 11, 12, 12, 17, 18, 18, 19, 19, 20, 20]

const redondear = (n: number, a = 10) => Math.max(a, Math.round(n / a) * a)

export function fuenteDemo(hoy: Date = new Date()): FuenteContador {
  const azar = generador(20260930)
  const elegir = <T>(xs: T[]) => xs[Math.floor(azar() * xs.length)]

  const productos: Producto[] = CATALOGO.map(([nombre, categoria, costo, precio, stock], i) => ({
    id: `demo-p${i}`,
    codigo: String(i + 1),
    nombre,
    categoria,
    costo,
    precio,
    stock,
    stockMin: categoria === 'Servicios' ? 0 : 8,
  }))

  const pesoTotal = CATALOGO.reduce((s, c) => s + c[5], 0)
  const productoAlAzar = () => {
    let r = azar() * pesoTotal
    for (let i = 0; i < CATALOGO.length; i++) {
      r -= CATALOGO[i][5]
      if (r <= 0) return i
    }
    return 0
  }
  const metodoAlAzar = () => {
    let r = azar()
    for (const [m, p] of METODOS) {
      r -= p
      if (r <= 0) return m
    }
    return 'efectivo' as MetodoPago
  }

  const ventas: Venta[] = []
  const reposiciones: Reposicion[] = []
  let nroVenta = 0
  const nroFactura: Record<string, number> = {}

  // 13 meses para atrás: el acumulado de 12 meses del mes anterior también
  // tiene que estar completo.
  const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - 13, 1)

  for (let d = new Date(inicio); d <= hoy; d.setDate(d.getDate() + 1)) {
    const mesesAtras = (hoy.getFullYear() - d.getFullYear()) * 12 + hoy.getMonth() - d.getMonth()
    const factorPrecio = 1 / Math.pow(1 + INFLACION_MENSUAL, mesesAtras)
    const esHoy = isoLocal(d) === isoLocal(hoy)

    // Domingo cerrado; sábado sólo a la mañana y con menos gente.
    if (d.getDay() !== 0) {
      const sabado = d.getDay() === 6
      const base = 22 * ESTACIONALIDAD[d.getMonth()] * (sabado ? 0.5 : 1)
      const cantidad = Math.round(base * (0.75 + azar() * 0.5))

      for (let k = 0; k < cantidad; k++) {
        const h = sabado ? elegir(HORAS.slice(0, 7)) : elegir(HORAS)
        const cuando = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, Math.floor(azar() * 60))
        if (esHoy && cuando > hoy) continue

        const renglones = azar() < 0.7 ? 1 : azar() < 0.8 ? 2 : 3
        const items = new Map<number, number>()
        for (let r = 0; r < renglones; r++) {
          const i = productoAlAzar()
          const [, categoria] = CATALOGO[i]
          const cant = categoria === 'Servicios' && i === 0 ? 1 + Math.floor(azar() * 30) : 1 + (azar() < 0.2 ? 1 : 0)
          items.set(i, (items.get(i) ?? 0) + cant)
        }

        const detalle = [...items].map(([i, cantidadItem]) => ({
          productoId: productos[i].id,
          nombre: productos[i].nombre,
          cantidad: cantidadItem,
          precio: redondear(productos[i].precio * factorPrecio),
        }))
        ventas.push({
          id: `demo-v${nroVenta++}`,
          fecha: isoLocalConHora(cuando),
          items: detalle,
          total: detalle.reduce((s, it) => s + it.precio * it.cantidad, 0),
          metodo: metodoAlAzar(),
        })
      }
    }

    // Compras: dos o tres facturas por semana, de lunes a viernes a la mañana.
    const habil = d.getDay() >= 1 && d.getDay() <= 5
    if (habil && azar() < 0.5 && !(esHoy && hoy.getHours() < 11)) {
      const prov = elegir(PROVEEDORES)
      const candidatos = CATALOGO.map((c, i) => ({ c, i })).filter(
        ({ c }) => prov.categorias.includes(c[1]) && c[1] !== 'Servicios',
      )
      const insumos = prov.categorias.includes('Servicios')
      const lineas = 2 + Math.floor(azar() * 4)
      const items: Reposicion['items'] = []

      for (let l = 0; l < lineas && candidatos.length > 0; l++) {
        const { c, i } = elegir(candidatos)
        if (items.some((it) => it.productoId === productos[i].id)) continue
        const unidades = c[1] === 'Tecnología' || c[1] === 'Mochilas' ? 2 + Math.floor(azar() * 4) : 12 * (1 + Math.floor(azar() * 4))
        items.push({
          productoId: productos[i].id,
          nombre: productos[i].nombre,
          cantidad: unidades,
          costo: redondear(c[2] * factorPrecio),
        })
      }
      // Papelera del Oeste también trae el toner de la fotocopiadora.
      if (insumos && azar() < 0.4) {
        items.push({ productoId: null, nombre: 'Tóner fotocopiadora Ricoh', cantidad: 1, costo: redondear(68000 * factorPrecio, 100) })
      }
      if (items.length === 0) continue

      nroFactura[prov.nombre] = (nroFactura[prov.nombre] ?? 1200 + Math.floor(azar() * 8000)) + 1 + Math.floor(azar() * 40)
      const porFoto = azar() < 0.65
      const fecha = isoLocal(d)
      reposiciones.push({
        id: `demo-r${reposiciones.length}`,
        fecha: `${fecha}T${String(9 + Math.floor(azar() * 3)).padStart(2, '0')}:${String(Math.floor(azar() * 60)).padStart(2, '0')}:00`,
        items,
        total: items.reduce((s, it) => s + it.costo * it.cantidad, 0),
        origen: porFoto ? 'foto' : 'manual',
        proveedor: prov.nombre,
        comprobante: `${prov.tipo} 0003-${String(nroFactura[prov.nombre]).padStart(8, '0')}`,
        foto: porFoto ? `factura_${fecha}_${prov.nombre.split(' ')[0].toLowerCase()}.jpg` : undefined,
      })
    }
  }

  // Más recientes primero, como vienen de Supabase.
  ventas.sort((a, b) => b.fecha.localeCompare(a.fecha))
  reposiciones.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return {
    comercio: 'Print',
    razonSocial: 'Print Librería (datos de ejemplo)',
    cuit: '30-00000000-0',
    ventas,
    reposiciones,
    productos,
  }
}
