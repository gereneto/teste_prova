// Os alunos aparecem no site só pelas iniciais e pelo número de chamada.

/** Partículas que não entram nas iniciais: "Ana da Silva" vira AS. */
const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

const semAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "Ana Clara de Souza" → "ACS" (usado para gerar os dados fictícios). */
export function iniciaisDoNome(nome: string): string {
  const letras = semAcentos(nome)
    .split(/[\s'-]+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .map((parte) => parte.match(/[a-z]/i)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean)
  return letras.join('')
}

/** O que a pessoa digita vira maiúsculas, só com as letras, sem pontos: "acs" ou "a.c.s." → "ACS" */
export function formatarIniciais(texto: string): string {
  return semAcentos(texto).toUpperCase().replace(/[^A-Z]/g, '')
}

/** Iniciais que aparecem mais de uma vez na lista. */
export function iniciaisRepetidas(lista: { iniciais: string }[]): Set<string> {
  const vistas = new Set<string>()
  const repetidas = new Set<string>()
  for (const { iniciais } of lista) {
    if (!iniciais) continue
    if (vistas.has(iniciais)) repetidas.add(iniciais)
    vistas.add(iniciais)
  }
  return repetidas
}

/** Como o aluno aparece em listas e títulos: "Nº 7 · ACS" */
export const identificacao = (aluno: { numero: string; iniciais: string }) => `Nº ${aluno.numero || '—'} · ${aluno.iniciais || 'sem iniciais'}`

/** Como o aluno aparece no meio de uma frase, depois de "o": "o nº 7 (ACS)", "o aluno ACS". */
export function alunoEmTexto(aluno: { numero: string; iniciais: string }): string {
  if (aluno.numero) return `nº ${aluno.numero}${aluno.iniciais ? ` (${aluno.iniciais})` : ''}`
  return aluno.iniciais ? `aluno ${aluno.iniciais}` : 'aluno sem número nem iniciais'
}
