// Os alunos aparecem no site só pelas iniciais e pelo número de chamada.
// O nome completo pode ser colado na tela de cadastro, mas é convertido antes de salvar.

/** Partículas que não entram nas iniciais: "Ana da Silva" vira A.S. */
const PARTICULAS = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])

const semAcentos = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '')

/** "Ana Clara de Souza" → "A.C.S." */
export function iniciaisDoNome(nome: string): string {
  const letras = semAcentos(nome)
    .split(/[\s'-]+/)
    .filter((parte) => parte && !PARTICULAS.has(parte.toLowerCase()))
    .map((parte) => parte.match(/[a-z]/i)?.[0]?.toUpperCase() ?? '')
    .filter(Boolean)
  return letras.length ? `${letras.join('.')}.` : ''
}

/** Aceita "acs", "A C S" ou "A.C.S." e devolve "A.C.S."; null se não forem só iniciais. */
export function normalizarIniciais(texto: string): string | null {
  const limpo = semAcentos(texto).toUpperCase().replace(/[.\s]/g, '')
  if (!/^[A-Z]{1,6}$/.test(limpo)) return null
  return `${limpo.split('').join('.')}.`
}

/** Um texto com espaço entre palavras de duas letras ou mais parece um nome, não iniciais. */
export const pareceNome = (texto: string) => /\p{L}{2,}\s+\p{L}{2,}/u.test(texto.trim())

/** Iniciais que aparecem mais de uma vez na lista. */
export function iniciaisRepetidas(lista: { iniciais: string }[]): Set<string> {
  const vistas = new Set<string>()
  const repetidas = new Set<string>()
  for (const { iniciais } of lista) {
    if (vistas.has(iniciais)) repetidas.add(iniciais)
    vistas.add(iniciais)
  }
  return repetidas
}

/** Como o aluno aparece em listas e títulos: "Nº 7 · A.C.S." */
export const identificacao = (aluno: { numero: number; iniciais: string }) => `Nº ${aluno.numero} · ${aluno.iniciais}`

/** Como o aluno aparece no meio de uma frase: "o nº 7 (A.C.S.)". */
export const alunoEmTexto = (aluno: { numero: number; iniciais: string }) => `nº ${aluno.numero} (${aluno.iniciais})`
