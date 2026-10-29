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
//  H. bola alta na PARTIDA (C3, item 14 da FILA; pedido do dono de 17/10: "o goleiro ESPALMA bola alta"): 480 chutes de uma
//     partida de verdade copiada (os outros 20 longe, 1 s para o goleiro realista se arrumar), metade mirada na linha do
//     gol (com o goleiro adiantado, a bola por cima dele) e metade no plano dele (o mergulho), que chegam a ≥ 1,9 m e a ≥ 1,2 m
//     de lado dele na leitura. StatsBomb open data, 728 partidas, medido aqui (PESQUISA-ETAPA4.md §14): nas defesas de
//     MERGULHO dessa bola, encaixe 2,3% (1/44), uma mão 61,4%, para fora 79,1% das não seguras; com o goleiro a ≥ 2 m da
//     linha (a bola por cima dele), encaixe 14,9% (14/94):
//    H1. no mergulho, espalmada (não encaixe nem "pegou") ≥ 85%; H1b. por cima do goleiro adiantado, seguras ≤ 30% (a main:
//        36,7% — a conta do treino, 0,6, e o "pegou" da mão desenhada por cima da espalmada sorteada);
//    H2. nas espalmadas, UMA mão — a de cima, a do ombro mais alto — na bola (≤ 0,25 m), acima da cabeça, e a outra a > 0,35 m
//        dela: ≥ 80% (a main: 2,7% — as duas palmas sempre na bola);
//    H3. as espalmadas (sem o rebote) saem do campo em 3 s (por cima do travessão, pela linha de fundo): ≥ 90%;
//    H4. com o rebote (a bola que escapa e cai perto, GOLEIRO.realista.rebote): para fora em 65–95% (real 79,1%, IC 65–89%);
//    H5. a bola com a defesa já sorteada para espalmar (ou batido), fora do corpo, não vira "pegou" — a mão desenhada que
//        passa perto dela antes do contato (sim.js bolaLivre) — em nenhum chute da seção (a main: 21 de 370; a espalmada
//        da StatsBomb não vira encaixe).
//  I. nada atravessa o goleiro e o goleiro atrás da bola, na PARTIDA (pendências do C1 e do C2), pelo corpo DESENHADO (o
//     manequim da pose, entre o miolo e a casca; ver a seção I abaixo):
//    I1. a bola a 0,95–1,9 m no corpo do goleiro FORA da área (sem a mão, solto no lance): a. não bate no ar (a > 5 cm do corpo
//        desenhado); b. sem bater, não entra > 2 cm nele;
//    I2. a saída no cruzamento que falha (450 lances: o sorteio forçado a errar, a natural e a mão forçada a não chegar): a bola
//        nunca entra no corpo desenhado do pulo nem bate nele no ar (a saída que encaixa, soca ou "pega" com a mão do pulo deu
//        certo); com a mão que não chega, ≥ 20 saídas e ≥ 10 batidas no corpo do pulo (sem elas, a mutação M5 passava);
//    I3. o goleiro atrás da bola (a 18–45 m dela, ela indo para o gol vazio): nunca "defende" longe dela (a main: 4/120).
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
const { pose, J, NJ, SEGMENTOS, RAIO_CABECA: RAIO_CAB } = await imp('anim.js');
const { copiarBola, passoBola, criarBola, chutar } = await imp('bola.js');
const P = await imp('partida.js');
const GK = await imp('goleiro.js');
const RG = await imp('regras-goleiro.js');
const { GOLEIRO } = await imp('config.js');
const { criarRng } = await imp('rng.js');
const { parametros } = await imp('jogador.js');
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

// ------------------------------------------------------------------ H e I: na PARTIDA (o goleiro realista)
// Uma partida de verdade (semente 5, a bola rolando no 1º tempo), copiada para cada lance: os outros 20 longe, o atacante e o
// goleiro (os atributos por terço) no lance. A bola sai pela física do jogo (bola.js) mirando um ponto do plano dado.
const base = (() => {
  const m = P.criarPartida({ semente: 5, minutosPorTempo: 60 });
  for (let i = 0; i < 900 && !(m.partida.estado === 'jogo' && !m.parada && i > 300); i++) P.passoPartida(m, P.entradaDemoPartida(m));
  if (m.partida.estado !== 'jogo' || m.parada || m.ataca[0] !== 1) throw new Error('partida base fora de jogo');
  return m;
})();
const GKP = [{ reflexo: 62, posicionamento: 62, mergulho: 62 }, { reflexo: 75, posicionamento: 74, mergulho: 75 }, { reflexo: 88, posicionamento: 86, mergulho: 88 }];
/** Cópia da partida para um lance: a, g (goleiro do time 1, que defende x = +GX) e o passo. */
function lancePartida(sem, attr) {
  const m = structuredClone(base);
  m.rng = criarRng(sem); m.humanos = [];
  m.voo = null; m.naMao = null; m.posse = null; m.ultimoToque = null; m.desvio = -1;
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
  for (const j of m.jogadores) { j.defesa = null; j.mergulho = null; j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; j.saindo = false; }
  const a = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA');
  const g = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
  g.par = parametros(attr);
  let q = 0;
  for (const o of m.jogadores) {
    if (o === a || o === g) continue;
    if (o.posicao === 'GOL') { P.teleportar(o, -GX + 1.2, 0, 0); continue; }
    P.teleportar(o, -20 - (q % 4) * 6, -24 + (q % 9) * 6, o.time === 0 ? 0 : Math.PI); q++;
  }
  return { m, a, g, passo: () => P.passoPartida(m, P.entradaDemoPartida(m)) };
}
/** Põe a bola parada em (bx, bz), o atacante atrás dela, e (com `prep`) o goleiro se arruma `prep` passos. */
function bolaNoPe(L, bx, bz, prep) {
  const { m, a } = L, rumo = Math.atan2(-bz, GX - bx);
  P.teleportar(a, bx - Math.cos(rumo) * 0.4, bz - Math.sin(rumo) * 0.4, rumo);
  Object.assign(m.bola.p, { x: bx, y: 0.11, z: bz }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 }); Object.assign(m.bola.w, { x: 0, y: 0, z: 0 });
  m.bola.rolando = true; m.posse = a.id;
  const papel = a.papel; a.papel = 'parado';
  for (let i = 0; i < prep; i++) L.passo();
  a.papel = papel;
  return m.posse === a.id && m.partida.estado === 'jogo' && !m.parada;
}
/** O chute do atacante (ou o cruzamento: `tipo`): a bola passa no plano x = xP em (zP, yP), a v m/s (física do jogo). */
function chutePara(L, xP, zP, yP, v, tipo = 'chute') {
  const { m, a } = L, b = m.bola;
  const dx = xP - b.p.x, dz = zP - b.p.z, dh = Math.hypot(dx, dz), ux = dx / dh, uz = dz / dh;
  const yEm = el => { const t = criarBola(b.p.x, b.p.z); t.p.y = b.p.y; chutar(t, { x: ux * v * Math.cos(el), y: v * Math.sin(el), z: uz * v * Math.cos(el) }, { x: 0, y: 0, z: 0 }); t.rolando = false; const c = GK.preverPassagem(t, xP, 240); return c ? c.y : -1; };
  let lo = -0.05, hi = 0.9;
  for (let n = 0; n < 30; n++) { const mid = (lo + hi) / 2; if (yEm(mid) < yP) lo = mid; else hi = mid; }
  const el = (lo + hi) / 2;
  m.posse = null; m.naMao = null;
  chutar(b, { x: ux * v * Math.cos(el), y: v * Math.sin(el), z: uz * v * Math.cos(el) }, { x: 0, y: 0, z: 0 }); b.rolando = false;
  if (a.cond) { a.cond.toque = null; a.cond.busca = false; }
  a.pedido = null; a.carga = null;
  m.ultimoToque = { id: a.id, time: a.time, tick: m.tick };
  if (tipo === 'chute') RG.registrarChute(m, a, 'chute');
  m.voo = { tipo, de: a.id, time: a.time, para: null, alvo: { x: GX, z: zP }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick, alto: b.v.y > 1.5 };
}
const maoNaPose = (PP, bp) => {
  const d = k => Math.hypot(PP[k * 3] - bp.x, PP[k * 3 + 1] - bp.y, PP[k * 3 + 2] - bp.z);
  const dE = d(J.maoE), dD = d(J.maoD), k = dE <= dD ? J.maoE : J.maoD;
  return { perto: Math.min(dE, dD), outra: Math.max(dE, dD), k, acima: PP[k * 3 + 1] > PP[J.cabeca * 3 + 1] };
};

// H. bola alta (pedido do dono, 17/10: "o goleiro ESPALMA bola alta"): chutes que chegam ao plano do goleiro realista (1 s
// para ele se arrumar, com o atacante parado com a bola) a ≥ 1,9 m de altura e ≥ 1,2 m de lado dele na leitura
function casoAlta(k) {
  const r = gerador(31000 + k);
  const d = 10 + 18 * r(), ang = (r() * 2 - 1) * 0.55;
  const L = lancePartida(31000 + k, GKP[k % 3]);
  const { m, g } = L;
  if (!bolaNoPe(L, GX - d * Math.cos(ang), d * Math.sin(ang), 60)) return null;
  const lado = r() < 0.5 ? -1 : 1, lat = 1.25 + 1.4 * r();
  // (metade mirada na linha do gol — com o goleiro adiantado, a bola por cima dele — e metade no plano dele: o mergulho)
  if (k % 2) chutePara(L, GX, Math.max(-MEIO + 0.2, Math.min(MEIO - 0.2, g.z + lado * lat * (GX - m.bola.p.x) / Math.max(1, g.x - m.bola.p.x))), 1.95 + 0.4 * r(), 14 + 12 * r());
  else chutePara(L, g.x, g.z + lado * lat, 1.95 + 0.4 * r(), 14 + 12 * r());
  const res = { lido: null, res: null, modo: null, rebote: false, fora: null, mao: null, cima: null, tipo: null };
  const bp = { x: 0, y: 0, z: 0 };
  const P1 = new Float32Array(NJ * 3), P2 = new Float32Array(NJ * 3);
  pose(g, m, P1);
  for (let i = 0; i < 300; i++) {
    bp.x = m.bola.p.x; bp.y = m.bola.p.y; bp.z = m.bola.p.z;
    P2.set(P1);
    // (a defesa já sorteada — espalmada ou batido — para esta bola e ainda por vir, fora do corpo: H5)
    const d0 = g.defesa, t0 = m.tick;
    const sorteada = !!d0 && !d0.fora && !d0.corpo && d0.tipo !== 'encaixe' && !!m.voo && d0.chave === m.voo.tickChave && t0 < d0.tick;
    const ev = L.passo();
    if (sorteada && ev.some(e => e.tipo === 'defesa' && e.id === g.id && e.modo === 'pegou')) res.pegouSorteada = true;
    pose(g, m, P1);
    const dd = g.defesa;
    if (!res.lido && dd && dd.lido === m.tick - 1) res.lido = dd.fora ? { fora: true } : { y: dd.y, lat: Math.abs(dd.z - g.z), recuo: !!dd.recuo };
    for (const e of ev) {
      if (res.res) continue;
      if (e.tipo === 'gol') res.res = 'gol';
      if (e.tipo === 'defesa' && e.id === g.id) {
        res.res = 'defesa'; res.modo = e.modo; res.rebote = !!e.rebote; res.tick = m.tick;
        const gm = g.mergulho; res.tipo = gm ? gm.tipo : '-';
        const a0 = maoNaPose(P2, bp), a1 = maoNaPose(P1, bp);
        res.mao = a0.perto <= a1.perto ? a0 : a1;
        // a mão de cima: a do ombro mais alto no contato
        const PP = a0.perto <= a1.perto ? P2 : P1;
        res.cima = PP[J.ombroE * 3 + 1] >= PP[J.ombroD * 3 + 1] ? J.maoE : J.maoD;
      }
    }
    if (res.res === 'defesa' && res.modo === 'espalmada' && res.fora == null) {
      const b = m.bola.p;
      if (b.x > GX || Math.abs(b.z) > CAMPO.meioZ || (m.parada && !m.parada.rolou)) res.fora = true;
      else if (m.tick - res.tick > 180 || m.posse != null || m.naMao != null) res.fora = false;
    }
    if (!res.res && (m.bola.p.x > GX + 0.5 || Math.hypot(m.bola.v.x, m.bola.v.z) < 0.5)) res.res = 'fora';
    if (res.res && (res.res !== 'defesa' || res.modo !== 'espalmada' || res.fora != null)) break;
  }
  return res;
}
const resAltaTodos = Array.from({ length: 480 }, (_, k) => casoAlta(k)).filter(Boolean);
const resH = resAltaTodos.filter(x => x.lido && !x.lido.fora && x.lido.y >= 1.9 && x.lido.lat >= 1.2);
// (H5: em todos os chutes da seção, lidos no gol — não só os da bola alta)
const pegH = resAltaTodos.filter(x => x.pegouSorteada);
const defH = resH.filter(x => x.res === 'defesa');
const espH = defH.filter(x => x.modo === 'espalmada'), espHp = espH.filter(x => !x.rebote);
const umaH = espH.filter(x => x.mao && x.mao.perto <= 0.25 && x.mao.acima && x.mao.k === x.cima && x.mao.outra > 0.35);
const recH = defH.filter(x => x.lido.recuo), defHm = defH.filter(x => !x.lido.recuo && x.tipo === 'mergulho');

// I. nada atravessa o goleiro e o goleiro atrás da bola (pendências do C1 e do C2):
//  I1. o goleiro FORA da área (sem a mão: lerChute `semMao`), solto no lance (a IA o move), a 17,5–35,5 m da linha: a bola a
//      0,95–1,9 m no corpo dele (tronco, ombros, cabeça; a ±0,3 m do centro), de 5–20 m — pelo corpo DESENHADO (o manequim:
//      as juntas da pose e as cápsulas do render/jogador3d.js, com dois limites que não dependem da conta da simulação: o
//      MIOLO, a seção com o menor semieixo e a cabeça com 0,92 do raio, sempre dentro do desenho; a CASCA, o maior semieixo e a
//      cabeça com o cabelo, 1,24 do raio, sempre fora dele), com a bola acima de 0,9 m (abaixo: as pernas de todo jogador,
//      sim.js colisaoBolaCorpo, informativo): a. no passo em que bate nele, o caminho da bola chega a ≤ 5 cm da CASCA (nada
//      bate no ar; a revisão de 29/10 achou 38 de 250 batidas a > 5 cm, até 32 cm, com o cilindro de antes); b. sem bater,
//      ela nunca entra mais de 2 cm no MIOLO (o caminho do passo em pedaços de 2 cm, na pose do começo e na do fim) — fora os
//      3 passos antes de ele dominar ou pegar a bola (a recepção no peito de todo jogador, sim.js bolaAltaNoCorpo, leva a
//      bola do peito ao pé: contada à parte, informativo);
//  I2. a saída no cruzamento que FALHA (o sorteio forçado a errar — cruz.p = 0 —, a natural e a mão que não chega — cruz.mao
//      forçado a 2 cm: o pulo vai à bola e a mão desenhada não a "toca", saidaFalhou {longe}, e a bola segue pela mão, pelo
//      braço ou pela cabeça do pulo; sem esse grupo, tirar a colisão da saída cuja mão não chega — a mutação M5 da revisão de
//      29/10 — não reprovava nada): pelo mesmo corpo desenhado (a pose do pulo), a bola não entra no miolo sem bater nele e
//      não bate no ar; no grupo da mão, ≥ 20 saídas, ≥ 10 batidas no corpo do pulo, e a entrada no miolo contada DEPOIS do
//      passo em que a mão não chegou (no passo antes do contato a mão desenhada já encosta na bola: é o encontro da defesa
//      viva, a mesma de quando ele pega);
//  I3. o goleiro ATRÁS da bola (driblado, a 18–45 m dela, ela indo para o gol vazio): nenhuma "defesa" dele longe da bola
//      (a mais de 1,5 m do corpo no toque) — na main ele "espalmava" pela linha do gol medindo só o lado.
const RBOLA = 0.11, TOL = 0.02, NO_AR = 0.05;
// a forma do desenho (render/jogador3d.js estilo/estiloGoleiro e a cabeça; a mesma em todas as versões medidas): [achatamento,
// raios] por segmento quando diferem de SEGMENTOS; o goleiro com a luva no antebraço
const FORMA_D = { 'pelve-lombar': [0.74, [0.118, 0.13]], 'lombar-peito': [0.68], 'peito-pescoco': [0.78], 'ombroE-ombroD': [0.85], 'quadrilE-quadrilD': [0.84, [0.088, 0.088]], 'tornozeloE-pontaE': [0.8], 'tornozeloD-pontaD': [0.8], 'cotoveloE-maoE': [1, [0.046, 0.05]], 'cotoveloD-maoD': [1, [0.046, 0.05]] };
const NOME_J = Object.keys(J).sort((x, y) => J[x] - J[y]);
const SEGS_D = SEGMENTOS.map(([a, b, ra, rb]) => { const f = FORMA_D[`${NOME_J[a]}-${NOME_J[b]}`] ?? [1]; const r = f[1] ?? [ra, rb]; return [a, b, r[0], r[1], f[0]]; });
/** Folga da superfície da bola (centro em x, y, z) à do limite do corpo da pose PP (negativa = dentro): o miolo ou a casca. */
function folgaCorpo(PP, x, y, z, miolo) {
  let d = Infinity;
  for (const [a, b, rA, rB, ach] of SEGS_D) {
    const ax = PP[a * 3], ay = PP[a * 3 + 1], az = PP[a * 3 + 2], vx = PP[b * 3] - ax, vy = PP[b * 3 + 1] - ay, vz = PP[b * 3 + 2] - az;
    const L2 = vx * vx + vy * vy + vz * vz, t = L2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy + (z - az) * vz) / L2)) : 0;
    const r = (rA + (rB - rA) * t) * (miolo ? ach : 1);
    d = Math.min(d, Math.hypot(x - ax - vx * t, y - ay - vy * t, z - az - vz * t) - r - RBOLA);
  }
  const k = J.cabeca * 3;
  return Math.min(d, Math.hypot(x - PP[k], y - PP[k + 1], z - PP[k + 2]) - RAIO_CAB * (miolo ? 0.92 : 1.24) - RBOLA);
}
/** O menor valor de f no caminho (x0, y0, z0) → (x1, y1, z1), em pedaços de 2 cm, só acima de yMin (longe do corpo: ∞). */
let PERTO = null;
function minCaminho(x0, y0, z0, x1, y1, z1, f, yMin = 0.9) {
  if (PERTO) {
    // (a 2,5 m do quadril, nas duas poses, nenhum ponto do corpo desenhado chega: pula a conta)
    const sx = x1 - x0, sz = z1 - z0, s2 = sx * sx + sz * sz;
    let longe = true;
    for (const PP of PERTO) {
      const px = PP[J.pelve * 3], pz = PP[J.pelve * 3 + 2], t = s2 > 0 ? Math.max(0, Math.min(1, ((px - x0) * sx + (pz - z0) * sz) / s2)) : 0;
      if (Math.hypot(x0 + sx * t - px, z0 + sz * t - pz) < 2.5) longe = false;
    }
    if (longe) return Infinity;
  }
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 0.02));
  let mn = Infinity;
  for (let i = 0; i <= n; i++) { const u = i / n, y = y0 + (y1 - y0) * u; if (y > yMin) mn = Math.min(mn, f(x0 + (x1 - x0) * u, y, z0 + (z1 - z0) * u)); }
  return mn;
}
/**
 * Acompanha o lance de g por até `n` passos: em cada passo, a pose do começo (P0) e a do fim (P1). O passo em que g toca na
 * bola (bateuCorpo ou defesa): a folga mínima do caminho que ela faria nele (a velocidade do começo; a colisão a para no
 * ponto de entrada, o bloqueio a rebate de onde ela está) até a CASCA, nas duas poses — e o ponto onde ela ficou. Sem
 * tocar: a entrada no MIOLO pelo caminho de verdade. `ate(ev)` encerra.
 */
function seguirCorpo(L, g, n, ate) {
  const { m } = L, P0 = new Float32Array(NJ * 3), P1 = new Float32Array(NJ * 3);
  PERTO = [P0, P1];
  pose(g, m, P1);
  const R = { bateu: false, yBate: null, folgaBate: null, pen: 0, yPen: null, penBaixo: 0, gol: false, recepcao: 0 };
  const pens = [];
  for (let i = 0; i < n; i++) {
    const b = m.bola, x0 = b.p.x, y0 = b.p.y, z0 = b.p.z, vx = b.v.x, vy = b.v.y, vz = b.v.z;
    P0.set(P1);
    const ev = L.passo();
    pose(g, m, P1);
    if (ev.some(e => e.tipo === 'gol')) R.gol = true;
    const toque = ev.find(e => (e.tipo === 'bateuCorpo' || e.tipo === 'defesa') && e.id === g.id);
    if (toque) {
      const f = (x, y, z) => Math.min(folgaCorpo(P0, x, y, z, false), folgaCorpo(P1, x, y, z, false));
      R.bateu = true; R.yBate = y0; R.modo = toque.tipo === 'defesa' ? toque.modo : 'corpo';
      R.folgaBate = Math.min(minCaminho(x0, y0, z0, x0 + vx * PASSO, y0 + vy * PASSO, z0 + vz * PASSO, f, -1), f(b.p.x, b.p.y, b.p.z));
      break;
    }
    // (a bola que ele domina — no peito, na coxa: sim.js bolaAltaNoCorpo, a recepção de todo jogador — ou pega: os 3 passos
    // antes dela não contam; a recepção leva a bola do peito ao pé. Contados à parte em `recepcao`)
    if (m.naMao === g.id || m.posse === g.id) { R.recepcao = pens.filter(x => x.tick >= m.tick - 3 && x.pA > TOL).length; pens.splice(0, pens.length, ...pens.filter(x => x.tick < m.tick - 3)); break; }
    const fm = (x, y, z) => Math.min(folgaCorpo(P1, x, y, z, true), folgaCorpo(P0, x, y, z, true));
    const pA = -minCaminho(x0, y0, z0, b.p.x, b.p.y, b.p.z, fm), pB = -minCaminho(x0, y0, z0, b.p.x, b.p.y, b.p.z, fm, -1);
    pens.push({ tick: m.tick, pA, pB, y0 });
    if (ate(ev)) break;
  }
  for (const x of pens) {
    if (x.pA > R.pen) { R.pen = x.pA; R.yPen = x.y0; R.tick = x.tick; }
    if (x.pB > R.penBaixo) R.penBaixo = x.pB;
  }
  return R;
}
function casoForaArea(k) {
  const r = gerador(33000 + k);
  const L = lancePartida(33000 + k, GKP[k % 3]);
  const { m, g } = L;
  const gxk = GX - 17.5 - 18 * r(), gzk = (r() * 2 - 1) * 14, d = 5 + 15 * r(), ang = (r() * 2 - 1) * 0.8;
  const bx = gxk - d * Math.cos(ang), bz = gzk + d * Math.sin(ang);
  P.teleportar(g, gxk, gzk, Math.atan2(bz - gzk, bx - gxk));
  if (!bolaNoPe(L, bx, bz, 2)) return null;
  P.teleportar(g, gxk, gzk, Math.atan2(bz - gzk, bx - gxk));
  chutePara(L, gxk, gzk + (r() * 2 - 1) * 0.3, 0.95 + 0.95 * r(), 10 + 18 * r());
  const R = seguirCorpo(L, g, 120, () => m.bola.p.x > g.x + 3 || m.posse != null || m.naMao != null || (m.parada && !m.parada.rolou));
  return { ...R, semMao: !!(g.defesa && g.defesa.semMao), k };
}
const resI1 = Array.from({ length: 600 }, (_, k) => casoForaArea(k)).filter(Boolean);
function casoSaidaFalha(k, pZero, maoLonge = false) {
  const r = gerador(34000 + k);
  const L = lancePartida(34000 + k, GKP[k % 3]);
  const { m, g } = L;
  const lado = k % 2 ? 1 : -1;
  if (!bolaNoPe(L, GX - 3 - 6 * r(), lado * (16 + 8 * r()), 40)) return null;
  const C = GOLEIRO.realista.cruz, p0 = C.p, mao0 = C.mao;
  if (pZero) C.p = 0;
  if (maoLonge) C.mao = 0.02;
  const xP = GX - 2.5 - 4 * r(), zP = -lado * (r() * 3 - 0.5);
  chutePara(L, xP, zP, 1.6 + 0.8 * r(), 15 + 7 * r(), 'cruzamento');
  let saiu = false, bateu = false, pulou = false, defendeu = false, quando = null, pen = 0, folgaBate = null, longe = false, jaLonge = null, penDepois = 0, quandoDepois = null;
  const P0 = new Float32Array(NJ * 3), P1 = new Float32Array(NJ * 3);
  PERTO = [P0, P1];
  pose(g, m, P1);
  try {
    for (let i = 0; i < 150; i++) {
      const b = m.bola, x0 = b.p.x, y0 = b.p.y, z0 = b.p.z, vx = b.v.x, vy = b.v.y, vz = b.v.z;
      P0.set(P1);
      const ev = L.passo();
      pose(g, m, P1);
      let toque = null;
      for (const e of ev) {
        if (e.id !== g.id) continue;
        if (e.tipo === 'saidaGoleiro' && e.modo === 'cruzamento') saiu = true;
        if (e.tipo === 'saidaFalhou' && e.longe) { longe = true; jaLonge = jaLonge ?? 'agora'; }
        // (a saída que deu certo: o encaixe ou o soco dela, ou a bola que ele pega com a mão do pulo — "pegou")
        if (e.tipo === 'defesa' && (e.saidaAlta || e.modo === 'pegou' || e.modo === 'encaixe')) defendeu = true;
        else if (e.tipo === 'bateuCorpo' || e.tipo === 'defesa') toque = e;
      }
      if (saiu && GK.mergulhoAtivo(g, m.tick)) pulou = true;
      if (defendeu) break;
      if (toque) {
        // bateu: o caminho que ela faria neste passo chega a ≤ NO_AR da casca do corpo desenhado (as duas poses)?
        const f = (x, y, z) => Math.min(folgaCorpo(P0, x, y, z, false), folgaCorpo(P1, x, y, z, false));
        bateu = true;
        folgaBate = Math.min(minCaminho(x0, y0, z0, x0 + vx * PASSO, y0 + vy * PASSO, z0 + vz * PASSO, f, -1), f(b.p.x, b.p.y, b.p.z));
        break;
      }
      if (m.posse != null || m.naMao != null) break;
      if (saiu) {
        const fm = (x, y, z) => Math.min(folgaCorpo(P1, x, y, z, true), folgaCorpo(P0, x, y, z, true));
        const p1 = -minCaminho(x0, y0, z0, b.p.x, b.p.y, b.p.z, fm, -1);
        // (a mão forçada a não chegar: conta só depois do passo em que ela não chegou — `penDepois`; sem ela não chegar — o
        // sorteio ou o desvio —, o lance todo, como nos outros grupos)
        const depois = jaLonge === true, d0 = g.defesa;
        const txt = () => `k ${k}${pZero ? ' (sorteio forçado a errar)' : maoLonge ? ' (a mão forçada a não chegar)' : ''}: tick ${m.tick}, ${fmt(100 * p1, 1)} cm no miolo, contato ${d0 && d0.tick}, lida ${d0 && d0.lido}, fora ${!!(d0 && d0.fora)}, sucesso ${d0 && d0.sucesso}, tipo ${d0 && d0.tipo}, bola a ${m.bola.p.y.toFixed(2)} m`;
        if (depois && p1 > penDepois) { penDepois = p1; quandoDepois = txt(); }
        // (segue até o fim do lance: a saída que encaixa ou soca no passo seguinte não conta — a bola chega às mãos)
        if (p1 > pen) { pen = p1; quando = txt(); }
      }
      if (jaLonge === 'agora') jaLonge = true;
      if (m.bola.p.x > GX + 0.5 || (m.parada && !m.parada.rolou)) break;
    }
  } finally { C.p = p0; C.mao = mao0; }
  // (a saída que falhou: ele pulou e não encaixou nem socou)
  return pulou && !defendeu ? { bateu, folgaBate, atravessou: (maoLonge && longe ? penDepois : pen) > TOL, pen, penDepois, quando: maoLonge && longe ? quandoDepois : quando, maoLonge, longe } : null;
}
const resI2 = [...Array.from({ length: 150 }, (_, k) => casoSaidaFalha(k, true)), ...Array.from({ length: 150 }, (_, k) => casoSaidaFalha(200 + k, false)),
  // (do grupo da mão forçada, só as saídas em que ela não chegou: as outras — o sorteio dos 7% ou o desvio — falharam pela
  // mão forçada numa bola que ele pegaria, e a bola que encosta no corpo antes do contato é a da defesa viva, a do C1)
  ...Array.from({ length: 150 }, (_, k) => casoSaidaFalha(400 + k, false, true)).filter(x => x && x.longe)].filter(Boolean);
const resI2m = resI2.filter(x => x.maoLonge && x.longe);
function casoAtras(k) {
  const r = gerador(35000 + k);
  const L = lancePartida(35000 + k, GKP[k % 3]);
  const { m, g } = L;
  const bx = GX - 22 - 18 * r(), bz = (r() * 2 - 1) * 10;
  if (!bolaNoPe(L, bx, bz, 2)) return null;
  // o goleiro driblado: atrás da bola (mais longe do gol que ela), a 18–45 m dela
  const gxk = bx - 18 - 27 * r();
  P.teleportar(g, gxk, bz + (r() * 2 - 1) * 6, 0);
  chutePara(L, GX, (r() * 2 - 1) * 3, r() < 0.5 ? 0.15 : 0.6 + 1.6 * r(), 14 + 14 * r());
  for (let i = 0; i < 300; i++) {
    const ev = L.passo();
    for (const e of ev) {
      if (e.tipo === 'defesa' && e.id === g.id) return { defesa: true, longe: Math.hypot(m.bola.p.x - g.x, m.bola.p.z - g.z) > 1.5, d: Math.hypot(m.bola.p.x - g.x, m.bola.p.z - g.z) };
      if (e.tipo === 'gol') return { defesa: false, gol: true };
    }
    if (m.bola.p.x > GX + 0.5 || (m.parada && !m.parada.rolou)) return { defesa: false };
  }
  return { defesa: false };
}
const resI3 = Array.from({ length: 120 }, (_, k) => casoAtras(k)).filter(Boolean);

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
console.log(`  H. bola alta na partida: ${resH.length} lidas a ≥ 1,9 m e ≥ 1,2 m de lado (${defH.length} defesas: ${defH.filter(x => x.modo === 'encaixe').length} encaixes, ${defH.filter(x => x.modo === 'pegou').length} "pegou", ${espH.length} espalmadas — ${espH.length - espHp.length} rebotes; ${defHm.length} no mergulho; ${recH.length} por cima do goleiro adiantado, ${recH.filter(x => x.modo !== 'espalmada').length} seguras)`);
const bI1 = resI1.filter(x => x.bateu && x.yBate > 0.9), arI1 = bI1.filter(x => x.folgaBate > NO_AR), atI1 = resI1.filter(x => x.pen > TOL);
const arI2 = resI2.filter(x => x.bateu && x.folgaBate > NO_AR);
console.log(`  I. partida: ${resI1.length} chutes no corpo do goleiro fora da área (${resI1.filter(x => x.semMao).length} sem a mão; ${bI1.length} batidas acima de 0,9 m, ${resI1.filter(x => x.bateu && x.yBate <= 0.9).length} nas pernas; ${resI1.filter(x => x.gol).length} gols; ${resI1.filter(x => x.recepcao > 0).length} recepções dele com a bola > 2 cm dentro do peito nos 3 passos antes; abaixo de 0,9 m, as pernas de todo jogador, a bola entrou > 2 cm no miolo em ${resI1.filter(x => x.penBaixo > TOL).length}), ${resI2.length} saídas no alto que falharam (${resI2m.length} com a mão forçada a não chegar, ${resI2m.filter(x => x.bateu).length} batidas no corpo do pulo), ${resI3.length} chutes com o goleiro atrás da bola (${resI3.filter(x => x.gol).length} gols)`);
console.log(tabelaTexto(porAltura));
if (detalhe) {
  for (const x of longe.filter(x => !x.r.mergulho).slice(0, 20)) console.log(`  sem mergulho: d ${x.c.d} ang ${x.c.ang} lat ${x.c.lat} y ${x.c.y} v ${x.c.v}: ${x.r.res}, a ${fmt(x.r.latCorpo, 2)} m, voou ${x.r.voou}, inclinou ${fmt(x.r.inclinou, 0)}°`);
  for (const x of [...defesas, ...defB].filter(x => !(x.r.maoContato <= 0.25)).slice(0, 20)) console.log(`  mão longe: d ${fmt(x.c.d, 1)} ang ${fmt(x.c.ang, 0)} ${x.c.y != null ? `y ${x.c.y}` : `yA ${fmt(x.c.yA, 2)}`}: ${x.r.res}${x.r.recuo ? ' (cavadinha)' : ''}, mão a ${fmt(x.r.maoContato, 2)} m`);
  for (const x of jogB.slice(0, 12)) console.log(`  espalmada jogável: d ${fmt(x.c.d, 1)} ang ${fmt(x.c.ang, 0)} zA ${fmt(x.c.zA, 2)} yA ${fmt(x.c.yA, 2)}: (${fmt(x.r.jogavel.x, 1)}, ${fmt(x.r.jogavel.z, 1)}) aos ${fmt(x.r.jogavel.t, 2)} s`);
  for (const x of resE.filter(x => x.maoContato != null && x.maoContato > 0.25)) console.log(`  desvio, mão longe: ${x.res} (${x.tipo}), mão a ${fmt(x.maoContato, 2)} m, bola a ${fmt(x.dBola, 2)} m do centro`);
  for (const x of resI2.filter(x => x.atravessou).slice(0, 12)) console.log(`  I2, a bola atravessou o pulo: ${x.quando}`);
  for (const x of arI2.slice(0, 12)) console.log(`  I2, bateu no ar: ${fmt(100 * x.folgaBate, 1)} cm do corpo desenhado`);
  for (const x of arI1.slice(0, 12)) console.log(`  I1, bateu no ar: k ${x.k}, bola a ${fmt(x.yBate, 2)} m, ${fmt(100 * x.folgaBate, 1)} cm do corpo desenhado (${x.modo})`);
  for (const x of atI1.slice(0, 12)) console.log(`  I1, a bola entrou no corpo: k ${x.k}, ${fmt(100 * x.pen, 1)} cm, bola a ${fmt(x.yPen, 2)} m`);
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
  // (StatsBomb open data, 728 partidas, medido aqui — PESQUISA-ETAPA4.md §14: nas defesas de MERGULHO da bola a ≥ 1,9 m na linha
  // e ≥ 1,2 m de lado do goleiro, encaixe 2,3% (1 de 44), uma mão 61,4%, para fora 79,1% das não seguras (34 de 43; IC 95%
  // 65–89%); aqui toda bola assim é mergulho ou salto: o goleiro do jogo não chega em pé a 1,2 m)
  ['H1. partida, bola alta (≥ 1,9 m, ≥ 1,2 m de lado), no mergulho: nas defesas, espalmada (não encaixe nem "pegou"; StatsBomb 97,7%)', defHm.length >= 20 && defHm.filter(x => x.modo === 'espalmada').length / defHm.length >= 0.85, pc(defHm.filter(x => x.modo === 'espalmada').length, defHm.length), '≥ 85%'],
  ['H1b. a mesma bola por cima do goleiro adiantado (ele volta): seguras (StatsBomb, ≥ 2 m da linha: 14,9%, IC 9–24%)', recH.length >= 20 && recH.filter(x => x.modo !== 'espalmada').length / recH.length <= 0.3, pc(recH.filter(x => x.modo !== 'espalmada').length, recH.length), '≤ 30%'],
  ['H2. nas espalmadas, UMA mão — a de cima — na bola (≤ 0,25 m), acima da cabeça, e a outra a > 0,35 m', espH.length >= 30 && umaH.length / espH.length >= 0.8, pc(umaH.length, espH.length), '≥ 80%'],
  ['H3. as espalmadas (sem o rebote) saem do campo — por cima do travessão ou pela linha de fundo — em 3 s', espHp.length >= 25 && espHp.filter(x => x.fora).length / espHp.length >= 0.9, pc(espHp.filter(x => x.fora).length, espHp.length), '≥ 90%'],
  ['H4. com o rebote (a bola que escapa e cai perto): para fora (StatsBomb 79,1%, IC 65–89%)', espH.length >= 30 && espH.filter(x => x.fora).length / espH.length >= 0.65 && espH.filter(x => x.fora).length / espH.length <= 0.95, pc(espH.filter(x => x.fora).length, espH.length), '65–95%'],
  ['H5. a bola com a espalmada (ou o batido) já sorteada não vira "pegou" da mão desenhada antes do contato', resH.length >= 60 && pegH.length === 0, `${pegH.length} de ${resAltaTodos.filter(x => x.lido && !x.lido.fora).length} lidas`, '0'],
  ['I1a. partida: a bola no corpo do goleiro fora da área (acima de 0,9 m) — nas batidas, a bola a > 5 cm do corpo desenhado (bate no ar)', bI1.length >= 30 && arI1.length === 0, `${arI1.length} de ${bI1.length} (máx ${fmt(100 * Math.max(0, ...bI1.map(x => x.folgaBate)), 1)} cm)`, '0'],
  ['I1b. partida: a mesma bola, sem bater, entra > 2 cm no corpo desenhado (o miolo)', resI1.length >= 400 && atI1.length === 0, `${atI1.length} de ${resI1.length} (máx ${fmt(100 * Math.max(0, ...resI1.map(x => x.pen)), 1)} cm)`, '0'],
  ['I2. partida: a saída no cruzamento que falha (também a mão que não chega) — a bola nunca entra > 2 cm no corpo desenhado do pulo nem bate nele no ar', resI2.length >= 40 && resI2m.length >= 20 && resI2m.filter(x => x.bateu).length >= 10 && resI2.filter(x => x.atravessou).length === 0 && arI2.length === 0, `${resI2.filter(x => x.atravessou).length} de ${resI2.length} (mão: ${resI2m.filter(x => x.atravessou).length} de ${resI2m.length}, ${resI2m.filter(x => x.bateu).length} batidas); no ar ${arI2.length} de ${resI2.filter(x => x.bateu).length} batidas`, '0 e 0'],
  ['I3. partida: o goleiro atrás da bola (a 18–45 m dela) nunca "defende" longe dela (> 1,5 m)', resI3.length >= 60 && resI3.filter(x => x.defesa && x.longe).length === 0, `${resI3.filter(x => x.defesa && x.longe).length} de ${resI3.length}`, '0'],
];
console.log('');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[2], x[3], x[1] ? 'PASSOU' : 'REPROVOU'])]));
if (durs.length) console.log(`\nmergulho, do contato até de pé (informação): mediana ${fmt(percentil(durs, 0.5), 2)} s, p10 ${fmt(percentil(durs, 0.1), 2)} s, p90 ${fmt(percentil(durs, 0.9), 2)} s`);
const ok = metas.every(x => x[1]);
console.log(ok ? '\nteste-mergulho: PASSOU' : '\nteste-mergulho: REPROVOU');
process.exit(ok ? 0 : 1);
