import { X } from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'
import { buscarHabilidade, habilidadesDoAno, type Habilidade } from '../data/bncc'
import { normalizar } from '../lib/formato'
import type { Serie } from '../types'

const MAXIMO_OPCOES = 40

/** Campo de busca das habilidades da BNCC do ano, por código ou por texto. */
export function SeletorHabilidade(props: {
  serie: Serie
  disciplina: string
  valor: string | null
  aoMudar: (habilidade: Habilidade | null) => void
}) {
  const { serie, disciplina, valor } = props
  const idLista = useId()
  const [aberto, setAberto] = useState(false)
  const [busca, setBusca] = useState('')
  const [ativa, setAtiva] = useState(0)
  const atual = buscarHabilidade(valor)

  const opcoes = useMemo(() => {
    const termos = normalizar(busca).split(/\s+/).filter(Boolean)
    return habilidadesDoAno(serie)
      .filter((h) => {
        const texto = normalizar(`${h.codigo} ${h.componente} ${h.descricao} ${h.objeto}`)
        return termos.every((t) => texto.includes(t))
      })
      .sort((a, b) => Number(b.componente === disciplina) - Number(a.componente === disciplina) || a.codigo.localeCompare(b.codigo))
      .slice(0, MAXIMO_OPCOES)
  }, [serie, disciplina, busca])

  function escolher(habilidade: Habilidade) {
    props.aoMudar(habilidade)
    setAberto(false)
    setBusca('')
  }

  function aoTeclar(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setAtiva((i) => Math.min(i + 1, opcoes.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAtiva((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && aberto && opcoes[ativa]) {
      e.preventDefault()
      escolher(opcoes[ativa])
    } else if (e.key === 'Escape') {
      setAberto(false)
    }
  }

  return (
    <div className="seletor">
      <input
        role="combobox"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-autocomplete="list"
        aria-label="Habilidade da BNCC"
        value={aberto ? busca : atual ? `${atual.codigo} · ${atual.descricao}` : ''}
        placeholder="Buscar por código ou palavra"
        title={atual?.descricao}
        onFocus={() => {
          setAberto(true)
          setBusca('')
          setAtiva(0)
        }}
        onBlur={() => setAberto(false)}
        onChange={(e) => {
          setBusca(e.target.value)
          setAtiva(0)
        }}
        onKeyDown={aoTeclar}
      />
      {valor && !aberto && (
        <button type="button" className="seletor-limpar" onClick={() => props.aoMudar(null)} aria-label="Tirar a habilidade desta questão">
          <X size={14} aria-hidden />
        </button>
      )}
      {aberto && (
        <ul className="seletor-lista" role="listbox" id={idLista}>
          {opcoes.map((h, i) => (
            <li
              key={h.codigo}
              role="option"
              aria-selected={i === ativa}
              className={i === ativa ? 'ativa' : ''}
              onMouseEnter={() => setAtiva(i)}
              onMouseDown={(e) => {
                e.preventDefault()
                escolher(h)
              }}
            >
              <span className="seletor-codigo">
                {h.codigo} <span className="texto-2">{h.componente}</span>
              </span>
              <span className="seletor-descricao">{h.descricao}</span>
            </li>
          ))}
          {!opcoes.length && <li className="seletor-vazio">Nenhuma habilidade do {serie}º ano com esse termo.</li>}
        </ul>
      )}
    </div>
  )
}
