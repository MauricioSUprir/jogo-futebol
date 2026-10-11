// Acha um impedimento DE VERDADE da partida IA × IA em Node (hash Node = Chromium: o navegador chega no mesmo lance)
// para os prints da linha de impedimento — sem semente fixa (com outra IA a semente deixa de ter o lance).
//   acharImpedimento({pastaJs, sementes = 1..40, maxTicks = 7200, depoisDe = 600}) → {semente, tick, id, time, linhaX} | null
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function acharImpedimento({ pastaJs, sementes = Array.from({ length: 40 }, (_, i) => i + 1), maxTicks = 7200, depoisDe = 600 } = {}) {
  const P = await import(pathToFileURL(path.join(pastaJs, 'partida.js')).href);
  for (const semente of sementes) {
    const m = P.criarPartida({ semente });
    for (let i = 0; i < maxTicks; i++) {
      P.passoPartida(m, P.entradaDemoPartida(m), null);
      const ev = m.eventos.find(e => e.tipo === 'impedimento');
      if (ev && m.tick >= depoisDe) return { semente, tick: m.tick, id: ev.id, time: ev.time, linhaX: ev.linhaX };
    }
  }
  return null;
}
