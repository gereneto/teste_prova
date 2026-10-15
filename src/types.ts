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
}

/** Pessoa da coordenação de um colégio. Só uma é a responsável, e é ela quem cadastra as demais. */
export interface Coordenador extends Contato {
  id: Id
  colegioId: Id
  responsavel: boolean
}

export interface Professor {
  id: Id
  colegioId: Id
  nome: string
  email: string
  /** Quem saiu do colégio fica desativado, para o nome continuar no histórico. */
  ativo: boolean
}

/** Na equipe Solar, uma pessoa é a responsável e define quem pode editar e quem só visualiza. */
export type PapelSolar = 'responsavel' | 'edicao' | 'visualizacao'

export interface MembroSolar extends Contato {
  id: Id
  papel: PapelSolar
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

export type MotivoSaida = 'transferencia' | 'mudou_de_cidade' | 'concluiu' | 'outro'

export interface Aluno {
  id: Id
  turmaId: Id
  /** Só as iniciais, como "A.C.S.": o site não guarda o nome completo. */
  iniciais: string
  /** Número de chamada, o mesmo do diário da escola. É ele que liga a prova em papel ao aluno no site. */
  numero: number
  /** Ano em que entrou no colégio (null = não informado). Separa alunos novos e antigos nos resultados. */
  anoIngresso: number | null
  ativo: boolean
  /** Incluído a pedido de um professor e ainda não confirmado pela coordenação. */
  pendente?: boolean
  saida?: { em: string; motivo: MotivoSaida }
}

/** A avaliação anual: uma prova para cada ano do Fundamental I. */
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
  /** O que cada alternativa errada costuma indicar, escrito pela equipe pedagógica da Solar. */
  comentarios?: Partial<Record<Letra, string>>
  /** Como retomar o conteúdo com a turma. */
  comoRetomar?: string
}

export interface PdfCaderno {
  nome: string
  tamanho: number
  origem: 'exemplo' | 'enviado'
  /** Caminho do arquivo de exemplo; PDFs enviados ficam no IndexedDB do navegador. */
  url?: string
  enviadoEm: string
}

/** A prova de um ano dentro de uma avaliação. No código continua "caderno"; nas telas é "a prova do 3º ano". */
export interface Caderno {
  id: Id
  avaliacaoId: Id
  serie: Serie
  numAlternativas: 4 | 5
  usaFolhaRespostas: boolean
  questoes: Questao[]
  pdf: PdfCaderno | null
  /** Quem conferiu o gabarito com a prova impressa. Mudar o gabarito ou anular uma questão desfaz a conferência. */
  conferencia?: { por: string; em: string } | null
}

export type Situacao = 'presente' | 'faltou' | 'adaptada'

export interface RespostaAluno {
  situacao: Situacao
  marcas: string
  atualizadoEm: string
  /** Número de chamada do aluno nesta turma quando a prova foi lançada (ele pode mudar de turma depois). */
  numero?: number
}

/** As respostas de uma turma para uma prova. */
export interface Lancamento {
  id: Id
  cadernoId: Id
  turmaId: Id
  respostas: Record<Id, RespostaAluno>
  concluidoEm: string | null
}

export type TipoPedido = 'incluir' | 'saida' | 'correcao'
export type SituacaoPedido = 'pendente' | 'aprovado' | 'recusado' | 'cancelado'

/** Mudança na lista de alunos pedida por um professor. Só vale depois que a coordenação aprova. */
export interface Pedido {
  id: Id
  tipo: TipoPedido
  colegioId: Id
  turmaId: Id
  alunoId: Id
  professorId: Id
  criadoEm: string
  /** Inclusão e correção: os dados propostos. */
  iniciais?: string
  numero?: number
  anoIngresso?: number | null
  /** Saída: o motivo. */
  motivoSaida?: MotivoSaida
  situacao: SituacaoPedido
  decisao?: { por: string; em: string; motivo?: string }
}

/** Uma linha do histórico de alterações, escrita em frase. */
export interface Evento {
  id: Id
  em: string
  por: string
  colegioId: Id | null
  turmaId: Id | null
  cadernoId: Id | null
  texto: string
  /** Mudança na correção de uma prova: aparece como aviso nos resultados das turmas daquele ano. */
  avisarTurmas?: boolean
}

export interface Config {
  /** Percentual mínimo de acertos para Básico, Adequado e Avançado. */
  faixas: [number, number, number]
  /** Ano letivo em curso: as turmas deste ano são as que aparecem para cadastro e lançamento. */
  anoLetivo: number
}

export interface Db {
  versao: number
  colegios: Colegio[]
  coordenadores: Coordenador[]
  professores: Professor[]
  equipeSolar: MembroSolar[]
  turmas: Turma[]
  alunos: Aluno[]
  avaliacoes: Avaliacao[]
  cadernos: Caderno[]
  lancamentos: Lancamento[]
  pedidos: Pedido[]
  historico: Evento[]
  config: Config
}

export type Perfil =
  | { papel: 'solar'; membroId: Id }
  | { papel: 'coordenacao'; colegioId: Id; coordenadorId: Id }
  | { papel: 'professor'; colegioId: Id; professorId: Id }
