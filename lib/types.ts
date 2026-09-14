/** Modelo de datos de Rindo. Todo se persiste hoy en localStorage, pero las
 *  formas están pensadas para mapear 1:1 a tablas cuando haya backend:
 *  cada entidad tiene `id` propio y referencias por id, nunca objetos anidados. */

export type PlanId = 'hogar' | 'comercial' | 'comercial-pro'
export type ThemeId = 'petroleo' | 'medianoche' | 'grafito'
export type MetodoPago = 'efectivo' | 'tarjeta' | 'transferencia'
export type TipoMovimiento = 'ingreso' | 'gasto'

/** Clave del registro de íconos (components/ui/Icon.tsx). Se guarda el nombre,
 *  no el componente, para que la categoría sea serializable. */
export type IconName = string

/** Token de color semántico usado por los chips de categoría. */
export type CategoriaColor =
  | 'accent'
  | 'pos'
  | 'warn'
  | 'neg'
  | 'teal'
  | 'arena'
  | 'oliva'
  | 'ladrillo'

export interface Perfil {
  nombre: string
  email: string
  plan: PlanId
  moneda: string
  /* Hogar */
  integrantes?: number
  ingresoMensual?: number
  /* Comercial */
  negocio?: string
  rubro?: string
  antiguedad?: string
  empleadosRango?: string
  ciudad?: string
  /** dataURL del logo subido en el setup. Vacío = se usa la inicial. */
  logo?: string
}

export interface Categoria {
  id: string
  nombre: string
  icono: IconName
  color: CategoriaColor
  /** Límite mensual en pesos. 0 = sin presupuesto asignado. */
  limite: number
}

export interface Movimiento {
  id: string
  tipo: TipoMovimiento
  monto: number
  categoriaId: string
  descripcion: string
  /** ISO corto: yyyy-mm-dd */
  fecha: string
  /** id del miembro de la familia que lo cargó */
  autorId?: string
  origen?: 'manual' | 'ticket'
}

export interface Miembro {
  id: string
  nombre: string
  rol: 'admin' | 'miembro'
}

/** Invitación a la cuenta familiar. Hoy el código se genera y se comparte,
 *  pero no conecta con otro usuario real: falta el backend. La estructura ya
 *  contempla el estado para cuando exista. */
export interface Invitacion {
  codigo: string
  creada: string
  estado: 'pendiente' | 'aceptada'
}

export interface Producto {
  id: string
  nombre: string
  categoria: string
  costo: number
  precio: number
  stock: number
  /** Umbral por debajo del cual el producto entra en "reponer". */
  stockMin: number
}

export interface ItemVenta {
  productoId: string
  nombre: string
  cantidad: number
  /** Precio unitario al momento de la venta (no se recalcula después). */
  precio: number
}

export interface Venta {
  id: string
  /** ISO completo con hora — el gráfico por hora depende de esto. */
  fecha: string
  items: ItemVenta[]
  total: number
  metodo: MetodoPago
}

export interface ItemReposicion {
  productoId: string | null
  nombre: string
  cantidad: number
  costo: number
  /** true cuando lo detectó la lectura de la factura y nadie lo tocó. */
  autoDetectado?: boolean
}

export interface Reposicion {
  id: string
  fecha: string
  items: ItemReposicion[]
  total: number
  origen: 'manual' | 'foto'
}

export interface Empleado {
  id: string
  nombre: string
  puesto: string
  /** ISO corto */
  ingreso: string
  sueldo: number
  activo: boolean
  permisos: { ventas: boolean; stock: boolean; reportes: boolean }
}

export interface PagoImpuesto {
  fecha: string
  monto: number
}

export interface Impuesto {
  id: string
  nombre: string
  monto: number
  /** ISO corto del vencimiento del período actual. */
  vence: string
  estado: 'pendiente' | 'pagado'
  periodicidad: 'mensual' | 'bimestral' | 'anual'
  pagos: PagoImpuesto[]
}

/** Tarjeta de confirmación embebida en una respuesta del asistente. */
export interface ConfirmacionChat {
  titulo: string
  lineas: { etiqueta: string; valor: string }[]
  estado: 'pendiente' | 'confirmada' | 'corregida'
}

export interface Mensaje {
  id: string
  rol: 'usuario' | 'asistente'
  texto: string
  tipo: 'texto' | 'audio' | 'foto'
  /** Segundos, sólo para tipo audio. */
  duracion?: number
  /** dataURL, sólo para tipo foto. */
  adjunto?: string
  hora: string
  confirmacion?: ConfirmacionChat
}

export interface Ajustes {
  tema: ThemeId
  moneda: string
  notificaciones: boolean
  idioma: string
}

export interface Flags {
  setupHecho: boolean
  onboardingVisto: boolean
  sesionIniciada: boolean
}

export interface DB {
  version: number
  perfil: Perfil | null
  categorias: Categoria[]
  movimientos: Movimiento[]
  miembros: Miembro[]
  invitacion: Invitacion | null
  productos: Producto[]
  ventas: Venta[]
  reposiciones: Reposicion[]
  empleados: Empleado[]
  impuestos: Impuesto[]
  mensajes: Mensaje[]
  /** Sugerencias de precio ya descartadas por el comerciante. */
  preciosIgnorados: string[]
  ajustes: Ajustes
  flags: Flags
}
