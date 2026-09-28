import { ArrowLeft, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import logoSolar from '../../assets/marca/logo-solar.png'
import { Vazio } from '../../components/ui'
import { turmaNome } from '../../lib/formato'
import { LETRAS, type Aluno, type Avaliacao, type Caderno, type Colegio, type Turma } from '../../types'
import { useContextoTurma } from './contexto'

const QUESTOES_POR_COLUNA = 10

export default function FolhasResposta() {
  const contexto = useContextoTurma()
  const navigate = useNavigate()
  const [extras, setExtras] = useState(2)
  if ('erro' in contexto) {
    return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar</Link>} />
  }
  const { caderno, avaliacao, turma, colegio, alunos } = contexto
  const folhas: { chave: string; aluno: Aluno | null }[] = [
    ...alunos.filter((a) => a.ativo).map((aluno) => ({ chave: aluno.id, aluno })),
    ...Array.from({ length: extras }, (_, i) => ({ chave: `avulsa-${i}`, aluno: null })),
  ]

  return (
    <div className="impressao">
      <div className="impressao-barra nao-imprimir">
        <button className="btn btn-fantasma" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <div className="impressao-titulo">
          <strong>Folhas de respostas</strong>
          <span className="texto-2">
            {turmaNome(turma)} · {colegio.nome} · {avaliacao.titulo}
          </span>
        </div>
        <label className="impressao-extras">
          Folhas em branco
          <input type="number" min={0} max={20} value={extras} onChange={(e) => setExtras(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
        </label>
        <button className="btn btn-primario" onClick={() => window.print()}>
          <Printer size={16} aria-hidden /> Imprimir {folhas.length} folhas
        </button>
      </div>
      <p className="impressao-dica nao-imprimir">
        Uma folha por aluno, já com nome e número de chamada, na mesma ordem da tela de lançamento. As folhas em branco servem para alunos
        novos. Imprima em papel A4, sem ajustar à página.
      </p>
      {folhas.map((folha) => (
        <Folha key={folha.chave} aluno={folha.aluno} caderno={caderno} avaliacao={avaliacao} turma={turma} colegio={colegio} />
      ))}
    </div>
  )
}

function Folha(props: { aluno: Aluno | null; caderno: Caderno; avaliacao: Avaliacao; turma: Turma; colegio: Colegio }) {
  const { aluno, caderno, avaliacao, turma, colegio } = props
  const letras = LETRAS.slice(0, caderno.numAlternativas)
  const colunas: number[][] = []
  caderno.questoes.forEach((_, i) => {
    if (i % QUESTOES_POR_COLUNA === 0) colunas.push([])
    colunas[colunas.length - 1].push(i)
  })

  return (
    <section className="folha">
      {/* Marcas nos cantos: servem de referência para a leitura automática por foto, numa versão futura. */}
      <span className="folha-canto folha-canto-se" aria-hidden />
      <span className="folha-canto folha-canto-sd" aria-hidden />
      <span className="folha-canto folha-canto-ie" aria-hidden />
      <span className="folha-canto folha-canto-id" aria-hidden />

      <header className="folha-cabecalho">
        <img src={logoSolar} alt="Solar Colégios" className="folha-logo" />
        <div className="folha-marca">Prova Solar · Folha de respostas</div>
        <div className="folha-avaliacao">{avaliacao.titulo}</div>
        <div>
          {colegio.nome} · {turmaNome(turma)} · {turma.turno}
        </div>
      </header>

      <div className="folha-aluno">
        <div className="folha-campo folha-campo-nome">
          <span className="folha-rotulo">Aluno(a)</span>
          <span className="folha-valor">{aluno?.nome}</span>
        </div>
        <div className="folha-campo">
          <span className="folha-rotulo">Nº</span>
          <span className="folha-valor">{aluno?.numero}</span>
        </div>
      </div>

      <p className="folha-instrucoes">
        Pinte toda a bolinha da alternativa escolhida, assim: <span className="folha-exemplo" aria-label="bolinha pintada" />. Marque só
        uma alternativa em cada questão.
      </p>

      <div className="folha-questoes">
        {colunas.map((indices, c) => (
          <div className="folha-coluna" key={c}>
            {indices.map((i) => (
              <div className="folha-linha" key={i}>
                <span className="folha-num">{i + 1}</span>
                {letras.map((letra) => (
                  <span className="folha-bolha" key={letra}>
                    {letra}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      <footer className="folha-rodape">
        <span>Não dobre nem amasse esta folha.</span>
        <span className="folha-codigo">
          {caderno.id} · {aluno?.id ?? 'avulsa'}
        </span>
      </footer>
    </section>
  )
}
