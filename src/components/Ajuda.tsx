import { Mail, Phone, Printer } from 'lucide-react'
import { Link } from 'react-router'
import { contatoDoColegio, membroSolarDoColegio, responsavelSolar } from '../lib/consultas'
import type { Contato, Db, Perfil } from '../types'

type Papel = Perfil['papel']

/** Passo a passo de cada perfil, também impresso numa folha (/imprimir/passo-a-passo/:papel). */
export const PASSOS: Record<Papel, { titulo: string; texto: string }[]> = {
  professor: [
    {
      titulo: 'Confira a lista da turma',
      texto: 'Na aba Alunos, compare a lista com o seu diário. Você mesmo inclui, corrige ou tira alunos: cada mudança é salva na hora e a coordenação é avisada.',
    },
    { titulo: 'Complete o que falta', texto: 'Cada aluno tem número, iniciais, sexo e ano de entrada no colégio. O que ficar em branco aparece em amarelo para completar depois.' },
    { titulo: 'Aplique a prova', texto: 'A coordenação imprime as provas. Aplique nas datas combinadas.' },
    { titulo: 'Lance as respostas', texto: 'Com as provas em ordem de número, toque em “Lançar respostas” e passe a letra que cada aluno marcou. Cada toque já fica salvo.' },
    { titulo: 'Conclua e veja os resultados', texto: 'Quando todos estiverem lançados, toque em “Concluir lançamento”. Os resultados da turma aparecem na hora.' },
  ],
  coordenacao: [
    { titulo: 'Confira as turmas do ano', texto: 'Em “Turmas e alunos”, veja se todas as turmas estão cadastradas.' },
    {
      titulo: 'Diga quem cuida de cada turma',
      texto: 'Em “Professores”, cadastre os professores e escolha o professor de cada turma. Cada professor recebe no e-mail o link para entrar no site.',
    },
    {
      titulo: 'Monte a lista de alunos',
      texto: 'Abra cada turma e inclua os alunos, um por linha: número, iniciais, sexo e ano de entrada. Os professores também podem incluir e corrigir.',
    },
    { titulo: 'Tome ciência dos avisos', texto: 'Em “Avisos”, veja o que os professores mudaram nas listas e toque em “Ciente”. Se precisar, corrija.' },
    { titulo: 'Imprima as provas', texto: 'Em “Provas”, baixe a prova de cada ano para imprimir. No 5º ano, imprima também as folhas de respostas de cada turma.' },
    { titulo: 'Acompanhe os resultados', texto: 'No Início, acompanhe o lançamento. Em “Resultados”, veja os gráficos do colégio e de cada turma.' },
  ],
  solar: [
    { titulo: 'Prepare as provas', texto: 'Em “Avaliações”, envie o PDF de cada ano e preencha o gabarito, a disciplina e a habilidade de cada questão.' },
    { titulo: 'Confira os gabaritos', texto: 'Uma segunda pessoa confere o gabarito com a prova impressa e marca “Gabarito conferido”.' },
    {
      titulo: 'Cuide dos seus colégios',
      texto: 'Em “Colégios”, cada colégio mostra quem cuida dele na Solar. Essa pessoa define quem responde pela coordenação, que recebe o link de acesso por e-mail.',
    },
    { titulo: 'Acompanhe o lançamento', texto: 'No Início, veja o que falta e os alertas de gabarito.' },
    { titulo: 'Leia os resultados', texto: 'Em “Resultados”, veja o panorama da rede, por colégio e por turma, e as questões com menos acertos.' },
  ],
}

export const PALAVRAS: { termo: string; definicao: string }[] = [
  { termo: 'Avaliação', definicao: 'A aplicação anual da Prova Solar, com uma prova para cada ano, de Português e Matemática.' },
  { termo: 'Prova', definicao: 'O papel que os alunos de um ano recebem, como a prova do 3º ano.' },
  { termo: 'Folha de respostas', definicao: 'Só no 5º ano: os alunos marcam as respostas numa folha à parte. Do 1º ao 4º ano, marcam na própria prova.' },
  { termo: 'Lançar respostas', definicao: 'Passar para o site a letra que cada aluno marcou. O site corrige sozinho.' },
  { termo: 'Em branco', definicao: 'O aluno não marcou nenhuma alternativa na questão.' },
  { termo: 'Rasurada', definicao: 'O aluno marcou mais de uma alternativa na questão.' },
  { termo: 'Prova adaptada', definicao: 'O aluno fez uma versão diferente da prova. Ele fica fora das médias.' },
  { termo: 'Acerto', definicao: 'A parte das questões que o aluno acertou, em porcentagem. Questões anuladas não contam.' },
  { termo: 'Faixa de acerto', definicao: 'Os gráficos agrupam os alunos de 20 em 20 pontos: menos de 20%, de 20% a 39%, e assim por diante, até 80% ou mais.' },
  { termo: 'Habilidade da BNCC', definicao: 'O que a questão avalia, segundo a Base Nacional Comum Curricular.' },
  { termo: 'Aluno novo', definicao: 'Quem entrou no colégio no mesmo ano da avaliação.' },
  { termo: 'Link de acesso', definicao: 'O endereço que chega por e-mail e entra direto na sua conta, sem senha. Não expira: guarde o e-mail e não o encaminhe.' },
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
  const colegio = perfil.papel !== 'solar' ? db.colegios.find((c) => c.id === perfil.colegioId) : undefined
  // Quem cuida do colégio na Solar atende primeiro; sem ninguém, a pessoa responsável pela equipe.
  const solar = (colegio && membroSolarDoColegio(db, colegio)) ?? responsavelSolar(db)
  const coordenacao = colegio ? contatoDoColegio(db, colegio.id) : null
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
