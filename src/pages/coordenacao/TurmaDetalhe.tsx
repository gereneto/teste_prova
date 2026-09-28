import { ArrowDownAZ, ClipboardPaste, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Aviso, Cabecalho, Cartao, Vazio } from '../../components/ui'
import { nomesProfessores } from '../../lib/consultas'
import { compararTexto, plural, turmaNome } from '../../lib/formato'
import {
  adicionarAlunos,
  editarAluno,
  editarTurma,
  lerListaDeNomes,
  reativarAluno,
  removerAluno,
  removerTurma,
  renumerarEmOrdemAlfabetica,
} from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Aluno, Id } from '../../types'
import { FormularioTurma } from './TurmasEscola'

export default function TurmaDetalhe() {
  const { turmaId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [editandoTurma, setEditandoTurma] = useState(false)
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [editando, setEditando] = useState<{ id: Id; nome: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const turma = db.turmas.find((t) => t.id === turmaId)
  if (!turma || perfil?.papel !== 'coordenacao' || turma.colegioId !== perfil.colegioId) {
    return <Vazio titulo="Turma não encontrada" acao={<Link className="btn" to="/coordenacao/turmas">Voltar para as turmas</Link>} />
  }

  const ativos = db.alunos.filter((a) => a.turmaId === turma.id && a.ativo).sort((a, b) => a.numero - b.numero)
  const inativos = db.alunos.filter((a) => a.turmaId === turma.id && !a.ativo).sort((a, b) => compararTexto(a.nome, b.nome))
  const temRespostas = db.lancamentos.some((l) => l.turmaId === turma.id && Object.keys(l.respostas).length > 0)
  const nomesLidos = lerListaDeNomes(texto)

  function adicionar() {
    if (!nomesLidos.length) return
    adicionarAlunos(turma!.id, nomesLidos)
    setAviso(`${plural(nomesLidos.length, 'aluno adicionado', 'alunos adicionados')} no fim da lista.`)
    setTexto('')
    setColando(false)
  }

  function remover(aluno: Aluno) {
    if (!confirm(`Remover ${aluno.nome} da turma?`)) return
    const tinhaRespostas = db.lancamentos.some((l) => l.respostas[aluno.id])
    removerAluno(aluno.id)
    setAviso(
      tinhaRespostas
        ? `${aluno.nome} saiu da turma. As respostas já lançadas continuam nos resultados anteriores.`
        : `${aluno.nome} não está mais na lista da turma.`,
    )
  }

  function salvarNome() {
    if (!editando) return
    const nome = editando.nome.trim().replace(/\s+/g, ' ')
    if (nome) editarAluno(editando.id, nome)
    setEditando(null)
  }

  function renumerar() {
    if (!confirm('Renumerar os alunos em ordem alfabética? Os números de chamada vão mudar.')) return
    renumerarEmOrdemAlfabetica(turma!.id)
    setAviso('Números de chamada refeitos em ordem alfabética.')
  }

  function excluirTurma() {
    if (!confirm(`Excluir a turma ${turmaNome(turma!)} e a lista de alunos dela?`)) return
    removerTurma(turma!.id)
    navigate('/coordenacao/turmas')
  }

  return (
    <>
      <Cabecalho
        titulo={turmaNome(turma)}
        subtitulo={`${turma.turno} · ${nomesProfessores(db, turma)} · ${plural(ativos.length, 'aluno', 'alunos')}`}
        voltar={{ para: '/coordenacao/turmas', rotulo: 'Turmas e alunos' }}
        acoes={
          !editandoTurma && (
            <button className="btn" onClick={() => setEditandoTurma(true)}>
              <Pencil size={16} aria-hidden /> Editar turma
            </button>
          )
        }
      />

      {editandoTurma && (
        <>
          <FormularioTurma
            db={db}
            colegioId={turma.colegioId}
            ignorarTurmaId={turma.id}
            inicial={{ serie: turma.serie, nome: turma.nome, turno: turma.turno, professorIds: turma.professorIds }}
            rotuloSalvar="Salvar alterações"
            aoSalvar={(dados) => {
              editarTurma(turma.id, dados)
              setEditandoTurma(false)
            }}
            aoCancelar={() => setEditandoTurma(false)}
          />
          <p className="texto-2 pequeno">
            {temRespostas ? (
              'Esta turma já tem respostas lançadas, então não pode ser excluída.'
            ) : (
              <button className="btn btn-perigo btn-pequeno" onClick={excluirTurma}>
                <Trash2 size={15} aria-hidden /> Excluir turma
              </button>
            )}
          </p>
        </>
      )}

      {aviso && (
        <Aviso tom="sucesso" acoes={<button className="btn btn-pequeno btn-fantasma" onClick={() => setAviso(null)}>Fechar</button>}>
          {aviso}
        </Aviso>
      )}

      <Cartao
        titulo="Alunos"
        sub="O número de chamada é a ordem da tela de lançamento e das folhas de respostas."
        acoes={
          <>
            {!colando && (
              <button className="btn btn-primario" onClick={() => setColando(true)}>
                <ClipboardPaste size={16} aria-hidden /> Adicionar alunos
              </button>
            )}
            {ativos.length > 1 && (
              <button className="btn" onClick={renumerar}>
                <ArrowDownAZ size={16} aria-hidden /> Renumerar em ordem alfabética
              </button>
            )}
          </>
        }
      >
        {colando && (
          <div className="colar">
            <label className="campo">
              <span>Cole os nomes, um por linha</span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={8}
                placeholder={'Ana Clara Souza\nBruno Lima\nCarolina Mendes'}
                autoFocus
              />
            </label>
            <p className="campo-ajuda">
              Pode copiar direto de uma coluna do Excel ou do sistema do colégio. Números de chamada e colunas extras são ignorados. Os
              alunos entram no fim da lista, com os próximos números.
            </p>
            {nomesLidos.length > 0 && (
              <p className="texto-2 pequeno">
                {plural(nomesLidos.length, 'nome reconhecido', 'nomes reconhecidos')}: {nomesLidos.slice(0, 3).join(', ')}
                {nomesLidos.length > 3 ? '…' : ''}
              </p>
            )}
            <div className="form-acoes">
              <button className="btn btn-primario" onClick={adicionar} disabled={!nomesLidos.length}>
                Adicionar {nomesLidos.length ? plural(nomesLidos.length, 'aluno', 'alunos') : 'alunos'}
              </button>
              <button
                className="btn btn-fantasma"
                onClick={() => {
                  setColando(false)
                  setTexto('')
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {!ativos.length && !colando && <Vazio titulo="Esta turma ainda não tem alunos">Use “Adicionar alunos” e cole a lista da turma.</Vazio>}

        {ativos.length > 0 && (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th className="num">Nº</th>
                  <th>Nome</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((aluno) => (
                  <tr key={aluno.id}>
                    <td className="num">{aluno.numero}</td>
                    <td>
                      {editando?.id === aluno.id ? (
                        <input
                          className="input-tabela"
                          value={editando.nome}
                          onChange={(e) => setEditando({ id: aluno.id, nome: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') salvarNome()
                            if (e.key === 'Escape') setEditando(null)
                          }}
                          aria-label={`Nome de ${aluno.nome}`}
                          autoFocus
                        />
                      ) : (
                        aluno.nome
                      )}
                    </td>
                    <td className="acoes">
                      {editando?.id === aluno.id ? (
                        <>
                          <button className="btn btn-pequeno btn-primario" onClick={salvarNome}>
                            Salvar
                          </button>
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditando(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditando({ id: aluno.id, nome: aluno.nome })}>
                            <Pencil size={14} aria-hidden /> Editar
                          </button>
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => remover(aluno)}>
                            <Trash2 size={14} aria-hidden /> Remover
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {inativos.length > 0 && (
          <details className="inativos">
            <summary>{plural(inativos.length, 'aluno saiu', 'alunos saíram')} da turma</summary>
            <ul>
              {inativos.map((aluno) => (
                <li key={aluno.id}>
                  <span>{aluno.nome}</span>
                  <button className="btn btn-pequeno btn-fantasma" onClick={() => reativarAluno(aluno.id)}>
                    <Undo2 size={14} aria-hidden /> Voltar para a turma
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Cartao>
    </>
  )
}
