import { ChartColumn, ClipboardList, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Cabecalho } from '../../components/ui'
import { alunosAtivos, anoLetivoAtual, avaliacaoDaTurma, nomesProfessores } from '../../lib/consultas'
import { plural, turmaNome } from '../../lib/formato'
import type { Caderno, Colegio, Db, Perfil, Turma } from '../../types'

export type AbaTurma = 'lancar' | 'resultados' | 'alunos'

/**
 * Cabeçalho de todas as páginas de uma turma, com as mesmas abas para professor e coordenação:
 * Lançar respostas, Resultados e Alunos. A Solar vê só os resultados. Imprimir as provas é só na aba Provas da coordenação.
 */
export function CabecalhoTurma(props: {
  db: Db
  perfil: Perfil
  turma: Turma
  colegio: Colegio
  base: string
  aba: AbaTurma
  caderno?: Caderno
  acoes?: ReactNode
}) {
  const { db, perfil, turma, colegio, base, aba } = props
  const prova = props.caderno
    ? { caderno: props.caderno, avaliacao: db.avaliacoes.find((a) => a.id === props.caderno!.avaliacaoId)! }
    : avaliacaoDaTurma(db, turma)
  const anterior = turma.anoLetivo < anoLetivoAtual(db)
  const comAbas = perfil.papel !== 'solar' && !anterior
  const alunos = alunosAtivos(db, turma.id).length

  const abas: { id: AbaTurma; rotulo: string; para: string; Icone: LucideIcon }[] = []
  if (prova) abas.push({ id: 'lancar', rotulo: 'Lançar respostas', para: `${base}/lancar/${prova.caderno.id}/${turma.id}`, Icone: ClipboardList })
  if (prova) abas.push({ id: 'resultados', rotulo: 'Resultados', para: `${base}/resultados/${prova.caderno.id}/${turma.id}`, Icone: ChartColumn })
  abas.push({ id: 'alunos', rotulo: 'Alunos', para: `${base}/turma/${turma.id}/alunos`, Icone: Users })

  const detalhes = [
    colegio.nome,
    anterior ? `ano letivo ${turma.anoLetivo}` : turma.turno,
    perfil.papel === 'professor' ? null : nomesProfessores(db, turma),
    anterior ? null : plural(alunos, 'aluno', 'alunos'),
  ].filter(Boolean)

  return (
    <>
      <Cabecalho
        sobretitulo={prova ? prova.avaliacao.titulo : 'Turma'}
        titulo={anterior ? `${turmaNome(turma)} de ${turma.anoLetivo}` : turmaNome(turma)}
        subtitulo={detalhes.join(' · ')}
        voltar={{ para: base, rotulo: 'Início' }}
        acoes={props.acoes}
      />
      {comAbas && (
        <nav className="abas-turma" aria-label="Páginas da turma">
          {abas.map(({ id, rotulo, para, Icone }) => (
            <NavLink key={id} to={para} className={`aba-turma ${aba === id ? 'ativa' : ''}`} aria-current={aba === id ? 'page' : undefined}>
              <Icone size={18} aria-hidden /> {rotulo}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
