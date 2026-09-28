import { ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecalho, Cartao, Vazio } from '../../components/ui'
import { nomesProfessores, turmasDoColegio } from '../../lib/consultas'
import { compararTexto, serieNome, turmaNome } from '../../lib/formato'
import { criarTurma, type DadosTurma } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES, TURNOS, type Db, type Id, type Serie } from '../../types'

export default function TurmasEscola() {
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [criando, setCriando] = useState(false)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!colegio) return null

  const turmas = turmasDoColegio(db, colegio.id)
  const alunosAtivos = (turmaId: Id) => db.alunos.filter((a) => a.turmaId === turmaId && a.ativo).length

  return (
    <>
      <Cabecalho
        titulo="Turmas e alunos"
        subtitulo={`${colegio.nome} · ${turmas.length} turmas do 1º ao 5º ano`}
        acoes={
          !criando && (
            <button className="btn btn-primario" onClick={() => setCriando(true)}>
              <Plus size={16} aria-hidden /> Nova turma
            </button>
          )
        }
      />

      {criando && (
        <FormularioTurma
          db={db}
          colegioId={colegio.id}
          aoCancelar={() => setCriando(false)}
          aoSalvar={(dados) => navigate(`/coordenacao/turmas/${criarTurma(colegio.id, dados)}`)}
        />
      )}

      {!turmas.length && <Vazio titulo="Cadastre a primeira turma">Depois é só colar a lista de alunos de cada turma.</Vazio>}

      {SERIES.map((serie) => {
        const doAno = turmas.filter((t) => t.serie === serie)
        if (!doAno.length) return null
        return (
          <Cartao key={serie} titulo={serieNome(serie)}>
            <ul className="lista-links">
              {doAno.map((turma) => (
                <li key={turma.id}>
                  <Link to={`/coordenacao/turmas/${turma.id}`} className="lista-link">
                    <span className="lista-link-titulo">{turmaNome(turma)}</span>
                    <span className="texto-2">{turma.turno}</span>
                    <span className="texto-2">{nomesProfessores(db, turma)}</span>
                    <span className="texto-2">{alunosAtivos(turma.id)} alunos</span>
                    <ChevronRight size={18} aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </Cartao>
        )
      })}
    </>
  )
}

/** Formulário de turma, usado para criar e para editar. */
export function FormularioTurma(props: {
  db: Db
  colegioId: Id
  inicial?: DadosTurma
  ignorarTurmaId?: Id
  rotuloSalvar?: string
  aoSalvar: (dados: DadosTurma) => void
  aoCancelar?: () => void
}) {
  const { db, colegioId } = props
  const turmasDoColegio = db.turmas.filter((t) => t.colegioId === colegioId && t.id !== props.ignorarTurmaId)
  const proximaLetra = (serie: Serie) => {
    const usadas = new Set(turmasDoColegio.filter((t) => t.serie === serie).map((t) => t.nome.toUpperCase()))
    return 'ABCDEFGHIJ'.split('').find((l) => !usadas.has(l)) ?? ''
  }
  const [dados, setDados] = useState<DadosTurma>(
    props.inicial ?? { serie: 1, nome: proximaLetra(1), turno: 'Manhã', professorIds: [] },
  )
  const [erro, setErro] = useState<string | null>(null)
  const professores = db.professores.filter((p) => p.colegioId === colegioId).sort((a, b) => compararTexto(a.nome, b.nome))

  function enviar(e: FormEvent) {
    e.preventDefault()
    const nome = dados.nome.trim()
    if (!nome) return setErro('Informe a identificação da turma, como A ou B.')
    if (turmasDoColegio.some((t) => t.serie === dados.serie && t.nome.toLowerCase() === nome.toLowerCase())) {
      return setErro(`Já existe a turma ${turmaNome({ serie: dados.serie, nome })} neste colégio.`)
    }
    props.aoSalvar({ ...dados, nome })
  }

  return (
    <form className="cartao form" onSubmit={enviar} noValidate>
      <div className="form-grade">
        <label className="campo">
          <span>Ano</span>
          <select
            value={dados.serie}
            onChange={(e) => {
              const serie = Number(e.target.value) as Serie
              setDados({ ...dados, serie, nome: props.inicial ? dados.nome : proximaLetra(serie) })
              setErro(null)
            }}
          >
            {SERIES.map((s) => (
              <option key={s} value={s}>
                {serieNome(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Identificação</span>
          <input
            value={dados.nome}
            onChange={(e) => {
              setDados({ ...dados, nome: e.target.value })
              setErro(null)
            }}
            placeholder="A"
            maxLength={20}
            aria-invalid={Boolean(erro)}
          />
        </label>
        <label className="campo">
          <span>Turno</span>
          <select value={dados.turno} onChange={(e) => setDados({ ...dados, turno: e.target.value as DadosTurma['turno'] })}>
            {TURNOS.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <label className="campo">
          <span>Professor(a)</span>
          <select value={dados.professorIds[0] ?? ''} onChange={(e) => setDados({ ...dados, professorIds: e.target.value ? [e.target.value] : [] })}>
            <option value="">Sem professor</option>
            {professores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
              </option>
            ))}
          </select>
        </label>
      </div>
      {erro && <p className="erro-campo">{erro}</p>}
      <div className="form-acoes">
        <button type="submit" className="btn btn-primario">
          {props.rotuloSalvar ?? 'Criar turma'}
        </button>
        {props.aoCancelar && (
          <button type="button" className="btn btn-fantasma" onClick={props.aoCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}
