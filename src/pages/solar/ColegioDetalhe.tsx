import { ChartColumn, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { Cabecalho, Cartao, Vazio } from '../../components/ui'
import { nomesProfessores, turmasDoColegio } from '../../lib/consultas'
import { plural, turmaNome } from '../../lib/formato'
import { editarColegio } from '../../store/acoes'
import { useDb } from '../../store/db'
import { FormularioColegio } from './Colegios'

export default function ColegioDetalhe() {
  const { colegioId = '' } = useParams()
  const db = useDb()
  const [editando, setEditando] = useState(false)
  const colegio = db.colegios.find((c) => c.id === colegioId)
  if (!colegio) return <Vazio titulo="Colégio não encontrado" acao={<Link className="btn" to="/solar/colegios">Voltar</Link>} />

  const turmas = turmasDoColegio(db, colegio.id)
  const alunosDa = (turmaId: string) => db.alunos.filter((a) => a.turmaId === turmaId && a.ativo).length
  const totalAlunos = turmas.reduce((s, t) => s + alunosDa(t.id), 0)

  return (
    <>
      <Cabecalho
        sobretitulo="Colégio da Rede"
        titulo={colegio.nome}
        subtitulo={`${colegio.cidade}/${colegio.uf} · ${plural(turmas.length, 'turma', 'turmas')} · ${plural(totalAlunos, 'aluno', 'alunos')}`}
        voltar={{ para: '/solar/colegios', rotulo: 'Colégios' }}
        acoes={
          <>
            {!editando && (
              <button className="btn" onClick={() => setEditando(true)}>
                <Pencil size={16} aria-hidden /> Editar dados
              </button>
            )}
            <Link className="btn" to={`/solar/estatisticas?colegio=${colegio.id}`}>
              <ChartColumn size={16} aria-hidden /> Estatísticas do colégio
            </Link>
          </>
        }
      />

      {editando ? (
        <FormularioColegio
          inicial={colegio}
          rotuloSalvar="Salvar alterações"
          aoSalvar={(dados) => {
            editarColegio(colegio.id, dados)
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      ) : (
        <Cartao titulo="Coordenação">
          <dl className="dados">
            <div>
              <dt>Nome</dt>
              <dd>{colegio.coordenacao.nome || '—'}</dd>
            </div>
            <div>
              <dt>E-mail</dt>
              <dd>{colegio.coordenacao.email || '—'}</dd>
            </div>
            <div>
              <dt>Telefone</dt>
              <dd>{colegio.coordenacao.telefone || '—'}</dd>
            </div>
          </dl>
        </Cartao>
      )}

      <Cartao titulo="Turmas" sub="Cadastradas pela coordenação do colégio. A Solar vê só a quantidade de alunos, não os nomes.">
        {!turmas.length ? (
          <Vazio titulo="A coordenação ainda não cadastrou turmas" />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Turno</th>
                  <th>Professor(a)</th>
                  <th className="num">Alunos</th>
                  <th className="num">Novos no colégio</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((turma) => (
                  <tr key={turma.id}>
                    <td>{turmaNome(turma)}</td>
                    <td>{turma.turno}</td>
                    <td>{nomesProfessores(db, turma)}</td>
                    <td className="num">{alunosDa(turma.id)}</td>
                    <td className="num">{db.alunos.filter((a) => a.turmaId === turma.id && a.ativo && a.anoIngresso === turma.anoLetivo).length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  )
}
