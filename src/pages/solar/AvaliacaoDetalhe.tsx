import { BadgeCheck, ChartColumn, Download, MessageSquareText, Pencil, Trash2, Upload } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { SeletorHabilidade } from '../../components/SeletorHabilidade'
import { Aviso, Cabecalho, Cartao, Confirmacao, Janela, Vazio } from '../../components/ui'
import { buscarHabilidade, DISCIPLINAS } from '../../data/bncc'
import { cadernosDaAvaliacao, descreverPeriodo, permissoesDe, pessoaDoPerfil } from '../../lib/consultas'
import { dataCurta, dataLonga, plural, serieNome, tamanhoArquivo } from '../../lib/formato'
import {
  adicionarCaderno,
  aplicarGabarito,
  conferirGabarito,
  definirAlternativas,
  definirFolhaRespostas,
  definirNumeroDeQuestoes,
  editarAvaliacao,
  editarComentario,
  editarComoRetomar,
  editarQuestao,
  enviarPdf,
  removerAvaliacao,
  removerCaderno,
  removerPdf,
} from '../../store/acoes'
import { baixarPdfDoCaderno } from '../../store/arquivos'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { LETRAS, SERIES, type Caderno, type Db, type Letra, type Questao, type Serie } from '../../types'
import { FormularioAvaliacao, pendenciasDoCaderno } from './Avaliacoes'

const LIMITE_PDF_MB = 50

export default function AvaliacaoDetalhe() {
  const { avaliacaoId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const avaliacao = db.avaliacoes.find((a) => a.id === avaliacaoId)
  if (!avaliacao) return <Vazio titulo="Avaliação não encontrada" acao={<Link className="btn" to="/solar/avaliacoes">Voltar</Link>} />
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)

  const cadernos = cadernosDaAvaliacao(db, avaliacao.id)
  const serie: Serie = SERIES.find((s) => String(s) === params.get('serie')) ?? cadernos[0]?.serie ?? 1
  const caderno = cadernos.find((c) => c.serie === serie)
  const comRespostas = db.lancamentos.some((l) => cadernos.some((c) => c.id === l.cadernoId) && Object.keys(l.respostas).length)
  const historico = db.historico.filter((e) => e.cadernoId && cadernos.some((c) => c.id === e.cadernoId)).slice(-10).reverse()

  return (
    <>
      <Cabecalho
        sobretitulo="Avaliação"
        titulo={avaliacao.titulo}
        subtitulo={descreverPeriodo(avaliacao)}
        voltar={{ para: '/solar/avaliacoes', rotulo: 'Avaliações' }}
        acoes={
          <>
            {editarRede && !editando && (
              <button className="btn" onClick={() => setEditando(true)}>
                <Pencil size={16} aria-hidden /> Editar nome e datas
              </button>
            )}
            <Link className="btn" to={`/solar/resultados?avaliacao=${avaliacao.id}`}>
              <ChartColumn size={16} aria-hidden /> Resultados
            </Link>
          </>
        }
      />

      {!editarRede && <Aviso tom="info">Seu acesso é só de visualização: você vê as provas e os gabaritos, mas não muda nada.</Aviso>}

      {editando && (
        <FormularioAvaliacao
          inicial={avaliacao}
          rotuloSalvar="Salvar alterações"
          aoSalvar={(dados) => {
            editarAvaliacao(avaliacao.id, dados)
            setEditando(false)
          }}
          aoCancelar={() => setEditando(false)}
        />
      )}

      <div className="abas-series" role="tablist" aria-label="Prova de cada ano">
        {SERIES.map((s) => {
          const c = cadernos.find((x) => x.serie === s)
          const pendencias = c ? pendenciasDoCaderno(c) : []
          return (
            <button
              key={s}
              role="tab"
              aria-selected={s === serie}
              className={`aba-serie ${s === serie ? 'ativa' : ''} ${c ? '' : 'ausente'}`}
              onClick={() => setParams({ serie: String(s) }, { replace: true })}
            >
              {serieNome(s)}
              {pendencias.length > 0 && <span className="ponto-pendente" aria-label={pendencias.join(', ')} />}
            </button>
          )
        })}
      </div>

      {caderno ? (
        <EditorCaderno key={caderno.id} db={db} caderno={caderno} editavel={editarRede} />
      ) : (
        <Vazio
          titulo={`Esta avaliação não tem prova do ${serieNome(serie)}`}
          acao={
            editarRede && (
              <button className="btn btn-primario" onClick={() => adicionarCaderno(avaliacao.id, serie)}>
                Criar a prova do {serieNome(serie)}
              </button>
            )
          }
        />
      )}

      {historico.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Histórico de alterações nas provas</summary>
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

      {editarRede && (
        <div className="zona-perigo">
          <button className="btn btn-perigo" onClick={() => setExcluindo(true)}>
            <Trash2 size={16} aria-hidden /> Excluir avaliação
          </button>
        </div>
      )}

      <Confirmacao
        titulo={`Excluir a ${avaliacao.titulo}?`}
        aberta={excluindo}
        rotuloConfirmar="Excluir a avaliação e as provas"
        perigo
        aoConfirmar={() => {
          removerAvaliacao(avaliacao.id)
          navigate('/solar/avaliacoes')
        }}
        aoFechar={() => setExcluindo(false)}
      >
        <p>
          Saem do site as provas de todos os anos{comRespostas ? ' e todas as respostas já lançadas pelos professores. Os resultados desta avaliação deixam de existir' : ''}.
          Não dá para desfazer.
        </p>
      </Confirmacao>
    </>
  )
}

interface MudancaPendente {
  descricao: string
  aplicar: (motivo: string) => void
}

function EditorCaderno({ db, caderno, editavel }: { db: Db; caderno: Caderno; editavel: boolean }) {
  const [numQuestoes, setNumQuestoes] = useState(String(caderno.questoes.length))
  const [gabaritoTexto, setGabaritoTexto] = useState('')
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [mudanca, setMudanca] = useState<MudancaPendente | null>(null)
  const [motivo, setMotivo] = useState('')
  const [reduzindo, setReduzindo] = useState<number | null>(null)
  const [excluindo, setExcluindo] = useState(false)
  const [comentando, setComentando] = useState<number | null>(null)
  const letras: readonly string[] = LETRAS.slice(0, caderno.numAlternativas)
  const total = caderno.questoes.length
  const turmasComRespostas = db.lancamentos.filter((l) => l.cadernoId === caderno.id && Object.keys(l.respostas).length > 0).length
  const disciplinas = [...new Set(caderno.questoes.map((q) => q.disciplina))]
  const semGabarito = caderno.questoes.some((q) => !q.anulada && !q.gabarito)

  /** Depois que há respostas lançadas, mudar o gabarito pede um motivo, que vai para o histórico e para o aviso às turmas. */
  function mudarCorrecao(descricao: string, aplicar: (motivo?: string) => void) {
    if (!turmasComRespostas) return aplicar()
    setMotivo('')
    setMudanca({ descricao, aplicar })
  }

  function aplicarNumero() {
    const n = Number(numQuestoes)
    if (!Number.isInteger(n) || n < 1 || n > 60) return setMensagem({ erro: true, texto: 'Use um número de questões entre 1 e 60.' })
    if (n === total) return
    if (n < total && turmasComRespostas > 0) return setReduzindo(n)
    definirNumeroDeQuestoes(caderno.id, n)
    setMensagem({ erro: false, texto: `A prova agora tem ${n} questões.` })
  }

  function aplicarGabaritoTexto() {
    const encontradas = gabaritoTexto.toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean)
    if (!encontradas.length) return setMensagem({ erro: true, texto: 'Digite as letras do gabarito em sequência, como BDACB.' })
    if (encontradas.some((l) => !letras.includes(l))) return setMensagem({ erro: true, texto: `Use só as letras ${letras.join(', ')}.` })
    if (encontradas.length > total) return setMensagem({ erro: true, texto: `São ${encontradas.length} letras, mas a prova tem ${total} questões.` })
    mudarCorrecao(`aplicar o gabarito ${encontradas.join('')}`, (m) => {
      aplicarGabarito(caderno.id, encontradas as Letra[], m)
      setGabaritoTexto('')
      setMensagem({ erro: false, texto: encontradas.length === total ? 'Gabarito aplicado a todas as questões.' : `Gabarito aplicado às primeiras ${encontradas.length} questões.` })
    })
  }

  async function aoEscolherPdf(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) return setMensagem({ erro: true, texto: 'Escolha um arquivo em PDF.' })
    if (arquivo.size > LIMITE_PDF_MB * 1024 * 1024) return setMensagem({ erro: true, texto: `O PDF passa de ${LIMITE_PDF_MB} MB. Reduza o arquivo e tente de novo.` })
    setEnviando(true)
    try {
      await enviarPdf(caderno.id, arquivo)
      setMensagem({ erro: false, texto: `PDF “${arquivo.name}” guardado. Os professores do ${serieNome(caderno.serie)} já podem baixar.` })
    } catch {
      setMensagem({ erro: true, texto: 'Não foi possível guardar o PDF neste navegador. Tente de novo.' })
    } finally {
      setEnviando(false)
    }
  }

  async function baixar() {
    try {
      await baixarPdfDoCaderno(caderno)
    } catch {
      setMensagem({ erro: true, texto: 'O PDF desta prova foi enviado em outro navegador. Nesta versão de teste, cada navegador guarda os próprios arquivos.' })
    }
  }

  return (
    <Cartao
      titulo={`Prova do ${serieNome(caderno.serie)}`}
      sub={`${plural(total, 'questão', 'questões')} · ${disciplinas.join(', ')}`}
      acoes={
        <>
          {caderno.pdf && (
            <button className="btn btn-pequeno" onClick={baixar}>
              <Download size={15} aria-hidden /> Baixar a prova
            </button>
          )}
          {editavel && (
            <button className="btn btn-pequeno btn-fantasma" onClick={() => setExcluindo(true)}>
              <Trash2 size={15} aria-hidden /> Excluir prova
            </button>
          )}
        </>
      }
    >
      {caderno.conferencia ? (
        <Aviso tom="sucesso">
          Gabarito conferido com a prova impressa por {caderno.conferencia.por} em {dataLonga(caderno.conferencia.em)}.
        </Aviso>
      ) : (
        <Aviso
          tom="atencao"
          acoes={
            editavel && (
              <button className="btn btn-pequeno btn-primario" onClick={() => conferirGabarito(caderno.id)} disabled={semGabarito}>
                <BadgeCheck size={15} aria-hidden /> Marcar como conferido
              </button>
            )
          }
        >
          {semGabarito
            ? 'O gabarito ainda está incompleto.'
            : 'O gabarito ainda não foi conferido. O ideal é que uma segunda pessoa confira cada letra com a prova impressa e marque aqui.'}{' '}
          Mudar o gabarito ou anular uma questão desfaz a conferência.
        </Aviso>
      )}

      {turmasComRespostas > 0 && (
        <Aviso tom="info">
          {plural(turmasComRespostas, 'turma já lançou', 'turmas já lançaram')} respostas desta prova. Mudanças no gabarito e anulações pedem um motivo,
          recalculam os resultados na hora e aparecem como aviso para as turmas.
        </Aviso>
      )}

      <fieldset className="fieldset-livre" disabled={!editavel}>
        <div className="editor-config">
          <div className="bloco-config">
            <h3 className="subtitulo">Prova em PDF</h3>
            {caderno.pdf ? (
              <p className="pequeno">
                <strong>{caderno.pdf.nome}</strong> · {tamanhoArquivo(caderno.pdf.tamanho)} ·{' '}
                {caderno.pdf.origem === 'exemplo' ? 'arquivo de exemplo' : `enviado em ${dataLonga(caderno.pdf.enviadoEm)}`}
              </p>
            ) : (
              <p className="texto-2 pequeno">Ainda não enviado. Os professores baixam a prova por aqui para imprimir.</p>
            )}
            {editavel && (
              <div className="form-acoes">
                <label className={`btn ${caderno.pdf ? '' : 'btn-primario'}`}>
                  <Upload size={16} aria-hidden /> {enviando ? 'Guardando…' : caderno.pdf ? 'Trocar PDF' : 'Enviar PDF'}
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={aoEscolherPdf} disabled={enviando} />
                </label>
                {caderno.pdf && (
                  <button type="button" className="btn btn-fantasma" onClick={() => removerPdf(caderno.id)}>
                    Remover
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="bloco-config">
            <h3 className="subtitulo">Formato</h3>
            <div className="campo-inline">
              <span>Questões</span>
              <input
                type="number"
                min={1}
                max={60}
                value={numQuestoes}
                onChange={(e) => setNumQuestoes(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarNumero()}
                className="input-curto"
                aria-label="Número de questões"
              />
              <button type="button" className="btn btn-pequeno" onClick={aplicarNumero}>
                Aplicar
              </button>
            </div>
            <div className="campo-inline">
              <span>Alternativas</span>
              <div className="segmentos" role="group" aria-label="Número de alternativas">
                {([4, 5] as const).map((n) => (
                  <button type="button" key={n} className={`segmento ${caderno.numAlternativas === n ? 'ativo' : ''}`} onClick={() => definirAlternativas(caderno.id, n)}>
                    {n} ({LETRAS.slice(0, n).join('')})
                  </button>
                ))}
              </div>
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={caderno.usaFolhaRespostas} onChange={(e) => definirFolhaRespostas(caderno.id, e.target.checked)} />
              Os alunos marcam numa folha de respostas separada
            </label>
          </div>

          <div className="bloco-config">
            <h3 className="subtitulo">Gabarito rápido</h3>
            <p className="campo-ajuda">Digite as letras em sequência para preencher várias questões de uma vez.</p>
            <div className="campo-inline">
              <input
                value={gabaritoTexto}
                onChange={(e) => setGabaritoTexto(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && aplicarGabaritoTexto()}
                placeholder="BDACBADCCA"
                className="input-gabarito"
                aria-label="Gabarito em sequência"
              />
              <button type="button" className="btn btn-pequeno" onClick={aplicarGabaritoTexto}>
                Aplicar
              </button>
            </div>
            <p className="texto-2 pequeno">
              Atual: <span className="codigo">{caderno.questoes.map((q) => (q.anulada ? 'x' : (q.gabarito ?? '·'))).join('')}</span>
            </p>
          </div>
        </div>

      </fieldset>

      {mensagem && (
        <p className={mensagem.erro ? 'erro-campo' : 'ok-campo'} role="status">
          {mensagem.texto}
        </p>
      )}

      <div className="editor-questoes">
          <div className="editor-questoes-cabecalho" aria-hidden>
            <span>Nº</span>
            <span>Gabarito</span>
            <span>Disciplina</span>
            <span>Habilidade da BNCC</span>
            <span>Anular</span>
          </div>
          {caderno.questoes.map((q, i) => (
            <div key={i} className={`editor-questao-bloco ${q.anulada ? 'anulada' : ''}`}>
              <div className="editor-questao">
                <span className="editor-num">{i + 1}</span>
                <div className="segmentos segmentos-letras" role="radiogroup" aria-label={`Gabarito da questão ${i + 1}`}>
                  {letras.map((l) => (
                    <button
                      key={l}
                      type="button"
                      role="radio"
                      aria-checked={q.gabarito === l}
                      className={`segmento ${q.gabarito === l ? 'ativo' : ''}`}
                      disabled={!editavel}
                      onClick={() => q.gabarito !== l && mudarCorrecao(`mudar o gabarito da questão ${i + 1} para ${l}`, (m) => editarQuestao(caderno.id, i, { gabarito: l as Letra }, m))}
                    >
                      {l}
                    </button>
                  ))}
                </div>
                <select
                  value={q.disciplina}
                  disabled={!editavel}
                  aria-label={`Disciplina da questão ${i + 1}`}
                  onChange={(e) => {
                    const disciplina = e.target.value
                    const manter = buscarHabilidade(q.habilidade)?.componente === disciplina
                    editarQuestao(caderno.id, i, { disciplina, habilidade: manter ? q.habilidade : null })
                  }}
                >
                  {DISCIPLINAS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <fieldset className="fieldset-livre" disabled={!editavel}>
                  <SeletorHabilidade
                    serie={caderno.serie}
                    disciplina={q.disciplina}
                    valor={q.habilidade}
                    aoMudar={(h) =>
                      editarQuestao(caderno.id, i, h ? { habilidade: h.codigo, disciplina: DISCIPLINAS.includes(h.componente) ? h.componente : q.disciplina } : { habilidade: null })
                    }
                  />
                </fieldset>
                <div className="editor-questao-fim">
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={q.anulada}
                      disabled={!editavel}
                      onChange={(e) =>
                        mudarCorrecao(e.target.checked ? `anular a questão ${i + 1}` : `desfazer a anulação da questão ${i + 1}`, (m) =>
                          editarQuestao(caderno.id, i, { anulada: !q.anulada }, m),
                        )
                      }
                    />
                    <span className="sr-only">Anular a questão {i + 1}</span>
                    <span aria-hidden>Anulada</span>
                  </label>
                  <button
                    type="button"
                    className={`btn btn-pequeno btn-fantasma ${q.comentarios && Object.keys(q.comentarios).length ? 'com-comentario' : ''}`}
                    aria-expanded={comentando === i}
                    onClick={() => setComentando(comentando === i ? null : i)}
                  >
                    <MessageSquareText size={14} aria-hidden /> Comentários
                  </button>
                </div>
              </div>
              {comentando === i && <ComentariosQuestao caderno={caderno} indice={i} questao={q} editavel={editavel} />}
            </div>
          ))}
      </div>

      <Janela
        titulo="Mudar a correção depois do lançamento"
        aberta={mudanca !== null}
        aoFechar={() => setMudanca(null)}
        acoes={
          <>
            <button
              className="btn btn-primario"
              disabled={!motivo.trim()}
              onClick={() => {
                mudanca?.aplicar(motivo.trim())
                setMudanca(null)
              }}
            >
              Mudar e recalcular
            </button>
            <button className="btn btn-fantasma" onClick={() => setMudanca(null)}>
              Voltar sem mudar nada
            </button>
          </>
        }
      >
        <p>
          {plural(turmasComRespostas, 'turma já lançou', 'turmas já lançaram')} respostas desta prova. Ao {mudanca?.descricao}, os resultados de todas elas
          serão recalculados, e os professores e as coordenações verão um aviso com o motivo.
        </p>
        <label className="campo">
          <span>Motivo</span>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: erro de digitação no gabarito" maxLength={140} autoFocus />
        </label>
      </Janela>

      <Confirmacao
        titulo={`Tirar as últimas ${reduzindo ? total - reduzindo : 0} questões?`}
        aberta={reduzindo !== null}
        rotuloConfirmar="Tirar as questões"
        aoConfirmar={() => {
          if (reduzindo) {
            definirNumeroDeQuestoes(caderno.id, reduzindo)
            setMensagem({ erro: false, texto: `A prova agora tem ${reduzindo} questões.` })
          }
          setReduzindo(null)
        }}
        aoFechar={() => setReduzindo(null)}
      >
        <p>As respostas já lançadas nessas questões deixam de contar, e os resultados são recalculados.</p>
      </Confirmacao>

      <Confirmacao
        titulo={`Excluir a prova do ${serieNome(caderno.serie)}?`}
        aberta={excluindo}
        rotuloConfirmar="Excluir a prova"
        perigo
        aoConfirmar={() => {
          removerCaderno(caderno.id)
          setExcluindo(false)
        }}
        aoFechar={() => setExcluindo(false)}
      >
        <p>
          A prova sai da avaliação
          {turmasComRespostas ? `, junto com as respostas de ${plural(turmasComRespostas, 'turma', 'turmas')}` : ''}. Não dá para desfazer.
        </p>
      </Confirmacao>
    </Cartao>
  )
}

/** O que cada alternativa errada costuma indicar e como retomar: aparece para o professor nos resultados da turma. */
function ComentariosQuestao({ caderno, indice, questao, editavel }: { caderno: Caderno; indice: number; questao: Questao; editavel: boolean }) {
  const letras = LETRAS.slice(0, caderno.numAlternativas).filter((l) => l !== questao.gabarito)
  const [textos, setTextos] = useState<Partial<Record<Letra, string>>>(questao.comentarios ?? {})
  const [retomar, setRetomar] = useState(questao.comoRetomar ?? '')
  return (
    <div className="comentarios-questao">
      <p className="texto-2 pequeno">
        Estes textos aparecem para o professor nos resultados da turma, quando muitos alunos marcam a alternativa. Escreva sem citar números da rede ou de
        outras turmas.
      </p>
      {letras.map((letra) => (
        <label key={letra} className="campo">
          <span>Quem marca {letra} costuma…</span>
          <input
            value={textos[letra] ?? ''}
            readOnly={!editavel}
            onChange={(e) => setTextos({ ...textos, [letra]: e.target.value })}
            onBlur={() => editavel && editarComentario(caderno.id, indice, letra, textos[letra] ?? '')}
            placeholder="Ex.: ter somado sem considerar a reserva."
          />
        </label>
      ))}
      <label className="campo">
        <span>Como retomar</span>
        <input
          value={retomar}
          readOnly={!editavel}
          onChange={(e) => setRetomar(e.target.value)}
          onBlur={() => editavel && editarComoRetomar(caderno.id, indice, retomar)}
          placeholder="Ex.: retomar com material dourado antes do algoritmo."
        />
      </label>
    </div>
  )
}
