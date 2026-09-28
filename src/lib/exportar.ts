import { baixarBlob } from '../store/arquivos'

type Celula = string | number | null | undefined

function formatarCelula(valor: Celula): string {
  if (valor == null) return ''
  // Excel em português usa vírgula como separador decimal.
  if (typeof valor === 'number') return String(Math.round(valor * 10) / 10).replace('.', ',')
  return `"${valor.replace(/"/g, '""')}"`
}

/** CSV com ponto e vírgula e BOM: abre direto no Excel em português, com acentos. */
export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][]) {
  const conteudo = [cabecalho, ...linhas].map((linha) => linha.map(formatarCelula).join(';')).join('\r\n')
  baixarBlob(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' }), nomeArquivo)
}

/** "Avaliação diagnóstica — 3º bimestre" → "avaliacao-diagnostica-3o-bimestre" */
export function paraNomeDeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/º/g, 'o')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
