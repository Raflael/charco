import { CFG } from './config.js';
import { randomGenome, mutate, recombinar } from './genome.js';
import { cerebro } from './brain.js';
import { wrapPos, clamp, conforto, prendeY } from './util.js';

const C = CFG.creature;
let NEXT_ID = 1;

export class Creature {
  constructor(x, y, genome, energy, gen = 0, ancestry = []) {
    this.id = NEXT_ID++;
    this.x = x; this.y = y;
    this.genome = genome || randomGenome();
    this.energy = energy ?? C.startEnergy;
    this.age = 0;
    this.gen = gen;
    this.ancestry = ancestry;
    this.angle = Math.random() * Math.PI * 2;
    this.wander = this.angle;
    this.dead = false;
    this.causa = null;
    this.kills = 0;
    this.children = 0;
    this.esp = 0;          // espécie: o world atribui ao nascer
    this.pronta = 0;       // segundos no cio, esperando parceiro
    this.ultimoCruz = -1;  // trava: um cruzamento por passo

    const g = this.genome;
    // --- Fenotipo: derivado uma vez, lido todo frame ---
    this.radius = 2.5 + g.size * 5.5;
    this.maxSpeed = C.maxSpeed * g.speed;
    this.senseR = C.maxSense * g.sense;
    this.lifespan = C.lifespan / g.metabolism;
    this.reproAt = g.maturity * 100;

    // Eficiencia digestiva dos dois lados. O expoente < 1 e' o que torna o
    // onivoro viavel: sem ele a dieta intermediaria e' pior que os dois
    // extremos, e a carnivoria nunca consegue evoluir.
    this.herbEff = Math.pow(1 - g.diet, C.dietSharp);
    this.carnEff = Math.pow(g.diet, C.dietSharp);

    // Metabolismo acelerado digere mais rapido, mas queima mais e vive menos:
    // e' o eixo r/K da simulacao (pressa x eficiencia).
    this.digest = Math.sqrt(g.metabolism);

    // Lei de Kleiber: 'size' e' comprimento, massa ~ size^3, metabolismo basal
    // ~ massa^0.75 -> size^2.25. A biologia certa E' o balanceamento certo:
    // e' isso que impede a corrida armamentista de tamanho.
    this.massa = Math.pow(g.size, 2.25);
    this.basal = C.basalCost * this.massa * g.metabolism;
    this.moveK = C.moveCost * g.size * g.size * g.speed * g.speed;
    this.senseK = C.senseCost * g.sense;
    // A boca nao cresce junto com o corpo, senao ser grande daria area de
    // captura de graca e o gene size venceria sozinho.
    this.mouth = C.eatRadius + 4 * Math.sqrt(g.size);
  }

  // Quanto este item vale pra mim (0 = nao me serve)
  valor(item) {
    return item.meat ? this.carnEff : this.herbEff;
  }

  perceive(world) {
    const p = { food: null, prey: null, threat: null, mate: null };
    let bf = Infinity, bp = Infinity, bt = Infinity, bm = Infinity;
    const g = this.genome;
    const r = this.senseR;

    const parte = world.deriva.abertura > 0.35;
    world.foodGrid.query(this.x, this.y, r, (f, d2, dx, dy) => {
      if (parte && world.separados(this.x, f.x)) return;
      if (this.valor(f) < 0.2) return;            // nao persigo o que nao digiro
      if (d2 < bf) { bf = d2; p.food = { dx, dy, ref: f }; }
    });

    world.grid.query(this.x, this.y, r, (o, d2, dx, dy) => {
      if (o === this || d2 === 0) return;
      if (parte && world.separados(this.x, o.x)) return;
      const ratio = g.size / o.genome.size;
      if (ratio > C.predEdge && g.diet > C.huntDiet) {
        // presa enfeitada salta aos olhos: conta como se estivesse mais perto
        const visivel = d2 / (1 + o.genome.ornamento * C.ornRisco);
        if (visivel < bp) { bp = visivel; p.prey = { dx, dy, ref: o }; }
      } else if (ratio < 1 / C.predEdge && o.genome.diet > C.huntDiet) {
        if (d2 < bt) { bt = d2; p.threat = { dx, dy, ref: o }; }
      }
      // Parceiro: so' procuro quando estou no cio, e so' vejo quem pode
      // cruzar comigo. Bicho de outra especie nem entra no radar.
      if (this.pronta > 0 && o.pronta > 0 && o.esp === this.esp) {
        // Quem poe mais no filho tem mais a perder, e escolhe melhor.
        const exigencia = g.preferencia * g.investimento * 2;
        const atrai = 1 + exigencia * o.genome.ornamento * C.ornAtracao;
        const score = d2 / atrai;   // enfeitado parece mais perto
        if (score < bm) { bm = score; p.mate = { dx, dy, ref: o }; }
      }
    });
    return p;
  }

  update(dt, world) {
    const g = this.genome;
    const p = this.perceive(world);
    const want = cerebro().decide(this, p);

    // Giro com inercia: ninguem vira instantaneo, seja decidindo por regra
    // ou por rede neural. E' o mesmo limite fisico pros dois.
    this.angle += clamp(want.turn, -1, 1) * C.turnRate * dt;

    const effort = clamp(want.effort, 0, 1);
    const v = this.maxSpeed * effort;
    const xAnt = this.x;
    this.x = wrapPos(this.x + Math.cos(this.angle) * v * dt, CFG.world.w);
    if (world.naFenda(this.x)) {
      this.x = xAnt;
      this.angle = Math.PI - this.angle;   // ricocheteia em vez de raspar
    }
    this.y = prendeY(this.y + Math.sin(this.angle) * v * dt, this.radius);

    // A conta que segura o projeto de pe':
    // grande + rapido + enxergando longe TEM que doer.
    // Termorregulacao: viver fora da sua faixa custa, e custa proporcional
    // a massa, igual ao metabolismo basal. E' o que prende cada linhagem a
    // sua latitude — e o que separa as populacoes.
    const conf = conforto(g.termo, this.y);
    const clima = C.termoK * (1 - conf) * this.massa;
    const veneno = C.toxK * g.toxina * this.massa;   // veneno nao e' de graca
    const enfeite = C.ornK * g.ornamento * this.massa;
    this.energy -= (this.basal + this.moveK * effort * effort + this.senseK
                    + clima + veneno + enfeite) * dt;

    this.eat(world);
    this.age += dt;

    if (this.energy <= 0 || this.age > this.lifespan) {
      this.dead = true;
      this.causa = this.energy <= 0 ? 'fome' : 'velhice';
      return;
    }
    if (this.energy > this.reproAt) {
      this.pronta += dt;
      this.tentarCruzar(world);
      // Partenogênese de emergência: sem parceiro por tempo demais, ela se
      // divide sozinha. Acontece na natureza e impede que a população trave
      // quando a densidade cai — sem isso, uma seca vira extinção garantida.
      if (this.pronta > C.esperaParceiro) { this.reproduce(world); this.pronta = 0; }
    } else {
      this.pronta = 0;
    }
  }

  tentarCruzar(world) {
    if (world.creatures.length >= C.maxCount) return;
    if (this.ultimoCruz === world.passo) return;

    // Nao e' mais 'o primeiro que aparecer': junta os candidatos e ESCOLHE.
    // O peso de cada um e' o enfeite dele visto pelo gosto de quem escolhe —
    // com preferencia 0 a escolha e' indiferente, que e' o estado ancestral.
    const cand = [];
    world.grid.query(this.x, this.y, this.radius + 11, (o) => {
      if (o === this || o.dead || o.pronta <= 0) return;
      if (o.ultimoCruz === world.passo) return;
      if (o.esp !== this.esp) return;   // especies diferentes nao cruzam
      if (cand.length < 8) cand.push(o);
    });
    if (!cand.length) return;

    // Entre os que ja' estao encostando, ainda prefere o mais enfeitado —
    // mas o grosso da escolha aconteceu la' atras, no rumo que ela tomou.
    let escolhido = cand[0], melhor = -1;
    for (const o of cand) {
      const exigencia = this.genome.preferencia * this.genome.investimento * 2;
      const nota = (1 + exigencia * o.genome.ornamento * C.ornAtracao)
                   * (0.7 + Math.random() * 0.6);
      if (nota > melhor) { melhor = nota; escolhido = o; }
    }

    const par = (o) => {
      if (o.dead || o.pronta <= 0) return;

      // Cada um poe o que o proprio gene manda. Quem poe pouco volta rapido
      // ao cio e pode cruzar de novo; quem poe muito fica fora de circulacao.
      const ea = this.energy * C.custoCruz * 2 * this.genome.investimento;
      const eb = o.energy * C.custoCruz * 2 * o.genome.investimento;
      this.energy -= ea; o.energy -= eb;
      this.pronta = 0; o.pronta = 0;
      this.ultimoCruz = o.ultimoCruz = world.passo;
      this.children++; o.children++;

      // O filho so' vinga se veio com bagagem. A energia ja' foi gasta de
      // qualquer jeito — investir pouco economiza, mas aposta.
      const dote = ea + eb;
      if (dote < C.minViavel && Math.random() > dote / C.minViavel) {
        world.natimortos++;
        return;
      }

      const anc = this.ancestry.length >= 6
        ? [...this.ancestry.slice(1), this.id]
        : [...this.ancestry, this.id];
      const filho = new Creature(
        wrapPos((this.x + o.x) / 2, CFG.world.w),
        prendeY((this.y + o.y) / 2, 4),
        recombinar(this.genome, o.genome), ea + eb,
        Math.max(this.gen, o.gen) + 1, anc
      );
      filho.espPai = this.esp;
      world.spawnQueue.push(filho);
      world.births++; world.cruzamentos++;
    };

    par(escolhido);
  }

  eat(world) {
    world.foodGrid.query(this.x, this.y, this.mouth + CFG.food.radius, (f) => {
      if (f.dead) return;
      const eff = this.valor(f);
      if (eff < 0.15) return;
      f.dead = true;
      this.energy += f.energy * eff * this.digest;
      if (f.meat) world.scavenged++; else world.foodEaten++;
    });

    if (this.genome.diet > C.huntDiet) {
      world.grid.query(this.x, this.y, this.radius + 6, (o) => {
        if (o === this || o.dead) return;
        if (this.genome.size / o.genome.size <= C.predEdge) return;
        const tox = o.genome.toxina;
        if (tox > 0.02) {
          // Mordeu um toxico: perde energia de qualquer jeito, e muitas vezes
          // cospe a presa viva. E' esse cuspe que da' vantagem individual ao
          // veneno — sem ele so' os parentes se beneficiariam.
          this.energy -= C.toxDano * tox;
          world.envenenamentos++;
          if (Math.random() < tox * C.toxRejeita) return;   // cuspida, sobrevive
        }
        o.dead = true;
        o.causa = 'predado';
        this.energy += Math.max(o.energy, 10) * C.predGain * this.carnEff * this.digest;
        this.kills++;
        world.predations++;
      });
    }
  }

  reproduce(world) {
    if (world.creatures.length >= C.maxCount) return;
    // Partenogenese agora CUSTA: sem isso, quem nao e' escolhido apenas se
    // clona, ninguem perde nada por ser preterido, e nenhum enfeite compensa.
    const share = this.energy * C.childShare * C.custoParteno;
    this.energy -= share;
    if (share < C.minViavel && Math.random() > share / C.minViavel) {
      world.natimortos++;
      return;
    }
    this.children++;
    const anc = this.ancestry.length >= 6
      ? [...this.ancestry.slice(1), this.id]
      : [...this.ancestry, this.id];
    const bebe = new Creature(
      wrapPos(this.x + (Math.random() - 0.5) * 18, CFG.world.w),
      prendeY(this.y + (Math.random() - 0.5) * 18, 4),
      mutate(this.genome), share, this.gen + 1, anc
    );
    bebe.espPai = this.esp;
    world.spawnQueue.push(bebe);
    world.births++;
  }
}
