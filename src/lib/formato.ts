import type { Serie, Turma } from '../types'

export const serieNome = (serie: Serie) => `${serie}º ano`

export const turmaNome = (turma: Pick<Turma, 'serie' | 'nome'>) => `${turma.serie}º ano ${turma.nome}`

export function pct(valor: number | null | undefined): string {
  if (valor == null || Number.isNaN(valor)) return '—'
  return `${Math.round(valor)}%`
}

/** "2026-09-21" → "21/09" */
export function dataCurta(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}`
}

/** "2026-09-21" → "21/09/2026" */
export function dataLonga(iso: string): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}

const dois = (n: number) => String(n).padStart(2, '0')

/** Data de hoje no fuso do navegador, como "2026-09-28". */
export function hojeIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`
}

/** Data e hora locais, como "2026-09-28T14:05:00". */
export function agoraIso(): string {
  const d = new Date()
  return `${hojeIso()}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
}

/** Dias corridos de hoje até a data (negativo se já passou). */
export function diasAte(iso: string): number {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  const [ha, hm, hd] = hojeIso().split('-').map(Number)
  return Math.round((Date.UTC(ano, mes - 1, dia) - Date.UTC(ha, hm - 1, hd)) / 86_400_000)
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export function tamanhoArquivo(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** Minúsculas e sem acentos, para buscas. */
export const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export const compararTexto = (a: string, b: string) => a.localeCompare(b, 'pt-BR')

export function ordenarTurmas<T extends Pick<Turma, 'serie' | 'nome'>>(turmas: T[]): T[] {
  return [...turmas].sort((a, b) => a.serie - b.serie || compararTexto(a.nome, b.nome))
}
