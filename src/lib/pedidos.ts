import type { Db, MotivoSaida, Pedido } from '../types'
import { dataCurta, turmaNome } from './formato'

export const NOMES_MOTIVO: Record<MotivoSaida, string> = {
  transferencia: 'Foi para outra escola',
  mudou_de_cidade: 'Mudou de cidade',
  concluiu: 'Concluiu o Fundamental I',
  outro: 'Outro motivo',
}

/** "Inclusão do nº 17 (L.M.R.)", "Saída do nº 6 (A.B.)", "Correção do nº 5 (E.C.F.)" */
export function descreverPedido(db: Db, pedido: Pedido, comTurma = false): string {
  const aluno = db.alunos.find((a) => a.id === pedido.alunoId)
  const numero = pedido.tipo === 'incluir' ? pedido.numero : aluno?.numero
  const iniciais = pedido.tipo === 'incluir' ? pedido.iniciais : aluno?.iniciais
  const quem = numero != null ? `nº ${numero}${iniciais ? ` (${iniciais})` : ''}` : 'aluno'
  const tipo = { incluir: 'Inclusão', saida: 'Saída', correcao: 'Correção' }[pedido.tipo]
  const turma = comTurma ? db.turmas.find((t) => t.id === pedido.turmaId) : undefined
  return `${tipo} do ${quem}${turma ? ` · ${turmaNome(turma)}` : ''}`
}

/** O que muda, em palavras, para a coordenação decidir. */
export function detalharPedido(db: Db, pedido: Pedido): string[] {
  const aluno = db.alunos.find((a) => a.id === pedido.alunoId)
  if (pedido.tipo === 'incluir') {
    return [`Nº ${pedido.numero} · ${pedido.iniciais}`, `Entrou no colégio: ${pedido.anoIngresso ?? 'não sabe'}`]
  }
  if (pedido.tipo === 'saida') return [`Motivo: ${pedido.motivoSaida ? NOMES_MOTIVO[pedido.motivoSaida].toLowerCase() : 'não informado'}`]
  const linhas: string[] = []
  if (aluno && pedido.numero != null && pedido.numero !== aluno.numero) linhas.push(`Número: de ${aluno.numero} para ${pedido.numero}`)
  if (aluno && pedido.iniciais && pedido.iniciais !== aluno.iniciais) linhas.push(`Iniciais: de ${aluno.iniciais} para ${pedido.iniciais}`)
  if (aluno && pedido.anoIngresso !== undefined && pedido.anoIngresso !== aluno.anoIngresso) {
    linhas.push(`Entrou no colégio: de ${aluno.anoIngresso ?? 'não informado'} para ${pedido.anoIngresso ?? 'não informado'}`)
  }
  return linhas.length ? linhas : ['Os dados pedidos já são os da lista.']
}

export function situacaoDoPedido(pedido: Pedido): { texto: string; tom: 'ambar' | 'sucesso' | 'neutro' | 'perigo' } {
  if (pedido.situacao === 'pendente') return { texto: 'Aguardando a coordenação', tom: 'ambar' }
  if (pedido.situacao === 'aprovado') return { texto: `Aprovado${pedido.decisao ? ` em ${dataCurta(pedido.decisao.em)}` : ''}`, tom: 'sucesso' }
  if (pedido.situacao === 'recusado') return { texto: `Não aprovado${pedido.decisao ? ` em ${dataCurta(pedido.decisao.em)}` : ''}`, tom: 'perigo' }
  return { texto: 'Cancelado', tom: 'neutro' }
}
