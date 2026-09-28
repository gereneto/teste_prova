# Prova Solar

Site para aplicar as provas em papel da Solar nas escolas do Fundamental I (1º ao 5º ano). O professor lança a alternativa que cada aluno marcou, o site corrige pelo gabarito e mostra os resultados da turma, do colégio e da rede.

**Versão de teste:** sem senha e com dados fictícios.
Endereço: <https://gereneto.github.io/teste_prova/>

## Como testar

Ao abrir o site, escolha quem você é: professor(a), coordenação ou equipe Solar. Professores e coordenações também escolhem o colégio; na versão final, isso virá do login.

Um roteiro para ver tudo em poucos minutos:

1. **Professor(a).** Colégio Monte Verde, Priscila Ferreira (1º ano A), “Avaliação diagnóstica — 3º bimestre”, “Lançar respostas”. Lance alguns alunos pelo teclado: `A` `B` `C` `D` (ou `1` a `4`) marcam e avançam, `espaço` é em branco, `X` é rasurada, `Backspace` volta uma questão e `Enter` vai para o próximo aluno. No fim, conclua o lançamento e veja os resultados da turma.
2. **Coordenação.** No painel, o andamento de cada turma. Em “Turmas e alunos”, abra uma turma e use “Adicionar alunos” para colar uma lista de nomes.
3. **Equipe Solar.** Em “Estatísticas”, escolha a avaliação do 3º bimestre e o 4º ano: a questão 12 aparece com o alerta de **gabarito suspeito**, porque o gabarito dela está errado de propósito. Clique em “Editar gabarito”, troque a resposta da questão 12 para A e volte às estatísticas: os resultados de todas as turmas são recalculados na hora.

Duas abas abertas ao mesmo tempo, uma como professor e outra como Solar, mostram o lançamento aparecendo nas estatísticas.

## O que esta versão faz

- **Lançamento rápido:** um aluno por vez, na ordem da chamada, com botões grandes no celular e atalhos de teclado no computador. Cada marcação é salva na hora. Há marcações para aluno que faltou, prova adaptada (fica fora das médias), questão em branco e rasurada. O site não deixa passar para o próximo aluno com questão vazia.
- **Correção automática:** o professor só copia a letra marcada. Se a Solar corrige um gabarito ou anula uma questão, tudo é recalculado.
- **Resultados da turma:** média, faixas de desempenho, alunos que precisam de atenção, acerto por disciplina, por questão (com a alternativa errada mais marcada) e por habilidade da BNCC. Exportação para planilha.
- **Painel da coordenação:** andamento do lançamento por turma, médias e comparação das turmas por disciplina. Cadastro de turmas, professores e alunos (colando a lista de uma planilha).
- **Painel e estatísticas da Solar:** andamento por colégio, pendências das provas, médias por colégio, ano, turma, disciplina e habilidade, análise de cada questão com alertas (gabarito suspeito, muito difícil, muito fácil) e exportação para Excel. A Solar vê só números agregados, sem nomes de alunos.
- **Provas:** cada avaliação tem um caderno por ano, com PDF para as escolas baixarem, gabarito (inclusive colando a sequência de letras), disciplina e habilidade da BNCC de cada questão, número de questões e de alternativas.
- **Folhas de respostas:** para o 3º ao 5º ano, uma folha por aluno já com nome e número, pronta para imprimir em A4. As marcas nos cantos preparam a leitura por foto numa versão futura.

## Limitações desta versão de teste

- **Não há servidor.** Os dados ficam no navegador de quem usa. Cada pessoa começa com os mesmos dados fictícios, e o que ela muda não aparece para mais ninguém. “Restaurar dados de exemplo”, na tela inicial, volta tudo ao começo.
- **Não há login.** Qualquer pessoa escolhe qualquer perfil.
- A exportação gera arquivos CSV, que abrem direto no Excel.

## Dados fictícios

5 colégios, 50 turmas, cerca de 800 alunos e um professor por turma, com nomes inventados. São três avaliações:

- 2º bimestre: aplicada e com todas as turmas lançadas;
- 3º bimestre: em lançamento, com turmas concluídas, em andamento e não iniciadas;
- 4º bimestre: agendada, com PDFs e um gabarito ainda pendentes.

As respostas simuladas seguem um modelo em que alunos mais proficientes acertam mais, então as estatísticas se comportam como numa prova de verdade.

## Para quem vai mexer no código

Feito com Vite, React e TypeScript. Precisa do Node.js 24 ou mais recente.

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes da correção, das estatísticas e dos dados de exemplo
npm run build    # gera a versão publicada em dist/
```

Cada envio para a branch `main` testa, compila e publica o site no GitHub Pages (`.github/workflows/publicar.yml`).

| Pasta | O que tem |
|---|---|
| `src/pages` | As telas, separadas por perfil (`professor`, `coordenacao`, `solar`) e as telas de turma usadas por professor e coordenação (`turma`) |
| `src/lib/estatisticas.ts` | Correção e todas as estatísticas |
| `src/store` | Onde os dados são guardados. Hoje é o navegador; para ter servidor e login, basta trocar `db.ts` e `acoes.ts` |
| `src/data/seed.ts` | Gerador dos dados fictícios |
| `src/data/bncc-ef1.json` | 574 habilidades da BNCC do 1º ao 5º ano |
| `scripts/` | Conversão da planilha da BNCC e geração dos PDFs de exemplo |

A lista de habilidades vem da planilha `BNCC - Habilidades.xlsx` da Solar:

```bash
python scripts/bncc_para_json.py "caminho/para/BNCC - Habilidades.xlsx"
```

O script também remove o cabeçalho de página do PDF da BNCC que veio colado no fim de 14 habilidades da planilha.
