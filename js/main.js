import { CFG } from './config.js';
import { World } from './world.js';
import { Stats } from './stats.js';
import { GENES } from './genome.js';
import { lerp, clamp, wrapDelta } from './util.js';
import { usarCerebro, modoCerebro } from './brain.js';
import { NET } from './net.js';
import { desenharCriatura, definirModoCor, corDeEspecie } from './corpo.js';
import { Marcos } from './marcos.js';
import { predacao, catastrofe, alternarSom } from './som.js';

const cv = document.getElementById('mundo');
const ctx = cv.getContext('2d', { alpha: false });
const gcv = document.getElementById('grafico');
const gtx = gcv.getContext('2d');

const world = new World();
const stats = new Stats();
const marcos = new Marcos();
let predAnterior = 0;

const VELOCIDADES = [1, 2, 4, 8, 16, 32];
const ui = {
  vel: 1, pausado: false, modo: 'linhagem',
  params: { foodRate: 32 }, alvo: null, rastro: false
};

// ---------- canvas ----------
let escala = 1, offx = 0, offy = 0, dpr = 1;
function ajustar() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);   // 2 ja' basta; 3 so' custa
  const r = cv.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  escala = Math.min(r.width / CFG.world.w, r.height / CFG.world.h);
  offx = (r.width - CFG.world.w * escala) / 2;
  offy = (r.height - CFG.world.h * escala) / 2;
}
window.addEventListener('resize', ajustar);

// ---------- desenho ----------
function desenhar() {
  const r = cv.getBoundingClientRect();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = ui.rastro ? 'rgba(220,209,178,.17)' : '#dcd1b2';
  ctx.fillRect(0, 0, r.width, r.height);
  ctx.setTransform(escala * dpr, 0, 0, escala * dpr, offx * dpr, offy * dpr);

  // leito do charco
  ctx.fillStyle = ui.rastro ? 'rgba(200,197,166,.17)' : '#c8c5a6';
  ctx.fillRect(0, 0, CFG.world.w, CFG.world.h);

  // o clima, visivel: frio na margem de cima, quente na de baixo.
  // E' o mapa do mundo que as linhagens estao dividindo entre si.
  if (!gradClima) {
    gradClima = ctx.createLinearGradient(0, 0, 0, CFG.world.h);
    gradClima.addColorStop(0, 'rgba(92,116,128,.30)');
    gradClima.addColorStop(0.5, 'rgba(190,180,150,0)');
    gradClima.addColorStop(1, 'rgba(158,106,44,.30)');
  }
  ctx.fillStyle = gradClima;
  ctx.fillRect(0, 0, CFG.world.w, CFG.world.h);

  // manchas ferteis: sugerem por que a vida se acumula em certos lugares
  for (const p of world.patches) {
    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, CFG.food.spread * 2.1);
    gr.addColorStop(0, 'rgba(108,120,56,0.17)');
    gr.addColorStop(1, 'rgba(108,120,56,0)');
    ctx.fillStyle = gr;
    ctx.fillRect(p.x - 290, p.y - 290, 580, 580);
  }

  // comida: vegetal e carnica em passadas separadas
  // (2 trocas de estilo no frame inteiro, nao 2 mil)
  ctx.fillStyle = '#6c7838';
  for (const f of world.food) if (!f.meat) ctx.fillRect(f.x - 1.5, f.y - 1.5, 3, 3);
  ctx.fillStyle = '#9b4626';
  for (const f of world.food) if (f.meat) ctx.fillRect(f.x - 2, f.y - 2, 4, 4);

  // a rocha exposta pela deriva: nada cresce ali, ninguem atravessa
  if (world.deriva.abertura > 0) {
    const larg = CFG.deriva.largura * world.deriva.abertura;
    for (const fx of world.deriva.xs) {
      ctx.fillStyle = '#a2947a';
      ctx.fillRect(fx - larg / 2, 0, larg, CFG.world.h);
      ctx.strokeStyle = 'rgba(64,54,40,.45)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(fx - larg / 2, 0); ctx.lineTo(fx - larg / 2, CFG.world.h);
      ctx.moveTo(fx + larg / 2, 0); ctx.lineTo(fx + larg / 2, CFG.world.h);
      ctx.stroke();
      // estratos: a rocha tem camadas, e elas contam o tempo
      ctx.strokeStyle = 'rgba(88,74,54,.30)';
      for (let y = 14; y < CFG.world.h; y += 26) {
        ctx.beginPath();
        ctx.moveTo(fx - larg / 2, y);
        ctx.lineTo(fx + larg / 2, y + 5);
        ctx.stroke();
      }
    }
  }

  // criaturas: corpo inteiro derivado do genoma (ver corpo.js)
  // Acima de ~340 bichos ninguem distingue uma pata da outra: vale mais
  // manter o quadro fluido no i3 do que desenhar o que nao se ve'.
  const detalhe = world.creatures.length > 340 ? 0 : 1;
  for (const c of world.creatures) desenharCriatura(ctx, c, detalhe);

  // espécie escolhida no painel: onde ela vive, agora
  if (espSel) {
    ctx.strokeStyle = 'rgba(44,38,32,.55)';
    ctx.lineWidth = 1.3;
    for (const c of world.creatures) {
      if (c.esp !== espSel) continue;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.radius + 4.5, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  const a = ui.alvo;
  if (a && !a.dead) {
    ctx.strokeStyle = 'rgba(155,70,38,.9)';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(a.x, a.y, a.radius + 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(155,70,38,.30)';
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.arc(a.x, a.y, a.senseR, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

// ---------- grafico ----------
const SERIES = [
  { k: 'pop',   cor: '#2c2620', rot: 'população' },
  { k: 'size',  cor: '#b2842b', rot: 'tamanho' },
  { k: 'speed', cor: '#5d7a86', rot: 'velocidade' },
  { k: 'sense', cor: '#6c7838', rot: 'visão' },
  { k: 'diet',  cor: '#9b4626', rot: 'dieta' }
];

function desenharGrafico() {
  const W = gcv.width, H = gcv.height;
  gtx.clearRect(0, 0, W, H);
  if (stats.series.pop.length < 2) return;

  for (const s of SERIES) {
    const serie = stats.series[s.k];
    let lo, hi;
    if (s.k === 'pop') {
      lo = 0; hi = Math.max.apply(null, serie.concat([10]));
    } else {
      lo = Math.min.apply(null, serie);
      hi = Math.max.apply(null, serie);
      const folga = Math.max((hi - lo) * 0.25, 0.04);   // evita divisao por ~0
      lo -= folga; hi += folga;
    }
    gtx.strokeStyle = s.cor;
    gtx.lineWidth = s.k === 'pop' ? 1.6 : 1.1;
    gtx.globalAlpha = s.k === 'pop' ? 0.95 : 0.8;
    gtx.beginPath();
    for (let i = 0; i < serie.length; i++) {
      const x = (i / (CFG.sim.history - 1)) * W;
      const y = H - 4 - ((serie[i] - lo) / (hi - lo)) * (H - 8);
      i ? gtx.lineTo(x, y) : gtx.moveTo(x, y);
    }
    gtx.stroke();
  }
  gtx.globalAlpha = 1;
}

// ---------- a rede neural do especime ----------
// Cor dos sensores = de onde vem a informacao. Verde positivo, vermelho
// negativo, espessura = forca do peso. Nao e' enfeite: da' pra VER a
// criatura ligar 'ameaca perto' direto em 'vira pro outro lado'.
const CORES_IN = ['#8c806c','#8c806c','#8c806c','#b2842b',
                  '#6c7838','#6c7838','#6c7838',
                  '#9b4626','#9b4626','#9b4626',
                  '#7c5a33','#7c5a33','#7c5a33',
                  '#5d7a86','#5d7a86','#5d7a86',
                  '#5d7a86','#5d7a86'];

function sinapse(tx, x1, y1, x2, y2, v) {
  const a = Math.min(Math.abs(v) / 2.2, 0.75);
  if (a < 0.07) return;
  tx.strokeStyle = (v > 0 ? 'rgba(108,120,56,' : 'rgba(155,70,38,') + a.toFixed(2) + ')';
  tx.lineWidth = Math.min(Math.abs(v), 2.5) * 0.65;
  tx.beginPath(); tx.moveTo(x1, y1); tx.lineTo(x2, y2); tx.stroke();
}

function no(tx, x, y, r, cor) {
  tx.fillStyle = cor;
  tx.beginPath(); tx.arc(x, y, r, 0, Math.PI * 2); tx.fill();
}

function desenharRede(w) {
  const W = rcv.width, H = rcv.height;
  rtx.clearRect(0, 0, W, H);
  const xIn = 26, xHid = W / 2, xOut = W - 40;
  const yIn  = i => 10 + i * ((H - 20) / (NET.in - 1));
  const yHid = j => 26 + j * ((H - 52) / (NET.hid - 1));
  const yOut = k => H / 2 - 24 + k * 48;

  for (let j = 0; j < NET.hid; j++)
    for (let i = 0; i < NET.in; i++)
      sinapse(rtx, xIn, yIn(i), xHid, yHid(j), w[j * NET.in + i]);

  const base = NET.in * NET.hid + NET.hid;
  for (let k = 0; k < NET.out; k++)
    for (let j = 0; j < NET.hid; j++)
      sinapse(rtx, xHid, yHid(j), xOut, yOut(k), w[base + k * NET.hid + j]);

  for (let i = 0; i < NET.in; i++) no(rtx, xIn, yIn(i), 3, CORES_IN[i]);
  for (let j = 0; j < NET.hid; j++) no(rtx, xHid, yHid(j), 4.5, '#6b6050');
  for (let k = 0; k < NET.out; k++) no(rtx, xOut, yOut(k), 5, '#9b4626');

  rtx.fillStyle = '#6b6050';
  rtx.font = 'italic 9px Georgia, serif';
  rtx.textAlign = 'left';
  rtx.fillText('virar', xOut + 9, yOut(0) + 3);
  rtx.fillText('andar', xOut + 9, yOut(1) + 3);
}


// ---------- a arvore da vida ----------
// Cada linha horizontal e' uma especie existindo no tempo; o degrau vertical
// e' o instante da especiacao — quando aquela populacao deixou de conseguir
// cruzar com a mae. A cruz no fim e' extincao. Ninguem desenhou essa arvore:
// ela e' o registro que o proprio mundo produziu.
function desenharArvore() {
  const W = acv.width, H = acv.height;
  atx.clearRect(0, 0, W, H);
  const reg = world.registro;
  const todas = [...reg.especies.values()].filter(e => e.anunciada || e.pop > 0);
  if (!todas.length) return;

  const top = new Set(todas.slice().sort((a, b) => b.pico - a.pico)
                           .slice(0, 24).map(e => e.id));
  const linha = [];
  const filhas = id => todas.filter(e => e.pai === id && top.has(e.id))
                            .sort((a, b) => a.origem - b.origem);
  const visita = e => { linha.push(e); filhas(e.id).forEach(visita); };
  todas.filter(e => top.has(e.id) && (!e.pai || !top.has(e.pai)))
       .sort((a, b) => a.origem - b.origem).forEach(visita);
  if (!linha.length) return;

  const y = {};
  const passo = (H - 14) / Math.max(linha.length - 1, 1);
  linha.forEach((e, i) => { y[e.id] = 7 + i * passo; });
  const t1 = Math.max(world.time, 1);
  const px = t => 3 + (t / t1) * (W - 76);

  for (const e of linha) {
    if (e.pai === null || y[e.pai] === undefined) continue;
    atx.strokeStyle = 'rgba(124,90,51,.45)';
    atx.lineWidth = 1;
    atx.beginPath();
    atx.moveTo(px(e.origem), y[e.pai]);
    atx.lineTo(px(e.origem), y[e.id]);
    atx.stroke();
  }

  for (const e of linha) {
    const x1 = px(e.origem);
    const x2 = px(e.viva ? world.time : e.fim);
    atx.strokeStyle = corEsp(e.id);
    atx.lineWidth = Math.min(4, 1 + Math.log2(Math.max(e.pico, 1)) * 0.45);
    atx.globalAlpha = e.viva ? 1 : 0.4;
    atx.beginPath();
    atx.moveTo(x1, y[e.id]);
    atx.lineTo(Math.max(x2, x1 + 1.5), y[e.id]);
    atx.stroke();
    if (!e.viva) {
      atx.globalAlpha = 0.85;
      atx.fillStyle = '#9b4626';
      atx.fillRect(x2 - 1, y[e.id] - 2.5, 2, 5);
    }
    atx.globalAlpha = 1;
  }

  atx.font = 'italic 9px Georgia, serif';
  atx.textAlign = 'left';
  linha.filter(e => e.viva).sort((a, b) => b.pop - a.pop).slice(0, 5).forEach(e => {
    atx.fillStyle = corEsp(e.id);
    atx.fillText(e.nome.slice(0, 15), W - 72, y[e.id] + 3);
  });
}

// ---------- listas de especies e fosseis ----------
function itemTaxa(e, morta) {
  return '<li data-esp="' + e.id + '" class="' + (morta ? 'morta ' : '') +
         (espSel === e.id ? 'sel' : '') + '">' +
         '<i class="bolha" style="background:' + corEsp(e.id) + '"></i>' +
         '<span class="nome">' + e.nome + '</span>' +
         '<span class="qt">' + (morta ? Math.round(e.fim - e.origem) + 's' : e.pop) +
         '</span></li>';
}

function atualizarTaxa() {
  const reg = world.registro;
  const vivas = reg.vivas();
  const foss = reg.fosseis();
  el('conta-esp').textContent = vivas.length;
  el('conta-foss').textContent = foss.length;
  el('lista-esp').innerHTML = vivas.slice(0, 14).map(e => itemTaxa(e, false)).join('') ||
    '<li>ainda nenhuma</li>';
  el('lista-foss').innerHTML = foss.slice(0, 10).map(e => itemTaxa(e, true)).join('') ||
    '<li>ninguém se extinguiu ainda</li>';

  const fe = el('ficha-esp');
  const e = espSel ? reg.especies.get(espSel) : null;
  if (!e) { fe.hidden = true; return; }
  fe.hidden = false;
  const mae = e.pai ? reg.especies.get(e.pai) : null;
  const t = (k, v) => '<div class="par"><span>' + k + '</span><span>' + v + '</span></div>';
  fe.innerHTML = '<h3>' + e.nome + (e.viva ? '' : ' †') + '</h3>' +
    t('vivos agora', e.pop) +
    t('surgiu em', Math.round(e.origem) + 's') +
    (e.viva ? '' : t('extinta em', Math.round(e.fim) + 's')) +
    t('pico', e.pico) +
    t('nascidos', e.nascidos) +
    t('separou-se de', mae ? mae.nome : 'ninguém (fundadora)') +
    t('tamanho', e.rep.size.toFixed(2)) +
    t('dieta', e.rep.diet.toFixed(2)) +
    t('visão', e.rep.sense.toFixed(2)) +
    t('clima', e.rep.termo.toFixed(2));
}
// ---------- painel ----------
const el = id => document.getElementById(id);

// Rotulo em ingles no meio de uma prancha em portugues denuncia a origem
// do texto na hora. Aqui cada gene tem o nome que um naturalista usaria.
const NOME_GENE = {
  size: 'tamanho', speed: 'velocidade', sense: 'visão', diet: 'dieta',
  metabolism: 'metabolismo', maturity: 'maturidade', aggression: 'agressão',
  termo: 'clima', toxina: 'veneno', ornamento: 'enfeite',
  preferencia: 'gosto', investimento: 'investimento'
};
const nomeGene = g => NOME_GENE[g] || g;
const rcv = document.getElementById('rede');
const rtx = rcv.getContext('2d');
const acv = document.getElementById('arvore');
const atx = acv.getContext('2d');
let espSel = null;
let gradClima = null;
const corEsp = corDeEspecie;
const barras = el('barras');
GENES.forEach(g => {
  const d = document.createElement('div');
  d.className = 'barra';
  d.innerHTML = '<span>' + nomeGene(g) + '</span><div class="trilho"><i id="b-' + g +
                '"></i></div><em id="n-' + g + '">–</em>';
  barras.appendChild(d);
});
el('legenda').innerHTML = SERIES.map(s =>
  '<span style="color:' + s.cor + '">' + s.rot + '</span>').join('');

let fps = 60, ultimoPainel = 0;
function atualizarPainel() {
  el('v-pop').textContent = stats.now.pop;
  el('v-gen').textContent = stats.now.gen.toFixed(1);
  el('v-food').textContent = world.food.length;
  el('v-fps').textContent = Math.round(fps);

  for (const g of GENES) {
    const faixa = CFG.genes[g];
    const v = stats.now[g];
    el('b-' + g).style.width = (clamp((v - faixa.min) / (faixa.max - faixa.min), 0, 1) * 100) + '%';
    el('n-' + g).textContent = v.toFixed(2);
  }

  el('eventos').innerHTML = world.events.slice(0, 8).map(e =>
    '<li><b>' + Math.floor(e.t) + 's</b> ' + e.msg + '</li>').join('') ||
    '<li>nada de mais até agora</li>';

  const a = ui.alvo;
  const ficha = el('ficha');
  if (!a) { ficha.hidden = true; return; }
  ficha.hidden = false;
  el('f-id').textContent = '#' + a.id + (a.dead ? ' †' : '');
  const par = (k, v) =>
    '<div class="par"><span>' + k + '</span><span>' + v + '</span></div>';
  el('f-corpo').innerHTML =
    par('estado', a.dead ? 'morreu de ' + a.causa : 'vivo') +
    par('espécie', (world.registro.especies.get(a.esp) || {}).nome || '—') +
    par('geração', a.gen) +
    par('energia', a.energy.toFixed(0) + ' / ' + a.reproAt.toFixed(0)) +
    par('idade', a.age.toFixed(0) + 's / ' + a.lifespan.toFixed(0) + 's') +
    par('filhos', a.children) +
    par('presas', a.kills) +
    GENES.map(g => par(nomeGene(g), a.genome[g].toFixed(2))).join('') +
    par('linhagem', a.ancestry.length ? a.ancestry.join(' › ') : 'fundador');

  desenharRede(a.genome.brain);
  el('rede-nota').textContent = modoCerebro() === 'neural'
    ? 'o cérebro deste indivíduo — herdado do pai com mutação, nunca projetado'
    : 'a rede está no genoma, mas quem decide agora são as regras';
}

// ---------- loop ----------
let acc = 0, anterior = performance.now();
function frame(agora) {
  const real = Math.min((agora - anterior) / 1000, 0.25);
  anterior = agora;
  fps = fps * 0.9 + (1 / Math.max(real, 0.001)) * 0.1;

  if (!ui.pausado) {
    // Passo fixo: a fisica nao muda quando o FPS varia, e acelerar o tempo
    // vira so' "dar mais passos por quadro".
    acc += real * ui.vel;
    let passos = 0;
    while (acc >= CFG.sim.dt && passos < CFG.sim.maxStepsPerFrame) {
      world.step(CFG.sim.dt, ui.params);
      stats.sample(world, CFG.sim.dt);
      marcos.observar(world, stats, CFG.sim.dt);
      acc -= CFG.sim.dt; passos++;
    }
    if (acc > CFG.sim.dt * 60) acc = 0;   // acelerado demais: nao acumula divida
  }

  if (world.predations > predAnterior) {
    const novas = world.predations - predAnterior;
    predAnterior = world.predations;
    if (novas < 40) predacao(stats.now.size);   // enxurrada nao vira metralhadora
  }

  desenhar();
  if (agora - ultimoPainel > 200) {
    atualizarPainel(); desenharGrafico();
    atualizarTaxa(); desenharArvore();
    ultimoPainel = agora;
  }
  requestAnimationFrame(frame);
}

// ---------- interacao ----------
cv.addEventListener('click', e => {
  const r = cv.getBoundingClientRect();
  const mx = (e.clientX - r.left - offx) / escala;
  const my = (e.clientY - r.top - offy) / escala;
  let melhor = null, bd = 900;
  for (const c of world.creatures) {
    const dx = wrapDelta(c.x - mx, CFG.world.w);
    const dy = wrapDelta(c.y - my, CFG.world.h);
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; melhor = c; }
  }
  ui.alvo = melhor;
  el('dica').style.opacity = melhor ? '0' : '1';
});

for (const alvo of ['lista-esp', 'lista-foss']) {
  el(alvo).onclick = ev => {
    const li = ev.target.closest('li[data-esp]');
    if (!li) return;
    const id = +li.dataset.esp;
    espSel = (espSel === id) ? null : id;
    atualizarTaxa();
  };
}

el('s-food').addEventListener('input', e => {
  ui.params.foodRate = +e.target.value;
  el('o-food').textContent = e.target.value;
});
el('s-mut').addEventListener('input', e => {
  CFG.mutation.rate = +e.target.value / 100;
  el('o-mut').textContent = e.target.value;
});
el('s-vel').addEventListener('input', e => {
  ui.vel = VELOCIDADES[+e.target.value];
  el('o-vel').textContent = ui.vel;
});

el('b-seca').onclick    = () => { world.drought(); catastrofe(); };
el('b-praga').onclick   = () => { world.plague(); catastrofe(); };
el('b-invasao').onclick = () => { world.invasion(); catastrofe(); };
el('b-deriva').onclick = e => {
  const partido = world.deriva.alvo === 1;
  if (partido) world.juntar(); else world.partir();
  e.target.classList.toggle('on', !partido);
  e.target.textContent = partido ? 'deriva' : 'reunir';
  catastrofe();
};
el('b-rastro').onclick  = e => {
  ui.rastro = !ui.rastro;
  e.target.classList.toggle('on', ui.rastro);
};
el('b-som').onclick = e => {
  e.target.classList.toggle('on', alternarSom());
};
el('b-pausa').onclick   = e => {
  ui.pausado = !ui.pausado;
  e.target.textContent = ui.pausado ? 'continuar' : 'pausar';
  e.target.classList.toggle('on', ui.pausado);
};
el('b-reset').onclick = () => {
  world.reset(); stats.reset(); marcos.reset(); espSel = null;
  ui.alvo = null; predAnterior = 0;
};

document.querySelectorAll('#modo-cor button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#modo-cor button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    ui.modo = b.dataset.modo;
  };
});

document.querySelectorAll('#modo-cerebro button').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#modo-cerebro button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    usarCerebro(b.dataset.cerebro);
    world.log('quem decide agora: ' + b.dataset.cerebro);
  };
});

addEventListener('keydown', e => {
  if (e.code === 'Space') { e.preventDefault(); el('b-pausa').click(); }
});

ajustar();

// Atalho de captura/teste: ?passos=N adianta a simulacao sem depender de
// requestAnimationFrame (que fica congelado no Chrome headless).
const qs = new URLSearchParams(location.search);
const adiantar = +(qs.get('passos') || 0);
if (qs.get('deriva')) world.partir();
if (qs.get('cerebro')) {
  usarCerebro(qs.get('cerebro'));
  const bt = document.querySelector('[data-cerebro="' + qs.get('cerebro') + '"]');
  if (bt) { document.querySelectorAll('#modo-cerebro button').forEach(x => x.classList.remove('on')); bt.classList.add('on'); }
}
if (adiantar > 0) {
  for (let i = 0; i < adiantar; i++) {
    world.step(CFG.sim.dt, ui.params);
    stats.sample(world, CFG.sim.dt);
    marcos.observar(world, stats, CFG.sim.dt);
  }
  predAnterior = world.predations;
  if (qs.get('modo')) {
    ui.modo = qs.get('modo');
    definirModoCor(ui.modo);
    const bm = document.querySelector('[data-modo="' + ui.modo + '"]');
    if (bm) {
      document.querySelectorAll('#modo-cor button').forEach(x => x.classList.remove('on'));
      bm.classList.add('on');
    }
  }
  if (qs.get('cerebro')) { usarCerebro(qs.get('cerebro')); }
  if (qs.get('alvo') && world.creatures.length) { ui.alvo = world.creatures[0]; }
  desenhar(); atualizarPainel(); desenharGrafico();
  atualizarTaxa(); desenharArvore();
}

requestAnimationFrame(frame);
