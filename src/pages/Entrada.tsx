import { ArrowRight, Building2, ClipboardList, Mail, RotateCcw, Users, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import logoBranco from '../assets/marca/logo-solar-branco.png'
import { INICIO_DO_PAPEL } from '../components/Layout'
import { Confirmacao } from '../components/ui'
import { pessoaDoPerfil, turmasDoProfessor } from '../lib/consultas'
import { listaEmTexto, turmaNome } from '../lib/formato'
import { perfilDeTeste, pessoasDeTeste } from '../lib/teste'
import { restaurarDadosDeExemplo } from '../store/acoes'
import { useDb } from '../store/db'
import { definirPerfil, usePerfil } from '../store/perfil'
import type { Perfil } from '../types'

type Papel = Perfil['papel']

const OPCOES: { papel: Papel; titulo: string; texto: string; Icone: LucideIcon }[] = [
  {
    papel: 'professor',
    titulo: 'Professor(a)',
    texto: 'Lança as respostas da turma, cuida da lista de alunos e vê os resultados só da própria turma.',
    Icone: ClipboardList,
  },
  {
    papel: 'coordenacao',
    titulo: 'Coordenação',
    texto: 'Cuida das turmas, dos professores e dos alunos, imprime as provas e vê os resultados de todas as turmas do colégio.',
    Icone: Users,
  },
  {
    papel: 'solar',
    titulo: 'Equipe Solar',
    texto: 'Prepara as provas, cadastra os colégios e vê os resultados de toda a rede, por turma e por colégio.',
    Icone: Building2,
  },
]

export default function Entrada() {
  const db = useDb()
  const perfilAtual = usePerfil()
  const navigate = useNavigate()
  const [confirmando, setConfirmando] = useState(false)
  const pessoas = pessoasDeTeste(db)
  const pessoaAtual = perfilAtual ? pessoaDoPerfil(db, perfilAtual) : null

  const quemEntra: Record<Papel, string | null> = {
    professor: pessoas.professor && `Entra como ${pessoas.professor.nome}, ${listaEmTexto(turmasDoProfessor(db, pessoas.professor.id).map((t) => `do ${turmaNome(t)}`))}`,
    coordenacao: pessoas.coordenador && `Entra como ${pessoas.coordenador.nome}, ${pessoas.coordenador.responsavel ? 'responsável pela coordenação' : 'da coordenação'}`,
    solar: pessoas.membro && `Entra como ${pessoas.membro.nome}, ${pessoas.membro.papel === 'responsavel' ? 'responsável pela equipe Solar' : 'da equipe Solar'}`,
  }

  function entrar(papel: Papel) {
    const perfil = perfilDeTeste(db, papel)
    if (!perfil) return
    definirPerfil(perfil)
    navigate(INICIO_DO_PAPEL[papel])
  }

  async function restaurar() {
    setConfirmando(false)
    await restaurarDadosDeExemplo()
    definirPerfil(null)
  }

  return (
    <div className="entrada">
      <section className="entrada-hero">
        <div className="entrada-hero-conteudo">
          <img src={logoBranco} alt="Solar Colégios" className="entrada-hero-logo" />
          <h1>Prova Solar</h1>
          <p className="entrada-hero-sub">Lançamento e resultados da avaliação anual da Rede</p>
          <span className="selo selo-ambar">Versão de teste</span>
        </div>
      </section>

      <main className="entrada-corpo">
        <section className="entrada-passo">
          <p className="sobretitulo">Entrada</p>
          <h2>Que visão você quer ver?</h2>
          <p className="entrada-sub">
            Nesta versão de teste não há senha. Cada perfil entra com uma pessoa fixa{pessoas.colegio ? ` do ${pessoas.colegio.nome}` : ''}, para
            você comparar o que cada uma vê.
          </p>
          {perfilAtual && pessoaAtual && (
            <button className="btn btn-secundario entrada-continuar" onClick={() => navigate(INICIO_DO_PAPEL[perfilAtual.papel])}>
              Continuar como {pessoaAtual.nome} <ArrowRight size={16} aria-hidden />
            </button>
          )}
          <div className="entrada-opcoes">
            {OPCOES.map(({ papel, titulo, texto, Icone }) => (
              <button key={papel} className="entrada-opcao" onClick={() => entrar(papel)} disabled={!quemEntra[papel]}>
                <span className="entrada-icone">
                  <Icone size={24} aria-hidden />
                </span>
                <span className="entrada-opcao-titulo">{titulo}</span>
                <span className="entrada-opcao-quem">{quemEntra[papel] ?? 'Não há ninguém com este perfil nos dados de teste.'}</span>
                <span className="entrada-opcao-texto">{texto}</span>
                <span className="entrada-opcao-entrar">
                  Entrar <ArrowRight size={16} aria-hidden />
                </span>
              </button>
            ))}
          </div>
        </section>

        <footer className="entrada-rodape">
          <p>
            Versão de teste, com dados fictícios. O que você muda fica guardado só neste navegador: outras pessoas não veem as suas alterações.
            Duas abas abertas ao mesmo tempo, cada uma num perfil, mostram uma mudança aparecendo na outra.
          </p>
          <p>
            Ao cadastrar uma pessoa, o site manda para o e-mail dela um link que entra direto na conta. Nesta versão os e-mails não saem de verdade: eles
            ficam em <Link to="/emails">E-mails enviados</Link>.
          </p>
          <div className="form-acoes">
            <Link className="btn btn-pequeno btn-fantasma" to="/emails">
              <Mail size={15} aria-hidden /> E-mails enviados
            </Link>
            <button className="btn btn-pequeno btn-fantasma" onClick={() => setConfirmando(true)}>
              <RotateCcw size={15} aria-hidden /> Restaurar dados de exemplo
            </button>
          </div>
        </footer>
      </main>

      <Confirmacao
        titulo="Voltar aos dados de exemplo?"
        aberta={confirmando}
        rotuloConfirmar="Apagar o que fiz e restaurar"
        perigo
        aoConfirmar={restaurar}
        aoFechar={() => setConfirmando(false)}
      >
        <p>Tudo o que foi lançado, cadastrado ou alterado neste navegador será apagado, e os dados fictícios voltam ao começo.</p>
      </Confirmacao>
    </div>
  )
}
