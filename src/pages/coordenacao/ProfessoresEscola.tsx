import { Pencil, Plus, UserCheck, UserX, X } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Aviso, Cabecalho, Cartao, Confirmacao, Selo, Vazio } from '../../components/ui'
import { turmasDoColegio, turmasDoProfessor } from '../../lib/consultas'
import { compararTexto, plural, serieNome, turmaNome } from '../../lib/formato'
import { criarProfessor, definirProfessoresDaTurma, desativarProfessor, editarProfessor, reativarProfessor } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, type Id, type Professor } from '../../types'

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ProfessoresEscola() {
  const db = useDb()
  const perfil = usePerfil()
  const [criando, setCriando] = useState(false)
  const [editandoId, setEditandoId] = useState<Id | null>(null)
  const [desativando, setDesativando] = useState<Professor | null>(null)
  const [salvo, setSalvo] = useState<Id | null>(null)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!colegio) return null

  const professores = db.professores.filter((p) => p.colegioId === colegio.id).sort((a, b) => Number(b.ativo) - Number(a.ativo) || compararTexto(a.nome, b.nome))
  const ativos = professores.filter((p) => p.ativo)
  const turmas = turmasDoColegio(db, colegio.id)
  const semProfessor = turmas.filter((t) => !t.professorIds.length)
  const semTurma = ativos.filter((p) => !turmasDoProfessor(db, p.id).length)

  function mudarProfessores(turmaId: Id, ids: Id[]) {
    definirProfessoresDaTurma(turmaId, ids)
    setSalvo(turmaId)
  }

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Professores"
        subtitulo="Quem tem acesso ao site e qual professor cuida de cada turma."
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

      {(semProfessor.length > 0 || semTurma.length > 0) && (
        <Aviso tom="atencao">
          {[
            semProfessor.length > 0 && `${semProfessor.map(turmaNome).join(', ')} ${semProfessor.length > 1 ? 'estão' : 'está'} sem professor.`,
            semTurma.length > 0 && `${plural(semTurma.length, 'professor ainda não tem', 'professores ainda não têm')} turma: ${semTurma.map((p) => p.nome).join(', ')}.`,
          ]
            .filter(Boolean)
            .join(' ')}
        </Aviso>
      )}

      <Cartao titulo="Quem cuida de cada turma" sub="Cada mudança é salva na hora. Uma turma pode ter mais de um professor, como o regente e um auxiliar.">
        <div className="por-turma">
          {SERIES.map((serie) => {
            const doAno = turmas.filter((t) => t.serie === serie)
            if (!doAno.length) return null
            return (
              <div key={serie} className="por-turma-ano">
                <h3 className="subtitulo">{serieNome(serie)}</h3>
                {doAno.map((turma) => {
                  const disponiveis = ativos.filter((p) => !turma.professorIds.includes(p.id))
                  return (
                    <div key={turma.id} className="por-turma-linha">
                      <strong>{turmaNome(turma)}</strong>
                      <div className="chips">
                        {turma.professorIds.map((id) => {
                          const professor = db.professores.find((p) => p.id === id)
                          return (
                            <span key={id} className="chip">
                              {professor?.nome ?? 'Professor removido'}
                              <button
                                type="button"
                                className="chip-tirar"
                                onClick={() => mudarProfessores(turma.id, turma.professorIds.filter((x) => x !== id))}
                                aria-label={`Tirar ${professor?.nome ?? 'professor'} do ${turmaNome(turma)}`}
                              >
                                <X size={14} aria-hidden />
                              </button>
                            </span>
                          )
                        })}
                        {!turma.professorIds.length && <Selo tom="ambar">Sem professor</Selo>}
                      </div>
                      <select
                        className="select-compacto"
                        value=""
                        onChange={(e) => e.target.value && mudarProfessores(turma.id, [...turma.professorIds, e.target.value])}
                        aria-label={`Incluir professor no ${turmaNome(turma)}`}
                      >
                        <option value="">{turma.professorIds.length ? '+ outro professor' : 'Escolher professor'}</option>
                        {disponiveis.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nome}
                          </option>
                        ))}
                      </select>
                      {salvo === turma.id && <span className="ok-campo">Salvo</span>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </Cartao>

      <Cartao titulo="Professores com acesso" sub="Na versão final, cada professor entra no site com o e-mail cadastrado aqui.">
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
                    <tr key={professor.id} className={professor.ativo ? '' : 'linha-inativa'}>
                      <td>
                        {professor.nome} {!professor.ativo && <Selo>Acesso desativado</Selo>}
                      </td>
                      <td>{professor.email || <span className="texto-2">sem e-mail</span>}</td>
                      <td>
                        {turmasDoProfessor(db, professor.id).map(turmaNome).join(', ') || <span className="texto-2">sem turma</span>}
                      </td>
                      <td className="acoes">
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditandoId(professor.id)}>
                          <Pencil size={14} aria-hidden /> Editar
                        </button>
                        {professor.ativo ? (
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => setDesativando(professor)}>
                            <UserX size={14} aria-hidden /> Desativar
                          </button>
                        ) : (
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => reativarProfessor(professor.id)}>
                            <UserCheck size={14} aria-hidden /> Reativar
                          </button>
                        )}
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      <Confirmacao
        titulo={desativando ? `Desativar o acesso de ${desativando.nome}?` : ''}
        aberta={desativando !== null}
        rotuloConfirmar="Desativar o acesso"
        aoConfirmar={() => {
          if (desativando) desativarProfessor(desativando.id)
          setDesativando(null)
        }}
        aoFechar={() => setDesativando(null)}
      >
        {desativando && (
          <p>
            A pessoa deixa de entrar no site
            {turmasDoProfessor(db, desativando.id).length > 0 && ` e sai de ${turmasDoProfessor(db, desativando.id).map(turmaNome).join(', ')}`}. Nada do que
            ela lançou se perde, e o nome continua no histórico. Dá para reativar depois.
          </p>
        )}
      </Confirmacao>
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
    if (!limpo.email) return setErro('Informe o e-mail: na versão final, é com ele que o professor entra no site.')
    if (!EMAIL_VALIDO.test(limpo.email)) return setErro('Esse e-mail não parece válido. Confira.')
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
          <span>E-mail</span>
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
