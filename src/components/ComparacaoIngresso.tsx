import { ordemDisciplina } from '../data/bncc'
import { agruparPorAnoDeIngresso, avaliados, desempenhoPor, mediaPct, separarPorIngresso, type ResultadoAluno } from '../lib/estatisticas'
import { pct, plural } from '../lib/formato'
import type { Config } from '../types'
import { Barras, Cartao } from './ui'

/** Abaixo disso, a diferença entre os grupos pode ser acaso. */
const MINIMO_POR_GRUPO = 10

export function pontosPercentuais(diferenca: number | null): string {
  if (diferenca == null) return '—'
  const valor = Math.round(diferenca)
  return `${valor > 0 ? '+' : ''}${valor} p.p.`
}

/**
 * Compara os alunos que entraram no colégio no ano letivo da avaliação (novos) com os que já
 * estavam (antigos). A versão compacta cabe dentro de outro cartão.
 */
export function ComparacaoIngresso(props: { resultados: ResultadoAluno[]; config: Config; compacta?: boolean }) {
  const { resultados, config } = props
  const grupos = separarPorIngresso(resultados)
  const novos = avaliados(grupos.novos)
  const antigos = avaliados(grupos.antigos)
  const semAno = avaliados(grupos.sem_ano).length
  const mediaNovos = mediaPct(novos)
  const mediaAntigos = mediaPct(antigos)
  const diferenca = mediaNovos != null && mediaAntigos != null ? mediaAntigos - mediaNovos : null
  const anoLetivo = resultados[0]?.turma.anoLetivo
  const avisoSemAno =
    semAno > 0 ? `${plural(semAno, 'aluno sem ano de entrada informado fica', 'alunos sem ano de entrada informado ficam')} fora desta comparação.` : null

  if (!novos.length && !antigos.length) {
    if (props.compacta || !semAno) return null
    return (
      <Cartao titulo="Alunos novos e antigos">
        <p className="texto-2">Informe o ano em que cada aluno entrou no colégio para comparar alunos novos e antigos.</p>
      </Cartao>
    )
  }

  const poucos = (novos.length > 0 && novos.length < MINIMO_POR_GRUPO) || (antigos.length > 0 && antigos.length < MINIMO_POR_GRUPO)

  if (props.compacta) {
    return (
      <p className="comparacao-resumo">
        <span>
          <strong>Novos no colégio:</strong> {pct(mediaNovos)} <span className="texto-2">({plural(novos.length, 'aluno', 'alunos')})</span>
        </span>
        <span>
          <strong>Antigos:</strong> {pct(mediaAntigos)} <span className="texto-2">({plural(antigos.length, 'aluno', 'alunos')})</span>
        </span>
        {poucos && <span className="texto-2">Com tão poucos alunos, a diferença pode ser acaso.</span>}
        {avisoSemAno && <span className="texto-2">{avisoSemAno}</span>}
      </p>
    )
  }

  const porAno = agruparPorAnoDeIngresso(resultados).filter((g) => avaliados(g.resultados).length > 0)
  const disciplinasNovos = new Map(desempenhoPor(novos, (q) => q.disciplina).map((d) => [d.chave, d.pct]))
  const disciplinasAntigos = new Map(desempenhoPor(antigos, (q) => q.disciplina).map((d) => [d.chave, d.pct]))
  const disciplinas = [...new Set([...disciplinasNovos.keys(), ...disciplinasAntigos.keys()])].sort(ordemDisciplina)

  return (
    <Cartao titulo="Alunos novos e antigos" sub={`Novos são os alunos que entraram no colégio em ${anoLetivo}. A comparação usa a média de acertos.`}>
      <div className="comparacao">
        <div className="comparacao-bloco">
          <p className="sobretitulo">Novos no colégio</p>
          <div className="comparacao-valor">{pct(mediaNovos)}</div>
          <div className="texto-2 pequeno">{plural(novos.length, 'aluno avaliado', 'alunos avaliados')}</div>
        </div>
        <div className="comparacao-bloco">
          <p className="sobretitulo">Antigos</p>
          <div className="comparacao-valor">{pct(mediaAntigos)}</div>
          <div className="texto-2 pequeno">{plural(antigos.length, 'aluno avaliado', 'alunos avaliados')}</div>
        </div>
        <div className="comparacao-bloco destaque">
          <p className="sobretitulo">Diferença</p>
          <div className="comparacao-valor">{pontosPercentuais(diferenca)}</div>
          <div className="pequeno">
            {diferenca == null || Math.round(diferenca) === 0 ? 'sem diferença' : diferenca > 0 ? 'a favor dos antigos' : 'a favor dos novos'}
          </div>
        </div>
      </div>
      {poucos && <p className="texto-2 pequeno">Um dos grupos tem menos de {MINIMO_POR_GRUPO} alunos: a diferença pode ser obra do acaso.</p>}
      <div className="grade grade-2 sem-margem">
        <div>
          <h3 className="subtitulo">Por ano de entrada no colégio</h3>
          <Barras
            config={config}
            itens={porAno.map((g) => ({
              chave: g.chave,
              rotulo: g.rotulo,
              valor: mediaPct(g.resultados),
              detalhe: plural(avaliados(g.resultados).length, 'aluno', 'alunos'),
            }))}
          />
        </div>
        <div>
          <h3 className="subtitulo">Por disciplina</h3>
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th className="num">Novos</th>
                  <th className="num">Antigos</th>
                  <th className="num">Diferença</th>
                </tr>
              </thead>
              <tbody>
                {disciplinas.map((d) => {
                  const n = disciplinasNovos.get(d) ?? null
                  const a = disciplinasAntigos.get(d) ?? null
                  return (
                    <tr key={d}>
                      <td>{d}</td>
                      <td className="num">{pct(n)}</td>
                      <td className="num">{pct(a)}</td>
                      <td className="num">
                        <strong>{pontosPercentuais(n != null && a != null ? a - n : null)}</strong>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {avisoSemAno && <p className="texto-2 pequeno">{avisoSemAno}</p>}
    </Cartao>
  )
}
