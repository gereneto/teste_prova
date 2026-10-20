import { ArrowRight, ChartColumn, ClipboardCopy, Mail, Phone } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Barras, Cabecalho, Cartao, LembreteCooperacao, Progresso, Selo } from '../../components/ui'
import {
  avaliacaoAtual,
  avaliacoesOrdenadas,
  cadernosDaAvaliacao,
  cadernosDaSerie,
  contatoDoColegio,
  descreverPeriodo,
  etapaAvaliacao,
  membroSolarDoColegio,
  nomesProfessores,
  permissoesDe,
  podeDefinirResponsavel,
  pessoaDoPerfil,
  turmasDoColegio,
} from '../../lib/consultas'
import { compararTexto, dataCurta, descreverPrazo, plural, primeiroNome, provaNome, turmaNome } from '../../lib/formato'
import { analisarQuestoesAg, avaliadosAg, mediaAg, progressoAg } from '../../lib/rede'
import { useDb } from '../../store/db'
import { useRede, type Rede } from '../../store/painel'
import { usePerfil } from '../../store/perfil'
import { DISCIPLINAS_DA_PROVA, type Avaliacao, type Db } from '../../types'

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
  const rede = useRede()
  const atual = avaliacaoAtual(db)
  const abertas = avaliacoesOrdenadas(db).filter((a) => etapaAvaliacao(a) !== 'encerrada')
  const alertas = useMemo(() => alertasDeGabarito(db, rede, atual), [db, rede, atual])

  const pendencias: Pendencia[] = []
  for (const avaliacao of abertas) {
    for (const caderno of cadernosDaAvaliacao(db, avaliacao.id)) {
      const para = `/solar/avaliacoes/${avaliacao.id}?serie=${caderno.serie}&disciplina=${caderno.disciplina}`
      const prova = `prova de ${provaNome(caderno)}`
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
      chave: `alerta-${alerta.caderno.id}-${alerta.indice}`,
      texto: (
        <>
          <strong>
            Questão {alerta.indice + 1} da prova de {provaNome(alerta.caderno)}
          </strong>
          : alerta de gabarito suspeito. Os alunos que vão bem no resto da prova marcaram outra alternativa.
        </>
      ),
      acao: {
        rotulo: 'Ver a questão',
        para: `/solar/resultados?avaliacao=${alerta.caderno.avaliacaoId}&serie=${alerta.caderno.serie}&disciplina=${alerta.caderno.disciplina}`,
      },
    })
  }
  for (const colegio of colegios) {
    if (!contatoDoColegio(db, colegio.id)) {
      const quem = membroSolarDoColegio(db, colegio)
      pendencias.push({
        chave: `resp-${colegio.id}`,
        texto: (
          <>
            <strong>{colegio.nome}</strong> ainda não tem responsável pela coordenação.
            {!podeDefinirResponsavel(pessoa, colegio) && quem && ` Quem define é ${quem.nome}.`}
          </>
        ),
        acao: { rotulo: podeDefinirResponsavel(pessoa, colegio) ? 'Definir responsável' : 'Ver colégio', para: `/solar/colegios/${colegio.id}` },
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

      {atual && <Andamento db={db} rede={rede} avaliacao={atual} quem={primeiroNome(pessoa?.nome ?? '')} />}

      <Prontidao db={db} rede={rede} />

      {atual && <ResumoResultados db={db} rede={rede} avaliacao={atual} />}

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
          <div className="kpi-valor">{rede.painel.cadastros.reduce((s, c) => s + c.alunos, 0).toLocaleString('pt-BR')}</div>
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

/** Questões com alerta de gabarito suspeito na avaliação em andamento, pelas somas de todas as turmas. */
function alertasDeGabarito(db: Db, rede: Rede, avaliacao: Avaliacao | null) {
  if (!avaliacao) return []
  return cadernosDaAvaliacao(db, avaliacao.id).flatMap((caderno) =>
    analisarQuestoesAg(caderno, rede.painel.turmas)
      .filter((a) => a.alertas.includes('gabarito_suspeito'))
      .map((a) => ({ caderno, indice: a.indice })),
  )
}

function Andamento({ db, rede, avaliacao, quem }: { db: Db; rede: Rede; avaliacao: Avaliacao; quem: string }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  // Uma linha por turma e prova (cada turma lança Português e Matemática).
  const linhas = [...db.colegios]
    .sort((a, b) => compararTexto(a.nome, b.nome))
    .map((colegio) => {
      const turmas = turmasDoColegio(db, colegio.id, avaliacao.anoLetivo).flatMap((turma) =>
        cadernosDaSerie(db, avaliacao.id, turma.serie).map((caderno) => {
          const ag = rede.agDe(caderno.id, turma.id)
          return { turma, caderno, progresso: progressoAg(ag), ultima: ag?.ultima ?? '' }
        }),
      )
      return { colegio, turmas, contato: contatoDoColegio(db, colegio.id) }
    })
  const total = linhas.reduce((s, l) => s + l.turmas.length, 0)
  const concluidas = linhas.reduce((s, l) => s + l.turmas.filter((t) => t.progresso.status === 'concluido').length, 0)

  async function copiar(linha: (typeof linhas)[number]) {
    const faltam = linha.turmas.filter((t) => t.progresso.status !== 'concluido')
    const texto = `Olá${linha.contato ? `, ${primeiroNome(linha.contato.nome)}` : ''}! Na ${avaliacao.titulo}, ${plural(faltam.length, 'lançamento do colégio ainda não foi concluído', 'lançamentos do colégio ainda não foram concluídos')}: ${faltam
      .map((t) => `${turmaNome(t.turma)}, ${t.caderno.disciplina} (${t.progresso.status === 'nao_iniciado' ? 'não começou' : `${t.progresso.lancados} de ${t.progresso.total}`})`)
      .join('; ')}. O prazo vai até ${dataCurta(avaliacao.prazoLancamento)}. Se precisarem de ajuda com o site, é só chamar. ${quem}, equipe Solar`
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
        <strong>{concluidas}</strong> de {total} lançamentos concluídos <span className="texto-2 pequeno">(cada turma lança Português e Matemática)</span>
      </p>
      <Progresso valor={concluidas} total={total} rotulo="Lançamentos concluídos" />
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
                    {faltam.map(({ turma, caderno, progresso, ultima }) => (
                      <li key={`${turma.id}-${caderno.id}`}>
                        <span>
                          <strong>
                            {turmaNome(turma)} · {caderno.disciplina}
                          </strong>{' '}
                          · {nomesProfessores(db, turma)}
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
                <p className="texto-2 pequeno">Todas as turmas concluíram o lançamento das duas provas.</p>
              )}
            </details>
          )
        })}
      </div>
    </Cartao>
  )
}

/** Se cada colégio está pronto: responsável, professores nas turmas, alunos cadastrados e com os dados completos. */
function Prontidao({ db, rede }: { db: Db; rede: Rede }) {
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))
  return (
    <Cartao titulo="Como estão os cadastros dos colégios" sub="O que cada colégio já preparou no site. Clique no colégio para ver os detalhes.">
      <div className="tabela-rolagem">
        <table className="tabela">
          <thead>
            <tr>
              <th>Colégio</th>
              <th>Pela Solar</th>
              <th>Responsável</th>
              <th className="num">Turmas com professor</th>
              <th className="num">Alunos</th>
              <th className="num">Com dados faltando</th>
              <th className="num">Iniciais repetidas</th>
            </tr>
          </thead>
          <tbody>
            {colegios.map((colegio) => {
              const turmas = turmasDoColegio(db, colegio.id)
              const cadastros = turmas.map((t) => rede.cadastroDe(t.id))
              const alunos = cadastros.reduce((s, c) => s + (c?.alunos ?? 0), 0)
              const comProfessor = turmas.filter((t) => t.professorIds.length).length
              const incompletos = cadastros.reduce((s, c) => s + (c?.incompletos ?? 0), 0)
              const repetidas = cadastros.filter((c) => c?.repetidas).length
              const responsavel = contatoDoColegio(db, colegio.id)
              return (
                <tr key={colegio.id}>
                  <td>
                    <Link to={`/solar/colegios/${colegio.id}`}>{colegio.nome}</Link>
                  </td>
                  <td>{membroSolarDoColegio(db, colegio)?.nome ?? <Selo tom="ambar">Ninguém</Selo>}</td>
                  <td>{responsavel ? responsavel.nome : <Selo tom="ambar">Sem responsável</Selo>}</td>
                  <td className="num">{comProfessor === turmas.length ? `${comProfessor} de ${turmas.length}` : <Selo tom="ambar">{`${comProfessor} de ${turmas.length}`}</Selo>}</td>
                  <td className="num">{alunos}</td>
                  <td className="num">{incompletos ? <Selo tom="ambar">{String(incompletos)}</Selo> : <span className="texto-2">0</span>}</td>
                  <td className="num">{repetidas ? `${plural(repetidas, 'turma', 'turmas')}` : <span className="texto-2">0</span>}</td>
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

function ResumoResultados({ db, rede, avaliacao }: { db: Db; rede: Rede; avaliacao: Avaliacao }) {
  const daAvaliacao = rede.painel.turmas.filter((ag) => rede.cadernoDe(ag.caderno)?.avaliacaoId === avaliacao.id)
  if (!avaliadosAg(daAvaliacao)) return null
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))
  const porDisciplina = DISCIPLINAS_DA_PROVA.map((disciplina) => {
    const ags = daAvaliacao.filter((ag) => rede.cadernoDe(ag.caderno)?.disciplina === disciplina)
    const media = mediaAg(ags, rede.cadernoDe)
    const colegio = colegios.map((c) => {
      const doColegio = ags.filter((ag) => rede.colegioDaTurma(ag.turma) === c.id)
      return { chave: c.id, rotulo: c.nome, valor: mediaAg(doColegio, rede.cadernoDe), detalhe: plural(avaliadosAg(doColegio), 'aluno', 'alunos') }
    })
    return { disciplina, media, colegio }
  })
  return (
    <Cartao
      titulo={`Resultados até agora · ${avaliacao.titulo}`}
      sub={`Acerto médio da rede: ${porDisciplina.map((d) => `${d.disciplina} ${d.media == null ? '—' : `${Math.round(d.media)}%`}`).join(' · ')}. Colégios em ordem alfabética.`}
      acoes={
        <Link className="btn" to={`/solar/resultados?avaliacao=${avaliacao.id}`}>
          <ChartColumn size={16} aria-hidden /> Ver tudo
        </Link>
      }
    >
      <LembreteCooperacao chave="solar-inicio">
        Use estas comparações para descobrir onde apoiar e quem pode compartilhar o que deu certo, não para classificar colégios ou professores.
      </LembreteCooperacao>
      <div className="grade grade-2 sem-margem">
        {porDisciplina.map((d) => (
          <div key={d.disciplina}>
            <h3 className="subtitulo">{d.disciplina}</h3>
            <Barras itens={d.colegio} />
          </div>
        ))}
      </div>
    </Cartao>
  )
}
