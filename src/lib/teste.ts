import { PESSOAS_DE_TESTE } from '../data/seed'
import type { Colegio, Coordenador, Db, MembroSolar, Perfil, Professor } from '../types'
import { equipeDoColegio, responsavelSolar, turmasDoProfessor } from './consultas'

export interface PessoasDeTeste {
  colegio: Colegio | null
  professor: Professor | null
  coordenador: Coordenador | null
  membro: MembroSolar | null
}

/**
 * As pessoas fixas da versão de teste. Se alguma foi desativada ou removida durante o teste,
 * entra outra do mesmo colégio no lugar.
 */
export function pessoasDeTeste(db: Db): PessoasDeTeste {
  const colegio = db.colegios.find((c) => c.id === PESSOAS_DE_TESTE.colegioId) ?? db.colegios[0] ?? null
  const professores = db.professores.filter((p) => p.colegioId === colegio?.id && p.ativo)
  const professor =
    professores.find((p) => p.id === PESSOAS_DE_TESTE.professorId) ?? professores.find((p) => turmasDoProfessor(db, p.id).length > 0) ?? null
  const equipe = colegio ? equipeDoColegio(db, colegio.id) : []
  const coordenador = equipe.find((c) => c.id === PESSOAS_DE_TESTE.coordenadorId) ?? equipe[0] ?? null
  const membro = db.equipeSolar.find((m) => m.id === PESSOAS_DE_TESTE.membroSolarId) ?? responsavelSolar(db) ?? db.equipeSolar[0] ?? null
  return { colegio, professor, coordenador, membro }
}

export function perfilDeTeste(db: Db, papel: Perfil['papel']): Perfil | null {
  const { colegio, professor, coordenador, membro } = pessoasDeTeste(db)
  if (papel === 'professor') return colegio && professor ? { papel, colegioId: colegio.id, professorId: professor.id } : null
  if (papel === 'coordenacao') return colegio && coordenador ? { papel, colegioId: colegio.id, coordenadorId: coordenador.id } : null
  return membro ? { papel, membroId: membro.id } : null
}
