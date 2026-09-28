import { ChartColumn, Download, Pencil, Trash2, Upload } from 'lucide-react'
import { useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { descreverPeriodo } from '../../components/LinhaAvaliacao'
import { SeletorHabilidade } from '../../components/SeletorHabilidade'
import { Aviso, Cabecalho, Cartao, Vazio } from '../../components/ui'
import { buscarHabilidade, DISCIPLINAS } from '../../data/bncc'
import { cadernosDaAvaliacao } from '../../lib/consultas'
import { dataLonga, plural, serieNome, tamanhoArquivo } from '../../lib/formato'
import {
  adicionarCaderno,
  aplicarGabarito,
  definirAlternativas,
  definirFolhaRespostas,
  definirNumeroDeQuestoes,
  editarAvaliacao,
  editarQuestao,
  enviarPdf,
  removerAvaliacao,
  removerCaderno,
  removerPdf,
} from '../../store/acoes'
import { baixarPdfDoCaderno } from '../../store/arquivos'
import { useDb } from '../../store/db'
import { LETRAS, SERIES, type Caderno, type Db, type Letra, type Serie } from '../../types'
import { FormularioAvaliacao, pendenciasDoCaderno } from './Avaliacoes'

const LIMITE_PDF_MB = 50

export default function AvaliacaoDetalhe() {
  const { avaliacaoId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const db = useDb()
  const navigate = useNavigate()
  const [editando, setEditando] = useState(false)
  const avaliacao = db.avaliacoes.find((a) => a.id === avaliacaoId)
  if (!avaliacao) return <Vazio titulo="Avaliação não encontrada" acao={<Link className="btn" to="/solar/avaliacoes">Voltar</Link>} />

  const cadernos = cadernosDaAvaliacao(db, avaliacao.id)
  const serie: Serie = SERIES.find((s) => String(s) === params.get('serie')) ?? cadernos[0]?.serie ?? 1
  const caderno = cadernos.find((c) => c.serie === serie)

  function excluir() {
    const comRespostas = db.lancamentos.some((l) => cadernos.some((c) => c.id === l.cadernoId) && Object.keys(l.respostas).length)
    const aviso = comRespostas ? ' As respostas já lançadas pelos professores também serão apagadas.' : ''
    if (!confirm(`Excluir “${avaliacao!.titulo}” e todos os cadernos?${aviso}`)) return
    removerAvaliacao(avaliacao!.id)
    navigate('/solar/avaliacoes')
  }

  return (
    <>
      <Cabecalho
        titulo={avaliacao.titulo}
        subtitulo={descreverPeriodo(avaliacao)}
        voltar={{ para: '/solar/avaliacoes', rotulo: 'Avaliações' }}
        acoes={
          <>
            {!editando && (
              <button className="btn" onClick={() => setEditando(true)}>
                <Pencil size={16} aria-hidden /> Editar nome e datas
              </button>
            )}
            <Link className="btn" to={`/solar/estatisticas?avaliacao=${avaliacao.id}`}>
              <ChartColumn size={16} aria-hidden /> Estatísticas
            </Link>
          </>
        }
      />

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

      <div className="abas-series" role="tablist" aria-label="Caderno de cada ano">
        {SERIES.map((s) => {
          const c = cadernos.find((x) => x.serie === s)
          return (
            <button
              key={s}
              role="tab"
              aria-selected={s === serie}
              className={`aba-serie ${s === serie ? 'ativa' : ''} ${c ? '' : 'ausente'}`}
              onClick={() => setParams({ serie: String(s) }, { replace: true })}
            >
              {serieNome(s)}
              {c && pendenciasDoCaderno(c).length > 0 && <span className="ponto-pendente" title={pendenciasDoCaderno(c).join(', ')} />}
            </button>
          )
        })}
      </div>

      {caderno ? (
        <EditorCaderno key={caderno.id} db={db} caderno={caderno} />
      ) : (
        <Vazio
          titulo={`Esta avaliação não tem caderno do ${serieNome(serie)}`}
          acao={
            <button className="btn btn-primario" onClick={() => adicionarCaderno(avaliacao.id, serie)}>
              Criar caderno do {serieNome(serie)}
            </button>
          }
        />
      )}

      <div className="zona-perigo">
        <button className="btn btn-perigo" onClick={excluir}>
          <Trash2 size={16} aria-hidden /> Excluir avaliação
        </button>
      </div>
    </>
  )
}

function EditorCaderno({ db, caderno }: { db: Db; caderno: Caderno }) {
  const [numQuestoes, setNumQuestoes] = useState(String(caderno.questoes.length))
  const [gabaritoTexto, setGabaritoTexto] = useState('')
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const letras: readonly string[] = LETRAS.slice(0, caderno.numAlternativas)
  const total = caderno.questoes.length
  const turmasComRespostas = db.lancamentos.filter((l) => l.cadernoId === caderno.id && Object.keys(l.respostas).length > 0).length
  const disciplinas = [...new Set(caderno.questoes.map((q) => q.disciplina))]

  function aplicarNumero() {
    const n = Number(numQuestoes)
    if (!Number.isInteger(n) || n < 1 || n > 60) return setMensagem({ erro: true, texto: 'Use um número de questões entre 1 e 60.' })
    if (n === total) return
    if (n < total && turmasComRespostas > 0 && !confirm(`Tirar as últimas ${total - n} questões? As respostas lançadas nelas deixam de contar.`)) return
    definirNumeroDeQuestoes(caderno.id, n)
    setMensagem({ erro: false, texto: `O caderno agora tem ${n} questões.` })
  }

  function aplicarGabaritoTexto() {
    const encontradas = gabaritoTexto.toUpperCase().replace(/[^A-Z]/g, '').split('').filter(Boolean)
    if (!encontradas.length) return setMensagem({ erro: true, texto: 'Digite as letras do gabarito em sequência, como BDACB.' })
    if (encontradas.some((l) => !letras.includes(l))) return setMensagem({ erro: true, texto: `Use só as letras ${letras.join(', ')}.` })
    if (encontradas.length > total) return setMensagem({ erro: true, texto: `São ${encontradas.length} letras, mas o caderno tem ${total} questões.` })
    aplicarGabarito(caderno.id, encontradas as Letra[])
    setGabaritoTexto('')
    setMensagem({
      erro: false,
      texto: encontradas.length === total ? 'Gabarito aplicado a todas as questões.' : `Gabarito aplicado às primeiras ${encontradas.length} questões.`,
    })
  }

  async function aoEscolherPdf(e: ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0]
    e.target.value = ''
    if (!arquivo) return
    if (arquivo.type !== 'application/pdf' && !arquivo.name.toLowerCase().endsWith('.pdf')) {
      return setMensagem({ erro: true, texto: 'Escolha um arquivo em PDF.' })
    }
    if (arquivo.size > LIMITE_PDF_MB * 1024 * 1024) return setMensagem({ erro: true, texto: `O PDF passa de ${LIMITE_PDF_MB} MB. Reduza o arquivo e tente de novo.` })
    setEnviando(true)
    try {
      await enviarPdf(caderno.id, arquivo)
      setMensagem({ erro: false, texto: `PDF “${arquivo.name}” guardado. Os professores do ${serieNome(caderno.serie)} já podem baixar.` })
    } catch {
      setMensagem({ erro: true, texto: 'Não foi possível guardar o PDF neste navegador.' })
    } finally {
      setEnviando(false)
    }
  }

  async function baixar() {
    try {
      await baixarPdfDoCaderno(caderno)
    } catch (erro) {
      setMensagem({ erro: true, texto: erro instanceof Error ? erro.message : 'Não foi possível baixar o PDF.' })
    }
  }

  function excluirCaderno() {
    const aviso = turmasComRespostas ? ` ${plural(turmasComRespostas, 'turma já lançou', 'turmas já lançaram')} respostas, que serão apagadas.` : ''
    if (confirm(`Excluir o caderno do ${serieNome(caderno.serie)}?${aviso}`)) removerCaderno(caderno.id)
  }

  return (
    <Cartao
      titulo={`Caderno do ${serieNome(caderno.serie)}`}
      sub={`${plural(total, 'questão', 'questões')} · ${disciplinas.join(', ')}`}
      acoes={
        <button className="btn btn-pequeno btn-fantasma" onClick={excluirCaderno}>
          <Trash2 size={15} aria-hidden /> Excluir caderno
        </button>
      }
    >
      {turmasComRespostas > 0 && (
        <Aviso tom="info">
          {plural(turmasComRespostas, 'turma já lançou', 'turmas já lançaram')} respostas deste caderno. Mudanças no gabarito e anulações
          recalculam os resultados na hora.
        </Aviso>
      )}

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
          <div className="form-acoes">
            <label className={`btn ${caderno.pdf ? '' : 'btn-primario'}`}>
              <Upload size={16} aria-hidden /> {enviando ? 'Guardando…' : caderno.pdf ? 'Trocar PDF' : 'Enviar PDF'}
              <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={aoEscolherPdf} disabled={enviando} />
            </label>
            {caderno.pdf && (
              <>
                <button className="btn" onClick={baixar}>
                  <Download size={16} aria-hidden /> Baixar
                </button>
                <button className="btn btn-fantasma" onClick={() => removerPdf(caderno.id)}>
                  Remover
                </button>
              </>
            )}
          </div>
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
            <button className="btn btn-pequeno" onClick={aplicarNumero}>
              Aplicar
            </button>
          </div>
          <div className="campo-inline">
            <span>Alternativas</span>
            <div className="segmentos" role="group" aria-label="Número de alternativas">
              {([4, 5] as const).map((n) => (
                <button key={n} className={`segmento ${caderno.numAlternativas === n ? 'ativo' : ''}`} onClick={() => definirAlternativas(caderno.id, n)}>
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
            <button className="btn btn-pequeno" onClick={aplicarGabaritoTexto}>
              Aplicar
            </button>
          </div>
          <p className="texto-2 pequeno">
            Atual: <span className="codigo">{caderno.questoes.map((q) => (q.anulada ? 'x' : (q.gabarito ?? '·'))).join('')}</span>
          </p>
        </div>
      </div>

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
          <div key={i} className={`editor-questao ${q.anulada ? 'anulada' : ''}`}>
            <span className="editor-num">{i + 1}</span>
            <div className="segmentos segmentos-letras" role="radiogroup" aria-label={`Gabarito da questão ${i + 1}`}>
              {letras.map((l) => (
                <button
                  key={l}
                  type="button"
                  role="radio"
                  aria-checked={q.gabarito === l}
                  className={`segmento ${q.gabarito === l ? 'ativo' : ''}`}
                  onClick={() => editarQuestao(caderno.id, i, { gabarito: l as Letra })}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              value={q.disciplina}
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
            <SeletorHabilidade
              serie={caderno.serie}
              disciplina={q.disciplina}
              valor={q.habilidade}
              aoMudar={(h) =>
                editarQuestao(
                  caderno.id,
                  i,
                  h ? { habilidade: h.codigo, disciplina: DISCIPLINAS.includes(h.componente) ? h.componente : q.disciplina } : { habilidade: null },
                )
              }
            />
            <label className="checkbox">
              <input type="checkbox" checked={q.anulada} onChange={(e) => editarQuestao(caderno.id, i, { anulada: e.target.checked })} />
              <span className="sr-only">Anular a questão {i + 1}</span>
              <span aria-hidden>Anulada</span>
            </label>
          </div>
        ))}
      </div>
    </Cartao>
  )
}
