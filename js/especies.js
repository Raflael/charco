import { CFG } from './config.js';
import { NPESOS } from './net.js';
import { GENES } from './genome.js';

// O CONCEITO BIOLOGICO DE ESPECIE, implementado literalmente:
// espécie não é um rótulo que eu ponho — é quem ainda consegue cruzar com quem.
// Duas populações divergem, a distância genética passa do limiar, elas deixam
// de se reproduzir entre si. Nesse instante nasce uma espécie nova.

// Peso de cada gene na distância. 'diet' pesa mais porque mudar de dieta é
// mudar de nicho — é a divergência que mais separa populações de verdade.
const PESO = {
  size: 1.0, speed: 0.9, sense: 0.7, diet: 1.5,
  metabolism: 0.6, maturity: 0.5, aggression: 0.5, termo: 1.4, toxina: 0.9,
  ornamento: 0.8, preferencia: 0.3, investimento: 0.4
};
const SOMA_PESOS = Object.values(PESO).reduce((a, b) => a + b, 0);

// Calibrado rodando: com 0.17 a simulação fabricava 40 espécies de 5 bichos
// cada — ruído taxonômico, não biologia. 0.30 produz espécies que duram,
// competem e deixam descendentes.
export const LIMIAR_ESPECIE = 0.30;

export function distancia(a, b) {
  let d = 0;
  for (const k in PESO) {
    const f = CFG.genes[k];
    d += PESO[k] * Math.abs(a[k] - b[k]) / (f.max - f.min);
  }
  d /= SOMA_PESOS;

  // O cérebro também conta: dois bichos que decidem de formas muito
  // diferentes já não se reconhecem como parceiros.
  let dw = 0;
  for (let i = 0; i < NPESOS; i++) dw += Math.abs(a.brain[i] - b.brain[i]);
  return d + (dw / NPESOS) * 0.20;
}

// ---------- nomenclatura binomial ----------
// O nome DESCREVE o bicho: sai dos traços mais extremos dele, como taxonomia
// de verdade. Tachyodon voracis é rápido e carnívoro mesmo. E o gênero é
// herdado quando a filha ficou perto da mãe — gênero novo só quando a
// divergência foi grande, que é exatamente o critério de um taxonomista.

const RAIZ = [
  { gene: 'speed',      alto: 'Tachy',  baixo: 'Brady' },
  { gene: 'size',       alto: 'Macro',  baixo: 'Micro' },
  { gene: 'diet',       alto: 'Vora',   baixo: 'Phyto' },
  { gene: 'sense',      alto: 'Oculo',  baixo: 'Typhlo' },
  { gene: 'aggression', alto: 'Thyro',  baixo: 'Prauno' },
  { gene: 'metabolism', alto: 'Pyro',   baixo: 'Crypto' },
  { gene: 'termo',      alto: 'Thermo', baixo: 'Psychro' },
  { gene: 'toxina',     alto: 'Toxo',   baixo: 'Innoc' },
  { gene: 'ornamento',  alto: 'Callo',  baixo: 'Lito' }
];
const SUF = ['don', 'pus', 'ops', 'nyx', 'chus', 'ster', 'phus', 'mys'];
const EPITETO = [
  { gene: 'diet',       alto: 'voracis',   baixo: 'herbarius' },
  { gene: 'speed',      alto: 'celer',     baixo: 'tardus' },
  { gene: 'size',       alto: 'giganteus', baixo: 'pusillus' },
  { gene: 'sense',      alto: 'vigilans',  baixo: 'caecus' },
  { gene: 'maturity',   alto: 'patiens',   baixo: 'praecox' },
  { gene: 'metabolism', alto: 'ardens',    baixo: 'lentus' },
  { gene: 'aggression', alto: 'ferox',     baixo: 'placidus' },
  { gene: 'termo',      alto: 'australis',  baixo: 'borealis' },
  { gene: 'toxina',     alto: 'venenatus',  baixo: 'edulis' },
  { gene: 'ornamento',  alto: 'ornatus',    baixo: 'nudus' }
];
const MODIF = ['minor', 'major', 'litoralis', 'profundus', 'robustus',
               'gracilis', 'nanus', 'ingens', 'obscurus', 'pallidus'];

function extremidade(g, gene) {
  const f = CFG.genes[gene];
  return (g[gene] - f.min) / (f.max - f.min) - 0.5;
}

function ranque(tabela, g) {
  return tabela
    .map(o => ({ o, v: extremidade(g, o.gene) }))
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
}

function batiza(g, generoHerdado, usados, n) {
  const r = ranque(RAIZ, g)[0];
  const raiz = r.v > 0 ? r.o.alto : r.o.baixo;
  const epitetos = ranque(EPITETO, g)
    .map(x => (x.v > 0 ? x.o.alto : x.o.baixo))
    .concat(MODIF);
  const generos = (generoHerdado ? [generoHerdado] : []).concat(SUF.map(s => raiz + s));

  for (const gen of generos) {
    for (const ep of epitetos) {
      const nome = gen + ' ' + ep;
      if (!usados.has(nome)) return { genero: gen, epiteto: ep, nome };
    }
  }
  const gen = generoHerdado || raiz + 'us';
  return { genero: gen, epiteto: 'sp' + n, nome: gen + ' sp' + n };
}

function copiaGenoma(g) {
  return Object.assign({}, g, { brain: g.brain.slice() });
}

// ---------- registro ----------
export class Registro {
  constructor() { this.reset(); }

  reset() {
    this.especies = new Map();
    this.usados = new Set();
    this.prox = 1;
  }

  nova(genoma, t, paiEsp) {
    const pai = paiEsp ? this.especies.get(paiEsp) : null;
    // Gênero herdado quando a filha ficou "na família"; gênero novo quando
    // a divergência foi grande demais pra isso.
    const herda = pai && distancia(genoma, pai.rep) < LIMIAR_ESPECIE * 1.8;
    const id = this.prox++;
    const n = batiza(genoma, herda ? pai.genero : null, this.usados, id);
    this.usados.add(n.nome);

    const esp = {
      id, nome: n.nome, genero: n.genero, epiteto: n.epiteto,
      rep: copiaGenoma(genoma),
      origem: t, fim: null, viva: true,
      pai: paiEsp || null, filhas: [],
      pop: 0, pico: 0, nascidos: 0, hue: genoma.hue, anunciada: false
    };
    this.especies.set(id, esp);
    if (pai) pai.filhas.push(id);
    return esp;
  }

  // Chamado quando um filho nasce. Quase sempre ele é da espécie do pai
  // (1 comparação); só quando divergiu é que procuramos outra casa pra ele —
  // e se não houver nenhuma, isso é um evento de especiação.
  classificar(genoma, t, paiEsp) {
    const esp = this.especies.get(paiEsp);
    if (esp && esp.viva && distancia(genoma, esp.rep) < LIMIAR_ESPECIE) {
      esp.nascidos++;
      return esp.id;
    }
    let melhor = null, bd = LIMIAR_ESPECIE;
    for (const e of this.especies.values()) {
      if (!e.viva || e.id === paiEsp) continue;
      const d = distancia(genoma, e.rep);
      if (d < bd) { bd = d; melhor = e; }
    }
    if (melhor) { melhor.nascidos++; return melhor.id; }

    const nv = this.nova(genoma, t, paiEsp);
    nv.nascidos = 1;
    return nv.id;
  }

  // Censo: recalcula a população, RECENTRA o representante na média dos
  // membros vivos (sem isso a espécie fica ancorada no fundador e a
  // população foge dele até ninguém mais pertencer à própria espécie),
  // e declara extinta quem zerou.
  censo(creatures, t, aoExtinguir, aoSurgir) {
    const somas = new Map();
    for (const e of this.especies.values()) e.pop = 0;

    for (const c of creatures) {
      const e = this.especies.get(c.esp);
      if (!e) continue;
      e.pop++;
      let s = somas.get(e.id);
      if (!s) {
        s = { g: {}, w: new Float32Array(NPESOS), n: 0 };
        for (const k of GENES) s.g[k] = 0;
        somas.set(e.id, s);
      }
      for (const k of GENES) s.g[k] += c.genome[k];
      const bw = c.genome.brain;
      for (let i = 0; i < NPESOS; i++) s.w[i] += bw[i];
      s.n++;
    }

    for (const [id, s] of somas) {
      const e = this.especies.get(id);
      for (const k of GENES) e.rep[k] = s.g[k] / s.n;
      for (let i = 0; i < NPESOS; i++) e.rep.brain[i] = s.w[i] / s.n;
    }

    for (const e of this.especies.values()) {
      if (!e.viva) continue;
      if (e.pop > e.pico) {
        e.pico = e.pop;
        // Uma espécie só entra pra história quando dá sinal de vida:
        // linhagens de 2 indivíduos que somem em 10s virariam ruído.
        if (e.pop >= 10 && !e.anunciada) {
          e.anunciada = true;
          if (aoSurgir) aoSurgir(e);
        }
      }
      if (e.pop === 0) {
        e.viva = false;
        e.fim = t;
        if (e.anunciada && aoExtinguir) aoExtinguir(e);
      }
    }
  }

  vivas() {
    return [...this.especies.values()]
      .filter(e => e.viva && e.pop > 0)
      .sort((a, b) => b.pop - a.pop);
  }

  fosseis() {
    return [...this.especies.values()]
      .filter(e => !e.viva && e.anunciada)
      .sort((a, b) => (b.fim - b.origem) - (a.fim - a.origem));
  }

  // Linhagem de uma espécie até a raiz — a coluna vertebral da árvore.
  ancestrais(id) {
    const caminho = [];
    let e = this.especies.get(id);
    while (e) { caminho.unshift(e); e = e.pai ? this.especies.get(e.pai) : null; }
    return caminho;
  }
}
