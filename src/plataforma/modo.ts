// Os dois builds do mesmo código (vite.config.ts):
// - a demonstração (npm run build): dados fictícios no navegador, sem login;
// - a plataforma (npm run build:plataforma): plataformasolar.org.br/prova/, com o login comum e o banco.
// import.meta.env.MODE é trocado pelo valor na compilação: na demonstração, todo "if (PLATAFORMA)" some do
// pacote, e o supabase-js não entra nele.

export const PLATAFORMA = import.meta.env.MODE === 'plataforma'

/**
 * Nome de chave no navegador (localStorage, sessionStorage, IndexedDB). Na plataforma, tudo leva o prefixo
 * "prova:" (contrato da origem, PLANO §3); a demonstração, noutra origem, continua com "prova-solar:".
 */
export const chave = (nome: string) => (PLATAFORMA ? `prova:${nome}` : `prova-solar:${nome}`)
