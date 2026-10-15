import { FileSpreadsheet, MessageSquareText, Presentation, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoIngresso } from '../../components/ComparacaoIngresso'
import { Aviso, BarraFaixas, Barras, Cabecalho, Cartao, Kpi, LembreteCooperacao, SeloFaixa, Vazio } from '../../components/ui'
import { buscarHabilidade, ordemDisciplina } from '../../data/bncc'
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
  type ResultadoAluno,
} from '../../lib/estatisticas'
import { AVISO_COMPARACAO, baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { pct, plural, serieNome, turmaNome } from '../../lib/formato'
import { identificacao } from '../../lib/iniciais'
import { comentarioEmFrase, dificuldadesComuns } from '../../lib/leitura'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, type Config, type Letra, type Serie } from '../../types'

/** Mínimo de alunos avaliados para mostrar a média de uma turma; com menos, mostra só as faixas. */
const MINIMO_POR_TURMA = 8
/** Com menos alunos avaliados no ano, a lista do que retomar seria acaso. */
const MINIMO_POR_ANO = 10

export default function ResultadosColegio() {
  const db = useDb()
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacao = db.avaliacoes.find((a) => a.id === params.get('avaliacao')) ?? avaliacaoAtual(db) ?? avaliacoes[0]
  const resultados = useMemo(
    () => (colegio && avaliacao ? coletarResultados(db, { avaliacaoId: avaliacao.id, colegioId: colegio.id }) : []),
    [db, colegio, avaliacao],
  )
  const [serieTurmas, setSerieTurmas] = useState<Serie>(1)
  if (!colegio) return null
  if (!avaliacao) return <Vazio titulo="Ainda não há avaliações">A Solar cadastra a avaliação anual e as provas de cada ano.</Vazio>

  const config = db.config
  const lista = avaliados(resultados)
  const media = mediaPct(resultados)
  const part = participacao(resultados)
  const emLancamento = ['aplicacao', 'lancamento'].includes(etapaAvaliacao(avaliacao))
  const turmas = turmasDoColegio(db, colegio.id, avaliacao.anoLetivo)
  const porAno = SERIES.map((serie) => ({ serie, resultados: resultados.filter((r) => r.turma.serie === serie) })).filter((x) => avaliados(x.resultados).length)

  function exportarTurmas() {
    const linhas = turmas.map((turma) => {
      const rs = resultados.filter((r) => r.turma.id === turma.id)
      const p = participacao(rs)
      return [turmaNome(turma), turma.turno, p.matriculados, p.avaliados, p.faltas, p.adaptadas, mediaPct(rs), ...contarFaixas(rs, config)]
    })
    baixarCsv(
      `turmas-${paraNomeDeArquivo(`${colegio!.nome} ${avaliacao!.titulo}`)}.csv`,
      ['Turma', 'Turno', 'Alunos', 'Avaliados', 'Faltas', 'Prova adaptada', 'Média de acertos (%)', ...NOMES_FAIXAS],
      linhas,
      AVISO_COMPARACAO,
    )
  }

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Resultados do colégio"
        subtitulo="Começam pelo que é comum a todas as turmas, para o colégio planejar junto."
        acoes={
          <>
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
            <Link className="btn btn-primario" to={`/imprimir/reuniao/${avaliacao.id}`}>
              <Presentation size={16} aria-hidden /> Preparar reunião pedagógica
            </Link>
          </>
        }
      />

      {emLancamento && <Aviso tom="atencao">O lançamento ainda está em andamento: os números vão mudar até o fim do prazo.</Aviso>}

      {!lista.length ? (
        <Vazio titulo="Ainda não há alunos avaliados nesta avaliação">Os resultados aparecem assim que os professores lançam as respostas.</Vazio>
      ) : (
        <>
          <div className="grade grade-kpis">
            <Kpi rotulo="Média do colégio" valor={pct(media)} detalhe={media != null && <SeloFaixa valor={media} config={config} />} />
            <Kpi rotulo="Alunos avaliados" valor={`${part.avaliados} de ${part.matriculados}`} detalhe={plural(part.faltas, 'faltou', 'faltaram')} />
            <Kpi rotulo="Adequado ou Avançado" valor={pct((100 * lista.filter((r) => faixaDe(r.correcao.pct, config) >= 2).length) / lista.length)} detalhe="dos alunos avaliados" />
            <Kpi rotulo={NOMES_FAIXAS[0]} valor={lista.filter((r) => faixaDe(r.correcao.pct, config) === 0).length} detalhe="alunos para acompanhar" />
          </div>

          <Cartao titulo="O que o colégio precisa retomar" sub="Questões que menos da metade dos alunos do ano acertou. É tarefa do grupo de professores de cada ano, não de uma turma.">
            {SERIES.map((serie) => {
              const caderno = cadernoDaSerie(db, avaliacao.id, serie)
              const doAno = resultados.filter((r) => r.turma.serie === serie)
              if (!caderno || !avaliados(doAno).length) return null
              if (avaliados(doAno).length < MINIMO_POR_ANO) {
                return (
                  <section key={serie} className="retomar-ano">
                    <h3 className="subtitulo">{serieNome(serie)}</h3>
                    <p className="texto-2 pequeno">
                      Só {plural(avaliados(doAno).length, 'aluno foi avaliado', 'alunos foram avaliados')} até agora. Com tão poucos, a lista do que retomar
                      seria acaso: ela aparece quando mais turmas lançarem.
                    </p>
                  </section>
                )
              }
              const turmasDoAno = turmas.filter((t) => t.serie === serie).length
              const dificuldades = dificuldadesComuns(caderno, doAno).slice(0, 4)
              const analise = analisarQuestoes(caderno, doAno)
              return (
                <section key={serie} className="retomar-ano">
                  <h3 className="subtitulo">{serieNome(serie)}</h3>
                  {!dificuldades.length ? (
                    <p className="texto-2 pequeno">Em todas as questões, pelo menos metade dos alunos do ano acertou.</p>
                  ) : (
                    <ul className="retomar-lista">
                      {dificuldades.map((d) => {
                        const h = buscarHabilidade(d.questao.habilidade)
                        const erro = analise[d.indice].erroMaisComum
                        const comentario = erro ? d.questao.comentarios?.[erro.marca as Letra] : undefined
                        const turmasComAlunos = d.porTurma.filter((t) => t.n > 0).length
                        return (
                          <li key={d.indice}>
                            <p>
                              <strong>Questão {d.indice + 1}</strong> · {d.questao.disciplina} · {pct(d.pct)} de acerto no colégio
                              {d.emTodas && turmasComAlunos > 1 && (
                                <span className="selo selo-ambar">
                                  Difícil {turmasComAlunos === 2 ? 'nas duas turmas' : `nas ${turmasComAlunos} turmas`}
                                  {turmasComAlunos < turmasDoAno ? ' que já lançaram' : ''}
                                </span>
                              )}
                            </p>
                            {h && <p className="texto-2 pequeno">{h.descricao}</p>}
                            {erro && erro.pct >= 25 && (
                              <p className="pequeno">
                                {pct(erro.pct)} marcaram {erro.marca}.{comentario && <span className="frase-comentario"> <MessageSquareText size={14} aria-hidden /> Da equipe Solar: {comentarioEmFrase(erro.marca, comentario)}</span>}
                              </p>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </section>
              )
            })}
          </Cartao>

          <div className="grade grade-2">
            <Cartao titulo="Faixas de desempenho" sub="Todos os alunos avaliados do colégio">
              <BarraFaixas resultados={resultados} config={config} />
            </Cartao>
            <Cartao titulo="Média por ano" sub="Cada ano fez uma prova diferente: estes números não dizem qual ano está melhor.">
              <Barras config={config} itens={porAno.map((x) => ({ chave: String(x.serie), rotulo: serieNome(x.serie), valor: mediaPct(x.resultados), detalhe: plural(avaliados(x.resultados).length, 'aluno', 'alunos') }))} />
            </Cartao>
          </div>

          <ComparacaoIngresso resultados={resultados} config={config} />

          <details className="cartao recolhivel" id="por-turma">
            <summary>Ver por turma</summary>
            <LembreteCooperacao chave={`coordenacao-${avaliacao.id}`} />
            <div className="segmentos segmentos-grandes" role="group" aria-label="Ano">
              {SERIES.filter((s) => turmas.some((t) => t.serie === s)).map((s) => (
                <button key={s} className={`segmento ${serieTurmas === s ? 'ativo' : ''}`} onClick={() => setSerieTurmas(s)}>
                  {serieNome(s)}
                </button>
              ))}
            </div>
            <TurmasDoAno
              resultados={resultados.filter((r) => r.turma.serie === serieTurmas)}
              turmas={turmas.filter((t) => t.serie === serieTurmas)}
              serie={serieTurmas}
              config={config}
              anoLetivo={avaliacao.anoLetivo}
              cadernoId={cadernoDaSerie(db, avaliacao.id, serieTurmas)?.id}
            />
            <div className="form-acoes">
              <button className="btn btn-pequeno" onClick={exportarTurmas}>
                <FileSpreadsheet size={15} aria-hidden /> Baixar planilha das turmas
              </button>
            </div>
          </details>

          <details className="cartao recolhivel">
            <summary>Alunos para acompanhar ({lista.filter((r) => faixaDe(r.correcao.pct, config) === 0).length})</summary>
            <AlunosParaAcompanhar resultados={resultados} config={config} />
          </details>
        </>
      )}
    </>
  )
}

function TurmasDoAno(props: { resultados: ResultadoAluno[]; turmas: ReturnType<typeof turmasDoColegio>; serie: Serie; config: Config; anoLetivo: number; cadernoId?: string }) {
  const { resultados, config } = props
  const porTurma = agruparPor(resultados, (r) => r.turma.id)
  const disciplinas = desempenhoPor(resultados, (q) => q.disciplina)
    .sort((a, b) => ordemDisciplina(a.chave, b.chave))
    .map((d) => d.chave)
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
              <th>Alunos por faixa</th>
              <th className="num">Média</th>
              {disciplinas.map((d) => (
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
              const media = mediaPct(l.rs)
              const porDisciplina = new Map(desempenhoPor(l.rs, (q) => q.disciplina).map((d) => [d.chave, d.pct]))
              return (
                <tr key={l.chave} className={l.turmaId ? '' : 'linha-colegio'}>
                  <td>
                    {l.turmaId && props.cadernoId ? <Link to={`/coordenacao/resultados/${props.cadernoId}/${l.turmaId}`}>{l.rotulo}</Link> : <strong>{l.rotulo}</strong>}
                    <span className="texto-2 bloco pequeno">
                      {plural(p.avaliados, 'avaliado', 'avaliados')} · {plural(novos, 'novo no colégio', 'novos no colégio')}
                      {p.adaptadas ? ` · ${p.adaptadas} com prova adaptada` : ''}
                    </span>
                  </td>
                  <td>
                    <MiniFaixas contagem={contarFaixas(l.rs, config)} />
                  </td>
                  <td className="num">
                    {p.avaliados === 0 ? <span className="texto-2">ainda sem resultados</span> : poucos && l.turmaId ? <span className="texto-2">poucos alunos</span> : pct(media)}
                  </td>
                  {disciplinas.map((d) => {
                    const v = porDisciplina.get(d)
                    return (
                      <td key={d} className={`num ${v != null && !poucos ? `calor-${faixaDe(v, config)}` : ''}`}>
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
        As turmas aparecem sempre na mesma ordem. Diferenças de poucos pontos costumam ser acaso: olhe para o que se repete em várias turmas. Turmas com
        menos de {MINIMO_POR_TURMA} alunos avaliados mostram só as faixas.
      </p>
    </>
  )
}

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

function AlunosParaAcompanhar({ resultados, config }: { resultados: ResultadoAluno[]; config: Config }) {
  const abaixo = avaliados(resultados).filter((r) => faixaDe(r.correcao.pct, config) === 0)
  const porTurma = [...agruparPor(abaixo, (r) => r.turma)].sort(([a], [b]) => a.serie - b.serie || a.nome.localeCompare(b.nome))
  if (!abaixo.length) return <p className="texto-2">Nenhum aluno ficou abaixo do básico.</p>
  return (
    <>
      <LembreteCooperacao chave="acompanhar">
        Esta lista serve para combinar o acompanhamento com os professores, não para comparar turmas. Turmas com mais alunos aqui podem ter recebido mais
        alunos novos ou ter mais faltas.
      </LembreteCooperacao>
      <div className="grupos">
        {porTurma.map(([turma, lista]) => (
          <div key={turma.id} className="grupo">
            <h3>{turmaNome(turma)}</h3>
            <ul>
              {lista
                .sort((a, b) => a.aluno.numero - b.aluno.numero)
                .map((r) => (
                  <li key={r.aluno.id}>
                    {identificacao(r.aluno)} <span className="texto-2">· {r.correcao.acertos} de {r.correcao.validas}</span>
                    {ehNovo(r.aluno, turma.anoLetivo) && <span className="tag-novo">Novo</span>}
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="btn btn-pequeno nao-imprimir" onClick={() => window.print()}>
        <Printer size={15} aria-hidden /> Imprimir
      </button>
    </>
  )
}
