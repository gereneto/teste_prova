import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Fontes do design system da Solar, servidas junto com o site (sem depender do Google Fonts).
import '@fontsource/quicksand/500.css'
import '@fontsource/quicksand/600.css'
import '@fontsource/quicksand/700.css'
import '@fontsource/nunito-sans/400.css'
import '@fontsource/nunito-sans/600.css'
import '@fontsource/nunito-sans/700.css'
import App from './App'
import './styles.css'

const raiz = createRoot(document.getElementById('root')!)

// Na plataforma, a porta confere a sessão e carrega os dados do banco antes das telas. Import dinâmico, com o teste
// escrito aqui (e não o PLATAFORMA de modo.ts): só assim o Vite tira da demonstração o pedaço com o supabase-js.
if (import.meta.env.MODE === 'plataforma') {
  void import('./plataforma/Portao').then(({ Portao }) =>
    raiz.render(
      <StrictMode>
        <Portao>
          <App />
        </Portao>
      </StrictMode>,
    ),
  )
} else {
  raiz.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
