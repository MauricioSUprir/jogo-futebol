// Acha um impedimento DE VERDADE da partida IA × IA em Node (hash Node = Chromium: o navegador chega no mesmo lance)
// para os prints da linha de impedimento — sem semente fixa (com outra IA a semente deixa de ter o lance).
//   acharImpedimento({pastaJs, sementes = 1..40, maxTicks = 7200, depoisDe = 600, comoPagina = false, time = null}) → {semente, tick, id, time, linhaX} | null
// time: só o impedimento desse time (o do impedido; null = qualquer um).
// comoPagina: a entrada da IA pelo humano chega ao passo como a página (?demo=1) entrega — só {x, z, botoes} e a marca `iaCobra`, sem o `ia`
// da entradaDemoPartida (a mesma lição do acharGol): o lance achado é o MESMO que o laço da página joga.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function acharImpedimento({ pastaJs, sementes = Array.from({ length: 40 }, (_, i) => i + 1), maxTicks = 7200, depoisDe = 600, comoPagina = false, time = null } = {}) {
  const P = await import(pathToFileURL(path.join(pastaJs, 'partida.js')).href);
  const ent = { 0: { x: 0, z: 0, botoes: 0 } };
  Object.defineProperties(ent, { x: { value: 0, writable: true }, z: { value: 0, writable: true }, botoes: { value: 0, writable: true }, iaCobra: { value: false, writable: true } });
  const entrada = m => {
    const e = P.entradaDemoPartida(m);
    if (!comoPagina) return e;
    ent[0].x = ent.x = e?.x ?? 0; ent[0].z = ent.z = e?.z ?? 0; ent[0].botoes = ent.botoes = (e?.botoes ?? 0) | 0;
    ent[0].iaCobra = ent.iaCobra = !!(e && (e.ia || e.iaCobra)); // a marca da IA que a página passa (main.js entradaDoTime)
    return ent;
  };
  for (const semente of sementes) {
    const m = P.criarPartida({ semente });
    for (let i = 0; i < maxTicks; i++) {
      P.passoPartida(m, entrada(m), null);
      const ev = m.eventos.find(e => e.tipo === 'impedimento');
      if (ev && m.tick >= depoisDe && (time == null || ev.time === time)) return { semente, tick: m.tick, id: ev.id, time: ev.time, linhaX: ev.linhaX };
    }
  }
  return null;
}
