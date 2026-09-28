import { ChartColumn, ClipboardList, Download, Pencil, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { etapaAvaliacao } from '../lib/consultas'
import { progressoDe } from '../lib/estatisticas'
import { dataCurta } from '../lib/formato'
import { baixarPdfDoCaderno } from '../store/arquivos'
import { useDb } from '../store/db'
import type { Avaliacao, Caderno, Turma } from '../types'
import { Progresso, Selo, SeloStatus } from './ui'

export function descreverPeriodo(avaliacao: Avaliacao): string {
  const aplicacao = `Aplicação de ${dataCurta(avaliacao.aplicacaoInicio)} a ${dataCurta(avaliacao.aplicacaoFim)}`
  const etapa = etapaAvaliacao(avaliacao)
  if (etapa === 'encerrada') return `${aplicacao} · prazo de lançamento encerrado em ${dataCurta(avaliacao.prazoLancamento)}`
  return `${aplicacao} · lançamento até ${dataCurta(avaliacao.prazoLancamento)}`
}

/** Uma avaliação na lista de turmas do professor, com o andamento e os atalhos. */
export function LinhaAvaliacao(props: { avaliacao: Avaliacao; caderno: Caderno; turma: Turma; base: string }) {
  const { avaliacao, caderno, turma, base } = props
  const db = useDb()
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  const progresso = progressoDe(db, caderno, turma.id)
  const lancar = `${base}/lancar/${caderno.id}/${turma.id}`
  const resultados = `${base}/resultados/${caderno.id}/${turma.id}`

  async function baixar() {
    setErroPdf(null)
    try {
      await baixarPdfDoCaderno(caderno)
    } catch (erro) {
      setErroPdf(erro instanceof Error ? erro.message : 'Não foi possível baixar o PDF.')
    }
  }

  return (
    <li className="linha-avaliacao">
      <div className="linha-avaliacao-info">
        <div className="linha-avaliacao-titulo">
          {avaliacao.titulo} {etapaAvaliacao(avaliacao) === 'agendada' && <Selo tom="info">Agendada</Selo>}
        </div>
        <div className="texto-2 pequeno">{descreverPeriodo(avaliacao)}</div>
      </div>
      <div className="linha-avaliacao-status">
        <div className="linha-avaliacao-selo">
          <SeloStatus status={progresso.status} />
          <span className="texto-2 pequeno">
            {progresso.lancados} de {progresso.total} alunos
          </span>
        </div>
        <Progresso valor={progresso.lancados} total={progresso.total} rotulo="Alunos lançados" />
      </div>
      <div className="linha-avaliacao-acoes">
        {progresso.status === 'concluido' ? (
          <>
            <Link className="btn btn-primario" to={resultados}>
              <ChartColumn size={16} aria-hidden /> Ver resultados
            </Link>
            <Link className="btn" to={lancar}>
              <Pencil size={16} aria-hidden /> Corrigir lançamento
            </Link>
          </>
        ) : (
          <>
            <Link className="btn btn-primario" to={lancar}>
              <ClipboardList size={16} aria-hidden /> {progresso.status === 'em_andamento' ? 'Continuar lançamento' : 'Lançar respostas'}
            </Link>
            {progresso.lancados > 0 && (
              <Link className="btn" to={resultados}>
                <ChartColumn size={16} aria-hidden /> Resultados parciais
              </Link>
            )}
          </>
        )}
        {caderno.pdf ? (
          <button className="btn" onClick={baixar}>
            <Download size={16} aria-hidden /> Baixar prova
          </button>
        ) : (
          <span className="texto-2 pequeno">PDF da prova ainda não enviado pela Solar</span>
        )}
        {caderno.usaFolhaRespostas && (
          <Link className="btn" to={`/imprimir/folhas/${caderno.id}/${turma.id}`}>
            <Printer size={16} aria-hidden /> Folhas de respostas
          </Link>
        )}
      </div>
      {erroPdf && <p className="erro-campo">{erroPdf}</p>}
    </li>
  )
}
