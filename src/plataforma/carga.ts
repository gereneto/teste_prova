// O que prova.carregar() devolve (tudo o que a pessoa da sessão vê, pelo RLS) e a conversão para o Db que
// as telas já usam. Pura: sem rede e sem banco, testada em carga.test.ts.

import { VERSAO_DADOS } from '../data/seed'
import { textoMudancaAluno } from '../lib/alunos'
import type {
  Aluno,
  Caderno,
  Coordenador,
  Db,
  Disciplina,
  Evento,
  Id,
  Lancamento,
  MembroSolar,
  MotivoSaida,
  PapelSolar,
  Perfil,
  Professor,
  Questao,
  Serie,
  Sexo,
  Situacao,
  TipoMudancaAluno,
  Turma,
  Turno,
} from '../types'

type Papel = 'professor' | 'coordenacao' | 'coordenacao_responsavel' | 'solar_visualizacao' | 'solar_edicao' | 'solar_responsavel'

export interface Carga {
  eu: Id | null
  anoLetivo: number
  pessoas: { id: Id; nome: string; email: string; telefone: string | null; ativo: boolean; entrou: boolean }[]
  vinculos: { pessoa: Id; colegio: Id | null; papel: Papel; ativo: boolean }[]
  colegios: { id: Id; nome: string; cidade: string | null; uf: string | null; ativo: boolean; cuidadoPor: Id | null }[]
  turmas: { id: Id; colegio: Id; anoLetivo: number; serie: Serie; nome: string; turno: Turno; professores: Id[] }[]
  alunos: { id: Id; colegio: Id; iniciais: string; sexo: Sexo | null; anoIngresso: number | null }[]
  matriculas: { aluno: Id; anoLetivo: number; turma: Id; numero: string; ativo: boolean; saidaEm: string | null; saidaMotivo: MotivoSaida | null }[]
  avaliacoes: { id: Id; titulo: string; anoLetivo: number; aplicacaoInicio: string; aplicacaoFim: string; prazoLancamento: string }[]
  cadernos: {
    id: Id
    avaliacao: Id
    serie: Serie
    disciplina: Disciplina
    numAlternativas: 4 | 5
    usaFolhaRespostas: boolean
    questoes: Questao[]
    pdfNome: string | null
    pdfTamanho: number | null
    pdfEnviadoEm: string | null
    conferidoPor: string | null
    conferidoEm: string | null
  }[]
  lancamentos: { caderno: Id; turma: Id; concluidoEm: string | null }[]
  respostas: { caderno: Id; turma: Id; aluno: Id; situacao: Situacao; marcas: string; numero: string; atualizadoEm: string }[]
  historico: {
    id: Id
    em: string
    por: string
    colegio: Id | null
    turma: Id | null
    caderno: Id | null
    texto: string | null
    aluno: Id | null
    tipo: TipoMudancaAluno | null
    campos: Evento['campos'] | null
    motivo: MotivoSaida | null
    retrato: { numero: string; iniciais: string; sexo: Sexo | null; anoIngresso: number | null } | null
    avisarTurmas: boolean
    avisarCoordenacao: boolean
    cientePor: string | null
    cienteEm: string | null
  }[]
}

const dois = (n: number) => String(n).padStart(2, '0')

/** Data e hora do banco (com fuso) como a Prova guarda: a hora local, sem fuso ("2026-10-19T21:37:08"). */
export function horaLocal(valor: string | null | undefined): string {
  if (!valor) return ''
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return valor
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}:${dois(d.getSeconds())}`
}

export const chaveResposta = (caderno: Id, turma: Id, aluno: Id) => `${caderno}__${turma}__${aluno}`

const PAPEL_SOLAR: Partial<Record<Papel, PapelSolar>> = {
  solar_responsavel: 'responsavel',
  solar_edicao: 'edicao',
  solar_visualizacao: 'visualizacao',
}

export interface Convertida {
  db: Db
  eu: { id: Id; nome: string; email: string } | null
  /** Os papéis da pessoa da sessão: Solar primeiro, depois a coordenação de cada colégio, depois professor. */
  perfis: Perfil[]
  /** A hora do banco de cada resposta (para avisar quando outra pessoa mudou o mesmo aluno). */
  bases: Map<string, string>
}

export function converterCarga(c: Carga): Convertida {
  const pessoas = new Map(c.pessoas.map((p) => [p.id, p]))
  const colegiosAtivos = new Set(c.colegios.filter((x) => x.ativo).map((x) => x.id))
  const ativosDe = (papeis: Papel[]) =>
    c.vinculos.filter((v) => v.ativo && papeis.includes(v.papel) && pessoas.get(v.pessoa)?.ativo && (!v.colegio || colegiosAtivos.has(v.colegio)))

  const coordenadores: Coordenador[] = []
  for (const v of ativosDe(['coordenacao_responsavel', 'coordenacao'])) {
    if (coordenadores.some((x) => x.id === v.pessoa && x.colegioId === v.colegio)) continue
    const p = pessoas.get(v.pessoa)!
    coordenadores.push({ id: p.id, colegioId: v.colegio!, nome: p.nome, email: p.email, telefone: p.telefone ?? '', responsavel: v.papel === 'coordenacao_responsavel', token: '' })
  }

  const professores: Professor[] = []
  for (const v of c.vinculos.filter((x) => x.papel === 'professor' && x.colegio)) {
    const p = pessoas.get(v.pessoa)
    if (!p || professores.some((x) => x.id === p.id && x.colegioId === v.colegio)) continue
    professores.push({ id: p.id, colegioId: v.colegio!, nome: p.nome, email: p.email, ativo: v.ativo && p.ativo && colegiosAtivos.has(v.colegio!), token: '' })
  }

  const equipeSolar: MembroSolar[] = ativosDe(['solar_responsavel', 'solar_edicao', 'solar_visualizacao']).map((v) => {
    const p = pessoas.get(v.pessoa)!
    return { id: p.id, nome: p.nome, email: p.email, telefone: p.telefone ?? '', papel: PAPEL_SOLAR[v.papel]!, token: '' }
  })

  const turmas: Turma[] = c.turmas.map((t) => ({
    id: t.id,
    colegioId: t.colegio,
    anoLetivo: t.anoLetivo,
    serie: t.serie,
    nome: t.nome,
    turno: t.turno,
    professorIds: t.professores ?? [],
  }))

  // O aluno da Prova é o do colégio com a matrícula mais recente (a turma de hoje, ou a última que teve).
  const matriculas = new Map<Id, Carga['matriculas']>()
  for (const m of c.matriculas) matriculas.set(m.aluno, [...(matriculas.get(m.aluno) ?? []), m])
  const alunos: Aluno[] = []
  for (const a of c.alunos) {
    const m = (matriculas.get(a.id) ?? []).sort((x, y) => y.anoLetivo - x.anoLetivo)[0]
    if (!m) continue
    alunos.push({
      id: a.id,
      turmaId: m.turma,
      numero: m.numero,
      iniciais: a.iniciais,
      sexo: a.sexo,
      anoIngresso: a.anoIngresso,
      ativo: m.ativo,
      ...(m.ativo || !m.saidaEm ? {} : { saida: { em: m.saidaEm, motivo: m.saidaMotivo ?? 'outro' } }),
    })
  }

  const cadernos: Caderno[] = c.cadernos.map((x) => ({
    id: x.id,
    avaliacaoId: x.avaliacao,
    serie: x.serie,
    disciplina: x.disciplina,
    numAlternativas: x.numAlternativas,
    usaFolhaRespostas: x.usaFolhaRespostas,
    questoes: x.questoes,
    pdf: x.pdfNome ? { nome: x.pdfNome, tamanho: x.pdfTamanho ?? 0, origem: 'enviado', enviadoEm: horaLocal(x.pdfEnviadoEm) } : null,
    conferencia: x.conferidoEm ? { por: x.conferidoPor ?? '', em: horaLocal(x.conferidoEm) } : null,
  }))

  const lancamentos = new Map<string, Lancamento>()
  const lancamentoDe = (caderno: Id, turma: Id) => {
    const id = `${caderno}__${turma}`
    let l = lancamentos.get(id)
    if (!l) lancamentos.set(id, (l = { id, cadernoId: caderno, turmaId: turma, respostas: {}, concluidoEm: null }))
    return l
  }
  for (const l of c.lancamentos) lancamentoDe(l.caderno, l.turma).concluidoEm = l.concluidoEm ? horaLocal(l.concluidoEm) : null
  const bases = new Map<string, string>()
  for (const r of c.respostas) {
    lancamentoDe(r.caderno, r.turma).respostas[r.aluno] = { situacao: r.situacao, marcas: r.marcas, atualizadoEm: horaLocal(r.atualizadoEm), numero: r.numero }
    bases.set(chaveResposta(r.caderno, r.turma, r.aluno), r.atualizadoEm)
  }

  const historico: Evento[] = c.historico.map((h) => ({
    id: h.id,
    em: horaLocal(h.em),
    por: h.por,
    colegioId: h.colegio,
    turmaId: h.turma,
    cadernoId: h.caderno,
    // As mudanças na lista de alunos vêm sem frase: a frase sai do tipo, dos campos e do retrato do aluno.
    texto: h.texto ?? (h.tipo && h.retrato ? textoMudancaAluno(h.tipo, h.retrato, { campos: h.campos ?? undefined, motivo: h.motivo ?? undefined }) : ''),
    ...(h.avisarTurmas ? { avisarTurmas: true } : {}),
    ...(h.avisarCoordenacao ? { avisarCoordenacao: true } : {}),
    ...(h.cientePor ? { ciente: { por: h.cientePor, em: horaLocal(h.cienteEm) } } : {}),
    ...(h.aluno ? { alunoId: h.aluno } : {}),
    ...(h.tipo ? { tipo: h.tipo } : {}),
    ...(h.campos ? { campos: h.campos } : {}),
  }))

  const db: Db = {
    versao: VERSAO_DADOS,
    colegios: c.colegios
      .filter((x) => x.ativo)
      .map((x) => ({ id: x.id, nome: x.nome, cidade: x.cidade ?? '', uf: x.uf ?? '', membroSolarId: x.cuidadoPor })),
    coordenadores,
    professores,
    equipeSolar,
    turmas,
    alunos,
    avaliacoes: c.avaliacoes.map((a) => ({ ...a })),
    cadernos,
    lancamentos: [...lancamentos.values()],
    historico,
    emails: [],
    config: { anoLetivo: c.anoLetivo },
  }

  const eu = c.eu ? pessoas.get(c.eu) : undefined
  const perfis: Perfil[] = []
  if (eu) {
    const meus = c.vinculos.filter((v) => v.pessoa === eu.id && v.ativo && (!v.colegio || colegiosAtivos.has(v.colegio)))
    if (meus.some((v) => !v.colegio)) perfis.push({ papel: 'solar', membroId: eu.id })
    for (const v of meus.filter((x) => x.colegio && (x.papel === 'coordenacao' || x.papel === 'coordenacao_responsavel'))) {
      if (!perfis.some((p) => p.papel === 'coordenacao' && p.colegioId === v.colegio)) perfis.push({ papel: 'coordenacao', colegioId: v.colegio!, coordenadorId: eu.id })
    }
    for (const v of meus.filter((x) => x.colegio && x.papel === 'professor')) {
      perfis.push({ papel: 'professor', colegioId: v.colegio!, professorId: eu.id })
    }
  }
  return { db, eu: eu ? { id: eu.id, nome: eu.nome, email: eu.email } : null, perfis, bases }
}

/** Os dados vazios, enquanto a carga não chega. */
export function dbVazio(): Db {
  return {
    versao: VERSAO_DADOS,
    colegios: [],
    coordenadores: [],
    professores: [],
    equipeSolar: [],
    turmas: [],
    alunos: [],
    avaliacoes: [],
    cadernos: [],
    lancamentos: [],
    historico: [],
    emails: [],
    config: { anoLetivo: new Date().getFullYear() },
  }
}
