import { ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecalho, Cartao, Selo, Vazio } from '../../components/ui'
import { alunosAtivos, contatoDoColegio, membroSolarDoColegio, permissoesDe, pessoaDoPerfil, turmasDoColegio } from '../../lib/consultas'
import { compararTexto, plural } from '../../lib/formato'
import { criarColegio, type DadosColegio } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Contato } from '../../types'

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Colegios() {
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [criando, setCriando] = useState(false)
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))

  return (
    <>
      <Cabecalho
        sobretitulo="Rede"
        titulo="Colégios"
        subtitulo="Cada colégio fica aos cuidados de uma pessoa da Solar, que define quem responde pela coordenação. A coordenação cadastra as turmas, os professores e os alunos."
        acoes={
          editarRede &&
          !criando && (
            <button className="btn btn-primario" onClick={() => setCriando(true)}>
              <Plus size={16} aria-hidden /> Novo colégio
            </button>
          )
        }
      />
      {criando && (
        <FormularioColegio
          comResponsavel
          rotuloSalvar="Cadastrar colégio"
          aoSalvar={(dados, responsavel) => navigate(`/solar/colegios/${criarColegio(dados, responsavel)}`, { state: { enviado: responsavel?.email ?? null } })}
          aoCancelar={() => setCriando(false)}
        />
      )}
      <Cartao>
        {!colegios.length ? (
          <Vazio titulo="Cadastre o primeiro colégio" />
        ) : (
          <ul className="lista-links">
            {colegios.map((colegio) => {
              const turmas = turmasDoColegio(db, colegio.id)
              const alunos = turmas.reduce((s, t) => s + alunosAtivos(db, t.id).length, 0)
              const responsavel = contatoDoColegio(db, colegio.id)
              const membroSolar = membroSolarDoColegio(db, colegio)
              return (
                <li key={colegio.id}>
                  <Link to={`/solar/colegios/${colegio.id}`} className="lista-link lista-link-colegio">
                    <span>
                      <span className="lista-link-titulo">{colegio.nome}</span>
                      <span className="texto-2 pequeno bloco">
                        {colegio.cidade}/{colegio.uf} · {membroSolar ? `pela Solar: ${membroSolar.nome}` : 'ninguém da Solar ainda'}
                      </span>
                    </span>
                    <span className="texto-2">{plural(turmas.length, 'turma', 'turmas')}</span>
                    <span className="texto-2">{plural(alunos, 'aluno', 'alunos')}</span>
                    <span className="pequeno">
                      {responsavel ? (
                        <>
                          {responsavel.nome}
                          <span className="texto-2 bloco">{responsavel.email}</span>
                        </>
                      ) : (
                        <Selo tom="ambar">Sem responsável</Selo>
                      )}
                    </span>
                    <ChevronRight size={18} aria-hidden />
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </Cartao>
    </>
  )
}

export function FormularioColegio(props: {
  inicial?: DadosColegio
  comResponsavel?: boolean
  rotuloSalvar: string
  aoSalvar: (dados: DadosColegio, responsavel: Contato | null) => void
  aoCancelar: () => void
}) {
  const [dados, setDados] = useState<DadosColegio>(props.inicial ?? { nome: '', cidade: '', uf: 'SP' })
  const [responsavel, setResponsavel] = useState<Contato>({ nome: '', email: '', telefone: '' })
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (parcial: Partial<DadosColegio>) => {
    setDados({ ...dados, ...parcial })
    setErro(null)
  }
  const mudarResponsavel = (parcial: Partial<Contato>) => {
    setResponsavel({ ...responsavel, ...parcial })
    setErro(null)
  }

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo: DadosColegio = { nome: dados.nome.trim(), cidade: dados.cidade.trim(), uf: dados.uf }
    if (!limpo.nome) return setErro('Informe o nome do colégio.')
    if (!limpo.cidade) return setErro('Informe a cidade.')
    const pessoa = { nome: responsavel.nome.trim(), email: responsavel.email.trim().toLowerCase(), telefone: responsavel.telefone.trim() }
    if (props.comResponsavel && pessoa.nome && !EMAIL_VALIDO.test(pessoa.email)) return setErro('Informe um e-mail válido para a pessoa responsável.')
    props.aoSalvar(limpo, props.comResponsavel && pessoa.nome ? pessoa : null)
  }

  return (
    <form className="cartao form" onSubmit={enviar} noValidate>
      <div className="form-grade">
        <label className="campo campo-largo">
          <span>Nome do colégio</span>
          <input value={dados.nome} onChange={(e) => mudar({ nome: e.target.value })} placeholder="Colégio Exemplo" autoFocus />
        </label>
        <label className="campo">
          <span>Cidade</span>
          <input value={dados.cidade} onChange={(e) => mudar({ cidade: e.target.value })} placeholder="Campinas" />
        </label>
        <label className="campo campo-estreito">
          <span>UF</span>
          <select value={dados.uf} onChange={(e) => mudar({ uf: e.target.value })}>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </select>
        </label>
      </div>
      {props.comResponsavel && (
        <>
          <h3 className="subtitulo">Responsável pela coordenação (pode ficar para depois)</h3>
          <p className="campo-ajuda">A pessoa recebe por e-mail o link de acesso, que entra direto na conta dela. Na Solar, o colégio fica aos cuidados de quem o cadastra.</p>
          <div className="form-grade">
            <label className="campo">
              <span>Nome</span>
              <input value={responsavel.nome} onChange={(e) => mudarResponsavel({ nome: e.target.value })} placeholder="Maria da Silva" />
            </label>
            <label className="campo">
              <span>E-mail</span>
              <input type="email" value={responsavel.email} onChange={(e) => mudarResponsavel({ email: e.target.value })} placeholder="coordenacao@colegio.com.br" />
            </label>
            <label className="campo">
              <span>Telefone (opcional)</span>
              <input type="tel" value={responsavel.telefone} onChange={(e) => mudarResponsavel({ telefone: e.target.value })} placeholder="(19) 3333-4444" />
            </label>
          </div>
        </>
      )}
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
