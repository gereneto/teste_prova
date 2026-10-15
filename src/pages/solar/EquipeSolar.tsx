import { Crown, Pencil, Plus, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { AvisoEnvio, BotaoReenviar } from '../../components/AvisoEnvio'
import { FormularioContato } from '../../components/FormularioContato'
import { Aviso, Cabecalho, Cartao, Confirmacao, Selo } from '../../components/ui'
import { permissoesDe, pessoaDoPerfil, responsavelSolar } from '../../lib/consultas'
import { compararTexto, listaEmTexto } from '../../lib/formato'
import { adicionarMembroSolar, editarMembroSolar, mudarPapelSolar, passarResponsabilidadeSolar, removerMembroSolar } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Id, MembroSolar, PapelSolar } from '../../types'

const PAPEIS: Record<PapelSolar, { titulo: string; texto: string }> = {
  responsavel: { titulo: 'Responsável', texto: 'Edita tudo e define quem da equipe edita e quem só visualiza.' },
  edicao: { titulo: 'Edição', texto: 'Cadastra colégios e responsáveis, prepara provas e gabaritos, muda as configurações.' },
  visualizacao: { titulo: 'Só visualização', texto: 'Vê tudo o que a equipe vê, sem mudar nada.' },
}

export default function EquipeSolar() {
  const db = useDb()
  const perfil = usePerfil()
  const [incluindo, setIncluindo] = useState(false)
  const [papelNovo, setPapelNovo] = useState<Exclude<PapelSolar, 'responsavel'>>('visualizacao')
  const [editandoId, setEditandoId] = useState<Id | null>(null)
  const [tirando, setTirando] = useState<MembroSolar | null>(null)
  const [passando, setPassando] = useState<MembroSolar | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
  const eu = perfil ? pessoaDoPerfil(db, perfil) : null
  const { gerirEquipeSolar } = permissoesDe(eu)
  const responsavel = responsavelSolar(db)
  const colegiosDe = (membroId: Id) =>
    db.colegios
      .filter((c) => c.membroSolarId === membroId)
      .map((c) => c.nome)
      .sort(compararTexto)

  return (
    <>
      <Cabecalho
        sobretitulo="Equipe Solar"
        titulo="Quem tem acesso na Solar"
        subtitulo="Uma pessoa é a responsável. As demais podem ter permissão de edição ou só de visualização."
        acoes={
          gerirEquipeSolar &&
          !incluindo && (
            <button className="btn btn-primario" onClick={() => setIncluindo(true)}>
              <Plus size={16} aria-hidden /> Incluir pessoa
            </button>
          )
        }
      />

      {!gerirEquipeSolar && responsavel && <Aviso tom="info">Quem define quem edita e quem só visualiza é {responsavel.nome}, responsável pela equipe Solar.</Aviso>}

      {incluindo && (
        <FormularioContato
          titulo="Incluir pessoa na equipe Solar"
          rotuloSalvar="Incluir na equipe"
          extra={
            <fieldset className="campo">
              <legend>Permissão</legend>
              <div className="chips">
                {(['edicao', 'visualizacao'] as const).map((papel) => (
                  <label key={papel} className={`chip chip-escolha ${papelNovo === papel ? 'escolhido' : ''}`}>
                    <input type="radio" name="papel" checked={papelNovo === papel} onChange={() => setPapelNovo(papel)} />
                    {PAPEIS[papel].titulo}
                  </label>
                ))}
              </div>
              <p className="campo-ajuda">{PAPEIS[papelNovo].texto}</p>
            </fieldset>
          }
          aoSalvar={(contato) => {
            setEnviado(adicionarMembroSolar(contato, papelNovo).emailEnviado)
            setIncluindo(false)
          }}
          aoCancelar={() => setIncluindo(false)}
        />
      )}

      <AvisoEnvio email={enviado} aoFechar={() => setEnviado(null)} />

      {(['responsavel', 'edicao', 'visualizacao'] as const).map((papel) => {
        const pessoas = db.equipeSolar.filter((m) => m.papel === papel).sort((a, b) => compararTexto(a.nome, b.nome))
        return (
          <Cartao key={papel} titulo={PAPEIS[papel].titulo} sub={PAPEIS[papel].texto}>
            {!pessoas.length ? (
              <p className="texto-2">Ninguém com esta permissão.</p>
            ) : (
              <ul className="lista-pessoas">
                {pessoas.map((membro) =>
                  editandoId === membro.id ? (
                    <li key={membro.id}>
                      <FormularioContato
                        inicial={membro}
                        rotuloSalvar="Salvar"
                        aoSalvar={(contato) => {
                          setEnviado(editarMembroSolar(membro.id, contato).emailEnviado)
                          setEditandoId(null)
                        }}
                        aoCancelar={() => setEditandoId(null)}
                      />
                    </li>
                  ) : (
                    <li key={membro.id}>
                      <div>
                        <p className="lista-pessoas-nome">
                          {membro.nome} {eu?.papel === 'solar' && eu.membro.id === membro.id && <Selo>Você</Selo>}
                        </p>
                        <p className="texto-2 pequeno">{[membro.email, membro.telefone].filter(Boolean).join(' · ')}</p>
                        {colegiosDe(membro.id).length > 0 && <p className="texto-2 pequeno">Cuida de {listaEmTexto(colegiosDe(membro.id))}.</p>}
                      </div>
                      {gerirEquipeSolar && (
                        <div className="form-acoes">
                          <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditandoId(membro.id)}>
                            <Pencil size={14} aria-hidden /> Editar
                          </button>
                          {!(eu?.papel === 'solar' && eu.membro.id === membro.id) && <BotaoReenviar tipo="solar" id={membro.id} aoEnviar={setEnviado} />}
                          {membro.papel !== 'responsavel' && (
                            <>
                              <select
                                className="select-compacto"
                                value={membro.papel}
                                onChange={(e) => mudarPapelSolar(membro.id, e.target.value as Exclude<PapelSolar, 'responsavel'>)}
                                aria-label={`Permissão de ${membro.nome}`}
                              >
                                <option value="edicao">Edição</option>
                                <option value="visualizacao">Só visualização</option>
                              </select>
                              <button className="btn btn-pequeno btn-fantasma" onClick={() => setPassando(membro)}>
                                <Crown size={14} aria-hidden /> Passar a responsabilidade
                              </button>
                              <button className="btn btn-pequeno btn-fantasma" onClick={() => setTirando(membro)}>
                                <UserMinus size={14} aria-hidden /> Tirar da equipe
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </li>
                  ),
                )}
              </ul>
            )}
          </Cartao>
        )
      })}

      <Confirmacao
        titulo={tirando ? `Tirar ${tirando.nome} da equipe Solar?` : ''}
        aberta={tirando !== null}
        rotuloConfirmar="Tirar da equipe"
        aoConfirmar={() => {
          if (tirando) removerMembroSolar(tirando.id)
          setTirando(null)
        }}
        aoFechar={() => setTirando(null)}
      >
        <p>A pessoa deixa de ter acesso ao site. O que ela fez continua no histórico.</p>
      </Confirmacao>

      <Confirmacao
        titulo={passando ? `Passar a responsabilidade para ${passando.nome}?` : ''}
        aberta={passando !== null}
        rotuloConfirmar="Passar a responsabilidade"
        aoConfirmar={() => {
          if (passando) passarResponsabilidadeSolar(passando.id)
          setPassando(null)
        }}
        aoFechar={() => setPassando(null)}
      >
        <p>
          {passando?.nome} passa a ser a pessoa responsável pela equipe Solar. Você continua na equipe, com permissão de edição. Só pode haver uma pessoa
          responsável por vez.
        </p>
      </Confirmacao>
    </>
  )
}
