import { describe, expect, it } from 'vitest'
import type { Caderno, Colegio, Letra, Questao, Turma } from '../types'
import { corrigir, type ResultadoAluno } from './estatisticas'
import { formatarIniciais, iniciaisDoNome } from './iniciais'
import { compararChamada, descreverFaltando } from './alunos'
import { quadroColegioQuestao } from './leitura'

const q = (gabarito: Letra, disciplina = 'Português'): Questao => ({ gabarito, disciplina, habilidade: null, anulada: false })
const caderno = (questoes: Questao[]): Caderno => ({ id: 'cad', avaliacaoId: 'av', serie: 3, numAlternativas: 4, usaFolhaRespostas: false, questoes, pdf: null })
const colegio = (id: string): Colegio => ({ id, nome: id, cidade: '', uf: '', membroSolarId: null })
const turma: Turma = { id: 't', colegioId: 'c1', anoLetivo: 2026, serie: 3, nome: 'A', turno: 'Manhã', professorIds: [] }

function resultado(cad: Caderno, id: string, marcas: string, col: Colegio): ResultadoAluno {
  return {
    aluno: { id, turmaId: turma.id, numero: '1', iniciais: 'A.B.', sexo: 'F', anoIngresso: 2024, ativo: true },
    turma,
    colegio: col,
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
  })

  it('põe em maiúsculas o que foi digitado, no formato A.C.S.', () => {
    expect(formatarIniciais('acs')).toBe('A.C.S.')
    expect(formatarIniciais('a. c. s')).toBe('A.C.S.')
    expect(formatarIniciais('ÉM')).toBe('E.M.')
    expect(formatarIniciais(' . ')).toBe('')
  })
})

describe('alunos', () => {
  it('ordena a chamada entendendo números dentro do código, com quem está sem número no fim', () => {
    expect(['10', '', '2', '1'].sort(compararChamada)).toEqual(['1', '2', '10', ''])
    expect(['3A-10', '3A-2'].sort(compararChamada)).toEqual(['3A-2', '3A-10'])
  })

  it('resume os dados que faltam', () => {
    const base = { numero: '1', iniciais: 'A.B.', sexo: 'F' as const, anoIngresso: 2024 }
    expect(descreverFaltando([base])).toBeNull()
    expect(descreverFaltando([base, { ...base, sexo: null }, { ...base, sexo: null, anoIngresso: null }])).toBe(
      '2 alunos com dados faltando: 2 sem sexo e 1 sem ano de entrada',
    )
  })
})

describe('quadro colégio x questão', () => {
  it('aponta a questão difícil em todos os colégios e a difícil em um só', () => {
    const cad = caderno([q('A'), q('B')])
    const [c1, c2] = [colegio('c1'), colegio('c2')]
    const lista: ResultadoAluno[] = []
    for (let i = 0; i < 20; i++) lista.push(resultado(cad, `a${i}`, i < 15 ? 'AC' : 'BC', c1))
    for (let i = 0; i < 20; i++) lista.push(resultado(cad, `b${i}`, i < 5 ? 'AB' : 'BC', c2))
    const linhas = quadroColegioQuestao(cad, lista, [c1, c2])
    expect(linhas[0].leitura).toBe('alguns')
    expect(linhas[1].leitura).toBe('todos')
  })
})
