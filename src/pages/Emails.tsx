import { ArrowLeft, LogIn, Mail } from 'lucide-react'
import { Link } from 'react-router'
import { Marca } from '../components/Layout'
import { Cabecalho, Selo, Vazio } from '../components/ui'
import { pessoaPorToken } from '../lib/consultas'
import { dataCurta } from '../lib/formato'
import { linkDeAcesso } from '../store/acoes'
import { useDb } from '../store/db'

/**
 * Nesta versão de teste o site não envia e-mails de verdade: cada e-mail que sairia fica guardado
 * e aparece aqui, com o link de acesso, para testar a entrada pelo link.
 */
export default function Emails() {
  const db = useDb()
  const emails = [...db.emails].reverse()
  return (
    <div className="app">
      <header className="topo">
        <div className="topo-interno">
          <Marca />
        </div>
      </header>
      <main className="conteudo">
        <Cabecalho
          voltar={{ para: '/', rotulo: 'Entrada' }}
          sobretitulo="Versão de teste"
          titulo="E-mails enviados"
          subtitulo="Nesta versão o site não envia e-mails de verdade. Cada e-mail com link de acesso que sairia aparece aqui. Abra o link para entrar como a pessoa."
        />
        {!emails.length ? (
          <Vazio titulo="Nenhum e-mail enviado ainda">
            Eles aparecem quando a coordenação cadastra um professor, quando alguém da Solar define o responsável de um colégio ou inclui alguém na
            equipe, e quando o e-mail de alguém é corrigido.
          </Vazio>
        ) : (
          <ul className="emails">
            {emails.map((email) => {
              const valido = pessoaPorToken(db, email.token) !== null
              return (
                <li key={email.id} className="email">
                  <div className="email-topo">
                    <Mail size={18} aria-hidden />
                    <span>
                      <strong>Para:</strong> {email.nome} &lt;{email.para}&gt;
                    </span>
                    <span className="texto-2 pequeno">
                      {dataCurta(email.enviadoEm)} às {email.enviadoEm.slice(11, 16)}
                    </span>
                  </div>
                  <p className="email-assunto">{email.assunto}</p>
                  <p>{email.texto}</p>
                  <div className="email-link">
                    {valido ? (
                      <Link className="btn btn-primario" to={`/entrar/${email.token}`}>
                        <LogIn size={16} aria-hidden /> Entrar na Prova Solar
                      </Link>
                    ) : (
                      <Selo>Este link não vale mais</Selo>
                    )}
                    <span className="codigo texto-2">{linkDeAcesso(email.token)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        <p>
          <Link to="/">
            <ArrowLeft size={14} aria-hidden /> Voltar para a entrada
          </Link>
        </p>
      </main>
    </div>
  )
}
