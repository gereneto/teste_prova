// Os alunos aparecem no site só pelas iniciais e pelo número de chamada.

/** Partículas que não entram nas iniciais: "Ana da Silva" vira A.S. */
const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

const semAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "Ana Clara de Souza" → "A.C.S." (usado para gerar os dados fictícios). */
export function iniciaisDoNome(nome: string): string {
  const letras = semAcentos(nome)
    .split(/[\s'-]+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .map((parte) => parte.match(/[a-z]/i)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean)
  return letras.length ? `${letras.join('.')}.` : ''
}

/** O que a pessoa digita vira maiúsculas, só com letras: "acs" ou "a.c.s" → "A.C.S." */
export function formatarIniciais(texto: string): string {
  const letras = semAcentos(texto).toUpperCase().replace(/[^A-Z]/g, '')
  return letras ? `${letras.split('').join('.')}.` : ''
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

/** Como o aluno aparece em listas e títulos: "Nº 7 · A.C.S." */
export const identificacao = (aluno: { numero: string; iniciais: string }) => `Nº ${aluno.numero || '—'} · ${aluno.iniciais || 'sem iniciais'}`

/** Como o aluno aparece no meio de uma frase, depois de "o": "o nº 7 (A.C.S.)", "o aluno A.C.S.". */
export function alunoEmTexto(aluno: { numero: string; iniciais: string }): string {
  if (aluno.numero) return `nº ${aluno.numero}${aluno.iniciais ? ` (${aluno.iniciais})` : ''}`
  return aluno.iniciais ? `aluno ${aluno.iniciais}` : 'aluno sem número nem iniciais'
}
