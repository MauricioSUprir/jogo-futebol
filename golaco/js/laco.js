// Laço de passo fixo com acumulador ("Fix Your Timestep!", Glenn Fiedler): a simulação anda
// sempre em passos de 1/60 s e o desenho interpola entre o passo anterior e o atual com
// alfa = sobra do acumulador / passo. Funciona igual a 60, 120 ou 144 Hz. Puro (sem DOM).
//
// Encaixe do delta (Glaiel 2019, "How to make your game run at 60fps"): o carimbo do
// requestAnimationFrame treme (±0,5 ms, ou vem arredondado a 0,1 ms); com o acumulador colado na
// fronteira de um passo, cada tremor alternava quadros de 0 e 2 passos (31% dos quadros a 60 Hz)
// — a entrada lida num quadro sem passo esperava mais 16,7 ms. Quando a média dos últimos 8
// deltas está a menos de 0,2 ms de 1/30, 1/60, 1/120 ou 1/144 s, o delta usado é exatamente esse
// período. Na ressincronia (primeiro quadro, aba voltando, recomeço) o acumulador começa em meio
// passo: o tremor que sobra não muda a contagem de passos (e o desenho fica meio passo atrás do
// estado mais novo, em vez de um passo inteiro).

import { PASSO, MAX_PASSOS_POR_QUADRO } from './config.js';

const ENCAIXES = [1 / 30, 1 / 60, 1 / 120, 1 / 144];
const TOLERANCIA_ENCAIXE = 0.0002; // s
const MEDIA_DELTAS = 8;

export function criarLaco(passo = PASSO) {
  return { passo, acum: passo / 2, ultimo: null, perdidos: 0, deltas: [] };
}

/** Delta encaixado no período do monitor quando a média recente está a ≤ 0,2 ms dele. */
function encaixar(l, dt) {
  const h = l.deltas;
  h.push(dt);
  if (h.length > MEDIA_DELTAS) h.shift();
  let media = 0;
  for (const d of h) media += d;
  media /= h.length;
  for (const p of ENCAIXES) if (Math.abs(media - p) < TOLERANCIA_ENCAIXE) return p;
  return dt;
}

/**
 * Recebe o instante do quadro (ms, ex.: performance.now() do requestAnimationFrame) e diz
 * quantos passos rodar e o alfa da interpolação. Com l.ultimo = null (primeiro quadro ou
 * ressincronia) não roda passo nenhum e recomeça a contagem.
 */
export function avancarLaco(l, agoraMs) {
  if (l.ultimo === null) {
    l.ultimo = agoraMs;
    l.acum = l.passo / 2;
    l.deltas.length = 0;
    return { passos: 0, alfa: 0.5 };
  }
  let dt = (agoraMs - l.ultimo) / 1000;
  l.ultimo = agoraMs;
  if (!(dt > 0)) dt = 0;
  if (dt > 0.25) dt = 0.25; // aba voltou do segundo plano: não tenta recuperar tudo
  if (dt > 0) dt = encaixar(l, dt);
  l.acum += dt;
  let passos = Math.floor(l.acum / l.passo + 1e-9);
  if (passos > MAX_PASSOS_POR_QUADRO) {
    // espiral da morte: descarta o atraso em vez de travar
    l.perdidos += passos - MAX_PASSOS_POR_QUADRO;
    passos = MAX_PASSOS_POR_QUADRO;
    l.acum = l.passo / 2;
  } else {
    l.acum -= passos * l.passo;
    if (l.acum < 0) l.acum = 0;
  }
  return { passos, alfa: Math.min(1, l.acum / l.passo) };
}
