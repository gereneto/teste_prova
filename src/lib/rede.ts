// Os números da Solar, somados por turma e prova (PLANO §7.3): a Solar não vê aluno a aluno.
//
// Na plataforma, o banco manda estas somas prontas (prova.painel_rede, no plataforma-infra); na
// demonstração, painelDosDados calcula as mesmas somas a partir dos dados do navegador. As telas da
// Solar usam só elas, nos dois casos. As contas são as de estatisticas.ts, refeitas sobre as somas:
// rede.test.ts confere que dão os mesmos números que os alunos um a um.

import { camposFaltando } from './alunos'
import { alunosAtivos, alunosDaTurma, lancamentoDe } from './consultas'
import {
  analiseDaQuestao,
  corrigir,
  faixaDe,
  grupoIngresso,
  marcaEm,
  questaoValida,
  respostaCompleta,
  type AnaliseQuestao,
  type Desempenho,
  type Participacao,
  type Progresso,
  type ResumoGrupos,
} from './estatisticas'
import { iniciaisRepetidas } from './iniciais'
import { leituraDaLinha, MINIMO_QUADRO, type LinhaQuadro } from './leitura'
import { compararTexto } from './formato'
import type { Caderno, Colegio, Db, Id, Questao, RespostasDoColegio, Turma } from '../types'

export type Faixas = [number, number, number, number, number]

/** Um grupo de alunos avaliados numa turma e prova: quantos, a soma dos acertos e as faixas. */
export interface GrupoAgregado {
  n: number
  somaAcertos: number
  faixas: Faixas
}

/** Uma questão numa turma: quantos marcaram cada letra (ou branco, rasura, vazio), quantos acertaram e a soma dos acertos na prova de quem acertou. */
export interface QuestaoAgregada {
  marcas: Record<string, number>
  acertos: number
  somaComAcerto: number
}

/**
 * Uma turma numa prova. Grupos: novos, antigos e sem_ano (ingresso); F, M e sem_sexo; ha0 a ha4 (anos desde a
 * entrada no colégio, até "4 ou mais").
 */
export interface AgregadoTurma {
  turma: Id
  caderno: Id
  /** Alunos da lista (como em alunosDaTurma). */
  total: number
  comResposta: number
  lancados: number
  faltas: number
  adaptadas: number
  avaliados: number
  somaAcertos: number
  somaQuadrados: number
  faixas: Faixas
  ultima: string | null
  concluidoEm: string | null
  questoes: QuestaoAgregada[]
  grupos: Partial<Record<string, GrupoAgregado>>
}

/** O cadastro de uma turma do ano letivo em curso. */
export interface CadastroTurma {
  turma: Id
  alunos: number
  incompletos: number
  novos: number
  repetidas: boolean
}

export interface PainelRede {
  anoLetivo: number
  cadastros: CadastroTurma[]
  turmas: AgregadoTurma[]
}

const zeros = (): Faixas => [0, 0, 0, 0, 0]

// ------------------------------------------------------------------ as somas, a partir dos dados (demonstração)

export function agregarTurma(db: Db, caderno: Caderno, turma: Turma): AgregadoTurma {
  const lancamento = lancamentoDe(db, caderno.id, turma.id)
  const ag: AgregadoTurma = {
    turma: turma.id,
    caderno: caderno.id,
    total: 0,
    comResposta: 0,
    lancados: 0,
    faltas: 0,
    adaptadas: 0,
    avaliados: 0,
    somaAcertos: 0,
    somaQuadrados: 0,
    faixas: zeros(),
    ultima: null,
    concluidoEm: lancamento?.concluidoEm ?? null,
    questoes: caderno.questoes.map(() => ({ marcas: {}, acertos: 0, somaComAcerto: 0 })),
    grupos: {},
  }
  const somar = (chave: string, acertos: number, faixa: number) => {
    const g = (ag.grupos[chave] ??= { n: 0, somaAcertos: 0, faixas: zeros() })
    g.n++
    g.somaAcertos += acertos
    g.faixas[faixa]++
  }
  for (const aluno of alunosDaTurma(db, turma.id, lancamento)) {
    ag.total++
    const resposta = lancamento?.respostas[aluno.id]
    if (resposta) {
      ag.comResposta++
      if (!ag.ultima || resposta.atualizadoEm > ag.ultima) ag.ultima = resposta.atualizadoEm
    }
    if (!respostaCompleta(caderno, resposta)) continue
    ag.lancados++
    if (resposta!.situacao === 'faltou') ag.faltas++
    if (resposta!.situacao === 'adaptada') ag.adaptadas++
    if (resposta!.situacao !== 'presente') continue
    const correcao = corrigir(caderno, resposta!.marcas)
    const faixa = faixaDe(correcao.pct)
    ag.avaliados++
    ag.somaAcertos += correcao.acertos
    ag.somaQuadrados += correcao.acertos * correcao.acertos
    ag.faixas[faixa]++
    caderno.questoes.forEach((_, i) => {
      const q = ag.questoes[i]
      const marca = marcaEm(resposta!.marcas, i)
      q.marcas[marca] = (q.marcas[marca] ?? 0) + 1
      if (correcao.porQuestao[i] === 'certa') {
        q.acertos++
        q.somaComAcerto += correcao.acertos
      }
    })
    const ingresso = grupoIngresso(aluno, turma.anoLetivo)
    somar(ingresso, correcao.acertos, faixa)
    somar(aluno.sexo ?? 'sem_sexo', correcao.acertos, faixa)
    if (ingresso !== 'sem_ano') somar(`ha${Math.min(turma.anoLetivo - aluno.anoIngresso!, 4)}`, correcao.acertos, faixa)
  }
  return ag
}

/** O painel inteiro a partir dos dados do navegador (a demonstração tem tudo; a plataforma recebe pronto do banco). */
export function painelDosDados(db: Db): PainelRede {
  const turmas: AgregadoTurma[] = []
  for (const avaliacao of db.avaliacoes) {
    for (const caderno of db.cadernos.filter((c) => c.avaliacaoId === avaliacao.id)) {
      for (const turma of db.turmas.filter((t) => t.serie === caderno.serie && t.anoLetivo === avaliacao.anoLetivo)) {
        turmas.push(agregarTurma(db, caderno, turma))
      }
    }
  }
  const cadastros = db.turmas
    .filter((t) => t.anoLetivo === db.config.anoLetivo)
    .map((turma): CadastroTurma => {
      const alunos = alunosAtivos(db, turma.id)
      return {
        turma: turma.id,
        alunos: alunos.length,
        incompletos: alunos.filter((a) => camposFaltando(a).length).length,
        novos: alunos.filter((a) => a.anoIngresso === turma.anoLetivo).length,
        repetidas: iniciaisRepetidas(alunos).size > 0,
      }
    })
  return { anoLetivo: db.config.anoLetivo, cadastros, turmas }
}

// ------------------------------------------------------------------ as contas, a partir das somas

const validasDe = (caderno: Pick<Caderno, 'questoes'> | undefined) => caderno?.questoes.filter(questaoValida).length ?? 0

/** Para achar o caderno de cada soma. */
export type CadernoDe = (id: Id) => Caderno | undefined

/** Soma do percentual de acerto de cada aluno (cada prova tem o seu número de questões que contam). */
function somaPct(ag: Pick<AgregadoTurma, 'caderno'>, somaAcertos: number, cadernoDe: CadernoDe): number {
  const validas = validasDe(cadernoDe(ag.caderno))
  return validas ? (100 * somaAcertos) / validas : 0
}

export function participacaoAg(ags: AgregadoTurma[]): Participacao {
  const p: Participacao = { matriculados: 0, lancados: 0, avaliados: 0, faltas: 0, adaptadas: 0 }
  for (const ag of ags) {
    p.matriculados += ag.total
    p.lancados += ag.lancados
    p.avaliados += ag.avaliados
    p.faltas += ag.faltas
    p.adaptadas += ag.adaptadas
  }
  return p
}

export const avaliadosAg = (ags: AgregadoTurma[]) => ags.reduce((s, ag) => s + ag.avaliados, 0)

export function mediaAg(ags: AgregadoTurma[], cadernoDe: CadernoDe): number | null {
  const n = avaliadosAg(ags)
  return n ? ags.reduce((s, ag) => s + somaPct(ag, ag.somaAcertos, cadernoDe), 0) / n : null
}

export function faixasAg(ags: AgregadoTurma[]): Faixas {
  const f = zeros()
  for (const ag of ags) ag.faixas.forEach((v, i) => (f[i] += v))
  return f
}

/** Um grupo somado em várias turmas: alunos avaliados, média e faixas. */
export function grupoAg(ags: AgregadoTurma[], chave: string, cadernoDe: CadernoDe): { n: number; media: number | null; faixas: Faixas } {
  let n = 0
  let soma = 0
  const faixas = zeros()
  for (const ag of ags) {
    const g = ag.grupos[chave]
    if (!g) continue
    n += g.n
    soma += somaPct(ag, g.somaAcertos, cadernoDe)
    g.faixas.forEach((v, i) => (faixas[i] += v))
  }
  return { n, media: n ? soma / n : null, faixas }
}

export function resumoGruposAg(ags: AgregadoTurma[], cadernoDe: CadernoDe, anoLetivo: number | null): ResumoGrupos {
  const g = (chave: string) => {
    const { n, media } = grupoAg(ags, chave, cadernoDe)
    return { n, media }
  }
  return {
    anoLetivo,
    total: avaliadosAg(ags),
    novos: g('novos'),
    antigos: g('antigos'),
    F: g('F'),
    M: g('M'),
    semDado: g('sem_ano').n + g('sem_sexo').n,
  }
}

/** Percentual de acerto agrupado por uma característica da questão (disciplina, habilidade...), como desempenhoPor. */
export function desempenhoAg(ags: AgregadoTurma[], cadernoDe: CadernoDe, chaveDa: (q: Questao) => string | null): Desempenho[] {
  const mapa = new Map<string, { acertos: number; respostas: number; questoes: Set<string> }>()
  for (const ag of ags) {
    const caderno = cadernoDe(ag.caderno)
    if (!caderno || !ag.avaliados) continue
    caderno.questoes.forEach((q, i) => {
      if (!questaoValida(q)) return
      const chave = chaveDa(q)
      if (!chave) return
      let item = mapa.get(chave)
      if (!item) {
        item = { acertos: 0, respostas: 0, questoes: new Set() }
        mapa.set(chave, item)
      }
      item.respostas += ag.avaliados
      item.acertos += ag.questoes[i]?.acertos ?? 0
      item.questoes.add(`${caderno.id}:${i}`)
    })
  }
  return [...mapa].map(([chave, v]) => ({ chave, acertos: v.acertos, respostas: v.respostas, pct: (100 * v.acertos) / v.respostas, questoes: v.questoes.size }))
}

/**
 * Correlação entre acertar a questão (x = 0 ou 1) e os acertos no resto da prova (y = T − x), a partir das somas:
 * n, Σx, ΣxT, ΣT e ΣT². É a mesma conta de correlacao(), com Σx² = Σx e Σxy = ΣxT − Σx.
 */
export function correlacaoDeSomas(n: number, sx: number, sxT: number, sT: number, sT2: number): number | null {
  if (n < 2) return null
  const sy = sT - sx
  const sxy = sxT - sx
  const syy = sT2 - 2 * sxT + sx
  const nsxx = n * sx - sx * sx
  const nsyy = n * syy - sy * sy
  if (nsxx === 0 || nsyy === 0) return null
  return (n * sxy - sx * sy) / Math.sqrt(nsxx * nsyy)
}

/** A análise de cada questão de uma prova, somando as turmas (analisarQuestoes sobre as somas). */
export function analisarQuestoesAg(caderno: Caderno, ags: AgregadoTurma[]): AnaliseQuestao[] {
  const doCaderno = ags.filter((ag) => ag.caderno === caderno.id)
  const n = avaliadosAg(doCaderno)
  const sT = doCaderno.reduce((s, ag) => s + ag.somaAcertos, 0)
  const sT2 = doCaderno.reduce((s, ag) => s + ag.somaQuadrados, 0)
  return caderno.questoes.map((questao, indice) => {
    const contagem: Record<string, number> = {}
    let acertos = 0
    let comAcerto = 0
    for (const ag of doCaderno) {
      const q = ag.questoes[indice]
      if (!q) continue
      for (const [marca, qtd] of Object.entries(q.marcas)) contagem[marca] = (contagem[marca] ?? 0) + qtd
      acertos += q.acertos
      comAcerto += q.somaComAcerto
    }
    return analiseDaQuestao(questao, indice, n, contagem, acertos, correlacaoDeSomas(n, acertos, comAcerto, sT, sT2))
  })
}

/** Cada questão de uma prova, colégio por colégio (quadroColegioQuestao sobre as somas). */
export function quadroColegioQuestaoAg(
  caderno: Caderno,
  ags: AgregadoTurma[],
  colegios: Colegio[],
  colegioDaTurma: (turmaId: Id) => Id | undefined,
  minimo = MINIMO_QUADRO,
): LinhaQuadro[] {
  const doCaderno = ags.filter((ag) => ag.caderno === caderno.id)
  const acerto = (lista: AgregadoTurma[], indice: number) => {
    const n = avaliadosAg(lista)
    return { pct: n ? (100 * lista.reduce((s, ag) => s + (ag.questoes[indice]?.acertos ?? 0), 0)) / n : null, n }
  }
  return caderno.questoes.map((questao, indice) => {
    const valida = questaoValida(questao)
    const rede = valida ? acerto(doCaderno, indice).pct : null
    const mapa = new Map(
      colegios.map((c) => [c.id, valida ? acerto(doCaderno.filter((ag) => colegioDaTurma(ag.turma) === c.id), indice) : { pct: null, n: 0 }]),
    )
    return { indice, questao, rede, porColegio: mapa, leitura: leituraDaLinha([...mapa.values()], minimo) }
  })
}

/** O andamento de uma turma numa prova, como progressoDe. */
export function progressoAg(ag: AgregadoTurma | undefined): Progresso {
  if (!ag) return { status: 'nao_iniciado', total: 0, lancados: 0, faltas: 0, adaptadas: 0 }
  return {
    status: ag.concluidoEm ? 'concluido' : ag.comResposta ? 'em_andamento' : 'nao_iniciado',
    total: ag.total,
    lancados: ag.lancados,
    faltas: ag.faltas,
    adaptadas: ag.adaptadas,
  }
}

/** De que colégios são as respostas já lançadas numa prova: turmas e alunos com resposta, pelas somas da rede. */
export function respostasPorColegio(db: Db, ags: AgregadoTurma[], cadernoId: Id): RespostasDoColegio[] {
  const porColegio = new Map<Id, RespostasDoColegio>()
  for (const ag of ags) {
    if (ag.caderno !== cadernoId || !ag.comResposta) continue
    const colegioId = db.turmas.find((t) => t.id === ag.turma)?.colegioId
    if (!colegioId) continue
    const item = porColegio.get(colegioId) ?? { colegioId, nome: db.colegios.find((c) => c.id === colegioId)?.nome ?? 'Colégio', turmas: 0, alunos: 0 }
    item.turmas++
    item.alunos += ag.comResposta
    porColegio.set(colegioId, item)
  }
  return [...porColegio.values()].sort((a, b) => compararTexto(a.nome, b.nome))
}
