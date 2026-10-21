import { describe, expect, it } from 'vitest'
import { gerarDadosExemplo } from '../data/seed'
import { cadernosDaAvaliacao } from './consultas'
import {
  agruparPorAnoDeIngresso,
  analisarQuestoes,
  coletarResultados,
  contarFaixas,
  desempenhoPor,
  mediaPct,
  participacao,
  progressoDe,
  resumoGrupos,
  type AnaliseQuestao,
} from './estatisticas'
import { quadroColegioQuestao } from './leitura'
import {
  agregarTurma,
  analisarQuestoesAg,
  desempenhoAg,
  faixasAg,
  grupoAg,
  mediaAg,
  painelDosDados,
  participacaoAg,
  progressoAg,
  quadroColegioQuestaoAg,
  resumoGruposAg,
} from './rede'
import { DISCIPLINAS_DA_PROVA, type Aluno, type Caderno, type Db, type Disciplina, type Letra, type Turma } from '../types'

// As contas da Solar sobre as somas por turma têm de dar os mesmos números das contas aluno a aluno.
const db = gerarDadosExemplo('2026-10-15')
const painel = painelDosDados(db)
const cadernoDe = (id: string) => db.cadernos.find((c) => c.id === id)
const turmaDe = (id: string) => db.turmas.find((t) => t.id === id)!
const perto = (a: number | null | undefined, b: number | null | undefined) => {
  if (a == null || b == null) return expect(a ?? null).toBe(b ?? null)
  expect(a).toBeCloseTo(b, 9)
}

function selecoes() {
  const lista: { rotulo: string; avaliacaoId: string; serie?: number; colegioId?: string; disciplina?: Disciplina }[] = []
  for (const avaliacao of db.avaliacoes) {
    lista.push({ rotulo: `${avaliacao.titulo}, rede`, avaliacaoId: avaliacao.id })
    for (const disciplina of DISCIPLINAS_DA_PROVA) {
      lista.push({ rotulo: `${avaliacao.titulo}, ${disciplina}`, avaliacaoId: avaliacao.id, disciplina })
      for (const serie of [1, 3, 5]) lista.push({ rotulo: `${avaliacao.titulo}, ${disciplina}, ${serie}º`, avaliacaoId: avaliacao.id, disciplina, serie })
      for (const colegio of db.colegios.slice(0, 2)) {
        lista.push({ rotulo: `${avaliacao.titulo}, ${disciplina}, ${colegio.nome}`, avaliacaoId: avaliacao.id, disciplina, colegioId: colegio.id })
      }
    }
  }
  return lista
}

function agsDe(s: { avaliacaoId: string; serie?: number; colegioId?: string; disciplina?: Disciplina }) {
  return painel.turmas.filter((ag) => {
    const caderno = cadernoDe(ag.caderno)!
    const turma = turmaDe(ag.turma)
    return (
      caderno.avaliacaoId === s.avaliacaoId &&
      (!s.serie || caderno.serie === s.serie) &&
      (!s.disciplina || caderno.disciplina === s.disciplina) &&
      (!s.colegioId || turma.colegioId === s.colegioId)
    )
  })
}

function confereAnalise(a: AnaliseQuestao[], b: AnaliseQuestao[]) {
  expect(b.length).toBe(a.length)
  a.forEach((x, i) => {
    const y = b[i]
    expect(y.n).toBe(x.n)
    perto(y.pctAcerto, x.pctAcerto)
    perto(y.discriminacao, x.discriminacao)
    expect(y.contagem).toEqual(x.contagem)
    expect(y.alertas).toEqual(x.alertas)
    expect(y.esquecidas).toEqual(x.esquecidas)
    expect(y.erroMaisComum?.marca ?? null).toBe(x.erroMaisComum?.marca ?? null)
  })
}

describe('as somas por turma dão os mesmos números que os alunos um a um', () => {
  for (const s of selecoes()) {
    it(s.rotulo, () => {
      const resultados = coletarResultados(db, { avaliacaoId: s.avaliacaoId, serie: (s.serie as 1) ?? null, colegioId: s.colegioId, disciplina: s.disciplina })
      const ags = agsDe(s)
      expect(participacaoAg(ags)).toEqual(participacao(resultados))
      perto(mediaAg(ags, cadernoDe), mediaPct(resultados))
      expect(faixasAg(ags)).toEqual(contarFaixas(resultados))
      for (const chave of [(q: { disciplina: string }) => q.disciplina, (q: { habilidade: string | null }) => q.habilidade]) {
        const a = new Map(desempenhoPor(resultados, chave).map((d) => [d.chave, d]))
        const b = desempenhoAg(ags, cadernoDe, chave)
        expect(b.length).toBe(a.size)
        for (const d of b) {
          expect(d.acertos).toBe(a.get(d.chave)!.acertos)
          expect(d.respostas).toBe(a.get(d.chave)!.respostas)
          expect(d.questoes).toBe(a.get(d.chave)!.questoes)
        }
      }
      const g = resumoGrupos(resultados)
      const h = resumoGruposAg(ags, cadernoDe, g.anoLetivo)
      expect(h.total).toBe(g.total)
      expect(h.semDado).toBe(g.semDado)
      for (const k of ['novos', 'antigos', 'F', 'M'] as const) {
        expect(h[k].n).toBe(g[k].n)
        perto(h[k].media, g[k].media)
      }
      agruparPorAnoDeIngresso(resultados).forEach((grupo, i) => {
        const ag = grupoAg(ags, `ha${i}`, cadernoDe)
        expect(ag.n).toBe(grupo.resultados.filter((r) => r.correcao).length)
        perto(ag.media, mediaPct(grupo.resultados))
        expect(ag.faixas).toEqual(contarFaixas(grupo.resultados))
      })
      if (s.serie && s.disciplina) {
        const caderno = cadernosDaAvaliacao(db, s.avaliacaoId).find((c) => c.serie === s.serie && c.disciplina === s.disciplina)!
        confereAnalise(analisarQuestoes(caderno, resultados), analisarQuestoesAg(caderno, ags))
        const a = quadroColegioQuestao(caderno, resultados, db.colegios)
        const b = quadroColegioQuestaoAg(caderno, ags, db.colegios, (id) => turmaDe(id).colegioId)
        a.forEach((linha, i) => {
          perto(b[i].rede, linha.rede)
          expect(b[i].leitura).toBe(linha.leitura)
          for (const [colegio, v] of linha.porColegio) {
            expect(b[i].porColegio.get(colegio)!.n).toBe(v.n)
            perto(b[i].porColegio.get(colegio)!.pct, v.pct)
          }
        })
      }
    })
  }

  it('o andamento de cada turma em cada prova', () => {
    for (const ag of painel.turmas) expect(progressoAg(ag)).toEqual(progressoDe(db, cadernoDe(ag.caderno)!, ag.turma))
  })

  it('o gabarito suspeito de propósito aparece também pelas somas', () => {
    const caderno = cadernoDe('cad-2026-4-pt')!
    const analise = analisarQuestoesAg(caderno, painel.turmas)
    expect(analise[1].alertas).toContain('gabarito_suspeito')
  })
})

// O mesmo cenário dos testes do banco (plataforma-infra, 09_prova_painel): o painel calculado aqui tem de dar
// os mesmos números que prova.painel_rede() dá lá.
describe('as mesmas somas do banco (cenário do 09_prova_painel)', () => {
  const q = (gabaritos: string, disciplina: Disciplina) =>
    gabaritos.split('').map((g) => ({ gabarito: g as Letra, disciplina, habilidade: null, anulada: false }))
  const caderno = (id: string, avaliacaoId: string, serie: 2 | 3, disciplina: Disciplina, gabaritos: string): Caderno => ({
    id, avaliacaoId, serie, disciplina, usaFolhaRespostas: false, questoes: q(gabaritos, disciplina), pdf: null,
  })
  const turma = (id: string, colegioId: string, anoLetivo: number, serie: 2 | 3, nome: string): Turma => ({
    id, colegioId, anoLetivo, serie, nome, turno: 'Manhã', professorIds: [],
  })
  // A turma de cada aluno é a da matrícula mais recente (é o que a Prova recebe do banco).
  const aluno = (id: string, turmaId: string, numero: string, iniciais: string, sexo: 'F' | 'M' | null, anoIngresso: number): Aluno => ({
    id, turmaId, numero, iniciais, sexo, anoIngresso, ativo: true,
  })
  const r = (marcas: string, situacao: 'presente' | 'faltou' = 'presente') => ({ situacao, marcas, atualizadoEm: '2026-10-10T10:00:00', numero: '' })
  const base: Db = {
    versao: 0, coordenadores: [], professores: [], equipeSolar: [], historico: [], emails: [], config: { anoLetivo: 2026 },
    colegios: [{ id: 'A', nome: 'A', cidade: '', uf: '', membroSolarId: null }, { id: 'B', nome: 'B', cidade: '', uf: '', membroSolarId: null }],
    turmas: [turma('2A25', 'A', 2025, 2, 'A'), turma('3A', 'A', 2026, 3, 'A'), turma('3B', 'A', 2026, 3, 'B'), turma('B3A', 'B', 2026, 3, 'A')],
    alunos: [
      aluno('a1', '3A', '1', 'AA', 'F', 2024), aluno('a2', '3A', '2', 'BB', 'M', 2025), aluno('a3', '3A', '3', 'CC', 'F', 2026),
      aluno('a4', '3B', '1', 'DD', null, 2023), aluno('b1', 'B3A', '1', 'EE', 'M', 2026),
    ],
    avaliacoes: [
      { id: 'av25', titulo: '2025', anoLetivo: 2025, aplicacaoInicio: '2025-11-17', aplicacaoFim: '2025-11-21', prazoLancamento: '2025-12-05' },
      { id: 'av26', titulo: '2026', anoLetivo: 2026, aplicacaoInicio: '2026-10-05', aplicacaoFim: '2026-10-09', prazoLancamento: '2026-11-30' },
    ],
    cadernos: [caderno('P25', 'av25', 2, 'Português', 'ABCD'), caderno('P3', 'av26', 3, 'Português', 'ABCDA'), caderno('M3', 'av26', 3, 'Matemática', 'DCBAD')],
    lancamentos: [
      { id: 'P25__2A25', cadernoId: 'P25', turmaId: '2A25', concluidoEm: null, respostas: { a1: r('ABCD'), a2: r('ABCA'), a4: r('', 'faltou') } },
      { id: 'P3__3A', cadernoId: 'P3', turmaId: '3A', concluidoEm: null, respostas: { a1: r('ABCDA'), a2: r('ABDDB') } },
      { id: 'P3__3B', cadernoId: 'P3', turmaId: '3B', concluidoEm: null, respostas: { a4: r('BBCDA') } },
      { id: 'P3__B3A', cadernoId: 'P3', turmaId: 'B3A', concluidoEm: null, respostas: { b1: r('ABCDA') } },
    ],
  }
  const ag = (d: Db, c: string, t: string) => {
    const { ultima: _, ...resto } = agregarTurma(d, d.cadernos.find((x) => x.id === c)!, d.turmas.find((x) => x.id === t)!)
    return resto
  }

  it('3º A em Português', () => {
    expect(ag(base, 'P3', '3A')).toEqual({
      turma: '3A', caderno: 'P3', total: 3, comResposta: 2, lancados: 2, faltas: 0, adaptadas: 0, avaliados: 2,
      somaAcertos: 8, somaQuadrados: 34, faixas: [0, 0, 0, 1, 1], concluidoEm: null,
      questoes: [
        { marcas: { A: 2 }, acertos: 2, somaComAcerto: 8 },
        { marcas: { B: 2 }, acertos: 2, somaComAcerto: 8 },
        { marcas: { C: 1, D: 1 }, acertos: 1, somaComAcerto: 5 },
        { marcas: { D: 2 }, acertos: 2, somaComAcerto: 8 },
        { marcas: { A: 1, B: 1 }, acertos: 1, somaComAcerto: 5 },
      ],
      grupos: {
        antigos: { n: 2, somaAcertos: 8, faixas: [0, 0, 0, 1, 1] },
        F: { n: 1, somaAcertos: 5, faixas: [0, 0, 0, 0, 1] },
        M: { n: 1, somaAcertos: 3, faixas: [0, 0, 0, 1, 0] },
        ha1: { n: 1, somaAcertos: 3, faixas: [0, 0, 0, 1, 0] },
        ha2: { n: 1, somaAcertos: 5, faixas: [0, 0, 0, 0, 1] },
      },
    })
  })

  it('Matemática ainda sem lançamento, o 3º B, B e 2025', () => {
    expect(ag(base, 'M3', '3A')).toMatchObject({ total: 3, comResposta: 0, avaliados: 0, faixas: [0, 0, 0, 0, 0], grupos: {} })
    expect(ag(base, 'P3', '3B').grupos).toEqual({
      antigos: { n: 1, somaAcertos: 4, faixas: [0, 0, 0, 0, 1] },
      sem_sexo: { n: 1, somaAcertos: 4, faixas: [0, 0, 0, 0, 1] },
      ha3: { n: 1, somaAcertos: 4, faixas: [0, 0, 0, 0, 1] },
    })
    expect(ag(base, 'P3', 'B3A').grupos.novos).toEqual({ n: 1, somaAcertos: 5, faixas: [0, 0, 0, 0, 1] })
    expect(ag(base, 'P25', '2A25')).toMatchObject({ total: 3, comResposta: 3, lancados: 3, faltas: 1, avaliados: 2, somaAcertos: 7, somaQuadrados: 25 })
    expect(ag(base, 'P25', '2A25').grupos.novos).toEqual({ n: 1, somaAcertos: 3, faixas: [0, 0, 0, 1, 0] })
  })

  it('a2 muda para o 3º B depois de fazer Português no 3º A', () => {
    const d: Db = { ...base, alunos: base.alunos.map((a) => (a.id === 'a2' ? { ...a, turmaId: '3B' } : a)) }
    expect(ag(d, 'P3', '3B').total).toBe(1)
    expect(ag(d, 'P3', '3A').avaliados).toBe(2)
    expect(ag(d, 'M3', '3B').total).toBe(2)
  })
})
