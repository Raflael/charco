// Som procedural, sem nenhum arquivo de audio: cada predacao e' um clique
// curto cuja altura vem do tamanho da presa. Desligado por padrao — som
// automatico em pagina que abre sozinha e' falta de educacao.

let ctx = null, ligado = false, ultimo = 0, contador = 0;

export function alternarSom() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();          // so' nasce depois de um clique do usuario
  }
  ligado = !ligado;
  if (ligado && ctx.state === 'suspended') ctx.resume();
  return ligado;
}

export const somLigado = () => ligado;

function bip(freq, dur, vol, tipo) {
  const agora = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = tipo || 'triangle';
  osc.frequency.setValueAtTime(freq, agora);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.55, agora + dur);
  g.gain.setValueAtTime(0, agora);
  g.gain.linearRampToValueAtTime(vol, agora + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, agora + dur);
  osc.connect(g); g.connect(ctx.destination);
  osc.start(agora); osc.stop(agora + dur + 0.02);
}

// Teto de eventos por segundo: numa onda de predacao o charco viraria
// metralhadora, e o ouvido cansa antes dos olhos.
export function predacao(tamanhoPresa) {
  if (!ligado || !ctx) return;
  const t = ctx.currentTime;
  if (t - ultimo < 0.11) { contador++; return; }
  ultimo = t; contador = 0;
  bip(340 - Math.min(tamanhoPresa, 2) * 110, 0.09, 0.055);
}

export function catastrofe() {
  if (!ligado || !ctx) return;
  bip(90, 0.7, 0.10, 'sawtooth');
}
