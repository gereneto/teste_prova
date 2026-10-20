import type { Serie, Turma } from '../types'

export const serieNome = (serie: Serie) => `${serie}º ano`

/** "Matemática do 3º ano" (no meio da frase: "a prova de Matemática do 3º ano"). */
export const provaNome = (caderno: { serie: Serie; disciplina: string }) => `${caderno.disciplina} do ${serieNome(caderno.serie)}`

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

/** Dias corridos de uma data até outra (negativo se a segunda vem antes). */
export function diasEntre(de: string, ate: string): number {
  const [a1, m1, d1] = de.slice(0, 10).split('-').map(Number)
  const [a2, m2, d2] = ate.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000)
}

/** Dias corridos de hoje até a data (negativo se já passou). */
export const diasAte = (iso: string) => diasEntre(hojeIso(), iso)

/** "2026-10-15" mais 3 dias → "2026-10-18" */
export function somarDias(iso: string, dias: number): string {
  const [ano, mes, dia] = iso.slice(0, 10).split('-').map(Number)
  const d = new Date(Date.UTC(ano, mes - 1, dia + dias))
  return `${d.getUTCFullYear()}-${dois(d.getUTCMonth() + 1)}-${dois(d.getUTCDate())}`
}

/** "Faltam 6 dias (até 30/10)", "O prazo termina hoje", "O prazo terminou em 30/10". */
export function descreverPrazo(prazo: string): string {
  const dias = diasAte(prazo)
  if (dias > 1) return `Faltam ${dias} dias (até ${dataCurta(prazo)})`
  if (dias === 1) return `O prazo termina amanhã (${dataCurta(prazo)})`
  if (dias === 0) return 'O prazo termina hoje'
  return `O prazo terminou em ${dataCurta(prazo)}`
}

export const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome

/** Corta um texto longo no fim de uma palavra: "Identificar funções do texto dramático…" */
export function resumir(texto: string, limite = 90): string {
  if (texto.length <= limite) return texto
  return `${texto.slice(0, texto.lastIndexOf(' ', limite)).replace(/[,;:.]$/, '')}…`
}

/** "a, b e c" */
export function listaEmTexto(itens: string[]): string {
  if (itens.length <= 1) return itens.join('')
  return `${itens.slice(0, -1).join(', ')} e ${itens.at(-1)}`
}

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
