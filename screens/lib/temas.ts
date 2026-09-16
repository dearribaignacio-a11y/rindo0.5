import type { ThemeId } from './types'

export interface Tema {
  id: ThemeId
  nombre: string
  descripcion: string
  /** Colores del preview chico. Van literales porque el preview tiene que
   *  mostrar el tema *no aplicado*, así que no puede usar las variables CSS. */
  preview: { fondo: string; superficie: string; acento: string; texto: string }
}

/** Tres variantes de la misma familia seria. Ninguna se va al violeta. */
export const TEMAS: Tema[] = [
  {
    id: 'petroleo',
    nombre: 'Petróleo',
    descripcion: 'Gris neutro con acento azul petróleo.',
    preview: { fondo: '#121212', superficie: '#1a1a1a', acento: '#1d5c6e', texto: '#f2f2f2' },
  },
  {
    id: 'medianoche',
    nombre: 'Medianoche',
    descripcion: 'Grises más fríos, acento azul marino.',
    preview: { fondo: '#101318', superficie: '#191d24', acento: '#1e4e6b', texto: '#eef1f5' },
  },
  {
    id: 'grafito',
    nombre: 'Grafito',
    descripcion: 'Base grafito con acento verde azulado.',
    preview: { fondo: '#121413', superficie: '#1b1e1d', acento: '#14746f', texto: '#f0f2f1' },
  },
]
