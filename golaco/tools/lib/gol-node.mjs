// Gols em NODE para os testes da comemoração (tools/teste-comemoracao.mjs): o mesmo roteiro do gol roteirizado do
// navegador (tools/lib/gol-roteirizado.mjs: um jogador de linha do time com a bola e o último toque de verdade dele; o
// corredor do chute limpo; a bola sai do pé com a física da bola para a boca do gol) e os gols NATURAIS da partida IA × IA
// (o primeiro gol de cada semente, em sementes já conhecidas e, se elas pararem de ter gol, nas próximas). O autor de
// verdade sai de render/autor-gol.js, como na página. Só escreve no mundo do próprio teste.
//   const L = await carregarNode(pastaJs);
//   golRoteirizadoNode(L, {semente, time, dist, z0, y, z, v}) → {m, golTick, gol {tick, time, id, contra}, s} | null
//   golNaturalNode(L, semente, maxTicks) → {m, golTick, gol, s} | null
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function carregarNode(pastaJs) {
  const imp = f => import(pathToFileURL(path.join(path.resolve(pastaJs), f)).href);
  return { P: await imp('partida.js'), B: await imp('bola.js'), C: await imp('config.js'), AG: await imp('render/autor-gol.js') };
}

function rastreador(L, m) {
  const est = L.AG.criarAutorGol();
  const timeDe = id => m.jogadores.find(j => j.id === id)?.time ?? null;
  return { est, passo: () => L.AG.autorEventos(est, m.eventos, m.tick, timeDe) };
}

export function golRoteirizadoNode(L, o = {}) {
  const { P, B, C } = L;
  const time = o.time ?? 0;
  const m = P.criarPartida({ semente: o.semente ?? 5 });
  const r = rastreador(L, m);
  const porId = id => m.jogadores.find(j => j.id === id);
  let n = 0;
  for (; n < 6000; n++) {
    P.passoPartida(m, P.entradaDemoPartida(m), null);
    r.passo();
    const u = r.est.ultimo, j = m.posse != null ? porId(m.posse) : null;
    if (m.partida.estado === 'jogo' && j && m.naMao == null && !m.voo && j.time === time && j.posicao !== 'GOL' && u.ativo && u.id === j.id) break;
  }
  const autor = m.posse != null ? porId(m.posse) : null;
  if (!autor) return null;
  const MX = C.CAMPO.meioX, s = m.ataca[time];
  const levar = (j, x, z) => {
    const dx = x - j.x, dz = z - j.z;
    j.x = x; j.z = z; j.vx = 0; j.vz = 0;
    for (const p of j.pes) { p.x += dx; p.z += dz; p.lx += dx; p.lz += dz; p.gx += dx; p.gz += dz; p.tx += dx; p.tz += dz; p.bx += dx; p.bz += dz; }
  };
  const dist = o.dist ?? 9.5, z0 = o.z0 ?? 3.0, yAlvo = o.y ?? 1.0, zAlvo = o.z ?? -1.4, v = o.v ?? 23;
  const P0 = { x: s * (MX - dist), z: z0 };
  let dx = s * MX - P0.x, dz = zAlvo - P0.z;
  const Lc = Math.hypot(dx, dz); dx /= Lc; dz /= Lc;
  const corredor = (j, larg) => { const ax = j.x - P0.x, az = j.z - P0.z, t = Math.max(0, Math.min(Lc + 2.5, ax * dx + az * dz)); return Math.hypot(ax - dx * t, az - dz * t) < larg; };
  let k = 0;
  for (const j of m.jogadores) {
    if (j === autor) continue;
    const adv = j.time !== time;
    if ((adv && (j.posicao === 'GOL' || corredor(j, 9))) || (!adv && corredor(j, 3))) { levar(j, s * (MX - 26 - (k % 3) * 2), (k % 2 ? 1 : -1) * (14 + 2 * Math.floor(k / 2))); k++; }
  }
  levar(autor, P0.x - dx * 0.55, P0.z - dz * 0.55);
  autor.rumo = Math.atan2(dz, dx);
  const xm = s * (MX - 0.3);
  const altura = vy => {
    const b = B.criarBola(P0.x, P0.z); b.p.y = 0.25; b.v.x = dx * v; b.v.z = dz * v; b.v.y = vy; b.rolando = false;
    for (let i = 0; i < 200; i++) { const xa = b.p.x, ya = b.p.y; B.passoBola(b, []); if ((b.p.x - xm) * s >= 0 && (xa - xm) * s < 0) return ya + (b.p.y - ya) * (xm - xa) / (b.p.x - xa); }
    return -1;
  };
  let lo = -2, hi = 8;
  for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (altura(mid) < yAlvo) lo = mid; else hi = mid; }
  m.posse = null; m.naMao = null; m.voo = null;
  if (autor.cond) { autor.cond.toque = null; autor.cond.busca = false; }
  Object.assign(m.bola, B.criarBola(P0.x, P0.z));
  m.bola.p.y = 0.25; m.bola.v.x = dx * v; m.bola.v.z = dz * v; m.bola.v.y = (lo + hi) / 2; m.bola.rolando = false;
  m.ultimoToque = { id: autor.id, time: autor.time, tick: m.tick };
  for (let i = 0; i < 90; i++) {
    P.passoPartida(m, P.entradaDemoPartida(m), null);
    if (r.passo()) return { m, golTick: m.tick, gol: { ...r.est.gol }, s, autor: autor.id };
  }
  return null;
}

export function golNaturalNode(L, semente, maxTicks = 4000) {
  const { P } = L;
  const m = P.criarPartida({ semente });
  const r = rastreador(L, m);
  for (let i = 0; i < maxTicks; i++) {
    P.passoPartida(m, P.entradaDemoPartida(m), null);
    if (r.passo()) return { m, golTick: m.tick, gol: { ...r.est.gol }, s: m.ataca[r.est.gol.time ?? 0], semente };
  }
  return null;
}

/** TODOS os gols naturais da partida da semente em até maxTicks (cada um com a cópia do mundo no tick do gol). */
export function golsNaturaisNode(L, semente, maxTicks = 30000, max = Infinity) {
  const { P } = L;
  const m = P.criarPartida({ semente });
  const r = rastreador(L, m);
  const gols = [];
  for (let i = 0; i < maxTicks && gols.length < max; i++) {
    P.passoPartida(m, P.entradaDemoPartida(m), null);
    if (m.partida?.estado === 'fim') break;
    if (r.passo()) gols.push({ m: structuredClone(m), golTick: m.tick, gol: { ...r.est.gol }, s: m.ataca[r.est.gol.time ?? 0], semente });
  }
  return gols;
}
