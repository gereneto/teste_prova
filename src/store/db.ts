import { produce, type Draft } from 'immer'
import { useSyncExternalStore } from 'react'
import { gerarDadosExemplo, VERSAO_DADOS } from '../data/seed'
import type { Db } from '../types'
import { apagarTodosPdfs } from './arquivos'

// Nesta versão de teste, tudo fica no localStorage do navegador. Quando houver servidor,
// só este arquivo e acoes.ts precisam mudar: as telas continuam chamando as mesmas funções.

const CHAVE = 'prova-solar:dados'
const ESPERA_GRAVACAO_MS = 400

const ouvintes = new Set<() => void>()
const ouvintesSalvando = new Set<() => void>()
let estado: Db = carregar()
let salvando = false
let gravacaoPendente: ReturnType<typeof setTimeout> | null = null

function carregar(): Db {
  try {
    const bruto = localStorage.getItem(CHAVE)
    if (bruto) {
      const salvo = JSON.parse(bruto) as Db
      if (salvo.versao === VERSAO_DADOS) return salvo
      // Dados num formato antigo: voltam aos de exemplo, e os PDFs enviados para os cadernos antigos saem junto.
      const novo = gerarDadosExemplo()
      localStorage.setItem(CHAVE, JSON.stringify(novo))
      apagarTodosPdfs().catch(() => {})
      return novo
    }
  } catch {
    // Sem acesso ao localStorage (modo privado, cota cheia): segue só com os dados em memória.
  }
  return gerarDadosExemplo()
}

function notificar() {
  ouvintes.forEach((fn) => fn())
}

function definirSalvando(valor: boolean) {
  if (salvando === valor) return
  salvando = valor
  ouvintesSalvando.forEach((fn) => fn())
}

function gravarAgora() {
  if (gravacaoPendente) {
    clearTimeout(gravacaoPendente)
    gravacaoPendente = null
  }
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado))
  } catch {
    // Mantém em memória; na próxima alteração tenta de novo.
  }
  definirSalvando(false)
}

function agendarGravacao() {
  definirSalvando(true)
  if (gravacaoPendente) clearTimeout(gravacaoPendente)
  gravacaoPendente = setTimeout(gravarAgora, ESPERA_GRAVACAO_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', gravarAgora)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && gravacaoPendente) gravarAgora()
  })
  // Outra aba gravou (ex.: professor numa aba e Solar na outra): mostra os dados novos.
  window.addEventListener('storage', (evento) => {
    if (evento.key !== CHAVE || !evento.newValue) return
    try {
      const novo = JSON.parse(evento.newValue) as Db
      if (novo.versao === VERSAO_DADOS) {
        estado = novo
        notificar()
      }
    } catch {
      // Ignora gravações corrompidas de outra aba.
    }
  })
}

export const getDb = () => estado

function inscrever(fn: () => void) {
  ouvintes.add(fn)
  return () => {
    ouvintes.delete(fn)
  }
}

export function useDb(): Db {
  return useSyncExternalStore(inscrever, getDb)
}

export function useSalvando(): boolean {
  return useSyncExternalStore(
    (fn) => {
      ouvintesSalvando.add(fn)
      return () => {
        ouvintesSalvando.delete(fn)
      }
    },
    () => salvando,
  )
}

export function atualizar(receita: (rascunho: Draft<Db>) => void) {
  estado = produce(estado, receita)
  notificar()
  agendarGravacao()
}

export function substituirDados(novo: Db) {
  estado = novo
  notificar()
  gravarAgora()
}
