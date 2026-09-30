/**
 * Cómo llega el Excel al contador. Tres caminos, en este orden:
 *
 *  A. Subir el archivo, generar un link privado que vence a los 7 días y
 *     abrir WhatsApp con el mensaje ya escrito. Necesita sesión (Supabase).
 *  B. Menú de compartir del celular (Web Share API) con el Excel adjunto.
 *  C. Descargar el archivo y abrir WhatsApp con el mensaje, para adjuntarlo
 *     a mano.
 */

import type { Contador } from '@/lib/types'
import { XLSX_MIME } from './excel'
import type { Periodo } from './periodo'

export type Via = 'link' | 'compartir' | 'descarga'

/* ── Número de WhatsApp ───────────────────────────────────────────────── */

/**
 * Normaliza a 549 + área + número (13 dígitos). Acepta lo que la gente
 * escribe de verdad: "+54 9 264 412-3456", "54 264 4123456" (sin el 9) o
 * "0264 15 412-3456" (con 0 y 15). Devuelve null si no cierra.
 */
export function normalizarWhatsApp(entrada: string): string | null {
  let n = entrada.replace(/\D/g, '')
  if (n.startsWith('00')) n = n.slice(2)
  if (n.startsWith('0')) n = `54${n.slice(1)}`
  // Sin código de país: número nacional de 10 dígitos (área + número).
  if (n.length === 10) n = `54${n}`
  // El 15 del celular va después del código de área (2 a 4 dígitos): se saca.
  if (n.startsWith('54') && !n.startsWith('549') && n.length === 14) {
    for (const area of [2, 3, 4]) {
      if (n.slice(2 + area, 4 + area) === '15') {
        n = `54${n.slice(2, 2 + area)}${n.slice(4 + area)}`
        break
      }
    }
  }
  if (n.startsWith('54') && !n.startsWith('549') && n.length === 12) n = `549${n.slice(2)}`
  return /^549\d{10}$/.test(n) ? n : null
}

/** 5492644123456 → +54 9 264 412-3456 (asume área de 3 dígitos, como San Juan). */
export function whatsappLegible(n: string) {
  if (!/^549\d{10}$/.test(n)) return n
  return `+54 9 ${n.slice(3, 6)} ${n.slice(6, 9)}-${n.slice(9)}`
}

/* ── Mensaje ──────────────────────────────────────────────────────────── */

const primerNombre = (nombre: string) => nombre.trim().split(/\s+/)[0] || nombre

export function mensajeWhatsApp(opts: {
  contador: Contador
  comercio: string
  periodo: Periodo
  link?: string
}) {
  const saludo = `Hola ${primerNombre(opts.contador.nombre)}, te paso el resumen ${opts.periodo.enTexto} de ${opts.comercio}`
  // El link va en su propia línea: pegado a un punto, algunos teléfonos lo
  // toman como parte de la dirección y el link queda roto.
  if (opts.link) return `${saludo}:\n${opts.link}\n\nEl link vence en 7 días. Enviado desde Rindo.`
  return `${saludo}. Te adjunto el archivo Excel.\n\nEnviado desde Rindo.`
}

export const urlWhatsApp = (numero: string, texto: string) =>
  `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`

/* ── Capacidades del dispositivo ──────────────────────────────────────── */

/** ¿El navegador puede compartir un archivo .xlsx? (Chrome Android, Safari iOS). */
export function puedeCompartirArchivo() {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [new File([''], 'prueba.xlsx', { type: XLSX_MIME })] })
  } catch {
    return false
  }
}

export function descargar(archivo: Blob, nombre: string) {
  const url = URL.createObjectURL(archivo)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Un respiro antes de liberar: algunos navegadores leen la URL después del click.
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/* ── Envío ────────────────────────────────────────────────────────────── */

export interface Envio {
  /** Genera (o devuelve ya generado) el Excel. */
  archivo: () => Promise<Blob>
  nombre: string
  contador: Contador
  comercio: string
  periodo: Periodo
  /** Opción A. Si no viene (modo demo, sin sesión), se salta directo a B/C. */
  subir?: (archivo: Blob, nombre: string) => Promise<string>
}

/**
 * Manda el Excel por el mejor camino disponible y dice cuál usó.
 *
 * Los navegadores sólo dejan abrir otra pestaña o el menú de compartir "en
 * respuesta a un toque". Como subir el archivo tarda, la pestaña de WhatsApp
 * se abre vacía en el mismo toque y recién después se le carga la dirección.
 * Esta función tiene que llamarse directo desde el onClick.
 */
export async function enviarAlContador(e: Envio): Promise<Via> {
  const compartir = puedeCompartirArchivo()
  const usaVentana = Boolean(e.subir) || !compartir
  const ventana = usaVentana ? window.open('', '_blank') : null
  try {
    if (ventana) {
      ventana.document.title = 'Rindo'
      ventana.document.body.style.cssText = 'font-family:system-ui,sans-serif;background:#121212;color:#f2f2f2;padding:24px'
      ventana.document.body.textContent = 'Preparando el envío…'
    }
  } catch {
    /* ignorado: es sólo un texto de espera */
  }

  const abrir = (texto: string) => {
    const url = urlWhatsApp(e.contador.whatsapp, texto)
    if (ventana && !ventana.closed) ventana.location.href = url
    else window.location.href = url
  }

  const archivo = await e.archivo()

  // A — link privado de 7 días.
  if (e.subir) {
    try {
      const link = await e.subir(archivo, e.nombre)
      abrir(mensajeWhatsApp({ ...e, link }))
      return 'link'
    } catch {
      // Sin red, sin la migración 0012, sesión vencida… seguimos con B o C.
    }
  }

  // B — menú de compartir con el archivo adjunto.
  if (compartir) {
    ventana?.close()
    try {
      await navigator.share({
        files: [new File([archivo], e.nombre, { type: XLSX_MIME })],
        text: mensajeWhatsApp(e),
      })
      return 'compartir'
    } catch (err) {
      // Cerró el menú sin elegir: no es un error, no descargamos nada.
      if (err instanceof DOMException && err.name === 'AbortError') throw err
    }
  }

  // C — descarga + WhatsApp con el mensaje, para adjuntar a mano.
  descargar(archivo, e.nombre)
  abrir(mensajeWhatsApp(e))
  return 'descarga'
}
