import 'server-only'
import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

/** Topes de uso por ventana de tiempo (ver `consumir_cupo` en la migración
 *  0014). Cada lectura de foto o mensaje al asistente se paga en la cuenta de
 *  Anthropic: sin esto, alguien con una cuenta gratis podía gastarla entera. */
export const TOPES = {
  /** Fotos + asistente, sumados, por cuenta. Alcanza de sobra para un
   *  mostrador con mucho movimiento. */
  iaPorHora: 100,
  iaPorDia: 500,
  /** Altas de cuenta por IP. Holgado porque en Argentina muchos celulares
   *  salen a internet por la misma IP de la compañía. */
  altasPorHora: 10,
  /** Intentos de "contraseña actual" en Ajustes, por cuenta. */
  passwordPorHora: 10,
} as const

/**
 * `true` si todavía queda cupo para `clave` en la ventana. Si el servidor no
 * tiene la Service Role Key o la migración 0014 no se corrió, deja pasar
 * (igual que antes de existir el tope) en vez de romper la app.
 */
export async function hayCupo(clave: string, limite: number, segundos: number): Promise<boolean> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return true
  try {
    const { data, error } = await createAdminClient().rpc('consumir_cupo', {
      p_clave: clave,
      p_limite: limite,
      p_segundos: segundos,
    })
    if (error) {
      console.error('[limites]', error.message)
      return true
    }
    return data !== false
  } catch (err) {
    console.error('[limites]', err)
    return true
  }
}

/** Tope de IA por cuenta: por hora y por día. */
export async function hayCupoIA(userId: string): Promise<boolean> {
  const hora = await hayCupo(`ia:h:${userId}`, TOPES.iaPorHora, 3600)
  if (!hora) return false
  return hayCupo(`ia:d:${userId}`, TOPES.iaPorDia, 86_400)
}

/** IP de quien hace el pedido. En Vercel `x-real-ip` la pone la plataforma,
 *  no el cliente, así que no se puede falsificar desde afuera. */
export function ipDe(req: Request): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'desconocida'
  )
}

/**
 * Los cron de Vercel mandan `Authorization: Bearer <CRON_SECRET>`. Sin la
 * variable cargada en el servidor NO se deja pasar a nadie: antes, sin
 * secreto, cualquiera podía disparar estas rutas desde el navegador.
 */
export function esCronAutorizado(req: Request): boolean {
  const secreto = process.env.CRON_SECRET
  if (!secreto) return false
  const recibido = Buffer.from(req.headers.get('authorization') ?? '')
  const esperado = Buffer.from(`Bearer ${secreto}`)
  return recibido.length === esperado.length && timingSafeEqual(recibido, esperado)
}
