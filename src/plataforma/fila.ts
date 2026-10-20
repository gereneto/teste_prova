// A fila do lançamento (PLANO §7.3): cada resposta vai primeiro para o IndexedDB "prova:fila", neste aparelho, e
// sai dali só quando o banco confirma. Se a internet da escola cair, nada se perde: a fila tenta de novo, e o que
// ficou é mandado na próxima vez que a Prova abrir (só com a sessão da mesma pessoa).
// Vale a última gravação de cada aluno; se outra pessoa mudou o mesmo aluno depois que esta tela o leu, o banco
// avisa (conflito), e a tela mostra quem foi.

import { identificacao } from '../lib/iniciais'
import type { Db, Id, RespostaAluno, Situacao } from '../types'
import { chaveResposta, horaLocal } from './carga'
import { avisar, lerPlataforma, mudarPlataforma } from './estado'

const BANCO = 'prova:fila'
const LOJA = 'respostas'
const LOTE = 200

interface Item {
  chave: string
  usuario: Id
  caderno: Id
  turma: Id
  aluno: Id
  situacao: Situacao
  marcas: string
  /** A hora do banco da última versão que esta tela leu (null: o aluno ainda não tinha resposta). */
  base: string | null
  /** Sobe a cada mudança: só sai da fila a versão que o banco confirmou. */
  versao: number
}

/** Uma resposta da fila de lançamento como o banco responde. */
interface Salvo {
  caderno: Id
  turma: Id
  aluno: Id
  atualizadoEm?: string
  conflito?: { por: string; em: string } | null
  erro?: string
}

export type Enviar = (lote: Omit<Item, 'chave' | 'usuario' | 'versao'>[]) => Promise<Salvo[]>

let usuario: Id = ''
let bases = new Map<string, string>()
let enviarAoBanco: Enviar | null = null
let lerDb: () => Db = () => {
  throw new Error('fila sem dados')
}
let versao = Date.now()
let timer: ReturnType<typeof setTimeout> | null = null
let espera = 0
let emAndamento: Promise<number> | null = null

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1)
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(LOJA, { keyPath: 'chave' })
    pedido.onsuccess = () => resolve(pedido.result)
    pedido.onerror = () => reject(pedido.error)
  })
}

async function naLoja<T>(modo: IDBTransactionMode, operacao: (loja: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const banco = await abrir()
  return new Promise((resolve, reject) => {
    const transacao = banco.transaction(LOJA, modo)
    const pedido = operacao(transacao.objectStore(LOJA))
    transacao.oncomplete = () => {
      banco.close()
      resolve(pedido.result)
    }
    transacao.onerror = () => {
      banco.close()
      reject(transacao.error)
    }
  })
}

const todos = async () => ((await naLoja<Item[]>('readonly', (l) => l.getAll())) ?? []).filter((i) => i.usuario === usuario)

async function contar() {
  try {
    const n = (await todos()).length
    mudarPlataforma({ fila: { ...lerPlataforma().fila, pendentes: n } })
  } catch {
    // sem IndexedDB: nada a contar
  }
}

/** Antes da primeira carga: de quem é a fila e como mandar. Só entram na fila as respostas desta pessoa. */
export function prepararFila(opcoes: { usuario: Id; enviar: Enviar; lerDb: () => Db }) {
  usuario = opcoes.usuario
  enviarAoBanco = opcoes.enviar
  lerDb = opcoes.lerDb
  window.addEventListener('online', () => agendarEnvio(0))
}

/** Depois da primeira carga: conta o que ficou de outra vez e manda. */
export function comecarFila() {
  void contar().then(() => agendarEnvio(0))
}

/** As horas do banco de cada resposta, a cada carga nova. */
export function atualizarBases(novas: Map<string, string>) {
  bases = novas
}

/** As respostas que estão na fila (de outra vez em que a internet caiu) por cima dos dados que vieram do banco. */
export async function aplicarPendentes(db: Db): Promise<void> {
  let itens: Item[] = []
  try {
    itens = await todos()
  } catch {
    return
  }
  for (const i of itens) {
    const id = `${i.caderno}__${i.turma}`
    let l = db.lancamentos.find((x) => x.id === id)
    if (!l) db.lancamentos.push((l = { id, cadernoId: i.caderno, turmaId: i.turma, respostas: {}, concluidoEm: null }))
    const numero = l.respostas[i.aluno]?.numero ?? db.alunos.find((a) => a.id === i.aluno)?.numero
    l.respostas[i.aluno] = { situacao: i.situacao, marcas: i.marcas, atualizadoEm: horaLocal(new Date().toISOString()), numero }
  }
}

/** Põe a resposta do aluno na fila (no aparelho) e agenda o envio. */
export async function agendarResposta(caderno: Id, turma: Id, aluno: Id, r: RespostaAluno) {
  const chave = chaveResposta(caderno, turma, aluno)
  const item: Item = { chave, usuario, caderno, turma, aluno, situacao: r.situacao, marcas: r.marcas, base: bases.get(chave) ?? null, versao: ++versao }
  try {
    await naLoja('readwrite', (l) => l.put(item))
  } catch {
    // Sem IndexedDB (modo privado antigo): manda direto, sem a garantia de ficar no aparelho.
    pendentesNaMemoria.set(chave, item)
  }
  await contar()
  agendarEnvio(900)
}

const pendentesNaMemoria = new Map<string, Item>()

function agendarEnvio(ms: number) {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void enviarRespostas(), ms)
}

/** Manda o que está na fila. Devolve quantas respostas ficaram sem enviar. */
export function enviarRespostas(): Promise<number> {
  if (emAndamento) return emAndamento.then(() => enviarRespostas())
  emAndamento = enviarAgora().finally(() => {
    emAndamento = null
  })
  return emAndamento
}

const nomeDoAluno = (db: Db, aluno: Id) => {
  const a = db.alunos.find((x) => x.id === aluno)
  return a ? identificacao(a) : 'um aluno'
}

async function enviarAgora(): Promise<number> {
  if (!enviarAoBanco || !usuario) return 0
  let itens: Item[]
  try {
    itens = [...(await todos()), ...pendentesNaMemoria.values()]
  } catch {
    itens = [...pendentesNaMemoria.values()]
  }
  if (!itens.length) {
    mudarPlataforma({ fila: { pendentes: 0, enviando: false, semRede: false } })
    return 0
  }
  mudarPlataforma({ fila: { ...lerPlataforma().fila, enviando: true } })
  try {
    for (let k = 0; k < itens.length; k += LOTE) {
      const lote = itens.slice(k, k + LOTE)
      const salvos = await enviarAoBanco(lote.map(({ caderno, turma, aluno, situacao, marcas, base }) => ({ caderno, turma, aluno, situacao, marcas, base })))
      for (const s of salvos) {
        const item = lote.find((i) => i.caderno === s.caderno && i.turma === s.turma && i.aluno === s.aluno)
        if (!item) continue
        if (s.erro) {
          avisar('perigo', `A resposta de ${nomeDoAluno(lerDb(), item.aluno)} não foi salva: ${s.erro}`)
        } else {
          bases.set(item.chave, s.atualizadoEm!)
          if (s.conflito) {
            avisar(
              'atencao',
              `${s.conflito.por} tinha mudado as respostas de ${nomeDoAluno(lerDb(), item.aluno)} em ${horaLocal(s.conflito.em).slice(0, 16).replace('T', ' às ')}. Ficou valendo o que você lançou agora: confira se está certo.`,
            )
          }
        }
        await tirarSeNaoMudou(item)
      }
    }
    espera = 0
    mudarPlataforma({ fila: { ...lerPlataforma().fila, semRede: false } })
  } catch {
    // Sem internet (ou o banco fora do ar): tudo continua na fila; tenta de novo, cada vez mais devagar.
    espera = Math.min(60_000, espera ? espera * 2 : 5_000)
    mudarPlataforma({ fila: { ...lerPlataforma().fila, semRede: true } })
    agendarEnvio(espera)
  } finally {
    mudarPlataforma({ fila: { ...lerPlataforma().fila, enviando: false } })
    await contar()
  }
  return lerPlataforma().fila.pendentes
}

/** Sai da fila só a versão que foi enviada; se a pessoa mudou o aluno de novo nesse meio-tempo, a nova fica. */
async function tirarSeNaoMudou(item: Item) {
  if (pendentesNaMemoria.get(item.chave)?.versao === item.versao) pendentesNaMemoria.delete(item.chave)
  try {
    const atual = await naLoja<Item | undefined>('readonly', (l) => l.get(item.chave))
    if (atual && atual.versao === item.versao) await naLoja('readwrite', (l) => l.delete(item.chave))
    else if (atual) await naLoja('readwrite', (l) => l.put({ ...atual, base: bases.get(item.chave) ?? atual.base }))
  } catch {
    // sem IndexedDB
  }
}
