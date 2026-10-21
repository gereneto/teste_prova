import { ArrowLeft, ArrowRight, Check, Circle, CircleDashed, CloudCheck, CloudOff, FileText, LoaderCircle, Pencil, TriangleAlert, UserX } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, Explicacao, Progresso, Selo, Vazio } from '../../components/ui'
import { corrigir, ehNovo, marcaEm, progressoDaTurma, questaoValida, respostaCompleta } from '../../lib/estatisticas'
import { dataLonga, plural } from '../../lib/formato'
import { alunoEmTexto, identificacao } from '../../lib/iniciais'
import { concluirLancamento, definirSituacao, marcarQuestao } from '../../store/acoes'
import { usePlataforma } from '../../plataforma/estado'
import { PLATAFORMA } from '../../plataforma/modo'
import { useSalvando } from '../../store/db'
import { BRANCO, LETRAS, RASURA, VAZIO, type Aluno, type Caderno, type Id, type RespostaAluno, type Situacao } from '../../types'
import { CabecalhoTurma } from './CabecalhoTurma'
import { useContextoTurma, type ContextoTurma } from './contexto'

export default function Lancamento() {
  const contexto = useContextoTurma()
  if ('erro' in contexto) {
    return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  }
  return <TelaLancamento {...contexto} />
}

const TECLAS_LETRA: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, '1': 0, '2': 1, '3': 2, '4': 3 }

// As linhas das questões alternam as cores do símbolo da Solar, o que ajuda a não pular linha ao copiar do papel.
const CORES_DAS_LINHAS = ['cor-vermelha', 'cor-laranja', 'cor-amarela'] as const

type Conferencia = { tipo: 'igual'; anterior: Aluno } | { tipo: 'brancos'; quantas: number; validas: number }

function TelaLancamento(contexto: ContextoTurma) {
  const { db, perfil, caderno, turma, colegio, lancamento, alunos, base } = contexto
  const navigate = useNavigate()
  const total = caderno.questoes.length
  const letras = LETRAS
  const resposta = (id: Id) => lancamento?.respostas[id]
  const completo = (id: Id) => respostaCompleta(caderno, resposta(id))

  const primeiraPendente = (marcas: string) => {
    for (let i = 0; i < total; i++) if (!caderno.questoes[i].anulada && marcaEm(marcas, i) === VAZIO) return i
    return total
  }
  const proximaValida = (de: number) => {
    for (let i = Math.max(0, de); i < total; i++) if (!caderno.questoes[i].anulada) return i
    return total
  }
  const anteriorValida = (de: number) => {
    for (let i = Math.min(de, total - 1); i >= 0; i--) if (!caderno.questoes[i].anulada) return i
    return proximaValida(0)
  }

  // Posição atual: o aluno e a questão que recebem a próxima marcação (questao === total: aluno terminado).
  const [cursor, setCursor] = useState(() => {
    const primeiro = alunos.find((a) => !completo(a.id)) ?? alunos[0]
    return { alunoId: primeiro?.id ?? '', questao: primeiro ? primeiraPendente(resposta(primeiro.id)?.marcas ?? '') : 0 }
  })
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [conferencia, setConferencia] = useState<Conferencia | null>(null)
  // Conferências já respondidas com "Está certo": não perguntam de novo para as mesmas marcações.
  const [confirmadas, setConfirmadas] = useState<Set<string>>(() => new Set())

  const indiceAluno = alunos.findIndex((a) => a.id === cursor.alunoId)
  const aluno: Aluno | undefined = alunos[indiceAluno]
  const respostaAtual = aluno ? resposta(aluno.id) : undefined
  const situacao: Situacao = respostaAtual?.situacao ?? 'presente'
  const marcas = respostaAtual?.marcas ?? ''
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const todosLancados = alunos.length > 0 && progresso.lancados === alunos.length
  const alunoCompleto = aluno ? completo(aluno.id) : false
  const resultados = `${base}/resultados/${caderno.id}/${turma.id}`
  const validas = caderno.questoes.filter((q) => !q.anulada).length
  const lancadas = caderno.questoes.filter((q, i) => !q.anulada && marcaEm(marcas, i) !== VAZIO).length
  const xara = aluno ? alunos.find((a) => a.id !== aluno.id && a.iniciais === aluno.iniciais) : undefined
  const chaveConferencia = aluno ? `${aluno.id}:${marcas}` : ''

  function irPara(alunoId: Id) {
    setCursor({ alunoId, questao: primeiraPendente(resposta(alunoId)?.marcas ?? '') })
    setMensagem(null)
    setConferencia(null)
  }

  function proximoPendente(ignorar?: Id): Aluno | null {
    for (let k = 1; k <= alunos.length; k++) {
      const candidato = alunos[(indiceAluno + k) % alunos.length]
      if (candidato.id !== ignorar && !completo(candidato.id)) return candidato
    }
    return null
  }

  function marcar(marca: string, indice = cursor.questao) {
    if (!aluno) return
    if (situacao !== 'presente') {
      const motivo = situacao === 'faltou' ? 'falta' : 'prova adaptada'
      setMensagem({ erro: true, texto: `O ${alunoEmTexto(aluno)} está com ${motivo}. Desfaça para lançar as respostas.` })
      return
    }
    if (indice >= total) {
      setMensagem({ erro: false, texto: 'Todas as questões deste aluno já foram lançadas. Toque numa questão para revisar ou siga para o próximo aluno.' })
      return
    }
    if (caderno.questoes[indice].anulada) return
    marcarQuestao(caderno.id, turma.id, aluno.id, indice, marca, total)
    setMensagem(null)
    setConferencia(null)
    setCursor({ alunoId: aluno.id, questao: proximaValida(indice + 1) })
  }

  /** Antes de passar ao próximo aluno, desconfia de duas coisas: a mesma prova lançada duas vezes e muitas questões em branco. */
  function precisaConferir(): Conferencia | null {
    if (!aluno || situacao !== 'presente' || confirmadas.has(chaveConferencia)) return null
    const anterior = alunos[indiceAluno - 1]
    const respostaAnterior = anterior && resposta(anterior.id)
    if (anterior && respostaAnterior?.situacao === 'presente' && completo(anterior.id) && respostaAnterior.marcas.trimEnd() === marcas.trimEnd()) {
      return { tipo: 'igual', anterior }
    }
    const brancos = caderno.questoes.filter((q, i) => questaoValida(q) && marcaEm(marcas, i) === BRANCO).length
    if (validas > 0 && brancos * 2 >= validas) return { tipo: 'brancos', quantas: brancos, validas }
    return null
  }

  function seguir() {
    setConferencia(null)
    const seguinte = proximoPendente()
    if (seguinte) irPara(seguinte.id)
    else setMensagem({ erro: false, texto: 'Todos os alunos foram lançados. Confira e conclua o lançamento.' })
  }

  function proximoAluno() {
    if (!aluno) return
    if (!alunoCompleto) {
      const faltam = caderno.questoes.filter((q, i) => !q.anulada && marcaEm(marcas, i) === VAZIO).length
      setMensagem({
        erro: true,
        texto: `Falta lançar ${plural(faltam, 'questão', 'questões')} do ${alunoEmTexto(aluno)}. Se o aluno não respondeu, use “Em branco”.`,
      })
      return
    }
    const duvida = precisaConferir()
    if (duvida) {
      setConferencia(duvida)
      return
    }
    seguir()
  }

  function estaCerto() {
    setConfirmadas(new Set(confirmadas).add(chaveConferencia))
    seguir()
  }

  function alternarSituacao(nova: Exclude<Situacao, 'presente'>) {
    if (!aluno) return
    const valor: Situacao = situacao === nova ? 'presente' : nova
    definirSituacao(caderno.id, turma.id, aluno.id, valor)
    setMensagem(null)
    setConferencia(null)
    if (valor === 'presente') {
      setCursor({ alunoId: aluno.id, questao: primeiraPendente(marcas) })
      return
    }
    const seguinte = proximoPendente(aluno.id)
    if (seguinte) irPara(seguinte.id)
  }

  function concluir() {
    concluirLancamento(caderno.id, turma.id)
    navigate(resultados)
  }

  function aoTeclar(e: KeyboardEvent) {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const alvo = e.target instanceof HTMLElement ? e.target : null
    if (alvo?.closest('input, textarea, select, dialog')) return
    const tecla = e.key.toLowerCase()
    // Enter ou espaço num botão focado com Tab continuam acionando o botão.
    if ((tecla === 'enter' || tecla === ' ') && alvo?.closest('button, a')) return
    const letra = TECLAS_LETRA[tecla]
    if (letra !== undefined) {
      e.preventDefault()
      marcar(LETRAS[letra])
      return
    }
    if (tecla === ' ' || tecla === '0' || tecla === '-') marcar(BRANCO)
    else if (tecla === 'x' || tecla === 'r' || tecla === '*') marcar(RASURA)
    else if (tecla === 'backspace' || tecla === 'arrowup') setCursor((c) => ({ ...c, questao: anteriorValida(c.questao - 1) }))
    else if (tecla === 'arrowdown') setCursor((c) => ({ ...c, questao: proximaValida(c.questao + 1) }))
    else if (tecla === 'enter') (conferencia ? estaCerto : proximoAluno)()
    else return
    e.preventDefault()
  }

  const teclado = useRef(aoTeclar)
  useEffect(() => {
    teclado.current = aoTeclar
  })
  useEffect(() => {
    const ouvir = (e: KeyboardEvent) => teclado.current(e)
    window.addEventListener('keydown', ouvir)
    return () => window.removeEventListener('keydown', ouvir)
  }, [])

  // Mantém à vista a questão atual; com o aluno terminado, o botão “Próximo aluno” (importante no celular).
  useEffect(() => {
    const alvo = cursor.questao >= total ? document.querySelector('.lanc-acoes') : document.querySelector('.questao.atual')
    alvo?.scrollIntoView({ block: 'nearest' })
  }, [cursor, total])
  useEffect(() => {
    document.querySelector('.lanc-lista-item.atual')?.scrollIntoView({ block: 'nearest' })
  }, [cursor.alunoId])
  useEffect(() => {
    if (!aluno && alunos.length) setCursor({ alunoId: alunos[0].id, questao: 0 })
  }, [aluno, alunos])

  // Depois de um clique com o mouse, tira o foco do botão para o teclado voltar a lançar respostas.
  function soltarFoco(e: MouseEvent) {
    if (e.detail > 0 && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur()
  }

  const cabecalho = <CabecalhoTurma db={db} perfil={perfil} turma={turma} colegio={colegio} base={base} aba="lancar" caderno={caderno} acoes={<IndicadorSalvo />} />

  if (!alunos.length) {
    return (
      <>
        {cabecalho}
        <Vazio
          titulo="Esta turma ainda não tem alunos no site"
          acao={
            <Link className="btn btn-primario" to={`${base}/turma/${turma.id}/alunos`}>
              Ir para a lista de alunos
            </Link>
          }
        >
          {perfil.papel === 'professor'
            ? 'A coordenação cadastra a lista da turma. Se precisar, você pode pedir a inclusão de um aluno na aba Alunos.'
            : 'Cole a lista da secretaria na aba Alunos.'}
        </Vazio>
      </>
    )
  }

  // Letras lançadas em blocos de 5, como na folha, para conferir com o papel.
  const blocos: string[] = []
  for (let i = 0; i < total; i += 5) {
    const trecho = caderno.questoes
      .slice(i, i + 5)
      .map((q, k) => {
        const marca = marcaEm(marcas, i + k)
        if (q.anulada) return 'x'
        return marca === VAZIO ? '·' : marca === BRANCO ? '–' : marca === RASURA ? '*' : marca
      })
      .join(' ')
    blocos.push(`${i + 1}–${Math.min(i + 5, total)}: ${trecho}`)
  }

  return (
    <>
      {cabecalho}

      {lancamento?.concluidoEm ? (
        <Aviso tom="sucesso" acoes={<Link className="btn btn-pequeno" to={resultados}>Ver resultados</Link>}>
          Lançamento concluído em {dataLonga(lancamento.concluidoEm)}. Você ainda pode revisar respostas: os resultados se atualizam na hora.
        </Aviso>
      ) : todosLancados ? (
        <Aviso
          tom="sucesso"
          acoes={
            <button className="btn btn-primario" onClick={concluir}>
              <Check size={16} aria-hidden /> Concluir lançamento
            </button>
          }
        >
          Todos os alunos foram lançados. Confira e conclua: assim a coordenação e a Solar sabem que a turma terminou.
        </Aviso>
      ) : null}

      <div className="lanc" onClick={soltarFoco}>
        <aside className="lanc-lista" aria-label="Alunos da turma">
          <div className="lanc-lista-topo">
            <span>
              <strong>{progresso.lancados}</strong> de {progresso.total} lançados
            </span>
            <Progresso valor={progresso.lancados} total={progresso.total} rotulo="Alunos lançados" />
          </div>
          <ol>
            {alunos.map((a) => (
              <ItemAluno key={a.id} aluno={a} caderno={caderno} resposta={resposta(a.id)} atual={a.id === aluno?.id} aoEscolher={() => irPara(a.id)} />
            ))}
          </ol>
        </aside>

        {aluno && (
          <section className="lanc-principal cartao" aria-label={`Respostas do ${identificacao(aluno)}`}>
            <div className="lanc-aluno">
              <div className="lanc-aluno-id">
                <span className="lanc-numero">
                  <span className="lanc-numero-rotulo">Nº</span> {aluno.numero || '—'}
                </span>
                <div>
                  <h2>
                    {aluno.iniciais}
                    {ehNovo(aluno, turma.anoLetivo) && <span className="tag-novo">Novo no colégio</span>}
                    {!aluno.ativo && <Selo>Não está mais na turma</Selo>}
                  </h2>
                  <p className="texto-2 pequeno">
                    Aluno {indiceAluno + 1} de {alunos.length}
                    {aluno.anoIngresso ? ` · entrou no colégio em ${aluno.anoIngresso}` : ''}
                  </p>
                </div>
              </div>
              <div className="lanc-situacoes">
                <button className={`btn ${situacao === 'faltou' ? 'btn-marcado' : ''}`} aria-pressed={situacao === 'faltou'} onClick={() => alternarSituacao('faltou')}>
                  <UserX size={16} aria-hidden /> Faltou
                </button>
                <button className={`btn ${situacao === 'adaptada' ? 'btn-marcado' : ''}`} aria-pressed={situacao === 'adaptada'} onClick={() => alternarSituacao('adaptada')}>
                  <FileText size={16} aria-hidden /> Prova adaptada
                </button>
                <Explicacao rotulo="O que é prova adaptada?">Para quem fez uma versão diferente da prova. O aluno fica fora das médias da turma.</Explicacao>
              </div>
            </div>

            <p className="lanc-confira">
              {aluno.numero ? (
                <>
                  Confira se o número escrito na prova é o <strong>{aluno.numero}</strong> antes de lançar.
                </>
              ) : (
                <>Este aluno está sem número de chamada. Confira as iniciais e complete o número na aba Alunos.</>
              )}
              {xara && (
                <span className="lanc-xara">
                  <TriangleAlert size={15} aria-hidden /> Atenção: há outro {aluno.iniciais} nesta turma, o {alunoEmTexto(xara)}.
                </span>
              )}
            </p>

            {situacao !== 'presente' ? (
              <div className="lanc-ausente">
                <p>
                  O {alunoEmTexto(aluno)} {situacao === 'faltou' ? 'faltou' : 'fez uma prova adaptada'} e fica fora das médias da turma.
                </p>
                <button className="btn" onClick={() => alternarSituacao(situacao)}>
                  Desfazer
                </button>
              </div>
            ) : (
              <>
                <p className="lanc-dica">Errou? Toque na letra certa. Rasurada é quando o aluno marcou mais de uma alternativa.</p>
                <div className="questoes" style={{ gridTemplateRows: `repeat(${Math.min(10, total)}, auto)` }}>
                  {caderno.questoes.map((q, i) => {
                    const marca = marcaEm(marcas, i)
                    const classes = [
                      'questao',
                      CORES_DAS_LINHAS[i % CORES_DAS_LINHAS.length],
                      i === cursor.questao && 'atual',
                      q.anulada && 'anulada',
                      marca !== VAZIO && 'respondida',
                    ]
                    return (
                      <div
                        key={i}
                        className={classes.filter(Boolean).join(' ')}
                        onClick={(e) => {
                          if (!q.anulada && !(e.target as HTMLElement).closest('button')) setCursor({ alunoId: aluno.id, questao: i })
                        }}
                      >
                        <span className="questao-num">{i + 1}</span>
                        <div className="questao-bolhas">
                          {letras.map((letra) => (
                            <button
                              key={letra}
                              type="button"
                              className={`bolha ${marca === letra ? 'marcada' : ''}`}
                              disabled={q.anulada}
                              aria-pressed={marca === letra}
                              aria-label={`Questão ${i + 1}, alternativa ${letra}`}
                              onClick={() => marcar(letra, i)}
                            >
                              {letra}
                            </button>
                          ))}
                        </div>
                        <div className="questao-extras">
                          {q.anulada ? (
                            <span className="questao-anulada">Questão anulada</span>
                          ) : (
                            <>
                              <button
                                type="button"
                                className={`opcao-extra ${marca === BRANCO ? 'marcada' : ''}`}
                                aria-pressed={marca === BRANCO}
                                aria-label={`Questão ${i + 1}, em branco`}
                                onClick={() => marcar(BRANCO, i)}
                              >
                                Em branco
                              </button>
                              <button
                                type="button"
                                className={`opcao-extra ${marca === RASURA ? 'marcada' : ''}`}
                                aria-pressed={marca === RASURA}
                                aria-label={`Questão ${i + 1}, rasurada`}
                                onClick={() => marcar(RASURA, i)}
                              >
                                Rasurada
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <p className="lanc-blocos" aria-label="Respostas lançadas, de 5 em 5">
                  {blocos.map((b) => (
                    <span key={b}>{b}</span>
                  ))}
                </p>
              </>
            )}

            {conferencia && (
              <div className="lanc-conferencia" role="alert">
                <p>
                  <TriangleAlert size={18} aria-hidden />{' '}
                  {conferencia.tipo === 'igual'
                    ? `As respostas do ${alunoEmTexto(aluno)} são iguais às do ${alunoEmTexto(conferencia.anterior)}. Você lançou a mesma prova duas vezes?`
                    : `${conferencia.quantas} das ${conferencia.validas} questões estão em branco. O aluno faltou?`}
                </p>
                <div className="form-acoes">
                  {conferencia.tipo === 'brancos' && (
                    <button className="btn" onClick={() => alternarSituacao('faltou')}>
                      <UserX size={16} aria-hidden /> Marcar que faltou
                    </button>
                  )}
                  {conferencia.tipo === 'igual' && (
                    <button className="btn" onClick={() => setConferencia(null)}>
                      Revisar o {alunoEmTexto(aluno)}
                    </button>
                  )}
                  <button className="btn btn-primario" onClick={estaCerto}>
                    Está certo, seguir
                  </button>
                </div>
              </div>
            )}

            <div className="lanc-acoes">
              <div className="lanc-navegacao">
                {indiceAluno > 0 && (
                  <button className="btn btn-fantasma" onClick={() => irPara(alunos[indiceAluno - 1].id)}>
                    <ArrowLeft size={16} aria-hidden /> Anterior
                  </button>
                )}
                <button className={`btn ${alunoCompleto ? 'btn-primario' : ''}`} onClick={proximoAluno}>
                  Próximo aluno <ArrowRight size={16} aria-hidden />
                </button>
              </div>
            </div>
            <p className={`lanc-msg ${mensagem?.erro ? 'erro' : ''}`} role="status" aria-live="polite">
              {mensagem?.texto}
            </p>
            <p className="atalhos">
              No teclado: <kbd>1</kbd> a <kbd>{LETRAS.length}</kbd> marca e avança · <kbd>espaço</kbd> em branco · <kbd>X</kbd>{' '}
              rasurada · <kbd>⌫</kbd> volta uma questão · <kbd>Enter</kbd> próximo aluno
            </p>
          </section>
        )}
      </div>

      {aluno && (
        <div className="lanc-barra-celular">
          <span>
            <strong>Nº {aluno.numero || '—'}</strong> · {situacao === 'presente' ? `${lancadas} de ${validas} questões` : situacao === 'faltou' ? 'faltou' : 'prova adaptada'}
          </span>
          <button className={`btn ${alunoCompleto ? 'btn-primario' : ''}`} onClick={proximoAluno}>
            Próximo aluno <ArrowRight size={16} aria-hidden />
          </button>
        </div>
      )}
    </>
  )
}

function ItemAluno(props: { aluno: Aluno; caderno: Caderno; resposta: RespostaAluno | undefined; atual: boolean; aoEscolher: () => void }) {
  const { aluno, caderno, resposta, atual } = props
  const completo = respostaCompleta(caderno, resposta)
  let Icone = Circle
  let detalhe = ''
  if (resposta?.situacao === 'faltou') {
    Icone = UserX
    detalhe = 'faltou'
  } else if (resposta?.situacao === 'adaptada') {
    Icone = FileText
    detalhe = 'adaptada'
  } else if (completo && resposta) {
    Icone = Check
    const correcao = corrigir(caderno, resposta.marcas)
    detalhe = correcao.validas ? `${correcao.acertos}/${correcao.validas}` : 'feito'
  } else if (resposta) {
    Icone = CircleDashed
    detalhe = 'falta terminar'
  }
  if (atual) Icone = Pencil
  return (
    <li>
      <button className={`lanc-lista-item ${atual ? 'atual' : ''} ${completo ? 'feito' : ''}`} onClick={props.aoEscolher} aria-current={atual || undefined}>
        <Icone size={15} aria-hidden className="lanc-lista-icone" />
        <span className="lanc-lista-nome">
          <strong>{aluno.numero || '—'}</strong> · {aluno.iniciais || '—'}
        </span>
        <span className="lanc-lista-detalhe">{detalhe}</span>
      </button>
    </li>
  )
}

function IndicadorSalvo() {
  const salvando = useSalvando()
  const { fila } = usePlataforma()
  // Na plataforma, cada aluno fica guardado neste aparelho até o banco confirmar (a fila do lançamento).
  if (PLATAFORMA && fila.semRede && fila.pendentes) {
    return (
      <span className="indicador-salvo indicador-sem-rede" aria-live="polite">
        <CloudOff size={15} aria-hidden /> Sem internet: {plural(fila.pendentes, 'aluno guardado', 'alunos guardados')} neste aparelho. Vão para o servidor
        quando a internet voltar.
      </span>
    )
  }
  return (
    <span className="indicador-salvo" aria-live="polite">
      {salvando ? (
        <>
          <LoaderCircle size={15} className="girando" aria-hidden /> Salvando…
        </>
      ) : (
        <>
          <CloudCheck size={15} aria-hidden /> {PLATAFORMA ? 'Tudo salvo' : 'Tudo salvo neste navegador'}
        </>
      )}
    </span>
  )
}
