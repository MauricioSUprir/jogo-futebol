// Recepção que NUNCA se afasta da bola (pedido do dono, 10/10: "quando a bola chega no jogador, e
// eu já mudo o analógico pro lado que eu quero, o jogador sai da bola, isso nunca pode acontecer").
//
// Canhão de passes para o jogador controlado (o passe é de um companheiro: j.recebe e m.voo como o
// jogo marca), de 8 direções em relação ao rumo do corpo (frente, diagonais, lado, por trás), rasteiros
// e quicados, de 9–20 m, chegando a 6–14 m/s, mirados no pé ou até 1 m de lado; o corpo parado, trotando
// ou correndo; o analógico solto, em 8 direções (em relação ao sentido da bola), girando, e trocado 1,0 /
// 0,5 / 0,2 s antes da bola chegar (inclusive para LONGE da bola). Mais bolas livres sem passe (rebote,
// desvio, bola espirrada perto dele). Ninguém do outro time: toda bola é alcançável.
//
// Metas (pedido da frente A, 10/10):
//  1. domina ≥ 99% das bolas;
//  2. a distância corpo–bola nunca aumenta mais que 0,15 m enquanto a bola vem (velocidade da bola
//     apontando para ele) e já esteve a ≤ 3 m dele, até o domínio (pior caso de todos);
//  3. com o analógico inclinado, o 1º toque sai na direção dele (±20°) em ≥ 95%;
//  4. 0,5 s depois do domínio a bola está a ≤ 1,2 m de um pé em ≥ 97%.
//   node tools/teste-recepcao.mjs [--js <pasta js>] [--detalhe] [--rapido]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt, percentil } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const { criarMundo, passo } = await imp('sim.js');
const { chutarRasteiro, chutar, velParaChegarCom, copiarBola, passoBola } = await imp('bola.js');
const { PASSO, BOTAO } = await imp('config.js');
const detalhe = args.includes('--detalhe');
const rapido = args.includes('--rapido');

const DEG = Math.PI / 180;
const difAng = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

/** Ticks até a bola (cópia) passar pelo ponto mais perto de (px, pz), e a distância nesse ponto. */
function chegada(b0, px, pz, max = 300) {
  const b = copiarBola(b0);
  let melhor = { i: max, d: Infinity };
  for (let i = 1; i <= max; i++) {
    passoBola(b, null);
    const d = Math.hypot(b.p.x - px, b.p.z - pz);
    if (d < melhor.d) melhor = { i, d };
    else if (d > melhor.d + 0.5) break;
  }
  return melhor;
}

const CORPOS = { parado: { mag: 0, bot: 0 }, trote: { mag: 0.5, bot: 0 }, corrida: { mag: 1, bot: 0 } };

/**
 * Um caso. c = {corpo, ang (de onde a bola vem, em relação ao rumo do corpo), lat, dist, vel, quica,
 * an: {tipo: 'solto'|'dir'|'gira', ang}, troca (s antes da chegada), livre ('passa'|'espirra'|null), sem}
 */
function caso(c) {
  const jog = [
    { id: 0, x: -20, z: 0, rumo: 0, time: 0, papel: 'humano', posicao: 'MEI' },
    { id: 1, x: 40, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'MEI' },
  ];
  const m = criarMundo({ semente: c.sem, jogadores: jog, bola: { x: 45, z: 30 }, posse: null });
  const j = m.jogadores[0], b = m.bola;
  const base = CORPOS[c.corpo];
  const eBase = { x: base.mag, z: 0, botoes: base.bot };
  for (let i = 0; i < 75; i++) passo(m, { 0: eBase });
  const h = j.rumo;
  // ponto de chegada: onde o corpo estaria seguindo reto (iterado com o tempo da bola)
  let T = 1, px = j.x, pz = j.z, ux = 1, uz = 0;
  const angO = h + c.ang * DEG; // a bola vem DESTA direção (sai de lá e anda no sentido oposto)
  for (let k = 0; k < 4; k++) {
    px = j.x + j.vx * T; pz = j.z + j.vz * T;
    ux = -Math.cos(angO); uz = -Math.sin(angO);
    const ax = px - uz * c.lat, az = pz + ux * c.lat; // mira até 1 m de lado (perpendicular à linha)
    const ox = ax - ux * c.dist, oz = az - uz * c.dist;
    const bb = { p: { x: ox, y: 0.11, z: oz }, v: { x: 0, y: 0, z: 0 }, w: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 }, rolando: true };
    lancar(bb, c, ux, uz);
    T = chegada(bb, ax, az).i * PASSO;
  }
  const ax = px - uz * c.lat, az = pz + ux * c.lat;
  if (c.livre === 'espirra') {
    // bola espirrada: começa perto dele (0,8–1,5 m) e foge devagar para um lado
    const a0 = c.ang * DEG + h;
    b.p.x = j.x + Math.cos(a0) * c.dist; b.p.y = 0.11; b.p.z = j.z + Math.sin(a0) * c.dist;
    const av = a0 + c.lat; // c.lat = desvio do sentido da bola (rad) neste tipo
    chutarRasteiro(b, Math.cos(av) * c.vel, Math.sin(av) * c.vel);
    T = 0.3;
  } else {
    b.p.x = ax - ux * c.dist; b.p.y = 0.11; b.p.z = az - uz * c.dist;
    lancar(b, c, ux, uz);
  }
  m.posse = null;
  if (!c.livre) {
    m.voo = { tipo: 'passe', de: 1, time: 0, para: 0, alvo: { x: ax, z: az }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + Math.round(T / PASSO), alto: !!c.quica };
    j.recebe = { tick: m.tick, x: ax, z: az, tipo: 'passe', chega: m.tick + Math.round(T / PASSO) };
  }
  const nT = Math.round(T / PASSO), nTroca = Math.max(0, nT - Math.round(c.troca / PASSO));
  let dom = -1, dmin = Infinity, perto3 = false, viol = 0, dirOk = null, dirErro = null, longe = null, angAn = null;
  let bDom = null;
  const N = nT + 150;
  for (let i = 0; i < N; i++) {
    let e = eBase;
    if (i >= nTroca) {
      if (c.an.tipo === 'solto') e = { x: 0, z: 0, botoes: 0 };
      else {
        const a0 = Math.atan2(uz, ux) + c.an.ang * DEG + (c.an.tipo === 'gira' ? (i - nTroca) * PASSO * 3 : 0);
        e = { x: Math.cos(a0), z: Math.sin(a0), botoes: 0 };
      }
    }
    passo(m, { 0: e });
    const d = Math.hypot(b.p.x - j.x, b.p.z - j.z);
    if (c.log && (i % 3 === 0 || m.posse === 0)) {
      const r = j.recep, t = j.cond.toque;
      c.log.push(`${i} j(${j.x.toFixed(2)},${j.z.toFixed(2)}) v=${Math.hypot(j.vx, j.vz).toFixed(2)} rumo=${(j.rumo / DEG).toFixed(0)} b(${b.p.x.toFixed(2)},${b.p.z.toFixed(2)},${b.p.y.toFixed(2)}) vb=${Math.hypot(b.v.x, b.v.z).toFixed(2)} dirb=${(Math.atan2(b.v.z, b.v.x) / DEG).toFixed(0)} an=${(Math.atan2(e.z, e.x) / DEG).toFixed(0)}/${Math.hypot(e.x, e.z).toFixed(1)} d=${d.toFixed(2)} posse=${m.posse} `
        + `rec=${r && r.ativo && r.tick === m.tick - 1 ? `${r.modo} +${r.alvo - m.tick} q(${r.qx.toFixed(2)},${r.qz.toFixed(2)})` : '-'} toque=${t ? `${t.tipo}${t.modo ? '/' + t.modo : ''}@${t.tick - m.tick}` : '-'} pés=${+j.pes[0].apoio}${+j.pes[1].apoio}`);
    }
    if (dom < 0 && m.posse === 0) {
      dom = i;
      bDom = { x: b.p.x, z: b.p.z, vx: b.v.x, vz: b.v.z };
      if (c.an.tipo !== 'solto' && i >= nTroca) angAn = Math.atan2(e.z, e.x);
    }
    if (dom < 0) {
      const vindo = b.v.x * (j.x - b.p.x) + b.v.z * (j.z - b.p.z) > 0 && Math.hypot(b.v.x, b.v.z) > 0.3;
      if (d <= 3) perto3 = true;
      if (perto3 && vindo) { dmin = Math.min(dmin, d); viol = Math.max(viol, d - dmin); }
      if (!vindo) dmin = Math.min(dmin, d);
    }
    if (dom >= 0 && i === dom && angAn != null && Math.hypot(bDom.vx, bDom.vz) >= 0.5) {
      // direção do 1º toque: a velocidade com que a bola sai do toque
      dirErro = Math.abs(difAng(angAn, Math.atan2(bDom.vz, bDom.vx))) / DEG; dirOk = dirErro <= 20;
    } else if (dom >= 0 && i === dom + 18 && angAn != null && dirOk == null) {
      // toque que quase parou a bola: o deslocamento dela em 0,3 s
      const sx = b.p.x - bDom.x, sz = b.p.z - bDom.z;
      if (Math.hypot(sx, sz) < 0.15) { dirOk = false; dirErro = 180; }
      else { dirErro = Math.abs(difAng(angAn, Math.atan2(sz, sx))) / DEG; dirOk = dirErro <= 20; }
    }
    if (dom >= 0 && i === dom + 30) {
      longe = Infinity;
      for (const p of j.pes) longe = Math.min(longe, Math.hypot(b.p.x - p.tx, b.p.z - p.tz));
      break;
    }
  }
  return { dom: dom >= 0, viol, dirOk, dirErro, longe, tempo: dom >= 0 ? dom * PASSO : null };
}

/** Lança a bola: rasteira (chega a c.vel) ou quicada (pula e quica antes de chegar). */
function lancar(bb, c, ux, uz) {
  if (!c.quica) {
    const v0 = velParaChegarCom(Math.max(0, c.dist - 0.3), c.vel);
    chutarRasteiro(bb, ux * v0, uz * v0);
  } else {
    // quicada: sobe e cai na metade do caminho (mais ou menos), depois quica até ele
    const vh = Math.min(22, velParaChegarCom(c.dist, c.vel) * 1.08);
    const tq = (0.55 * c.dist) / vh;
    chutar(bb, { x: ux * vh, y: 4.905 * tq, z: uz * vh }, { x: 0, y: 0, z: 0 });
    bb.rolando = false;
  }
}

// ------------------------------------------------------------------ grade de casos
const casos = [];
const ANG = [0, 45, -45, 90, -90, 135, -135, 180];
const ANALOG = [{ tipo: 'solto', ang: 0 }, ...[0, 45, 90, 135, 180, -135, -90, -45].map(a => ({ tipo: 'dir', ang: a })), { tipo: 'gira', ang: 90 }];
const TROCAS = [1.0, 0.5, 0.2];
let sem = 1;
for (const corpo of Object.keys(CORPOS)) for (const ang of ANG) for (const an of ANALOG) for (const troca of TROCAS) {
  if (rapido && sem % 3) { sem++; continue; }
  const k = sem++;
  casos.push({
    tipo: 'passe', corpo, ang, an, troca, sem: k,
    lat: [0, 0.5, -1.0, 0.25, 1.0][k % 5], dist: [10, 14, 18, 9, 20][(k >> 1) % 5], vel: [6, 9, 12, 14][(k >> 2) % 4],
    quica: k % 7 === 3,
  });
}
// bolas livres sem passe: rolando e passando perto (até 2 m), e espirradas perto dele
for (const corpo of ['parado', 'trote']) for (const ang of ANG) for (const an of ANALOG) {
  if (rapido && sem % 3) { sem++; continue; }
  const k = sem++;
  casos.push({ tipo: 'livre', livre: 'passa', corpo, ang, an, troca: [0.8, 0.5][k % 2], sem: k, lat: [0.4, -1.2, 2.0, -0.8][k % 4], dist: [10, 13][k % 2], vel: [4, 6, 8][k % 3], quica: false });
}
for (const corpo of ['parado', 'trote']) for (const ang of [0, 60, 120, 180, -60, -120]) for (const an of ANALOG) {
  if (rapido && sem % 3) { sem++; continue; }
  const k = sem++;
  casos.push({ tipo: 'espirrada', livre: 'espirra', corpo, ang, an, troca: 0.3, sem: k, lat: [0.6, -0.9, 1.5, 0][k % 4], dist: [0.9, 1.3][k % 2], vel: [1.5, 2.5, 3.5][k % 3], quica: false });
}

// ------------------------------------------------------------------ roda e mede
if (args.includes('--sonda')) {
  // depuração: um caso só, com o rastro passo a passo (índice na lista ou o texto da falha)
  const k = +arg('--sonda');
  const c = { ...casos[k], log: [] };
  const r = caso(c);
  console.log(JSON.stringify({ ...c, log: undefined }));
  console.log(c.log.join('\n'));
  console.log(r);
  process.exit(0);
}
const res = casos.map(c => ({ c, r: caso(c) }));
const grupos = {};
function g(nome) { return (grupos[nome] ??= { n: 0, dom: 0, viols: [], dirN: 0, dirOk: 0, pertoN: 0, pertoOk: 0 }); }
const falhas = [];
for (const { c, r } of res) {
  for (const nome of ['TODOS', c.tipo === 'passe' ? `passe ${c.corpo}${c.quica ? ' quicado' : ''}` : c.tipo, `analógico ${c.an.tipo === 'dir' ? (Math.abs(c.an.ang) >= 135 ? 'para longe' : 'inclinado') : c.an.tipo}`, `troca ${c.troca} s`]) {
    const G = g(nome);
    G.n++;
    if (r.dom) G.dom++;
    G.viols.push(r.viol);
    if (r.dirOk != null) { G.dirN++; if (r.dirOk) G.dirOk++; }
    if (r.longe != null) { G.pertoN++; if (r.longe <= 1.2) G.pertoOk++; }
  }
  if (!r.dom || r.viol > 0.15 || r.dirOk === false || (r.longe != null && r.longe > 1.2)) {
    falhas.push(`[${casos.indexOf(c)}] ${c.tipo} ${c.corpo} de ${c.ang}° lat ${c.lat} ${c.dist} m ${c.vel} m/s${c.quica ? ' quicado' : ''} analógico ${c.an.tipo} ${c.an.ang}° troca ${c.troca}: `
      + `${r.dom ? `dominou (${fmt(r.tempo, 2)} s)` : 'NÃO dominou'} aumento ${fmt(r.viol, 2)} m${r.dirErro != null ? ` 1º toque ${fmt(r.dirErro, 0)}°` : ''}${r.longe != null ? ` bola a ${fmt(r.longe, 2)} m do pé` : ''}`);
  }
}
const lin = [['grupo', 'casos', 'dominou', 'aumento máx (p99)', '1º toque ±20°', 'bola ≤ 1,2 m em 0,5 s']];
const ordem = Object.keys(grupos).sort((a, b) => (a === 'TODOS' ? -1 : b === 'TODOS' ? 1 : a.localeCompare(b)));
for (const nome of ordem) {
  const G = grupos[nome];
  lin.push([nome, G.n, `${fmt((100 * G.dom) / G.n, 1)}%`, `${fmt(Math.max(...G.viols), 2)} (${fmt(percentil(G.viols, 0.99), 2)}) m`,
    G.dirN ? `${fmt((100 * G.dirOk) / G.dirN, 1)}%` : '—', G.pertoN ? `${fmt((100 * G.pertoOk) / G.pertoN, 1)}%` : '—']);
}
console.log(`Recepção (${res.length} bolas; lógica de ${path.relative(process.cwd(), JS) || '.'}):`);
console.log(tabelaTexto(lin));
if (detalhe) for (const f of falhas.slice(0, +arg("--max", 80))) console.log('  - ' + f);
else if (falhas.length) { console.log(`  (${falhas.length} casos fora de alguma meta; --detalhe lista). Exemplos:`); for (const f of falhas.slice(0, 6)) console.log('  - ' + f); }

const T = grupos.TODOS;
const metas = [
  ['domina a bola (passes e bolas livres alcançáveis)', T.dom / T.n >= 0.99, `${fmt((100 * T.dom) / T.n, 1)}% (${T.dom}/${T.n})`, '≥ 99%'],
  ['distância corpo–bola nunca aumenta (bola vindo, a ≤ 3 m, antes do domínio)', Math.max(...T.viols) <= 0.15, `pior ${fmt(Math.max(...T.viols), 2)} m`, '≤ 0,15 m'],
  ['1º toque na direção do analógico (±20°)', T.dirN > 0 && T.dirOk / T.dirN >= 0.95, `${fmt((100 * T.dirOk) / Math.max(1, T.dirN), 1)}% (${T.dirOk}/${T.dirN})`, '≥ 95%'],
  ['bola a ≤ 1,2 m do pé 0,5 s depois do domínio', T.pertoN > 0 && T.pertoOk / T.pertoN >= 0.97, `${fmt((100 * T.pertoOk) / Math.max(1, T.pertoN), 1)}% (${T.pertoOk}/${T.pertoN})`, '≥ 97%'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[2], x[3], x[1] ? 'PASSOU' : 'REPROVOU'])]));
const ok = metas.every(x => x[1]);
console.log(ok ? '\nteste-recepcao: PASSOU' : '\nteste-recepcao: REPROVOU');
process.exit(ok ? 0 : 1);
