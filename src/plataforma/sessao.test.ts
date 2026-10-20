// Os mesmos casos de hub/ferramentas/teste-sessao.mjs (a referência do contrato da sessão), contra a versão
// TypeScript da Prova: supabase-js de verdade, armazenamento em memória e um Auth falso no lugar da rede.
import { describe, expect, it } from 'vitest'
import { ambienteDe, criarSessao, type Janela } from './sessao'

function areaDeMemoria() {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    key: (i: number) => [...m.keys()][i] ?? null,
    clear: () => m.clear(),
    get length() {
      return m.size
    },
    mapa: m,
  }
}
type Area = ReturnType<typeof areaDeMemoria>

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
function sessaoFalsa(uid: string) {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const jwt = [b64({ alg: 'ES256', typ: 'JWT' }), b64({ sub: uid, exp, aud: 'authenticated', role: 'authenticated', amr: [{ method: 'otp' }] }), 'assinatura'].join('.')
  return {
    access_token: jwt,
    refresh_token: 'r-' + uid + '-' + Math.random(),
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: exp,
    user: { id: uid, aud: 'authenticated', role: 'authenticated', email: uid + '@exemplo.org', app_metadata: {}, user_metadata: {} },
  }
}

function navegador(host: string, opcoes: { local?: Area; aba?: Area; semRede?: boolean; uid?: string } = {}) {
  const { local = areaDeMemoria(), aba = areaDeMemoria(), semRede = false, uid = 'u1' } = opcoes
  const pedidos: { url: string; metodo: string }[] = []
  const fetchFalso = (async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = String(url)
    pedidos.push({ url: u, metodo: init.method || 'GET' })
    if (semRede) throw new TypeError('Failed to fetch')
    const json = (corpo: object, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } })
    if (u.includes('/auth/v1/verify')) return json(sessaoFalsa(uid))
    if (u.includes('/auth/v1/token?grant_type=refresh_token')) return json(sessaoFalsa(uid))
    if (u.includes('/auth/v1/logout')) return new Response(null, { status: 204 })
    return json({ msg: 'não previsto: ' + u }, 500)
  }) as typeof fetch
  const janela: Janela = {
    location: { hostname: host, origin: 'https://' + host, pathname: '/', search: '', replace() {}, reload() {} },
    localStorage: local as unknown as Storage,
    sessionStorage: aba as unknown as Storage,
    addEventListener() {},
    fetch: fetchFalso,
  }
  return { S: criarSessao(janela), local, aba, pedidos }
}

const HOST = 'plataformasolar.org.br'
async function entrar(nav: ReturnType<typeof navegador>) {
  const r = await nav.S.cliente().auth.verifyOtp({ token_hash: 'th', type: 'email' })
  if (r.error) throw r.error
  return r.data.session
}

describe('ambiente pelo endereço', () => {
  it.each([
    ['plataformasolar.org.br', 'producao'],
    ['etapa-5-prova-solar.site-institucional-c24.workers.dev', 'teste'],
    ['localhost', 'local'],
    ['127.0.0.1', 'local'],
    ['www.plataformasolar.org.br', null],
    ['plataformasolar.org.br.evil.com', null],
    ['qualquer.workers.dev', null],
    ['x.site-institucional-c24.workers.dev.evil.com', null],
  ])('%s → %s', (host, esperado) => {
    expect(ambienteDe(host)?.nome ?? null).toBe(esperado)
  })
  it('produção usa o solar-prod e o preview usa o solar-teste', () => {
    expect(ambienteDe(HOST)!.url).toBe('https://rsazegmzlkvqhsrmyfuj.supabase.co')
    expect(ambienteDe('etapa-5-prova-solar.site-institucional-c24.workers.dev')!.url).toBe('https://azhguphtsspnulvejtfu.supabase.co')
  })
})

describe('onde a sessão fica', () => {
  it('sem escolha guardada, lembra (marcado por padrão) e a sessão vai para o localStorage', async () => {
    const nav = navegador(HOST)
    expect(nav.S.lembrar()).toBe(true)
    await entrar(nav)
    expect(nav.local.getItem('solar-auth')).not.toBeNull()
    expect(nav.aba.getItem('solar-auth')).toBeNull()
    expect(nav.S.ondeEsta()).toBe('aparelho')
    expect(nav.S.usuarioSalvo()).toBe('u1')
    expect((await nav.S.cliente().auth.getSession()).data.session?.user.id).toBe('u1')
    expect(nav.pedidos.some((p) => p.url === 'https://rsazegmzlkvqhsrmyfuj.supabase.co/auth/v1/verify')).toBe(true)
  })

  it('desmarcado: a sessão fica na aba; a renovação fica onde está; aba nova não tem sessão', async () => {
    const nav = navegador(HOST)
    nav.S.definirLembrar(false)
    expect(nav.local.getItem('solar:lembrar')).toBe('0')
    await entrar(nav)
    expect(nav.aba.getItem('solar-auth')).not.toBeNull()
    expect(nav.local.getItem('solar-auth')).toBeNull()
    expect(nav.S.ondeEsta()).toBe('aba')
    expect([...nav.local.mapa.keys()]).toEqual(['solar:lembrar'])
    nav.S.definirLembrar(true)
    const r = await nav.S.cliente().auth.refreshSession()
    expect(r.error).toBeNull()
    expect(nav.aba.getItem('solar-auth')).not.toBeNull()
    expect(nav.local.getItem('solar-auth')).toBeNull()
    const nova = navegador(HOST, { local: nav.local })
    expect(nova.S.temSessaoSalva()).toBe(false)
    expect((await nova.S.cliente().auth.getSession()).data.session).toBeNull()
  })

  it('duas pessoas no mesmo navegador: uma lembrada, outra só na aba', async () => {
    const local = areaDeMemoria()
    const a = navegador(HOST, { local, uid: 'lembrada' })
    await entrar(a)
    const b = navegador(HOST, { local, uid: 'na-aba' })
    expect(b.S.usuarioSalvo()).toBe('lembrada')
    await b.S.sair(false)
    b.S.definirLembrar(false)
    await entrar(b)
    expect(b.S.usuarioSalvo()).toBe('na-aba')
    expect(b.S.ondeEsta()).toBe('aba')
    a.S.definirLembrar(true)
    await entrar(a)
    expect(a.S.ondeEsta()).toBe('aparelho')
    expect(a.S.usuarioSalvo()).toBe('lembrada')
    expect(b.S.usuarioSalvo()).toBe('na-aba')
    await b.S.sair(false)
    expect(b.aba.getItem('solar-auth')).toBeNull()
    expect(local.getItem('solar-auth')).not.toBeNull()
    expect(b.S.temSessaoSalva()).toBe(false)
    expect((await b.S.cliente().auth.getSession()).data.session).toBeNull()
    await a.S.sair(false)
    expect(local.getItem('solar-auth')).toBeNull()
    expect(a.pedidos.some((p) => p.url.includes('/auth/v1/logout') && p.url.includes('scope=local'))).toBe(true)
  })
})

describe('sair', () => {
  it('de todos sem rede: não apaga nada e não avisa; com rede: apaga', async () => {
    const local = areaDeMemoria()
    const a = navegador(HOST, { local })
    await entrar(a)
    const offline = navegador(HOST, { local, semRede: true })
    let avisou = false
    offline.S.aoSair(() => (avisou = true))
    expect(await offline.S.sair(true)).toBe(false)
    expect(local.getItem('solar-auth')).not.toBeNull()
    expect(avisou).toBe(false)
    expect(await a.S.sair(true)).toBe(true)
    expect(local.getItem('solar-auth')).toBeNull()
    expect(a.pedidos.some((p) => p.url.includes('/auth/v1/logout') && p.url.includes('scope=global'))).toBe(true)
  })

  it('deste aparelho sem rede: apaga a sessão local mesmo assim', async () => {
    const local = areaDeMemoria()
    const a = navegador(HOST, { local })
    await entrar(a)
    const offline = navegador(HOST, { local, semRede: true })
    expect(await offline.S.sair(false)).toBe(true)
    expect(local.getItem('solar-auth')).toBeNull()
  })

  it('aoSair avisa quando a própria sessão acaba', async () => {
    const a = navegador(HOST, { uid: 'x' })
    a.S.definirLembrar(false)
    await entrar(a)
    let avisos = 0
    a.S.aoSair(() => avisos++)
    await a.S.cliente().auth.signOut({ scope: 'local' })
    expect(avisos).toBe(1)
  })
})

describe('o "voltar" do /entrar/', () => {
  const S = navegador(HOST).S
  it.each([
    ['/prova/', '/prova/'],
    ['/prova/?a=1', '/prova/?a=1'],
    ['https://outro.site/x', '/'],
    ['//outro.site/x', '/'],
    ['/.//outro.site', '/'],
    ['/entrar/', '/'],
    ['', '/'],
  ])('%s → %s', (v, esperado) => expect(S.destinoSeguro(v)).toBe(esperado))
})
