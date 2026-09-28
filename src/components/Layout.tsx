import { Repeat } from 'lucide-react'
import { useEffect } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import logoSolar from '../assets/marca/logo-solar.png'
import { useDb } from '../store/db'
import { usePerfil } from '../store/perfil'
import type { Db, Perfil } from '../types'

type Papel = Perfil['papel']

// Navegação em Title Case, como no site da Solar.
const ABAS: Record<Papel, { para: string; rotulo: string; fim?: boolean }[]> = {
  professor: [],
  coordenacao: [
    { para: '/coordenacao', rotulo: 'Painel', fim: true },
    { para: '/coordenacao/turmas', rotulo: 'Turmas e Alunos' },
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

const NOME_DO_PAPEL: Record<Papel, string> = {
  professor: 'Professor(a)',
  coordenacao: 'Coordenação',
  solar: 'Equipe Solar',
}

/** Papel e nome de quem está usando; null se o colégio ou o professor não existem mais. */
export function identificarPerfil(perfil: Perfil, db: Db): { papel: string; nome: string } | null {
  if (perfil.papel === 'solar') return { papel: NOME_DO_PAPEL.solar, nome: 'Rede Solar' }
  const colegio = db.colegios.find((c) => c.id === perfil.colegioId)
  if (!colegio) return null
  if (perfil.papel === 'coordenacao') return { papel: NOME_DO_PAPEL.coordenacao, nome: colegio.nome }
  const professor = db.professores.find((p) => p.id === perfil.professorId && p.colegioId === colegio.id)
  return professor ? { papel: NOME_DO_PAPEL.professor, nome: `${professor.nome} · ${colegio.nome}` } : null
}

/** Texto do perfil em uma linha, como "Coordenação · Colégio Monte Verde". */
export function descreverPerfil(perfil: Perfil, db: Db): string | null {
  if (perfil.papel === 'solar') return NOME_DO_PAPEL.solar
  const identificado = identificarPerfil(perfil, db)
  return identificado && `${perfil.papel === 'coordenacao' ? `${identificado.papel} · ` : ''}${identificado.nome}`
}

export function Marca() {
  return (
    <div className="marca">
      <img src={logoSolar} alt="Solar Colégios" className="marca-logo" />
      <span className="marca-divisor" aria-hidden />
      <span className="marca-nome">Prova Solar</span>
      <span className="selo selo-ambar">Versão de teste</span>
    </div>
  )
}

/** Moldura das páginas de um papel. Sem perfil compatível, volta para a pergunta inicial. */
export function Area({ papel }: { papel: Papel }) {
  const perfil = usePerfil()
  const db = useDb()
  const navigate = useNavigate()
  const identificado = perfil && perfil.papel === papel ? identificarPerfil(perfil, db) : null
  if (!identificado) return <Navigate to="/" replace />

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <Marca />
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
          <div className="topo-perfil">
            <span className="topo-descricao">
              <span className="topo-papel">{identificado.papel}</span>
              <span className="topo-nome">{identificado.nome}</span>
            </span>
            <button className="btn btn-pequeno btn-fantasma" onClick={() => navigate('/')}>
              <Repeat size={15} aria-hidden /> Trocar perfil
            </button>
          </div>
        </div>
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
