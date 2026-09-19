import { CFG } from './config.js';
import { rand, clamp, gauss } from './util.js';
import { randomNet, mutateNet, crossNet } from './net.js';

export const GENES = Object.keys(CFG.genes);

export function randomGenome() {
  const g = {};
  for (const k of GENES) {
    const [lo, hi] = CFG.genes[k].init;
    g[k] = rand(lo, hi);
  }
  g.brain = randomNet();  // 98 pesos: o comportamento tambem e' herdado
  g.hue = rand(0, 360);   // gene NEUTRO: nao faz nada, so' e' herdado.
  return g;               // e' ele que deixa a linhagem visivel na tela.
}

export function mutate(parent) {
  const child = {};
  for (const k of GENES) {
    const { min, max } = CFG.genes[k];
    const sd = (max - min) * CFG.mutation.rate;
    child[k] = clamp(parent[k] + gauss(0, sd), min, max);
  }
  child.brain = mutateNet(parent.brain, CFG.mutation.rate);
  child.hue = (parent.hue + gauss(0, CFG.mutation.hueDrift) + 360) % 360;
  return child;
}

// Filho de dois pais: cada gene sorteia de qual vem (crossover uniforme),
// e so' depois a mutacao age. Nao e' media — media apagaria a variacao que
// a selecao precisa pra trabalhar.
export function recombinar(a, b) {
  const child = {};
  // CROSSOVER DE PONTO UNICO, nao uniforme. A ordem de GENES e' a ordem no
  // cromossomo, e vizinhos tendem a viajar juntos — isso e' ligacao genetica.
  //
  // Nao e' preciosismo: o runaway de Fisher DEPENDE de desequilibrio de
  // ligacao entre o gene do enfeite e o gene do gosto. Com crossover uniforme
  // (cada gene sorteado por conta propria) essa ligacao e' destruida toda
  // geracao, e o runaway nunca se estabelece — foi exatamente o que os
  // primeiros testes mostraram. 'ornamento' e 'preferencia' sao vizinhos no
  // cromossomo de proposito.
  const ponto = 1 + Math.floor(Math.random() * (GENES.length - 1));
  const comecaEmA = Math.random() < 0.5;
  for (let i = 0; i < GENES.length; i++) {
    const k = GENES[i];
    const { min, max } = CFG.genes[k];
    const base = ((i < ponto) === comecaEmA) ? a[k] : b[k];
    child[k] = clamp(base + gauss(0, (max - min) * CFG.mutation.rate), min, max);
  }
  child.brain = crossNet(a.brain, b.brain, CFG.mutation.rate);
  const h = (Math.random() < 0.5 ? a.hue : b.hue) + gauss(0, CFG.mutation.hueDrift);
  child.hue = (h + 360) % 360;
  return child;
}
