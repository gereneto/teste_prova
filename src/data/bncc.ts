import dados from './bncc-ef1.json'
import type { Serie } from '../types'

export interface Habilidade {
  codigo: string
  componente: string
  anos: number[]
  unidade: string
  objeto: string
  descricao: string
}

/** Habilidades da BNCC do 1º ao 5º ano, geradas de "BNCC - Habilidades.xlsx" por scripts/bncc_para_json.py. */
export const HABILIDADES: Habilidade[] = dados

const POR_CODIGO = new Map(HABILIDADES.map((h) => [h.codigo, h]))

export function buscarHabilidade(codigo: string | null | undefined): Habilidade | null {
  return codigo ? (POR_CODIGO.get(codigo) ?? null) : null
}

/** Nomes dos componentes como aparecem na planilha da BNCC. */
export const DISCIPLINAS = [
  'Português',
  'Matemática',
  'Ciências',
  'História',
  'Geografia',
  'Artes',
  'Educação Física',
  'Religião',
]

export const ordemDisciplina = (a: string, b: string) => DISCIPLINAS.indexOf(a) - DISCIPLINAS.indexOf(b)

export function habilidadesDoAno(serie: Serie, disciplina?: string): Habilidade[] {
  return HABILIDADES.filter((h) => h.anos.includes(serie) && (!disciplina || h.componente === disciplina))
}
