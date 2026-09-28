export type Id = string

export type Serie = 1 | 2 | 3 | 4 | 5
export const SERIES: Serie[] = [1, 2, 3, 4, 5]

export type Turno = 'Manhã' | 'Tarde' | 'Integral'
export const TURNOS: Turno[] = ['Manhã', 'Tarde', 'Integral']

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const
export type Letra = (typeof LETRAS)[number]

// Cada questão lançada vira um caractere na string `marcas` da resposta do aluno:
// uma letra, em branco, rasurada (mais de uma marcada) ou ainda não lançada.
export const BRANCO = '-'
export const RASURA = '*'
export const VAZIO = ' '

export interface Contato {
  nome: string
  email: string
  telefone: string
}

export interface Colegio {
  id: Id
  nome: string
  cidade: string
  uf: string
  coordenacao: Contato
}

export interface Professor {
  id: Id
  colegioId: Id
  nome: string
  email: string
}

export interface Turma {
  id: Id
  colegioId: Id
  anoLetivo: number
  serie: Serie
  nome: string
  turno: Turno
  professorIds: Id[]
}

export interface Aluno {
  id: Id
  turmaId: Id
  nome: string
  numero: number
  /** Ano em que entrou no colégio (null = não informado). Separa alunos novos e antigos nos resultados. */
  anoIngresso: number | null
  ativo: boolean
}

/** Um ciclo de aplicação (ex.: avaliação do 3º bimestre), com um caderno para cada ano. */
export interface Avaliacao {
  id: Id
  titulo: string
  anoLetivo: number
  aplicacaoInicio: string
  aplicacaoFim: string
  prazoLancamento: string
}

export interface Questao {
  gabarito: Letra | null
  disciplina: string
  habilidade: string | null
  anulada: boolean
}

export interface PdfCaderno {
  nome: string
  tamanho: number
  origem: 'exemplo' | 'enviado'
  /** Caminho do arquivo de exemplo; PDFs enviados ficam no IndexedDB do navegador. */
  url?: string
  enviadoEm: string
}

/** A prova de um ano dentro de uma avaliação. */
export interface Caderno {
  id: Id
  avaliacaoId: Id
  serie: Serie
  numAlternativas: 4 | 5
  usaFolhaRespostas: boolean
  questoes: Questao[]
  pdf: PdfCaderno | null
}

export type Situacao = 'presente' | 'faltou' | 'adaptada'

export interface RespostaAluno {
  situacao: Situacao
  marcas: string
  atualizadoEm: string
}

/** As respostas de uma turma para um caderno. */
export interface Lancamento {
  id: Id
  cadernoId: Id
  turmaId: Id
  respostas: Record<Id, RespostaAluno>
  concluidoEm: string | null
}

export interface Config {
  /** Percentual mínimo de acertos para Básico, Adequado e Avançado. */
  faixas: [number, number, number]
}

export interface Db {
  versao: number
  colegios: Colegio[]
  professores: Professor[]
  turmas: Turma[]
  alunos: Aluno[]
  avaliacoes: Avaliacao[]
  cadernos: Caderno[]
  lancamentos: Lancamento[]
  config: Config
}

export type Perfil =
  | { papel: 'solar' }
  | { papel: 'coordenacao'; colegioId: Id }
  | { papel: 'professor'; colegioId: Id; professorId: Id }
