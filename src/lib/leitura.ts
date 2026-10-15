// Leituras prontas dos resultados, em linguagem de sala de aula: o que retomar, que erro se destaca,
// que grupos formar. As regras são simples de explicar e não comparam a turma com ninguém.

import { ordemDisciplina } from '../data/bncc'
import type { Caderno, Colegio, Id, Questao, Turma } from '../types'
import { agruparPor, avaliados, questaoValida, type AnaliseQuestao, type ResultadoAluno, type ResultadoAvaliado } from './estatisticas'

/** O comentário da Solar sobre uma alternativa, como frase: "Quem marca C costuma ter somado sem…" */
export const comentarioEmFrase = (letra: string, comentario: string) => `Quem marca ${letra} costuma ${comentario.replace(/^\s*costuma\s+/i, '')}`

/** "Para retomar": menos da metade acertou. */
export const LIMITE_RETOMAR = 50
/** Só se agrupam alunos por disciplina com pelo menos este número de questões; com menos, seria acaso. */
export const MINIMO_QUESTOES_GRUPO = 3
/** Um erro "se destaca" quando pelo menos esta parte da turma marcou a mesma alternativa errada. */
const PCT_ERRO_DESTACADO = 30

export function questoesParaRetomar(analise: AnaliseQuestao[]): AnaliseQuestao[] {
  return analise.filter((a) => a.pctAcerto != null && a.pctAcerto < LIMITE_RETOMAR).sort((a, b) => a.pctAcerto! - b.pctAcerto!)
}

/** A questão em que mais alunos marcaram a mesma alternativa errada, se esse erro for comum. */
export function erroQueSeDestaca(analise: AnaliseQuestao[], minimoAlunos = 3): AnaliseQuestao | null {
  const candidatas = analise.filter((a) => a.erroMaisComum && a.erroMaisComum.qtd >= minimoAlunos && a.erroMaisComum.pct >= PCT_ERRO_DESTACADO)
  return candidatas.sort((a, b) => b.erroMaisComum!.pct - a.erroMaisComum!.pct)[0] ?? null
}

/** Disciplinas da prova com questões suficientes para formar grupos. */
export function disciplinasComQuestoes(caderno: Pick<Caderno, 'questoes'>, minimo = MINIMO_QUESTOES_GRUPO): { disciplina: string; indices: number[] }[] {
  const porDisciplina = new Map<string, number[]>()
  caderno.questoes.forEach((q, i) => {
    if (questaoValida(q)) porDisciplina.set(q.disciplina, [...(porDisciplina.get(q.disciplina) ?? []), i])
  })
  return [...porDisciplina]
    .filter(([, indices]) => indices.length >= minimo)
    .sort(([a], [b]) => ordemDisciplina(a, b))
    .map(([disciplina, indices]) => ({ disciplina, indices }))
}

function acertosEm(r: ResultadoAvaliado, indices: number[]) {
  return indices.filter((i) => r.correcao.porQuestao[i] === 'certa').length
}

export interface GrupoParaRetomar {
  disciplina: string
  questoes: number
  alunos: { resultado: ResultadoAvaliado; acertos: number }[]
}

/** Para cada disciplina com questões suficientes, os alunos que acertaram menos da metade delas. */
export function gruposParaRetomar(resultados: ResultadoAluno[]): GrupoParaRetomar[] {
  const lista = avaliados(resultados)
  if (!lista.length) return []
  return disciplinasComQuestoes(lista[0].caderno)
    .map(({ disciplina, indices }) => ({
      disciplina,
      questoes: indices.length,
      alunos: lista
        .map((resultado) => ({ resultado, acertos: acertosEm(resultado, indices) }))
        .filter((x) => (100 * x.acertos) / indices.length < LIMITE_RETOMAR)
        .sort((a, b) => a.resultado.aluno.numero - b.resultado.aluno.numero),
    }))
    .filter((g) => g.alunos.length > 0)
}

/** A disciplina em que o aluno teve mais dificuldade (acertou menos da metade), se houver. */
export function dificuldadeDoAluno(r: ResultadoAvaliado): { disciplina: string; acertos: number; questoes: number } | null {
  let pior: { disciplina: string; acertos: number; questoes: number } | null = null
  for (const { disciplina, indices } of disciplinasComQuestoes(r.caderno)) {
    const acertos = acertosEm(r, indices)
    if ((100 * acertos) / indices.length >= LIMITE_RETOMAR) continue
    if (!pior || acertos / indices.length < pior.acertos / pior.questoes) pior = { disciplina, acertos, questoes: indices.length }
  }
  return pior
}

/** Percentual de acerto de um grupo de alunos numa questão. */
export function acertoNaQuestao(lista: ResultadoAvaliado[], indice: number): { pct: number | null; n: number } {
  const validos = lista.filter((r) => r.correcao.porQuestao[indice] !== 'fora')
  if (!validos.length) return { pct: null, n: 0 }
  return { pct: (100 * validos.filter((r) => r.correcao.porQuestao[indice] === 'certa').length) / validos.length, n: validos.length }
}

export interface DificuldadeComum {
  indice: number
  questao: Questao
  pct: number
  porTurma: { turma: Turma; pct: number | null; n: number }[]
  /** Todas as turmas com pelo menos `minimoPorTurma` alunos ficaram abaixo da metade. */
  emTodas: boolean
}

/**
 * O que o colégio precisa retomar num ano: as questões que menos da metade dos alunos acertou,
 * com o resultado de cada turma. Serve para planejar em grupo, não para comparar professores.
 */
export function dificuldadesComuns(caderno: Caderno, resultados: ResultadoAluno[], minimoPorTurma = 5): DificuldadeComum[] {
  const lista = avaliados(resultados).filter((r) => r.caderno.id === caderno.id)
  const porTurma = [...agruparPor(lista, (r) => r.turma)] as [Turma, ResultadoAvaliado[]][]
  return caderno.questoes
    .map((questao, indice) => {
      if (!questaoValida(questao)) return null
      const { pct } = acertoNaQuestao(lista, indice)
      if (pct == null || pct >= LIMITE_RETOMAR) return null
      const turmas = porTurma.map(([turma, rs]) => ({ turma, ...acertoNaQuestao(rs, indice) }))
      const comAlunos = turmas.filter((t) => t.n >= minimoPorTurma)
      return { indice, questao, pct, porTurma: turmas, emTodas: comAlunos.length > 1 && comAlunos.every((t) => t.pct! < LIMITE_RETOMAR) }
    })
    .filter((x): x is DificuldadeComum => x !== null)
    .sort((a, b) => a.pct - b.pct)
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
    const abaixo = comAlunos.filter((v) => v.pct! < LIMITE_RETOMAR).length
    let leitura: LeituraQuadro = null
    if (comAlunos.length > 1 && abaixo === comAlunos.length) leitura = 'todos'
    else if (abaixo > 0 && abaixo <= 2) leitura = 'alguns'
    return { indice, questao, rede, porColegio: mapa, leitura }
  })
}
