import { ChartColumn, ClipboardList } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { descreverPeriodo } from '../../components/LinhaAvaliacao'
import { BarraFaixas, Barras, Cabecalho, Cartao, Kpi, Progresso, SeloFaixa, SeloStatus, Vazio } from '../../components/ui'
import { avaliacaoAtual, avaliacoesOrdenadas, cadernoDaSerie, nomesProfessores, turmasDoColegio } from '../../lib/consultas'
import { agruparPor, avaliados, coletarResultados, desempenhoPor, faixaDe, mediaPct, progressoDe } from '../../lib/estatisticas'
import { pct, serieNome, turmaNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES } from '../../types'
import { ordemDisciplina } from '../turma/ResultadosTurma'

export default function PainelEscola() {
  const db = useDb()
  const perfil = usePerfil()
  const [params, setParams] = useSearchParams()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  const avaliacoes = avaliacoesOrdenadas(db)
  const avaliacaoId = params.get('avaliacao') ?? avaliacaoAtual(db)?.id ?? avaliacoes[0]?.id
  const avaliacao = db.avaliacoes.find((a) => a.id === avaliacaoId)

  const resultados = useMemo(
    () => (colegio && avaliacao ? coletarResultados(db, { avaliacaoId: avaliacao.id, colegioId: colegio.id }) : []),
    [db, colegio, avaliacao],
  )
  if (!colegio) return null

  const seletor = (
    <label className="campo-inline">
      <span>Avaliação</span>
      <select value={avaliacao?.id ?? ''} onChange={(e) => setParams({ avaliacao: e.target.value })}>
        {avaliacoes.map((a) => (
          <option key={a.id} value={a.id}>
            {a.titulo}
          </option>
        ))}
      </select>
    </label>
  )

  const cabecalho = (
    <Cabecalho titulo={colegio.nome} subtitulo={`${colegio.cidade}/${colegio.uf} · Coordenação: ${colegio.coordenacao.nome}`} acoes={seletor} />
  )
  if (!avaliacao) {
    return (
      <>
        {cabecalho}
        <Vazio titulo="Ainda não há avaliações">A Solar cadastra as avaliações e os cadernos de cada ano.</Vazio>
      </>
    )
  }

  const config = db.config
  const porTurma = agruparPor(resultados, (r) => r.turma.id)
  const linhas = turmasDoColegio(db, colegio.id).map((turma) => {
    const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
    const daTurma = porTurma.get(turma.id) ?? []
    return { turma, caderno, progresso: caderno ? progressoDe(db, caderno, turma.id) : null, media: mediaPct(daTurma), resultados: daTurma }
  })
  const comProva = linhas.filter((l) => l.progresso)
  const concluidas = comProva.filter((l) => l.progresso!.status === 'concluido').length
  const lancados = comProva.reduce((s, l) => s + l.progresso!.lancados, 0)
  const matriculados = comProva.reduce((s, l) => s + l.progresso!.total, 0)
  const media = mediaPct(resultados)
  const atencao = avaliados(resultados).filter((r) => faixaDe(r.correcao.pct, config) === 0).length
  const disciplinas = [...new Set(db.cadernos.filter((c) => c.avaliacaoId === avaliacao.id).flatMap((c) => c.questoes.map((q) => q.disciplina)))].sort(
    ordemDisciplina,
  )
  const porAno = SERIES.map((serie) => ({
    serie,
    media: mediaPct(resultados.filter((r) => r.turma.serie === serie)),
  })).filter((x) => x.media != null)

  return (
    <>
      {cabecalho}
      <p className="texto-2 pequeno recuo-cabecalho">{descreverPeriodo(avaliacao)}</p>

      <div className="grade grade-kpis">
        <Kpi rotulo="Turmas concluídas" valor={`${concluidas} de ${comProva.length}`} detalhe={<Progresso valor={concluidas} total={comProva.length} />} />
        <Kpi rotulo="Alunos lançados" valor={`${lancados} de ${matriculados}`} detalhe={<Progresso valor={lancados} total={matriculados} />} />
        <Kpi rotulo="Média do colégio" valor={pct(media)} detalhe={media != null ? <SeloFaixa valor={media} config={config} /> : 'sem alunos avaliados'} />
        <Kpi rotulo="Precisam de atenção" valor={atencao} detalhe={`alunos com menos de ${config.faixas[0]}% de acertos`} />
      </div>

      <Cartao titulo="Andamento por turma">
        <div className="tabela-rolagem">
          <table className="tabela">
            <thead>
              <tr>
                <th>Turma</th>
                <th>Professor(a)</th>
                <th>Situação</th>
                <th className="coluna-progresso">Lançados</th>
                <th className="num">Média</th>
                <th className="acoes">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ turma, caderno, progresso, media: mediaTurma }) => (
                <tr key={turma.id}>
                  <td>
                    <strong>{turmaNome(turma)}</strong> <span className="texto-2 pequeno">{turma.turno}</span>
                  </td>
                  <td>{nomesProfessores(db, turma)}</td>
                  {caderno && progresso ? (
                    <>
                      <td>
                        <SeloStatus status={progresso.status} />
                      </td>
                      <td className="coluna-progresso">
                        <div className="progresso-com-texto">
                          <Progresso valor={progresso.lancados} total={progresso.total} />
                          <span className="texto-2 pequeno">
                            {progresso.lancados}/{progresso.total}
                          </span>
                        </div>
                      </td>
                      <td className="num">{pct(mediaTurma)}</td>
                      <td className="acoes">
                        <Link className="btn btn-pequeno" to={`/coordenacao/resultados/${caderno.id}/${turma.id}`}>
                          <ChartColumn size={15} aria-hidden /> Resultados
                        </Link>
                        <Link className="btn btn-pequeno btn-fantasma" to={`/coordenacao/lancar/${caderno.id}/${turma.id}`}>
                          <ClipboardList size={15} aria-hidden /> Lançar
                        </Link>
                      </td>
                    </>
                  ) : (
                    <td colSpan={4} className="texto-2">
                      Sem prova do {serieNome(turma.serie)} nesta avaliação
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Cartao>

      <div className="grade grade-2">
        <Cartao titulo="Distribuição por faixa de desempenho" sub="Todos os alunos avaliados do colégio">
          <BarraFaixas resultados={resultados} config={config} />
        </Cartao>
        <Cartao titulo="Média por ano">
          {porAno.length ? (
            <Barras config={config} itens={porAno.map((x) => ({ chave: String(x.serie), rotulo: serieNome(x.serie), valor: x.media }))} />
          ) : (
            <p className="texto-2">Ainda não há alunos avaliados.</p>
          )}
        </Cartao>
      </div>

      <Cartao titulo="Desempenho por disciplina" sub="Percentual de acertos de cada turma. A cor indica a faixa de desempenho.">
        <div className="tabela-rolagem">
          <table className="tabela tabela-calor">
            <thead>
              <tr>
                <th>Turma</th>
                {disciplinas.map((d) => (
                  <th key={d} className="num">
                    {d}
                  </th>
                ))}
                <th className="num">Geral</th>
              </tr>
            </thead>
            <tbody>
              {linhas
                .filter((l) => avaliados(l.resultados).length > 0)
                .map((l) => {
                  const porDisciplina = new Map(desempenhoPor(l.resultados, (q) => q.disciplina).map((d) => [d.chave, d.pct]))
                  return (
                    <tr key={l.turma.id}>
                      <td>{turmaNome(l.turma)}</td>
                      {disciplinas.map((d) => (
                        <CelulaCalor key={d} valor={porDisciplina.get(d) ?? null} faixa={porDisciplina.has(d) ? faixaDe(porDisciplina.get(d)!, config) : null} />
                      ))}
                      <CelulaCalor valor={l.media} faixa={l.media != null ? faixaDe(l.media, config) : null} />
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </Cartao>
    </>
  )
}

export function CelulaCalor({ valor, faixa }: { valor: number | null; faixa: number | null }) {
  return <td className={`num ${faixa != null ? `calor-${faixa}` : ''}`}>{pct(valor)}</td>
}
