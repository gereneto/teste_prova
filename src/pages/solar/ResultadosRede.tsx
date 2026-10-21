import { FileSpreadsheet, Pencil } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoGrupos } from '../../components/ComparacaoGrupos'
import {
  Aviso,
  Barras,
  Cabecalho,
  Cartao,
  ColunasPorQuestao,
  Explicacao,
  Histograma,
  Kpi,
  LegendaFaixas,
  LembreteCooperacao,
  MiniBarra,
  MiniFaixas,
  NOMES_STATUS,
  Selo,
  Vazio,
  type Tom,
} from '../../components/ui'
import { buscarHabilidade, ordemDisciplina } from '../../data/bncc'
import { avaliacaoAtual, avaliacoesOrdenadas, cadernoDe, etapaAvaliacao, permissoesDe, pessoaDoPerfil } from '../../lib/consultas'
import { faixaDe, MINIMO_PARA_ALERTAS, NOMES_FAIXAS, type AlertaQuestao, type AnaliseQuestao } from '../../lib/estatisticas'
import { AVISO_COMPARACAO, baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { compararTexto, pct, plural, resumir, serieNome, turmaNome } from '../../lib/formato'
import { LIMITE_METADE, MINIMO_QUADRO } from '../../lib/leitura'
import {
  analisarQuestoesAg,
  avaliadosAg,
  desempenhoAg,
  faixasAg,
  grupoAg,
  mediaAg,
  participacaoAg,
  progressoAg,
  quadroColegioQuestaoAg,
  resumoGruposAg,
  type AgregadoTurma,
} from '../../lib/rede'
import { useDb } from '../../store/db'
import { useRede, type Rede } from '../../store/painel'
import { usePerfil } from '../../store/perfil'
import { BRANCO, DISCIPLINAS_DA_PROVA, LETRAS, RASURA, SERIES, VARIAS_DISCIPLINAS, type Caderno, type Colegio, type Db, type Disciplina, type Serie } from '../../types'
import { SeletorDisciplina } from '../coordenacao/ResultadosColegio'

const ALERTAS: Record<AlertaQuestao, { rotulo: string; texto: string; tom: Tom }> = {
  gabarito_suspeito: {
    rotulo: 'Gabarito suspeito',
    texto: 'Os alunos que vão bem no resto da prova erram esta questão, e outra alternativa foi mais marcada que a do gabarito. Confira o gabarito ou anule a questão.',
    tom: 'perigo',
  },
  muito_dificil: { rotulo: 'Muito difícil', texto: 'Menos de 20% de acertos, menos do que se esperaria só no chute.', tom: 'atencao' },
  muito_facil: { rotulo: 'Muito fácil', texto: 'Mais de 95% de acertos: a questão quase não diferencia os alunos.', tom: 'info' },
  nao_separa: { rotulo: 'Não separa bem', texto: 'Quem vai bem e quem vai mal no resto da prova acerta esta questão na mesma proporção. Vale rever o enunciado.', tom: 'atencao' },
}

const HABILIDADES_VISIVEIS = 10
/** Turma "pode precisar de apoio" quando pelo menos esta parte dos alunos acertou menos de 40% da prova. */
const PCT_APOIO = 30
const nomesFaixasCsv = NOMES_FAIXAS.map((f) => `Alunos com ${f.toLowerCase()} de acertos`)
/** Acima desta parte de faltas, a média da turma diz pouco. */
const PCT_FALTAS_ALTO = 20

const nomeCurto = (colegio: Colegio) => colegio.nome.replace(/^(Colégio|Escola)\s+/, '')

/**
 * Os resultados da rede para a Solar: somados por turma e prova (lib/rede.ts), nunca aluno a aluno. Os números são de
 * uma prova (a de uma disciplina); com mais de uma disciplina, "Acerto por disciplina" compara as provas.
 */
export default function ResultadosRede() {
  const db = useDb()
  const rede = useRede()
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const [todasHabilidades, setTodasHabilidades] = useState(false)
  const [soApoio, setSoApoio] = useState(false)
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)

  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacao = db.avaliacoes.find((a) => a.id === params.get('avaliacao')) ?? avaliacaoAtual(db) ?? avaliacoes[0]
  const serie: Serie | null = SERIES.find((s) => String(s) === params.get('serie')) ?? null
  const disciplina: Disciplina = DISCIPLINAS_DA_PROVA.find((d) => d === params.get('disciplina')) ?? DISCIPLINAS_DA_PROVA[0]
  const colegioId = db.colegios.find((c) => c.id === params.get('colegio'))?.id ?? null
  // Todas as provas (para comparar as disciplinas) e só a escolhida (para todo o resto).
  const ambas = useMemo(
    () =>
      avaliacao
        ? rede.painel.turmas.filter((ag) => {
            const caderno = rede.cadernoDe(ag.caderno)
            return caderno?.avaliacaoId === avaliacao.id && (!serie || caderno.serie === serie) && (!colegioId || rede.colegioDaTurma(ag.turma) === colegioId)
          })
        : [],
    [rede, avaliacao, serie, colegioId],
  )
  const ags = useMemo(() => ambas.filter((ag) => rede.cadernoDe(ag.caderno)?.disciplina === disciplina), [ambas, rede, disciplina])

  function filtrar(chave: string, valor: string | null) {
    const novos = new URLSearchParams(params)
    if (valor) novos.set(chave, valor)
    else novos.delete(chave)
    setParams(novos, { replace: true })
  }

  if (!avaliacao) return <Vazio titulo="Ainda não há avaliações" />

  const n = avaliadosAg(ags)
  const part = participacaoAg(ags)
  const media = mediaAg(ags, rede.cadernoDe)
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))
  const colegio = db.colegios.find((c) => c.id === colegioId)
  const escopo = [disciplina, serie ? serieNome(serie) : 'todos os anos', colegio ? colegio.nome : 'todos os colégios'].join(' · ')
  const nomeArquivo = paraNomeDeArquivo([avaliacao.titulo, disciplina, serie ? serieNome(serie) : '', colegio?.nome ?? ''].join(' '))
  const anoLetivo = avaliacao.anoLetivo
  const doColegio = (c: Colegio) => ags.filter((ag) => rede.colegioDaTurma(ag.turma) === c.id)

  // Turmas sempre na mesma ordem: colégio, ano e letra. Sem ordenar por média e sem o nome do professor.
  const turmas = ags
    .flatMap((ag) => {
      const turma = db.turmas.find((t) => t.id === ag.turma)
      const doTurma = turma && db.colegios.find((c) => c.id === turma.colegioId)
      if (!turma || !doTurma) return []
      const p = participacaoAg([ag])
      const total = ag.faixas.reduce((s, v) => s + v, 0)
      return [
        {
          ag,
          turma,
          colegio: doTurma,
          caderno: rede.cadernoDe(ag.caderno),
          participacao: p,
          media: mediaAg([ag], rede.cadernoDe),
          faixas: ag.faixas,
          novos: ag.grupos.novos?.n ?? 0,
          pctAbaixo: total ? (100 * (ag.faixas[0] + ag.faixas[1])) / total : 0,
          pctFaltas: p.lancados ? (100 * p.faltas) / p.lancados : 0,
          progresso: progressoAg(ag),
        },
      ]
    })
    .sort((a, b) => compararTexto(a.colegio.nome, b.colegio.nome) || a.turma.serie - b.turma.serie || compararTexto(a.turma.nome, b.turma.nome))
  const turmasVisiveis = soApoio ? turmas.filter((t) => t.ag.avaliados >= 5 && t.pctAbaixo >= PCT_APOIO) : turmas
  const concluidas = turmas.filter((t) => t.progresso.status === 'concluido').length
  const porColegio = colegios
    .filter((c) => !colegioId || c.id === colegioId)
    .map((c) => ({ chave: c.id, rotulo: c.nome, valor: mediaAg(doColegio(c), rede.cadernoDe), detalhe: plural(avaliadosAg(doColegio(c)), 'aluno', 'alunos') }))
  const porAno = SERIES.map((s) => {
    const doAno = ags.filter((ag) => rede.cadernoDe(ag.caderno)?.serie === s)
    return { chave: String(s), rotulo: serieNome(s), valor: mediaAg(doAno, rede.cadernoDe), detalhe: plural(avaliadosAg(doAno), 'aluno', 'alunos') }
  }).filter((x) => x.valor != null)
  const porDisciplina = desempenhoAg(ambas, rede.cadernoDe, (q) => q.disciplina).sort((a, b) => ordemDisciplina(a.chave, b.chave))
  const porHabilidade = desempenhoAg(ags, rede.cadernoDe, (q) => q.habilidade).sort((a, b) => a.pct - b.pct)
  const caderno = serie ? cadernoDe(db, avaliacao.id, serie, disciplina) : undefined
  const analise = caderno ? analisarQuestoesAg(caderno, ags) : []

  function exportarTurmas() {
    baixarCsv(
      `turmas-${nomeArquivo}.csv`,
      ['Colégio', 'Cidade', 'UF', 'Turma', 'Turno', 'Alunos', 'Avaliados', 'Faltas', 'Prova adaptada', 'Novos no colégio', 'Acerto médio (%)', ...nomesFaixasCsv],
      turmas.map((t) => [
        t.colegio.nome,
        t.colegio.cidade,
        t.colegio.uf,
        turmaNome(t.turma),
        t.turma.turno,
        t.participacao.matriculados,
        t.participacao.avaliados,
        t.participacao.faltas,
        t.participacao.adaptadas,
        t.novos,
        t.media,
        ...t.faixas,
      ]),
      AVISO_COMPARACAO,
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

  function exportarGrupos() {
    // Os mesmos grupos de agruparPorAnoDeIngresso: os novos, cada um dos três anos anteriores e, por fim, quem entrou antes.
    const anos = [`${anoLetivo} (novos)`, String(anoLetivo - 1), String(anoLetivo - 2), String(anoLetivo - 3), `Até ${anoLetivo - 4}`]
    const linhas = [
      { rotulo: 'Novos no colégio', chave: 'novos' },
      { rotulo: 'Antigos', chave: 'antigos' },
      ...anos.map((rotulo, i) => ({ rotulo: `Entraram em ${rotulo}`, chave: `ha${i}` })),
      { rotulo: 'Sem ano de entrada informado', chave: 'sem_ano' },
      { rotulo: 'Meninas', chave: 'F' },
      { rotulo: 'Meninos', chave: 'M' },
      { rotulo: 'Sem sexo informado', chave: 'sem_sexo' },
    ]
    baixarCsv(
      `grupos-${nomeArquivo}.csv`,
      ['Grupo', 'Alunos avaliados', 'Acerto médio (%)', ...nomesFaixasCsv],
      linhas.map((g) => {
        const grupo = grupoAg(ags, g.chave, rede.cadernoDe)
        return [g.rotulo, grupo.n, grupo.media, ...grupo.faixas]
      }),
    )
  }

  function exportarQuestoes() {
    if (!caderno) return
    const letras = LETRAS
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
  const faixas = (
    <Cartao titulo="Alunos por faixa de acerto" sub={escopo}>
      <Histograma contagem={faixasAg(ags)} />
    </Cartao>
  )

  return (
    <>
      <Cabecalho sobretitulo="Resultados" titulo="Resultados da rede" subtitulo="A Solar vê os resultados por turma e por colégio. A lista de alunos fica com cada colégio." />

      <SeletorDisciplina valor={disciplina} aoMudar={(d) => filtrar('disciplina', d)} />

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
            {colegios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
        <div className="filtros-exportar">
          <span className="texto-2 pequeno">Baixar planilha</span>
          <div className="form-acoes">
            <button className="btn btn-pequeno" onClick={exportarTurmas} disabled={!n}>
              <FileSpreadsheet size={15} aria-hidden /> Turmas
            </button>
            <button className="btn btn-pequeno" onClick={exportarHabilidades} disabled={!n}>
              <FileSpreadsheet size={15} aria-hidden /> Habilidades
            </button>
            <button className="btn btn-pequeno" onClick={exportarGrupos} disabled={!n}>
              <FileSpreadsheet size={15} aria-hidden /> Grupos de alunos
            </button>
            {caderno && (
              <button className="btn btn-pequeno" onClick={exportarQuestoes} disabled={!n}>
                <FileSpreadsheet size={15} aria-hidden /> Questões
              </button>
            )}
          </div>
        </div>
      </div>

      {emLancamento && (
        <Aviso tom="atencao">
          Lançamento de {disciplina} em andamento: {concluidas} de {plural(turmas.length, 'turma concluída', 'turmas concluídas')}. Os números ainda vão mudar.
        </Aviso>
      )}

      {!n ? (
        <Vazio titulo="Ainda não há alunos avaliados nesta seleção">Os resultados aparecem assim que os professores lançam as respostas.</Vazio>
      ) : (
        <>
          <LembreteCooperacao chave={`solar-${avaliacao.id}`}>
            Use estas comparações para descobrir onde apoiar e quem pode compartilhar o que deu certo, não para classificar colégios ou professores.
          </LembreteCooperacao>

          <div className="grade grade-kpis grade-kpis-3">
            <Kpi rotulo="Acerto médio" valor={pct(media)} detalhe={escopo} />
            <Kpi rotulo="Alunos avaliados" valor={part.avaliados.toLocaleString('pt-BR')} detalhe={`${part.lancados} de ${part.matriculados} já lançados · ${plural(part.faltas, 'falta', 'faltas')}`} />
            <Kpi rotulo={`Turmas que concluíram o lançamento de ${disciplina}`} valor={`${concluidas} de ${turmas.length}`} />
          </div>

          {VARIAS_DISCIPLINAS ? (
            <div className="grade grade-2">
              {faixas}
              <Cartao titulo="Acerto por disciplina" sub="As provas, lado a lado.">
                <Barras itens={porDisciplina.map((d) => ({ chave: d.chave, rotulo: d.chave, valor: d.pct, detalhe: plural(d.questoes, 'questão', 'questões') }))} />
              </Cartao>
            </div>
          ) : (
            faixas
          )}

          {(!colegioId || !serie) && (
            <div className={`grade ${!colegioId && !serie ? 'grade-2' : ''}`}>
              {!colegioId && (
                <Cartao titulo="Acerto médio por colégio" sub="Em ordem alfabética.">
                  <Barras itens={porColegio} />
                </Cartao>
              )}
              {!serie && (
                <Cartao titulo="Acerto médio por ano" sub="Cada ano fez uma prova diferente: estes números não dizem qual ano está melhor.">
                  <Barras itens={porAno} />
                </Cartao>
              )}
            </div>
          )}

          {caderno && (
            <Cartao titulo={`Acerto por questão · prova de ${disciplina} do ${serieNome(caderno.serie)}`} sub={escopo}>
              <ColunasPorQuestao itens={analise.map((a) => ({ numero: a.indice + 1, valor: a.pctAcerto }))} />
              <LegendaFaixas />
            </Cartao>
          )}

          <ComparacaoGrupos grupos={resumoGruposAg(ags, rede.cadernoDe, anoLetivo)} />

          <Participacao ags={ags} rede={rede} colegios={colegios.filter((c) => !colegioId || c.id === colegioId)} />

          <Cartao
            titulo="Turmas"
            sub="Sempre na mesma ordem: colégio, ano e turma. Clique numa turma para ver os resultados dela."
            acoes={
              <label className="checkbox">
                <input type="checkbox" checked={soApoio} onChange={(e) => setSoApoio(e.target.checked)} />
                Só as que podem precisar de apoio
              </label>
            }
          >
            {soApoio && (
              <p className="texto-2 pequeno">
                Turmas em que {PCT_APOIO}% ou mais dos alunos acertaram menos de 40% da prova. Veja junto o que ajuda a explicar: alunos novos, faltas,
                tamanho da turma.
              </p>
            )}
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th>Colégio</th>
                    <th>Turma</th>
                    <th className="num">Avaliados</th>
                    <th className="num">Novos</th>
                    <th className="num">Faltas</th>
                    <th className="num">Acerto médio</th>
                    <th>Alunos por faixa de acerto</th>
                  </tr>
                </thead>
                <tbody>
                  {turmasVisiveis.map((t) => (
                    <tr key={t.turma.id}>
                      <td>{t.colegio.nome}</td>
                      <td>
                        {t.caderno ? <Link to={`/solar/resultados/${t.caderno.id}/${t.turma.id}`}>{turmaNome(t.turma)}</Link> : turmaNome(t.turma)}{' '}
                        {t.progresso.status !== 'concluido' && <Selo tom={t.progresso.status === 'em_andamento' ? 'ambar' : 'neutro'}>{NOMES_STATUS[t.progresso.status]}</Selo>}
                      </td>
                      <td className="num">
                        {t.participacao.avaliados} de {t.participacao.matriculados}
                      </td>
                      <td className="num">{t.novos}</td>
                      <td className="num">{t.pctFaltas >= PCT_FALTAS_ALTO ? <Selo tom="ambar">{pct(t.pctFaltas)}</Selo> : t.participacao.faltas}</td>
                      <td className="num">{pct(t.media)}</td>
                      <td>
                        <MiniFaixas contagem={t.faixas} />
                      </td>
                    </tr>
                  ))}
                  {!turmasVisiveis.length && (
                    <tr>
                      <td colSpan={7} className="texto-2">
                        Nenhuma turma nesta situação.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <LegendaFaixas />
          </Cartao>

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
                  {(todasHabilidades ? porHabilidade : porHabilidade.slice(0, HABILIDADES_VISIVEIS)).map((d) => {
                    const h = buscarHabilidade(d.chave)
                    return (
                      <tr key={d.chave}>
                        <td className="descricao-habilidade">
                          {h?.descricao ?? d.chave}
                          <span className="texto-2 bloco pequeno">
                            {d.chave} · {h?.componente}
                          </span>
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
            {porHabilidade.length > HABILIDADES_VISIVEIS && (
              <button className="btn btn-fantasma btn-pequeno" onClick={() => setTodasHabilidades(!todasHabilidades)}>
                {todasHabilidades ? 'Mostrar só as 10 com menos acertos' : `Mostrar todas as ${porHabilidade.length} habilidades`}
              </button>
            )}
          </Cartao>

          {caderno ? (
            <>
              {!colegioId && <QuadroColegios caderno={caderno} ags={ags} rede={rede} colegios={colegios} />}
              <AnaliseQuestoes caderno={caderno} analise={analise} editar={editarRede} />
            </>
          ) : (
            <EscolherAno db={db} avaliacaoId={avaliacao.id} disciplina={disciplina} ags={ags} rede={rede} aoEscolher={(s) => filtrar('serie', String(s))} />
          )}
        </>
      )}
    </>
  )
}

function Participacao({ ags, rede, colegios }: { ags: AgregadoTurma[]; rede: Rede; colegios: Colegio[] }) {
  return (
    <Cartao titulo="Participação por colégio" sub={`Quando muitos alunos faltam (${PCT_FALTAS_ALTO}% ou mais), a média diz pouco.`}>
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Colégio</th>
              <th className="num">Alunos</th>
              <th className="num">Lançados</th>
              <th className="num">Avaliados</th>
              <th className="num">Faltas</th>
              <th className="num">Prova adaptada</th>
            </tr>
          </thead>
          <tbody>
            {colegios.map((c) => {
              const p = participacaoAg(ags.filter((ag) => rede.colegioDaTurma(ag.turma) === c.id))
              const pctFaltas = p.lancados ? (100 * p.faltas) / p.lancados : 0
              return (
                <tr key={c.id}>
                  <td>{c.nome}</td>
                  <td className="num">{p.matriculados}</td>
                  <td className="num">{p.lancados}</td>
                  <td className="num">{p.avaliados}</td>
                  <td className="num">
                    {p.faltas} {p.lancados > 0 && <span className="texto-2">({pct(pctFaltas)})</span>}
                    {pctFaltas >= PCT_FALTAS_ALTO && <Selo tom="ambar">Poucos presentes</Selo>}
                  </td>
                  <td className="num">{p.adaptadas}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

/** Cada questão da prova de um ano, colégio por colégio, com uma leitura pronta. */
function QuadroColegios({ caderno, ags, rede, colegios }: { caderno: Caderno; ags: AgregadoTurma[]; rede: Rede; colegios: Colegio[] }) {
  const linhas = quadroColegioQuestaoAg(caderno, ags, colegios, rede.colegioDaTurma)
  const comLeitura = linhas.filter((l) => l.leitura)
  return (
    <Cartao
      titulo={`Pontos de melhoria · prova de ${caderno.disciplina} do ${serieNome(caderno.serie)}`}
      sub={`Acerto de cada questão em cada colégio. Menos de ${LIMITE_METADE}% de acertos em todos os colégios: rever a questão ou o material. Menos da metade só em um ou dois: apoiar esses colégios.`}
      acoes={<Explicacao>Colégios com menos de {MINIMO_QUADRO} alunos avaliados nesta prova aparecem em cinza: com tão poucos alunos, a diferença pode ser acaso.</Explicacao>}
    >
      <div className="tabela-rolagem">
        <table className="tabela tabela-calor tabela-quadro">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Habilidade</th>
              {colegios.map((c) => (
                <th key={c.id} className="num">
                  {nomeCurto(c)}
                </th>
              ))}
              <th className="num">Rede</th>
              <th>Leitura</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const h = buscarHabilidade(l.questao.habilidade)
              return (
                <tr key={l.indice}>
                  <td className="num">{l.indice + 1}</td>
                  <td className="descricao-habilidade">
                    <span className="pequeno">
                      <strong>{l.questao.disciplina}</strong>
                      {h && ` · ${resumir(h.descricao)}`}
                    </span>
                  </td>
                  {colegios.map((c) => {
                    const v = l.porColegio.get(c.id)
                    const poucos = !v || v.n < MINIMO_QUADRO
                    return (
                      <td key={c.id} className={`num ${!poucos && v.pct != null ? `calor-${faixaDe(v.pct)}` : 'calor-poucos'}`}>
                        {v?.pct == null ? '—' : pct(v.pct)}
                      </td>
                    )
                  })}
                  <td className={`num ${l.rede != null ? `calor-${faixaDe(l.rede)}` : ''}`}>{pct(l.rede)}</td>
                  <td className="pequeno">
                    {l.leitura === 'todos' && <Selo tom="perigo">Rever questão ou material</Selo>}
                    {l.leitura === 'alguns' && <Selo tom="ambar">Apoiar colégios</Selo>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {!comLeitura.length && <p className="texto-2 pequeno">Nenhuma questão ficou abaixo da metade de acertos nos colégios com alunos suficientes.</p>}
    </Cartao>
  )
}

function EscolherAno(props: { db: Db; avaliacaoId: string; disciplina: Disciplina; ags: AgregadoTurma[]; rede: Rede; aoEscolher: (serie: Serie) => void }) {
  const opcoes = SERIES.map((serie) => {
    const caderno = cadernoDe(props.db, props.avaliacaoId, serie, props.disciplina)
    const alertas = caderno ? analisarQuestoesAg(caderno, props.ags).filter((a) => a.alertas.includes('gabarito_suspeito')).length : 0
    return { serie, caderno, alertas }
  }).filter((o) => o.caderno)
  return (
    <Cartao titulo="Análise por questão e pontos de melhoria" sub={`Cada ano tem uma prova diferente: escolha o ano para ver cada questão da prova de ${props.disciplina}, colégio por colégio.`}>
      <div className="chips">
        {opcoes.map((o) => (
          <button key={o.serie} className="btn" onClick={() => props.aoEscolher(o.serie)}>
            {serieNome(o.serie)}
            {o.alertas > 0 && <Selo tom="perigo">{plural(o.alertas, 'gabarito suspeito', 'gabaritos suspeitos')}</Selo>}
          </button>
        ))}
      </div>
    </Cartao>
  )
}

function AnaliseQuestoes({ caderno, analise, editar }: { caderno: Caderno; analise: AnaliseQuestao[]; editar: boolean }) {
  const [soComAlerta, setSoComAlerta] = useState(false)
  const letras = LETRAS
  const comAlerta = analise.filter((a) => a.alertas.length)
  const visiveis = soComAlerta ? comAlerta : analise
  const n = analise[0]?.n ?? 0

  return (
    <Cartao
      titulo={`Análise por questão · prova de ${caderno.disciplina} do ${serieNome(caderno.serie)}`}
      sub={`${plural(n, 'aluno avaliado', 'alunos avaliados')}${n < MINIMO_PARA_ALERTAS ? ` · os alertas aparecem a partir de ${MINIMO_PARA_ALERTAS} alunos` : ''}`}
      acoes={
        <>
          <label className="checkbox">
            <input type="checkbox" checked={soComAlerta} onChange={(e) => setSoComAlerta(e.target.checked)} />
            Só questões com alerta ({comAlerta.length})
          </label>
          <Link className="btn btn-pequeno" to={`/solar/avaliacoes/${caderno.avaliacaoId}?serie=${caderno.serie}&disciplina=${caderno.disciplina}`}>
            <Pencil size={15} aria-hidden /> {editar ? 'Editar gabarito' : 'Ver a prova'}
          </Link>
        </>
      }
    >
      {comAlerta.some((a) => a.alertas.includes('gabarito_suspeito')) && (
        <Aviso tom="perigo">{ALERTAS.gabarito_suspeito.texto} Ao corrigir o gabarito ou anular a questão, todos os resultados são recalculados na hora.</Aviso>
      )}
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Disciplina e habilidade</th>
              <th>Gabarito</th>
              <th className="coluna-barra">Acerto</th>
              <th>Marcações</th>
              <th className="num">Discriminação</th>
              <th>Alertas</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((a) => {
              const h = buscarHabilidade(a.questao.habilidade)
              return (
                <tr key={a.indice} className={a.alertas.includes('gabarito_suspeito') ? 'linha-alerta' : ''}>
                  <td className="num">{a.indice + 1}</td>
                  <td>
                    {a.questao.disciplina}
                    {h && (
                      <span className="texto-2 bloco pequeno">
                        {h.descricao} ({h.codigo})
                      </span>
                    )}
                  </td>
                  <td>{a.questao.anulada ? <span className="texto-2">anulada</span> : (a.questao.gabarito ?? <span className="texto-2">sem gabarito</span>)}</td>
                  <td className="coluna-barra">{a.pctAcerto != null ? <MiniBarra valor={a.pctAcerto} /> : '—'}</td>
                  <td className="marcacoes">
                    {a.n > 0 &&
                      letras.map((l) => (
                        <span key={l} className={l === a.questao.gabarito ? 'certa' : ''}>
                          {l} {pct((100 * (a.contagem[l] ?? 0)) / a.n)}
                        </span>
                      ))}
                    {a.esquecidas.length > 0 && <span className="bloco">quase ninguém marcou {a.esquecidas.join(' e ')}</span>}
                  </td>
                  <td className="num">{a.discriminacao != null ? a.discriminacao.toFixed(2).replace('.', ',') : '—'}</td>
                  <td>
                    {a.alertas.map((alerta) => (
                      <span key={alerta} className="alerta-questao">
                        <Selo tom={ALERTAS[alerta].tom}>{ALERTAS[alerta].rotulo}</Selo>
                        <span className="texto-2 bloco pequeno">{ALERTAS[alerta].texto}</span>
                      </span>
                    ))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="texto-2 pequeno">
        Discriminação: de −1 a 1. Mostra se quem acerta a questão também vai bem no resto da prova. Acima de 0,2, a questão separa bem quem domina o
        conteúdo; perto de 0 ou negativa, merece revisão. “Quase ninguém marcou”: a alternativa errada não está funcionando como armadilha.
      </p>
    </Cartao>
  )
}
