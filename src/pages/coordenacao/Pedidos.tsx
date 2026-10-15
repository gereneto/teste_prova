import { CartaoPedido } from '../../components/CartaoPedido'
import { Cabecalho, Cartao, Selo, Vazio } from '../../components/ui'
import { pedidosPendentes } from '../../lib/consultas'
import { dataCurta } from '../../lib/formato'
import { descreverPedido, situacaoDoPedido } from '../../lib/pedidos'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'

/** Os pedidos dos professores: incluir aluno, registrar saída e corrigir dados. */
export default function Pedidos() {
  const db = useDb()
  const perfil = usePerfil()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!colegio) return null
  const pendentes = pedidosPendentes(db, colegio.id).sort((a, b) => a.criadoEm.localeCompare(b.criadoEm))
  const decididos = db.pedidos
    .filter((p) => p.colegioId === colegio.id && p.situacao !== 'pendente')
    .sort((a, b) => (b.decisao?.em ?? b.criadoEm).localeCompare(a.decisao?.em ?? a.criadoEm))

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Pedidos dos professores"
        subtitulo="Mudanças na lista de alunos pedidas pelos professores. Só valem depois que a coordenação aprova; o professor vê a resposta."
      />

      {!pendentes.length ? (
        <Vazio titulo="Nenhum pedido esperando resposta">Quando um professor pedir uma mudança na lista de alunos, ela aparece aqui.</Vazio>
      ) : (
        <div className="pedidos">
          {pendentes.map((p) => (
            <CartaoPedido key={p.id} db={db} pedido={p} />
          ))}
        </div>
      )}

      {decididos.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Pedidos já respondidos ({decididos.length})</summary>
          <ul className="lista-simples">
            {decididos.map((p) => {
              const situacao = situacaoDoPedido(p)
              const professor = db.professores.find((x) => x.id === p.professorId)?.nome
              return (
                <li key={p.id}>
                  <span>
                    {descreverPedido(db, p, true)}
                    <span className="texto-2 bloco pequeno">
                      Pedido por {professor ?? 'professor(a)'} em {dataCurta(p.criadoEm)}
                      {p.decisao && ` · respondido por ${p.decisao.por}`}
                      {p.decisao?.motivo && ` · motivo: ${p.decisao.motivo}`}
                    </span>
                  </span>
                  <Selo tom={situacao.tom}>{situacao.texto}</Selo>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      <Cartao className="cartao-sutil">
        <p className="texto-2 pequeno">
          Enquanto espera, um aluno incluído pelo professor já aparece no lançamento, e a prova dele pode ser lançada. Ele só entra nas médias da turma e
          do colégio depois da aprovação. Se o pedido não for aprovado, as respostas lançadas para ele são apagadas.
        </p>
      </Cartao>
    </>
  )
}
