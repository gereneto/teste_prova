import { ChartColumn, Crown, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { AvisoEnvio, BotaoReenviar } from '../../components/AvisoEnvio'
import { FormularioContato } from '../../components/FormularioContato'
import { Cabecalho, Cartao, Selo, SeloStatus, Vazio } from '../../components/ui'
import { camposFaltando } from '../../lib/alunos'
import {
  alunosAtivos,
  avaliacaoAtual,
  cadernoDaSerie,
  equipeDoColegio,
  membroSolarDoColegio,
  nomesProfessores,
  permissoesDe,
  pessoaDoPerfil,
  podeDefinirResponsavel,
  turmasDoColegio,
} from '../../lib/consultas'
import { ehNovo, progressoDe } from '../../lib/estatisticas'
import { dataCurta, plural, turmaNome } from '../../lib/formato'
import { definirMembroSolarDoColegio, definirResponsavelDoColegio, editarColegio } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { FormularioColegio } from './Colegios'

export default function ColegioDetalhe() {
  const { colegioId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const [editando, setEditando] = useState(false)
  const [trocando, setTrocando] = useState(false)
  // Ao cadastrar o colégio já com a pessoa responsável, a página abre avisando do e-mail enviado.
  const location = useLocation()
  const [enviado, setEnviado] = useState<string | null>((location.state as { enviado?: string | null } | null)?.enviado ?? null)
  const colegio = db.colegios.find((c) => c.id === colegioId)
  if (!colegio) return <Vazio titulo="Colégio não encontrado" acao={<Link className="btn" to="/solar/colegios">Voltar</Link>} />
  const pessoa = perfil ? pessoaDoPerfil(db, perfil) : null
  const { editarRede, gerirEquipeSolar } = permissoesDe(pessoa)
  const defineResponsavel = podeDefinirResponsavel(pessoa, colegio)
  const membroSolar = membroSolarDoColegio(db, colegio)
  const quemPodeCuidar = db.equipeSolar.filter((m) => m.papel !== 'visualizacao')

  const turmas = turmasDoColegio(db, colegio.id)
  const totalAlunos = turmas.reduce((s, t) => s + alunosAtivos(db, t.id).length, 0)
  const equipe = equipeDoColegio(db, colegio.id)
  const responsavel = equipe.find((c) => c.responsavel)
  const avaliacao = avaliacaoAtual(db)
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

      <Cartao titulo="Pela Solar" sub="Cada colégio fica aos cuidados de uma pessoa da equipe Solar, que define quem responde pela coordenação.">
        {gerirEquipeSolar ? (
          <label className="campo campo-estreito">
            <span>Quem cuida do colégio</span>
            <select value={colegio.membroSolarId ?? ''} onChange={(e) => definirMembroSolarDoColegio(colegio.id, e.target.value || null)}>
              <option value="">Ninguém ainda</option>
              {quemPodeCuidar.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <p>{membroSolar ? <strong>{membroSolar.nome}</strong> : <span className="texto-2">Ninguém da Solar cuida deste colégio ainda.</span>}</p>
            <p className="texto-2 pequeno">Quem escolhe é a pessoa responsável pela equipe Solar.</p>
          </>
        )}
      </Cartao>

      <Cartao
        titulo="Coordenação"
        sub={`A pessoa responsável é definida ${membroSolar ? `por ${membroSolar.nome}, da Solar,` : 'pela Solar'} e cadastra as demais pessoas da equipe do colégio. Cada pessoa cadastrada recebe por e-mail o link de acesso.`}
        acoes={
          defineResponsavel &&
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
              setEnviado(definirResponsavelDoColegio(colegio.id, contato).emailEnviado)
              setTrocando(false)
            }}
            aoCancelar={() => setTrocando(false)}
          />
        )}
        <AvisoEnvio email={enviado} aoFechar={() => setEnviado(null)} />
        {equipe.length ? (
          <ul className="lista-pessoas">
            {equipe.map((c) => (
              <li key={c.id}>
                <div>
                  <p className="lista-pessoas-nome">
                    {c.nome} {c.responsavel && <Selo tom="marca">Responsável</Selo>}
                  </p>
                  <p className="texto-2 pequeno">{[c.email, c.telefone].filter(Boolean).join(' · ')}</p>
                </div>
                {defineResponsavel && c.responsavel && <BotaoReenviar tipo="coordenador" id={c.id} aoEnviar={setEnviado} />}
              </li>
            ))}
          </ul>
        ) : (
          <p className="texto-2">Ainda não há ninguém na coordenação deste colégio.</p>
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
                  const alunos = alunosAtivos(db, turma.id)
                  const faltando = alunos.filter((a) => camposFaltando(a).length).length
                  const caderno = avaliacao ? cadernoDaSerie(db, avaliacao.id, turma.serie) : undefined
                  return (
                    <tr key={turma.id}>
                      <td>{caderno ? <Link to={`/solar/resultados/${caderno.id}/${turma.id}`}>{turmaNome(turma)}</Link> : turmaNome(turma)}</td>
                      <td>{turma.turno}</td>
                      <td>{nomesProfessores(db, turma)}</td>
                      <td className="num">
                        {alunos.length}
                        {faltando > 0 && <span className="texto-2 bloco pequeno">{faltando} com dados faltando</span>}
                      </td>
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
