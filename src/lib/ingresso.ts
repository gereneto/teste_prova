import type { Turma } from '../types'

/** Anos oferecidos para a entrada no colégio: do ano letivo até 12 anos antes (Educação Infantil incluída). */
export const ANOS_PARA_TRAS = 12

export const anosDeEntrada = (anoLetivo: number) => Array.from({ length: ANOS_PARA_TRAS + 1 }, (_, i) => anoLetivo - i)

/**
 * A conta que ajuda a conferir o ano de entrada: "entrou no 1º ano", "entrou na Educação Infantil".
 * Ano depois do ano letivo, ou antigo demais para a idade da turma, vira um aviso (sem bloquear).
 */
export function descreverEntrada(anoIngresso: number | null, turma: Pick<Turma, 'serie' | 'anoLetivo'>): { texto: string; problema: boolean } | null {
  if (anoIngresso == null) return null
  if (anoIngresso > turma.anoLetivo) return { texto: 'ano depois do ano letivo: confira', problema: true }
  const serie = turma.serie - (turma.anoLetivo - anoIngresso)
  if (serie === turma.serie) return { texto: 'novo no colégio', problema: false }
  if (serie >= 1) return { texto: `entrou no ${serie}º ano`, problema: false }
  if (serie >= -3) return { texto: 'entrou na Educação Infantil', problema: false }
  return { texto: 'ano antigo demais para a turma: confira', problema: true }
}
