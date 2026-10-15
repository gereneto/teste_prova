import { Link, Navigate } from 'react-router'
import { Vazio } from '../../components/ui'
import { anoLetivoAtual, avaliacaoDaTurma, etapaAvaliacao } from '../../lib/consultas'
import { progressoDe } from '../../lib/estatisticas'
import { useTurmaDaRota } from './contexto'

/** Abre a turma na aba que faz mais sentido agora: lançar durante o lançamento, resultados depois. */
export default function TurmaInicio() {
  const contexto = useTurmaDaRota()
  if ('erro' in contexto) return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  const { db, perfil, turma, base } = contexto
  const prova = avaliacaoDaTurma(db, turma)
  if (!prova) return <Navigate to={`${base}/turma/${turma.id}/alunos`} replace />
  const resultados = `${base}/resultados/${prova.caderno.id}/${turma.id}`
  if (perfil.papel === 'solar' || turma.anoLetivo < anoLetivoAtual(db)) return <Navigate to={resultados} replace />
  const etapa = etapaAvaliacao(prova.avaliacao)
  if (etapa === 'agendada') return <Navigate to={`${base}/turma/${turma.id}/alunos`} replace />
  const concluido = progressoDe(db, prova.caderno, turma.id).status === 'concluido'
  return <Navigate to={concluido ? resultados : `${base}/lancar/${prova.caderno.id}/${turma.id}`} replace />
}
