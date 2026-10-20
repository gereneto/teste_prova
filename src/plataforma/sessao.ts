// A sessão da Plataforma Solar na Prova: a versão TypeScript do solar-sessao.js (contrato v1) do
// plataforma-hub (/comum/), com o mesmo comportamento, conferido pelos mesmos casos de teste
// (sessao.test.ts, cópia dos de hub/ferramentas/teste-sessao.mjs). Não mudar CHAVE.
//
// O ambiente é escolhido pelo endereço:
//   plataformasolar.org.br → produção;  *.site-institucional-c24.workers.dev → teste;  localhost → Supabase local.
// "Continuar conectado neste aparelho" (solar:lembrar): marcado, a sessão fica no localStorage até sair;
// desmarcado, no sessionStorage, só naquela aba, e acaba ao fechar o navegador.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

export const VERSAO = 1
const CHAVE = 'solar-auth'
const LEMBRAR = 'solar:lembrar'

export type NomeAmbiente = 'producao' | 'teste' | 'local'
export interface Ambiente {
  nome: NomeAmbiente
  url: string
  chave: string
}

const AMBIENTES: Record<NomeAmbiente, Ambiente> = {
  producao: { nome: 'producao', url: 'https://rsazegmzlkvqhsrmyfuj.supabase.co', chave: 'sb_publishable_i2w-a-o5IK3pdrs5FKh5uQ_37ciIYWa' },
  teste: { nome: 'teste', url: 'https://azhguphtsspnulvejtfu.supabase.co', chave: 'sb_publishable_PRrAfl8-sOM6DcdrF9G4EA_o0nBaEoG' },
  local: { nome: 'local', url: 'http://127.0.0.1:54321', chave: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH' },
}

/** O que o módulo usa do navegador (nos testes, um navegador de mentira). */
export interface Janela {
  location: { hostname: string; origin: string; pathname: string; search: string; replace(url: string): void; reload(): void }
  localStorage: Storage | null
  sessionStorage: Storage | null
  addEventListener(tipo: 'storage', fn: (e: StorageEvent) => void): void
  fetch?: typeof fetch
}

export function ambienteDe(host: string): Ambiente | null {
  let a: Ambiente | null = null
  if (host === 'plataformasolar.org.br') a = AMBIENTES.producao
  else if (/^[a-z0-9-]+\.site-institucional-c24\.workers\.dev$/.test(host)) a = AMBIENTES.teste
  else if (host === 'localhost' || host === '127.0.0.1') a = AMBIENTES.local
  return a ? { ...a } : null // outro host: sem login
}

export type Sessao = ReturnType<typeof criarSessao>

export function criarSessao(janela: Janela) {
  // ------------------------------------------------------------------ onde a sessão fica
  type Qual = 'aba' | 'aparelho'
  const area = (qual: Qual): Storage | null => {
    try {
      return qual === 'aba' ? janela.sessionStorage : janela.localStorage
    } catch {
      return null
    }
  }
  const lerEm = (qual: Qual, k: string) => {
    const s = area(qual)
    try {
      return s ? s.getItem(k) : null
    } catch {
      return null
    }
  }
  const gravarEm = (qual: Qual, k: string, v: string) => {
    const s = area(qual)
    try {
      s?.setItem(k, v)
    } catch {
      // sem armazenamento: a escolha vale só nesta página
    }
  }
  const tirarDe = (qual: Qual, k: string) => {
    const s = area(qual)
    try {
      s?.removeItem(k)
    } catch {
      // idem
    }
  }

  const lembrar = () => lerEm('aparelho', LEMBRAR) !== '0' // sem escolha: lembrar
  const definirLembrar = (sim: boolean) => gravarEm('aparelho', LEMBRAR, sim ? '1' : '0')

  // A área da sessão desta aba: 'aba' (sessionStorage) ou 'aparelho' (localStorage). Decidida na primeira
  // leitura que acha uma sessão (a da aba vale mais: noutra aba do mesmo navegador pode haver outra pessoa,
  // lembrada) ou numa entrada nova (onde solar:lembrar mandar). Fica fixa enquanto a página estiver aberta:
  // depois de sair, a aba não passa a ler a sessão de outra pessoa.
  let modo: Qual | null = null
  const modoAtual = (): Qual | null => {
    if (!modo) modo = lerEm('aba', CHAVE) ? 'aba' : lerEm('aparelho', CHAVE) ? 'aparelho' : null
    return modo
  }
  const ondeEsta = (): Qual | null => {
    const m = modoAtual()
    return m && lerEm(m, CHAVE) ? m : null
  }

  // O armazenamento que o supabase-js usa: tudo na área desta aba; a renovação fica onde está.
  const armazenamento = {
    getItem: (k: string) => {
      const m = modoAtual()
      return m ? lerEm(m, k) : null
    },
    setItem: (k: string, v: string) => {
      let m = modoAtual()
      if (!m || (k === CHAVE && !lerEm(m, CHAVE))) m = modo = lembrar() ? 'aparelho' : 'aba'
      gravarEm(m, k, v)
    },
    removeItem: (k: string) => {
      const m = modoAtual()
      if (m) tirarDe(m, k)
    },
  }

  const temSessaoSalva = () => !!ondeEsta() // síncrono e offline
  const usuarioSalvo = (): string | null => {
    try {
      const s = JSON.parse(armazenamento.getItem(CHAVE) ?? 'null')
      return s && s.user ? s.user.id : null
    } catch {
      return null
    }
  }

  const ambiente = () => ambienteDe(janela.location.hostname)
  let sb: SupabaseClient | null = null
  let callbacksSaida: (() => void)[] = []
  const usuarioAoCarregar = usuarioSalvo()

  function cliente(): SupabaseClient {
    const a = ambiente()
    if (!a) throw new Error('solar-sessao: host sem ambiente')
    if (!sb) {
      sb = createClient(a.url, a.chave, {
        auth: { storageKey: CHAVE, storage: armazenamento, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
        ...(janela.fetch ? { global: { fetch: janela.fetch } } : {}),
      })
    }
    return sb
  }

  // ------------------------------------------------------------------ entrar e voltar

  // O "voltar" só aceita caminho da própria origem, nunca /entrar/ e nunca algo que o navegador leia como
  // outro site: new URL('/.//x.com', origem).pathname dá '//x.com'.
  function destinoSeguro(v: string | null | undefined): string {
    try {
      const u = new URL(v || '/', janela.location.origin)
      if (u.origin !== janela.location.origin) return '/'
      if (/^\/[/\\]/.test(u.pathname)) return '/'
      if (u.pathname.indexOf('/entrar/') === 0) return '/'
      return u.pathname + u.search
    } catch {
      return '/'
    }
  }
  function irParaEntrar() {
    janela.location.replace('/entrar/?voltar=' + encodeURIComponent(janela.location.pathname + janela.location.search))
  }

  // ------------------------------------------------------------------ sair

  function avisarSaida() {
    for (const fn of callbacksSaida) {
      try {
        fn()
      } catch {
        // um aviso com erro não impede os outros
      }
    }
    callbacksSaida = []
  }
  function recarregarSeMudou() {
    const agora = usuarioSalvo()
    if (usuarioAoCarregar && agora && agora !== usuarioAoCarregar) janela.location.reload()
  }
  // Chama fn quando a sessão desta aba acabar, por esta ou por outra aba de qualquer app. O aviso de outra aba
  // só vale se a sessão daqui tiver sumido: com "não lembrar", cada aba tem a sua.
  function aoSair(fn: () => void) {
    callbacksSaida.push(fn)
    if (callbacksSaida.length > 1) return
    cliente().auth.onAuthStateChange((ev) => {
      if (ev === 'SIGNED_OUT' && !temSessaoSalva()) avisarSaida()
      // Outra pessoa entrou e a sessão desta aba virou a dela: recarrega, para não gravar o trabalho de X na conta de Y.
      if (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED') recarregarSeMudou()
    })
    janela.addEventListener('storage', (e) => {
      if (e.key !== CHAVE) return
      if (!temSessaoSalva()) {
        avisarSaida()
        return
      }
      recarregarSeMudou()
    })
  }
  function limparSessaoLocal(onde: Qual) {
    const s = area(onde)
    if (!s) return
    try {
      for (let i = s.length - 1; i >= 0; i--) {
        const k = s.key(i)
        if (k && (k === CHAVE || k.indexOf(CHAVE + '-') === 0)) s.removeItem(k)
      }
    } catch {
      // nada a fazer
    }
  }
  // Encerra no Auth todas as sessões da pessoa. true se encerrou (ou se já não havia sessão). Vai direto ao Auth
  // porque o signOut({ scope: 'global' }) do supabase-js 2.117 apaga a sessão local mesmo quando a chamada falha.
  async function sairNoAuth(): Promise<boolean> {
    const a = ambiente()!
    let s
    try {
      s = await cliente().auth.getSession()
    } catch {
      return false
    }
    if (s.error) return false
    if (!s.data.session) return true
    let r: Response
    try {
      r = await (janela.fetch ?? fetch)(a.url + '/auth/v1/logout?scope=global', {
        method: 'POST',
        credentials: 'omit',
        headers: { apikey: a.chave, Authorization: 'Bearer ' + s.data.session.access_token },
      })
    } catch {
      return false
    }
    return r.ok || r.status === 401 || r.status === 403 || r.status === 404
  }
  // Devolve true se saiu. Com todos = true e sem rede, NÃO apaga nada e devolve false.
  async function sair(todos: boolean): Promise<boolean> {
    const onde = ondeEsta()
    if (todos && !(await sairNoAuth())) return false
    try {
      await cliente().auth.signOut({ scope: 'local' })
    } catch {
      // sem rede o signOut pode falhar: a sessão local sai do mesmo jeito
    }
    if (onde) limparSessaoLocal(onde)
    avisarSaida() // a própria aba não recebe o evento storage
    return true
  }

  return { VERSAO, ambiente, cliente, temSessaoSalva, usuarioSalvo, ondeEsta, lembrar, definirLembrar, destinoSeguro, irParaEntrar, aoSair, sair }
}

let unica: Sessao | null = null
/** A sessão desta página (com o window de verdade). */
export function sessao(): Sessao {
  return (unica ??= criarSessao(window as unknown as Janela))
}
