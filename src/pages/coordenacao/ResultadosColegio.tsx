import { FileSpreadsheet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoGrupos } from '../../components/ComparacaoGrupos'
import { Aviso, Barras, Cabecalho, Cartao, ColunasPorQuestao, Histograma, Kpi, LegendaFaixas, LembreteCooperacao, MiniFaixas, Vazio } from '../../components/ui'
import { avaliacaoAtual, avaliacoesOrdenadas, cadernoDaSerie, etapaAvaliacao, turmasDoColegio } from '../../lib/consultas'
import {
  agruparPor,
  analisarQuestoes,
  avaliados,
  coletarResultados,
  contarFaixas,
  desempenhoPor,
  ehNovo,
  faixaDe,
  mediaPct,
  NOMES_FAIXAS,
  participacao,
  progressoDe,
  type ResultadoAluno,
} from '../../lib/estatisticas'
import { AVISO_COMPARACAO, baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { pct, plural, serieNome, turmaNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { DISCIPLINAS_DA_PROVA, SERIES, type Serie, type Turma } from '../../types'

/** Mínimo de alunos avaliados para mostrar a média de uma turma; com menos, mostra só as faixas. */
const MINIMO_POR_TURMA = 8

export default function ResultadosColegio() {
  const db = useDb()
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const [serieQuestoes, setSerieQuestoes] = useState<Serie>(1)
  const [serieTurmas, setSerieTurmas] = useState<Serie>(1)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacao = db.avaliacoes.find((a) => a.id === params.get('avaliacao')) ?? avaliacaoAtual(db) ?? avaliacoes[0]
  const resultados = useMemo(
    () => (colegio && avaliacao ? coletarResultados(db, { avaliacaoId: avaliacao.id, colegioId: colegio.id }) : []),
    [db, colegio, avaliacao],
  )
  if (!colegio) return null
  if (!avaliacao) return <Vazio titulo="Ainda não há avaliações">A Solar cadastra a avaliação anual e as provas de cada ano.</Vazio>

  const lista = avaliados(resultados)
  const media = mediaPct(resultados)
  const part = participacao(resultados)
  const emLancamento = ['aplicacao', 'lancamento'].includes(etapaAvaliacao(avaliacao))
  const turmas = turmasDoColegio(db, colegio.id, avaliacao.anoLetivo)
  const concluidas = turmas.filter((t) => {
    const caderno = cadernoDaSerie(db, avaliacao.id, t.serie)
    return caderno && progressoDe(db, caderno, t.id).status === 'concluido'
  }).length
  const porDisciplina = DISCIPLINAS_DA_PROVA.map((d) => desempenhoPor(resultados, (q) => q.disciplina).find((x) => x.chave === d)).filter(Boolean)
  const porAno = SERIES.map((serie) => ({ serie, resultados: resultados.filter((r) => r.turma.serie === serie) })).filter((x) => avaliados(x.resultados).length)
  const seriesComTurma = SERIES.filter((s) => turmas.some((t) => t.serie === s))
  const caderno = cadernoDaSerie(db, avaliacao.id, serieQuestoes)
  const doAno = resultados.filter((r) => r.turma.serie === serieQuestoes)

  function exportarTurmas() {
    const linhas = turmas.map((turma) => {
      const rs = resultados.filter((r) => r.turma.id === turma.id)
      const p = participacao(rs)
      return [turmaNome(turma), turma.turno, p.matriculados, p.avaliados, p.faltas, p.adaptadas, mediaPct(rs), ...contarFaixas(rs)]
    })
    baixarCsv(
      `turmas-${paraNomeDeArquivo(`${colegio!.nome} ${avaliacao!.titulo}`)}.csv`,
      ['Turma', 'Turno', 'Alunos', 'Avaliados', 'Faltas', 'Prova adaptada', 'Acerto médio (%)', ...NOMES_FAIXAS.map((f) => `Alunos com ${f.toLowerCase()} de acertos`)],
      linhas,
      AVISO_COMPARACAO,
    )
  }

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Resultados do colégio"
        acoes={
          <label className="campo-inline">
            <span>Avaliação</span>
            <select value={avaliacao.id} onChange={(e) => setParams({ avaliacao: e.target.value })}>
              {avaliacoes.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.titulo}
                </option>
              ))}
            </select>
          </label>
        }
      />

      {emLancamento && <Aviso tom="atencao">O lançamento ainda está em andamento: os números vão mudar até o fim do prazo.</Aviso>}

      {!lista.length ? (
        <Vazio titulo="Ainda não há alunos avaliados nesta avaliação">Os resultados aparecem assim que os professores lançam as respostas.</Vazio>
      ) : (
        <>
          <div className="grade grade-kpis grade-kpis-3">
            <Kpi rotulo="Acerto médio do colégio" valor={pct(media)} />
            <Kpi rotulo="Alunos avaliados" valor={`${part.avaliados} de ${part.matriculados}`} detalhe={plural(part.faltas, 'faltou', 'faltaram')} />
            <Kpi rotulo="Turmas que concluíram o lançamento" valor={`${concluidas} de ${turmas.length}`} />
          </div>

          <div className="grade grade-2">
            <Cartao titulo="Alunos por faixa de acerto">
              <Histograma resultados={resultados} />
            </Cartao>
            <Cartao titulo="Acerto por disciplina">
              <Barras itens={porDisciplina.map((d) => ({ chave: d!.chave, rotulo: d!.chave, valor: d!.pct }))} />
              <h3 className="subtitulo subtitulo-espaco">Acerto médio por ano</h3>
              <Barras itens={porAno.map((x) => ({ chave: String(x.serie), rotulo: serieNome(x.serie), valor: mediaPct(x.resultados), detalhe: plural(avaliados(x.resultados).length, 'aluno', 'alunos') }))} />
              <p className="texto-2 pequeno">Cada ano fez uma prova diferente.</p>
            </Cartao>
          </div>

          <Cartao
            titulo="Acerto por questão"
            sub="Todos os alunos do ano no colégio"
            acoes={<SeletorAno series={seriesComTurma} valor={serieQuestoes} aoMudar={setSerieQuestoes} />}
          >
            {caderno && avaliados(doAno).length ? (
              <>
                <ColunasPorQuestao
                  itens={analisarQuestoes(caderno, doAno).map((a) => ({ numero: a.indice + 1, valor: a.pctAcerto, disciplina: a.questao.disciplina }))}
                />
                <LegendaFaixas />
              </>
            ) : (
              <p className="texto-2">Ainda não há alunos avaliados no {serieNome(serieQuestoes)}.</p>
            )}
          </Cartao>

          <ComparacaoGrupos resultados={resultados} />

          <details className="cartao recolhivel" id="por-turma">
            <summary>Ver por turma</summary>
            <LembreteCooperacao chave={`coordenacao-${avaliacao.id}`} />
            <SeletorAno series={seriesComTurma} valor={serieTurmas} aoMudar={setSerieTurmas} />
            <TurmasDoAno
              resultados={resultados.filter((r) => r.turma.serie === serieTurmas)}
              turmas={turmas.filter((t) => t.serie === serieTurmas)}
              serie={serieTurmas}
              anoLetivo={avaliacao.anoLetivo}
              cadernoId={cadernoDaSerie(db, avaliacao.id, serieTurmas)?.id}
            />
            <div className="form-acoes">
              <button className="btn btn-pequeno" onClick={exportarTurmas}>
                <FileSpreadsheet size={15} aria-hidden /> Baixar planilha das turmas
              </button>
            </div>
          </details>
        </>
      )}
    </>
  )
}

function SeletorAno(props: { series: Serie[]; valor: Serie; aoMudar: (serie: Serie) => void }) {
  return (
    <div className="segmentos" role="group" aria-label="Ano">
      {props.series.map((s) => (
        <button key={s} className={`segmento ${props.valor === s ? 'ativo' : ''}`} onClick={() => props.aoMudar(s)}>
          {serieNome(s)}
        </button>
      ))}
    </div>
  )
}

function TurmasDoAno(props: { resultados: ResultadoAluno[]; turmas: Turma[]; serie: Serie; anoLetivo: number; cadernoId?: string }) {
  const { resultados } = props
  const porTurma = agruparPor(resultados, (r) => r.turma.id)
  const linhas = [
    { chave: 'colegio', rotulo: `Colégio, ${serieNome(props.serie)}`, rs: resultados, turmaId: null as string | null },
    ...props.turmas.map((t) => ({ chave: t.id, rotulo: turmaNome(t), rs: porTurma.get(t.id) ?? [], turmaId: t.id })),
  ]
  return (
    <>
      <div className="tabela-rolagem">
        <table className="tabela tabela-calor">
          <thead>
            <tr>
              <th>Turma</th>
              <th>Alunos por faixa de acerto</th>
              <th className="num">Acerto médio</th>
              {DISCIPLINAS_DA_PROVA.map((d) => (
                <th key={d} className="num">
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const p = participacao(l.rs)
              const novos = avaliados(l.rs).filter((r) => ehNovo(r.aluno, props.anoLetivo)).length
              const poucos = p.avaliados < MINIMO_POR_TURMA
              const porDisciplina = new Map(desempenhoPor(l.rs, (q) => q.disciplina).map((d) => [d.chave, d.pct]))
              return (
                <tr key={l.chave} className={l.turmaId ? '' : 'linha-colegio'}>
                  <td>
                    {l.turmaId && props.cadernoId ? <Link to={`/coordenacao/resultados/${props.cadernoId}/${l.turmaId}`}>{l.rotulo}</Link> : <strong>{l.rotulo}</strong>}
                    <span className="texto-2 bloco pequeno">
                      {plural(p.avaliados, 'avaliado', 'avaliados')} · {plural(novos, 'novo no colégio', 'novos no colégio')}
                    </span>
                  </td>
                  <td>
                    <MiniFaixas contagem={contarFaixas(l.rs)} />
                  </td>
                  <td className="num">
                    {p.avaliados === 0 ? <span className="texto-2">sem resultados</span> : poucos && l.turmaId ? <span className="texto-2">poucos alunos</span> : pct(mediaPct(l.rs))}
                  </td>
                  {DISCIPLINAS_DA_PROVA.map((d) => {
                    const v = porDisciplina.get(d)
                    return (
                      <td key={d} className={`num ${v != null && !(poucos && l.turmaId) ? `calor-${faixaDe(v)}` : ''}`}>
                        {poucos && l.turmaId ? '' : pct(v)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="texto-2 pequeno">
        As turmas aparecem sempre na mesma ordem. Diferenças de poucos pontos costumam ser acaso. Turmas com menos de {MINIMO_POR_TURMA} alunos
        avaliados mostram só as faixas.
      </p>
    </>
  )
}
