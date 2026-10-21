// O título e o nome do PDF da prova que a coordenação baixa. O leitor de PDF mostra na aba o título gravado dentro do
// arquivo (o /Title do dicionário Info), que vem de quem gerou o PDF e pode estar errado (2026-10-21: as provas de
// Português chegaram com "Prova Solar de Matemática 1º ano"). Por isso o site acerta o título na hora de baixar, por
// uma atualização incremental: os bytes do arquivo ficam como estão e o dicionário novo vai no fim, como faz um editor
// de PDF ao salvar. Arquivo com estrutura que não reconhecemos, ou protegido, sai igual.

import type { Caderno } from '../types'

/** "Prova Solar de Língua Portuguesa 1º ano": o título dentro do PDF. */
export const tituloDaProva = (caderno: Pick<Caderno, 'disciplina' | 'serie'>) =>
  `Prova Solar de ${caderno.disciplina === 'Português' ? 'Língua Portuguesa' : caderno.disciplina} ${caderno.serie}º ano`

/** "Prova Solar de Lingua Portuguesa 1o ano.pdf": o nome do arquivo, sem acentos (alguns navegadores estragam os acentos). */
export const nomeDoPdf = (caderno: Pick<Caderno, 'disciplina' | 'serie'>) =>
  `${tituloDaProva(caderno).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/º/g, 'o')}.pdf`

/** Até onde procurar o fim da tabela de referências (o trailer) depois do começo dela. */
const LIMITE_TABELA = 16 * 1024 * 1024

/** Bytes como texto, um caractere por byte (as posições no texto são as posições no arquivo). */
function comoTexto(bytes: Uint8Array): string {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return texto
}

const comoBytes = (texto: string) => Uint8Array.from(texto, (c) => c.charCodeAt(0) & 0xff)

/** O dicionário "<< ... >>" que começa em `inicio`, com os aninhados e as strings dentro; null se não fechar. */
function dicionario(texto: string, inicio: number): string | null {
  if (texto.slice(inicio, inicio + 2) !== '<<') return null
  let nivel = 0
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i]
    if (c === '(') {
      // String literal: parênteses equilibrados, com "\" escapando o caractere seguinte.
      let dentro = 1
      for (i++; i < texto.length && dentro > 0; i++) {
        if (texto[i] === '\\') i++
        else if (texto[i] === '(') dentro++
        else if (texto[i] === ')') dentro--
      }
      i--
    } else if (c === '<' && texto[i + 1] === '<') {
      nivel++
      i++
    } else if (c === '>' && texto[i + 1] === '>') {
      nivel--
      i++
      if (nivel === 0) return texto.slice(inicio, i + 1)
    }
  }
  return null
}

/** Texto do PDF em UTF-16 com BOM, em hexadecimal: aceita acentos e "º". */
function textoPdf(texto: string): string {
  let hex = 'FEFF'
  for (let i = 0; i < texto.length; i++) hex += texto.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0')
  return `<${hex}>`
}

const dois = (n: number) => String(n).padStart(2, '0')
const dataPdf = (d: Date) =>
  `(D:${d.getFullYear()}${dois(d.getMonth() + 1)}${dois(d.getDate())}${dois(d.getHours())}${dois(d.getMinutes())}${dois(d.getSeconds())})`

/** O PDF com o título trocado (atualização incremental no fim do arquivo); se não der, o próprio PDF. */
export function comTitulo(pdf: Uint8Array<ArrayBuffer>, titulo: string, agora = new Date()): Uint8Array<ArrayBuffer> {
  const fim = comoTexto(pdf.subarray(Math.max(0, pdf.length - 2048)))
  const ultimo = /startxref\s+(\d+)\s+%%EOF\s*$/.exec(fim)
  if (!ultimo) return pdf
  const anterior = Number(ultimo[1])
  if (!(anterior > 0 && anterior < pdf.length)) return pdf

  // A última tabela de referências: a clássica ("xref" ... "trailer << >>") ou um objeto /Type /XRef.
  const tabela = comoTexto(pdf.subarray(anterior, Math.min(pdf.length, anterior + LIMITE_TABELA)))
  let trailer: string | null = null
  let fluxo = false
  if (/^\s*xref\s/.test(tabela)) {
    const t = tabela.indexOf('trailer')
    trailer = t < 0 ? null : dicionario(tabela, tabela.indexOf('<<', t))
  } else if (/^\s*\d+\s+\d+\s+obj\s*<</.test(tabela)) {
    trailer = dicionario(tabela, tabela.indexOf('<<'))
    fluxo = !!trailer && /\/Type\s*\/XRef\b/.test(trailer)
    if (!fluxo) trailer = null
  }
  if (!trailer || /\/Encrypt\b/.test(trailer)) return pdf
  const raiz = /\/Root\s+(\d+\s+\d+\s+R)/.exec(trailer)?.[1]
  const tamanho = Number(/\/Size\s+(\d+)/.exec(trailer)?.[1])
  if (!raiz || !(tamanho > 0)) return pdf
  const id = /\/ID\s*(\[[^\]]*\])/.exec(trailer)?.[1]

  const n = tamanho
  const separa = pdf[pdf.length - 1] === 0x0a || pdf[pdf.length - 1] === 0x0d ? '' : '\n'
  const posInfo = pdf.length + separa.length
  let novo = `${separa}${n} 0 obj\n<< /Title ${textoPdf(titulo)} /ModDate ${dataPdf(agora)} >>\nendobj\n`
  const comuns = `/Root ${raiz} /Info ${n} 0 R /Prev ${anterior}${id ? ` /ID ${id}` : ''}`
  if (!fluxo) {
    const posTabela = pdf.length + novo.length
    novo +=
      `xref\n${n} 1\n${String(posInfo).padStart(10, '0')} 00000 n\r\n` +
      `trailer\n<< /Size ${n + 1} ${comuns} >>\nstartxref\n${posTabela}\n%%EOF\n`
  } else {
    // Tabela em fluxo (PDF 1.5 em diante): a atualização também é um fluxo, sem compressão, com duas entradas de 7 bytes.
    const posTabela = pdf.length + novo.length
    const entrada = (pos: number) => String.fromCharCode(1, (pos >>> 24) & 0xff, (pos >>> 16) & 0xff, (pos >>> 8) & 0xff, pos & 0xff, 0, 0)
    const dados = entrada(posInfo) + entrada(posTabela)
    novo +=
      `${n + 1} 0 obj\n<< /Type /XRef /Size ${n + 2} /Index [${n} 2] /W [1 4 2] ${comuns} /Length ${dados.length} >>\nstream\n` +
      `${dados}\nendstream\nendobj\nstartxref\n${posTabela}\n%%EOF\n`
  }
  const saida = new Uint8Array(pdf.length + novo.length)
  saida.set(pdf)
  saida.set(comoBytes(novo), pdf.length)
  return saida
}
