import { ArrowRight, KeyRound, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Moldura } from './Portao'
import { sessao } from './sessao'

type Resposta = { ok?: boolean; mensagem?: string; token_hash?: string }

async function acesso(corpo: Record<string, string>): Promise<{ status: number; json: Resposta }> {
  const a = sessao().ambiente()!
  const r = await fetch(`${a.url}/functions/v1/acesso`, {
    method: 'POST',
    headers: { apikey: a.chave, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  })
  return { status: r.status, json: ((await r.json().catch(() => ({}))) as Resposta) ?? {} }
}

/**
 * A entrada por código no ambiente de teste. O preview de uma branch (*.workers.dev) não tem o /entrar/ do hub, por
 * isso a Prova tem esta tela, com o mesmo fluxo: e-mail, código de 4 dígitos e "Continuar conectado". Na produção
 * ela nunca aparece: a Prova manda para o /entrar/ do hub.
 */
export function EntrarTeste() {
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email')
  const [email, setEmail] = useState('')
  const [codigo, setCodigo] = useState('')
  const [lembrar, setLembrar] = useState(() => sessao().lembrar())
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function pedir(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return setMensagem({ texto: 'Digite o seu e-mail.', erro: true })
    setOcupado(true)
    setMensagem(null)
    try {
      const r = await acesso({ acao: 'pedir', email: email.trim() })
      if (r.json.ok) {
        setEtapa('codigo')
        setMensagem({ texto: `Mandamos um código de 4 dígitos para ${email.trim()}. Ele vale por 15 minutos.`, erro: false })
      } else {
        setMensagem({ texto: r.json.mensagem ?? 'Não deu para pedir o código.', erro: true })
      }
    } catch {
      setMensagem({ texto: 'Sem conexão com o servidor. Confira a internet.', erro: true })
    } finally {
      setOcupado(false)
    }
  }

  async function verificar(e: FormEvent) {
    e.preventDefault()
    setOcupado(true)
    setMensagem(null)
    try {
      const r = await acesso({ acao: 'verificar', email: email.trim(), codigo })
      if (!r.json.ok || !r.json.token_hash) {
        setMensagem({ texto: r.json.mensagem ?? 'Código não aceito.', erro: true })
        return
      }
      sessao().definirLembrar(lembrar)
      const { error } = await sessao().cliente().auth.verifyOtp({ token_hash: r.json.token_hash, type: 'email' })
      if (error) {
        setMensagem({ texto: 'O código foi aceito, mas a sessão não abriu. Peça outro código.', erro: true })
        return
      }
      window.location.reload()
    } catch {
      setMensagem({ texto: 'Sem conexão com o servidor. Confira a internet.', erro: true })
    } finally {
      setOcupado(false)
    }
  }

  return (
    <Moldura titulo="Entrar">
      <p className="entrada-sub">
        Ambiente de teste da Plataforma Solar, com o banco de teste. Entre com o e-mail cadastrado e o código de 4 dígitos. Pessoas de teste (e-mail
        terminado em .test) não recebem e-mail: o código delas sai do workflow “Código de teste” do plataforma-infra; use “Já tenho um código”.
      </p>
      {etapa === 'email' ? (
        <form className="cartao form" onSubmit={pedir} noValidate>
          <label className="campo campo-largo">
            <span>E-mail</span>
            <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </label>
          <div className="form-acoes">
            <button type="submit" className="btn btn-primario" disabled={ocupado}>
              <Mail size={16} aria-hidden /> Receber o código por e-mail
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (!email.trim()) return setMensagem({ texto: 'Digite o seu e-mail.', erro: true })
                setMensagem(null)
                setEtapa('codigo')
              }}
            >
              <KeyRound size={16} aria-hidden /> Já tenho um código
            </button>
          </div>
        </form>
      ) : (
        <form className="cartao form" onSubmit={verificar} noValidate>
          <p>
            Código para <strong>{email.trim()}</strong>
          </p>
          <label className="campo">
            <span>Código de 4 dígitos</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={9}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="input-curto"
              autoFocus
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
            Continuar conectado neste aparelho
          </label>
          <div className="form-acoes">
            <button type="submit" className="btn btn-primario" disabled={ocupado}>
              Entrar <ArrowRight size={16} aria-hidden />
            </button>
            <button type="button" className="btn btn-fantasma" onClick={() => setEtapa('email')}>
              Trocar o e-mail
            </button>
          </div>
        </form>
      )}
      {mensagem && (
        <p className={mensagem.erro ? 'erro-campo' : 'ok-campo'} role="status">
          {mensagem.texto}
        </p>
      )}
    </Moldura>
  )
}
