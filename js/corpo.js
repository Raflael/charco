import { lerp, clamp } from './util.js';

// ---------------------------------------------------------------------------
// O FENOTIPO E' O GENE.
// Nenhuma criatura tem sprite desenhado por ninguem: carapaca, olho, antena,
// visceras, mandibula, espinho e pluma saem todos dos genes.
//
// O desenho segue prancha de microscopia — um cladocero visto no aumento:
// corpo translucido com orgaos aparecendo por dentro, carapaca reticulada,
// hachura de gravura acompanhando a curva, e contorno de peso variavel (a
// linha engrossa embaixo, onde a sombra cai, como numa pena de bico fino).
//
// Custo: 400 corpos desenhados a mao por frame derrubariam a maquina. Como a
// populacao forma clados, primos sao quase identicos — entao o corpo e'
// rasterizado uma vez por "especie aproximada" e reaproveitado. O que nao
// cabe num bitmap (patas remando, cauda, plumas, ovos) e' desenhado vivo.
// ---------------------------------------------------------------------------

const cache = new Map();
const LIMITE = 600;
const SS = 3;              // supersample: traco fino precisa de resolucao
let modoCor = 'linhagem';

export function definirModoCor(m) {
  if (m !== modoCor) { modoCor = m; cache.clear(); }
}

// --------------------------- pigmentos ---------------------------
// Faixa das terras: ocre, siena, umber, terra verde, oxido de ferro.
const TERRA_MIN = 24, TERRA_MAX = 94;
const terra = (t, s, l) => ({ h: lerp(TERRA_MIN, TERRA_MAX, clamp(t, 0, 1)), s, l });

export function corDeEspecie(id) {
  const t = (id * 0.381966) % 1;
  const l = [27, 38, 52][id % 3];
  return 'hsl(' + Math.round(lerp(TERRA_MIN, TERRA_MAX, t)) + ' 33% ' + l + '%)';
}

export function matiz(c) {
  const g = c.genome;
  switch (modoCor) {
    case 'dieta':
      return { h: lerp(100, 14, g.diet), s: lerp(28, 52, g.diet), l: lerp(45, 37, g.diet) };
    case 'tamanho': {
      const t = clamp((g.size - 0.25) / 1.95, 0, 1);
      return { h: lerp(52, 24, t), s: lerp(30, 40, t), l: lerp(54, 30, t) };
    }
    case 'idade': {
      const t = clamp(c.age / c.lifespan, 0, 1);
      return { h: lerp(92, 32, t), s: lerp(34, 14, t), l: lerp(47, 36, t) };
    }
    case 'toxina': {
      const t = clamp(g.toxina, 0, 1);
      return { h: lerp(40, 8, t), s: lerp(8, 62, t), l: lerp(58, 34, t) };
    }
    case 'especie': {
      const t = (c.esp * 0.381966) % 1;
      return terra(t, 33, [27, 38, 52][c.esp % 3]);
    }
    default:
      return terra(g.hue / 360, 31, 27 + ((g.hue | 0) % 3) * 12);
  }
}

function tom(k, dl, ds, alpha) {
  const l = clamp(k.l + (dl || 0), 0, 100);
  const s = clamp(k.s + (ds || 0), 0, 100);
  return 'hsl(' + Math.round(k.h) + ' ' + s + '% ' + l + '%' +
         (alpha !== undefined ? ' / ' + alpha : '') + ')';
}

const NANQUIM = 'rgba(40,34,27,';

function chave(c) {
  const g = c.genome;
  return modoCor + '|' + Math.round(g.hue / 8) + '|' + Math.round(g.size * 12) +
         '|' + Math.round(g.diet * 8) + '|' + Math.round(g.speed * 6) +
         '|' + Math.round(g.sense * 5) + '|' + Math.round(g.aggression * 4) +
         '|' + Math.round((g.toxina || 0) * 5) +
         (modoCor === 'idade' ? '|' + Math.round((c.age / c.lifespan) * 5) : '') +
         (modoCor === 'especie' ? '|' + c.esp : '');
}

// Aleatoriedade estavel: primos compartilham as mesmas pequenas assimetrias,
// entao o cache continua valendo e mesmo assim nenhum clado sai igual a outro.
function semente(g) {
  return (g.hue * 7.13 + g.size * 31.7 + g.diet * 17.3) % 1;
}

// --------------------------- o corpo ---------------------------

function contornoCarapaca(x, rx, ry, espinha, rostro) {
  x.beginPath();
  x.moveTo(rx * (0.88 + rostro * 0.22), ry * 0.16);          // ponta do rostro
  x.quadraticCurveTo(rx * 1.02, -ry * 0.44, rx * 0.52, -ry * 0.74);
  x.bezierCurveTo(rx * 0.05, -ry * 1.06, -rx * 0.62, -ry * 0.94,
                  -rx * 0.90, -ry * 0.34);                    // dorso
  x.lineTo(-rx * (0.98 + espinha), -ry * 0.02);               // espinha caudal
  x.lineTo(-rx * 0.88, ry * 0.30);
  x.bezierCurveTo(-rx * 0.46, ry * 1.02, rx * 0.34, ry * 0.94,
                  rx * 0.78, ry * 0.52);                      // ventre
  x.closePath();
}

function rasterizar(c) {
  const g = c.genome;
  const r = c.radius;
  const sd = semente(g);

  const rx = r * (1 + clamp(g.speed, 0, 1.6) * 0.40);
  const ry = r * (1 - clamp(g.speed, 0, 1.6) * 0.12);
  const espinha = 0.22 + clamp(g.speed, 0, 1.6) * 0.45;   // quem corre tem cauda
  const rostro = clamp(g.diet, 0, 1) * 0.5;
  const pad = r * 1.5 + 7;

  const cv = document.createElement('canvas');
  cv.width  = Math.ceil((rx * (2 + espinha) + pad) * SS);
  cv.height = Math.ceil((ry * 2.4 + pad) * SS);
  const x = cv.getContext('2d');
  x.scale(SS, SS);
  const cx = rx * (1 + espinha) + pad / 2, cy = (ry * 2.4 + pad) / 2;
  x.translate(cx, cy);
  x.lineJoin = 'round';

  const k = matiz(c);

  // ---- sombra: so' uma meia-lua sob a barriga. A silhueta inteira
  //      deslocada borrava o bicho e engordava a forma. ----
  x.save();
  x.beginPath();
  x.rect(-rx * 2, ry * 0.1, rx * 4, ry * 2);
  x.clip();
  x.translate(ry * 0.10, ry * 0.20);
  x.fillStyle = 'rgba(74,76,58,.14)';
  contornoCarapaca(x, rx, ry, espinha, rostro);
  x.fill();
  x.restore();

  // ---- corpo translucido ----
  contornoCarapaca(x, rx, ry, espinha, rostro);
  x.fillStyle = tom(k, 4, -6, 0.88);
  x.fill();

  // tudo o que vem agora fica DENTRO da carapaca
  x.save();
  contornoCarapaca(x, rx, ry, espinha, rostro);
  x.clip();

  // luz entrando pelo dorso
  const luz = x.createLinearGradient(0, -ry, 0, ry);
  luz.addColorStop(0, tom(k, 16, -10, 0.85));
  luz.addColorStop(0.55, tom(k, 0, 0, 0.1));
  luz.addColorStop(1, tom(k, -16, 4, 0.5));
  x.fillStyle = luz;
  x.fillRect(-rx * 2, -ry * 2, rx * 4, ry * 4);

  // intestino: a alca escura que se ve' nos cladoceros vivos
  x.strokeStyle = tom(k, -26, 12, 0.55);
  x.lineWidth = ry * 0.20;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(rx * 0.52, -ry * 0.02);
  x.bezierCurveTo(rx * 0.1, ry * 0.42, -rx * 0.34, ry * 0.30, -rx * 0.74, -ry * 0.04);
  x.stroke();

  // camara de incubacao, na garupa
  x.fillStyle = tom(k, 13, -12, 0.5);
  x.beginPath();
  x.ellipse(-rx * 0.46, -ry * 0.26, rx * 0.30, ry * 0.34, -0.2, 0, Math.PI * 2);
  x.fill();

  // reticulado da carapaca: a malha losangular so' aparece em bicho grande,
  // como na carapaca de verdade
  if (g.size > 0.7) {
    x.strokeStyle = NANQUIM + (0.07 + g.size * 0.05).toFixed(2) + ')';
    x.lineWidth = 0.35;
    const passo = ry * 0.42;
    for (let i = -8; i <= 8; i++) {
      x.beginPath();
      x.moveTo(-rx * 1.6, i * passo);
      x.lineTo(rx * 1.6, i * passo + ry * 1.5);
      x.stroke();
      x.beginPath();
      x.moveTo(-rx * 1.6, i * passo + ry * 1.5);
      x.lineTo(rx * 1.6, i * passo);
      x.stroke();
    }
  }

  // hachura de gravura acompanhando a curva do ventre
  x.strokeStyle = NANQUIM + '0.13)';
  x.lineWidth = 0.4;
  const nh = 5 + Math.round(g.size * 4);
  for (let i = 0; i < nh; i++) {
    const t = i / nh;
    x.beginPath();
    x.moveTo(rx * (0.75 - t * 1.5), ry * (0.30 + t * 0.2));
    x.quadraticCurveTo(rx * (0.2 - t * 1.2), ry * 1.0,
                       -rx * (0.2 + t * 0.9), ry * 0.55);
    x.stroke();
  }
  x.restore();

  // ---- contorno de peso variavel: fino por cima, encorpado embaixo ----
  contornoCarapaca(x, rx, ry, espinha, rostro);
  x.strokeStyle = NANQUIM + '0.55)';
  x.lineWidth = 0.7;
  x.stroke();

  x.save();
  x.beginPath();
  x.rect(-rx * 2, 0, rx * 4, ry * 2.2);   // so' a metade de baixo
  x.clip();
  contornoCarapaca(x, rx, ry, espinha, rostro);
  x.strokeStyle = NANQUIM + '0.72)';
  x.lineWidth = 1.25;
  x.stroke();
  x.restore();

  // ---- franja ventral: a fileira de cerdas na abertura da carapaca ----
  x.strokeStyle = NANQUIM + '0.30)';
  x.lineWidth = 0.34;
  const nc = 7 + Math.round(g.size * 4);
  for (let i = 0; i < nc; i++) {
    const t = i / (nc - 1);
    const px = lerp(rx * 0.72, -rx * 0.80, t);
    const py = ry * (0.62 + Math.sin(t * Math.PI) * 0.30);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px - ry * 0.06, py + ry * 0.20);
    x.stroke();
  }

  // ---- olho composto ----
  // Olho contido: metade do tamanho anterior. Os raios viravam uma roda de
  // carroca; facetas de verdade sao pontos, e sugeridos, nao desenhados.
  const ro = clamp(0.13 + g.sense * 0.20, 0.13, 0.36) * ry;
  const ox = rx * 0.55, oy = -ry * 0.26;
  x.fillStyle = 'rgba(30,26,20,.88)';
  x.beginPath();
  x.arc(ox, oy, ro, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = 'rgba(228,220,198,.20)';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + sd * 6;
    x.beginPath();
    x.arc(ox + Math.cos(a) * ro * 0.52, oy + Math.sin(a) * ro * 0.52,
          ro * 0.17, 0, Math.PI * 2);
    x.fill();
  }
  x.fillStyle = 'rgba(246,241,224,.9)';
  x.beginPath();
  x.arc(ox + ro * 0.32, oy - ro * 0.34, ro * 0.30, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = NANQUIM + '0.45)';
  x.lineWidth = 0.4;
  x.beginPath();
  x.arc(ox, oy, ro, 0, Math.PI * 2);
  x.stroke();

  // ---- antena natatoria bifida, com cerdas ----
  // Antena natatoria: sai da cabeca, arqueia pra frente e abre em dois
  // ramos, cada um com cerdas finas. E' o remo do bicho — no cladocero
  // real e' com ela que ele da' o tranco, nao com a cauda.
  const comp = rx * (0.42 + clamp(g.sense, 0, 1.5) * 0.52);
  x.lineCap = 'round';
  for (const lado of [-1, 1]) {
    const bx = rx * 0.50, by = ry * (0.02 + lado * 0.10);
    const cotovelo = { x: bx + comp * 0.52, y: by + lado * comp * 0.30 };
    x.strokeStyle = NANQUIM + '0.58)';
    x.lineWidth = 0.75;
    x.beginPath();
    x.moveTo(bx, by);
    x.quadraticCurveTo(bx + comp * 0.30, by + lado * comp * 0.05,
                       cotovelo.x, cotovelo.y);
    x.stroke();
    for (let ramo = 0; ramo < 2; ramo++) {
      const ang = lado * (0.30 + ramo * 0.42);
      const px = cotovelo.x + Math.cos(ang) * comp * 0.78;
      const py = cotovelo.y + Math.sin(ang) * comp * 0.78;
      x.strokeStyle = NANQUIM + '0.52)';
      x.lineWidth = 0.6;
      x.beginPath();
      x.moveTo(cotovelo.x, cotovelo.y);
      x.quadraticCurveTo((cotovelo.x + px) / 2 + comp * 0.10,
                         (cotovelo.y + py) / 2, px, py);
      x.stroke();
      x.strokeStyle = NANQUIM + '0.26)';
      x.lineWidth = 0.32;
      for (let s = 1; s <= 4; s++) {
        const t = 0.25 + s * 0.18;
        const mx = cotovelo.x + (px - cotovelo.x) * t;
        const my = cotovelo.y + (py - cotovelo.y) * t;
        x.beginPath();
        x.moveTo(mx, my);
        x.lineTo(mx + comp * 0.04, my + lado * comp * 0.17);
        x.stroke();
      }
    }
  }

  // ---- mandibulas de quem caca ----
  if (g.diet > 0.35) {
    const presa = lerp(0.18, 0.55, clamp((g.diet - 0.35) / 0.65, 0, 1));
    x.fillStyle = tom(k, -30, 16);
    x.strokeStyle = NANQUIM + '0.6)';
    x.lineWidth = 0.5;
    for (const lado of [-1, 1]) {
      const pt = rx * (0.98 + presa * 0.30);
      x.beginPath();
      x.moveTo(rx * 0.80, lado * ry * 0.06);
      x.quadraticCurveTo(pt, lado * ry * (0.10 + presa * 0.30),
                         pt * 0.94, lado * ry * (0.34 + presa * 0.42));
      x.quadraticCurveTo(rx * 0.90, lado * ry * (0.20 + presa * 0.18),
                         rx * 0.78, lado * ry * 0.22);
      x.closePath();
      x.fill();
      x.stroke();
    }
  }

  // ---- espinhos dorsais ----
  if (g.aggression > 0.55) {
    const n = Math.round(lerp(2, 5, clamp((g.aggression - 0.55) / 0.45, 0, 1)));
    x.fillStyle = tom(k, -16, 10);
    x.strokeStyle = NANQUIM + '0.45)';
    x.lineWidth = 0.4;
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(n - 1, 1);
      const px = lerp(rx * 0.22, -rx * 0.58, t);
      // serrilha: os do meio sao os maiores, como numa crista
      const h = ry * lerp(0.22, 0.48, g.aggression) * (0.55 + Math.sin(t * Math.PI) * 0.75);
      const arco = -ry * (0.74 + Math.cos(px / rx) * 0.16);
      const lar = ry * 0.19;
      x.beginPath();
      x.moveTo(px + lar * 0.9, arco + ry * 0.04);
      x.quadraticCurveTo(px + lar * 0.1, arco - h * 0.45,
                         px - lar * 0.75, arco - h);   // ponta varrida pra tras
      x.quadraticCurveTo(px - lar * 0.35, arco - h * 0.30,
                         px - lar * 0.95, arco + ry * 0.04);
      x.closePath();
      x.fill();
      x.stroke();
    }
  }

  return { canvas: cv, w: cv.width / SS, h: cv.height / SS, cx, cy, rx, ry, espinha };
}

function sprite(c) {
  const k = chave(c);
  let s = cache.get(k);
  if (!s) {
    if (cache.size > LIMITE) cache.clear();
    s = rasterizar(c);
    cache.set(k, s);
  }
  return s;
}

// --------------------------- o que esta' vivo ---------------------------

export function desenharCriatura(ctx, c, detalhe) {
  const fino = detalhe !== 0;
  const s = sprite(c);
  const g = c.genome;
  const k = matiz(c);

  // Ritmo proprio: metabolismo alto rema mais rapido e pulsa mais forte.
  const fase = c.age * (5 + g.metabolism * 7) + c.id * 0.9;
  const pulso = 1 + Math.sin(fase) * 0.045;
  const remada = Math.sin(fase * 1.7);

  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(c.angle);
  ctx.lineCap = 'round';

  // ---- patas toracicas batendo por baixo da carapaca ----
  if (fino) {
  ctx.strokeStyle = tom(k, -18, 6, 0.75);
  ctx.lineWidth = Math.max(0.5, s.ry * 0.09);
  const np = 4;
  for (let i = 0; i < np; i++) {
    const t = i / (np - 1);
    const px = lerp(s.rx * 0.45, -s.rx * 0.25, t);
    const bat = Math.sin(fase * 2.4 - i * 0.7) * s.ry * 0.30;
    ctx.beginPath();
    ctx.moveTo(px, s.ry * 0.45);
    ctx.quadraticCurveTo(px - s.ry * 0.1, s.ry * 0.85 + bat * 0.5,
                         px - s.ry * 0.35 + bat, s.ry * 1.05);
    ctx.stroke();
  }

  }

  // ---- a espinha caudal varre a agua ----
  const amp = s.ry * (0.28 + clamp(g.speed, 0, 1.6) * 0.62);
  const bal = remada * amp;
  ctx.strokeStyle = tom(k, -12, -6);
  const base = -s.rx * (0.88 + s.espinha);
  const ponta = -s.rx * (1.62 + s.espinha);
  const segs = fino ? 3 : 1;
  for (let i = 0; i < segs; i++) {
    const t0 = i / segs, t1 = (i + 1) / segs;
    ctx.lineWidth = Math.max(0.35, s.ry * (0.19 - i * 0.055));
    ctx.beginPath();
    ctx.moveTo(lerp(base, ponta, t0), bal * t0 * t0);
    ctx.quadraticCurveTo(lerp(base, ponta, (t0 + t1) / 2), bal * ((t0 + t1) / 2) ** 2,
                         lerp(base, ponta, t1), bal * t1 * t1);
    ctx.stroke();
  }

  // ---- plumas do enfeite: e' o que a outra esta' olhando ----
  const orn = g.ornamento || 0;
  if (orn > 0.06) {
    const nf = 2 + Math.round(orn * 5);
    const comp = s.rx * (1.0 + orn * 3.2);
    for (let i = 0; i < nf; i++) {
      const leque = (i / Math.max(nf - 1, 1) - 0.5) * (0.55 + orn * 1.35);
      const px = -s.rx - comp * Math.cos(leque * 0.5);
      const py = bal * 0.9 + Math.sin(leque) * comp;
      ctx.strokeStyle = tom(k, 6, 12, 0.9);              // haste
      ctx.lineWidth = Math.max(0.5, s.ry * 0.10);
      ctx.beginPath();
      ctx.moveTo(-s.rx * 0.7, 0);
      ctx.quadraticCurveTo(-s.rx - comp * 0.45,
                           bal * 0.6 + Math.sin(leque) * comp * 0.5, px, py);
      ctx.stroke();
      // barbas dos DOIS lados da haste, encurtando na ponta: e' isso que
      // faz ler como pena em vez de risco
      if (!fino) continue;
      ctx.strokeStyle = tom(k, 18, 6, 0.62);
      ctx.lineWidth = 0.45;
      for (let b = 1; b <= 7; b++) {
        const t = 0.22 + b * 0.11;
        const bx = lerp(-s.rx * 0.7, px, t), by = lerp(0, py, t);
        const largura = comp * 0.17 * Math.sin(t * Math.PI) * 1.1;
        const nx = -Math.sin(leque), ny = Math.cos(leque);
        ctx.beginPath();
        ctx.moveTo(bx - nx * largura, by - ny * largura);
        ctx.lineTo(bx + nx * largura, by + ny * largura);
        ctx.stroke();
      }
    }
  }

  ctx.drawImage(s.canvas, -s.cx * pulso, -s.cy * pulso, s.w * pulso, s.h * pulso);

  // ---- ovos na camara: so' aparecem quando ela esta' no cio ----
  if (c.pronta > 0) {
    const no = 2 + Math.round(clamp(c.energy / c.reproAt, 0, 1) * 3);
    ctx.fillStyle = tom(k, 26, -14, 0.8);
    ctx.strokeStyle = NANQUIM + '0.35)';
    ctx.lineWidth = 0.35;
    for (let i = 0; i < no; i++) {
      const a = (i / no) * Math.PI * 2 + fase * 0.2;
      const ex = -s.rx * 0.46 + Math.cos(a) * s.rx * 0.16;
      const ey = -s.ry * 0.26 + Math.sin(a) * s.ry * 0.18;
      ctx.beginPath();
      ctx.arc(ex, ey, s.ry * 0.13, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
  }

  ctx.restore();
}
