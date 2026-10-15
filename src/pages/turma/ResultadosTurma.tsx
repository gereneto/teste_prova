import { FileSpreadsheet, MessageSquareText, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoGrupos } from '../../components/ComparacaoGrupos'
import { Aviso, Barras, Cartao, ColunasPorQuestao, Histograma, Kpi, LegendaFaixas, MiniBarra, Vazio } from '../../components/ui'
import { buscarHabilidade } from '../../data/bncc'
import { avaliacaoAnterior } from '../../lib/consultas'
import {
  analisarQuestoes,
  avaliados,
  coletarResultados,
  desempenhoPor,
  ehNovo,
  faixaDe,
  marcaEm,
  mediaPct,
  NOMES_FAIXAS,
  participacao,
  progressoDaTurma,
  questaoValida,
  type AnaliseQuestao,
  type ResultadoAluno,
} from '../../lib/estatisticas'
import { baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { dataCurta, pct, plural, turmaNome } from '../../lib/formato'
import { identificacao } from '../../lib/iniciais'
import { comentarioEmFrase } from '../../lib/leitura'
import { BRANCO, DISCIPLINAS_DA_PROVA, LETRAS, RASURA, VAZIO, type Caderno, type Letra } from '../../types'
import { CabecalhoTurma } from './CabecalhoTurma'
import { useContextoTurma, type ContextoTurma } from './contexto'

export default function ResultadosTurma() {
  const contexto = useContextoTurma()
  if ('erro' in contexto) {
    return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  }
  return <TelaResultados {...contexto} />
}

export function rotuloSituacao(r: ResultadoAluno): string {
  if (!r.completo) return r.situacao ? 'Lançamento incompleto' : 'Ainda não lançado'
  if (r.situacao === 'faltou') return 'Faltou'
  if (r.situacao === 'adaptada') return 'Prova adaptada'
  return 'Presente'
}

const textoMarca = (marca: string) => (marca === BRANCO ? 'branco' : marca === RASURA ? 'rasura' : marca === VAZIO ? '' : marca)

type Aba = 'resumo' | 'alunos' | 'questoes' | 'habilidades'

function TelaResultados({ db, perfil, caderno, avaliacao, turma, colegio, lancamento, alunos, base }: ContextoTurma) {
  const [params, setParams] = useSearchParams()
  // A Solar vê os números da turma, mas não os alunos (a lista fica com o colégio).
  const comAlunos = perfil.papel !== 'solar'
  const abas: { id: Aba; rotulo: string }[] = [
    { id: 'resumo', rotulo: 'Resumo' },
    ...(comAlunos ? [{ id: 'alunos' as const, rotulo: 'Alunos' }] : []),
    { id: 'questoes', rotulo: 'Questões' },
    { id: 'habilidades', rotulo: 'Habilidades' },
  ]
  const aba: Aba = abas.find((a) => a.id === params.get('aba'))?.id ?? 'resumo'

  const resultados = useMemo(() => coletarResultados(db, { avaliacaoId: avaliacao.id, turmaId: turma.id }), [db, avaliacao.id, turma.id])
  const lista = avaliados(resultados)
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const analise = analisarQuestoes(caderno, resultados)
  const semGabarito = caderno.questoes.filter((q) => !q.anulada && q.gabarito === null).length
  const mudancasGabarito = db.historico.filter((e) => e.cadernoId === caderno.id && e.avisarTurmas).slice(-3)

  function exportar() {
    baixarCsv(
      `resultados-${paraNomeDeArquivo(`${colegio.nome} ${turmaNome(turma)} ${avaliacao.titulo}`)}.csv`,
      ['Nº', 'Iniciais', 'Sexo', 'Entrou no colégio', 'Novo no colégio', 'Situação', 'Acertos', 'Questões que contam', '% de acertos', 'Faixa de acerto', ...caderno.questoes.map((_, i) => `Q${i + 1}`)],
      resultados.map((r) => [
        r.aluno.numero,
        r.aluno.iniciais,
        r.aluno.sexo,
        r.aluno.anoIngresso,
        r.aluno.anoIngresso == null ? '' : ehNovo(r.aluno, turma.anoLetivo) ? 'sim' : 'não',
        rotuloSituacao(r),
        r.correcao?.acertos,
        r.correcao?.validas,
        r.correcao?.pct,
        r.correcao ? NOMES_FAIXAS[faixaDe(r.correcao.pct)] : '',
        ...caderno.questoes.map((_, i) => (r.situacao === 'presente' ? textoMarca(marcaEm(r.marcas, i)) : '')),
      ]),
      `Dados de alunos do ${colegio.nome}, ${turmaNome(turma)}. Uso pedagógico interno.`,
    )
  }

  const acoes = (
    <>
      {comAlunos && (
        <button className="btn" onClick={exportar} disabled={!resultados.length}>
          <FileSpreadsheet size={16} aria-hidden /> Baixar planilha da turma
        </button>
      )}
      <button className="btn" onClick={() => window.print()}>
        <Printer size={16} aria-hidden /> Imprimir
      </button>
    </>
  )

  return (
    <>
      <CabecalhoTurma db={db} perfil={perfil} turma={turma} colegio={colegio} base={base} aba="resultados" caderno={caderno} acoes={acoes} />

      {progresso.status !== 'concluido' && (
        <Aviso tom="atencao">
          Resultados parciais: {progresso.lancados} de {plural(progresso.total, 'aluno lançado', 'alunos lançados')}.
        </Aviso>
      )}
      {!caderno.conferencia && semGabarito === 0 && <Aviso tom="info">Resultado preliminar: a Solar ainda vai conferir o gabarito desta prova.</Aviso>}
      {semGabarito > 0 && <Aviso tom="info">A Solar ainda não definiu o gabarito de {plural(semGabarito, 'questão', 'questões')}. Elas ficam fora do cálculo.</Aviso>}
      {mudancasGabarito.map((e) => (
        <Aviso key={e.id} tom="info">
          {dataCurta(e.em)}: a equipe Solar {e.texto.charAt(0).toLowerCase() + e.texto.slice(1)}
        </Aviso>
      ))}

      <div className="segmentos segmentos-grandes nao-imprimir" role="tablist" aria-label="Partes dos resultados">
        {abas.map((a) => (
          <button
            key={a.id}
            role="tab"
            aria-selected={aba === a.id}
            className={`segmento ${aba === a.id ? 'ativo' : ''}`}
            onClick={() => setParams(a.id === 'resumo' ? {} : { aba: a.id }, { replace: true })}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {!lista.length ? (
        <Vazio
          titulo="Ainda não há alunos avaliados"
          acao={
            comAlunos && (
              <Link className="btn btn-primario" to={`${base}/lancar/${caderno.id}/${turma.id}`}>
                Lançar respostas
              </Link>
            )
          }
        >
          Os resultados aparecem assim que o primeiro aluno tiver todas as questões lançadas.
        </Vazio>
      ) : aba === 'resumo' ? (
        <Resumo resultados={resultados} analise={analise} caderno={caderno} />
      ) : aba === 'alunos' ? (
        <Alunos {...{ db, caderno, avaliacao, turma, resultados }} />
      ) : aba === 'questoes' ? (
        <Questoes caderno={caderno} analise={analise} />
      ) : (
        <Habilidades resultados={resultados} />
      )}
    </>
  )
}

function Resumo({ resultados, analise, caderno }: { resultados: ResultadoAluno[]; analise: AnaliseQuestao[]; caderno: Caderno }) {
  const lista = avaliados(resultados)
  const media = mediaPct(resultados)
  const part = participacao(resultados)
  const validas = caderno.questoes.filter(questaoValida).length
  const mediaAcertos = lista.length ? lista.reduce((s, r) => s + r.correcao.acertos, 0) / lista.length : 0
  const porDisciplina = DISCIPLINAS_DA_PROVA.map((d) => desempenhoPor(resultados, (q) => q.disciplina).find((x) => x.chave === d)).filter(Boolean)
  return (
    <>
      <div className="grade grade-kpis grade-kpis-3">
        <Kpi rotulo="Acerto médio da turma" valor={pct(media)} detalhe={`${Math.round(mediaAcertos)} de ${validas} questões, em média`} />
        <Kpi rotulo="Alunos avaliados" valor={`${part.avaliados} de ${part.matriculados}`} detalhe={[part.faltas && plural(part.faltas, 'faltou', 'faltaram'), part.adaptadas && `${part.adaptadas} com prova adaptada`].filter(Boolean).join(' · ')} />
        <Kpi rotulo="Questões que contam" valor={validas} detalhe={caderno.questoes.length > validas ? `${caderno.questoes.length - validas} fora do cálculo` : 'todas'} />
      </div>

      <div className="grade grade-2">
        <Cartao titulo="Alunos por faixa de acerto">
          <Histograma resultados={resultados} />
        </Cartao>
        <Cartao titulo="Acerto por disciplina">
          <Barras itens={porDisciplina.map((d) => ({ chave: d!.chave, rotulo: d!.chave, valor: d!.pct, detalhe: plural(d!.questoes, 'questão', 'questões') }))} />
        </Cartao>
      </div>

      <Cartao titulo="Acerto por questão" sub="Percentual da turma que acertou cada questão. A linha tracejada marca a metade.">
        <ColunasPorQuestao itens={analise.map((a) => ({ numero: a.indice + 1, valor: a.pctAcerto, disciplina: a.questao.disciplina }))} />
        <LegendaFaixas />
      </Cartao>

      <ComparacaoGrupos resultados={resultados} />
    </>
  )
}

function Alunos(props: { db: ContextoTurma['db']; caderno: Caderno; avaliacao: ContextoTurma['avaliacao']; turma: ContextoTurma['turma']; resultados: ResultadoAluno[] }) {
  const { db, caderno, avaliacao, turma, resultados } = props
  const [ordem, setOrdem] = useState<'numero' | 'acertos'>('numero')
  const [ficha, setFicha] = useState<string | null>(null)
  const linhas = ordem === 'numero' ? resultados : [...resultados].sort((a, b) => (b.correcao?.pct ?? -1) - (a.correcao?.pct ?? -1))

  // Resultados da avaliação do ano anterior dos alunos que estão na turma agora (de qualquer turma em que estavam).
  const anterior = avaliacaoAnterior(db, avaliacao)
  const doAnoAnterior = useMemo(() => {
    if (!anterior || turma.anoLetivo !== db.config.anoLetivo) return new Map<string, ResultadoAluno>()
    const ids = new Set(resultados.map((r) => r.aluno.id))
    return new Map(coletarResultados(db, { avaliacaoId: anterior.id }).filter((r) => ids.has(r.aluno.id)).map((r) => [r.aluno.id, r]))
  }, [db, anterior, turma.anoLetivo, resultados])

  return (
    <>
      <Cartao
        titulo="Alunos"
        acoes={
          <div className="segmentos" role="group" aria-label="Ordenar alunos">
            <button className={`segmento ${ordem === 'numero' ? 'ativo' : ''}`} onClick={() => setOrdem('numero')}>
              Por número
            </button>
            <button className={`segmento ${ordem === 'acertos' ? 'ativo' : ''}`} onClick={() => setOrdem('acertos')}>
              Por acertos
            </button>
          </div>
        }
      >
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th className="num">Nº</th>
                <th>Iniciais</th>
                <th>Sexo</th>
                <th>Entrou no colégio</th>
                <th className="num">Acertos</th>
                <th className="coluna-barra">% de acertos</th>
                {doAnoAnterior.size > 0 && anterior && <th className="num">{anterior.titulo}</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => {
                const antes = doAnoAnterior.get(r.aluno.id)
                return (
                  <tr key={r.aluno.id}>
                    <td className="num">{r.aluno.numero || '—'}</td>
                    <td>
                      {r.aluno.iniciais || <span className="texto-2">—</span>}
                      {ehNovo(r.aluno, turma.anoLetivo) && <span className="tag-novo">Novo</span>}
                    </td>
                    <td>{r.aluno.sexo ?? <span className="texto-2">—</span>}</td>
                    <td>{r.aluno.anoIngresso ?? <span className="texto-2">—</span>}</td>
                    {r.correcao ? (
                      <>
                        <td className="num">
                          {r.correcao.acertos} de {r.correcao.validas}
                        </td>
                        <td className="coluna-barra">
                          <MiniBarra valor={r.correcao.pct} />
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="texto-2">
                        {rotuloSituacao(r)}
                      </td>
                    )}
                    {doAnoAnterior.size > 0 && anterior && <td className="num">{antes?.correcao ? pct(antes.correcao.pct) : <span className="texto-2">—</span>}</td>}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {doAnoAnterior.size > 0 && anterior && (
          <p className="texto-2 pequeno">A última coluna mostra o acerto de cada aluno na {anterior.titulo}, que tinha outra prova e, às vezes, outra turma.</p>
        )}
      </Cartao>

      <Cartao titulo="Mapa da turma" sub="Cada linha é um aluno; cada coluna, uma questão. Casa clara: acertou. Casa vermelha: a letra que marcou. Toque num aluno para ver as questões que ele errou.">
        <div className="tabela-rolagem">
          <table className="mapa">
            <thead>
              <tr>
                <th className="mapa-aluno">Aluno</th>
                {caderno.questoes.map((q, i) => (
                  <th key={i} className={q.anulada ? 'anulada' : ''}>
                    {i + 1}
                  </th>
                ))}
                <th className="num">Acertos</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((r) => (
                <tr key={r.aluno.id} className={ficha === r.aluno.id ? 'aberta' : ''}>
                  <th className="mapa-aluno">
                    <button type="button" className="link-botao" onClick={() => setFicha(ficha === r.aluno.id ? null : r.aluno.id)} aria-expanded={ficha === r.aluno.id}>
                      {r.aluno.numero || '—'} · {r.aluno.iniciais || '—'}
                    </button>
                  </th>
                  {r.correcao ? (
                    r.correcao.porQuestao.map((res, i) => (
                      <td key={i} className={`mapa-${res}`}>
                        {res === 'certa' || res === 'fora' ? '' : res === 'branco' ? '–' : res === 'rasura' ? '*' : marcaEm(r.marcas, i)}
                      </td>
                    ))
                  ) : (
                    <td colSpan={caderno.questoes.length} className="mapa-ausente">
                      {rotuloSituacao(r)}
                    </td>
                  )}
                  <td className="num">{r.correcao ? r.correcao.acertos : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ficha && <FichaAluno resultado={resultados.find((r) => r.aluno.id === ficha)!} caderno={caderno} />}
      </Cartao>
    </>
  )
}

function FichaAluno({ resultado, caderno }: { resultado: ResultadoAluno; caderno: Caderno }) {
  if (!resultado.correcao) {
    return (
      <div className="ficha">
        <h3>{identificacao(resultado.aluno)}</h3>
        <p>{rotuloSituacao(resultado)}.</p>
      </div>
    )
  }
  const erradas = resultado.correcao.porQuestao.flatMap((res, i) => (res !== 'certa' && res !== 'fora' ? [i] : []))
  return (
    <div className="ficha">
      <h3>
        {identificacao(resultado.aluno)} · {resultado.correcao.acertos} de {resultado.correcao.validas} ({pct(resultado.correcao.pct)})
      </h3>
      {erradas.length ? (
        <ul>
          {erradas.map((i) => {
            const q = caderno.questoes[i]
            const h = buscarHabilidade(q.habilidade)
            const marca = marcaEm(resultado.marcas, i)
            return (
              <li key={i}>
                <strong>Questão {i + 1}</strong> ({q.disciplina}): {marca === BRANCO ? 'em branco' : marca === RASURA ? 'rasurada' : `marcou ${marca}, a certa era ${q.gabarito}`}.
                {h && <span className="texto-2 bloco pequeno">{h.descricao}</span>}
              </li>
            )
          })}
        </ul>
      ) : (
        <p>Acertou todas as questões que contam.</p>
      )}
    </div>
  )
}

function Questoes({ caderno, analise }: { caderno: Caderno; analise: AnaliseQuestao[] }) {
  const letras = LETRAS.slice(0, caderno.numAlternativas)
  return (
    <Cartao titulo="Questões" sub="Acerto de cada questão e quantos alunos marcaram cada alternativa">
      <div className="tabela-rolagem">
        <table className="tabela tabela-questoes">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Disciplina e habilidade</th>
              <th>Gabarito</th>
              <th className="coluna-barra">Acerto</th>
              <th>Marcações</th>
            </tr>
          </thead>
          <tbody>
            {analise.map((a) => {
              const habilidade = buscarHabilidade(a.questao.habilidade)
              const erro = a.erroMaisComum
              const comentario = erro ? a.questao.comentarios?.[erro.marca as Letra] : undefined
              return [
                <tr key={a.indice}>
                  <td className="num">
                    <strong>{a.indice + 1}</strong>
                  </td>
                  <td>
                    {a.questao.disciplina}
                    {habilidade && (
                      <span className="texto-2 bloco pequeno">
                        {habilidade.descricao} <span className="codigo">({habilidade.codigo})</span>
                      </span>
                    )}
                  </td>
                  <td>{a.questao.anulada ? <span className="texto-2">anulada</span> : (a.questao.gabarito ?? <span className="texto-2">sem gabarito</span>)}</td>
                  <td className="coluna-barra">
                    {a.pctAcerto != null && (
                      <>
                        <MiniBarra valor={a.pctAcerto} />
                        <span className="texto-2 bloco pequeno">
                          {Math.round((a.pctAcerto * a.n) / 100)} de {a.n} acertaram
                        </span>
                      </>
                    )}
                  </td>
                  <td className="marcacoes">
                    {letras.map((l) => (
                      <span key={l} className={l === a.questao.gabarito ? 'certa' : ''}>
                        {l} {a.contagem[l] ?? 0}
                      </span>
                    ))}
                    {(a.contagem[BRANCO] ?? 0) > 0 && <span>branco {a.contagem[BRANCO]}</span>}
                    {(a.contagem[RASURA] ?? 0) > 0 && <span>rasura {a.contagem[RASURA]}</span>}
                  </td>
                </tr>,
                (comentario || a.questao.comoRetomar) && (
                  <tr key={`${a.indice}-comentario`} className="linha-comentario">
                    <td />
                    <td colSpan={4}>
                      <MessageSquareText size={15} aria-hidden /> <strong>Da equipe Solar:</strong> {comentario && comentarioEmFrase(erro!.marca, comentario)}
                      {a.questao.comoRetomar && <span className="bloco">Como retomar: {a.questao.comoRetomar}</span>}
                    </td>
                  </tr>
                ),
              ]
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

function Habilidades({ resultados }: { resultados: ResultadoAluno[] }) {
  const porHabilidade = desempenhoPor(resultados, (q) => q.habilidade).sort((a, b) => a.pct - b.pct)
  return (
    <Cartao titulo="Habilidades da BNCC" sub="Da habilidade com menos acertos para a com mais">
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Habilidade</th>
              <th className="num">Questões</th>
              <th className="coluna-barra">Acerto</th>
            </tr>
          </thead>
          <tbody>
            {porHabilidade.map((d) => {
              const h = buscarHabilidade(d.chave)
              return (
                <tr key={d.chave}>
                  <td className="descricao-habilidade">
                    {h?.descricao ?? d.chave} <span className="codigo texto-2">({d.chave})</span>
                  </td>
                  <td className="num">{d.questoes}</td>
                  <td className="coluna-barra">
                    <MiniBarra valor={d.pct} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}
