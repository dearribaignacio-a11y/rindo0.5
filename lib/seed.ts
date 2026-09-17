import type {
  Categoria,
  DB,
  Impuesto,
  Miembro,
  Movimiento,
  Perfil,
  Producto,
  Venta,
} from './types'
import { isoLocal, isoLocalConHora } from './format'

/**
 * Datos de ejemplo que se cargan una única vez, al terminar el setup.
 *
 * Una app de plata vacía no se puede juzgar: sin movimientos no hay balance,
 * sin ventas no hay gráfico. Todo lo sembrado acá es editable y borrable desde
 * la app (Ajustes → Borrar todos los datos), y las fechas se calculan siempre
 * relativas a hoy para que el mes en curso nunca aparezca vacío.
 */

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/* Las fechas se arman con los helpers locales de `format`. Con
   `toISOString()` la semilla generaba ventas fechadas mañana: construía la
   hora en local (21:15) y la serializaba en UTC (00:15 del día siguiente),
   así que las últimas horas de cada jornada caían en el día equivocado. */

/** yyyy-mm-dd de hace `n` días. */
function hace(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoLocal(d)
}

/** ISO local completo de hace `n` días a la hora `h`. */
function haceHora(n: number, h: number, m = 0) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(h, m, 0, 0)
  return isoLocalConHora(d)
}

/** yyyy-mm-dd del día `dia` del mes en curso (o del siguiente si ya pasó). */
function proximoDia(dia: number) {
  const hoy = new Date()
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), dia)
  if (d < hoy) d.setMonth(d.getMonth() + 1)
  return isoLocal(d)
}

const redondear = (n: number) => Math.round(n / 50) * 50

/* ══════════════════════════════════════════════════════════════════════════
   PLAN HOGAR
   ══════════════════════════════════════════════════════════════════════════ */

const CATEGORIAS_HOGAR: Omit<Categoria, 'id'>[] = [
  { nombre: 'Supermercado', icono: 'carrito', color: 'accent', limite: 240000 },
  { nombre: 'Servicios', icono: 'rayo', color: 'warn', limite: 95000 },
  { nombre: 'Transporte', icono: 'auto', color: 'teal', limite: 60000 },
  { nombre: 'Salud', icono: 'salud', color: 'neg', limite: 45000 },
  { nombre: 'Ocio', icono: 'ocio', color: 'arena', limite: 70000 },
  { nombre: 'Educación', icono: 'educacion', color: 'oliva', limite: 55000 },
  { nombre: 'Sueldo', icono: 'sueldo', color: 'pos', limite: 0 },
]

/** Gastos típicos por categoría, con su rango de monto y descripción. */
const GASTOS_HOGAR: Record<string, [string, number, number][]> = {
  Supermercado: [
    ['Compra semanal', 34000, 58000],
    ['Verdulería', 8000, 16000],
    ['Carnicería', 14000, 26000],
    ['Kiosco', 2500, 6000],
  ],
  Servicios: [
    ['Luz — EPSE', 18000, 32000],
    ['Internet', 22000, 29000],
    ['Gas', 9000, 18000],
    ['Celular', 12000, 19000],
  ],
  Transporte: [
    ['Nafta', 18000, 32000],
    ['Colectivo — SUBE', 3000, 7000],
    ['Estacionamiento', 1500, 4000],
  ],
  Salud: [
    ['Farmacia', 8000, 22000],
    ['Obra social', 26000, 38000],
  ],
  Ocio: [
    ['Salida a comer', 14000, 32000],
    ['Streaming', 4500, 9000],
    ['Cine', 8000, 14000],
  ],
  Educación: [
    ['Cuota colegio', 38000, 52000],
    ['Útiles', 6000, 14000],
  ],
}

export function seedHogar(perfil: Perfil): Partial<DB> {
  const categorias: Categoria[] = CATEGORIAS_HOGAR.map((c) => ({ ...c, id: uid() }))
  const porNombre = (n: string) => categorias.find((c) => c.nombre === n)!

  const integrantes = Math.max(1, perfil.integrantes ?? 2)
  const miembros: Miembro[] = [{ id: uid(), nombre: perfil.nombre || 'Vos', rol: 'admin' }]
  const nombresExtra = ['Familiar 2', 'Familiar 3', 'Familiar 4', 'Familiar 5']
  for (let i = 1; i < Math.min(integrantes, 5); i++) {
    miembros.push({ id: uid(), nombre: nombresExtra[i - 1], rol: 'miembro' })
  }

  const movimientos: Movimiento[] = []

  // Sueldo del mes: el ingreso declarado en el setup, o un valor razonable.
  const sueldo = perfil.ingresoMensual && perfil.ingresoMensual > 0 ? perfil.ingresoMensual : 950000
  movimientos.push({
    id: uid(),
    tipo: 'ingreso',
    monto: sueldo,
    categoriaId: porNombre('Sueldo').id,
    descripcion: 'Sueldo mensual',
    fecha: hace(new Date().getDate() - 1),
    autorId: miembros[0].id,
    origen: 'manual',
  })

  // Gastos repartidos en los últimos 24 días, ~1,5 por día.
  for (let d = 0; d < 24; d++) {
    const cuantos = d % 3 === 0 ? 2 : 1
    for (let k = 0; k < cuantos; k++) {
      const nombres = Object.keys(GASTOS_HOGAR)
      const cat = nombres[(d * 2 + k) % nombres.length]
      const opciones = GASTOS_HOGAR[cat]
      const [desc, min, max] = opciones[(d + k) % opciones.length]
      movimientos.push({
        id: uid(),
        tipo: 'gasto',
        monto: redondear(min + ((d * 37 + k * 91) % (max - min))),
        categoriaId: porNombre(cat).id,
        descripcion: desc,
        fecha: hace(d),
        autorId: miembros[(d + k) % miembros.length].id,
        origen: (d + k) % 5 === 0 ? 'ticket' : 'manual',
      })
    }
  }

  movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha))

  return { categorias, movimientos, miembros }
}

/* ══════════════════════════════════════════════════════════════════════════
   PLAN COMERCIAL
   ══════════════════════════════════════════════════════════════════════════ */

type ProductoSemilla = [nombre: string, categoria: string, costo: number, margen: number, stock: number]

/** Catálogo por rubro — el setup pregunta el rubro justamente para esto. */
const CATALOGOS: Record<string, ProductoSemilla[]> = {
  Almacén: [
    ['Yerba 1kg', 'Almacén', 3200, 1.45, 24],
    ['Aceite girasol 900ml', 'Almacén', 2400, 1.5, 18],
    ['Fideos 500g', 'Almacén', 950, 1.6, 40],
    ['Arroz 1kg', 'Almacén', 1400, 1.55, 32],
    ['Azúcar 1kg', 'Almacén', 1250, 1.5, 6],
    ['Leche entera 1L', 'Lácteos', 1300, 1.4, 15],
    ['Queso cremoso x kg', 'Lácteos', 8900, 1.45, 4],
    ['Gaseosa 2,25L', 'Bebidas', 2600, 1.55, 28],
    ['Agua mineral 2L', 'Bebidas', 1100, 1.6, 22],
    ['Cerveza lata 473ml', 'Bebidas', 1500, 1.65, 3],
    ['Pan lactal', 'Panificados', 2100, 1.5, 9],
    ['Galletitas surtidas', 'Panificados', 1450, 1.7, 26],
    ['Detergente 750ml', 'Limpieza', 1900, 1.6, 12],
    ['Lavandina 1L', 'Limpieza', 1150, 1.65, 0],
    ['Papel higiénico x4', 'Limpieza', 2800, 1.55, 14],
  ],
  Kiosco: [
    ['Alfajor triple', 'Golosinas', 800, 1.7, 45],
    ['Chicles', 'Golosinas', 350, 1.9, 60],
    ['Chocolate 100g', 'Golosinas', 1600, 1.6, 18],
    ['Caramelos x bolsa', 'Golosinas', 900, 1.8, 22],
    ['Gaseosa 500ml', 'Bebidas', 1200, 1.65, 30],
    ['Agua saborizada', 'Bebidas', 1300, 1.6, 4],
    ['Energizante', 'Bebidas', 2400, 1.7, 12],
    ['Papas fritas', 'Snacks', 1500, 1.7, 20],
    ['Maní salado', 'Snacks', 950, 1.8, 2],
    ['Cigarrillos', 'Tabaco', 3200, 1.2, 16],
    ['Encendedor', 'Varios', 700, 2.1, 25],
    ['Pilas AA x2', 'Varios', 1800, 1.7, 8],
  ],
  Indumentaria: [
    ['Remera lisa', 'Remeras', 7800, 2.2, 22],
    ['Remera estampada', 'Remeras', 9200, 2.1, 14],
    ['Jean clásico', 'Pantalones', 21000, 2.0, 11],
    ['Jogging', 'Pantalones', 16500, 2.0, 7],
    ['Buzo con capucha', 'Abrigo', 24000, 1.95, 9],
    ['Campera rompeviento', 'Abrigo', 32000, 1.9, 3],
    ['Medias pack x3', 'Accesorios', 3400, 2.3, 30],
    ['Gorra', 'Accesorios', 6800, 2.2, 1],
    ['Cinturón cuero', 'Accesorios', 9500, 2.1, 6],
  ],
  Gastronomía: [
    ['Café con leche', 'Cafetería', 900, 3.2, 99],
    ['Medialuna', 'Cafetería', 420, 3.0, 99],
    ['Tostado J&Q', 'Cocina', 2200, 2.6, 99],
    ['Hamburguesa completa', 'Cocina', 4100, 2.5, 99],
    ['Milanesa con papas', 'Cocina', 5600, 2.3, 99],
    ['Empanada', 'Cocina', 700, 2.8, 99],
    ['Gaseosa 500ml', 'Bebidas', 1200, 2.2, 24],
    ['Cerveza tirada pinta', 'Bebidas', 1800, 2.6, 40],
    ['Agua sin gas', 'Bebidas', 800, 2.3, 5],
  ],
  'Peluquería/Estética': [
    ['Corte de pelo', 'Servicios', 2000, 4.0, 99],
    ['Color', 'Servicios', 9000, 2.6, 99],
    ['Brushing', 'Servicios', 1800, 3.6, 99],
    ['Manicura', 'Servicios', 2200, 3.4, 99],
    ['Shampoo profesional', 'Productos', 7200, 1.9, 8],
    ['Acondicionador', 'Productos', 6800, 1.9, 6],
    ['Máscara capilar', 'Productos', 9500, 1.85, 2],
    ['Esmalte', 'Productos', 2600, 2.1, 15],
  ],
  Ferretería: [
    ['Tornillos x100', 'Fijaciones', 2400, 1.9, 26],
    ['Tarugos x50', 'Fijaciones', 1500, 2.0, 18],
    ['Cinta aisladora', 'Electricidad', 900, 2.2, 34],
    ['Cable 2,5mm x metro', 'Electricidad', 1200, 1.8, 120],
    ['Lámpara LED 9W', 'Electricidad', 2100, 1.9, 4],
    ['Pintura látex 4L', 'Pinturas', 18000, 1.65, 7],
    ['Pincel 2"', 'Pinturas', 1600, 2.1, 12],
    ['Martillo', 'Herramientas', 6800, 1.8, 5],
    ['Destornillador set', 'Herramientas', 9200, 1.85, 1],
    ['Candado 40mm', 'Seguridad', 4200, 1.9, 9],
  ],
  Farmacia: [
    ['Ibuprofeno 400 x10', 'Medicamentos', 2400, 1.5, 30],
    ['Paracetamol 500 x20', 'Medicamentos', 1900, 1.5, 26],
    ['Amoxicilina 500 x14', 'Medicamentos', 8200, 1.4, 6],
    ['Alcohol en gel 250ml', 'Cuidado', 1600, 1.7, 18],
    ['Barbijo x10', 'Cuidado', 1200, 1.8, 22],
    ['Protector solar F50', 'Dermo', 12500, 1.6, 5],
    ['Crema humectante', 'Dermo', 7800, 1.65, 9],
    ['Pañales talle M x40', 'Bebés', 14500, 1.4, 3],
    ['Termómetro digital', 'Accesorios', 6200, 1.7, 2],
  ],
  Otro: [
    ['Producto A', 'General', 2000, 1.6, 20],
    ['Producto B', 'General', 3500, 1.6, 14],
    ['Producto C', 'General', 5200, 1.55, 8],
    ['Producto D', 'General', 900, 1.8, 40],
    ['Producto E', 'General', 12000, 1.5, 3],
    ['Producto F', 'General', 7400, 1.6, 0],
  ],
}


export function seedComercial(perfil: Perfil): Partial<DB> {
  const catalogo = CATALOGOS[perfil.rubro ?? 'Almacén'] ?? CATALOGOS['Almacén']

  const productos: Producto[] = catalogo.map(([nombre, categoria, costo, margen, stock]) => ({
    id: uid(),
    nombre,
    categoria,
    costo,
    precio: redondear(costo * margen),
    stock,
    stockMin: stock > 40 ? 12 : 6,
  }))

  /* Ventas de los últimos 8 días. La curva por hora imita un comercio de
     barrio: pico al mediodía y otro a la tarde-noche. */
  const ventas: Venta[] = []
  const pesoHora: Record<number, number> = {
    9: 1, 10: 2, 11: 3, 12: 4, 13: 3, 17: 3, 18: 4, 19: 5, 20: 3, 21: 1,
  }
  const metodos = ['efectivo', 'tarjeta', 'transferencia', 'efectivo', 'efectivo', 'tarjeta'] as const

  let n = 0
  for (let d = 7; d >= 0; d--) {
    // El fin de semana vende distinto; hoy va un poco por encima de ayer.
    const factor = d === 0 ? 1.12 : d % 6 === 0 ? 0.72 : 1
    for (const [horaStr, peso] of Object.entries(pesoHora)) {
      const hora = Number(horaStr)
      const tickets = Math.max(1, Math.round(peso * factor))
      for (let t = 0; t < tickets; t++) {
        n++
        const cuantos = 1 + (n % 3)
        const items = Array.from({ length: cuantos }, (_, k) => {
          const p = productos[(n * 5 + k * 3) % productos.length]
          return {
            productoId: p.id,
            nombre: p.nombre,
            cantidad: 1 + ((n + k) % 3),
            precio: p.precio,
          }
        })
        ventas.push({
          id: uid(),
          fecha: haceHora(d, hora, (n * 7) % 60),
          items,
          total: items.reduce((s, i) => s + i.precio * i.cantidad, 0),
          metodo: metodos[n % metodos.length],
        })
      }
    }
  }
  ventas.sort((a, b) => b.fecha.localeCompare(a.fecha))

  /* Obligaciones impositivas típicas de un comercio chico en San Juan */
  const cantidadEmpleadosAprox = ({ '0': 0, '1-3': 2, '4-10': 5, 'Más de 10': 8 } as const)[
    perfil.empleadosRango as '0' | '1-3' | '4-10' | 'Más de 10'
  ] ?? 2
  const impuestos: Impuesto[] = ([
    {
      id: uid(),
      nombre: 'Monotributo',
      monto: 47500,
      vence: proximoDia(20),
      estado: 'pendiente',
      periodicidad: 'mensual',
      pagos: [
        { fecha: hace(30), monto: 47500 },
        { fecha: hace(61), monto: 44200 },
      ],
    },
    {
      id: uid(),
      nombre: 'Ingresos Brutos — San Juan',
      monto: 68400,
      vence: proximoDia(16),
      estado: 'pendiente',
      periodicidad: 'mensual',
      pagos: [{ fecha: hace(28), monto: 61900 }],
    },
    {
      id: uid(),
      nombre: 'Tasa municipal de comercio',
      monto: 21800,
      vence: proximoDia(10),
      estado: 'pendiente',
      periodicidad: 'mensual',
      pagos: [{ fecha: hace(33), monto: 21800 }],
    },
    {
      id: uid(),
      nombre: 'Cargas sociales',
      // Estimación gruesa a partir del rango que declaró en el setup — los
      // empleados reales viven en Supabase, no hace falta la lista acá.
      monto: cantidadEmpleadosAprox > 0 ? redondear(cantidadEmpleadosAprox * 148000) : 0,
      vence: proximoDia(12),
      estado: cantidadEmpleadosAprox > 0 ? 'pendiente' : 'pagado',
      periodicidad: 'mensual',
      pagos: [],
    },
  ] satisfies Impuesto[]).filter((i) => i.monto > 0)

  return { productos, ventas, impuestos, categorias: [], movimientos: [] }
}

export const RUBROS = [
  'Almacén',
  'Kiosco',
  'Indumentaria',
  'Gastronomía',
  'Peluquería/Estética',
  'Ferretería',
  'Farmacia',
  'Otro',
] as const

export const ANTIGUEDADES = ['Recién empieza', '1-2 años', '3-5 años', 'Más de 5 años'] as const
export const RANGOS_EMPLEADOS = ['0', '1-3', '4-10', 'Más de 10'] as const
