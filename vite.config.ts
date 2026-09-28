/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Caminhos relativos: o mesmo build funciona no GitHub Pages (/teste_prova/) e localmente.
export default defineConfig({
  base: './',
  plugins: [react()],
  // O pacote inclui as 574 habilidades da BNCC do 1º ao 5º ano; ~165 KB compactado é aceitável.
  build: {
    chunkSizeWarningLimit: 800,
  },
  test: {
    environment: 'node',
  },
})
