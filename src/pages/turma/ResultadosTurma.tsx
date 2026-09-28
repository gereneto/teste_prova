import { FileSpreadsheet, Pencil, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { ComparacaoIngresso } from '../../components/ComparacaoIngresso'
import { Aviso, BarraFaixas, Barras, Cabecalho, Cartao, Kpi, MiniBarra, SeloFaixa, Vazio } from '../../components/ui'
import { buscarHabilidade, ordemDisciplina } from '../../data/bncc'
import {
  analisarQuestoes,
  avaliados,
  coletarResultados,
  desempenhoPor,
  faixaDe,
  marcaEm,
  mediaPct,
  NOMES_FAIXAS,
  participacao,
  progressoDaTurma,
  questaoValida,
  type ResultadoAluno,
} from '../../lib/estatisticas'
import { baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { pct, plural, turmaNome } from '../../lib/formato'
import { BRANCO, LETRAS, RASURA, VAZIO } from '../../types'
import { useContextoTurma, type ContextoTurma } from './contexto'

export default function ResultadosTurma() {
  const contexto = useContextoTurma()
  if ('erro' in contexto) {
    return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar</Link>} />
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

function TelaResultados({ db, caderno, avaliacao, turma, colegio, lancamento, alunos, base }: ContextoTurma) {
  const [ordem, setOrdem] = useState<'numero' | 'nota'>('numero')
  const config = db.config
  const resultados = useMemo(() => coletarResultados(db, { avaliacaoId: avaliacao.id, turmaId: turma.id }), [db, avaliacao.id, turma.id])
  const lista = avaliados(resultados)
  const media = mediaPct(resultados)
  const part = participacao(resultados)
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const atencao = lista.filter((r) => faixaDe(r.correcao.pct, config) === 0).sort((a, b) => a.correcao.pct - b.correcao.pct)
  const porDisciplina = desempenhoPor(resultados, (q) => q.disciplina).sort((a, b) => ordemDisciplina(a.chave, b.chave))
  const porHabilidade = desempenhoPor(resultados, (q) => q.habilidade).sort((a, b) => a.pct - b.pct)
  const analise = analisarQuestoes(caderno, resultados)
  const letras = LETRAS.slice(0, caderno.numAlternativas)
  const validas = caderno.questoes.filter(questaoValida).length
  const anuladas = caderno.questoes.filter((q) => q.anulada).length
  const semGabarito = caderno.questoes.filter((q) => !q.anulada && q.gabarito === null).length
  const linhasAlunos = [...resultados].sort(
    ordem === 'numero' ? (a, b) => a.aluno.numero - b.aluno.numero : (a, b) => (b.correcao?.pct ?? -1) - (a.correcao?.pct ?? -1),
  )
  const lancar = `${base}/lancar/${caderno.id}/${turma.id}`

  function exportar() {
    baixarCsv(
      `resultados-${paraNomeDeArquivo(`${colegio.nome} ${turmaNome(turma)} ${avaliacao.titulo}`)}.csv`,
      ['Nº', 'Aluno', 'Entrou no colégio', 'Novo no colégio', 'Situação', 'Acertos', 'Questões válidas', '% de acertos', 'Faixa', ...caderno.questoes.map((_, i) => `Q${i + 1}`)],
      [...resultados]
        .sort((a, b) => a.aluno.numero - b.aluno.numero)
        .map((r) => [
          r.aluno.numero,
          r.aluno.nome,
          r.aluno.anoIngresso,
          r.aluno.anoIngresso == null ? '' : r.aluno.anoIngresso >= turma.anoLetivo ? 'sim' : 'não',
          rotuloSituacao(r),
          r.correcao?.acertos,
          r.correcao?.validas,
          r.correcao?.pct,
          r.correcao ? NOMES_FAIXAS[faixaDe(r.correcao.pct, config)] : '',
          ...caderno.questoes.map((_, i) => (r.situacao === 'presente' ? textoMarca(marcaEm(r.marcas, i)) : '')),
        ]),
    )
  }

  return (
    <>
      <Cabecalho
        sobretitulo={avaliacao.titulo}
        titulo="Resultados da turma"
        subtitulo={`${turmaNome(turma)} · ${colegio.nome}`}
        voltar={{ para: base, rotulo: base === '/professor' ? 'Minhas turmas' : 'Painel do colégio' }}
        acoes={
          <>
            <Link className="btn" to={lancar}>
              <Pencil size={16} aria-hidden /> {progresso.status === 'concluido' ? 'Corrigir lançamento' : 'Continuar lançamento'}
            </Link>
            <button className="btn" onClick={exportar} disabled={!resultados.length}>
              <FileSpreadsheet size={16} aria-hidden /> Exportar planilha
            </button>
            <button className="btn" onClick={() => window.print()}>
              <Printer size={16} aria-hidden /> Imprimir
            </button>
          </>
        }
      />

      {progresso.status !== 'concluido' && (
        <Aviso tom="atencao">
          Resultados parciais: {progresso.lancados} de {plural(progresso.total, 'aluno lançado', 'alunos lançados')}. Os números se
          atualizam a cada resposta lançada.
        </Aviso>
      )}
      {semGabarito > 0 && (
        <Aviso tom="info">
          A Solar ainda não definiu o gabarito de {plural(semGabarito, 'questão', 'questões')}. Elas ficam fora do cálculo até lá.
        </Aviso>
      )}

      {!lista.length ? (
        <Vazio titulo="Ainda não há alunos avaliados" acao={<Link className="btn btn-primario" to={lancar}>Lançar respostas</Link>}>
          Os resultados aparecem assim que o primeiro aluno tiver todas as questões lançadas.
        </Vazio>
      ) : (
        <>
          <div className="grade grade-kpis">
            <Kpi rotulo="Média da turma" valor={pct(media)} detalhe={media != null && <SeloFaixa valor={media} config={config} />} />
            <Kpi
              rotulo="Alunos avaliados"
              valor={`${part.avaliados} de ${part.matriculados}`}
              detalhe={[part.faltas && plural(part.faltas, 'faltou', 'faltaram'), part.adaptadas && `${part.adaptadas} com prova adaptada`]
                .filter(Boolean)
                .join(' · ')}
            />
            <Kpi rotulo="Precisam de atenção" valor={atencao.length} detalhe={`${NOMES_FAIXAS[0].toLowerCase()} (menos de ${config.faixas[0]}%)`} />
            <Kpi rotulo="Questões que contam" valor={validas} detalhe={anuladas ? plural(anuladas, 'anulada', 'anuladas') : 'nenhuma anulada'} />
          </div>

          <div className="grade grade-2">
            <Cartao titulo="Distribuição por faixa de desempenho">
              <BarraFaixas resultados={resultados} config={config} />
              {atencao.length > 0 && (
                <div className="atencao">
                  <h3>Precisam de atenção</h3>
                  <ul>
                    {atencao.map((r) => (
                      <li key={r.aluno.id}>
                        <span>
                          {r.aluno.numero}. {r.aluno.nome}
                        </span>
                        <span className="texto-2">{pct(r.correcao.pct)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Cartao>
            <Cartao titulo="Por disciplina" sub="Percentual de acertos nas questões de cada disciplina">
              <Barras
                config={config}
                itens={porDisciplina.map((d) => ({ chave: d.chave, rotulo: d.chave, valor: d.pct, detalhe: plural(d.questoes, 'questão', 'questões') }))}
              />
            </Cartao>
          </div>

          <Cartao
            titulo="Alunos"
            acoes={
              <div className="segmentos" role="group" aria-label="Ordenar alunos">
                <button className={`segmento ${ordem === 'numero' ? 'ativo' : ''}`} onClick={() => setOrdem('numero')}>
                  Por número
                </button>
                <button className={`segmento ${ordem === 'nota' ? 'ativo' : ''}`} onClick={() => setOrdem('nota')}>
                  Por nota
                </button>
              </div>
            }
          >
            <ComparacaoIngresso resultados={resultados} config={config} compacta />
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="num">Nº</th>
                    <th>Aluno</th>
                    <th>Entrou no colégio</th>
                    <th className="num">Acertos</th>
                    <th className="num">%</th>
                    <th>Faixa</th>
                  </tr>
                </thead>
                <tbody>
                  {linhasAlunos.map((r) => (
                    <tr key={r.aluno.id}>
                      <td className="num">{r.aluno.numero}</td>
                      <td>{r.aluno.nome}</td>
                      <td>
                        {r.aluno.anoIngresso ?? <span className="texto-2">—</span>}
                        {r.aluno.anoIngresso != null && r.aluno.anoIngresso >= turma.anoLetivo && <span className="tag-novo">Novo</span>}
                      </td>
                      {r.correcao ? (
                        <>
                          <td className="num">
                            {r.correcao.acertos}/{r.correcao.validas}
                          </td>
                          <td className="num">{pct(r.correcao.pct)}</td>
                          <td>
                            <SeloFaixa valor={r.correcao.pct} config={config} />
                          </td>
                        </>
                      ) : (
                        <td colSpan={3} className="texto-2">
                          {rotuloSituacao(r)}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>

          <Cartao titulo="Questões" sub="Percentual de acerto e a alternativa errada que mais apareceu em cada questão">
            <div className="tabela-rolagem">
              <table className="tabela">
                <thead>
                  <tr>
                    <th className="num">Nº</th>
                    <th>Disciplina</th>
                    <th>Habilidade</th>
                    <th>Gabarito</th>
                    <th className="coluna-barra">Acerto</th>
                    <th>Erro mais comum</th>
                    <th>Marcações</th>
                  </tr>
                </thead>
                <tbody>
                  {analise.map((a) => {
                    const habilidade = buscarHabilidade(a.questao.habilidade)
                    return (
                      <tr key={a.indice}>
                        <td className="num">{a.indice + 1}</td>
                        <td>{a.questao.disciplina}</td>
                        <td>
                          {habilidade ? (
                            <abbr title={habilidade.descricao} className="codigo">
                              {habilidade.codigo}
                            </abbr>
                          ) : (
                            <span className="texto-2">—</span>
                          )}
                        </td>
                        <td>{a.questao.anulada ? <span className="texto-2">anulada</span> : (a.questao.gabarito ?? <span className="texto-2">sem gabarito</span>)}</td>
                        <td className="coluna-barra">
                          {a.pctAcerto != null && <MiniBarra valor={a.pctAcerto} config={config} />}
                        </td>
                        <td>{a.erroMaisComum ? `${a.erroMaisComum.marca} · ${pct(a.erroMaisComum.pct)}` : <span className="texto-2">—</span>}</td>
                        <td className="marcacoes">
                          {letras.map((l) => (
                            <span key={l} className={l === a.questao.gabarito ? 'certa' : ''}>
                              {l} {a.contagem[l] ?? 0}
                            </span>
                          ))}
                          {(a.contagem[BRANCO] ?? 0) > 0 && <span>branco {a.contagem[BRANCO]}</span>}
                          {(a.contagem[RASURA] ?? 0) > 0 && <span>rasura {a.contagem[RASURA]}</span>}
                        </td>
                      </tr>
                    )
                  })}
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
                  {porHabilidade.map((d) => (
                    <tr key={d.chave}>
                      <td className="codigo">{d.chave}</td>
                      <td className="descricao-habilidade">{buscarHabilidade(d.chave)?.descricao ?? '—'}</td>
                      <td className="num">{d.questoes}</td>
                      <td className="coluna-barra">
                        <MiniBarra valor={d.pct} config={config} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Cartao>
        </>
      )}
    </>
  )
}
