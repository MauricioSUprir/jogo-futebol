// Goleiro (Etapa 2): posicionamento na bissetriz do ângulo bola–traves, leitura do chute (onde
// e quando a bola passa pelo plano do goleiro), tempo de reação pelo atributo, mergulho com
// alcance real, encaixe ou espalmada, bola nas mãos e reposição, e saída (botão GOLEIRO
// segurado ou 1×1). Puro: sem three.js nem DOM; sorteios pelo gerador do mundo.

import { GOLEIRO, CAMPO, PASSO, BOLA, BOTAO, JOGADOR } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { criarBola, passoBola, chutar } from './bola.js';

const DT = PASSO;
const MEIO = CAMPO.gol.largura / 2;

/** x da linha do gol que o goleiro defende (o time ataca o lado oposto). */
export function linhaDoGol(m, j) {
  const lado = m.ataca ? m.ataca[j.time] : (j.time === 0 ? 1 : -1);
  return -lado * CAMPO.meioX;
}

/** Ponto na bissetriz do ângulo bola–traves, a d metros da linha. */
export function pontoBissetriz(bx, bz, gx, d) {
  const s = gx > 0 ? -1 : 1; // para dentro do campo
  const p1x = gx, p1z = -MEIO, p2x = gx, p2z = MEIO;
  let ax = p1x - bx, az = p1z - bz;
  let la = MD.hypot(ax, az) || 1; ax /= la; az /= la;
  let cx = p2x - bx, cz = p2z - bz;
  let lc = MD.hypot(cx, cz) || 1; cx /= lc; cz /= lc;
  let ux = ax + cx, uz = az + cz;
  const lu = MD.hypot(ux, uz) || 1; ux /= lu; uz /= lu;
  // reta B + t·u cruzando x = gx + s·d
  const xAlvo = gx + s * d;
  if (Math.abs(ux) < 1e-6) return { x: xAlvo, z: clamp(bz, -MEIO, MEIO) };
  const t = (xAlvo - bx) / ux;
  return { x: xAlvo, z: clamp(bz + uz * t, -MEIO - 0.4, MEIO + 0.4) };
}

/** Prevê onde a bola passa pelo plano x = xPlano: {ticks, y, z} ou null. */
export function preverPassagem(b, xPlano, max = 120) {
  const t = criarBola(b.p.x, b.p.z);
  Object.assign(t.p, b.p); Object.assign(t.v, b.v); Object.assign(t.w, b.w); t.rolando = b.rolando;
  const sentido = Math.sign(xPlano - b.p.x);
  let xAnt = t.p.x, yAnt = t.p.y, zAnt = t.p.z;
  for (let i = 1; i <= max; i++) {
    passoBola(t, null);
    if ((t.p.x - xPlano) * sentido >= 0) {
      const f = (xPlano - xAnt) / ((t.p.x - xAnt) || 1e-9);
      return { ticks: i, y: yAnt + (t.p.y - yAnt) * f, z: zAnt + (t.p.z - zAnt) * f, v: MD.hypot(t.v.x, t.v.y, t.v.z) };
    }
    if (MD.hypot(t.v.x, t.v.z) < 0.5) return null;
    xAnt = t.p.x; yAnt = t.p.y; zAnt = t.p.z;
  }
  return null;
}

/** Está segurando a bola nas mãos? */
export function comBolaNaMao(m, j) {
  return m.naMao === j.id;
}

/**
 * Alcance lateral da mão (m) τ segundos depois de reagir: o centro de massa acelera até o pico e
 * anda até deslocMax; perna/braço esticam no reflexo (tReflexo) e o corpo inteiro até tEsticar.
 */
export function alcanceGoleiro(tau, fator = 1) {
  const G = GOLEIRO;
  if (tau <= 0) return G.alcanceEmPe;
  const a = G.aMergulho * fator, vp = G.vMergulho * fator;
  const tA = vp / a;
  let x = tau <= tA ? 0.5 * a * tau * tau : 0.5 * a * tA * tA + vp * (tau - tA);
  x = Math.min(x, G.deslocMax * fator);
  // reflexo (perna/braço) rápido, e o resto do esticar junto com o mergulho
  const braco = G.alcanceEmPe + (G.bracoReflexo - G.alcanceEmPe) * Math.min(1, tau / G.tReflexo)
    + (G.bracoEsticado - G.bracoReflexo) * clamp((tau - G.tReflexo) / (G.tEsticar - G.tReflexo), 0, 1);
  return x + braco;
}

/**
 * Chance de defesa de uma bola no alvo: logística dos dados (lateral, distância do chute, altura),
 * ajustada pelos atributos, e zero além do alcance físico (com folga).
 */
export function chanceDefesa(lateral, dChute, altura, alcance, attr) {
  const L = GOLEIRO.logit;
  const nivel = ((attr.reflexo + attr.mergulho + attr.posicionamento) / 3 - 72) / 100;
  const lg = L.c0 + L.cLat * lateral + L.cDist * dChute + L.cAlt * altura + L.attr * nivel;
  const p = 1 / (1 + MD.exp(-lg));
  const fis = clamp((alcance + GOLEIRO.folgaAlcance - lateral) / GOLEIRO.folgaAlcance, 0, 1);
  return p * fis;
}

/**
 * Lê um chute (bola livre vindo para o gol) e planeja a defesa. Chamar a cada tick antes de
 * integrar a bola. Decide uma vez por chute (sorteio único → determinístico).
 */
export function lerChute(m, j) {
  if (m.posse != null || m.naMao != null) { j.defesa = null; return; }
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const sentido = Math.sign(gx);
  const vIn = b.v.x * sentido;
  if (vIn < 5) { if (j.defesa && m.tick > j.defesa.tick + 30) j.defesa = null; return; }
  if (j.defesa && j.defesa.chave === m.voo?.tickChave) return;
  // onde a bola cruza a linha do gol e o plano do goleiro
  const linha = preverPassagem(b, gx, 150);
  if (!linha) return;
  const noGol = Math.abs(linha.z) < MEIO + 0.25 && linha.y < CAMPO.gol.altura + 0.25;
  if (!noGol) { j.defesa = { chave: m.voo?.tickChave, fora: true, tick: m.tick + linha.ticks }; return; }
  const xPlano = Math.abs(j.x - gx) > 0.3 ? j.x : gx - sentido * 0.3;
  const plano = preverPassagem(b, xPlano, 150) ?? linha;
  const a = j.par.attr;
  const reac = Math.round(lerp(GOLEIRO.reacao[0], GOLEIRO.reacao[1], a.reflexo / 100) / DT);
  const tau = (plano.ticks - reac) * DT;              // tempo para se mexer depois de reagir
  const lat = plano.z - j.z;
  const dist = Math.abs(lat);
  const alcance = alcanceGoleiro(tau, lerp(0.9, 1.08, a.mergulho / 100));
  const alturaOk = plano.y < GOLEIRO.alturaMax + (dist < 1 ? 0.2 : 0);
  const dChute = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  let pDefesa = alturaOk ? chanceDefesa(dist, dChute, plano.y, alcance, a) : 0;
  // bola por cima do goleiro adiantado (cavadinha): ele volta e tenta tirar antes da linha
  const recuo = !alturaOk && Math.abs(j.x - gx) > 2 ? recuoBolaAlta(m, j, b, gx, reac) : null;
  if (recuo) pDefesa = lerp(GOLEIRO.recuoDefesa[0], GOLEIRO.recuoDefesa[1], clamp(recuo.folga / 0.3, 0, 1));
  // passe do próprio time (recuo) não é chute: o goleiro recebe sempre que alcança, sem o sorteio
  // da defesa (antes ~3% dos recuos viravam gol contra quando a "defesa" sorteada falhava)
  const proprio = m.voo && m.voo.time === j.time && m.voo.tipo !== 'chute' && m.voo.tipo !== 'cabeceio';
  if (proprio) pDefesa = alturaOk && dist <= alcance + GOLEIRO.folgaAlcance / 2 ? 1 : 0;
  const ok = uniforme(m.rng) < pDefesa;
  // segurar ou espalmar: em pé e de longe segura mais; no mergulho e de perto, espalma
  const mergulha = dist > GOLEIRO.alcanceEmPe;
  const S = GOLEIRO.segurar;
  const pSegura = proprio ? 1 : (mergulha ? S.mergulho : dChute < 12 ? S.perto : S.emPe) * lerp(0.85, 1.15, a.reflexo / 100);
  const encaixe = ok && uniforme(m.rng) < pSegura;
  // a bola no tick do contato (aplicarDefesa roda em defesa.tick − 1, antes de a bola andar nesse passo):
  // é onde as mãos do mergulho desenhado chegam
  const contato = bolaDepois(b, Math.max(0, plano.ticks - 1));
  j.defesa = recuo ? {
    chave: m.voo?.tickChave, tick: m.tick + recuo.i, inicio: m.tick + reac, x: recuo.x, z: recuo.z, y: recuo.y,
    sucesso: ok, tipo: ok ? (encaixe ? 'encaixe' : 'espalmada') : 'falhou', mergulha: false, recuo: true,
    lado: Math.sign(recuo.z - j.z) || 1, xPlano: recuo.x,
  } : {
    chave: m.voo?.tickChave, tick: m.tick + plano.ticks, inicio: m.tick + reac, z: plano.z, y: plano.y,
    sucesso: ok, tipo: ok ? (encaixe ? 'encaixe' : 'espalmada') : 'falhou', mergulha,
    lado: Math.sign(lat) || 1, xPlano, bx: contato.x, by: contato.y, bz: contato.z,
  };
  m.eventos.push({ tipo: 'leituraGoleiro', id: j.id, chega: dist <= alcance, p: pDefesa });
}

const _bd = criarBola(0, 0), _bdOut = { x: 0, y: 0, z: 0 };
/** Posição da bola depois de n passos (física pura, sem mexer na bola do jogo). */
function bolaDepois(b, n) {
  Object.assign(_bd.p, b.p); Object.assign(_bd.v, b.v); Object.assign(_bd.w, b.w); _bd.rolando = b.rolando;
  for (let i = 0; i < n; i++) passoBola(_bd, null);
  _bdOut.x = _bd.p.x; _bdOut.y = _bd.p.y; _bdOut.z = _bd.p.z;
  return _bdOut;
}

/**
 * Bola alta que passa por cima do goleiro adiantado: primeiro ponto do voo, entre ele e a linha,
 * em que ela desce ao alcance da mão e ele chega a tempo voltando. {i, x, z, y, folga} ou null.
 */
function recuoBolaAlta(m, j, b, gx, reac) {
  const t = criarBola(b.p.x, b.p.z);
  Object.assign(t.p, b.p); Object.assign(t.v, b.v); Object.assign(t.w, b.w); t.rolando = b.rolando;
  const sentido = Math.sign(gx);
  for (let i = 1; i <= 150; i++) {
    passoBola(t, null);
    if ((t.p.x - gx) * sentido > 0) return null; // entrou (ou passou da linha)
    if (t.v.y > 0 || t.p.y > GOLEIRO.alturaMax) continue;
    if ((t.p.x - j.x) * sentido < 0) continue; // ainda na frente dele
    const tGoleiro = reac * DT + MD.hypot(t.p.x - j.x, t.p.z - j.z) / GOLEIRO.vRecuo;
    const folga = i * DT - tGoleiro;
    if (folga >= 0) return { i, x: t.p.x, z: t.p.z, y: t.p.y, folga };
  }
  return null;
}

/** Executa a defesa no tick planejado (antes de integrar a bola). */
export function aplicarDefesa(m, j) {
  const d = j.defesa;
  if (!d || d.fora || m.tick !== d.tick - 1) return;
  if (!d.sucesso) { m.eventos.push({ tipo: 'goleiroBatido', id: j.id }); return; }
  const b = m.bola;
  const sentido = Math.sign(linhaDoGol(m, j));
  if (d.tipo === 'encaixe') {
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0;
    m.naMao = j.id;
    m.posse = j.id;
    j.segura = { desde: m.tick };
    m.voo = null;
    m.eventos.push({ tipo: 'defesa', id: j.id, modo: 'encaixe' });
  } else {
    // espalmada: a mão na bola desvia para FORA do perigo — por cima do travessão (alta), pela linha de fundo
    // por fora da trave (escanteio) ou bem aberta para o lado; nunca de volta para o meio da área
    espalmar(m, j, d, sentido);
    m.voo = null;
    m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
    m.eventos.push({ tipo: 'defesa', id: j.id, modo: 'espalmada' });
  }
  if (m.stats) m.stats.defesas = (m.stats.defesas ?? 0) + 1;
}

const _be = criarBola(0, 0), _ve = { x: 0, y: 0, z: 0 }, _w0 = { x: 0, y: 0, z: 0 };

/**
 * Para onde vai a bola espalmada (pesquisa: PESQUISA-RECEPCAO-GOLEIRO.md — treinadores de goleiro: "espalmar
 * para fora, pela trave ou por cima do travessão, nunca de volta na área"; StatsBomb: 39% dos mergulhos
 * espalmam para fora). Tenta a direção de cada caso e confere pela física (a mesma bola, sem ninguém) que ela
 * não entra no gol nem morre na zona perigosa (à frente do gol, a menos de ESPALMADA.zonaX da linha e |z| <
 * ESPALMADA.zonaZ); senão abre mais o ângulo.
 */
function espalmar(m, j, d, sentido) {
  const b = m.bola, E = GOLEIRO.espalmada;
  const gx = linhaDoGol(m, j);
  const v = MD.hypot(b.v.x, b.v.y, b.v.z);
  // sai pela trave mais perto da bola; com ela no meio, para o lado do mergulho
  const lado = Math.abs(b.p.z) > 0.6 ? Math.sign(b.p.z) : (d.lado || 1);
  const dLinha = Math.abs(gx - b.p.x);
  const r1 = uniforme(m.rng), r2 = uniforme(m.rng);
  for (let tent = 0; tent < 6; tent++) {
    const abre = tent * 0.6;
    if (b.p.y > E.alturaTravessao) {
      // por cima do travessão: sobe e vai para trás da linha
      const sp = Math.min(E.vMax, Math.max(E.vMin, v * E.fracaoV)) * (1 + 0.1 * tent);
      _ve.x = sentido * sp * 0.5; _ve.y = sp * (0.8 + 0.1 * tent); _ve.z = lado * sp * (0.15 + 0.1 * tent);
    } else {
      // pela linha de fundo por fora da trave (perto da linha) ou bem aberta para o lado (longe dela)
      const longe = dLinha > E.perto;
      const zAlvo = lado * (longe ? E.zAberta + 3 * r1 + 2 * abre : CAMPO.gol.largura / 2 + 1.0 + 1.8 * r1 + abre);
      const xAlvo = longe ? gx - sentido * dLinha * 0.5 : gx + sentido * 0.6;
      let ux = xAlvo - b.p.x, uz = zAlvo - b.p.z;
      const l = MD.hypot(ux, uz) || 1;
      ux /= l; uz /= l;
      const sp = Math.min(E.vMax, Math.max(E.vMin, v * E.fracaoV)) * (1 + 0.12 * tent);
      _ve.x = ux * sp; _ve.z = uz * sp; _ve.y = 1 + 2 * r2;
    }
    if (espalmadaSegura(b, gx, sentido) || tent === 5) break;
  }
  chutar(b, _ve, _w0);
  b.rolando = false;
}

/** A bola saindo com _ve fica fora do perigo? (não entra no gol e não morre na zona perigosa) */
function espalmadaSegura(b, gx, sentido) {
  const E = GOLEIRO.espalmada, c = _be;
  Object.assign(c.p, b.p); c.v.x = _ve.x; c.v.y = _ve.y; c.v.z = _ve.z; c.w.x = 0; c.w.y = 0; c.w.z = 0; c.rolando = false;
  for (let i = 0; i < 240; i++) {
    passoBola(c, null);
    // passou da linha de fundo (gol contra ou escanteio) ou da lateral: decidido
    if ((c.p.x - gx) * sentido > 0) return !(Math.abs(c.p.z) < CAMPO.gol.largura / 2 + 0.15 && c.p.y < CAMPO.gol.altura + 0.15);
    if (Math.abs(c.p.z) > CAMPO.meioZ) return true;
    const vh = MD.hypot(c.v.x, c.v.z);
    if (c.p.y < 0.5 && vh < E.vMorre) return !(Math.abs(gx - c.p.x) < E.zonaX && Math.abs(c.p.z) < E.zonaZ);
  }
  return true;
}

/** Goleiro deve sair (1×1 da IA ou botão GOLEIRO do humano)? */
function deveSair(m, j, humano) {
  if (humano) return (j.botoesTime & BOTAO.GOLEIRO) !== 0 ? 'botao' : false;
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const dBolaGol = MD.hypot(b.p.x - gx, b.p.z);
  if (dBolaGol > 17) return false;
  const dono = m.posse != null ? m.jogadores.find(o => o.id === m.posse) : null;
  if (!dono || dono.time === j.time) return false;
  // só sai no 1×1 de verdade: o atacante vem conduzindo para o gol (parado, ele fecha o ângulo)
  const vGol = (dono.vx * (gx - dono.x) + dono.vz * (0 - dono.z)) / (MD.hypot(gx - dono.x, dono.z) || 1);
  if (vGol < 2.5) return false;
  // ninguém do meu time mais perto da bola do que eu
  const dg = MD.hypot(j.x - b.p.x, j.z - b.p.z);
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id) continue;
    if (MD.hypot(o.x - b.p.x, o.z - b.p.z) < dg * 0.8) return false;
  }
  return '1x1';
}

/**
 * Movimento do goleiro neste tick: {dx, dz, vel, rumoAlvo}. botoesTime = botões do humano do
 * time (para o botão GOLEIRO), quando há humano.
 */
export function movimentoGoleiro(m, j, humano) {
  const b = m.bola;
  const gx = linhaDoGol(m, j);
  const sentido = Math.sign(gx);
  const olhar = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  if (comBolaNaMao(m, j)) return { dx: -sentido, dz: 0, vel: 0, rumoAlvo: MD.atan2(0, -sentido) };
  const d = j.defesa;
  if (d && d.sucesso !== undefined && !d.fora && m.tick >= d.inicio && m.tick < d.tick + 6) {
    if (d.recuo) {
      // volta para o ponto em que a bola desce (batido, chega um pouco atrasado)
      const dx = d.x - j.x, dz = d.z - j.z, dd = MD.hypot(dx, dz) || 1;
      const v = Math.min(GOLEIRO.vRecuo * (d.sucesso ? 1 : 0.8), dd / Math.max((d.tick - m.tick) * DT, 0.05));
      return { dx: dx / dd, dz: dz / dd, vel: v, rumoAlvo: olhar };
    }
    // defesa desenhada (mergulho, salto ou em pé): começa uma vez por leitura, no máximo antecipaMergulho s
    // antes do contato, e daí o corpo anda pela conta do mergulho (sim.js passoMergulho); batido, ele tenta e
    // a mão fica curta. Antes disso, anda de lado para a linha da bola (batido, para a ~1,2 m dela)
    if (!j.mergulho || j.mergulho.idDefesa !== d.tick) {
      const falta = (d.tick - 1 - m.tick) * DT;
      if (falta > GOLEIRO.antecipaMergulho) {
        const alvoZ = d.sucesso ? d.z : (Math.abs(d.z - j.z) > 1.2 ? d.z - d.lado * 1.2 : j.z);
        const dz = alvoZ - j.z;
        const v = Math.min(GOLEIRO.vLado, Math.abs(dz) / Math.max(falta, 0.05));
        return { dx: 0, dz: Math.sign(dz) || 1, vel: Math.abs(dz) > 0.05 ? v : 0, rumoAlvo: olhar };
      }
      iniciarMergulho(m, j, d);
      j.mergulho.idDefesa = d.tick;
    }
    return { dx: -sentido, dz: 0, vel: 0, rumoAlvo: j.rumo };
  }
  if (j.mergulho && m.tick > j.mergulho.fim) j.mergulho = null;
  if (mergulhoAtivo(j, m.tick + 1)) return { dx: -sentido, dz: 0, vel: 0, rumoAlvo: j.rumo };
  const sair = deveSair(m, j, humano);
  if (sair === '1x1') {
    // contra quem domina a bola: fecha o ângulo na bissetriz, sem passar de ~4 m da linha
    const dBola = MD.hypot(b.p.x - gx, b.p.z);
    const p = pontoBissetriz(b.p.x, b.p.z, gx, Math.min(GOLEIRO.saida1x1Max, Math.max(1.2, dBola - 3)));
    const dx = p.x - j.x, dz = p.z - j.z;
    const dd = MD.hypot(dx, dz);
    if (!j.saindo) { j.saindo = true; m.eventos.push({ tipo: 'saidaGoleiro', id: j.id, modo: '1x1' }); }
    return { dx: dd > 1e-6 ? dx / dd : 0, dz: dd > 1e-6 ? dz / dd : 0, vel: Math.min(j.par.vArrancada * 0.8, dd * 4), rumoAlvo: olhar };
  }
  if (sair) {
    // botão GOLEIRO: sai na bola (até saidaMax da linha; o campo fica do lado -sentido)
    const x1 = gx - sentido * 0.5, x2 = gx - sentido * GOLEIRO.saidaMax;
    const tx = clamp(b.p.x, Math.min(x1, x2), Math.max(x1, x2));
    const dx = tx - j.x, dzz = b.p.z - j.z;
    const dd = MD.hypot(dx, dzz) || 1;
    if (!j.saindo) { j.saindo = true; m.eventos.push({ tipo: 'saidaGoleiro', id: j.id }); }
    return { dx: dx / dd, dz: dzz / dd, vel: j.par.vArrancada * 0.95, rumoAlvo: olhar };
  }
  j.saindo = false;
  // posição: bissetriz, mais adiantado com a bola longe
  const dBola = MD.hypot(b.p.x - gx, b.p.z);
  const P = GOLEIRO.profundidade;
  const dLinha = dBola <= 20 ? lerp(P[0], P[1], clamp((dBola - 6) / 14, 0, 1))
    : lerp(P[1], GOLEIRO.profundidadeLonge, clamp((dBola - 20) / 20, 0, 1));
  const p = pontoBissetriz(b.p.x, b.p.z, gx, dLinha);
  const dx = p.x - j.x, dz = p.z - j.z;
  const dd = MD.hypot(dx, dz);
  const vel = Math.min(4.5, dd * 3);
  return { dx: dd > 1e-6 ? dx / dd : 0, dz: dd > 1e-6 ? dz / dd : 0, vel, rumoAlvo: olhar };
}

/** Bola nas mãos acompanha o goleiro (no meio das palmas, na altura do peito). */
export function bolaNaMao(m, j) {
  const b = m.bola;
  const f = 0.32;
  // na defesa desenhada (encaixe no mergulho): a bola fica nas mãos do quadro do próximo tick
  if (bolaNasMaosMergulho(j, m.tick + 1, b.p)) {
    b.v.x = 0; b.v.y = 0; b.v.z = 0;
    b.rolando = false;
    return;
  }
  b.p.x = j.x + MD.cos(j.rumo) * f;
  b.p.z = j.z + MD.sin(j.rumo) * f;
  b.p.y = 1.05;
  b.v.x = 0; b.v.y = 0; b.v.z = 0;
  b.rolando = false;
}

/** Goleiro com a bola nas mãos a solta para a reposição (pé ou mão). */
export function soltarDaMao(m, j) {
  const b = m.bola;
  b.p.y = BOLA.raio;
  b.rolando = true;
  m.naMao = null;
  j.segura = null;
}

// =====================================================================================================
// Mergulho, salto e defesa em pé desenhados (pedido do dono, 10/10: "o goleiro não pula, e nem espalma
// direito"). Pesquisa: PESQUISA-RECEPCAO-GOLEIRO.md (Spratford 2009, Ibrahim 2019, Monteiro 2022, Suzuki
// 1987). O corpo do goleiro na defesa é CINEMÁTICO: o centro (j.x, j.z), a altura do quadril, a inclinação
// do tronco e os pés saem de uma função do tempo (quadroMergulho) — a simulação anda o corpo por ela e a
// animação (anim.js poseMergulho) desenha pela MESMA conta: o corpo nunca "desliza em pé" e a mão chega à
// bola no tick do contato. Matemática pelo MD: os pés plantados no fim e a bola nas mãos entram no estado
// (hash Node = navegador).
//
// O mergulho é uma "prancha": no contato, pés (fora do chão), quadril, ombros e mãos ficam quase numa linha
// que aponta para a bola (Spratford: o corpo estendido no voo); o quadril anda de lado o bastante para os pés
// não serem jogados para trás (o corpo gira em torno do centro de massa, mas o centro de massa vai junto).
// Depois do contato ele cai de lado, fica no chão e levanta com os pés plantando debaixo do quadril.
//
// j.mergulho = {tick0, tc (tick do contato = defesa.tick − 1), tipo: 'mergulho'|'salto'|'baixa'|'peito',
//   sucesso, encaixe, x0, z0 (centro no começo), fx, fz (frente), lx, lz (lado do mergulho), sC, fC (quanto o
//   centro anda de lado e para a frente até o contato), hC (quadril no contato), phiC (inclinação do tronco de
//   lado no contato: 0 = de pé, π/2 = deitado de lado), thC (inclinação para a frente: a defesa baixa curva o
//   tronco sobre a bola), v0L, v0F (velocidade do corpo no começo: vinha andando de lado), h0, bx, by, bz (a
//   bola no contato), ext (1 = o braço chega à bola), tImp (s de impulsão), tq (s do contato até cair), vc,
//   sFim (centro de lado ao cair), sLev (de lado quando fica de pé), fim (tick em que está de pé de novo), pe0
//   [{x, z, y, ar}] (pés no começo), perto (o pé do lado do mergulho), passo (o passo dele na impulsão), pmL
//   (meio dos pés no começo, de lado), pmF (para a frente, onde o centro volta na defesa em pé), pf [{x, z}]
//   (onde os pés plantam no fim), passa, durPasso, iniPasso (defesa em pé: o pé que dá um passo curto até a
//   base, quanto dura e quando começa), lado, alt, ate, idDefesa (a leitura que começou esta defesa)}

const ARM = 0.55;            // ombro → mão (anim: braço 0,29 + antebraço 0,26)
const TRONCO_OMBRO = 0.46;   // pelve → linha dos ombros no eixo do tronco (0,17 + 0,22 + 0,07)
const MEIO_OMBRO = 0.19;
const H_PE = 0.92;           // quadril de pé
const H_CHAO = 0.17;         // quadril deitado de lado no chão
const PERNA = 0.82;          // quadril → tornozelo com a perna quase esticada (no ar)
const DESCE_PERNA = 0.07;    // a perna no ar pende um pouco abaixo da linha do tronco (deitado: tornozelo a ~0,1 m)
const LMAX = (JOGADOR.coxa + JOGADOR.canela) * 0.998; // o alcance da perna da animação
const MEIO_QUADRIL = JOGADOR.larguraQuadril / 2;
const TORN = JOGADOR.alturaTornozelo;
const PE_NO_AR = 0.15;       // m: o tornozelo de baixo no contato do mergulho (os dois pés fora do chão)
const ATRAS = 0.3;           // m que os pés podem ficar para trás do ponto de saída no voo
const V_PICO = 4.6;          // m/s — pico do centro de massa no mergulho (Monteiro 2022: 3,6–4,0; folga do braço curto do boneco)
const T_CHAO = 0.12;         // s deitado depois de cair
const T_LEVANTA = 0.5;       // s para levantar
const BASE_EM_PE = 0.16;     // m do centro a cada pé na base da defesa em pé
const RECUA = 0.3;           // m que o corpo volta de lado ao levantar (sobe por cima dos pés, que vêm para debaixo dele)
const T_SALTO_POUSO = 0.3;   // s do contato até os pés pousarem no salto
const T_EM_PE = 0.45;        // s da defesa em pé (baixa / peito) depois do contato
const T_ABRACA = 0.25;       // s para trazer a bola encaixada para junto do peito
const MEIO_PI = 1.5707963267948966;

const sm = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Eixos do corpo no quadro: cima do tronco (u) inclinado phi para o lado do mergulho e th para a frente, e a
 * direita do corpo (r = frente × cima, normalizada). Escreve em `e`.
 */
function eixos(g, phi, th, e) {
  const c = MD.cos(phi), s = MD.sin(phi), ct = MD.cos(th), st = MD.sin(th);
  e.ux = g.lx * s * ct + g.fx * st; e.uy = c * ct; e.uz = g.lz * s * ct + g.fz * st;
  const rx = -g.fz * e.uy, ry = g.fz * e.ux - g.fx * e.uz, rz = g.fx * e.uy;
  const n = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
  e.rx = rx / n; e.ry = ry / n; e.rz = rz / n;
  return e;
}
const _e = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, _ec = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 };

/** Eixos do corpo no quadro q do mergulho g (para a animação: a mesma conta). */
export function eixosMergulho(g, q, e) { return eixos(g, q.phi, q.th, e); }

/** Inclinação do tronco preferida pela altura da bola: rasteira = quase deitado; alta = mais de pé. */
function inclinacaoPelaAltura(bY) {
  if (bY <= 0.6) return 1.40;
  if (bY <= 1.4) return 1.31 - (0.35 * (bY - 0.6)) / 0.8;
  return cl(0.87 - 0.44 * (bY - 1.4), 0.43, 0.87);
}

/**
 * Pose do mergulho no contato (a prancha): inclinação phi, quadril (s de lado, h de altura) para o ombro do
 * meio ficar a um braço da bola (bL de lado, bY de altura), com o pé de baixo fora do chão, os pés no máximo
 * ATRAS para trás do pé mais adiantado (peL) e o quadril sem passar do que dá para andar até o contato (sMax).
 */
function resolverMergulho(bL, bY, peL, sMax) {
  const phiH = inclinacaoPelaAltura(bY);
  let melhor = Infinity, rPhi = phiH, rH = H_PE, rS = 0;
  for (let k = 0; k <= 24; k++) {
    const phi = 0.3 + 0.05 * k;
    const s = MD.sin(phi), c = MD.cos(phi);
    for (let ia = 0; ia < 4; ia++) {
      const a = 0.3 + 0.06 * ia;
      let sC = bL - (TRONCO_OMBRO + a) * s;
      let hC = bY - (TRONCO_OMBRO + a) * c;
      const peBaixo = hC - MEIO_QUADRIL * s - 0.03 * c - PERNA * c - DESCE_PERNA * s;
      if (peBaixo < PE_NO_AR) hC += PE_NO_AR - peBaixo;
      const pes = sC - PERNA * s;
      if (pes < peL - ATRAS) sC += peL - ATRAS - pes;
      const oL = sC + TRONCO_OMBRO * s, oY = hC + TRONCO_OMBRO * c;
      const dBr = Math.sqrt((bL - oL) * (bL - oL) + (bY - oY) * (bY - oY));
      const custo = Math.abs(phi - phiH) + 3 * Math.max(0, dBr - 0.48) + 1.5 * Math.max(0, sC - sMax)
        + 2 * Math.max(0, hC - 1.45) + 0.3 * (0.48 - a);
      if (custo < melhor) { melhor = custo; rPhi = phi; rH = hC; rS = Math.max(0, sC); }
    }
  }
  return { phi: rPhi, h: rH, s: rS };
}

/**
 * Defesa em pé (baixa / peito): o quadril vai um pouco para o lado e para a frente, agacha e o tronco curva
 * sobre a bola (th) até o ombro do meio ficar a ~0,38 m dela. Os pés: fica plantado o que está no chão perto do
 * corpo; o outro (no ar, ou longe — vinha de um passo de lado largo) dá um passo curto até a base debaixo do
 * quadril. As pernas alcançam os pés em toda a defesa.
 */
const _gR = { lx: 0, lz: 0, fx: 0, fz: 0 };
function resolverEmPe(j, pe0, lx, lz, fx, fz, bL, bF, bY) {
  _gR.lx = lx; _gR.lz = lz; _gR.fx = fx; _gR.fz = fz;
  const phi = cl(bL * 0.5, 0, 0.35);
  const sC = cl(bL - 0.3, 0, 0.3), fC = cl(bF - 0.3, -0.25, 0.25);
  const cx = j.x + lx * sC + fx * fC, cz = j.z + lz * sC + fz * fC;
  const rx = -fz, rz = fx;
  const pes = [], passa = [];
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const fica = !pe0[p].ar && MD.hypot(pe0[p].x - cx, pe0[p].z - cz) <= 0.5;
    passa.push(!fica);
    pes.push(fica ? { x: pe0[p].x, z: pe0[p].z } : { x: cx + rx * lado * BASE_EM_PE, z: cz + rz * lado * BASE_EM_PE });
  }
  let melhor = Infinity, rH = H_PE, rTh = 0;
  for (let ih = 0; ih < 6; ih++) {
    const h = H_PE - 0.04 - 0.08 * ih;
    for (let it = 0; it <= 26; it++) {
      const th = 0.05 * it;
      const e = eixos(_gR, phi, th, _e);
      // as pernas alcançam os pés (pela articulação do quadril, como a animação)
      let falta = 0;
      for (let p = 0; p < 2; p++) {
        const lado = p === 0 ? -1 : 1;
        const hx = cx + e.rx * lado * MEIO_QUADRIL - e.ux * 0.03, hy = h + e.ry * lado * MEIO_QUADRIL - e.uy * 0.03;
        const hz = cz + e.rz * lado * MEIO_QUADRIL - e.uz * 0.03;
        const dx = pes[p].x - hx, dy = TORN - hy, dz = pes[p].z - hz;
        falta = Math.max(falta, Math.sqrt(dx * dx + dy * dy + dz * dz) - LMAX * 0.98);
      }
      const oL = sC + TRONCO_OMBRO * (e.ux * lx + e.uz * lz), oF = fC + TRONCO_OMBRO * (e.ux * fx + e.uz * fz);
      const oY = h + TRONCO_OMBRO * e.uy;
      const dB = Math.sqrt((bL - oL) * (bL - oL) + (bF - oF) * (bF - oF) + (bY - oY) * (bY - oY));
      const custo = Math.abs(dB - 0.38) + 0.1 * th + 0.3 * (H_PE - h) + 5 * Math.max(0, falta);
      if (custo < melhor) { melhor = custo; rH = h; rTh = th; }
    }
  }
  return { phi, th: rTh, h: rH, s: sC, f: fC, pes, passa };
}

/**
 * Começa a defesa desenhada de j para a leitura d (lerChute) no tick de agora. O tipo sai da bola no contato:
 * alta perto do corpo → salto; baixa ou no peito e perto → em pé; senão → mergulho. Calcula a pose do contato
 * (na defesa a mão chega à bola; batido, ele tenta e fica curto) e onde os pés plantam no fim.
 */
export function iniciarMergulho(m, j, d) {
  const t0 = m.tick;
  const tc = Math.max(t0 + 1, d.tick - 1);
  const tcRel = (tc - t0) * DT;
  const fx = MD.cos(j.rumo), fz = MD.sin(j.rumo);
  // lado: perpendicular à frente, para o lado da bola
  let lx = -fz, lz = fx;
  const relX = d.bx - j.x, relZ = d.bz - j.z;
  if (lx * relX + lz * relZ < 0) { lx = -lx; lz = -lz; }
  const bL = lx * relX + lz * relZ, bF = fx * relX + fz * relZ, bY = d.by;
  // velocidade do corpo no começo (vinha andando de lado): o perfil do centro parte dela, sem tranco
  const v0L = j.vx * lx + j.vz * lz, v0F = j.vx * fx + j.vz * fz;
  // pés no começo: o plantado onde está; o que está no ar continua de onde estava desenhado
  const pe0 = [0, 1].map(p => (j.pes[p].apoio ? { x: j.pes[p].x, z: j.pes[p].z, y: TORN, ar: false } : { x: j.pes[p].tx, z: j.pes[p].tz, y: j.pes[p].ty, ar: true }));
  const perto = (pe0[1].x - pe0[0].x) * lx + (pe0[1].z - pe0[0].z) * lz >= 0 ? 1 : 0;
  const pmX = (pe0[0].x + pe0[1].x) / 2 - j.x, pmZ = (pe0[0].z + pe0[1].z) / 2 - j.z;
  const pmL = pmX * lx + pmZ * lz, pmF = pmX * fx + pmZ * fz;
  let tipo;
  if (bY > 1.75 && bL < 0.8) tipo = 'salto';
  else if (bL < 0.75 && bY <= 0.6) tipo = 'baixa';
  else if (bL < 0.65 && bY <= 1.75) tipo = 'peito';
  else tipo = 'mergulho';
  // batido: ele tenta mesmo assim — o corpo vai menos e a mão não chega à bola
  const alvoL = d.sucesso ? bL : Math.max(0, bL - 0.4);
  const ext = d.sucesso ? 1 : 0.8;
  const sMax = Math.max(0.2, V_PICO * tcRel * 0.75);
  let phiC = 0, thC = 0, hC = H_PE, sC = 0, fC = 0, emPe = null;
  if (tipo === 'mergulho') {
    fC = cl(bF - 0.1, -0.6, 0.6);
    // os pés no voo não ficam mais que ATRAS para trás do pé que está mais adiantado para o lado da bola
    const peL = Math.max((pe0[0].x - j.x) * lx + (pe0[0].z - j.z) * lz, (pe0[1].x - j.x) * lx + (pe0[1].z - j.z) * lz);
    const r = resolverMergulho(alvoL, bY, peL, sMax);
    phiC = r.phi; hC = r.h; sC = r.s;
  } else if (tipo === 'salto') {
    phiC = cl(bL * 0.35, 0, 0.35);
    const oY = TRONCO_OMBRO * MD.cos(phiC) - MEIO_OMBRO * MD.sin(phiC);
    hC = cl(bY - 0.3 - oY, H_PE, H_PE + 0.45);
    fC = cl(bF - 0.3, -0.3, 0.3);
    const sL = TRONCO_OMBRO * MD.sin(phiC) + MEIO_OMBRO * MD.cos(phiC);
    const dY = bY - (hC + oY), dF = bF - fC;
    const alcL = Math.sqrt(Math.max(0, (ARM - 0.05) * (ARM - 0.05) - dY * dY - dF * dF));
    sC = cl(alvoL - sL - alcL, 0, Math.min(0.6, sMax));
  } else {
    emPe = resolverEmPe(j, pe0, lx, lz, fx, fz, alvoL, bF, bY);
    phiC = emPe.phi; thC = emPe.th; hC = emPe.h; sC = Math.min(emPe.s, sMax); fC = emPe.f;
  }
  const tImp = tipo === 'mergulho' ? cl(tcRel - 0.12, 0.05, 0.16) : cl(tcRel - 0.1, 0.05, 0.14);
  const vc = tcRel > 0 ? sC / tcRel : 0;
  let tq = 0, fim, sFim, fFim = fC, passo = 0;
  if (tipo === 'mergulho') {
    tq = cl(Math.sqrt((2 * Math.max(0.05, hC - H_CHAO)) / 9.81) * 1.1, 0.15, 0.4);
    // deitado, os pés não ficam para trás de onde estavam no contato
    const pesC = sC - PERNA * MD.sin(phiC);
    sFim = Math.max(sC + vc * tq * 0.5, pesC + PERNA + 0.02);
    fim = tc + Math.round((tq + T_CHAO + T_LEVANTA) / DT);
    // o passo do pé do lado da bola na impulsão: menor quando os pés ficam para trás no voo
    passo = cl(0.15 + pesC - pmL, 0.05, 0.3);
  } else if (tipo === 'salto') {
    tq = T_SALTO_POUSO;
    sFim = sC + vc * tq * 0.5;
    fim = tc + Math.round((tq + 0.3) / DT);
  } else {
    // em pé: volta para cima dos pés (os que ficaram e os que deram o passo)
    const mx = (emPe.pes[0].x + emPe.pes[1].x) / 2 - j.x, mz = (emPe.pes[0].z + emPe.pes[1].z) / 2 - j.z;
    sFim = mx * lx + mz * lz; fFim = mx * fx + mz * fz;
    fim = tc + Math.round(T_EM_PE / DT);
  }
  // onde os pés plantam no fim: em pé, onde estão; no mergulho e no salto, debaixo do quadril (no mergulho, de
  // pé RECUA de volta: ele sobe por cima dos pés)
  const sLev = tipo === 'mergulho' ? sFim - RECUA : sFim;
  const cx = j.x + lx * sLev + fx * fFim, cz = j.z + lz * sLev + fz * fFim;
  const rx = -fz, rz = fx; // direita do corpo
  const pf = emPe ? emPe.pes
    : [{ x: cx - rx * MEIO_QUADRIL, z: cz - rz * MEIO_QUADRIL }, { x: cx + rx * MEIO_QUADRIL, z: cz + rz * MEIO_QUADRIL }];
  // em pé: o passo curto de cada pé que muda de lugar (o que estava no ar primeiro; depois o outro), com
  // duração pela distância (um pé humano anda até ~3 m/s parado)
  const passa = emPe ? emPe.passa : [false, false];
  const durPasso = [0, 1].map(p => (passa[p] ? cl(MD.hypot(pf[p].x - pe0[p].x, pf[p].z - pe0[p].z) / 2.2, 0.15, 0.45) : 0));
  const primeiro = passa[0] && passa[1] ? (pe0[1].ar && !pe0[0].ar ? 1 : 0) : (passa[1] ? 1 : 0);
  const iniPasso = [0, 1].map(p => (passa[p] && passa[1 - p] && p !== primeiro ? durPasso[primeiro] : 0));
  j.mergulho = {
    tick0: t0, tc, tipo, sucesso: !!d.sucesso, encaixe: d.tipo === 'encaixe', x0: j.x, z0: j.z, fx, fz, lx, lz,
    sC, fC, hC, phiC, thC, v0L, v0F, h0: j.quadril ?? H_PE, bx: d.bx, by: d.by, bz: d.bz, ext, tImp, tq, vc, sFim, sLev, fim,
    pe0, perto, passo, pmL, pmF: fFim, pf, passa, durPasso, iniPasso, lado: d.lado, alt: d.y, ate: fim,
  };
  return j.mergulho;
}

/** A defesa desenhada de j vale no tick? (do começo até ficar de pé) */
export function mergulhoAtivo(j, tick) {
  const g = j.mergulho;
  return !!g && g.tc != null && tick > g.tick0 && tick <= g.fim;
}

/**
 * Quadro da defesa desenhada no tick (pura): escreve em `q` o centro do corpo (x, z), a altura do quadril h,
 * a inclinação do tronco de lado (phi) e para a frente (th), quanto os braços vão à bola (braco 0–1), a fase,
 * os tornozelos (a0, a1 {x, y, z}) e se cada pé está plantado (apoio0, apoio1).
 */
export function quadroMergulho(g, tick, q) {
  const t = (tick - g.tick0) * DT;
  corpoMergulho(g, t, q);
  tornozelosMergulho(g, t, (g.tc - g.tick0) * DT, (g.tc - g.tick0) * DT + g.tq, q);
  return q;
}

/** O corpo do quadro no tempo t (s desde o começo): centro, quadril, inclinações e braços (sem os pés). */
function corpoMergulho(g, t, q) {
  const tcRel = (g.tc - g.tick0) * DT;
  const tPouso = tcRel + g.tq;
  const u = cl(t / Math.max(tcRel, DT), 0, 1);
  const S = 2 * u * u - u * u * u;
  // Hermite: sai com a velocidade que tinha (v0) e chega ao contato com a velocidade da conta (sC/tcRel)
  const H0 = (u * u * u - 2 * u * u + u) * tcRel;
  let s, f, h, phi, th = 0;
  if (g.tipo === 'mergulho') {
    if (t <= tcRel) { s = g.sC * S + g.v0L * H0; f = g.fC * S + g.v0F * H0; }
    else if (t <= tPouso + T_CHAO) { const w = Math.min(1, (t - tcRel) / Math.max(g.tq, DT)); s = g.sC + (g.sFim - g.sC) * (2 * w - w * w); f = g.fC; }
    else { s = g.sFim + (g.sLev - g.sFim) * sm((t - tPouso - T_CHAO) / T_LEVANTA); f = g.fC; }
    const hLow = g.h0 - 0.1;
    if (t <= g.tImp) h = g.h0 + (hLow - g.h0) * sm(t / g.tImp);
    else if (t <= tcRel) h = hLow + (g.hC - hLow) * MD.sin(MEIO_PI * cl((t - g.tImp) / Math.max(tcRel - g.tImp, DT), 0, 1));
    else if (t <= tPouso) { const v = (t - tcRel) / g.tq; h = g.hC + (H_CHAO - g.hC) * v * v; }
    else if (t <= tPouso + T_CHAO) h = H_CHAO;
    else h = H_CHAO + (H_PE - H_CHAO) * sm((t - tPouso - T_CHAO) / T_LEVANTA);
    // o tronco gira junto com o corpo que anda (o mesmo perfil): os pés não são jogados para trás
    if (t <= tcRel) phi = g.phiC * S;
    else if (t <= tPouso) phi = g.phiC + (MEIO_PI - g.phiC) * sm((t - tcRel) / g.tq);
    else if (t <= tPouso + T_CHAO) phi = MEIO_PI;
    else phi = MEIO_PI * (1 - sm((t - tPouso - T_CHAO) / T_LEVANTA));
  } else if (g.tipo === 'salto') {
    s = t <= tcRel ? g.sC * S + g.v0L * H0 : g.sC + g.vc * (Math.min(t - tcRel, g.tq) - (0.5 * Math.min(t - tcRel, g.tq) ** 2) / Math.max(g.tq, DT));
    f = t <= tcRel ? g.fC * S + g.v0F * H0 : g.fC;
    const hLow = g.h0 - 0.15;
    if (t <= g.tImp) h = g.h0 + (hLow - g.h0) * sm(t / g.tImp);
    else if (t <= tcRel) h = hLow + (g.hC - hLow) * MD.sin(MEIO_PI * cl((t - g.tImp) / Math.max(tcRel - g.tImp, DT), 0, 1));
    else if (t <= tPouso) h = g.hC + (g.h0 - 0.06 - g.hC) * sm((t - tcRel) / g.tq);
    else h = g.h0 - 0.06 + 0.06 * sm((t - tPouso) / 0.3);
    phi = t <= tcRel ? g.phiC * sm(t / Math.max(tcRel, DT)) : g.phiC * (1 - sm((t - tcRel) / (g.tq + 0.3)));
  } else {
    // em pé (baixa / peito): agacha, inclina e curva sobre a bola até o contato; depois volta para cima dos pés
    const ida = sm(t / Math.max(tcRel, DT)), volta = t <= tcRel ? 0 : sm((t - tcRel) / T_EM_PE);
    const k = ida * (1 - volta);
    h = g.h0 + (g.hC - g.h0) * k;
    phi = g.phiC * k;
    th = g.thC * k;
    // (os pés estão plantados: o corpo não continua o passo de lado — vai direto para a defesa)
    s = t <= tcRel ? g.sC * S : g.sC + (g.sFim - g.sC) * volta;
    f = t <= tcRel ? g.fC * S : g.fC + (g.pmF - g.fC) * volta;
    // as pernas sempre alcançam os pés plantados: o quadril não fica acima do alcance delas
    const e = eixos(g, phi, th, _ec);
    const cx = g.x0 + g.lx * s + g.fx * f, cz = g.z0 + g.lz * s + g.fz * f, L = LMAX * 0.995;
    for (let p = 0; p < 2; p++) {
      const lado = p === 0 ? -1 : 1;
      const dx = g.pf[p].x - (cx + e.rx * lado * MEIO_QUADRIL - e.ux * 0.03), dz = g.pf[p].z - (cz + e.rz * lado * MEIO_QUADRIL - e.uz * 0.03);
      const hMax = TORN + Math.sqrt(Math.max(0, L * L - dx * dx - dz * dz)) - (e.ry * lado * MEIO_QUADRIL - e.uy * 0.03);
      if (h > hMax) h = hMax;
    }
  }
  // braços: vão à bola do fim da impulsão até o contato; depois do contato voltam
  const ini = Math.max(0, g.tImp - 0.06);
  const braco = t <= tcRel ? sm((t - ini) / Math.max(tcRel - ini, DT)) * g.ext : g.ext * (1 - sm((t - tcRel) / 0.35));
  q.fase = t < g.tImp ? 'impulso' : t <= tcRel ? 'voo' : t <= tPouso ? 'queda' : 'fim';
  q.t = t; q.s = s; q.f = f; q.h = h; q.phi = phi; q.th = th; q.braco = braco;
  q.x = g.x0 + g.lx * s + g.fx * f; q.z = g.z0 + g.lz * s + g.fz * f;
  return q;
}

/** Articulação do quadril da perna p no quadro (a mesma da animação) em `out`. */
function articulacaoQuadril(q, e, p, out) {
  const lado = p === 0 ? -1 : 1;
  out.x = q.x + e.rx * lado * MEIO_QUADRIL - e.ux * 0.03;
  out.y = q.h + e.ry * lado * MEIO_QUADRIL - e.uy * 0.03;
  out.z = q.z + e.rz * lado * MEIO_QUADRIL - e.uz * 0.03;
  return out;
}

/**
 * O pé (x, y, z) no ponto plantado ou, se a perna não alcança mais (o quadril já foi longe no mergulho), no
 * ponto da linha quadril → pé a um comprimento de perna: o pé sai do chão puxado pelo corpo. Devolve se alcança.
 */
function pePuxado(hip, x, y, z, out) {
  const dx = x - hip.x, dy = y - hip.y, dz = z - hip.z;
  const d = Math.sqrt(dx * dx + dy * dy + dz * dz), L = LMAX * 0.99;
  if (d <= L) { out.x = x; out.y = y; out.z = z; return true; }
  out.x = hip.x + (dx / d) * L; out.y = Math.max(TORN, hip.y + (dy / d) * L); out.z = hip.z + (dz / d) * L;
  return false;
}
const _qi = {}, _ei = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, _hq = { x: 0, y: 0, z: 0 }, _pp = { x: 0, y: 0, z: 0 };
const _hl = { x: 0, y: 0, z: 0 }, _ar = { x: 0, y: 0, z: 0 };

/** Tornozelo da perna p ao longo do corpo (no ar ou deitado) no tempo t do mergulho, em `out`. */
function pernaNoCorpo(g, q, e, p, hq, out) {
  const longe = p !== g.perto;
  const comp = longe ? PERNA * 0.94 : PERNA;
  const avanco = longe ? 0.08 : 0.03;
  out.x = hq.x - e.ux * comp + g.fx * avanco; out.z = hq.z - e.uz * comp + g.fz * avanco;
  out.y = Math.max(TORN, hq.y - e.uy * comp - DESCE_PERNA * MD.sin(q.phi));
  return out;
}
function pernaDeitada(g, t, p, out) {
  corpoMergulho(g, t, _qi);
  const e = eixos(g, _qi.phi, _qi.th, _ei);
  return pernaNoCorpo(g, _qi, e, p, articulacaoQuadril(_qi, e, p, _hl), out);
}

/** Tornozelos e apoio dos pés no quadro (parte de quadroMergulho). */
function tornozelosMergulho(g, t, tcRel, tPouso, q) {
  const a0 = q.a0 ?? (q.a0 = { x: 0, y: 0, z: 0 }), a1 = q.a1 ?? (q.a1 = { x: 0, y: 0, z: 0 });
  if (g.tipo === 'baixa' || g.tipo === 'peito') {
    // em pé: o pé que fica, plantado; o que muda de lugar dá um passo curto (sobe e desce) até a base
    for (let p = 0; p < 2; p++) {
      const a = p === 0 ? a0 : a1, e0 = g.pe0[p];
      if (!g.passa[p]) { a.x = e0.x; a.y = TORN; a.z = e0.z; if (p === 0) q.apoio0 = true; else q.apoio1 = true; continue; }
      const v = sm((t - g.iniPasso[p]) / g.durPasso[p]);
      a.x = e0.x + (g.pf[p].x - e0.x) * v; a.z = e0.z + (g.pf[p].z - e0.z) * v;
      a.y = e0.y + (TORN - e0.y) * v + 0.06 * MD.sin(3.141592653589793 * v);
      if (p === 0) q.apoio0 = v >= 1; else q.apoio1 = v >= 1;
    }
    return q;
  }
  const fimRel = (g.fim - g.tick0) * DT;
  const e = eixos(g, q.phi, q.th, _e);
  for (let p = 0; p < 2; p++) {
    const a = p === 0 ? a0 : a1;
    // articulação do quadril (a mesma da animação) e a perna no ar: ao longo do corpo, pendendo um pouco
    const hq = articulacaoQuadril(q, e, p, _hq);
    const ar = pernaNoCorpo(g, q, e, p, hq, _ar);
    const arX = ar.x, arY = ar.y, arZ = ar.z;
    let x, y, z, apoio;
    if (g.tipo === 'mergulho') {
      // ponto de saída: o pé do lado da bola dá o passo de impulsão; o outro empurra do lugar — e, se o corpo
      // já foi longe antes da saída, sai do chão puxado por ele (o ponto da perna esticada na saída)
      const passo = p === g.perto ? g.passo : 0;
      let sx = g.pe0[p].x + g.lx * passo, sz = g.pe0[p].z + g.lz * passo, y0 = g.pe0[p].y;
      if (p !== g.perto) {
        corpoMergulho(g, g.tImp, _qi);
        pePuxado(articulacaoQuadril(_qi, eixos(g, _qi.phi, _qi.th, _ei), p, _hq), g.pe0[p].x, g.pe0[p].y, g.pe0[p].z, _pp);
        sx = _pp.x; y0 = _pp.y; sz = _pp.z;
      }
      const tAr = Math.max(0.06, tcRel - g.tImp); // os pés chegam à linha do corpo no contato
      if (t < g.tImp) {
        if (p === g.perto) {
          const v = sm(t / g.tImp);
          x = g.pe0[p].x + g.lx * passo * v; z = g.pe0[p].z + g.lz * passo * v; y = g.pe0[p].y + 0.07 * MD.sin(3.141592653589793 * v);
          apoio = false;
        } else {
          const alcanca = pePuxado(articulacaoQuadril(q, e, p, _hq), g.pe0[p].x, g.pe0[p].y, g.pe0[p].z, _pp);
          x = _pp.x; y = _pp.y; z = _pp.z; apoio = alcanca && !g.pe0[p].ar;
        }
      } else if (t <= fimRel - T_LEVANTA) {
        // no ar e no chão: do ponto de saída para a perna ao longo do corpo
        const v = sm((t - g.tImp) / tAr);
        x = sx + (arX - sx) * v; y = y0 + (arY - y0) * v; z = sz + (arZ - sz) * v;
        apoio = false;
      } else {
        // levantando: de onde o pé estava deitado até debaixo do quadril (onde planta no fim)
        const v = sm((t - (fimRel - T_LEVANTA)) / T_LEVANTA);
        pernaDeitada(g, fimRel - T_LEVANTA, p, _pp);
        x = _pp.x + (g.pf[p].x - _pp.x) * v; y = _pp.y + (TORN - _pp.y) * v; z = _pp.z + (g.pf[p].z - _pp.z) * v;
        apoio = t >= fimRel - 1e-9;
      }
    } else {
      // salto: os dois pés empurram e voltam a pousar debaixo do quadril
      const y0 = g.pe0[p].y;
      if (t < g.tImp) { x = g.pe0[p].x; y = y0; z = g.pe0[p].z; apoio = !g.pe0[p].ar; }
      else if (t < tPouso) {
        const sobe = sm((t - g.tImp) / Math.max(tcRel - g.tImp, DT)), desce = sm((t - tcRel) / Math.max(g.tq, DT));
        const alt = Math.max(0, q.h - (g.h0 - 0.02)) * (t <= tcRel ? sobe : 1 - desce);
        const v = sm((t - g.tImp) / Math.max(tPouso - g.tImp, DT));
        x = g.pe0[p].x + (g.pf[p].x - g.pe0[p].x) * v; z = g.pe0[p].z + (g.pf[p].z - g.pe0[p].z) * v;
        y = (y0 + (TORN - y0) * v) + alt;
        apoio = false;
      } else { x = g.pf[p].x; y = TORN; z = g.pf[p].z; apoio = true; }
    }
    a.x = x; a.y = y; a.z = z;
    if (p === 0) q.apoio0 = apoio; else q.apoio1 = apoio;
  }
  return q;
}

/**
 * Ombros e mãos no quadro (em `out`: o0/o1 ombros e m0/m1 mãos, 0 = esquerda): as mãos vão da espera (à
 * frente da cintura) até a bola do contato (com a bola entre as palmas) pelo peso `braco` do quadro, nunca
 * além do alcance do braço. A MESMA conta na simulação (bola nas mãos) e na animação.
 */
export function maosMergulho(g, q, out, repouso = 0, segura = false) {
  const e = eixos(g, q.phi, q.th, _e);
  const ox = q.x + e.ux * TRONCO_OMBRO, oy = q.h + e.uy * TRONCO_OMBRO, oz = q.z + e.uz * TRONCO_OMBRO;
  // segurando (encaixe): depois do contato as mãos trazem a bola para junto do peito ("abraça a bola")
  const tcRel = (g.tc - g.tick0) * DT;
  const traz = segura && q.t > tcRel ? sm((q.t - tcRel) / T_ABRACA) : 0;
  const peitoX = ox - e.ux * 0.12 + g.fx * 0.2, peitoY = oy - e.uy * 0.12, peitoZ = oz - e.uz * 0.12 + g.fz * 0.2;
  // batido: a mão vai na direção da bola mas fica curta (0,35 m antes dela, do lado do corpo)
  const curta = g.sucesso ? 0 : 0.35;
  const bx = g.bx - g.lx * curta, bz = g.bz - g.lz * curta;
  const alvoX = bx + (peitoX - bx) * traz, alvoY = g.by + (peitoY - g.by) * traz, alvoZ = bz + (peitoZ - bz) * traz;
  const braco = segura && q.t > tcRel ? g.ext : q.braco;
  const m0 = out.m0 ?? (out.m0 = { x: 0, y: 0, z: 0 }), m1 = out.m1 ?? (out.m1 = { x: 0, y: 0, z: 0 });
  const o0 = out.o0 ?? (out.o0 = { x: 0, y: 0, z: 0 }), o1 = out.o1 ?? (out.o1 = { x: 0, y: 0, z: 0 });
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const sx = ox + e.rx * lado * MEIO_OMBRO, sy = oy + e.ry * lado * MEIO_OMBRO, sz = oz + e.rz * lado * MEIO_OMBRO;
    // espera: à frente da cintura (repouso, só no desenho do fim: braço caído ao lado do corpo)
    const ex = sx + g.fx * 0.3 * (1 - repouso) - e.ux * (0.25 + 0.27 * repouso);
    const ey = sy - e.uy * (0.25 + 0.27 * repouso);
    const ez = sz + g.fz * 0.3 * (1 - repouso) - e.uz * (0.25 + 0.27 * repouso);
    // a bola, com as palmas dos dois lados (ao longo da direita do corpo)
    const bxp = alvoX + e.rx * lado * 0.12, byp = alvoY + e.ry * lado * 0.12, bzp = alvoZ + e.rz * lado * 0.12;
    let tx = ex + (bxp - ex) * braco, ty = ey + (byp - ey) * braco, tz = ez + (bzp - ez) * braco;
    const dx = tx - sx, dy = ty - sy, dz = tz - sz, d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d > ARM) { tx = sx + (dx / d) * ARM; ty = sy + (dy / d) * ARM; tz = sz + (dz / d) * ARM; }
    const o = p === 0 ? o0 : o1, mm = p === 0 ? m0 : m1;
    o.x = sx; o.y = sy; o.z = sz;
    mm.x = tx; mm.y = Math.max(0.05, ty); mm.z = tz;
  }
  return out;
}

const _qm = {}, _mm = {};

/**
 * Passo do corpo do goleiro na defesa desenhada (no lugar de passoCorpo): o centro, a velocidade e o rumo
 * vêm do quadro do PRÓXIMO tick (o estado que este passo deixa).
 */
export function passoMergulho(m, j) {
  const g = j.mergulho;
  const q = quadroMergulho(g, m.tick + 1, _qm);
  j.vx = (q.x - j.x) / DT; j.vz = (q.z - j.z) / DT;
  j.x = q.x; j.z = q.z;
  j.rumo = MD.atan2(g.fz, g.fx); j.giro = 0; j.ax = 0; j.az = 0; j.inv = false;
}

/** Recoloca o corpo no quadro depois das trombadas (o mergulho não é empurrado de lado). */
export function fixarMergulho(m, j) {
  const q = quadroMergulho(j.mergulho, m.tick + 1, _qm);
  j.x = q.x; j.z = q.z;
}

/**
 * Pés do goleiro na defesa desenhada (no lugar da passada): plantado = o ponto do quadro; no ar = o pé
 * desenhado (tx, ty, tz) no ponto do quadro. No fim os dois ficam plantados debaixo do quadril.
 */
export function pesMergulho(m, j) {
  const g = j.mergulho;
  const q = quadroMergulho(g, m.tick + 1, _qm);
  for (let p = 0; p < 2; p++) {
    const pe = j.pes[p], a = p === 0 ? q.a0 : q.a1, apoio = p === 0 ? q.apoio0 : q.apoio1;
    if (apoio) {
      if (!pe.apoio || pe.x !== a.x || pe.z !== a.z) {
        pe.apoio = true; pe.x = a.x; pe.z = a.z; pe.rumo = j.rumo; pe.faseApoio = j.fase - (p === 0 ? 0 : 1);
        pe.lx = a.x; pe.lz = a.z; pe.lrumo = j.rumo; pe.bx = a.x; pe.bz = a.z; pe.gx = a.x; pe.gz = a.z;
        pe.chegou = false; pe.pendente = false; pe.k = 0; pe.puxa = 0;
      }
    } else pe.apoio = false;
    pe.tx = a.x; pe.ty = a.y; pe.tz = a.z;
  }
  if (m.tick + 1 >= g.fim) { j.vx = 0; j.vz = 0; }
}

/** Centro da bola nas mãos do goleiro na defesa desenhada (no tick) em `out`, ou null fora dela. */
export function bolaNasMaosMergulho(j, tick, out) {
  const g = j.mergulho;
  if (!g || g.tc == null || !(tick > g.tick0 && tick <= g.fim)) return null;
  const q = quadroMergulho(g, tick, _qm);
  const mm = maosMergulho(g, q, _mm, 0, true);
  out.x = (mm.m0.x + mm.m1.x) / 2; out.y = Math.max(0.12, (mm.m0.y + mm.m1.y) / 2); out.z = (mm.m0.z + mm.m1.z) / 2;
  return out;
}
