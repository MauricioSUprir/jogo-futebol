// Dribles simples com o modificador (seção 3/4): condução curta com a bola colada (devagar,
// um toque por passo, bola perto) e pedalada (dois toques no modificador): o quadril balança
// para o lado, o pé passa por cima da bola e a bola continua com o jogador.
//   node tools/teste-dribles.mjs
import { criarMundo, passo } from '../js/sim.js';
import { BOTAO, PASSO } from '../js/config.js';
import { pose, J, NJ } from '../js/anim.js';
import { tabelaTexto, fmt, media, percentil } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

// condução curta
{
  const m = criarMundo({ semente: 5, jogadores: [{ id: 0, x: -10, z: 0, rumo: 0 }], bola: { x: -9.6, z: 0 }, posse: 0, log: true });
  const j = m.jogadores[0];
  const ds = [], vs = [];
  let f0 = null;
  for (let i = 0; i < 8 * 60; i++) {
    const r = i * PASSO * 0.6;
    passo(m, { 0: { x: Math.cos(r) * 0.9, z: Math.sin(r) * 0.9, botoes: BOTAO.MOD } });
    if (i > 90) {
      if (f0 === null) f0 = { fase: j.fase, toques: m.log.length };
      ds.push(Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
      vs.push(Math.hypot(j.vx, j.vz));
    }
  }
  const passos = j.fase - f0.fase, toques = m.log.length - f0.toques;
  reg('condução curta — velocidade máxima', `${fmt(Math.max(...vs))} m/s`, '≤ 2,7 m/s', Math.max(...vs) <= 2.7);
  reg('condução curta — bola colada (p95 bola–corpo)', `${fmt(percentil(ds, 0.95))} m (méd ${fmt(media(ds))})`, '≤ 0,55 m', percentil(ds, 0.95) <= 0.55);
  reg('condução curta — toques por passo', fmt(toques / passos), '0,8–1,2', toques / passos >= 0.8 && toques / passos <= 1.2);
  reg('condução curta — sem perder a bola', `${m.stats.perdas} perda(s)`, '0', m.stats.perdas === 0 && m.posse === 0);
}
// pedalada
{
  let ok = 0, lateral = [], dmax = [];
  for (let s = 1; s <= 6; s++) {
    const m = criarMundo({ semente: s, jogadores: [{ id: 0, x: -10, z: 0, rumo: 0 }], bola: { x: -9.6, z: 0 }, posse: 0 });
    const j = m.jogadores[0];
    const out = new Float32Array(NJ * 3);
    for (let i = 0; i < 120 + s * 3; i++) passo(m, { 0: { x: 0.45, z: 0, botoes: 0 } });
    // dois toques rápidos no modificador
    const seq = [BOTAO.MOD, BOTAO.MOD, BOTAO.MOD, 0, 0, 0, BOTAO.MOD, BOTAO.MOD, BOTAO.MOD];
    let viu = false, latMax = 0, d = 0;
    for (let i = 0; i < 90; i++) {
      const bot = i < seq.length ? seq[i] : 0;
      passo(m, { 0: { x: 0.45, z: 0, botoes: bot } });
      if (j.cond.pedalada) {
        viu = true;
        pose(j, m, out);
        const lat = Math.abs(out[J.pelve * 3 + 2] - j.z);
        latMax = Math.max(latMax, lat);
      }
      d = Math.max(d, Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z));
    }
    for (let i = 0; i < 120; i++) passo(m, { 0: { x: 0.45, z: 0, botoes: 0 } });
    lateral.push(latMax); dmax.push(d);
    if (viu && m.posse === 0 && m.stats.perdas === 0) ok++;
  }
  reg('pedalada — ativa com dois toques e bola segue com o jogador', `${ok}/6`, '6/6', ok === 6);
  reg('pedalada — quadril balança para o lado', `${fmt(Math.min(...lateral))} m (mín)`, '≥ 0,08 m', Math.min(...lateral) >= 0.08);
  reg('pedalada — bola perto do corpo durante o drible', `${fmt(Math.max(...dmax))} m (máx)`, '≤ 0,9 m', Math.max(...dmax) <= 0.9);
}
console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-dribles: REPROVOU (${falhas})` : '\nteste-dribles: PASSOU');
process.exit(falhas ? 1 : 0);
