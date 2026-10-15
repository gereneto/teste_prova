import { Crown, Pencil, Plus, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { AvisoEnvio, BotaoReenviar } from '../../components/AvisoEnvio'
import { FormularioContato } from '../../components/FormularioContato'
import { Aviso, Cabecalho, Cartao, Confirmacao, Selo } from '../../components/ui'
import { equipeDoColegio, permissoesDe, pessoaDoPerfil } from '../../lib/consultas'
import { adicionarCoordenador, editarCoordenador, passarResponsabilidade, removerCoordenador } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Coordenador, Id } from '../../types'

/** Quem faz parte da coordenação. Só a pessoa responsável inclui ou tira alguém. */
export default function EquipeColegio() {
  const db = useDb()
  const perfil = usePerfil()
  const [incluindo, setIncluindo] = useState(false)
  const [editandoId, setEditandoId] = useState<Id | null>(null)
  const [tirando, setTirando] = useState<Coordenador | null>(null)
  const [passando, setPassando] = useState<Coordenador | null>(null)
  const [enviado, setEnviado] = useState<string | null>(null)
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!perfil || !colegio) return null
  const eu = pessoaDoPerfil(db, perfil)
  const { gerirEquipeColegio } = permissoesDe(eu)
  const equipe = equipeDoColegio(db, colegio.id)
  const responsavel = equipe.find((c) => c.responsavel)

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Equipe da coordenação"
        subtitulo="Todas as pessoas da equipe têm as mesmas permissões de coordenação. A pessoa responsável é quem inclui ou tira pessoas da equipe."
        acoes={
          gerirEquipeColegio &&
          !incluindo && (
            <button className="btn btn-primario" onClick={() => setIncluindo(true)}>
              <Plus size={16} aria-hidden /> Incluir pessoa
            </button>
          )
        }
      />

      {!gerirEquipeColegio && responsavel && (
        <Aviso tom="info">Quem inclui ou tira pessoas da equipe é {responsavel.nome}, responsável pela coordenação.</Aviso>
      )}

      {incluindo && (
        <FormularioContato
          titulo="Incluir pessoa na coordenação"
          rotuloSalvar="Incluir na equipe"
          aoSalvar={(contato) => {
            setEnviado(adicionarCoordenador(colegio.id, contato).emailEnviado)
            setIncluindo(false)
          }}
          aoCancelar={() => setIncluindo(false)}
        />
      )}

      <Cartao>
        <AvisoEnvio email={enviado} aoFechar={() => setEnviado(null)} />
        <ul className="lista-pessoas">
          {equipe.map((pessoa) =>
            editandoId === pessoa.id ? (
              <li key={pessoa.id}>
                <FormularioContato
                  inicial={pessoa}
                  rotuloSalvar="Salvar"
                  aoSalvar={(contato) => {
                    setEnviado(editarCoordenador(pessoa.id, contato).emailEnviado)
                    setEditandoId(null)
                  }}
                  aoCancelar={() => setEditandoId(null)}
                />
              </li>
            ) : (
              <li key={pessoa.id}>
                <div>
                  <p className="lista-pessoas-nome">
                    {pessoa.nome} {pessoa.responsavel && <Selo tom="marca">Responsável</Selo>} {eu?.papel === 'coordenacao' && eu.coordenador.id === pessoa.id && <Selo>Você</Selo>}
                  </p>
                  <p className="texto-2 pequeno">{[pessoa.email, pessoa.telefone].filter(Boolean).join(' · ')}</p>
                </div>
                {gerirEquipeColegio && (
                  <div className="form-acoes">
                    <button className="btn btn-pequeno btn-fantasma" onClick={() => setEditandoId(pessoa.id)}>
                      <Pencil size={14} aria-hidden /> Editar
                    </button>
                    {!(eu?.papel === 'coordenacao' && eu.coordenador.id === pessoa.id) && <BotaoReenviar tipo="coordenador" id={pessoa.id} aoEnviar={setEnviado} />}
                    {!pessoa.responsavel && (
                      <>
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => setPassando(pessoa)}>
                          <Crown size={14} aria-hidden /> Passar a responsabilidade
                        </button>
                        <button className="btn btn-pequeno btn-fantasma" onClick={() => setTirando(pessoa)}>
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
        <p className="texto-2 pequeno">Quem define a pessoa responsável de cada colégio é a equipe Solar.</p>
      </Cartao>

      <Confirmacao
        titulo={tirando ? `Tirar ${tirando.nome} da equipe?` : ''}
        aberta={tirando !== null}
        rotuloConfirmar="Tirar da equipe"
        aoConfirmar={() => {
          if (tirando) removerCoordenador(tirando.id)
          setTirando(null)
        }}
        aoFechar={() => setTirando(null)}
      >
        <p>A pessoa deixa de ter acesso ao colégio no site. O que ela fez continua no histórico.</p>
      </Confirmacao>

      <Confirmacao
        titulo={passando ? `Passar a responsabilidade para ${passando.nome}?` : ''}
        aberta={passando !== null}
        rotuloConfirmar="Passar a responsabilidade"
        aoConfirmar={() => {
          if (passando) passarResponsabilidade(passando.id)
          setPassando(null)
        }}
        aoFechar={() => setPassando(null)}
      >
        <p>
          {passando?.nome} passa a ser a pessoa responsável e a incluir ou tirar pessoas da equipe. Você continua na coordenação, com as mesmas
          permissões, mas sem esse papel.
        </p>
      </Confirmacao>
    </>
  )
}
