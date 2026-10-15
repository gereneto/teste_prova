import type { Aluno, Evento, MotivoSaida, Sexo, TipoMudancaAluno } from '../types'
import { listaEmTexto, plural } from './formato'
import { alunoEmTexto } from './iniciais'

export const NOMES_MOTIVO: Record<MotivoSaida, string> = {
  transferencia: 'Foi para outra escola',
  mudou_de_cidade: 'Mudou de cidade',
  concluiu: 'Concluiu o Fundamental I',
  outro: 'Outro motivo',
}

export const NOMES_SEXO: Record<Sexo, string> = { F: 'Feminino', M: 'Masculino' }

/**
 * Ordem da chamada. O número é livre (cada colégio usa o seu código), então a comparação entende
 * números dentro do texto: "2" vem antes de "10", "3A-2" antes de "3A-10". Quem está sem número vai para o fim.
 */
export function compararChamada(a: string, b: string): number {
  if (!a || !b) return Number(!a) - Number(!b)
  return a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
}

export const ordenarPorChamada = <T extends { numero: string }>(lista: T[]) => [...lista].sort((a, b) => compararChamada(a.numero, b.numero))

export type CampoAluno = 'numero' | 'iniciais' | 'sexo' | 'anoIngresso'

const SEM: Record<CampoAluno, string> = {
  numero: 'sem número',
  iniciais: 'sem iniciais',
  sexo: 'sem sexo',
  anoIngresso: 'sem ano de entrada',
}

/** Os campos que ficaram em branco no cadastro do aluno. */
export function camposFaltando(aluno: Pick<Aluno, CampoAluno>): CampoAluno[] {
  const faltando: CampoAluno[] = []
  if (!aluno.numero) faltando.push('numero')
  if (!aluno.iniciais) faltando.push('iniciais')
  if (!aluno.sexo) faltando.push('sexo')
  if (aluno.anoIngresso == null) faltando.push('anoIngresso')
  return faltando
}

/** "3 alunos com dados faltando: 2 sem sexo e 1 sem ano de entrada", ou null se estiver tudo preenchido. */
export function descreverFaltando(alunos: Pick<Aluno, CampoAluno>[]): string | null {
  const incompletos = alunos.filter((a) => camposFaltando(a).length)
  if (!incompletos.length) return null
  const porCampo = (Object.keys(SEM) as CampoAluno[])
    .map((campo) => [campo, incompletos.filter((a) => camposFaltando(a).includes(campo)).length] as const)
    .filter(([, n]) => n > 0)
    .map(([campo, n]) => `${n} ${SEM[campo]}`)
  return `${plural(incompletos.length, 'aluno com dados faltando', 'alunos com dados faltando')}: ${listaEmTexto(porCampo)}`
}

const NOMES_CAMPO: Record<CampoAluno, string> = { numero: 'número', iniciais: 'iniciais', sexo: 'sexo', anoIngresso: 'ano de entrada' }

/** O valor de um campo como aparece no histórico: "em branco" quando vazio. */
export function valorDoCampo(aluno: Pick<Aluno, CampoAluno>, campo: CampoAluno): string {
  const valor = aluno[campo]
  return valor == null || valor === '' ? 'em branco' : String(valor)
}

/** As frases do histórico e dos avisos à coordenação sobre mudanças na lista de alunos. */
export function textoMudancaAluno(
  tipo: TipoMudancaAluno,
  aluno: Pick<Aluno, CampoAluno>,
  extra: { campos?: Evento['campos']; motivo?: MotivoSaida; texto?: string } = {},
): string {
  const quem = alunoEmTexto(aluno)
  if (tipo === 'inclusao') {
    const detalhes = [aluno.sexo && `sexo ${aluno.sexo === 'F' ? 'feminino' : 'masculino'}`, aluno.anoIngresso && `entrou no colégio em ${aluno.anoIngresso}`]
    const preenchidos = detalhes.filter(Boolean) as string[]
    return `Incluiu o ${quem} na lista${preenchidos.length ? `: ${listaEmTexto(preenchidos)}` : ''}.`
  }
  if (tipo === 'correcao') {
    const mudancas = Object.entries(extra.campos ?? {}).map(([campo, { de, para }]) => `${NOMES_CAMPO[campo as CampoAluno]} de ${de} para ${para}`)
    return `Corrigiu o ${quem}: ${listaEmTexto(mudancas)}.`
  }
  if (tipo === 'saida') return `Tirou o ${quem} da lista: ${NOMES_MOTIVO[extra.motivo ?? 'outro'].toLowerCase()}.`
  if (tipo === 'volta') return `Pôs o ${quem} de volta na lista.`
  if (tipo === 'exclusao') return `Excluiu o cadastro do ${quem}, feito por engano.`
  return extra.texto ?? ''
}
