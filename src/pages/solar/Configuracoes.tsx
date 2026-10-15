import { RotateCcw } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Cabecalho, Cartao, Confirmacao } from '../../components/ui'
import { permissoesDe, pessoaDoPerfil } from '../../lib/consultas'
import { NOMES_FAIXAS } from '../../lib/estatisticas'
import { definirFaixas, restaurarDadosDeExemplo } from '../../store/acoes'
import { useDb } from '../../store/db'
import { usePerfil } from '../../store/perfil'

export default function Configuracoes() {
  const db = useDb()
  const perfil = usePerfil()
  const [faixas, setFaixas] = useState(db.config.faixas.map(String))
  const [mensagem, setMensagem] = useState<{ texto: string; erro: boolean } | null>(null)
  const [restaurando, setRestaurando] = useState(false)
  const { editarRede } = permissoesDe(perfil ? pessoaDoPerfil(db, perfil) : null)
  const numeros = faixas.map(Number)

  function salvar(e: FormEvent) {
    e.preventDefault()
    if (numeros.some((n) => !Number.isInteger(n) || n < 1 || n > 100)) return setMensagem({ erro: true, texto: 'Use números inteiros de 1 a 100.' })
    if (!(numeros[0] < numeros[1] && numeros[1] < numeros[2])) {
      return setMensagem({ erro: true, texto: 'Cada faixa precisa começar acima da anterior (Básico < Adequado < Avançado).' })
    }
    definirFaixas([numeros[0], numeros[1], numeros[2]])
    setMensagem({ erro: false, texto: 'Faixas salvas. Todos os resultados, inclusive os de avaliações anteriores, já usam os novos limites.' })
  }

  async function restaurar() {
    setRestaurando(false)
    await restaurarDadosDeExemplo()
    setFaixas(['40', '60', '80'])
    setMensagem({ erro: false, texto: 'Dados de exemplo restaurados.' })
  }

  const valido = numeros.every((n) => Number.isInteger(n)) && numeros[0] < numeros[1] && numeros[1] < numeros[2]

  return (
    <>
      <Cabecalho sobretitulo="Equipe Solar" titulo="Configurações" subtitulo={`Ano letivo em curso: ${db.config.anoLetivo}.`} />

      <Cartao
        titulo="Faixas de desempenho"
        sub="Classificam cada aluno pelo percentual de acertos. Valem para professores, coordenações e Solar, e reclassificam também as avaliações anteriores."
      >
        <form className="form" onSubmit={salvar} noValidate>
          <fieldset className="fieldset-livre" disabled={!editarRede}>
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
          </fieldset>
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
          {editarRede ? (
            <div className="form-acoes">
              <button type="submit" className="btn btn-primario">
                Salvar faixas
              </button>
            </div>
          ) : (
            <p className="texto-2 pequeno">Seu acesso é só de visualização.</p>
          )}
        </form>
      </Cartao>

      <Cartao titulo="Dados desta versão de teste">
        <p>
          Nesta versão não há servidor: os dados ficam guardados neste navegador. Cada pessoa que abre o site começa com os mesmos dados fictícios, e o que
          ela muda não aparece para mais ninguém.
        </p>
        <p className="texto-2">Dá para abrir duas abas ao mesmo tempo, por exemplo uma como professor e outra como Solar: o que é lançado numa aparece na outra.</p>
        <button className="btn" onClick={() => setRestaurando(true)}>
          <RotateCcw size={16} aria-hidden /> Restaurar dados de exemplo
        </button>
      </Cartao>

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
