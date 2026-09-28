import { describe, expect, it } from 'vitest'
import { analisarQuestoes, coletarResultados, progressoDe } from '../lib/estatisticas'
import { buscarHabilidade } from './bncc'
import { gerarDadosExemplo } from './seed'

const db = gerarDadosExemplo()

describe('dados de exemplo', () => {
  it('seguem a estimativa: 5 colégios, 50 turmas e cerca de 800 alunos', () => {
    expect(db.colegios).toHaveLength(5)
    expect(db.turmas).toHaveLength(50)
    expect(db.alunos.length).toBeGreaterThan(700)
    expect(db.alunos.length).toBeLessThan(900)
    expect(db.professores).toHaveLength(50)
  })

  it('saem iguais toda vez', () => {
    expect(JSON.stringify(gerarDadosExemplo())).toBe(JSON.stringify(db))
  })

  it('não repetem ids', () => {
    const ids = [...db.colegios, ...db.professores, ...db.turmas, ...db.alunos, ...db.cadernos, ...db.lancamentos].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('numeram os alunos de cada turma a partir de 1', () => {
    for (const turma of db.turmas) {
      const numeros = db.alunos.filter((a) => a.turmaId === turma.id).map((a) => a.numero)
      expect(numeros).toEqual(numeros.map((_, i) => i + 1))
    }
  })

  it('classificam cada questão com uma habilidade do ano e da disciplina certos', () => {
    for (const caderno of db.cadernos) {
      for (const questao of caderno.questoes) {
        const habilidade = buscarHabilidade(questao.habilidade)
        expect(habilidade).not.toBeNull()
        expect(habilidade!.anos).toContain(caderno.serie)
        expect(habilidade!.componente).toBe(questao.disciplina)
      }
    }
  })

  it('trazem uma turma de cada situação no Colégio Monte Verde', () => {
    const caderno = (serie: number) => db.cadernos.find((c) => c.id === `cad-2026-3bim-${serie}`)!
    expect(progressoDe(db, caderno(1), 'tur-monte-verde-1A').status).toBe('nao_iniciado')
    expect(progressoDe(db, caderno(3), 'tur-monte-verde-3A').status).toBe('em_andamento')
    expect(progressoDe(db, caderno(4), 'tur-monte-verde-4A').status).toBe('concluido')
  })

  it('só disparam o alerta de gabarito suspeito na questão errada de propósito', () => {
    const suspeitas: string[] = []
    for (const caderno of db.cadernos) {
      const resultados = coletarResultados(db, { avaliacaoId: caderno.avaliacaoId, serie: caderno.serie })
      for (const analise of analisarQuestoes(caderno, resultados)) {
        if (analise.alertas.includes('gabarito_suspeito')) suspeitas.push(`${caderno.id}#${analise.indice + 1}`)
      }
    }
    expect(suspeitas).toEqual(['cad-2026-3bim-4#12'])
  })
})
