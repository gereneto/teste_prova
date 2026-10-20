// O estado da Prova na plataforma que as telas acompanham: em que fase está a entrada, quem é a pessoa, os
// perfis dela, o painel da rede (Solar), os avisos de gravação e a fila do lançamento. Sem nada do banco aqui
// (a demonstração importa este arquivo e não pode levar o supabase-js).

import { useSyncExternalStore } from 'react'
import type { PainelRede } from '../lib/rede'
import type { Id, Perfil } from '../types'

export type Fase = 'iniciando' | 'entrar' | 'carregando' | 'pronto' | 'sem_acesso' | 'erro'
export type TomAviso = 'perigo' | 'atencao' | 'sucesso' | 'info'

export interface AvisoGravacao {
  id: number
  tom: TomAviso
  texto: string
}

export interface EstadoPlataforma {
  fase: Fase
  erro: string | null
  /** 'producao' ou 'teste' (o ambiente pelo endereço). */
  ambiente: string | null
  eu: { id: Id; nome: string; email: string } | null
  perfis: Perfil[]
  painel: PainelRede | null
  avisos: AvisoGravacao[]
  /** Funções do banco em andamento. */
  ocupado: number
  fila: { pendentes: number; enviando: boolean; semRede: boolean }
}

let estado: EstadoPlataforma = {
  fase: 'iniciando',
  erro: null,
  ambiente: null,
  eu: null,
  perfis: [],
  painel: null,
  avisos: [],
  ocupado: 0,
  fila: { pendentes: 0, enviando: false, semRede: false },
}
const ouvintes = new Set<() => void>()

export const lerPlataforma = () => estado

export function mudarPlataforma(parcial: Partial<EstadoPlataforma>) {
  estado = { ...estado, ...parcial }
  ouvintes.forEach((fn) => fn())
}

export function usePlataforma(): EstadoPlataforma {
  return useSyncExternalStore(
    (fn) => {
      ouvintes.add(fn)
      return () => {
        ouvintes.delete(fn)
      }
    },
    () => estado,
  )
}

let proximo = 1

/** Um aviso no alto da tela. Os de sucesso e de informação somem sozinhos; os de erro ficam até fechar. */
export function avisar(tom: TomAviso, texto: string) {
  if (estado.avisos.some((a) => a.texto === texto)) return
  const id = proximo++
  mudarPlataforma({ avisos: [...estado.avisos, { id, tom, texto }].slice(-4) })
  if (tom === 'sucesso' || tom === 'info') setTimeout(() => dispensarAviso(id), 10_000)
}

export function dispensarAviso(id: number) {
  mudarPlataforma({ avisos: estado.avisos.filter((a) => a.id !== id) })
}
