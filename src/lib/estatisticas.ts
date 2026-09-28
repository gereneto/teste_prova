import {
  BRANCO,
  LETRAS,
  RASURA,
  VAZIO,
  type Aluno,
  type Caderno,
  type Colegio,
  type Config,
  type Db,
  type Id,
  type Lancamento,
  type Questao,
  type RespostaAluno,
  type Serie,
  type Situacao,
  type Turma,
} from '../types'
import { alunosDaTurma, lancamentoDe } from './consultas'

export const questaoValida = (q: Questao) => !q.anulada && q.gabarito !== null

export const marcaEm = (marcas: string, indice: number) => marcas[indice] ?? VAZIO

export type ResultadoQuestao = 'certa' | 'errada' | 'branco' | 'rasura' | 'vazia' | 'fora'

export interface Correcao {
  acertos: number
  /** Questões que contam: não anuladas e com gabarito definido. */
  validas: number
  pct: number
  porQuestao: ResultadoQuestao[]
}

export function corrigir(caderno: Pick<Caderno, 'questoes'>, marcas: string): Correcao {
  let acertos = 0
  let validas = 0
  const porQuestao = caderno.questoes.map((q, i): ResultadoQuestao => {
    if (!questaoValida(q)) return 'fora'
    validas++
    const marca = marcaEm(marcas, i)
    if (marca === q.gabarito) {
      acertos++
      return 'certa'
    }
    if (marca === BRANCO) return 'branco'
    if (marca === RASURA) return 'rasura'
    if (marca === VAZIO) return 'vazia'
    return 'errada'
  })
  return { acertos, validas, pct: validas ? (100 * acertos) / validas : 0, porQuestao }
}

/** Presente com todas as questões lançadas (as anuladas podem ficar vazias), ou marcado como falta ou prova adaptada. */
export function respostaCompleta(caderno: Pick<Caderno, 'questoes'>, resposta: RespostaAluno | undefined): boolean {
  if (!resposta) return false
  if (resposta.situacao !== 'presente') return true
  return caderno.questoes.every((q, i) => q.anulada || marcaEm(resposta.marcas, i) !== VAZIO)
}

export type StatusLancamento = 'nao_iniciado' | 'em_andamento' | 'concluido'

export interface Progresso {
  status: StatusLancamento
  total: number
  lancados: number
  faltas: number
  adaptadas: number
}

export function progressoDaTurma(caderno: Pick<Caderno, 'questoes'>, alunos: Aluno[], lancamento: Lancamento | undefined): Progresso {
  let lancados = 0
  let faltas = 0
  let adaptadas = 0
  let algum = false
  for (const aluno of alunos) {
    const resposta = lancamento?.respostas[aluno.id]
    if (!resposta) continue
    algum = true
    if (!respostaCompleta(caderno, resposta)) continue
    lancados++
    if (resposta.situacao === 'faltou') faltas++
    if (resposta.situacao === 'adaptada') adaptadas++
  }
  const status: StatusLancamento = lancamento?.concluidoEm ? 'concluido' : algum ? 'em_andamento' : 'nao_iniciado'
  return { status, total: alunos.length, lancados, faltas, adaptadas }
}

export function progressoDe(db: Db, caderno: Caderno, turmaId: Id): Progresso {
  const lancamento = lancamentoDe(db, caderno.id, turmaId)
  return progressoDaTurma(caderno, alunosDaTurma(db, turmaId, lancamento), lancamento)
}

export interface ResultadoAluno {
  aluno: Aluno
  turma: Turma
  colegio: Colegio
  caderno: Caderno
  /** null enquanto o aluno não foi lançado. */
  situacao: Situacao | null
  completo: boolean
  marcas: string
  /** Só para alunos presentes com todas as questões lançadas. */
  correcao: Correcao | null
}

export type ResultadoAvaliado = ResultadoAluno & { correcao: Correcao }

export interface FiltroResultados {
  avaliacaoId: Id
  serie?: Serie | null
  colegioId?: Id | null
  turmaId?: Id | null
}

export function coletarResultados(db: Db, filtro: FiltroResultados): ResultadoAluno[] {
  const avaliacao = db.avaliacoes.find((a) => a.id === filtro.avaliacaoId)
  if (!avaliacao) return []
  const colegios = new Map(db.colegios.map((c) => [c.id, c]))
  const saida: ResultadoAluno[] = []
  const cadernos = db.cadernos.filter((c) => c.avaliacaoId === avaliacao.id && (!filtro.serie || c.serie === filtro.serie))
  for (const caderno of cadernos) {
    const turmas = db.turmas.filter(
      (t) =>
        t.serie === caderno.serie &&
        t.anoLetivo === avaliacao.anoLetivo &&
        (!filtro.colegioId || t.colegioId === filtro.colegioId) &&
        (!filtro.turmaId || t.id === filtro.turmaId),
    )
    for (const turma of turmas) {
      const lancamento = lancamentoDe(db, caderno.id, turma.id)
      const colegio = colegios.get(turma.colegioId)
      if (!colegio) continue
      for (const aluno of alunosDaTurma(db, turma.id, lancamento)) {
        const resposta = lancamento?.respostas[aluno.id]
        const completo = respostaCompleta(caderno, resposta)
        saida.push({
          aluno,
          turma,
          colegio,
          caderno,
          situacao: resposta?.situacao ?? null,
          completo,
          marcas: resposta?.marcas ?? '',
          correcao: completo && resposta?.situacao === 'presente' ? corrigir(caderno, resposta.marcas) : null,
        })
      }
    }
  }
  return saida
}

export const avaliados = (resultados: ResultadoAluno[]) =>
  resultados.filter((r): r is ResultadoAvaliado => r.correcao !== null)

export function mediaPct(resultados: ResultadoAluno[]): number | null {
  const lista = avaliados(resultados)
  return lista.length ? lista.reduce((soma, r) => soma + r.correcao.pct, 0) / lista.length : null
}

export const NOMES_FAIXAS = ['Abaixo do básico', 'Básico', 'Adequado', 'Avançado'] as const
export type Faixa = 0 | 1 | 2 | 3

export function faixaDe(pct: number, config: Config): Faixa {
  const [basico, adequado, avancado] = config.faixas
  if (pct >= avancado) return 3
  if (pct >= adequado) return 2
  if (pct >= basico) return 1
  return 0
}

export function contarFaixas(resultados: ResultadoAluno[], config: Config): [number, number, number, number] {
  const contagem: [number, number, number, number] = [0, 0, 0, 0]
  for (const r of avaliados(resultados)) contagem[faixaDe(r.correcao.pct, config)]++
  return contagem
}

export interface Participacao {
  matriculados: number
  lancados: number
  avaliados: number
  faltas: number
  adaptadas: number
}

export function participacao(resultados: ResultadoAluno[]): Participacao {
  const p: Participacao = { matriculados: resultados.length, lancados: 0, avaliados: 0, faltas: 0, adaptadas: 0 }
  for (const r of resultados) {
    if (!r.completo) continue
    p.lancados++
    if (r.situacao === 'faltou') p.faltas++
    else if (r.situacao === 'adaptada') p.adaptadas++
    else p.avaliados++
  }
  return p
}

export function agruparPor<K>(resultados: ResultadoAluno[], chave: (r: ResultadoAluno) => K): Map<K, ResultadoAluno[]> {
  const grupos = new Map<K, ResultadoAluno[]>()
  for (const r of resultados) {
    const k = chave(r)
    const grupo = grupos.get(k)
    if (grupo) grupo.push(r)
    else grupos.set(k, [r])
  }
  return grupos
}

export type AlertaQuestao = 'gabarito_suspeito' | 'muito_dificil' | 'muito_facil'

export interface AnaliseQuestao {
  indice: number
  questao: Questao
  n: number
  pctAcerto: number | null
  /** Quantos alunos marcaram cada letra, em branco ou rasurada. */
  contagem: Record<string, number>
  erroMaisComum: { marca: string; pct: number } | null
  /** Correlação entre acertar a questão e ir bem no resto da prova (ponto-bisserial). */
  discriminacao: number | null
  alertas: AlertaQuestao[]
}

/** Abaixo disso, os alertas por questão seriam ruído. */
export const MINIMO_PARA_ALERTAS = 30

export function analisarQuestoes(caderno: Caderno, resultados: ResultadoAluno[]): AnaliseQuestao[] {
  const doCaderno = avaliados(resultados).filter((r) => r.caderno.id === caderno.id)
  const n = doCaderno.length
  return caderno.questoes.map((questao, indice) => {
    const contagem: Record<string, number> = {}
    for (const r of doCaderno) {
      const marca = marcaEm(r.marcas, indice)
      contagem[marca] = (contagem[marca] ?? 0) + 1
    }
    if (!questaoValida(questao) || n === 0) {
      return { indice, questao, n, pctAcerto: null, contagem, erroMaisComum: null, discriminacao: null, alertas: [] }
    }
    const acertou: number[] = doCaderno.map((r) => (r.correcao.porQuestao[indice] === 'certa' ? 1 : 0))
    const resto = doCaderno.map((r, k) => r.correcao.acertos - acertou[k])
    const acertos = acertou.reduce((soma, v) => soma + v, 0)
    const pctAcerto = (100 * acertos) / n

    let maisMarcada: { marca: string; qtd: number } | null = null
    for (const letra of LETRAS.slice(0, caderno.numAlternativas)) {
      const qtd = contagem[letra] ?? 0
      if (letra !== questao.gabarito && qtd > 0 && (!maisMarcada || qtd > maisMarcada.qtd)) maisMarcada = { marca: letra, qtd }
    }

    const discriminacao = correlacao(acertou, resto)
    const alertas: AlertaQuestao[] = []
    if (n >= MINIMO_PARA_ALERTAS) {
      // Quem vai bem no resto da prova erra esta questão, e uma alternativa errada é mais marcada que a do gabarito.
      const outraMaisMarcada = maisMarcada !== null && maisMarcada.qtd > acertos
      if (discriminacao !== null && discriminacao < -0.05 && outraMaisMarcada) alertas.push('gabarito_suspeito')
      if (pctAcerto < 20) alertas.push('muito_dificil')
      if (pctAcerto > 95) alertas.push('muito_facil')
    }
    return {
      indice,
      questao,
      n,
      pctAcerto,
      contagem,
      erroMaisComum: maisMarcada && { marca: maisMarcada.marca, pct: (100 * maisMarcada.qtd) / n },
      discriminacao,
      alertas,
    }
  })
}

export function correlacao(x: number[], y: number[]): number | null {
  const n = x.length
  if (n < 2) return null
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx
    const dy = y[i] - my
    sxy += dx * dy
    sxx += dx * dx
    syy += dy * dy
  }
  if (sxx === 0 || syy === 0) return null
  return sxy / Math.sqrt(sxx * syy)
}

export interface Desempenho {
  chave: string
  acertos: number
  respostas: number
  pct: number
  questoes: number
}

/** Percentual de acerto agrupado por uma característica da questão (disciplina, habilidade...). */
export function desempenhoPor(resultados: ResultadoAluno[], chaveDa: (q: Questao) => string | null): Desempenho[] {
  const mapa = new Map<string, { acertos: number; respostas: number; questoes: Set<string> }>()
  for (const r of avaliados(resultados)) {
    r.caderno.questoes.forEach((q, i) => {
      const resultado = r.correcao.porQuestao[i]
      if (resultado === 'fora') return
      const chave = chaveDa(q)
      if (!chave) return
      let item = mapa.get(chave)
      if (!item) {
        item = { acertos: 0, respostas: 0, questoes: new Set() }
        mapa.set(chave, item)
      }
      item.respostas++
      if (resultado === 'certa') item.acertos++
      item.questoes.add(`${r.caderno.id}:${i}`)
    })
  }
  return [...mapa].map(([chave, v]) => ({
    chave,
    acertos: v.acertos,
    respostas: v.respostas,
    pct: (100 * v.acertos) / v.respostas,
    questoes: v.questoes.size,
  }))
}
