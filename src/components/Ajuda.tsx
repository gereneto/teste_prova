import { Mail, Phone, Printer } from 'lucide-react'
import { Link } from 'react-router'
import { contatoDoColegio, responsavelSolar } from '../lib/consultas'
import type { Contato, Db, Perfil } from '../types'

type Papel = Perfil['papel']

/** Passo a passo de cada perfil, também impresso numa folha (/imprimir/passo-a-passo/:papel). */
export const PASSOS: Record<Papel, { titulo: string; texto: string }[]> = {
  professor: [
    { titulo: 'Confira a lista da turma', texto: 'Na aba Alunos, compare a lista com o seu diário. Se faltar alguém, toque em “Falta um aluno na lista”.' },
    { titulo: 'Imprima o material', texto: 'Toque em “Imprimir material da turma”. Saem a lista de chamada da prova e, do 3º ao 5º ano, as folhas de respostas.' },
    { titulo: 'Aplique a prova', texto: 'Nas datas combinadas. Cada aluno recebe a folha com o próprio número.' },
    { titulo: 'Lance as respostas', texto: 'Com as provas em ordem de número, toque em “Lançar respostas” e passe a letra que cada aluno marcou. Cada toque já fica salvo.' },
    { titulo: 'Conclua e veja os resultados', texto: 'Quando todos estiverem lançados, toque em “Concluir lançamento”. Os resultados da turma aparecem na hora.' },
  ],
  coordenacao: [
    { titulo: 'Confira as turmas do ano', texto: 'Em “Turmas e alunos”, veja se todas as turmas estão cadastradas.' },
    { titulo: 'Diga quem cuida de cada turma', texto: 'Em “Professores”, cadastre os professores e escolha o professor de cada turma.' },
    { titulo: 'Cole a lista de alunos', texto: 'Abra cada turma e cole a lista da secretaria. O site guarda só o número, as iniciais e o ano de entrada.' },
    { titulo: 'Responda aos pedidos', texto: 'Em “Pedidos”, aprove ou recuse as mudanças que os professores pediram na lista de alunos.' },
    { titulo: 'Acompanhe e converse', texto: 'No Início, acompanhe o lançamento. Em “Resultados”, veja o colégio e prepare a reunião pedagógica.' },
  ],
  solar: [
    { titulo: 'Prepare as provas', texto: 'Em “Avaliações”, envie o PDF de cada ano e preencha o gabarito, a disciplina e a habilidade de cada questão.' },
    { titulo: 'Confira os gabaritos', texto: 'Uma segunda pessoa confere o gabarito com a prova impressa e marca “Gabarito conferido”.' },
    { titulo: 'Acompanhe os colégios', texto: 'Em “Colégios”, veja quem é o responsável de cada um e se as turmas estão prontas.' },
    { titulo: 'Acompanhe o lançamento', texto: 'No Início, veja o que falta e os alertas de gabarito.' },
    { titulo: 'Leia os resultados', texto: 'Em “Resultados”, veja o panorama da rede e os pontos de melhoria.' },
  ],
}

export const PALAVRAS: { termo: string; definicao: string }[] = [
  { termo: 'Avaliação', definicao: 'A aplicação anual da Prova Solar, com uma prova para cada ano.' },
  { termo: 'Prova', definicao: 'O papel que os alunos de um ano recebem, como a prova do 3º ano.' },
  { termo: 'Lançar respostas', definicao: 'Passar para o site a letra que cada aluno marcou. O site corrige sozinho.' },
  { termo: 'Em branco', definicao: 'O aluno não marcou nenhuma alternativa na questão.' },
  { termo: 'Rasurada', definicao: 'O aluno marcou mais de uma alternativa na questão.' },
  { termo: 'Prova adaptada', definicao: 'O aluno fez uma versão diferente da prova. Ele fica fora das médias.' },
  { termo: 'Faixa de desempenho', definicao: 'Abaixo do básico, Básico, Adequado ou Avançado, conforme o número de acertos.' },
  { termo: 'Habilidade da BNCC', definicao: 'O que a questão avalia, segundo a Base Nacional Comum Curricular.' },
  { termo: 'Aluno novo', definicao: 'Quem entrou no colégio no mesmo ano da avaliação.' },
]

function CartaoContato({ titulo, contato, papel }: { titulo: string; contato: Contato | null; papel: string }) {
  return (
    <div className="ajuda-contato">
      <p className="sobretitulo">{titulo}</p>
      {contato ? (
        <>
          <p className="ajuda-contato-nome">{contato.nome}</p>
          <p className="texto-2 pequeno">{papel}</p>
          <div className="form-acoes">
            {contato.telefone && (
              <a className="btn btn-pequeno" href={`tel:${contato.telefone.replace(/[^\d+]/g, '')}`}>
                <Phone size={15} aria-hidden /> {contato.telefone}
              </a>
            )}
            {contato.email && (
              <a className="btn btn-pequeno" href={`mailto:${contato.email}`}>
                <Mail size={15} aria-hidden /> {contato.email}
              </a>
            )}
          </div>
        </>
      ) : (
        <p className="texto-2">Ainda não há uma pessoa cadastrada.</p>
      )}
    </div>
  )
}

export function AjudaConteudo({ db, perfil }: { db: Db; perfil: Perfil }) {
  const solar = responsavelSolar(db)
  const coordenacao = perfil.papel !== 'solar' ? contatoDoColegio(db, perfil.colegioId) : null
  return (
    <div className="ajuda">
      <div className="ajuda-contatos">
        {perfil.papel === 'professor' && (
          <CartaoContato titulo="Fale com a coordenação do seu colégio" contato={coordenacao} papel="Coordenação, para dúvidas sobre a turma, os alunos e o site" />
        )}
        <CartaoContato titulo="Problema com a prova ou com o site?" contato={solar} papel="Equipe Solar" />
      </div>

      <h3 className="subtitulo">Passo a passo</h3>
      <ol className="passos">
        {PASSOS[perfil.papel].map((passo) => (
          <li key={passo.titulo}>
            <strong>{passo.titulo}.</strong> {passo.texto}
          </li>
        ))}
      </ol>
      <Link className="btn btn-pequeno" to={`/imprimir/passo-a-passo/${perfil.papel}`}>
        <Printer size={15} aria-hidden /> Imprimir o passo a passo
      </Link>

      <details className="ajuda-palavras">
        <summary>Palavras do site</summary>
        <dl>
          {PALAVRAS.map((p) => (
            <div key={p.termo}>
              <dt>{p.termo}</dt>
              <dd>{p.definicao}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  )
}
