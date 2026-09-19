// Detecta marcos ecologicos e escreve o diario do charco.
// Um grafico mostra numeros; o diario conta uma HISTORIA — e' o que faz a
// pessoa que esta' olhando entender o que acabou de acontecer.
// Tudo com histerese (liga num limiar, desliga noutro) pra nao virar spam.

// Matiz e' um angulo, entao media e dispersao dele precisam de estatistica
// circular: somar vetores unitarios e olhar o comprimento da resultante (R).
// R perto de 1 = todo mundo na mesma cor; R perto de 0 = cores espalhadas.
// Uma media aritmetica de graus diria que 350 e 10 dao 180 — ciano, quando
// na verdade os dois sao vermelho.
function corMedia(lista) {
  let sx = 0, sy = 0;
  for (const c of lista) {
    const r = (c.genome.hue * Math.PI) / 180;
    sx += Math.cos(r); sy += Math.sin(r);
  }
  const n = lista.length || 1;
  sx /= n; sy /= n;
  return {
    angulo: ((Math.atan2(sy, sx) * 180) / Math.PI + 360) % 360,
    R: Math.sqrt(sx * sx + sy * sy)
  };
}

function distanciaAngular(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

// Correlacao de Pearson entre dois genes na populacao. E' a assinatura do
// runaway de Fisher: o gosto de quem escolhe e o enfeite de quem e' escolhido
// sao herdados juntos, entao passam a andar juntos na populacao inteira.
function correlacao(lista, a, b) {
  const n = lista.length;
  if (n < 12) return 0;
  let ma = 0, mb = 0;
  for (const c of lista) { ma += c.genome[a]; mb += c.genome[b]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (const c of lista) {
    const da = c.genome[a] - ma, db = c.genome[b] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  return (va && vb) ? cov / Math.sqrt(va * vb) : 0;
}

export class Marcos {
  constructor() { this.reset(); }

  reset() {
    this.estado = {};
    this.acc = 0;
    this.pico = 0;
    this.geracaoVista = 0;
  }

  gatilho(world, chave, cond, msgLiga, msgDesliga) {
    const antes = !!this.estado[chave];
    if (cond && !antes) { world.log(msgLiga); this.estado[chave] = true; }
    else if (!cond && antes) {
      if (msgDesliga) world.log(msgDesliga);
      this.estado[chave] = false;
    }
  }

  // Gatilho com histerese assimetrica: liga num limiar e so' desliga noutro,
  // bem abaixo. Com limiar unico, um valor tremendo em volta dele faz o
  // diario anunciar e desanunciar o mesmo fato a cada 3 segundos.
  gatilhoFaixa(world, chave, valor, liga, desliga, msgLiga, msgDesliga) {
    const antes = !!this.estado[chave];
    if (!antes && valor > liga) { world.log(msgLiga); this.estado[chave] = true; }
    else if (antes && valor < desliga) {
      if (msgDesliga) world.log(msgDesliga);
      this.estado[chave] = false;
    }
  }

  observar(world, stats, dt) {
    this.acc += dt;
    if (this.acc < 3) return;
    this.acc = 0;

    const pop = stats.now.pop;
    if (pop < 5) return;

    const carn = world.creatures.filter(c => c.genome.diet > 0.5).length / pop;

    this.gatilho(world, 'carniv', carn > 0.12,
      'os carnívoros tomaram o charco (' + Math.round(carn * 100) + '%)',
      'a onda carnívora passou — sobraram os herbívoros');

    this.gatilho(world, 'gigante', stats.now.size > 1.15,
      'gigantismo: o corpo médio passou de 1.15',
      'os gigantes não se sustentaram');

    this.gatilho(world, 'nanico', stats.now.size < 0.45,
      'nanismo: corpo pequeno virou a aposta vencedora', null);

    this.gatilho(world, 'veloz', stats.now.speed > 1.15,
      'corrida armamentista: velocidade média acima de 1.15', null);

    this.gatilho(world, 'cego', stats.now.sense < 0.25,
      'a visão está atrofiando — enxergar saiu caro demais',
      'a visão voltou a compensar');

    this.gatilho(world, 'apressado', stats.now.maturity < 0.75,
      'estratégia r: reproduzir cedo virou regra', null);

    if (pop > this.pico * 1.25 && pop > 120) {
      this.pico = pop;
      world.log('novo pico populacional: ' + pop + ' criaturas');
    } else if (this.pico > 120 && pop < this.pico * 0.42) {
      world.log('colapso: de ' + this.pico + ' para ' + pop + ' criaturas');
      this.pico = pop;
    }


    // ---- aposematismo e mimetismo ----
    // O gene de cor nasceu NEUTRO de proposito. Quando o veneno aparece, ele
    // deixa de ser neutro: a cor vira aviso, e depois vira mentira.
    const toxicos = world.creatures.filter(c => c.genome.toxina > 0.35);
    const inocuos = world.creatures.filter(c => c.genome.toxina <= 0.15);
    const fracTox = toxicos.length / pop;

    this.gatilhoFaixa(world, 'venenosos', fracTox, 0.18, 0.07,
      'veneno: ' + Math.round(fracTox * 100) + '% da população ficou tóxica',
      'o veneno deixou de compensar e sumiu');

    if (toxicos.length >= 12) {
      const ct = corMedia(toxicos);
      this.gatilhoFaixa(world, 'aposema', ct.R, 0.68, 0.45,
        'APOSEMATISMO: os tóxicos convergiram todos para a mesma cor',
        'o aviso se dispersou — a cor voltou a não significar nada');

      if (ct.R > 0.60 && inocuos.length >= 12) {
        const ci = corMedia(inocuos);
        // Quanto mais concentrados os inocuos E mais perto da cor do aviso,
        // maior a nota de imitacao. Uma nota continua permite histerese.
        const perto = 1 - Math.min(distanciaAngular(ct.angulo, ci.angulo) / 60, 1);
        this.gatilhoFaixa(world, 'mimetismo', ci.R * perto, 0.45, 0.22,
          'MIMETISMO: os inofensivos copiaram a cor de quem é venenoso',
          'a imitação se desfez');
      }
    }

    // ---- selecao sexual ----
    this.gatilhoFaixa(world, 'enfeite', stats.now.ornamento, 0.34, 0.16,
      'o enfeite virou moeda: ornamento médio passou de 0.34',
      'o enfeite saiu de moda — custava caro demais');

    // A correlacao tem que ser medida DENTRO de uma especie. Na populacao
    // inteira, especies com medias diferentes criam correlacao que nao existe
    // em ninguem — paradoxo de Simpson.
    const dominante = world.registro.vivas()[0];
    const povo = dominante
      ? world.creatures.filter(c => c.esp === dominante.id)
      : world.creatures;
    this.gatilhoFaixa(world, 'runaway',
      correlacao(povo, 'ornamento', 'preferencia'), 0.30, 0.12,
      'RUNAWAY DE FISHER: o gosto e o enfeite passaram a andar juntos',
      'o gosto e o enfeite se soltaram um do outro');

    const ger = Math.floor(stats.now.gen / 25) * 25;
    if (ger > this.geracaoVista) {
      this.geracaoVista = ger;
      world.log('geração ' + ger + ' alcançada');
    }
  }
}
