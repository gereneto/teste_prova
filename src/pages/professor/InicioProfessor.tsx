import { ArrowRight, ChartColumn, ClipboardList, Printer, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Cabecalho, Cartao, Selo, Vazio } from '../../components/ui'
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
import { marcaEm, progressoDaTurma, respostaCompleta } from '../../lib/estatisticas'
import { dataCurta, dataLonga, descreverPrazo, diasAte, plural, primeiroNome, serieNome, turmaNome } from '../../lib/formato'
import { descreverPedido, situacaoDoPedido } from '../../lib/pedidos'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { VAZIO, type Db, type Turma } from '../../types'

export default function InicioProfessor() {
  const db = useDb()
  const perfil = usePerfil()
  const professor = perfil?.papel === 'professor' ? db.professores.find((p) => p.id === perfil.professorId) : undefined
  if (!professor) return null
  const colegio = db.colegios.find((c) => c.id === professor.colegioId)
  const turmas = turmasDoProfessor(db, professor.id)
  const anteriores = turmasAnterioresDoProfessor(db, professor.id)
  const coordenacao = contatoDoColegio(db, professor.colegioId)
  const pedidos = db.pedidos
    .filter((p) => p.professorId === professor.id && p.situacao !== 'cancelado')
    .sort((a, b) => (b.decisao?.em ?? b.criadoEm).localeCompare(a.decisao?.em ?? a.criadoEm))

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

      {pedidos.length > 0 && (
        <Cartao titulo="Seus pedidos à coordenação" sub="Mudanças na lista de alunos só valem depois que a coordenação aprova.">
          <ul className="lista-simples">
            {pedidos.slice(0, 5).map((pedido) => {
              const situacao = situacaoDoPedido(pedido)
              return (
                <li key={pedido.id}>
                  <span>
                    {descreverPedido(db, pedido, turmas.length > 1)}
                    {pedido.situacao === 'recusado' && pedido.decisao?.motivo && <span className="texto-2 bloco pequeno">Motivo: {pedido.decisao.motivo}</span>}
                  </span>
                  <Selo tom={situacao.tom}>{situacao.texto}</Selo>
                </li>
              )
            })}
          </ul>
        </Cartao>
      )}

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
                    <Link className="btn btn-pequeno" to={`/professor/resultados/${prova.caderno.id}/${turma.id}`}>
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
  const alunos = alunosAtivos(db, turma.id)
  const base = '/professor'
  return (
    <Cartao titulo={turmaNome(turma)} sub={`${turma.turno} · ${plural(alunos.length, 'aluno', 'alunos')}`}>
      <ProximoPasso db={db} turma={turma} />
      <div className="atalhos-turma">
        {prova && (
          <>
            <Link to={`${base}/lancar/${prova.caderno.id}/${turma.id}`}>
              <ClipboardList size={18} aria-hidden /> Lançar respostas
            </Link>
            <Link to={`${base}/resultados/${prova.caderno.id}/${turma.id}`}>
              <ChartColumn size={18} aria-hidden /> Resultados
            </Link>
          </>
        )}
        <Link to={`${base}/turma/${turma.id}/alunos`}>
          <Users size={18} aria-hidden /> Alunos
        </Link>
        {prova && (
          <Link to={`/imprimir/material/${prova.caderno.id}/${turma.id}`}>
            <Printer size={18} aria-hidden /> Imprimir material
          </Link>
        )}
      </div>
    </Cartao>
  )
}

/** O próximo passo da turma em uma frase e um botão. */
function ProximoPasso({ db, turma }: { db: Db; turma: Turma }) {
  const prova = avaliacaoDaTurma(db, turma)
  if (!prova) {
    return (
      <div className="proximo-passo">
        <p className="proximo-passo-frase">Ainda não há prova do {serieNome(turma.serie)} na avaliação deste ano.</p>
      </div>
    )
  }
  const { avaliacao, caderno } = prova
  const base = '/professor'
  const lancar = `${base}/lancar/${caderno.id}/${turma.id}`
  const lancamento = lancamentoDe(db, caderno.id, turma.id)
  const alunos = alunosDaTurma(db, turma.id, lancamento)
  const progresso = progressoDaTurma(caderno, alunos, lancamento)
  const etapa = etapaAvaliacao(avaliacao)
  const datas = `${avaliacao.titulo}: aplicação de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}, lançamento até ${dataCurta(avaliacao.prazoLancamento)}`
  const dias = diasAte(avaliacao.prazoLancamento)

  let frase: string
  let detalhe: string | null = null
  let botao: { rotulo: string; para: string } | null = null
  let urgente = false

  if (etapa === 'agendada') {
    frase = `A prova será aplicada de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}. Antes disso, confira a lista de alunos e imprima o material.`
    botao = { rotulo: 'Imprimir material da turma', para: `/imprimir/material/${caderno.id}/${turma.id}` }
  } else if (progresso.status === 'concluido') {
    frase = 'Pronto! Veja como foi a turma.'
    detalhe = lancamento?.concluidoEm ? `Lançamento concluído em ${dataLonga(lancamento.concluidoEm)}.` : null
    botao = { rotulo: 'Ver resultados', para: `${base}/resultados/${caderno.id}/${turma.id}` }
  } else if (alunos.length > 0 && progresso.lancados === alunos.length) {
    frase = `Todos os ${alunos.length} alunos foram lançados. Confira e conclua o lançamento.`
    detalhe = descreverPrazo(avaliacao.prazoLancamento)
    botao = { rotulo: 'Concluir lançamento', para: lancar }
  } else if (etapa === 'aplicacao' && progresso.status === 'nao_iniciado') {
    frase = `Semana da prova: de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}. Depois de aplicar, lance as respostas.`
    detalhe = descreverPrazo(avaliacao.prazoLancamento)
    botao = { rotulo: 'Lançar respostas', para: lancar }
  } else if (progresso.status === 'nao_iniciado') {
    frase = `Lance as respostas do ${turmaNome(turma)}. ${descreverPrazo(avaliacao.prazoLancamento)}.`
    detalhe = `0 de ${plural(alunos.length, 'aluno lançado', 'alunos lançados')}.`
    botao = { rotulo: 'Começar', para: lancar }
    urgente = dias >= 0 && dias <= 3
  } else {
    const parado = alunos.find((a) => !respostaCompleta(caderno, lancamento?.respostas[a.id]))
    const marcas = parado ? lancamento?.respostas[parado.id]?.marcas : undefined
    const questao = marcas ? caderno.questoes.findIndex((q, i) => !q.anulada && marcaEm(marcas, i) === VAZIO) : -1
    frase = parado
      ? marcas && questao >= 0
        ? `Você parou no aluno nº ${parado.numero}, na questão ${questao + 1}.`
        : `O próximo é o aluno nº ${parado.numero}.`
      : 'Continue o lançamento.'
    detalhe = `${progresso.lancados} de ${plural(alunos.length, 'aluno lançado', 'alunos lançados')}. ${descreverPrazo(avaliacao.prazoLancamento)}.`
    botao = { rotulo: 'Continuar de onde parei', para: lancar }
    urgente = dias >= 0 && dias <= 3
  }

  return (
    <div className={`proximo-passo ${urgente ? 'urgente' : ''}`}>
      <p className="sobretitulo">O que fazer agora</p>
      <p className="proximo-passo-frase">{frase}</p>
      {detalhe && <p className="proximo-passo-detalhe">{detalhe}</p>}
      {botao && (
        <Link className="btn btn-primario btn-grande" to={botao.para}>
          {botao.rotulo} <ArrowRight size={18} aria-hidden />
        </Link>
      )}
      <p className="texto-2 pequeno proximo-passo-datas">{datas}</p>
    </div>
  )
}
