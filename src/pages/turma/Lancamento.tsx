import { ArrowLeft, ArrowRight, ChartColumn, Check, Circle, CircleDashed, CloudCheck, FileText, LoaderCircle, Pencil, UserX } from 'lucide-react'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, Cabecalho, Progresso, Selo, Vazio } from '../../components/ui'
import { corrigir, marcaEm, progressoDaTurma, respostaCompleta } from '../../lib/estatisticas'
import { dataLonga, plural, turmaNome } from '../../lib/formato'
import { concluirLancamento, definirSituacao, marcarQuestao } from '../../store/acoes'
import { useSalvando } from '../../store/db'
import { BRANCO, LETRAS, RASURA, VAZIO, type Aluno, type Caderno, type Id, type RespostaAluno, type Situacao } from '../../types'
import { useContextoTurma, type ContextoTurma } from './contexto'

export default function Lancamento() {
  const contexto = useContextoTurma()
  if ('erro' in contexto) {
    return (
      <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar</Link>} />
    )
  }
  return <TelaLancamento {...contexto} />
}

const TECLAS_LETRA: Record<string, number> = { a: 0, b: 1, c: 2, d: 3, e: 4, '1': 0, '2': 1, '3': 2, '4': 3, '5': 4 }

// As linhas das questões alternam as cores do símbolo da Solar, o que ajuda a não pular linha ao copiar do papel.
const CORES_DAS_LINHAS = ['cor-vermelha', 'cor-laranja', 'cor-amarela'] as const

function TelaLancamento({ caderno, avaliacao, turma, colegio, lancamento, alunos, base }: ContextoTurma) {
  const navigate = useNavigate()
  const total = caderno.questoes.length
  const letras = LETRAS.slice(0, caderno.numAlternativas)
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

  const indiceAluno = alunos.findIndex((a) => a.id === cursor.alunoId)
  const aluno: Aluno | undefined = alunos[indiceAluno]
  const respostaAtual = aluno ? resposta(aluno.id) : undefined
  const situacao: Situacao = respostaAtual?.situacao ?? 'presente'
  const marcas = respostaAtual?.marcas ?? ''
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const todosLancados = alunos.length > 0 && progresso.lancados === alunos.length
  const alunoCompleto = aluno ? completo(aluno.id) : false
  const resultados = `${base}/resultados/${caderno.id}/${turma.id}`

  function irPara(alunoId: Id) {
    setCursor({ alunoId, questao: primeiraPendente(resposta(alunoId)?.marcas ?? '') })
    setMensagem(null)
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
      setMensagem({ erro: true, texto: `${aluno.nome} está com ${motivo}. Desfaça para lançar as respostas.` })
      return
    }
    if (indice >= total) {
      setMensagem({ erro: false, texto: 'Todas as questões deste aluno já foram lançadas. Clique numa questão para corrigir ou siga para o próximo aluno.' })
      return
    }
    if (caderno.questoes[indice].anulada) return
    marcarQuestao(caderno.id, turma.id, aluno.id, indice, marca, total)
    setMensagem(null)
    setCursor({ alunoId: aluno.id, questao: proximaValida(indice + 1) })
  }

  function proximoAluno() {
    if (!aluno) return
    if (!alunoCompleto) {
      const faltam = caderno.questoes.filter((q, i) => !q.anulada && marcaEm(marcas, i) === VAZIO).length
      setMensagem({
        erro: true,
        texto: `Falta lançar ${plural(faltam, 'questão', 'questões')} de ${aluno.nome.split(' ')[0]}. Se o aluno não respondeu, use “Em branco”.`,
      })
      return
    }
    const seguinte = proximoPendente()
    if (seguinte) irPara(seguinte.id)
    else setMensagem({ erro: false, texto: 'Todos os alunos foram lançados. Confira e conclua o lançamento.' })
  }

  function alternarSituacao(nova: Exclude<Situacao, 'presente'>) {
    if (!aluno) return
    const valor: Situacao = situacao === nova ? 'presente' : nova
    definirSituacao(caderno.id, turma.id, aluno.id, valor)
    setMensagem(null)
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
    if (alvo?.closest('input, textarea, select')) return
    const tecla = e.key.toLowerCase()
    // Enter ou espaço num botão focado com Tab continuam acionando o botão.
    if ((tecla === 'enter' || tecla === ' ') && alvo?.closest('button, a')) return
    const letra = TECLAS_LETRA[tecla]
    if (letra !== undefined) {
      if (letra < caderno.numAlternativas) {
        e.preventDefault()
        marcar(LETRAS[letra])
      }
      return
    }
    if (tecla === ' ' || tecla === '0' || tecla === '-') marcar(BRANCO)
    else if (tecla === 'x' || tecla === 'r' || tecla === '*') marcar(RASURA)
    else if (tecla === 'backspace' || tecla === 'arrowup') setCursor((c) => ({ ...c, questao: anteriorValida(c.questao - 1) }))
    else if (tecla === 'arrowdown') setCursor((c) => ({ ...c, questao: proximaValida(c.questao + 1) }))
    else if (tecla === 'enter') proximoAluno()
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

  const cabecalho = (
    <Cabecalho
      sobretitulo={avaliacao.titulo}
      titulo="Lançar respostas"
      subtitulo={`${turmaNome(turma)} · ${colegio.nome}`}
      voltar={{ para: base, rotulo: base === '/professor' ? 'Minhas turmas' : 'Painel do colégio' }}
      acoes={
        <>
          <IndicadorSalvo />
          <Link className="btn" to={resultados}>
            <ChartColumn size={16} aria-hidden /> Resultados
          </Link>
        </>
      }
    />
  )

  if (!alunos.length) {
    return (
      <>
        {cabecalho}
        <Vazio titulo="Esta turma ainda não tem alunos">A coordenação do colégio cadastra os alunos em “Turmas e alunos”.</Vazio>
      </>
    )
  }

  return (
    <>
      {cabecalho}

      {lancamento?.concluidoEm ? (
        <Aviso tom="sucesso" acoes={<Link className="btn btn-pequeno" to={resultados}>Ver resultados</Link>}>
          Lançamento concluído em {dataLonga(lancamento.concluidoEm)}. Você ainda pode corrigir respostas: os resultados se atualizam na
          hora.
        </Aviso>
      ) : todosLancados ? (
        <Aviso
          tom="sucesso"
          acoes={
            <button className="btn btn-primario btn-pequeno" onClick={concluir}>
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
          <section className="lanc-principal cartao" aria-label={`Respostas de ${aluno.nome}`}>
            <div className="lanc-aluno">
              <div>
                <div className="texto-2 pequeno">
                  Nº {aluno.numero} · aluno {indiceAluno + 1} de {alunos.length}
                </div>
                <h2>
                  {aluno.nome} {!aluno.ativo && <Selo>saiu da turma</Selo>}
                </h2>
              </div>
              <div className="lanc-situacoes">
                <button className={`btn ${situacao === 'faltou' ? 'btn-marcado' : ''}`} aria-pressed={situacao === 'faltou'} onClick={() => alternarSituacao('faltou')}>
                  <UserX size={16} aria-hidden /> Faltou
                </button>
                <button
                  className={`btn ${situacao === 'adaptada' ? 'btn-marcado' : ''}`}
                  aria-pressed={situacao === 'adaptada'}
                  onClick={() => alternarSituacao('adaptada')}
                  title="Para quem fez uma versão diferente da prova: o aluno fica fora das médias"
                >
                  <FileText size={16} aria-hidden /> Prova adaptada
                </button>
              </div>
            </div>

            {situacao !== 'presente' ? (
              <div className="lanc-ausente">
                <p>
                  {aluno.nome.split(' ')[0]} {situacao === 'faltou' ? 'faltou' : 'fez uma prova adaptada'} e fica fora das médias da turma.
                </p>
                <button className="btn" onClick={() => alternarSituacao(situacao)}>
                  Desfazer
                </button>
              </div>
            ) : (
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
                              title="O aluno marcou mais de uma alternativa"
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
              No teclado: <kbd>1</kbd> a <kbd>{caderno.numAlternativas}</kbd> marca e avança · <kbd>espaço</kbd> em branco · <kbd>X</kbd>{' '}
              rasurada · <kbd>⌫</kbd> volta uma questão · <kbd>Enter</kbd> próximo aluno
            </p>
          </section>
        )}
      </div>
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
    detalhe = correcao.validas ? `${correcao.acertos}/${correcao.validas}` : 'ok'
  } else if (resposta) {
    Icone = CircleDashed
    detalhe = 'incompleto'
  }
  if (atual) Icone = Pencil
  return (
    <li>
      <button className={`lanc-lista-item ${atual ? 'atual' : ''} ${completo ? 'feito' : ''}`} onClick={props.aoEscolher} aria-current={atual || undefined}>
        <Icone size={15} aria-hidden className="lanc-lista-icone" />
        <span className="lanc-lista-nome">
          {aluno.numero}. {aluno.nome}
        </span>
        <span className="lanc-lista-detalhe">{detalhe}</span>
      </button>
    </li>
  )
}

function IndicadorSalvo() {
  const salvando = useSalvando()
  return (
    <span className="indicador-salvo" aria-live="polite">
      {salvando ? (
        <>
          <LoaderCircle size={15} className="girando" aria-hidden /> Salvando…
        </>
      ) : (
        <>
          <CloudCheck size={15} aria-hidden /> Salvo neste navegador
        </>
      )}
    </span>
  )
}
