'use client'

/** Reduce una foto antes de mandarla al servidor: una foto de cámara pesa
 *  varios MB, y de eso sólo hace falta que el texto se lea bien. Sólo achica
 *  (nunca agranda) hasta que el lado más largo mida `lado` px, manteniendo la
 *  proporción — a diferencia del recorte cuadrado del logo del negocio
 *  (`screens/SetupWizard.tsx`), acá la foto es rectangular (un ticket, una
 *  factura, una hoja de cuaderno) y recortarla perdería contenido. */
export async function comprimirImagen(file: File, lado = 1280): Promise<string> {
  const dataUrl = await new Promise<string>((res) => {
    const lector = new FileReader()
    lector.onload = () => res(String(lector.result))
    lector.readAsDataURL(file)
  })

  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return res(dataUrl)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      res(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => res(dataUrl)
    img.src = dataUrl
  })
}
