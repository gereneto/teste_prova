import { describe, expect, it } from 'vitest'
import { gerarDadosExemplo } from '../data/seed'
import { conferirLista, lerListaDeAlunos, validarIniciais } from './acoes'

describe('lerListaDeAlunos', () => {
  it('lê nome, número de chamada e ano de entrada em vários formatos', () => {
    const lidas = lerListaDeAlunos('Nome;Ano\n7;Ana Clara Souza;2021\n8. Bruno Lima 2026\nCarolina Mendes\nA.C.R.', 2026)
    expect(lidas.map(({ nome, numero, anoIngresso }) => [nome, numero, anoIngresso])).toEqual([
      ['Ana Clara Souza', 7, 2021],
      ['Bruno Lima', 8, 2026],
      ['Carolina Mendes', null, null],
      ['A.C.R.', null, null],
    ])
  })
})

describe('conferirLista', () => {
  const db = gerarDadosExemplo('2026-10-15')
  const turmaId = 'tur-monte-verde-2026-3A'

  it('guarda só as iniciais e numera depois do último número da turma', () => {
    const ultimo = Math.max(...db.alunos.filter((a) => a.turmaId === turmaId && a.ativo).map((a) => a.numero))
    const linhas = conferirLista(db, turmaId, lerListaDeAlunos('Ana Clara de Souza\nACR', 2026), 2026)
    expect(linhas.map((l) => [l.iniciais, l.numero, l.anoIngresso, l.problema])).toEqual([
      ['A.C.S.', ultimo + 1, 2026, null],
      ['A.C.R.', ultimo + 2, 2026, null],
    ])
  })

  it('recusa número de chamada que já é de outro aluno', () => {
    const [linha] = conferirLista(db, turmaId, lerListaDeAlunos('1;Ana Souza', 2026), null)
    expect(linha.problema).toMatch(/^O nº 1 já é de /)
  })
})

describe('validarIniciais', () => {
  it('não deixa digitar o nome completo', () => {
    expect(validarIniciais('Maria Souza')).toMatch(/só as iniciais/)
    expect(validarIniciais('m.s.')).toBeNull()
  })
})
