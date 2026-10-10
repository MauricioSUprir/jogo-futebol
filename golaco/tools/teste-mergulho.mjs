// Goleiro que PULA e ESPALMA (pedido do dono, 10/10: "o goleiro não pula, e nem espalma direito").
// Mede pela POSE desenhada (anim.js), como o jogador vê, em quatro canhões:
//  A. grade (432 chutes no alvo de 9 a 26 m, de frente e de lado a ±28°, a 0,5–3,0 m do goleiro na linha
//     dele, da grama ao ângulo, a 18–27 m/s, contra um goleiro médio e um bom):
//     1. chute no alvo fora do alcance em pé — a bola passa a > 1 m de onde o goleiro estava 0,5 s antes (com
//        menos tempo que isso ele não chega andando de lado): 100% com mergulho desenhado — os dois pés fora
//        do chão (tornozelos > 0,12 m) e o tronco inclinado > 45° em algum quadro;
//     2. nas defesas, a mão a ≤ 0,25 m da bola no tick do contato (≥ 95%);
//     3. espalmadas que morrem na zona perigosa (à frente do gol, < 11 m da linha, |z| < 9 m, abaixo de 4 m/s)
//        ≤ 10%;
//     4. o pé do goleiro não patina nem salta no mergulho e no levantar (as metas do teste-patinacao: plantado
//        ≤ 0,05 m/s; deslocamento por quadro ≤ (2,5·v + 3)·dt; pouso ≤ 0,19·v + 0,81 m/s — v = a velocidade do
//        corpo, limitada a 6 m/s: um corpo "voando" não afrouxa a meta do pé);
//  B. canhão variado (contraprova de 10/10: 900 chutes de 6–30 m, até 60° de ângulo, com curva, alturas
//     contínuas, cavadinha por cima do goleiro adiantado) e 150 REBOTES (2º chute 0,25–0,7 s depois da 1ª
//     defesa, com o goleiro ainda no chão):
//     5. nas defesas, a mão a ≤ 0,25 m da bola no contato (≥ 95%, contando a cavadinha);
//     6. o centro do corpo nunca passa de 5,5 m/s nem a pelve desenhada de 7,5 m/s (pesquisa: o centro de massa
//        do goleiro chega a 3,6–4,0 m/s; antes da correção ele "teletransportava" a até 64 m/s);
//     7. o goleiro nunca passa da linha do gol (o centro do corpo);
//     8. o tronco não gira mais que 20° num quadro (antes: até 105° no rebote);
//     9. espalmadas jogáveis na zona perigosa (abaixo de 1,5 m e de 7 m/s, < 11 m da linha, |z| < 9 m, em
//        algum instante dos 2 s seguintes, contado desde o contato) ≤ 10%;
//    10. bola alta (> 1,9 m) perto do corpo (< 0,8 m): salto (pés fora do chão e as duas mãos acima da cabeça)
//        em ≥ 80%;
//    11. a espalmada não volta para as mãos dele em ≤ 0,5 s (≤ 2%, grade A + canhão B; antes ~metade voltava 1
//        tick depois e a espalmada virava encaixe);
//  C. rebote disputado: 720 chutes com 3 atacantes e 2 defensores (IA) na área; depois da espalmada, quem toca
//     primeiro na bola:
//    11. o ataque em ≤ 10% das espalmadas (a espalmada para fora do perigo; na partida da versão publicada o
//        ataque pegava ~31% delas).
//  E. chute desviado: 648 chutes rasteiros que raspam num zagueiro parado entre a bola e o gol depois de o
//     goleiro ler (contraprova S1):
//    12. nas defesas depois do desvio, a mão a ≤ 0,25 m da bola (≥ 95%) — o goleiro relê o chute desviado;
//    13. a bola nunca salta num quadro além do que ela anda (≤ 0,3 m; antes ia parar nas mãos de longe).
//  D. informação: no mergulho, quanto tempo do contato até estar de pé de novo (cair, ficar no chão, levantar).
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

const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2, ALT = CAMPO.gol.altura;
const TORN = [J.tornozeloE, J.tornozeloD];
const DEG = Math.PI / 180;
const V_PE = 6; // m/s — a velocidade do corpo que entra nos limites do pé (no máximo)
const limiteBalanco = v => 2.5 * Math.min(v, V_PE) + 3;
const limitePouso = v => 0.19 * Math.min(v, V_PE) + 0.81;

/** Gerador simples com semente (só para montar os casos do teste). */
function gerador(sem) {
  let s = (sem * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

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

/** Critério duro (contraprova): a bola espalmada fica jogável na zona (abaixo de 1,5 m e de 7 m/s) em 2 s? */
function jogavelNaZona(b0) {
  const b = copiarBola(b0);
  for (let i = 0; i <= 120; i++) {
    if (i > 0) passoBola(b, null);
    if (b.p.x > GX || Math.abs(b.p.z) > CAMPO.meioZ) return null;
    if (b.p.y < 1.5 && Math.hypot(b.v.x, b.v.z) < 7 && GX - b.p.x < 11 && Math.abs(b.p.z) < 9) return { x: b.p.x, z: b.p.z, t: i * PASSO };
  }
  return null;
}

/** Lança a bola de (bx, bz) para passar em (GX, zAlvo) na altura yAlvo, a v m/s, com curva wy (rad/s). */
function lancar(b, bx, bz, zAlvo, yAlvo, v, wy) {
  const ux0 = GX - bx, uz0 = zAlvo - bz, D = Math.hypot(ux0, uz0);
  const ux = ux0 / D, uz = uz0 / D;
  let lo = -0.3, hi = 1.2;
  for (let k = 0; k < 40; k++) {
    const el = (lo + hi) / 2;
    const c = copiarBola(b); c.p.x = bx; c.p.y = 0.11; c.p.z = bz;
    c.v.x = ux * v * Math.cos(el); c.v.y = v * Math.sin(el); c.v.z = uz * v * Math.cos(el); c.w.x = 0; c.w.y = wy; c.w.z = 0; c.rolando = false;
    let y = null;
    for (let i = 0; i < 400; i++) {
      const x0 = c.p.x, y0 = c.p.y;
      passoBola(c, null);
      if (c.p.x >= GX - 0.2) { y = y0 + (c.p.y - y0) * ((GX - 0.2 - x0) / ((c.p.x - x0) || 1e-9)); break; }
      if (Math.hypot(c.v.x, c.v.z) < 0.5) break;
    }
    if (y == null || y < yAlvo) lo = el; else hi = el;
  }
  const el = (lo + hi) / 2;
  b.p.x = bx; b.p.y = 0.11; b.p.z = bz;
  b.v.x = ux * v * Math.cos(el); b.v.y = v * Math.sin(el); b.v.z = uz * v * Math.cos(el);
  b.w.x = 0; b.w.y = wy; b.w.z = 0; b.rolando = false;
}

/** Mede um lance (pose do goleiro a cada passo) até o fim da defesa. `chute(m, g)` lança a bola. */
function medir(m, g, n, reb) {
  const b = m.bola;
  const P = new Float32Array(NJ * 3), P0 = new Float32Array(NJ * 3);
  const r = {
    res: null, latCorpo: null, inclinou: 0, voou: false, maoContato: null, destino: null, jogavel: null, dur: null,
    pat: { plantado: 0, razao: 0, pouso: 0 }, vCentro: 0, vPelve: 0, xMax: -Infinity, giroTronco: 0, maoAcima: false, latEmPe: null,
  };
  let ant = null, ultimo = null, t2 = null;
  const hist = []; // centro do goleiro por tick (para a distância lateral 0,5 s antes de a bola chegar)
  pose(g, m, P);
  for (let i = 0; i < n; i++) {
    // rebote: o 2º chute logo depois da 1ª defesa
    if (reb && r.res && t2 == null && m.tick >= r.tickDef + reb.atraso) {
      t2 = m.tick;
      m.posse = null; m.naMao = null;
      lancar(b, GX - reb.d, reb.z0, reb.zA, 0.4, 20, 0);
      m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
    }
    const preB = { x: b.p.x, y: b.p.y, z: b.p.z };
    hist.push(g.z);
    if (r.latCorpo == null && preB.x >= g.x - 0.35) r.latCorpo = Math.abs(preB.z - hist[Math.max(0, i - 30)]);
    P0.set(P);
    const gx0 = g.x, gz0 = g.z;
    passo(m, {});
    pose(g, m, P);
    r.vCentro = Math.max(r.vCentro, Math.hypot(g.x - gx0, g.z - gz0) / PASSO);
    r.vPelve = Math.max(r.vPelve, Math.hypot(P[0] - P0[0], P[1] - P0[1], P[2] - P0[2]) / PASSO);
    r.xMax = Math.max(r.xMax, g.x);
    // mergulho desenhado: os dois pés fora do chão e o tronco inclinado
    const yE = P[J.tornozeloE * 3 + 1], yD = P[J.tornozeloD * 3 + 1];
    if (yE > 0.12 && yD > 0.12) r.voou = true;
    const tx = P[J.pescoco * 3] - P[J.pelve * 3], ty = P[J.pescoco * 3 + 1] - P[J.pelve * 3 + 1], tz = P[J.pescoco * 3 + 2] - P[J.pelve * 3 + 2];
    const lt = Math.hypot(tx, ty, tz) || 1;
    r.inclinou = Math.max(r.inclinou, Math.acos(Math.max(-1, Math.min(1, ty / lt))) / DEG);
    const ax = P0[J.pescoco * 3] - P0[J.pelve * 3], ay = P0[J.pescoco * 3 + 1] - P0[J.pelve * 3 + 1], az = P0[J.pescoco * 3 + 2] - P0[J.pelve * 3 + 2];
    const cs = (tx * ax + ty * ay + tz * az) / (lt * (Math.hypot(ax, ay, az) || 1));
    r.giroTronco = Math.max(r.giroTronco, Math.acos(Math.max(-1, Math.min(1, cs))) / DEG);
    if (!r.res && P[J.maoE * 3 + 1] > P[J.cabeca * 3 + 1] && P[J.maoD * 3 + 1] > P[J.cabeca * 3 + 1]) r.maoAcima = true;
    if (g.mergulho && g.mergulho !== ultimo && g.mergulho.tc != null) { ultimo = g.mergulho; if (g.mergulho.tipo === 'mergulho' && r.dur == null) r.dur = (g.mergulho.fim - g.mergulho.tc) * PASSO; }
    // patinação do goleiro (o mesmo critério do teste-patinacao)
    const atu = { t: TORN.map(k => [P[k * 3], P[k * 3 + 1], P[k * 3 + 2]]), sim: g.pes.map(p => ({ apoio: p.apoio, x: p.x, z: p.z })), v: Math.max(Math.hypot(g.vx, g.vz), r.vPelve) };
    if (ant) {
      const v = Math.max(atu.v, ant.v);
      for (let p = 0; p < 2; p++) {
        const d = Math.hypot(atu.t[p][0] - ant.t[p][0], atu.t[p][1] - ant.t[p][1], atu.t[p][2] - ant.t[p][2]);
        const vp = d / PASSO, s0 = ant.sim[p], s1 = atu.sim[p];
        if (s0.apoio && s1.apoio && s0.x === s1.x && s0.z === s1.z && vp > r.pat.plantado) r.pat.plantado = vp;
        if (!s0.apoio && s1.apoio) r.pat.pouso = Math.max(r.pat.pouso, vp / limitePouso(v));
        if (vp / limiteBalanco(v) > r.pat.razao) r.pat.razao = vp / limiteBalanco(v);
      }
    }
    ant = atu;
    for (const e of m.eventos) {
      if (t2 != null) continue; // o 2º chute do rebote não muda o desfecho do 1º
      // a espalmada que volta para as mãos dele logo depois ("pegou" em ≤ 0,5 s) não é espalmada
      if (e.tipo === 'defesa' && e.modo === 'pegou' && e.id === g.id && r.res === 'espalmada' && m.tick - r.tickDef <= 30) r.reagarrou = true;
      if (e.tipo === 'gol' && !r.res) { r.res = 'gol'; r.tickDef = m.tick; }
      if (e.tipo === 'defesa' && !r.res) {
        r.res = e.modo; r.tickDef = m.tick;
        if (r.latCorpo == null) r.latCorpo = Math.abs(preB.z - hist[Math.max(0, i - 30)]);
        // a mão (a mais perto) e a bola no contato: a pose do começo do passo e a do fim
        let dm = Infinity;
        for (const PP of [P0, P]) for (const k of [J.maoE, J.maoD]) dm = Math.min(dm, Math.hypot(PP[k * 3] - preB.x, PP[k * 3 + 1] - preB.y, PP[k * 3 + 2] - preB.z));
        r.maoContato = dm;
        r.recuo = !!(g.defesa && g.defesa.recuo);
        if (e.modo === 'espalmada') { r.destino = destinoEspalmada(b); r.jogavel = jogavelNaZona(b); }
      }
    }
    if (!r.res && b.p.x > GX + 0.3) { r.res = 'fora'; r.tickDef = m.tick; }
    if (r.res && !reb && g.mergulho == null && i > 100) break;
  }
  return r;
}

// ------------------------------------------------------------------ A. grade
function casoGrade(c) {
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
  const r = medir(m, g, 200, null);
  r.mergulho = r.voou && r.inclinou > 45;
  return r;
}

// ------------------------------------------------------------------ B. canhão variado e rebote no chão
function casoVariado(c) {
  const jog = [
    { id: 0, x: 0, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: c.attr },
  ];
  const bx = GX - Math.cos(c.ang * DEG) * c.d, bz = Math.sin(c.ang * DEG) * c.d;
  const m = criarMundo({ semente: c.sem, jogadores: jog, bola: { x: bx, z: bz }, posse: null });
  for (let i = 0; i < 120; i++) passo(m, {});
  const g = jogadorPorId(m, 20);
  lancar(m.bola, bx, bz, c.zA, c.yA, c.v, c.wy);
  m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
  const r = medir(m, g, c.rebote ? 260 : 200, c.rebote);
  r.mergulho = r.voou && r.inclinou > 45;
  return r;
}

// ------------------------------------------------------------------ C. rebote disputado
function casoDisputa(c) {
  const jog = [
    { id: 0, x: 0, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
    { id: 1, x: GX - 7, z: -4.5, rumo: 0, time: 0, papel: 'ia', posicao: 'ATA' },
    { id: 2, x: GX - 7, z: 4.5, rumo: 0, time: 0, papel: 'ia', posicao: 'ATA' },
    { id: 3, x: GX - 11, z: 0.5, rumo: 0, time: 0, papel: 'ia', posicao: 'MEI' },
    { id: 21, x: GX - 5, z: -3, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'ZAG' },
    { id: 22, x: GX - 5, z: 3, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'ZAG' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: c.attr },
  ];
  const bx = GX - Math.cos(c.ang * DEG) * c.d, bz = Math.sin(c.ang * DEG) * c.d;
  const m = criarMundo({ semente: c.sem, jogadores: jog, bola: { x: bx, z: bz }, posse: null });
  // todos parados até o chute (o goleiro se posiciona)
  for (let i = 0; i < 60; i++) passo(m, {});
  lancar(m.bola, bx, bz, c.zA, c.yA, c.v, 0);
  m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
  let esp = null;
  for (let i = 0; i < 300; i++) {
    passo(m, {});
    for (const e of m.eventos) {
      if (!esp) {
        if (e.tipo === 'defesa' && e.modo === 'espalmada') esp = { tick: m.tick, primeiro: null };
        else if (e.tipo === 'gol' || e.tipo === 'defesa') return null;
        continue;
      }
      if (esp.primeiro) continue;
      if (e.tipo === 'gol') esp.primeiro = 'gol';
      else if ((e.tipo === 'toque' || e.tipo === 'bateuCorpo' || e.tipo === 'cabeceio' || e.tipo === 'dominioAereo' || e.tipo === 'defesa') && e.id != null) {
        const o = jogadorPorId(m, e.id);
        esp.primeiro = o && o.time === 0 ? 'ataque' : 'defesa';
      }
    }
    if (!esp && (m.bola.p.x > GX + 0.3 || m.posse != null)) return null; // não foi espalmada
    if (esp && !esp.primeiro) {
      if (m.posse != null) { const o = jogadorPorId(m, m.posse); esp.primeiro = o && o.time === 0 ? 'ataque' : 'defesa'; }
      else if (m.bola.p.x > GX || Math.abs(m.bola.p.z) > CAMPO.meioZ) esp.primeiro = 'fora';
      else if (m.tick - esp.tick > 240) esp.primeiro = 'ninguém';
    }
    if (esp && esp.primeiro) return esp;
  }
  return esp;
}

// ------------------------------------------------------------------ E. chute desviado num corpo
// O chute passa raspando num zagueiro parado entre a bola e o gol DEPOIS de o goleiro ler (contraprova S1: a
// defesa lida ainda acontecia no tick lido, com a bola em outro lugar — na partida a bola chegou a ir parar nas
// mãos de 23 m num quadro). Mede a mão desenhada na bola em cada defesa e o maior salto da bola num quadro.
function casoDesvio(c) {
  const bx = GX - Math.cos(c.ang * DEG) * c.d, bz = Math.sin(c.ang * DEG) * c.d;
  const ux = GX - bx, uz = c.zA - bz, L = Math.hypot(ux, uz);
  const k = (GX - c.dDef - bx) / ux;
  const zx = bx + ux * k + (-uz / L) * c.off, zz = bz + uz * k + (ux / L) * c.off;
  const jog = [
    { id: 0, x: 0, z: 30, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
    { id: 21, x: zx, z: zz, rumo: Math.PI, time: 1, papel: 'parado', posicao: 'ZAG' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: c.attr },
  ];
  const m = criarMundo({ semente: c.sem, jogadores: jog, bola: { x: bx, z: bz }, posse: null });
  for (let i = 0; i < 120; i++) passo(m, {});
  const g = jogadorPorId(m, 20), z = jogadorPorId(m, 21);
  z.x = zx; z.z = zz; z.vx = 0; z.vz = 0;
  lancar(m.bola, bx, bz, c.zA, c.yA, c.v, 0);
  m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
  const b = m.bola, P = new Float32Array(NJ * 3), P0 = new Float32Array(NJ * 3);
  const r = { desviou: false, noAlvo: false, res: null, maoContato: null, salto: 0 };
  pose(g, m, P);
  for (let i = 0; i < 200; i++) {
    const preB = { x: b.p.x, y: b.p.y, z: b.p.z }, vB = Math.hypot(b.v.x, b.v.y, b.v.z) * PASSO;
    P0.set(P);
    passo(m, {});
    pose(g, m, P);
    if (m.posse != null && m.posse !== 20) return null; // o zagueiro dominou: não houve chute desviado
    if (r.desviou && !r.res) r.salto = Math.max(r.salto, Math.hypot(b.p.x - preB.x, b.p.y - preB.y, b.p.z - preB.z) - vB);
    for (const e of m.eventos) {
      if (e.tipo === 'bateuCorpo' && e.id === 21 && !r.desviou) {
        r.desviou = true;
        const lin = preverLinha(b);
        r.noAlvo = !!lin && Math.abs(lin.z) < MEIO && lin.y < ALT;
      }
      if (!r.desviou || r.res) continue;
      if (e.tipo === 'gol') r.res = 'gol';
      if (e.tipo === 'defesa') {
        r.res = e.modo;
        let dm = Infinity;
        for (const PP of [P0, P]) for (const kk of [J.maoE, J.maoD]) dm = Math.min(dm, Math.hypot(PP[kk * 3] - preB.x, PP[kk * 3 + 1] - preB.y, PP[kk * 3 + 2] - preB.z));
        r.maoContato = dm;
        r.tipo = g.mergulho ? `${g.mergulho.tipo}${g.mergulho.rebote ? ' (relido)' : ''}` : '-';
        r.dBola = Math.hypot(preB.x - g.x, preB.z - g.z);
      }
    }
    if (r.desviou && !r.res && (b.p.x > GX + 0.3 || Math.hypot(b.v.x, b.v.z) < 1)) r.res = 'fora';
    if (r.res) break;
  }
  return r.desviou ? r : null;
}
/** Onde a bola (física pura) cruza a linha do gol: {z, y} ou null. */
function preverLinha(b0) {
  const c = copiarBola(b0);
  for (let i = 0; i < 200; i++) {
    const x0 = c.p.x, y0 = c.p.y, z0 = c.p.z;
    passoBola(c, null);
    if (c.p.x >= GX) { const f = (GX - x0) / ((c.p.x - x0) || 1e-9); return { z: z0 + (c.p.z - z0) * f, y: y0 + (c.p.y - y0) * f }; }
    if (Math.hypot(c.v.x, c.v.z) < 0.5 || c.v.x < 0) return null;
  }
  return null;
}

const ATTR2 = [{ reflexo: 72, posicionamento: 72, mergulho: 72 }, { reflexo: 86, posicionamento: 84, mergulho: 86 }];
const casos = [];
let sem = 1;
for (const attr of ATTR2) {
  for (const d of [9, 14, 20, 26]) for (const ang of [-28, 0, 28]) for (const lat of [0.5, 1.2, 1.8, 2.4, 3.0]) for (const y of [0.25, 0.8, 1.4, 2.0]) {
    const k = sem++;
    casos.push({ attr, d, ang, lat, y, lado: k % 2 ? 1 : -1, v: 18 + (k % 4) * 3, sem: 7000 + k });
  }
}
const res = [];
for (const c of casos) { const r = casoGrade(c); if (r) res.push({ c, r }); }

// B: o mesmo gerador da contraprova (cp-goleiro.mjs), para as metas valerem fora da grade
const rnd = gerador(4242);
const ATTR3 = [{ reflexo: 60, posicionamento: 60, mergulho: 60 }, { reflexo: 75, posicionamento: 75, mergulho: 75 }, { reflexo: 90, posicionamento: 88, mergulho: 90 }];
const casosB = [];
for (let k = 0; k < 900; k++) {
  const d = 6 + rnd() * 24;
  const ang = (rnd() * 2 - 1) * (d < 12 ? 60 : 45);
  const zA = (rnd() * 2 - 1) * (MEIO - 0.25);
  const yA = 0.1 + rnd() * (ALT - 0.25);
  const v = 14 + rnd() * 16;
  const wy = rnd() < 0.3 ? (rnd() * 2 - 1) * 12 : 0;
  casosB.push({ d, ang, zA, yA, v, wy, attr: ATTR3[k % 3], sem: 9000 + k });
}
for (let k = 0; k < 150; k++) {
  const d = 10 + rnd() * 12, ang = (rnd() * 2 - 1) * 30, zA = (rnd() * 2 - 1) * 2.8;
  casosB.push({ d, ang, zA, yA: 0.3 + rnd() * 1.2, v: 20 + rnd() * 6, wy: 0, attr: ATTR3[k % 3], sem: 12000 + k, rebote: { atraso: Math.round((0.25 + rnd() * 0.45) / PASSO), d: 7 + rnd() * 4, z0: (rnd() * 2 - 1) * 6, zA: -Math.sign(zA || 1) * (1.5 + rnd() * 1.6) } });
}
const resB = casosB.map(c => ({ c, r: casoVariado(c) }));

// C: rebote disputado
const casosC = [];
let semC = 1;
for (const attr of ATTR2) for (const d of [11, 15, 19, 23]) for (const ang of [-25, -10, 0, 10, 25]) for (const zA of [-3, -2, -1.2, 1.2, 2, 3]) for (const yA of [0.3, 0.9, 1.5]) {
  const k = semC++;
  casosC.push({ attr, d, ang, zA, yA, v: 19 + (k % 3) * 3, sem: 15000 + k });
}
const resC = casosC.map(c => casoDisputa(c)).filter(Boolean);

// E: chute desviado
const casosE = [];
let semE = 1;
for (const attr of ATTR2) for (const d of [14, 18, 22]) for (const ang of [-20, 0, 20]) for (const dDef of [5, 7, 9]) for (const off of [-0.22, -0.1, 0.1, 0.22]) for (const zA of [-2, 0, 2]) {
  const kk = semE++;
  casosE.push({ attr, d, ang, dDef, off, zA, yA: 0.25 + (kk % 3) * 0.15, v: 19 + (kk % 3) * 3, sem: 18000 + kk });
}
const resE = casosE.map(c => casoDesvio(c)).filter(Boolean);

// ------------------------------------------------------------------ resultados
const noAlvo = res.filter(x => x.r.res === 'gol' || x.r.res === 'encaixe' || x.r.res === 'espalmada');
const longe = noAlvo.filter(x => x.r.latCorpo != null && x.r.latCorpo > 1.0);
const comMergulho = longe.filter(x => x.r.mergulho);
const defesas = noAlvo.filter(x => x.r.res === 'encaixe' || x.r.res === 'espalmada');
const maoOk = defesas.filter(x => x.r.maoContato != null && x.r.maoContato <= 0.25);
const esp = defesas.filter(x => x.r.res === 'espalmada');
const perigo = esp.filter(x => x.r.destino && !x.r.destino.fora && GX - x.r.destino.x < 11 && Math.abs(x.r.destino.z) < 9);
const durs = res.map(x => x.r.dur).filter(v => v != null);
const pat = [...res, ...resB].reduce((a, x) => ({ plantado: Math.max(a.plantado, x.r.pat.plantado), razao: Math.max(a.razao, x.r.pat.razao), pouso: Math.max(a.pouso, x.r.pat.pouso) }), { plantado: 0, razao: 0, pouso: 0 });

const prim = resB.filter(x => !x.c.rebote);
const defB = prim.filter(x => x.r.res === 'encaixe' || x.r.res === 'espalmada');
const maoOkB = defB.filter(x => x.r.maoContato != null && x.r.maoContato <= 0.25);
const espB = defB.filter(x => x.r.res === 'espalmada');
const jogB = espB.filter(x => x.r.jogavel);
const espTodas = [...esp, ...espB];
const reag = espTodas.filter(x => x.r.reagarrou);
const altos = prim.filter(x => ['gol', 'encaixe', 'espalmada'].includes(x.r.res) && x.c.yA > 1.9 && x.r.latCorpo != null && x.r.latCorpo < 0.8 && !x.r.recuo);
const altosSalto = altos.filter(x => x.r.voou && x.r.maoAcima);
const vCentro = Math.max(...resB.map(x => x.r.vCentro), ...res.map(x => x.r.vCentro));
const vPelve = Math.max(...resB.map(x => x.r.vPelve), ...res.map(x => x.r.vPelve));
const xMax = Math.max(...resB.map(x => x.r.xMax), ...res.map(x => x.r.xMax));
const giro = Math.max(...resB.map(x => x.r.giroTronco), ...res.map(x => x.r.giroTronco));
const giroReb = Math.max(0, ...resB.filter(x => x.c.rebote).map(x => x.r.giroTronco));
const atk = resC.filter(x => x.primeiro === 'ataque');
const defE = resE.filter(x => x.res === 'encaixe' || x.res === 'espalmada');
const maoOkE = defE.filter(x => x.maoContato != null && x.maoContato <= 0.25);
const saltoE = Math.max(0, ...resE.map(x => x.salto));
const alvoE = resE.filter(x => x.noAlvo);

console.log(`Goleiro (lógica de ${path.relative(process.cwd(), JS) || '.'}):`);
console.log(`  A. grade: ${res.length} chutes, ${noAlvo.length} no alvo (${defesas.length} defesas: ${defesas.filter(x => x.r.res === 'encaixe').length} encaixes, ${esp.length} espalmadas)`);
console.log(`  B. variado: ${prim.length} chutes, ${defB.length} defesas (${espB.length} espalmadas, ${defB.filter(x => x.r.recuo).length} pela cavadinha); ${resB.length - prim.length} rebotes`);
console.log(`  C. disputa: ${resC.length} espalmadas — primeiro na bola: ${['ataque', 'defesa', 'fora', 'gol', 'ninguém'].map(k => `${k} ${resC.filter(x => x.primeiro === k).length}`).join(', ')}`);
console.log(`  E. desvio: ${resE.length} chutes desviados no zagueiro (${alvoE.length} ainda no alvo: ${alvoE.filter(x => x.res === 'gol').length} gols, ${alvoE.filter(x => x.res === 'encaixe' || x.res === 'espalmada').length} defesas depois de reler); ${defE.length} defesas no total`);
const porAltura = [['bola no plano', 'no alvo a > 1 m (0,5 s antes)', 'com mergulho', 'defesas', 'mão ≤ 0,25 m']];
for (const y of [0.25, 0.8, 1.4, 2.0]) {
  const l = longe.filter(x => x.c.y === y), dd = defesas.filter(x => x.c.y === y);
  porAltura.push([`${fmt(y, 2)} m`, l.length, `${l.filter(x => x.r.mergulho).length}`, dd.length, `${dd.filter(x => x.r.maoContato <= 0.25).length}`]);
}
console.log(tabelaTexto(porAltura));
if (detalhe) {
  for (const x of longe.filter(x => !x.r.mergulho).slice(0, 20)) console.log(`  sem mergulho: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y} v ${x.c.v}: ${x.r.res}, a ${fmt(x.r.latCorpo, 2)} m, voou ${x.r.voou}, inclinou ${fmt(x.r.inclinou, 0)}°`);
  for (const x of [...defesas, ...defB].filter(x => !(x.r.maoContato <= 0.25)).slice(0, 20)) console.log(`  mão longe: d ${fmt(x.c.d, 1)} ang ${fmt(x.c.ang, 0)} ${x.c.y != null ? `y ${x.c.y}` : `yA ${fmt(x.c.yA, 2)}`}: ${x.r.res}${x.r.recuo ? ' (cavadinha)' : ''}, mão a ${fmt(x.r.maoContato, 2)} m`);
  for (const x of jogB.slice(0, 12)) console.log(`  espalmada jogável: d ${fmt(x.c.d, 1)} ang ${fmt(x.c.ang, 0)} zA ${fmt(x.c.zA, 2)} yA ${fmt(x.c.yA, 2)}: (${fmt(x.r.jogavel.x, 1)}, ${fmt(x.r.jogavel.z, 1)}) aos ${fmt(x.r.jogavel.t, 2)} s`);
  for (const x of resE.filter(x => x.maoContato != null && x.maoContato > 0.25)) console.log(`  desvio, mão longe: ${x.res} (${x.tipo}), mão a ${fmt(x.maoContato, 2)} m, bola a ${fmt(x.dBola, 2)} m do centro`);
  for (const x of resB.filter(x => x.r.vCentro > 5.5 || x.r.vPelve > 7.5 || x.r.giroTronco > 20).slice(0, 12)) console.log(`  corpo rápido: d ${fmt(x.c.d, 1)} ang ${fmt(x.c.ang, 0)}${x.c.rebote ? ' (rebote)' : ''}: centro ${fmt(x.r.vCentro, 1)} m/s, pelve ${fmt(x.r.vPelve, 1)} m/s, tronco ${fmt(x.r.giroTronco, 0)}°/quadro`);
}
const pc = (a, b) => `${fmt((100 * a) / Math.max(1, b), 1)}% (${a}/${b})`;
const metas = [
  ['A1. chute no alvo a > 1 m do goleiro (0,5 s antes): mergulho desenhado (pés fora do chão e tronco > 45°)', longe.length > 0 && comMergulho.length === longe.length, pc(comMergulho.length, longe.length), '100%'],
  ['A2. nas defesas, a mão a ≤ 0,25 m da bola no contato', defesas.length > 0 && maoOk.length / defesas.length >= 0.95, pc(maoOk.length, defesas.length), '≥ 95%'],
  ['A3. espalmadas que morrem na zona perigosa (< 11 m da linha, |z| < 9 m)', esp.length >= 10 && perigo.length / esp.length <= 0.10, pc(perigo.length, esp.length), '≤ 10%'],
  ['A4. pé do goleiro plantado não anda (mergulho e levantar)', pat.plantado <= 0.05, `${fmt(pat.plantado, 3)} m/s`, '≤ 0,05 m/s'],
  ['A4. pé do goleiro não salta: desloc. por quadro / (2,5·v + 3)·dt (v ≤ 6 m/s)', pat.razao <= 1, fmt(pat.razao, 2), '≤ 1'],
  ['A4. pouso do pé do goleiro / (0,19·v + 0,81 m/s) (v ≤ 6 m/s)', pat.pouso <= 1, fmt(pat.pouso, 2), '≤ 1'],
  ['B5. canhão variado + cavadinha: nas defesas, a mão a ≤ 0,25 m da bola no contato', defB.length > 0 && maoOkB.length / defB.length >= 0.95, pc(maoOkB.length, defB.length), '≥ 95%'],
  ['B6. centro do corpo do goleiro (máx. em todos os lances)', vCentro <= 5.5, `${fmt(vCentro, 1)} m/s`, '≤ 5,5 m/s'],
  ['B6. pelve desenhada (máx.)', vPelve <= 7.5, `${fmt(vPelve, 1)} m/s`, '≤ 7,5 m/s'],
  ['B7. o centro do goleiro nunca passa da linha do gol', xMax <= GX, `x máx ${fmt(xMax, 2)} (linha ${GX})`, `≤ ${GX}`],
  ['B8. o tronco gira por quadro (máx.; no rebote com o goleiro no chão)', giro <= 20, `${fmt(giro, 0)}° (rebote ${fmt(giroReb, 0)}°)`, '≤ 20°'],
  ['B9. espalmadas jogáveis na zona (< 1,5 m e < 7 m/s, < 11 m da linha, |z| < 9, em 2 s)', espB.length >= 10 && jogB.length / espB.length <= 0.10, pc(jogB.length, espB.length), '≤ 10%'],
  ['B11. a espalmada volta para as mãos dele em ≤ 0,5 s (vira encaixe; grade A + canhão B)', espTodas.length >= 50 && reag.length / espTodas.length <= 0.02, pc(reag.length, espTodas.length), '≤ 2%'],
  ['B10. bola alta (> 1,9 m) perto do corpo (< 0,8 m): salto com as duas mãos acima da cabeça', altos.length >= 5 && altosSalto.length / altos.length >= 0.8, pc(altosSalto.length, altos.length), '≥ 80%'],
  ['C11. rebote disputado: o ataque toca primeiro na bola espalmada', resC.length >= 40 && atk.length / resC.length <= 0.10, pc(atk.length, resC.length), '≤ 10%'],
  ['E12. chute desviado num corpo depois da leitura: nas defesas, a mão a ≤ 0,25 m da bola', resE.length >= 40 && (defE.length === 0 || maoOkE.length / defE.length >= 0.95), pc(maoOkE.length, defE.length), '≥ 95%'],
  ['E13. chute desviado: a bola nunca salta num quadro (além do que ela anda)', resE.length >= 40 && saltoE <= 0.3, `${fmt(saltoE, 2)} m`, '≤ 0,3 m'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[2], x[3], x[1] ? 'PASSOU' : 'REPROVOU'])]));
if (durs.length) console.log(`\nmergulho, do contato até de pé (informação): mediana ${fmt(percentil(durs, 0.5), 2)} s, p10 ${fmt(percentil(durs, 0.1), 2)} s, p90 ${fmt(percentil(durs, 0.9), 2)} s`);
const ok = metas.every(x => x[1]);
console.log(ok ? '\nteste-mergulho: PASSOU' : '\nteste-mergulho: REPROVOU');
process.exit(ok ? 0 : 1);
