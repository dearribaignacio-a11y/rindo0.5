import { renderIcono } from '@/lib/server/icono'

export const runtime = 'edge'

export function GET() {
  return renderIcono(192)
}
