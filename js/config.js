// Todos os numeros de balanceamento moram aqui.
// Mexer nesses valores e' mexer nas leis da fisica do Charco.
export const CFG = {
  world: { w: 1600, h: 900 },

  food: {
    rate: 20,          // itens por segundo
    energy: 26,
    patches: 7,        // manchas ferteis -> gera territorio
    spread: 130,       // dispersao dentro da mancha (px)
    max: 900,
    radius: 3,
    carrionTTL: 32,     // segundos ate' a carnica apodrecer
    carrionK: 16        // energia extra do cadaver, proporcional ao corpo
  },

  creature: {
    startCount: 140,
    startEnergy: 110,
    childShare: 0.5,       // fracao da energia que vai pro filho
    basalCost: 0.95,       // * size^1.5 * metabolism
    moveCost: 6.0,         // * size^2 * speed^2 * (uso da velocidade)^2
    senseCost: 0.35,       // * sense
    maxSpeed: 105,         // px/s quando speed = 1
    maxSense: 230,         // px   quando sense = 1
    eatRadius: 6,          // folga alem do raio do corpo
    predEdge: 1.15,        // preciso ser 15% maior pra comer alguem
    predGain: 0.65,        // fracao da energia da presa que eu absorvo
    lifespan: 105,         // segundos quando metabolism = 1
    turnRate: 5.0,         // rad/s - inercia de direcao
    dietSharp: 0.6,        // <1 achata o vale adaptativo entre as dietas:
                           // o onivoro precisa ser viavel pra ponte existir
    huntDiet: 0.25,        // dieta minima pra valer a pena cacar
    custoCruz: 0.38,       // fracao da energia que cada pai poe no filho
    ornK: 0.75,            // custo energetico do enfeite, proporcional a massa
    ornRisco: 1.1,         // o quanto o enfeite te faz notar pelo predador
    ornAtracao: 6,         // peso do enfeite na escolha de parceiro
    toxK: 0.55,            // custo metabolico do veneno, proporcional a massa
    toxDano: 46,           // energia que o predador perde ao morder um toxico
    toxRejeita: 0.85,      // chance (x toxina) de ser cuspido e sobreviver
    termoK: 1.0,           // custo de viver fora da propria faixa termica
                           // (1.6 era letal demais: matava o mutante antes
                           //  dele ter chance de achar a latitude dele)
    termoSigma: 0.26,      // largura da zona de conforto
    // VIABILIDADE (Parker-Baker-Smith, 1972): filho magro pode nao vingar.
    // Sem isso, investir pouco e' de graca e o gene de investimento desaba
    // pro minimo — foi o que aconteceu no primeiro teste (0.5 -> 0.109).
    // Com isso aparece o conflito: se um poe pouco, o outro tem que compensar,
    // e e' desse conflito que a assimetria sexual pode nascer.
    minViavel: 62,
    custoParteno: 1.45,    // clonar sozinha sai mais caro que dividir um filho
    esperaParceiro: 12,    // segundos pronta sem achar par -> partenogenese
                           // Calibrado contra o EFEITO ALLEE: com 20s a
                           // populacao caia com comida sobrando no mapa —
                           // pouca densidade, ninguem achava parceiro, menos
                           // filhos, menos densidade ainda. Com 12s ha' MAIS
                           // cruzamento (2215 x 1711 em 8 min), nao menos:
                           // a populacao se mantem densa o bastante pra haver
                           // encontro. E' partenogenese facultativa, igual a
                           // das dafnias — que e' no que esses bichos deram.
    minCount: 8,           // abaixo disso, repovoa (evita tela morta)
    maxCount: 900          // teto duro: protege o FPS, nao a ecologia
  },

  // [min, max] de cada gene. mut = desvio da mutacao, em fracao do intervalo.
  genes: {
    size:       { min: 0.25, max: 2.2,  init: [0.45, 0.85] },
    speed:      { min: 0.10, max: 1.6,  init: [0.35, 0.70] },
    sense:      { min: 0.05, max: 1.5,  init: [0.30, 0.60] },
    diet:       { min: 0.00, max: 1.0,  init: [0.00, 0.20] },
    metabolism: { min: 0.40, max: 2.0,  init: [0.85, 1.15] },
    maturity:   { min: 0.60, max: 2.5,  init: [1.10, 1.50] },
    aggression: { min: 0.00, max: 1.0,  init: [0.20, 0.50] },
    // temperatura otima do bicho: 0 = polo frio (topo), 1 = raso quente (base)
    termo:      { min: 0.00, max: 1.0,  init: [0.40, 0.60] },
    // investimento em veneno. Caro de produzir, inutil se ninguem te caca,
    // e so' vale a pena se o predador conseguir APRENDER a te evitar.
    toxina:     { min: 0.00, max: 1.0,  init: [0.00, 0.08] },
    // O enfeite: caro de manter e visivel pro predador. E' o handicap de
    // Zahavi — so' quem esta' de fato bem consegue bancar um.
    ornamento:  { min: 0.00, max: 1.0,  init: [0.00, 0.06] },
    // O gosto de quem escolhe. Herdado junto com o enfeite, e' o que permite
    // o runaway de Fisher: o gosto puxa o enfeite, o enfeite puxa o gosto.
    preferencia:{ min: 0.00, max: 1.0,  init: [0.20, 0.60] },
    // ANISOGAMIA: quanto DESTE individuo vai no filho. Comeca todo mundo no
    // meio (isogamia). Se a populacao se partir entre quem investe muito e
    // quem investe pouco, a assimetria sexual terá evoluido sozinha — e e'
    // dela que nasce a competicao por parceiro, e do resto o enfeite.
    investimento:{min: 0.05, max: 1.0,  init: [0.45, 0.55] }
  },

  mutation: { rate: 0.055, hueDrift: 5 },  // hue anda em graus por geracao

  // Deriva continental: duas fendas verticais partem o cilindro em dois
  // continentes. Uma fenda so' nao separaria nada — o mundo da' a volta
  // na horizontal, entao daria pra contornar por tras.
  deriva: { largura: 34, velocidade: 0.18 },

  sim: { dt: 1 / 60, maxStepsPerFrame: 30, sampleEvery: 0.5, history: 480 }
};
