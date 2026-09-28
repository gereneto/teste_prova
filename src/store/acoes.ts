import type { Draft } from 'immer'
import { disciplinasDoCaderno, gerarDadosExemplo } from '../data/seed'
import { idLancamento } from '../lib/consultas'
import { agoraIso, compararTexto } from '../lib/formato'
import {
  LETRAS,
  VAZIO,
  type Caderno,
  type Colegio,
  type Contato,
  type Db,
  type Id,
  type Lancamento,
  type Letra,
  type Questao,
  type Serie,
  type Situacao,
  type Turma,
} from '../types'
import { apagarPdf, apagarTodosPdfs, salvarPdf } from './arquivos'
import { atualizar, getDb, substituirDados } from './db'

export function novoId(prefixo: string): Id {
  const sufixo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefixo}-${sufixo}`
}

// Colégios

export type DadosColegio = Omit<Colegio, 'id'>

export function criarColegio(dados: DadosColegio): Id {
  const id = novoId('col')
  atualizar((db) => {
    db.colegios.push({ id, ...dados })
  })
  return id
}

export function editarColegio(id: Id, dados: DadosColegio) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === id)
    if (colegio) Object.assign(colegio, dados)
  })
}

// Professores

export function criarProfessor(colegioId: Id, dados: Omit<Contato, 'telefone'>): Id {
  const id = novoId('prof')
  atualizar((db) => {
    db.professores.push({ id, colegioId, ...dados })
  })
  return id
}

export function editarProfessor(id: Id, dados: Omit<Contato, 'telefone'>) {
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id)
    if (professor) Object.assign(professor, dados)
  })
}

export function removerProfessor(id: Id) {
  atualizar((db) => {
    db.professores = db.professores.filter((p) => p.id !== id)
    for (const turma of db.turmas) turma.professorIds = turma.professorIds.filter((pid) => pid !== id)
  })
}

// Turmas

export type DadosTurma = Pick<Turma, 'serie' | 'nome' | 'turno' | 'professorIds'>

export function criarTurma(colegioId: Id, dados: DadosTurma): Id {
  const id = novoId('tur')
  atualizar((db) => {
    db.turmas.push({ id, colegioId, anoLetivo: new Date().getFullYear(), ...dados })
  })
  return id
}

export function editarTurma(id: Id, dados: DadosTurma) {
  atualizar((db) => {
    const turma = db.turmas.find((t) => t.id === id)
    if (turma) Object.assign(turma, dados)
  })
}

export function removerTurma(id: Id) {
  atualizar((db) => {
    db.turmas = db.turmas.filter((t) => t.id !== id)
    db.alunos = db.alunos.filter((a) => a.turmaId !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.turmaId !== id)
  })
}

// Alunos

/**
 * Lê nomes colados de uma planilha ou lista: um por linha. Ignora números de chamada
 * e colunas extras ("12  Maria Souza", "Maria Souza;3º ano") e linhas de cabeçalho.
 */
export function lerListaDeNomes(texto: string): string[] {
  const nomes: string[] = []
  for (const linha of texto.split(/\r?\n/)) {
    const celulas = linha.split(/\t|;/).map((c) => c.trim())
    const celula = celulas.find((c) => /\p{L}/u.test(c)) ?? ''
    const nome = celula
      .replace(/^\d+\s*[.)\-–]?\s*/, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (nome && !/^(nome|aluno|aluna|nome do aluno|estudante)s?$/i.test(nome)) nomes.push(nome)
  }
  return nomes
}

export function adicionarAlunos(turmaId: Id, nomes: string[]) {
  atualizar((db) => {
    let numero = Math.max(0, ...db.alunos.filter((a) => a.turmaId === turmaId && a.ativo).map((a) => a.numero))
    for (const nome of nomes) db.alunos.push({ id: novoId('alu'), turmaId, nome, numero: ++numero, ativo: true })
  })
}

export function editarAluno(id: Id, nome: string) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (aluno) aluno.nome = nome
  })
}

/** Quem já tem respostas lançadas só é desativado, para não sumir dos resultados anteriores. */
export function removerAluno(id: Id) {
  atualizar((db) => {
    if (db.lancamentos.some((l) => l.respostas[id])) {
      const aluno = db.alunos.find((a) => a.id === id)
      if (aluno) aluno.ativo = false
    } else {
      db.alunos = db.alunos.filter((a) => a.id !== id)
    }
  })
}

export function reativarAluno(id: Id) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    aluno.ativo = true
    aluno.numero = 1 + Math.max(0, ...db.alunos.filter((a) => a.turmaId === aluno.turmaId && a.ativo && a.id !== id).map((a) => a.numero))
  })
}

export function renumerarEmOrdemAlfabetica(turmaId: Id) {
  atualizar((db) => {
    db.alunos
      .filter((a) => a.turmaId === turmaId && a.ativo)
      .sort((a, b) => compararTexto(a.nome, b.nome))
      .forEach((aluno, i) => {
        aluno.numero = i + 1
      })
  })
}

// Avaliações e cadernos

export type DadosAvaliacao = Pick<Db['avaliacoes'][number], 'titulo' | 'aplicacaoInicio' | 'aplicacaoFim' | 'prazoLancamento'>

function cadernoEmBranco(avaliacaoId: Id, serie: Serie): Caderno {
  return {
    id: novoId('cad'),
    avaliacaoId,
    serie,
    numAlternativas: 4,
    usaFolhaRespostas: serie >= 3,
    questoes: disciplinasDoCaderno(serie).map((disciplina) => ({ gabarito: null, disciplina, habilidade: null, anulada: false })),
    pdf: null,
  }
}

export function criarAvaliacao(dados: DadosAvaliacao, series: Serie[]): Id {
  const id = novoId('av')
  atualizar((db) => {
    db.avaliacoes.push({ id, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)), ...dados })
    for (const serie of series) db.cadernos.push(cadernoEmBranco(id, serie))
  })
  return id
}

export function editarAvaliacao(id: Id, dados: DadosAvaliacao) {
  atualizar((db) => {
    const avaliacao = db.avaliacoes.find((a) => a.id === id)
    if (avaliacao) Object.assign(avaliacao, { ...dados, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)) })
  })
}

export function removerAvaliacao(id: Id) {
  const cadernos = getDb().cadernos.filter((c) => c.avaliacaoId === id).map((c) => c.id)
  atualizar((db) => {
    db.avaliacoes = db.avaliacoes.filter((a) => a.id !== id)
    db.cadernos = db.cadernos.filter((c) => c.avaliacaoId !== id)
    db.lancamentos = db.lancamentos.filter((l) => !cadernos.includes(l.cadernoId))
  })
  cadernos.forEach((c) => apagarPdf(c).catch(() => {}))
}

export function adicionarCaderno(avaliacaoId: Id, serie: Serie): Id {
  const caderno = cadernoEmBranco(avaliacaoId, serie)
  atualizar((db) => {
    db.cadernos.push(caderno)
  })
  return caderno.id
}

export function removerCaderno(id: Id) {
  atualizar((db) => {
    db.cadernos = db.cadernos.filter((c) => c.id !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.cadernoId !== id)
  })
  apagarPdf(id).catch(() => {})
}

function comCaderno(id: Id, alterar: (caderno: Draft<Caderno>) => void) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === id)
    if (caderno) alterar(caderno)
  })
}

export function definirAlternativas(id: Id, numAlternativas: 4 | 5) {
  comCaderno(id, (caderno) => {
    caderno.numAlternativas = numAlternativas
    const permitidas: readonly string[] = LETRAS.slice(0, numAlternativas)
    for (const q of caderno.questoes) if (q.gabarito && !permitidas.includes(q.gabarito)) q.gabarito = null
  })
}

export function definirFolhaRespostas(id: Id, usa: boolean) {
  comCaderno(id, (caderno) => {
    caderno.usaFolhaRespostas = usa
  })
}

export function definirNumeroDeQuestoes(id: Id, total: number) {
  comCaderno(id, (caderno) => {
    const ultima = caderno.questoes.at(-1)
    while (caderno.questoes.length < total) {
      caderno.questoes.push({ gabarito: null, disciplina: ultima?.disciplina ?? 'Português', habilidade: null, anulada: false })
    }
    caderno.questoes.splice(total)
  })
}

export function editarQuestao(cadernoId: Id, indice: number, alteracao: Partial<Questao>) {
  comCaderno(cadernoId, (caderno) => {
    const questao = caderno.questoes[indice]
    if (questao) Object.assign(questao, alteracao)
  })
}

/** Preenche o gabarito a partir de uma sequência como "BDACB..."; espaços e vírgulas são ignorados. */
export function aplicarGabarito(cadernoId: Id, letras: Letra[]) {
  comCaderno(cadernoId, (caderno) => {
    letras.slice(0, caderno.questoes.length).forEach((letra, i) => {
      caderno.questoes[i].gabarito = letra
    })
  })
}

export async function enviarPdf(cadernoId: Id, arquivo: File) {
  await salvarPdf(cadernoId, arquivo)
  comCaderno(cadernoId, (caderno) => {
    caderno.pdf = { nome: arquivo.name, tamanho: arquivo.size, origem: 'enviado', enviadoEm: agoraIso() }
  })
}

export function removerPdf(cadernoId: Id) {
  comCaderno(cadernoId, (caderno) => {
    caderno.pdf = null
  })
  apagarPdf(cadernoId).catch(() => {})
}

// Lançamento de respostas

function lancamentoPara(db: Draft<Db>, cadernoId: Id, turmaId: Id): Draft<Lancamento> {
  const id = idLancamento(cadernoId, turmaId)
  const existente = db.lancamentos.find((l) => l.id === id)
  if (existente) return existente
  const novo: Lancamento = { id, cadernoId, turmaId, respostas: {}, concluidoEm: null }
  db.lancamentos.push(novo)
  return novo
}

export function marcarQuestao(cadernoId: Id, turmaId: Id, alunoId: Id, indice: number, marca: string, totalQuestoes: number) {
  atualizar((db) => {
    const lancamento = lancamentoPara(db, cadernoId, turmaId)
    const resposta = (lancamento.respostas[alunoId] ??= { situacao: 'presente', marcas: '', atualizadoEm: '' })
    const marcas = resposta.marcas.padEnd(totalQuestoes, VAZIO).split('')
    marcas[indice] = marca
    resposta.marcas = marcas.join('')
    resposta.atualizadoEm = agoraIso()
  })
}

export function definirSituacao(cadernoId: Id, turmaId: Id, alunoId: Id, situacao: Situacao) {
  atualizar((db) => {
    const lancamento = lancamentoPara(db, cadernoId, turmaId)
    const resposta = (lancamento.respostas[alunoId] ??= { situacao, marcas: '', atualizadoEm: '' })
    resposta.situacao = situacao
    resposta.atualizadoEm = agoraIso()
  })
}

export function concluirLancamento(cadernoId: Id, turmaId: Id) {
  atualizar((db) => {
    lancamentoPara(db, cadernoId, turmaId).concluidoEm = agoraIso()
  })
}

// Configurações e dados

export function definirFaixas(faixas: [number, number, number]) {
  atualizar((db) => {
    db.config.faixas = faixas
  })
}

export async function restaurarDadosDeExemplo() {
  substituirDados(gerarDadosExemplo())
  await apagarTodosPdfs().catch(() => {})
}
