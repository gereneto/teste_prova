import { Download, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Cabecalho, Cartao, Selo, Vazio } from '../../components/ui'
import { alunosAtivos, avaliacaoAtual, avaliacoesOrdenadas, cadernosDaAvaliacao, descreverPeriodo, turmasDoColegio } from '../../lib/consultas'
import { plural, serieNome, turmaNome } from '../../lib/formato'
import { baixarPdfDoCaderno } from '../../store/arquivos'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, type Caderno } from '../../types'

/**
 * As provas de todos os anos, para a coordenação baixar e imprimir: em cada ano, a de Português e a de Matemática.
 * Professores não imprimem provas.
 */
export default function Provas() {
  const db = useDb()
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const [erro, setErro] = useState<string | null>(null)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacao = db.avaliacoes.find((a) => a.id === params.get('avaliacao')) ?? avaliacaoAtual(db) ?? avaliacoes[0]
  if (!colegio) return null
  if (!avaliacao) return <Vazio titulo="Ainda não há avaliações">A Solar cadastra a avaliação anual e envia as provas de cada ano.</Vazio>

  const turmas = turmasDoColegio(db, colegio.id, avaliacao.anoLetivo)
  const cadernos = cadernosDaAvaliacao(db, avaliacao.id)

  async function baixar(caderno: Caderno) {
    setErro(null)
    try {
      await baixarPdfDoCaderno(caderno)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível baixar a prova.')
    }
  }

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Provas"
        subtitulo="Baixe o PDF de cada prova e imprima uma cópia por aluno. Só a coordenação tem acesso às provas."
        acoes={
          avaliacoes.length > 1 && (
            <label className="campo-inline">
              <span>Avaliação</span>
              <select value={avaliacao.id} onChange={(e) => setParams({ avaliacao: e.target.value })}>
                {avaliacoes.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.titulo}
                  </option>
                ))}
              </select>
            </label>
          )
        }
      />
      <p className="texto-2 recuo-cabecalho">{descreverPeriodo(avaliacao)}</p>
      {erro && <p className="erro-campo">{erro}</p>}

      {!cadernos.length && <Vazio titulo="A Solar ainda não cadastrou as provas desta avaliação" />}

      <div className="provas">
        {SERIES.map((serie) => {
          const doAno = cadernos.filter((c) => c.serie === serie)
          if (!doAno.length) return null
          const turmasDoAno = turmas.filter((t) => t.serie === serie)
          const alunos = turmasDoAno.reduce((s, t) => s + alunosAtivos(db, t.id).length, 0)
          const comFolha = doAno.some((c) => c.usaFolhaRespostas)
          return (
            <Cartao
              key={serie}
              titulo={serieNome(serie)}
              sub={turmasDoAno.length ? `${plural(alunos, 'aluno', 'alunos')} em ${turmasDoAno.map(turmaNome).join(', ')}` : 'Nenhuma turma deste ano no colégio'}
            >
              <ul className="provas-do-ano">
                {doAno.map((caderno) => (
                  <li key={caderno.id}>
                    <span>
                      <strong>Prova de {caderno.disciplina}</strong>
                      <span className="texto-2 bloco pequeno">{plural(caderno.questoes.length, 'questão', 'questões')}</span>
                    </span>
                    <span className="form-acoes">
                      {caderno.pdf ? (
                        <button className="btn btn-primario btn-pequeno" onClick={() => baixar(caderno)}>
                          <Download size={15} aria-hidden /> Baixar a prova
                        </button>
                      ) : (
                        <Selo tom="ambar">A Solar ainda não enviou o PDF</Selo>
                      )}
                      {caderno.usaFolhaRespostas &&
                        turmasDoAno.map((turma) => (
                          <Link key={turma.id} className="btn btn-pequeno" to={`/imprimir/folhas/${caderno.id}/${turma.id}`}>
                            <Printer size={15} aria-hidden /> Folhas · {turmaNome(turma)}
                          </Link>
                        ))}
                    </span>
                  </li>
                ))}
              </ul>
              {comFolha ? (
                <p className="texto-2 pequeno">
                  No {serieNome(serie)}, os alunos marcam as respostas numa folha separada para cada prova, que já sai com o número de chamada e as
                  iniciais de cada um.
                </p>
              ) : (
                <p className="texto-2 pequeno">
                  No {serieNome(serie)}, os alunos marcam as respostas na própria prova. Escreva o número de chamada de cada aluno na capa.
                </p>
              )}
            </Cartao>
          )
        })}
      </div>
    </>
  )
}
