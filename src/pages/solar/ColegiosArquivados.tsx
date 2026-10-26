import { ChevronRight, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Cabecalho, Cartao, Confirmacao, Selo, Vazio } from '../../components/ui'
import { permissoesDe, pessoaDoPerfil } from '../../lib/consultas'
import { compararTexto, dataCurta, fraseConfere, fraseParaExcluirColegio, ordenarTurmas, plural, turmaNome } from '../../lib/formato'
import { excluirColegio, reativarColegio } from '../../store/acoes'
import { useDb } from '../../store/db'
import { useRede, type Rede } from '../../store/painel'
import { usePerfil } from '../../store/perfil'
import type { ColegioArquivado, Turma } from '../../types'

/** Alunos de uma turma do colégio arquivado: na plataforma, do painel da rede; na demonstração, dos dados guardados. */
const alunosDaTurma = (rede: Rede, arquivado: ColegioArquivado, turma: Turma) =>
  rede.cadastroDe(turma.id)?.alunos ?? arquivado.alunos.filter((a) => a.turmaId === turma.id && a.ativo).length

const arquivadoPor = (a: ColegioArquivado) => (a.em ? `arquivado em ${dataCurta(a.em)}${a.por ? ` por ${a.por}` : ''}` : 'arquivado')

/** Os colégios que a Solar arquivou: fora das listas e das contas da rede, com tudo guardado. */
export default function ColegiosArquivados() {
  const db = useDb()
  const arquivados = [...db.arquivados].sort((a, b) => compararTexto(a.colegio.nome, b.colegio.nome))
  return (
    <>
      <Cabecalho
        sobretitulo="Rede"
        titulo="Colégios arquivados"
        subtitulo="Colégios que saíram da rede. A coordenação e os professores deles não entram mais, e eles ficam fora das contas da rede. Nada se apagou: cada um pode ser reativado, com tudo como estava."
        voltar={{ para: '/solar/colegios', rotulo: 'Colégios' }}
      />
      <Cartao>
        {!arquivados.length ? (
          <Vazio titulo="Nenhum colégio arquivado" />
        ) : (
          <ul className="lista-links">
            {arquivados.map((a) => (
              <li key={a.colegio.id}>
                <Link to={`/solar/colegios/arquivados/${a.colegio.id}`} className="lista-link lista-link-arquivado">
                  <span>
                    <span className="lista-link-titulo">{a.colegio.nome}</span>
                    <span className="texto-2 pequeno bloco">
                      {a.colegio.cidade}/{a.colegio.uf} · {arquivadoPor(a)}
                    </span>
                  </span>
                  <span className="texto-2">{plural(a.turmas.length, 'turma', 'turmas')}</span>
                  <ChevronRight size={18} aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  )
}

/** Um colégio arquivado: o que ficou guardado, reativar e (só a responsável pela equipe Solar) excluir em definitivo. */
export function ColegioArquivadoDetalhe() {
  const { colegioId = '' } = useParams()
  const db = useDb()
  const rede = useRede()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [reativando, setReativando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [frase, setFrase] = useState('')
  const arquivado = db.arquivados.find((a) => a.colegio.id === colegioId)
  if (!arquivado) {
    return <Vazio titulo="Colégio não encontrado" acao={<Link className="btn" to="/solar/colegios/arquivados">Voltar</Link>} />
  }
  const { colegio } = arquivado
  const { editarRede, gerirEquipeSolar } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)
  const turmas = ordenarTurmas(arquivado.turmas.filter((t) => t.anoLetivo === db.config.anoLetivo))
  const anteriores = arquivado.turmas.length - turmas.length
  const totalAlunos = turmas.reduce((s, t) => s + alunosDaTurma(rede, arquivado, t), 0)
  const equipe = [...arquivado.coordenadores].sort((a, b) => Number(b.responsavel) - Number(a.responsavel))
  const professores = arquivado.professores.filter((p, i, todos) => todos.findIndex((x) => x.id === p.id) === i)
  const historico = arquivado.historico.slice(-10).reverse()
  const fraseExcluir = fraseParaExcluirColegio(colegio.nome)

  return (
    <>
      <Cabecalho
        sobretitulo="Colégio arquivado"
        titulo={colegio.nome}
        subtitulo={`${colegio.cidade}/${colegio.uf} · ${arquivadoPor(arquivado)}`}
        voltar={{ para: '/solar/colegios/arquivados', rotulo: 'Colégios arquivados' }}
        acoes={
          editarRede && (
            <button className="btn btn-primario" onClick={() => setReativando(true)}>
              <RotateCcw size={16} aria-hidden /> Reativar colégio
            </button>
          )
        }
      />

      <Confirmacao
        titulo={`Reativar o ${colegio.nome}?`}
        aberta={reativando}
        rotuloConfirmar="Reativar colégio"
        aoConfirmar={() => {
          reativarColegio(colegio.id)
          navigate(`/solar/colegios/${colegio.id}`)
        }}
        aoFechar={() => setReativando(false)}
      >
        <p>
          O colégio volta à lista de colégios e aos resultados da rede, com tudo como estava, e a coordenação e os professores
          voltam a entrar.
        </p>
      </Confirmacao>

      <Cartao titulo="Equipe sem acesso" sub="Enquanto o colégio estiver arquivado, estas pessoas não entram (as que também estão em outro colégio continuam entrando por ele).">
        {equipe.length || professores.length ? (
          <ul className="lista-pessoas">
            {equipe.map((c) => (
              <li key={`c-${c.id}`}>
                <div>
                  <p className="lista-pessoas-nome">
                    {c.nome} {c.responsavel ? <Selo tom="marca">Responsável</Selo> : <Selo>Coordenação</Selo>}
                  </p>
                  <p className="texto-2 pequeno">{c.email}</p>
                </div>
              </li>
            ))}
            {professores.length > 0 && (
              <li>
                <div>
                  <p className="lista-pessoas-nome">
                    {plural(professores.length, 'professor(a)', 'professores')}
                  </p>
                  <p className="texto-2 pequeno">{professores.map((p) => p.nome).sort(compararTexto).join(', ')}</p>
                </div>
              </li>
            )}
          </ul>
        ) : (
          <p className="texto-2">O colégio não tinha ninguém cadastrado.</p>
        )}
      </Cartao>

      <Cartao
        titulo="Turmas guardadas"
        sub={`${plural(turmas.length, 'turma', 'turmas')} e ${plural(totalAlunos, 'aluno', 'alunos')} em ${db.config.anoLetivo}${anteriores ? `, mais ${plural(anteriores, 'turma', 'turmas')} de anos anteriores` : ''}. Os resultados voltam às contas da rede se o colégio for reativado.`}
      >
        {!turmas.length ? (
          <p className="texto-2">O colégio não tem turmas em {db.config.anoLetivo}.</p>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Turno</th>
                  <th className="num">Alunos</th>
                </tr>
              </thead>
              <tbody>
                {turmas.map((t) => (
                  <tr key={t.id}>
                    <td>{turmaNome(t)}</td>
                    <td>{t.turno}</td>
                    <td className="num">{alunosDaTurma(rede, arquivado, t)}</td>
                  </tr>
                ))}
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

      <Cartao
        titulo="Excluir em definitivo"
        sub="Apaga as turmas, os alunos, as respostas lançadas, o histórico e os acessos do colégio. Quem só tinha acesso por ele sai do cadastro. Não tem volta."
      >
        {gerirEquipeSolar ? (
          <button
            className="btn btn-perigo"
            onClick={() => {
              setFrase('')
              setExcluindo(true)
            }}
          >
            <Trash2 size={16} aria-hidden /> Excluir em definitivo
          </button>
        ) : (
          <p className="texto-2 pequeno">Só a pessoa responsável pela equipe Solar exclui um colégio.</p>
        )}
      </Cartao>

      <Confirmacao
        titulo={`Excluir em definitivo o ${colegio.nome}?`}
        aberta={excluindo}
        rotuloConfirmar="Excluir em definitivo"
        perigo
        bloqueado={!fraseConfere(frase, fraseExcluir)}
        aoConfirmar={() => {
          excluirColegio(colegio.id)
          navigate('/solar/colegios/arquivados')
        }}
        aoFechar={() => setExcluindo(false)}
      >
        <p>
          Saem para sempre as turmas, os alunos, as respostas lançadas e o histórico do colégio.
          {equipe.length + professores.length > 0 &&
            ` ${plural(equipe.length + professores.length, 'pessoa', 'pessoas')} da equipe ${equipe.length + professores.length > 1 ? 'perdem' : 'perde'} o acesso de vez; quem não está em outro colégio sai do cadastro.`}{' '}
          Os resultados da rede deixam de contar este colégio. Não há como desfazer.
        </p>
        <CampoFrase frase={fraseExcluir} digitado={frase} aoDigitar={setFrase} />
      </Confirmacao>
    </>
  )
}

/** "Para confirmar, digite: …": o botão da confirmação só liga quando a frase confere. */
export function CampoFrase(props: { frase: string; digitado: string; aoDigitar: (texto: string) => void }) {
  return (
    <label className="campo">
      <span>
        Para confirmar, digite: <strong className="frase-confirmar">{props.frase}</strong>
      </span>
      <input value={props.digitado} onChange={(e) => props.aoDigitar(e.target.value)} autoComplete="off" spellCheck={false} autoFocus />
    </label>
  )
}
