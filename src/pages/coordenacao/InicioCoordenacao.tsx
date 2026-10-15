import { ArrowRight, ChartColumn, ClipboardCopy, ClipboardList, Users } from 'lucide-react'
import { useState, type MouseEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Cabecalho, Cartao, Progresso, Vazio } from '../../components/ui'
import { DIAS_PEDIDO_PARADO } from '../../components/CartaoPedido'
import {
  alunosAtivos,
  avaliacaoAtual,
  cadernoDaSerie,
  etapaAvaliacao,
  lancamentoDe,
  pedidosPendentes,
  pessoaDoPerfil,
  turmasDoColegio,
} from '../../lib/consultas'
import { progressoDe } from '../../lib/estatisticas'
import { dataCurta, dataLonga, descreverPrazo, diasAte, diasEntre, hojeIso, listaEmTexto, plural, primeiroNome, turmaNome } from '../../lib/formato'
import { iniciaisRepetidas } from '../../lib/iniciais'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Avaliacao, Db, Turma } from '../../types'

interface ItemAtencao {
  chave: string
  texto: ReactNode
  acao: { rotulo: string; para: string }
}

export default function InicioCoordenacao() {
  const db = useDb()
  const perfil = usePerfil()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!perfil || !colegio) return null
  const pessoa = pessoaDoPerfil(db, perfil)
  const turmas = turmasDoColegio(db, colegio.id)
  const avaliacao = avaliacaoAtual(db)
  const base = '/coordenacao'

  const itens: ItemAtencao[] = []
  const pedidos = pedidosPendentes(db, colegio.id)
  if (pedidos.length) {
    const maisAntigo = Math.max(...pedidos.map((p) => diasEntre(p.criadoEm, hojeIso())))
    itens.push({
      chave: 'pedidos',
      texto: (
        <>
          <strong>{plural(pedidos.length, 'pedido de professor espera', 'pedidos de professores esperam')}</strong> a sua resposta
          {maisAntigo > DIAS_PEDIDO_PARADO ? `, o mais antigo há ${maisAntigo} dias` : ''}.
        </>
      ),
      acao: { rotulo: 'Ver pedidos', para: `${base}/pedidos` },
    })
  }
  for (const turma of turmas.filter((t) => !t.professorIds.length)) {
    itens.push({ chave: `prof-${turma.id}`, texto: <><strong>{turmaNome(turma)}</strong> está sem professor.</>, acao: { rotulo: 'Escolher professor', para: `${base}/professores` } })
  }
  for (const turma of turmas) {
    const alunos = alunosAtivos(db, turma.id)
    const para = `${base}/turma/${turma.id}/alunos`
    if (!alunos.length) {
      itens.push({ chave: `vazia-${turma.id}`, texto: <><strong>{turmaNome(turma)}</strong> ainda não tem alunos cadastrados.</>, acao: { rotulo: 'Colar a lista', para } })
      continue
    }
    const semAno = alunos.filter((a) => a.anoIngresso == null).length
    if (semAno) {
      itens.push({
        chave: `ano-${turma.id}`,
        texto: (
          <>
            <strong>{plural(semAno, 'aluno', 'alunos')}</strong> do {turmaNome(turma)} sem o ano de entrada no colégio.
          </>
        ),
        acao: { rotulo: 'Completar', para },
      })
    }
    const repetidas = iniciaisRepetidas(alunos)
    if (repetidas.size) {
      itens.push({
        chave: `rep-${turma.id}`,
        texto: (
          <>
            No {turmaNome(turma)}, dois alunos têm as mesmas iniciais ({[...repetidas].join(', ')}). Confira se estão certas.
          </>
        ),
        acao: { rotulo: 'Conferir', para },
      })
    }
  }
  if (avaliacao && ['aplicacao', 'lancamento'].includes(etapaAvaliacao(avaliacao))) {
    const naoComecaram = turmas.filter((t) => {
      const caderno = cadernoDaSerie(db, avaliacao.id, t.serie)
      return caderno && progressoDe(db, caderno, t.id).status === 'nao_iniciado'
    })
    if (naoComecaram.length) {
      itens.push({
        chave: 'andamento',
        texto: (
          <>
            {descreverPrazo(avaliacao.prazoLancamento)} para lançar as respostas, e{' '}
            <strong>{plural(naoComecaram.length, 'turma ainda não começou', 'turmas ainda não começaram')}</strong>.
          </>
        ),
        acao: { rotulo: 'Ver andamento', para: '#andamento' },
      })
    }
  }

  return (
    <>
      <Cabecalho
        sobretitulo="Início"
        titulo={`Olá, ${primeiroNome(pessoa?.nome ?? '')}`}
        subtitulo={`${colegio.nome} · ${pessoa?.papel === 'coordenacao' && pessoa.coordenador.responsavel ? 'responsável pela coordenação' : 'coordenação'}`}
      />

      {!turmas.length ? (
        <PrimeirosPassos />
      ) : (
        <Cartao titulo="O que precisa da sua atenção">
          {itens.length ? (
            <ul className="atencao-lista">
              {itens.map((item) => (
                <li key={item.chave}>
                  <span>{item.texto}</span>
                  {item.acao.para.startsWith('#') ? (
                    <a className="btn btn-pequeno" href={item.acao.para} onClick={rolarPara(item.acao.para)}>
                      {item.acao.rotulo} <ArrowRight size={15} aria-hidden />
                    </a>
                  ) : (
                    <Link className="btn btn-pequeno" to={item.acao.para}>
                      {item.acao.rotulo} <ArrowRight size={15} aria-hidden />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="tudo-em-dia">Tudo em dia. Nenhuma pendência no colégio.</p>
          )}
        </Cartao>
      )}

      {avaliacao && turmas.length > 0 && <Andamento db={db} avaliacao={avaliacao} turmas={turmas} quem={primeiroNome(pessoa?.nome ?? '')} />}

      <Cartao
        titulo="Resultados do colégio"
        sub="O que o colégio precisa retomar, ano a ano, e material para a reunião pedagógica."
        acoes={
          <Link className="btn btn-primario" to={`${base}/resultados`}>
            <ChartColumn size={16} aria-hidden /> Ver resultados
          </Link>
        }
      >
        <p className="texto-2 pequeno">Os resultados começam pelo que é comum a todas as turmas, para o colégio planejar junto.</p>
      </Cartao>
    </>
  )
}

/** Âncoras dentro da página: com HashRouter, "#andamento" mudaria a rota; aqui só rola até o quadro. */
const rolarPara = (ancora: string) => (e: MouseEvent) => {
  e.preventDefault()
  document.querySelector(ancora)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function PrimeirosPassos() {
  const passos = [
    { texto: 'Cadastre os professores do colégio', para: '/coordenacao/professores', Icone: Users },
    { texto: 'Crie as turmas do ano e diga quem cuida de cada uma', para: '/coordenacao/turmas', Icone: ClipboardList },
    { texto: 'Cole a lista de alunos de cada turma', para: '/coordenacao/turmas', Icone: ClipboardList },
  ]
  return (
    <Cartao titulo="Primeiros passos" sub="O colégio ainda não tem turmas no site. Comece por aqui:">
      <ol className="primeiros-passos">
        {passos.map(({ texto, para, Icone }, i) => (
          <li key={texto}>
            <span className="primeiros-passos-numero">{i + 1}</span>
            <span>{texto}</span>
            <Link className="btn btn-pequeno" to={para}>
              <Icone size={15} aria-hidden /> Abrir
            </Link>
          </li>
        ))}
      </ol>
    </Cartao>
  )
}

/** O andamento do lançamento, sem médias e sem vermelho: serve para ajudar, não para cobrar. */
function Andamento({ db, avaliacao, turmas, quem }: { db: Db; avaliacao: Avaliacao; turmas: Turma[]; quem: string }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const linhas = turmas.flatMap((turma) => {
    const caderno = cadernoDaSerie(db, avaliacao.id, turma.serie)
    if (!caderno) return []
    return [{ turma, caderno, progresso: progressoDe(db, caderno, turma.id), lancamento: lancamentoDe(db, caderno.id, turma.id) }]
  })
  const grupos = [
    { titulo: 'Ainda não começaram', linhas: linhas.filter((l) => l.progresso.status === 'nao_iniciado') },
    { titulo: 'Em andamento', linhas: linhas.filter((l) => l.progresso.status === 'em_andamento') },
    { titulo: 'Concluídas', linhas: linhas.filter((l) => l.progresso.status === 'concluido') },
  ]
  const dias = diasAte(avaliacao.prazoLancamento)

  function lembrete(turma: Turma, lancados: number, total: number): string {
    const nomes = turma.professorIds.map((id) => db.professores.find((p) => p.id === id)?.nome).filter((n): n is string => Boolean(n))
    const saudacao = nomes.length ? `Olá, ${listaEmTexto(nomes.map(primeiroNome))}!` : 'Olá!'
    const situacao = lancados ? `está em ${lancados} de ${total} alunos` : 'ainda não começou'
    return `${saudacao} O lançamento da ${avaliacao.titulo} do ${turmaNome(turma)} ${situacao}, e o prazo vai até ${dataCurta(avaliacao.prazoLancamento)}. Se precisar de ajuda com o site, é só me chamar. ${quem}`
  }

  async function copiar(turma: Turma, lancados: number, total: number) {
    const texto = lembrete(turma, lancados, total)
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(turma.id)
    } catch {
      window.prompt('Copie o lembrete:', texto)
    }
  }

  return (
    <Cartao
      id="andamento"
      titulo={`Andamento do lançamento · ${avaliacao.titulo}`}
      sub={`${dias >= 0 ? `${descreverPrazo(avaliacao.prazoLancamento)}.` : `O prazo terminou em ${dataCurta(avaliacao.prazoLancamento)}.`} O lançamento leva tempo: antes de cobrar, pergunte se o professor precisa de ajuda.`}
    >
      <div className="andamento-grupos">
        {grupos.map((grupo) => (
          <section key={grupo.titulo} className="andamento-grupo">
            <h3 className="subtitulo">
              {grupo.titulo} <span className="texto-2">({grupo.linhas.length})</span>
            </h3>
            {!grupo.linhas.length ? (
              <p className="texto-2 pequeno">Nenhuma turma.</p>
            ) : (
              <ul className="andamento-lista">
                {grupo.linhas.map(({ turma, caderno, progresso, lancamento }) => (
                  <li key={turma.id}>
                    <div className="andamento-turma">
                      <strong>{turmaNome(turma)}</strong>
                      <span className="texto-2 pequeno">
                        {turma.professorIds.map((id) => db.professores.find((p) => p.id === id)?.nome).filter(Boolean).join(', ') || 'Sem professor'}
                      </span>
                    </div>
                    {progresso.status === 'concluido' ? (
                      <span className="texto-2 pequeno">{lancamento?.concluidoEm ? `concluída em ${dataLonga(lancamento.concluidoEm)}` : 'concluída'}</span>
                    ) : (
                      <div className="progresso-com-texto">
                        <Progresso valor={progresso.lancados} total={progresso.total} rotulo="Alunos lançados" />
                        <span className="texto-2 pequeno">
                          {progresso.lancados} de {progresso.total}
                        </span>
                      </div>
                    )}
                    <div className="andamento-acoes">
                      {progresso.status === 'concluido' ? (
                        <Link className="btn btn-pequeno" to={`/coordenacao/resultados/${caderno.id}/${turma.id}`}>
                          <ChartColumn size={15} aria-hidden /> Resultados
                        </Link>
                      ) : (
                        <>
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => copiar(turma, progresso.lancados, progresso.total)}>
                            <ClipboardCopy size={15} aria-hidden /> {copiado === turma.id ? 'Lembrete copiado' : 'Copiar lembrete'}
                          </button>
                          <Link className="btn btn-pequeno btn-fantasma" to={`/coordenacao/lancar/${caderno.id}/${turma.id}`}>
                            <ClipboardList size={15} aria-hidden /> Ajudar a lançar
                          </Link>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {!linhas.length && <Vazio titulo="Nenhuma prova para as turmas do colégio nesta avaliação" />}
    </Cartao>
  )
}
