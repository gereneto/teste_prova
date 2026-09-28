import { ArrowLeft, ArrowRight, ChevronRight, ClipboardList, RotateCcw, Search, Sun, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { descreverPerfil, INICIO_DO_PAPEL, Marca } from '../components/Layout'
import { turmasDoColegio, turmasDoProfessor } from '../lib/consultas'
import { compararTexto, normalizar, plural, turmaNome } from '../lib/formato'
import { restaurarDadosDeExemplo } from '../store/acoes'
import { useDb } from '../store/db'
import { definirPerfil, usePerfil } from '../store/perfil'
import type { Id, Perfil } from '../types'

type Papel = Perfil['papel']

const OPCOES: { papel: Papel; titulo: string; texto: string; Icone: LucideIcon }[] = [
  { papel: 'professor', titulo: 'Professor(a)', texto: 'Lança as respostas dos alunos e vê os resultados das suas turmas.', Icone: ClipboardList },
  { papel: 'coordenacao', titulo: 'Coordenação', texto: 'Cadastra turmas, professores e alunos e acompanha o colégio inteiro.', Icone: Users },
  { papel: 'solar', titulo: 'Equipe Solar', texto: 'Cadastra colégios e provas e vê as estatísticas de toda a rede.', Icone: Sun },
]

export default function Entrada() {
  const db = useDb()
  const perfilAtual = usePerfil()
  const navigate = useNavigate()
  const [papel, setPapel] = useState<Papel | null>(null)
  const [colegioId, setColegioId] = useState<Id | null>(null)
  const [busca, setBusca] = useState('')

  const descricaoAtual = perfilAtual ? descreverPerfil(perfilAtual, db) : null

  function entrar(perfil: Perfil) {
    definirPerfil(perfil)
    navigate(INICIO_DO_PAPEL[perfil.papel])
  }

  function escolherPapel(escolhido: Papel) {
    if (escolhido === 'solar') entrar({ papel: 'solar' })
    else setPapel(escolhido)
  }

  function escolherColegio(id: Id) {
    if (papel === 'coordenacao') entrar({ papel: 'coordenacao', colegioId: id })
    else {
      setColegioId(id)
      setBusca('')
    }
  }

  function voltar() {
    if (colegioId) setColegioId(null)
    else setPapel(null)
  }

  async function restaurar() {
    if (!confirm('Apagar tudo o que foi feito neste navegador e voltar aos dados de exemplo?')) return
    await restaurarDadosDeExemplo()
    definirPerfil(null)
    setPapel(null)
    setColegioId(null)
  }

  const colegio = db.colegios.find((c) => c.id === colegioId)
  const professores = colegio
    ? db.professores
        .filter((p) => p.colegioId === colegio.id)
        .map((p) => ({ professor: p, turmas: turmasDoProfessor(db, p.id) }))
        .filter(({ professor }) => normalizar(professor.nome).includes(normalizar(busca.trim())))
        .sort((a, b) => {
          const ta = a.turmas[0]
          const tb = b.turmas[0]
          if (ta && tb) return ta.serie - tb.serie || compararTexto(ta.nome, tb.nome)
          return ta ? -1 : tb ? 1 : compararTexto(a.professor.nome, b.professor.nome)
        })
    : []

  return (
    <div className="entrada">
      <div className="entrada-topo">
        <Marca />
      </div>

      {!papel && (
        <section className="entrada-passo">
          <h1>Quem é você?</h1>
          <p className="entrada-sub">Nesta versão de teste não há senha: escolha um perfil para navegar.</p>
          {perfilAtual && descricaoAtual && (
            <button className="entrada-continuar" onClick={() => navigate(INICIO_DO_PAPEL[perfilAtual.papel])}>
              Continuar como <strong>{descricaoAtual}</strong> <ArrowRight size={16} aria-hidden />
            </button>
          )}
          <div className="entrada-opcoes">
            {OPCOES.map(({ papel: p, titulo, texto, Icone }) => (
              <button key={p} className="entrada-opcao" onClick={() => escolherPapel(p)}>
                <span className="entrada-icone">
                  <Icone size={26} aria-hidden />
                </span>
                <span className="entrada-opcao-titulo">{titulo}</span>
                <span className="entrada-opcao-texto">{texto}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {papel && !colegio && (
        <section className="entrada-passo">
          <button className="btn btn-fantasma btn-pequeno" onClick={voltar}>
            <ArrowLeft size={15} aria-hidden /> Voltar
          </button>
          <h1>De qual colégio você é?</h1>
          <p className="entrada-sub">Na versão final, o colégio já vem do seu login.</p>
          <ul className="entrada-lista">
            {[...db.colegios]
              .sort((a, b) => compararTexto(a.nome, b.nome))
              .map((c) => (
                <li key={c.id}>
                  <button className="entrada-item" onClick={() => escolherColegio(c.id)}>
                    <span>
                      <span className="entrada-item-titulo">{c.nome}</span>
                      <span className="entrada-item-sub">
                        {c.cidade}/{c.uf} · {plural(turmasDoColegio(db, c.id).length, 'turma', 'turmas')}
                      </span>
                    </span>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}

      {papel === 'professor' && colegio && (
        <section className="entrada-passo">
          <button className="btn btn-fantasma btn-pequeno" onClick={voltar}>
            <ArrowLeft size={15} aria-hidden /> Voltar
          </button>
          <h1>Qual é o seu nome?</h1>
          <p className="entrada-sub">Professores do {colegio.nome}. Na versão final, isso também vem do login.</p>
          <label className="busca">
            <Search size={16} aria-hidden />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar pelo nome" aria-label="Buscar professor pelo nome" autoFocus />
          </label>
          <ul className="entrada-lista">
            {professores.map(({ professor, turmas }) => (
              <li key={professor.id}>
                <button className="entrada-item" onClick={() => entrar({ papel: 'professor', colegioId: colegio.id, professorId: professor.id })}>
                  <span>
                    <span className="entrada-item-titulo">{professor.nome}</span>
                    <span className="entrada-item-sub">
                      {turmas.length ? turmas.map((t) => `${turmaNome(t)} · ${t.turno}`).join(', ') : 'Sem turma'}
                    </span>
                  </span>
                  <ChevronRight size={18} aria-hidden />
                </button>
              </li>
            ))}
            {!professores.length && <li className="texto-2">Ninguém com esse nome.</li>}
          </ul>
        </section>
      )}

      <footer className="entrada-rodape">
        <p>
          Versão de teste, com dados fictícios. O que você lançar fica guardado só neste navegador: outras pessoas não veem as suas
          alterações.
        </p>
        <button className="btn btn-pequeno btn-fantasma" onClick={restaurar}>
          <RotateCcw size={15} aria-hidden /> Restaurar dados de exemplo
        </button>
      </footer>
    </div>
  )
}
