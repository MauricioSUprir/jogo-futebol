// Partida IA × IA em Node gravando o anel do replay EXATAMENTE como o main.js (rodarPasso + gravarNoAnel): a pose de
// cada passo (anim.js), x/z/rumo, a bola, o corte (jogador levado > 2 m ou bola > 2,5 m), a foto da Regra 11 em vigor
// (m.partida.imped, só lida), as marcas do passo (bit0 chute ou cabeceio para o gol, bit1 gol: replay-anel.js
// marcasDoPasso, a mesma função do main.js) e, com js/tecnicos.js, os 2 treinadores (um passo deles depois do passo da
// partida, lendo o mundo; gravados depois dos jogadores com o bit2). Para os testes da cena semiautomática (teste-saot,
// teste-replay-anel) e o medir-saot.
//   const G = await criarGravador(pastaJs);  const S = G.novaPartida(semente, {comoPagina});  G.passo(S) → eventos
// comoPagina: a entrada da IA pelo humano chega como a página (?demo=1) entrega (lib/acha-gol.mjs).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function criarGravador(pastaJs) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  const PA = await imp('partida.js');
  const RA = await imp('render/replay-anel.js');
  const C = await imp('config.js');
  const { NJ, pose } = await imp('anim.js');
  let TE = null;
  try { TE = await imp('tecnicos.js'); } catch (_) { TE = null; }
  const P = NJ * 3;
  const ent = { 0: { x: 0, z: 0, botoes: 0 } };
  Object.defineProperties(ent, { x: { value: 0, writable: true }, z: { value: 0, writable: true }, botoes: { value: 0, writable: true } });
  function novaPartida(semente, opc = {}) {
    const m = PA.criarPartida({ semente, minutosPorTempo: opc.minutosPorTempo });
    const a = RA.criarAnel({ ticks: Math.round(C.REPLAY.segundos / C.PASSO), vagas: C.REPLAY.vagas, nj: NJ });
    const est = new Map();
    const bAnt = { x: m.bola.p.x, y: m.bola.p.y, z: m.bola.p.z };
    const T = TE && opc.tecnicos !== false ? TE.criarTecnicos(m.times, semente) : null;
    return { m, a, est, bAnt, ms: 0, n: 0, comoPagina: !!opc.comoPagina, semente, T, L: T ? TE.criarLeitura() : null };
  }
  function entrada(S) {
    const e = PA.entradaDemoPartida(S.m);
    if (!S.comoPagina) return e;
    ent[0].x = ent.x = e?.x ?? 0; ent[0].z = ent.z = e?.z ?? 0; ent[0].botoes = ent.botoes = (e?.botoes ?? 0) | 0;
    return ent;
  }
  /** Um passo da partida; com `gravar`, grava no anel como o main.js. Devolve os eventos do passo. */
  function passo(S, gravar = true) {
    const { m, a, est } = S;
    const ev = PA.passoPartida(m, entrada(S), null) ?? m.eventos;
    if (S.T) { TE.leituraDoMundo(m, ev, S.L); TE.passoTecnicos(S.T, S.L); }
    if (!gravar) return ev;
    let cortou = false;
    for (const j of m.jogadores) {
      let e = est.get(j.id);
      if (!e) { e = { atu: new Float32Array(P), x: j.x, z: j.z }; est.set(j.id, e); }
      pose(j, m, e.atu);
      if (Math.hypot(j.x - e.x, j.z - e.z) > 2) cortou = true;
      e.x = j.x; e.z = j.z;
    }
    if (Math.hypot(m.bola.p.x - S.bAnt.x, m.bola.p.y - S.bAnt.y, m.bola.p.z - S.bAnt.z) > 2.5) cortou = true;
    // o treinador longe do último passo gravado (no main.js: os passos de uma cena com o mundo parado; aqui nunca acontece)
    if (S.T && C.REPLAY.saltoTecnico) for (const tc of S.T.tecs) {
      const g = ((S.tecG ??= {})[tc.id] ??= { x: NaN, z: NaN });
      if (Math.hypot(tc.j.x - g.x, tc.j.z - g.z) > C.REPLAY.saltoTecnico) cortou = true;
      g.x = tc.j.x; g.z = tc.j.z;
    }
    S.bAnt.x = m.bola.p.x; S.bAnt.y = m.bola.p.y; S.bAnt.z = m.bola.p.z;
    const tg = performance.now();
    a.inicio(m.tick, m.tick * C.PASSO, cortou);
    let v = 0;
    for (const j of m.jogadores) { const e = est.get(j.id); a.jogador(v++, j.id, j.time, j.posicao === 'GOL', j.x, j.z, j.rumo, e.atu); }
    if (S.T) for (const tc of S.T.tecs) a.jogador(v++, tc.id, tc.time, false, tc.j.x, tc.j.z, tc.j.rumo, tc.atu, true);
    const im = m.partida?.imped;
    if (im && a.foto) a.foto(im.tick, im.time, im.por, im.defensor, im.linhaX, m.ataca[im.time]);
    // as marcas pela mesma função do main.js (versões antigas sem ela: todo cabeceio como chute, como era)
    if (a.marcar) {
      if (RA.marcasDoPasso) a.marcar(RA.marcasDoPasso(ev, m.voo));
      else for (const e of ev) a.marcar(e.tipo === 'gol' ? 2 : e.tipo === 'chute' || e.tipo === 'cabeceio' ? 1 : 0);
    }
    a.fim(m.bola.p, m.bola.q);
    S.ms += performance.now() - tg; S.n++;
    return ev;
  }
  return { PA, RA, C, NJ, P, TE, novaPartida, passo };
}
