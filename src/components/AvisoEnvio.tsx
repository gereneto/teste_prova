import { Send } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { reenviarLink } from '../store/acoes'
import type { Id } from '../types'
import { Aviso } from './ui'
import { PLATAFORMA } from '../plataforma/modo'

/** Avisa que o acesso foi para o e-mail da pessoa: o convite (plataforma) ou o link (demonstração). */
export function AvisoEnvio(props: { email: string | null; aoFechar: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // O aviso pode surgir longe de onde a pessoa clicou: rola a tela até ele.
  useEffect(() => {
    if (props.email) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [props.email])
  if (!props.email) return null
  return (
    <div ref={ref}>
      <Aviso
        tom="sucesso"
        acoes={
          <button className="btn btn-pequeno btn-fantasma" onClick={props.aoFechar}>
            Fechar
          </button>
        }
      >
        {PLATAFORMA ? (
          <>
            Mandamos um convite para <strong>{props.email}</strong>. Para entrar, a pessoa abre a Plataforma Solar, digita este e-mail e recebe
            um código de 4 dígitos. Não há senha.
          </>
        ) : (
          <>
            Enviamos o link de acesso para <strong>{props.email}</strong>. Pelo link, a pessoa entra direto na própria conta, sem senha. Nesta
            versão de teste o e-mail não sai de verdade: ele fica em{' '}
            <Link to="/emails" target="_blank">
              E-mails enviados
            </Link>
            .
          </>
        )}
      </Aviso>
    </div>
  )
}

/** Manda de novo o acesso, para quem perdeu o e-mail: um convite novo (plataforma) ou o mesmo link (demonstração). */
export function BotaoReenviar(props: { tipo: 'professor' | 'coordenador' | 'solar'; id: Id; aoEnviar: (email: string) => void }) {
  return (
    <button
      className="btn btn-pequeno btn-fantasma"
      onClick={() => {
        const email = reenviarLink(props.tipo, props.id)
        if (email) props.aoEnviar(email)
      }}
    >
      <Send size={15} aria-hidden /> {PLATAFORMA ? 'Reenviar convite' : 'Reenviar link'}
    </button>
  )
}
