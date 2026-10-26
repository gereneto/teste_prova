// O que prova.carregar() devolve (tudo o que a pessoa da sessão vê, pelo RLS) e a conversão para o Db que
// as telas já usam. Pura: sem rede e sem banco, testada em carga.test.ts.

import { VERSAO_DADOS } from '../data/seed'
import { textoMudancaAluno } from '../lib/alunos'
import {
  DISCIPLINAS_DA_PROVA,
  LETRAS,
  TEXTO_ARQUIVOU,
  type Aluno,
  type Caderno,
  type Colegio,
  type ColegioArquivado,
  type Coordenador,
  type Db,
  type Disciplina,
  type Evento,
  type Id,
  type Lancamento,
  type Letra,
  type MembroSolar,
  type MotivoSaida,
  type PapelSolar,
  type Perfil,
  type Professor,
  type Questao,
  type Serie,
  type Sexo,
  type Situacao,
  type TipoMudancaAluno,
  type Turma,
  type Turno,
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
  /** Só para a Solar (RLS); um banco antes da migração provas_excluidas não manda. */
  excluidas?: {
    id: Id
    caderno: Id
    avaliacao: Id
    avaliacaoTitulo: string
    anoLetivo: number
    serie: Serie
    disciplina: Disciplina
    questoes: number
    pdfNome: string | null
    colegios: { colegio: Id; nome: string; turmas: number; alunos: number }[]
    em: string
    por: string
  }[]
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

/** A questão só com as 4 alternativas: o banco ainda aceita uma quinta, e um gabarito ou comentário nela sai. */
function soAsQuatro(q: Questao): Questao {
  const valida = (l: string): l is Letra => (LETRAS as readonly string[]).includes(l)
  const comentarios = q.comentarios && Object.fromEntries(Object.entries(q.comentarios).filter(([l]) => valida(l)))
  return { ...q, gabarito: q.gabarito && valida(q.gabarito) ? q.gabarito : null, ...(comentarios ? { comentarios } : {}) }
}

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
  // A equipe dos colégios arquivados (os vínculos continuam no banco; só o colégio está desligado), para a Solar
  // ver quem perdeu o acesso.
  const equipeArquivada: Coordenador[] = []
  for (const v of c.vinculos.filter((x) => x.ativo && x.colegio && !colegiosAtivos.has(x.colegio) && (x.papel === 'coordenacao' || x.papel === 'coordenacao_responsavel'))) {
    const p = pessoas.get(v.pessoa)
    if (!p?.ativo || equipeArquivada.some((x) => x.id === p.id && x.colegioId === v.colegio)) continue
    equipeArquivada.push({ id: p.id, colegioId: v.colegio!, nome: p.nome, email: p.email, telefone: p.telefone ?? '', responsavel: v.papel === 'coordenacao_responsavel', token: '' })
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

  // Só as provas das disciplinas de agora (por enquanto, Português): as de outra disciplina ficam no banco, fora das telas.
  const cadernos: Caderno[] = c.cadernos
    .filter((x) => DISCIPLINAS_DA_PROVA.includes(x.disciplina))
    .map((x) => ({
      id: x.id,
      avaliacaoId: x.avaliacao,
      serie: x.serie,
      disciplina: x.disciplina,
      usaFolhaRespostas: x.usaFolhaRespostas,
      questoes: x.questoes.map(soAsQuatro),
      pdf: x.pdfNome ? { nome: x.pdfNome, tamanho: x.pdfTamanho ?? 0, origem: 'enviado', enviadoEm: horaLocal(x.pdfEnviadoEm) } : null,
      conferencia: x.conferidoEm ? { por: x.conferidoPor ?? '', em: horaLocal(x.conferidoEm) } : null,
    }))
  const daProva = new Set(cadernos.map((x) => x.id))

  const lancamentos = new Map<string, Lancamento>()
  const lancamentoDe = (caderno: Id, turma: Id) => {
    const id = `${caderno}__${turma}`
    let l = lancamentos.get(id)
    if (!l) lancamentos.set(id, (l = { id, cadernoId: caderno, turmaId: turma, respostas: {}, concluidoEm: null }))
    return l
  }
  for (const l of c.lancamentos) {
    if (daProva.has(l.caderno)) lancamentoDe(l.caderno, l.turma).concluidoEm = l.concluidoEm ? horaLocal(l.concluidoEm) : null
  }
  const bases = new Map<string, string>()
  for (const r of c.respostas) {
    if (!daProva.has(r.caderno)) continue
    lancamentoDe(r.caderno, r.turma).respostas[r.aluno] = { situacao: r.situacao, marcas: r.marcas, atualizadoEm: horaLocal(r.atualizadoEm), numero: r.numero }
    bases.set(chaveResposta(r.caderno, r.turma, r.aluno), r.atualizadoEm)
  }

  const historico: Evento[] = c.historico.filter((h) => !h.caderno || daProva.has(h.caderno)).map((h) => ({
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

  // Os colégios arquivados saem das listas e das contas da rede; o que era deles vai junto para db.arquivados.
  const colegio = (x: Carga['colegios'][number]): Colegio => ({ id: x.id, nome: x.nome, cidade: x.cidade ?? '', uf: x.uf ?? '', membroSolarId: x.cuidadoPor })
  const turmaAtiva = (turmaId: Id | null) => !turmaId || colegiosAtivos.has(turmas.find((t) => t.id === turmaId)?.colegioId ?? '')
  const arquivados: ColegioArquivado[] = c.colegios
    .filter((x) => !x.ativo)
    .map((x) => {
      const doColegio = new Set(turmas.filter((t) => t.colegioId === x.id).map((t) => t.id))
      const eventos = historico.filter((e) => e.colegioId === x.id)
      const arquivou = eventos.findLast((e) => e.texto === TEXTO_ARQUIVOU)
      return {
        colegio: colegio(x),
        em: arquivou?.em ?? '',
        por: arquivou?.por ?? '',
        coordenadores: equipeArquivada.filter((p) => p.colegioId === x.id),
        professores: professores.filter((p) => p.colegioId === x.id),
        turmas: turmas.filter((t) => doColegio.has(t.id)),
        alunos: alunos.filter((a) => doColegio.has(a.turmaId)),
        lancamentos: [...lancamentos.values()].filter((l) => doColegio.has(l.turmaId)),
        historico: eventos,
      }
    })

  const db: Db = {
    versao: VERSAO_DADOS,
    colegios: c.colegios.filter((x) => x.ativo).map(colegio),
    arquivados,
    coordenadores,
    professores: professores.filter((p) => colegiosAtivos.has(p.colegioId)),
    equipeSolar,
    turmas: turmas.filter((t) => colegiosAtivos.has(t.colegioId)),
    alunos: alunos.filter((a) => turmaAtiva(a.turmaId)),
    avaliacoes: c.avaliacoes.map((a) => ({ ...a })),
    cadernos,
    lancamentos: [...lancamentos.values()].filter((l) => turmaAtiva(l.turmaId)),
    excluidas: (c.excluidas ?? []).map((e) => ({
      id: e.id,
      cadernoId: e.caderno,
      avaliacaoId: e.avaliacao,
      avaliacaoTitulo: e.avaliacaoTitulo,
      anoLetivo: e.anoLetivo,
      serie: e.serie,
      disciplina: e.disciplina,
      questoes: e.questoes,
      pdf: e.pdfNome ? { nome: e.pdfNome, tamanho: 0, origem: 'enviado', enviadoEm: '' } : null,
      colegios: e.colegios.map((x) => ({ colegioId: x.colegio, nome: x.nome, turmas: x.turmas, alunos: x.alunos })),
      em: horaLocal(e.em),
      por: e.por,
    })),
    historico: historico.filter((e) => !e.colegioId || colegiosAtivos.has(e.colegioId)),
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
    arquivados: [],
    coordenadores: [],
    professores: [],
    equipeSolar: [],
    turmas: [],
    alunos: [],
    avaliacoes: [],
    cadernos: [],
    lancamentos: [],
    excluidas: [],
    historico: [],
    emails: [],
    config: { anoLetivo: new Date().getFullYear() },
  }
}
