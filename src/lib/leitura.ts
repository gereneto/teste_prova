// Leituras prontas dos resultados, para a Solar e para os comentários das questões.

import type { Caderno, Colegio, Id, Questao } from '../types'
import { agruparPor, avaliados, questaoValida, type ResultadoAluno, type ResultadoAvaliado } from './estatisticas'

/** O comentário da Solar sobre uma alternativa, como frase: "Quem marca C costuma ter somado sem…" */
export const comentarioEmFrase = (letra: string, comentario: string) => `Quem marca ${letra} costuma ${comentario.replace(/^\s*costuma\s+/i, '')}`

/** Abaixo disso, menos da metade acertou. */
export const LIMITE_METADE = 50

/** Percentual de acerto de um grupo de alunos numa questão. */
export function acertoNaQuestao(lista: ResultadoAvaliado[], indice: number): { pct: number | null; n: number } {
  const validos = lista.filter((r) => r.correcao.porQuestao[indice] !== 'fora')
  if (!validos.length) return { pct: null, n: 0 }
  return { pct: (100 * validos.filter((r) => r.correcao.porQuestao[indice] === 'certa').length) / validos.length, n: validos.length }
}

export type LeituraQuadro = 'todos' | 'alguns' | null

export interface LinhaQuadro {
  indice: number
  questao: Questao
  rede: number | null
  porColegio: Map<Id, { pct: number | null; n: number }>
  leitura: LeituraQuadro
}

/** Mínimo de alunos para mostrar o acerto de um colégio numa questão. */
export const MINIMO_QUADRO = 20

/**
 * Cada questão de uma prova, colégio por colégio. "todos": abaixo da metade em todos os colégios
 * (rever a questão ou o material); "alguns": abaixo da metade em um ou dois colégios (apoiar esses colégios).
 */
export function quadroColegioQuestao(caderno: Caderno, resultados: ResultadoAluno[], colegios: Colegio[], minimo = MINIMO_QUADRO): LinhaQuadro[] {
  const lista = avaliados(resultados).filter((r) => r.caderno.id === caderno.id)
  const porColegio = agruparPor(lista, (r) => r.colegio.id)
  return caderno.questoes.map((questao, indice) => {
    const rede = questaoValida(questao) ? acertoNaQuestao(lista, indice).pct : null
    const mapa = new Map(colegios.map((c) => [c.id, questaoValida(questao) ? acertoNaQuestao(porColegio.get(c.id) ?? [], indice) : { pct: null, n: 0 }]))
    const comAlunos = [...mapa.values()].filter((v) => v.n >= minimo && v.pct != null)
    const abaixo = comAlunos.filter((v) => v.pct! < LIMITE_METADE).length
    let leitura: LeituraQuadro = null
    if (comAlunos.length > 1 && abaixo === comAlunos.length) leitura = 'todos'
    else if (abaixo > 0 && abaixo <= 2) leitura = 'alguns'
    return { indice, questao, rede, porColegio: mapa, leitura }
  })
}
