import { CFG } from './config.js';
import { forward, NET } from './net.js';
import { conforto } from './util.js';
import { CFG as CONF } from './config.js';

// decide(criatura, percepcao) -> { turn: -1..1, effort: 0..1 }
//
// 'turn' e' EGOCENTRICO: fracao do giro maximo pra esquerda/direita a partir
// do rumo atual. Foi o que permitiu plugar a rede neural sem tocar em mais
// nada: ela nao precisa aprender trigonometria antes de aprender a comer.

function paraFrenteELado(c, alvo) {
  const d = Math.hypot(alvo.dx, alvo.dy) || 1;
  const ux = alvo.dx / d, uy = alvo.dy / d;
  const cos = Math.cos(c.angle), sin = Math.sin(c.angle);
  return [ux * cos + uy * sin, -ux * sin + uy * cos, d];
}

function rumoPara(c, alvo, effort) {
  const [frente, lado] = paraFrenteELado(c, alvo);
  const ang = Math.atan2(lado, frente);        // -PI..PI relativo ao focinho
  return { turn: Math.max(-1, Math.min(1, ang / (Math.PI / 2))), effort };
}

export class RuleBrain {
  decide(c, p) {
    const g = c.genome;

    // 1. Ameaca manda em tudo: quem foge come depois, quem nao foge nao come.
    if (p.threat && 1 - g.aggression > 0.25) {
      return rumoPara(c, { dx: -p.threat.dx, dy: -p.threat.dy }, 1);
    }
    // 2. Pronta pra cruzar e com parceiro a vista: a chance de reproduzir
    //    vale mais que mais uma refeicao (a energia ja' esta' no limiar).
    if (p.mate && c.pronta > 0) return rumoPara(c, p.mate, 1);

    // 3. Cacar so' compensa pra quem tem dieta carnivora.
    if (p.prey && g.diet > 0.35 && g.diet * (0.4 + 0.6 * g.aggression) > 0.3) {
      return rumoPara(c, p.prey, 1);
    }
    // 4. Comida vegetal.
    if (p.food && g.diet < 0.85) return rumoPara(c, p.food, 0.85);

    // 5. Desconforto termico manda procurar outra latitude — a regra e'
    //    burra de proposito: a versao neural aprende a fazer melhor.
    if (conforto(g.termo, c.y) < 0.45) {
      const alvoY = g.termo * CONF.world.h;
      let dy = alvoY - c.y;
      if (dy >  CONF.world.h / 2) dy -= CONF.world.h;
      if (dy < -CONF.world.h / 2) dy += CONF.world.h;
      return rumoPara(c, { dx: 0, dy: dy }, 0.75);
    }

    // 6. Nada a vista: passeio com direcao persistente.
    c.wander += (Math.random() - 0.5) * 0.6;
    return { turn: Math.sin(c.wander) * 0.35, effort: 0.45 };
  }
}

export class NeuralBrain {
  constructor() { this.s = new Float32Array(NET.in); }

  decide(c, p) {
    const s = this.s;
    s[0] = 1;                                          // bias
    s[1] = Math.min(c.energy / c.reproAt, 1.5);
    s[2] = Math.min(c.age / c.lifespan, 1);
    s[3] = c.genome.diet;                              // "que tipo de bicho eu sou"

    let i = 4;
    for (const alvo of [p.food, p.prey, p.threat, p.mate]) {
      if (alvo) {
        const [frente, lado, d] = paraFrenteELado(c, alvo);
        s[i] = frente; s[i + 1] = lado;
        s[i + 2] = 1 - Math.min(d / c.senseR, 1);      // proximidade
      } else {
        s[i] = 0; s[i + 1] = 0; s[i + 2] = 0;
      }
      i += 3;
    }

    // Clima: o quanto estou confortavel, e se melhora indo pra frente.
    // O segundo sensor e' uma DERIVADA — e' o que permite a rede evoluir
    // migracao (seguir o gradiente) sem saber onde fica o norte.
    const aqui = conforto(c.genome.termo, c.y);
    const frente = conforto(c.genome.termo,
      (c.y + Math.sin(c.angle) * 60 + CONF.world.h) % CONF.world.h);
    s[16] = aqui;
    s[17] = (frente - aqui) * 4;

    // A COR DA PRESA. Em seno e cosseno porque matiz e' circular — 0 e 360
    // sao a mesma cor, e um sensor linear ensinaria a rede a ter medo de
    // uma descontinuidade que nao existe.
    if (p.prey) {
      const rad = (p.prey.ref.genome.hue * Math.PI) / 180;
      s[18] = Math.cos(rad);
      s[19] = Math.sin(rad);
    } else {
      s[18] = 0; s[19] = 0;
    }

    const out = forward(c.genome.brain, s);
    return { turn: out[0], effort: (out[1] + 1) / 2 };
  }
}

const CEREBROS = { regras: new RuleBrain(), neural: new NeuralBrain() };
let atual = 'regras';

export const cerebro = () => CEREBROS[atual];
export const modoCerebro = () => atual;
export function usarCerebro(nome) {
  if (CEREBROS[nome]) atual = nome;
}
