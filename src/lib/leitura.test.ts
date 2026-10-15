import { describe, expect, it } from 'vitest'
import type { Caderno, Colegio, Letra, Questao, Turma } from '../types'
import { analisarQuestoes, corrigir, type ResultadoAluno, type ResultadoAvaliado } from './estatisticas'
import { iniciaisDoNome, normalizarIniciais, pareceNome } from './iniciais'
import { dificuldadeDoAluno, dificuldadesComuns, erroQueSeDestaca, gruposParaRetomar, questoesParaRetomar } from './leitura'

const q = (gabarito: Letra, disciplina = 'Português'): Questao => ({ gabarito, disciplina, habilidade: null, anulada: false })
const caderno = (questoes: Questao[]): Caderno => ({ id: 'cad', avaliacaoId: 'av', serie: 3, numAlternativas: 4, usaFolhaRespostas: true, questoes, pdf: null })
const colegio: Colegio = { id: 'c', nome: 'C', cidade: '', uf: '' }
const turmaA: Turma = { id: 'ta', colegioId: 'c', anoLetivo: 2026, serie: 3, nome: 'A', turno: 'Manhã', professorIds: [] }
const turmaB: Turma = { ...turmaA, id: 'tb', nome: 'B' }

function resultado(cad: Caderno, id: string, marcas: string, turma = turmaA, numero = 1): ResultadoAvaliado {
  return {
    aluno: { id, turmaId: turma.id, iniciais: 'A.B.', numero, anoIngresso: 2024, ativo: true },
    turma,
    colegio,
    caderno: cad,
    situacao: 'presente',
    completo: true,
    marcas,
    correcao: corrigir(cad, marcas),
  }
}

describe('iniciais', () => {
  it('tira as iniciais do nome, sem partículas nem acentos', () => {
    expect(iniciaisDoNome('Ana Clara de Souza')).toBe('A.C.S.')
    expect(iniciaisDoNome('Ícaro dos Santos e Silva')).toBe('I.S.S.')
    expect(iniciaisDoNome('  João   Pedro  ')).toBe('J.P.')
  })

  it('aceita iniciais digitadas de vários jeitos e recusa nomes', () => {
    expect(normalizarIniciais('acs')).toBe('A.C.S.')
    expect(normalizarIniciais('A. C. S.')).toBe('A.C.S.')
    expect(normalizarIniciais('Ana 2')).toBeNull()
    expect(pareceNome('Ana Souza')).toBe(true)
    expect(pareceNome('A.C.S.')).toBe(false)
  })
})

describe('leituras da turma', () => {
  // Uma questão de Português (A) e três de Matemática (B, C, D).
  const cad = caderno([q('A'), q('B', 'Matemática'), q('C', 'Matemática'), q('D', 'Matemática')])
  const lista = [
    resultado(cad, 'a1', 'ABCA', turmaA, 1),
    resultado(cad, 'a2', 'ACCA', turmaA, 2),
    resultado(cad, 'a3', 'BCAA', turmaA, 3),
    resultado(cad, 'a4', 'ACBA', turmaA, 4),
  ]
  const analise = analisarQuestoes(cad, lista as ResultadoAluno[])

  it('lista para retomar as questões que menos da metade acertou', () => {
    expect(questoesParaRetomar(analise).map((a) => a.indice + 1)).toEqual([4, 2])
  })

  it('destaca o erro que muitos alunos repetiram', () => {
    const destaque = erroQueSeDestaca(analise)
    expect(destaque?.indice).toBe(3)
    expect(destaque?.erroMaisComum).toMatchObject({ marca: 'A', qtd: 4 })
  })

  it('só forma grupos em disciplinas com pelo menos 3 questões', () => {
    const grupos = gruposParaRetomar(lista)
    expect(grupos.map((g) => g.disciplina)).toEqual(['Matemática'])
    expect(grupos[0].alunos.map((x) => x.resultado.aluno.id)).toEqual(['a2', 'a3', 'a4'])
  })

  it('aponta a disciplina em que o aluno acertou menos da metade', () => {
    expect(dificuldadeDoAluno(lista[2])).toEqual({ disciplina: 'Matemática', acertos: 0, questoes: 3 })
    expect(dificuldadeDoAluno(lista[0])).toBeNull()
  })
})

describe('dificuldades comuns do colégio', () => {
  it('marca as questões difíceis em todas as turmas do ano', () => {
    const cad = caderno([q('A'), q('B')])
    const lista: ResultadoAluno[] = []
    for (let i = 0; i < 6; i++) lista.push(resultado(cad, `a${i}`, i < 4 ? 'AC' : 'AB', turmaA))
    for (let i = 0; i < 6; i++) lista.push(resultado(cad, `b${i}`, i < 5 ? 'AC' : 'AB', turmaB))
    const dificuldades = dificuldadesComuns(cad, lista)
    expect(dificuldades.map((d) => d.indice)).toEqual([1])
    expect(dificuldades[0].emTodas).toBe(true)
  })
})
