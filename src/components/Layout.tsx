import { Repeat, Sun } from 'lucide-react'
import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useDb } from '../store/db'
import { usePerfil } from '../store/perfil'
import type { Db, Perfil } from '../types'

type Papel = Perfil['papel']

const ABAS: Record<Papel, { para: string; rotulo: string; fim?: boolean }[]> = {
  professor: [],
  coordenacao: [
    { para: '/coordenacao', rotulo: 'Painel', fim: true },
    { para: '/coordenacao/turmas', rotulo: 'Turmas e alunos' },
    { para: '/coordenacao/professores', rotulo: 'Professores' },
  ],
  solar: [
    { para: '/solar', rotulo: 'Painel', fim: true },
    { para: '/solar/colegios', rotulo: 'Colégios' },
    { para: '/solar/avaliacoes', rotulo: 'Avaliações' },
    { para: '/solar/estatisticas', rotulo: 'Estatísticas' },
    { para: '/solar/configuracoes', rotulo: 'Configurações' },
  ],
}

export const INICIO_DO_PAPEL: Record<Papel, string> = {
  professor: '/professor',
  coordenacao: '/coordenacao',
  solar: '/solar',
}

/** Texto do perfil no topo da página; null se o colégio ou o professor não existem mais. */
export function descreverPerfil(perfil: Perfil, db: Db): string | null {
  if (perfil.papel === 'solar') return 'Equipe Solar'
  const colegio = db.colegios.find((c) => c.id === perfil.colegioId)
  if (!colegio) return null
  if (perfil.papel === 'coordenacao') return `Coordenação · ${colegio.nome}`
  const professor = db.professores.find((p) => p.id === perfil.professorId && p.colegioId === colegio.id)
  return professor ? `${professor.nome} · ${colegio.nome}` : null
}

export function Marca() {
  return (
    <div className="marca">
      <Sun size={22} aria-hidden className="marca-sol" />
      <span className="marca-nome">Prova Solar</span>
      <span className="marca-selo">versão de teste</span>
    </div>
  )
}

/** Moldura das páginas de um papel. Sem perfil compatível, volta para a pergunta inicial. */
export function Area({ papel }: { papel: Papel }) {
  const perfil = usePerfil()
  const db = useDb()
  const navigate = useNavigate()
  const descricao = perfil && perfil.papel === papel ? descreverPerfil(perfil, db) : null
  if (!descricao) return <Navigate to="/" replace />

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <Marca />
          <div className="topo-perfil">
            <span className="topo-descricao">{descricao}</span>
            <button className="btn btn-pequeno btn-fantasma" onClick={() => navigate('/')}>
              <Repeat size={15} aria-hidden /> Trocar perfil
            </button>
          </div>
        </div>
        {ABAS[papel].length > 0 && (
          <nav className="abas" aria-label="Seções">
            <div className="abas-interno">
              {ABAS[papel].map((aba) => (
                <NavLink key={aba.para} to={aba.para} end={aba.fim} className={({ isActive }) => `aba ${isActive ? 'ativa' : ''}`}>
                  {aba.rotulo}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
    </div>
  )
}

/** Com HashRouter o navegador não volta ao topo ao trocar de página; este componente faz isso. */
export function RolarParaTopo() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}
