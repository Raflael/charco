import { World } from './js/world.js';
import { usarCerebro } from './js/brain.js';

// Uso: node sim.mjs [regras|neural] [minutos] [fartura]
const modo = process.argv[2] || 'regras';
const mins = +(process.argv[3] || 10);
const fartura = +(process.argv[4] || 32);
usarCerebro(modo);

const w = new World();
const G = ['size','speed','sense','diet','metabolism','maturity'];
const avg = k => w.creatures.reduce((a,c)=>a+c.genome[k],0)/(w.creatures.length||1);
const sd  = k => { const m=avg(k); return Math.sqrt(w.creatures.reduce((a,c)=>a+(c.genome[k]-m)**2,0)/(w.creatures.length||1)); };

console.log('cerebro:', modo, '| fartura:', fartura, '| ' + mins + ' min\n');
console.log('t\tpop\tger\t' + G.map(g=>g.slice(0,4)).join('\t') + '\tsdSz\t%carn');
const t0 = Date.now();
for (let s = 0; s < mins * 60; s++) {
  for (let i = 0; i < 60; i++) w.step(1/60, { foodRate: fartura });
  if (s % 60 === 59 || s < 1) {
    const ger = w.creatures.reduce((a,c)=>a+c.gen,0)/(w.creatures.length||1);
    const carn = w.creatures.filter(c=>c.genome.diet>0.5).length;
    console.log((s+1) + '\t' + w.creatures.length + '\t' + ger.toFixed(1) + '\t'
      + G.map(g=>avg(g).toFixed(2)).join('\t') + '\t' + sd('size').toFixed(2)
      + '\t' + Math.round(100*carn/(w.creatures.length||1)) + '%');
  }
}
console.log('\npredacoes:', w.predations, '| carnica:', w.scavenged, '| vegetais:', w.foodEaten,
            '| nascimentos:', w.births);
console.log('colapsos:', w.events.filter(e=>e.msg.includes('repovoamento')).length,
            '| tempo real:', ((Date.now()-t0)/1000).toFixed(1) + 's');
