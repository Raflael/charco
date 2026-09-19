# Charco

Um ecossistema onde a evolução roda ao vivo. Criaturas têm genoma, gastam
energia, comem, escolhem parceiro, se reproduzem com recombinação e morrem.
Ninguém programou predador, herbívoro, migração, o corpo dos bichos nem as
espécies. Tudo isso emerge — e fica registrado.

## Rodar

    node serve.cjs        # http://localhost:8099

Ou abrir o index.html direto: é tudo módulo ES, sem build, sem dependência.

Evolução sem interface, pra testar balanceamento em segundos:

    node sim.mjs                    # 10 min de evolução, cérebro por regras
    node sim.mjs neural 10 40       # cérebro | minutos | fartura

## Arquitetura

    js/config.js     todos os números de balanceamento (mexer aqui = mudar as leis)
    js/genome.js     genes escalares + 128 pesos de rede; mutação e recombinação
    js/net.js        a rede: 18 sensores -> 6 neurônios -> virar/andar
    js/brain.js      RuleBrain e NeuralBrain atrás da mesma interface decide()
    js/creature.js   fenótipo, energia, caça, cio, cruzamento, morte
    js/especies.js   distância genética, isolamento reprodutivo, nomenclatura
    js/world.js      mundo cilíndrico, clima, comida, carniça, censo, catástrofes
    js/grid.js       hash espacial (sem isso é O(n²) e morre em 400 bichos)
    js/corpo.js      o corpo desenhado a partir do genoma + cache por clado
    js/marcos.js     detecta marcos ecológicos e escreve o diário
    js/som.js        som procedural, sem arquivo de áudio
    js/stats.js      série temporal dos traços
    js/main.js       canvas, gráfico, ficha, rede desenhada, árvore da vida

## As leis que impedem a simulação de degenerar

1. **Lei de Kleiber.** O gene de tamanho é comprimento, massa ~ tamanho³, e o
   metabolismo basal ~ massa^0.75 → expoente **2.25**. Com o expoente errado
   (1.5) o tamanho vira vantagem pura e em 5 minutos todo mundo é um clone
   gigante.

2. **A boca não escala com o corpo.** Senão ser grande dá área de captura de
   graça, e o gene de tamanho ganha sozinho por outro caminho.

3. **Carniça.** Dieta intermediária é um vale adaptativo: com dieta 0.4 o
   bicho digere planta mal e ainda não caça. A carnivoria só evolui se houver
   rampa — necrofagia primeiro, predação depois. Sem cadáveres no mapa,
   carnívoros nunca aparecem.

4. **O mundo é cilindro, não toro.** Dá a volta na horizontal, mas tem margem
   de verdade em cima e embaixo. Era um toro até o clima entrar — e num toro
   o polo frio faz fronteira com o quente, então "norte" e "sul" não existem,
   o meio vira ótimo único e nenhuma linhagem se separa por latitude.

O gene de cor (hue) não faz nada de propósito: sendo neutro, ele só é herdado
— é o que deixa deriva genética e clados visíveis na tela.

## O cérebro

A interface é decide(criatura, percepção) devolvendo giro e esforço. O giro é
**egocêntrico** (fração do giro máximo a partir do focinho), e foi isso que
permitiu plugar a rede sem tocar em mais nada: ela não precisa aprender
trigonometria antes de aprender a comer.

Os 128 pesos moram dentro do genoma e sofrem crossover no cruzamento. O botão
"quem decide" troca em tempo real — a rede sempre esteve lá, só dormindo.

Mesmo mundo, mesma fartura, 10 minutos:

| | regras | rede neural |
|---|---:|---:|
| gerações | 28.5 | 41.4 |
| nascimentos | 5715 | 8854 |
| predações | 2122 | 6159 |
| vegetais consumidos | 19595 | 19607 |

Comida disponível idêntica (é o teto do mundo): a população de cérebro
evoluído converteu o mesmo alimento em **55% mais descendentes**.

**Armadilha que custou caro:** o número de entradas da rede tem que bater com
quantos sensores o NeuralBrain escreve. Float32Array engole escrita fora do
range em silêncio — um sensor sumia sem erro nenhum, e a rede evoluía cega
pra ele.

## Espécies — o conceito biológico, implementado literalmente

Espécie aqui não é rótulo: é **quem ainda consegue cruzar com quem**. Duas
populações divergem, a distância genética passa do limiar, e elas deixam de se
reproduzir entre si. Nesse instante nasce uma espécie nova, que ganha:

- **nome binomial que descreve o bicho**, montado a partir dos traços mais
  extremos dele (*Tachyodon voracis* é rápido e carnívoro mesmo), com o gênero
  herdado da espécie-mãe quando a divergência foi pequena — que é exatamente
  o critério de um taxonomista
- **lugar na árvore da vida**, desenhada ao vivo no painel: cada linha é uma
  espécie no tempo, cada degrau é uma especiação, cada cruz é uma extinção
- **ficha no museu** quando a última morre: quanto viveu, pico populacional,
  de quem se separou

O representante da espécie é **recentrado na média dos vivos** a cada censo.
Sem isso a espécie fica ancorada no fundador e a população inteira foge dele
até ninguém mais pertencer à própria espécie.

Calibração: com limiar 0.17 a simulação fabricava 40 espécies de 5 indivíduos
— ruído taxonômico. Com 0.30 elas duram, competem e deixam descendentes.

## Clima e radiação adaptativa

O charco tem gradiente térmico: frio na margem de cima, quente na de baixo.
O gene térmico é a temperatura ótima do bicho, e viver fora dela custa energia
proporcional à massa — termorregulação de verdade. A rede tem dois sensores
climáticos, e o segundo é uma **derivada** ("melhora se eu for pra frente"):
é o que permite migração evoluir sem que a rede saiba onde fica o norte.

O resultado, numa corrida de 10 minutos:

    179  Phytodon herbarius   termo 0.60  diet 0.11
     34  Phytodon minor       termo 0.85  diet 0.06   foi pro sul quente
     22  Phytodon placidus    termo 0.37  diet 0.48   foi pro norte e virou carnívoro
      8  Phytodon praecox     termo 0.74  diet 0.29

Uma linhagem se partiu por latitude e por dieta ao mesmo tempo. Isso é
radiação adaptativa, e ninguém escreveu o roteiro.

## Reprodução sexuada

Acima do limiar de energia a criatura entra no cio, procura parceiro **da
própria espécie** e o filho sai de crossover uniforme dos dois genomas — genes
e pesos da rede. Não é média: média apagaria a variação de que a seleção
precisa.

Sem parceiro por 12s, ela se divide sozinha (**partenogênese**). Existe na
natureza e impede a população de travar quando a densidade cai — sem isso uma
seca vira extinção garantida, e a população entra no efeito Allee descrito
mais abaixo.

## Desempenho

10 minutos de mundo em ~39s de CPU num i3-10105 — cerca de **15x tempo real**
num núcleo só, com ~250 criaturas, censo taxonômico e tudo ligado.

Duas decisões seguram isso: o corpo é rasterizado **uma vez por espécie
aproximada** e reaproveitado (primos são quase idênticos), e o cruzamento é
decidido por **identidade de espécie**, não por distância genética crua — o
que evitava comparar 128 pesos de rede por vizinho, todo frame.

## Deriva continental

O botão "deriva" abre duas fendas verticais e parte o charco em dois
continentes. **Duas** fendas, não uma: o mundo dá a volta na horizontal, e
com uma só dava pra contornar por trás.

Enquanto estão abertas, nada atravessa e ninguém vê o outro lado. As duas
populações divergem em separado. Apertar de novo junta as placas — e aí o
programa confere o que sobrou:

    120s  as placas começaram a se afastar
    126s  a terra se partiu — dois continentes isolados
    520s  as placas voltam a se encontrar
    526s  reencontro: Phytodon herbarius e Phytodon ferox não cruzam mais
          — o isolamento virou espécie

Esse é o experimento de especiação alopátrica fechando o ciclo: separou,
divergiu, reencontrou, e o reencontro **provou** o isolamento — elas se
cruzam de novo e simplesmente não se reproduzem.

## O efeito Allee, encontrado sem querer

Depois da reprodução sexuada, a população passou a cair **com comida
sobrando no mapa**. Não era fome: em baixa densidade ninguém achava parceiro,
nasciam menos filhos, a densidade caía mais ainda. Isso tem nome em ecologia
— efeito Allee — e a saída foi a mesma da natureza: encurtar a espera até a
partenogênese, que é partenogênese facultativa, igual à das dáfnias.

| espera | população | comida sobrando | cruzamentos | espécies |
|---|---:|---:|---:|---:|
| 20s | 99 | 95 | 1711 | 4 |
| **12s** | **140** | 75 | **2215** | **6** |
| 8s | 324 | 43 | 1328 | 5 |

O detalhe bonito: 12s produz **mais sexo, não menos**. A população fica densa
o suficiente pra haver encontro.

## A estética

Prancha de história natural: papel, tinta ferro-galha, terras queimadas —
Haeckel e caderno de campo, não painel de controle. As regras da casa:

- **nenhum pigmento fora da faixa das terras** (matiz 24–94, saturação ~33%):
  ocre, siena, umber, terra verde, óxido de ferro. Matiz livre em 360 graus
  com saturação alta é cor de dashboard, e entrega o sotaque na hora
- **espécies se distinguem por valor, não por croma** — é o que um ilustrador
  faz quando só tem terras na paleta
- **contorno de nanquim em cada corpo**: é o traço de pena que separa a
  ilustração científica do círculo colorido de infográfico
- versalete no lugar de caixa alta, serifa no texto, itálico nos nomes
  científicos, e nenhum canto arredondado que não exista em papel
- a água é turva e o clima está pintado nela: cinza-frio em cima, barro
  quente embaixo
- **escolha única não é botão**: é um item marcado a tinta numa lista, como a
  legenda de uma prancha. Ação é etiqueta de herbário, que afunda quando
  pressionada. E medida se lê em **régua graduada**, não em barrinha
- **rótulo em inglês no meio de uma prancha em português denuncia a origem do
  texto na hora** — cada gene tem o nome que um naturalista usaria (tamanho,
  visão, maturidade, clima, veneno)

## Aposematismo e mimetismo — quando a cor passa a mentir

O gene de cor nasceu **neutro de propósito**: não fazia nada, só era herdado,
e servia pra deixar a deriva genética visível. Com a toxina ele deixou de ser
neutro.

O veneno é um gene caro (custa energia proporcional à massa) e inútil se
ninguém te caça. Quem morde um tóxico perde energia — e na maioria das vezes
cospe a presa viva. É esse cuspe que dá vantagem **individual** ao veneno;
sem ele, só os parentes do morto se beneficiariam.

E o predador ganhou um sensor novo: **a cor da presa**, em seno e cosseno,
porque matiz é circular — 0 e 360 são a mesma cor, e um sensor linear
ensinaria a rede a temer uma descontinuidade que não existe.

Em 20 minutos de mundo, sem nada disso ser programado:

     956s  MIMETISMO: os inofensivos copiaram a cor de quem é venenoso
    1095s  APOSEMATISMO: os tóxicos convergiram todos para a mesma cor

    toxina média 0.04 -> 0.447
    cor dos tóxicos: 166 graus  (concentração R = 0.73)
    cor dos inócuos: 181 graus  (concentração R = 0.42)

Os tóxicos convergiram para uma cor só — isso é aposematismo, o aviso. Os
inofensivos foram parar a 15 graus dali: copiaram o aviso sem pagar o veneno.
Isso é **mimetismo batesiano**, e ele emergiu sozinho de três regras simples.

Compare o modo de cor **linhagem** com o modo **veneno**: um mostra o aviso
que o bicho ostenta, o outro mostra a verdade. A diferença entre os dois é o
experimento inteiro.

**Matiz é ângulo:** a média e a dispersão de cores usam estatística circular
(soma de vetores unitários, e o comprimento R da resultante). Uma média
aritmética diria que 350 e 10 dão 180 — ciano, quando os dois são vermelho.

**Histerese nos marcos:** o detector liga em R > 0.68 e só desliga em
R < 0.45. Com limiar único, um valor tremendo em volta dele fazia o diário
anunciar e desanunciar o mesmo fato a cada 3 segundos.

## Seleção sexual — e o que NÃO emergiu

Aposematismo é sinal **entre** espécies ("não me coma"). Este é o sinal
**dentro** da espécie ("me escolha").

Três genes:

- **ornamento** — plumas desenhadas vivas atrás do corpo. Custam energia
  proporcional à massa **e** te entregam ao predador: uma presa enfeitada é
  percebida como se estivesse mais perto do que está. É o **handicap de
  Zahavi** — o sinal é honesto porque é caro.
- **preferência** — o gosto de quem escolhe.
- **investimento** — quanto deste indivíduo vai no filho. Começa em 0.5 pra
  todo mundo (isogamia: ninguém é macho nem fêmea).

A escolha acontece na **aproximação**, não no encontro: um bicho enfeitado
parece mais perto pra quem gosta de enfeite, e é atrás dele que ela vai. Isso
é corte. A exigência de cada um é `preferência × investimento` — quem põe
mais no filho tem mais a perder, e escolhe melhor.

### O que funcionou

- **o ornamento evolui sozinho** sob escolha de parceiro: 0.03 → 0.15–0.25,
  com dezenas de indivíduos emplumados acima de 0.4
- **quem investe mais é mais exigente** (correlação investimento × preferência
  = +0.18): a lógica da escolha se sustenta na população
- **viabilidade mínima** (Parker-Baker-Smith 1972) impede o colapso do
  investimento parental. Sem ela, investir pouco é de graça e o gene desaba
  pro mínimo — foi o que aconteceu: 0.5 → 0.109. Com o trade-off (filho magro
  pode não vingar), estabiliza em 0.32

### O que NÃO emergiu, e por quê

**Runaway de Fisher: episódico, nunca sustentado.** Aparece por alguns
segundos e se desfaz. Duas causas foram encontradas e corrigidas pelo
caminho, e ainda assim ele não se estabeleceu:

1. *O genoma não tinha cromossomo.* O runaway depende de desequilíbrio de
   ligação entre o gene do enfeite e o do gosto — eles precisam ser herdados
   juntos. O crossover uniforme original sorteava cada gene por conta própria
   e destruía essa ligação toda geração. Corrigido com **crossover de ponto
   único**, onde a ordem de GENES é a ordem no cromossomo e ornamento e
   preferência são vizinhos de propósito.
2. *A correlação estava sendo medida na população inteira*, misturando
   espécies com médias diferentes — paradoxo de Simpson. Passou a ser medida
   dentro da espécie dominante.

**Anisogamia: não emergiu.** O gene de investimento varia (desvio 0.19) mas a
distribuição continua contínua — não se parte nos dois grupos que
caracterizariam papéis sexuais.

A hipótese que sobra, e que este modelo não testa, é que falta **competição
sexual de verdade**: com partenogênese disponível (mesmo encarecida em 45%),
quem não é escolhido ainda tem saída, e sem escassez de parceiros o prêmio
por ser atraente nunca fica grande o bastante para pagar o handicap.

Ficam registrados como resultados negativos honestos. Três tentativas com
correções reais a cada uma já indicam que falta estrutura ao modelo — e
continuar mexendo em parâmetro até o número aparecer seria fabricar
resultado, não descobrir.

**A regra que ficou:** quando um fenômeno biológico conhecido não emerge, a
primeira suspeita é que o modelo apagou a estrutura de que ele depende —
não que falta tempo ou um parâmetro mais forte.

## Roadmap

- [x] **Fase 1** — núcleo: genoma, energia, reprodução, mutação, grid, render
- [x] **Fase 2** — gráfico ao vivo, ficha de espécime, catástrofes, tempo 32x
- [x] **Fase 3** — rede neural no genoma + visualização do cérebro
- [x] **Fase 4** — corpo derivado do genoma, rastros, diário, som
- [x] **Fase 5** — sexuada, espécies, clima, árvore da vida, museu de fósseis
- [x] **Fase 6** — deriva continental, especiação alopátrica com prova no
      reencontro, e estética de prancha de história natural
- [x] **Fase 7** — toxina, aposematismo e mimetismo batesiano emergentes
- [x] **Fase 8** — seleção sexual: handicap, corte, investimento parental
      (runaway e anisogamia não emergiram — está documentado por quê)
- [ ] próximo: salvar e compartilhar um mundo inteiro pela URL

## Atalhos

- clique numa criatura: ficha com genoma, espécie, linhagem e o cérebro dela
- clique numa espécie da lista: mostra onde ela vive agora
- espaço: pausa
- parâmetros de URL: passos=N (adianta a simulação), cerebro=neural,
  modo=especie, deriva=1
