# Prova Solar

Site para aplicar a avaliação anual da Solar, em papel, nas escolas do Fundamental I (1º ao 5º ano). A prova tem Português e Matemática. O professor lança a alternativa que cada aluno marcou, o site corrige pelo gabarito e mostra os resultados da turma, do colégio e da rede.

**Versão de teste:** sem senha, com dados fictícios e e-mails simulados.
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
   - Conclua o lançamento e veja os resultados em gráficos: alunos por faixa de acerto, acerto por disciplina e por questão, novos e antigos, meninas e meninos.
   - Na aba Alunos, preencha a última linha para incluir um aluno: número de chamada (pode ter letras), iniciais (o site passa para maiúsculas), sexo e ano de entrada. Dá para deixar casas em branco: elas ficam em amarelo até alguém completar. A mudança vale na hora, e a coordenação recebe um aviso.
2. **Coordenação.** O Início lista o que precisa de atenção: avisos de professores, uma turma sem professor, turmas com dados faltando e o andamento do lançamento (sem médias e sem cobrança).
   - Em “Avisos”, veja o que os professores mudaram nas listas e toque em “Ciente”. Não é preciso aprovar nada; se quiser, corrija na turma.
   - Em “Provas”, baixe a prova de cada ano para imprimir. Só a coordenação tem esta aba. No 5º ano, imprima também as folhas de respostas de cada turma, que já saem com o número e as iniciais de cada aluno.
   - Em “Professores”, cadastre um professor: o site manda para o e-mail dele um link de acesso. Corrija o e-mail e um link novo é enviado; o antigo para de valer.
   - Em “Resultados”, veja os gráficos do colégio. As turmas ficam em “Ver por turma”, com o lembrete de cooperação.
3. **Equipe Solar.** O Início aponta o gabarito do 4º ano ainda não conferido, o alerta de gabarito suspeito na questão 12 e um colégio sem responsável.
   - Em “Colégios”, cada colégio mostra quem cuida dele na Solar. Essa pessoa (ou a responsável pela equipe Solar) define quem responde pela coordenação: torna responsável qualquer pessoa da coordenação do colégio, ou cadastra uma nova, que recebe o link de acesso por e-mail. A coordenação não passa a responsabilidade.
   - Em “Resultados”, escolha o 4º ano: o quadro de pontos de melhoria mostra cada questão em cada colégio.
   - Em “Avaliações”, troque o gabarito da questão 12 do 4º ano para A. Como já há respostas lançadas, o site pede um motivo, recalcula tudo e mostra um aviso nos resultados das turmas do 4º ano.
4. **E-mails enviados.** Nesta versão os e-mails não saem de verdade: ficam na página “E-mails enviados” (link no rodapé da tela inicial). Abra o link de um e-mail para entrar direto na conta da pessoa.

Duas abas abertas ao mesmo tempo, cada uma num perfil, mostram uma mudança aparecendo na outra.

## Quem vê o quê

| | Professor(a) | Coordenação | Equipe Solar |
|---|---|---|---|
| Resultados | Só das próprias turmas (inclusive de anos anteriores), aluno a aluno | Todas as turmas do colégio, aluno a aluno | Por turma e por colégio, sem a lista de alunos |
| Média da rede | Não | Não | Sim |
| Lista de alunos | Inclui, corrige e tira alunos da própria turma; a coordenação é avisada | Faz tudo o que o professor faz, em todas as turmas, e muda alunos de turma; toma ciência dos avisos | Vê só quantos são |
| Provas | Não imprime | Baixa e imprime todas as provas; folhas de respostas do 5º ano | Envia os PDFs e cuida dos gabaritos |
| Professores | Não | Cadastra (o link vai por e-mail), desativa e diz quem cuida de cada turma | Vê |
| Equipe | Não | A pessoa responsável (escolhida pela Solar) inclui e tira pessoas da coordenação | A pessoa responsável define quem edita e quem só visualiza |
| Colégios | Não | Não | Cada colégio fica com uma pessoa da Solar, que escolhe a pessoa responsável pela coordenação entre a equipe do colégio, ou cadastra uma nova |

Nesta versão de teste as regras valem só nas telas. Na versão final, o servidor só entrega o que cada pessoa pode ver.

## Links de acesso

Ninguém precisa de senha. Cada pessoa recebe por e-mail um link pessoal que entra direto na conta dela:

- o professor, quando a coordenação o cadastra;
- a pessoa da coordenação, quando a Solar a define como responsável ou quando a responsável a inclui na equipe;
- a pessoa da Solar, quando a responsável pela equipe a inclui.

O link não expira. Se o e-mail de alguém for corrigido, o site manda um link novo para o endereço certo, e o antigo deixa de valer. Ao lado de cada pessoa há o botão “Reenviar link”, para quem perdeu o e-mail. O endereço tem a forma `…/#/entrar/<código>`; os links das pessoas dos dados de exemplo funcionam em qualquer navegador.

Nesta versão os e-mails não são enviados: eles ficam guardados e aparecem em “E-mails enviados”.

## O que esta versão faz

- **Alunos só pelas iniciais.** O aluno aparece como “Nº 7 · ACS” (iniciais só com as letras, sem pontos), com o número de chamada do colégio, que pode ter letras. Cada aluno tem ainda sexo e ano de entrada no colégio. Casas em branco são aceitas e lembradas depois; números repetidos e iniciais repetidas geram um aviso.
- **Avaliação anual de Português e Matemática.** Uma avaliação por ano, com uma prova para cada ano: 16 questões no 1º e no 2º ano, 20 do 3º ao 5º. Só o 5º ano usa folha de respostas. Os dados de exemplo têm a de 2025 (encerrada) e a de 2026 (em lançamento).
- **Resultados em gráficos.** Alunos por faixa de acerto (menos de 20%, 20% a 39%, 40% a 59%, 60% a 79%, 80% ou mais), acerto por disciplina, por questão, por ano e por colégio, e a comparação entre novos e antigos e entre meninas e meninos. As cores vão do vermelho (menos acertos) ao azul (mais acertos).
- **Professor:**
  - Início com uma frase e um botão para o próximo passo, e o lembrete de dados faltando na turma.
  - Página da turma com as abas Lançar respostas, Resultados e Alunos.
  - Lançamento com o número em destaque, aviso de iniciais repetidas, conferências automáticas e barra fixa no celular.
  - Resultados com mapa da turma, ficha de cada aluno e os resultados do ano anterior dos alunos que estão na turma agora.
  - Lista de alunos em que cada linha é um aluno, como no lançamento.
- **Coordenação:**
  - Início com o que precisa de atenção e o andamento do lançamento, com lembrete pronto para copiar.
  - Avisos das mudanças feitas pelos professores, com “Ciente” e “Marcar todos como vistos”.
  - Provas de todos os anos para baixar, e folhas de respostas do 5º ano por turma.
  - Resultados do colégio; as turmas aparecem sempre na mesma ordem, sem ranking e com o lembrete de cooperação.
  - Professores: desativar em vez de apagar, e mais de um professor por turma.
  - Equipe da coordenação, com uma pessoa responsável.
  - Histórico de alterações de cada turma.
- **Equipe Solar:**
  - Início com o que precisa de ação: provas sem PDF, gabaritos a conferir, alertas de gabarito e colégios sem responsável.
  - Colégios, cada um aos cuidados de uma pessoa da Solar, com o andamento e os cadastros.
  - Resultados com participação, turmas em ordem fixa e pontos de melhoria (colégio x questão).
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
- **Os e-mails não saem.** Ficam em “E-mails enviados”.
- PDFs enviados ficam só no navegador de quem enviou.
- A exportação gera arquivos CSV, que abrem direto no Excel.

## Dados fictícios

- 5 colégios, 50 turmas, cerca de 830 alunos (só iniciais) e um professor por turma, com nomes inventados.
- A avaliação de 2025 tem todas as turmas lançadas. Os alunos de 2026 que já estavam no colégio fizeram a prova de 2025 numa turma do ano anterior.
- As datas da avaliação de 2026 são contadas a partir do dia em que os dados são criados, para a versão de teste sempre mostrar um lançamento em andamento.
- No Colégio Monte Verde há um exemplo de cada situação:
  - uma turma que ainda não começou, uma em andamento e outras concluídas;
  - uma turma sem professor;
  - alunos sem ano de entrada (2º ano B), sem sexo (1º ano C) e sem número (4º ano B);
  - avisos de professores: a inclusão do nº 17 no 3º ano A e uma saída no 1º ano B, ainda não vistos, e uma correção que a coordenação já viu.
- A Escola Recanto do Saber está sem responsável pela coordenação.
- O gabarito da questão 12 da prova do 4º ano está errado de propósito, para o alerta aparecer.
- As questões 3 e 12 da prova do 3º ano têm comentários de exemplo da equipe pedagógica.

As respostas simuladas seguem um modelo em que alunos mais proficientes acertam mais. **A diferença entre alunos novos e antigos também é simulada:** os novos foram gerados com desempenho um pouco menor (cerca de 7 pontos percentuais), só para a comparação ter o que mostrar. Não é um resultado real.

## Para quem vai mexer no código

Feito com Vite, React e TypeScript. Precisa do Node.js 24 ou mais recente.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes da correção, das estatísticas, da lista de alunos, dos links de acesso e dos dados de exemplo
npm run build    # gera a versão publicada em dist/
```

O código fica em <https://github.com/solar-colegios/prova-solar>. Cada envio para a branch `main` roda os testes, compila o site e publica no GitHub Pages (`.github/workflows/publicar.yml`), em <https://solar-colegios.github.io/prova-solar/>. Para isso, o Pages do repositório precisa estar com a origem “GitHub Actions” (Settings › Pages › Build and deployment). A cópia pública <https://github.com/gereneto/teste_prova> publica o mesmo site em <https://gereneto.github.io/teste_prova/>. O site definitivo é publicado pela Cloudflare em <https://plataformasolar.org.br/prova/>: a cada envio para a `main`, o Workers Builds roda `npm run build:plataforma` (saída em `dist-plataforma/prova/`) e `npx wrangler deploy` (`wrangler.jsonc`).

| Pasta ou arquivo | O que tem |
|---|---|
| `src/pages` | As telas, por perfil (`professor`, `coordenacao`, `solar`) e as telas de turma, usadas pelos três (`turma`) |
| `src/lib/estatisticas.ts` | Correção e estatísticas |
| `src/lib/leitura.ts` | Comentários das questões e quadro colégio x questão |
| `src/lib/alunos.ts` | Ordem da chamada, dados faltando e o texto de cada mudança na lista de alunos |
| `src/lib/consultas.ts` | Consultas aos dados, pessoas e permissões de cada perfil |
| `src/lib/iniciais.ts` | Formato das iniciais (maiúsculas com ponto) e conferência de iniciais repetidas |
| `src/store` | Onde os dados ficam e o que cada tela pode alterar: na demonstração, no navegador; na plataforma, as mesmas ações também vão ao banco, pela ponte de `src/plataforma` |
| `src/plataforma` | Só na versão da plataforma (abaixo): sessão, carga do banco, funções do banco, fila do lançamento, entrada |
| `src/data/seed.ts` | Gerador dos dados fictícios e das pessoas fixas da versão de teste |
| `src/data/bncc-ef1.json` | 574 habilidades da BNCC do 1º ao 5º ano |
| `src/assets/marca` | Logos e arte da marca, copiados do design system da Solar |
| `src/styles.css` | Estilos, com os tokens do design system no início |
| `scripts/` | Conversão da planilha da BNCC e geração dos PDFs de exemplo |

### A versão da plataforma (`npm run build:plataforma`)

O mesmo código compila com o banco de verdade (Supabase, schema `prova` do repositório `plataforma-infra`) quando o modo do Vite é `plataforma` (`src/plataforma/modo.ts`, constante `PLATAFORMA`). As telas não mudam: `store/db.ts` e `store/acoes.ts` mudam os dados na hora e, na plataforma, mandam cada mudança ao banco pela ponte (`plataforma/ponte.ts`), uma função de cada vez e na ordem; depois, a carga do banco (`prova.carregar`) substitui tudo. Erro do banco aparece num aviso no canto da tela. A demonstração não leva o `supabase-js` no pacote (o `main.tsx` só importa a plataforma quando o modo é `plataforma`).

| Arquivo | O que faz |
|---|---|
| `plataforma/sessao.ts` | A sessão comum da Plataforma Solar, cópia em TypeScript do `solar-sessao.js` do hub (contrato v1, mesmos casos de teste em `sessao.test.ts`). O ambiente sai do endereço: `plataformasolar.org.br` usa a produção; `*.site-institucional-c24.workers.dev`, o banco de teste; `localhost`, o Supabase local |
| `plataforma/Portao.tsx` | Confere a sessão e carrega os dados antes das telas. Sem sessão: na produção, vai para `/entrar/?voltar=/prova/` do hub; no teste, mostra `EntrarTeste.tsx` (e-mail e código, porque o preview de uma branch não tem o hub) |
| `plataforma/EntradaPlataforma.tsx` | Quem tem mais de um papel escolhe com qual entrar; com um só, entra direto |
| `plataforma/servidor.ts` | As funções do banco (RPC), os convites (pela função `acesso`), os PDFs (bucket `provas`, baixados por URL assinada) e a carga |
| `plataforma/carga.ts` | Converte o que o banco devolve para o formato das telas (`Db`) |
| `plataforma/fila.ts` | O lançamento: cada aluno fica no IndexedDB (`prova:fila`) até o banco confirmar; sem internet, a tela avisa e envia quando a internet volta |

Tudo o que a plataforma guarda no navegador leva o prefixo `prova:` (`chave()` em `modo.ts`); a demonstração continua com `prova-solar:`. A entrada por perfil, os links de acesso e “E-mails enviados” existem só na demonstração. A Solar recebe os números da rede já somados por turma (`prova.painel_rede`), nunca aluno a aluno.

Para experimentar a plataforma no ambiente de teste: cada branch vira um preview em `https://<branch>-prova-solar.site-institucional-c24.workers.dev/prova/`, com o banco de teste. Pessoas de teste usam e-mails terminados em `.test` e entram com o código do workflow **Código de teste** do `plataforma-infra`. O workflow **Ensaio da Prova** do mesmo repositório percorre as telas sozinho num navegador (Solar, coordenação e professora: cadastros, lançamento com um aluno sem internet e resultados) e guarda as telas de cada passo.

A lista de habilidades vem da planilha `BNCC - Habilidades.xlsx` da Solar:

```bash
python scripts/bncc_para_json.py "caminho/para/BNCC - Habilidades.xlsx"
```

O script também remove o cabeçalho de página do PDF da BNCC que veio colado no fim de 14 habilidades da planilha.

Três ajustes em relação ao design system, pensando em leitura:

- o texto secundário usa um marrom acinzentado (`#6b5b56`) no lugar do cinza da marca, que não tem contraste suficiente em letra pequena;
- as faixas de acerto vão do vermelho ao azul, passando por laranja, âmbar e verde;
- nenhum texto fica abaixo de 14 px, exceto os rótulos em maiúsculas.

As fontes Quicksand e Nunito Sans substituem a Hiruko Pro, como o próprio design system recomenda enquanto não houver os arquivos licenciados.
