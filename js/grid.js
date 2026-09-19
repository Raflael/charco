import { CFG } from './config.js';
import { wrapDelta } from './util.js';

// Hash espacial toroidal. Sem isso, cada criatura olharia todas as outras
// (O(n^2)) e a simulacao engasga por volta de 400 individuos.
export class SpatialGrid {
  constructor(cell = 80) {
    this.cell = cell;
    this.cols = Math.ceil(CFG.world.w / cell);
    this.rows = Math.ceil(CFG.world.h / cell);
    this.buckets = new Array(this.cols * this.rows);
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i] = [];
  }

  clear() {
    for (let i = 0; i < this.buckets.length; i++) this.buckets[i].length = 0;
  }

  _idx(cx, cy) {
    const x = ((cx % this.cols) + this.cols) % this.cols;   // so' o eixo X da' a volta
    return cy * this.cols + x;
  }

  insert(item) {
    const cx = Math.floor(item.x / this.cell);
    const cy = Math.min(this.rows - 1, Math.max(0, Math.floor(item.y / this.cell)));
    this.buckets[this._idx(cx, cy)].push(item);
  }

  // Percorre candidatos num raio. Chama cb(item, d2) so' pra quem esta' dentro.
  query(x, y, r, cb) {
    const span = Math.ceil(r / this.cell);
    const cx = Math.floor(x / this.cell);
    const cy = Math.floor(y / this.cell);
    const r2 = r * r;
    for (let oy = -span; oy <= span; oy++) {
      const yy = cy + oy;
      if (yy < 0 || yy >= this.rows) continue;   // nao existe vizinho alem da margem
      for (let ox = -span; ox <= span; ox++) {
        const bucket = this.buckets[this._idx(cx + ox, yy)];
        for (let i = 0; i < bucket.length; i++) {
          const it = bucket[i];
          if (it.dead) continue;
          const dx = wrapDelta(it.x - x, CFG.world.w);
          const dy = it.y - y;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) cb(it, d2, dx, dy);
        }
      }
    }
  }
}
