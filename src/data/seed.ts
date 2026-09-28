import { criarAleatorio, type Aleatorio } from '../lib/aleatorio'
import { compararTexto, normalizar } from '../lib/formato'
import {
  BRANCO,
  LETRAS,
  RASURA,
  VAZIO,
  type Aluno,
  type Avaliacao,
  type Caderno,
  type Colegio,
  type Db,
  type Id,
  type Lancamento,
  type Letra,
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
export const VERSAO_DADOS = 2

const ANO_LETIVO = 2026
const SEMENTE = 20260928

interface ColegioBase {
  slug: string
  nome: string
  cidade: string
  uf: string
  ddd: string
  turmasPorAno: [number, number, number, number, number]
  /** Deslocamento da proficiência média dos alunos, para os colégios não saírem todos iguais. */
  efeito: number
  /** Parte dos alunos que entrou no colégio neste ano letivo. */
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

const AVALIACOES: Avaliacao[] = [
  { id: 'av-2026-2bim', titulo: 'Avaliação diagnóstica — 2º bimestre', anoLetivo: ANO_LETIVO, aplicacaoInicio: '2026-06-15', aplicacaoFim: '2026-06-19', prazoLancamento: '2026-06-26' },
  { id: 'av-2026-3bim', titulo: 'Avaliação diagnóstica — 3º bimestre', anoLetivo: ANO_LETIVO, aplicacaoInicio: '2026-09-21', aplicacaoFim: '2026-09-25', prazoLancamento: '2026-10-02' },
  { id: 'av-2026-4bim', titulo: 'Avaliação diagnóstica — 4º bimestre', anoLetivo: ANO_LETIVO, aplicacaoInicio: '2026-11-23', aplicacaoFim: '2026-11-27', prazoLancamento: '2026-12-04' },
]

const PDF_ENVIADO_EM: Record<Id, string> = {
  'av-2026-2bim': '2026-06-08',
  'av-2026-3bim': '2026-09-14',
  'av-2026-4bim': '2026-11-16',
}

const TAMANHO_PDF_EXEMPLO: Record<Serie, number> = { 1: 9_100, 2: 9_100, 3: 6_200, 4: 6_200, 5: 6_200 }

/** Disciplinas de cada questão, na ordem do caderno (igual a scripts/gerar_pdfs_exemplo.py). */
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

// Situações fixas, para a demonstração ter sempre um exemplo de cada caso no primeiro colégio.
const STATUS_FIXO_3BIM: Record<Id, StatusSimulado> = {
  'tur-monte-verde-1A': 'nao_iniciado',
  'tur-monte-verde-3A': 'andamento',
  'tur-monte-verde-4A': 'concluido',
}

// Gabarito errado de propósito, para o alerta de "gabarito suspeito" aparecer nas estatísticas da Solar.
const GABARITO_ERRADO = { cadernoId: 'cad-2026-3bim-4', indice: 11, gabarito: 'C' as Letra, correta: 'A' as Letra }

export function gerarDadosExemplo(): Db {
  const rng = criarAleatorio(SEMENTE)
  const colegios: Colegio[] = []
  const professores: Professor[] = []
  const turmas: Turma[] = []
  const alunos: Aluno[] = []
  const proficiencia = new Map<Id, number>()
  const fazProvaAdaptada = new Set<Id>()
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

  COLEGIOS.forEach((base, i) => {
    const colegioId = `col-${base.slug}`
    const dominio = `${base.slug.replace(/-/g, '')}.example`
    colegios.push({
      id: colegioId,
      nome: base.nome,
      cidade: base.cidade,
      uf: base.uf,
      coordenacao: { nome: nomeAdulto(), email: `coordenacao@${dominio}`, telefone: `(${base.ddd}) 0000-000${i + 1}` },
    })

    base.turmasPorAno.forEach((quantidade, indiceSerie) => {
      const serie = (indiceSerie + 1) as Serie
      for (let k = 0; k < quantidade; k++) {
        const letra = 'ABC'[k]
        const sufixo = `${base.slug}-${serie}${letra}`
        const nomeProfessor = nomeAdulto()
        const partes = normalizar(nomeProfessor).split(' ')
        professores.push({
          id: `prof-${sufixo}`,
          colegioId,
          nome: nomeProfessor,
          email: `${partes[0]}.${partes.at(-1)}@${dominio}`,
        })
        const turno: Turno = quantidade === 3 ? (k < 2 ? 'Manhã' : 'Tarde') : k === 0 ? 'Manhã' : 'Tarde'
        turmas.push({ id: `tur-${sufixo}`, colegioId, anoLetivo: ANO_LETIVO, serie, nome: letra, turno, professorIds: [`prof-${sufixo}`] })

        const efeitoTurma = rng.normal(0, 0.2)
        const nomes = new Set<string>()
        const total = rng.inteiro(12, 20)
        while (nomes.size < total) nomes.add(nomeCrianca(rng))
        ;[...nomes].sort(compararTexto).forEach((nome, indice) => {
          const id = `alu-${sufixo}-${String(indice + 1).padStart(2, '0')}`
          const anoIngresso = sortearIngresso(rng, serie, base.novos)
          alunos.push({ id, turmaId: `tur-${sufixo}`, nome, numero: indice + 1, anoIngresso, ativo: true })
          const efeitoTempo = efeitoDoTempo(ANO_LETIVO - anoIngresso + 1)
          proficiencia.set(id, base.efeito + efeitoTurma + efeitoTempo + rng.normal(0, 0.85))
          if (rng.num() < 0.012) fazProvaAdaptada.add(id)
        })
      }
    })
  })

  const cadernos: Caderno[] = []
  const itensSimulados = new Map<Id, ItemSimulado[]>()
  for (const avaliacao of AVALIACOES) {
    for (const serie of [1, 2, 3, 4, 5] as Serie[]) {
      const id = `cad-${avaliacao.id.slice(3)}-${serie}`
      const disciplinas = disciplinasDoCaderno(serie)
      const gabaritos = rng.embaralhar(disciplinas.map((_, i) => LETRAS[i % 4]))
      const usadas = new Set<string>()
      const questoes: Questao[] = disciplinas.map((disciplina, i) => {
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
      if (id === GABARITO_ERRADO.cadernoId) {
        questoes[GABARITO_ERRADO.indice].gabarito = GABARITO_ERRADO.gabarito
        itens[GABARITO_ERRADO.indice] = { correta: GABARITO_ERRADO.correta, distratores: ['C', 'B', 'D'], dificuldade: -0.4, discriminacao: 1.4 }
      }
      itensSimulados.set(id, itens)

      // O 4º bimestre ainda está em preparação: faltam PDFs e um gabarito.
      const emPreparo = avaliacao.id === 'av-2026-4bim'
      if (emPreparo && serie === 5) questoes.forEach((q) => (q.gabarito = null))
      cadernos.push({
        id,
        avaliacaoId: avaliacao.id,
        serie,
        numAlternativas: 4,
        usaFolhaRespostas: serie >= 3,
        questoes,
        pdf:
          emPreparo && serie >= 4
            ? null
            : {
                nome: `caderno-exemplo-${serie}ano.pdf`,
                tamanho: TAMANHO_PDF_EXEMPLO[serie],
                origem: 'exemplo',
                url: `exemplos/caderno-exemplo-${serie}ano.pdf`,
                enviadoEm: PDF_ENVIADO_EM[avaliacao.id],
              },
      })
    }
  }

  function simularLancamento(turma: Turma, lista: Aluno[], cadernoId: Id, status: Exclude<StatusSimulado, 'nao_iniciado'>, crescimento: number, quando: () => string): Lancamento {
    const itens = itensSimulados.get(cadernoId)!
    const respostas: Record<Id, RespostaAluno> = {}
    const completos = status === 'concluido' ? lista.length : Math.round(lista.length * rng.entre(0.3, 0.8))
    lista.forEach((aluno, indice) => {
      if (indice > completos) return
      const theta = proficiencia.get(aluno.id)! + crescimento + rng.normal(0, 0.15)
      let marcas = simularMarcas(rng, theta, itens)
      // Numa turma em andamento, o último aluno ficou pela metade.
      if (indice === completos) marcas = marcas.slice(0, rng.inteiro(3, itens.length - 3)).padEnd(itens.length, VAZIO)
      const situacao: Situacao = fazProvaAdaptada.has(aluno.id) ? 'adaptada' : rng.num() < 0.04 ? 'faltou' : 'presente'
      respostas[aluno.id] = { situacao, marcas: situacao === 'presente' ? marcas : '', atualizadoEm: quando() }
    })
    return {
      id: `${cadernoId}__${turma.id}`,
      cadernoId,
      turmaId: turma.id,
      respostas,
      concluidoEm: status === 'concluido' ? quando() : null,
    }
  }

  const alunosPorTurma = new Map<Id, Aluno[]>()
  for (const aluno of alunos) alunosPorTurma.set(aluno.turmaId, [...(alunosPorTurma.get(aluno.turmaId) ?? []), aluno])

  const lancamentos: Lancamento[] = []
  for (const turma of turmas) {
    const lista = alunosPorTurma.get(turma.id) ?? []
    lancamentos.push(simularLancamento(turma, lista, `cad-2026-2bim-${turma.serie}`, 'concluido', 0, () => momento(rng, '2026-06', 19, 26)))
    const status = STATUS_FIXO_3BIM[turma.id] ?? sortearStatus(rng)
    if (status !== 'nao_iniciado') {
      lancamentos.push(simularLancamento(turma, lista, `cad-2026-3bim-${turma.serie}`, status, 0.12, () => momento(rng, '2026-09', 25, 28)))
    }
  }

  return {
    versao: VERSAO_DADOS,
    colegios,
    professores,
    turmas,
    alunos,
    avaliacoes: AVALIACOES.map((avaliacao) => ({ ...avaliacao })),
    cadernos,
    lancamentos,
    config: { faixas: [40, 60, 80] },
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
 * Ano de entrada no colégio. Parte dos alunos é nova (entrou neste ano letivo); os demais vieram da
 * Educação Infantil do próprio colégio, entraram no 1º ano ou chegaram num ano intermediário.
 */
function sortearIngresso(rng: Aleatorio, serie: Serie, taxaNovos: number): number {
  if (rng.num() < taxaNovos) return ANO_LETIVO
  const entradaNoPrimeiroAno = ANO_LETIVO - (serie - 1)
  const sorteio = rng.num()
  if (serie === 1 || sorteio < 0.45) return entradaNoPrimeiroAno - rng.inteiro(1, 3)
  if (sorteio < 0.75 || entradaNoPrimeiroAno + 1 > ANO_LETIVO - 1) return entradaNoPrimeiroAno
  return rng.inteiro(entradaNoPrimeiroAno + 1, ANO_LETIVO - 1)
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
  return sorteio < 0.56 ? 'concluido' : sorteio < 0.8 ? 'andamento' : 'nao_iniciado'
}

function momento(rng: Aleatorio, anoMes: string, diaMin: number, diaMax: number): string {
  const dia = String(rng.inteiro(diaMin, diaMax)).padStart(2, '0')
  const hora = String(rng.inteiro(8, 21)).padStart(2, '0')
  const minuto = String(rng.inteiro(0, 59)).padStart(2, '0')
  return `${anoMes}-${dia}T${hora}:${minuto}:00`
}
