import { ArrowRight } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router'
import logoBranco from '../assets/marca/logo-solar-branco.png'
import { INICIO_DO_PAPEL } from '../components/Layout'
import { Vazio } from '../components/ui'
import { useDb } from '../store/db'
import { definirPerfil, usePerfil } from '../store/perfil'
import type { Db, Perfil } from '../types'
import { usePlataforma } from './estado'

const NOMES_SOLAR = { responsavel: 'responsável pela equipe', edicao: 'com permissão de edição', visualizacao: 'só visualização' } as const

function descrever(db: Db, perfil: Perfil): { titulo: string; sub: string } {
  if (perfil.papel === 'solar') {
    const membro = db.equipeSolar.find((m) => m.id === perfil.membroId)
    return { titulo: 'Equipe Solar', sub: membro ? NOMES_SOLAR[membro.papel] : '' }
  }
  const colegio = db.colegios.find((c) => c.id === perfil.colegioId)?.nome ?? ''
  if (perfil.papel === 'coordenacao') {
    const responsavel = db.coordenadores.find((c) => c.id === perfil.coordenadorId && c.colegioId === perfil.colegioId)?.responsavel
    return { titulo: responsavel ? 'Responsável pela coordenação' : 'Coordenação', sub: colegio }
  }
  return { titulo: 'Professor(a)', sub: colegio }
}

/**
 * O início da Prova na plataforma: quem tem um papel só entra direto nele; quem tem mais de um (coordenação que
 * também dá aula, pessoa em dois colégios) escolhe com qual entrar. Sem a entrada por perfil da demonstração.
 */
export default function EntradaPlataforma() {
  const db = useDb()
  const { perfis, eu } = usePlataforma()
  const atual = usePerfil()
  const navigate = useNavigate()
  if (atual) return <Navigate to={INICIO_DO_PAPEL[atual.papel]} replace />
  if (perfis.length === 1) return <Navigate to={INICIO_DO_PAPEL[perfis[0].papel]} replace />

  function entrar(perfil: Perfil) {
    definirPerfil(perfil)
    navigate(INICIO_DO_PAPEL[perfil.papel])
  }

  return (
    <div className="entrada">
      <section className="entrada-hero">
        <div className="entrada-hero-conteudo">
          <a href="/" aria-label="Plataforma Solar">
            <img src={logoBranco} alt="Solar Colégios" className="entrada-hero-logo" />
          </a>
          <h1>Prova Solar</h1>
          <p className="entrada-hero-sub">Lançamento e resultados da avaliação anual da Rede</p>
        </div>
      </section>
      <main className="entrada-corpo">
        <section className="entrada-passo">
          <p className="sobretitulo">Entrada</p>
          <h2>{eu ? `Olá, ${eu.nome.split(' ')[0]}. Como você quer entrar?` : 'Como você quer entrar?'}</h2>
          <p className="entrada-sub">Você tem mais de um papel na Prova Solar. Dá para trocar depois, pelo botão “Trocar de papel”, no alto.</p>
          {perfis.length ? (
            <ul className="entrada-lista">
              {perfis.map((perfil) => {
                const { titulo, sub } = descrever(db, perfil)
                return (
                  <li key={JSON.stringify(perfil)}>
                    <button className="entrada-item" onClick={() => entrar(perfil)}>
                      <span>
                        <span className="entrada-item-titulo">{titulo}</span>
                        <span className="entrada-item-sub">{sub}</span>
                      </span>
                      <ArrowRight size={18} aria-hidden />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <Vazio titulo="Seu cadastro está sem papel na Prova Solar">Fale com a coordenação do seu colégio.</Vazio>
          )}
        </section>
      </main>
    </div>
  )
}
