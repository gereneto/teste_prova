import { FileSpreadsheet, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoIngresso } from '../../components/ComparacaoIngresso'
import { Aviso, BarraFaixas, Barras, Cabecalho, Cartao, Kpi, MiniBarra, Selo, SeloFaixa, Vazio, type Tom } from '../../components/ui'
import { buscarHabilidade, ordemDisciplina } from '../../data/bncc'
import { avaliacaoAtual, avaliacoesOrdenadas, cadernoDaSerie, etapaAvaliacao, nomesProfessores } from '../../lib/consultas'
import {
  agruparPor,
  agruparPorAnoDeIngresso,
  analisarQuestoes,
  avaliados,
  coletarResultados,
  contarFaixas,
  desempenhoPor,
  MINIMO_PARA_ALERTAS,
  mediaPct,
  NOMES_FAIXAS,
  participacao,
  progressoDe,
  separarPorIngresso,
  type AlertaQuestao,
  type ResultadoAluno,
} from '../../lib/estatisticas'
import { baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { compararTexto, pct, plural, serieNome, turmaNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { BRANCO, LETRAS, RASURA, SERIES, type Db, type Serie } from '../../types'

const ALERTAS: Record<AlertaQuestao, { rotulo: string; texto: string; tom: Tom }> = {
  gabarito_suspeito: {
    rotulo: 'Gabarito suspeito',
    texto: 'Os alunos que vão bem no resto da prova erram esta questão, e outra alternativa foi mais marcada que a do gabarito. Confira o gabarito ou anule a questão.',
    tom: 'perigo',
  },
  muito_dificil: { rotulo: 'Muito difícil', texto: 'Menos de 20% de acertos, menos do que se esperaria só no chute.', tom: 'atencao' },
  muito_facil: { rotulo: 'Muito fácil', texto: 'Mais de 95% de acertos: a questão quase não diferencia os alunos.', tom: 'info' },
}

const HABILIDADES_VISIVEIS = 10

export default function Estatisticas() {
  const db = useDb()
  const [params, setParams] = useSearchParams()
  const [todasHabilidades, setTodasHabilidades] = useState(false)
  const [soComAlerta, setSoComAlerta] = useState(false)
  const [piorPrimeiro, setPiorPrimeiro] = useState(false)

  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacao = db.avaliacoes.find((a) => a.id === params.get('avaliacao')) ?? avaliacaoAtual(db) ?? avaliacoes[0]
  const serie: Serie | null = SERIES.find((s) => String(s) === params.get('serie')) ?? null
  const colegioId = db.colegios.find((c) => c.id === params.get('colegio'))?.id ?? null
  const resultados = useMemo(
    () => (avaliacao ? coletarResultados(db, { avaliacaoId: avaliacao.id, serie, colegioId }) : []),
    [db, avaliacao, serie, colegioId],
  )

  function filtrar(chave: string, valor: string | null) {
    const novos = new URLSearchParams(params)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParams(novos, { replace: true })
  }

  if (!avaliacao) return <Vazio titulo="Ainda não há avaliações" />

  const config = db.config
  const lista = avaliados(resultados)
  const part = participacao(resultados)
  const media = mediaPct(resultados)
  const contagemFaixas = contarFaixas(resultados, config)
  const colegio = db.colegios.find((c) => c.id === colegioId)
  const escopo = [serie ? serieNome(serie) : 'todos os anos', colegio ? colegio.nome : 'todos os colégios'].join(' · ')
  const nomeArquivo = paraNomeDeArquivo([avaliacao.titulo, serie ? serieNome(serie) : '', colegio?.nome ?? ''].join(' '))

  const turmas = [...agruparPor(resultados, (r) => r.turma)].map(([turma, rs]) => ({
    turma,
    colegio: rs[0].colegio,
    resultados: rs,
    participacao: participacao(rs),
    media: mediaPct(rs),
    faixas: contarFaixas(rs, config),
    progresso: cadernoDaSerie(db, avaliacao.id, turma.serie) ? progressoDe(db, cadernoDaSerie(db, avaliacao.id, turma.serie)!, turma.id) : null,
  }))
  const turmasOrdenadas = [...turmas].sort((a, b) => {
    if (a.media == null) return 1
    if (b.media == null) return -1
    return piorPrimeiro ? a.media - b.media : b.media - a.media
  })
  const concluidas = turmas.filter((t) => t.progresso?.status === 'concluido').length
  const porColegio = [...agruparPor(resultados, (r) => r.colegio)]
    .map(([c, rs]) => ({ chave: c.id, rotulo: c.nome, valor: mediaPct(rs), detalhe: `${avaliados(rs).length} alunos` }))
    .sort((a, b) => (b.valor ?? -1) - (a.valor ?? -1))
  const porAno = SERIES.map((s) => {
    const rs = resultados.filter((r) => r.turma.serie === s)
    return { chave: String(s), rotulo: serieNome(s), valor: mediaPct(rs), detalhe: `${avaliados(rs).length} alunos` }
  }).filter((x) => x.valor != null)
  const porDisciplina = desempenhoPor(resultados, (q) => q.disciplina).sort((a, b) => ordemDisciplina(a.chave, b.chave))
  const porHabilidade = desempenhoPor(resultados, (q) => q.habilidade).sort((a, b) => a.pct - b.pct)
  const caderno = serie ? cadernoDaSerie(db, avaliacao.id, serie) : undefined
  const analise = caderno ? analisarQuestoes(caderno, resultados) : []

  function exportarTurmas() {
    baixarCsv(
      `turmas-${nomeArquivo}.csv`,
      ['Colégio', 'Cidade', 'UF', 'Turma', 'Turno', 'Professor(a)', 'Alunos', 'Avaliados', 'Faltas', 'Prova adaptada', 'Média de acertos (%)', ...NOMES_FAIXAS],
      [...turmas]
        .sort((a, b) => compararTexto(a.colegio.nome, b.colegio.nome) || a.turma.serie - b.turma.serie || compararTexto(a.turma.nome, b.turma.nome))
        .map((t) => [
          t.colegio.nome,
          t.colegio.cidade,
          t.colegio.uf,
          turmaNome(t.turma),
          t.turma.turno,
          nomesProfessores(db, t.turma),
          t.participacao.matriculados,
          t.participacao.avaliados,
          t.participacao.faltas,
          t.participacao.adaptadas,
          t.media,
          ...t.faixas,
        ]),
    )
  }

  function exportarHabilidades() {
    baixarCsv(
      `habilidades-${nomeArquivo}.csv`,
      ['Código', 'Componente', 'Unidade temática', 'Objeto de conhecimento', 'Habilidade', 'Questões', 'Respostas', 'Acertos', 'Acerto (%)'],
      porHabilidade.map((d) => {
        const h = buscarHabilidade(d.chave)
        return [d.chave, h?.componente, h?.unidade, h?.objeto, h?.descricao, d.questoes, d.respostas, d.acertos, d.pct]
      }),
    )
  }

  function exportarIngresso() {
    const grupos = [
      { rotulo: 'Novos no colégio', lista: separarPorIngresso(resultados).novos },
      { rotulo: 'Antigos', lista: separarPorIngresso(resultados).antigos },
      ...agruparPorAnoDeIngresso(resultados).map((g) => ({ rotulo: `Entraram em ${g.rotulo}`, lista: g.resultados })),
      { rotulo: 'Sem ano de entrada informado', lista: separarPorIngresso(resultados).sem_ano },
    ]
    baixarCsv(
      `novos-e-antigos-${nomeArquivo}.csv`,
      ['Grupo', 'Alunos avaliados', 'Média de acertos (%)', ...NOMES_FAIXAS],
      grupos.map((g) => [g.rotulo, avaliados(g.lista).length, mediaPct(g.lista), ...contarFaixas(g.lista, config)]),
    )
  }

  function exportarQuestoes() {
    if (!caderno) return
    const letras = LETRAS.slice(0, caderno.numAlternativas)
    baixarCsv(
      `questoes-${nomeArquivo}.csv`,
      ['Nº', 'Disciplina', 'Habilidade', 'Gabarito', 'Anulada', 'Alunos', 'Acerto (%)', ...letras, 'Em branco', 'Rasurada', 'Erro mais comum', 'Discriminação', 'Alertas'],
      analise.map((a) => [
        a.indice + 1,
        a.questao.disciplina,
        a.questao.habilidade,
        a.questao.gabarito,
        a.questao.anulada ? 'sim' : 'não',
        a.n,
        a.pctAcerto,
        ...letras.map((l) => a.contagem[l] ?? 0),
        a.contagem[BRANCO] ?? 0,
        a.contagem[RASURA] ?? 0,
        a.erroMaisComum?.marca,
        a.discriminacao,
        a.alertas.map((x) => ALERTAS[x].rotulo).join(', '),
      ]),
    )
  }

  const emLancamento = ['aplicacao', 'lancamento'].includes(etapaAvaliacao(avaliacao))

  return (
    <>
      <Cabecalho
        sobretitulo="Resultados"
        titulo="Estatísticas da rede"
        subtitulo="A Solar vê só números agregados: os nomes dos alunos ficam com as escolas."
      />

      <div className="cartao filtros">
        <label className="campo">
          <span>Avaliação</span>
          <select value={avaliacao.id} onChange={(e) => filtrar('avaliacao', e.target.value)}>
            {avaliacoes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.titulo}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Ano</span>
          <select value={serie ?? ''} onChange={(e) => filtrar('serie', e.target.value || null)}>
            <option value="">Todos os anos</option>
            {SERIES.map((s) => (
              <option key={s} value={s}>
                {serieNome(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Colégio</span>
          <select value={colegioId ?? ''} onChange={(e) => filtrar('colegio', e.target.value || null)}>
            <option value="">Todos os colégios</option>
            {[...db.colegios]
              .sort((a, b) => compararTexto(a.nome, b.nome))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </label>
        <div className="filtros-exportar">
          <span className="texto-2 pequeno">Exportar para Excel</span>
          <div className="form-acoes">
            <button className="btn btn-pequeno" onClick={exportarTurmas} disabled={!lista.length}>
              <FileSpreadsheet size={15} aria-hidden /> Turmas
            </button>
            <button className="btn btn-pequeno" onClick={exportarHabilidades} disabled={!lista.length}>
              <FileSpreadsheet size={15} aria-hidden /> Habilidades
            </button>
            <button className="btn btn-pequeno" onClick={exportarIngresso} disabled={!lista.length}>
              <FileSpreadsheet size={15} aria-hidden /> Novos e antigos
            </button>
            {caderno && (
              <button className="btn btn-pequeno" onClick={exportarQuestoes} disabled={!lista.length}>
                <FileSpreadsheet size={15} aria-hidden /> Questões
              </button>
            )}
          </div>
        </div>
      </div>

      {emLancamento && (
        <Aviso tom="atencao">
          Lançamento em andamento: {concluidas} de {plural(turmas.length, 'turma concluída', 'turmas concluídas')}. Os números ainda vão mudar.
        </Aviso>
      )}

      {!lista.length ? (
        <Vazio titulo="Ainda não há alunos avaliados nesta seleção">Os resultados aparecem assim que os professores lançam as respostas.</Vazio>
      ) : (
        <>
          <div className="grade grade-kpis">
            <Kpi
              rotulo="Alunos avaliados"
              valor={part.avaliados.toLocaleString('pt-BR')}
              detalhe={`${part.lancados} de ${part.matriculados} alunos já lançados · ${part.faltas} faltas`}
            />
            <Kpi rotulo="Média de acertos" valor={pct(media)} detalhe={media != null && <SeloFaixa valor={media} config={config} />} />
            <Kpi rotulo="Turmas concluídas" valor={`${concluidas} de ${turmas.length}`} detalhe={escopo} />
            <Kpi rotulo={NOMES_FAIXAS[0]} valor={pct((100 * contagemFaixas[0]) / lista.length)} detalhe={`${contagemFaixas[0]} alunos com menos de ${config.faixas[0]}%`} />
          </div>

          <div className="grade grade-2">
            <Cartao titulo="Faixas de desempenho" sub={escopo}>
              <BarraFaixas resultados={resultados} config={config} />
            </Cartao>
            <Cartao titulo="Por disciplina" sub="Percentual de acertos nas questões de cada disciplina">
              <Barras
                config={config}
                itens={porDisciplina.map((d) => ({ chave: d.chave, rotulo: d.chave, valor: d.pct, detalhe: plural(d.questoes, 'questão', 'questões') }))}
              />
            </Cartao>
          </div>

          {(!colegioId || !serie) && (
            <div className={`grade ${!colegioId && !serie ? 'grade-2' : ''}`}>
              {!colegioId && (
                <Cartao titulo="Média por colégio">
                  <Barras config={config} itens={porColegio} />
                </Cartao>
              )}
              {!serie && (
                <Cartao titulo="Média por ano">
                  <Barras config={config} itens={porAno} />
                </Cartao>
              )}
            </div>
          )}

          <ComparacaoIngresso resultados={resultados} config={config} />

          <Cartao
            titulo="Turmas"
            sub="Média de acertos e distribuição dos alunos pelas faixas"
            acoes={
              <div className="segmentos" role="group" aria-label="Ordenar turmas">
                <button className={`segmento ${!piorPrimeiro ? 'ativo' : ''}`} onClick={() => setPiorPrimeiro(false)}>
                  Maiores médias
                </button>
                <button className={`segmento ${piorPrimeiro ? 'ativo' : ''}`} onClick={() => setPiorPrimeiro(true)}>
                  Menores médias
                </button>
              </div>
            }
          >
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Colégio</th>
                    <th>Turma</th>
                    <th>Professor(a)</th>
                    <th className="num">Avaliados</th>
                    <th className="num">Média</th>
                    <th>Faixas</th>
                  </tr>
                </thead>
                <tbody>
                  {turmasOrdenadas.map((t) => (
                    <tr key={t.turma.id}>
                      <td>{t.colegio.nome}</td>
                      <td>
                        {turmaNome(t.turma)} {t.progresso?.status === 'em_andamento' && <Selo tom="atencao">parcial</Selo>}
                        {t.progresso?.status === 'nao_iniciado' && <Selo>não iniciada</Selo>}
                      </td>
                      <td>{nomesProfessores(db, t.turma)}</td>
                      <td className="num">
                        {t.participacao.avaliados}/{t.participacao.matriculados}
                      </td>
                      <td className="num">{pct(t.media)}</td>
                      <td>
                        <MiniFaixas contagem={t.faixas} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          <Cartao titulo="Habilidades da BNCC" sub="Da habilidade com menos acertos para a com mais">
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Habilidade</th>
                    <th className="num">Questões</th>
                    <th className="coluna-barra">Acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {(todasHabilidades ? porHabilidade : porHabilidade.slice(0, HABILIDADES_VISIVEIS)).map((d) => {
                    const h = buscarHabilidade(d.chave)
                    return (
                      <tr key={d.chave}>
                        <td className="codigo">
                          {d.chave}
                          <div className="texto-2 pequeno">{h?.componente}</div>
                        </td>
                        <td className="descricao-habilidade">{h?.descricao ?? '—'}</td>
                        <td className="num">{d.questoes}</td>
                        <td className="coluna-barra">
                          <MiniBarra valor={d.pct} config={config} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {porHabilidade.length > HABILIDADES_VISIVEIS && (
              <button className="btn btn-fantasma btn-pequeno" onClick={() => setTodasHabilidades(!todasHabilidades)}>
                {todasHabilidades ? 'Mostrar só as 10 com menos acertos' : `Mostrar todas as ${porHabilidade.length} habilidades`}
              </button>
            )}
          </Cartao>

          {caderno ? (
            <AnaliseQuestoes db={db} caderno={caderno} analise={analise} soComAlerta={soComAlerta} aoMudarFiltro={setSoComAlerta} />
          ) : (
            <EscolherAno db={db} avaliacaoId={avaliacao.id} colegioId={colegioId} resultados={resultados} aoEscolher={(s) => filtrar('serie', String(s))} />
          )}
        </>
      )}
    </>
  )
}

function MiniFaixas({ contagem }: { contagem: number[] }) {
  const total = contagem.reduce((s, v) => s + v, 0)
  if (!total) return <span className="texto-2">—</span>
  return (
    <span className="mini-faixas" title={contagem.map((n, i) => `${NOMES_FAIXAS[i]}: ${n}`).join(' · ')}>
      {contagem.map((n, i) => (n ? <span key={i} className={`faixa-${i}`} style={{ flexGrow: n }} /> : null))}
    </span>
  )
}

function EscolherAno(props: { db: Db; avaliacaoId: string; colegioId: string | null; resultados: ResultadoAluno[]; aoEscolher: (serie: Serie) => void }) {
  const opcoes = SERIES.map((serie) => {
    const caderno = cadernoDaSerie(props.db, props.avaliacaoId, serie)
    const alertas = caderno
      ? analisarQuestoes(
          caderno,
          props.resultados.filter((r) => r.turma.serie === serie),
        ).filter((a) => a.alertas.length).length
      : 0
    return { serie, caderno, alertas }
  }).filter((o) => o.caderno)

  return (
    <Cartao titulo="Análise por questão" sub="Cada ano tem um caderno diferente: escolha o ano para ver a análise de cada questão.">
      <div className="chips">
        {opcoes.map((o) => (
          <button key={o.serie} className="btn" onClick={() => props.aoEscolher(o.serie)}>
            {serieNome(o.serie)}
            {o.alertas > 0 && <Selo tom="perigo">{plural(o.alertas, 'alerta', 'alertas')}</Selo>}
          </button>
        ))}
      </div>
    </Cartao>
  )
}

function AnaliseQuestoes(props: {
  db: Db
  caderno: NonNullable<ReturnType<typeof cadernoDaSerie>>
  analise: ReturnType<typeof analisarQuestoes>
  soComAlerta: boolean
  aoMudarFiltro: (valor: boolean) => void
}) {
  const { caderno, analise } = props
  const letras = LETRAS.slice(0, caderno.numAlternativas)
  const comAlerta = analise.filter((a) => a.alertas.length)
  const visiveis = props.soComAlerta ? comAlerta : analise
  const n = analise[0]?.n ?? 0

  return (
    <Cartao
      titulo={`Análise por questão · caderno do ${serieNome(caderno.serie)}`}
      sub={`${n} alunos avaliados${n < MINIMO_PARA_ALERTAS ? ` · alertas aparecem a partir de ${MINIMO_PARA_ALERTAS} alunos` : ''}`}
      acoes={
        <>
          <label className="checkbox">
            <input type="checkbox" checked={props.soComAlerta} onChange={(e) => props.aoMudarFiltro(e.target.checked)} />
            Só questões com alerta ({comAlerta.length})
          </label>
          <Link className="btn btn-pequeno" to={`/solar/avaliacoes/${caderno.avaliacaoId}?serie=${caderno.serie}`}>
            <Pencil size={15} aria-hidden /> Editar gabarito
          </Link>
        </>
      }
    >
      {comAlerta.some((a) => a.alertas.includes('gabarito_suspeito')) && (
        <Aviso tom="perigo">
          {ALERTAS.gabarito_suspeito.texto} Ao corrigir o gabarito ou anular a questão, todos os resultados são recalculados na hora.
        </Aviso>
      )}
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Disciplina</th>
              <th>Habilidade</th>
              <th>Gabarito</th>
              <th className="coluna-barra">Acerto</th>
              <th>Marcações</th>
              <th className="num" title="Correlação entre acertar a questão e ir bem no resto da prova">
                Discriminação
              </th>
              <th>Alertas</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((a) => {
              const h = buscarHabilidade(a.questao.habilidade)
              return (
                <tr key={a.indice} className={a.alertas.includes('gabarito_suspeito') ? 'linha-alerta' : ''}>
                  <td className="num">{a.indice + 1}</td>
                  <td>{a.questao.disciplina}</td>
                  <td>
                    {h ? (
                      <abbr className="codigo" title={h.descricao}>
                        {h.codigo}
                      </abbr>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{a.questao.anulada ? <span className="texto-2">anulada</span> : (a.questao.gabarito ?? <span className="texto-2">sem gabarito</span>)}</td>
                  <td className="coluna-barra">{a.pctAcerto != null ? <MiniBarra valor={a.pctAcerto} config={props.db.config} /> : '—'}</td>
                  <td className="marcacoes">
                    {a.n > 0 &&
                      letras.map((l) => (
                        <span key={l} className={l === a.questao.gabarito ? 'certa' : ''}>
                          {l} {pct((100 * (a.contagem[l] ?? 0)) / a.n)}
                        </span>
                      ))}
                  </td>
                  <td className="num">{a.discriminacao != null ? a.discriminacao.toFixed(2).replace('.', ',') : '—'}</td>
                  <td>
                    <div className="chips">
                      {a.alertas.map((alerta) => (
                        <Selo key={alerta} tom={ALERTAS[alerta].tom} titulo={ALERTAS[alerta].texto}>
                          {ALERTAS[alerta].rotulo}
                        </Selo>
                      ))}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="texto-2 pequeno">
        Discriminação: de −1 a 1. Acima de 0,2 a questão separa bem quem domina o conteúdo; perto de 0 ou negativa merece revisão.
      </p>
    </Cartao>
  )
}

