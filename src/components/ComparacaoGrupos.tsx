import type { ResumoGrupos } from '../lib/estatisticas'
import { plural } from '../lib/formato'
import { Barras, Cartao } from './ui'

/** Abaixo disso, a diferença entre os grupos pode ser acaso. */
const MINIMO_POR_GRUPO = 10

/**
 * Acerto médio de alunos novos e antigos no colégio, e de meninas e meninos. Os grupos vêm de resumoGrupos (alunos)
 * ou de resumoGruposAg (somas por turma, para a Solar).
 */
export function ComparacaoGrupos({ grupos }: { grupos: ResumoGrupos }) {
  const item = (chave: string, rotulo: string, g: { n: number; media: number | null }) => ({
    chave,
    rotulo,
    valor: g.media,
    detalhe: plural(g.n, 'aluno', 'alunos'),
  })
  const ingresso = [item('novos', `Novos (entraram em ${grupos.anoLetivo})`, grupos.novos), item('antigos', 'Antigos', grupos.antigos)]
  const sexos = [item('F', 'Meninas', grupos.F), item('M', 'Meninos', grupos.M)]
  const poucos = grupos.novos.n + grupos.antigos.n > 0 && [grupos.novos, grupos.antigos, grupos.F, grupos.M].some((g) => g.n < MINIMO_POR_GRUPO)
  if (!grupos.total) return null
  return (
    <Cartao titulo="Acerto médio por grupo">
      <div className="grade grade-2 sem-margem">
        <div>
          <h3 className="subtitulo">No colégio</h3>
          <Barras itens={ingresso} />
        </div>
        <div>
          <h3 className="subtitulo">Sexo</h3>
          <Barras itens={sexos} />
        </div>
      </div>
      {poucos && <p className="texto-2 pequeno">Com menos de {MINIMO_POR_GRUPO} alunos num grupo, a diferença pode ser acaso.</p>}
      {grupos.semDado > 0 && <p className="texto-2 pequeno">Alunos sem o ano de entrada ou sem o sexo informado ficam fora do grupo que falta.</p>}
    </Cartao>
  )
}
