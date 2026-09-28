import { ImageResponse } from 'next/og'

/**
 * Ícono de Rindo generado al vuelo (no hay ningún archivo de imagen en el
 * repo) — un cuadrado a pantalla completa, sin bordes redondeados propios:
 * así sirve tanto de ícono "any" como de ícono "maskable" (el sistema
 * operativo le aplica su propia forma). El glifo "R" se deja bien adentro
 * del cuadrado para no quedar cortado cuando el SO lo enmascara en redondo.
 * Mismos colores que `components/ui/Logo.tsx` en el tema "petroleo" —
 * ver el comentario de `app/manifest.ts` sobre por qué un color fijo.
 */
export function renderIcono(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1D5C6E',
        }}
      >
        <span
          style={{
            fontSize: size * 0.55,
            fontWeight: 700,
            color: '#EAF6FA',
            fontFamily: 'sans-serif',
          }}
        >
          R
        </span>
      </div>
    ),
    { width: size, height: size },
  )
}
