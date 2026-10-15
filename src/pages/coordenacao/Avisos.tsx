import { Check, CheckCheck, Users } from 'lucide-react'
import { Link } from 'react-router'
import { Cabecalho, Vazio } from '../../components/ui'
import { avisosPendentes } from '../../lib/consultas'
import { dataCurta, diasEntre, hojeIso, turmaNome } from '../../lib/formato'
import { marcarCiente } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import type { Db, Evento } from '../../types'

/** As mudanças que os professores fizeram nas listas de alunos. Já valem: a coordenação só marca que viu. */
export default function Avisos() {
  const db = useDb()
  const perfil = usePerfil()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  if (!colegio) return null
  const pendentes = avisosPendentes(db, colegio.id).sort((a, b) => b.em.localeCompare(a.em))
  const vistos = db.historico
    .filter((e) => e.avisarCoordenacao && e.ciente && e.colegioId === colegio.id)
    .sort((a, b) => b.em.localeCompare(a.em))
    .slice(0, 30)

  return (
    <>
      <Cabecalho
        sobretitulo={colegio.nome}
        titulo="Avisos"
        subtitulo="Mudanças que os professores fizeram nas listas de alunos. Elas já valem: marque que viu e, se quiser, corrija na turma."
        acoes={
          pendentes.length > 1 && (
            <button className="btn" onClick={() => marcarCiente(pendentes.map((e) => e.id))}>
              <CheckCheck size={16} aria-hidden /> Marcar todos como vistos
            </button>
          )
        }
      />

      {!pendentes.length ? (
        <Vazio titulo="Nenhuma mudança nova">Quando um professor incluir, corrigir ou tirar um aluno da lista, o aviso aparece aqui.</Vazio>
      ) : (
        <ul className="avisos">
          {pendentes.map((evento) => (
            <CartaoAviso key={evento.id} db={db} evento={evento} />
          ))}
        </ul>
      )}

      {vistos.length > 0 && (
        <details className="cartao recolhivel">
          <summary>Já vistos</summary>
          <ul className="historico">
            {vistos.map((e) => (
              <li key={e.id}>
                <span className="historico-data">{dataCurta(e.em)}</span>
                <span>
                  {e.texto}{' '}
                  <span className="texto-2">
                    ({e.por}, {turmaDoEvento(db, e)}; visto por {e.ciente!.por} em {dataCurta(e.ciente!.em)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </>
  )
}

const turmaDoEvento = (db: Db, evento: Evento) => {
  const turma = db.turmas.find((t) => t.id === evento.turmaId)
  return turma ? turmaNome(turma) : 'turma'
}

function CartaoAviso({ db, evento }: { db: Db; evento: Evento }) {
  const dias = diasEntre(evento.em, hojeIso())
  return (
    <li className="aviso-mudanca">
      <div>
        <p className="aviso-mudanca-texto">{evento.texto}</p>
        <p className="texto-2 pequeno">
          {evento.por} · {turmaDoEvento(db, evento)} · {dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`}
        </p>
      </div>
      <div className="form-acoes">
        <button className="btn btn-pequeno btn-primario" onClick={() => marcarCiente([evento.id])}>
          <Check size={15} aria-hidden /> Ciente
        </button>
        {evento.turmaId && (
          <Link className="btn btn-pequeno" to={`/coordenacao/turma/${evento.turmaId}/alunos`}>
            <Users size={15} aria-hidden /> Ver a turma
          </Link>
        )}
      </div>
    </li>
  )
}
