import { ChartColumn, ClipboardList, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router'
import { Cabecalho } from '../../components/ui'
import { alunosAtivos, anoLetivoAtual, avaliacaoDaTurma, cadernosDaSerie, nomesProfessores } from '../../lib/consultas'
import { plural, turmaNome } from '../../lib/formato'
import type { Caderno, Colegio, Db, Perfil, Turma } from '../../types'

export type AbaTurma = 'lancar' | 'resultados' | 'alunos'

/**
 * Cabeçalho de todas as páginas de uma turma, com as mesmas abas para professor e coordenação:
 * Lançar respostas, Resultados e Alunos. A Solar vê só os resultados. Imprimir as provas é só na aba Provas da coordenação.
 * Em Lançar e Resultados, com mais de uma disciplina, a turma escolhe a prova (uma prova por disciplina).
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
    ? {
        avaliacao: db.avaliacoes.find((a) => a.id === props.caderno!.avaliacaoId)!,
        cadernos: cadernosDaSerie(db, props.caderno.avaliacaoId, turma.serie),
      }
    : avaliacaoDaTurma(db, turma)
  const atual = props.caderno ?? prova?.cadernos[0]
  const anterior = turma.anoLetivo < anoLetivoAtual(db)
  const comAbas = perfil.papel !== 'solar' && !anterior
  const alunos = alunosAtivos(db, turma.id).length

  const abas: { id: AbaTurma; rotulo: string; para: string; Icone: LucideIcon }[] = []
  if (atual) abas.push({ id: 'lancar', rotulo: 'Lançar respostas', para: `${base}/lancar/${atual.id}/${turma.id}`, Icone: ClipboardList })
  if (atual) abas.push({ id: 'resultados', rotulo: 'Resultados', para: `${base}/resultados/${atual.id}/${turma.id}`, Icone: ChartColumn })
  abas.push({ id: 'alunos', rotulo: 'Alunos', para: `${base}/turma/${turma.id}/alunos`, Icone: Users })

  const disciplinas = props.caderno && prova && prova.cadernos.length > 1 && aba !== 'alunos' ? prova.cadernos : []
  // Sem a escolha da prova (uma disciplina só), o nome dela fica na linha de baixo.
  const detalhes = [
    props.caderno && aba !== 'alunos' && !disciplinas.length ? `Prova de ${props.caderno.disciplina}` : null,
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
      {disciplinas.length > 0 && (
        <nav className="segmentos segmentos-grandes disciplinas-turma" aria-label="Prova">
          {disciplinas.map((c) => (
            <NavLink
              key={c.id}
              to={`${base}/${aba === 'lancar' ? 'lancar' : 'resultados'}/${c.id}/${turma.id}`}
              className={`segmento ${c.id === props.caderno?.id ? 'ativo' : ''}`}
              aria-current={c.id === props.caderno?.id ? 'page' : undefined}
            >
              {c.disciplina}
            </NavLink>
          ))}
        </nav>
      )}
    </>
  )
}
