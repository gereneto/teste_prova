import { RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Cabecalho, Cartao } from '../../components/ui'
import { NOMES_FAIXAS } from '../../lib/estatisticas'
import { definirFaixas, restaurarDadosDeExemplo } from '../../store/acoes'
import { useDb } from '../../store/db'

export default function Configuracoes() {
  const db = useDb()
  const [faixas, setFaixas] = useState(db.config.faixas.map(String))
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const numeros = faixas.map(Number)

  function salvar(e: FormEvent) {
    e.preventDefault()
    if (numeros.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) {
      return setMensagem({ erro: true, texto: 'Use números inteiros de 1 a 100.' })
    }
    if (!(numeros[0] < numeros[1] && numeros[1] < numeros[2])) {
      return setMensagem({ erro: true, texto: 'Cada faixa precisa começar acima da anterior (Básico < Adequado < Avançado).' })
    }
    definirFaixas([numeros[0], numeros[1], numeros[2]])
    setMensagem({ erro: false, texto: 'Faixas salvas. Todos os painéis já usam os novos limites.' })
  }

  async function restaurar() {
    if (!confirm('Apagar tudo o que foi feito neste navegador e voltar aos dados de exemplo?')) return
    await restaurarDadosDeExemplo()
    setFaixas(['40', '60', '80'])
    setMensagem({ erro: false, texto: 'Dados de exemplo restaurados.' })
  }

  const valido = numeros.every((n) => Number.isInteger(n)) && numeros[0] < numeros[1] && numeros[1] < numeros[2]

  return (
    <>
      <Cabecalho titulo="Configurações" />

      <Cartao titulo="Faixas de desempenho" sub="Classificam cada aluno pelo percentual de acertos. Valem para professores, coordenações e Solar.">
        <form className="form" onSubmit={salvar} noValidate>
          <div className="form-grade">
            {['Básico a partir de', 'Adequado a partir de', 'Avançado a partir de'].map((rotulo, i) => (
              <label className="campo" key={rotulo}>
                <span>{rotulo}</span>
                <span className="input-sufixo">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={faixas[i]}
                    onChange={(e) => {
                      const novas = [...faixas]
                      novas[i] = e.target.value
                      setFaixas(novas)
                      setMensagem(null)
                    }}
                  />
                  %
                </span>
              </label>
            ))}
          </div>
          {valido && (
            <ul className="faixas-previa">
              <li>
                <span className="faixas-ponto faixa-0" aria-hidden /> {NOMES_FAIXAS[0]}: menos de {numeros[0]}%
              </li>
              <li>
                <span className="faixas-ponto faixa-1" aria-hidden /> {NOMES_FAIXAS[1]}: de {numeros[0]}% a {numeros[1] - 1}%
              </li>
              <li>
                <span className="faixas-ponto faixa-2" aria-hidden /> {NOMES_FAIXAS[2]}: de {numeros[1]}% a {numeros[2] - 1}%
              </li>
              <li>
                <span className="faixas-ponto faixa-3" aria-hidden /> {NOMES_FAIXAS[3]}: {numeros[2]}% ou mais
              </li>
            </ul>
          )}
          {mensagem && (
            <p className={mensagem.erro ? 'erro-campo' : 'ok-campo'} role="status">
              {mensagem.texto}
            </p>
          )}
          <div className="form-acoes">
            <button type="submit" className="btn btn-primario">
              Salvar faixas
            </button>
          </div>
        </form>
      </Cartao>

      <Cartao titulo="Dados desta versão de teste">
        <p>
          Nesta versão não há servidor: os dados ficam guardados neste navegador. Cada pessoa que abre o site começa com os mesmos dados
          fictícios, e o que ela muda não aparece para mais ninguém.
        </p>
        <p className="texto-2">
          Dá para abrir duas abas ao mesmo tempo, por exemplo uma como professor e outra como Solar: o que é lançado numa aparece na outra.
        </p>
        <button className="btn" onClick={restaurar}>
          <RotateCcw size={16} aria-hidden /> Restaurar dados de exemplo
        </button>
      </Cartao>
    </>
  )
}
