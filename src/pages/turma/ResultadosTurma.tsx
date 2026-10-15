import { Download, FileSpreadsheet, MessageSquareText, Printer } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { ComparacaoIngresso } from '../../components/ComparacaoIngresso'
import { Aviso, BarraFaixas, Barras, Cartao, Explicacao, Kpi, MiniBarra, Selo, SeloFaixa, Vazio } from '../../components/ui'
import { buscarHabilidade, ordemDisciplina } from '../../data/bncc'
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
  type ResultadoAvaliado,
} from '../../lib/estatisticas'
import { baixarCsv, paraNomeDeArquivo } from '../../lib/exportar'
import { dataCurta, listaEmTexto, pct, plural, serieNome, turmaNome } from '../../lib/formato'
import { identificacao } from '../../lib/iniciais'
import { comentarioEmFrase, dificuldadeDoAluno, erroQueSeDestaca, gruposParaRetomar, LIMITE_RETOMAR, questoesParaRetomar } from '../../lib/leitura'
import { baixarPdfDoCaderno } from '../../store/arquivos'
import { BRANCO, LETRAS, RASURA, VAZIO, type Caderno, type Config, type Letra } from '../../types'
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
  const config = db.config

  const resultados = useMemo(() => coletarResultados(db, { avaliacaoId: avaliacao.id, turmaId: turma.id }), [db, avaliacao.id, turma.id])
  const pendentes = useMemo(
    () => coletarResultados(db, { avaliacaoId: avaliacao.id, turmaId: turma.id, incluirPendentes: true }).filter((r) => r.aluno.pendente),
    [db, avaliacao.id, turma.id],
  )
  const lista = avaliados(resultados)
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const analise = analisarQuestoes(caderno, resultados)
  const validas = caderno.questoes.filter(questaoValida).length
  const semGabarito = caderno.questoes.filter((q) => !q.anulada && q.gabarito === null).length
  const mudancasGabarito = db.historico.filter((e) => e.cadernoId === caderno.id && e.avisarTurmas).slice(-3)

  function exportar() {
    baixarCsv(
      `resultados-${paraNomeDeArquivo(`${colegio.nome} ${turmaNome(turma)} ${avaliacao.titulo}`)}.csv`,
      ['Nº', 'Iniciais', 'Entrou no colégio', 'Novo no colégio', 'Situação', 'Acertos', 'Questões que contam', '% de acertos', 'Faixa', ...caderno.questoes.map((_, i) => `Q${i + 1}`)],
      [...resultados]
        .sort((a, b) => a.aluno.numero - b.aluno.numero)
        .map((r) => [
          r.aluno.numero,
          r.aluno.iniciais,
          r.aluno.anoIngresso,
          r.aluno.anoIngresso == null ? '' : ehNovo(r.aluno, turma.anoLetivo) ? 'sim' : 'não',
          rotuloSituacao(r),
          r.correcao?.acertos,
          r.correcao?.validas,
          r.correcao?.pct,
          r.correcao ? NOMES_FAIXAS[faixaDe(r.correcao.pct, config)] : '',
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
          Resultados parciais: {progresso.lancados} de {plural(progresso.total, 'aluno lançado', 'alunos lançados')}. Os números se atualizam a
          cada resposta lançada.
        </Aviso>
      )}
      {!caderno.conferencia && semGabarito === 0 && (
        <Aviso tom="info">Resultado preliminar: a Solar ainda vai conferir o gabarito desta prova. Se algo mudar, os números se atualizam sozinhos.</Aviso>
      )}
      {semGabarito > 0 && (
        <Aviso tom="info">A Solar ainda não definiu o gabarito de {plural(semGabarito, 'questão', 'questões')}. Elas ficam fora do cálculo até lá.</Aviso>
      )}
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

      {!lista.length && !pendentes.length ? (
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
        <Resumo
          resultados={resultados}
          lista={lista}
          analise={analise}
          caderno={caderno}
          validas={validas}
          config={config}
          comAlunos={comAlunos}
          papel={perfil.papel}
          irPara={(a) => setParams({ aba: a }, { replace: true })}
          anoLetivo={turma.anoLetivo}
        />
      ) : aba === 'alunos' ? (
        <Alunos {...{ db, caderno, avaliacao, turma, resultados, pendentes, config }} />
      ) : aba === 'questoes' ? (
        <Questoes caderno={caderno} analise={analise} config={config} />
      ) : (
        <Habilidades resultados={resultados} config={config} />
      )}
    </>
  )
}

function Resumo(props: {
  resultados: ResultadoAluno[]
  lista: ResultadoAvaliado[]
  analise: AnaliseQuestao[]
  caderno: Caderno
  validas: number
  config: Config
  comAlunos: boolean
  papel: string
  irPara: (aba: Aba) => void
  anoLetivo: number
}) {
  const { resultados, lista, analise, caderno, validas, config, comAlunos } = props
  const media = mediaPct(resultados)
  const mediaAcertos = lista.length ? lista.reduce((s, r) => s + r.correcao.acertos, 0) / lista.length : 0
  const part = participacao(resultados)
  const bons = lista.filter((r) => faixaDe(r.correcao.pct, config) >= 2).length
  const retomar = questoesParaRetomar(analise)
  const destaque = erroQueSeDestaca(analise)
  const comentarioDestaque = destaque ? caderno.questoes[destaque.indice].comentarios?.[destaque.erroMaisComum!.marca as Letra] : undefined
  const atencao = lista.filter((r) => faixaDe(r.correcao.pct, config) === 0).sort((a, b) => a.aluno.numero - b.aluno.numero)
  const faltaram = resultados.filter((r) => r.completo && r.situacao === 'faltou')
  const porDisciplina = desempenhoPor(resultados, (q) => q.disciplina).sort((a, b) => ordemDisciplina(a.chave, b.chave))
  const grupos = gruposParaRetomar(resultados)

  // Para cada aluno novo, as questões que ele errou e a maioria da turma acertou: pistas do que a turma viu antes.
  const pctPorQuestao = new Map(analise.map((a) => [a.indice, a.pctAcerto]))
  const novos = lista
    .filter((r) => ehNovo(r.aluno, props.anoLetivo))
    .map((r) => ({
      r,
      questoes: r.correcao.porQuestao.flatMap((res, i) => (res !== 'certa' && res !== 'fora' && (pctPorQuestao.get(i) ?? 0) >= 60 ? [i + 1] : [])),
    }))

  return (
    <>
      <Cartao titulo="Em poucas palavras" className="cartao-destaque">
        <ul className="frases">
          <li>
            Em média, a turma acertou <strong>{Math.round(mediaAcertos)} das {validas} questões</strong> ({pct(media)}).
          </li>
          <li>
            <strong>{bons}</strong> dos {plural(lista.length, 'aluno avaliado', 'alunos avaliados')} ficaram em Adequado ou Avançado.
          </li>
          <li>
            {retomar.length ? (
              <>
                Para retomar com a turma toda: <strong>{retomar.length === 1 ? 'a questão' : 'as questões'}{' '}
                {listaEmTexto(retomar.slice(0, 6).map((a) => a.indice + 1).sort((a, b) => a - b).map(String))}</strong>
                {retomar.length > 6 ? ` e mais ${retomar.length - 6}` : ''} (menos da metade da turma acertou).{' '}
                <button type="button" className="link-botao" onClick={() => props.irPara('questoes')}>
                  Ver as questões
                </button>
              </>
            ) : (
              'Em todas as questões, pelo menos metade da turma acertou.'
            )}
          </li>
          {destaque && (
            <li>
              Na questão {destaque.indice + 1}, <strong>{plural(destaque.erroMaisComum!.qtd, 'aluno marcou', 'alunos marcaram')} {destaque.erroMaisComum!.marca}</strong>.
              {comentarioDestaque && <span className="frase-comentario">Da equipe Solar: {comentarioEmFrase(destaque.erroMaisComum!.marca, comentarioDestaque)}</span>}
            </li>
          )}
        </ul>
        <p className="texto-2 pequeno">
          Esta é uma prova. Junte com o que você observa em sala antes de tirar conclusões.{' '}
          {props.papel === 'professor'
            ? 'Quem vê estes resultados: você, a coordenação do colégio e a equipe Solar (a Solar vê só os números da turma, sem os alunos).'
            : props.papel === 'coordenacao'
              ? 'Quem vê estes resultados: o professor da turma, a coordenação e a equipe Solar (a Solar vê só os números da turma, sem os alunos).'
              : 'A Solar vê os números da turma; a lista de alunos fica com o colégio.'}
        </p>
      </Cartao>

      <div className="grade grade-kpis">
        <Kpi rotulo="Média da turma" valor={pct(media)} detalhe={media != null && <SeloFaixa valor={media} config={config} />} />
        <Kpi
          rotulo="Alunos avaliados"
          valor={`${part.avaliados} de ${part.matriculados}`}
          detalhe={[part.faltas && plural(part.faltas, 'faltou', 'faltaram'), part.adaptadas && `${part.adaptadas} com prova adaptada`].filter(Boolean).join(' · ')}
        />
        <Kpi rotulo="Precisam de atenção" valor={atencao.length} detalhe={`${NOMES_FAIXAS[0].toLowerCase()}`} />
        <Kpi rotulo="Questões que contam" valor={validas} detalhe={caderno.questoes.length > validas ? `${caderno.questoes.length - validas} fora do cálculo` : 'todas'} />
      </div>

      <div className="grade grade-2">
        <Cartao titulo="Faixas de desempenho" sub="Quantos alunos ficaram em cada faixa, pelo número de acertos">
          <BarraFaixas resultados={resultados} config={config} questoes={validas} />
          {comAlunos && atencao.length > 0 && (
            <div className="atencao">
              <h3>Precisam de atenção</h3>
              <ul>
                {atencao.map((r) => {
                  const dificuldade = dificuldadeDoAluno(r)
                  return (
                    <li key={r.aluno.id}>
                      <span>
                        <strong>{identificacao(r.aluno)}</strong> · acertou {r.correcao.acertos} de {r.correcao.validas}
                        {dificuldade && (
                          <span className="texto-2 bloco pequeno">
                            mais dificuldade em {dificuldade.disciplina} (acertou {dificuldade.acertos} de {dificuldade.questoes})
                          </span>
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {comAlunos && faltaram.length > 0 && (
            <p className="texto-2 pequeno">
              {faltaram.length === 1 ? 'Faltou' : 'Faltaram'}: {listaEmTexto(faltaram.map((r) => `nº ${r.aluno.numero}`))}. Se der, aplique a prova{' '}
              {faltaram.length === 1 ? 'a esse aluno' : 'a esses alunos'} e lance depois.
            </p>
          )}
        </Cartao>
        <Cartao titulo="Por disciplina" sub="Percentual de acertos nas questões de cada disciplina">
          <Barras config={config} itens={porDisciplina.map((d) => ({ chave: d.chave, rotulo: d.chave, valor: d.pct, detalhe: plural(d.questoes, 'questão', 'questões') }))} />
          {porDisciplina.some((d) => d.questoes < 3) && (
            <p className="texto-2 pequeno">Disciplinas com uma ou duas questões dão só uma pista: use com cuidado.</p>
          )}
        </Cartao>
      </div>

      {comAlunos && grupos.length > 0 && (
        <Cartao
          titulo="Grupos para retomar"
          sub="Alunos que acertaram menos da metade das questões de cada disciplina"
          acoes={<Explicacao>Só entram disciplinas com 3 questões ou mais: com menos, o grupo sairia do acaso. Ajuste os grupos com o que você conhece de cada aluno.</Explicacao>}
        >
          <div className="grupos">
            {grupos.map((g) => (
              <div key={g.disciplina} className="grupo">
                <h3>
                  {g.disciplina} <span className="texto-2 pequeno">({plural(g.questoes, 'questão', 'questões')})</span>
                </h3>
                <ul>
                  {g.alunos.map(({ resultado, acertos }) => (
                    <li key={resultado.aluno.id}>
                      {identificacao(resultado.aluno)} <span className="texto-2">· acertou {acertos} de {g.questoes}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Cartao>
      )}

      {comAlunos && novos.length > 0 && (
        <Cartao titulo="Acolhimento dos alunos novos" sub="Questões que cada aluno novo errou e que a maioria da turma acertou: podem ser conteúdos que a turma viu antes de ele chegar.">
          <ul className="lista-simples">
            {novos.map(({ r, questoes }) => (
              <li key={r.aluno.id}>
                <span>
                  <strong>{identificacao(r.aluno)}</strong> · acertou {r.correcao.acertos} de {r.correcao.validas}
                </span>
                <span className="texto-2">{questoes.length ? `${questoes.length > 1 ? 'questões' : 'questão'} ${listaEmTexto(questoes.map(String))}` : 'nenhuma questão nessa situação'}</span>
              </li>
            ))}
          </ul>
          <p className="texto-2 pequeno">Uma sugestão: retomar esses conteúdos em pequeno grupo, sem rotular o aluno.</p>
        </Cartao>
      )}

      <ComparacaoIngresso resultados={resultados} config={config} compacta />
    </>
  )
}

function Alunos(props: {
  db: ContextoTurma['db']
  caderno: Caderno
  avaliacao: ContextoTurma['avaliacao']
  turma: ContextoTurma['turma']
  resultados: ResultadoAluno[]
  pendentes: ResultadoAluno[]
  config: Config
}) {
  const { db, caderno, avaliacao, turma, resultados, pendentes, config } = props
  const [ordem, setOrdem] = useState<'numero' | 'acertos'>('numero')
  const [ficha, setFicha] = useState<string | null>(null)
  const linhas = [...resultados].sort(
    ordem === 'numero' ? (a, b) => a.aluno.numero - b.aluno.numero : (a, b) => (b.correcao?.pct ?? -1) - (a.correcao?.pct ?? -1),
  )

  // Resultados da avaliação do ano anterior dos alunos que estão na turma agora (de qualquer turma em que estavam).
  const anterior = avaliacaoAnterior(db, avaliacao)
  const doAnoAnterior = useMemo(() => {
    if (!anterior || turma.anoLetivo !== db.config.anoLetivo) return new Map<string, ResultadoAluno>()
    const ids = new Set(resultados.map((r) => r.aluno.id))
    return new Map(coletarResultados(db, { avaliacaoId: anterior.id }).filter((r) => ids.has(r.aluno.id)).map((r) => [r.aluno.id, r]))
  }, [db, anterior, turma.anoLetivo, resultados])
  const anteriores = [...doAnoAnterior.values()]

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
                <th>Aluno</th>
                <th>Entrou no colégio</th>
                <th className="num">Acertos</th>
                <th>Faixa</th>
                {anterior && doAnoAnterior.size > 0 && <th>{anterior.titulo}</th>}
              </tr>
            </thead>
            <tbody>
              {linhas.map((r) => {
                const antes = doAnoAnterior.get(r.aluno.id)
                return (
                  <tr key={r.aluno.id}>
                    <td className="num">{r.aluno.numero}</td>
                    <td>
                      {r.aluno.iniciais}
                      {ehNovo(r.aluno, turma.anoLetivo) && <span className="tag-novo">Novo</span>}
                    </td>
                    <td>{r.aluno.anoIngresso ?? <span className="texto-2">não informado</span>}</td>
                    {r.correcao ? (
                      <>
                        <td className="num">
                          {r.correcao.acertos} de {r.correcao.validas}
                        </td>
                        <td>
                          <SeloFaixa valor={r.correcao.pct} config={config} />
                        </td>
                      </>
                    ) : (
                      <td colSpan={2} className="texto-2">
                        {rotuloSituacao(r)}
                      </td>
                    )}
                    {anterior && doAnoAnterior.size > 0 && (
                      <td>
                        {antes?.correcao ? (
                          <>
                            <SeloFaixa valor={antes.correcao.pct} config={config} /> <span className="texto-2 pequeno">{turmaNome(antes.turma)}</span>
                          </>
                        ) : (
                          <span className="texto-2">{antes ? rotuloSituacao(antes) : 'não fez'}</span>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {anterior && doAnoAnterior.size > 0 && (
          <p className="texto-2 pequeno">
            Na {anterior.titulo}, estes alunos fizeram a prova do {serieNome((turma.serie - 1) as 1)}, nem sempre na mesma turma. Compare as faixas, não os
            números exatos: as provas são diferentes.
          </p>
        )}
      </Cartao>

      {pendentes.length > 0 && (
        <Cartao titulo="Aguardando a coordenação" sub="Alunos incluídos a seu pedido. Ficam fora da média e das faixas até a coordenação aprovar.">
          <ul className="lista-simples">
            {pendentes.map((r) => (
              <li key={r.aluno.id}>
                <span>
                  <strong>{identificacao(r.aluno)}</strong>
                </span>
                <span className="texto-2">{r.correcao ? `acertou ${r.correcao.acertos} de ${r.correcao.validas}` : rotuloSituacao(r)}</span>
              </li>
            ))}
          </ul>
        </Cartao>
      )}

      <Cartao
        titulo="Mapa da turma"
        sub="Cada linha é um aluno; cada coluna, uma questão. Casa em branco: acertou. Casa colorida: a letra que marcou. Toque num aluno para ver a ficha."
      >
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
              {[...resultados]
                .sort((a, b) => a.aluno.numero - b.aluno.numero)
                .map((r) => (
                  <tr key={r.aluno.id} className={ficha === r.aluno.id ? 'aberta' : ''}>
                    <th className="mapa-aluno">
                      <button type="button" className="link-botao" onClick={() => setFicha(ficha === r.aluno.id ? null : r.aluno.id)} aria-expanded={ficha === r.aluno.id}>
                        {r.aluno.numero} · {r.aluno.iniciais}
                      </button>
                    </th>
                    {r.correcao ? (
                      r.correcao.porQuestao.map((res, i) => {
                        const marca = marcaEm(r.marcas, i)
                        return (
                          <td key={i} className={`mapa-${res}`}>
                            {res === 'certa' || res === 'fora' ? '' : res === 'branco' ? '–' : res === 'rasura' ? '*' : marca}
                          </td>
                        )
                      })
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
        <p className="mapa-legenda texto-2 pequeno">
          <span className="mapa-amostra mapa-certa" /> acertou · <span className="mapa-amostra mapa-errada">C</span> marcou outra letra ·{' '}
          <span className="mapa-amostra mapa-branco">–</span> em branco · <span className="mapa-amostra mapa-rasura">*</span> rasurada
        </p>
        {ficha && <FichaAluno resultado={resultados.find((r) => r.aluno.id === ficha)!} caderno={caderno} antes={doAnoAnterior.get(ficha)} config={config} />}
      </Cartao>

      {anteriores.length > 0 && anterior && (
        <Cartao titulo={`Como estes alunos foram na ${anterior.titulo}`} sub={`${plural(avaliados(anteriores).length, 'aluno avaliado', 'alunos avaliados')} que hoje estão no ${turmaNome(turma)}`}>
          <BarraFaixas resultados={anteriores} config={config} />
          <p className="texto-2 pequeno">Serve para conhecer a turma, não para comparar com o resultado deste ano: as provas são diferentes.</p>
        </Cartao>
      )}
    </>
  )
}

function FichaAluno({ resultado, caderno, antes, config }: { resultado: ResultadoAluno; caderno: Caderno; antes?: ResultadoAluno; config: Config }) {
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
        {identificacao(resultado.aluno)} · acertou {resultado.correcao.acertos} de {resultado.correcao.validas} <SeloFaixa valor={resultado.correcao.pct} config={config} />
      </h3>
      {antes?.correcao && (
        <p className="texto-2 pequeno">
          No ano anterior ({turmaNome(antes.turma)}): {NOMES_FAIXAS[faixaDe(antes.correcao.pct, config)]}.
        </p>
      )}
      {erradas.length ? (
        <ul>
          {erradas.map((i) => {
            const q = caderno.questoes[i]
            const h = buscarHabilidade(q.habilidade)
            const marca = marcaEm(resultado.marcas, i)
            return (
              <li key={i}>
                <strong>Questão {i + 1}</strong> ({q.disciplina}): {marca === BRANCO ? 'deixou em branco' : marca === RASURA ? 'rasurou' : `marcou ${marca}, a certa era ${q.gabarito}`}.
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

function Questoes({ caderno, analise, config }: { caderno: Caderno; analise: AnaliseQuestao[]; config: Config }) {
  const letras = LETRAS.slice(0, caderno.numAlternativas)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  async function baixar() {
    setErroPdf(null)
    try {
      await baixarPdfDoCaderno(caderno)
    } catch (erro) {
      setErroPdf(erro instanceof Error ? erro.message : 'Não foi possível baixar a prova.')
    }
  }
  return (
    <Cartao
      titulo="Questões"
      sub={`Acerto de cada questão e a alternativa errada que mais apareceu. “Retomar”: menos da metade da turma acertou (abaixo de ${LIMITE_RETOMAR}%).`}
      acoes={
        caderno.pdf && (
          <button className="btn btn-pequeno" onClick={baixar}>
            <Download size={15} aria-hidden /> Baixar a prova para ver as questões
          </button>
        )
      }
    >
      {erroPdf && <p className="erro-campo">{erroPdf}</p>}
      <div className="tabela-rolagem">
        <table className="tabela tabela-questoes">
          <thead>
            <tr>
              <th className="num">Nº</th>
              <th>Disciplina e habilidade</th>
              <th>Gabarito</th>
              <th className="coluna-barra">Acerto</th>
              <th>Erro mais comum</th>
              <th>Marcações</th>
            </tr>
          </thead>
          <tbody>
            {analise.map((a) => {
              const habilidade = buscarHabilidade(a.questao.habilidade)
              const erro = a.erroMaisComum
              const comentario = erro ? a.questao.comentarios?.[erro.marca as Letra] : undefined
              const retomar = a.pctAcerto != null && a.pctAcerto < LIMITE_RETOMAR
              return [
                <tr key={a.indice}>
                  <td className="num">
                    <strong>{a.indice + 1}</strong>
                  </td>
                  <td>
                    {a.questao.disciplina} {retomar && <Selo tom="ambar">Retomar</Selo>}
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
                        <MiniBarra valor={a.pctAcerto} config={config} />
                        <span className="texto-2 bloco pequeno">
                          {Math.round((a.pctAcerto * a.n) / 100)} de {a.n} acertaram
                        </span>
                      </>
                    )}
                  </td>
                  <td>{erro ? `${erro.marca} · ${plural(erro.qtd, 'aluno', 'alunos')}` : <span className="texto-2">—</span>}</td>
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
                (comentario || (retomar && a.questao.comoRetomar)) && (
                  <tr key={`${a.indice}-comentario`} className="linha-comentario">
                    <td />
                    <td colSpan={5}>
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

function Habilidades({ resultados, config }: { resultados: ResultadoAluno[]; config: Config }) {
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
                  <td className="num">
                    {d.questoes}
                    {d.questoes === 1 && <span className="texto-2 bloco pequeno">só uma pista</span>}
                  </td>
                  <td className="coluna-barra">
                    <MiniBarra valor={d.pct} config={config} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="texto-2 pequeno">Quando a habilidade é medida por uma questão só, use o resultado como pista, não como conclusão.</p>
    </Cartao>
  )
}
