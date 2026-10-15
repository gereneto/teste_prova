import { ArrowRightLeft, LogOut, Pencil, Plus, Trash2, TriangleAlert, Undo2 } from 'lucide-react'
import { useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Aviso, Cartao, Confirmacao, Vazio } from '../../components/ui'
import { camposFaltando, descreverFaltando, NOMES_MOTIVO, type CampoAluno } from '../../lib/alunos'
import { alunosNaOrdemDoCadastro, anoLetivoAtual, turmasDoColegio } from '../../lib/consultas'
import { ehNovo } from '../../lib/estatisticas'
import { dataCurta, dataLonga, plural, turmaNome } from '../../lib/formato'
import { alunoEmTexto, formatarIniciais, identificacao } from '../../lib/iniciais'
import { anosDeEntrada } from '../../lib/ingresso'
import {
  atualizarAluno,
  criarAluno,
  editarTurma,
  excluirCadastroDoAluno,
  mudarDeTurma,
  novoId,
  reativarAluno,
  registrarSaida,
  removerTurma,
  temRespostas,
  type DadosAluno,
} from '../../store/acoes'
import type { Aluno, Db, Id, MotivoSaida, Sexo, Turma } from '../../types'
import { FormularioTurma } from '../coordenacao/TurmasEscola'
import { CabecalhoTurma } from './CabecalhoTurma'
import { useTurmaDaRota, type ContextoSoTurma } from './contexto'

/** A aba Alunos da turma. Coordenação e professores editam a lista do mesmo jeito; a coordenação é avisada do que o professor muda. */
export default function AlunosDaTurma() {
  const contexto = useTurmaDaRota()
  if ('erro' in contexto) return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  return <TelaAlunos {...contexto} />
}

// As linhas alternam as cores do símbolo da Solar, como na tela de lançamento.
const CORES_DAS_LINHAS = ['cor-vermelha', 'cor-laranja', 'cor-amarela'] as const

function TelaAlunos({ db, perfil, turma, colegio, base }: ContextoSoTurma) {
  const navigate = useNavigate()
  const coordenacao = perfil.papel === 'coordenacao'
  const [editandoTurma, setEditandoTurma] = useState(false)
  const [excluindoTurma, setExcluindoTurma] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  // A linha em branco no fim já tem o id do próximo aluno: ao ser preenchida, vira o aluno sem perder o foco.
  const [idNovo, setIdNovo] = useState(() => novoId('alu'))
  const editor = useRef<HTMLDivElement>(null)

  const anterior = turma.anoLetivo < anoLetivoAtual(db)
  const alunos = alunosNaOrdemDoCadastro(db, turma.id)
  const inativos = db.alunos.filter((a) => a.turmaId === turma.id && !a.ativo)
  const faltando = descreverFaltando(alunos)
  const contagem = new Map<string, number>()
  for (const a of alunos) if (a.numero) contagem.set(a.numero.toLowerCase(), (contagem.get(a.numero.toLowerCase()) ?? 0) + 1)
  const repetidos = [...contagem].filter(([, n]) => n > 1).map(([numero]) => numero)
  const historico = db.historico.filter((e) => e.turmaId === turma.id).slice(-12).reverse()
  const outrasTurmas = turmasDoColegio(db, turma.colegioId).filter((t) => t.id !== turma.id)
  const podeExcluirTurma = coordenacao && !db.lancamentos.some((l) => l.turmaId === turma.id && Object.keys(l.respostas).length > 0)

  function criar(id: Id, dados: Partial<DadosAluno>) {
    criarAluno(turma.id, id, dados)
    setIdNovo(novoId('alu'))
  }

  function focarLinhaNova() {
    editor.current?.querySelector<HTMLInputElement>('.linha-aluno.nova input')?.focus()
  }

  // Enter passa para a próxima casa, como o Tab.
  function aoTeclar(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)) return
    e.preventDefault()
    const campos = [...(editor.current?.querySelectorAll<HTMLElement>('[data-campo]') ?? [])]
    campos[campos.indexOf(e.target) + 1]?.focus()
  }

  const cabecalho = (
    <CabecalhoTurma
      db={db}
      perfil={perfil}
      turma={turma}
      colegio={colegio}
      base={base}
      aba="alunos"
      acoes={
        coordenacao &&
        !anterior &&
        !editandoTurma && (
          <button className="btn" onClick={() => setEditandoTurma(true)}>
            <Pencil size={16} aria-hidden /> Editar turma
          </button>
        )
      }
    />
  )

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

      {faltando && (
        <Aviso tom="atencao">
          <strong>Faltam dados.</strong> {faltando}. As casas em amarelo mostram o que completar.
        </Aviso>
      )}
      {repetidos.length > 0 && (
        <Aviso tom="atencao">
          {repetidos.length === 1 ? `O nº ${repetidos[0]} aparece` : `Os números ${repetidos.join(', ')} aparecem`} mais de uma vez na lista. Confira
          no diário.
        </Aviso>
      )}

      <Cartao
        titulo="Alunos da turma"
        sub={`Cada linha é um aluno: número de chamada, iniciais, sexo e ano em que entrou no colégio. Tudo é salvo na hora, e dá para deixar uma casa em branco e completar depois.${
          perfil.papel === 'professor' ? ' A coordenação recebe um aviso de cada mudança.' : ''
        }`}
      >
        <div className="editor-alunos" ref={editor} onKeyDown={aoTeclar}>
          <div className="linha-aluno linha-aluno-cabecalho" aria-hidden>
            <span>Nº na chamada</span>
            <span>Iniciais</span>
            <span>Sexo</span>
            <span>Entrou no colégio</span>
            <span />
          </div>
          {/* Uma lista só, com a linha em branco no fim: assim, quando ela vira aluno (mesma key), o React
              mantém a linha e o foco continua na casa em que a pessoa está digitando. */}
          {[
            ...alunos.map((aluno, i) => (
              <LinhaAluno
                key={aluno.id}
                db={db}
                turma={turma}
                aluno={aluno}
                cor={CORES_DAS_LINHAS[i % CORES_DAS_LINHAS.length]}
                repetido={repetidos.includes(aluno.numero.toLowerCase())}
                outrasTurmas={coordenacao ? outrasTurmas : []}
                aoAvisar={setAviso}
              />
            )),
            <LinhaAluno
              key={idNovo}
              db={db}
              turma={turma}
              aluno={null}
              cor={CORES_DAS_LINHAS[alunos.length % CORES_DAS_LINHAS.length]}
              repetido={false}
              outrasTurmas={[]}
              aoCriar={(dados) => criar(idNovo, dados)}
              aoAvisar={setAviso}
            />,
          ]}
        </div>
        <div className="editor-alunos-rodape">
          <button className="btn" onClick={focarLinhaNova}>
            <Plus size={16} aria-hidden /> Adicionar aluno
          </button>
          <p className="texto-2 pequeno">
            Para incluir um aluno, preencha a última linha. <kbd>Enter</kbd> ou <kbd>Tab</kbd> passa para a próxima casa.
          </p>
        </div>

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
                  <button
                    className="btn btn-pequeno btn-fantasma"
                    onClick={() => {
                      reativarAluno(aluno.id)
                      setAviso(`O ${alunoEmTexto(aluno)} voltou para a lista.`)
                    }}
                  >
                    <Undo2 size={14} aria-hidden /> Pôr de volta na lista
                  </button>
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

const MOTIVOS: MotivoSaida[] = ['transferencia', 'mudou_de_cidade', 'outro']

/** Uma linha do editor: número, iniciais, sexo e ano de entrada. Sem aluno, é a linha em branco que inclui um novo. */
function LinhaAluno(props: {
  db: Db
  turma: Turma
  aluno: Aluno | null
  cor: string
  repetido: boolean
  outrasTurmas: Turma[]
  aoCriar?: (dados: Partial<DadosAluno>) => void
  aoAvisar: (texto: string) => void
}) {
  const { db, turma, aluno, cor, repetido, outrasTurmas } = props
  const [acao, setAcao] = useState<'saida' | 'mudar' | null>(null)
  const [motivo, setMotivo] = useState<MotivoSaida | 'engano'>('transferencia')
  const [destino, setDestino] = useState<Id>('')
  const faltam = aluno ? camposFaltando(aluno) : []

  function salvar(dados: Partial<DadosAluno>) {
    if (aluno) atualizarAluno(aluno.id, dados)
    else if (Object.values(dados).some((v) => v !== '' && v != null)) props.aoCriar?.(dados)
  }

  function confirmarSaida(e: FormEvent) {
    e.preventDefault()
    if (!aluno) return
    setAcao(null)
    if (motivo === 'engano') {
      excluirCadastroDoAluno(aluno.id)
      props.aoAvisar(`O cadastro do ${alunoEmTexto(aluno)}, feito por engano, foi excluído.`)
      return
    }
    registrarSaida(aluno.id, motivo)
    props.aoAvisar(`O ${alunoEmTexto(aluno)} saiu da lista.${temRespostas(db, aluno.id) ? ' As respostas já lançadas continuam nos resultados.' : ''}`)
  }

  function confirmarMudanca(e: FormEvent) {
    e.preventDefault()
    const nova = outrasTurmas.find((t) => t.id === destino)
    if (!aluno || !nova) return
    mudarDeTurma(aluno.id, nova.id)
    setAcao(null)
    props.aoAvisar(`O ${alunoEmTexto(aluno)} foi para o ${turmaNome(nova)}. As respostas já lançadas ficam nesta turma.`)
  }

  const casa = (campo: CampoAluno) => `linha-aluno-casa ${aluno && faltam.includes(campo) ? 'faltando' : ''}`

  return (
    <div className={`linha-aluno ${cor} ${aluno ? '' : 'nova'}`}>
      <span className={`${casa('numero')} ${repetido ? 'repetido' : ''}`} data-rotulo="Nº na chamada">
        <input
          data-campo
          key={aluno?.numero ?? ''}
          defaultValue={aluno?.numero ?? ''}
          placeholder={aluno ? 'falta' : 'Nº'}
          aria-label={aluno ? `Número de chamada de ${identificacao(aluno)}` : 'Número de chamada do novo aluno'}
          maxLength={20}
          onBlur={(e: FocusEvent<HTMLInputElement>) => {
            const valor = e.currentTarget.value.trim()
            if (valor !== (aluno?.numero ?? '')) salvar({ numero: valor })
          }}
        />
      </span>
      <span className={casa('iniciais')} data-rotulo="Iniciais">
        <input
          data-campo
          key={aluno?.iniciais ?? ''}
          defaultValue={aluno?.iniciais ?? ''}
          placeholder={aluno ? 'falta' : 'Iniciais'}
          aria-label={aluno ? `Iniciais do nº ${aluno.numero || 'sem número'}` : 'Iniciais do novo aluno'}
          maxLength={20}
          autoCapitalize="characters"
          onInput={(e) => {
            const campo = e.currentTarget
            const posicao = campo.selectionStart
            campo.value = campo.value.toUpperCase()
            if (posicao != null) campo.setSelectionRange(posicao, posicao)
          }}
          onBlur={(e: FocusEvent<HTMLInputElement>) => {
            const valor = formatarIniciais(e.currentTarget.value)
            e.currentTarget.value = valor
            if (valor !== (aluno?.iniciais ?? '')) salvar({ iniciais: valor })
          }}
        />
      </span>
      <span className={`${casa('sexo')} linha-aluno-sexo`} role="group" aria-label="Sexo" data-rotulo="Sexo">
        {(['F', 'M'] as Sexo[]).map((sexo) => (
          <button
            key={sexo}
            type="button"
            className={`bolha ${aluno?.sexo === sexo ? 'marcada' : ''}`}
            aria-pressed={aluno?.sexo === sexo}
            aria-label={sexo === 'F' ? 'Feminino' : 'Masculino'}
            onClick={() => salvar({ sexo: aluno?.sexo === sexo ? null : sexo })}
          >
            {sexo}
          </button>
        ))}
      </span>
      <span className={casa('anoIngresso')} data-rotulo="Entrou no colégio">
        <select
          data-campo
          value={aluno?.anoIngresso ?? ''}
          aria-label="Ano em que entrou no colégio"
          onChange={(e) => salvar({ anoIngresso: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{aluno ? 'falta' : 'Ano'}</option>
          {anosDeEntrada(turma.anoLetivo).map((ano) => (
            <option key={ano} value={ano}>
              {ano === turma.anoLetivo ? `${ano} (este ano)` : ano}
            </option>
          ))}
        </select>
      </span>
      <span className="linha-aluno-acoes">
        {aluno && acao === null && (
          <>
            {ehNovo(aluno, turma.anoLetivo) && <span className="tag-novo">Novo</span>}
            {outrasTurmas.length > 0 && (
              <button type="button" className="btn btn-pequeno btn-fantasma" onClick={() => setAcao('mudar')} aria-label={`Mudar ${identificacao(aluno)} de turma`}>
                <ArrowRightLeft size={14} aria-hidden /> Mudar de turma
              </button>
            )}
            <button
              type="button"
              className="btn btn-pequeno btn-fantasma"
              onClick={() => {
                setMotivo('transferencia')
                setAcao('saida')
              }}
              aria-label={`Tirar ${identificacao(aluno)} da lista`}
            >
              <LogOut size={14} aria-hidden /> Tirar da lista
            </button>
          </>
        )}
        {aluno && acao === 'saida' && (
          <form className="inline-acoes" onSubmit={confirmarSaida}>
            <select className="select-compacto" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoSaida | 'engano')} aria-label="Por que sai da lista">
              {MOTIVOS.map((m) => (
                <option key={m} value={m}>
                  {NOMES_MOTIVO[m]}
                </option>
              ))}
              {!temRespostas(db, aluno.id) && <option value="engano">Foi cadastrado por engano</option>}
            </select>
            <button type="submit" className="btn btn-pequeno btn-primario">
              Tirar da lista
            </button>
            <button type="button" className="btn btn-pequeno btn-fantasma" onClick={() => setAcao(null)}>
              Cancelar
            </button>
          </form>
        )}
        {aluno && acao === 'mudar' && (
          <form className="inline-acoes" onSubmit={confirmarMudanca}>
            <select className="select-compacto" value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Turma de destino">
              <option value="">Para qual turma?</option>
              {outrasTurmas.map((t) => (
                <option key={t.id} value={t.id}>
                  {turmaNome(t)}
                </option>
              ))}
            </select>
            <button type="submit" className="btn btn-pequeno btn-primario" disabled={!destino}>
              Mudar
            </button>
            <button type="button" className="btn btn-pequeno btn-fantasma" onClick={() => setAcao(null)}>
              Cancelar
            </button>
          </form>
        )}
        {repetido && (
          <span className="texto-alerta pequeno">
            <TriangleAlert size={14} aria-hidden /> nº repetido
          </span>
        )}
      </span>
    </div>
  )
}
