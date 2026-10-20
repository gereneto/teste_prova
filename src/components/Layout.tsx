import { ALargeSmall, LifeBuoy, LogOut, Repeat, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import logoSolar from '../assets/marca/logo-solar.png'
import { avisosPendentes, pessoaDoPerfil, turmasDoProfessor, type Pessoa } from '../lib/consultas'
import { turmaNome } from '../lib/formato'
import { dispensarAviso, usePlataforma } from '../plataforma/estado'
import { chave, PLATAFORMA } from '../plataforma/modo'
import { servidor } from '../plataforma/ponte'
import { useDb } from '../store/db'
import { definirPerfil, usePerfil } from '../store/perfil'
import type { Db, Perfil } from '../types'
import { AjudaConteudo } from './Ajuda'
import { Aviso, Janela } from './ui'

type Papel = Perfil['papel']

export const INICIO_DO_PAPEL: Record<Papel, string> = {
  professor: '/professor',
  coordenacao: '/coordenacao',
  solar: '/solar',
}

export const NOME_DO_PAPEL: Record<Papel, string> = {
  professor: 'Professor(a)',
  coordenacao: 'Coordenação',
  solar: 'Equipe Solar',
}

const NOMES_PAPEL_SOLAR = { responsavel: 'Responsável', edicao: 'Edição', visualizacao: 'Só visualização' } as const

/** Como a pessoa aparece no topo: o nome e, embaixo, o papel e o colégio. */
export function descreverPessoa(db: Db, pessoa: Pessoa): { nome: string; detalhe: string } {
  if (pessoa.papel === 'solar') return { nome: pessoa.nome, detalhe: `Equipe Solar · ${NOMES_PAPEL_SOLAR[pessoa.membro.papel]}` }
  const colegioId = pessoa.papel === 'professor' ? pessoa.professor.colegioId : pessoa.coordenador.colegioId
  const colegio = db.colegios.find((c) => c.id === colegioId)?.nome ?? ''
  if (pessoa.papel === 'coordenacao') return { nome: pessoa.nome, detalhe: `${pessoa.coordenador.responsavel ? 'Responsável pela coordenação' : 'Coordenação'} · ${colegio}` }
  const turmas = turmasDoProfessor(db, pessoa.professor.id).map(turmaNome)
  return { nome: pessoa.nome, detalhe: [turmas.join(', '), colegio].filter(Boolean).join(' · ') }
}

interface Aba {
  para: string
  rotulo: string
  fim?: boolean
  contador?: number
}

// "Início" é sempre a lista do que fazer; "Resultados" é sempre onde ficam os números.
function abasDo(db: Db, perfil: Perfil): Aba[] {
  if (perfil.papel === 'professor') {
    return [
      { para: '/professor', rotulo: 'Início', fim: true },
      ...turmasDoProfessor(db, perfil.professorId).map((t) => ({ para: `/professor/turma/${t.id}`, rotulo: turmaNome(t) })),
    ]
  }
  if (perfil.papel === 'coordenacao') {
    return [
      { para: '/coordenacao', rotulo: 'Início', fim: true },
      { para: '/coordenacao/avisos', rotulo: 'Avisos', contador: avisosPendentes(db, perfil.colegioId).length },
      { para: '/coordenacao/equipe', rotulo: 'Equipe' },
      { para: '/coordenacao/professores', rotulo: 'Professores' },
      { para: '/coordenacao/turmas', rotulo: 'Turmas e alunos' },
      { para: '/coordenacao/provas', rotulo: 'Provas' },
      { para: '/coordenacao/resultados', rotulo: 'Resultados' },
    ]
  }
  return [
    { para: '/solar', rotulo: 'Início', fim: true },
    { para: '/solar/colegios', rotulo: 'Colégios' },
    { para: '/solar/avaliacoes', rotulo: 'Avaliações' },
    { para: '/solar/resultados', rotulo: 'Resultados' },
    { para: '/solar/equipe', rotulo: 'Equipe' },
    { para: '/solar/configuracoes', rotulo: 'Configurações' },
  ]
}

export function Marca() {
  const { ambiente } = usePlataforma()
  const logo = <img src={logoSolar} alt="Solar Colégios" className="marca-logo" />
  return (
    <div className="marca">
      {/* Na plataforma, o logo leva à página inicial da Plataforma Solar. */}
      {PLATAFORMA ? (
        <a href="/" className="marca-link" title="Página inicial da Plataforma Solar">
          {logo}
        </a>
      ) : (
        logo
      )}
      <span className="marca-divisor" aria-hidden />
      <span className="marca-nome">Prova Solar</span>
      {PLATAFORMA ? (
        ambiente !== 'producao' && <span className="selo selo-ambar">Ambiente de teste</span>
      ) : (
        <span className="selo selo-ambar">Versão de teste</span>
      )}
    </div>
  )
}

/** Os avisos das gravações no banco (plataforma): erros ficam até fechar; os outros somem sozinhos. */
function AvisosGravacao() {
  const { avisos } = usePlataforma()
  if (!avisos.length) return null
  return (
    <div className="avisos-gravacao" aria-live="polite">
      {avisos.map((a) => (
        <Aviso
          key={a.id}
          tom={a.tom}
          acoes={
            <button className="btn btn-pequeno btn-fantasma" onClick={() => dispensarAviso(a.id)} aria-label="Fechar o aviso">
              <X size={15} aria-hidden />
            </button>
          }
        >
          {a.texto}
        </Aviso>
      ))}
    </div>
  )
}

const CHAVE_LETRA = chave('letra-maior')

function lerLetraMaior() {
  try {
    return localStorage.getItem(CHAVE_LETRA) === '1'
  } catch {
    return false
  }
}

/** "Letra maior" aumenta tudo em cerca de 15%; o aparelho guarda a escolha. */
function useLetraMaior(): [boolean, (valor: boolean) => void] {
  const [ativa, setAtiva] = useState(lerLetraMaior)
  useEffect(() => {
    document.documentElement.classList.toggle('letra-maior', ativa)
  }, [ativa])
  return [
    ativa,
    (valor) => {
      setAtiva(valor)
      try {
        if (valor) localStorage.setItem(CHAVE_LETRA, '1')
        else localStorage.removeItem(CHAVE_LETRA)
      } catch {
        // Sem armazenamento, a escolha vale até fechar a página.
      }
    },
  ]
}

/** Moldura das páginas de um papel. Sem perfil compatível, volta para a entrada. */
export function Area({ papel }: { papel: Papel }) {
  const perfil = usePerfil()
  const db = useDb()
  const navigate = useNavigate()
  const [ajudaAberta, setAjudaAberta] = useState(false)
  const [letraMaior, setLetraMaior] = useLetraMaior()
  const { perfis } = usePlataforma()
  const pessoa = perfil && perfil.papel === papel ? pessoaDoPerfil(db, perfil) : null
  if (!perfil || !pessoa) return <Navigate to="/" replace />
  const quem = descreverPessoa(db, pessoa)
  const abas = abasDo(db, perfil)

  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <Marca />
          <nav className="abas" aria-label="Seções">
            <div className="abas-interno">
              {abas.map((aba) => (
                <NavLink key={aba.para} to={aba.para} end={aba.fim} className={({ isActive }) => `aba ${isActive ? 'ativa' : ''}`}>
                  {aba.rotulo}
                  {aba.contador ? <span className="aba-contador">{aba.contador}</span> : null}
                </NavLink>
              ))}
            </div>
          </nav>
          <div className="topo-perfil">
            <span className="topo-descricao">
              <span className="topo-nome">{quem.nome}</span>
              <span className="topo-papel">{quem.detalhe}</span>
            </span>
            <div className="topo-botoes">
              <button className="btn btn-pequeno btn-secundario" onClick={() => setAjudaAberta(true)}>
                <LifeBuoy size={16} aria-hidden /> Preciso de ajuda
              </button>
              <button
                className={`btn btn-pequeno btn-fantasma ${letraMaior ? 'btn-marcado' : ''}`}
                aria-pressed={letraMaior}
                aria-label="Letra maior"
                onClick={() => setLetraMaior(!letraMaior)}
              >
                <ALargeSmall size={17} aria-hidden /> <span className="rotulo-botao">Letra maior</span>
              </button>
              {PLATAFORMA ? (
                <>
                  {perfis.length > 1 && (
                    <button
                      className="btn btn-pequeno btn-fantasma"
                      onClick={() => {
                        definirPerfil(null)
                        navigate('/')
                      }}
                      aria-label="Trocar de papel"
                    >
                      <Repeat size={15} aria-hidden /> <span className="rotulo-botao">Trocar de papel</span>
                    </button>
                  )}
                  <button className="btn btn-pequeno btn-fantasma" onClick={() => void servidor()?.sair()} aria-label="Sair">
                    <LogOut size={15} aria-hidden /> <span className="rotulo-botao">Sair</span>
                  </button>
                </>
              ) : (
                <button className="btn btn-pequeno btn-fantasma" onClick={() => navigate('/')} aria-label="Trocar perfil">
                  <Repeat size={15} aria-hidden /> <span className="rotulo-botao">Trocar perfil</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="conteudo">
        <Outlet />
      </main>
      {PLATAFORMA && <AvisosGravacao />}
      <Janela titulo="Precisa de ajuda?" aberta={ajudaAberta} aoFechar={() => setAjudaAberta(false)} larga>
        <AjudaConteudo db={db} perfil={perfil} />
      </Janela>
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
