import type { Caderno, Id } from '../types'

// Os PDFs enviados ficam no IndexedDB do navegador (o localStorage não comporta arquivos).
const NOME_BANCO = 'prova-solar-arquivos'
const LOJA = 'pdfs'

function abrirBanco(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(NOME_BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA)
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

async function naLoja<T>(modo: IDBTransactionMode, operacao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrirBanco()
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(LOJA, modo)
    const pedido = operacao(transacao.objectStore(LOJA))
    transacao.oncomplete = () => {
      banco.close()
      resolve(pedido.result)
    }
    transacao.onerror = () => {
      banco.close()
      reject(transacao.error)
    }
  })
}

export const salvarPdf = (cadernoId: Id, arquivo: Blob) => naLoja('readwrite', (loja) => loja.put(arquivo, cadernoId))
export const lerPdf = (cadernoId: Id) => naLoja<Blob | undefined>('readonly', (loja) => loja.get(cadernoId))
export const apagarPdf = (cadernoId: Id) => naLoja('readwrite', (loja) => loja.delete(cadernoId))
export const apagarTodosPdfs = () => naLoja('readwrite', (loja) => loja.clear())

export function baixarBlob(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob)
  baixarUrl(url, nomeArquivo)
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

export function baixarUrl(url: string, nomeArquivo: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  link.remove()
}

/** Baixa o PDF da prova. Lança erro se o arquivo enviado não estiver neste navegador. */
export async function baixarPdfDoCaderno(caderno: Caderno) {
  const pdf = caderno.pdf
  if (!pdf) return
  if (pdf.origem === 'exemplo' && pdf.url) {
    baixarUrl(import.meta.env.BASE_URL + pdf.url, pdf.nome)
    return
  }
  const blob = await lerPdf(caderno.id)
  if (!blob) throw new Error('O PDF desta prova não está salvo neste navegador.')
  baixarBlob(blob, pdf.nome)
}
