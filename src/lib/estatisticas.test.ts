import { describe, expect, it } from 'vitest'
import type { Aluno, Caderno, Colegio, Letra, Questao, Turma } from '../types'
import {
  analisarQuestoes,
  contarFaixas,
  correlacao,
  corrigir,
  desempenhoPor,
  faixaDe,
  progressoDaTurma,
  respostaCompleta,
  type ResultadoAluno,
} from './estatisticas'

const q = (gabarito: Letra | null, disciplina = 'Português', extra: Partial<Questao> = {}): Questao => ({
  gabarito,
  disciplina,
  habilidade: null,
  anulada: false,
  ...extra,
})

const caderno = (questoes: Questao[]): Caderno => ({
  id: 'cad',
  avaliacaoId: 'av',
  serie: 3,
  numAlternativas: 4,
  usaFolhaRespostas: true,
  questoes,
  pdf: null,
})

const aluno = (id: string): Aluno => ({ id, turmaId: 't', nome: id, numero: 1, ativo: true })
const turma: Turma = { id: 't', colegioId: 'c', anoLetivo: 2026, serie: 3, nome: 'A', turno: 'Manhã', professorIds: [] }
const colegio: Colegio = { id: 'c', nome: 'C', cidade: '', uf: '', coordenacao: { nome: '', email: '', telefone: '' } }

function resultado(cad: Caderno, id: string, marcas: string): ResultadoAluno {
  return { aluno: aluno(id), turma, colegio, caderno: cad, situacao: 'presente', completo: true, marcas, correcao: corrigir(cad, marcas) }
}

describe('corrigir', () => {
  it('compara as marcas com o gabarito', () => {
    const c = corrigir(caderno([q('A'), q('B'), q('C'), q('D'), q('A')]), 'AB-*C')
    expect(c.acertos).toBe(2)
    expect(c.validas).toBe(5)
    expect(c.pct).toBe(40)
    expect(c.porQuestao).toEqual(['certa', 'certa', 'branco', 'rasura', 'errada'])
  })

  it('deixa de fora questões anuladas e sem gabarito', () => {
    const c = corrigir(caderno([q('A'), q('B', 'Português', { anulada: true }), q(null)]), 'ABA')
    expect(c.validas).toBe(1)
    expect(c.acertos).toBe(1)
    expect(c.pct).toBe(100)
    expect(c.porQuestao).toEqual(['certa', 'fora', 'fora'])
  })

  it('trata marcas que faltam como não lançadas', () => {
    expect(corrigir(caderno([q('A'), q('B')]), 'A').porQuestao).toEqual(['certa', 'vazia'])
  })
})

describe('respostaCompleta', () => {
  const cad = caderno([q('A'), q('B', 'Português', { anulada: true }), q('C')])

  it('exige todas as questões válidas lançadas', () => {
    expect(respostaCompleta(cad, { situacao: 'presente', marcas: 'A C', atualizadoEm: '' })).toBe(true)
    expect(respostaCompleta(cad, { situacao: 'presente', marcas: 'A  ', atualizadoEm: '' })).toBe(false)
    expect(respostaCompleta(cad, undefined)).toBe(false)
  })

  it('considera completos os alunos que faltaram ou fizeram prova adaptada', () => {
    expect(respostaCompleta(cad, { situacao: 'faltou', marcas: '', atualizadoEm: '' })).toBe(true)
    expect(respostaCompleta(cad, { situacao: 'adaptada', marcas: '', atualizadoEm: '' })).toBe(true)
  })
})

describe('progressoDaTurma', () => {
  const cad = caderno([q('A'), q('B')])
  const alunos = [aluno('a1'), aluno('a2'), aluno('a3')]
  const lancamento = (respostas: Record<string, string>, concluidoEm: string | null = null) => ({
    id: 'l',
    cadernoId: 'cad',
    turmaId: 't',
    concluidoEm,
    respostas: Object.fromEntries(
      Object.entries(respostas).map(([id, marcas]) => [
        id,
        { situacao: marcas === 'F' ? ('faltou' as const) : ('presente' as const), marcas: marcas === 'F' ? '' : marcas, atualizadoEm: '' },
      ]),
    ),
  })

  it('mostra não iniciado, em andamento e concluído', () => {
    expect(progressoDaTurma(cad, alunos, undefined).status).toBe('nao_iniciado')
    const andamento = progressoDaTurma(cad, alunos, lancamento({ a1: 'AB', a2: 'A ', a3: 'F' }))
    expect(andamento).toMatchObject({ status: 'em_andamento', total: 3, lancados: 2, faltas: 1 })
    expect(progressoDaTurma(cad, alunos, lancamento({ a1: 'AB' }, '2026-09-28')).status).toBe('concluido')
  })
})

describe('faixas', () => {
  const config = { faixas: [40, 60, 80] as [number, number, number] }

  it('usa os limites como mínimo de cada faixa', () => {
    expect([0, 39.9, 40, 59, 60, 79.9, 80, 100].map((p) => faixaDe(p, config))).toEqual([0, 0, 1, 1, 2, 2, 3, 3])
  })

  it('conta os alunos por faixa', () => {
    const cad = caderno([q('A'), q('B'), q('C'), q('D'), q('A')])
    const lista = [resultado(cad, 'a', 'ABCDA'), resultado(cad, 'b', 'ABCCC'), resultado(cad, 'c', 'CCCCC')]
    expect(contarFaixas(lista, config)).toEqual([1, 0, 1, 1])
  })
})

describe('correlacao', () => {
  it('vai de -1 a 1 e é nula sem variação', () => {
    expect(correlacao([0, 1, 0, 1], [1, 3, 1, 3])).toBeCloseTo(1)
    expect(correlacao([0, 1, 0, 1], [3, 1, 3, 1])).toBeCloseTo(-1)
    expect(correlacao([1, 1, 1], [1, 2, 3])).toBeNull()
  })
})

describe('analisarQuestoes', () => {
  it('aponta gabarito suspeito quando os melhores alunos erram a questão', () => {
    // Questão 5 tem gabarito C, mas quem vai bem no resto da prova marca A.
    const cad = caderno([q('A'), q('B'), q('C'), q('D'), q('C')])
    const lista: ResultadoAluno[] = []
    for (let i = 0; i < 40; i++) {
      const bom = i < 24
      lista.push(resultado(cad, `a${i}`, bom ? 'ABCDA' : 'DDDAC'))
    }
    const analise = analisarQuestoes(cad, lista)
    expect(analise[4].alertas).toContain('gabarito_suspeito')
    expect(analise[4].erroMaisComum).toEqual({ marca: 'A', pct: 60 })
    expect(analise[0].alertas).not.toContain('gabarito_suspeito')
  })

  it('não suspeita de questão fácil só porque os poucos erros são brancos', () => {
    const cad = caderno([q('A'), q('B'), q('C')])
    const lista: ResultadoAluno[] = []
    for (let i = 0; i < 40; i++) lista.push(resultado(cad, `a${i}`, i === 0 ? '-BC' : i < 20 ? 'ABC' : 'ADD'))
    const analise = analisarQuestoes(cad, lista)
    expect(analise[0].discriminacao).toBeLessThan(0)
    expect(analise[0].alertas).not.toContain('gabarito_suspeito')
  })

  it('não gera alertas com poucos alunos', () => {
    const cad = caderno([q('A'), q('C')])
    const analise = analisarQuestoes(cad, [resultado(cad, 'a', 'AA'), resultado(cad, 'b', 'BC')])
    expect(analise.every((a) => a.alertas.length === 0)).toBe(true)
  })
})

describe('desempenhoPor', () => {
  it('agrupa acertos por disciplina', () => {
    const cad = caderno([q('A', 'Português'), q('B', 'Português'), q('C', 'Matemática')])
    const lista = [resultado(cad, 'a', 'ABC'), resultado(cad, 'b', 'AAA')]
    const porDisciplina = Object.fromEntries(desempenhoPor(lista, (x) => x.disciplina).map((d) => [d.chave, d]))
    expect(porDisciplina['Português']).toMatchObject({ acertos: 3, respostas: 4, pct: 75, questoes: 2 })
    expect(porDisciplina['Matemática']).toMatchObject({ acertos: 1, respostas: 2, pct: 50, questoes: 1 })
  })
})
