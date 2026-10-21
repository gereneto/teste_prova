import { describe, expect, it } from 'vitest'
import { comTitulo, nomeDoPdf, tituloDaProva } from './pdf'

const texto = (bytes: Uint8Array) => Array.from(bytes, (b) => String.fromCharCode(b)).join('')
const bytes = (s: string) => new Uint8Array(Array.from(s, (c) => c.charCodeAt(0)))

/** Um PDF mínimo com tabela de referências clássica e título errado, com as posições certas. */
function pdfClassico(): Uint8Array<ArrayBuffer> {
  const objetos = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] >>',
    '<< /Title (Prova Solar de Matematica 1o ano) >>',
  ]
  let corpo = '%PDF-1.4\n'
  const posicoes: number[] = []
  objetos.forEach((o, i) => {
    posicoes.push(corpo.length)
    corpo += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const tabela = corpo.length
  corpo += `xref\n0 5\n0000000000 65535 f\r\n${posicoes.map((p) => `${String(p).padStart(10, '0')} 00000 n\r\n`).join('')}`
  corpo += `trailer\n<</Size 5\n/Root 1 0 R\n/Info 4 0 R>>\nstartxref\n${tabela}\n%%EOF\n`
  return bytes(corpo)
}

/** O objeto que a tabela de referências da última atualização aponta, e o que está lá. */
function ultimaAtualizacao(pdf: string) {
  const inicio = Number(/startxref\s+(\d+)\s+%%EOF\s*$/.exec(pdf)![1])
  return { inicio, aPartir: pdf.slice(inicio) }
}

describe('o PDF da prova', () => {
  it('tem o título e o nome da prova, o nome sem acentos', () => {
    expect(tituloDaProva({ disciplina: 'Português', serie: 1 })).toBe('Prova Solar de Língua Portuguesa 1º ano')
    expect(nomeDoPdf({ disciplina: 'Português', serie: 1 })).toBe('Prova Solar de Lingua Portuguesa 1o ano.pdf')
    expect(nomeDoPdf({ disciplina: 'Português', serie: 5 })).toBe('Prova Solar de Lingua Portuguesa 5o ano.pdf')
  })

  it('ganha o título novo no fim, sem mexer no que já estava no arquivo', () => {
    const original = pdfClassico()
    const saida = comTitulo(original, 'Prova Solar de Língua Portuguesa 1º ano', new Date(2026, 9, 21, 15, 30, 0))
    expect(saida.subarray(0, original.length)).toEqual(original)
    const t = texto(saida)
    const { aPartir } = ultimaAtualizacao(t)
    expect(aPartir).toMatch(/^xref\n5 1\n(\d{10}) 00000 n\r\ntrailer\n<< \/Size 6 \/Root 1 0 R \/Info 5 0 R \/Prev \d+ >>/)
    // A entrada da tabela aponta para o objeto 5, que tem o título em UTF-16 (com "í" e "º").
    const posInfo = Number(/^xref\n5 1\n(\d{10})/.exec(aPartir)![1])
    expect(t.slice(posInfo)).toMatch(/^5 0 obj\n<< \/Title <FEFF00500072006F00760061[0-9A-F]*00ED[0-9A-F]*00BA00200061006E006F> \/ModDate \(D:20261021153000\) >>/)
    // /Prev aponta para a tabela antiga.
    const prev = Number(/\/Prev (\d+)/.exec(aPartir)![1])
    expect(t.slice(prev, prev + 4)).toBe('xref')
  })

  it('com tabela em fluxo (PDF 1.5), a atualização também é um fluxo', () => {
    let corpo = '%PDF-1.5\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n'
    const tabela = corpo.length
    corpo += `9 0 obj\n<< /Type /XRef /Size 10 /W [1 4 2] /Root 1 0 R /ID [<AB><CD>] /Length 0 >>\nstream\n\nendstream\nendobj\nstartxref\n${tabela}\n%%EOF`
    const saida = texto(comTitulo(bytes(corpo), 'Título'))
    const { inicio, aPartir } = ultimaAtualizacao(saida)
    expect(aPartir).toMatch(/^11 0 obj\n<< \/Type \/XRef \/Size 12 \/Index \[10 2\] \/W \[1 4 2\] \/Root 1 0 R \/Info 10 0 R \/Prev \d+ \/ID \[<AB><CD>\] \/Length 14 >>\nstream\n/)
    const dados = aPartir.slice(aPartir.indexOf('stream\n') + 7).slice(0, 14)
    const pos = (k: number) => ((dados.charCodeAt(k + 1) << 24) | (dados.charCodeAt(k + 2) << 16) | (dados.charCodeAt(k + 3) << 8) | dados.charCodeAt(k + 4)) >>> 0
    expect(saida.slice(pos(0))).toMatch(/^10 0 obj\n<< \/Title /)
    expect(pos(7)).toBe(inicio)
    // O arquivo terminava sem quebra de linha: a atualização começa numa linha nova.
    expect(saida.slice(corpo.length, corpo.length + 1)).toBe('\n')
  })

  it('sai igual quando não reconhece o arquivo ou ele é protegido', () => {
    // O PDF do Ensaio da Prova não tem tabela de referências.
    const semTabela = bytes('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n')
    expect(comTitulo(semTabela, 'Título')).toBe(semTabela)
    const protegido = bytes(texto(pdfClassico()).replace('/Info 4 0 R>>', '/Info 4 0 R/Encrypt 4 0 R>>'))
    expect(comTitulo(protegido, 'Título')).toBe(protegido)
    expect(comTitulo(bytes('não é PDF'), 'Título')).toEqual(bytes('não é PDF'))
  })
})
