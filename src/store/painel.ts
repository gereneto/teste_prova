import { useMemo } from 'react'
import { painelDosDados, type AgregadoTurma, type CadastroTurma, type PainelRede } from '../lib/rede'
import type { Caderno, Db, Id } from '../types'
import { useDb, usePainelDoServidor } from './db'

/** O painel da rede com os atalhos que as telas da Solar usam. */
export interface Rede {
  painel: PainelRede
  cadernoDe: (id: Id) => Caderno | undefined
  /** A soma de uma turma numa prova. */
  agDe: (cadernoId: Id, turmaId: Id) => AgregadoTurma | undefined
  cadastroDe: (turmaId: Id) => CadastroTurma | undefined
  colegioDaTurma: (turmaId: Id) => Id | undefined
}

export function vistaDaRede(db: Db, painel: PainelRede): Rede {
  const cadernos = new Map(db.cadernos.map((c) => [c.id, c]))
  const ags = new Map(painel.turmas.map((ag) => [`${ag.caderno}__${ag.turma}`, ag]))
  const cadastros = new Map(painel.cadastros.map((c) => [c.turma, c]))
  const turmas = new Map(db.turmas.map((t) => [t.id, t.colegioId]))
  return {
    painel,
    cadernoDe: (id) => cadernos.get(id),
    agDe: (cadernoId, turmaId) => ags.get(`${cadernoId}__${turmaId}`),
    cadastroDe: (turmaId) => cadastros.get(turmaId),
    colegioDaTurma: (turmaId) => turmas.get(turmaId),
  }
}

/**
 * Os números da Solar, somados por turma e prova. Na plataforma, vêm prontos do banco (prova.painel_rede), porque a
 * Solar não recebe aluno a aluno; na demonstração, saem dos dados do navegador, com as mesmas contas.
 */
export function useRede(): Rede {
  const db = useDb()
  const doServidor = usePainelDoServidor()
  return useMemo(() => vistaDaRede(db, doServidor ?? painelDosDados(db)), [db, doServidor])
}
