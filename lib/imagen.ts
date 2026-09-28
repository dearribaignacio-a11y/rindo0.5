'use client'

/**
 * Prepara una foto para mandarla a leer: la achica y la pasa a JPEG.
 *
 * Una foto de cámara pesa varios MB y Vercel corta los cuerpos de más de
 * ~4,5 MB. 1568 px de lado es lo máximo que el modelo aprovecha sin
 * reescalar, y alcanza para que la letra chica de un ticket se lea bien.
 *
 * Devuelve null si el navegador no puede abrir la imagen (típico: una HEIC de
 * iPhone elegida desde la galería en un navegador que no la soporta). Antes
 * se mandaba igual el archivo original y el servidor lo rechazaba sin que la
 * pantalla dijera por qué.
 */
export async function comprimirFoto(file: File, lado = 1568): Promise<string | null> {
  const dataUrl = await new Promise<string | null>((res) => {
    const lector = new FileReader()
    lector.onload = () => res(String(lector.result))
    lector.onerror = () => res(null)
    lector.readAsDataURL(file)
  })
  if (!dataUrl) return null

  return new Promise((res) => {
    const img = new Image()
    img.onload = () => {
      const escala = Math.min(1, lado / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * escala)
      canvas.height = Math.round(img.height * escala)
      const ctx = canvas.getContext('2d')
      if (!ctx) return res(esFormatoAceptado(dataUrl) ? dataUrl : null)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      res(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => res(null)
    img.src = dataUrl
  })
}

function esFormatoAceptado(dataUrl: string) {
  return /^data:image\/(png|jpeg|webp|gif);base64,/i.test(dataUrl)
}
