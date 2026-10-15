# Prova Solar

Site para aplicar a avaliação anual da Solar, em papel, nas escolas do Fundamental I (1º ao 5º ano). O professor lança a alternativa que cada aluno marcou, o site corrige pelo gabarito e mostra os resultados da turma, do colégio e da rede.

**Versão de teste:** sem senha e com dados fictícios.
Endereço: <https://gereneto.github.io/teste_prova/>

O visual segue o [design system da Solar Colégios](https://claude.ai/artifact/617oFotvSgGgx4a78EpVqf): paleta quente, Quicksand nos títulos, Nunito Sans no texto, botões em pílula e os logos oficiais.

## Como testar

A tela inicial pergunta que visão você quer ver. Cada perfil entra direto com uma pessoa fixa do Colégio Monte Verde, para comparar o que cada uma vê:

| Perfil | Pessoa (fictícia) |
|---|---|
| Professor(a) | Sílvia Mendes, do 3º ano A |
| Coordenação | Priscila Dias, responsável pela coordenação |
| Equipe Solar | Fernanda Martins, responsável pela equipe Solar |

Um roteiro para ver tudo em poucos minutos:

1. **Professor(a).** O Início diz o que fazer agora: “Você parou no aluno nº 12”. Toque em “Continuar de onde parei” e lance alguns alunos pelo teclado (`1` a `4` marcam e avançam, `espaço` é em branco, `X` é rasurada, `Enter` vai para o próximo aluno) ou tocando nas letras.
   - Lance um aluno todo em branco: o site pergunta se ele faltou.
   - Lance dois alunos seguidos com as mesmas respostas: o site pergunta se a mesma prova foi lançada duas vezes.
   - Conclua o lançamento e veja os resultados:
     - Resumo: em frases, o que retomar e o erro que se destaca.
     - Alunos: o mapa da turma, a ficha de cada aluno e como estes alunos foram em 2025.
     - Questões: a questão 3 tem um comentário da Solar sobre a alternativa errada.
   - Na aba Alunos, use “Falta um aluno na lista”: o aluno entra na hora, como “aguardando a coordenação”.
2. **Coordenação.** O Início lista o que precisa de atenção: pedidos de professores, uma turma sem professor, iniciais repetidas, alunos sem ano de entrada e o andamento do lançamento (sem médias e sem cobrança).
   - Em “Pedidos”, aprove a inclusão do nº 17 do 3º ano A e recuse outro pedido com um motivo.
   - Em “Resultados”, veja primeiro o que o colégio precisa retomar; as turmas ficam em “Ver por turma”, com o lembrete de cooperação. “Preparar reunião pedagógica” gera o material da reunião.
   - Em “Turmas e alunos”, abra uma turma e cole uma lista de nomes: a tela mostra como cada nome vira iniciais, e só as iniciais são guardadas.
3. **Equipe Solar.** O Início aponta o gabarito do 4º ano ainda não conferido, o alerta de gabarito suspeito na questão 12 e um colégio sem responsável.
   - Em “Resultados”, escolha o 4º ano: o quadro de pontos de melhoria mostra cada questão em cada colégio.
   - Em “Avaliações”, troque o gabarito da questão 12 do 4º ano para A. Como já há respostas lançadas, o site pede um motivo, recalcula tudo e mostra um aviso nos resultados das turmas do 4º ano.

Duas abas abertas ao mesmo tempo, cada uma num perfil, mostram uma mudança aparecendo na outra.

## Quem vê o quê

| | Professor(a) | Coordenação | Equipe Solar |
|---|---|---|---|
| Resultados | Só das próprias turmas, aluno a aluno | Todas as turmas do colégio, aluno a aluno | Todas as turmas e colégios, sem a lista de alunos |
| Média da rede | Não | Não | Sim |
| Lista de alunos | Vê e pede mudanças | Inclui, corrige, muda de turma, registra saídas e aprova pedidos | Vê só quantos são |
| Professores | Não | Cadastra, desativa e diz quem cuida de cada turma | Vê |
| Equipe | Não | A pessoa responsável inclui e tira pessoas da coordenação | A pessoa responsável define quem edita e quem só visualiza |
| Colégios e provas | Baixa a prova da turma | Baixa as provas | Quem tem edição cadastra colégios, responsáveis, provas e gabaritos |

Nesta versão de teste as regras valem só nas telas: não há login. Na versão final, cada pessoa entra com o próprio e-mail, e o servidor só entrega o que ela pode ver.

## O que esta versão faz

- **Alunos só pelas iniciais.** O aluno aparece como “Nº 7 · A.C.S.”, com o número de chamada do diário. A coordenação pode colar a lista com os nomes: a tela mostra como cada um vira iniciais e só guarda número, iniciais e ano de entrada. Números repetidos são recusados, e iniciais repetidas geram um aviso.
- **Avaliação anual.** Uma avaliação por ano, com uma prova para cada ano. Os dados de exemplo têm a de 2025 (encerrada) e a de 2026 (em lançamento).
- **Professor:**
  - Início com uma frase e um botão para o próximo passo.
  - Página da turma com as abas Lançar respostas, Resultados, Alunos e Imprimir material.
  - Lançamento com o número em destaque, aviso de iniciais repetidas, conferências automáticas e barra fixa no celular.
  - Resultados em palavras, com:
    - grupos para retomar, só em disciplinas com 3 questões ou mais;
    - acolhimento dos alunos novos;
    - mapa da turma e ficha de cada aluno;
    - resultados do ano anterior dos alunos que estão na turma agora.
  - Pedidos à coordenação (incluir aluno, registrar saída, corrigir dados): o aluno incluído já pode ter a prova lançada, mas só entra nas médias depois da aprovação.
- **Coordenação:**
  - Início com o que precisa de atenção e o andamento do lançamento, com lembrete pronto para copiar.
  - Caixa de pedidos.
  - Resultados que começam pelo que o colégio precisa retomar. As turmas aparecem sempre na mesma ordem, sem ranking, sem o nome do professor ao lado da média e com o lembrete de cooperação.
  - Material para a reunião pedagógica.
  - Professores: desativar em vez de apagar, e mais de um professor por turma.
  - Equipe da coordenação, com uma pessoa responsável.
  - Histórico de alterações de cada turma.
- **Equipe Solar:**
  - Início com o que precisa de ação: provas sem PDF, gabaritos a conferir, alertas de gabarito, colégios sem responsável e pedidos parados.
  - Andamento e cadastros de cada colégio.
  - Resultados com participação, novos e antigos, turmas em ordem fixa e pontos de melhoria (colégio x questão).
  - Análise de cada questão com alertas escritos em palavras.
  - Conferência do gabarito, motivo obrigatório para mudar a correção depois do lançamento, e comentário por alternativa, que aparece para o professor.
  - Equipe com responsável, edição e visualização.
- **Em todo o site:**
  - O mesmo vocabulário nos três perfis.
  - Letra mínima de 14 px e o botão “Letra maior”.
  - Nada escondido em dica de mouse.
  - Janelas do próprio site no lugar das confirmações do navegador.
  - O botão “Preciso de ajuda”, com os contatos e um passo a passo que dá para imprimir.

## Limitações desta versão de teste

- **Não há servidor.** Os dados ficam no navegador de quem usa. Cada pessoa começa com os mesmos dados fictícios, e o que ela muda não aparece para mais ninguém. “Restaurar dados de exemplo”, na tela inicial, volta tudo ao começo.
- **Não há login.** A entrada leva cada perfil a uma pessoa fixa.
- PDFs enviados ficam só no navegador de quem enviou.
- A exportação gera arquivos CSV, que abrem direto no Excel.

## Dados fictícios

- 5 colégios, 50 turmas, cerca de 830 alunos (só iniciais) e um professor por turma, com nomes inventados.
- A avaliação de 2025 tem todas as turmas lançadas. Os alunos de 2026 que já estavam no colégio fizeram a prova de 2025 numa turma do ano anterior.
- As datas da avaliação de 2026 são contadas a partir do dia em que os dados são criados, para a versão de teste sempre mostrar um lançamento em andamento.
- No Colégio Monte Verde há um exemplo de cada situação:
  - uma turma que ainda não começou, uma em andamento e outras concluídas;
  - uma turma sem professor;
  - iniciais repetidas e alunos sem ano de entrada;
  - pedidos de professores.
- A Escola Recanto do Saber está sem responsável pela coordenação.
- O gabarito da questão 12 da prova do 4º ano está errado de propósito, para o alerta aparecer.
- As questões 3 e 10 da prova do 3º ano têm comentários de exemplo da equipe pedagógica.

As respostas simuladas seguem um modelo em que alunos mais proficientes acertam mais. **A diferença entre alunos novos e antigos também é simulada:** os novos foram gerados com desempenho um pouco menor (cerca de 7 pontos percentuais), só para a comparação ter o que mostrar. Não é um resultado real.

## Para quem vai mexer no código

Feito com Vite, React e TypeScript. Precisa do Node.js 24 ou mais recente.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes da correção, das estatísticas, das leituras e dos dados de exemplo
npm run build    # gera a versão publicada em dist/
```

O código fica em <https://github.com/solar-colegios/prova-solar>. Cada envio para a branch `main` roda os testes e compila o site (`.github/workflows/publicar.yml`). A publicação no GitHub Pages só acontece quando o repositório é público, porque no plano gratuito do GitHub repositório privado não tem Pages. Enquanto isso, o site de teste é publicado a partir de uma cópia pública, em <https://github.com/gereneto/teste_prova>. O site definitivo vai para a Cloudflare, com domínio próprio.

| Pasta ou arquivo | O que tem |
|---|---|
| `src/pages` | As telas, por perfil (`professor`, `coordenacao`, `solar`) e as telas de turma, usadas pelos três (`turma`) |
| `src/lib/estatisticas.ts` | Correção e estatísticas |
| `src/lib/leitura.ts` | Leituras prontas: o que retomar, erro que se destaca, grupos, dificuldades comuns, quadro colégio x questão |
| `src/lib/consultas.ts` | Consultas aos dados, pessoas e permissões de cada perfil |
| `src/lib/iniciais.ts` | Conversão de nomes em iniciais e conferência de iniciais |
| `src/store` | Onde os dados são guardados e o que cada tela pode alterar. Hoje é o navegador; para ter servidor e login, basta trocar `db.ts` e `acoes.ts` |
| `src/data/seed.ts` | Gerador dos dados fictícios e das pessoas fixas da versão de teste |
| `src/data/bncc-ef1.json` | 574 habilidades da BNCC do 1º ao 5º ano |
| `src/assets/marca` | Logos e arte da marca, copiados do design system da Solar |
| `src/styles.css` | Estilos, com os tokens do design system no início |
| `scripts/` | Conversão da planilha da BNCC e geração dos PDFs de exemplo |

A lista de habilidades vem da planilha `BNCC - Habilidades.xlsx` da Solar:

```bash
python scripts/bncc_para_json.py "caminho/para/BNCC - Habilidades.xlsx"
```

O script também remove o cabeçalho de página do PDF da BNCC que veio colado no fim de 14 habilidades da planilha.

Três ajustes em relação ao design system, pensando em leitura:

- o texto secundário usa um marrom acinzentado (`#6b5b56`) no lugar do cinza da marca, que não tem contraste suficiente em letra pequena;
- as faixas de desempenho usam vermelho, âmbar, verde e azul, como nos boletins de avaliação externa;
- nenhum texto fica abaixo de 14 px, exceto os rótulos em maiúsculas.

As fontes Quicksand e Nunito Sans substituem a Hiruko Pro, como o próprio design system recomenda enquanto não houver os arquivos licenciados.
