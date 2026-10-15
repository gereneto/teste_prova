import { ArrowRight, ChartColumn, ClipboardCopy, Mail, Phone } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { DIAS_PEDIDO_PARADO } from '../../components/CartaoPedido'
import { Barras, Cabecalho, Cartao, LembreteCooperacao, Progresso, Selo } from '../../components/ui'
import {
  alunosAtivos,
  avaliacaoAtual,
  avaliacoesOrdenadas,
  cadernoDaSerie,
  cadernosDaAvaliacao,
  contatoDoColegio,
  descreverPeriodo,
  etapaAvaliacao,
  lancamentoDe,
  nomesProfessores,
  pedidosPendentes,
  permissoesDe,
  pessoaDoPerfil,
  turmasDoColegio,
} from '../../lib/consultas'
import { analisarQuestoes, avaliados, coletarResultados, mediaPct, progressoDe } from '../../lib/estatisticas'
import { compararTexto, dataCurta, descreverPrazo, diasEntre, hojeIso, plural, primeiroNome, serieNome, turmaNome } from '../../lib/formato'
import { iniciaisRepetidas } from '../../lib/iniciais'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, type Avaliacao, type Db } from '../../types'

interface Pendencia {
  chave: string
  texto: ReactNode
  acao?: { rotulo: string; para: string }
}

export default function InicioSolar() {
  const db = useDb()
  const perfil = usePerfil()
  const pessoa = perfil ? pessoaDoPerfil(db, perfil) : null
  const { editarRede } = permissoesDe(pessoa)
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))
  const atual = avaliacaoAtual(db)
  const abertas = avaliacoesOrdenadas(db).filter((a) => etapaAvaliacao(a) !== 'encerrada')
  const alertas = useMemo(() => alertasDeGabarito(db, atual), [db, atual])

  const pendencias: Pendencia[] = []
  for (const avaliacao of abertas) {
    for (const caderno of cadernosDaAvaliacao(db, avaliacao.id)) {
      const para = `/solar/avaliacoes/${avaliacao.id}?serie=${caderno.serie}`
      const prova = `prova do ${serieNome(caderno.serie)}`
      if (!caderno.pdf) pendencias.push({ chave: `pdf-${caderno.id}`, texto: <>Falta o PDF da <strong>{prova}</strong> ({avaliacao.titulo}).</>, acao: { rotulo: 'Enviar PDF', para } })
      const semGabarito = caderno.questoes.filter((q) => !q.anulada && !q.gabarito).length
      if (semGabarito) {
        pendencias.push({ chave: `gab-${caderno.id}`, texto: <>Falta o gabarito de {plural(semGabarito, 'questão', 'questões')} da <strong>{prova}</strong>.</>, acao: { rotulo: 'Preencher', para } })
      } else if (!caderno.conferencia) {
        pendencias.push({ chave: `conf-${caderno.id}`, texto: <>O gabarito da <strong>{prova}</strong> ainda não foi conferido com a prova impressa.</>, acao: { rotulo: 'Conferir', para } })
      }
    }
  }
  for (const alerta of alertas) {
    pendencias.push({
      chave: `alerta-${alerta.serie}-${alerta.indice}`,
      texto: (
        <>
          <strong>Questão {alerta.indice + 1} da prova do {serieNome(alerta.serie)}</strong>: alerta de gabarito suspeito. Os alunos que vão bem no resto da prova
          marcaram outra alternativa.
        </>
      ),
      acao: { rotulo: 'Ver a questão', para: `/solar/resultados?avaliacao=${alerta.avaliacaoId}&serie=${alerta.serie}` },
    })
  }
  for (const colegio of colegios) {
    if (!contatoDoColegio(db, colegio.id)) {
      pendencias.push({ chave: `resp-${colegio.id}`, texto: <><strong>{colegio.nome}</strong> ainda não tem responsável pela coordenação.</>, acao: { rotulo: 'Definir responsável', para: `/solar/colegios/${colegio.id}` } })
    }
    const parados = pedidosPendentes(db, colegio.id).filter((p) => diasEntre(p.criadoEm, hojeIso()) > DIAS_PEDIDO_PARADO)
    if (parados.length) {
      const dias = Math.max(...parados.map((p) => diasEntre(p.criadoEm, hojeIso())))
      pendencias.push({
        chave: `ped-${colegio.id}`,
        texto: (
          <>
            <strong>{colegio.nome}</strong>: {plural(parados.length, 'pedido de professor espera', 'pedidos de professores esperam')} a coordenação há até {dias} dias.
          </>
        ),
        acao: { rotulo: 'Ver colégio', para: `/solar/colegios/${colegio.id}` },
      })
    }
  }

  return (
    <>
      <Cabecalho sobretitulo="Início" titulo={`Olá, ${primeiroNome(pessoa?.nome ?? '')}`} subtitulo="Equipe Solar · o que precisa de atenção na rede" />

      <Cartao titulo="O que precisa de você agora">
        {pendencias.length ? (
          <ul className="atencao-lista">
            {pendencias.map((p) => (
              <li key={p.chave}>
                <span>{p.texto}</span>
                {p.acao && (
                  <Link className="btn btn-pequeno" to={p.acao.para}>
                    {editarRede || p.acao.rotulo.startsWith('Ver') ? p.acao.rotulo : 'Ver'} <ArrowRight size={15} aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tudo-em-dia">Tudo em dia na rede.</p>
        )}
        {!editarRede && pendencias.length > 0 && <p className="texto-2 pequeno">Seu acesso é só de visualização: quem resolve é a equipe com permissão de edição.</p>}
      </Cartao>

      {atual && <Andamento db={db} avaliacao={atual} quem={primeiroNome(pessoa?.nome ?? '')} />}

      <Prontidao db={db} />

      {atual && <ResumoResultados db={db} avaliacao={atual} />}

      <div className="grade grade-kpis">
        <div className="kpi kpi-pequeno">
          <div className="kpi-valor">{db.colegios.length}</div>
          <div className="kpi-rotulo">colégios</div>
        </div>
        <div className="kpi kpi-pequeno">
          <div className="kpi-valor">{db.turmas.filter((t) => t.anoLetivo === db.config.anoLetivo).length}</div>
          <div className="kpi-rotulo">turmas em {db.config.anoLetivo}</div>
        </div>
        <div className="kpi kpi-pequeno">
          <div className="kpi-valor">{db.alunos.filter((a) => a.ativo && !a.pendente).length.toLocaleString('pt-BR')}</div>
          <div className="kpi-rotulo">alunos</div>
        </div>
        <div className="kpi kpi-pequeno">
          <div className="kpi-valor">{db.avaliacoes.length}</div>
          <div className="kpi-rotulo">avaliações anuais</div>
        </div>
      </div>
    </>
  )
}

/** Questões com alerta de gabarito suspeito na avaliação em andamento. */
function alertasDeGabarito(db: Db, avaliacao: Avaliacao | null) {
  if (!avaliacao) return []
  return SERIES.flatMap((serie) => {
    const caderno = cadernoDaSerie(db, avaliacao.id, serie)
    if (!caderno) return []
    const resultados = coletarResultados(db, { avaliacaoId: avaliacao.id, serie })
    return analisarQuestoes(caderno, resultados)
      .filter((a) => a.alertas.includes('gabarito_suspeito'))
      .map((a) => ({ avaliacaoId: avaliacao.id, serie, indice: a.indice }))
  })
}

function Andamento({ db, avaliacao, quem }: { db: Db; avaliacao: Avaliacao; quem: string }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const linhas = [...db.colegios]
    .sort((a, b) => compararTexto(a.nome, b.nome))
    .map((colegio) => {
      const turmas = turmasDoColegio(db, colegio.id, avaliacao.anoLetivo).flatMap((turma) => {
        const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
        if (!caderno) return []
        const lancamento = lancamentoDe(db, caderno.id, turma.id)
        const ultima = lancamento ? Object.values(lancamento.respostas).reduce((m, r) => (r.atualizadoEm > m ? r.atualizadoEm : m), '') : ''
        return [{ turma, caderno, progresso: progressoDe(db, caderno, turma.id), ultima }]
      })
      return { colegio, turmas, contato: contatoDoColegio(db, colegio.id) }
    })
  const total = linhas.reduce((s, l) => s + l.turmas.length, 0)
  const concluidas = linhas.reduce((s, l) => s + l.turmas.filter((t) => t.progresso.status === 'concluido').length, 0)

  async function copiar(linha: (typeof linhas)[number]) {
    const faltam = linha.turmas.filter((t) => t.progresso.status !== 'concluido')
    const texto = `Olá${linha.contato ? `, ${primeiroNome(linha.contato.nome)}` : ''}! Na ${avaliacao.titulo}, ${plural(faltam.length, 'turma do colégio ainda não concluiu', 'turmas do colégio ainda não concluíram')} o lançamento: ${faltam
      .map((t) => `${turmaNome(t.turma)} (${t.progresso.status === 'nao_iniciado' ? 'não começou' : `${t.progresso.lancados} de ${t.progresso.total}`})`)
      .join(', ')}. O prazo vai até ${dataCurta(avaliacao.prazoLancamento)}. Se precisarem de ajuda com o site, é só chamar. ${quem}, equipe Solar`
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(linha.colegio.id)
    } catch {
      window.prompt('Copie o lembrete:', texto)
    }
  }

  return (
    <Cartao
      titulo={`Andamento do lançamento · ${avaliacao.titulo}`}
      sub={`${descreverPeriodo(avaliacao)} · ${descreverPrazo(avaliacao.prazoLancamento)}`}
      acoes={
        <Link className="btn" to={`/solar/resultados?avaliacao=${avaliacao.id}`}>
          <ChartColumn size={16} aria-hidden /> Resultados
        </Link>
      }
    >
      <p className="resumo-andamento">
        <strong>{concluidas}</strong> de {total} turmas concluíram o lançamento
      </p>
      <Progresso valor={concluidas} total={total} rotulo="Turmas concluídas" />
      <div className="andamento-colegios">
        {linhas.map((linha) => {
          const faltam = linha.turmas.filter((t) => t.progresso.status !== 'concluido')
          const feitas = linha.turmas.length - faltam.length
          return (
            <details key={linha.colegio.id} className="andamento-colegio">
              <summary>
                <span className="andamento-colegio-nome">{linha.colegio.nome}</span>
                <span className="progresso-com-texto">
                  <Progresso valor={feitas} total={linha.turmas.length} />
                  <span className="texto-2 pequeno">
                    {feitas} de {linha.turmas.length} concluídas
                  </span>
                </span>
              </summary>
              {faltam.length ? (
                <>
                  <ul className="lista-simples">
                    {faltam.map(({ turma, progresso, ultima }) => (
                      <li key={turma.id}>
                        <span>
                          <strong>{turmaNome(turma)}</strong> · {nomesProfessores(db, turma)}
                        </span>
                        <span className="texto-2 pequeno">
                          {progresso.status === 'nao_iniciado' ? 'não começou' : `${progresso.lancados} de ${progresso.total} lançados`}
                          {ultima && ` · última atividade em ${dataCurta(ultima)}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="andamento-contato">
                    {linha.contato ? (
                      <span className="pequeno">
                        Coordenação: <strong>{linha.contato.nome}</strong>
                        {linha.contato.telefone && (
                          <a href={`tel:${linha.contato.telefone.replace(/[^\d+]/g, '')}`}>
                            {' '}
                            <Phone size={13} aria-hidden /> {linha.contato.telefone}
                          </a>
                        )}
                        {linha.contato.email && (
                          <a href={`mailto:${linha.contato.email}`}>
                            {' '}
                            <Mail size={13} aria-hidden /> {linha.contato.email}
                          </a>
                        )}
                      </span>
                    ) : (
                      <span className="texto-2 pequeno">Sem responsável pela coordenação.</span>
                    )}
                    <button className="btn btn-pequeno btn-fantasma" onClick={() => copiar(linha)}>
                      <ClipboardCopy size={15} aria-hidden /> {copiado === linha.colegio.id ? 'Lembrete copiado' : 'Copiar lembrete'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="texto-2 pequeno">Todas as turmas concluíram o lançamento.</p>
              )}
            </details>
          )
        })}
      </div>
    </Cartao>
  )
}

/** Se cada colégio está pronto: responsável, professores nas turmas, alunos cadastrados e com ano de entrada. */
function Prontidao({ db }: { db: Db }) {
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))
  return (
    <Cartao titulo="Como estão os cadastros dos colégios" sub="O que cada colégio já preparou no site. Clique no colégio para ver os detalhes.">
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Colégio</th>
              <th>Responsável</th>
              <th className="num">Turmas com professor</th>
              <th className="num">Alunos</th>
              <th className="num">Sem ano de entrada</th>
              <th className="num">Iniciais repetidas</th>
              <th className="num">Pedidos esperando</th>
            </tr>
          </thead>
          <tbody>
            {colegios.map((colegio) => {
              const turmas = turmasDoColegio(db, colegio.id)
              const alunos = turmas.flatMap((t) => alunosAtivos(db, t.id))
              const comProfessor = turmas.filter((t) => t.professorIds.length).length
              const semAno = alunos.filter((a) => a.anoIngresso == null).length
              const repetidas = turmas.filter((t) => iniciaisRepetidas(alunosAtivos(db, t.id)).size > 0).length
              const pedidos = pedidosPendentes(db, colegio.id).length
              const responsavel = contatoDoColegio(db, colegio.id)
              return (
                <tr key={colegio.id}>
                  <td>
                    <Link to={`/solar/colegios/${colegio.id}`}>{colegio.nome}</Link>
                  </td>
                  <td>{responsavel ? responsavel.nome : <Selo tom="ambar">Sem responsável</Selo>}</td>
                  <td className="num">{comProfessor === turmas.length ? `${comProfessor} de ${turmas.length}` : <Selo tom="ambar">{`${comProfessor} de ${turmas.length}`}</Selo>}</td>
                  <td className="num">{alunos.length}</td>
                  <td className="num">{semAno ? <Selo tom="ambar">{String(semAno)}</Selo> : <span className="texto-2">0</span>}</td>
                  <td className="num">{repetidas ? `${plural(repetidas, 'turma', 'turmas')}` : <span className="texto-2">0</span>}</td>
                  <td className="num">{pedidos ? <Selo tom="ambar">{String(pedidos)}</Selo> : <span className="texto-2">0</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="texto-2 pequeno">Iniciais repetidas não são um erro: o número de chamada diferencia os alunos. Vale só conferir.</p>
    </Cartao>
  )
}

function ResumoResultados({ db, avaliacao }: { db: Db; avaliacao: Avaliacao }) {
  const resultados = useMemo(() => coletarResultados(db, { avaliacaoId: avaliacao.id }), [db, avaliacao.id])
  if (!avaliados(resultados).length) return null
  const porColegio = [...db.colegios]
    .sort((a, b) => compararTexto(a.nome, b.nome))
    .map((c) => {
      const rs = resultados.filter((r) => r.colegio.id === c.id)
      return { chave: c.id, rotulo: c.nome, valor: mediaPct(rs), detalhe: plural(avaliados(rs).length, 'aluno', 'alunos') }
    })
  return (
    <Cartao
      titulo={`Resultados até agora · ${avaliacao.titulo}`}
      sub={`Média de acertos da rede: ${mediaPct(resultados) == null ? '—' : `${Math.round(mediaPct(resultados)!)}%`}. Colégios em ordem alfabética.`}
      acoes={
        <Link className="btn" to={`/solar/resultados?avaliacao=${avaliacao.id}`}>
          <ChartColumn size={16} aria-hidden /> Ver tudo
        </Link>
      }
    >
      <LembreteCooperacao chave="solar-inicio">
        Use estas comparações para descobrir onde apoiar e quem pode compartilhar o que deu certo, não para classificar colégios ou professores.
      </LembreteCooperacao>
      <Barras config={db.config} itens={porColegio} />
    </Cartao>
  )
}
