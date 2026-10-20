import { LogOut, RotateCcw } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import logoBranco from '../assets/marca/logo-solar-branco.png'
import { EntrarTeste } from './EntrarTeste'
import { usePlataforma } from './estado'
import { iniciar, recarregar, sair } from './servidor'

/**
 * A porta da Prova na plataforma: confere a sessão e carrega os dados antes de mostrar as telas. Sem sessão, a
 * produção manda para o /entrar/ do hub; o ambiente de teste (o preview de uma branch, que não tem o hub) mostra a
 * entrada por código aqui mesmo.
 */
export function Portao({ children }: { children: ReactNode }) {
  const p = usePlataforma()
  useEffect(() => {
    void iniciar()
  }, [])

  if (p.fase === 'pronto') return <>{children}</>
  if (p.fase === 'entrar') return <EntrarTeste />
  if (p.fase === 'sem_acesso') {
    return (
      <Moldura titulo="Seu e-mail não tem acesso à Prova Solar">
        <p>O seu cadastro na Plataforma Solar está sem um colégio ou um papel ativo. Fale com a coordenação do seu colégio.</p>
        <BotaoSair />
      </Moldura>
    )
  }
  if (p.fase === 'erro') {
    return (
      <Moldura titulo="Não deu para abrir a Prova Solar">
        <p>{p.erro}</p>
        <div className="form-acoes">
          <button className="btn btn-primario" onClick={recarregar}>
            <RotateCcw size={16} aria-hidden /> Tentar de novo
          </button>
          <BotaoSair />
        </div>
      </Moldura>
    )
  }
  return (
    <Moldura titulo="Abrindo a Prova Solar…">
      <p className="texto-2">Carregando os dados do seu colégio.</p>
    </Moldura>
  )
}

function BotaoSair() {
  return (
    <button className="btn" onClick={() => void sair()}>
      <LogOut size={16} aria-hidden /> Sair
    </button>
  )
}

/** A mesma moldura da entrada: a marca no alto e o conteúdo embaixo. */
export function Moldura({ titulo, children }: { titulo: string; children: ReactNode }) {
  const { ambiente } = usePlataforma()
  return (
    <div className="entrada">
      <section className="entrada-hero">
        <div className="entrada-hero-conteudo">
          <a href="/" aria-label="Plataforma Solar">
            <img src={logoBranco} alt="Solar Colégios" className="entrada-hero-logo" />
          </a>
          <h1>Prova Solar</h1>
          <p className="entrada-hero-sub">Lançamento e resultados da avaliação anual da Rede</p>
          {ambiente === 'teste' && <span className="selo selo-ambar">Ambiente de teste</span>}
        </div>
      </section>
      <main className="entrada-corpo">
        <section className="entrada-passo">
          <h2>{titulo}</h2>
          {children}
        </section>
      </main>
    </div>
  )
}
