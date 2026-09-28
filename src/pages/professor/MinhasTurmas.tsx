import { LinhaAvaliacao } from '../../components/LinhaAvaliacao'
import { Cabecalho, Cartao, Vazio } from '../../components/ui'
import { avaliacoesOrdenadas, cadernoDaSerie, turmasDoProfessor } from '../../lib/consultas'
import { plural, serieNome, turmaNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'

export default function MinhasTurmas() {
  const db = useDb()
  const perfil = usePerfil()
  const professor = perfil?.papel === 'professor' ? db.professores.find((p) => p.id === perfil.professorId) : undefined
  if (!professor) return null

  const turmas = turmasDoProfessor(db, professor.id)
  const avaliacoes = avaliacoesOrdenadas(db)

  return (
    <>
      <Cabecalho
        titulo={`Olá, ${professor.nome.split(' ')[0]}`}
        subtitulo="Escolha a turma e a avaliação para lançar as respostas dos alunos ou ver os resultados."
      />
      {!turmas.length && (
        <Vazio titulo="Você ainda não tem turmas">A coordenação do colégio associa cada professor às suas turmas.</Vazio>
      )}
      {turmas.map((turma) => {
        const alunos = db.alunos.filter((a) => a.turmaId === turma.id && a.ativo).length
        const linhas = avaliacoes.flatMap((avaliacao) => {
          const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
          return caderno ? [{ avaliacao, caderno }] : []
        })
        return (
          <Cartao key={turma.id} titulo={turmaNome(turma)} sub={`${turma.turno} · ${plural(alunos, 'aluno', 'alunos')}`}>
            {linhas.length ? (
              <ul className="lista-avaliacoes">
                {linhas.map(({ avaliacao, caderno }) => (
                  <LinhaAvaliacao key={avaliacao.id} avaliacao={avaliacao} caderno={caderno} turma={turma} base="/professor" />
                ))}
              </ul>
            ) : (
              <p className="texto-2">Ainda não há avaliações para o {serieNome(turma.serie)}.</p>
            )}
          </Cartao>
        )
      })}
    </>
  )
}
