import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { Cabecalho, Cartao, Confirmacao, LegendaFaixas } from '../../components/ui'
import { restaurarDadosDeExemplo } from '../../store/acoes'
import { useDb } from '../../store/db'
import { PLATAFORMA } from '../../plataforma/modo'

export default function Configuracoes() {
  const db = useDb()
  const [mensagem, setMensagem] = useState<string | null>(null)
  const [restaurando, setRestaurando] = useState(false)

  async function restaurar() {
    setRestaurando(false)
    await restaurarDadosDeExemplo()
    setMensagem('Dados de exemplo restaurados.')
  }

  return (
    <>
      <Cabecalho sobretitulo="Equipe Solar" titulo="Configurações" subtitulo={`Ano letivo em curso: ${db.config.anoLetivo}.`} />

      <Cartao
        titulo="Faixas de acerto"
        sub="Os gráficos agrupam os alunos pelo percentual de acertos na prova, de 20 em 20 pontos. As faixas são as mesmas para professores, coordenações e Solar."
      >
        <LegendaFaixas />
      </Cartao>

      {!PLATAFORMA && (
      <Cartao titulo="Dados desta versão de teste">
        <p>
          Nesta versão não há servidor: os dados ficam guardados neste navegador. Cada pessoa que abre o site começa com os mesmos dados fictícios, e o que
          ela muda não aparece para mais ninguém.
        </p>
        <p className="texto-2">Dá para abrir duas abas ao mesmo tempo, por exemplo uma como professor e outra como Solar: o que é lançado numa aparece na outra.</p>
        <p className="texto-2">
          Os e-mails com link de acesso também não saem de verdade: ficam em <Link to="/emails" target="_blank">E-mails enviados</Link>.
        </p>
        <button className="btn" onClick={() => setRestaurando(true)}>
          <RotateCcw size={16} aria-hidden /> Restaurar dados de exemplo
        </button>
        {mensagem && (
          <p className="ok-campo" role="status">
            {mensagem}
          </p>
        )}
      </Cartao>
      )}

      <Confirmacao
        titulo="Voltar aos dados de exemplo?"
        aberta={restaurando}
        rotuloConfirmar="Apagar o que fiz e restaurar"
        perigo
        aoConfirmar={restaurar}
        aoFechar={() => setRestaurando(false)}
      >
        <p>Tudo o que foi lançado, cadastrado ou alterado neste navegador será apagado, e os dados fictícios voltam ao começo.</p>
      </Confirmacao>
    </>
  )
}
