import { baixarBlob } from '../store/arquivos'

type Celula = string | number | null | undefined

function formatarCelula(valor: Celula): string {
  if (valor == null) return ''
  // Excel em português usa vírgula como separador decimal.
  if (typeof valor === 'number') return String(Math.round(valor * 10) / 10).replace('.', ',')
  return `"${valor.replace(/"/g, '""')}"`
}

/**
 * CSV com ponto e vírgula e BOM: abre direto no Excel em português, com acentos. O aviso, se houver,
 * vai na primeira linha (por exemplo, que a planilha tem dados de alunos ou compara turmas).
 */
export function baixarCsv(nomeArquivo: string, cabecalho: string[], linhas: Celula[][], aviso?: string) {
  const conteudo = [...(aviso ? [[aviso]] : []), cabecalho, ...linhas].map((linha) => linha.map(formatarCelula).join(';')).join('\r\n')
  baixarBlob(new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8' }), nomeArquivo)
}

export const AVISO_COMPARACAO =
  'Esta planilha compara turmas. Use para descobrir onde o colégio pode se ajudar, não para classificar professores. Não divulgue em mural nem em grupo de mensagens.'

/** "Avaliação anual 2026 — 3º ano" → "avaliacao-anual-2026-3o-ano" */
export function paraNomeDeArquivo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/º/g, 'o')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
