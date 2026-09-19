import { CFG } from './config.js';

export const rand  = (a, b) => a + Math.random() * (b - a);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp  = (a, b, t) => a + (b - a) * t;

// Box-Muller: mutacao precisa ser gaussiana, nao uniforme.
// Uniforme empurra todo mundo pras bordas do intervalo; gaussiana
// mantem a populacao coesa e deixa o outlier ser raro (que e' o ponto).
export function gauss(mean = 0, sd = 1) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// O mundo e' um CILINDRO: da' a volta na horizontal, mas tem margem de
// verdade em cima e embaixo. Era um toro ate' o clima entrar — num toro o
// polo frio faz fronteira com o quente, entao "norte" e "sul" nao existem,
// o meio vira otimo unico e nenhuma linhagem se separa por latitude.
export function wrapDelta(d, size) {
  const half = size / 2;
  if (d >  half) return d - size;
  if (d < -half) return d + size;
  return d;
}

export function wrapPos(v, size) {
  if (v < 0) return v + size;
  if (v >= size) return v - size;
  return v;
}

// Vertical nao da' a volta: a diferenca em y e' a diferenca, e ponto.
export function dist2(ax, ay, bx, by) {
  const dx = wrapDelta(ax - bx, CFG.world.w);
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// Margem de cima e de baixo sao parede: quem chega, encosta e desliza.
export function prendeY(v, folga) {
  const lim = CFG.world.h - folga;
  return v < folga ? folga : (v > lim ? lim : v);
}

// O charco tem clima: frio na margem de cima, quente na de baixo.
// E' esse gradiente que cria nicho geografico — e nicho geografico e' o que
// faz duas populacoes divergirem de verdade em vez de se misturarem.
export function temperatura(y) {
  return y / CFG.world.h;
}

export function conforto(termo, y) {
  const d = termo - temperatura(y);
  return Math.exp(-(d * d) / (2 * CFG.creature.termoSigma * CFG.creature.termoSigma));
}
