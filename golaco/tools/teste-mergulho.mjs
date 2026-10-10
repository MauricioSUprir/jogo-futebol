// Goleiro que PULA e ESPALMA (pedido do dono, 10/10: "o goleiro não pula, e nem espalma direito").
// Canhão de chutes no alvo (de 9 a 26 m, de frente e de lado, a 0,5–3,0 m do goleiro na linha dele, da
// grama ao ângulo, a 18–27 m/s) contra um goleiro médio e um bom. Mede pela POSE desenhada (anim.js), como o
// jogador vê:
//  1. chute no alvo fora do alcance em pé — a bola passa a > 1 m de onde o goleiro estava 0,5 s antes (com
//     menos tempo que isso ele não chega andando de lado): 100% com mergulho desenhado — os dois pés fora
//     do chão (tornozelos > 0,12 m) e o tronco inclinado > 45° em algum quadro;
//  2. nas defesas, a mão a ≤ 0,25 m da bola no tick do contato (≥ 95%);
//  3. espalmadas que morrem na zona perigosa (à frente do gol, < 11 m da linha, |z| < 9 m: a bola fica lá
//     abaixo de 4 m/s, jogável para o rebote) ≤ 10% — nunca de volta para o meio da área;
//  4. o pé do goleiro não patina nem salta no mergulho e no levantar (as metas do teste-patinacao: plantado
//     ≤ 0,05 m/s; deslocamento por quadro ≤ (2,5·v + 3)·dt; pouso ≤ 0,19·v + 0,81 m/s — com v a maior
//     velocidade do corpo: a do centro no chão ou a da pelve desenhada, que no mergulho também sobe e cai);
//  5. informação: no mergulho, quanto tempo do contato até estar de pé de novo (cair, ficar no chão, levantar).
//   node tools/teste-mergulho.mjs [--js <pasta js>] [--detalhe]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt, percentil } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const { criarMundo, passo, jogadorPorId } = await imp('sim.js');
const { CAMPO, PASSO } = await imp('config.js');
const { pose, J, NJ } = await imp('anim.js');
const { copiarBola, passoBola } = await imp('bola.js');
const detalhe = args.includes('--detalhe');

const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;
const TORN = [J.tornozeloE, J.tornozeloD];
const DEG = Math.PI / 180;
const limiteBalanco = v => 2.5 * v + 3;
const limitePouso = v => 0.19 * v + 0.81;

/**
 * Onde a bola espalmada fica jogável: sem ninguém, pela física da bola, o ponto em que ela "morre" (no chão
 * ou baixa, abaixo de 4 m/s — onde um atacante a domina) ou onde está depois de 3 s; {fora: true} se antes
 * disso ela sai do campo (linha de fundo, por cima do travessão, lateral) ou entra no gol.
 */
function destinoEspalmada(b0) {
  const b = copiarBola(b0);
  for (let i = 0; i < 180; i++) {
    passoBola(b, null);
    if (b.p.x > GX || Math.abs(b.p.z) > CAMPO.meioZ) return { fora: true };
    if (b.p.y < 0.5 && Math.hypot(b.v.x, b.v.z) < 4) return { fora: false, x: b.p.x, z: b.p.z };
  }
  return { fora: false, x: b.p.x, z: b.p.z };
}

function caso(c) {
  const jog = [
    { id: 0, x: 0, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: c.attr },
  ];
  const ang = c.ang * DEG;
  const bx = GX - Math.cos(ang) * c.d, bz = Math.sin(ang) * c.d;
  const m = criarMundo({ semente: c.sem, jogadores: jog, bola: { x: bx, z: bz }, posse: null });
  for (let i = 0; i < 120; i++) passo(m, {}); // o goleiro se posiciona
  const g = jogadorPorId(m, 20);
  // alvo no plano do goleiro: lat m para um lado, na altura y
  const pz = g.z + c.lado * c.lat;
  const kx = (GX - bx) / (g.x - bx);
  const zLinha = bz + (pz - bz) * kx;
  if (Math.abs(zLinha) > MEIO - 0.2) return null; // fora do gol: não conta
  const ux0 = GX - bx, uz0 = zLinha - bz, D = Math.hypot(ux0, uz0);
  const ux = ux0 / D, uz = uz0 / D;
  const Dg = Math.hypot(g.x - bx, pz - bz);
  let lo = -0.2, hi = 0.6;
  for (let k = 0; k < 30; k++) {
    const el = (lo + hi) / 2;
    const t = Dg / (c.v * Math.cos(el));
    const yy = 0.11 + c.v * Math.sin(el) * t - 4.905 * t * t;
    if (yy < c.y) lo = el; else hi = el;
  }
  const el = (lo + hi) / 2;
  const b = m.bola;
  b.v.x = ux * c.v * Math.cos(el); b.v.y = c.v * Math.sin(el); b.v.z = uz * c.v * Math.cos(el);
  b.rolando = false;
  m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
  const P = new Float32Array(NJ * 3);
  const r = { res: null, latCorpo: null, mergulho: false, inclinou: 0, voou: false, maoContato: null, destino: null, dur: null, pat: { plantado: 0, razao: 0, pouso: 0 } };
  let ant = null, ultimo = null;
  const latPlano = () => Math.abs(b.p.z - g.z);
  const hist = []; // centro do goleiro por tick (para a distância lateral 0,5 s antes de a bola chegar)
  for (let i = 0; i < 200; i++) {
    const preB = { x: b.p.x, y: b.p.y, z: b.p.z };
    hist.push(g.z);
    // a bola chega ao plano do goleiro (ou é defendida): a distância lateral de onde ele estava 0,5 s antes
    if (r.latCorpo == null && preB.x >= g.x - 0.35) r.latCorpo = Math.abs(preB.z - hist[Math.max(0, i - 30)]);
    pose(g, m, P);
    const preP = Float32Array.from(P);
    passo(m, {});
    pose(g, m, P);
    // mergulho desenhado: os dois pés fora do chão e o tronco inclinado
    const yE = P[J.tornozeloE * 3 + 1], yD = P[J.tornozeloD * 3 + 1];
    if (yE > 0.12 && yD > 0.12) r.voou = true;
    const tx = P[J.pescoco * 3] - P[J.pelve * 3], ty = P[J.pescoco * 3 + 1] - P[J.pelve * 3 + 1], tz = P[J.pescoco * 3 + 2] - P[J.pelve * 3 + 2];
    const incl = Math.acos(Math.max(-1, Math.min(1, ty / (Math.hypot(tx, ty, tz) || 1)))) / DEG;
    r.inclinou = Math.max(r.inclinou, incl);
    // duração (informação): do contato até ficar de pé, no mergulho
    if (g.mergulho && g.mergulho !== ultimo && g.mergulho.tc != null) { ultimo = g.mergulho; if (g.mergulho.tipo === 'mergulho') r.dur = (g.mergulho.fim - g.mergulho.tc) * PASSO; }
    // patinação do goleiro (o mesmo critério do teste-patinacao)
    const pel = [P[J.pelve * 3], P[J.pelve * 3 + 1], P[J.pelve * 3 + 2]];
    const vPel = ant ? Math.hypot(pel[0] - ant.pel[0], pel[1] - ant.pel[1], pel[2] - ant.pel[2]) / PASSO : 0;
    const atu = { t: TORN.map(k => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]), sim: g.pes.map(p => ({ apoio: p.apoio, x: p.x, z: p.z })), v: Math.max(Math.hypot(g.vx, g.vz), vPel), pel };
    if (ant) {
      const v = Math.max(atu.v, ant.v);
      for (let p = 0; p < 2; p++) {
        const d = Math.hypot(atu.t[p][0] - ant.t[p][0], atu.t[p][1] - ant.t[p][1], atu.t[p][2] - ant.t[p][2]);
        const vp = d / PASSO, s0 = ant.sim[p], s1 = atu.sim[p];
        const g0 = g.mergulho, onde = g0 ? `t ${m.tick - g0.tick0} (tc ${g0.tc - g0.tick0}, fim ${g0.fim - g0.tick0}) ${g0.tipo}` : `sem mergulho (tick ${m.tick})`;
        if (s0.apoio && s1.apoio && s0.x === s1.x && s0.z === s1.z && vp > r.pat.plantado) { r.pat.plantado = vp; r.pat.ondePl = `pé ${p} ${onde}`; }
        if (!s0.apoio && s1.apoio) r.pat.pouso = Math.max(r.pat.pouso, vp / limitePouso(v));
        if (vp / limiteBalanco(v) > r.pat.razao) { r.pat.razao = vp / limiteBalanco(v); r.pat.ondeRz = `pé ${p} ${onde} apoio ${s0.apoio}->${s1.apoio}`; }
      }
    }
    ant = atu;
    for (const e of m.eventos) {
      if (e.tipo === 'gol' && !r.res) r.res = 'gol';
      if (e.tipo === 'defesa' && !r.res) {
        r.res = e.modo;
        if (r.latCorpo == null) r.latCorpo = Math.abs(preB.z - hist[Math.max(0, i - 30)]);
        // a mão (a mais perto) e a bola no contato: a pose do começo do passo e a do fim
        let dm = Infinity;
        for (const PP of [preP, P]) for (const k of [J.maoE, J.maoD]) dm = Math.min(dm, Math.hypot(PP[k * 3] - preB.x, PP[k * 3 + 1] - preB.y, PP[k * 3 + 2] - preB.z));
        r.maoContato = dm;
        if (e.modo === 'espalmada') r.destino = destinoEspalmada(b);
      }
    }
    if (!r.res && b.p.x > GX + 0.3) r.res = 'fora';
    if (r.res && g.mergulho == null && i > 100) break;
  }
  r.mergulho = r.voou && r.inclinou > 45;
  void latPlano;
  return r;
}

const casos = [];
let sem = 1;
for (const attr of [{ reflexo: 72, posicionamento: 72, mergulho: 72 }, { reflexo: 86, posicionamento: 84, mergulho: 86 }]) {
  for (const d of [9, 14, 20, 26]) for (const ang of [-28, 0, 28]) for (const lat of [0.5, 1.2, 1.8, 2.4, 3.0]) for (const y of [0.25, 0.8, 1.4, 2.0]) {
    const k = sem++;
    casos.push({ attr, d, ang, lat, y, lado: k % 2 ? 1 : -1, v: 18 + (k % 4) * 3, sem: 7000 + k });
  }
}
const res = [];
for (const c of casos) { const r = caso(c); if (r) res.push({ c, r }); }

const noAlvo = res.filter(x => x.r.res === 'gol' || x.r.res === 'encaixe' || x.r.res === 'espalmada');
const longe = noAlvo.filter(x => x.r.latCorpo != null && x.r.latCorpo > 1.0);
const comMergulho = longe.filter(x => x.r.mergulho);
const defesas = noAlvo.filter(x => x.r.res === 'encaixe' || x.r.res === 'espalmada');
const maoOk = defesas.filter(x => x.r.maoContato != null && x.r.maoContato <= 0.25);
const esp = defesas.filter(x => x.r.res === 'espalmada');
const perigo = esp.filter(x => x.r.destino && !x.r.destino.fora && GX - x.r.destino.x < 11 && Math.abs(x.r.destino.z) < 9);
const durs = res.map(x => x.r.dur).filter(v => v != null);
const pat = res.reduce((a, x) => ({ plantado: Math.max(a.plantado, x.r.pat.plantado), razao: Math.max(a.razao, x.r.pat.razao), pouso: Math.max(a.pouso, x.r.pat.pouso) }), { plantado: 0, razao: 0, pouso: 0 });

console.log(`Goleiro: ${res.length} chutes, ${noAlvo.length} no alvo (${defesas.length} defesas: ${defesas.filter(x => x.r.res === 'encaixe').length} encaixes, ${esp.length} espalmadas); lógica de ${path.relative(process.cwd(), JS) || '.'}`);
const porAltura = [['bola no plano', 'no alvo a > 1 m (0,5 s antes)', 'com mergulho', 'defesas', 'mão ≤ 0,25 m']];
for (const y of [0.25, 0.8, 1.4, 2.0]) {
  const l = longe.filter(x => x.c.y === y), dd = defesas.filter(x => x.c.y === y);
  porAltura.push([`${fmt(y, 2)} m`, l.length, `${l.filter(x => x.r.mergulho).length}`, dd.length, `${dd.filter(x => x.r.maoContato <= 0.25).length}`]);
}
console.log(tabelaTexto(porAltura));
if (detalhe) {
  for (const x of longe.filter(x => !x.r.mergulho).slice(0, 20)) console.log(`  sem mergulho: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y} v ${x.c.v}: ${x.r.res}, a ${fmt(x.r.latCorpo, 2)} m, voou ${x.r.voou}, inclinou ${fmt(x.r.inclinou, 0)}°`);
  for (const x of defesas.filter(x => !(x.r.maoContato <= 0.25)).slice(0, 20)) console.log(`  mão longe: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y} v ${x.c.v}: ${x.r.res}, mão a ${fmt(x.r.maoContato, 2)} m`);
  for (const x of res.filter(x => x.r.pat.plantado > 0.05).slice(0, 12)) console.log(`  pé plantado anda ${fmt(x.r.pat.plantado, 2)} m/s: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y}: ${x.r.pat.ondePl}`);
  for (const x of res.filter(x => x.r.pat.razao > 1).slice(0, 12)) console.log(`  pé salta ${fmt(x.r.pat.razao, 2)}: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y}: ${x.r.pat.ondeRz}`);
  for (const x of perigo.slice(0, 20)) console.log(`  espalmada na zona: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y}: (${fmt(x.r.destino.x, 1)}, ${fmt(x.r.destino.z, 1)})`);
}
const pc = (a, b) => `${fmt((100 * a) / Math.max(1, b), 1)}% (${a}/${b})`;
const metas = [
  ['chute no alvo a > 1 m do goleiro (0,5 s antes): mergulho desenhado (pés fora do chão e tronco > 45°)', longe.length > 0 && comMergulho.length === longe.length, pc(comMergulho.length, longe.length), '100%'],
  ['nas defesas, a mão a ≤ 0,25 m da bola no contato', defesas.length > 0 && maoOk.length / defesas.length >= 0.95, pc(maoOk.length, defesas.length), '≥ 95%'],
  ['espalmadas que morrem na zona perigosa (< 11 m da linha, |z| < 9 m)', esp.length >= 10 && perigo.length / esp.length <= 0.10, pc(perigo.length, esp.length), '≤ 10%'],
  ['pé do goleiro plantado não anda (mergulho e levantar)', pat.plantado <= 0.05, `${fmt(pat.plantado, 3)} m/s`, '≤ 0,05 m/s'],
  ['pé do goleiro não salta: desloc. por quadro / (2,5·v + 3)·dt', pat.razao <= 1, fmt(pat.razao, 2), '≤ 1'],
  ['pouso do pé do goleiro / (0,19·v + 0,81 m/s)', pat.pouso <= 1, fmt(pat.pouso, 2), '≤ 1'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[2], x[3], x[1] ? 'PASSOU' : 'REPROVOU'])]));
if (durs.length) console.log(`\nmergulho, do contato até de pé (informação): mediana ${fmt(percentil(durs, 0.5), 2)} s, p10 ${fmt(percentil(durs, 0.1), 2)} s, p90 ${fmt(percentil(durs, 0.9), 2)} s`);
const ok = metas.every(x => x[1]);
console.log(ok ? '\nteste-mergulho: PASSOU' : '\nteste-mergulho: REPROVOU');
process.exit(ok ? 0 : 1);
