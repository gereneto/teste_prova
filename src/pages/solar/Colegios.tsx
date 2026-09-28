import { ChevronRight, Plus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Cabecalho, Cartao, Vazio } from '../../components/ui'
import { compararTexto } from '../../lib/formato'
import { criarColegio, type DadosColegio } from '../../store/acoes'
import { useDb } from '../../store/db'

export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ')
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Colegios() {
  const db = useDb()
  const navigate = useNavigate()
  const [criando, setCriando] = useState(false)
  const colegios = [...db.colegios].sort((a, b) => compararTexto(a.nome, b.nome))

  return (
    <>
      <Cabecalho
        sobretitulo="Rede"
        titulo="Colégios"
        subtitulo="Cada colégio tem uma coordenação, que cadastra as próprias turmas, professores e alunos"
        acoes={
          !criando && (
            <button className="btn btn-primario" onClick={() => setCriando(true)}>
              <Plus size={16} aria-hidden /> Novo colégio
            </button>
          )
        }
      />
      {criando && (
        <FormularioColegio
          rotuloSalvar="Cadastrar colégio"
          aoSalvar={(dados) => navigate(`/solar/colegios/${criarColegio(dados)}`)}
          aoCancelar={() => setCriando(false)}
        />
      )}
      <Cartao>
        {!colegios.length ? (
          <Vazio titulo="Cadastre o primeiro colégio" />
        ) : (
          <ul className="lista-links">
            {colegios.map((colegio) => {
              const turmas = db.turmas.filter((t) => t.colegioId === colegio.id)
              const alunos = db.alunos.filter((a) => a.ativo && turmas.some((t) => t.id === a.turmaId)).length
              return (
                <li key={colegio.id}>
                  <Link to={`/solar/colegios/${colegio.id}`} className="lista-link lista-link-colegio">
                    <span>
                      <span className="lista-link-titulo">{colegio.nome}</span>
                      <span className="texto-2 pequeno bloco">
                        {colegio.cidade}/{colegio.uf}
                      </span>
                    </span>
                    <span className="texto-2">{turmas.length} turmas</span>
                    <span className="texto-2">{alunos} alunos</span>
                    <span className="texto-2 pequeno">
                      {colegio.coordenacao.nome || 'Sem coordenação cadastrada'}
                      {colegio.coordenacao.email && <span className="bloco">{colegio.coordenacao.email}</span>}
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
  rotuloSalvar: string
  aoSalvar: (dados: DadosColegio) => void
  aoCancelar: () => void
}) {
  const [dados, setDados] = useState<DadosColegio>(
    props.inicial ?? { nome: '', cidade: '', uf: 'SP', coordenacao: { nome: '', email: '', telefone: '' } },
  )
  const [erro, setErro] = useState<string | null>(null)
  const mudar = (parcial: Partial<DadosColegio>) => {
    setDados({ ...dados, ...parcial })
    setErro(null)
  }
  const mudarContato = (parcial: Partial<DadosColegio['coordenacao']>) => mudar({ coordenacao: { ...dados.coordenacao, ...parcial } })

  function enviar(e: FormEvent) {
    e.preventDefault()
    const limpo: DadosColegio = {
      nome: dados.nome.trim(),
      cidade: dados.cidade.trim(),
      uf: dados.uf,
      coordenacao: {
        nome: dados.coordenacao.nome.trim(),
        email: dados.coordenacao.email.trim().toLowerCase(),
        telefone: dados.coordenacao.telefone.trim(),
      },
    }
    if (!limpo.nome) return setErro('Informe o nome do colégio.')
    if (!limpo.cidade) return setErro('Informe a cidade.')
    if (limpo.coordenacao.email && !EMAIL_VALIDO.test(limpo.coordenacao.email)) return setErro('O e-mail da coordenação não parece válido.')
    props.aoSalvar(limpo)
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
      <h3 className="subtitulo">Coordenação</h3>
      <div className="form-grade">
        <label className="campo">
          <span>Nome</span>
          <input value={dados.coordenacao.nome} onChange={(e) => mudarContato({ nome: e.target.value })} placeholder="Maria da Silva" />
        </label>
        <label className="campo">
          <span>E-mail</span>
          <input type="email" value={dados.coordenacao.email} onChange={(e) => mudarContato({ email: e.target.value })} placeholder="coordenacao@colegio.com.br" />
        </label>
        <label className="campo">
          <span>Telefone</span>
          <input type="tel" value={dados.coordenacao.telefone} onChange={(e) => mudarContato({ telefone: e.target.value })} placeholder="(19) 3333-4444" />
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
