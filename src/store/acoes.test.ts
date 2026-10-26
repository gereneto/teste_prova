import { beforeEach, describe, expect, it } from 'vitest'
import { PESSOAS_DE_TESTE } from '../data/seed'
import { pessoaPorToken } from '../lib/consultas'
import { painelDosDados, respostasPorColegio } from '../lib/rede'
import { fraseConfere, fraseParaExcluirProva } from '../lib/formato'
import { atualizarAluno, criarAluno, criarProfessor, editarProfessor, excluirCadastroDoAluno, marcarCiente, novoId, removerCaderno, restaurarDadosDeExemplo, textoAvisoExclusao } from './acoes'
import { getDb } from './db'
import { definirPerfil } from './perfil'

const turmaId = 'tur-monte-verde-2026-3A'
const comoProfessor = () => definirPerfil({ papel: 'professor', colegioId: PESSOAS_DE_TESTE.colegioId, professorId: PESSOAS_DE_TESTE.professorId })
const comoCoordenacao = () => definirPerfil({ papel: 'coordenacao', colegioId: PESSOAS_DE_TESTE.colegioId, coordenadorId: PESSOAS_DE_TESTE.coordenadorId })

beforeEach(async () => {
  await restaurarDadosDeExemplo()
})

describe('lista de alunos', () => {
  it('guarda as iniciais em maiúsculas e aceita campos em branco', () => {
    comoCoordenacao()
    const id = novoId('alu')
    criarAluno(turmaId, id, { iniciais: 'acs' })
    expect(getDb().alunos.find((a) => a.id === id)).toMatchObject({ numero: '', iniciais: 'ACS', sexo: null, anoIngresso: null, ativo: true })
  })

  it('avisa a coordenação do que o professor mudou, num aviso só por aluno e por dia', () => {
    comoProfessor()
    const avisosAntes = getDb().historico.filter((e) => e.avisarCoordenacao).length
    const id = novoId('alu')
    criarAluno(turmaId, id, { numero: '18' })
    atualizarAluno(id, { iniciais: 'mso' })
    atualizarAluno(id, { sexo: 'M', anoIngresso: 2026 })
    const avisos = getDb().historico.filter((e) => e.avisarCoordenacao)
    expect(avisos).toHaveLength(avisosAntes + 1)
    expect(avisos.at(-1)!.texto).toBe('Incluiu o nº 18 (MSO) na lista: sexo masculino e entrou no colégio em 2026.')
  })

  it('junta as correções do mesmo aluno e some com o aviso se tudo voltar ao que era', () => {
    comoProfessor()
    const aluno = getDb().alunos.find((a) => a.turmaId === turmaId && a.numero === '2')!
    atualizarAluno(aluno.id, { sexo: aluno.sexo === 'F' ? 'M' : 'F' })
    atualizarAluno(aluno.id, { numero: '20' })
    const aviso = getDb().historico.at(-1)!
    expect(aviso.avisarCoordenacao).toBe(true)
    expect(Object.keys(aviso.campos!)).toEqual(['sexo', 'numero'])
    atualizarAluno(aluno.id, { sexo: aluno.sexo, numero: '2' })
    expect(getDb().historico.some((e) => e.id === aviso.id)).toBe(false)
  })

  it('não avisa nada se o professor inclui e exclui o mesmo aluno no mesmo dia', () => {
    comoProfessor()
    const antes = getDb().historico.length
    const id = novoId('alu')
    criarAluno(turmaId, id, { numero: '18' })
    atualizarAluno(id, { iniciais: 'xx' })
    excluirCadastroDoAluno(id)
    expect(getDb().historico).toHaveLength(antes)
    expect(getDb().alunos.some((a) => a.id === id)).toBe(false)
  })

  it('não avisa a coordenação do que ela mesma mudou, e marca os avisos como vistos', () => {
    comoCoordenacao()
    const aluno = getDb().alunos.find((a) => a.turmaId === turmaId && a.numero === '3')!
    atualizarAluno(aluno.id, { anoIngresso: 2019 })
    expect(getDb().historico.at(-1)!.avisarCoordenacao).toBeUndefined()
    const pendentes = getDb().historico.filter((e) => e.avisarCoordenacao && !e.ciente).map((e) => e.id)
    marcarCiente(pendentes)
    expect(getDb().historico.filter((e) => e.avisarCoordenacao && !e.ciente)).toHaveLength(0)
  })
})

describe('links de acesso', () => {
  it('manda o link quando o professor é cadastrado, e um link novo quando o e-mail é corrigido', () => {
    comoCoordenacao()
    const { id, emailEnviado } = criarProfessor(PESSOAS_DE_TESTE.colegioId, { nome: 'Rita Lopes', email: 'rita@colegio.example' })
    expect(emailEnviado).toBe('rita@colegio.example')
    const primeiro = getDb().professores.find((p) => p.id === id)!.token
    expect(getDb().emails.at(-1)).toMatchObject({ para: 'rita@colegio.example', token: primeiro })
    expect(pessoaPorToken(getDb(), primeiro)).toMatchObject({ papel: 'professor', professorId: id })

    expect(editarProfessor(id, { nome: 'Rita Lopes', email: 'rita.lopes@colegio.example' }).emailEnviado).toBe('rita.lopes@colegio.example')
    const segundo = getDb().professores.find((p) => p.id === id)!.token
    expect(segundo).not.toBe(primeiro)
    expect(pessoaPorToken(getDb(), primeiro)).toBeNull()
    expect(editarProfessor(id, { nome: 'Rita C. Lopes', email: 'rita.lopes@colegio.example' }).emailEnviado).toBeNull()
  })
})

describe('prova excluída com respostas', () => {
  it('fica arquivada, com as respostas por colégio, e a coordenação é avisada', () => {
    definirPerfil({ papel: 'solar', membroId: PESSOAS_DE_TESTE.membroSolarId })
    const db = getDb()
    const caderno = db.cadernos.find((c) => db.lancamentos.some((l) => l.cadernoId === c.id && Object.keys(l.respostas).length))!
    const respostas = respostasPorColegio(db, painelDosDados(db).turmas, caderno.id)
    expect(respostas.length).toBeGreaterThan(0)
    expect(respostas.reduce((s, r) => s + r.alunos, 0)).toBeGreaterThan(0)
    const avisosAntes = getDb().historico.filter((e) => e.avisarCoordenacao).length
    removerCaderno(caderno.id, respostas)
    const depois = getDb()
    expect(depois.cadernos.some((c) => c.id === caderno.id)).toBe(false)
    expect(depois.lancamentos.some((l) => l.cadernoId === caderno.id)).toBe(false)
    expect(depois.excluidas).toHaveLength(1)
    expect(depois.excluidas[0]).toMatchObject({ cadernoId: caderno.id, serie: caderno.serie, colegios: respostas, questoes: caderno.questoes.length })
    const avisos = depois.historico.filter((e) => e.avisarCoordenacao)
    expect(avisos).toHaveLength(avisosAntes + respostas.length)
    expect(avisos.at(-1)!.texto).toBe(textoAvisoExclusao(caderno, depois.excluidas[0]!.avaliacaoTitulo, respostas.at(-1)!))
    expect(avisos.at(-1)!.turmaId).toBeNull()
  })

  it('sem respostas, sai de vez', () => {
    const caderno = getDb().cadernos[0]!
    removerCaderno(caderno.id)
    expect(getDb().excluidas).toHaveLength(0)
  })

  it('pede a frase, sem olhar maiúsculas, acentos e espaços a mais', () => {
    expect(fraseParaExcluirProva({ serie: 5, disciplina: 'Português' })).toBe('excluir prova portugues quinto ano')
    expect(fraseConfere('  Excluir prova  Português quinto ano ', 'excluir prova portugues quinto ano')).toBe(true)
    expect(fraseConfere('excluir prova portugues quarto ano', 'excluir prova portugues quinto ano')).toBe(false)
  })
})
