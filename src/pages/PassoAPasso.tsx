import { ArrowLeft, Printer } from 'lucide-react'
import { useNavigate, useParams } from 'react-router'
import logoSolar from '../assets/marca/logo-solar.png'
import { PALAVRAS, PASSOS } from '../components/Ajuda'
import { contatoDoColegio, responsavelSolar } from '../lib/consultas'
import { useDb } from '../store/db'
import { usePerfil } from '../store/perfil'
import type { Perfil } from '../types'

const TITULOS = { professor: 'professor(a)', coordenacao: 'coordenação', solar: 'equipe Solar' } as const

/** O passo a passo de cada perfil numa folha A4, com os contatos de quem ajuda. */
export default function PassoAPasso() {
  const { papel: parametro = 'professor' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const papel: Perfil['papel'] = parametro === 'coordenacao' || parametro === 'solar' ? parametro : 'professor'
  const coordenacao = perfil && perfil.papel !== 'solar' ? contatoDoColegio(db, perfil.colegioId) : null
  const solar = responsavelSolar(db)

  return (
    <div className="impressao">
      <div className="impressao-barra nao-imprimir">
        <button className="btn btn-fantasma" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <div className="impressao-titulo">
          <strong>Passo a passo</strong>
          <span className="texto-2">Uma folha A4 para deixar perto do computador.</span>
        </div>
        <button className="btn btn-primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </div>

      <article className="pagina-a4 passo-a-passo">
        <header className="pagina-a4-topo">
          <img src={logoSolar} alt="Solar Colégios" />
          <div>
            <p className="sobretitulo">Prova Solar</p>
            <h1>Passo a passo da {TITULOS[papel]}</h1>
            <p>Endereço do site: {window.location.origin + window.location.pathname}</p>
          </div>
        </header>
        <ol className="passos passos-grandes">
          {PASSOS[papel].map((passo) => (
            <li key={passo.titulo}>
              <strong>{passo.titulo}.</strong> {passo.texto}
            </li>
          ))}
        </ol>
        <section>
          <h2>Quem ajuda</h2>
          <ul>
            {papel === 'professor' && coordenacao && (
              <li>
                Coordenação: {coordenacao.nome}
                {coordenacao.telefone && `, ${coordenacao.telefone}`}
                {coordenacao.email && `, ${coordenacao.email}`}
              </li>
            )}
            {solar && (
              <li>
                Equipe Solar: {solar.nome}
                {solar.telefone && `, ${solar.telefone}`}
                {solar.email && `, ${solar.email}`}
              </li>
            )}
          </ul>
        </section>
        <section>
          <h2>Palavras do site</h2>
          <dl className="palavras">
            {PALAVRAS.map((p) => (
              <div key={p.termo}>
                <dt>{p.termo}</dt>
                <dd>{p.definicao}</dd>
              </div>
            ))}
          </dl>
        </section>
      </article>
    </div>
  )
}
