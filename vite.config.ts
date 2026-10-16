/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dois builds do mesmo código:
// - demonstração (npm run build): caminhos relativos, e o mesmo build funciona no GitHub Pages
//   (/teste_prova/) e localmente;
// - plataforma (npm run build:plataforma): plataformasolar.com.br/prova/. O Worker publica
//   dist-plataforma/ inteiro, e o caminho completo chega a ele, por isso a saída fica em prova/.
export default defineConfig(({ mode }) => {
  const plataforma = mode === 'plataforma'
  return {
    base: plataforma ? '/prova/' : './',
    plugins: [react()],
    // O pacote inclui as 574 habilidades da BNCC do 1º ao 5º ano; ~165 KB compactado é aceitável.
    build: {
      chunkSizeWarningLimit: 800,
      outDir: plataforma ? 'dist-plataforma/prova' : 'dist',
    },
    test: {
      environment: 'node',
    },
  }
})
