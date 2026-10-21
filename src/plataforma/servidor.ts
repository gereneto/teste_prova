// A Prova na plataforma: a sessão, a carga do que a pessoa vê (prova.carregar), as funções do banco (RPC) que
// as ações chamam, os convites, os PDFs no Storage e a fila do lançamento. Só entra no build da plataforma
// (main.tsx o importa só quando PLATAFORMA): a demonstração não leva nada disto.

import type { PainelRede } from '../lib/rede'
import { getDb, trocarDados } from '../store/db'
import { definirPerfil, getPerfil } from '../store/perfil'
import { LETRAS, type Caderno, type Id, type Perfil, type RespostaAluno } from '../types'
import { converterCarga, type Carga } from './carga'
import { avisar, lerPlataforma, mudarPlataforma } from './estado'
import { agendarResposta, aplicarPendentes, atualizarBases, comecarFila, enviarRespostas, prepararFila, type Enviar } from './fila'
import { registrarServidor, type OpcoesRpc, type Servidor } from './ponte'
import { sessao } from './sessao'

export class ErroDoBanco extends Error {
  constructor(
    mensagem: string,
    readonly codigo: string,
    readonly semRede: boolean,
  ) {
    super(mensagem)
  }
}

const SEM_REDE = 'Sem conexão com o servidor. Confira a internet.'
const pareceSemRede = (texto: string) => /fetch|network|NetworkError|Load failed|Failed/i.test(texto)

/** Uma função do banco. Erro do banco vem com a frase pronta para a tela (as RPC já escrevem assim). */
export async function chamar<T>(schema: 'prova' | 'plataforma', nome: string, args: Record<string, unknown>): Promise<T> {
  let r
  try {
    r = await sessao().cliente().schema(schema).rpc(nome, args)
  } catch {
    throw new ErroDoBanco(SEM_REDE, '', true)
  }
  if (r.error) {
    const semRede = !r.error.code && pareceSemRede(r.error.message)
    throw new ErroDoBanco(semRede ? SEM_REDE : r.error.message, r.error.code ?? '', semRede)
  }
  return r.data as T
}

// ------------------------------------------------------------------ a carga

let ultimaCarga = 0

/** Lê tudo de novo do banco. Espera as gravações em andamento terminarem, para não desfazer o que a pessoa fez. */
async function carregar(): Promise<void> {
  if (lerPlataforma().ocupado) return recarregarDepois()
  const carga = await chamar<Carga>('prova', 'carregar', {})
  if (!carga.eu) {
    mudarPlataforma({ fase: 'sem_acesso' })
    return
  }
  const { db, eu, perfis, bases } = converterCarga(carga)
  atualizarBases(bases)
  await aplicarPendentes(db)
  let painel: PainelRede | null = null
  if (perfis.some((p) => p.papel === 'solar')) painel = await chamar<PainelRede>('prova', 'painel_rede', {})
  if (lerPlataforma().ocupado) return recarregarDepois() // alguém gravou enquanto lia: lê de novo depois
  trocarDados(db)
  ultimaCarga = Date.now()
  mudarPlataforma({ fase: 'pronto', eu, perfis, painel, erro: null })
  ajustarPerfil(perfis)
  return
}

let timerCarga: ReturnType<typeof setTimeout> | null = null
function recarregarDepois(ms = 400) {
  if (timerCarga) clearTimeout(timerCarga)
  timerCarga = setTimeout(() => {
    carregar().catch((e) => {
      if (e instanceof ErroDoBanco && e.semRede) return // sem internet: fica com o que tem
      avisar('perigo', `Não deu para atualizar os dados: ${e instanceof Error ? e.message : String(e)}`)
    })
  }, ms)
}

const mesmoPerfil = (a: Perfil, b: Perfil) => JSON.stringify(a) === JSON.stringify(b)

/** O perfil desta aba tem de ser um dos papéis da pessoa; com um papel só, entra direto nele. */
function ajustarPerfil(perfis: Perfil[]) {
  const atual = getPerfil()
  if (atual && perfis.some((p) => mesmoPerfil(p, atual))) return
  definirPerfil(perfis.length === 1 ? perfis[0] : null)
}

// ------------------------------------------------------------------ as gravações, uma de cada vez

let cadeia: Promise<void> = Promise.resolve()

function naFila(tarefa: () => Promise<void>) {
  mudarPlataforma({ ocupado: lerPlataforma().ocupado + 1 })
  cadeia = cadeia
    .then(tarefa)
    .catch(() => {})
    .finally(() => {
      const ocupado = lerPlataforma().ocupado - 1
      mudarPlataforma({ ocupado })
      if (!ocupado) recarregarDepois()
    })
}

function falhou(e: unknown, oQue = 'A mudança não foi salva') {
  if (e instanceof ErroDoBanco && e.semRede) avisar('perigo', `${oQue}: sem conexão com o servidor. Confira a internet e faça de novo.`)
  else avisar('perigo', `${oQue}: ${e instanceof Error ? e.message : String(e)}`)
}

// ------------------------------------------------------------------ convites

interface Cadastro {
  pessoa?: Id
  convite?: Id | null
  email?: string
  nome?: string
  responsavel?: Cadastro | null
}

/** Pede à função acesso que mande o convite que o cadastro gerou (com a sessão de quem cadastrou). */
async function mandarConvite(convite: Id, email: string) {
  const s = sessao()
  const a = s.ambiente()!
  const { data } = await s.cliente().auth.getSession()
  let r: Response
  try {
    r = await fetch(`${a.url}/functions/v1/acesso`, {
      method: 'POST',
      headers: { apikey: a.chave, Authorization: `Bearer ${data.session?.access_token ?? ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ acao: 'convite', convite }),
    })
  } catch {
    avisar('perigo', `O convite para ${email} não saiu: sem conexão. Use “Reenviar convite” depois.`)
    return
  }
  const j = (await r.json().catch(() => ({}))) as { ok?: boolean; simulado?: boolean; modo_testes?: boolean; mensagem?: string }
  if (r.ok && j.ok) {
    if (j.simulado && j.modo_testes)
      avisar('info', `Modo de testes: o convite para ${email} não sai por e-mail. A pessoa entra pela tela Entrar com este e-mail, e o código aparece na tela.`)
    else if (j.simulado) avisar('info', `${email} é um endereço de teste: o convite não sai de verdade.`)
    else avisar('sucesso', `Convite enviado para ${email}.`)
  } else {
    avisar('perigo', `O convite para ${email} não saiu: ${j.mensagem ?? 'erro no envio'}. Use “Reenviar convite” daqui a pouco.`)
  }
}

async function mandarConvites(r: Cadastro | null) {
  for (const c of [r, r?.responsavel]) if (c?.convite && c.email) await mandarConvite(c.convite, c.email)
}

// ------------------------------------------------------------------ as provas: gravação junta e PDFs

const cadernosPendentes = new Map<Id, { caderno: Caderno; motivo?: string; timer: ReturnType<typeof setTimeout> }>()

function gravarCaderno(id: Id) {
  const p = cadernosPendentes.get(id)
  cadernosPendentes.delete(id)
  if (!p) return
  clearTimeout(p.timer)
  enfileirar('prova', 'salvar_caderno', {
    id: p.caderno.id,
    num_alternativas: LETRAS.length,
    usa_folha: p.caderno.usaFolhaRespostas,
    questoes: p.caderno.questoes,
    motivo: p.motivo ?? null,
  })
}

/** A edição de uma prova que ainda espera a digitação parar vai antes de qualquer outra mudança (ex.: conferir o gabarito). */
function gravarCadernosPendentes() {
  for (const id of [...cadernosPendentes.keys()]) gravarCaderno(id)
}

function salvarCaderno(caderno: Caderno, motivo?: string) {
  const antes = cadernosPendentes.get(caderno.id)
  if (antes) clearTimeout(antes.timer)
  // O motivo de uma mudança de gabarito não espera: vai junto, na hora.
  const motivoJunto = motivo ?? antes?.motivo
  cadernosPendentes.set(caderno.id, { caderno, motivo: motivoJunto, timer: setTimeout(() => gravarCaderno(caderno.id), motivoJunto ? 0 : 700) })
}

const caminhoDoPdf = (cadernoId: Id) => `cadernos/${cadernoId}.pdf`

// ------------------------------------------------------------------ o servidor que as ações usam

function enfileirar(schema: 'prova' | 'plataforma', nome: string, args: Record<string, unknown>, opcoes: OpcoesRpc = {}) {
  naFila(async () => {
    try {
      await enviarRespostas() // o lançamento pendente vai antes de qualquer outra mudança
      const r = await chamar<Cadastro | null>(schema, nome, args)
      if (opcoes.convite) await mandarConvites(r)
      opcoes.depois?.()
    } catch (e) {
      falhou(e)
    }
  })
}

const servidorDaProva: Servidor = {
  rpc(schema: 'prova' | 'plataforma', nome: string, args: Record<string, unknown>, opcoes: OpcoesRpc = {}) {
    gravarCadernosPendentes()
    enfileirar(schema, nome, args, opcoes)
  },
  salvarCaderno,
  resposta(cadernoId: Id, turmaId: Id, alunoId: Id, resposta: RespostaAluno) {
    void agendarResposta(cadernoId, turmaId, alunoId, resposta)
  },
  enviarRespostas,
  async enviarPdf(cadernoId: Id, arquivo: File) {
    const storage = sessao().cliente().storage.from('provas')
    const { error } = await storage.upload(caminhoDoPdf(cadernoId), arquivo, { upsert: true, contentType: 'application/pdf' })
    if (error) throw new Error(pareceSemRede(error.message) ? SEM_REDE : `O PDF não foi enviado: ${error.message}`)
    await chamar('prova', 'registrar_pdf', { id: cadernoId, nome: arquivo.name, tamanho: arquivo.size })
    recarregarDepois()
  },
  removerPdf(cadernoIds: Id[]) {
    if (!cadernoIds.length) return
    void sessao()
      .cliente()
      .storage.from('provas')
      .remove(cadernoIds.map(caminhoDoPdf))
      .then(({ error }) => error && avisar('atencao', `O arquivo do PDF ficou no servidor: ${error.message}`))
  },
  async urlDoPdf(cadernoId: Id) {
    const { data, error } = await sessao().cliente().storage.from('provas').createSignedUrl(caminhoDoPdf(cadernoId), 60)
    if (error || !data) throw new Error(error && pareceSemRede(error.message) ? SEM_REDE : 'Não foi possível baixar a prova agora. Tente de novo.')
    return data.signedUrl
  },
  sair,
}

// ------------------------------------------------------------------ o começo

/** Começa a Prova na plataforma: confere a sessão e carrega; sem sessão, manda para o /entrar/ (ou mostra a entrada de teste). */
let iniciado = false

export async function iniciar() {
  if (iniciado) return // o StrictMode chama o efeito duas vezes
  iniciado = true
  registrarServidor(servidorDaProva)
  const s = sessao()
  const ambiente = s.ambiente()
  mudarPlataforma({ ambiente: ambiente?.nome ?? null })
  if (!ambiente) {
    mudarPlataforma({ fase: 'erro', erro: 'Este endereço não é o da Plataforma Solar.' })
    return
  }
  let temSessao = false
  try {
    temSessao = !!(await s.cliente().auth.getSession()).data.session
  } catch {
    temSessao = s.temSessaoSalva()
  }
  if (!temSessao) {
    if (ambiente.nome === 'producao') s.irParaEntrar()
    else mudarPlataforma({ fase: 'entrar' })
    return
  }
  // Saiu nesta ou noutra aba (de qualquer app da plataforma): volta à entrada.
  s.aoSair(() => window.location.reload())
  const usuario = s.usuarioSalvo()
  const enviar: Enviar = (lote) => chamar('prova', 'salvar_respostas', { lote })
  if (usuario) prepararFila({ usuario, enviar, lerDb: getDb })
  mudarPlataforma({ fase: 'carregando' })
  try {
    await carregar()
  } catch (e) {
    mudarPlataforma({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) })
    return
  }
  if (usuario) comecarFila()
  // Outra pessoa pode ter mudado algo: ao voltar para a aba depois de um tempo, lê de novo.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - ultimaCarga > 60_000) recarregarDepois(0)
    if (document.visibilityState === 'hidden') gravarCadernosPendentes()
  })
  // Fechar a aba com uma mudança indo para o servidor: o navegador pergunta antes. (O lançamento não precisa: a
  // fila fica guardada neste aparelho e vai na próxima vez.)
  window.addEventListener('beforeunload', (e) => {
    gravarCadernosPendentes()
    if (lerPlataforma().ocupado) e.preventDefault()
  })
}

/** Lê os dados de novo (botão "Tentar de novo" e depois de um erro). */
export function recarregar() {
  mudarPlataforma({ fase: 'carregando' })
  carregar().catch((e) => mudarPlataforma({ fase: 'erro', erro: e instanceof Error ? e.message : String(e) }))
}

/** Sai deste navegador (todos os apps da plataforma). */
export async function sair() {
  await sessao().sair(false)
  definirPerfil(null)
  if (lerPlataforma().ambiente === 'producao') window.location.replace('/')
  else window.location.reload()
}

