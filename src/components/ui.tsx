import { ArrowLeft, CircleAlert, CircleCheck, CircleHelp, HeartHandshake, Info, TriangleAlert, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { faixaDe, NOMES_FAIXAS, type StatusLancamento } from '../lib/estatisticas'
import { pct, plural } from '../lib/formato'
import { chave as chaveLocal } from '../plataforma/modo'

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

export function Cartao(props: { titulo?: ReactNode; sub?: ReactNode; acoes?: ReactNode; children?: ReactNode; className?: string; id?: string }) {
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

/** Barras horizontais de 0 a 100%, com a cor da faixa de acerto. */
export function Barras({ itens }: { itens: ItemBarra[] }) {
  return (
    <div className="barras">
      {itens.map((item) => (
        <div className="barra-item" key={item.chave}>
          <div className="barra-rotulo">{item.rotulo}</div>
          <div className="barra-trilho">
            {item.valor != null && <div className={`barra-preench faixa-${faixaDe(item.valor)}`} style={{ width: `${Math.max(1, Math.min(100, item.valor))}%` }} />}
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
export function MiniBarra({ valor }: { valor: number }) {
  return (
    <span className="mini-barra">
      <span className="mini-barra-trilho">
        <span className={`mini-barra-preench faixa-${faixaDe(valor)}`} style={{ width: `${Math.max(2, Math.min(100, valor))}%` }} />
      </span>
      <span className="mini-barra-valor">{pct(valor)}</span>
    </span>
  )
}

/** Quantos alunos ficaram em cada faixa de acerto (de 20 em 20 pontos), em colunas. */
/** Alunos por faixa de acerto. A contagem vem de contarFaixas (alunos) ou de faixasAg (somas por turma). */
export function Histograma({ contagem }: { contagem: readonly number[] }) {
  const maior = Math.max(1, ...contagem)
  const total = contagem.reduce((s, v) => s + v, 0)
  return (
    <figure className="histograma" aria-label={`Alunos por faixa de acerto: ${contagem.map((n, i) => `${NOMES_FAIXAS[i]}, ${n}`).join('; ')}`}>
      <div className="histograma-colunas" aria-hidden>
        {contagem.map((n, faixa) => (
          <div key={faixa} className="histograma-coluna">
            <span className="histograma-valor">{n}</span>
            <span className={`histograma-barra faixa-${faixa}`} style={{ height: `${(100 * n) / maior}%` }} />
          </div>
        ))}
      </div>
      <div className="histograma-rotulos" aria-hidden>
        {NOMES_FAIXAS.map((nome) => (
          <span key={nome}>{nome}</span>
        ))}
      </div>
      <figcaption className="texto-2 pequeno">
        {plural(total, 'aluno avaliado', 'alunos avaliados')}, pelo percentual de acertos na prova.
      </figcaption>
    </figure>
  )
}

/** Acerto em cada questão, em colunas de 0 a 100%, com uma linha na metade. */
/** Percentual de acerto de cada questão de uma prova (uma disciplina só). */
export function ColunasPorQuestao({ itens }: { itens: { numero: number; valor: number | null }[] }) {
  return (
    <div className="colunas-questoes-rolagem">
      <figure className="colunas-questoes" style={{ minWidth: `${itens.length * 34}px` }}>
        <div className="colunas-questoes-area">
          <span className="colunas-questoes-metade" aria-hidden />
          {itens.map((item) => (
            <div key={item.numero} className="colunas-questoes-coluna" role="img" aria-label={`Questão ${item.numero}: ${pct(item.valor)} de acerto`}>
              <span className="colunas-questoes-valor">{item.valor == null ? '—' : Math.round(item.valor)}</span>
              {item.valor != null && <span className={`colunas-questoes-barra faixa-${faixaDe(item.valor)}`} style={{ height: `${Math.max(1, item.valor)}%` }} />}
            </div>
          ))}
        </div>
        <div className="colunas-questoes-numeros" aria-hidden>
          {itens.map((item) => (
            <span key={item.numero}>{item.numero}</span>
          ))}
        </div>
      </figure>
    </div>
  )
}

/** Barra fina com a parte dos alunos em cada faixa de acerto, para tabelas. */
export function MiniFaixas({ contagem }: { contagem: number[] }) {
  const total = contagem.reduce((s, v) => s + v, 0)
  if (!total) return <span className="texto-2">—</span>
  return (
    <span className="mini-faixas-com-texto">
      <span className="mini-faixas" aria-hidden>
        {contagem.map((n, i) => (n ? <span key={i} className={`faixa-${i}`} style={{ flexGrow: n }} /> : null))}
      </span>
      <span className="sr-only">{contagem.map((n, i) => `${NOMES_FAIXAS[i]}: ${n}`).join(', ')}</span>
    </span>
  )
}

/** Legenda das cores das faixas de acerto. */
export function LegendaFaixas() {
  return (
    <ul className="legenda-faixas" aria-label="Cores das faixas de acerto">
      {NOMES_FAIXAS.map((nome, faixa) => (
        <li key={nome}>
          <span className={`faixas-ponto faixa-${faixa}`} aria-hidden /> {nome}
        </li>
      ))}
    </ul>
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
  const chave = chaveLocal(`lembrete:${props.chave}`)
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
