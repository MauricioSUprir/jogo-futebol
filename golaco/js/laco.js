// Laço de passo fixo com acumulador ("Fix Your Timestep!", Glenn Fiedler): a simulação anda
// sempre em passos de 1/60 s e o desenho interpola entre o passo anterior e o atual com
// alfa = sobra do acumulador / passo. Funciona igual a 60, 120 ou 144 Hz. Puro (sem DOM).

import { PASSO, MAX_PASSOS_POR_QUADRO } from './config.js';

export function criarLaco(passo = PASSO) {
  return { passo, acum: 0, ultimo: null, perdidos: 0 };
}

/**
 * Recebe o instante do quadro (ms, ex.: performance.now() do requestAnimationFrame) e diz
 * quantos passos rodar e o alfa da interpolação.
 */
export function avancarLaco(l, agoraMs) {
  if (l.ultimo === null) {
    l.ultimo = agoraMs;
    return { passos: 0, alfa: 0 };
  }
  let dt = (agoraMs - l.ultimo) / 1000;
  l.ultimo = agoraMs;
  if (!(dt > 0)) dt = 0;
  if (dt > 0.25) dt = 0.25; // aba voltou do segundo plano: não tenta recuperar tudo
  l.acum += dt;
  let passos = Math.floor(l.acum / l.passo + 1e-9);
  if (passos > MAX_PASSOS_POR_QUADRO) {
    // espiral da morte: descarta o atraso em vez de travar
    l.perdidos += passos - MAX_PASSOS_POR_QUADRO;
    passos = MAX_PASSOS_POR_QUADRO;
    l.acum = 0;
  } else {
    l.acum -= passos * l.passo;
    if (l.acum < 0) l.acum = 0;
  }
  return { passos, alfa: Math.min(1, l.acum / l.passo) };
}
