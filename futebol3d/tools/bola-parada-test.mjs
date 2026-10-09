// Bolas paradas e jogo aéreo (pedido do dono): N partidas IA x IA com as configurações padrão. Mede:
//   tiro de meta — adversário dentro da área no momento da cobrança (Regra 16: todos fora até a bola
//                  entrar em jogo); zagueiros abertos na área para a saída curta
//   bola na mão  — distância da bola ao meio das duas mãos (pose do jogo) no lateral e com o goleiro
//                  segurando (a bola "flutuava" na frente do corpo)
//   escanteio    — atacantes na área, defensores na área e na pequena área, quem fica atrás (contra-ataque)
//   disputa pelo alto (informativo) — bolas alçadas na área (cruzamento, escanteio, lançamento, corte;
//                  chute não conta) descendo na altura da cabeça: em quantas os DOIS times saltam
// node tools/bola-parada-test.mjs [partidas=6] [--base pasta]
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const pos = process.argv.slice(2).filter((a, i, A) => !a.startsWith('--') && !(i > 0 && A[i - 1].startsWith('--')));
const N = +(pos[0] || 6);
const base = path.resolve(arg('base', path.join(path.dirname(fileURLToPath(import.meta.url)), '..')));
const { Match } = await import(path.join(base, 'js/match.js'));
const { DEFAULT_SETTINGS, PITCH } = await import(path.join(base, 'js/config.js'));
const { TEAMS } = await import(path.join(base, 'js/teams.js'));
const { computePose, createPose, bonePoint, setMocap } = await import(path.join(base, 'js/anim.js'));
setMocap(JSON.parse(readFileSync(path.join(base, 'assets/mocap/locomocao.json'))));
const HL = PITCH.halfL, BOX_D = PITCH.boxDepth ?? 16.5, BOX_W = PITCH.boxHalfWidth ?? 20.16;
const PO = createPose(), o3 = [0, 0, 0];
// meio das duas mãos no mundo (palma: 8 cm abaixo do punho)
function maos(p) {
  computePose(p.pose, PO);
  const hs = ((p.data.look && p.data.look.height) || 1.8) / 1.8;
  const th = Math.PI / 2 - p.heading, c = Math.cos(th), s = Math.sin(th);
  let x = 0, y = 0, z = 0;
  for (const b of [7, 10]) { bonePoint(PO, b, 0, -0.08, 0, o3); const px = o3[0] * hs, py = o3[1] * hs, pz = o3[2] * hs; x += p.x + c * px + s * pz; y += py; z += p.z - s * px + c * pz; }
  return [x / 2, y / 2, z / 2];
}
const naArea = (m, team, x, z) => { const gx = m.ownGoalX(team); return Math.abs(gx - x) < BOX_D && Math.abs(z) < BOX_W; };
const naPequena = (m, team, x, z) => { const gx = m.ownGoalX(team); return Math.abs(gx - x) < 5.5 && Math.abs(z) < 9.16; };
const S = { tm: 0, tmInvadido: 0, tmAdv: 0, tmZagAbertos: 0, mao: [], maoGk: [], esc: 0, escAtk: 0, escDef: 0, escPeq: 0, escAtras: 0, altas: 0, disputadas: 0 };
for (let k = 0; k < N; k++) {
  const m = new Match({ home: TEAMS[k % TEAMS.length], away: TEAMS[(k + 3) % TEAMS.length], userSide: 'none', settings: { ...DEFAULT_SETTINGS, intro: false } });
  m.headless = true;
  // momento da cobrança
  const take = m.takeSetpiece.bind(m);
  m.takeSetpiece = (kind, params) => {
    const sp = m.sp;
    // conta só a cobrança que de fato sai (a do humano/IA com a área ainda ocupada fica esperando)
    const S0 = { ...S };
    if (sp && sp.type === 'goalkick') {
      S.tm++;
      const t = sp.team;
      const inv = t.opp.players.filter(q => !q.sentOff && naArea(m, t, q.x, q.z)).length;
      if (inv) S.tmInvadido++;
      S.tmAdv += inv;
      const zag = t.players.filter(q => q.role === 'DEF' && !q.sentOff && naArea(m, t, q.x, q.z) && Math.abs(q.z) > 7);
      if (zag.length >= 2) S.tmZagAbertos++;
    }
    if (sp && sp.type === 'corner') {
      S.esc++;
      const t = sp.team, d = t.opp;
      S.escAtk += t.players.filter(q => !q.sentOff && !q.isGK && q !== sp.taker && naArea(m, d, q.x, q.z)).length;
      S.escDef += d.players.filter(q => !q.sentOff && !q.isGK && naArea(m, d, q.x, q.z)).length;
      S.escPeq += d.players.filter(q => !q.sentOff && !q.isGK && naPequena(m, d, q.x, q.z)).length;
      S.escAtras += t.players.filter(q => !q.sentOff && !q.isGK && m.lx(t, q.x) < 5).length;
    }
    const r = take(kind, params);
    if (sp && m.sp === sp && !sp.taken) Object.assign(S, S0);      // não saiu: desfaz a contagem
    return r;
  };
  const aerea = new Map();      // bola alta na área: quem saltou (times)
  for (let i = 0; i < 60 * 60 * 40 && m.phase !== 'ended'; i++) {
    m.step(1 / 60, null);
    for (const e of m.events) if (e.type === 'replay') m.replayFinished();
    m.events.length = 0;
    // bola na mão
    const h = m.holder;
    if (m.ball.held && h && !(h.action && (h.action.type === 'gk_dive' || h.action.type === 'getup'))) {
      const c = maos(h), d = Math.hypot(m.ball.p.x - c[0], m.ball.p.y - c[1], m.ball.p.z - c[2]);
      (h.isGK ? S.maoGk : S.mao).push(d);
    }
    // bola alçada chegando na área (altura de cabeça) — cada lance conta uma vez
    const b = m.ball.p, lk = m.lastKick;
    const alcada = lk && ['cross', 'long', 'hpass', 'hclear', 'clear', 'gk_kick'].includes(lk.kind);
    if (m.phase === 'play' && !m.owner && alcada && b.y > 1.4 && b.y < 3 && m.ball.v.y < 0) {
      for (const t of m.teams) {
        if (!naArea(m, t, b.x, b.z)) continue;
        const key = lk.t;
        if (!aerea.has(key)) { aerea.set(key, new Set()); S.altas++; }
        const set = aerea.get(key);
        for (const p of m.players) if (p.action && p.action.type === 'header') set.add(p.team.i);
      }
    }
    if (m.phase !== 'play') {
      for (const [key, set] of aerea) if (set.size === 2 && !set.contado) { S.disputadas++; set.contado = true; }
      aerea.clear();
    }
  }
  for (const [, set] of aerea) if (set.size === 2) S.disputadas++;
}
const med = (a) => a.length ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN;
const r = [];
const c1 = S.tm > 0 && S.tmInvadido === 0;
r.push([c1, `tiro de meta: adversário dentro da área na cobrança em ${S.tmInvadido} de ${S.tm} (${(S.tmAdv / Math.max(1, S.tm)).toFixed(1)} por cobrança; alvo 0 — Regra 16)`]);
const c2 = S.tm > 0 && S.tmZagAbertos / S.tm >= 0.7;
r.push([c2, `tiro de meta: dois zagueiros abertos na área para a saída em ${(S.tmZagAbertos / Math.max(1, S.tm) * 100).toFixed(0)}% (alvo ≥ 70%)`]);
const c3 = S.mao.length > 0 && med(S.mao) <= 0.15;
r.push([c3, `lateral: bola a ${med(S.mao).toFixed(2)} m do meio das mãos (mediana de ${S.mao.length} quadros; alvo ≤ 0,15 m)`]);
const c4 = S.maoGk.length > 0 && med(S.maoGk) <= 0.15;
r.push([c4, `goleiro com a bola: a ${med(S.maoGk).toFixed(2)} m do meio das mãos (mediana de ${S.maoGk.length} quadros; alvo ≤ 0,15 m)`]);
const e = Math.max(1, S.esc);
const c5 = S.esc > 0 && S.escAtk / e >= 5 && S.escDef / e >= 7 && S.escPeq / e >= 2 && S.escAtras / e >= 2;
r.push([c5, `escanteio (${S.esc}): na área ${(S.escAtk / e).toFixed(1)} atacantes (alvo ≥ 5) e ${(S.escDef / e).toFixed(1)} defensores (alvo ≥ 7), ${(S.escPeq / e).toFixed(1)} defensores na pequena área (alvo ≥ 2), ${(S.escAtras / e).toFixed(1)} atacantes atrás para o contra-ataque (alvo ≥ 2)`]);
for (const [ok, txt] of r) console.log(`${ok ? 'PASSOU' : 'FALHOU'} | ${txt}`);
// informativo (a disputa de cabeça é medida no cenário de cruzamento de tools/disputa-aerea-test.mjs: aqui
// entram também chutões e cortes que caem na área, onde muitas vezes só um time está perto)
console.log(`info   | bolas alçadas na área: ${S.altas}, disputadas de cabeça pelos dois times em ${(S.disputadas / Math.max(1, S.altas) * 100).toFixed(0)}%`);
process.exit(r.every(x => x[0]) ? 0 : 1);
