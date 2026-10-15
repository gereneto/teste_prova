import { ArrowLeft, Download, Printer } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import logoSolar from '../../assets/marca/logo-solar.png'
import { Vazio } from '../../components/ui'
import { alunosAtivos } from '../../lib/consultas'
import { serieNome, turmaNome } from '../../lib/formato'
import { baixarPdfDoCaderno } from '../../store/arquivos'
import { LETRAS, type Aluno, type Avaliacao, type Caderno, type Colegio, type Turma } from '../../types'
import { useContextoTurma } from './contexto'

const QUESTOES_POR_COLUNA = 10

/**
 * Tudo o que se imprime para uma turma: a lista de chamada da prova (o professor escreve os nomes à mão,
 * e ela fica na escola) e, do 3º ao 5º ano, as folhas de respostas com o número e as iniciais de cada aluno.
 */
export default function MaterialImpressao() {
  const contexto = useContextoTurma()
  const navigate = useNavigate()
  const [lista, setLista] = useState(true)
  const [folhas, setFolhas] = useState<boolean | null>(null)
  const [extras, setExtras] = useState(2)
  const [erroPdf, setErroPdf] = useState<string | null>(null)
  if ('erro' in contexto) {
    return <Vazio titulo={contexto.erro} acao={<Link className="btn" to={contexto.base}>Voltar ao início</Link>} />
  }
  const { caderno, avaliacao, turma, colegio } = contexto
  const alunos = alunosAtivos(contexto.db, turma.id)
  const comFolhas = folhas ?? caderno.usaFolhaRespostas
  const paginas = (lista ? 1 : 0) + (comFolhas ? alunos.length + extras : 0)

  async function baixar() {
    setErroPdf(null)
    try {
      await baixarPdfDoCaderno(caderno)
    } catch (erro) {
      setErroPdf(erro instanceof Error ? erro.message : 'Não foi possível baixar a prova.')
    }
  }

  return (
    <div className="impressao">
      <div className="impressao-barra nao-imprimir">
        <button className="btn btn-fantasma" onClick={() => navigate(-1)}>
          <ArrowLeft size={16} aria-hidden /> Voltar
        </button>
        <div className="impressao-titulo">
          <strong>Material da turma</strong>
          <span className="texto-2">
            {turmaNome(turma)} · {colegio.nome} · {avaliacao.titulo}
          </span>
        </div>
        {caderno.pdf && (
          <button className="btn" onClick={baixar}>
            <Download size={16} aria-hidden /> Baixar a prova (PDF)
          </button>
        )}
        <button className="btn btn-primario" onClick={() => window.print()} disabled={!paginas}>
          <Printer size={16} aria-hidden /> Imprimir {paginas} {paginas === 1 ? 'página' : 'páginas'}
        </button>
      </div>

      <div className="impressao-opcoes nao-imprimir">
        {erroPdf && <p className="erro-campo">{erroPdf}</p>}
        <label className="checkbox">
          <input type="checkbox" checked={lista} onChange={(e) => setLista(e.target.checked)} />
          <span>
            <strong>Lista de chamada da prova</strong>: número e iniciais de cada aluno, com espaço para você escrever o nome à mão. Ela fica na escola.
          </span>
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={comFolhas} onChange={(e) => setFolhas(e.target.checked)} />
          <span>
            <strong>Folhas de respostas</strong>: uma por aluno, já com o número e as iniciais.
            {!caderno.usaFolhaRespostas && ` No ${serieNome(turma.serie)}, os alunos marcam na própria prova; as folhas são opcionais.`}
          </span>
        </label>
        {comFolhas && (
          <label className="impressao-extras">
            Folhas em branco, para alunos que chegarem
            <input type="number" min={0} max={20} value={extras} onChange={(e) => setExtras(Math.max(0, Math.min(20, Number(e.target.value) || 0)))} />
          </label>
        )}
        <p className="texto-2 pequeno">
          {caderno.usaFolhaRespostas
            ? 'Entregue a cada aluno a folha com o número dele. '
            : `No ${serieNome(turma.serie)}, escreva o número de chamada de cada aluno na capa da prova. `}
          Antes de lançar as respostas, coloque as provas em ordem de número. Imprima em papel A4, sem ajustar à página.
        </p>
      </div>

      {!alunos.length && <Vazio titulo="A turma ainda não tem alunos no site">A lista de chamada e as folhas saem com os alunos cadastrados.</Vazio>}
      {lista && alunos.length > 0 && <ListaDeChamada alunos={alunos} caderno={caderno} avaliacao={avaliacao} turma={turma} colegio={colegio} />}
      {comFolhas &&
        [...alunos.map((aluno) => ({ chave: aluno.id, aluno })), ...Array.from({ length: extras }, (_, i) => ({ chave: `branco-${i}`, aluno: null }))].map((folha) => (
          <Folha key={folha.chave} aluno={folha.aluno} caderno={caderno} avaliacao={avaliacao} turma={turma} colegio={colegio} />
        ))}
    </div>
  )
}

interface Dados {
  caderno: Caderno
  avaliacao: Avaliacao
  turma: Turma
  colegio: Colegio
}

function CabecalhoFolha({ titulo, avaliacao, turma, colegio }: Omit<Dados, 'caderno'> & { titulo: string }) {
  return (
    <header className="folha-cabecalho">
      <img src={logoSolar} alt="Solar Colégios" className="folha-logo" />
      <div className="folha-marca">Prova Solar · {titulo}</div>
      <div className="folha-avaliacao">{avaliacao.titulo}</div>
      <div>
        {colegio.nome} · {turmaNome(turma)} · {turma.turno}
      </div>
    </header>
  )
}

function ListaDeChamada({ alunos, ...dados }: Dados & { alunos: Aluno[] }) {
  return (
    <section className="folha folha-lista">
      <CabecalhoFolha titulo="Lista de chamada da prova" {...dados} />
      <p className="folha-instrucoes">
        Escreva o nome de cada aluno ao lado do número. O site guarda só o número e as iniciais: esta lista, com os nomes, fica na escola.
      </p>
      <table className="folha-tabela">
        <thead>
          <tr>
            <th>Nº</th>
            <th>Iniciais</th>
            <th>Nome do aluno</th>
            <th>Faltou</th>
          </tr>
        </thead>
        <tbody>
          {alunos.map((aluno) => (
            <tr key={aluno.id}>
              <td className="folha-tabela-num">{aluno.numero}</td>
              <td>{aluno.iniciais}</td>
              <td className="folha-tabela-nome" />
              <td className="folha-tabela-caixa">
                <span />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function Folha({ aluno, caderno, avaliacao, turma, colegio }: Dados & { aluno: Aluno | null }) {
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

      <CabecalhoFolha titulo="Folha de respostas" avaliacao={avaliacao} turma={turma} colegio={colegio} />

      <div className="folha-aluno">
        <div className="folha-numero">
          <span className="folha-rotulo">Nº</span>
          <span className="folha-numero-valor">{aluno?.numero ?? ''}</span>
        </div>
        <div className="folha-campo">
          <span className="folha-rotulo">Iniciais</span>
          <span className="folha-valor">{aluno?.iniciais ?? ''}</span>
        </div>
        <div className="folha-campo folha-campo-nome">
          <span className="folha-rotulo">Seu nome</span>
        </div>
      </div>

      <p className="folha-instrucoes">
        Pinte toda a bolinha da alternativa escolhida, assim: <span className="folha-exemplo" aria-label="bolinha pintada" />. Marque só uma alternativa em
        cada questão.
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
        <span>
          {avaliacao.titulo} · prova do {serieNome(caderno.serie)}
        </span>
      </footer>
    </section>
  )
}
