import { ArrowLeft, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
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

export function Cartao(props: { titulo?: ReactNode; sub?: ReactNode; acoes?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`cartao ${props.className ?? ''}`}>
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

export function Selo(props: { tom?: Tom; children: ReactNode; titulo?: string }) {
  return (
    <span className={`selo selo-${props.tom ?? 'neutro'}`} title={props.titulo}>
      {props.children}
    </span>
  )
}

const STATUS: Record<StatusLancamento, { rotulo: string; tom: Tom }> = {
  nao_iniciado: { rotulo: 'Não iniciado', tom: 'neutro' },
  em_andamento: { rotulo: 'Em andamento', tom: 'ambar' },
  concluido: { rotulo: 'Concluído', tom: 'sucesso' },
}

export function SeloStatus({ status }: { status: StatusLancamento }) {
  return <Selo tom={STATUS[status].tom}>{STATUS[status].rotulo}</Selo>
}

export function SeloFaixa({ valor, config }: { valor: number; config: Config }) {
  const faixa = faixaDe(valor, config)
  return <span className={`selo selo-faixa-${faixa}`}>{NOMES_FAIXAS[faixa]}</span>
}

export function Progresso({ valor, total, rotulo }: { valor: number; total: number; rotulo?: string }) {
  const largura = total ? Math.round((100 * valor) / total) : 0
  return (
    <div
      className="progresso"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={valor}
      aria-label={rotulo}
      title={`${valor} de ${total}`}
    >
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

export function BarraFaixas({ resultados, config }: { resultados: ResultadoAluno[]; config: Config }) {
  const contagem = contarFaixas(resultados, config)
  const total = contagem.reduce((s, v) => s + v, 0)
  const [basico, adequado, avancado] = config.faixas
  const limites = [`menos de ${basico}%`, `${basico}% a ${adequado - 1}%`, `${adequado}% a ${avancado - 1}%`, `${avancado}% ou mais`]
  return (
    <div className="faixas">
      <div className="faixas-barra" aria-hidden>
        {contagem.map((qtd, faixa) =>
          qtd ? <div key={faixa} className={`faixas-seg faixa-${faixa}`} style={{ flexGrow: qtd }} title={`${NOMES_FAIXAS[faixa]}: ${qtd}`} /> : null,
        )}
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
              {qtd} {total ? <span className="texto-2">· {pct((100 * qtd) / total)}</span> : null}
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
