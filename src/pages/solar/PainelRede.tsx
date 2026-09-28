import { ChartColumn, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { descreverPeriodo } from '../../components/LinhaAvaliacao'
import { Barras, Cabecalho, Cartao, Kpi, Progresso, Selo, Vazio } from '../../components/ui'
import { avaliacaoAtual, avaliacoesOrdenadas, cadernoDaSerie, cadernosDaAvaliacao, etapaAvaliacao } from '../../lib/consultas'
import { agruparPor, coletarResultados, mediaPct, progressoDe } from '../../lib/estatisticas'
import { compararTexto, diasAte, pct, plural, serieNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { SERIES, type Avaliacao, type Db } from '../../types'

export default function PainelRede() {
  const db = useDb()
  const atual = avaliacaoAtual(db)
  const ordenadas = avaliacoesOrdenadas(db)
  const ultimaEncerrada = ordenadas.find((a) => etapaAvaliacao(a) === 'encerrada' && a.id !== atual?.id) ?? null
  const agendadas = ordenadas.filter((a) => etapaAvaliacao(a) === 'agendada')

  return (
    <>
      <Cabecalho titulo="Painel da rede" subtitulo="Andamento das avaliações e resultados de todos os colégios" />

      <div className="grade grade-kpis">
        <Kpi rotulo="Colégios" valor={db.colegios.length} />
        <Kpi rotulo="Turmas" valor={db.turmas.length} detalhe="do 1º ao 5º ano" />
        <Kpi rotulo="Alunos" valor={db.alunos.filter((a) => a.ativo).length.toLocaleString('pt-BR')} />
        <Kpi rotulo="Avaliações" valor={db.avaliacoes.length} detalhe={agendadas.length ? plural(agendadas.length, 'agendada', 'agendadas') : undefined} />
      </div>

      {atual ? <Andamento db={db} avaliacao={atual} /> : <Vazio titulo="Nenhuma avaliação cadastrada" />}
      {ultimaEncerrada && <ResumoResultados db={db} avaliacao={ultimaEncerrada} />}
      <Pendencias db={db} avaliacoes={[...(atual ? [atual] : []), ...agendadas]} />
    </>
  )
}

function Andamento({ db, avaliacao }: { db: Db; avaliacao: Avaliacao }) {
  const dias = diasAte(avaliacao.prazoLancamento)
  const prazo =
    dias > 1 ? `faltam ${dias} dias para o prazo` : dias === 1 ? 'o prazo termina amanhã' : dias === 0 ? 'o prazo termina hoje' : 'prazo encerrado'
  const linhas = [...db.colegios]
    .sort((a, b) => compararTexto(a.nome, b.nome))
    .map((colegio) => {
      const contagem = { concluido: 0, em_andamento: 0, nao_iniciado: 0, total: 0, lancados: 0, alunos: 0 }
      for (const turma of db.turmas.filter((t) => t.colegioId === colegio.id)) {
        const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
        if (!caderno) continue
        const progresso = progressoDe(db, caderno, turma.id)
        contagem[progresso.status]++
        contagem.total++
        contagem.lancados += progresso.lancados
        contagem.alunos += progresso.total
      }
      return { colegio, ...contagem }
    })
  const concluidas = linhas.reduce((s, l) => s + l.concluido, 0)
  const total = linhas.reduce((s, l) => s + l.total, 0)

  return (
    <Cartao
      titulo={`Andamento: ${avaliacao.titulo}`}
      sub={`${descreverPeriodo(avaliacao)} · ${prazo}`}
      acoes={
        <Link className="btn" to={`/solar/estatisticas?avaliacao=${avaliacao.id}`}>
          <ChartColumn size={16} aria-hidden /> Estatísticas
        </Link>
      }
    >
      <p className="resumo-andamento">
        <strong>{concluidas}</strong> de {total} turmas concluíram o lançamento
      </p>
      <Progresso valor={concluidas} total={total} rotulo="Turmas concluídas" />
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Colégio</th>
              <th className="coluna-progresso">Turmas concluídas</th>
              <th className="num">Em andamento</th>
              <th className="num">Não iniciadas</th>
              <th className="num">Alunos lançados</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.colegio.id}>
                <td>
                  <Link to={`/solar/colegios/${l.colegio.id}`}>{l.colegio.nome}</Link>
                  <div className="texto-2 pequeno">
                    {l.colegio.cidade}/{l.colegio.uf}
                  </div>
                </td>
                <td className="coluna-progresso">
                  <div className="progresso-com-texto">
                    <Progresso valor={l.concluido} total={l.total} />
                    <span className="texto-2 pequeno">
                      {l.concluido}/{l.total}
                    </span>
                  </div>
                </td>
                <td className="num">{l.em_andamento || <span className="texto-2">0</span>}</td>
                <td className="num">
                  {l.nao_iniciado ? (
                    <Selo tom={dias < 0 ? 'perigo' : 'atencao'} titulo={dias < 0 ? 'Prazo encerrado' : undefined}>
                      {l.nao_iniciado}
                    </Selo>
                  ) : (
                    <span className="texto-2">0</span>
                  )}
                </td>
                <td className="num">{pct(l.alunos ? (100 * l.lancados) / l.alunos : null)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  )
}

function ResumoResultados({ db, avaliacao }: { db: Db; avaliacao: Avaliacao }) {
  const resultados = useMemo(() => coletarResultados(db, { avaliacaoId: avaliacao.id }), [db, avaliacao.id])
  const porColegio = [...agruparPor(resultados, (r) => r.colegio)]
    .map(([colegio, lista]) => ({ chave: colegio.id, rotulo: colegio.nome, valor: mediaPct(lista) }))
    .sort((a, b) => (b.valor ?? 0) - (a.valor ?? 0))
  const porAno = SERIES.map((serie) => ({
    chave: String(serie),
    rotulo: serieNome(serie),
    valor: mediaPct(resultados.filter((r) => r.turma.serie === serie)),
  }))

  return (
    <Cartao
      titulo={`Resultados: ${avaliacao.titulo}`}
      sub={`Média de acertos · rede toda: ${pct(mediaPct(resultados))}`}
      acoes={
        <Link className="btn" to={`/solar/estatisticas?avaliacao=${avaliacao.id}`}>
          <ChartColumn size={16} aria-hidden /> Ver tudo
        </Link>
      }
    >
      <div className="grade grade-2 sem-margem">
        <div>
          <h3 className="subtitulo">Por colégio</h3>
          <Barras config={db.config} itens={porColegio} />
        </div>
        <div>
          <h3 className="subtitulo">Por ano</h3>
          <Barras config={db.config} itens={porAno} />
        </div>
      </div>
    </Cartao>
  )
}

function Pendencias({ db, avaliacoes }: { db: Db; avaliacoes: Avaliacao[] }) {
  const itens = avaliacoes.flatMap((avaliacao) => {
    const cadernos = cadernosDaAvaliacao(db, avaliacao.id)
    const problemas: string[] = []
    for (const serie of SERIES) {
      const caderno = cadernos.find((c) => c.serie === serie)
      if (!caderno) {
        problemas.push(`${serieNome(serie)}: sem caderno`)
        continue
      }
      const faltas = [
        !caderno.pdf && 'falta o PDF',
        caderno.questoes.some((q) => !q.anulada && !q.gabarito) && 'falta gabarito',
        caderno.questoes.some((q) => !q.habilidade) && 'questões sem habilidade',
      ].filter(Boolean)
      if (faltas.length) problemas.push(`${serieNome(serie)}: ${faltas.join(', ')}`)
    }
    return problemas.length ? [{ avaliacao, problemas }] : []
  })
  if (!itens.length) return null

  return (
    <Cartao titulo="Pendências das provas" sub="O que falta nos cadernos da avaliação atual e das próximas">
      <ul className="pendencias">
        {itens.map(({ avaliacao, problemas }) => (
          <li key={avaliacao.id}>
            <div className="pendencias-titulo">
              <TriangleAlert size={16} aria-hidden /> <Link to={`/solar/avaliacoes/${avaliacao.id}`}>{avaliacao.titulo}</Link>
            </div>
            <ul>
              {problemas.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Cartao>
  )
}
