import { useState, type FormEvent, type ReactNode } from 'react'
import type { Contato } from '../types'
import { PLATAFORMA } from '../plataforma/modo'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Nome, e-mail e telefone de uma pessoa da coordenação ou da equipe Solar. */
export function FormularioContato(props: {
  inicial?: Contato
  titulo?: string
  rotuloSalvar: string
  aoSalvar: (contato: Contato) => void
  aoCancelar: () => void
  extra?: ReactNode
}) {
  const [contato, setContato] = useState<Contato>(props.inicial ?? { nome: '', email: '', telefone: '' })
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (parcial: Partial<Contato>) => {
    setContato({ ...contato, ...parcial })
    setErro(null)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo = { nome: contato.nome.trim().replace(/\s+/g, ' '), email: contato.email.trim().toLowerCase(), telefone: contato.telefone.trim() }
    if (!limpo.nome) return setErro('Informe o nome.')
    if (!limpo.email) return setErro(PLATAFORMA ? 'Informe o e-mail: é com ele que a pessoa entra no site.' : 'Informe o e-mail: é para ele que vai o link de acesso ao site.')
    if (!EMAIL_VALIDO.test(limpo.email)) return setErro('Esse e-mail não parece válido. Confira.')
    props.aoSalvar(limpo)
  }

  return (
    <form className="cartao form" onSubmit={enviar} noValidate>
      {props.titulo && <h3 className="subtitulo">{props.titulo}</h3>}
      <div className="form-grade">
        <label className="campo">
          <span>Nome</span>
          <input value={contato.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Maria da Silva" autoFocus />
        </label>
        <label className="campo">
          <span>E-mail</span>
          <input type="email" value={contato.email} onChange={(e) => mudar({ email: e.target.value })} placeholder="maria@colegio.com.br" />
        </label>
        <label className="campo">
          <span>Telefone (opcional)</span>
          <input type="tel" value={contato.telefone} onChange={(e) => mudar({ telefone: e.target.value })} placeholder="(19) 3333-4444" />
        </label>
      </div>
      {props.inicial && contato.email.trim().toLowerCase() !== props.inicial.email && EMAIL_VALIDO.test(contato.email.trim()) && (
        <p className="campo-ajuda">
          {PLATAFORMA
            ? 'Ao salvar, o novo e-mail recebe um convite, e as sessões abertas com o e-mail antigo acabam.'
            : 'Ao salvar, o novo e-mail recebe um link de acesso, e o link enviado antes deixa de valer.'}
        </p>
      )}
      {!props.inicial && (
        <p className="campo-ajuda">
          {PLATAFORMA
            ? 'A pessoa recebe neste e-mail um convite. Para entrar, ela digita o e-mail e recebe um código de 4 dígitos (sem senha).'
            : 'A pessoa recebe neste e-mail o link de acesso ao site, que entra direto na conta dela.'}
        </p>
      )}
      {props.extra}
      {erro && <p className="erro-campo">{erro}</p>}
      <div className="form-acoes">
        <button type="submit" className="btn btn-primario">
          {props.rotuloSalvar}
        </button>
        <button type="button" className="btn btn-fantasma" onClick={props.aoCancelar}>
          Cancelar
        </button>
      </div>
    </form>
  )
}
