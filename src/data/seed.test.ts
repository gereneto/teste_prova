import { describe, expect, it } from 'vitest'
import { alunosDaTurma, etapaAvaliacao, lancamentoDe } from '../lib/consultas'
import { analisarQuestoes, coletarResultados, mediaPct, progressoDe, separarPorIngresso } from '../lib/estatisticas'
import { buscarHabilidade } from './bncc'
import { gerarDadosExemplo, PESSOAS_DE_TESTE } from './seed'

const HOJE = '2026-10-15'
const db = gerarDadosExemplo(HOJE)
const turmas2026 = db.turmas.filter((t) => t.anoLetivo === 2026)

describe('dados de exemplo', () => {
  it('seguem a estimativa: 5 colégios, 50 turmas e cerca de 800 alunos', () => {
    expect(db.colegios).toHaveLength(5)
    expect(turmas2026).toHaveLength(50)
    const ativos = db.alunos.filter((a) => a.ativo)
    expect(ativos.length).toBeGreaterThan(700)
    expect(ativos.length).toBeLessThan(900)
    expect(db.professores).toHaveLength(50)
  })

  it('têm só a avaliação anual: a de 2025, encerrada, e a de 2026, em lançamento', () => {
    expect(db.avaliacoes.map((a) => [a.titulo, etapaAvaliacao(a, HOJE)])).toEqual([
      ['Avaliação anual 2025', 'encerrada'],
      ['Avaliação anual 2026', 'lancamento'],
    ])
  })

  it('saem iguais toda vez', () => {
    expect(JSON.stringify(gerarDadosExemplo(HOJE))).toBe(JSON.stringify(db))
  })

  it('não repetem ids', () => {
    const ids = [
      ...db.colegios,
      ...db.coordenadores,
      ...db.professores,
      ...db.equipeSolar,
      ...db.turmas,
      ...db.alunos,
      ...db.cadernos,
      ...db.lancamentos,
      ...db.historico,
    ].map((x) => x.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('guardam só as iniciais dos alunos', () => {
    for (const aluno of db.alunos) {
      expect(aluno.iniciais).toMatch(/^[A-Z]{1,6}$/)
      expect(Object.keys(aluno)).not.toContain('nome')
    }
  })

  it('numeram os alunos de cada turma sem repetir número', () => {
    for (const turma of db.turmas) {
      const lancamento = db.lancamentos.find((l) => l.turmaId === turma.id)
      const lista = turma.anoLetivo === 2026 ? db.alunos.filter((a) => a.turmaId === turma.id && a.ativo) : alunosDaTurma(db, turma.id, lancamento)
      const numeros = lista.map((a) => a.numero).filter(Boolean)
      expect(new Set(numeros).size).toBe(numeros.length)
      if (turma.anoLetivo === 2025) expect(numeros.map(Number).sort((a, b) => a - b)).toEqual(numeros.map((_, i) => i + 1))
    }
  })

  it('têm uma prova de Português por ano, com folha de respostas só no 5º ano', () => {
    for (const avaliacao of db.avaliacoes) {
      for (const serie of [1, 2, 3, 4, 5]) {
        const doAno = db.cadernos.filter((c) => c.avaliacaoId === avaliacao.id && c.serie === serie)
        expect(doAno.map((c) => c.disciplina)).toEqual(['Português'])
      }
    }
    for (const caderno of db.cadernos) {
      expect(new Set(caderno.questoes.map((q) => q.disciplina))).toEqual(new Set([caderno.disciplina]))
      expect(caderno.questoes).toHaveLength(caderno.serie <= 2 ? 8 : 10)
      expect(caderno.usaFolhaRespostas).toBe(caderno.serie === 5)
    }
  })

  it('registram o sexo dos alunos, com alguns dados faltando para o lembrete aparecer', () => {
    const ativos = db.alunos.filter((a) => a.ativo)
    const meninas = ativos.filter((a) => a.sexo === 'F').length / ativos.length
    expect(meninas).toBeGreaterThan(0.4)
    expect(meninas).toBeLessThan(0.6)
    expect(ativos.filter((a) => a.sexo === null)).toHaveLength(2)
    expect(ativos.filter((a) => a.numero === '')).toHaveLength(1)
  })

  it('dão a cada pessoa um link de acesso diferente, e a cada colégio alguém da Solar', () => {
    const tokens = [...db.professores, ...db.coordenadores, ...db.equipeSolar].map((p) => p.token)
    expect(new Set(tokens).size).toBe(tokens.length)
    expect(tokens.every((t) => /^[a-z0-9]{20}$/.test(t))).toBe(true)
    for (const colegio of db.colegios) expect(db.equipeSolar.find((m) => m.id === colegio.membroSolarId)?.papel).not.toBe('visualizacao')
  })

  it('registram o ano de entrada de cada aluno, com parte deles novos no colégio', () => {
    const turmas = new Map(db.turmas.map((t) => [t.id, t]))
    const ativos = db.alunos.filter((a) => a.ativo)
    for (const aluno of ativos) {
      if (aluno.anoIngresso == null) continue
      const turma = turmas.get(aluno.turmaId)!
      expect(aluno.anoIngresso).toBeLessThanOrEqual(turma.anoLetivo)
      expect(aluno.anoIngresso).toBeGreaterThanOrEqual(turma.anoLetivo - (turma.serie - 1) - 4)
    }
    expect(ativos.filter((a) => a.anoIngresso == null)).toHaveLength(3)
    const parteNovos = ativos.filter((a) => a.anoIngresso === 2026).length / ativos.length
    expect(parteNovos).toBeGreaterThan(0.08)
    expect(parteNovos).toBeLessThan(0.3)
  })

  it('trazem os resultados de 2025 dos alunos, numa turma do ano anterior do mesmo colégio', () => {
    const turmas = new Map(db.turmas.map((t) => [t.id, t]))
    let comAnterior = 0
    for (const lancamento of db.lancamentos.filter((l) => l.cadernoId.startsWith('cad-2025'))) {
      const anterior = turmas.get(lancamento.turmaId)!
      for (const alunoId of Object.keys(lancamento.respostas)) {
        const aluno = db.alunos.find((a) => a.id === alunoId)!
        if (!aluno.ativo) continue
        const atual = turmas.get(aluno.turmaId)!
        expect(atual.anoLetivo).toBe(2026)
        expect(atual.serie).toBe(anterior.serie + 1)
        expect(atual.colegioId).toBe(anterior.colegioId)
        comAnterior++
      }
    }
    expect(comAnterior).toBeGreaterThan(400)
  })

  it('simulam alunos novos um pouco abaixo dos antigos', () => {
    const { novos, antigos } = separarPorIngresso(coletarResultados(db, { avaliacaoId: 'av-2025' }))
    expect(mediaPct(novos)!).toBeLessThan(mediaPct(antigos)!)
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

  it('trazem uma turma de cada situação no colégio da versão de teste', () => {
    const caderno = (id: string) => db.cadernos.find((c) => c.id === `cad-2026-${id}`)!
    expect(progressoDe(db, caderno('1-pt'), 'tur-monte-verde-2026-1A').status).toBe('nao_iniciado')
    expect(progressoDe(db, caderno('2-pt'), 'tur-monte-verde-2026-2A').status).toBe('concluido')
    expect(progressoDe(db, caderno('3-pt'), 'tur-monte-verde-2026-3A').status).toBe('em_andamento')
    expect(progressoDe(db, caderno('4-pt'), 'tur-monte-verde-2026-4A').status).toBe('concluido')
  })

  it('só disparam o alerta de gabarito suspeito na questão errada de propósito', () => {
    const suspeitas: string[] = []
    for (const caderno of db.cadernos) {
      const resultados = coletarResultados(db, { avaliacaoId: caderno.avaliacaoId, cadernoId: caderno.id })
      for (const analise of analisarQuestoes(caderno, resultados)) {
        if (analise.alertas.includes('gabarito_suspeito')) suspeitas.push(`${caderno.id}#${analise.indice + 1}`)
      }
    }
    expect(suspeitas).toEqual(['cad-2026-4-pt#2'])
  })

  it('põem o professor, a coordenação e a Solar de teste juntos, no mesmo colégio', () => {
    const professor = db.professores.find((p) => p.id === PESSOAS_DE_TESTE.professorId)!
    const coordenador = db.coordenadores.find((c) => c.id === PESSOAS_DE_TESTE.coordenadorId)!
    expect(professor.colegioId).toBe(PESSOAS_DE_TESTE.colegioId)
    expect(coordenador.colegioId).toBe(PESSOAS_DE_TESTE.colegioId)
    expect(coordenador.responsavel).toBe(true)
    expect(db.equipeSolar.find((m) => m.id === PESSOAS_DE_TESTE.membroSolarId)!.papel).toBe('responsavel')
    expect(db.equipeSolar.filter((m) => m.papel === 'responsavel')).toHaveLength(1)
  })

  it('trazem avisos de mudanças feitas por professores, para a coordenação marcar que está ciente', () => {
    const avisos = db.historico.filter((e) => e.avisarCoordenacao && e.colegioId === PESSOAS_DE_TESTE.colegioId)
    expect(avisos).toHaveLength(3)
    expect(avisos.filter((e) => !e.ciente)).toHaveLength(2)
    const inclusao = avisos.find((e) => e.tipo === 'inclusao')!
    expect(lancamentoDe(db, 'cad-2026-3-pt', inclusao.turmaId!)!.respostas[inclusao.alunoId!]).toBeDefined()
    expect(inclusao.texto).toMatch(/^Incluiu o nº \d+ \(LMR\) na lista: sexo feminino e entrou no colégio em 2026\.$/)
  })
})
