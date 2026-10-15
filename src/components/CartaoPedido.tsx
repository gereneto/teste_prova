import { Check, X } from 'lucide-react'
import { useState } from 'react'
import { diasEntre, hojeIso, plural, turmaNome } from '../lib/formato'
import { descreverPedido, detalharPedido } from '../lib/pedidos'
import { aprovarPedido, recusarPedido, temRespostas } from '../store/acoes'
import type { Db, Pedido } from '../types'
import { Selo } from './ui'

const MOTIVOS_PRONTOS = [
  'Este aluno já está na lista com outro número.',
  'O número ou as iniciais não conferem com o diário.',
  'O aluno não é desta turma.',
]

/** Pedidos parados há mais que isso aparecem destacados. */
export const DIAS_PEDIDO_PARADO = 3

/** Um pedido de professor para a coordenação aprovar ou recusar (com motivo). */
export function CartaoPedido({ db, pedido }: { db: Db; pedido: Pedido }) {
  const [recusando, setRecusando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const professor = db.professores.find((p) => p.id === pedido.professorId)?.nome ?? 'Professor(a)'
  const turma = db.turmas.find((t) => t.id === pedido.turmaId)
  const dias = diasEntre(pedido.criadoEm, hojeIso())
  const jaLancado = pedido.tipo === 'incluir' && temRespostas(db, pedido.alunoId)

  function aprovar() {
    setErro(aprovarPedido(pedido.id))
  }

  function recusar() {
    if (!motivo.trim()) return setErro('Escreva o motivo: o professor vai ver.')
    recusarPedido(pedido.id, motivo.trim())
  }

  return (
    <article className={`pedido ${dias > DIAS_PEDIDO_PARADO ? 'parado' : ''}`}>
      <div className="pedido-topo">
        <div>
          <h3>{descreverPedido(db, pedido)}</h3>
          <p className="texto-2 pequeno">
            {professor} pediu {dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`}
            {turma ? ` · ${turmaNome(turma)}` : ''}
          </p>
        </div>
        {dias > DIAS_PEDIDO_PARADO && <Selo tom="ambar">Esperando há {plural(dias, 'dia', 'dias')}</Selo>}
      </div>
      <ul className="pedido-detalhes">
        {detalharPedido(db, pedido).map((linha) => (
          <li key={linha}>{linha}</li>
        ))}
        {jaLancado && <li>A prova deste aluno já foi lançada. Ela entra nos resultados do colégio quando você aprovar.</li>}
      </ul>
      {recusando ? (
        <div className="pedido-recusa">
          <p className="pequeno">
            <strong>Por que não aprovar?</strong> O professor vai ver este motivo.
            {jaLancado && ' As respostas lançadas para este aluno serão apagadas.'}
          </p>
          <div className="chips">
            {MOTIVOS_PRONTOS.map((m) => (
              <button key={m} type="button" className={`chip chip-escolha ${motivo === m ? 'escolhido' : ''}`} onClick={() => setMotivo(m)}>
                {m}
              </button>
            ))}
          </div>
          <label className="campo">
            <span>Ou escreva o motivo</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={160} />
            <span className="campo-ajuda">Não escreva o nome do aluno.</span>
          </label>
          <div className="form-acoes">
            <button className="btn btn-perigo-cheio" onClick={recusar}>
              Não aprovar
            </button>
            <button className="btn btn-fantasma" onClick={() => setRecusando(false)}>
              Voltar
            </button>
          </div>
        </div>
      ) : (
        <div className="form-acoes">
          <button className="btn btn-primario" onClick={aprovar}>
            <Check size={16} aria-hidden /> Aprovar
          </button>
          <button className="btn" onClick={() => setRecusando(true)}>
            <X size={16} aria-hidden /> Não aprovar
          </button>
        </div>
      )}
      {erro && <p className="erro-campo">{erro}</p>}
    </article>
  )
}
