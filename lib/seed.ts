/**
 * Listas de opciones fijas que usan los formularios de alta (setup inicial,
 * Mi Negocio). No son datos de ejemplo — son las opciones que el usuario
 * elige, así que no dependen de la cuenta ni se borran nunca.
 *
 * Antes este archivo también generaba productos, ventas, movimientos e
 * impuestos de mentira para que una cuenta nueva no arrancara vacía. Se
 * sacó: confundía a un comerciante real ver ventas que nunca cargó. Toda
 * cuenta nueva arranca sin datos, como corresponde.
 */

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
