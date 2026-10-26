import { beforeEach, describe, expect, it } from 'vitest'
import { PESSOAS_DE_TESTE } from '../data/seed'
import { fraseConfere, fraseParaArquivarColegio, fraseParaExcluirColegio } from '../lib/formato'
import { painelDosDados } from '../lib/rede'
import { arquivarColegio, excluirColegio, reativarColegio, restaurarDadosDeExemplo } from './acoes'
import { getDb } from './db'
import { definirPerfil } from './perfil'

const colegioId = 'col-aurora'
const comoSolar = () => definirPerfil({ papel: 'solar', membroId: PESSOAS_DE_TESTE.membroSolarId })
const contar = (id: string) => {
  const db = getDb()
  const turmas = new Set(db.turmas.filter((t) => t.colegioId === id).map((t) => t.id))
  return {
    turmas: turmas.size,
    alunos: db.alunos.filter((a) => turmas.has(a.turmaId)).length,
    lancamentos: db.lancamentos.filter((l) => turmas.has(l.turmaId)).length,
    coordenadores: db.coordenadores.filter((c) => c.colegioId === id).length,
    professores: db.professores.filter((p) => p.colegioId === id).length,
  }
}

beforeEach(async () => {
  await restaurarDadosDeExemplo()
  comoSolar()
})

describe('frases de confirmação', () => {
  it('usam o nome sem o "Colégio" do começo, sem acentos e em minúsculas', () => {
    expect(fraseParaArquivarColegio('Colégio Catena Áurea')).toBe('arquivo colegio catena aurea')
    expect(fraseParaExcluirColegio('Escola  Pequeno Príncipe')).toBe('excluir colegio escola pequeno principe')
  })

  it('conferem sem olhar maiúsculas, acentos e espaços a mais', () => {
    const frase = fraseParaArquivarColegio('Colégio Catena Áurea')
    expect(fraseConfere('Arquivo Colégio  Catena Áurea ', frase)).toBe(true)
    expect(fraseConfere('arquivo colegio catena', frase)).toBe(false)
    expect(fraseConfere('arquivar colegio catena aurea', frase)).toBe(false)
  })
})

describe('colégios arquivados', () => {
  it('arquivar tira o colégio das listas e das contas da rede, e guarda tudo o que era dele', () => {
    const antes = contar(colegioId)
    expect(antes.turmas).toBeGreaterThan(0)
    const turmas = new Set(getDb().turmas.filter((t) => t.colegioId === colegioId).map((t) => t.id))
    arquivarColegio(colegioId)
    const db = getDb()
    expect(db.colegios.some((c) => c.id === colegioId)).toBe(false)
    expect(contar(colegioId)).toEqual({ turmas: 0, alunos: 0, lancamentos: 0, coordenadores: 0, professores: 0 })
    expect(db.historico.some((e) => e.colegioId === colegioId)).toBe(false)
    expect(painelDosDados(db).turmas.some((ag) => turmas.has(ag.turma))).toBe(false)
    const arquivado = db.arquivados.find((a) => a.colegio.id === colegioId)!
    expect(arquivado.por).toBe(db.equipeSolar.find((m) => m.id === PESSOAS_DE_TESTE.membroSolarId)!.nome)
    expect({
      turmas: arquivado.turmas.length,
      alunos: arquivado.alunos.length,
      lancamentos: arquivado.lancamentos.length,
      coordenadores: arquivado.coordenadores.length,
      professores: arquivado.professores.length,
    }).toEqual(antes)
    expect(arquivado.historico.at(-1)!.texto).toBe('Arquivou o colégio.')
  })

  it('reativar devolve tudo como estava', () => {
    const antes = contar(colegioId)
    const eventos = getDb().historico.filter((e) => e.colegioId === colegioId).length
    arquivarColegio(colegioId)
    reativarColegio(colegioId)
    const db = getDb()
    expect(db.arquivados).toHaveLength(0)
    expect(db.colegios.some((c) => c.id === colegioId)).toBe(true)
    expect(contar(colegioId)).toEqual(antes)
    const doColegio = db.historico.filter((e) => e.colegioId === colegioId)
    expect(doColegio).toHaveLength(eventos + 2)
    expect(doColegio.slice(-2).map((e) => e.texto)).toEqual(['Arquivou o colégio.', 'Reativou o colégio.'])
  })

  it('excluir apaga o arquivado e deixa uma linha no histórico da Solar', () => {
    arquivarColegio(colegioId)
    excluirColegio(colegioId)
    const db = getDb()
    expect(db.arquivados).toHaveLength(0)
    expect(db.colegios.some((c) => c.id === colegioId)).toBe(false)
    expect(db.historico.at(-1)).toMatchObject({ colegioId: null, texto: 'Excluiu em definitivo o Colégio Aurora (Londrina/PR).' })
  })

  it('só exclui colégio arquivado', () => {
    excluirColegio(colegioId)
    expect(getDb().colegios.some((c) => c.id === colegioId)).toBe(true)
  })
})
