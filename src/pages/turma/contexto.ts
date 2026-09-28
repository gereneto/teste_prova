import { useParams } from 'react-router'
import { INICIO_DO_PAPEL } from '../../components/Layout'
import { alunosDaTurma, lancamentoDe, podeVerTurma } from '../../lib/consultas'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Aluno, Avaliacao, Caderno, Colegio, Db, Lancamento, Perfil, Turma } from '../../types'

export interface ContextoTurma {
  db: Db
  perfil: Perfil
  caderno: Caderno
  avaliacao: Avaliacao
  turma: Turma
  colegio: Colegio
  lancamento: Lancamento | undefined
  alunos: Aluno[]
  /** Início da área do perfil atual, para os links de volta. */
  base: string
}

/** Dados de uma turma numa prova, a partir de /…/:cadernoId/:turmaId, já conferindo o acesso. */
export function useContextoTurma(): ContextoTurma | { erro: string; base: string } {
  const { cadernoId = '', turmaId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const base = perfil ? INICIO_DO_PAPEL[perfil.papel] : '/'
  const caderno = db.cadernos.find((c) => c.id === cadernoId)
  const avaliacao = caderno && db.avaliacoes.find((a) => a.id === caderno.avaliacaoId)
  const turma = db.turmas.find((t) => t.id === turmaId)
  const colegio = turma && db.colegios.find((c) => c.id === turma.colegioId)
  if (!perfil || !caderno || !avaliacao || !turma || !colegio || caderno.serie !== turma.serie) {
    return { erro: 'Esta turma ou esta prova não existe mais.', base }
  }
  if (!podeVerTurma(perfil, turma)) return { erro: 'Você não tem acesso a esta turma.', base }
  const lancamento = lancamentoDe(db, caderno.id, turma.id)
  return { db, perfil, caderno, avaliacao, turma, colegio, lancamento, alunos: alunosDaTurma(db, turma.id, lancamento), base }
}
