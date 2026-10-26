import type { Draft } from 'immer'
import { gerarDadosExemplo, questoesDaProva } from '../data/seed'
import { textoMudancaAluno, valorDoCampo, type CampoAluno } from '../lib/alunos'
import { idLancamento, pessoaDoPerfil } from '../lib/consultas'
import { agoraIso, hojeIso, primeiroNome, provaNome, turmaNome } from '../lib/formato'
import { formatarIniciais } from '../lib/iniciais'
import {
  DISCIPLINAS_DA_PROVA,
  LETRAS,
  TEXTO_ARQUIVOU,
  VAZIO,
  type Aluno,
  type Caderno,
  type Colegio,
  type Contato,
  type Db,
  type Disciplina,
  type Evento,
  type Id,
  type Lancamento,
  type Letra,
  type MotivoSaida,
  type PapelSolar,
  type Questao,
  type RespostasDoColegio,
  type Serie,
  type Sexo,
  type Situacao,
  type TipoMudancaAluno,
  type Turma,
} from '../types'
import { PLATAFORMA } from '../plataforma/modo'
import { servidor } from '../plataforma/ponte'
import { apagarPdf, apagarTodosPdfs, salvarPdf } from './arquivos'
import { atualizar, getDb, substituirDados } from './db'
import { getPerfil } from './perfil'

// Cada ação muda os dados na hora (as telas respondem sem esperar) e, na plataforma, manda a mudança ao banco
// pela ponte (servidor()); na demonstração, servidor() é null e fica tudo no navegador. As regras de quem pode o
// quê ficam no banco: se ele recusar, a tela mostra o motivo e os dados voltam ao que estava lá.

/** Na plataforma, os ids são os do banco (uuid), criados aqui para a tela já ter o registro novo. */
export function novoId(prefixo: string): Id {
  if (PLATAFORMA) return crypto.randomUUID()
  const sufixo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefixo}-${sufixo}`
}

/** O colégio do perfil da coordenação (a mesma pessoa pode estar em mais de um colégio). */
const colegioDoPerfil = (): Id | null => {
  const perfil = getPerfil()
  return perfil && perfil.papel !== 'solar' ? perfil.colegioId : null
}

const papelNoBanco = (papel: PapelSolar) => `solar_${papel}`

const ALFABETO_TOKEN = 'abcdefghijkmnpqrstuvwxyz23456789'

/** Token do link de acesso: 20 caracteres sorteados, difícil de adivinhar. */
export function novoToken(): string {
  const bytes = new Uint8Array(20)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(bytes)
  else bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)))
  return Array.from(bytes, (b) => ALFABETO_TOKEN[b % ALFABETO_TOKEN.length]).join('')
}

/** Nome de quem está usando o site, para o histórico. */
export function autorAtual(): string {
  const perfil = getPerfil()
  return (perfil && pessoaDoPerfil(getDb(), perfil)?.nome) ?? 'Alguém'
}

type Onde = { colegioId?: Id | null; turmaId?: Id | null; cadernoId?: Id | null; avisarTurmas?: boolean }

function registrar(db: Draft<Db>, texto: string, onde: Onde = {}) {
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
const nomeDoColegio = (db: Draft<Db>, colegioId: Id) => db.colegios.find((c) => c.id === colegioId)?.nome ?? 'colégio'

// Links de acesso, enviados por e-mail. Nesta versão de teste o envio é simulado: o e-mail fica
// guardado em db.emails e aparece na página "E-mails enviados".

/** Endereço que entra no site direto na conta da pessoa. Não expira; mudar o e-mail gera outro. */
export function linkDeAcesso(token: string): string {
  const base = typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : ''
  return `${base}#/entrar/${token}`
}

type MotivoEmail = 'convite' | 'email_corrigido' | 'reenvio'

/** "Envia" o link de acesso e devolve o endereço para onde foi. */
function enviarLink(db: Draft<Db>, pessoa: { nome: string; email: string; token: string }, papel: string, motivo: MotivoEmail): string {
  const ola = `Olá, ${primeiroNome(pessoa.nome)}!`
  const guarde = 'O link é pessoal e não expira: guarde este e-mail e não o encaminhe a ninguém.'
  const texto = {
    convite: `${ola} ${autorAtual()} incluiu você na Prova Solar, o site da avaliação anual da Rede Solar, ${papel}. Para entrar, use o link abaixo: você entra direto na sua conta, sem senha. ${guarde}`,
    email_corrigido: `${ola} O e-mail da sua conta na Prova Solar (${papel}) foi corrigido para este endereço. Use o link abaixo para entrar. O link enviado antes não vale mais. ${guarde}`,
    reenvio: `${ola} Aqui está de novo o seu link de acesso à Prova Solar, ${papel}. ${guarde}`,
  }[motivo]
  db.emails.push({ id: novoId('email'), enviadoEm: agoraIso(), para: pessoa.email, nome: pessoa.nome, assunto: 'Seu acesso à Prova Solar', texto, token: pessoa.token })
  return pessoa.email
}

const papelDoCoordenador = (db: Draft<Db>, colegioId: Id, responsavel: boolean) =>
  `${responsavel ? 'como responsável pela coordenação' : 'na coordenação'} do ${nomeDoColegio(db, colegioId)}`
const papelDoProfessor = (db: Draft<Db>, colegioId: Id) => `como professor(a) do ${nomeDoColegio(db, colegioId)}`
const papelSolar = (papel: PapelSolar) =>
  `na equipe Solar, ${papel === 'responsavel' ? 'como pessoa responsável' : papel === 'edicao' ? 'com permissão de edição' : 'com permissão só de visualização'}`

/** Manda de novo o mesmo link (o antigo continua valendo). Devolve o e-mail de destino. */
export function reenviarLink(tipo: 'professor' | 'coordenador' | 'solar', id: Id): string | null {
  const banco = servidor()
  if (banco) {
    // Na plataforma, um convite novo (sem link: a pessoa entra pelo código).
    banco.rpc('plataforma', 'reenviar_convite', { pessoa: id }, { convite: true })
    const db = getDb()
    return (tipo === 'professor' ? db.professores : tipo === 'coordenador' ? db.coordenadores : db.equipeSolar).find((x) => x.id === id)?.email ?? null
  }
  let enviado: string | null = null
  atualizar((db) => {
    if (tipo === 'professor') {
      const p = db.professores.find((x) => x.id === id)
      if (p) enviado = enviarLink(db, p, papelDoProfessor(db, p.colegioId), 'reenvio')
    } else if (tipo === 'coordenador') {
      const c = db.coordenadores.find((x) => x.id === id)
      if (c) enviado = enviarLink(db, c, papelDoCoordenador(db, c.colegioId, c.responsavel), 'reenvio')
    } else {
      const m = db.equipeSolar.find((x) => x.id === id)
      if (m) enviado = enviarLink(db, m, papelSolar(m.papel), 'reenvio')
    }
  })
  return enviado
}

/** Resultado das ações que cadastram ou mudam uma pessoa: para onde foi o e-mail com o link, se foi. */
export interface Envio {
  emailEnviado: string | null
}

// Colégios e coordenação

export type DadosColegio = Pick<Colegio, 'nome' | 'cidade' | 'uf'>

export function criarColegio(dados: DadosColegio, responsavel: Contato | null): Id {
  const id = novoId('col')
  const idResponsavel = novoId('coord')
  const perfil = getPerfil()
  atualizar((db) => {
    db.colegios.push({ id, ...dados, membroSolarId: perfil?.papel === 'solar' ? perfil.membroId : null })
    registrar(db, `Cadastrou o ${dados.nome}.`, { colegioId: id })
    if (responsavel?.nome) {
      const pessoa = { id: idResponsavel, colegioId: id, ...responsavel, responsavel: true, token: novoToken() }
      db.coordenadores.push(pessoa)
      enviarLink(db, pessoa, papelDoCoordenador(db, id, true), 'convite')
      registrar(db, `Definiu ${responsavel.nome} como responsável pela coordenação e enviou o link de acesso para ${responsavel.email}.`, { colegioId: id })
    }
  })
  servidor()?.rpc(
    'plataforma',
    'criar_colegio',
    { id, ...dados, responsavel: responsavel?.nome ? { id: idResponsavel, ...responsavel } : null },
    { convite: true },
  )
  return id
}

export function editarColegio(id: Id, dados: DadosColegio) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === id)
    if (colegio) Object.assign(colegio, dados)
  })
  servidor()?.rpc('plataforma', 'editar_colegio', { id, ...dados })
}

/**
 * Arquiva o colégio: ele sai das listas e das contas da rede, e a coordenação e os professores dele perdem o acesso.
 * Nada se apaga: o que era do colégio vai junto para db.arquivados, e reativar devolve tudo.
 */
export function arquivarColegio(id: Id) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === id)
    if (!colegio) return
    registrar(db, TEXTO_ARQUIVOU, { colegioId: id })
    const turmas = new Set(db.turmas.filter((t) => t.colegioId === id).map((t) => t.id))
    const evento = db.historico[db.historico.length - 1]
    db.arquivados.push({
      colegio,
      em: evento.em,
      por: evento.por,
      coordenadores: db.coordenadores.filter((c) => c.colegioId === id),
      professores: db.professores.filter((p) => p.colegioId === id),
      turmas: db.turmas.filter((t) => turmas.has(t.id)),
      alunos: db.alunos.filter((a) => turmas.has(a.turmaId)),
      lancamentos: db.lancamentos.filter((l) => turmas.has(l.turmaId)),
      historico: db.historico.filter((e) => e.colegioId === id),
    })
    db.colegios = db.colegios.filter((c) => c.id !== id)
    db.coordenadores = db.coordenadores.filter((c) => c.colegioId !== id)
    db.professores = db.professores.filter((p) => p.colegioId !== id)
    db.turmas = db.turmas.filter((t) => !turmas.has(t.id))
    db.alunos = db.alunos.filter((a) => !turmas.has(a.turmaId))
    db.lancamentos = db.lancamentos.filter((l) => !turmas.has(l.turmaId))
    db.historico = db.historico.filter((e) => e.colegioId !== id)
  })
  servidor()?.rpc('plataforma', 'arquivar_colegio', { colegio: id })
}

/** Devolve o colégio arquivado às listas, com tudo o que era dele; a equipe volta a entrar. */
export function reativarColegio(id: Id) {
  atualizar((db) => {
    const arquivado = db.arquivados.find((a) => a.colegio.id === id)
    if (!arquivado) return
    db.arquivados = db.arquivados.filter((a) => a !== arquivado)
    db.colegios.push(arquivado.colegio)
    db.coordenadores.push(...arquivado.coordenadores)
    db.professores.push(...arquivado.professores)
    db.turmas.push(...arquivado.turmas)
    db.alunos.push(...arquivado.alunos)
    db.lancamentos.push(...arquivado.lancamentos)
    db.historico.push(...arquivado.historico)
    db.historico.sort((a, b) => a.em.localeCompare(b.em))
    registrar(db, 'Reativou o colégio.', { colegioId: id })
  })
  servidor()?.rpc('plataforma', 'reativar_colegio', { colegio: id })
}

/**
 * Exclui em definitivo um colégio arquivado (só a pessoa responsável pela equipe Solar): saem as turmas, os alunos,
 * as respostas, o histórico e os acessos dele. Fica no histórico da Solar uma linha dizendo que foi excluído.
 */
export function excluirColegio(id: Id) {
  atualizar((db) => {
    const arquivado = db.arquivados.find((a) => a.colegio.id === id)
    if (!arquivado) return
    db.arquivados = db.arquivados.filter((a) => a !== arquivado)
    // Das provas excluídas sai a parte do colégio (o banco tira também a cópia das respostas).
    for (const prova of db.excluidas) prova.colegios = prova.colegios.filter((c) => c.colegioId !== id)
    const { nome, cidade, uf } = arquivado.colegio
    registrar(db, `Excluiu em definitivo o ${nome} (${[cidade, uf].filter(Boolean).join('/')}).`)
  })
  servidor()?.rpc('plataforma', 'excluir_colegio', { colegio: id })
}

/** A pessoa responsável pela equipe Solar escolhe quem da Solar cuida de cada colégio. */
export function definirMembroSolarDoColegio(colegioId: Id, membroId: Id | null) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === colegioId)
    if (!colegio) return
    colegio.membroSolarId = membroId
    const nome = db.equipeSolar.find((m) => m.id === membroId)?.nome
    registrar(db, nome ? `${nome} passou a cuidar do ${colegio.nome} pela Solar.` : `O ${colegio.nome} ficou sem ninguém da Solar cuidando dele.`, { colegioId })
  })
  servidor()?.rpc('plataforma', 'definir_cuidado', { colegio: colegioId, pessoa: membroId })
}

/**
 * Define quem responde pela coordenação. Quem era responsável continua na equipe, sem o papel.
 * Se a pessoa é nova, recebe por e-mail o link de acesso.
 */
export function definirResponsavelDoColegio(colegioId: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  const idNovo = novoId('coord')
  atualizar((db) => {
    const equipe = db.coordenadores.filter((c) => c.colegioId === colegioId)
    equipe.forEach((c) => (c.responsavel = false))
    const existente = equipe.find((c) => contato.email && c.email.toLowerCase() === contato.email.toLowerCase())
    if (existente) {
      Object.assign(existente, { nome: contato.nome, telefone: contato.telefone, responsavel: true })
    } else {
      const pessoa = { id: idNovo, colegioId, ...contato, responsavel: true, token: novoToken() }
      db.coordenadores.push(pessoa)
      emailEnviado = enviarLink(db, pessoa, papelDoCoordenador(db, colegioId, true), 'convite')
    }
    registrar(db, `Definiu ${contato.nome} como responsável pela coordenação${emailEnviado ? ` e enviou o link de acesso para ${emailEnviado}` : ''}.`, { colegioId })
  })
  servidor()?.rpc('plataforma', 'definir_responsavel_colegio', { colegio: colegioId, id: idNovo, ...contato }, { convite: true })
  return { emailEnviado }
}

export function adicionarCoordenador(colegioId: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  const id = novoId('coord')
  atualizar((db) => {
    const pessoa = { id, colegioId, ...contato, responsavel: false, token: novoToken() }
    db.coordenadores.push(pessoa)
    emailEnviado = enviarLink(db, pessoa, papelDoCoordenador(db, colegioId, false), 'convite')
    registrar(db, `Incluiu ${contato.nome} na equipe da coordenação e enviou o link de acesso para ${contato.email}.`, { colegioId })
  })
  servidor()?.rpc('plataforma', 'adicionar_coordenacao', { colegio: colegioId, id, ...contato }, { convite: true })
  return { emailEnviado }
}

/** Corrigir o e-mail gera um link novo, que vai para o endereço novo; o antigo deixa de valer. */
export function editarCoordenador(id: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const pessoa = db.coordenadores.find((c) => c.id === id)
    if (!pessoa) return
    const mudouEmail = pessoa.email.toLowerCase() !== contato.email.toLowerCase()
    Object.assign(pessoa, contato)
    if (mudouEmail) {
      pessoa.token = novoToken()
      emailEnviado = enviarLink(db, pessoa, papelDoCoordenador(db, pessoa.colegioId, pessoa.responsavel), 'email_corrigido')
      registrar(db, `Corrigiu o e-mail de ${pessoa.nome} e enviou um novo link de acesso.`, { colegioId: pessoa.colegioId })
    }
  })
  servidor()?.rpc('plataforma', 'editar_pessoa', { pessoa: id, ...contato }, { convite: true })
  return { emailEnviado }
}

export function removerCoordenador(id: Id) {
  const colegioId = colegioDoPerfil() ?? getDb().coordenadores.find((c) => c.id === id)?.colegioId ?? null
  atualizar((db) => {
    const pessoa = db.coordenadores.find((c) => c.id === id && c.colegioId === colegioId)
    if (!pessoa || pessoa.responsavel) return
    db.coordenadores = db.coordenadores.filter((c) => !(c.id === id && c.colegioId === colegioId))
    registrar(db, `Tirou ${pessoa.nome} da equipe da coordenação.`, { colegioId: pessoa.colegioId })
  })
  servidor()?.rpc('plataforma', 'desativar_vinculo', { pessoa: id, colegio: colegioId, papel: 'coordenacao' })
}

/**
 * A Solar escolhe outra pessoa da coordenação como responsável; quem era continua na equipe, sem o papel.
 * A coordenação não passa a responsabilidade (pedido de 2026-10-20).
 */
export function tornarResponsavel(colegioId: Id, novoResponsavelId: Id) {
  atualizar((db) => {
    const novo = db.coordenadores.find((c) => c.id === novoResponsavelId && c.colegioId === colegioId)
    if (!novo) return
    db.coordenadores.filter((c) => c.colegioId === colegioId).forEach((c) => (c.responsavel = c.id === novo.id))
    registrar(db, `Definiu ${novo.nome} como responsável pela coordenação.`, { colegioId })
  })
  servidor()?.rpc('plataforma', 'passar_responsabilidade_colegio', { colegio: colegioId, pessoa: novoResponsavelId })
}

// Equipe Solar

export function adicionarMembroSolar(contato: Contato, papel: Exclude<PapelSolar, 'responsavel'>): Envio {
  let emailEnviado: string | null = null
  const id = novoId('solar')
  atualizar((db) => {
    const membro = { id, ...contato, papel, token: novoToken() }
    db.equipeSolar.push(membro)
    emailEnviado = enviarLink(db, membro, papelSolar(papel), 'convite')
    registrar(db, `Incluiu ${contato.nome} na equipe Solar, com ${papel === 'edicao' ? 'permissão de edição' : 'permissão só de visualização'}.`)
  })
  servidor()?.rpc('plataforma', 'adicionar_solar', { id, ...contato, papel: papelNoBanco(papel) }, { convite: true })
  return { emailEnviado }
}

export function editarMembroSolar(id: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro) return
    const mudouEmail = membro.email.toLowerCase() !== contato.email.toLowerCase()
    Object.assign(membro, contato)
    if (mudouEmail) {
      membro.token = novoToken()
      emailEnviado = enviarLink(db, membro, papelSolar(membro.papel), 'email_corrigido')
      registrar(db, `Corrigiu o e-mail de ${membro.nome} e enviou um novo link de acesso.`)
    }
  })
  servidor()?.rpc('plataforma', 'editar_pessoa', { pessoa: id, ...contato }, { convite: true })
  return { emailEnviado }
}

export function mudarPapelSolar(id: Id, papel: Exclude<PapelSolar, 'responsavel'>) {
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro || membro.papel === 'responsavel') return
    membro.papel = papel
    // Quem só visualiza não cuida de colégio.
    if (papel === 'visualizacao') for (const c of db.colegios) if (c.membroSolarId === id) c.membroSolarId = null
    registrar(db, `${membro.nome} passou a ter ${papel === 'edicao' ? 'permissão de edição' : 'permissão só de visualização'}.`)
  })
  servidor()?.rpc('plataforma', 'mudar_papel_solar', { pessoa: id, papel: papelNoBanco(papel) })
}

export function removerMembroSolar(id: Id) {
  const papel = getDb().equipeSolar.find((m) => m.id === id)?.papel
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro || membro.papel === 'responsavel') return
    db.equipeSolar = db.equipeSolar.filter((m) => m.id !== id)
    for (const c of db.colegios) if (c.membroSolarId === id) c.membroSolarId = null
    registrar(db, `Tirou ${membro.nome} da equipe Solar.`)
  })
  if (papel && papel !== 'responsavel') servidor()?.rpc('plataforma', 'desativar_vinculo', { pessoa: id, colegio: null, papel: papelNoBanco(papel) })
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
  servidor()?.rpc('plataforma', 'passar_responsabilidade_solar', { pessoa: id })
}

// Professores

/** Cadastra o professor e manda para o e-mail dele o link de acesso. */
export function criarProfessor(colegioId: Id, dados: { nome: string; email: string }): Envio & { id: Id } {
  const id = novoId('prof')
  let emailEnviado: string | null = null
  atualizar((db) => {
    const professor = { id, colegioId, ...dados, ativo: true, token: novoToken() }
    db.professores.push(professor)
    emailEnviado = enviarLink(db, professor, papelDoProfessor(db, colegioId), 'convite')
    registrar(db, `Cadastrou ${dados.nome} como professor(a) e enviou o link de acesso para ${dados.email}.`, { colegioId })
  })
  servidor()?.rpc('plataforma', 'adicionar_professor', { colegio: colegioId, id, ...dados }, { convite: true })
  return { id, emailEnviado }
}

export function editarProfessor(id: Id, dados: { nome: string; email: string }): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id)
    if (!professor) return
    const mudouEmail = professor.email.toLowerCase() !== dados.email.toLowerCase()
    Object.assign(professor, dados)
    if (mudouEmail) {
      professor.token = novoToken()
      emailEnviado = enviarLink(db, professor, papelDoProfessor(db, professor.colegioId), 'email_corrigido')
      registrar(db, `Corrigiu o e-mail de ${professor.nome} e enviou um novo link de acesso.`, { colegioId: professor.colegioId })
    }
  })
  servidor()?.rpc('plataforma', 'editar_pessoa', { pessoa: id, ...dados, telefone: null }, { convite: true })
  return { emailEnviado }
}

/** Quem sai do colégio perde o acesso e sai das turmas do ano, mas o nome continua no histórico. */
export function desativarProfessor(id: Id) {
  const colegioId = colegioDoPerfil() ?? getDb().professores.find((p) => p.id === id)?.colegioId ?? null
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id && p.colegioId === colegioId)
    if (!professor) return
    professor.ativo = false
    const turmas = db.turmas.filter((t) => t.anoLetivo === db.config.anoLetivo && t.professorIds.includes(id))
    for (const turma of turmas) turma.professorIds = turma.professorIds.filter((pid) => pid !== id)
    const sem = turmas.filter((t) => !t.professorIds.length).map(turmaNome)
    registrar(db, `Desativou o acesso de ${professor.nome}.${sem.length ? ` ${sem.join(', ')} ${sem.length > 1 ? 'ficaram' : 'ficou'} sem professor.` : ''}`, {
      colegioId: professor.colegioId,
    })
  })
  servidor()?.rpc('plataforma', 'desativar_vinculo', { pessoa: id, colegio: colegioId, papel: 'professor' })
}

export function reativarProfessor(id: Id) {
  const colegioId = colegioDoPerfil() ?? getDb().professores.find((p) => p.id === id)?.colegioId ?? null
  atualizar((db) => {
    const professor = db.professores.find((p) => p.id === id && p.colegioId === colegioId)
    if (!professor) return
    professor.ativo = true
    registrar(db, `Reativou o acesso de ${professor.nome}.`, { colegioId: professor.colegioId })
  })
  servidor()?.rpc('plataforma', 'reativar_vinculo', { pessoa: id, colegio: colegioId, papel: 'professor' })
}

// Turmas

export type DadosTurma = Pick<Turma, 'serie' | 'nome' | 'turno' | 'professorIds'>

export function criarTurma(colegioId: Id, dados: DadosTurma): Id {
  const id = novoId('tur')
  atualizar((db) => {
    db.turmas.push({ id, colegioId, anoLetivo: db.config.anoLetivo, ...dados })
    registrar(db, `Criou a turma ${turmaNome(dados)}.`, { colegioId, turmaId: id })
  })
  servidor()?.rpc('prova', 'criar_turma', { id, colegio: colegioId, serie: dados.serie, nome: dados.nome, turno: dados.turno, professores: dados.professorIds })
  return id
}

export function editarTurma(id: Id, dados: DadosTurma) {
  atualizar((db) => {
    const turma = db.turmas.find((t) => t.id === id)
    if (turma) Object.assign(turma, dados)
  })
  servidor()?.rpc('prova', 'editar_turma', { id, serie: dados.serie, nome: dados.nome, turno: dados.turno, professores: dados.professorIds })
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
  servidor()?.rpc('prova', 'definir_professores', { turma: turmaId, professores: professorIds })
}

export function removerTurma(id: Id) {
  atualizar((db) => {
    db.turmas = db.turmas.filter((t) => t.id !== id)
    db.alunos = db.alunos.filter((a) => a.turmaId !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.turmaId !== id)
  })
  servidor()?.rpc('prova', 'remover_turma', { turma: id })
}

// Alunos. A lista é editada pela coordenação e pelos professores da turma. As mudanças feitas por
// professores viram avisos para a coordenação, que marca que está ciente (e corrige, se quiser).

export interface DadosAluno {
  numero: string
  iniciais: string
  sexo: Sexo | null
  anoIngresso: number | null
}

const limpar = (dados: Partial<DadosAluno>): Partial<DadosAluno> => ({
  ...dados,
  ...(dados.numero !== undefined ? { numero: dados.numero.trim().replace(/\s+/g, ' ') } : {}),
  ...(dados.iniciais !== undefined ? { iniciais: formatarIniciais(dados.iniciais) } : {}),
})

/**
 * Registra uma mudança num aluno. As várias mudanças que a mesma pessoa faz no mesmo aluno, no mesmo
 * dia, viram uma linha só (e um aviso só para a coordenação, enquanto ela não marca que está ciente).
 */
function registrarMudancaAluno(
  db: Draft<Db>,
  aluno: Draft<Aluno>,
  tipo: TipoMudancaAluno,
  extra: { campos?: Evento['campos']; motivo?: MotivoSaida; texto?: string } = {},
) {
  const deProfessor = getPerfil()?.papel === 'professor'
  const por = autorAtual()
  const hoje = hojeIso()
  // Incluiu e excluiu no mesmo dia, antes de a coordenação ver: foi engano de digitação, nada a avisar.
  const doDia = (e: Evento) => e.alunoId === aluno.id && e.por === por && e.em.startsWith(hoje) && !e.ciente
  if (tipo === 'exclusao' && db.historico.some((e) => doDia(e) && e.tipo === 'inclusao')) {
    db.historico = db.historico.filter((e) => !doDia(e))
    return
  }
  const anterior = [...db.historico]
    .reverse()
    .find(
      (e) =>
        e.alunoId === aluno.id &&
        e.por === por &&
        e.em.startsWith(hoje) &&
        !e.ciente &&
        (e.tipo === tipo || (e.tipo === 'inclusao' && tipo === 'correcao')),
    )
  if (anterior && tipo === 'correcao' && anterior.tipo === 'correcao') {
    const campos = { ...anterior.campos }
    for (const [campo, mudanca] of Object.entries(extra.campos ?? {})) {
      const de = campos[campo]?.de ?? mudanca.de
      if (de === mudanca.para) delete campos[campo]
      else campos[campo] = { de, para: mudanca.para }
    }
    if (!Object.keys(campos).length) {
      db.historico = db.historico.filter((e) => e.id !== anterior.id)
      return
    }
    anterior.campos = campos
    anterior.texto = textoMudancaAluno('correcao', aluno, { campos })
    anterior.em = agoraIso()
    return
  }
  if (anterior && anterior.tipo === 'inclusao' && (tipo === 'correcao' || tipo === 'inclusao')) {
    anterior.texto = textoMudancaAluno('inclusao', aluno)
    anterior.em = agoraIso()
    return
  }
  db.historico.push({
    id: novoId('ev'),
    em: agoraIso(),
    por,
    colegioId: colegioDaTurma(db, aluno.turmaId),
    turmaId: aluno.turmaId,
    cadernoId: null,
    texto: textoMudancaAluno(tipo, aluno, extra),
    alunoId: aluno.id,
    tipo,
    ...(extra.campos ? { campos: extra.campos } : {}),
    ...(deProfessor ? { avisarCoordenacao: true } : {}),
  })
}

/** Cria o aluno com o id dado (a linha nova do editor já nasce com ele, para não perder o foco). */
export function criarAluno(turmaId: Id, id: Id, dados: Partial<DadosAluno>) {
  if (getDb().alunos.some((a) => a.id === id)) return
  const aluno: Aluno = { id, turmaId, numero: '', iniciais: '', sexo: null, anoIngresso: null, ativo: true, ...limpar(dados) }
  atualizar((db) => {
    db.alunos.push(aluno)
    registrarMudancaAluno(db, db.alunos.at(-1)!, 'inclusao')
  })
  servidor()?.rpc('prova', 'criar_aluno', {
    id,
    turma: turmaId,
    numero: aluno.numero,
    iniciais: aluno.iniciais,
    sexo: aluno.sexo,
    ano_ingresso: aluno.anoIngresso,
  })
}

/** Muda um ou mais campos do aluno. Campo vazio é permitido: o site lembra depois que falta. */
export function atualizarAluno(id: Id, dados: Partial<DadosAluno>) {
  const antes = getDb().alunos.find((a) => a.id === id)
  if (!antes) return
  const novos = limpar(dados)
  const campos: NonNullable<Evento['campos']> = {}
  for (const campo of Object.keys(novos) as CampoAluno[]) {
    const de = valorDoCampo(antes, campo)
    const para = valorDoCampo({ ...antes, ...novos }, campo)
    if (de !== para) campos[campo] = { de, para }
  }
  if (!Object.keys(campos).length) return
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    Object.assign(aluno, novos)
    registrarMudancaAluno(db, aluno, 'correcao', { campos })
  })
  servidor()?.rpc('prova', 'atualizar_aluno', { aluno: id, turma: antes.turmaId, dados: novos })
}

/** Preenche o ano de entrada de todos os alunos ativos da turma que ainda estão sem ele. */
export function definirIngressoDosSemAno(turmaId: Id, anoIngresso: number) {
  atualizar((db) => {
    for (const aluno of db.alunos) {
      if (aluno.turmaId === turmaId && aluno.ativo && aluno.anoIngresso == null) {
        aluno.anoIngresso = anoIngresso
        registrarMudancaAluno(db, aluno, 'correcao', { campos: { anoIngresso: { de: 'em branco', para: String(anoIngresso) } } })
      }
    }
  })
  servidor()?.rpc('prova', 'definir_ingresso_sem_ano', { turma: turmaId, ano: anoIngresso })
}

/** O aluno sai da lista; as respostas já lançadas continuam nos resultados. */
export function registrarSaida(id: Id, motivo: MotivoSaida) {
  const turmaId = getDb().alunos.find((a) => a.id === id)?.turmaId
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    aluno.ativo = false
    aluno.saida = { em: hojeIso(), motivo }
    registrarMudancaAluno(db, aluno, 'saida', { motivo })
  })
  if (turmaId) servidor()?.rpc('prova', 'registrar_saida', { aluno: id, turma: turmaId, motivo })
}

export const temRespostas = (db: Db, alunoId: Id) => db.lancamentos.some((l) => l.respostas[alunoId])

/** Para cadastro feito por engano: só vale para quem ainda não tem respostas lançadas. */
export function excluirCadastroDoAluno(id: Id) {
  const turmaId = getDb().alunos.find((a) => a.id === id)?.turmaId
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno || db.lancamentos.some((l) => l.respostas[id])) return
    db.alunos = db.alunos.filter((a) => a.id !== id)
    registrarMudancaAluno(db, aluno, 'exclusao')
  })
  if (turmaId) servidor()?.rpc('prova', 'excluir_aluno', { aluno: id, turma: turmaId })
}

export function reativarAluno(id: Id) {
  const turmaId = getDb().alunos.find((a) => a.id === id)?.turmaId
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    aluno.ativo = true
    delete aluno.saida
    registrarMudancaAluno(db, aluno, 'volta')
  })
  if (turmaId) servidor()?.rpc('prova', 'reativar_aluno', { aluno: id, turma: turmaId })
}

/** As respostas já lançadas ficam na turma antiga; na nova, o aluno continua com o mesmo número (confira se não repete). */
export function mudarDeTurma(id: Id, novaTurmaId: Id) {
  const turmaAntes = getDb().alunos.find((a) => a.id === id)?.turmaId
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno || aluno.turmaId === novaTurmaId) return
    const antiga = aluno.turmaId
    const texto = `Mudou o aluno ${aluno.iniciais || aluno.numero} do ${descreverTurma(db, antiga)} para o ${descreverTurma(db, novaTurmaId)}.`
    aluno.turmaId = novaTurmaId
    registrar(db, texto, { colegioId: colegioDaTurma(db, antiga), turmaId: antiga })
    registrar(db, texto, { colegioId: colegioDaTurma(db, novaTurmaId), turmaId: novaTurmaId })
  })
  if (turmaAntes && turmaAntes !== novaTurmaId) servidor()?.rpc('prova', 'mudar_de_turma', { aluno: id, turma: turmaAntes, nova: novaTurmaId })
}

/** A coordenação marca que viu as mudanças feitas pelos professores. */
export function marcarCiente(ids: Id[]) {
  atualizar((db) => {
    const por = autorAtual()
    const em = agoraIso()
    for (const evento of db.historico) if (ids.includes(evento.id) && !evento.ciente) evento.ciente = { por, em }
  })
  servidor()?.rpc('prova', 'marcar_ciente', { ids })
}

// Avaliações e provas

export type DadosAvaliacao = Pick<Db['avaliacoes'][number], 'titulo' | 'aplicacaoInicio' | 'aplicacaoFim' | 'prazoLancamento'>

export function cadernoEmBranco(avaliacaoId: Id, serie: Serie, disciplina: Disciplina): Caderno {
  return {
    id: novoId('cad'),
    avaliacaoId,
    serie,
    disciplina,
    usaFolhaRespostas: serie === 5,
    questoes: Array.from({ length: questoesDaProva(serie) }, () => ({ gabarito: null, disciplina, habilidade: null, anulada: false })),
    pdf: null,
    conferencia: null,
  }
}

/** Cria a avaliação com a prova de cada disciplina (por enquanto, só Português) de cada ano escolhido. */
export function criarAvaliacao(dados: DadosAvaliacao, series: Serie[]): Id {
  const id = novoId('av')
  const cadernos = series.flatMap((serie) => DISCIPLINAS_DA_PROVA.map((disciplina) => cadernoEmBranco(id, serie, disciplina)))
  atualizar((db) => {
    db.avaliacoes.push({ id, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)), ...dados })
    db.cadernos.push(...cadernos)
    registrar(db, `Criou a ${dados.titulo}.`)
  })
  servidor()?.rpc('prova', 'criar_avaliacao', {
    id,
    titulo: dados.titulo,
    inicio: dados.aplicacaoInicio,
    fim: dados.aplicacaoFim,
    prazo: dados.prazoLancamento,
    cadernos: cadernos.map(cadernoParaOBanco),
  })
  return id
}

/** Um caderno novo como o banco recebe (privado.inserir_caderno). */
const cadernoParaOBanco = (c: Caderno) => ({
  id: c.id,
  serie: c.serie,
  disciplina: c.disciplina,
  numAlternativas: LETRAS.length,
  usaFolhaRespostas: c.usaFolhaRespostas,
  questoes: c.questoes,
})

export function editarAvaliacao(id: Id, dados: DadosAvaliacao) {
  atualizar((db) => {
    const avaliacao = db.avaliacoes.find((a) => a.id === id)
    if (avaliacao) Object.assign(avaliacao, { ...dados, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)) })
  })
  servidor()?.rpc('prova', 'editar_avaliacao', { id, titulo: dados.titulo, inicio: dados.aplicacaoInicio, fim: dados.aplicacaoFim, prazo: dados.prazoLancamento })
}

/** As respostas de cada prova, por colégio (das somas da rede): as provas que têm alguma ficam arquivadas. */
export type RespostasPorCaderno = Partial<Record<Id, RespostasDoColegio[]>>

export function removerAvaliacao(id: Id, respostas: RespostasPorCaderno = {}) {
  const cadernos = getDb().cadernos.filter((c) => c.avaliacaoId === id).map((c) => c.id)
  atualizar((db) => {
    for (const caderno of db.cadernos.filter((c) => c.avaliacaoId === id)) arquivar(db, caderno, respostas[caderno.id] ?? [])
    const titulo = db.avaliacoes.find((a) => a.id === id)?.titulo
    db.avaliacoes = db.avaliacoes.filter((a) => a.id !== id)
    db.cadernos = db.cadernos.filter((c) => c.avaliacaoId !== id)
    db.lancamentos = db.lancamentos.filter((l) => !cadernos.includes(l.cadernoId))
    registrar(db, `Excluiu a ${titulo ?? 'avaliação'}.`)
  })
  const banco = servidor()
  // O PDF de uma prova arquivada fica guardado; o banco diz quais ele arquivou.
  if (banco)
    banco.rpc('prova', 'remover_avaliacao', { id }, { depois: (arquivadas) => banco.removerPdf(cadernos.filter((c) => !(Array.isArray(arquivadas) && arquivadas.includes(c)))) })
  else cadernos.filter((c) => !respostas[c]?.length).forEach((c) => apagarPdf(c).catch(() => {}))
}

export function adicionarCaderno(avaliacaoId: Id, serie: Serie, disciplina: Disciplina): Id {
  const caderno = cadernoEmBranco(avaliacaoId, serie, disciplina)
  atualizar((db) => {
    db.cadernos.push(caderno)
  })
  servidor()?.rpc('prova', 'adicionar_caderno', { avaliacao: avaliacaoId, caderno: cadernoParaOBanco(caderno) })
  return caderno.id
}

/**
 * Exclui a prova. Se já tem respostas (`colegios`, das somas da rede), ela fica arquivada em "Provas excluídas", com o
 * PDF guardado, e a coordenação de cada colégio recebe um aviso. O banco confere de novo e devolve se arquivou.
 */
export function removerCaderno(id: Id, colegios: RespostasDoColegio[] = []) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === id)
    if (caderno) arquivar(db, caderno, colegios)
    db.cadernos = db.cadernos.filter((c) => c.id !== id)
    db.lancamentos = db.lancamentos.filter((l) => l.cadernoId !== id)
  })
  const banco = servidor()
  if (banco)
    banco.rpc('prova', 'remover_caderno', { id }, {
      depois: (arquivada) => {
        if (arquivada !== true) banco.removerPdf([id])
      },
    })
  else if (!colegios.length) apagarPdf(id).catch(() => {})
}

/** A frase do aviso à coordenação (a mesma que o banco escreve em privado.arquivar_caderno). */
export const textoAvisoExclusao = (caderno: Pick<Caderno, 'disciplina' | 'serie'>, avaliacao: string, colegio: Pick<RespostasDoColegio, 'alunos' | 'turmas'>) =>
  `A Solar excluiu a prova de ${provaNome(caderno)} (${avaliacao}). As respostas que o colégio tinha lançado nela ` +
  `(${colegio.alunos} ${colegio.alunos === 1 ? 'aluno' : 'alunos'}, em ${colegio.turmas} ${colegio.turmas === 1 ? 'turma' : 'turmas'}) ` +
  'saíram do site, e os resultados dessa prova deixam de aparecer. A Solar guardou uma cópia.'

/** Guarda o resumo da prova excluída e avisa cada colégio que tinha respostas. Sem respostas, não faz nada. */
function arquivar(db: Draft<Db>, caderno: Draft<Caderno>, colegios: RespostasDoColegio[]) {
  if (!colegios.length) return
  const avaliacao = db.avaliacoes.find((a) => a.id === caderno.avaliacaoId)
  const titulo = avaliacao?.titulo ?? 'avaliação'
  db.excluidas.push({
    id: novoId('excluida'),
    cadernoId: caderno.id,
    avaliacaoId: caderno.avaliacaoId,
    avaliacaoTitulo: titulo,
    anoLetivo: avaliacao?.anoLetivo ?? db.config.anoLetivo,
    serie: caderno.serie,
    disciplina: caderno.disciplina,
    questoes: caderno.questoes.length,
    pdf: caderno.pdf ? { ...caderno.pdf } : null,
    colegios: colegios.map((c) => ({ ...c })),
    em: agoraIso(),
    por: autorAtual(),
  })
  for (const colegio of colegios) {
    db.historico.push({
      id: novoId('ev'),
      em: agoraIso(),
      por: autorAtual(),
      colegioId: colegio.colegioId,
      turmaId: null,
      cadernoId: null,
      texto: textoAvisoExclusao(caderno, titulo, colegio),
      avisarCoordenacao: true,
    })
  }
}

/** Muda a prova na hora e, na plataforma, grava a prova inteira (com o motivo, se a mudança de correção tiver um). */
function comCaderno(id: Id, alterar: (caderno: Draft<Caderno>, db: Draft<Db>) => void, motivo?: string) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === id)
    if (caderno) alterar(caderno, db)
  })
  const caderno = getDb().cadernos.find((c) => c.id === id)
  if (caderno) servidor()?.salvarCaderno(caderno, motivo)
}

export const temRespostasNaProva = (db: Db, cadernoId: Id) =>
  db.lancamentos.some((l) => l.cadernoId === cadernoId && Object.keys(l.respostas).length > 0)

export function definirFolhaRespostas(id: Id, usa: boolean) {
  comCaderno(id, (caderno) => {
    caderno.usaFolhaRespostas = usa
  })
}

export function definirNumeroDeQuestoes(id: Id, total: number) {
  comCaderno(id, (caderno) => {
    while (caderno.questoes.length < total) {
      caderno.questoes.push({ gabarito: null, disciplina: caderno.disciplina, habilidade: null, anulada: false })
    }
    caderno.questoes.splice(total)
    caderno.conferencia = null
  })
}

const nomeDaProva = (caderno: Draft<Caderno>, db: Draft<Db>) =>
  `prova de ${provaNome(caderno)} (${db.avaliacoes.find((a) => a.id === caderno.avaliacaoId)?.titulo ?? 'avaliação'})`

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
  }, motivo)
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
  }, motivo)
}

/** Marca o gabarito como conferido com a prova impressa. */
export function conferirGabarito(cadernoId: Id) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === cadernoId)
    if (!caderno) return
    caderno.conferencia = { por: autorAtual(), em: agoraIso() }
    registrar(db, `Conferiu o gabarito da ${nomeDaProva(caderno, db)}.`, { cadernoId })
  })
  servidor()?.rpc('prova', 'conferir_gabarito', { id: cadernoId })
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
  const banco = servidor()
  // Na plataforma o PDF vai para o Storage (bucket provas); na demonstração, para o IndexedDB deste navegador.
  if (banco) await banco.enviarPdf(cadernoId, arquivo)
  else await salvarPdf(cadernoId, arquivo)
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === cadernoId)
    if (caderno) caderno.pdf = { nome: arquivo.name, tamanho: arquivo.size, origem: 'enviado', enviadoEm: agoraIso() }
  })
}

export function removerPdf(cadernoId: Id) {
  atualizar((db) => {
    const caderno = db.cadernos.find((c) => c.id === cadernoId)
    if (caderno) caderno.pdf = null
  })
  const banco = servidor()
  if (banco) banco.rpc('prova', 'remover_pdf', { id: cadernoId }, { depois: () => banco.removerPdf([cadernoId]) })
  else apagarPdf(cadernoId).catch(() => {})
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
  paraAFila(cadernoId, turmaId, alunoId)
}

export function definirSituacao(cadernoId: Id, turmaId: Id, alunoId: Id, situacao: Situacao) {
  atualizar((db) => {
    const resposta = respostaPara(db, lancamentoPara(db, cadernoId, turmaId), alunoId, situacao)
    resposta.situacao = situacao
    resposta.atualizadoEm = agoraIso()
  })
  paraAFila(cadernoId, turmaId, alunoId)
}

/** Na plataforma, a resposta do aluno vai para a fila do lançamento (fica no aparelho até o banco confirmar). */
function paraAFila(cadernoId: Id, turmaId: Id, alunoId: Id) {
  const resposta = getDb().lancamentos.find((l) => l.id === idLancamento(cadernoId, turmaId))?.respostas[alunoId]
  if (resposta) servidor()?.resposta(cadernoId, turmaId, alunoId, resposta)
}

export function concluirLancamento(cadernoId: Id, turmaId: Id) {
  atualizar((db) => {
    lancamentoPara(db, cadernoId, turmaId).concluidoEm = agoraIso()
    const disciplina = db.cadernos.find((c) => c.id === cadernoId)?.disciplina
    registrar(db, `Concluiu o lançamento da prova de ${disciplina ?? 'avaliação'} do ${descreverTurma(db, turmaId)}.`, { colegioId: colegioDaTurma(db, turmaId), turmaId })
  })
  servidor()?.rpc('prova', 'concluir_lancamento', { caderno: cadernoId, turma: turmaId })
}

// Configurações e dados

export async function restaurarDadosDeExemplo() {
  substituirDados(gerarDadosExemplo())
  await apagarTodosPdfs().catch(() => {})
}
