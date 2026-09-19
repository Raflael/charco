import { gauss, clamp } from './util.js';

// Rede minuscula: 20 sensores -> 6 neuronios -> 2 saidas (virar, acelerar).
// Os pesos moram DENTRO do genoma e mutam como qualquer outro gene.
// ATENCAO: 'in' tem que bater com quantos sensores o NeuralBrain escreve.
// Float32Array engole escrita fora do range EM SILENCIO - com in:12 o
// ultimo sensor (proximidade da ameaca) era descartado sem erro nenhum.
export const NET = { in: 20, hid: 6, out: 2 };
export const NPESOS = NET.in * NET.hid + NET.hid + NET.hid * NET.out + NET.out;

export function randomNet() {
  const w = new Float32Array(NPESOS);
  for (let i = 0; i < NPESOS; i++) w[i] = gauss(0, 0.6);
  // Bias da saida 'esforco' comeca positivo: locomocao e' ancestral, o que
  // precisa evoluir e' a DECISAO. Sem isso a primeira geracao fica parada
  // no lugar e morre inteira antes da selecao ter o que selecionar.
  w[NPESOS - 1] = 0.8;
  return w;
}

// Crossover uniforme dos cerebros: cada peso vem de um dos dois pais.
// E' aqui que a reproducao sexuada paga o que promete — combinar duas
// solucoes boas de uma vez, em vez de esperar a mutacao acertar sozinha.
export function crossNet(a, b, rate) {
  const w = new Float32Array(NPESOS);
  const sd = rate * 3.2;
  for (let i = 0; i < NPESOS; i++) {
    const base = Math.random() < 0.5 ? a[i] : b[i];
    w[i] = clamp(base + gauss(0, sd), -4, 4);
  }
  return w;
}

export function mutateNet(pai, rate) {
  const w = new Float32Array(NPESOS);
  const sd = rate * 3.2;            // o slider de mutacao tambem mexe no cerebro
  for (let i = 0; i < NPESOS; i++) w[i] = clamp(pai[i] + gauss(0, sd), -4, 4);
  return w;
}

// Buffers reaproveitados: alocar Float32Array por criatura por frame
// entupiria o GC e o PC de 8GB sentiria.
const H = new Float32Array(NET.hid);
const OUT = new Float32Array(NET.out);

export function forward(w, sensores) {
  let p = 0;
  for (let j = 0; j < NET.hid; j++) {
    let soma = 0;
    for (let i = 0; i < NET.in; i++) soma += sensores[i] * w[p++];
    H[j] = Math.tanh(soma + w[NET.in * NET.hid + j]);
  }
  p = NET.in * NET.hid + NET.hid;
  for (let k = 0; k < NET.out; k++) {
    let soma = 0;
    for (let j = 0; j < NET.hid; j++) soma += H[j] * w[p++];
    OUT[k] = Math.tanh(soma + w[NPESOS - NET.out + k]);
  }
  return OUT;
}
