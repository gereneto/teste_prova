import type { Aluno, Avaliacao, Caderno, Db, Id, Lancamento, Perfil, Serie, Turma } from '../types'
import { hojeIso, ordenarTurmas } from './formato'

export const idLancamento = (cadernoId: Id, turmaId: Id) => `${cadernoId}__${turmaId}`

export function lancamentoDe(db: Db, cadernoId: Id, turmaId: Id): Lancamento | undefined {
  const id = idLancamento(cadernoId, turmaId)
  return db.lancamentos.find((l) => l.id === id)
}

/** Alunos ativos da turma, mais os que saíram mas já têm respostas neste lançamento. */
export function alunosDaTurma(db: Db, turmaId: Id, lancamento?: Lancamento): Aluno[] {
  return db.alunos
    .filter((a) => a.turmaId === turmaId && (a.ativo || lancamento?.respostas[a.id]))
    .sort((a, b) => a.numero - b.numero)
}

export function turmasDoColegio(db: Db, colegioId: Id): Turma[] {
  return ordenarTurmas(db.turmas.filter((t) => t.colegioId === colegioId))
}

export function turmasDoProfessor(db: Db, professorId: Id): Turma[] {
  return ordenarTurmas(db.turmas.filter((t) => t.professorIds.includes(professorId)))
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

export function podeVerTurma(perfil: Perfil, turma: Turma): boolean {
  if (perfil.papel === 'solar') return true
  if (perfil.papel === 'coordenacao') return turma.colegioId === perfil.colegioId
  return turma.professorIds.includes(perfil.professorId)
}
