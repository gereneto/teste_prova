import { ArrowRight, ChartColumn, ClipboardList, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Aviso, Cabecalho, Cartao, Vazio } from '../../components/ui'
import { descreverFaltando } from '../../lib/alunos'
import {
  alunosAtivos,
  alunosDaTurma,
  avaliacaoDaTurma,
  contatoDoColegio,
  etapaAvaliacao,
  lancamentoDe,
  turmasAnterioresDoProfessor,
  turmasDoProfessor,
} from '../../lib/consultas'
import { marcaEm, progressoDaTurma, respostaCompleta, type Progresso } from '../../lib/estatisticas'
import { dataCurta, dataLonga, descreverPrazo, diasAte, listaEmTexto, plural, primeiroNome, serieNome, turmaNome } from '../../lib/formato'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { VAZIO, type Caderno, type Db, type Turma } from '../../types'

export default function InicioProfessor() {
  const db = useDb()
  const perfil = usePerfil()
  const professor = perfil?.papel === 'professor' ? db.professores.find((p) => p.id === perfil.professorId) : undefined
  if (!professor) return null
  const colegio = db.colegios.find((c) => c.id === professor.colegioId)
  const turmas = turmasDoProfessor(db, professor.id)
  const anteriores = turmasAnterioresDoProfessor(db, professor.id)
  const coordenacao = contatoDoColegio(db, professor.colegioId)

  return (
    <>
      <Cabecalho sobretitulo="Início" titulo={`Olá, ${primeiroNome(professor.nome)}`} subtitulo={colegio?.nome} />

      {!turmas.length && (
        <Vazio titulo="Você ainda não tem turma no site">
          Quem associa cada professor às turmas é a coordenação do colégio
          {coordenacao ? `: ${coordenacao.nome}${coordenacao.telefone ? `, ${coordenacao.telefone}` : ''}` : ''}.
        </Vazio>
      )}

      {turmas.map((turma) => (
        <CartaoTurma key={turma.id} db={db} turma={turma} />
      ))}

      {anteriores.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Turmas de anos anteriores</summary>
          <ul className="lista-simples">
            {anteriores.map((turma) => {
              const prova = avaliacaoDaTurma(db, turma)
              return (
                <li key={turma.id}>
                  <span>
                    {turmaNome(turma)} de {turma.anoLetivo}
                    {prova && <span className="texto-2 bloco pequeno">{prova.avaliacao.titulo}</span>}
                  </span>
                  {prova && (
                    <Link className="btn btn-pequeno" to={`/professor/resultados/${prova.cadernos[0].id}/${turma.id}`}>
                      <ChartColumn size={15} aria-hidden /> Ver resultados
                    </Link>
                  )}
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </>
  )
}

function CartaoTurma({ db, turma }: { db: Db; turma: Turma }) {
  const prova = avaliacaoDaTurma(db, turma)
  const atual = prova && (situacoesDaTurma(db, turma, prova.cadernos).find((s) => s.progresso.status !== 'concluido')?.caderno ?? prova.cadernos[0])
  const alunos = alunosAtivos(db, turma.id)
  const faltando = descreverFaltando(alunos)
  const base = '/professor'
  return (
    <Cartao titulo={turmaNome(turma)} sub={`${turma.turno} · ${plural(alunos.length, 'aluno', 'alunos')}`}>
      <ProximoPasso db={db} turma={turma} />
      {faltando && (
        <Aviso tom="atencao" acoes={<Link className="btn btn-pequeno" to={`${base}/turma/${turma.id}/alunos`}>Completar</Link>}>
          Faltam dados na lista de alunos: {faltando}.
        </Aviso>
      )}
      <div className="atalhos-turma">
        {prova && atual && (
          <>
            <Link to={`${base}/lancar/${atual.id}/${turma.id}`}>
              <ClipboardList size={18} aria-hidden /> Lançar respostas
            </Link>
            <Link to={`${base}/resultados/${prova.cadernos[0].id}/${turma.id}`}>
              <ChartColumn size={18} aria-hidden /> Resultados
            </Link>
          </>
        )}
        <Link to={`${base}/turma/${turma.id}/alunos`}>
          <Users size={18} aria-hidden /> Alunos
        </Link>
      </div>
    </Cartao>
  )
}

/** Como está o lançamento de cada prova (uma por disciplina) da turma. */
function situacoesDaTurma(db: Db, turma: Turma, cadernos: Caderno[]) {
  return cadernos.map((caderno) => {
    const lancamento = lancamentoDe(db, caderno.id, turma.id)
    const alunos = alunosDaTurma(db, turma.id, lancamento)
    return { caderno, lancamento, alunos, progresso: progressoDaTurma(caderno, alunos, lancamento) }
  })
}

const situacaoEmTexto = (p: Progresso) =>
  p.status === 'concluido' ? 'concluído' : p.status === 'nao_iniciado' ? 'não começou' : `${p.lancados} de ${p.total} lançados`

/** O próximo passo da turma em uma frase e um botão: a primeira prova (na ordem das disciplinas) ainda não concluída. */
function ProximoPasso({ db, turma }: { db: Db; turma: Turma }) {
  const prova = avaliacaoDaTurma(db, turma)
  if (!prova) {
    return (
      <div className="proximo-passo">
        <p className="proximo-passo-frase">Ainda não há as provas do {serieNome(turma.serie)} na avaliação deste ano.</p>
      </div>
    )
  }
  const { avaliacao } = prova
  const situacoes = situacoesDaTurma(db, turma, prova.cadernos)
  const pendente = situacoes.find((s) => s.progresso.status !== 'concluido')
  const { caderno, lancamento, alunos, progresso } = pendente ?? situacoes[0]
  const prontas = situacoes.filter((s) => s.progresso.status === 'concluido').map((s) => s.caderno.disciplina)
  const jaPronta = prontas.length && pendente ? `${listaEmTexto(prontas)} ${prontas.length > 1 ? 'prontas' : 'pronto'}. ` : ''
  const base = '/professor'
  const lancar = `${base}/lancar/${caderno.id}/${turma.id}`
  const etapa = etapaAvaliacao(avaliacao)
  const datas = `${avaliacao.titulo}: aplicação de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}, lançamento até ${dataCurta(avaliacao.prazoLancamento)}`
  const dias = diasAte(avaliacao.prazoLancamento)

  let frase: string
  let detalhe: string | null = null
  let botao: { rotulo: string; para: string } | null = null
  let urgente = false

  if (etapa === 'agendada') {
    frase = `A prova será aplicada de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}. Antes disso, confira a lista de alunos da turma.`
    detalhe = 'A coordenação imprime as provas.'
    botao = { rotulo: 'Conferir a lista de alunos', para: `${base}/turma/${turma.id}/alunos` }
  } else if (!pendente) {
    frase = situacoes.length > 1 ? 'Pronto! Todas as provas foram lançadas. Veja como foi a turma.' : 'Pronto! Veja como foi a turma.'
    detalhe = lancamento?.concluidoEm ? `Lançamento concluído em ${dataLonga(lancamento.concluidoEm)}.` : null
    botao = { rotulo: 'Ver resultados', para: `${base}/resultados/${caderno.id}/${turma.id}` }
  } else if (alunos.length > 0 && progresso.lancados === alunos.length) {
    frase = `${jaPronta}Todos os ${alunos.length} alunos foram lançados em ${caderno.disciplina}. Confira e conclua o lançamento.`
    detalhe = descreverPrazo(avaliacao.prazoLancamento)
    botao = { rotulo: `Concluir ${caderno.disciplina}`, para: lancar }
  } else if (etapa === 'aplicacao' && situacoes.every((s) => s.progresso.status === 'nao_iniciado')) {
    frase = `Semana da prova: de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}. Depois de aplicar, lance as respostas de cada prova.`
    detalhe = descreverPrazo(avaliacao.prazoLancamento)
    botao = { rotulo: `Lançar ${caderno.disciplina}`, para: lancar }
  } else if (progresso.status === 'nao_iniciado') {
    frase = `${jaPronta}Lance as respostas de ${caderno.disciplina} do ${turmaNome(turma)}. ${descreverPrazo(avaliacao.prazoLancamento)}.`
    detalhe = `0 de ${plural(alunos.length, 'aluno lançado', 'alunos lançados')}.`
    botao = { rotulo: `Começar ${caderno.disciplina}`, para: lancar }
    urgente = dias >= 0 && dias <= 3
  } else {
    const parado = alunos.find((a) => !respostaCompleta(caderno, lancamento?.respostas[a.id]))
    const marcas = parado ? lancamento?.respostas[parado.id]?.marcas : undefined
    const questao = marcas ? caderno.questoes.findIndex((q, i) => !q.anulada && marcaEm(marcas, i) === VAZIO) : -1
    frase = parado
      ? marcas && questao >= 0
        ? `Em ${caderno.disciplina}, você parou no aluno nº ${parado.numero}, na questão ${questao + 1}.`
        : `Em ${caderno.disciplina}, o próximo é o aluno nº ${parado.numero}.`
      : `Continue o lançamento de ${caderno.disciplina}.`
    detalhe = `${progresso.lancados} de ${plural(alunos.length, 'aluno lançado', 'alunos lançados')}. ${descreverPrazo(avaliacao.prazoLancamento)}.`
    botao = { rotulo: 'Continuar de onde parei', para: lancar }
    urgente = dias >= 0 && dias <= 3
  }
  const resumo = situacoes.length > 1 ? situacoes.map((s) => `${s.caderno.disciplina}: ${situacaoEmTexto(s.progresso)}`).join(' · ') : null

  return (
    <div className={`proximo-passo ${urgente ? 'urgente' : ''}`}>
      <p className="sobretitulo">O que fazer agora</p>
      <p className="proximo-passo-frase">{frase}</p>
      {detalhe && <p className="proximo-passo-detalhe">{detalhe}</p>}
      {resumo && etapa !== 'agendada' && <p className="proximo-passo-detalhe">{resumo}</p>}
      {botao && (
        <Link className="btn btn-primario btn-grande" to={botao.para}>
          {botao.rotulo} <ArrowRight size={18} aria-hidden />
        </Link>
      )}
      <p className="texto-2 pequeno proximo-passo-datas">{datas}</p>
    </div>
  )
}
