import type { Draft } from 'immer'
import { disciplinasDoCaderno, gerarDadosExemplo } from '../data/seed'
import { idLancamento, pessoaDoPerfil } from '../lib/consultas'
import { agoraIso, hojeIso, serieNome, turmaNome } from '../lib/formato'
import { alunoEmTexto, iniciaisDoNome, normalizarIniciais, pareceNome } from '../lib/iniciais'
import { NOMES_MOTIVO } from '../lib/pedidos'
import {
  LETRAS,
  VAZIO,
  type Aluno,
  type Caderno,
  type Colegio,
  type Contato,
  type Db,
  type Id,
  type Lancamento,
  type Letra,
  type MotivoSaida,
  type PapelSolar,
  type Pedido,
  type Questao,
  type Serie,
  type Situacao,
  type Turma,
} from '../types'
import { apagarPdf, apagarTodosPdfs, salvarPdf } from './arquivos'
import { atualizar, getDb, substituirDados } from './db'
import { getPerfil } from './perfil'

export function novoId(prefixo: string): Id {
  const sufixo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefixo}-${sufixo}`
}

/** Nome de quem está usando o site, para o histórico e para as decisões dos pedidos. */
export function autorAtual(): string {
  const perfil = getPerfil()
  return (perfil && pessoaDoPerfil(getDb(), perfil)?.nome) ?? 'Alguém'
}

function registrar(db: Draft<Db>, texto: string, onde: { colegioId?: Id | null; turmaId?: Id | null; cadernoId?: Id | null; avisarTurmas?: boolean } = {}) {
  db.historico.push({
    id: novoId('ev'),
    em: agoraIso(),
    por: autorAtual(),
    colegioId: onde.colegioId ?? null,
    turmaId: onde.turmaId ?? null,
    cadernoId: onde.cadernoId ?? null,
    texto,
    ...(onde.avisarTurmas ? { avisarTurmas: true } : {}),
  })
}

const descreverTurma = (db: Draft<Db>, turmaId: Id) => {
  const turma = db.turmas.find((t) => t.id === turmaId)
  return turma ? turmaNome(turma) : 'turma'
}
const colegioDaTurma = (db: Draft<Db>, turmaId: Id) => db.turmas.find((t) => t.id === turmaId)?.colegioId ?? null

// Colégios e coordenação

export type DadosColegio = Omit<Colegio, 'id'>

export function criarColegio(dados: DadosColegio, responsavel: Contato | null): Id {
  const id = novoId('col')
  atualizar((db) => {
    db.colegios.push({ id, ...dados })
    if (responsavel?.nome) db.coordenadores.push({ id: novoId('coord'), colegioId: id, ...responsavel, responsavel: true })
    registrar(db, `Cadastrou o ${dados.nome}${responsavel?.nome ? `, com ${responsavel.nome} como responsável pela coordenação` : ''}.`, { colegioId: id })
  })
  return id
}

export function editarColegio(id: Id, dados: DadosColegio) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === id)
    if (colegio) Object.assign(colegio, dados)
  })
}

/** A Solar define quem responde pela coordenação. Quem era responsável continua na equipe, sem o papel. */
export function definirResponsavelDoColegio(colegioId: Id, contato: Contato) {
  atualizar((db) => {
    const equipe = db.coordenadores.filter((c) => c.colegioId === colegioId)
    equipe.forEach((c) => (c.responsavel = false))
    const existente = equipe.find((c) => contato.email && c.email.toLowerCase() === contato.email.toLowerCase())
    if (existente) Object.assign(existente, contato, { responsavel: true })
    else db.coordenadores.push({ id: novoId('coord'), colegioId, ...contato, responsavel: true })
    registrar(db, `Definiu ${contato.nome} como responsável pela coordenação.`, { colegioId })
  })
}

export function adicionarCoordenador(colegioId: Id, contato: Contato) {
  atualizar((db) => {
    db.coordenadores.push({ id: novoId('coord'), colegioId, ...contato, responsavel: false })
    registrar(db, `Incluiu ${contato.nome} na equipe da coordenação.`, { colegioId })
  })
}

export function editarCoordenador(id: Id, contato: Contato) {
  atualizar((db) => {
    const pessoa = db.coordenadores.find((c) => c.id === id)
    if (pessoa) Object.assign(pessoa, contato)
  })
}

export function removerCoordenador(id: Id) {
  atualizar((db) => {
    const pessoa = db.coordenadores.find((c) => c.id === id)
    if (!pessoa || pessoa.responsavel) return
    db.coordenadores = db.coordenadores.filter((c) => c.id !== id)
    registrar(db, `Tirou ${pessoa.nome} da equipe da coordenação.`, { colegioId: pessoa.colegioId })
  })
}

/** O responsável passa o papel para outra pessoa da equipe e continua na equipe sem ele. */
export function passarResponsabilidade(novoResponsavelId: Id) {
  atualizar((db) => {
    const novo = db.coordenadores.find((c) => c.id === novoResponsavelId)
    if (!novo) return
    db.coordenadores.filter((c) => c.colegioId === novo.colegioId).forEach((c) => (c.responsavel = c.id === novo.id))
    registrar(db, `Passou a responsabilidade pela coordenação para ${novo.nome}.`, { colegioId: novo.colegioId })
  })
}

// Equipe Solar

export function adicionarMembroSolar(contato: Contato, papel: Exclude<PapelSolar, 'responsavel'>) {
  atualizar((db) => {
    db.equipeSolar.push({ id: novoId('solar'), ...contato, papel })
    registrar(db, `Incluiu ${contato.nome} na equipe Solar, com ${papel === 'edicao' ? 'permissão de edição' : 'permissão só de visualização'}.`)
  })
}

export function editarMembroSolar(id: Id, contato: Contato) {
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (membro) Object.assign(membro, contato)
  })
}

export function mudarPapelSolar(id: Id, papel: Exclude<PapelSolar, 'responsavel'>) {
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro || membro.papel === 'responsavel') return
    membro.papel = papel
    registrar(db, `${membro.nome} passou a ter ${papel === 'edicao' ? 'permissão de edição' : 'permissão só de visualização'}.`)
  })
}

export function removerMembroSolar(id: Id) {
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro || membro.papel === 'responsavel') return
    db.equipeSolar = db.equipeSolar.filter((m) => m.id !== id)
    registrar(db, `Tirou ${membro.nome} da equipe Solar.`)
  })
}

/** Quem era responsável passa a ter permissão de edição. */
export function passarResponsabilidadeSolar(id: Id) {
  atualizar((db) => {
    const novo = db.equipeSolar.find((m) => m.id === id)
    if (!novo) return
    for (const membro of db.equipeSolar) {
      if (membro.papel === 'responsavel') membro.papel = 'edicao'
    }
    novo.papel = 'responsavel'
    registrar(db, `Passou a responsabilidade pela equipe Solar para ${novo.nome}.`)
  })
}

// Professores

export function criarProfessor(colegioId: Id, dados: { nome: string; email: string }): Id {
  const id = novoId('prof')
  atualizar((db) => {
    db.professores.push({ id, colegioId, ...dados, ativo: true })
    registrar(db, `Cadastrou ${dados.nome} como professor(a).`, { colegioId })
  })
  return id
}

export function editarProfessor(id: Id, dados: { nome: string; email: string }) {
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id)
    if (professor) Object.assign(professor, dados)
  })
}

/** Quem sai do colégio perde o acesso e sai das turmas do ano, mas o nome continua no histórico. */
export function desativarProfessor(id: Id) {
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id)
    if (!professor) return
    professor.ativo = false
    const turmas = db.turmas.filter((t) => t.anoLetivo === db.config.anoLetivo && t.professorIds.includes(id))
    for (const turma of turmas) turma.professorIds = turma.professorIds.filter((pid) => pid !== id)
    const sem = turmas.filter((t) => !t.professorIds.length).map(turmaNome)
    registrar(db, `Desativou o acesso de ${professor.nome}.${sem.length ? ` ${sem.join(', ')} ${sem.length > 1 ? 'ficaram' : 'ficou'} sem professor.` : ''}`, {
      colegioId: professor.colegioId,
    })
  })
}

export function reativarProfessor(id: Id) {
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id)
    if (!professor) return
    professor.ativo = true
    registrar(db, `Reativou o acesso de ${professor.nome}.`, { colegioId: professor.colegioId })
  })
}

// Turmas

export type DadosTurma = Pick<Turma, 'serie' | 'nome' | 'turno' | 'professorIds'>

export function criarTurma(colegioId: Id, dados: DadosTurma): Id {
  const id = novoId('tur')
  atualizar((db) => {
    db.turmas.push({ id, colegioId, anoLetivo: db.config.anoLetivo, ...dados })
    registrar(db, `Criou a turma ${turmaNome(dados)}.`, { colegioId, turmaId: id })
  })
  return id
}

export function editarTurma(id: Id, dados: DadosTurma) {
  atualizar((db) => {
    const turma = db.turmas.find((t) => t.id === id)
    if (turma) Object.assign(turma, dados)
  })
}

export function definirProfessoresDaTurma(turmaId: Id, professorIds: Id[]) {
  atualizar((db) => {
    const turma = db.turmas.find((t) => t.id === turmaId)
    if (!turma) return
    turma.professorIds = professorIds
    const nomes = professorIds.map((id) => db.professores.find((p) => p.id === id)?.nome).filter(Boolean)
    registrar(db, `${turmaNome(turma)}: ${nomes.length ? `professores agora são ${nomes.join(', ')}` : 'ficou sem professor'}.`, {
      colegioId: turma.colegioId,
      turmaId,
    })
  })
}

export function removerTurma(id: Id) {
  atualizar((db) => {
    db.turmas = db.turmas.filter((t) => t.id !== id)
    db.alunos = db.alunos.filter((a) => a.turmaId !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.turmaId !== id)
    db.pedidos = db.pedidos.filter((p) => p.turmaId !== id)
  })
}

// Alunos

const ANO_MINIMO_INGRESSO = 1990

export interface LinhaLida {
  /** A linha como foi colada; aparece só na tela de conferência e não é salva. */
  original: string
  nome: string
  numero: number | null
  anoIngresso: number | null
}

/** "A.C.S.", "A. C. S." ou "ACS": a pessoa já colou as iniciais, não o nome. */
const jaSaoIniciais = (texto: string) => /^\p{L}(\.\s?\p{L})+\.?$/u.test(texto.trim()) || /^[A-Z]{2,5}$/.test(texto.trim())

/**
 * Lê alunos colados de uma planilha ou lista: um por linha, com o número de chamada opcional na
 * primeira coluna ("7;Maria Souza") ou no começo ("7. Maria Souza") e o ano de entrada no colégio
 * opcional em outra coluna ("Maria Souza;2023") ou no fim ("Maria Souza 2023"). Ignora cabeçalhos.
 */
export function lerListaDeAlunos(texto: string, anoMaximo: number): LinhaLida[] {
  const ehAno = (valor: string) => /^\d{4}$/.test(valor) && Number(valor) >= ANO_MINIMO_INGRESSO && Number(valor) <= anoMaximo + 1
  const linhas: LinhaLida[] = []
  for (const original of texto.split(/\r?\n/)) {
    const celulas = original.split(/\t|;/).map((c) => c.trim())
    const celulaNumero = celulas.find((c) => /^\d{1,3}$/.test(c))
    const celulaAno = celulas.find(ehAno)
    let celulaNome = celulas.find((c) => /\p{L}/u.test(c)) ?? ''
    let numero = celulaNumero ? Number(celulaNumero) : null
    let anoIngresso = celulaAno ? Number(celulaAno) : null
    const anoNoFim = celulaNome.match(/\s(\d{4})$/)
    if (anoNoFim && ehAno(anoNoFim[1])) {
      anoIngresso ??= Number(anoNoFim[1])
      celulaNome = celulaNome.slice(0, anoNoFim.index)
    }
    const numeroNoComeco = celulaNome.match(/^(\d{1,3})\s*[.)\-–]?\s+/)
    if (numeroNoComeco) {
      numero ??= Number(numeroNoComeco[1])
      celulaNome = celulaNome.slice(numeroNoComeco[0].length)
    }
    const nome = celulaNome.replace(/\s+/g, ' ').trim()
    if (nome && !/^(nome|aluno|aluna|nome do aluno|estudante|iniciais)s?$/i.test(nome)) {
      linhas.push({ original: original.trim(), nome, numero: numero && numero > 0 ? numero : null, anoIngresso })
    }
  }
  return linhas
}

export interface DadosAluno {
  iniciais: string
  numero: number
  anoIngresso: number | null
}

export interface LinhaConferida extends DadosAluno {
  original: string
  /** Impede o cadastro: número repetido ou iniciais que não deu para tirar do nome. */
  problema: string | null
  /** Só um aviso: outro aluno da turma tem as mesmas iniciais. */
  iniciaisRepetidas: boolean
}

/** Números já usados na turma: alunos que estão nela e quem já tem prova lançada com aquele número. */
export function numerosUsados(db: Db, turmaId: Id, ignorarAlunoId?: Id): Map<number, Aluno> {
  const usados = new Map<number, Aluno>()
  for (const aluno of db.alunos) {
    if (aluno.id !== ignorarAlunoId && aluno.turmaId === turmaId && aluno.ativo) usados.set(aluno.numero, aluno)
  }
  for (const lancamento of db.lancamentos) {
    if (lancamento.turmaId !== turmaId) continue
    for (const [alunoId, resposta] of Object.entries(lancamento.respostas)) {
      if (alunoId === ignorarAlunoId || resposta.numero == null || usados.has(resposta.numero)) continue
      const aluno = db.alunos.find((a) => a.id === alunoId)
      if (aluno) usados.set(resposta.numero, aluno)
    }
  }
  return usados
}

export const proximoNumero = (db: Db, turmaId: Id) => Math.max(0, ...numerosUsados(db, turmaId).keys()) + 1

/**
 * Converte a lista colada no que vai ser salvo: iniciais, número e ano de entrada. Quem vem sem número
 * recebe o próximo livre, na ordem da lista.
 */
export function conferirLista(db: Db, turmaId: Id, lidas: LinhaLida[], anoPadrao: number | null): LinhaConferida[] {
  const usados = numerosUsados(db, turmaId)
  const naLista = new Map<number, number>()
  for (const l of lidas) if (l.numero != null) naLista.set(l.numero, (naLista.get(l.numero) ?? 0) + 1)
  let proximo = Math.max(0, ...usados.keys(), ...naLista.keys())
  const linhas = lidas.map((l): LinhaConferida => {
    const iniciais = jaSaoIniciais(l.nome) ? (normalizarIniciais(l.nome) ?? '') : iniciaisDoNome(l.nome)
    const numero = l.numero ?? ++proximo
    let problema: string | null = null
    if (!iniciais) problema = 'Não deu para tirar as iniciais deste nome.'
    else if (l.numero != null && usados.has(l.numero)) problema = `O nº ${l.numero} já é de ${usados.get(l.numero)!.iniciais}`
    else if (l.numero != null && naLista.get(l.numero)! > 1) problema = `O nº ${l.numero} aparece mais de uma vez na lista.`
    return { original: l.original, iniciais, numero, anoIngresso: l.anoIngresso ?? anoPadrao, problema, iniciaisRepetidas: false }
  })
  const contagem = new Map<string, number>()
  for (const iniciais of [...[...usados.values()].map((a) => a.iniciais), ...linhas.map((l) => l.iniciais)]) contagem.set(iniciais, (contagem.get(iniciais) ?? 0) + 1)
  for (const linha of linhas) linha.iniciaisRepetidas = (contagem.get(linha.iniciais) ?? 0) > 1
  return linhas
}

/** Confere iniciais digitadas à mão. Devolve o texto do erro, ou null se estiver tudo certo. */
export function validarIniciais(texto: string): string | null {
  if (pareceNome(texto)) return 'Digite só as iniciais, como A.C.S. O site não guarda o nome completo.'
  if (!normalizarIniciais(texto)) return 'Use só letras, como A.C.S. (de 1 a 6 letras).'
  return null
}

export function adicionarAlunos(turmaId: Id, novos: DadosAluno[]) {
  atualizar((db) => {
    for (const dados of novos) db.alunos.push({ id: novoId('alu'), turmaId, ...dados, ativo: true })
    registrar(db, `Incluiu ${novos.length === 1 ? `o ${alunoEmTexto(novos[0])}` : `${novos.length} alunos`} na lista.`, {
      colegioId: colegioDaTurma(db, turmaId),
      turmaId,
    })
  })
}

function descreverMudancas(antes: DadosAluno, depois: DadosAluno): string[] {
  const mudancas: string[] = []
  if (antes.numero !== depois.numero) mudancas.push(`número de ${antes.numero} para ${depois.numero}`)
  if (antes.iniciais !== depois.iniciais) mudancas.push(`iniciais de ${antes.iniciais} para ${depois.iniciais}`)
  if (antes.anoIngresso !== depois.anoIngresso) mudancas.push(`ano de entrada de ${antes.anoIngresso ?? 'não informado'} para ${depois.anoIngresso ?? 'não informado'}`)
  return mudancas
}

export function editarAluno(id: Id, dados: DadosAluno) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    const mudancas = descreverMudancas(aluno, dados)
    Object.assign(aluno, dados)
    if (mudancas.length) registrar(db, `Corrigiu o ${alunoEmTexto(aluno)}: ${mudancas.join(', ')}.`, { colegioId: colegioDaTurma(db, aluno.turmaId), turmaId: aluno.turmaId })
  })
}

/** Preenche o ano de entrada de todos os alunos ativos da turma que ainda estão sem ele. */
export function definirIngressoDosSemAno(turmaId: Id, anoIngresso: number) {
  atualizar((db) => {
    let quantos = 0
    for (const aluno of db.alunos) {
      if (aluno.turmaId === turmaId && aluno.ativo && aluno.anoIngresso == null) {
        aluno.anoIngresso = anoIngresso
        quantos++
      }
    }
    registrar(db, `Preencheu o ano de entrada (${anoIngresso}) de ${quantos === 1 ? '1 aluno' : `${quantos} alunos`} que estavam sem ele.`, {
      colegioId: colegioDaTurma(db, turmaId),
      turmaId,
    })
  })
}

function saida(db: Draft<Db>, aluno: Draft<Aluno>, motivo: MotivoSaida) {
  aluno.ativo = false
  aluno.saida = { em: hojeIso(), motivo }
  registrar(db, `Registrou a saída do ${alunoEmTexto(aluno)}: ${NOMES_MOTIVO[motivo].toLowerCase()}.`, {
    colegioId: colegioDaTurma(db, aluno.turmaId),
    turmaId: aluno.turmaId,
  })
}

/** O aluno sai da lista; as respostas já lançadas continuam nos resultados. */
export function registrarSaida(id: Id, motivo: MotivoSaida) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (aluno) saida(db, aluno, motivo)
  })
}

export const temRespostas = (db: Db, alunoId: Id) => db.lancamentos.some((l) => l.respostas[alunoId])

/** Para cadastro feito por engano: só vale para quem ainda não tem respostas lançadas. */
export function excluirCadastroDoAluno(id: Id) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno || db.lancamentos.some((l) => l.respostas[id])) return
    db.alunos = db.alunos.filter((a) => a.id !== id)
    db.pedidos = db.pedidos.filter((p) => p.alunoId !== id || p.situacao !== 'pendente')
    registrar(db, `Excluiu o cadastro do ${alunoEmTexto(aluno)}, feito por engano.`, { colegioId: colegioDaTurma(db, aluno.turmaId), turmaId: aluno.turmaId })
  })
}

/** O aluno volta com o número que tinha; se outro aluno já estiver com ele, recebe o próximo livre. Devolve o número. */
export function reativarAluno(id: Id): number | null {
  const db = getDb()
  const aluno = db.alunos.find((a) => a.id === id)
  if (!aluno) return null
  const usados = numerosUsados(db, aluno.turmaId, aluno.id)
  const numero = usados.has(aluno.numero) ? Math.max(0, ...usados.keys()) + 1 : aluno.numero
  atualizar((rascunho) => {
    const a = rascunho.alunos.find((x) => x.id === id)!
    a.ativo = true
    a.numero = numero
    delete a.saida
    registrar(rascunho, `O ${alunoEmTexto(a)} voltou para a lista da turma.`, { colegioId: colegioDaTurma(rascunho, a.turmaId), turmaId: a.turmaId })
  })
  return numero
}

/** As respostas já lançadas ficam na turma antiga; na nova, o aluno recebe o próximo número livre. Devolve o número. */
export function mudarDeTurma(id: Id, novaTurmaId: Id): number | null {
  const db = getDb()
  const aluno = db.alunos.find((a) => a.id === id)
  if (!aluno || aluno.turmaId === novaTurmaId) return null
  const numero = proximoNumero(db, novaTurmaId)
  atualizar((rascunho) => {
    const a = rascunho.alunos.find((x) => x.id === id)!
    const antiga = a.turmaId
    const texto = `Mudou o ${alunoEmTexto(a)} do ${descreverTurma(rascunho, antiga)} para o ${descreverTurma(rascunho, novaTurmaId)}, onde ficou com o nº ${numero}.`
    a.turmaId = novaTurmaId
    a.numero = numero
    registrar(rascunho, texto, { colegioId: colegioDaTurma(rascunho, antiga), turmaId: antiga })
    registrar(rascunho, texto, { colegioId: colegioDaTurma(rascunho, novaTurmaId), turmaId: novaTurmaId })
  })
  return numero
}

// Pedidos dos professores à coordenação

function professorAtualId(): Id | null {
  const perfil = getPerfil()
  return perfil?.papel === 'professor' ? perfil.professorId : null
}

function novoPedido(db: Draft<Db>, tipo: Pedido['tipo'], turmaId: Id, alunoId: Id, extra: Partial<Pedido>) {
  db.pedidos.push({
    id: novoId('ped'),
    tipo,
    colegioId: colegioDaTurma(db, turmaId) ?? '',
    turmaId,
    alunoId,
    professorId: professorAtualId() ?? '',
    criadoEm: agoraIso(),
    situacao: 'pendente',
    ...extra,
  })
}

/** O aluno entra na hora, como pendente: o professor já pode lançar a prova dele. Devolve o id do aluno. */
export function pedirInclusao(turmaId: Id, dados: DadosAluno): Id {
  const alunoId = novoId('alu')
  atualizar((db) => {
    db.alunos.push({ id: alunoId, turmaId, ...dados, ativo: true, pendente: true })
    novoPedido(db, 'incluir', turmaId, alunoId, { ...dados })
  })
  return alunoId
}

export function pedirSaida(alunoId: Id, motivoSaida: MotivoSaida) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === alunoId)
    if (aluno) novoPedido(db, 'saida', aluno.turmaId, alunoId, { motivoSaida })
  })
}

export function pedirCorrecao(alunoId: Id, dados: DadosAluno) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === alunoId)
    if (aluno) novoPedido(db, 'correcao', aluno.turmaId, alunoId, { ...dados })
  })
}

function apagarAlunoPendente(db: Draft<Db>, alunoId: Id) {
  db.alunos = db.alunos.filter((a) => a.id !== alunoId)
  for (const lancamento of db.lancamentos) delete lancamento.respostas[alunoId]
}

export function cancelarPedido(id: Id) {
  atualizar((db) => {
    const pedido = db.pedidos.find((p) => p.id === id)
    if (!pedido || pedido.situacao !== 'pendente') return
    pedido.situacao = 'cancelado'
    if (pedido.tipo === 'incluir') apagarAlunoPendente(db, pedido.alunoId)
  })
}

/** Aplica o pedido. Devolve o texto do erro se não for possível (número já usado por outro aluno). */
export function aprovarPedido(id: Id): string | null {
  const db = getDb()
  const pedido = db.pedidos.find((p) => p.id === id)
  if (!pedido || pedido.situacao !== 'pendente') return null
  const aluno = db.alunos.find((a) => a.id === pedido.alunoId)
  if (!aluno) return 'Este aluno não está mais na lista.'
  if (pedido.tipo !== 'saida' && pedido.numero != null) {
    const outro = numerosUsados(db, pedido.turmaId, aluno.id).get(pedido.numero)
    if (outro) return `O nº ${pedido.numero} já é de ${outro.iniciais} Recuse o pedido ou corrija o número na lista da turma antes de aprovar.`
  }
  const professor = db.professores.find((p) => p.id === pedido.professorId)?.nome ?? 'professor(a)'
  atualizar((rascunho) => {
    const p = rascunho.pedidos.find((x) => x.id === id)!
    const a = rascunho.alunos.find((x) => x.id === p.alunoId)!
    p.situacao = 'aprovado'
    p.decisao = { por: autorAtual(), em: agoraIso() }
    const onde = { colegioId: p.colegioId, turmaId: p.turmaId }
    if (p.tipo === 'incluir') {
      delete a.pendente
      registrar(rascunho, `Aprovou a inclusão do ${alunoEmTexto(a)}, pedida por ${professor}.`, onde)
    } else if (p.tipo === 'saida') {
      saida(rascunho, a, p.motivoSaida ?? 'outro')
    } else {
      const novos = { iniciais: p.iniciais ?? a.iniciais, numero: p.numero ?? a.numero, anoIngresso: p.anoIngresso === undefined ? a.anoIngresso : p.anoIngresso }
      const mudancas = descreverMudancas(a, novos)
      Object.assign(a, novos)
      registrar(rascunho, `Corrigiu o ${alunoEmTexto(a)} a pedido de ${professor}: ${mudancas.join(', ') || 'sem mudanças'}.`, onde)
    }
  })
  return null
}

export function recusarPedido(id: Id, motivo: string) {
  atualizar((db) => {
    const pedido = db.pedidos.find((p) => p.id === id)
    if (!pedido || pedido.situacao !== 'pendente') return
    pedido.situacao = 'recusado'
    pedido.decisao = { por: autorAtual(), em: agoraIso(), motivo }
    if (pedido.tipo === 'incluir') apagarAlunoPendente(db, pedido.alunoId)
  })
}

// Avaliações e provas

export type DadosAvaliacao = Pick<Db['avaliacoes'][number], 'titulo' | 'aplicacaoInicio' | 'aplicacaoFim' | 'prazoLancamento'>

function cadernoEmBranco(avaliacaoId: Id, serie: Serie): Caderno {
  return {
    id: novoId('cad'),
    avaliacaoId,
    serie,
    numAlternativas: 4,
    usaFolhaRespostas: serie >= 3,
    questoes: disciplinasDoCaderno(serie).map((disciplina) => ({ gabarito: null, disciplina, habilidade: null, anulada: false })),
    pdf: null,
    conferencia: null,
  }
}

export function criarAvaliacao(dados: DadosAvaliacao, series: Serie[]): Id {
  const id = novoId('av')
  atualizar((db) => {
    db.avaliacoes.push({ id, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)), ...dados })
    for (const serie of series) db.cadernos.push(cadernoEmBranco(id, serie))
    registrar(db, `Criou a ${dados.titulo}.`)
  })
  return id
}

export function editarAvaliacao(id: Id, dados: DadosAvaliacao) {
  atualizar((db) => {
    const avaliacao = db.avaliacoes.find((a) => a.id === id)
    if (avaliacao) Object.assign(avaliacao, { ...dados, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)) })
  })
}

export function removerAvaliacao(id: Id) {
  const cadernos = getDb().cadernos.filter((c) => c.avaliacaoId === id).map((c) => c.id)
  atualizar((db) => {
    const titulo = db.avaliacoes.find((a) => a.id === id)?.titulo
    db.avaliacoes = db.avaliacoes.filter((a) => a.id !== id)
    db.cadernos = db.cadernos.filter((c) => c.avaliacaoId !== id)
    db.lancamentos = db.lancamentos.filter((l) => !cadernos.includes(l.cadernoId))
    registrar(db, `Excluiu a ${titulo ?? 'avaliação'}.`)
  })
  cadernos.forEach((c) => apagarPdf(c).catch(() => {}))
}

export function adicionarCaderno(avaliacaoId: Id, serie: Serie): Id {
  const caderno = cadernoEmBranco(avaliacaoId, serie)
  atualizar((db) => {
    db.cadernos.push(caderno)
  })
  return caderno.id
}

export function removerCaderno(id: Id) {
  atualizar((db) => {
    db.cadernos = db.cadernos.filter((c) => c.id !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.cadernoId !== id)
  })
  apagarPdf(id).catch(() => {})
}

function comCaderno(id: Id, alterar: (caderno: Draft<Caderno>, db: Draft<Db>) => void) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === id)
    if (caderno) alterar(caderno, db)
  })
}

export const temRespostasNaProva = (db: Db, cadernoId: Id) =>
  db.lancamentos.some((l) => l.cadernoId === cadernoId && Object.keys(l.respostas).length > 0)

export function definirAlternativas(id: Id, numAlternativas: 4 | 5) {
  comCaderno(id, (caderno) => {
    caderno.numAlternativas = numAlternativas
    const permitidas: readonly string[] = LETRAS.slice(0, numAlternativas)
    for (const q of caderno.questoes) if (q.gabarito && !permitidas.includes(q.gabarito)) q.gabarito = null
    caderno.conferencia = null
  })
}

export function definirFolhaRespostas(id: Id, usa: boolean) {
  comCaderno(id, (caderno) => {
    caderno.usaFolhaRespostas = usa
  })
}

export function definirNumeroDeQuestoes(id: Id, total: number) {
  comCaderno(id, (caderno) => {
    const ultima = caderno.questoes.at(-1)
    while (caderno.questoes.length < total) {
      caderno.questoes.push({ gabarito: null, disciplina: ultima?.disciplina ?? 'Português', habilidade: null, anulada: false })
    }
    caderno.questoes.splice(total)
    caderno.conferencia = null
  })
}

const nomeDaProva = (caderno: Draft<Caderno>, db: Draft<Db>) =>
  `prova do ${serieNome(caderno.serie)} (${db.avaliacoes.find((a) => a.id === caderno.avaliacaoId)?.titulo ?? 'avaliação'})`

/**
 * Muda uma questão. Gabarito e anulação desfazem a conferência do gabarito; se já houver respostas
 * lançadas, a mudança entra no histórico com o motivo, e as turmas daquele ano veem o aviso.
 */
export function editarQuestao(cadernoId: Id, indice: number, alteracao: Partial<Questao>, motivo?: string) {
  comCaderno(cadernoId, (caderno, db) => {
    const questao = caderno.questoes[indice]
    if (!questao) return
    const mudaCorrecao =
      ('gabarito' in alteracao && alteracao.gabarito !== questao.gabarito) || ('anulada' in alteracao && alteracao.anulada !== questao.anulada)
    const antes = { gabarito: questao.gabarito, anulada: questao.anulada }
    Object.assign(questao, alteracao)
    if (!mudaCorrecao) return
    caderno.conferencia = null
    if (!db.lancamentos.some((l) => l.cadernoId === cadernoId && Object.keys(l.respostas).length)) return
    const prova = nomeDaProva(caderno, db)
    let texto: string
    if (antes.anulada !== questao.anulada) texto = `${questao.anulada ? 'Anulou a' : 'Desfez a anulação da'} questão ${indice + 1} da ${prova}`
    else texto = `Mudou o gabarito da questão ${indice + 1} da ${prova}, de ${antes.gabarito ?? 'nenhum'} para ${questao.gabarito ?? 'nenhum'}`
    registrar(db, `${texto}${motivo ? `. Motivo: ${motivo}` : ''}. Os resultados foram recalculados.`, { cadernoId, avisarTurmas: true })
  })
}

/** Preenche o gabarito a partir de uma sequência como "BDACB..."; espaços e vírgulas são ignorados. */
export function aplicarGabarito(cadernoId: Id, letras: Letra[], motivo?: string) {
  comCaderno(cadernoId, (caderno, db) => {
    const mudadas: number[] = []
    letras.slice(0, caderno.questoes.length).forEach((letra, i) => {
      if (caderno.questoes[i].gabarito !== letra) mudadas.push(i + 1)
      caderno.questoes[i].gabarito = letra
    })
    if (!mudadas.length) return
    caderno.conferencia = null
    if (db.lancamentos.some((l) => l.cadernoId === cadernoId && Object.keys(l.respostas).length)) {
      registrar(db, `Mudou o gabarito das questões ${mudadas.join(', ')} da ${nomeDaProva(caderno, db)}${motivo ? `. Motivo: ${motivo}` : ''}. Os resultados foram recalculados.`, { cadernoId, avisarTurmas: true })
    }
  })
}

/** Marca o gabarito como conferido com a prova impressa. */
export function conferirGabarito(cadernoId: Id) {
  comCaderno(cadernoId, (caderno, db) => {
    caderno.conferencia = { por: autorAtual(), em: agoraIso() }
    registrar(db, `Conferiu o gabarito da ${nomeDaProva(caderno, db)}.`, { cadernoId })
  })
}

export function editarComentario(cadernoId: Id, indice: number, letra: Letra, texto: string) {
  comCaderno(cadernoId, (caderno) => {
    const questao = caderno.questoes[indice]
    if (!questao) return
    const comentarios = { ...questao.comentarios }
    if (texto.trim()) comentarios[letra] = texto.trim()
    else delete comentarios[letra]
    questao.comentarios = comentarios
  })
}

export function editarComoRetomar(cadernoId: Id, indice: number, texto: string) {
  comCaderno(cadernoId, (caderno) => {
    const questao = caderno.questoes[indice]
    if (questao) questao.comoRetomar = texto.trim() || undefined
  })
}

export async function enviarPdf(cadernoId: Id, arquivo: File) {
  await salvarPdf(cadernoId, arquivo)
  comCaderno(cadernoId, (caderno) => {
    caderno.pdf = { nome: arquivo.name, tamanho: arquivo.size, origem: 'enviado', enviadoEm: agoraIso() }
  })
}

export function removerPdf(cadernoId: Id) {
  comCaderno(cadernoId, (caderno) => {
    caderno.pdf = null
  })
  apagarPdf(cadernoId).catch(() => {})
}

// Lançamento de respostas

function lancamentoPara(db: Draft<Db>, cadernoId: Id, turmaId: Id): Draft<Lancamento> {
  const id = idLancamento(cadernoId, turmaId)
  const existente = db.lancamentos.find((l) => l.id === id)
  if (existente) return existente
  const novo: Lancamento = { id, cadernoId, turmaId, respostas: {}, concluidoEm: null }
  db.lancamentos.push(novo)
  return novo
}

function respostaPara(db: Draft<Db>, lancamento: Draft<Lancamento>, alunoId: Id, situacao: Situacao) {
  const numero = db.alunos.find((a) => a.id === alunoId)?.numero
  return (lancamento.respostas[alunoId] ??= { situacao, marcas: '', atualizadoEm: '', numero })
}

export function marcarQuestao(cadernoId: Id, turmaId: Id, alunoId: Id, indice: number, marca: string, totalQuestoes: number) {
  atualizar((db) => {
    const resposta = respostaPara(db, lancamentoPara(db, cadernoId, turmaId), alunoId, 'presente')
    const marcas = resposta.marcas.padEnd(totalQuestoes, VAZIO).split('')
    marcas[indice] = marca
    resposta.marcas = marcas.join('')
    resposta.atualizadoEm = agoraIso()
  })
}

export function definirSituacao(cadernoId: Id, turmaId: Id, alunoId: Id, situacao: Situacao) {
  atualizar((db) => {
    const resposta = respostaPara(db, lancamentoPara(db, cadernoId, turmaId), alunoId, situacao)
    resposta.situacao = situacao
    resposta.atualizadoEm = agoraIso()
  })
}

export function concluirLancamento(cadernoId: Id, turmaId: Id) {
  atualizar((db) => {
    lancamentoPara(db, cadernoId, turmaId).concluidoEm = agoraIso()
    registrar(db, `Concluiu o lançamento das respostas do ${descreverTurma(db, turmaId)}.`, { colegioId: colegioDaTurma(db, turmaId), turmaId })
  })
}

// Configurações e dados

export function definirFaixas(faixas: [number, number, number]) {
  atualizar((db) => {
    db.config.faixas = faixas
    registrar(db, `Mudou as faixas de desempenho para Básico a partir de ${faixas[0]}%, Adequado a partir de ${faixas[1]}% e Avançado a partir de ${faixas[2]}%.`)
  })
}

export async function restaurarDadosDeExemplo() {
  substituirDados(gerarDadosExemplo())
  await apagarTodosPdfs().catch(() => {})
}
