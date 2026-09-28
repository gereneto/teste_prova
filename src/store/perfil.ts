import { useSyncExternalStore } from 'react'
import type { Perfil } from '../types'

// O perfil fica no sessionStorage: cada aba pode estar num papel diferente
// (ex.: professor numa aba e Solar na outra) e fechar a aba volta à pergunta inicial.
const CHAVE = 'prova-solar:perfil'
const ouvintes = new Set<() => void>()
let perfil: Perfil | null = ler()

function ler(): Perfil | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE)
    return bruto ? (JSON.parse(bruto) as Perfil) : null
  } catch {
    return null
  }
}

export function definirPerfil(novo: Perfil | null) {
  perfil = novo
  try {
    if (novo) sessionStorage.setItem(CHAVE, JSON.stringify(novo))
    else sessionStorage.removeItem(CHAVE)
  } catch {
    // Sem sessionStorage o perfil vale só até recarregar a página.
  }
  ouvintes.forEach((fn) => fn())
}

export function usePerfil(): Perfil | null {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => {
        ouvintes.delete(fn)
      }
    },
    () => perfil,
  )
}
