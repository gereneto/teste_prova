import { Link, Navigate } from 'react-router'
import { Vazio } from '../../components/ui'
import { anoLetivoAtual, avaliacaoDaTurma, etapaAvaliacao } from '../../lib/consultas'
import { progressoDe } from '../../lib/estatisticas'
import { useTurmaDaRota } from './contexto'

/**
 * Abre a turma na aba que faz mais sentido agora: lançar durante o lançamento (a primeira prova, na ordem das
 * disciplinas, que ainda não foi concluída), resultados depois.
 */
export default function TurmaInicio() {
  const contexto = useTurmaDaRota()
  if ('erro' in contexto) return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  const { db, perfil, turma, base } = contexto
  const prova = avaliacaoDaTurma(db, turma)
  if (!prova) return <Navigate to={`${base}/turma/${turma.id}/alunos`} replace />
  const resultados = `${base}/resultados/${prova.cadernos[0].id}/${turma.id}`
  if (perfil.papel === 'solar' || turma.anoLetivo < anoLetivoAtual(db)) return <Navigate to={resultados} replace />
  const etapa = etapaAvaliacao(prova.avaliacao)
  if (etapa === 'agendada') return <Navigate to={`${base}/turma/${turma.id}/alunos`} replace />
  const pendente = prova.cadernos.find((c) => progressoDe(db, c, turma.id).status !== 'concluido')
  return <Navigate to={pendente ? `${base}/lancar/${pendente.id}/${turma.id}` : resultados} replace />
}
