// A ponte entre as ações (store/acoes.ts) e o banco. Na demonstração ninguém se registra aqui, e as ações só
// mudam os dados do navegador; na plataforma, o servidor (servidor.ts, carregado só no build da plataforma) se
// registra, e cada ação também vai ao banco. Este arquivo não importa nada do banco, para a demonstração não
// levar o supabase-js no pacote.

import type { Caderno, Id, RespostaAluno } from '../types'

/** O que as ações pedem ao servidor. */
export interface Servidor {
  /** Uma função do banco (RPC), na fila: uma de cada vez, na ordem em que a pessoa fez. Erro aparece na tela. */
  rpc(schema: 'prova' | 'plataforma', nome: string, args: Record<string, unknown>, opcoes?: OpcoesRpc): void
  /** Grava a prova inteira (alternativas, folha e questões), com um respiro para juntar várias mudanças seguidas. */
  salvarCaderno(caderno: Caderno, motivo?: string): void
  /** A resposta de um aluno vai para a fila do lançamento (guardada no aparelho até o banco confirmar). */
  resposta(cadernoId: Id, turmaId: Id, alunoId: Id, resposta: RespostaAluno): void
  /** Manda as respostas que estão na fila e espera; devolve quantas ficaram sem enviar. */
  enviarRespostas(): Promise<number>
  enviarPdf(cadernoId: Id, arquivo: File): Promise<void>
  removerPdf(cadernoIds: Id[]): void
  /** Uma URL assinada (vale um minuto) para buscar o PDF da prova. */
  urlDoPdf(cadernoId: Id): Promise<string>
  /** Sai deste navegador (todos os apps da plataforma). */
  sair(): Promise<void>
}

export interface OpcoesRpc {
  /** O cadastro devolve um convite: a função acesso manda o e-mail. */
  convite?: boolean
  /** Depois de dar certo, com o que a RPC devolveu (por exemplo, apagar os PDFs de uma avaliação excluída). */
  depois?: (resultado: unknown) => void
}

let registrado: Servidor | null = null

export function registrarServidor(s: Servidor) {
  registrado = s
}

/** O servidor, na plataforma; null na demonstração. */
export const servidor = (): Servidor | null => registrado
