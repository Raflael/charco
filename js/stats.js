import { CFG } from './config.js';
import { GENES } from './genome.js';

// Serie temporal das medias. Sem isso a evolucao acontece e ninguem ve'.
export class Stats {
  constructor() { this.reset(); }

  reset() {
    this.acc = 0;
    this.series = { pop: [], food: [] };
    for (const g of GENES) this.series[g] = [];
    this.now = { pop: 0, food: 0, gen: 0 };
    for (const g of GENES) this.now[g] = 0;
  }

  sample(world, dt) {
    this.acc += dt;
    const cs = world.creatures;
    const n = cs.length || 1;

    const sum = {}; for (const g of GENES) sum[g] = 0;
    let gen = 0;
    for (const c of cs) {
      for (const g of GENES) sum[g] += c.genome[g];
      gen += c.gen;
    }
    for (const g of GENES) this.now[g] = sum[g] / n;
    this.now.pop = cs.length;
    this.now.food = world.food.length;
    this.now.gen = gen / n;

    if (this.acc < CFG.sim.sampleEvery) return;
    this.acc = 0;
    const push = (k, v) => {
      const s = this.series[k];
      s.push(v);
      if (s.length > CFG.sim.history) s.shift();
    };
    push('pop', cs.length);
    push('food', world.food.length);
    for (const g of GENES) push(g, this.now[g]);
  }
}
