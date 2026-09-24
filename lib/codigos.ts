import type { Producto } from './types'

/** Códigos de hasta 3 cifras: de sobra para el catálogo de un comercio chico
 *  y lo bastante corto para decirlo de un tirón al vender. */
const CODIGO_MAX = 999

/** Asigna el próximo número corto libre (1, 2, 3…) — el más chico que ningún
 *  otro producto de la cuenta esté usando todavía. Es automático a
 *  propósito: el comerciante no elige el código, así queda siempre corto y
 *  sin colisiones, y los que se liberan (al borrar un producto) se
 *  reutilizan solos. */
export function asignarCodigo(productos: Producto[]): string {
  const usados = new Set(
    productos.map((p) => Number(p.codigo)).filter((n) => Number.isInteger(n) && n > 0),
  )
  for (let n = 1; n <= CODIGO_MAX; n++) {
    if (!usados.has(n)) return String(n)
  }
  // Catálogo de 999 productos con código: caso límite que no debería pasar
  // en un comercio chico. El índice único de la base rechaza el duplicado
  // si de verdad llega a pasar, en vez de guardar un código repetido.
  return String(CODIGO_MAX)
}

/** Busca un producto por código exacto (sin importar mayúsculas/espacios).
 *  La usa el asistente de ventas: un código bien tipeado o dictado nunca
 *  debería fallar por un detalle de formato. */
export function buscarPorCodigo(productos: Producto[], codigo: string): Producto | undefined {
  const buscado = codigo.trim().toLowerCase()
  if (!buscado) return undefined
  return productos.find((p) => p.codigo?.trim().toLowerCase() === buscado)
}
