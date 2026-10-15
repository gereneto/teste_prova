import type { Aluno, Avaliacao, Caderno, Coordenador, Db, Id, Lancamento, MembroSolar, Perfil, Professor, Serie, Turma } from '../types'
import { dataCurta, hojeIso, ordenarTurmas } from './formato'

export const idLancamento = (cadernoId: Id, turmaId: Id) => `${cadernoId}__${turmaId}`

export function lancamentoDe(db: Db, cadernoId: Id, turmaId: Id): Lancamento | undefined {
  const id = idLancamento(cadernoId, turmaId)
  return db.lancamentos.find((l) => l.id === id)
}

/**
 * Os alunos de uma turma numa prova: os que estão nela hoje, mais quem já tem respostas lançadas
 * nesta turma (saiu, mudou de turma ou é de um ano anterior). Esses aparecem com o número de chamada
 * que tinham quando a prova foi lançada. Quem chegou de outra turma e já fez a prova lá fica de fora.
 */
export function alunosDaTurma(db: Db, turmaId: Id, lancamento?: Lancamento): Aluno[] {
  const respostas = lancamento?.respostas ?? {}
  const avaliadosEmOutraTurma = new Set<Id>()
  if (lancamento) {
    for (const outro of db.lancamentos) {
      if (outro.cadernoId === lancamento.cadernoId && outro.turmaId !== turmaId) Object.keys(outro.respostas).forEach((id) => avaliadosEmOutraTurma.add(id))
    }
  }
  const lista: Aluno[] = []
  for (const aluno of db.alunos) {
    const resposta = respostas[aluno.id]
    if (resposta) {
      const numero = aluno.turmaId === turmaId && aluno.ativo ? aluno.numero : (resposta.numero ?? aluno.numero)
      lista.push(numero === aluno.numero ? aluno : { ...aluno, numero })
    } else if (aluno.turmaId === turmaId && aluno.ativo && !avaliadosEmOutraTurma.has(aluno.id)) {
      lista.push(aluno)
    }
  }
  return lista.sort((a, b) => a.numero - b.numero)
}

/** Alunos que estão na turma hoje, inclusive os que aguardam a confirmação da coordenação. */
export const alunosAtivos = (db: Db, turmaId: Id) =>
  db.alunos.filter((a) => a.turmaId === turmaId && a.ativo).sort((a, b) => a.numero - b.numero)

export const anoLetivoAtual = (db: Db) => db.config.anoLetivo

/** Turmas do colégio no ano letivo em curso (ou no ano pedido). */
export function turmasDoColegio(db: Db, colegioId: Id, anoLetivo = anoLetivoAtual(db)): Turma[] {
  return ordenarTurmas(db.turmas.filter((t) => t.colegioId === colegioId && t.anoLetivo === anoLetivo))
}

export const turmasDoAno = (db: Db, anoLetivo = anoLetivoAtual(db)) => db.turmas.filter((t) => t.anoLetivo === anoLetivo)

/** Turmas do professor no ano letivo em curso. */
export function turmasDoProfessor(db: Db, professorId: Id): Turma[] {
  return ordenarTurmas(db.turmas.filter((t) => t.professorIds.includes(professorId) && t.anoLetivo === anoLetivoAtual(db)))
}

/** Turmas que o professor teve em anos anteriores, da mais recente para a mais antiga. */
export function turmasAnterioresDoProfessor(db: Db, professorId: Id): Turma[] {
  return ordenarTurmas(db.turmas.filter((t) => t.professorIds.includes(professorId) && t.anoLetivo < anoLetivoAtual(db))).sort(
    (a, b) => b.anoLetivo - a.anoLetivo,
  )
}

export function nomesProfessores(db: Db, turma: Turma): string {
  const nomes = turma.professorIds.map((id) => db.professores.find((p) => p.id === id)?.nome).filter(Boolean)
  return nomes.length ? nomes.join(', ') : 'Sem professor'
}

/** Da mais recente para a mais antiga. */
export function avaliacoesOrdenadas(db: Db): Avaliacao[] {
  return [...db.avaliacoes].sort((a, b) => b.aplicacaoInicio.localeCompare(a.aplicacaoInicio))
}

export function cadernosDaAvaliacao(db: Db, avaliacaoId: Id): Caderno[] {
  return db.cadernos.filter((c) => c.avaliacaoId === avaliacaoId).sort((a, b) => a.serie - b.serie)
}

export function cadernoDaSerie(db: Db, avaliacaoId: Id, serie: Serie): Caderno | undefined {
  return db.cadernos.find((c) => c.avaliacaoId === avaliacaoId && c.serie === serie)
}

/** A avaliação do ano letivo da turma (a prova que ela faz), se houver. */
export function avaliacaoDaTurma(db: Db, turma: Turma): { avaliacao: Avaliacao; caderno: Caderno } | null {
  for (const avaliacao of avaliacoesOrdenadas(db)) {
    if (avaliacao.anoLetivo !== turma.anoLetivo) continue
    const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
    if (caderno) return { avaliacao, caderno }
  }
  return null
}

export type EtapaAvaliacao = 'agendada' | 'aplicacao' | 'lancamento' | 'encerrada'

export function etapaAvaliacao(avaliacao: Avaliacao, hoje = hojeIso()): EtapaAvaliacao {
  if (hoje < avaliacao.aplicacaoInicio) return 'agendada'
  if (hoje <= avaliacao.aplicacaoFim) return 'aplicacao'
  if (hoje <= avaliacao.prazoLancamento) return 'lancamento'
  return 'encerrada'
}

/** A avaliação em aplicação ou lançamento hoje; se não houver, a última que já começou. */
export function avaliacaoAtual(db: Db): Avaliacao | null {
  const ordenadas = avaliacoesOrdenadas(db)
  return (
    ordenadas.find((a) => ['aplicacao', 'lancamento'].includes(etapaAvaliacao(a))) ??
    ordenadas.find((a) => etapaAvaliacao(a) === 'encerrada') ??
    ordenadas.at(-1) ??
    null
  )
}

/** A avaliação do ano letivo anterior ao da avaliação dada. */
export function avaliacaoAnterior(db: Db, avaliacao: Avaliacao): Avaliacao | null {
  return avaliacoesOrdenadas(db).find((a) => a.anoLetivo === avaliacao.anoLetivo - 1) ?? null
}

export function podeVerTurma(perfil: Perfil, turma: Turma): boolean {
  if (perfil.papel === 'solar') return true
  if (perfil.papel === 'coordenacao') return turma.colegioId === perfil.colegioId
  return turma.professorIds.includes(perfil.professorId)
}

// Pessoas

export const equipeDoColegio = (db: Db, colegioId: Id): Coordenador[] =>
  db.coordenadores.filter((c) => c.colegioId === colegioId).sort((a, b) => Number(b.responsavel) - Number(a.responsavel))

/** Quem responde pela coordenação do colégio: o responsável ou, se não houver, a primeira pessoa da equipe. */
export const contatoDoColegio = (db: Db, colegioId: Id): Coordenador | null => equipeDoColegio(db, colegioId)[0] ?? null

export const responsavelSolar = (db: Db): MembroSolar | null => db.equipeSolar.find((m) => m.papel === 'responsavel') ?? null

export type Pessoa =
  | { papel: 'professor'; nome: string; professor: Professor }
  | { papel: 'coordenacao'; nome: string; coordenador: Coordenador }
  | { papel: 'solar'; nome: string; membro: MembroSolar }

/** Quem está usando o site; null se a pessoa não existe mais nos dados. */
export function pessoaDoPerfil(db: Db, perfil: Perfil): Pessoa | null {
  if (perfil.papel === 'professor') {
    const professor = db.professores.find((p) => p.id === perfil.professorId)
    return professor ? { papel: 'professor', nome: professor.nome, professor } : null
  }
  if (perfil.papel === 'coordenacao') {
    const coordenador = db.coordenadores.find((c) => c.id === perfil.coordenadorId && c.colegioId === perfil.colegioId)
    return coordenador ? { papel: 'coordenacao', nome: coordenador.nome, coordenador } : null
  }
  const membro = db.equipeSolar.find((m) => m.id === perfil.membroId)
  return membro ? { papel: 'solar', nome: membro.nome, membro } : null
}

export interface Permissoes {
  /** Colégios, provas, gabaritos e faixas (equipe Solar com edição). */
  editarRede: boolean
  /** Quem da Solar edita e quem só visualiza (só a pessoa responsável). */
  gerirEquipeSolar: boolean
  /** Turmas, professores, alunos e pedidos do colégio (coordenação). */
  editarColegio: boolean
  /** Quem mais faz parte da coordenação (só a pessoa responsável). */
  gerirEquipeColegio: boolean
}

export function permissoesDe(pessoa: Pessoa | null): Permissoes {
  return {
    editarRede: pessoa?.papel === 'solar' && pessoa.membro.papel !== 'visualizacao',
    gerirEquipeSolar: pessoa?.papel === 'solar' && pessoa.membro.papel === 'responsavel',
    editarColegio: pessoa?.papel === 'coordenacao',
    gerirEquipeColegio: pessoa?.papel === 'coordenacao' && pessoa.coordenador.responsavel,
  }
}

export const pedidosPendentes = (db: Db, colegioId?: Id) =>
  db.pedidos.filter((p) => p.situacao === 'pendente' && (!colegioId || p.colegioId === colegioId))

/** "Aplicação de 05/10 a 09/10 · lançamento até 30/10" */
export function descreverPeriodo(avaliacao: Avaliacao): string {
  const aplicacao = `Aplicação de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}`
  if (etapaAvaliacao(avaliacao) === 'encerrada') return `${aplicacao} · prazo de lançamento encerrado em ${dataCurta(avaliacao.prazoLancamento)}`
  return `${aplicacao} · lançamento até ${dataCurta(avaliacao.prazoLancamento)}`
}
