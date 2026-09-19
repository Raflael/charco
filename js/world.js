import { CFG } from './config.js';
import { SpatialGrid } from './grid.js';
import { Creature } from './creature.js';
import { randomGenome } from './genome.js';
import { Registro } from './especies.js';
import { rand, gauss, wrapPos, prendeY } from './util.js';

export class World {
  constructor() {
    this.registro = new Registro();
    this.grid = new SpatialGrid(90);
    this.foodGrid = new SpatialGrid(60);
    this.reset();
  }

  reset() {
    this.creatures = [];
    this.food = [];
    this.spawnQueue = [];
    this.time = 0;
    this.passo = 0;
    this.births = 0; this.deaths = 0; this.cruzamentos = 0;
    this.censoAcc = 0;
    this.registro.reset();
    this.deriva = {
      abertura: 0,          // 0 = charco inteiro, 1 = dois continentes
      alvo: 0,
      xs: [CFG.world.w * 0.25, CFG.world.w * 0.75]
    };
    this.foodEaten = 0; this.predations = 0; this.scavenged = 0;
    this.envenenamentos = 0; this.natimortos = 0;
    this.foodDebt = 0;
    this.events = [];
    this.seedPatches();
    for (let i = 0; i < CFG.creature.startCount; i++) {
      const c = new Creature(rand(0, CFG.world.w), rand(0, CFG.world.h), randomGenome());
      c.esp = this.registro.classificar(c.genome, 0, null);
      this.creatures.push(c);
    }
    for (let i = 0; i < 420; i++) this.growFood();
  }

  seedPatches() {
    // Comida em manchas, nao espalhada por igual: e' a distribuicao irregular
    // que cria territorio, disputa e razao pra especie ficar diferente da outra.
    this.patches = [];
    for (let i = 0; i < CFG.food.patches; i++) {
      this.patches.push({ x: rand(0, CFG.world.w), y: rand(0, CFG.world.h) });
    }
  }

  growFood() {
    if (this.food.length >= CFG.food.max) return;
    if (this._tentativas === undefined) this._tentativas = 0;
    const p = this.patches[(Math.random() * this.patches.length) | 0];
    this.food.push({
      x: wrapPos(p.x + gauss(0, CFG.food.spread), CFG.world.w),
      y: prendeY(p.y + gauss(0, CFG.food.spread), 6),
      energy: CFG.food.energy, meat: false, dead: false
    });
    const f = this.food[this.food.length - 1];
    if (this.naFenda(f.x)) this.food.pop();   // nada cresce na rocha nua
  }

  // Quem morre vira comida. Isso nao e' enfeite: a carnica e' a RAMPA
  // evolutiva pra carnivoria - necrofagia primeiro, predacao depois.
  // Sem ela a dieta intermediaria e' um vale adaptativo intransponivel.
  dropCarrion(c) {
    if (this.food.length >= CFG.food.max) return;
    this.food.push({
      x: c.x, y: c.y,
      energy: Math.max(12, c.energy * 0.5 + c.genome.size * CFG.food.carrionK),
      meat: true, dead: false, until: this.time + CFG.food.carrionTTL
    });
  }

  step(dt, params) {
    this.time += dt;
    this.passo++;
    this.moverContinentes(dt);

    this.grid.clear();
    for (const c of this.creatures) this.grid.insert(c);
    this.foodGrid.clear();
    for (const f of this.food) this.foodGrid.insert(f);

    for (const c of this.creatures) if (!c.dead) c.update(dt, this);

    let alive = 0;
    for (const c of this.creatures) {
      if (c.dead) { if (c.causa !== 'predado') this.dropCarrion(c); }
      else this.creatures[alive++] = c;
    }
    this.deaths += this.creatures.length - alive;
    this.creatures.length = alive;

    if (this.spawnQueue.length) {
      for (const b of this.spawnQueue) {
        b.esp = this.registro.classificar(b.genome, this.time, b.espPai || null);
        this.creatures.push(b);
      }
      this.spawnQueue.length = 0;
    }

    let nf = 0;
    for (const f of this.food) {
      if (f.until && f.until < this.time) f.dead = true;   // carnica apodrece
      if (!f.dead) this.food[nf++] = f;
    }
    this.food.length = nf;

    this.censoAcc += dt;
    if (this.censoAcc >= 2) {
      this.censoAcc = 0;
      this.registro.censo(this.creatures, this.time,
        e => this.log('† ' + e.nome + ' extinta (viveu ' +
                      Math.round((e.fim - e.origem)) + 's, pico de ' + e.pico + ')'),
        e => this.log('nova espécie: ' + e.nome +
                      (e.pai && this.registro.especies.get(e.pai)
                        ? ' — separou-se de ' + this.registro.especies.get(e.pai).nome : '')));
    }

    this.foodDebt += params.foodRate * dt;
    while (this.foodDebt >= 1) { this.growFood(); this.foodDebt -= 1; }

    // Repovoamento de emergencia: extincao total e' um resultado legitimo da
    // ecologia, mas uma tela preta nao ensina nada a quem esta' olhando.
    if (this.creatures.length < CFG.creature.minCount) {
      this.log('repovoamento apos colapso');
      for (let i = this.creatures.length; i < 40; i++) {
        const c = new Creature(rand(0, CFG.world.w), rand(0, CFG.world.h), randomGenome());
        c.esp = this.registro.classificar(c.genome, this.time, null);
        this.creatures.push(c);
      }
    }
  }

  // --- deriva continental ---
  moverContinentes(dt) {
    const d = this.deriva;
    if (d.abertura === d.alvo) return;
    const passo = CFG.deriva.velocidade * dt;
    d.abertura += Math.sign(d.alvo - d.abertura) * Math.min(passo, Math.abs(d.alvo - d.abertura));
    this.expulsarDaFenda();
    if (Math.abs(d.abertura - d.alvo) < 0.001) {
      d.abertura = d.alvo;
      if (d.abertura === 1) this.log('a terra se partiu — dois continentes isolados');
      if (d.abertura === 0) this.reencontro();
    }
  }

  // A rocha subindo empurra quem estava em cima dela pro lado mais proximo,
  // e soterra a comida que ficou no caminho.
  expulsarDaFenda() {
    const d = this.deriva;
    if (d.abertura <= 0) return;
    const meia = (CFG.deriva.largura * d.abertura) / 2 + 2;
    const desvio = (x) => {
      for (const fx of d.xs) {
        let dx = x - fx;
        if (dx >  CFG.world.w / 2) dx -= CFG.world.w;
        if (dx < -CFG.world.w / 2) dx += CFG.world.w;
        if (Math.abs(dx) < meia) {
          return wrapPos(fx + (dx >= 0 ? meia : -meia), CFG.world.w);
        }
      }
      return null;
    };
    for (const c of this.creatures) {
      const novo = desvio(c.x);
      if (novo !== null) c.x = novo;
    }
    for (const f of this.food) {
      if (desvio(f.x) !== null) f.dead = true;   // soterrada
    }
  }

  // Quem esta' de que lado. Setor 0 e' a faixa entre as duas fendas.
  setor(x) {
    const d = this.deriva;
    return (x > d.xs[0] && x < d.xs[1]) ? 0 : 1;
  }

  separados(x1, x2) {
    return this.deriva.abertura > 0.35 && this.setor(x1) !== this.setor(x2);
  }

  // A fenda e' parede enquanto estiver aberta.
  naFenda(x) {
    const d = this.deriva;
    if (d.abertura <= 0) return false;
    const meia = (CFG.deriva.largura * d.abertura) / 2;
    for (const fx of d.xs) {
      let dx = x - fx;
      if (dx >  CFG.world.w / 2) dx -= CFG.world.w;
      if (dx < -CFG.world.w / 2) dx += CFG.world.w;
      if (Math.abs(dx) < meia) return true;
    }
    return false;
  }

  partir()  { this.deriva.alvo = 1; this.log('as placas começaram a se afastar'); }
  juntar()  { this.deriva.alvo = 0; this.log('as placas voltam a se encontrar'); }

  // O experimento de Darwin fechando o ciclo: separou, divergiu, reencontrou.
  // Se cada lado virou uma espécie diferente, o reencontro PROVA isso — elas
  // se cruzam de novo e simplesmente não se reproduzem.
  reencontro() {
    const dom = [0, 1].map(s => {
      const conta = new Map();
      for (const c of this.creatures) {
        if (this.setor(c.x) !== s) continue;
        conta.set(c.esp, (conta.get(c.esp) || 0) + 1);
      }
      let melhor = null, n = 0;
      for (const [id, q] of conta) if (q > n) { n = q; melhor = id; }
      return melhor;
    });
    const nome = id => (this.registro.especies.get(id) || {}).nome || '?';
    if (dom[0] && dom[1] && dom[0] !== dom[1]) {
      this.log('reencontro: ' + nome(dom[0]) + ' e ' + nome(dom[1]) +
               ' não cruzam mais — o isolamento virou espécie');
    } else {
      this.log('reencontro: as duas margens ainda são a mesma espécie');
    }
  }

  log(msg) {
    this.events.unshift({ t: this.time, msg });
    if (this.events.length > 40) this.events.pop();
  }

  // --- Catastrofes: o botao que transforma grafico em historia ---
  drought() {
    const keep = this.food.filter(() => Math.random() > 0.85);
    this.food = keep;
    this.seedPatches();
    this.log('SECA — comida dizimada, manchas mudaram de lugar');
  }

  plague() {
    for (const c of this.creatures) if (Math.random() < 0.6) c.dead = true;
    this.log('PRAGA — 60% da populacao caiu');
  }

  invasion() {
    for (let i = 0; i < 18; i++) {
      const g = randomGenome();
      g.size = 1.6; g.speed = 1.0; g.sense = 0.9; g.diet = 0.95;
      g.aggression = 0.9; g.metabolism = 1.1; g.maturity = 1.6; g.hue = 0;
      const inv = new Creature(rand(0, CFG.world.w), rand(0, CFG.world.h), g, 220);
      inv.esp = this.registro.classificar(g, this.time, null);
      this.creatures.push(inv);
    }
    this.log('INVASAO — 18 predadores vermelhos soltos no charco');
  }
}
