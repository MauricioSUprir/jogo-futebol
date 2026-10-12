// Acha, em Node, o instante de uma partida IA × IA (a entrada da IA pelo humano como a página entrega: o mesmo lance que
// o laço da página joga, lib/acha-gol.mjs comoPagina) em que o anel do replay tem o passe em POSIÇÃO LEGAL mais apertado
// (replay-saot.js checagemLegal, sem exigir chute nem gol) — para os prints da análise de posição legal. Para no
// primeiro com margem ≤ `alvo` m; sem nenhum, devolve o mais apertado visto.
//   acharLegal({pastaJs, sementes = 1..10, maxTicks = 5000, alvo = 1.0, cada = 30}) → {semente, tick, margem} | null
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { criarGravador } from './anel-node.mjs';

export async function acharLegal({ pastaJs, sementes = Array.from({ length: 10 }, (_, i) => i + 1), maxTicks = 5000, alvo = 1.0, cada = 30 } = {}) {
  const SA = await import(pathToFileURL(path.join(pastaJs, 'render/replay-saot.js')).href);
  const G = await criarGravador(pastaJs);
  let melhor = null;
  for (const semente of sementes) {
    const S = G.novaPartida(semente, { comoPagina: true });
    for (let i = 0; i < maxTicks; i++) {
      G.passo(S);
      if (i < 300 || i % cada) continue;
      const c = SA.checagemLegal(S.a, { teste: true, limite: 60 });
      if (c && (!melhor || c.margem < melhor.margem)) melhor = { semente, tick: S.m.tick, margem: c.margem };
      if (melhor && melhor.margem <= alvo) return melhor;
    }
  }
  return melhor;
}
