// Acha um gol DE VERDADE da partida IA × IA em Node (a mesma conta do navegador: hash Node = Chromium) para os
// prints do estádio — sem semente fixa: com outra IA ou outro goleiro (outras frentes), a semente 6 deixa de ter
// gol e os prints quebravam (contraprova B1). Procura nas sementes, em ordem, o 1º gol com batida POR DENTRO da
// rede logo depois (≤ 40 passos).
//   acharGol({pastaJs, sementes = 1..40, maxTicks = 4000, time = null}) → {semente, golTick, batidaTick, time, autor} | null
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function acharGol({ pastaJs, sementes = Array.from({ length: 40 }, (_, i) => i + 1), maxTicks = 4000, time = null } = {}) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const P = await imp('partida.js');
  const RO = await imp('render/rede-onda.js');
  for (const semente of sementes) {
    const m = P.criarPartida({ semente });
    const p0 = { x: 0, y: 0, z: 0 }, v0 = { x: 0, y: 0, z: 0 }, out = [];
    let gol = null;
    for (let i = 0; i < maxTicks; i++) {
      Object.assign(p0, m.bola.p); Object.assign(v0, m.bola.v);
      P.passoPartida(m, P.entradaDemoPartida(m), null);
      const ev = m.eventos.find(e => e.tipo === 'gol');
      if (ev && !gol) {
        if (time != null && ev.time !== time) { gol = { descartado: true, tick: m.tick }; continue; }
        gol = { tick: m.tick, time: ev.time, autor: ev.autor };
      }
      const n = RO.detectarImpactos(p0, v0, m.bola.p, m.bola.v, out);
      if (gol && !gol.descartado && n > 0 && out.slice(0, n).some(o => o.sinal > 0)) return { semente, golTick: gol.tick, batidaTick: m.tick, time: gol.time, autor: gol.autor };
      if (gol && m.tick - gol.tick > 40) gol = null;
    }
  }
  return null;
}
