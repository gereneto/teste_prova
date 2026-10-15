import { criarAleatorio, type Aleatorio } from '../lib/aleatorio'
import { compararTexto, hojeIso, normalizar, somarDias } from '../lib/formato'
import { iniciaisDoNome } from '../lib/iniciais'
import {
  BRANCO,
  LETRAS,
  RASURA,
  VAZIO,
  type Aluno,
  type Avaliacao,
  type Caderno,
  type Colegio,
  type Coordenador,
  type Db,
  type Evento,
  type Id,
  type Lancamento,
  type Letra,
  type MembroSolar,
  type Pedido,
  type Professor,
  type Questao,
  type RespostaAluno,
  type Serie,
  type Situacao,
  type Turma,
  type Turno,
} from '../types'
import { habilidadesDoAno } from './bncc'
import { NOMES_ADULTOS, NOMES_MENINAS, NOMES_MENINOS, SOBRENOMES } from './nomes'

/** Mude quando o formato dos dados mudar: o navegador descarta o que tinha salvo e recria os exemplos. */
export const VERSAO_DADOS = 3

const ANO_LETIVO = 2026
const ANO_ANTERIOR = 2025
const SEMENTE = 20261015

/**
 * Na versão de teste não há login: a entrada leva cada perfil direto a uma pessoa fixa.
 * As três são do mesmo colégio, para comparar o que cada uma vê.
 */
export const PESSOAS_DE_TESTE = {
  colegioId: 'col-monte-verde',
  professorId: 'prof-monte-verde-3A',
  coordenadorId: 'coord-monte-verde-1',
  membroSolarId: 'solar-1',
} as const

interface ColegioBase {
  slug: string
  nome: string
  cidade: string
  uf: string
  ddd: string
  turmasPorAno: [number, number, number, number, number]
  /** Deslocamento da proficiência média dos alunos, para os colégios não saírem todos iguais. */
  efeito: number
  /** Parte dos alunos que entrou no colégio no ano letivo. */
  novos: number
}

// 5 colégios, 50 turmas e cerca de 800 alunos, como na estimativa da primeira aplicação.
const COLEGIOS: ColegioBase[] = [
  { slug: 'monte-verde', nome: 'Colégio Monte Verde', cidade: 'Ribeirão Preto', uf: 'SP', ddd: '16', turmasPorAno: [3, 3, 3, 3, 3], efeito: 0.35, novos: 0.12 },
  { slug: 'horizonte', nome: 'Colégio Horizonte', cidade: 'Uberlândia', uf: 'MG', ddd: '34', turmasPorAno: [3, 3, 2, 2, 2], efeito: 0.15, novos: 0.15 },
  { slug: 'aurora', nome: 'Colégio Aurora', cidade: 'Londrina', uf: 'PR', ddd: '43', turmasPorAno: [2, 2, 2, 2, 2], efeito: 0, novos: 0.18 },
  { slug: 'vila-nova', nome: 'Colégio Vila Nova', cidade: 'Goiânia', uf: 'GO', ddd: '62', turmasPorAno: [2, 2, 2, 1, 1], efeito: -0.15, novos: 0.2 },
  { slug: 'recanto', nome: 'Escola Recanto do Saber', cidade: 'Feira de Santana', uf: 'BA', ddd: '75', turmasPorAno: [1, 1, 1, 1, 1], efeito: -0.3, novos: 0.24 },
]

/** Colégio que ainda não tem responsável pela coordenação, para o aviso aparecer no início da Solar. */
const COLEGIO_SEM_RESPONSAVEL = 'recanto'

function criarAvaliacoes(hoje: string): Avaliacao[] {
  return [
    { id: 'av-2025', titulo: 'Avaliação anual 2025', anoLetivo: ANO_ANTERIOR, aplicacaoInicio: '2025-11-17', aplicacaoFim: '2025-11-21', prazoLancamento: '2025-12-05' },
    // Datas contadas a partir de hoje, para a versão de teste sempre ter um lançamento em andamento.
    {
      id: 'av-2026',
      titulo: 'Avaliação anual 2026',
      anoLetivo: ANO_LETIVO,
      aplicacaoInicio: somarDias(hoje, -11),
      aplicacaoFim: somarDias(hoje, -7),
      prazoLancamento: somarDias(hoje, 16),
    },
  ]
}

const TAMANHO_PDF_EXEMPLO: Record<Serie, number> = { 1: 9_100, 2: 9_100, 3: 6_200, 4: 6_200, 5: 6_200 }

/** Disciplinas de cada questão, na ordem da prova (igual a scripts/gerar_pdfs_exemplo.py). */
export function disciplinasDoCaderno(serie: Serie): string[] {
  const porDisciplina = serie <= 2 ? 6 : 8
  return [
    ...Array<string>(porDisciplina).fill('Português'),
    ...Array<string>(porDisciplina).fill('Matemática'),
    'Ciências',
    'Ciências',
    'História',
    'Geografia',
  ]
}

/** Parâmetros usados só para simular respostas plausíveis; não vão para os dados. */
interface ItemSimulado {
  /** O que um aluno que domina a habilidade marcaria. */
  correta: Letra
  /** Do mais ao menos atraente. */
  distratores: Letra[]
  dificuldade: number
  discriminacao: number
}

type StatusSimulado = 'concluido' | 'andamento' | 'nao_iniciado'

// Situações fixas, para a demonstração ter sempre um exemplo de cada caso no colégio da versão de teste.
const STATUS_FIXO_2026: Record<Id, StatusSimulado> = {
  'tur-monte-verde-2026-1A': 'nao_iniciado',
  'tur-monte-verde-2026-2A': 'concluido',
  'tur-monte-verde-2026-3A': 'andamento',
  'tur-monte-verde-2026-4A': 'concluido',
}

// Gabarito errado de propósito, para o alerta de "gabarito suspeito" aparecer nos resultados da Solar.
const GABARITO_ERRADO = { cadernoId: 'cad-2026-4', indice: 11, gabarito: 'C' as Letra, correta: 'A' as Letra }

// Exemplos de comentário por alternativa, escritos como a equipe pedagógica escreveria ao montar a prova.
// O texto completa a frase "Quem marca esta alternativa costuma…".
const COMENTADAS: { cadernoId: Id; indice: number; habilidade: string; distrator: (gabarito: Letra) => Letra; texto: string; comoRetomar: string }[] = [
  {
    cadernoId: 'cad-2026-3',
    indice: 2,
    habilidade: 'EF35LP04',
    distrator: (g) => (g === 'B' ? 'C' : 'B'),
    texto: 'escolher a frase que está escrita no texto, sem fazer a inferência que a pergunta pede.',
    comoRetomar: 'Leia um texto curto com a turma e pergunte o que ele dá a entender sem dizer. Peça que mostrem as pistas que usaram.',
  },
  {
    cadernoId: 'cad-2026-3',
    indice: 9,
    habilidade: 'EF03MA05',
    distrator: (g) => (g === 'D' ? 'A' : 'D'),
    texto: 'ter somado sem considerar a reserva (o “vai um”).',
    comoRetomar: 'Retome a adição com reagrupamento com material dourado ou com o quadro de valor posicional, antes do algoritmo.',
  },
]

export function gerarDadosExemplo(hoje = hojeIso()): Db {
  const rng = criarAleatorio(SEMENTE)
  const avaliacoes = criarAvaliacoes(hoje)
  const aval2026 = avaliacoes.find((a) => a.anoLetivo === ANO_LETIVO)!

  const colegios: Colegio[] = []
  const coordenadores: Coordenador[] = []
  const professores: Professor[] = []
  const turmas: Turma[] = []
  const alunos: Aluno[] = []
  const pedidos: Pedido[] = []
  const historico: Evento[] = []

  // Só para a simulação: não vão para os dados.
  const nomeCompleto = new Map<Id, string>()
  const proficiencia = new Map<Id, number>()
  const efeitoTurma = new Map<Id, number>()
  const fazProvaAdaptada = new Set<Id>()
  /** Turma de 2025 de cada aluno e o número de chamada que ele tinha nela. */
  const turmaAnterior = new Map<Id, Id>()
  const numeroAnterior = new Map<Id, number>()

  const adultosUsados = new Set<string>()
  function nomeAdulto(): string {
    for (;;) {
      const nome = `${rng.escolher(NOMES_ADULTOS)} ${rng.escolher(SOBRENOMES)}`
      if (!adultosUsados.has(nome)) {
        adultosUsados.add(nome)
        return nome
      }
    }
  }
  const emailDe = (nome: string, dominio: string) => {
    const partes = normalizar(nome).split(' ')
    return `${partes[0]}.${partes.at(-1)}@${dominio}`
  }

  const equipeSolar: MembroSolar[] = (['responsavel', 'edicao', 'edicao', 'visualizacao', 'visualizacao'] as const).map((papel, i) => {
    const nome = nomeAdulto()
    return { id: `solar-${i + 1}`, nome, email: emailDe(nome, 'solar.example'), telefone: `(11) 0000-01${String(i + 1).padStart(2, '0')}`, papel }
  })
  const quemConfere = equipeSolar[1].nome

  COLEGIOS.forEach((base, i) => {
    const colegioId = `col-${base.slug}`
    const dominio = `${base.slug.replace(/-/g, '')}.example`
    const telefone = (n: number) => `(${base.ddd}) 0000-0${String(i * 10 + n).padStart(3, '0')}`
    colegios.push({ id: colegioId, nome: base.nome, cidade: base.cidade, uf: base.uf })
    if (base.slug !== COLEGIO_SEM_RESPONSAVEL) {
      coordenadores.push({ id: `coord-${base.slug}-1`, colegioId, nome: nomeAdulto(), email: `coordenacao@${dominio}`, telefone: telefone(1), responsavel: true })
    }
    if (colegioId === PESSOAS_DE_TESTE.colegioId) {
      coordenadores.push({ id: `coord-${base.slug}-2`, colegioId, nome: nomeAdulto(), email: `orientacao@${dominio}`, telefone: telefone(2), responsavel: false })
    }

    let contador = 0
    const novoAlunoId = () => `alu-${base.slug}-${String(++contador).padStart(4, '0')}`
    const letrasDoAno = (quantidade: number) => 'ABC'.slice(0, quantidade).split('')

    // Professores e turmas. Cada professor fica no mesmo ano e letra nos dois anos letivos.
    // As turmas de 2025 seguem as de 2026 do ano seguinte (a mesma turma de alunos, um ano antes).
    const turmasDe = new Map<string, Turma>()
    base.turmasPorAno.forEach((quantidade, indiceSerie) => {
      const serie = (indiceSerie + 1) as Serie
      for (const letra of letrasDoAno(quantidade)) {
        const nome = nomeAdulto()
        professores.push({ id: `prof-${base.slug}-${serie}${letra}`, colegioId, nome, email: emailDe(nome, dominio), ativo: true })
      }
    })
    for (const ano of [ANO_ANTERIOR, ANO_LETIVO]) {
      for (const serie of [1, 2, 3, 4, 5] as Serie[]) {
        const quantidade = ano === ANO_LETIVO ? base.turmasPorAno[serie - 1] : base.turmasPorAno[Math.min(serie, 4)]
        for (const [k, letra] of letrasDoAno(quantidade).entries()) {
          const id = `tur-${base.slug}-${ano}-${serie}${letra}`
          const turno: Turno = quantidade === 3 ? (k < 2 ? 'Manhã' : 'Tarde') : k === 0 ? 'Manhã' : 'Tarde'
          const turma: Turma = { id, colegioId, anoLetivo: ano, serie, nome: letra, turno, professorIds: [`prof-${base.slug}-${serie}${letra}`] }
          turmas.push(turma)
          turmasDe.set(`${ano}-${serie}${letra}`, turma)
          efeitoTurma.set(id, rng.normal(0, 0.2))
        }
      }
    }
    const turmasDoAno = (ano: number, serie: Serie) => [...turmasDe.values()].filter((t) => t.anoLetivo === ano && t.serie === serie)

    function criarAluno(turmaId: Id, nome: string, numero: number, anoIngresso: number, ativo = true): Aluno {
      const aluno: Aluno = { id: novoAlunoId(), turmaId, iniciais: iniciaisDoNome(nome), numero, anoIngresso, ativo }
      alunos.push(aluno)
      nomeCompleto.set(aluno.id, nome)
      proficiencia.set(aluno.id, base.efeito + rng.normal(0, 0.85))
      if (rng.num() < 0.012) fazProvaAdaptada.add(aluno.id)
      return aluno
    }

    // Alunos de 2026. Quem já estava no colégio em 2025 (do 2º ano em diante) fez a prova de 2025 numa turma do ano anterior.
    const de2025 = new Map<Id, Id[]>()
    for (const turma of ([1, 2, 3, 4, 5] as Serie[]).flatMap((s) => turmasDoAno(ANO_LETIVO, s))) {
      const nomes = new Set<string>()
      const total = rng.inteiro(12, 20)
      while (nomes.size < total) nomes.add(nomeCrianca(rng))
      ;[...nomes].sort(compararTexto).forEach((nome, indice) => {
        const aluno = criarAluno(turma.id, nome, indice + 1, sortearIngresso(rng, turma.serie, base.novos, ANO_LETIVO))
        if (turma.serie === 1 || aluno.anoIngresso! > ANO_ANTERIOR) return
        const opcoes = turmasDoAno(ANO_ANTERIOR, (turma.serie - 1) as Serie)
        const mesmaLetra = opcoes.find((t) => t.nome === turma.nome)
        const anterior = mesmaLetra && rng.num() < 0.75 ? mesmaLetra : rng.escolher(opcoes)
        de2025.set(anterior.id, [...(de2025.get(anterior.id) ?? []), aluno.id])
      })
    }

    // Turmas de 2025: os alunos que continuam, mais quem saiu do colégio no fim do ano e o 5º ano, que concluiu o Fundamental I.
    for (const turma of [1, 2, 3, 4, 5].flatMap((s) => turmasDoAno(ANO_ANTERIOR, s as Serie))) {
      const lista = de2025.get(turma.id) ?? []
      const quantosSaem = turma.serie === 5 ? rng.inteiro(12, 20) : rng.inteiro(0, 2)
      for (let k = 0; k < quantosSaem; k++) {
        const aluno = criarAluno(turma.id, nomeCrianca(rng), 0, sortearIngresso(rng, turma.serie, base.novos, ANO_ANTERIOR), false)
        aluno.saida = turma.serie === 5 ? { em: '2025-12-12', motivo: 'concluiu' } : { em: `2026-01-${String(rng.inteiro(10, 30))}`, motivo: rng.num() < 0.6 ? 'transferencia' : 'mudou_de_cidade' }
        lista.push(aluno.id)
      }
      ;[...lista]
        .sort((a, b) => compararTexto(nomeCompleto.get(a)!, nomeCompleto.get(b)!))
        .forEach((id, indice) => {
          turmaAnterior.set(id, turma.id)
          numeroAnterior.set(id, indice + 1)
          const aluno = alunos.find((a) => a.id === id)!
          if (!aluno.ativo) aluno.numero = indice + 1
        })
    }
  })

  const cadernos: Caderno[] = []
  const itensSimulados = new Map<Id, ItemSimulado[]>()
  for (const avaliacao of avaliacoes) {
    for (const serie of [1, 2, 3, 4, 5] as Serie[]) {
      const id = `cad-${avaliacao.anoLetivo}-${serie}`
      const disciplinas = disciplinasDoCaderno(serie)
      const gabaritos = rng.embaralhar(disciplinas.map((_, i) => LETRAS[i % 4]))
      const comentadas = COMENTADAS.filter((c) => c.cadernoId === id)
      const usadas = new Set<string>(comentadas.map((c) => c.habilidade))
      const questoes: Questao[] = disciplinas.map((disciplina, i) => {
        const fixa = comentadas.find((c) => c.indice === i)
        if (fixa) return { gabarito: gabaritos[i], disciplina, habilidade: fixa.habilidade, anulada: false }
        const candidatas = habilidadesDoAno(serie, disciplina).filter((h) => !usadas.has(h.codigo))
        const habilidade = candidatas.length ? rng.escolher(candidatas).codigo : null
        if (habilidade) usadas.add(habilidade)
        return { gabarito: gabaritos[i], disciplina, habilidade, anulada: false }
      })
      const itens: ItemSimulado[] = questoes.map((q) => ({
        correta: q.gabarito as Letra,
        distratores: rng.embaralhar(LETRAS.slice(0, 4).filter((l) => l !== q.gabarito)),
        dificuldade: rng.entre(-1.6, 1.2) + (q.disciplina === 'Matemática' ? 0.15 : 0),
        discriminacao: rng.entre(0.7, 1.7),
      }))
      for (const c of comentadas) {
        const questao = questoes[c.indice]
        const distrator = c.distrator(questao.gabarito as Letra)
        questao.comentarios = { [distrator]: c.texto }
        questao.comoRetomar = c.comoRetomar
        // A alternativa comentada é a armadilha mais atraente, e a questão fica um pouco mais difícil.
        itens[c.indice] = { ...itens[c.indice], distratores: [distrator, ...itens[c.indice].distratores.filter((l) => l !== distrator)], dificuldade: 0.4 }
      }
      if (id === GABARITO_ERRADO.cadernoId) {
        questoes[GABARITO_ERRADO.indice].gabarito = GABARITO_ERRADO.gabarito
        itens[GABARITO_ERRADO.indice] = { correta: GABARITO_ERRADO.correta, distratores: ['C', 'B', 'D'], dificuldade: -0.4, discriminacao: 1.4 }
      }
      itensSimulados.set(id, itens)

      const anterior = avaliacao.anoLetivo === ANO_ANTERIOR
      const conferida = anterior || id !== GABARITO_ERRADO.cadernoId
      cadernos.push({
        id,
        avaliacaoId: avaliacao.id,
        serie,
        numAlternativas: 4,
        usaFolhaRespostas: serie >= 3,
        questoes,
        pdf: {
          nome: `prova-exemplo-${serie}ano.pdf`,
          tamanho: TAMANHO_PDF_EXEMPLO[serie],
          origem: 'exemplo',
          url: `exemplos/caderno-exemplo-${serie}ano.pdf`,
          enviadoEm: somarDias(avaliacao.aplicacaoInicio, -21),
        },
        conferencia: conferida ? { por: anterior ? equipeSolar[0].nome : quemConfere, em: somarDias(avaliacao.aplicacaoInicio, -10) } : null,
      })
    }
  }

  const theta = (alunoId: Id, turma: Turma) => {
    const aluno = alunos.find((a) => a.id === alunoId)!
    return proficiencia.get(alunoId)! + efeitoDoTempo(turma.anoLetivo - aluno.anoIngresso! + 1) + efeitoTurma.get(turma.id)! + rng.normal(0, 0.15)
  }

  function simularLancamento(turma: Turma, lista: { id: Id; numero: number }[], status: Exclude<StatusSimulado, 'nao_iniciado'>, quando: () => string): Lancamento {
    const cadernoId = `cad-${turma.anoLetivo}-${turma.serie}`
    const itens = itensSimulados.get(cadernoId)!
    const respostas: Record<Id, RespostaAluno> = {}
    const completos = status === 'concluido' ? lista.length : Math.round(lista.length * rng.entre(0.4, 0.75))
    lista.forEach((aluno, indice) => {
      if (indice > completos) return
      let marcas = simularMarcas(rng, theta(aluno.id, turma), itens)
      // Numa turma em andamento, o último aluno ficou pela metade.
      if (indice === completos) marcas = marcas.slice(0, rng.inteiro(3, itens.length - 3)).padEnd(itens.length, VAZIO)
      const situacao: Situacao = fazProvaAdaptada.has(aluno.id) ? 'adaptada' : rng.num() < 0.04 ? 'faltou' : 'presente'
      respostas[aluno.id] = { situacao, marcas: situacao === 'presente' ? marcas : '', atualizadoEm: quando(), numero: aluno.numero }
    })
    return { id: `${cadernoId}__${turma.id}`, cadernoId, turmaId: turma.id, respostas, concluidoEm: status === 'concluido' ? quando() : null }
  }

  const lancamentos: Lancamento[] = []
  for (const turma of turmas) {
    if (turma.anoLetivo === ANO_ANTERIOR) {
      const lista = [...turmaAnterior].filter(([, t]) => t === turma.id).map(([id]) => ({ id, numero: numeroAnterior.get(id)! }))
      lista.sort((a, b) => a.numero - b.numero)
      lancamentos.push(simularLancamento(turma, lista, 'concluido', () => momentoEntre(rng, '2025-11-22', '2025-12-05')))
      continue
    }
    const status = STATUS_FIXO_2026[turma.id] ?? sortearStatus(rng)
    if (status === 'nao_iniciado') continue
    const lista = alunos.filter((a) => a.turmaId === turma.id).sort((a, b) => a.numero - b.numero)
    lancamentos.push(simularLancamento(turma, lista, status, () => momentoEntre(rng, aval2026.aplicacaoFim, somarDias(hoje, -1))))
  }

  // Situações da demonstração no colégio da versão de teste.
  const coordenacaoTeste = coordenadores.find((c) => c.id === PESSOAS_DE_TESTE.coordenadorId)!
  const evento = (em: string, texto: string, turmaId: Id | null, por = coordenacaoTeste.nome, colegioId: Id | null = PESSOAS_DE_TESTE.colegioId): Evento => ({
    id: `ev-${historico.length + 1}`,
    em,
    por,
    colegioId,
    turmaId,
    cadernoId: null,
    texto,
  })

  // Uma professora saiu do colégio: o acesso foi desativado e o 5º ano C ficou sem professor.
  const quemSaiu = professores.find((p) => p.id === 'prof-monte-verde-5C')!
  quemSaiu.ativo = false
  turmas.find((t) => t.id === 'tur-monte-verde-2026-5C')!.professorIds = []
  historico.push(evento(`${somarDias(hoje, -9)}T17:40:00`, `Desativou o acesso de ${quemSaiu.nome}, que saiu do colégio. O 5º ano C ficou sem professor.`, 'tur-monte-verde-2026-5C'))

  // Três alunos do 2º ano B ainda sem o ano de entrada no colégio.
  alunos.filter((a) => a.turmaId === 'tur-monte-verde-2026-2B').slice(0, 3).forEach((a) => (a.anoIngresso = null))

  // O professor da versão de teste pediu a inclusão de um aluno e já lançou a prova dele.
  const turmaTeste = turmas.find((t) => t.id === 'tur-monte-verde-2026-3A')!
  const daTurmaTeste = alunos.filter((a) => a.turmaId === turmaTeste.id)
  const pendente: Aluno = {
    id: 'alu-monte-verde-novo-1',
    turmaId: turmaTeste.id,
    iniciais: 'L.M.R.',
    numero: Math.max(...daTurmaTeste.map((a) => a.numero)) + 1,
    anoIngresso: ANO_LETIVO,
    ativo: true,
    pendente: true,
  }
  alunos.push(pendente)
  proficiencia.set(pendente.id, 0.1)
  const lancTeste = lancamentos.find((l) => l.turmaId === turmaTeste.id)!
  lancTeste.respostas[pendente.id] = {
    situacao: 'presente',
    marcas: simularMarcas(rng, theta(pendente.id, turmaTeste), itensSimulados.get(lancTeste.cadernoId)!),
    atualizadoEm: `${somarDias(hoje, -2)}T10:20:00`,
    numero: pendente.numero,
  }
  pedidos.push({
    id: 'ped-1',
    tipo: 'incluir',
    colegioId: PESSOAS_DE_TESTE.colegioId,
    turmaId: turmaTeste.id,
    alunoId: pendente.id,
    professorId: PESSOAS_DE_TESTE.professorId,
    criadoEm: `${somarDias(hoje, -2)}T10:12:00`,
    iniciais: pendente.iniciais,
    numero: pendente.numero,
    anoIngresso: pendente.anoIngresso,
    situacao: 'pendente',
  })

  // Um pedido já aprovado, para o professor ver a resposta da coordenação.
  const corrigido = daTurmaTeste.find((a) => a.anoIngresso! < ANO_ANTERIOR)!
  const anoAntes = corrigido.anoIngresso!
  corrigido.anoIngresso = anoAntes - 1
  pedidos.push({
    id: 'ped-2',
    tipo: 'correcao',
    colegioId: PESSOAS_DE_TESTE.colegioId,
    turmaId: turmaTeste.id,
    alunoId: corrigido.id,
    professorId: PESSOAS_DE_TESTE.professorId,
    criadoEm: `${somarDias(hoje, -16)}T08:30:00`,
    iniciais: corrigido.iniciais,
    numero: corrigido.numero,
    anoIngresso: corrigido.anoIngresso,
    situacao: 'aprovado',
    decisao: { por: coordenacaoTeste.nome, em: `${somarDias(hoje, -15)}T14:05:00` },
  })
  historico.push(
    evento(
      `${somarDias(hoje, -15)}T14:05:00`,
      `Corrigiu o ano de entrada do nº ${corrigido.numero} (${corrigido.iniciais}) de ${anoAntes} para ${corrigido.anoIngresso}, a pedido de ${professores.find((p) => p.id === PESSOAS_DE_TESTE.professorId)!.nome}.`,
      turmaTeste.id,
    ),
  )

  // Outro professor do mesmo colégio avisou que um aluno saiu; o pedido espera a coordenação há alguns dias.
  const saiu = alunos.find((a) => a.turmaId === 'tur-monte-verde-2026-1B' && a.numero === 6)!
  pedidos.push({
    id: 'ped-3',
    tipo: 'saida',
    colegioId: PESSOAS_DE_TESTE.colegioId,
    turmaId: saiu.turmaId,
    alunoId: saiu.id,
    professorId: 'prof-monte-verde-1B',
    criadoEm: `${somarDias(hoje, -5)}T16:45:00`,
    motivoSaida: 'transferencia',
    situacao: 'pendente',
  })

  // Num outro colégio, uma inclusão parada há uma semana (aparece para a Solar).
  const turmaHorizonte = turmas.find((t) => t.id === 'tur-horizonte-2026-2A')!
  const outroPendente: Aluno = {
    id: 'alu-horizonte-novo-1',
    turmaId: turmaHorizonte.id,
    iniciais: 'B.S.C.',
    numero: Math.max(...alunos.filter((a) => a.turmaId === turmaHorizonte.id).map((a) => a.numero)) + 1,
    anoIngresso: ANO_LETIVO,
    ativo: true,
    pendente: true,
  }
  alunos.push(outroPendente)
  pedidos.push({
    id: 'ped-4',
    tipo: 'incluir',
    colegioId: turmaHorizonte.colegioId,
    turmaId: turmaHorizonte.id,
    alunoId: outroPendente.id,
    professorId: 'prof-horizonte-2A',
    criadoEm: `${somarDias(hoje, -7)}T11:00:00`,
    iniciais: outroPendente.iniciais,
    numero: outroPendente.numero,
    anoIngresso: outroPendente.anoIngresso,
    situacao: 'pendente',
  })

  historico.push({
    id: `ev-${historico.length + 1}`,
    em: `${somarDias(aval2026.aplicacaoInicio, -10)}T15:00:00`,
    por: quemConfere,
    colegioId: null,
    turmaId: null,
    cadernoId: null,
    texto: 'Conferiu os gabaritos das provas do 1º, 2º, 3º e 5º ano da Avaliação anual 2026.',
  })
  historico.sort((a, b) => a.em.localeCompare(b.em))

  return {
    versao: VERSAO_DADOS,
    colegios,
    coordenadores,
    professores,
    equipeSolar,
    turmas,
    alunos,
    avaliacoes,
    cadernos,
    lancamentos,
    pedidos,
    historico,
    config: { faixas: [40, 60, 80], anoLetivo: ANO_LETIVO },
  }
}

function nomeCrianca(rng: Aleatorio): string {
  const primeiro = rng.num() < 0.5 ? rng.escolher(NOMES_MENINAS) : rng.escolher(NOMES_MENINOS)
  const sobrenome = rng.escolher(SOBRENOMES)
  if (rng.num() < 0.35) return `${primeiro} ${sobrenome}`
  let segundo = rng.escolher(SOBRENOMES)
  while (segundo === sobrenome) segundo = rng.escolher(SOBRENOMES)
  return `${primeiro} ${sobrenome} ${segundo}`
}

/**
 * Ano de entrada no colégio. Parte dos alunos é nova (entrou no ano letivo); os demais vieram da
 * Educação Infantil do próprio colégio, entraram no 1º ano ou chegaram num ano intermediário.
 */
function sortearIngresso(rng: Aleatorio, serie: Serie, taxaNovos: number, anoLetivo: number): number {
  if (rng.num() < taxaNovos) return anoLetivo
  const entradaNoPrimeiroAno = anoLetivo - (serie - 1)
  const sorteio = rng.num()
  if (serie === 1 || sorteio < 0.45) return entradaNoPrimeiroAno - rng.inteiro(1, 3)
  if (sorteio < 0.75 || entradaNoPrimeiroAno + 1 > anoLetivo - 1) return entradaNoPrimeiroAno
  return rng.inteiro(entradaNoPrimeiroAno + 1, anoLetivo - 1)
}

/**
 * Nos dados fictícios, quem está há menos tempo no colégio vai um pouco pior, para a comparação
 * entre novos e antigos ter o que mostrar. Não é um resultado real.
 */
function efeitoDoTempo(anosNoColegio: number): number {
  if (anosNoColegio <= 1) return -0.3
  if (anosNoColegio === 2) return -0.1
  return Math.min(0.15, 0.05 * (anosNoColegio - 2))
}

/** Modelo logístico simples: quanto maior a proficiência, maior a chance de acertar. */
function simularMarcas(rng: Aleatorio, theta: number, itens: ItemSimulado[]): string {
  return itens
    .map((item) => {
      const sorteio = rng.num()
      if (sorteio < 0.012) return BRANCO
      if (sorteio < 0.018) return RASURA
      const chance = 0.2 + 0.8 / (1 + Math.exp(-1.7 * item.discriminacao * (theta - item.dificuldade)))
      if (rng.num() < chance) return item.correta
      const u = rng.num()
      return item.distratores[u < 0.58 ? 0 : u < 0.86 ? 1 : 2]
    })
    .join('')
}

function sortearStatus(rng: Aleatorio): StatusSimulado {
  const sorteio = rng.num()
  return sorteio < 0.5 ? 'concluido' : sorteio < 0.8 ? 'andamento' : 'nao_iniciado'
}

/** Data e hora sorteadas entre dois dias (inclusive), num horário de trabalho. */
function momentoEntre(rng: Aleatorio, de: string, ate: string): string {
  const [a1, m1, d1] = de.split('-').map(Number)
  const [a2, m2, d2] = ate.split('-').map(Number)
  const dias = Math.max(0, Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86_400_000))
  const dia = somarDias(de, rng.inteiro(0, dias))
  const hora = String(rng.inteiro(8, 21)).padStart(2, '0')
  const minuto = String(rng.inteiro(0, 59)).padStart(2, '0')
  return `${dia}T${hora}:${minuto}:00`
}
