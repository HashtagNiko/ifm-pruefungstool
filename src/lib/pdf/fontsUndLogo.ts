import pdfMake from 'pdfmake/build/pdfmake'
import logoUrl from '../../../logo.png'

/**
 * Lädt Ubuntu-Fonts zur Laufzeit (Google Fonts via CDN) und registriert sie bei pdfmake.
 * Vermeidet, große Font-Binaries ins Repo/Bundle zu legen. Wird einmal gecacht.
 */
let fontsGeladen = false

function arrayBufferZuBase64(buffer: ArrayBuffer): string {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

async function ladeDatei(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Konnte Datei nicht laden: ${url}`)
  return arrayBufferZuBase64(await res.arrayBuffer())
}

export async function ensureFonts(): Promise<void> {
  if (fontsGeladen) return
  const basis = 'https://cdn.jsdelivr.net/gh/google/fonts/ufl/ubuntu/'
  const [regular, bold] = await Promise.all([
    ladeDatei(`${basis}Ubuntu-Regular.ttf`),
    ladeDatei(`${basis}Ubuntu-Bold.ttf`),
  ])
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pm = pdfMake as any
  pm.vfs = {
    ...(pm.vfs ?? {}),
    'Ubuntu-Regular.ttf': regular,
    'Ubuntu-Bold.ttf': bold,
  }
  pm.fonts = {
    Ubuntu: {
      normal: 'Ubuntu-Regular.ttf',
      bold: 'Ubuntu-Bold.ttf',
      italics: 'Ubuntu-Regular.ttf',
      bolditalics: 'Ubuntu-Bold.ttf',
    },
  }
  fontsGeladen = true
}

let logoCache: string | null = null

/** IFM-Logo als Data-URL (für pdfmake-Image). Einmal gecacht. */
export async function ladeLogoDataUrl(): Promise<string> {
  if (logoCache) return logoCache
  const res = await fetch(logoUrl)
  const blob = await res.blob()
  logoCache = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
  return logoCache
}
