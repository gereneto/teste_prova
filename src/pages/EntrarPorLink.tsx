import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { INICIO_DO_PAPEL } from '../components/Layout'
import { Vazio } from '../components/ui'
import { pessoaPorToken } from '../lib/consultas'
import { useDb } from '../store/db'
import { definirPerfil } from '../store/perfil'

/** O link de acesso enviado por e-mail: entra direto na conta da pessoa, sem senha. */
export default function EntrarPorLink() {
  const { token = '' } = useParams()
  const db = useDb()
  const navigate = useNavigate()
  const perfil = pessoaPorToken(db, token)

  useEffect(() => {
    if (!perfil) return
    definirPerfil(perfil)
    navigate(INICIO_DO_PAPEL[perfil.papel], { replace: true })
  }, [perfil, navigate])

  if (perfil) return null
  return (
    <main className="conteudo">
      <Vazio titulo="Este link de acesso não vale mais" acao={<Link className="btn" to="/">Ir para a entrada</Link>}>
        O e-mail da pessoa pode ter sido corrigido, ou o acesso foi desativado. Peça um link novo à coordenação do colégio ou à equipe Solar. Nesta versão
        de teste, o link só funciona no navegador onde a pessoa foi cadastrada.
      </Vazio>
    </main>
  )
}
