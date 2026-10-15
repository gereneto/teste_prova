import { ArrowLeft, CircleAlert, CircleCheck, CircleHelp, HeartHandshake, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { contarFaixas, faixaDe, NOMES_FAIXAS, type ResultadoAluno, type StatusLancamento } from '../lib/estatisticas'
import { pct } from '../lib/formato'
import type { Config } from '../types'

/** Cabeçalho de página no formato SectionHeading do design system: rótulo, título e subtítulo. */
export function Cabecalho(props: {
  titulo: ReactNode
  sobretitulo?: ReactNode
  subtitulo?: ReactNode
  voltar?: { para: string; rotulo: string }
  acoes?: ReactNode
}) {
  // A aba do navegador acompanha a tela.
  const tituloTexto = typeof props.titulo === 'string' ? props.titulo : null
  useEffect(() => {
    if (tituloTexto) document.title = `${tituloTexto} · Prova Solar`
  }, [tituloTexto])
  return (
    <header className="cabecalho">
      {props.voltar && (
        <Link className="cabecalho-voltar" to={props.voltar.para}>
          <ArrowLeft size={16} aria-hidden /> {props.voltar.rotulo}
        </Link>
      )}
      <div className="cabecalho-linha">
        <div>
          {props.sobretitulo && <p className="sobretitulo">{props.sobretitulo}</p>}
          <h1>{props.titulo}</h1>
          {props.subtitulo && <p className="cabecalho-sub">{props.subtitulo}</p>}
        </div>
        {props.acoes && <div className="cabecalho-acoes">{props.acoes}</div>}
      </div>
    </header>
  )
}

export function Cartao(props: { titulo?: ReactNode; sub?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`cartao ${props.className ?? ''}`} id={props.id}>
      {(props.titulo || props.acoes) && (
        <div className="cartao-topo">
          <div>
            {props.titulo && <h2 className="cartao-titulo">{props.titulo}</h2>}
            {props.sub && <p className="cartao-sub">{props.sub}</p>}
          </div>
          {props.acoes && <div className="cartao-acoes">{props.acoes}</div>}
        </div>
      )}
      {props.children}
    </section>
  )
}

/** Indicador no formato Stat do design system: o número em destaque e o rótulo embaixo. */
export function Kpi(props: { rotulo: string; valor: ReactNode; detalhe?: ReactNode }) {
  return (
    <div className="kpi">
      <div className="kpi-valor">{props.valor}</div>
      <div className="kpi-rotulo">{props.rotulo}</div>
      {props.detalhe && <div className="kpi-detalhe">{props.detalhe}</div>}
    </div>
  )
}

export type Tom = 'neutro' | 'info' | 'sucesso' | 'atencao' | 'perigo' | 'ambar' | 'marca'

export function Selo(props: { tom?: Tom; children: ReactNode }) {
  return <span className={`selo selo-${props.tom ?? 'neutro'}`}>{props.children}</span>
}

/** As três situações do lançamento de uma turma, com as mesmas palavras em todo o site. */
export const NOMES_STATUS: Record<StatusLancamento, string> = {
  nao_iniciado: 'Não começou',
  em_andamento: 'Em andamento',
  concluido: 'Concluída',
}

const TONS_STATUS: Record<StatusLancamento, Tom> = { nao_iniciado: 'neutro', em_andamento: 'ambar', concluido: 'sucesso' }

export function SeloStatus({ status }: { status: StatusLancamento }) {
  return <Selo tom={TONS_STATUS[status]}>{NOMES_STATUS[status]}</Selo>
}

export function SeloFaixa({ valor, config }: { valor: number; config: Config }) {
  const faixa = faixaDe(valor, config)
  return <span className={`selo selo-faixa-${faixa}`}>{NOMES_FAIXAS[faixa]}</span>
}

export function Progresso({ valor, total, rotulo }: { valor: number; total: number; rotulo?: string }) {
  const largura = total ? Math.round((100 * valor) / total) : 0
  return (
    <div className="progresso" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={valor} aria-label={rotulo}>
      <div className="progresso-barra" style={{ width: `${largura}%` }} />
    </div>
  )
}

export interface ItemBarra {
  chave: string
  rotulo: ReactNode
  valor: number | null
  detalhe?: ReactNode
}

/** Barras horizontais de 0 a 100%. Com `config`, cada barra ganha a cor da faixa de desempenho. */
export function Barras({ itens, config }: { itens: ItemBarra[]; config?: Config }) {
  return (
    <div className="barras">
      {itens.map((item) => (
        <div className="barra-item" key={item.chave}>
          <div className="barra-rotulo">{item.rotulo}</div>
          <div className="barra-trilho">
            {item.valor != null && (
              <div
                className={`barra-preench ${config ? `faixa-${faixaDe(item.valor, config)}` : ''}`}
                style={{ width: `${Math.max(1, Math.min(100, item.valor))}%` }}
              />
            )}
          </div>
          <div className="barra-valor">
            {pct(item.valor)}
            {item.detalhe && <span className="barra-detalhe">{item.detalhe}</span>}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Barra curta para células de tabela. */
export function MiniBarra({ valor, config }: { valor: number; config?: Config }) {
  return (
    <span className="mini-barra">
      <span className="mini-barra-trilho">
        <span
          className={`mini-barra-preench ${config ? `faixa-${faixaDe(valor, config)}` : ''}`}
          style={{ width: `${Math.max(2, Math.min(100, valor))}%` }}
        />
      </span>
      <span className="mini-barra-valor">{pct(valor)}</span>
    </span>
  )
}

/** Faixa de acertos em número de questões: com 16 questões e Adequado a partir de 60%, "de 10 a 12 acertos". */
function limitesEmAcertos(config: Config, questoes: number): string[] {
  const minimo = (p: number) => Math.ceil((p * questoes) / 100 - 1e-9)
  const [b, a, v] = config.faixas.map(minimo)
  const intervalo = (de: number, ate: number) => (de > ate ? 'nenhum valor' : de === ate ? `${de} acertos` : `de ${de} a ${ate} acertos`)
  return [intervalo(0, b - 1), intervalo(b, a - 1), intervalo(a, v - 1), intervalo(v, questoes)]
}

/**
 * Quantos alunos ficaram em cada faixa. Com `questoes` (uma prova só), a legenda mostra a faixa em
 * número de acertos, que é como o professor pensa; sem, mostra em percentual.
 */
export function BarraFaixas({ resultados, config, questoes }: { resultados: ResultadoAluno[]; config: Config; questoes?: number }) {
  const contagem = contarFaixas(resultados, config)
  const total = contagem.reduce((s, v) => s + v, 0)
  const [basico, adequado, avancado] = config.faixas
  const limites = questoes
    ? limitesEmAcertos(config, questoes).map((t) => `${t} em ${questoes}`)
    : [`menos de ${basico}%`, `${basico}% a ${adequado - 1}%`, `${adequado}% a ${avancado - 1}%`, `${avancado}% ou mais`]
  return (
    <div className="faixas">
      <div className="faixas-barra" aria-hidden>
        {contagem.map((qtd, faixa) => (qtd ? <div key={faixa} className={`faixas-seg faixa-${faixa}`} style={{ flexGrow: qtd }} /> : null))}
        {!total && <div className="faixas-seg faixas-vazia" style={{ flexGrow: 1 }} />}
      </div>
      <ul className="faixas-legenda">
        {contagem.map((qtd, faixa) => (
          <li key={faixa}>
            <span className={`faixas-ponto faixa-${faixa}`} aria-hidden />
            <span>
              <strong>{NOMES_FAIXAS[faixa]}</strong> <span className="texto-2">({limites[faixa]})</span>
            </span>
            <span className="faixas-qtd">
              {qtd} {qtd === 1 ? 'aluno' : 'alunos'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Vazio(props: { titulo: string; children?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="vazio">
      <p className="vazio-titulo">{props.titulo}</p>
      {props.children && <p className="vazio-texto">{props.children}</p>}
      {props.acao}
    </div>
  )
}

const ICONES_AVISO = { info: Info, sucesso: CircleCheck, atencao: TriangleAlert, perigo: CircleAlert }

export function Aviso(props: { tom?: keyof typeof ICONES_AVISO; children: ReactNode; acoes?: ReactNode }) {
  const tom = props.tom ?? 'info'
  const Icone = ICONES_AVISO[tom]
  return (
    <div className={`aviso aviso-${tom}`} role={tom === 'perigo' ? 'alert' : undefined}>
      <Icone size={18} aria-hidden className="aviso-icone" />
      <div className="aviso-texto">{props.children}</div>
      {props.acoes && <div className="aviso-acoes">{props.acoes}</div>}
    </div>
  )
}

/**
 * Explicação que abre com um toque, no lugar das dicas que só aparecem ao passar o mouse
 * (e que não existem no celular).
 */
export function Explicacao(props: { rotulo?: string; children: ReactNode }) {
  const [aberta, setAberta] = useState(false)
  return (
    <span className="explicacao">
      <button type="button" className="explicacao-botao" aria-expanded={aberta} onClick={() => setAberta(!aberta)}>
        <CircleHelp size={15} aria-hidden /> {props.rotulo ?? 'O que é isso?'}
      </button>
      {aberta && <span className="explicacao-texto">{props.children}</span>}
    </span>
  )
}

const lerDispensado = (chave: string) => {
  try {
    return localStorage.getItem(chave) === '1'
  } catch {
    return false
  }
}

/**
 * Lembrete de cooperação, onde quer que turmas (ou colégios) apareçam lado a lado. Pode ser reduzido
 * a uma linha com "Entendi", mas não some.
 */
export function LembreteCooperacao(props: { chave: string; children?: ReactNode }) {
  const chave = `prova-solar:lembrete:${props.chave}`
  const [curto, setCurto] = useState(() => lerDispensado(chave))
  function alternar(valor: boolean) {
    setCurto(valor)
    try {
      if (valor) localStorage.setItem(chave, '1')
      else localStorage.removeItem(chave)
    } catch {
      // Sem armazenamento, o lembrete volta a aparecer inteiro na próxima visita.
    }
  }
  const texto = props.children ?? (
    <>
      Estes números mostram como cada turma foi nesta prova, não quem ensina melhor. Turmas têm alunos e histórias diferentes. Use a
      comparação para descobrir onde o colégio pode se ajudar.
    </>
  )
  if (curto) {
    return (
      <p className="lembrete lembrete-curto">
        <HeartHandshake size={16} aria-hidden /> Para planejar juntos, não para classificar.{' '}
        <button type="button" className="link-botao" onClick={() => alternar(false)}>
          Ler o lembrete
        </button>
      </p>
    )
  }
  return (
    <div className="lembrete">
      <HeartHandshake size={20} aria-hidden className="lembrete-icone" />
      <div className="lembrete-texto">
        <p>{texto}</p>
        <details className="lembrete-mais">
          <summary>Por que não há ranking?</summary>
          <p>
            Uma prova mostra um momento de uma turma, não o trabalho de um professor. Classificações fazem os colegas guardarem o que sabem,
            e a troca entre eles é o que mais melhora o ensino. Por isso o site mostra as turmas sempre na mesma ordem e começa pelo que o
            colégio tem em comum.
          </p>
        </details>
        <details className="lembrete-mais">
          <summary>Como conversar sobre os resultados</summary>
          <ul>
            <li>Comece pelo que o colégio inteiro precisa retomar.</li>
            <li>Peça que cada professor conte uma prática que funcionou.</li>
            <li>Não exponha médias por professor em mural ou grupo de mensagens.</li>
            <li>Olhe a evolução ao longo do tempo, e não a posição.</li>
            <li>Ouça o professor antes de tirar conclusões sobre a turma.</li>
          </ul>
        </details>
      </div>
      <button type="button" className="btn btn-pequeno btn-fantasma" onClick={() => alternar(true)}>
        Entendi
      </button>
    </div>
  )
}

/** Janela do próprio site (no lugar das caixas OK/Cancelar do navegador), com botões que dizem o que fazem. */
export function Janela(props: { titulo: string; aberta: boolean; aoFechar: () => void; children: ReactNode; acoes?: ReactNode; larga?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialogo = ref.current
    if (!dialogo) return
    if (props.aberta && !dialogo.open) dialogo.showModal()
    if (!props.aberta && dialogo.open) dialogo.close()
  }, [props.aberta])
  return (
    <dialog ref={ref} className={`janela ${props.larga ? 'janela-larga' : ''}`} onClose={props.aoFechar} onCancel={props.aoFechar}>
      <div className="janela-topo">
        <h2>{props.titulo}</h2>
        <button type="button" className="janela-fechar" onClick={props.aoFechar} aria-label="Fechar">
          <X size={20} aria-hidden />
        </button>
      </div>
      <div className="janela-corpo">{props.children}</div>
      {props.acoes && <div className="janela-acoes">{props.acoes}</div>}
    </dialog>
  )
}

/** Pergunta de confirmação: o botão principal diz o que vai acontecer ("Tirar da turma"), o outro desiste. */
export function Confirmacao(props: {
  titulo: string
  aberta: boolean
  rotuloConfirmar: string
  rotuloDesistir?: string
  perigo?: boolean
  aoConfirmar: () => void
  aoFechar: () => void
  children: ReactNode
}) {
  return (
    <Janela
      titulo={props.titulo}
      aberta={props.aberta}
      aoFechar={props.aoFechar}
      acoes={
        <>
          <button type="button" className={`btn ${props.perigo ? 'btn-perigo-cheio' : 'btn-primario'}`} onClick={props.aoConfirmar}>
            {props.rotuloConfirmar}
          </button>
          <button type="button" className="btn btn-fantasma" onClick={props.aoFechar}>
            {props.rotuloDesistir ?? 'Voltar sem mudar nada'}
          </button>
        </>
      }
    >
      {props.children}
    </Janela>
  )
}
