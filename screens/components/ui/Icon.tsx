import {
  Apple,
  Baby,
  BookOpen,
  Box,
  Boxes,
  Brush,
  Cake,
  Car,
  CircleDashed,
  Coffee,
  CreditCard,
  Croissant,
  Dumbbell,
  Gift,
  GraduationCap,
  HeartPulse,
  House,
  Hammer,
  Lightbulb,
  Milk,
  PawPrint,
  PiggyBank,
  Pill,
  Plane,
  Popcorn,
  Scissors,
  Shirt,
  ShoppingCart,
  Smartphone,
  Soup,
  SprayCan,
  Utensils,
  Wallet,
  Wine,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { CategoriaColor, IconName } from '@/lib/types'

/**
 * Registro de íconos serializables.
 *
 * Las categorías se guardan en localStorage, así que no pueden guardar un
 * componente: guardan esta clave. El registro también es lo que hace posible
 * la regla de diseño de "íconos variados": cada concepto tiene el suyo y
 * ninguna lista termina con el mismo check repetido diez veces.
 */
export const ICONOS: Record<string, LucideIcon> = {
  carrito: ShoppingCart,
  rayo: Zap,
  auto: Car,
  salud: HeartPulse,
  ocio: Popcorn,
  educacion: GraduationCap,
  sueldo: Wallet,
  casa: House,
  mascota: PawPrint,
  ropa: Shirt,
  regalo: Gift,
  ahorro: PiggyBank,
  telefono: Smartphone,
  herramientas: Wrench,
  viaje: Plane,
  cafe: Coffee,
  gym: Dumbbell,
  libro: BookOpen,
  tarjeta: CreditCard,
  comida: Utensils,
  bebida: Wine,
  limpieza: SprayCan,
  bebe: Baby,
  belleza: Scissors,
  obra: Hammer,
  luz: Lightbulb,
  otros: CircleDashed,
}

/** Íconos disponibles en el selector al crear una categoría. */
export const ICONOS_ELEGIBLES: IconName[] = [
  'carrito', 'rayo', 'auto', 'salud', 'ocio', 'educacion', 'casa', 'mascota',
  'ropa', 'regalo', 'ahorro', 'telefono', 'herramientas', 'viaje', 'cafe',
  'gym', 'libro', 'tarjeta', 'comida', 'bebida', 'limpieza', 'bebe', 'otros',
]

export function iconoDe(nombre: IconName): LucideIcon {
  return ICONOS[nombre] ?? CircleDashed
}

/* ── Rubros de producto ────────────────────────────────────────────────── */

/** Ícono por categoría de producto. Sin esto todas las filas del catálogo
 *  usarían la misma cajita y la lista se vuelve ilegible de un vistazo. */
const POR_RUBRO: [RegExp, LucideIcon][] = [
  [/almac[eé]n|general|despensa/i, ShoppingCart],
  [/l[aá]cteo/i, Milk],
  [/bebida|vino|cerveza/i, Wine],
  [/panificado|panader/i, Croissant],
  [/golosina|dulce/i, Cake],
  [/snack|fiambre/i, Apple],
  [/limpieza/i, SprayCan],
  [/tabaco|varios/i, Box],
  [/remera|pantal[oó]n|abrigo|indumentaria/i, Shirt],
  [/accesorio/i, Gift],
  [/cafeter[ií]a/i, Coffee],
  [/cocina|comida|gastronom/i, Soup],
  [/servicio/i, Scissors],
  [/producto/i, Brush],
  [/medicamento|farmacia/i, Pill],
  [/cuidado|dermo/i, HeartPulse],
  [/beb[eé]s?/i, Baby],
  [/fijacion|herramienta/i, Hammer],
  [/electricidad/i, Lightbulb],
  [/pintura/i, Brush],
  [/seguridad/i, Wrench],
]

export function iconoRubro(categoria: string): LucideIcon {
  for (const [re, icono] of POR_RUBRO) if (re.test(categoria)) return icono
  return Boxes
}

/* ── Chip de ícono ─────────────────────────────────────────────────────── */

const TONOS: Record<CategoriaColor, string> = {
  accent: 'bg-accent-dim text-accent-hi',
  pos: 'bg-pos-dim text-pos',
  warn: 'bg-warn-dim text-warn',
  neg: 'bg-neg-dim text-neg',
  teal: 'bg-cat-teal/15 text-cat-teal',
  arena: 'bg-cat-arena/15 text-cat-arena',
  oliva: 'bg-cat-oliva/15 text-cat-oliva',
  ladrillo: 'bg-cat-ladrillo/15 text-cat-ladrillo',
}

export const COLORES_CATEGORIA: CategoriaColor[] = [
  'accent', 'pos', 'warn', 'neg', 'teal', 'arena', 'oliva', 'ladrillo',
]

const TAMANOS = {
  sm: 'size-8 rounded-[10px] [&>svg]:size-4',
  md: 'size-10 rounded-xl [&>svg]:size-[18px]',
  lg: 'size-12 rounded-[14px] [&>svg]:size-5',
}

/** Cuadrado redondeado con el ícono adentro y el color de la categoría. */
export function IconChip({
  icon: Icon,
  color = 'accent',
  size = 'md',
  className,
}: {
  icon: LucideIcon
  color?: CategoriaColor
  size?: keyof typeof TAMANOS
  className?: string
}) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center',
        TAMANOS[size],
        TONOS[color],
        className,
      )}
    >
      <Icon strokeWidth={1.9} />
    </span>
  )
}
