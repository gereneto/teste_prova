import { ArrowLeft, Printer } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import logoSolar from '../../assets/marca/logo-solar.png'
import { Vazio } from '../../components/ui'
import { buscarHabilidade } from '../../data/bncc'
import { cadernoDaSerie } from '../../lib/consultas'
import { avaliados, coletarResultados, contarFaixas, mediaPct, NOMES_FAIXAS, participacao, separarPorIngresso } from '../../lib/estatisticas'
import { pct, plural, serieNome } from '../../lib/formato'
import { dificuldadesComuns } from '../../lib/leitura'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'
import { SERIES } from '../../types'

const PERGUNTAS = [
  'O que já tentamos para ensinar estes conteúdos? O que funcionou?',
  'Que prática de uma turma pode ajudar as outras?',
  'Que conteúdos dos anos anteriores os alunos novos podem não ter visto? Como acolhê-los?',
  'Que apoio precisamos da coordenação ou da Solar?',
]

/**
 * Material para a reunião pedagógica, para imprimir ou projetar. Mostra o colégio como um todo e as
 * dificuldades comuns: não compara turmas e não traz iniciais de alunos.
 */
export default function ReuniaoPedagogica() {
  const { avaliacaoId = '' } = useParams()
  const db = useDb()
  const perfil = usePerfil()
  const navigate = useNavigate()
  const colegio = perfil?.papel === 'coordenacao' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  const avaliacao = db.avaliacoes.find((a) => a.id === avaliacaoId)
  const resultados = useMemo(
    () => (colegio && avaliacao ? coletarResultados(db, { avaliacaoId: avaliacao.id, colegioId: colegio.id }) : []),
    [db, colegio, avaliacao],
  )
  if (!colegio || !avaliacao) return <Vazio titulo="Material indisponível" acao={<Link className="btn" to="/">Voltar</Link>} />

  const config = db.config
  const lista = avaliados(resultados)
  const part = participacao(resultados)
  const faixas = contarFaixas(resultados, config)
  const { novos, antigos } = separarPorIngresso(resultados)
  const mediaNovos = mediaPct(novos)
  const mediaAntigos = mediaPct(antigos)

  return (
    <div className="impressao">
      <div className="impressao-barra nao-imprimir">
        <button className="btn btn-fantasma" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <div className="impressao-titulo">
          <strong>Reunião pedagógica</strong>
          <span className="texto-2">Para imprimir ou projetar. Sem comparação entre turmas e sem alunos.</span>
        </div>
        <button className="btn btn-primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir
        </button>
      </div>

      <article className="pagina-a4">
        <header className="pagina-a4-topo">
          <img src={logoSolar} alt="Solar Colégios" />
          <div>
            <p className="sobretitulo">Reunião pedagógica</p>
            <h1>{colegio.nome}</h1>
            <p>{avaliacao.titulo}</p>
          </div>
        </header>

        <section>
          <p className="pagina-a4-abertura">
            Estes resultados são do colégio inteiro. Servem para planejarmos juntos o que retomar, não para comparar turmas ou professores. Uma prova
            mostra um momento; junte com o que cada um observa em sala.
          </p>
        </section>

        <section>
          <h2>Panorama do colégio</h2>
          {lista.length ? (
            <ul>
              <li>
                {plural(part.avaliados, 'aluno avaliado', 'alunos avaliados')}, com média de {pct(mediaPct(resultados))} de acertos.
              </li>
              <li>{faixas.map((n, i) => `${NOMES_FAIXAS[i]}: ${n}`).join(' · ')}.</li>
              {part.faltas > 0 && <li>{plural(part.faltas, 'aluno faltou', 'alunos faltaram')}.</li>}
            </ul>
          ) : (
            <p>Ainda não há alunos avaliados.</p>
          )}
        </section>

        <section>
          <h2>O que retomar em cada ano</h2>
          {SERIES.map((serie) => {
            const caderno = cadernoDaSerie(db, avaliacao.id, serie)
            const doAno = resultados.filter((r) => r.turma.serie === serie)
            if (!caderno || !avaliados(doAno).length) return null
            const dificuldades = dificuldadesComuns(caderno, doAno).slice(0, 3)
            return (
              <div key={serie} className="pagina-a4-bloco">
                <h3>{serieNome(serie)}</h3>
                {dificuldades.length ? (
                  <ul>
                    {dificuldades.map((d) => (
                      <li key={d.indice}>
                        Questão {d.indice + 1} ({d.questao.disciplina}, {pct(d.pct)} de acerto): {buscarHabilidade(d.questao.habilidade)?.descricao ?? 'sem habilidade cadastrada'}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>Em todas as questões, pelo menos metade dos alunos acertou.</p>
                )}
              </div>
            )
          })}
        </section>

        {mediaNovos != null && mediaAntigos != null && (
          <section>
            <h2>Alunos novos no colégio</h2>
            <p>
              Os {plural(avaliados(novos).length, 'aluno novo', 'alunos novos')} tiveram média de {pct(mediaNovos)}; os que já estavam no colégio, {pct(mediaAntigos)}.
              Como acolher quem chegou neste ano?
            </p>
          </section>
        )}

        <section>
          <h2>Para a conversa</h2>
          <ul>
            {PERGUNTAS.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2>Combinados</h2>
          <div className="pagina-a4-linhas" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} />
            ))}
          </div>
        </section>
      </article>
    </div>
  )
}
