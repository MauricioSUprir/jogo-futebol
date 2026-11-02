// A câmera de TV do jogo (item 66 da FILA; pedido do dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a área
// completamente ... afastar muito pouco mais e centralizar mais"; contrato "Câmera de TV (item 66)" no CONTRATOS.md). Em
// Node, sem three: só os módulos puros (render/enquadramento.js — a MESMA conta que a render/camera.js aplica no three).
//   S) sintético, a 60 e a 30 qps: S1 o atraso da mola em regime (rampas de 7, 15 e 20 m/s: ≤ 0,25 s × v); S2 a parada
//      brusca (passa ≤ 0,5 m e assenta a ≤ 0,5 m em ≤ 0,35 s); S3 a aceleração ≤ 150 m/s²; S4 o alvo que salta 20 m (troca
//      de controlado: sem tranco, sem passar do ponto, a ≤ 1 m em ≤ 1,2 s); S5 a bola teletransportada = corte; S6 a bola
//      fora do campo (atrás do gol, dentro da rede, além da lateral): o foco nos limites e nenhum passo > 1,2 m; S7 a
//      histerese do espaço à frente (a posse que troca a cada 0,3 s não vira o lado; a de 0,6 s vira, a ≤ 6 m/s); S8 a bola
//      ALTA (5 voos de 6 a 20 m de pico): o chão debaixo dela nunca sai do quadro e a bola fora ≤ a do legado (R1 da revisão).
//   G) geometria: G1 a grade de bolas nas duas áreas (x 36–52,5, z ±20, de 1 em 1 m) com o foco em regime: os 4 cantos e
//      o alto das 2 traves dentro de 0,94 e a bola dentro do limite; G2 o escanteio na TV nos 4 cantos; G3 o tiro livre na
//      TV de 18 a 35 m da linha (z ±25): a área, o gol e a bola no quadro; G4 a projeção fechada contra uma 4×4.
//   P) partidas inteiras (demo IA × IA como a página com ?demo=1, sementes 1–6; o humano roteirizado 'passivo', 1–4), nas
//      duas telas: o alvo pelo preencherAlvo (o do main.js) e a TV nova e a de HOJE (o legado, a cópia exata da 79bbfbc2)
//      lado a lado. Reprova se a nova não cumpre M1–M6c, M9–M11 e R1 (as metas no cabeçalho de cada linha); o legado sai
//      impresso ao lado (ele reprova M1, M6 e M9). M2 conta a bola até a altura que cabe no quadro com o chão debaixo dela
//      (enquadramento.js alturaQueCabe: 10,0 m no celular, 14,4 no PC); acima dela a bola sai por cima e o M2b cobra o chão.
//   node tools/teste-camera.mjs [--js <pasta js>] [--so S|G|P] [--sementes 1-6] [--passivo 1-4] [--par 2]
//   --rastro <json>: só a conferência com a página (teste-camera-tela J1). Diagnóstico (stderr): CAM_DBG=<m> os passos do foco
//   maiores que isso, CAM_FORA=1 os instantes com a bola fora do quadro, CAM_G5=1 cada lente do G5.
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PASTA_JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const SO = arg('--so', null);
const PAR = Math.max(1, +arg('--par', 2));
const FILHO = arg('--filho', null);
// --rastro <json {cel: [{sem, tick, cam: {x, y, z}}], pc: [...]}>: a câmera da PÁGINA nesses ticks (teste-camera-tela J1);
// devolve em JSON a distância até a lente da TV nova daqui nos mesmos ticks (a demo como a página: comoPagina)
const RASTRO = arg('--rastro', null);
const imp = f => import(pathToFileURL(path.join(PASTA_JS, f)).href);
const EQ = await imp('render/enquadramento.js');
const C = await imp('config.js');
const Q = EQ.ENQUADRAMENTO;
const { meioX: MX, meioZ: MZ } = C.CAMPO;
const AP = C.CAMPO.area.profundidade, AL = C.CAMPO.area.largura / 2, GL = C.CAMPO.gol.largura / 2, GA = C.CAMPO.gol.altura;

function faixa(s) {
  const out = [];
  for (const p of String(s).split(',')) { const m = p.match(/^(\d+)-(\d+)$/); if (m) for (let i = +m[1]; i <= +m[2]; i++) out.push(i); else if (p) out.push(+p); }
  return out;
}
const TELAS = [
  { nome: 'celular 844×390', chave: 'cel', w: 844, h: 390 },
  { nome: 'PC 1280×720', chave: 'pc', w: 1280, h: 720 },
];
// a TV de ANTES (79bbfbc2, o legado lado a lado): o foco de hoje com a pose de antes (CAMERA largura 45, distância 40,
// altura 18,3; celular 46 e 12,3 — a TV nova é × 1,06)
const ANTES = { largura: 45, distancia: 40, altura: 18.3, celular: { distancia: 46, altura: 12.3 } };
for (const T of TELAS) {
  T.asp = T.w / T.h; T.pequena = Math.min(T.w, T.h) < 520;
  T.p = EQ.perfilCamera({}, 0, T.asp, T.pequena); T.g = EQ.geometriaTV({}, T.p, T.asp, T.pequena); T.W = EQ.larguraVista(T.p, T.pequena);
  T.pA = { ...T.p, largura: ANTES.largura, distancia: T.pequena ? ANTES.celular.distancia : ANTES.distancia, altura: T.pequena ? ANTES.celular.altura : ANTES.altura };
  T.gA = EQ.geometriaTV({}, T.pA, T.asp, T.pequena);
  // a altura mais alta da bola que cabe no quadro com o chão debaixo dela (enquadramento.js alturaQueCabe, a caixa dura; a
  // base sem ela: sem limite)
  T.yCabe = EQ.alturaQueCabe ? EQ.alturaQueCabe(T.g, EQ.ENQUADRAMENTO.bolaDuro) : Infinity;
}
const AMOSTRA = 15; // quadros (0,25 s a 60 qps)
const _n = { x: 0, y: 0, c: 0, ok: false }, _n2 = { x: 0, y: 0, c: 0, ok: false };
const dentro = (n, k = 1) => n.ok && Math.abs(n.x) <= k && Math.abs(n.y) <= k;

/** A área do gol gx (±MX) no quadro com o foco (fx, fz): a fração da grade 11 × 15, os 4 cantos, as 2 traves (base e topo). */
function areaNoQuadro(g, fx, fz, gx) {
  const s = Math.sign(gx);
  let n = 0, tot = 0;
  for (let i = 0; i <= 10; i++) for (let k = 0; k <= 14; k++) { tot++; if (dentro(EQ.projetarTV(g, fx, fz, gx - s * AP * i / 10, 0, -AL + 2 * AL * k / 14, _n))) n++; }
  let cantos = 0, traves = 0, pior = 0;
  for (const [u, z] of [[0, -AL], [0, AL], [AP, -AL], [AP, AL]]) {
    EQ.projetarTV(g, fx, fz, gx - s * u, 0, z, _n);
    if (dentro(_n)) cantos++;
    pior = Math.max(pior, _n.ok ? Math.max(Math.abs(_n.x), Math.abs(_n.y)) : 9);
  }
  for (const [y, z] of [[0, -GL], [0, GL], [GA, -GL], [GA, GL]]) {
    EQ.projetarTV(g, fx, fz, gx, y, z, _n);
    if (dentro(_n)) traves++;
    if (y > 0) pior = Math.max(pior, _n.ok ? Math.max(Math.abs(_n.x), Math.abs(_n.y)) : 9);
  }
  return { frac: n / tot, cantos, traves, inteira: cantos === 4 && traves === 4, pior };
}
/** A bola dentro da caixa B (NDC) com o foco (fx, fz)? */
function bolaNoLimite(g, fx, fz, b, B, folga = 1e-6) {
  EQ.projetarTV(g, fx, fz, b.x, Math.max(0.11, b.y ?? 0.11), b.z, _n);
  return _n.ok && Math.abs(_n.x) <= B.x + folga && _n.y >= B.baixo - folga && _n.y <= B.cima + folga;
}
function alvoVazio() {
  return { jx: 0, jz: 0, jvx: 0, jvz: 0, bx: 0, by: 0.11, bz: 0, bvx: 0, bvz: 0, ax: NaN, az: NaN, tRest: 0, cx: NaN, cz: NaN, cvx: 0, cvz: 0, dir: 0, parada: null, temParada: false };
}

// ================================================================================================= P: partidas (filho)
async function coletar(modo, sem, rastro = null) {
  const SIM = await imp('sim.js');
  const PA = await imp('partida.js');
  let m, passo;
  if (modo === 'passivo') {
    const { entradaRoteiro } = await import(pathToFileURL(path.join(AQUI, 'lib/humano-roteiro.mjs')).href);
    const MED = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
    m = PA.criarPartida({ semente: sem });
    const st = { s: (sem * 2654435761) >>> 0 || 1, carga: null, id: -1, desde: 0, espera: 0 };
    passo = () => PA.passoPartida(m, entradaRoteiro(m, MED, C.BOTAO, st, 'passivo')) ?? m.eventos;
  } else {
    const { criarGravador } = await import(pathToFileURL(path.join(AQUI, 'lib/anel-node.mjs')).href);
    const GR = await criarGravador(PASTA_JS);
    const S = GR.novaPartida(sem, { comoPagina: true, tecnicos: false });
    m = S.m;
    passo = () => GR.passo(S, false);
  }
  const dt = C.PASSO;
  // por tela: a TV nova (E + foco) e a de hoje (o legado); o estado da câmera do gol e do plano geral (camera.js)
  const cams = [];
  for (const T of TELAS) for (const tipo of ['nova', 'legado']) {
    cams.push({ T, tipo, est: { x: 0, z: 0, vx: 0, vz: 0 }, E: EQ.criarEnquadramento(), iniciado: false,
      f: [], ext: null, sent: 0, inv: 0, t: 0, acc: [], passoMax: 0, amostras: [], cortou: false });
  }
  const gol = { ativo: false, t: 0 };
  let geral = false, corte = true, quadro = 0;
  const marcas = {}, rastroOut = [], ant = new Map(), des = new Map(), bDes = { x: 0, y: 0, z: 0 };
  const bAnt3 = { x: m.bola.p.x, y: m.bola.p.y, z: m.bola.p.z };
  if (rastro) for (const T of TELAS) marcas[T.chave] = new Map((rastro[T.chave] ?? []).filter(a => a.sem === sem).map(a => [a.tick, a.cam]));
  const fimRastro = rastro ? Math.max(0, ...Object.values(marcas).flatMap(mm => [...mm.keys()])) : Infinity;
  const alvo = alvoVazio(), _leg = { x: 0, z: 0 };
  let bAnt = { x: m.bola.p.x, z: m.bola.p.z };
  for (let it = 0; it < 1e9; it++) {
    const ev = passo() ?? [];
    let acabou = false;
    for (const e of ev) {
      const t = e.tipo;
      if (t === 'gol') { gol.ativo = true; gol.t = 0; }
      else if (t === 'recomeco' || t === 'saida' || t === 'cobrancaPenalti' || t === 'corteBolaParada') { corte = true; gol.ativo = false; geral = false; }
      else if (t === 'intervalo' || t === 'fimDeJogo') { if (gol.ativo) { gol.ativo = false; corte = true; } geral = true; if (t === 'fimDeJogo') acabou = true; }
    }
    if (gol.ativo) { gol.t += dt; if (gol.t >= 4) { gol.ativo = false; corte = true; } }
    // o alvo (main.js desenharQuadro): o controlado do time 0 (sem ele, a bola) + o preencherAlvo. Na conferência com a página
    // (--rastro), as posições DESENHADAS como lá: com o relógio manual a 60 qps o desenho fica a meio passo (alfa 0,5)
    const h = SIM.jogadorPorId(m, m.controlado?.[0]), b = m.bola.p;
    if (rastro) {
      for (const j of m.jogadores) { const a = ant.get(j.id); des.set(j.id, a ? { x: (a.x + j.x) / 2, z: (a.z + j.z) / 2 } : { x: j.x, z: j.z }); }
      bDes.x = (bAnt3.x + b.x) / 2; bDes.y = (bAnt3.y + b.y) / 2; bDes.z = (bAnt3.z + b.z) / 2;
      const hd = h ? des.get(h.id) : null;
      alvo.jx = hd ? hd.x : bDes.x; alvo.jz = hd ? hd.z : bDes.z; alvo.jvx = h ? h.vx : 0; alvo.jvz = h ? h.vz : 0;
      EQ.preencherAlvo(alvo, m, id => des.get(id) ?? null, bDes);
      for (const j of m.jogadores) ant.set(j.id, { x: j.x, z: j.z });
      bAnt3.x = b.x; bAnt3.y = b.y; bAnt3.z = b.z;
    } else {
      alvo.jx = h ? h.x : b.x; alvo.jz = h ? h.z : b.z; alvo.jvx = h ? h.vx : 0; alvo.jvz = h ? h.vz : 0;
      EQ.preencherAlvo(alvo, m, null, b);
    }
    const deJogo = !gol.ativo && !geral;
    for (const k of cams) {
      const { T } = k;
      if (k.tipo === 'nova') {
        k.cortou = EQ.focoTV(k.E, k.est, alvo, T.p, T.g, T.W, dt, corte || !k.iniciado);
      } else {
        EQ.alvoLegado(alvo, T.pA, _leg);
        const fx = Math.max(-T.pA.limX, Math.min(T.pA.limX, _leg.x)), fz = Math.max(T.pA.limZ0, Math.min(T.pA.limZ1, _leg.z));
        k.cortou = corte || !k.iniciado;
        if (k.cortou) { k.est.x = fx; k.est.z = fz; k.est.vx = 0; k.est.vz = 0; } else EQ.molaLegada(k.est, fx, fz, dt);
      }
      k.iniciado = true;
      // vai e volta, aceleração do olhar e o passo do foco, fora dos cortes
      if (!deJogo || k.cortou) { k.f.length = 0; k.ext = null; k.sent = 0; continue; }
      const fx = k.est.x, fz = k.est.z;
      k.t += dt;
      if (k.f.length) {
        const a = k.f[k.f.length - 1], ps = Math.hypot(fx - a[0], fz - a[1]);
        k.passoMax = Math.max(k.passoMax, ps);
        if (process.env.CAM_DBG && ps > +process.env.CAM_DBG && k.tipo === 'nova') console.error(`${modo}:${sem} ${k.T.chave} tick ${m.tick} passo ${ps.toFixed(2)} foco ${a[0].toFixed(1)},${a[1].toFixed(1)} → ${fx.toFixed(1)},${fz.toFixed(1)} bola ${b.x.toFixed(1)},${b.y.toFixed(1)},${b.z.toFixed(1)} v ${Math.hypot(m.bola.v.x, m.bola.v.z).toFixed(1)} wA ${k.E.wA.toFixed(2)} duro ${k.E.duro} parada ${m.parada?.tipo ?? '-'}/${m.parada?.rolou ?? '-'} posse ${m.posse} voo ${!!m.voo} est ${m.partida?.estado}`);
      }
      k.f.push([fx, fz]); if (k.f.length > 3) k.f.shift();
      if (k.f.length === 3) {
        const [a0, a1, a2] = k.f;
        const ax = (a2[0] - 2 * a1[0] + a0[0]) / dt / dt, az = (a2[1] - 2 * a1[1] + a0[1]) / dt / dt;
        const gg = k.tipo === 'nova' ? T.g : T.gA;
        k.acc.push(Math.hypot(ax, az) / Math.hypot(gg.D, gg.H) * 180 / Math.PI);
      }
      if (k.ext == null) { k.ext = fx; k.sent = 0; }
      else if (k.sent > 0 && fx > k.ext) k.ext = fx;
      else if (k.sent < 0 && fx < k.ext) k.ext = fx;
      if (k.sent >= 0 && fx < k.ext - 1) { if (k.sent > 0) k.inv++; k.sent = -1; k.ext = fx; }
      else if (k.sent <= 0 && fx > k.ext + 1) { if (k.sent < 0) k.inv++; k.sent = 1; k.ext = fx; }
    }
    if (rastro) {
      for (const k of cams) {
        if (k.tipo !== 'nova') continue;
        const c = marcas[k.T.chave].get(m.tick);
        if (c) rastroOut.push({ tela: k.T.chave, tick: m.tick, d: Math.hypot(k.est.x - c.x, k.T.p.altura - c.y, k.est.z + k.T.p.distancia - c.z) });
      }
      if (m.tick >= fimRastro) break;
    }
    corte = false;
    quadro++;
    const vbx = (b.x - bAnt.x) / dt, vbz = (b.z - bAnt.z) / dt, vb = Math.hypot(vbx, vbz);
    bAnt = { x: b.x, z: b.z };
    // as amostras (a cada 0,25 s, com a câmera de jogo)
    if (quadro % AMOSTRA === 0 && deJogo) {
      const pr = m.parada, rol = m.partida?.estado === 'jogo' && (!pr || pr.rolou) ? 1 : 0;
      const gx = (b.x >= 0 ? 1 : -1) * MX, dGol = Math.hypot(b.x - gx, b.z);
      const naArea = Math.abs(b.x) >= MX - AP && Math.abs(b.z) <= AL ? 1 : 0;
      const dir = alvo.dir, dA = dir ? MX - b.x * dir : NaN;
      const noPe = m.posse != null && !m.voo ? 1 : 0;
      const zona = naArea ? 3 : dA <= 35 ? 2 : dA <= 70 ? 1 : 0;
      for (const k of cams) {
        const { T } = k, g = k.tipo === 'nova' ? T.g : T.gA, fx = k.est.x, fz = k.est.z;
        EQ.projetarTV(g, fx, fz, b.x, b.y, b.z, _n);
        if (process.env.CAM_FORA && rol && k.tipo === 'nova' && !dentro(_n)) console.error(`FORA ${modo}:${sem} ${T.chave} tick ${m.tick} ndc ${_n.x.toFixed(2)},${_n.y.toFixed(2)} foco ${fx.toFixed(1)},${fz.toFixed(1)} v ${k.est.vx.toFixed(1)},${k.est.vz.toFixed(1)} bola ${b.x.toFixed(1)},${b.y.toFixed(1)},${b.z.toFixed(1)} vb ${m.bola.v.x.toFixed(1)},${m.bola.v.y.toFixed(1)},${m.bola.v.z.toFixed(1)} duro ${k.E.duro} wA ${k.E.wA.toFixed(2)} voo ${!!m.voo}`);
        const s = [rol, _n.ok ? _n.x : NaN, _n.ok ? _n.y : NaN, noPe, zona, naArea, dGol];
        s.push(dir && _n.ok ? (1 + dir * _n.x) / 2 : NaN);
        s.push(vb >= 3 ? ((b.x - fx) * vbx + (b.z - fz) * vbz) / vb : NaN, vb);
        if (naArea || dGol <= 25) { const a = areaNoQuadro(g, fx, fz, gx); s.push(a.frac, a.inteira ? 1 : 0, a.traves === 4 ? 1 : 0); } else s.push(NaN, NaN, NaN);
        // o controlado em px CSS (0 → 1,8 m no lugar dele) e a mediana dos jogadores no quadro
        let hc = NaN;
        if (h) { EQ.projetarTV(g, fx, fz, h.x, 0, h.z, _n); EQ.projetarTV(g, fx, fz, h.x, 1.8, h.z, _n2); if (_n.ok) hc = Math.abs(_n2.y - _n.y) / 2 * T.h; }
        const hs = [];
        for (const j of m.jogadores) { EQ.projetarTV(g, fx, fz, j.x, 0, j.z, _n); if (!dentro(_n, 1.02)) continue; EQ.projetarTV(g, fx, fz, j.x, 1.8, j.z, _n2); hs.push(Math.abs(_n2.y - _n.y) / 2 * T.h); }
        hs.sort((x, y) => x - y);
        s.push(hc, hs.length ? hs[hs.length >> 1] : NaN);
        // o chão debaixo da bola no quadro e a bola acima da altura que cabe (a TV não inclina: R1 da revisão)
        s.push(dentro(EQ.projetarTV(g, fx, fz, b.x, 0, b.z, _n)) ? 1 : 0, b.y > T.yCabe ? 1 : 0);
        k.amostras.push(s);
      }
    }
    if (acabou) break;
  }
  if (rastro) return { modo, sem, rastro: rastroOut };
  const out = { modo, sem, passos: m.tick, cams: {} };
  for (const k of cams) {
    k.acc.sort((a, c) => a - c);
    out.cams[`${k.T.chave}-${k.tipo}`] = { inv: k.inv, t: k.t, accP999: k.acc[Math.floor(0.999 * (k.acc.length - 1))] ?? NaN, accMax: k.acc[k.acc.length - 1] ?? NaN, passoMax: k.passoMax, amostras: k.amostras };
  }
  return out;
}

if (FILHO != null) {
  const [modo, sem] = FILHO.split(':');
  const fs = await import('node:fs');
  const txt = JSON.stringify(await coletar(modo, +sem, RASTRO ? JSON.parse(fs.readFileSync(RASTRO, 'utf8')) : null));
  // (sair só depois de o pipe esvaziar: process.exit logo depois do write cortava a saída grande)
  await new Promise(ok => process.stdout.write(txt, ok));
  process.exit(0);
}

// ================================================================================================= o pai
if (RASTRO) {
  const fs = await import('node:fs');
  const R = JSON.parse(fs.readFileSync(RASTRO, 'utf8'));
  const sems = [...new Set([...(R.cel ?? []), ...(R.pc ?? [])].map(a => a.sem))];
  const res = await Promise.all(sems.map(sem => new Promise((ok, falha) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--filho', `demo:${sem}`, '--rastro', RASTRO, '--js', PASTA_JS], { stdio: ['ignore', 'pipe', 'inherit'] });
    let txt = '';
    p.stdout.on('data', d => { txt += d; });
    p.on('close', c => { if (c) falha(new Error(`rastro ${sem}: saída ${c}`)); else { try { ok(JSON.parse(txt)); } catch (e) { falha(e); } } });
  })));
  const out = { cel: [], pc: [] };
  for (const r of res) for (const x of r.rastro) out[x.tela].push(x);
  await new Promise(ok => process.stdout.write(JSON.stringify(out), ok));
  process.exit(0);
}
const linhas = [['medida', 'medido', 'meta', '']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok === null ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (ok === false) falhas++; }
const f1 = v => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : '–');
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '–');
const q = (v, p) => { const s = v.filter(Number.isFinite).sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * (s.length - 1) + 0.5))] : NaN; };
const pct = (n, d) => (d ? (100 * n / d) : NaN);

// ------------------------------------------------------------------------------------------------ S: sintético
/** Roda a TV nova num alvo sintético; roteiro(t, alvo) monta o alvo; devolve o foco por quadro. */
function sintetico(qps, dur, roteiro, T = TELAS[0], x0 = 0, z0 = 0) {
  const dt = 1 / qps, E = EQ.criarEnquadramento(), est = { x: x0, z: z0, vx: 0, vz: 0 }, a = alvoVazio();
  const serie = [];
  for (let i = 0; i <= Math.round(dur * qps); i++) {
    const t = i * dt;
    roteiro(t, a);
    const cortou = EQ.focoTV(E, est, a, T.p, T.g, T.W, dt, i === 0);
    serie.push({ t, x: est.x, z: est.z, vx: est.vx, vz: est.vz, cortou, lado: E.dir, frente: E.frente });
  }
  return serie;
}
/** A mola sozinha (passoMola + o teto de aceleração do limiteDuro) num alvo r(t) em x, com a bola no alvo. */
function molaSozinha(qps, dur, r) {
  const dt = 1 / qps, E = EQ.criarEnquadramento(), est = { x: r(0), z: 0, vx: 0, vz: 0 }, a = alvoVazio();
  E.limX = 1e9; E.limZ0 = -1e9; E.limZ1 = 1e9;
  const g = TELAS[0].g, serie = [];
  for (let i = 0; i <= Math.round(dur * qps); i++) {
    const t = i * dt, rx = r(t);
    a.bx = rx; a.bz = 0;
    const vx0 = est.vx, vz0 = est.vz;
    EQ.passoMola(E, est, rx, 0, dt, i === 0);
    if (i) EQ.limiteDuro(E, est, a, g, dt, vx0, vz0);
    serie.push({ t, x: est.x, vx: est.vx, r: rx, a: i ? (est.vx - vx0) / dt : 0 });
  }
  return serie;
}
// os voos altos do S8 (nome, a bola no chute, a velocidade): pico de 9 a 20 m, perto do lado de cá e no meio
const CENAS_ALTAS = [
  ['chutão do goleiro (pico 13 m)', [-45, 0.11, 5], [24, 16, -3]],
  ['balão do lado de cá na entrada da área (pico 15 m; o da demo s11)', [43, 0.11, 28], [-2, 17, -3]],
  ['balão no meio (pico 20 m)', [0, 0.11, 0], [3, 20, -2]],
  ['lançamento de lá para cá (pico 9 m)', [0, 0.11, -25], [4, 13, 20]],
  ['cruzamento alto do lado de cá (pico 6 m)', [44, 0.11, 30], [-3, 11, -18]],
];
/**
 * Um voo alto sintético (sem arrasto; no chão a bola perde metade e rola), 1 s parada antes: a TV nova (nova) ou a de hoje
 * (o legado com a pose de antes). Conta os quadros do chute até 1 s depois da queda com o chão debaixo da bola fora do
 * quadro, a bola fora e (a nova) o ponto de queda fora enquanto ela voa.
 */
function vooAlto(T, qps, b0, v0, nova) {
  const dt = 1 / qps, E = EQ.criarEnquadramento(), est = { x: 0, z: 0, vx: 0, vz: 0 }, a = alvoVazio(), o = {}, _a = {};
  const b = [...b0], v = [...v0], tq = 2 * v0[1] / 9.81, ax = b0[0] + v0[0] * tq, az = b0[2] + v0[2] * tq;
  const g = nova ? T.g : T.gA, p = nova ? T.p : T.pA;
  let n = 0, chao = 0, bola = 0, queda = 0, voando = false;
  for (let k = -qps; k < Math.round((tq + 1) * qps); k++) {
    if (k >= 0) {
      if (k === 0 || voando) {
        b[0] += v[0] * dt; b[1] += v[1] * dt; b[2] += v[2] * dt; v[1] -= 9.81 * dt;
        if (b[1] < 0.11) { b[1] = 0.11; v[0] *= 0.5; v[1] = 0; v[2] *= 0.5; }
      } else { b[0] += v[0] * dt; b[2] += v[2] * dt; v[0] *= Math.pow(0.99, 60 * dt); v[2] *= Math.pow(0.99, 60 * dt); }
      voando = b[1] > 0.11;
    }
    Object.assign(a, { jx: b[0] - 5, jz: b[2] + 3, jvx: 0, jvz: 0, bx: b[0], by: b[1], bz: b[2], bvx: k >= 0 ? v[0] : 0, bvy: k >= 0 ? v[1] : 0,
      bvz: k >= 0 ? v[2] : 0, ax: voando ? ax : NaN, az: voando ? az : NaN, tRest: voando ? Math.max(0, tq - k * dt) : 0, dir: 1 });
    if (nova) EQ.focoTV(E, est, a, p, g, T.W, dt, k === -qps);
    else {
      EQ.alvoLegado(a, p, _a);
      const fx = Math.max(-p.limX, Math.min(p.limX, _a.x)), fz = Math.max(p.limZ0, Math.min(p.limZ1, _a.z));
      if (k === -qps) { est.x = fx; est.z = fz; } else EQ.molaLegada(est, fx, fz, dt);
    }
    if (k < 0) continue;
    n++;
    if (!dentro(EQ.projetarTV(g, est.x, est.z, b[0], 0, b[2], o))) chao++;
    if (!dentro(EQ.projetarTV(g, est.x, est.z, b[0], b[1], b[2], o))) bola++;
    if (voando && !dentro(EQ.projetarTV(g, est.x, est.z, ax, 0, az, o))) queda++;
  }
  return { n, chao, bola, queda };
}
if (!SO || SO === 'S') {
  for (const qps of [60, 30]) {
    // S1: rampas — o atraso em regime (a partir de 1,5 s) / v; S3: a aceleração
    let piorAtraso = 0, piorAcel = 0;
    for (const v of [7, 15, 20]) {
      const s = molaSozinha(qps, 2.2, t => -40 + v * t);
      const fim = s.filter(p => p.t >= 1.6);
      const atraso = Math.max(...fim.map(p => (p.r - p.x) / v));
      piorAtraso = Math.max(piorAtraso, atraso);
      piorAcel = Math.max(piorAcel, ...s.map(p => Math.abs(p.a)));
    }
    reg(`S1 ${qps} qps: atraso da mola em regime (rampas de 7, 15 e 20 m/s), em s × v`, `${f2(piorAtraso)} s × v (hoje 0,62)`, '≤ 0,25', piorAtraso <= 0.25);
    // S2: parada brusca — o alvo a 15 m/s para em x = 0
    let passa = 0, assenta = 0;
    for (const v of [7, 15, 20]) {
      const s = molaSozinha(qps, 3, t => Math.min(0, -30 + v * t));
      const tPara = 30 / v;
      const depois = s.filter(p => p.t >= tPara);
      passa = Math.max(passa, Math.max(0, ...depois.map(p => p.x)));
      const ultFora = depois.filter(p => Math.abs(p.x) > 0.5).pop();
      assenta = Math.max(assenta, ultFora ? ultFora.t - tPara + 1 / qps : 0);
      piorAcel = Math.max(piorAcel, ...s.map(p => Math.abs(p.a)));
    }
    reg(`S2 ${qps} qps: parada brusca (7–20 m/s): passa do ponto; a ≤ 0,5 m em`, `${f2(passa)} m; ${f2(assenta)} s`, '≤ 0,5 m; ≤ 0,35 s', passa <= 0.5 && assenta <= 0.35);
    // S4: o alvo salta 20 m (troca de controlado)
    const s4 = molaSozinha(qps, 2.5, t => (t < 0.5 ? -10 : 10));
    const dep = s4.filter(p => p.t >= 0.5);
    const passa4 = Math.max(0, ...dep.map(p => p.x - 10)), chega = dep.find(p => Math.abs(p.x - 10) <= 1);
    const acel4 = Math.max(...s4.map(p => Math.abs(p.a)));
    piorAcel = Math.max(piorAcel, acel4);
    reg(`S4 ${qps} qps: o alvo salta 20 m: aceleração; passa do ponto; a ≤ 1 m em`, `${f1(acel4)} m/s²; ${f2(passa4)} m; ${chega ? f2(chega.t - 0.5) : '–'} s`, '≤ 150 m/s²; ≤ 0,05 m; ≤ 1,2 s', acel4 <= Q.acelMax + 1e-6 && passa4 <= 0.05 && !!chega && chega.t - 0.5 <= 1.2);
    reg(`S3 ${qps} qps: a aceleração do foco (S1, S2, S4)`, `${f1(piorAcel)} m/s²`, `≤ ${Q.acelMax} m/s²`, piorAcel <= Q.acelMax + 1e-6);
    // S5: a bola teletransportada (montagem sem evento de corte) = corte
    const s5 = sintetico(qps, 1, (t, a) => { a.bx = t < 0.5 ? 0 : 20; a.bz = 0; a.jx = a.bx; a.jz = 0; });
    const cortes = s5.filter((p, i) => i > 0 && p.cortou).length;
    reg(`S5 ${qps} qps: a bola teletransportada 20 m num quadro corta`, `${cortes} corte(s)`, '1', cortes === 1);
    // S6: a bola fora do campo (atrás do gol no tiro de meta, dentro da rede, além da lateral), parada e mexendo de leve
    let foraLim = 0, passoMax6 = 0;
    const casos = [[-58, 0.11, 2], [-58, 0.11, -9], [53.5, 0.6, 1], [0, 0.11, 36], [0, 0.11, -36], [-30, 0.11, 36.5], [52.6, 2.0, 2.5], [-56, 0.11, 30]];
    for (const T of TELAS) for (const [bx, by, bz] of casos) {
      const s = sintetico(qps, 3, (t, a) => {
        a.bx = bx + 0.2 * Math.sin(t * 9); a.by = by; a.bz = bz + 0.15 * Math.cos(t * 7); a.jx = bx * 0.8; a.jz = bz * 0.5; a.dir = -Math.sign(bx) || 1;
      }, T, bx * 0.6, bz * 0.5);
      for (let i = 1; i < s.length; i++) {
        const p = s[i], o = s[i - 1];
        if (Math.abs(p.x) > Q.area.limX + 1e-6 || p.z < T.p.limZ0 - 1e-6 || p.z > T.p.limZ1 + 1e-6) foraLim++;
        if (!p.cortou) passoMax6 = Math.max(passoMax6, Math.hypot(p.x - o.x, p.z - o.z));
      }
    }
    reg(`S6 ${qps} qps: a bola fora do campo (8 casos × 2 telas): foco fora dos limites; maior passo`, `${foraLim} quadro(s); ${f2(passoMax6)} m`, `0; ≤ ${qps === 60 ? '0,6' : '1,2'} m`, foraLim === 0 && passoMax6 <= (qps === 60 ? 0.6 : 1.2));
    // S7: a histerese do espaço à frente
    const s7a = sintetico(qps, 4, (t, a) => { a.bx = 0; a.bz = 0; a.jx = 0; a.jz = 0; a.dir = Math.floor(t / 0.3) % 2 ? -1 : 1; });
    const viraA = s7a.filter((p, i) => i && p.lado !== s7a[i - 1].lado).length;
    const s7b = sintetico(qps, 4, (t, a) => { a.bx = 0; a.bz = 0; a.jx = 0; a.jz = 0; a.dir = Math.floor(t / 0.6) % 2 ? -1 : 1; });
    const viraB = s7b.filter((p, i) => i && p.lado !== s7b[i - 1].lado).length;
    let vFrente = 0;
    for (let i = 1; i < s7b.length; i++) vFrente = Math.max(vFrente, Math.abs(s7b[i].frente - s7b[i - 1].frente) * qps);
    reg(`S7 ${qps} qps: espaço à frente — posse trocando a cada 0,3 s: viradas; a cada 0,6 s: viradas e velocidade`, `${viraA}; ${viraB}, ${f1(vFrente)} m/s`, `0; ≥ 5, ≤ ${Q.frenteVel} m/s`, viraA === 0 && viraB >= 5 && vFrente <= Q.frenteVel + 1e-6);
  }
  // S8: a bola ALTA (revisão R1): a câmera não inclina, então acima de uma altura não há foco que mostre a bola E o chão
  // debaixo dela; aí o chão (onde estão os jogadores e onde ela vai cair) fica no quadro e a bola sai por cima. Antes a TV
  // andava até 37 m para a frente atrás da bola, o chão saía do quadro e a bola continuava fora (o balão de 15 m da demo s11)
  {
    let chaoN = 0, bolaN = 0, bolaL = 0, chaoL = 0, nS8 = 0, queda = 0;
    const det = [];
    for (const qps of [60, 30]) for (const T of TELAS) for (const [nome, b0, v0] of CENAS_ALTAS) {
      const n = vooAlto(T, qps, b0, v0, true), l = vooAlto(T, qps, b0, v0, false);
      chaoN += n.chao; bolaN += n.bola; bolaL += l.bola; chaoL += l.chao; nS8 += n.n; queda += n.queda;
      if (n.chao) det.push(`${T.chave} ${qps} qps, ${nome}: ${n.chao}`);
    }
    reg(`S8 a bola alta (${CENAS_ALTAS.length} voos de 9 a 20 m × 2 telas × 60 e 30 qps; ${nS8} quadros): o chão debaixo da bola fora do quadro`,
      `${chaoN} quadro(s)${det.length ? ` (${det.slice(0, 3).join('; ')})` : ''} (legado ${chaoL})`, '0', chaoN === 0);
    reg('S8 … a bola fora do quadro (sai por cima acima do que cabe); o ponto de queda fora do quadro', `${bolaN} (legado ${bolaL}); ${queda}`, '≤ o legado; informativo', bolaN <= bolaL);
  }
  // M8: a largura vista no foco
  reg('M8 largura vista no foco: celular / PC', `${f1(TELAS[0].W)} / ${f1(TELAS[1].W)} m (hoje 39,6 / 45)`, '41,5–43,5 / 47–49 m', TELAS[0].W >= 41.5 && TELAS[0].W <= 43.5 && TELAS[1].W >= 47 && TELAS[1].W <= 49);
}

// ------------------------------------------------------------------------------------------------ G: geometria
/** O alvo da TV em regime (corte) para o alvo a: devolve o foco. */
function emRegime(T, a) {
  const E = EQ.criarEnquadramento(), est = { x: 0, z: 0, vx: 0, vz: 0 };
  EQ.focoTV(E, est, a, T.p, T.g, T.W, C.PASSO, true);
  return { x: est.x, z: est.z, E };
}
function ndcReferencia(de, para, fov, asp, p) {
  // lookAt (o da câmera do three: z = olho − alvo, x = cima × z, y = z × x) e a perspectiva em 4×4 (near 0,5, far 900)
  let zx = de[0] - para[0], zy = de[1] - para[1], zz = de[2] - para[2];
  let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx;
  l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  const V = [
    [xx, xy, xz, -(xx * de[0] + xy * de[1] + xz * de[2])],
    [yx, yy, yz, -(yx * de[0] + yy * de[1] + yz * de[2])],
    [zx, zy, zz, -(zx * de[0] + zy * de[1] + zz * de[2])],
    [0, 0, 0, 1],
  ];
  const n = 0.5, fa = 900, f = 1 / Math.tan((fov * Math.PI) / 360);
  const P = [[f / asp, 0, 0, 0], [0, f, 0, 0], [0, 0, (fa + n) / (n - fa), (2 * fa * n) / (n - fa)], [0, 0, -1, 0]];
  const mul = (M, a) => M.map(r => r[0] * a[0] + r[1] * a[1] + r[2] * a[2] + r[3] * a[3]);
  const c = mul(P, mul(V, [p[0], p[1], p[2], 1]));
  return { x: c[0] / c[3], y: c[1] / c[3] };
}
if (!SO || SO === 'G') {
  for (const T of TELAS) {
    // G1: a grade de bolas nas duas áreas
    let n = 0, ok = 0, pior = 0, bolaFora = 0;
    for (const s of [1, -1]) for (let ax = 36; ax <= 52.5; ax += 1) for (let z = -20; z <= 20; z += 1) {
      const a = alvoVazio(); a.bx = s * ax; a.bz = z; a.jx = a.bx; a.jz = z; a.dir = s;
      const f = emRegime(T, a), ar = areaNoQuadro(T.g, f.x, f.z, s * MX), bo = bolaNoLimite(T.g, f.x, f.z, { x: a.bx, y: 0.11, z }, Q.bola);
      n++; if (ar.pior <= Q.area.margem + 1e-6 && bo) ok++; if (!bo) bolaFora++;
      pior = Math.max(pior, ar.pior);
    }
    reg(`G1 ${T.nome}: bola na área (${n} pontos): os 4 cantos e as 2 traves ≤ 0,94 e a bola no limite`, `${f1(pct(ok, n))}% (pior |NDC| ${f2(pior)}; bola fora do limite ${bolaFora})`, '100%', ok === n);
    // G2: o escanteio na TV nos 4 cantos
    let ok2 = 0, d2 = [];
    for (const sx of [1, -1]) for (const sz of [1, -1]) {
      const a = alvoVazio(); a.bx = sx * (MX - 0.4); a.bz = sz * (MZ - 0.4); a.jx = a.bx - sx * 8; a.jz = a.bz * 0.3; a.dir = sx;
      a.temParada = true; a.parada = { tipo: 'escanteio', x: a.bx, z: a.bz, dir: sx };
      const f = emRegime(T, a), ar = areaNoQuadro(T.g, f.x, f.z, sx * MX), bo = bolaNoLimite(T.g, f.x, f.z, { x: a.bx, y: 0.11, z: a.bz }, { x: 1, baixo: -1, cima: 1 });
      if (ar.inteira && bo) ok2++; else d2.push(`${sx > 0 ? '+' : '−'}x ${sz > 0 ? 'cá' : 'lá'}: |NDC| ${f2(ar.pior)}${bo ? '' : ', bola fora'}`);
    }
    reg(`G2 ${T.nome}: escanteio na TV (os 4 cantos): a área inteira, o gol e a bola no quadro`, `${ok2}/4${d2.length ? ` (${d2.join('; ')})` : ''}`, '4/4', ok2 === 4);
    // G3: o tiro livre na TV, de 18 a 35 m da linha (z ±25): a bola e o gol sempre; a área inteira até onde cabe na
    // largura do quadro sem abrir o plano (no celular, 42 m no foco: até ~29 m da linha; no PC, a grade toda — de 30 a 35 m
    // o canto da linha de fundo do lado de cá fica de fora no celular, informativo)
    const ateArea = T.pequena ? 29 : 35;
    let n3 = 0, ok3 = 0, n3a = 0, ok3a = 0, n3b = 0, ok3b = 0, pior3 = 0;
    for (const sx of [1, -1]) for (let dl = 18; dl <= 35; dl += 1) for (let z = -25; z <= 25; z += 2.5) {
      const a = alvoVazio(); a.bx = sx * (MX - dl); a.bz = z; a.jx = a.bx - sx * 3; a.jz = z; a.dir = sx;
      a.temParada = true; a.parada = { tipo: 'tiroLivre', x: a.bx, z, dir: sx };
      const f = emRegime(T, a), ar = areaNoQuadro(T.g, f.x, f.z, sx * MX), bo = bolaNoLimite(T.g, f.x, f.z, { x: a.bx, y: 0.11, z }, { x: 1, baixo: -1, cima: 1 });
      n3++; if (bo && ar.traves === 4) ok3++;
      if (dl <= ateArea) { n3a++; if (ar.inteira && bo) ok3a++; else pior3 = Math.max(pior3, ar.pior); }
      else { n3b++; if (ar.inteira && bo) ok3b++; }
    }
    reg(`G3 ${T.nome}: tiro livre na TV a 18–35 m da linha (${n3} pontos): a bola e o gol no quadro`, `${f1(pct(ok3, n3))}%`, '100%', ok3 === n3);
    reg(`G3 ${T.nome}: … a área inteira, a 18–${ateArea} m (${n3a} pontos)`, `${f1(pct(ok3a, n3a))}%${pior3 ? ` (pior |NDC| ${f2(pior3)})` : ''}`, '≥ 95%', ok3a >= 0.95 * n3a);
    if (n3b) reg(`G3 ${T.nome}: … a área inteira, a ${ateArea + 1}–35 m (${n3b} pontos)`, `${f1(pct(ok3b, n3b))}%`, '(não cabe sem abrir o plano)', null);
    // G4: a projeção fechada contra a 4×4
    const pose = {}, o = {};
    let pior4 = 0, n4 = 0;
    for (const fx of [-44.5, -20, 0, 30, 44.5]) for (const fz of [-22, -5, 0, 10, 23]) {
      EQ.poseTV(T.p, fx, fz, T.asp, T.pequena, pose);
      for (let x = -55; x <= 55; x += 11) for (const y of [0, 1.8, 2.44, 8]) for (let z = -36; z <= 36; z += 8) {
        EQ.projetarTV(T.g, fx, fz, x, y, z, o);
        if (!o.ok) continue;
        const r = ndcReferencia(pose.de, pose.para, pose.fov, T.asp, [x, y, z]);
        pior4 = Math.max(pior4, Math.abs(r.x - o.x), Math.abs(r.y - o.y)); n4++;
      }
    }
    reg(`G4 ${T.nome}: projetarTV × a projeção 4×4 (${n4} pontos)`, pior4.toExponential(1), '≤ 1e-6', pior4 <= 1e-6);
  }
  await g5();
}

// G5: o escanteio da pessoa (render/plano-bola-parada.js, a câmera atrás do cobrador e ALTA) nos 4 cantos × a corrida
// da cobrança (recuo 0, 2,5 e 5 m) × as formas de estádio (o Golaço, o Maracanã e as formas genéricas da base): a lente fora
// dos sólidos do desenho (dentro da arquibancada de cá só com ela escondida), ≥ 2 m acima do que houver embaixo, a faixa da
// área na altura da tela e o jogador na marca do pênalti no celular (390 px de altura).
async function g5() {
  let PB = null;
  try { PB = await imp('render/plano-bola-parada.js'); } catch { PB = null; }
  if (!PB) { reg('G5 escanteio da pessoa: render/plano-bola-parada.js', 'não existe', 'existe', false); return; }
  const fs = await import('node:fs');
  const F = await imp('estadio-forma.js'), TD = await imp('render/torcida-dados.js');
  const GEN = await imp('estadio-generico.js'), PL = await imp('estadio-planta.js');
  const base = JSON.parse(fs.readFileSync(path.join(PASTA_JS, '../assets/tm/estadios.json'), 'utf8'));
  const formas = [['Golaço', null]];
  if (base.estadios.maracana?.forma) formas.push(['Maracanã', () => PL.criarPlanta(base.estadios.maracana.forma)]);
  for (const [k, e] of Object.entries(base.estadios)) if (e.forma && e.forma.entorno !== 'maracana') formas.push([k, () => GEN.criarPlantaGenerica(e.forma)]);
  const C = PB.CAMERA_ESCANTEIO, B = PB.CAMERA_BOLA_PARADA, H = 390, asp = 844 / 390;
  const tx = MX - 11; // o alvo do escanteio (mira.js alvoPadrao): a marca do pênalti
  const ruins = [], cabeca = [], faixas = [], faixasG = [], pxs = [], o = {};
  for (const [nome, criar] of formas) {
    const P = criar ? criar() : null;
    F.definirForma(P); TD.definirLadoDeCa(P ? P.cameraNoLadoDeCa : null);
    // (a corrida do escanteio: 2,5–4 m a 25–40° da linha — config.js CORRIDA_COBRANCA —, o recuo na linha bola–alvo ≤ 4 m)
    for (const sx of [1, -1]) for (const sz of [1, -1]) for (const recuo of [0, 2, 4]) {
      const bx = sx * (MX - 0.4), bz = sz * (MZ - 0.4), ax = sx * tx;
      // o lado da lente: o mais para dentro do campo (a conta do bola-parada.js camera)
      const dx = ax - bx, dz = -bz, d = Math.hypot(dx, dz);
      const fora = q => { const x = bx - dx / d * B.atras - dz / d * B.lado * q, z = bz - dz / d * B.atras + dx / d * B.lado * q; return Math.max(0, Math.abs(x) - MX) + Math.max(0, Math.abs(z) - MZ); };
      const lado = fora(1) < fora(-1) - 0.05 ? 1 : -1;
      const pl = PB.planoBolaParada(bx, bz, ax, 0, 0, lado, [], {}, recuo, C);
      const [px, py, pz] = pl.de, caso = `${nome} ${sx > 0 ? '+x' : '−x'} ${sz > 0 ? 'cá' : 'lá'} r${recuo}`;
      const escondida = TD.cameraNoLadoDeCa({ x: px, y: py, z: pz });
      const sol = F.solidoEm(px, py, pz, 0.3, false);
      if (sol && !escondida) ruins.push(`${caso}: ${sol}`);
      const solB = F.solidoEm(px, py - C.folgaCabeca, pz, 0.3, false);
      if (solB && !escondida) cabeca.push(`${caso}: ${solB}`);
      // a faixa da área (a grade 11 × 15) e o jogador na marca do pênalti
      let y0 = Infinity, y1 = -Infinity;
      for (let i = 0; i <= 10; i++) for (let k = 0; k <= 14; k++) {
        const r = ndcReferencia(pl.de, pl.para, pl.fov, asp, [sx * (MX - AP * i / 10), 0, -AL + 2 * AL * k / 14]);
        y0 = Math.min(y0, r.y); y1 = Math.max(y1, r.y);
      }
      const fx = (y1 - y0) / 2;
      (nome === 'Golaço' ? faixasG : faixas).push(fx);
      const a0 = ndcReferencia(pl.de, pl.para, pl.fov, asp, [sx * tx, 0, 0]), a1 = ndcReferencia(pl.de, pl.para, pl.fov, asp, [sx * tx, 1.8, 0]);
      pxs.push(Math.abs(a1.y - a0.y) / 2 * H);
      if (process.env.CAM_G5) console.error(`${caso}: lente (${pl.de.map(v => v.toFixed(1)).join(', ')}) fov ${pl.fov.toFixed(1)} faixa ${(100 * fx).toFixed(1)}% marca ${(Math.abs(a1.y - a0.y) / 2 * H).toFixed(1)} px`);
    }
  }
  F.definirForma(null); TD.definirLadoDeCa(null);
  const n = formas.length * 12, todas = [...faixas, ...faixasG];
  const lista = (r, k = 3) => (r.length ? `${r.length}: ${r.slice(0, k).join(' · ')}` : '0');
  reg(`G5 escanteio da pessoa (${formas.length} estádios × 4 cantos × corrida de 0, 2 e 4 m): a lente num sólido do desenho`, lista(ruins), '0', ruins.length === 0);
  reg(`G5 … ≥ ${C.folgaCabeca} m acima do que houver embaixo (degraus, cabeças)`, lista(cabeca), '0', cabeca.length === 0);
  const okF = todas.filter(v => v >= 0.15).length, minG = Math.min(...faixasG);
  reg('G5 … a faixa da área na altura da tela: ≥ 15% (todos); no Golaço, o pior', `${f1(pct(okF, n))}% (mediana ${f1(100 * q(todas, 0.5))}%); ${f1(100 * minG)}% (antes 6,5–8,8%)`, '≥ 95%; ≥ 20%', okF >= 0.95 * n && minG >= 0.2);
  // (no Golaço sempre ≥ 18 px; nos estádios com a arquibancada de lá encostada a lente sobe e olha mais de cima — a área fica
  // maior na tela, o jogador mais baixo: ≥ 18 px em ≥ 90% e nunca abaixo do pior da câmera baixa de antes, 13 px)
  const pxG = pxs.slice(0, 12), ok18 = pxs.filter(v => v >= 18).length;
  reg('G5 … o jogador na marca do pênalti no celular: no Golaço, o pior; em todos, ≥ 18 px e o pior', `${f1(Math.min(...pxG))} px; ${f1(pct(ok18, pxs.length))}% e ${f1(Math.min(...pxs))} px (mediana ${f1(q(pxs, 0.5))}; antes 13–15,6)`, '≥ 18 px; ≥ 90% e ≥ 13 px', Math.min(...pxG) >= 18 && ok18 >= 0.9 * pxs.length && Math.min(...pxs) >= 13);
}

// ------------------------------------------------------------------------------------------------ P: partidas
if (!SO || SO === 'P') {
  const fila = [...faixa(arg('--sementes', '1-6')).map(s => `demo:${s}`), ...faixa(arg('--passivo', '1-4')).map(s => `passivo:${s}`)];
  const res = [];
  const rodar = id => new Promise((ok, falha) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--filho', id, '--js', PASTA_JS], { stdio: ['ignore', 'pipe', 'inherit'] });
    let txt = '';
    p.stdout.on('data', d => { txt += d; });
    p.on('close', c => { if (c) falha(new Error(`${id}: saída ${c}`)); else { try { ok(JSON.parse(txt)); } catch (e) { falha(e); } } });
  });
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(PAR, fila.length) }, async () => {
    while (fila.length) { const id = fila.shift(); res.push(await rodar(id)); }
  }));
  console.error(`P: ${res.length} partidas em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  // índices da amostra
  const I = { rol: 0, x: 1, y: 2, pe: 3, zona: 4, area: 5, dGol: 6, u: 7, lag: 8, vb: 9, aFrac: 10, aInt: 11, aTrav: 12, hCtrl: 13, hMed: 14, chao: 15, alta: 16 };
  const dk = (s, k) => Number.isFinite(s[I.x]) && Math.abs(s[I.x]) <= k && Math.abs(s[I.y]) <= k;
  function medidas(modo, cam) {
    const L = res.filter(r => r.modo === modo).map(r => r.cams[cam]);
    const A = L.flatMap(c => c.amostras), rol = A.filter(s => s[I.rol]);
    const pe = rol.filter(s => s[I.pe]), ar = rol.filter(s => !s[I.pe]);
    const meio = pe.filter(s => s[I.zona] === 1 && Number.isFinite(s[I.u])), fin = pe.filter(s => s[I.zona] === 2 && Number.isFinite(s[I.u]));
    const naArea = rol.filter(s => s[I.area]), g25 = rol.filter(s => s[I.dGol] <= 25), rap = rol.filter(s => s[I.vb] >= 8);
    return {
      n: rol.length,
      miolo50: pct(rol.filter(s => dk(s, 0.5)).length, rol.length),
      fora: pct(rol.filter(s => !s[I.alta] && !dk(s, 1)).length, rol.filter(s => !s[I.alta]).length),
      chaoFora: pct(rol.filter(s => !s[I.chao]).length, rol.length),
      nAlta: rol.filter(s => s[I.alta]).length, foraAlta: rol.filter(s => s[I.alta] && !dk(s, 1)).length,
      xP90: q(rol.map(s => Math.abs(s[I.x])), 0.9),
      fora80Pe: pct(pe.filter(s => !dk(s, 0.8)).length, pe.length), fora80Ar: pct(ar.filter(s => !dk(s, 0.8)).length, ar.length),
      uMeio: q(meio.map(s => s[I.u]), 0.5), frenteMeio: pct(meio.filter(s => s[I.u] <= 0.5).length, meio.length),
      uFinal: q(fin.map(s => s[I.u]), 0.5), fora80Final: pct(fin.filter(s => s[I.u] < 0.1 || s[I.u] > 0.9).length, fin.length),
      areaInt: pct(naArea.filter(s => s[I.aInt]).length, naArea.length), nArea: naArea.length,
      g25Int: pct(g25.filter(s => s[I.aInt]).length, g25.length),
      areaP10: q(naArea.map(s => s[I.aFrac]), 0.1), traves: pct(naArea.filter(s => s[I.aTrav]).length, naArea.length),
      lagP90: q(rap.map(s => s[I.lag]), 0.9), nRap: rap.length,
      inv: L.reduce((a, c) => a + c.inv, 0) / (L.reduce((a, c) => a + c.t, 0) / 60),
      accP999: Math.max(...L.map(c => c.accP999)), accMax: Math.max(...L.map(c => c.accMax)), passoMax: Math.max(...L.map(c => c.passoMax)),
      hCtrl: q(A.map(s => s[I.hCtrl]), 0.5), hCtrlP10: q(A.map(s => s[I.hCtrl]), 0.1), hMed: q(A.map(s => s[I.hMed]), 0.5),
    };
  }
  for (const modo of ['demo', 'passivo']) {
    const nP = res.filter(r => r.modo === modo).length;
    if (!nP) continue;
    const rot = modo === 'demo' ? `demo (${nP})` : `'passivo' (${nP})`, d = modo === 'demo';
    for (const T of TELAS) {
      const N = medidas(modo, `${T.chave}-nova`), L = medidas(modo, `${T.chave}-legado`), cel = T.chave === 'cel';
      const tag = `${rot}, ${T.chave === 'cel' ? 'celular' : 'PC'}`;
      const ab = (fn, fmt = f1) => `${fmt(fn(L))} → ${fmt(fn(N))}`;
      const m1 = d ? 96 : 95;
      reg(`M1 ${tag}: bola no miolo 50% × 50% (bola rolando, ${N.n} instantes)`, `${ab(o => o.miolo50)}%`, `≥ ${m1}%`, N.miolo50 >= m1);
      reg(`M2 ${tag}: bola fora do quadro (até a altura que cabe, ${f1(T.yCabe)} m)`, `${ab(o => o.fora, f2)}%`, '≤ 0,05%', N.fora <= 0.05);
      reg(`M2b ${tag}: o chão debaixo da bola fora do quadro; a bola acima da altura que cabe fora (informativo)`,
        `${ab(o => o.chaoFora, f2)}%; ${L.foraAlta}/${L.nAlta} → ${N.foraAlta}/${N.nAlta}`, '0%', N.chaoFora === 0);
      const m3 = d ? 0.30 : 0.32;
      reg(`M3 ${tag}: |NDC x| da bola, p90`, ab(o => o.xP90, f2), `≤ ${f2(m3)}`, N.xP90 <= m3);
      if (cel) reg(`M3b ${tag}: fora dos 80% centrais — no pé / no ar`, `${f2(L.fora80Pe)} / ${f2(L.fora80Ar)}% → ${f2(N.fora80Pe)} / ${f2(N.fora80Ar)}%`, '≤ 0,1% / ≤ 0,6%', N.fora80Pe <= 0.1 && N.fora80Ar <= 0.6);
      // (u na régua de 2 casas, como a especificação mede: a TV real 0,37, o centro 0,50)
      const u2 = Math.round(N.uMeio * 100) / 100;
      reg(`M4 ${tag}: meio-campo, bola no pé: u mediano; u ≤ 0,5`, `${f2(L.uMeio)}; ${f1(L.frenteMeio)}% → ${N.uMeio.toFixed(3).replace('.', ',')}; ${f1(N.frenteMeio)}%`, '0,40–0,48; ≥ 65%', u2 >= 0.40 && u2 <= 0.48 && N.frenteMeio >= 65);
      reg(`M5 ${tag}: último terço fora da área, bola no pé: u mediano; fora dos 80%`, `${f2(L.uFinal)}; ${f1(L.fora80Final)}% → ${f2(N.uFinal)}; ${f1(N.fora80Final)}%`, '0,45–0,55; ≤ 1%', N.uFinal >= 0.45 && N.uFinal <= 0.55 && N.fora80Final <= 1);
      reg(`M6 ${tag}: bola na área (${N.nArea}): a área inteira (4 cantos e as 2 traves)`, `${ab(o => o.areaInt)}%`, '≥ 90%', N.areaInt >= 90);
      reg(`M6b ${tag}: bola a ≤ 25 m do gol: a área inteira`, `${ab(o => o.g25Int)}%`, '≥ 70%', N.g25Int >= 70);
      reg(`M6c ${tag}: bola na área: a área no quadro p10; as 2 traves`, `${f1(100 * L.areaP10)}%; ${f1(L.traves)}% → ${f1(100 * N.areaP10)}%; ${f1(N.traves)}%`, '≥ 95%; ≥ 97%', N.areaP10 >= 0.95 && N.traves >= 97);
      const m9 = d ? 7.0 : 7.5;
      reg(`M9 ${tag}: atraso no sentido da bola com ela a ≥ 8 m/s (${N.nRap}), p90`, `${ab(o => o.lagP90)} m`, `≤ ${f1(m9)} m`, N.lagP90 <= m9);
      reg(`M10 ${tag}: vai e volta (inversões do foco em x > 1 m)`, `${ab(o => o.inv)}/min`, `≤ o legado + 1 (${f1(L.inv + 1)})`, N.inv <= L.inv + 1);
      reg(`M11 ${tag}: aceleração do olhar fora dos cortes, p99,9 (pior partida); máximo; maior passo do foco`, `${f1(N.accP999)}°/s²; ${f1(N.accMax)}°/s²; ${f2(N.passoMax)} m (legado ${f1(L.accP999)}; ${f1(L.accMax)}; ${f2(L.passoMax)})`, '≤ 200; ≤ 400; ≤ 1,2 m', N.accP999 <= 200 && N.accMax <= 400 && N.passoMax <= 1.2);
      if (cel) {
        reg(`R1 ${tag}: controlado, mediana (o p10 informativo)`, `${f1(L.hCtrl)} → ${f1(N.hCtrl)} px (p10 ${f1(L.hCtrlP10)} → ${f1(N.hCtrlP10)}; todos ${f1(L.hMed)} → ${f1(N.hMed)})`, '≥ 34 px', N.hCtrl >= 34);
      } else reg(`R1c ${tag}: controlado, mediana`, `${f1(L.hCtrl)} → ${f1(N.hCtrl)} px`, '≥ 43 px', N.hCtrl >= 43);
    }
  }
}

const larg = [];
for (const l of linhas) l.forEach((c, i) => { larg[i] = Math.max(larg[i] ?? 0, String(c).length); });
console.log(linhas.map(l => l.map((c, i) => String(c).padEnd(larg[i])).join('  ')).join('\n'));
console.log(falhas ? `\nteste-camera: REPROVOU (${falhas})` : '\nteste-camera: PASSOU');
process.exit(falhas ? 1 : 0);
