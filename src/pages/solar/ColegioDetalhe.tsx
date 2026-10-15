import { ChartColumn, Crown, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { FormularioContato } from '../../components/FormularioContato'
import { Cabecalho, Cartao, Selo, Vazio } from '../../components/ui'
import {
  alunosAtivos,
  avaliacaoAtual,
  cadernoDaSerie,
  equipeDoColegio,
  nomesProfessores,
  pedidosPendentes,
  permissoesDe,
  pessoaDoPerfil,
  turmasDoColegio,
} from '../../lib/consultas'
import { ehNovo, progressoDe } from '../../lib/estatisticas'
import { dataCurta, plural, turmaNome } from '../../lib/formato'
import { definirResponsavelDoColegio, editarColegio } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SeloStatus } from '../../components/ui'
import { FormularioColegio } from './Colegios'

export default function ColegioDetalhe() {
  const { colegioId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const [editando, setEditando] = useState(false)
  const [trocando, setTrocando] = useState(false)
  const colegio = db.colegios.find((c) => c.id === colegioId)
  if (!colegio) return <Vazio titulo="Colégio não encontrado" acao={<Link className="btn" to="/solar/colegios">Voltar</Link>} />
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)

  const turmas = turmasDoColegio(db, colegio.id)
  const totalAlunos = turmas.reduce((s, t) => s + alunosAtivos(db, t.id).length, 0)
  const equipe = equipeDoColegio(db, colegio.id)
  const responsavel = equipe.find((c) => c.responsavel)
  const avaliacao = avaliacaoAtual(db)
  const pedidos = pedidosPendentes(db, colegio.id)
  const historico = db.historico.filter((e) => e.colegioId === colegio.id).slice(-10).reverse()

  return (
    <>
      <Cabecalho
        sobretitulo="Colégio da rede"
        titulo={colegio.nome}
        subtitulo={`${colegio.cidade}/${colegio.uf} · ${plural(turmas.length, 'turma', 'turmas')} · ${plural(totalAlunos, 'aluno', 'alunos')}`}
        voltar={{ para: '/solar/colegios', rotulo: 'Colégios' }}
        acoes={
          <>
            {editarRede && !editando && (
              <button className="btn" onClick={() => setEditando(true)}>
                <Pencil size={16} aria-hidden /> Editar dados
              </button>
            )}
            <Link className="btn" to={`/solar/resultados?colegio=${colegio.id}`}>
              <ChartColumn size={16} aria-hidden /> Resultados do colégio
            </Link>
          </>
        }
      />

      {editando && (
        <FormularioColegio
          inicial={colegio}
          rotuloSalvar="Salvar alterações"
          aoSalvar={(dados) => {
            editarColegio(colegio.id, dados)
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <Cartao
        titulo="Coordenação"
        sub="A pessoa responsável é definida pela Solar e cadastra as demais pessoas da equipe do colégio."
        acoes={
          editarRede &&
          !trocando && (
            <button className="btn btn-pequeno" onClick={() => setTrocando(true)}>
              <Crown size={15} aria-hidden /> {responsavel ? 'Trocar responsável' : 'Definir responsável'}
            </button>
          )
        }
      >
        {trocando && (
          <FormularioContato
            titulo={responsavel ? 'Nova pessoa responsável' : 'Pessoa responsável pela coordenação'}
            rotuloSalvar={responsavel ? 'Trocar responsável' : 'Definir responsável'}
            extra={responsavel && <p className="texto-2 pequeno">{responsavel.nome} continua na equipe da coordenação, sem o papel de responsável.</p>}
            aoSalvar={(contato) => {
              definirResponsavelDoColegio(colegio.id, contato)
              setTrocando(false)
            }}
            aoCancelar={() => setTrocando(false)}
          />
        )}
        {equipe.length ? (
          <ul className="lista-pessoas">
            {equipe.map((pessoa) => (
              <li key={pessoa.id}>
                <div>
                  <p className="lista-pessoas-nome">
                    {pessoa.nome} {pessoa.responsavel && <Selo tom="marca">Responsável</Selo>}
                  </p>
                  <p className="texto-2 pequeno">{[pessoa.email, pessoa.telefone].filter(Boolean).join(' · ')}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="texto-2">Ainda não há ninguém na coordenação deste colégio.</p>
        )}
        {pedidos.length > 0 && (
          <p className="pequeno">
            <Selo tom="ambar">{plural(pedidos.length, 'pedido', 'pedidos')}</Selo> de professores esperando a coordenação.
          </p>
        )}
      </Cartao>

      <Cartao titulo="Turmas" sub="Cadastradas pela coordenação. A Solar vê os resultados de cada turma, sem a lista de alunos, que fica com o colégio.">
        {!turmas.length ? (
          <Vazio titulo="A coordenação ainda não cadastrou turmas" />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Turno</th>
                  <th>Professores</th>
                  <th className="num">Alunos</th>
                  <th className="num">Novos no colégio</th>
                  {avaliacao && <th>Lançamento</th>}
                </tr>
              </thead>
              <tbody>
                {turmas.map((turma) => {
                  const alunos = alunosAtivos(db, turma.id).filter((a) => !a.pendente)
                  const caderno = avaliacao ? cadernoDaSerie(db, avaliacao.id, turma.serie) : undefined
                  return (
                    <tr key={turma.id}>
                      <td>{caderno ? <Link to={`/solar/resultados/${caderno.id}/${turma.id}`}>{turmaNome(turma)}</Link> : turmaNome(turma)}</td>
                      <td>{turma.turno}</td>
                      <td>{nomesProfessores(db, turma)}</td>
                      <td className="num">{alunos.length}</td>
                      <td className="num">{alunos.filter((a) => ehNovo(a, turma.anoLetivo)).length}</td>
                      {avaliacao && <td>{caderno ? <SeloStatus status={progressoDe(db, caderno, turma.id).status} /> : <span className="texto-2">sem prova</span>}</td>}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {historico.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Histórico do colégio</summary>
          <ul className="historico">
            {historico.map((e) => (
              <li key={e.id}>
                <span className="historico-data">{dataCurta(e.em)}</span>
                <span>
                  {e.texto} <span className="texto-2">({e.por})</span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}
