import { ChartColumn, Eye, Pencil, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecalho, Cartao, Progresso, Selo, Vazio, type Tom } from '../../components/ui'
import { avaliacoesOrdenadas, cadernosDaAvaliacao, descreverPeriodo, etapaAvaliacao, permissoesDe, pessoaDoPerfil, turmasDoAno, type EtapaAvaliacao } from '../../lib/consultas'
import { progressoDe } from '../../lib/estatisticas'
import { serieNome } from '../../lib/formato'
import { criarAvaliacao, type DadosAvaliacao } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, type Avaliacao, type Caderno, type Db, type Serie } from '../../types'

export const ETAPAS: Record<EtapaAvaliacao, { rotulo: string; tom: Tom }> = {
  agendada: { rotulo: 'Agendada', tom: 'info' },
  aplicacao: { rotulo: 'Em aplicação', tom: 'atencao' },
  lancamento: { rotulo: 'Em lançamento', tom: 'atencao' },
  encerrada: { rotulo: 'Encerrada', tom: 'neutro' },
}

export function pendenciasDoCaderno(caderno: Caderno): string[] {
  const semGabarito = caderno.questoes.some((q) => !q.anulada && !q.gabarito)
  return [!caderno.pdf && 'falta PDF', semGabarito && 'falta gabarito', !semGabarito && !caderno.conferencia && 'gabarito a conferir'].filter(
    (x): x is string => Boolean(x),
  )
}

export default function Avaliacoes() {
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [criando, setCriando] = useState(false)
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)
  const avaliacoes = avaliacoesOrdenadas(db)

  return (
    <>
      <Cabecalho
        sobretitulo="Provas"
        titulo="Avaliações"
        subtitulo="A avaliação é anual, com uma prova para cada ano. Cada prova tem o PDF, o gabarito e a disciplina e a habilidade de cada questão."
        acoes={
          editarRede &&
          !criando && (
            <button className="btn btn-primario" onClick={() => setCriando(true)}>
              <Plus size={16} aria-hidden /> Nova avaliação
            </button>
          )
        }
      />
      {criando && (
        <FormularioAvaliacao
          comSeries
          rotuloSalvar="Criar avaliação"
          aoSalvar={(dados, series) => navigate(`/solar/avaliacoes/${criarAvaliacao(dados, series)}`)}
          aoCancelar={() => setCriando(false)}
        />
      )}
      {!avaliacoes.length && <Vazio titulo="Crie a primeira avaliação" />}
      {avaliacoes.map((avaliacao) => {
        const etapa = ETAPAS[etapaAvaliacao(avaliacao)]
        const cadernos = cadernosDaAvaliacao(db, avaliacao.id)
        const andamento = contarConcluidas(db, avaliacao, cadernos)
        return (
          <Cartao
            key={avaliacao.id}
            titulo={
              <>
                {avaliacao.titulo} <Selo tom={etapa.tom}>{etapa.rotulo}</Selo>
              </>
            }
            sub={descreverPeriodo(avaliacao)}
            acoes={
              <>
                <Link className="btn btn-primario" to={`/solar/avaliacoes/${avaliacao.id}`}>
                  {editarRede ? <Pencil size={16} aria-hidden /> : <Eye size={16} aria-hidden />} {editarRede ? 'Editar provas' : 'Ver provas'}
                </Link>
                {andamento.lancadas > 0 && (
                  <Link className="btn" to={`/solar/resultados?avaliacao=${avaliacao.id}`}>
                    <ChartColumn size={16} aria-hidden /> Resultados
                  </Link>
                )}
              </>
            }
          >
            <div className="cadernos-resumo">
              {SERIES.map((serie) => {
                const caderno = cadernos.find((c) => c.serie === serie)
                const pendencias = caderno ? pendenciasDoCaderno(caderno) : []
                return (
                  <Link
                    key={serie}
                    to={`/solar/avaliacoes/${avaliacao.id}?serie=${serie}`}
                    className={`caderno-chip ${!caderno ? 'ausente' : pendencias.length ? 'pendente' : 'pronto'}`}
                  >
                    <strong>{serieNome(serie)}</strong>
                    <span>{!caderno ? 'sem prova' : pendencias.length ? pendencias.join(', ') : `${caderno.questoes.length} questões · pronta`}</span>
                  </Link>
                )
              })}
            </div>
            {andamento.total > 0 && andamento.lancadas > 0 && (
              <div className="progresso-com-texto">
                <Progresso valor={andamento.concluidas} total={andamento.total} rotulo="Turmas concluídas" />
                <span className="texto-2 pequeno">
                  {andamento.concluidas} de {andamento.total} turmas concluíram o lançamento
                </span>
              </div>
            )}
          </Cartao>
        )
      })}
    </>
  )
}

function contarConcluidas(db: Db, avaliacao: Avaliacao, cadernos: Caderno[]) {
  let total = 0
  let concluidas = 0
  let lancadas = 0
  for (const caderno of cadernos) {
    for (const turma of turmasDoAno(db, avaliacao.anoLetivo).filter((t) => t.serie === caderno.serie)) {
      const progresso = progressoDe(db, caderno, turma.id)
      total++
      if (progresso.status === 'concluido') concluidas++
      if (progresso.status !== 'nao_iniciado') lancadas++
    }
  }
  return { total, concluidas, lancadas }
}

export function FormularioAvaliacao(props: {
  inicial?: DadosAvaliacao
  comSeries?: boolean
  rotuloSalvar: string
  aoSalvar: (dados: DadosAvaliacao, series: Serie[]) => void
  aoCancelar: () => void
}) {
  const [dados, setDados] = useState<DadosAvaliacao>(props.inicial ?? { titulo: '', aplicacaoInicio: '', aplicacaoFim: '', prazoLancamento: '' })
  const [series, setSeries] = useState<Serie[]>([...SERIES])
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (parcial: Partial<DadosAvaliacao>) => {
    setDados({ ...dados, ...parcial })
    setErro(null)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const titulo = dados.titulo.trim()
    if (!titulo) return setErro('Dê um nome para a avaliação, como “Avaliação anual 2027”.')
    if (!dados.aplicacaoInicio || !dados.aplicacaoFim || !dados.prazoLancamento) return setErro('Preencha as três datas.')
    if (dados.aplicacaoFim < dados.aplicacaoInicio) return setErro('O fim da aplicação precisa ser depois do início.')
    if (dados.prazoLancamento < dados.aplicacaoFim) return setErro('O prazo de lançamento precisa ser depois do fim da aplicação.')
    if (props.comSeries && !series.length) return setErro('Escolha pelo menos um ano.')
    props.aoSalvar({ ...dados, titulo }, series)
  }

  return (
    <form className="cartao form" onSubmit={enviar} noValidate>
      <div className="form-grade">
        <label className="campo campo-largo">
          <span>Nome da avaliação</span>
          <input value={dados.titulo} onChange={(e) => mudar({ titulo: e.target.value })} placeholder="Avaliação anual 2027" autoFocus />
        </label>
        <label className="campo">
          <span>Início da aplicação</span>
          <input type="date" value={dados.aplicacaoInicio} onChange={(e) => mudar({ aplicacaoInicio: e.target.value })} />
        </label>
        <label className="campo">
          <span>Fim da aplicação</span>
          <input type="date" value={dados.aplicacaoFim} onChange={(e) => mudar({ aplicacaoFim: e.target.value })} />
        </label>
        <label className="campo">
          <span>Prazo de lançamento</span>
          <input type="date" value={dados.prazoLancamento} onChange={(e) => mudar({ prazoLancamento: e.target.value })} />
        </label>
      </div>
      {props.comSeries && (
        <fieldset className="campo">
          <legend>Anos com prova</legend>
          <div className="chips">
            {SERIES.map((serie) => (
              <label key={serie} className={`chip chip-escolha ${series.includes(serie) ? 'escolhido' : ''}`}>
                <input
                  type="checkbox"
                  checked={series.includes(serie)}
                  onChange={(e) => {
                    setSeries(e.target.checked ? [...series, serie].sort((a, b) => a - b) : series.filter((s) => s !== serie))
                    setErro(null)
                  }}
                />
                {serieNome(serie)}
              </label>
            ))}
          </div>
          <p className="campo-ajuda">Cada prova começa com 16 questões (1º e 2º ano) ou 20 (3º ao 5º), misturando as disciplinas. Dá para mudar depois.</p>
        </fieldset>
      )}
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
