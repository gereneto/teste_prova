import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Cabecalho, Cartao, Vazio } from '../../components/ui'
import { compararTexto, ordenarTurmas, turmaNome } from '../../lib/formato'
import { criarProfessor, editarProfessor, removerProfessor } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Id, Professor } from '../../types'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ProfessoresEscola() {
  const db = useDb()
  const perfil = usePerfil()
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<Id | null>(null)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!colegio) return null

  const professores = db.professores.filter((p) => p.colegioId === colegio.id).sort((a, b) => compararTexto(a.nome, b.nome))
  const turmasDe = (id: Id) => ordenarTurmas(db.turmas.filter((t) => t.professorIds.includes(id)))

  function remover(professor: Professor) {
    const turmas = turmasDe(professor.id)
    const aviso = turmas.length ? ` ${turmas.map(turmaNome).join(', ')} ${turmas.length > 1 ? 'ficarão' : 'ficará'} sem professor.` : ''
    if (confirm(`Remover ${professor.nome}?${aviso}`)) removerProfessor(professor.id)
  }

  return (
    <>
      <Cabecalho
        titulo="Professores"
        subtitulo={`${colegio.nome} · para associar um professor a uma turma, edite a turma em “Turmas e alunos”`}
        acoes={
          !criando && (
            <button className="btn btn-primario" onClick={() => setCriando(true)}>
              <Plus size={16} aria-hidden /> Novo professor
            </button>
          )
        }
      />

      {criando && (
        <FormularioProfessor
          rotuloSalvar="Cadastrar professor"
          aoSalvar={(dados) => {
            criarProfessor(colegio.id, dados)
            setCriando(false)
          }}
          aoCancelar={() => setCriando(false)}
        />
      )}

      <Cartao>
        {!professores.length ? (
          <Vazio titulo="Nenhum professor cadastrado" />
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Turmas</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {professores.map((professor) =>
                  editandoId === professor.id ? (
                    <tr key={professor.id}>
                      <td colSpan={4}>
                        <FormularioProfessor
                          inicial={professor}
                          rotuloSalvar="Salvar alterações"
                          aoSalvar={(dados) => {
                            editarProfessor(professor.id, dados)
                            setEditandoId(null)
                          }}
                          aoCancelar={() => setEditandoId(null)}
                        />
                      </td>
                    </tr>
                  ) : (
                    <tr key={professor.id}>
                      <td>{professor.nome}</td>
                      <td>{professor.email || <span className="texto-2">—</span>}</td>
                      <td>
                        <div className="chips">
                          {turmasDe(professor.id).map((t) => (
                            <span key={t.id} className="chip">
                              {turmaNome(t)}
                            </span>
                          ))}
                          {!turmasDe(professor.id).length && <span className="texto-2">Sem turma</span>}
                        </div>
                      </td>
                      <td className="acoes">
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditandoId(professor.id)}>
                          <Pencil size={14} aria-hidden /> Editar
                        </button>
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => remover(professor)}>
                          <Trash2 size={14} aria-hidden /> Remover
                        </button>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </>
  )
}

function FormularioProfessor(props: {
  inicial?: { nome: string; email: string }
  rotuloSalvar: string
  aoSalvar: (dados: { nome: string; email: string }) => void
  aoCancelar: () => void
}) {
  const [nome, setNome] = useState(props.inicial?.nome ?? '')
  const [email, setEmail] = useState(props.inicial?.email ?? '')
  const [erro, setErro] = useState<string | null>(null)

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo = { nome: nome.trim().replace(/\s+/g, ' '), email: email.trim().toLowerCase() }
    if (!limpo.nome) return setErro('Informe o nome do professor.')
    if (limpo.email && !EMAIL_VALIDO.test(limpo.email)) return setErro('Esse e-mail não parece válido. Confira ou deixe em branco.')
    props.aoSalvar(limpo)
  }

  return (
    <form className="cartao form" onSubmit={enviar} noValidate>
      <div className="form-grade">
        <label className="campo">
          <span>Nome</span>
          <input
            value={nome}
            onChange={(e) => {
              setNome(e.target.value)
              setErro(null)
            }}
            placeholder="Maria da Silva"
            autoFocus
          />
        </label>
        <label className="campo">
          <span>E-mail (opcional)</span>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErro(null)
            }}
            placeholder="maria@colegio.com.br"
          />
        </label>
      </div>
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
