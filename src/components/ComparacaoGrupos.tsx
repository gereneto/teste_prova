import { avaliados, mediaPct, separarPorIngresso, separarPorSexo, type ResultadoAluno } from '../lib/estatisticas'
import { plural } from '../lib/formato'
import { Barras, Cartao } from './ui'

/** Abaixo disso, a diferença entre os grupos pode ser acaso. */
const MINIMO_POR_GRUPO = 10

/** Acerto médio de alunos novos e antigos no colégio, e de meninas e meninos. */
export function ComparacaoGrupos({ resultados }: { resultados: ResultadoAluno[] }) {
  const ingresso = separarPorIngresso(resultados)
  const sexo = separarPorSexo(resultados)
  const anoLetivo = resultados[0]?.turma.anoLetivo
  const item = (chave: string, rotulo: string, lista: ResultadoAluno[]) => {
    const n = avaliados(lista).length
    return { chave, rotulo, valor: mediaPct(lista), detalhe: plural(n, 'aluno', 'alunos') }
  }
  const grupos = [item('novos', `Novos (entraram em ${anoLetivo})`, ingresso.novos), item('antigos', 'Antigos', ingresso.antigos)]
  const sexos = [item('F', 'Meninas', sexo.F), item('M', 'Meninos', sexo.M)]
  const poucos = [...ingresso.novos, ...ingresso.antigos].length > 0 && [ingresso.novos, ingresso.antigos, sexo.F, sexo.M].some((l) => avaliados(l).length < MINIMO_POR_GRUPO)
  const semDado = avaliados(ingresso.sem_ano).length + avaliados(sexo.sem).length
  if (!avaliados(resultados).length) return null
  return (
    <Cartao titulo="Acerto médio por grupo">
      <div className="grade grade-2 sem-margem">
        <div>
          <h3 className="subtitulo">No colégio</h3>
          <Barras itens={grupos} />
        </div>
        <div>
          <h3 className="subtitulo">Sexo</h3>
          <Barras itens={sexos} />
        </div>
      </div>
      {poucos && <p className="texto-2 pequeno">Com menos de {MINIMO_POR_GRUPO} alunos num grupo, a diferença pode ser acaso.</p>}
      {semDado > 0 && <p className="texto-2 pequeno">Alunos sem o ano de entrada ou sem o sexo informado ficam fora do grupo que falta.</p>}
    </Cartao>
  )
}
