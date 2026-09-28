/** Gerador pseudoaleatório com semente (mulberry32): os dados de exemplo saem iguais em qualquer navegador. */
export function criarAleatorio(semente: number) {
  let estado = semente >>> 0

  function num(): number {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    num,
    entre: (min: number, max: number) => min + num() * (max - min),
    inteiro: (min: number, max: number) => min + Math.floor(num() * (max - min + 1)),
    escolher: <T>(lista: readonly T[]): T => lista[Math.floor(num() * lista.length)],
    normal(media = 0, desvio = 1) {
      let u = 0
      while (u === 0) u = num()
      return media + desvio * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * num())
    },
    embaralhar<T>(lista: readonly T[]): T[] {
      const copia = [...lista]
      for (let i = copia.length - 1; i > 0; i--) {
        const j = Math.floor(num() * (i + 1))
        ;[copia[i], copia[j]] = [copia[j], copia[i]]
      }
      return copia
    },
  }
}

export type Aleatorio = ReturnType<typeof criarAleatorio>
