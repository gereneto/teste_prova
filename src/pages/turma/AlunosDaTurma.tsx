import { LogOut, Pencil, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso, Cartao, Selo, Vazio } from '../../components/ui'
import { alunosAtivos, anoLetivoAtual, contatoDoColegio } from '../../lib/consultas'
import { ehNovo } from '../../lib/estatisticas'
import { alunoEmTexto, normalizarIniciais } from '../../lib/iniciais'
import { anosDeEntrada, descreverEntrada } from '../../lib/ingresso'
import { descreverPedido, NOMES_MOTIVO, situacaoDoPedido } from '../../lib/pedidos'
import { cancelarPedido, numerosUsados, pedirCorrecao, pedirInclusao, pedirSaida, proximoNumero, validarIniciais, type DadosAluno } from '../../store/acoes'
import type { Aluno, Db, Id, MotivoSaida, Turma } from '../../types'
import { AlunosCoordenacao } from '../coordenacao/TurmaDetalhe'
import { CabecalhoTurma } from './CabecalhoTurma'
import { useTurmaDaRota, type ContextoSoTurma } from './contexto'

/** A aba Alunos da turma: a coordenação mexe na lista; o professor pede as mudanças. */
export default function AlunosDaTurma() {
  const contexto = useTurmaDaRota()
  if ('erro' in contexto) return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  if (contexto.perfil.papel === 'coordenacao') return <AlunosCoordenacao {...contexto} />
  return <AlunosProfessor {...contexto} />
}

const MOTIVOS_DO_PROFESSOR: MotivoSaida[] = ['transferencia', 'mudou_de_cidade', 'outro']

function AlunosProfessor({ db, perfil, turma, colegio, base }: ContextoSoTurma) {
  const [incluindo, setIncluindo] = useState(false)
  const [corrigindo, setCorrigindo] = useState<Id | null>(null)
  const [saindo, setSaindo] = useState<Id | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const alunos = alunosAtivos(db, turma.id)
  const professorId = perfil.papel === 'professor' ? perfil.professorId : ''
  const pedidos = db.pedidos.filter((p) => p.turmaId === turma.id && p.professorId === professorId).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const pendentePorAluno = new Map(db.pedidos.filter((p) => p.turmaId === turma.id && p.situacao === 'pendente').map((p) => [p.alunoId, p]))
  const coordenacao = contatoDoColegio(db, turma.colegioId)
  const anterior = turma.anoLetivo < anoLetivoAtual(db)

  const cabecalho = <CabecalhoTurma db={db} perfil={perfil} turma={turma} colegio={colegio} base={base} aba="alunos" />
  if (anterior) {
    return (
      <>
        {cabecalho}
        <Vazio titulo="Esta turma é de um ano anterior">A lista de alunos de anos anteriores não muda mais. Os resultados continuam disponíveis.</Vazio>
      </>
    )
  }

  return (
    <>
      {cabecalho}

      {aviso && (
        <Aviso tom="sucesso" acoes={<button className="btn btn-pequeno btn-fantasma" onClick={() => setAviso(null)}>Fechar</button>}>
          {aviso}
        </Aviso>
      )}

      <div className="confira-diario">
        <p>
          <strong>Confira esta lista com o seu diário.</strong> Falta alguém, sobra alguém ou algum dado está errado? Peça à coordenação: a
          mudança vale depois que ela aprovar.
        </p>
        {!incluindo && (
          <button className="btn btn-primario" onClick={() => setIncluindo(true)}>
            <UserPlus size={17} aria-hidden /> Falta um aluno na lista
          </button>
        )}
      </div>

      {incluindo && (
        <FormularioAluno
          db={db}
          turma={turma}
          titulo="Pedir a inclusão de um aluno"
          explicacao="O aluno entra na lista na hora, como “aguardando a coordenação”, e você já pode lançar a prova dele. Ele só entra nas médias depois que a coordenação aprovar."
          inicial={{ iniciais: '', numero: proximoNumero(db, turma.id), anoIngresso: turma.anoLetivo }}
          rotuloSalvar="Enviar pedido"
          aoSalvar={(dados) => {
            pedirInclusao(turma.id, dados)
            setIncluindo(false)
            setAviso(`Pedido enviado. O ${alunoEmTexto(dados)} já está na lista, aguardando a coordenação.`)
          }}
          aoCancelar={() => setIncluindo(false)}
        />
      )}

      <Cartao titulo={`Alunos do ${turma.serie}º ano ${turma.nome}`} sub="Os alunos aparecem só pelas iniciais e pelo número de chamada, o mesmo do diário.">
        {!alunos.length ? (
          <Vazio titulo="A turma ainda não tem alunos no site">
            Quem cadastra a lista é a coordenação{coordenacao ? ` (${coordenacao.nome})` : ''}. Se já tiver a lista, use “Falta um aluno na lista”.
          </Vazio>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Aluno</th>
                  <th>Entrou no colégio</th>
                  <th className="acoes">
                    <span className="sr-only">Pedidos</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {alunos.map((aluno) => {
                  const pendente = pendentePorAluno.get(aluno.id)
                  if (corrigindo === aluno.id) {
                    return (
                      <tr key={aluno.id}>
                        <td colSpan={4}>
                          <FormularioAluno
                            db={db}
                            turma={turma}
                            aluno={aluno}
                            titulo={`Pedir correção do ${alunoEmTexto(aluno)}`}
                            inicial={aluno}
                            rotuloSalvar="Enviar pedido"
                            aoSalvar={(dados) => {
                              pedirCorrecao(aluno.id, dados)
                              setCorrigindo(null)
                              setAviso('Pedido de correção enviado à coordenação.')
                            }}
                            aoCancelar={() => setCorrigindo(null)}
                          />
                        </td>
                      </tr>
                    )
                  }
                  return (
                    <tr key={aluno.id}>
                      <td className="num">
                        <strong>{aluno.numero}</strong>
                      </td>
                      <td>
                        {aluno.iniciais}
                        {ehNovo(aluno, turma.anoLetivo) && <span className="tag-novo">Novo</span>}
                      </td>
                      <td>{aluno.anoIngresso ?? <span className="texto-2">não informado</span>}</td>
                      <td className="acoes">
                        {pendente ? (
                          <Selo tom="ambar">{pendente.tipo === 'incluir' ? 'Aguardando a coordenação' : 'Pedido aguardando'}</Selo>
                        ) : saindo === aluno.id ? (
                          <SaidaInline
                            aoConfirmar={(motivo) => {
                              pedirSaida(aluno.id, motivo)
                              setSaindo(null)
                              setAviso(`Aviso de saída do ${alunoEmTexto(aluno)} enviado à coordenação.`)
                            }}
                            aoCancelar={() => setSaindo(null)}
                          />
                        ) : (
                          <>
                            <button className="btn btn-pequeno btn-fantasma" onClick={() => setCorrigindo(aluno.id)}>
                              <Pencil size={14} aria-hidden /> Pedir correção
                            </button>
                            <button className="btn btn-pequeno btn-fantasma" onClick={() => setSaindo(aluno.id)}>
                              <LogOut size={14} aria-hidden /> Saiu da turma
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {pedidos.length > 0 && (
        <Cartao titulo="Seus pedidos para esta turma">
          <ul className="lista-simples">
            {pedidos.map((pedido) => {
              const situacao = situacaoDoPedido(pedido)
              return (
                <li key={pedido.id}>
                  <span>
                    {descreverPedido(db, pedido)}
                    {pedido.situacao === 'recusado' && pedido.decisao?.motivo && <span className="texto-2 bloco pequeno">Motivo: {pedido.decisao.motivo}</span>}
                  </span>
                  <span className="lista-simples-acoes">
                    <Selo tom={situacao.tom}>{situacao.texto}</Selo>
                    {pedido.situacao === 'pendente' && (
                      <button className="btn btn-pequeno btn-fantasma" onClick={() => cancelarPedido(pedido.id)}>
                        Cancelar pedido
                      </button>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}
    </>
  )
}

function SaidaInline(props: { aoConfirmar: (motivo: MotivoSaida) => void; aoCancelar: () => void }) {
  const [motivo, setMotivo] = useState<MotivoSaida>('transferencia')
  return (
    <span className="inline-acoes">
      <select className="select-compacto" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoSaida)} aria-label="Motivo da saída">
        {MOTIVOS_DO_PROFESSOR.map((m) => (
          <option key={m} value={m}>
            {NOMES_MOTIVO[m]}
          </option>
        ))}
      </select>
      <button className="btn btn-pequeno btn-primario" onClick={() => props.aoConfirmar(motivo)}>
        Avisar a coordenação
      </button>
      <button className="btn btn-pequeno btn-fantasma" onClick={props.aoCancelar}>
        Cancelar
      </button>
    </span>
  )
}

/** Número, iniciais e ano de entrada de um aluno, com as conferências. Serve para professor e coordenação. */
export function FormularioAluno(props: {
  db: Db
  turma: Turma
  aluno?: Aluno
  titulo?: string
  explicacao?: string
  inicial: DadosAluno
  rotuloSalvar: string
  aoSalvar: (dados: DadosAluno) => void
  aoCancelar: () => void
}) {
  const { db, turma } = props
  const [numero, setNumero] = useState(String(props.inicial.numero))
  const [iniciais, setIniciais] = useState(props.inicial.iniciais)
  const [ano, setAno] = useState(props.inicial.anoIngresso == null ? '' : String(props.inicial.anoIngresso))
  const [erro, setErro] = useState<string | null>(null)
  const anoNumero = ano ? Number(ano) : null
  const entrada = descreverEntrada(anoNumero, turma)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const n = Number(numero)
    if (!Number.isInteger(n) || n < 1 || n > 99) return setErro('O número de chamada vai de 1 a 99.')
    const usado = numerosUsados(db, turma.id, props.aluno?.id).get(n)
    if (usado) return setErro(`O nº ${n} já é de ${usado.iniciais} Confira no diário.`)
    const problema = validarIniciais(iniciais)
    if (problema) return setErro(problema)
    props.aoSalvar({ numero: n, iniciais: normalizarIniciais(iniciais)!, anoIngresso: anoNumero })
  }

  return (
    <form className="cartao form form-aluno" onSubmit={enviar} noValidate>
      {props.titulo && <h3 className="subtitulo">{props.titulo}</h3>}
      {props.explicacao && <p className="texto-2 pequeno">{props.explicacao}</p>}
      <div className="form-grade">
        <label className="campo">
          <span>Nº de chamada</span>
          <input
            inputMode="numeric"
            value={numero}
            onChange={(e) => {
              setNumero(e.target.value.replace(/\D/g, ''))
              setErro(null)
            }}
            className="input-curto"
          />
        </label>
        <label className="campo">
          <span>Iniciais</span>
          <input
            value={iniciais}
            onChange={(e) => {
              setIniciais(e.target.value)
              setErro(null)
            }}
            placeholder="A.C.S."
            autoFocus
            aria-describedby="ajuda-iniciais"
          />
          <span id="ajuda-iniciais" className="campo-ajuda">
            Só as iniciais, como A.C.S. O site não guarda o nome completo.
          </span>
        </label>
        <label className="campo">
          <span>Ano em que entrou neste colégio</span>
          <select value={ano} onChange={(e) => setAno(e.target.value)}>
            {anosDeEntrada(turma.anoLetivo).map((a) => (
              <option key={a} value={a}>
                {a === turma.anoLetivo ? `${a} (entrou este ano)` : a}
              </option>
            ))}
            <option value="">Não sei</option>
          </select>
          {entrada && <span className={`campo-ajuda ${entrada.problema ? 'erro-campo' : ''}`}>Conferência: {entrada.texto}.</span>}
        </label>
      </div>
      {erro && <p className="erro-campo">{erro}</p>}
      <div className="form-acoes">
        <button type="submit" className="btn btn-primario">
          {props.rotuloSalvar}
        </button>
        <button type="button" className="btn btn-fantasma" onClick={props.aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
