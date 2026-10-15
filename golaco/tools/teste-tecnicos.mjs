// Área técnica e treinadores (pedido do dono de 12/10: "quero a área técnica e o treinador"; js/tecnicos.js,
// estadio-forma.js areaTecnica/retasAreaTecnica). Partidas IA × IA inteiras (sementes 1–24, 2 tempos de 4 min), os
// treinadores lendo o mundo por leituraDoMundo a cada passo, como na página:
//   T1  área técnica (IFAB Regra 1): a frente a 1,00 m da lateral, os lados 1,00 m além do banco, o fundo ≤ 39,7, linha de
//       0,12 m, as duas espelhadas (±5 cm);
//   T2  o centro e os dois pés dentro da área (margem 0,15 m) em 100% dos passos, z ≥ 35;
//   T3  andando ≤ 1,4 m/s e ≤ 1,5 m/s² (p99); comemorando, recuando ou esquivando (e freando depois deles) ≤ 3,0 m/s;
//       nunca > 0,15 m por passo;
//   T4  pé plantado ≤ 0,05 m/s; o tornozelo nunca salta mais que (2,5·v + 3)·dt (como no teste-cortejo);
//   T5  pose sem NaN; os ossos com o comprimento da pose de referência ± 1 mm; a mão a ≥ RAIO_CABECA + 0,02 m do centro da
//       cabeça; a mão ≤ 4 m/s fora da comemoração e ≤ 7 m/s nela (p99), nunca > 0,15 m por passo;
//   T6  olha a bola: o rumo da cabeça a ≤ 25° da direção da bola (mediana) e ≤ 45° (p90), com a bola em jogo;
//   T7  gol do time: a mão acima do topo da cabeça em 0,25–0,40 s em 100% dos gols, comemorando ≥ 3 s; gol sofrido: as
//       mãos na cabeça ou agachado em ≤ 0,6 s em 100%;
//   T8  observando ou andando (sem gesto de braço) 55–85% do tempo de bola rolando; 1–2,5 instruções por minuto de bola
//       rolando; o mesmo (gesto, variante) nunca duas vezes seguidas; cada variante ≥ 15% do seu gesto;
//   T9  a mesma sequência de leituras dá a pose bit a bit igual em 2 execuções, com Math.random trocado por uma função
//       que lança erro;
//   T10 o hash da partida no fim de 3 partidas é o mesmo com e sem os treinadores;
//   T11 ninguém tapa a bola na TV: o raio da câmera de TV até a bola não cruza a cápsula de nenhum treinador (r 0,30 m,
//       1,85 m) em 100% dos passos com a bola em jogo; nem o do condutor (pelve e pés) em ≥ 99,5%. Câmeras PC 40/18,3 e
//       celular 46/12,3 com o foco na bola (limites da câmera: z ≤ 23; o pior caso, a câmera atrás da bola);
//   T12 a bola não atravessa: o centro da bola dentro da cápsula (r 0,25 + raio da bola) ≤ 1 passo por partida em média e
//       nenhum episódio > 4 passos;
//   T13 treinador e jogador nunca se sobrepõem (≥ 0,5 m entre os centros); ≥ 1 m em ≥ 99,9% dos passos;
//   T14 custo ≤ 0,05 ms por passo (passoTecnicos com as 2 poses; mediana de 3 execuções);
//   T15 câmeras roteirizadas (pré-jogo, comemoração, lateral do golaço) a ≥ 0,6 m de qualquer treinador em 100% dos
//       quadros; e (contraprova 15/10) a lateral do golaço passando por um treinador sem salto (≤ 0,3 m por quadro: o z
//       dela é do plano inteiro);
//   T16 treinadorDoTime(T, t) (o gancho das cenas): {id, time, x, z, rumo, kit} do time, dentro da área técnica; null sem
//       treinadores.
// Na versão sem os treinadores (main/saot antes desta frente) os módulos não existem: reprova.
//   node tools/teste-tecnicos.mjs [--js <pasta js>] [--sementes N] [--par N] [--min M]
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const MIN_TEMPO = +arg('--min', 4);
const NS = +arg('--sementes', 24);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const GRAU = 180 / Math.PI;

// ------------------------------------------------------------------------------------------------ geometria
/** Distância entre os segmentos P0P1 e Q0Q1 (3D). */
function distSeg(px, py, pz, qx, qy, qz, rx, ry, rz, sx, sy, sz) {
  const ux = qx - px, uy = qy - py, uz = qz - pz, vx = sx - rx, vy = sy - ry, vz = sz - rz, wx = px - rx, wy = py - ry, wz = pz - rz;
  const a = ux * ux + uy * uy + uz * uz, b = ux * vx + uy * vy + uz * vz, c = vx * vx + vy * vy + vz * vz;
  const d = ux * wx + uy * wy + uz * wz, e = vx * wx + vy * wy + vz * wz, D = a * c - b * b;
  let sN, sD = D, tN, tD = D;
  if (D < 1e-9) { sN = 0; sD = 1; tN = e; tD = c; }
  else { sN = b * e - c * d; tN = a * e - b * d; if (sN < 0) { sN = 0; tN = e; tD = c; } else if (sN > sD) { sN = sD; tN = e + b; tD = c; } }
  if (tN < 0) { tN = 0; if (-d < 0) sN = 0; else if (-d > a) sN = sD; else { sN = -d; sD = a; } }
  else if (tN > tD) { tN = tD; if (-d + b < 0) sN = 0; else if (-d + b > a) sN = sD; else { sN = -d + b; sD = a; } }
  const sc = Math.abs(sN) < 1e-12 ? 0 : sN / sD, tc = Math.abs(tN) < 1e-12 ? 0 : tN / tD;
  const dx = wx + sc * ux - tc * vx, dy = wy + sc * uy - tc * vy, dz = wz + sc * uz - tc * vz;
  return Math.hypot(dx, dy, dz);
}
// cápsula do treinador para a TV (T11): eixo de 0,30 a 1,55 m, raio 0,30 (1,85 m de altura)
const CAP_TV = { y0: 0.3, y1: 1.55, r: 0.3 };
/** O raio de C até B cruza a cápsula do treinador em (cx, cz)? */
const cruza = (C, bx, by, bz, cx, cz) => distSeg(C[0], C[1], C[2], bx, by, bz, cx, CAP_TV.y0, cz, cx, CAP_TV.y1, cz) < CAP_TV.r;
/** Câmera de TV com o foco na bola (os limites do foco da câmera de TV: render/camera.js PERFIS.tv). */
function cameraTV(bx, bz, dist, alt, out) {
  out[0] = Math.max(-38.5, Math.min(38.5, bx)); out[1] = alt; out[2] = Math.max(-22, Math.min(23, bz)) + dist;
  return out;
}
const TVS = [['PC', 40, 18.3], ['celular', 46, 12.3]];

// ------------------------------------------------------------------------------------------------ uma partida (filho)
async function coletar(sem) {
  const P = await imp('partida.js'), S = await imp('sim.js'), C = await imp('config.js');
  const TE = await imp('tecnicos.js'), EF = await imp('estadio-forma.js');
  const { J, NJ, RAIO_CABECA } = await imp('anim.js');
  const { PASSO, BOLA, TECNICOS } = C;
  const m = P.criarPartida({ semente: sem, minutosPorTempo: MIN_TEMPO });
  const T = TE.criarTecnicos(m.times, sem), L = TE.criarLeitura();
  const areas = [EF.areaTecnica(0), EF.areaTecnica(1)];
  // ossos (pares de juntas) e o comprimento de referência (a pose de criação, parado)
  const OSSOS = [[J.pelve, J.lombar], [J.lombar, J.peito], [J.peito, J.pescoco], [J.pescoco, J.cabeca], [J.ombroE, J.ombroD],
    [J.ombroE, J.cotoveloE], [J.cotoveloE, J.maoE], [J.ombroD, J.cotoveloD], [J.cotoveloD, J.maoD],
    [J.quadrilE, J.joelhoE], [J.joelhoE, J.tornozeloE], [J.quadrilD, J.joelhoD], [J.joelhoD, J.tornozeloD]];
  const comp = (o, a, b) => Math.hypot(o[a * 3] - o[b * 3], o[a * 3 + 1] - o[b * 3 + 1], o[a * 3 + 2] - o[b * 3 + 2]);
  const ref = T.tecs.map(tc => OSSOS.map(([a, b]) => comp(tc.atu, a, b)));
  const R = {
    sem, passos: 0, fora: 0, foraEx: '', zMin: Infinity,
    vAndaMax: 0, vRapMax: 0, passoMax: 0, acel: new Uint32Array(1001), nAnda: 0,
    plantadoMax: 0, saltoMax: 0, nSalto: 0,
    nan: 0, ossoMax: 0, ossoEx: '', maoCabMin: Infinity, maoCabEx: '', maoVel: new Uint32Array(1001), nMao: 0, maoVelC: new Uint32Array(1001), maoPasso: 0, maoPassoEx: '',
    angulos: new Uint32Array(181), nAng: 0,
    gols: [], rolando: 0, observa: [0, 0], instrui: [0, 0], seq: [[], []], repetidos: 0, repEx: '',
    emJogo: 0, tv: { PC: 0, celular: 0 }, tvEx: '', condutor: 0, condutorPassos: 0,
    dentroBola: 0, episodio: 0, episodioMax: 0, distMin: Infinity, distMinEx: '', abaixo1: 0,
    hash: null, hashSem: null, ms: [],
  };
  const est = T.tecs.map(() => ({ torn: null, pl: [null, null], mao: null, ultimoEstado: '', ultimaVar: -1 }));
  const golPend = [];
  let ep = 0;
  const C3 = [0, 0, 0];
  const sinal = (tc, o) => {
    // pés: tornozelos desenhados
    for (const iT of [J.tornozeloE, J.tornozeloD]) {
      const x = o[iT * 3], z = o[iT * 3 + 2];
      if (!EF.dentroAreaTecnica(tc.time, x, z, 0.15)) return `pé em (${fmt(x, 2)}, ${fmt(z, 2)})`;
    }
    if (!EF.dentroAreaTecnica(tc.time, tc.j.x, tc.j.z, 0.15)) return `centro em (${fmt(tc.j.x, 2)}, ${fmt(tc.j.z, 2)})`;
    return null;
  };
  for (let i = 0; i < 400000 && m.partida.estado !== 'fim'; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m), null) ?? m.eventos;
    TE.leituraDoMundo(m, ev, L);
    const t0 = performance.now();
    TE.passoTecnicos(T, L);
    if (i % 7 === 0) R.ms.push(performance.now() - t0);
    R.passos++;
    const b = m.bola.p;
    for (const e of ev) if (e.tipo === 'gol') golPend.push({ tick: T.k, time: e.time === 1 ? 1 : 0, mao: [null, null], sofreu: [null, null], comemora: [0, 0] });
    const emJogo = L.emJogo;
    if (emJogo) R.emJogo++;
    const rolando = emJogo;
    if (rolando) R.rolando++;
    // condutor (T11): pelve e pés
    const cond = m.posse != null ? m.jogadores.find(j => j.id === m.posse) : null;
    T.tecs.forEach((tc, k) => {
      const o = tc.atu, j = tc.j, e = est[k];
      // T2
      const s = sinal(tc, o);
      if (s) { R.fora++; if (!R.foraEx) R.foraEx = `${tc.id} ${s} no passo ${i} da semente ${sem} (${tc.estado})`; }
      R.zMin = Math.min(R.zMin, j.z);
      // T3
      const v = Math.hypot(j.vx, j.vz);
      if (e.v != null) {
        const a = Math.hypot(j.vx - e.vx, j.vz - e.vz) / PASSO;
        if (tc.modo === 'anda' && tc.estado !== 'comemora') { R.vAndaMax = Math.max(R.vAndaMax, v); R.acel[Math.min(1000, Math.round(a * 100))]++; R.nAnda++; }
        else R.vRapMax = Math.max(R.vRapMax, v);
        R.passoMax = Math.max(R.passoMax, Math.hypot(j.x - e.x, j.z - e.z));
      }
      e.v = v; e.vx = j.vx; e.vz = j.vz; e.x = j.x; e.z = j.z;
      // T4: tornozelos desenhados (fora do pulinho: tc.noAr)
      const cur = [o[J.tornozeloE * 3], o[J.tornozeloE * 3 + 1], o[J.tornozeloE * 3 + 2], o[J.tornozeloD * 3], o[J.tornozeloD * 3 + 1], o[J.tornozeloD * 3 + 2]];
      const pl = [j.pes[0].apoio ? `${j.pes[0].x},${j.pes[0].z}` : null, j.pes[1].apoio ? `${j.pes[1].x},${j.pes[1].z}` : null];
      if (e.torn && !tc.noAr && !e.noAr) {
        for (let p = 0; p < 2; p++) {
          const d = Math.hypot(cur[p * 3] - e.torn[p * 3], cur[p * 3 + 1] - e.torn[p * 3 + 1], cur[p * 3 + 2] - e.torn[p * 3 + 2]);
          if (pl[p] && pl[p] === e.pl[p]) R.plantadoMax = Math.max(R.plantadoMax, d / PASSO);
          const lim = (2.5 * v + 3) * PASSO;
          if (d > lim + 1e-9) R.nSalto++;
          R.saltoMax = Math.max(R.saltoMax, d / lim);
        }
      }
      e.torn = cur; e.pl = pl; e.noAr = tc.noAr;
      // T5
      for (let q = 0; q < o.length; q++) if (!Number.isFinite(o[q])) { R.nan++; break; }
      OSSOS.forEach(([a2, b2], n) => {
        const dv = Math.abs(comp(o, a2, b2) - ref[k][n]);
        if (dv > R.ossoMax) { R.ossoMax = dv; R.ossoEx = `${tc.id} osso ${n} (${tc.estado}/${tc.variante}, postura ${tc.postura})`; }
      });
      const ic = J.cabeca * 3;
      for (const iM of [J.maoE, J.maoD]) {
        const d = Math.hypot(o[iM * 3] - o[ic], o[iM * 3 + 1] - o[ic + 1], o[iM * 3 + 2] - o[ic + 2]);
        if (d < R.maoCabMin) { R.maoCabMin = d; R.maoCabEx = `${tc.id} ${tc.estado}/${tc.variante} postura ${tc.postura}`; }
      }
      const maos = [o[J.maoE * 3], o[J.maoE * 3 + 1], o[J.maoE * 3 + 2], o[J.maoD * 3], o[J.maoD * 3 + 1], o[J.maoD * 3 + 2]];
      if (e.mao) {
        for (let p = 0; p < 2; p++) {
          const dm = Math.hypot(maos[p * 3] - e.mao[p * 3], maos[p * 3 + 1] - e.mao[p * 3 + 1], maos[p * 3 + 2] - e.mao[p * 3 + 2]), vm = dm / PASSO;
          if (dm > R.maoPasso) { R.maoPasso = dm; R.maoPassoEx = `semente ${sem}: ${tc.id} ${tc.estado}/${tc.variante} postura ${tc.postura} t ${fmt((T.k - tc.desde) * PASSO, 2)} s, v ${fmt(v, 2)} m/s`; }
          if (tc.estado !== 'comemora') { R.maoVel[Math.min(1000, Math.round(vm * 50))]++; R.nMao++; }
          else R.maoVelC[Math.min(1000, Math.round(vm * 50))]++;
        }
      }
      e.mao = maos;
      // T6: rumo da cabeça (pescoço → cabeça, no chão) × direção da bola
      if (emJogo) {
        const hx = o[ic] - o[J.pescoco * 3], hz = o[ic + 2] - o[J.pescoco * 3 + 2];
        const yaw = Math.atan2(hz, hx), alvo = Math.atan2(b.z - o[ic + 2], b.x - o[ic]);
        let d = Math.abs(yaw - alvo) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d;
        R.angulos[Math.min(180, Math.round(d * GRAU))]++; R.nAng++;
      }
      // T7: a mão acima do topo da cabeça; as mãos na cabeça ou agachado
      const topo = o[ic + 1] + RAIO_CABECA * 1.1;
      for (const g of golPend) {
        const t = (T.k - g.tick) * PASSO;
        if (t < 0 || t > 3.5) continue;
        if (g.time === tc.time) {
          if (g.mao[k] == null && Math.max(o[J.maoE * 3 + 1], o[J.maoD * 3 + 1]) > topo) g.mao[k] = t;
          if (tc.estado === 'comemora') g.comemora[k] = t;
        } else if (g.sofreu[k] == null) {
          const dE = Math.hypot(o[J.maoE * 3] - o[ic], o[J.maoE * 3 + 1] - o[ic + 1], o[J.maoE * 3 + 2] - o[ic + 2]);
          const dD = Math.hypot(o[J.maoD * 3] - o[ic], o[J.maoD * 3 + 1] - o[ic + 1], o[J.maoD * 3 + 2] - o[ic + 2]);
          if ((dE < 0.25 && dD < 0.25) || o[J.pelve * 3 + 1] < 0.72) g.sofreu[k] = t;
        }
      }
      // T8
      if (rolando) { if (tc.estado === 'observa') R.observa[k]++; }
      if (tc.estado !== e.ultimoEstado || tc.variante !== e.ultimaVar || (tc.desde === T.k - 1)) {
        if (tc.desde === T.k - 1 && tc.estado !== 'observa') {
          R.seq[k].push(`${tc.estado}:${tc.variante}`);
          if (tc.estado === 'instrui' && rolando) R.instrui[k]++;
        }
        e.ultimoEstado = tc.estado; e.ultimaVar = tc.variante;
      }
      // T11: o raio da TV até a bola (e até o condutor) contra a cápsula
      if (emJogo) {
        for (const [nome, dist, alt] of TVS) {
          cameraTV(b.x, b.z, dist, alt, C3);
          if (cruza(C3, b.x, b.y, b.z, j.x, j.z)) { R.tv[nome]++; if (!R.tvEx) R.tvEx = `${nome}: ${tc.id} em (${fmt(j.x, 2)}, ${fmt(j.z, 2)}) bola (${fmt(b.x, 2)}, ${fmt(b.y, 2)}, ${fmt(b.z, 2)}) ${tc.recuo ?? ''}`; }
        }
        if (cond) {
          R.condutorPassos++;
          let hit = false;
          for (const [, dist, alt] of TVS) {
            cameraTV(b.x, b.z, dist, alt, C3);
            if (cruza(C3, cond.x, 0.95, cond.z, j.x, j.z) || cruza(C3, cond.pes[0].x, 0.1, cond.pes[0].z, j.x, j.z) || cruza(C3, cond.pes[1].x, 0.1, cond.pes[1].z, j.x, j.z)) hit = true;
          }
          if (hit) R.condutor++;
        }
      }
      // T13: distância a todos os jogadores
      for (const q of m.jogadores) {
        const d = Math.hypot(q.x - j.x, q.z - j.z);
        if (d < R.distMin) { R.distMin = d; R.distMinEx = `${tc.id} × ${q.id} (${fmt(d, 2)} m) no passo ${i} da semente ${sem}`; }
        if (d < 1) R.abaixo1++;
      }
    });
    // T12: a bola dentro da cápsula de algum treinador
    let dentro = false;
    for (const tc of T.tecs) {
      const dy = b.y < 0.25 ? 0.25 - b.y : b.y > 1.6 ? b.y - 1.6 : 0;
      if (Math.hypot(Math.hypot(b.x - tc.j.x, b.z - tc.j.z), dy) < 0.25 + BOLA.raio) dentro = true;
    }
    if (dentro) { R.dentroBola++; ep++; R.episodioMax = Math.max(R.episodioMax, ep); } else ep = 0;
  }
  for (const g of golPend) R.gols.push(g);
  // T8: repetidos (o mesmo gesto e variante duas vezes seguidas)
  R.seq.forEach((sq, k) => { for (let i = 1; i < sq.length; i++) if (sq[i] === sq[i - 1]) { R.repetidos++; if (!R.repEx) R.repEx = `${TECNICOS.ids[k]}: ${sq[i]}`; } });
  R.hash = S.hashMundo(m);
  // T10: as 3 primeiras sementes de novo, sem os treinadores (o hash no fim tem de ser o mesmo)
  if (sem <= 3) {
    const m2 = P.criarPartida({ semente: sem, minutosPorTempo: MIN_TEMPO });
    for (let i = 0; i < R.passos; i++) P.passoPartida(m2, P.entradaDemoPartida(m2), null);
    R.hashSem = S.hashMundo(m2);
  }
  R.ms.sort((a, b2) => a - b2);
  R.msMediana = R.ms[R.ms.length >> 1];
  delete R.ms;
  R.acel = Array.from(R.acel); R.maoVel = Array.from(R.maoVel); R.maoVelC = Array.from(R.maoVelC); R.angulos = Array.from(R.angulos);
  return R;
}

if (args.includes('--filho')) {
  process.send(await coletar(+arg('--s', 1)));
  process.exit(0);
}

// ------------------------------------------------------------------------------------------------ pai
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const t0 = Date.now();

let TE = null, EF = null;
try { TE = await imp('tecnicos.js'); EF = await imp('estadio-forma.js'); if (!EF.retasAreaTecnica) EF = null; } catch (_) { TE = null; }
if (!TE || !EF) {
  reg('treinadores (js/tecnicos.js) e a área técnica (estadio-forma.js retasAreaTecnica)', 'não existem', 'existem', false);
} else {
  const C = await imp('config.js');
  const { ESTADIO, CAMPO, TECNICOS, PASSO } = C;
  // ---------------------------------------------------------------- T1
  {
    const rs = EF.retasAreaTecnica();
    const B = ESTADIO.bancos, ok = [];
    let txt = '';
    for (const t of [0, 1]) {
      const f = rs.find(r => r.time === t && r.lado === 'frente'), d = rs.find(r => r.time === t && r.lado === 'dentro'), o = rs.find(r => r.time === t && r.lado === 'fora');
      const s = t === 1 ? 1 : -1;
      const frente = f.z0 - CAMPO.meioZ;
      const dentro = Math.min(Math.abs(d.x0), Math.abs(d.x1)), fora = Math.max(Math.abs(o.x0), Math.abs(o.x1));
      const larg = [f.z1 - f.z0, d.x1 - d.x0, o.x1 - o.x0];
      ok.push(Math.abs(frente - 1) <= 0.05 && Math.abs(B.x[0] - dentro - 1) <= 0.05 && Math.abs(fora - B.x[1] - 1) <= 0.05
        && Math.max(f.z1, d.z1, o.z1) <= 39.7 + 1e-9 && larg.every(l => Math.abs(l - 0.12) <= 0.05) && Math.sign(f.x0 + f.x1) === s);
      txt += `${t === 0 ? 'mandante' : 'visitante'}: frente ${fmt(frente, 2)} m da lateral, lados ${fmt(B.x[0] - dentro, 2)}/${fmt(fora - B.x[1], 2)} m além do banco, fundo ${fmt(Math.max(d.z1, o.z1), 2)}, linhas ${larg.map(l => fmt(l, 2)).join('/')}; `;
    }
    const espelho = rs.filter(r => r.time === 0).every(r => rs.some(q => q.time === 1 && q.lado === r.lado && Math.abs(q.x0 + r.x1) < 1e-9 && Math.abs(q.x1 + r.x0) < 1e-9 && q.z0 === r.z0 && q.z1 === r.z1));
    reg('T1 área técnica (IFAB Regra 1): frente, lados, fundo, linha e espelho', `${txt}espelhadas ${espelho}`, '1,00 m; 1,00 m; ≤ 39,7; 0,12 m (±5 cm); sim', ok.every(Boolean) && espelho);
  }

  // ---------------------------------------------------------------- T16 (o gancho das cenas: o treinador como ator)
  {
    let txt = 'treinadorDoTime não existe', bom = false;
    if (typeof TE.treinadorDoTime === 'function') {
      const T = TE.criarTecnicos(null, 7), L = TE.leituraVazia(TE.criarLeitura());
      for (let i = 0; i < 600; i++) TE.passoTecnicos(T, L);
      const a = [0, 1].map(t => TE.treinadorDoTime(T, t));
      bom = a.every((o, t) => o && o.id === TECNICOS.ids[t] && o.time === t && o.kit === `tecnico${t}` && EF.dentroAreaTecnica(t, o.x, o.z) && Number.isFinite(o.rumo)) && TE.treinadorDoTime(null, 0) === null;
      txt = a.map(o => (o ? `${o.id} (time ${o.time}, ${o.kit}) em x ${fmt(o.x, 1)}, z ${fmt(o.z, 1)}` : 'null')).join('; ') + `; sem treinadores: ${TE.treinadorDoTime(null, 0)}`;
    }
    reg('T16 o treinador como ator de cena (treinadorDoTime: o gancho da comemoração e do fim de jogo)', txt, 'id, time e kit do time, dentro da área técnica; null sem treinadores', bom);
  }

  // ---------------------------------------------------------------- partidas (processos filhos)
  // --so S: só a semente S (diagnóstico)
  const SEMENTES = args.includes('--so') ? [+arg('--so')] : Array.from({ length: NS }, (_, i) => i + 1);
  const res = [];
  const nPar = Math.max(1, Math.min(SEMENTES.length, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 2)));
  let prox = 0;
  await Promise.all(Array.from({ length: nPar }, async () => {
    while (prox < SEMENTES.length) {
      const s = SEMENTES[prox++];
      res.push(await new Promise((ok, erro) => {
        const c = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--s', String(s)]);
        c.on('message', ok); c.on('error', erro);
        c.on('exit', code => { if (code) erro(new Error(`semente ${s} saiu com ${code}`)); });
      }));
    }
  }));
  res.sort((a, b) => a.sem - b.sem);
  const soma = k => res.reduce((s, r) => s + r[k], 0);
  const maxDe = k => Math.max(...res.map(r => r[k]));
  const juntar = k => { const h = new Array(res[0][k].length).fill(0); for (const r of res) r[k].forEach((v, i) => { h[i] += v; }); return h; };
  const quantil = (h, q, esc) => { const n = h.reduce((a, b) => a + b, 0); let c = 0; for (let i = 0; i < h.length; i++) { c += h[i]; if (c >= q * n) return i / esc; } return (h.length - 1) / esc; };
  const passos = soma('passos');
  // T2
  const fora = soma('fora');
  reg('T2 centro e pés dentro da área (margem 0,15 m), z ≥ 35', `${fora} passos fora em ${passos * 2}${fora ? ' (1º: ' + res.find(r => r.foraEx).foraEx + ')' : ''}; z mín ${fmt(Math.min(...res.map(r => r.zMin)), 2)}`, '0; ≥ 35', fora === 0 && Math.min(...res.map(r => r.zMin)) >= 35);
  // T3
  const acel = juntar('acel'), p99a = quantil(acel, 0.99, 100);
  reg('T3 andando ≤ 1,4 m/s e ≤ 1,5 m/s² (p99); rápido ≤ 3,0 m/s; ≤ 0,15 m por passo', `andando ${fmt(maxDe('vAndaMax'), 2)} m/s, ${fmt(p99a, 2)} m/s² (p99); rápido ${fmt(maxDe('vRapMax'), 2)} m/s; ${fmt(maxDe('passoMax'), 3)} m por passo`, '≤ 1,4; ≤ 1,5; ≤ 3,0; ≤ 0,15',
    maxDe('vAndaMax') <= 1.4 && p99a <= 1.5 && maxDe('vRapMax') <= 3.0 && maxDe('passoMax') <= 0.15);
  // T4
  reg('T4 pé plantado ≤ 0,05 m/s; tornozelo ≤ (2,5·v + 3)·dt', `${fmt(maxDe('plantadoMax'), 4)} m/s; razão máx ${fmt(maxDe('saltoMax'), 3)}, ${soma('nSalto')} acima`, '≤ 0,05; ≤ 1; 0', maxDe('plantadoMax') <= 0.05 && maxDe('saltoMax') <= 1 && soma('nSalto') === 0);
  // T5
  const maoVel = juntar('maoVel'), p99m = quantil(maoVel, 0.99, 50), p99c = quantil(juntar('maoVelC'), 0.99, 50);
  const ossoMax = maxDe('ossoMax'), maoCab = Math.min(...res.map(r => r.maoCabMin));
  const { RAIO_CABECA } = await imp('anim.js');
  reg('T5 sem NaN; ossos ± 1 mm da referência; mão ≥ RAIO_CABECA + 0,02 da cabeça; mão ≤ 4 m/s fora da comemoração e ≤ 7 nela (p99), ≤ 0,15 m por passo',
    `${soma('nan')} NaN; osso ${fmt(ossoMax * 1000, 2)} mm (${res.find(r => r.ossoMax === ossoMax)?.ossoEx}); mão–cabeça ${fmt(maoCab, 3)} m (${res.find(r => r.maoCabMin === maoCab)?.maoCabEx}); mão ${fmt(p99m, 2)} m/s fora, ${fmt(p99c, 2)} m/s comemorando (p99); ${fmt(maxDe('maoPasso'), 3)} m por passo (${res.find(r => r.maoPasso === maxDe('maoPasso'))?.maoPassoEx})`,
    `0; ≤ 1 mm; ≥ ${fmt(RAIO_CABECA + 0.02, 3)}; ≤ 4; ≤ 7; ≤ 0,15`, soma('nan') === 0 && ossoMax <= 0.001 && maoCab >= RAIO_CABECA + 0.02 && p99m <= 4 && p99c <= 7 && maxDe('maoPasso') <= 0.15);
  // T6
  const ang = juntar('angulos'), med = quantil(ang, 0.5, 1), p90 = quantil(ang, 0.9, 1);
  reg('T6 olha a bola: rumo da cabeça × direção da bola (bola em jogo)', `mediana ${fmt(med, 0)}°, p90 ${fmt(p90, 0)}°`, '≤ 25°; ≤ 45°', med <= 25 && p90 <= 45);
  // T7
  {
    const gols = res.flatMap(r => r.gols);
    const ts = [], sof = [], com = [];
    for (const g of gols) {
      const k = g.time, o = 1 - k;
      ts.push(g.mao[k]); com.push(g.comemora[k]); sof.push(g.sofreu[o]);
    }
    const okMao = ts.every(t => t != null && t >= 0.25 && t <= 0.40), okCom = com.every(t => t >= 3), okSof = sof.every(t => t != null && t <= 0.6);
    const f = arr => arr.length ? `${fmt(Math.min(...arr.map(v => v ?? 99)), 2)}–${fmt(Math.max(...arr.map(v => v ?? 99)), 2)} s` : '-';
    reg('T7 gol do time: mão acima da cabeça em 0,25–0,40 s, comemorando ≥ 3 s; gol sofrido: mãos na cabeça/agachado em ≤ 0,6 s',
      `${gols.length} gols: mão ${f(ts)}; comemora ${f(com)}; sofreu ${f(sof)}`, '100% em 0,25–0,40; ≥ 3 s; ≤ 0,6 s', gols.length >= 10 && okMao && okCom && okSof);
  }
  // T8
  {
    const rol = soma('rolando');
    const obs = res.reduce((s, r) => s + r.observa[0] + r.observa[1], 0) / Math.max(1, 2 * rol);
    const instr = res.reduce((s, r) => s + r.instrui[0] + r.instrui[1], 0) / Math.max(1, 2 * rol * PASSO / 60);
    // variantes: cada uma ≥ 15% do seu gesto
    const cont = {};
    for (const r of res) for (const sq of r.seq) for (const s of sq) { const [g, v] = s.split(':'); (cont[g] ??= {})[v] = (cont[g][v] ?? 0) + 1; }
    const dist = [];
    let okVar = true;
    for (const [g, vs] of Object.entries(cont)) {
      if (g === 'vamos' || g === 'intervalo' || g === 'fim') continue;
      const n = TECNICOS.variantes[g]?.length ?? 1, tot = Object.values(vs).reduce((a, b) => a + b, 0);
      const fr = Array.from({ length: n }, (_, i) => (vs[i] ?? 0) / tot);
      if (g !== 'aplaude' || true) if (fr.some(x => x < 0.15)) okVar = false;
      dist.push(`${g} ${fr.map(x => Math.round(100 * x)).join('/')}% (${tot})`);
    }
    reg('T8 observando/andando 55–85% da bola rolando; 1–2,5 instruções/min; sem (gesto, variante) repetido; cada variante ≥ 15%',
      `${fmt(100 * obs, 1)}%; ${fmt(instr, 2)}/min; ${soma('repetidos')} repetidos${soma('repetidos') ? ' (' + res.find(r => r.repEx).repEx + ')' : ''}; ${dist.join('; ')}`,
      '55–85%; 1–2,5; 0; ≥ 15%', obs >= 0.55 && obs <= 0.85 && instr >= 1 && instr <= 2.5 && soma('repetidos') === 0 && okVar);
  }
  // T10
  {
    const r3 = res.filter(r => r.hashSem != null);
    reg('T10 hash no fim de 3 partidas: com × sem os treinadores', r3.map(r => `${r.sem}: ${r.hash === r.hashSem ? 'igual' : 'DIFERENTE'}`).join(', '), '3 iguais', r3.length === 3 && r3.every(r => r.hash === r.hashSem));
  }
  // T11
  {
    const ej = soma('emJogo') * 2, pc = res.reduce((s, r) => s + r.tv.PC, 0), ce = res.reduce((s, r) => s + r.tv.celular, 0);
    const cp = soma('condutorPassos'), cc = soma('condutor');
    reg('T11 a TV vê a bola: raio até a bola livre dos treinadores (PC e celular); raio até o condutor livre ≥ 99,5%',
      `bola: PC ${pc}, celular ${ce} passos cruzando em ${ej}${pc + ce ? ' (1º: ' + res.find(r => r.tvEx).tvEx + ')' : ''}; condutor ${fmt(100 * (1 - cc / Math.max(1, cp)), 2)}% livre`,
      '0, 0; ≥ 99,5%', pc === 0 && ce === 0 && 1 - cc / Math.max(1, cp) >= 0.995);
  }
  // T12
  reg('T12 a bola não atravessa o treinador (centro na cápsula r 0,25 + raio)', `${fmt(soma('dentroBola') / res.length, 2)} passos por partida; maior episódio ${maxDe('episodioMax')} passos`, '≤ 1; ≤ 4', soma('dentroBola') / res.length <= 1 && maxDe('episodioMax') <= 4);
  // T13
  {
    const dm = Math.min(...res.map(r => r.distMin)), ab = soma('abaixo1'), tot = passos * 2;
    reg('T13 treinador × jogador: ≥ 0,5 m sempre; ≥ 1 m em ≥ 99,9% dos passos', `mín ${fmt(dm, 2)} m (${res.find(r => r.distMin === dm)?.distMinEx}); a < 1 m em ${fmt(100 * ab / tot, 3)}% (${ab} passos × jogador)`, '≥ 0,5; ≤ 0,1%', dm >= 0.5 && ab / tot <= 0.001);
  }
  // T14: a mediana das medianas de 3 partidas (a máquina carregada: a média tem as preempções)
  {
    const ms = res.slice(0, 3).map(r => r.msMediana).sort((a, b) => a - b);
    reg('T14 custo (passoTecnicos + 2 poses, Node)', `${fmt(ms[1] * 1000, 1)} µs por passo (medianas ${ms.map(v => fmt(v * 1000, 1)).join(', ')})`, '≤ 50 µs', ms[1] <= 0.05);
  }
  // ---------------------------------------------------------------- T9 (determinismo)
  {
    const P = await imp('partida.js');
    const m = P.criarPartida({ semente: 9, minutosPorTempo: MIN_TEMPO });
    const Ls = [];
    for (let i = 0; i < 2400; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m), null) ?? m.eventos;
      Ls.push(structuredClone(TE.leituraDoMundo(m, ev, TE.criarLeitura())));
    }
    const rodar = () => {
      const T = TE.criarTecnicos(m.times, 9), o = new Float32Array(57), poses = [];
      for (const L of Ls) { TE.passoTecnicos(T, L); for (const tc of T.tecs) poses.push(...TE.poseTecnico(tc, o)); }
      return Float32Array.from(poses);
    };
    const rnd = Math.random;
    let a = null, b = null, erro = null;
    Math.random = () => { throw new Error('Math.random chamado'); };
    try { a = rodar(); b = rodar(); } catch (e) { erro = e.message; } finally { Math.random = rnd; }
    let dif = 0;
    if (a && b) for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(Number.isNaN(a[i]) && Number.isNaN(b[i]))) dif++;
    reg('T9 mesma sequência de leituras → pose bit a bit igual; sem Math.random', erro ? `erro: ${erro}` : `${a.length / 57} poses; ${dif} floats diferentes`, '0; sem erro', !erro && dif === 0);
  }
  // ---------------------------------------------------------------- T15 (câmeras roteirizadas)
  {
    const viol = [];
    const PR = await imp('prejogo-roteiro.js'), CJ = await imp('cortejo.js');
    const P = await imp('partida.js');
    const mP = P.criarPartida({ semente: 2 });
    // pré-jogo: os treinadores em pé na base (aplaudem quando os times saem do túnel); a câmera de cada modo, quadro a quadro
    for (const modo of ['completo', 'curto', 'escalacao']) {
      const r = PR.criarRoteiro(modo), T = TE.criarTecnicos(mP.times, 2), L = TE.leituraVazia(TE.criarLeitura()), c = {};
      let n = 0, pior = Infinity;
      for (let t = 0; t < r.total; t += PASSO) {
        L.nEventos = 0;
        if (n === Math.round(CJ.CORTEJO.atrasoTimes / PASSO)) TE.pedirAplauso(L, 3);
        TE.passoTecnicos(T, L); n++;
        PR.cameraEm(r, t, c);
        const p = [c.px, c.py, c.pz];
        TE.afastarDeTecnicos(p, T, 0.6);
        for (const tc of T.tecs) pior = Math.min(pior, TE.distanciaTecnico(p[0], p[1], p[2], tc.j.x, tc.j.z));
      }
      if (pior < 0.6) viol.push(`pré-jogo ${modo}: ${fmt(pior, 2)} m`);
      viol.push(`(pré-jogo ${modo}: mín ${fmt(pior, 1)} m)`);
    }
    // comemoração: gols roteirizados (as câmeras da cena: steadicam, contraplano, reação), com os treinadores reagindo
    try {
      const CM = await imp('comemoracao.js');
      const { carregarNode, golRoteirizadoNode } = await import(pathToFileURL(path.join(AQUI, 'lib/gol-node.mjs')).href);
      const Lc = await carregarNode(JS);
      let pior = Infinity, cenas = 0;
      for (const [sem, z0, dist] of [[5, 3, 9.5], [7, 26, 12], [11, -20, 14], [13, 30, 8]]) {
        const g = golRoteirizadoNode(Lc, { semente: sem, time: 0, z0, dist });
        if (!g) continue;
        cenas++;
        const T = TE.criarTecnicos(g.m.times, sem), L = TE.criarLeitura();
        TE.leituraDoMundo(g.m, g.m.eventos, L);
        const plano = CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 });
        const c = CM.criarCena(plano, g.m), pc = CM.criarPlanoCamera();
        let primeiro = true;
        while (!c.acabou) {
          CM.passoCena(c);
          if (!primeiro) TE.leituraDoMundo(g.m, [], L);
          primeiro = false;
          TE.passoTecnicos(T, L);
          for (const pequena of [false, true]) {
            CM.planoCamera(c, { pequena, aspecto: pequena ? 844 / 390 : 16 / 9 }, pc);
            if (pc.nome === 'rede' || pc.nome === 'fim') continue;
            const p = [pc.de[0], pc.de[1], pc.de[2]];
            TE.afastarDeTecnicos(p, T, 0.6);
            for (const tc of T.tecs) pior = Math.min(pior, TE.distanciaTecnico(p[0], p[1], p[2], tc.j.x, tc.j.z));
          }
        }
      }
      if (!cenas || pior < 0.6) viol.push(`comemoração: ${cenas} cenas, ${fmt(pior, 2)} m`);
      else viol.push(`(comemoração: ${cenas} cenas, mín ${fmt(pior, 1)} m)`);
    } catch (e) { viol.push(`comemoração: ${e.message}`); }
    // lateral do golaço (replay): a câmera baixa da beira do campo (render/replay-olhos.js cameraLateral)
    try {
      const RO = await imp('render/replay-olhos.js');
      if (!RO.cameraLateral) throw new Error('replay-olhos.js sem cameraLateral');
      let pior = Infinity;
      const T = TE.criarTecnicos(mP.times, 4), L = TE.criarLeitura();
      // a câmera passando pela frente das áreas técnicas (x de −40 a 40) com os treinadores em todo lugar da área deles
      for (let x = -40; x <= 40; x += 0.25) {
        for (const tc of T.tecs) { tc.j.x = Math.max(tc.area.x0 + 0.42, Math.min(tc.area.x1 - 0.42, x + ((x * 13) % 3))); tc.j.z = 35.42 + (((x * 7) % 3.86) + 3.86) % 3.86; }
        const out = {};
        RO.cameraLateral(x, T.tecs.map(tc => ({ x: tc.j.x, z: tc.j.z })), out);
        for (const tc of T.tecs) pior = Math.min(pior, TE.distanciaTecnico(out.x, out.y, out.z, tc.j.x, tc.j.z));
      }
      if (pior < 0.6) viol.push(`lateral do golaço: ${fmt(pior, 2)} m`); else viol.push(`(lateral do golaço: mín ${fmt(pior, 1)} m)`);
    } catch (e) { viol.push(`lateral do golaço: ${e.message}`); }
    // contraprova 15/10: o plano lateral INTEIRO passando por um treinador (o diretor de render/replay.js quadro a quadro: a
    // bola seguida pela mola de REPLAY.atras, o x da câmera atrás dela; o z do plano por zLateralDoPlano) — sem salto entre
    // dois quadros (antes o z era decidido a cada quadro e a câmera pulava 2,5 m quando passava a 2 m dele) e a ≥ 0,6 m dele
    try {
      const RO = await imp('render/replay-olhos.js'), RA = await imp('render/replay-anel.js');
      const { REPLAY, PASSO } = C;
      const a = RA.criarAnel({ ticks: 600, vagas: REPLAY.vagas, nj: 19 });
      const pz = new Float32Array(57);
      for (let t = 1000; t <= 1100; t++) {
        a.inicio(t, t * PASSO, false);
        a.jogador(0, 211, 1, false, 13.5, 36.2, -Math.PI / 2, pz, true);
        a.fim({ x: 19.5 + (t - 1000) * 0.33, y: 0.3, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
      }
      const p = { de: 1000, ate: 1100, vel: REPLAY.gol.vel[2], cam: 'lateral' }, Lt = REPLAY.lateral, b = {};
      const k = 1 - Math.exp(-(1 / 60) * p.vel * REPLAY.atras.mola);
      const zPlano = RO.zLateralDoPlano ? RO.zLateralDoPlano(a, p.de, p.ate, 1) : null;
      let lx = null, cx = 0, ant = null, salto = 0, perto = Infinity;
      for (let t = p.de; t <= p.ate; t += p.vel) {
        const bp = RA.bolaNoTick(a, Math.floor(t), b);
        if (lx == null) { lx = bp.x; cx = lx - Lt.recuo; } else lx += (bp.x - lx) * k;
        cx += (lx - Lt.recuo - cx) * k;
        const c = RO.cameraLateral(cx, RO.tecnicosNoTick(a, Math.round(t)), {}, zPlano);
        if (ant) salto = Math.max(salto, Math.hypot(c.x - ant.x, c.y - ant.y, c.z - ant.z));
        ant = c;
        perto = Math.min(perto, TE.distanciaTecnico(c.x, c.y, c.z, 13.5, 36.2));
      }
      if (salto > 0.3 || perto < 0.6) viol.push(`lateral passando pelo treinador: salto ${fmt(salto, 2)} m por quadro, ${fmt(perto, 2)} m dele`);
      else viol.push(`(lateral passando pelo treinador: salto ${fmt(salto, 2)} m, ${fmt(perto, 1)} m)`);
    } catch (e) { viol.push(`lateral passando pelo treinador: ${e.message}`); }
    const ruins = viol.filter(v => !v.startsWith('('));
    reg('T15 câmeras roteirizadas (pré-jogo, comemoração, lateral do golaço) a ≥ 0,6 m dos treinadores; a lateral sem salto no plano', viol.join('; '), '≥ 0,6 m em todos os quadros; ≤ 0,3 m por quadro', ruins.length === 0);
  }
  console.log(`${res.length} partidas (sementes 1–${NS}) de 2 × ${MIN_TEMPO} min, ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-tecnicos: REPROVOU (${falhas})` : '\nteste-tecnicos: PASSOU');
process.exit(falhas ? 1 : 0);
