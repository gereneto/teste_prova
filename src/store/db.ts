import { produce, type Draft } from 'immer'
import { useSyncExternalStore } from 'react'
import { gerarDadosExemplo, VERSAO_DADOS } from '../data/seed'
import type { PainelRede } from '../lib/rede'
import { dbVazio } from '../plataforma/carga'
import { usePlataforma } from '../plataforma/estado'
import { chave, PLATAFORMA } from '../plataforma/modo'
import type { Db } from '../types'
import { apagarTodosPdfs } from './arquivos'

// Os dados que as telas leem e as ações mudam (acoes.ts). As telas não sabem de onde eles vêm:
// - na demonstração, tudo fica no localStorage do navegador, com os dados fictícios;
// - na plataforma, os dados vêm do banco (plataforma/servidor.ts), só o que a pessoa pode ver. As ações mudam
//   estes dados na hora e mandam a mudança ao banco; depois, a carga do banco substitui tudo.

const CHAVE = chave('dados')
const ESPERA_GRAVACAO_MS = 400

const ouvintes = new Set<() => void>()
const ouvintesSalvando = new Set<() => void>()
let estado: Db = PLATAFORMA ? dbVazio() : carregar()
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
  if (PLATAFORMA) return // na plataforma quem guarda é o banco (e a fila do lançamento)
  definirSalvando(true)
  if (gravacaoPendente) clearTimeout(gravacaoPendente)
  gravacaoPendente = setTimeout(gravarAgora, ESPERA_GRAVACAO_MS)
}

if (typeof window !== 'undefined' && !PLATAFORMA) {
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

/** Há gravação em andamento? Na plataforma: funções do banco em andamento ou respostas na fila do lançamento. */
export function useSalvando(): boolean {
  const plataforma = usePlataforma()
  const local = useSyncExternalStore(
    (fn) => {
      ouvintesSalvando.add(fn)
      return () => {
        ouvintesSalvando.delete(fn)
      }
    },
    () => salvando,
  )
  if (!PLATAFORMA) return local
  return plataforma.ocupado > 0 || plataforma.fila.enviando || plataforma.fila.pendentes > 0
}

export function atualizar(receita: (rascunho: Draft<Db>) => void) {
  estado = produce(estado, receita)
  notificar()
  agendarGravacao()
}

/** O painel da rede que o banco manda à Solar (na plataforma). Na demonstração não há: as telas calculam. */
export function usePainelDoServidor(): PainelRede | null {
  const plataforma = usePlataforma()
  return PLATAFORMA ? plataforma.painel : null
}

export function substituirDados(novo: Db) {
  estado = novo
  notificar()
  gravarAgora()
}

/** Os dados que vieram do banco (plataforma): substituem tudo, sem gravar no navegador. */
export function trocarDados(novo: Db) {
  estado = novo
  notificar()
}
