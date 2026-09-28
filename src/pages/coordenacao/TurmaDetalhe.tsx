import { ArrowDownAZ, ClipboardPaste, Pencil, Trash2, Undo2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Aviso, Cabecalho, Cartao, Vazio } from '../../components/ui'
import { nomesProfessores } from '../../lib/consultas'
import { compararTexto, plural, turmaNome } from '../../lib/formato'
import {
  adicionarAlunos,
  definirIngressoDosSemAno,
  editarAluno,
  editarTurma,
  lerListaDeAlunos,
  reativarAluno,
  removerAluno,
  removerTurma,
  renumerarEmOrdemAlfabetica,
} from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Aluno, Id } from '../../types'
import { FormularioTurma } from './TurmasEscola'

/** Anos oferecidos para a entrada no colégio: do ano letivo até 12 anos antes (Educação Infantil incluída). */
const ANOS_PARA_TRAS = 12
const SEM_ANO = 'nao'

export default function TurmaDetalhe() {
  const { turmaId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const [editandoTurma, setEditandoTurma] = useState(false)
  const [colando, setColando] = useState(false)
  const [texto, setTexto] = useState('')
  const [anoPadrao, setAnoPadrao] = useState<string | null>(null)
  const [anoEmMassa, setAnoEmMassa] = useState<string | null>(null)
  const [editando, setEditando] = useState<{ id: Id; nome: string; anoIngresso: string } | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const turma = db.turmas.find((t) => t.id === turmaId)
  if (!turma || perfil?.papel !== 'coordenacao' || turma.colegioId !== perfil.colegioId) {
    return <Vazio titulo="Turma não encontrada" acao={<Link className="btn" to="/coordenacao/turmas">Voltar para as turmas</Link>} />
  }

  const anoLetivo = turma.anoLetivo
  const anos = Array.from({ length: ANOS_PARA_TRAS + 1 }, (_, i) => anoLetivo - i)
  const ativos = db.alunos.filter((a) => a.turmaId === turma.id && a.ativo).sort((a, b) => a.numero - b.numero)
  const inativos = db.alunos.filter((a) => a.turmaId === turma.id && !a.ativo).sort((a, b) => compararTexto(a.nome, b.nome))
  const semAno = ativos.filter((a) => a.anoIngresso == null)
  const novos = ativos.filter((a) => a.anoIngresso === anoLetivo).length
  const temRespostas = db.lancamentos.some((l) => l.turmaId === turma.id && Object.keys(l.respostas).length > 0)
  // Turma vazia: é a lista inicial, e o ano de cada um pode não estar à mão. Turma com alunos: quem chega agora é novo.
  const anoParaQuemNaoTem = anoPadrao ?? (ativos.length ? String(anoLetivo) : SEM_ANO)
  const lidos = lerListaDeAlunos(texto, anoLetivo).map((a) => ({
    ...a,
    anoIngresso: a.anoIngresso ?? (anoParaQuemNaoTem === SEM_ANO ? null : Number(anoParaQuemNaoTem)),
  }))

  function adicionar() {
    if (!lidos.length) return
    adicionarAlunos(turma!.id, lidos)
    setAviso(`${plural(lidos.length, 'aluno adicionado', 'alunos adicionados')} no fim da lista.`)
    setTexto('')
    setAnoPadrao(null)
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

  function salvarEdicao() {
    if (!editando) return
    const nome = editando.nome.trim().replace(/\s+/g, ' ')
    if (nome) editarAluno(editando.id, { nome, anoIngresso: editando.anoIngresso ? Number(editando.anoIngresso) : null })
    setEditando(null)
  }

  function preencherSemAno() {
    const ano = Number(anoEmMassa ?? anoLetivo)
    definirIngressoDosSemAno(turma!.id, ano)
    setAviso(`${plural(semAno.length, 'aluno ficou', 'alunos ficaram')} com ano de entrada ${ano}.`)
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

  const opcoesDeAno = (rotuloVazio: string) => (
    <>
      <option value="">{rotuloVazio}</option>
      {anos.map((ano) => (
        <option key={ano} value={ano}>
          {ano === anoLetivo ? `${ano} (novo no colégio)` : ano}
        </option>
      ))}
    </>
  )

  return (
    <>
      <Cabecalho
        sobretitulo="Turma"
        titulo={turmaNome(turma)}
        subtitulo={`${turma.turno} · ${nomesProfessores(db, turma)} · ${plural(ativos.length, 'aluno', 'alunos')}${novos ? `, ${plural(novos, 'novo', 'novos')} no colégio` : ''}`}
        voltar={{ para: '/coordenacao/turmas', rotulo: 'Turmas e Alunos' }}
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

      {semAno.length > 0 && !colando && (
        <Aviso
          tom="atencao"
          acoes={
            <>
              <select
                className="select-compacto"
                value={anoEmMassa ?? String(anoLetivo)}
                onChange={(e) => setAnoEmMassa(e.target.value)}
                aria-label="Ano de entrada para os alunos sem ano"
              >
                {anos.map((ano) => (
                  <option key={ano} value={ano}>
                    {ano}
                  </option>
                ))}
              </select>
              <button className="btn btn-pequeno btn-primario" onClick={preencherSemAno}>
                Aplicar a todos eles
              </button>
            </>
          }
        >
          {plural(semAno.length, 'aluno está', 'alunos estão')} sem o ano de entrada no colégio. Sem ele, o aluno fica fora da comparação
          entre novos e antigos. Informe um por um em “Editar” ou aplique o mesmo ano a todos.
        </Aviso>
      )}

      <Cartao
        titulo="Alunos"
        sub="O número de chamada é a ordem da tela de lançamento e das folhas de respostas. O ano de entrada separa alunos novos e antigos nos resultados."
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
                placeholder={'Ana Clara Souza;2021\nBruno Lima;2026\nCarolina Mendes'}
                autoFocus
              />
            </label>
            <p className="campo-ajuda">
              Pode copiar direto do Excel ou do sistema do colégio. Se a planilha tiver o ano de entrada no colégio numa coluna ao lado do
              nome, ele vem junto. Números de chamada e outras colunas são ignorados. Os alunos entram no fim da lista.
            </p>
            <label className="campo">
              <span>Ano de entrada para quem não tiver o ano na lista</span>
              <select
                value={anoParaQuemNaoTem === SEM_ANO ? '' : anoParaQuemNaoTem}
                onChange={(e) => setAnoPadrao(e.target.value || SEM_ANO)}
              >
                {opcoesDeAno('Não informar agora')}
              </select>
            </label>
            {lidos.length > 0 && (
              <p className="texto-2 pequeno">
                {plural(lidos.length, 'aluno reconhecido', 'alunos reconhecidos')}:{' '}
                {lidos
                  .slice(0, 3)
                  .map((a) => `${a.nome} (${a.anoIngresso ?? 'sem ano'})`)
                  .join(', ')}
                {lidos.length > 3 ? '…' : ''}
              </p>
            )}
            <div className="form-acoes">
              <button className="btn btn-primario" onClick={adicionar} disabled={!lidos.length}>
                Adicionar {lidos.length ? plural(lidos.length, 'aluno', 'alunos') : 'alunos'}
              </button>
              <button
                className="btn btn-fantasma"
                onClick={() => {
                  setColando(false)
                  setTexto('')
                  setAnoPadrao(null)
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
                  <th>Entrou no colégio</th>
                  <th className="acoes">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {ativos.map((aluno) =>
                  editando?.id === aluno.id ? (
                    <tr key={aluno.id}>
                      <td className="num">{aluno.numero}</td>
                      <td>
                        <input
                          className="input-tabela"
                          value={editando.nome}
                          onChange={(e) => setEditando({ ...editando, nome: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') salvarEdicao()
                            if (e.key === 'Escape') setEditando(null)
                          }}
                          aria-label={`Nome de ${aluno.nome}`}
                          autoFocus
                        />
                      </td>
                      <td>
                        <select
                          className="select-compacto"
                          value={editando.anoIngresso}
                          onChange={(e) => setEditando({ ...editando, anoIngresso: e.target.value })}
                          aria-label={`Ano de entrada de ${aluno.nome}`}
                        >
                          {opcoesDeAno('Não informado')}
                        </select>
                      </td>
                      <td className="acoes">
                        <button className="btn btn-pequeno btn-primario" onClick={salvarEdicao}>
                          Salvar
                        </button>
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditando(null)}>
                          Cancelar
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={aluno.id}>
                      <td className="num">{aluno.numero}</td>
                      <td>{aluno.nome}</td>
                      <td>
                        {aluno.anoIngresso ?? <span className="texto-2">não informado</span>}
                        {aluno.anoIngresso === anoLetivo && <span className="tag-novo">Novo</span>}
                      </td>
                      <td className="acoes">
                        <button
                          className="btn btn-pequeno btn-fantasma"
                          onClick={() => setEditando({ id: aluno.id, nome: aluno.nome, anoIngresso: aluno.anoIngresso ? String(aluno.anoIngresso) : '' })}
                        >
                          <Pencil size={14} aria-hidden /> Editar
                        </button>
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => remover(aluno)}>
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
