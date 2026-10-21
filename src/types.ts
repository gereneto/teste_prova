export type Id = string

export type Serie = 1 | 2 | 3 | 4 | 5
export const SERIES: Serie[] = [1, 2, 3, 4, 5]

export type Turno = 'Manhã' | 'Tarde' | 'Integral'
export const TURNOS: Turno[] = ['Manhã', 'Tarde', 'Integral']

/** Toda questão tem estas 4 alternativas (2026-10-21: nada de quinta alternativa). */
export const LETRAS = ['A', 'B', 'C', 'D'] as const
export type Letra = (typeof LETRAS)[number]

/**
 * Cada disciplina tem um caderno próprio (decisão de 2026-10-19). Por enquanto a prova é só de Português
 * (2026-10-21): com uma disciplina só, as telas não mostram a escolha da prova nem a comparação entre disciplinas.
 * O banco aceita as duas, e a carga deixa de fora os cadernos de disciplinas que não estão aqui.
 */
export type Disciplina = 'Português' | 'Matemática'
export const DISCIPLINAS_DA_PROVA: Disciplina[] = ['Português']
export const VARIAS_DISCIPLINAS = DISCIPLINAS_DA_PROVA.length > 1

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

/**
 * Quem entra no site. O link de acesso enviado por e-mail leva o token e não expira;
 * mudar o e-mail da pessoa gera um token novo, e o link antigo deixa de valer.
 */
interface ComAcesso {
  token: string
}

export interface Colegio {
  id: Id
  nome: string
  cidade: string
  uf: string
  /** Pessoa da equipe Solar que cuida do colégio e define quem é o responsável pela coordenação. */
  membroSolarId: Id | null
}

/** Pessoa da coordenação de um colégio. Só uma é a responsável, e é ela quem cadastra as demais. */
export interface Coordenador extends Contato, ComAcesso {
  id: Id
  colegioId: Id
  responsavel: boolean
}

export interface Professor extends ComAcesso {
  id: Id
  colegioId: Id
  nome: string
  email: string
  /** Quem saiu do colégio fica desativado, para o nome continuar no histórico. */
  ativo: boolean
}

/** Na equipe Solar, uma pessoa é a responsável e define quem pode editar e quem só visualiza. */
export type PapelSolar = 'responsavel' | 'edicao' | 'visualizacao'

export interface MembroSolar extends Contato, ComAcesso {
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

export type Sexo = 'M' | 'F'

export type MotivoSaida = 'transferencia' | 'mudou_de_cidade' | 'concluiu' | 'outro'

/** Os campos podem ficar em branco: o site lembra depois que falta preencher. */
export interface Aluno {
  id: Id
  turmaId: Id
  /** Número (ou código) de chamada, como o colégio usa. É ele que liga a prova em papel ao aluno no site. */
  numero: string
  /** Só as iniciais, em maiúsculas e sem pontos, como "ACS": o site não guarda o nome completo. */
  iniciais: string
  sexo: Sexo | null
  /** Ano em que entrou no colégio (null = não informado). Separa alunos novos e antigos nos resultados. */
  anoIngresso: number | null
  ativo: boolean
  saida?: { em: string; motivo: MotivoSaida }
}

/** A avaliação anual: para cada ano do Fundamental I, uma prova de cada disciplina (por enquanto, só Português). */
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

/**
 * A prova de um ano e uma disciplina dentro de uma avaliação. No código continua "caderno"; nas telas é
 * "a prova de Português do 3º ano". Todas as questões são da disciplina do caderno e têm as 4 alternativas de LETRAS.
 */
export interface Caderno {
  id: Id
  avaliacaoId: Id
  serie: Serie
  disciplina: Disciplina
  /** Só o 5º ano marca numa folha de respostas separada; os demais marcam na própria prova. */
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
  numero?: string
}

/** As respostas de uma turma para uma prova. */
export interface Lancamento {
  id: Id
  cadernoId: Id
  turmaId: Id
  respostas: Record<Id, RespostaAluno>
  concluidoEm: string | null
}

export type TipoMudancaAluno = 'inclusao' | 'correcao' | 'saida' | 'volta' | 'exclusao' | 'mudanca_turma'

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
  /** Mudança feita por um professor na lista de alunos: a coordenação é avisada e marca que está ciente. */
  avisarCoordenacao?: boolean
  ciente?: { por: string; em: string }
  /** Para juntar num aviso só as várias mudanças que um professor faz no mesmo aluno no mesmo dia. */
  alunoId?: Id
  tipo?: TipoMudancaAluno
  campos?: Record<string, { de: string; para: string }>
}

/** E-mail com o link de acesso. Nesta versão de teste o envio é simulado: o e-mail fica guardado aqui. */
export interface Email {
  id: Id
  enviadoEm: string
  para: string
  nome: string
  assunto: string
  texto: string
  token: string
}

export interface Config {
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
  historico: Evento[]
  emails: Email[]
  config: Config
}

export type Perfil =
  | { papel: 'solar'; membroId: Id }
  | { papel: 'coordenacao'; colegioId: Id; coordenadorId: Id }
  | { papel: 'professor'; colegioId: Id; professorId: Id }
