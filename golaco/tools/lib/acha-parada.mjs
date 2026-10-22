// Acha um replay de PARADA de verdade (a falta ou a chance na bola parada; js/lances.js) da partida IA × IA em Node, como
// a página joga com ?demo=1 (comoPagina: a entrada da IA pelo humano chega ao passo só com {x, z, botoes} e a marca
// `iaCobra` — a lição do acharGol) e com o replay automático do gol e do impedimento contando no espaço (lib/paradas-node.mjs,
// a mesma conta da página). Hash Node = Chromium: o navegador chega no MESMO lance, no mesmo tick.
//   acharParada({pastaJs, sementes = 1..30, maxTicks = 20000, depoisDe = 300, cam = null ('fechada' | 'atras'), comoPagina = true})
//   → {semente, espera (tick do passo antes da montagem: o replay começa nele), morta (tick da bola morta), chave, tipo,
//      classe, cams, dur, planos} | null
import { criarSimParadas } from './paradas-node.mjs';

export async function acharParada({ pastaJs, sementes = Array.from({ length: 30 }, (_, i) => i + 1), maxTicks = 20000, depoisDe = 300, cam = null, comoPagina = true } = {}) {
  const P = await criarSimParadas(pastaJs);
  if (!P) return null;
  for (const semente of sementes) {
    const S = P.novaPartida(semente, { comoPagina });
    for (let i = 0; i < maxTicks && S.m.partida.estado !== 'fim'; i++) {
      const r = P.passo(S);
      const e = r.espera;
      if (!e || e.tick < depoisDe) continue;
      const cams = e.roteiro.planos.map(p => p.cam);
      if (cam && !cams.includes(cam)) continue;
      return { semente, espera: e.tick, morta: e.lance.morta, chave: e.lance.chave, tipo: e.lance.tipo, classe: e.lance.classe, cams, dur: e.dur, planos: e.roteiro.planos.map(p => ({ ...p })) };
    }
  }
  return null;
}
