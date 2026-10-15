import { ArrowRightLeft, ClipboardPaste, LogOut, Pencil, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { CartaoPedido } from '../../components/CartaoPedido'
import { Aviso, Cartao, Confirmacao, Selo, Vazio } from '../../components/ui'
import { alunosAtivos, anoLetivoAtual, pedidosPendentes, turmasDoColegio } from '../../lib/consultas'
import { ehNovo } from '../../lib/estatisticas'
import { dataCurta, dataLonga, plural, turmaNome } from '../../lib/formato'
import { alunoEmTexto, identificacao, iniciaisRepetidas } from '../../lib/iniciais'
import { anosDeEntrada, descreverEntrada } from '../../lib/ingresso'
import { NOMES_MOTIVO } from '../../lib/pedidos'
import {
  adicionarAlunos,
  conferirLista,
  definirIngressoDosSemAno,
  editarAluno,
  editarTurma,
  excluirCadastroDoAluno,
  lerListaDeAlunos,
  mudarDeTurma,
  reativarAluno,
  registrarSaida,
  removerTurma,
  temRespostas,
} from '../../store/acoes'
import type { Aluno, Id, MotivoSaida } from '../../types'
import { FormularioAluno } from '../turma/AlunosDaTurma'
import { CabecalhoTurma } from '../turma/CabecalhoTurma'
import type { ContextoSoTurma } from '../turma/contexto'
import { FormularioTurma } from './TurmasEscola'

const SEM_ANO = 'nao'
const MOTIVOS: MotivoSaida[] = ['transferencia', 'mudou_de_cidade', 'outro']

type Acao = { tipo: 'editar' | 'saida' | 'mudar'; alunoId: Id }

/** A aba Alunos da turma, para a coordenação: a lista completa, com cadastro, correções e pedidos. */
export function AlunosCoordenacao({ db, perfil, turma, colegio, base }: ContextoSoTurma) {
  const navigate = useNavigate()
  const [editandoTurma, setEditandoTurma] = useState(false)
  const [excluindoTurma, setExcluindoTurma] = useState(false)
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [anoPadrao, setAnoPadrao] = useState<string | null>(null)
  const [anoEmMassa, setAnoEmMassa] = useState<string | null>(null)
  const [acao, setAcao] = useState<Acao | null>(null)
  const [motivo, setMotivo] = useState<MotivoSaida | 'engano'>('transferencia')
  const [destino, setDestino] = useState<Id>('')
  const [aviso, setAviso] = useState<string | null>(null)

  const anoLetivo = turma.anoLetivo
  const ativos = alunosAtivos(db, turma.id)
  const inativos = db.alunos.filter((a) => a.turmaId === turma.id && !a.ativo).sort((a, b) => a.numero - b.numero)
  const semAno = ativos.filter((a) => a.anoIngresso == null)
  const repetidas = iniciaisRepetidas(ativos)
  const pedidos = pedidosPendentes(db).filter((p) => p.turmaId === turma.id)
  const historico = db.historico.filter((e) => e.turmaId === turma.id).slice(-12).reverse()
  const outrasTurmas = turmasDoColegio(db, turma.colegioId).filter((t) => t.id !== turma.id)
  const anterior = turma.anoLetivo < anoLetivoAtual(db)

  // Turma vazia: é a lista inicial, e o ano de cada um pode não estar à mão. Turma com alunos: quem chega agora é novo.
  const anoParaQuemNaoTem = anoPadrao ?? (ativos.length ? String(anoLetivo) : SEM_ANO)
  const linhas = conferirLista(db, turma.id, lerListaDeAlunos(texto, anoLetivo), anoParaQuemNaoTem === SEM_ANO ? null : Number(anoParaQuemNaoTem))
  const comProblema = linhas.filter((l) => l.problema).length

  function adicionar() {
    if (!linhas.length || comProblema) return
    adicionarAlunos(turma.id, linhas.map(({ iniciais, numero, anoIngresso }) => ({ iniciais, numero, anoIngresso })))
    setAviso(`${plural(linhas.length, 'aluno incluído', 'alunos incluídos')} na lista. Só o número, as iniciais e o ano de entrada foram guardados.`)
    setTexto('')
    setAnoPadrao(null)
    setColando(false)
  }

  function preencherSemAno() {
    const ano = Number(anoEmMassa ?? anoLetivo)
    definirIngressoDosSemAno(turma.id, ano)
    setAviso(`${plural(semAno.length, 'aluno ficou', 'alunos ficaram')} com ano de entrada ${ano}.`)
  }

  function confirmarSaida(aluno: Aluno) {
    setAcao(null)
    if (motivo === 'engano') {
      excluirCadastroDoAluno(aluno.id)
      setAviso(`O cadastro do ${alunoEmTexto(aluno)}, feito por engano, foi excluído.`)
      return
    }
    registrarSaida(aluno.id, motivo)
    setAviso(`O ${alunoEmTexto(aluno)} saiu da lista. ${temRespostas(db, aluno.id) ? 'As respostas já lançadas continuam nos resultados.' : ''}`)
  }

  function confirmarMudanca(aluno: Aluno) {
    const nova = outrasTurmas.find((t) => t.id === destino)
    if (!nova) return
    const numero = mudarDeTurma(aluno.id, nova.id)
    setAcao(null)
    setAviso(`O ${aluno.iniciais} foi para o ${turmaNome(nova)}, com o nº ${numero}. As respostas já lançadas ficam nesta turma.`)
  }

  function voltar(aluno: Aluno) {
    const numero = reativarAluno(aluno.id)
    setAviso(numero === aluno.numero ? `O ${alunoEmTexto(aluno)} voltou para a lista.` : `O ${aluno.iniciais} voltou para a lista com o nº ${numero}, porque o ${aluno.numero} já estava com outro aluno.`)
  }

  const opcoesDeAno = (rotuloVazio: string) => (
    <>
      {anosDeEntrada(anoLetivo).map((ano) => (
        <option key={ano} value={ano}>
          {ano === anoLetivo ? `${ano} (entrou este ano)` : ano}
        </option>
      ))}
      <option value="">{rotuloVazio}</option>
    </>
  )

  const podeExcluirTurma = !db.lancamentos.some((l) => l.turmaId === turma.id && Object.keys(l.respostas).length > 0)

  return (
    <>
      <CabecalhoTurma
        db={db}
        perfil={perfil}
        turma={turma}
        colegio={colegio}
        base={base}
        aba="alunos"
        acoes={
          !editandoTurma &&
          !anterior && (
            <button className="btn" onClick={() => setEditandoTurma(true)}>
              <Pencil size={16} aria-hidden /> Editar turma
            </button>
          )
        }
      />

      {editandoTurma && (
        <>
          <FormularioTurma
            db={db}
            colegioId={turma.colegioId}
            ignorarTurmaId={turma.id}
            inicial={{ serie: turma.serie, nome: turma.nome, turno: turma.turno, professorIds: turma.professorIds }}
            rotuloSalvar="Salvar alterações"
            aoSalvar={(dados) => {
              editarTurma(turma.id, dados)
              setEditandoTurma(false)
            }}
            aoCancelar={() => setEditandoTurma(false)}
          />
          <p className="texto-2 pequeno">
            {podeExcluirTurma ? (
              <button className="btn btn-perigo btn-pequeno" onClick={() => setExcluindoTurma(true)}>
                <Trash2 size={15} aria-hidden /> Excluir turma
              </button>
            ) : (
              'Esta turma já tem respostas lançadas, então não pode ser excluída.'
            )}
          </p>
        </>
      )}

      {aviso && (
        <Aviso tom="sucesso" acoes={<button className="btn btn-pequeno btn-fantasma" onClick={() => setAviso(null)}>Fechar</button>}>
          {aviso}
        </Aviso>
      )}

      {pedidos.length > 0 && (
        <Cartao titulo={`${plural(pedidos.length, 'pedido', 'pedidos')} desta turma`} sub="Mudanças pedidas pelo professor. Só valem depois que você aprovar.">
          <div className="pedidos">
            {pedidos.map((p) => (
              <CartaoPedido key={p.id} db={db} pedido={p} />
            ))}
          </div>
        </Cartao>
      )}

      {semAno.length > 0 && !colando && (
        <Aviso
          tom="atencao"
          acoes={
            <>
              <select className="select-compacto" value={anoEmMassa ?? String(anoLetivo)} onChange={(e) => setAnoEmMassa(e.target.value)} aria-label="Ano de entrada para os alunos sem ano">
                {anosDeEntrada(anoLetivo).map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
              <button className="btn btn-pequeno btn-primario" onClick={preencherSemAno}>
                Aplicar a todos eles
              </button>
            </>
          }
        >
          {plural(semAno.length, 'aluno está', 'alunos estão')} sem o ano de entrada no colégio ({semAno.map((a) => `nº ${a.numero}`).join(', ')}). Sem ele, o
          aluno fica fora da comparação entre novos e antigos. Se não souber, pergunte à secretaria e informe um por um em “Corrigir”, ou aplique o mesmo
          ano a todos.
        </Aviso>
      )}

      {repetidas.size > 0 && (
        <Aviso tom="info">
          {[...repetidas]
            .map((iniciais) => `${listaNumeros(ativos.filter((a) => a.iniciais === iniciais))} têm as mesmas iniciais (${iniciais})`)
            .join('; ')}
          . Tudo bem: o número de chamada diferencia os dois. Na tela de lançamento, o professor vê um aviso.
        </Aviso>
      )}

      <Cartao
        titulo="Alunos"
        sub="Os alunos aparecem só pelas iniciais e pelo número de chamada, o mesmo do diário. O ano de entrada separa alunos novos e antigos nos resultados."
        acoes={
          !colando &&
          !anterior && (
            <button className="btn btn-primario" onClick={() => setColando(true)}>
              <ClipboardPaste size={16} aria-hidden /> Adicionar alunos
            </button>
          )
        }
      >
        {colando && (
          <div className="colar">
            <Aviso tom="atencao">Esta é uma versão de teste, pública: use nomes inventados, não a lista verdadeira da turma.</Aviso>
            <label className="campo">
              <span>Cole a lista, um aluno por linha</span>
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={7} placeholder={'1;Ana Clara Souza;2021\n2;Bruno Lima;2026\n3;Carolina Mendes'} autoFocus />
            </label>
            <p className="campo-ajuda">
              Pode copiar do Excel ou do sistema do colégio. Se a primeira coluna tiver o número de chamada e outra tiver o ano de entrada no colégio,
              eles vêm junto. O nome serve só para tirar as iniciais: ele fica nesta tela e não é guardado.
            </p>
            <label className="campo campo-estreito-largo">
              <span>Ano de entrada para quem não tiver o ano na lista</span>
              <select value={anoParaQuemNaoTem === SEM_ANO ? '' : anoParaQuemNaoTem} onChange={(e) => setAnoPadrao(e.target.value || SEM_ANO)}>
                {opcoesDeAno('Não informar agora')}
              </select>
            </label>
            {linhas.length > 0 && (
              <div className="tabela-rolagem">
                <table className="tabela tabela-conferencia">
                  <thead>
                    <tr>
                      <th>Como veio</th>
                      <th>Como fica no site</th>
                      <th>Entrou no colégio</th>
                      <th>
                        <span className="sr-only">Conferência</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {linhas.map((l, i) => (
                      <tr key={i} className={l.problema ? 'linha-alerta' : ''}>
                        <td className="texto-2">{l.original}</td>
                        <td>
                          <strong>{identificacao(l)}</strong>
                        </td>
                        <td>{l.anoIngresso ?? <span className="texto-2">não informado</span>}</td>
                        <td className="pequeno">
                          {l.problema ? (
                            <span className="erro-campo">{l.problema}</span>
                          ) : l.iniciaisRepetidas ? (
                            <span className="texto-2">
                              <TriangleAlert size={14} aria-hidden /> iniciais repetidas na turma
                            </span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="form-acoes">
              <button className="btn btn-primario" onClick={adicionar} disabled={!linhas.length || comProblema > 0}>
                Incluir {linhas.length ? plural(linhas.length, 'aluno', 'alunos') : 'alunos'}
              </button>
              <button
                className="btn btn-fantasma"
                onClick={() => {
                  setColando(false)
                  setTexto('')
                  setAnoPadrao(null)
                }}
              >
                Cancelar
              </button>
              {comProblema > 0 && <span className="erro-campo">Corrija as linhas destacadas antes de incluir.</span>}
            </div>
          </div>
        )}

        {!ativos.length && !colando && <Vazio titulo="Esta turma ainda não tem alunos">Use “Adicionar alunos” e cole a lista da turma.</Vazio>}

        {ativos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Aluno</th>
                  <th>Entrou no colégio</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((aluno) => {
                  if (acao?.alunoId === aluno.id && acao.tipo === 'editar') {
                    return (
                      <tr key={aluno.id}>
                        <td colSpan={4}>
                          <FormularioAluno
                            db={db}
                            turma={turma}
                            aluno={aluno}
                            titulo={`Corrigir o ${alunoEmTexto(aluno)}`}
                            inicial={aluno}
                            rotuloSalvar="Salvar"
                            aoSalvar={(dados) => {
                              editarAluno(aluno.id, dados)
                              setAcao(null)
                            }}
                            aoCancelar={() => setAcao(null)}
                          />
                        </td>
                      </tr>
                    )
                  }
                  const entrada = descreverEntrada(aluno.anoIngresso, turma)
                  return (
                    <tr key={aluno.id}>
                      <td className="num">
                        <strong>{aluno.numero}</strong>
                      </td>
                      <td>
                        {aluno.iniciais}
                        {ehNovo(aluno, anoLetivo) && <span className="tag-novo">Novo</span>}
                        {aluno.pendente && <Selo tom="ambar">Aguardando sua aprovação</Selo>}
                        {repetidas.has(aluno.iniciais) && <span className="texto-2 pequeno"> · iniciais repetidas</span>}
                      </td>
                      <td>
                        {aluno.anoIngresso ?? <span className="texto-2">não informado</span>}
                        {entrada && <span className={`bloco pequeno ${entrada.problema ? 'erro-campo' : 'texto-2'}`}>{entrada.texto}</span>}
                      </td>
                      <td className="acoes">
                        {acao?.alunoId === aluno.id && acao.tipo === 'saida' ? (
                          <span className="inline-acoes">
                            <select className="select-compacto" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoSaida | 'engano')} aria-label="Por que sai da lista">
                              {MOTIVOS.map((m) => (
                                <option key={m} value={m}>
                                  {NOMES_MOTIVO[m]}
                                </option>
                              ))}
                              {!temRespostas(db, aluno.id) && <option value="engano">Foi cadastrado por engano</option>}
                            </select>
                            <button className="btn btn-pequeno btn-primario" onClick={() => confirmarSaida(aluno)}>
                              Tirar da lista
                            </button>
                            <button className="btn btn-pequeno btn-fantasma" onClick={() => setAcao(null)}>
                              Cancelar
                            </button>
                          </span>
                        ) : acao?.alunoId === aluno.id && acao.tipo === 'mudar' ? (
                          <span className="inline-acoes">
                            <select className="select-compacto" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Turma de destino">
                              <option value="">Para qual turma?</option>
                              {outrasTurmas.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {turmaNome(t)}
                                </option>
                              ))}
                            </select>
                            <button className="btn btn-pequeno btn-primario" onClick={() => confirmarMudanca(aluno)} disabled={!destino}>
                              Mudar de turma
                            </button>
                            <button className="btn btn-pequeno btn-fantasma" onClick={() => setAcao(null)}>
                              Cancelar
                            </button>
                          </span>
                        ) : (
                          !aluno.pendente && (
                            <>
                              <button className="btn btn-pequeno btn-fantasma" onClick={() => setAcao({ tipo: 'editar', alunoId: aluno.id })}>
                                <Pencil size={14} aria-hidden /> Corrigir
                              </button>
                              <button
                                className="btn btn-pequeno btn-fantasma"
                                onClick={() => {
                                  setDestino('')
                                  setAcao({ tipo: 'mudar', alunoId: aluno.id })
                                }}
                              >
                                <ArrowRightLeft size={14} aria-hidden /> Mudar de turma
                              </button>
                              <button
                                className="btn btn-pequeno btn-fantasma"
                                onClick={() => {
                                  setMotivo('transferencia')
                                  setAcao({ tipo: 'saida', alunoId: aluno.id })
                                }}
                              >
                                <LogOut size={14} aria-hidden /> Tirar da lista
                              </button>
                            </>
                          )
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {inativos.length > 0 && (
          <details className="inativos">
            <summary>{plural(inativos.length, 'aluno saiu', 'alunos saíram')} da turma</summary>
            <ul>
              {inativos.map((aluno) => (
                <li key={aluno.id}>
                  <span>
                    {identificacao(aluno)}
                    {aluno.saida && (
                      <span className="texto-2 pequeno">
                        {' '}
                        · {NOMES_MOTIVO[aluno.saida.motivo].toLowerCase()}, em {dataLonga(aluno.saida.em)}
                      </span>
                    )}
                  </span>
                  {!anterior && (
                    <button className="btn btn-pequeno btn-fantasma" onClick={() => voltar(aluno)}>
                      <Undo2 size={14} aria-hidden /> Voltar para a turma
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Cartao>

      {historico.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Histórico da turma</summary>
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

      <Confirmacao
        titulo={`Excluir o ${turmaNome(turma)}?`}
        aberta={excluindoTurma}
        rotuloConfirmar="Excluir a turma e a lista de alunos"
        perigo
        aoConfirmar={() => {
          removerTurma(turma.id)
          navigate('/coordenacao/turmas')
        }}
        aoFechar={() => setExcluindoTurma(false)}
      >
        <p>A turma e a lista de alunos dela saem do site. Como ainda não há respostas lançadas, nenhum resultado se perde.</p>
      </Confirmacao>
    </>
  )
}

function listaNumeros(alunos: Aluno[]): string {
  const numeros = alunos.map((a) => `nº ${a.numero}`)
  return numeros.length === 2 ? `O ${numeros[0]} e o ${numeros[1]}` : `Os ${numeros.join(', ')}`
}
