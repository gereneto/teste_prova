import type { Draft } from 'immer'
import { gerarDadosExemplo, questoesDaProva } from '../data/seed'
import { textoMudancaAluno, valorDoCampo, type CampoAluno } from '../lib/alunos'
import { idLancamento, pessoaDoPerfil } from '../lib/consultas'
import { agoraIso, hojeIso, primeiroNome, provaNome, turmaNome } from '../lib/formato'
import { formatarIniciais } from '../lib/iniciais'
import {
  DISCIPLINAS_DA_PROVA,
  LETRAS,
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
  type Serie,
  type Sexo,
  type Situacao,
  type TipoMudancaAluno,
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
  const perfil = getPerfil()
  atualizar((db) => {
    db.colegios.push({ id, ...dados, membroSolarId: perfil?.papel === 'solar' ? perfil.membroId : null })
    registrar(db, `Cadastrou o ${dados.nome}.`, { colegioId: id })
    if (responsavel?.nome) {
      const pessoa = { id: novoId('coord'), colegioId: id, ...responsavel, responsavel: true, token: novoToken() }
      db.coordenadores.push(pessoa)
      enviarLink(db, pessoa, papelDoCoordenador(db, id, true), 'convite')
      registrar(db, `Definiu ${responsavel.nome} como responsável pela coordenação e enviou o link de acesso para ${responsavel.email}.`, { colegioId: id })
    }
  })
  return id
}

export function editarColegio(id: Id, dados: DadosColegio) {
  atualizar((db) => {
    const colegio = db.colegios.find((c) => c.id === id)
    if (colegio) Object.assign(colegio, dados)
  })
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
}

/**
 * Define quem responde pela coordenação. Quem era responsável continua na equipe, sem o papel.
 * Se a pessoa é nova, recebe por e-mail o link de acesso.
 */
export function definirResponsavelDoColegio(colegioId: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const equipe = db.coordenadores.filter((c) => c.colegioId === colegioId)
    equipe.forEach((c) => (c.responsavel = false))
    const existente = equipe.find((c) => contato.email && c.email.toLowerCase() === contato.email.toLowerCase())
    if (existente) {
      Object.assign(existente, { nome: contato.nome, telefone: contato.telefone, responsavel: true })
    } else {
      const pessoa = { id: novoId('coord'), colegioId, ...contato, responsavel: true, token: novoToken() }
      db.coordenadores.push(pessoa)
      emailEnviado = enviarLink(db, pessoa, papelDoCoordenador(db, colegioId, true), 'convite')
    }
    registrar(db, `Definiu ${contato.nome} como responsável pela coordenação${emailEnviado ? ` e enviou o link de acesso para ${emailEnviado}` : ''}.`, { colegioId })
  })
  return { emailEnviado }
}

export function adicionarCoordenador(colegioId: Id, contato: Contato): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const pessoa = { id: novoId('coord'), colegioId, ...contato, responsavel: false, token: novoToken() }
    db.coordenadores.push(pessoa)
    emailEnviado = enviarLink(db, pessoa, papelDoCoordenador(db, colegioId, false), 'convite')
    registrar(db, `Incluiu ${contato.nome} na equipe da coordenação e enviou o link de acesso para ${contato.email}.`, { colegioId })
  })
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
  return { emailEnviado }
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

export function adicionarMembroSolar(contato: Contato, papel: Exclude<PapelSolar, 'responsavel'>): Envio {
  let emailEnviado: string | null = null
  atualizar((db) => {
    const membro = { id: novoId('solar'), ...contato, papel, token: novoToken() }
    db.equipeSolar.push(membro)
    emailEnviado = enviarLink(db, membro, papelSolar(papel), 'convite')
    registrar(db, `Incluiu ${contato.nome} na equipe Solar, com ${papel === 'edicao' ? 'permissão de edição' : 'permissão só de visualização'}.`)
  })
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
}

export function removerMembroSolar(id: Id) {
  atualizar((db) => {
    const membro = db.equipeSolar.find((m) => m.id === id)
    if (!membro || membro.papel === 'responsavel') return
    db.equipeSolar = db.equipeSolar.filter((m) => m.id !== id)
    for (const c of db.colegios) if (c.membroSolarId === id) c.membroSolarId = null
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
  return { emailEnviado }
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
  })
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
  atualizar((db) => {
    if (db.alunos.some((a) => a.id === id)) return
    const aluno: Aluno = { id, turmaId, numero: '', iniciais: '', sexo: null, anoIngresso: null, ativo: true, ...limpar(dados) }
    db.alunos.push(aluno)
    registrarMudancaAluno(db, db.alunos.at(-1)!, 'inclusao')
  })
}

/** Muda um ou mais campos do aluno. Campo vazio é permitido: o site lembra depois que falta. */
export function atualizarAluno(id: Id, dados: Partial<DadosAluno>) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    const novos = limpar(dados)
    const campos: NonNullable<Evento['campos']> = {}
    for (const campo of Object.keys(novos) as CampoAluno[]) {
      const de = valorDoCampo(aluno, campo)
      const para = valorDoCampo({ ...aluno, ...novos }, campo)
      if (de !== para) campos[campo] = { de, para }
    }
    if (!Object.keys(campos).length) return
    Object.assign(aluno, novos)
    registrarMudancaAluno(db, aluno, 'correcao', { campos })
  })
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
}

/** O aluno sai da lista; as respostas já lançadas continuam nos resultados. */
export function registrarSaida(id: Id, motivo: MotivoSaida) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    aluno.ativo = false
    aluno.saida = { em: hojeIso(), motivo }
    registrarMudancaAluno(db, aluno, 'saida', { motivo })
  })
}

export const temRespostas = (db: Db, alunoId: Id) => db.lancamentos.some((l) => l.respostas[alunoId])

/** Para cadastro feito por engano: só vale para quem ainda não tem respostas lançadas. */
export function excluirCadastroDoAluno(id: Id) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno || db.lancamentos.some((l) => l.respostas[id])) return
    db.alunos = db.alunos.filter((a) => a.id !== id)
    registrarMudancaAluno(db, aluno, 'exclusao')
  })
}

export function reativarAluno(id: Id) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno) return
    aluno.ativo = true
    delete aluno.saida
    registrarMudancaAluno(db, aluno, 'volta')
  })
}

/** As respostas já lançadas ficam na turma antiga; na nova, o aluno continua com o mesmo número (confira se não repete). */
export function mudarDeTurma(id: Id, novaTurmaId: Id) {
  atualizar((db) => {
    const aluno = db.alunos.find((a) => a.id === id)
    if (!aluno || aluno.turmaId === novaTurmaId) return
    const antiga = aluno.turmaId
    const texto = `Mudou o aluno ${aluno.iniciais || aluno.numero} do ${descreverTurma(db, antiga)} para o ${descreverTurma(db, novaTurmaId)}.`
    aluno.turmaId = novaTurmaId
    registrar(db, texto, { colegioId: colegioDaTurma(db, antiga), turmaId: antiga })
    registrar(db, texto, { colegioId: colegioDaTurma(db, novaTurmaId), turmaId: novaTurmaId })
  })
}

/** A coordenação marca que viu as mudanças feitas pelos professores. */
export function marcarCiente(ids: Id[]) {
  atualizar((db) => {
    const por = autorAtual()
    const em = agoraIso()
    for (const evento of db.historico) if (ids.includes(evento.id) && !evento.ciente) evento.ciente = { por, em }
  })
}

// Avaliações e provas

export type DadosAvaliacao = Pick<Db['avaliacoes'][number], 'titulo' | 'aplicacaoInicio' | 'aplicacaoFim' | 'prazoLancamento'>

export function cadernoEmBranco(avaliacaoId: Id, serie: Serie, disciplina: Disciplina): Caderno {
  return {
    id: novoId('cad'),
    avaliacaoId,
    serie,
    disciplina,
    numAlternativas: 4,
    usaFolhaRespostas: serie === 5,
    questoes: Array.from({ length: questoesDaProva(serie) }, () => ({ gabarito: null, disciplina, habilidade: null, anulada: false })),
    pdf: null,
    conferencia: null,
  }
}

/** Cria a avaliação com as provas de Português e de Matemática de cada ano escolhido. */
export function criarAvaliacao(dados: DadosAvaliacao, series: Serie[]): Id {
  const id = novoId('av')
  atualizar((db) => {
    db.avaliacoes.push({ id, anoLetivo: Number(dados.aplicacaoInicio.slice(0, 4)), ...dados })
    for (const serie of series) for (const disciplina of DISCIPLINAS_DA_PROVA) db.cadernos.push(cadernoEmBranco(id, serie, disciplina))
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

export function adicionarCaderno(avaliacaoId: Id, serie: Serie, disciplina: Disciplina): Id {
  const caderno = cadernoEmBranco(avaliacaoId, serie, disciplina)
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
    const disciplina = db.cadernos.find((c) => c.id === cadernoId)?.disciplina
    registrar(db, `Concluiu o lançamento da prova de ${disciplina ?? 'avaliação'} do ${descreverTurma(db, turmaId)}.`, { colegioId: colegioDaTurma(db, turmaId), turmaId })
  })
}

// Configurações e dados

export async function restaurarDadosDeExemplo() {
  substituirDados(gerarDadosExemplo())
  await apagarTodosPdfs().catch(() => {})
}
