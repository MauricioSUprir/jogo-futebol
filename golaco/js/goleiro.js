// Goleiro (Etapa 2): posicionamento na bissetriz do ângulo bola–traves, leitura do chute (onde
// e quando a bola passa pelo plano do goleiro), tempo de reação pelo atributo, mergulho com
// alcance real, encaixe ou espalmada, bola nas mãos e reposição, e saída (botão GOLEIRO
// segurado ou 1×1). Puro: sem three.js nem DOM; sorteios pelo gerador do mundo.

import { GOLEIRO, CAMPO, PASSO, BOLA, BOTAO, JOGADOR, G, BARREIRA } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { uniforme } from './rng.js';
import { criarBola, passoBola, chutar } from './bola.js';
import { maoPermitida, registrarToque } from './regras-goleiro.js';
import { preverBola } from './conducao.js';

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
 * ajustada pelos atributos, e zero além do alcance físico (com folga). `partida`: soma GOLEIRO.logit.c0Partida
 * (o equilíbrio da partida; o treino não muda).
 */
export function chanceDefesa(lateral, dChute, altura, alcance, attr, partida = false, tVoo = null, c0Partida = null) {
  const L = GOLEIRO.logit;
  const nivel = ((attr.reflexo + attr.mergulho + attr.posicionamento) / 3 - 72) / 100;
  // (c0Partida: o do pênalti, GOLEIRO.penalti.c0Partida — a calibração dele é a própria)
  let lg = L.c0 + (partida ? (c0Partida ?? L.c0Partida) : 0) + L.cLat * lateral + L.cDist * dChute + L.cAlt * altura + L.attr * nivel;
  // (partida) a bola bem mais lenta que um chute da mesma distância (cabeceio, chute fraco, desvio) dá ao goleiro o tempo a
  // mais: a logística foi ajustada com chutes (~20 m/s); cTempo por s além de dChute / vRef
  if (partida && tVoo != null) lg += L.cTempo * Math.max(0, tVoo - dChute / L.vRef);
  // (partida) de longe a logística do treino defendia demais para os gols de fora da área (GOLEIRO.logit.cLongePartida)
  if (partida && L.cLongePartida) lg += L.cLongePartida * Math.max(0, dChute - L.dLonge);
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
  // lê uma vez por chute — e de novo se a bola desviou num corpo depois da leitura (sim.js colisaoBolaCorpo grava
  // m.desvio): a defesa nova parte do desvio, com o tempo de reação inteiro (o desvio engana o goleiro)
  if (j.defesa && j.defesa.chave === m.voo?.tickChave && !(m.desvio > j.defesa.lido)) return;
  // onde a bola cruza a linha do gol e o plano do goleiro
  const linha = preverPassagem(b, gx, 150);
  if (!linha) return;
  const noGol = Math.abs(linha.z) < MEIO + 0.25 && linha.y < CAMPO.gol.altura + 0.25;
  if (!noGol) { j.defesa = { chave: m.voo?.tickChave, fora: true, tick: m.tick + linha.ticks, lido: m.tick }; return; }
  const xPlano = Math.abs(j.x - gx) > 0.3 ? j.x : gx - sentido * 0.3;
  const plano = preverPassagem(b, xPlano, 150) ?? linha;
  const a = j.par.attr;
  const reac = Math.round(lerp(GOLEIRO.reacao[0], GOLEIRO.reacao[1], a.reflexo / 100) / DT);
  // pênalti (Regra 14): o goleiro já escolheu o lado antes do chute (j.palpite, z do mergulho; partida.js). Lado certo:
  // sai antes (GOLEIRO.penalti.antecipa s a mais); lado errado ou parado no meio com a bola no canto: não chega
  const pen = m.partida?.penaltiAberto;
  const ehPenalti = !!pen && j.palpite != null && m.voo && m.voo.de === pen.id && j.time !== pen.time && m.tick - pen.tick < 90;
  // Panenka (a cavadinha do pênalti; acoes.js): a bola lenta leva ~1,3–1,6 s até ele (o chute, ~0,4–0,6 s)
  const panenka = ehPenalti && m.voo.tipo === 'cavadinha';
  let palpiteErrado = false, mergulhou = false;
  if (ehPenalti) {
    // o lado escolhido é do GOL (o meio dele, z = 0), não de onde o goleiro está: com o analógico segurado antes do
    // chute ele andava até |z| ~3,3 e a bola no lado certo (entre ele e o meio) contava como lado errado — gol certo
    const zg = j.palpite, P = GOLEIRO.penalti;
    palpiteErrado = zg === 0 ? Math.abs(plano.z) > P.meio : Math.sign(plano.z) !== Math.sign(zg) && Math.abs(plano.z) > P.meio * 0.5;
    // Panenka contra quem escolheu um lado: ele já mergulhou e está no chão quando ela chega — longe do lado dele (no
    // meio), entra
    if (panenka && zg !== 0 && Math.abs(plano.z - zg) > P.meio) { palpiteErrado = true; mergulhou = true; }
  }
  // partida (Regra 12): a mão só vale na própria área, sem recuo e sem a bola que ele soltou (regras-goleiro.js) — no
  // ponto do contato. Sem ela, não há defesa com a mão: ele bloqueia com o corpo (a colisão da bola com as pernas) e
  // joga com o pé (sim.js: entra na disputa da bola livre)
  if (m.partida) {
    const c0 = bolaDepois(b, Math.max(0, plano.ticks - 1));
    if (!maoPermitida(m, j, c0.x, c0.z)) { j.defesa = { chave: m.voo?.tickChave, fora: true, semMao: true, tick: m.tick + plano.ticks, lido: m.tick }; return; }
  }
  const tau = (plano.ticks - reac) * DT + (ehPenalti && !palpiteErrado ? GOLEIRO.penalti.antecipa : 0); // tempo para se mexer depois de reagir
  const lat = plano.z - j.z;
  const dist = Math.abs(lat);
  const alcance = alcanceGoleiro(tau, lerp(0.9, 1.08, a.mergulho / 100));
  const alturaOk = plano.y < GOLEIRO.alturaMax + (dist < 1 ? 0.2 : 0);
  const dChute = MD.hypot(b.p.x - j.x, b.p.z - j.z);
  // (o tempo de voo só conta no cabeceio a gol: GOLEIRO.logit.cTempo)
  let pDefesa = alturaOk ? chanceDefesa(dist, dChute, plano.y, alcance, a, !!m.partida, m.voo && m.voo.tipo === 'cabeceio' ? plano.ticks * DT : null,
    ehPenalti ? GOLEIRO.penalti.c0Partida : null) : 0;
  // Panenka com o goleiro que ficou no meio: tempo de sobra — pega (encaixa) a que alcança, como o recuo; a que passa
  // por cima dele ainda alta ele busca voltando para a linha (recuoBolaAlta)
  const panenkaNoMeio = panenka && !palpiteErrado && j.palpite === 0;
  // bola por cima do goleiro adiantado (cavadinha): ele volta e tenta tirar antes da linha
  const recuo = !alturaOk && (Math.abs(j.x - gx) > 2 || panenkaNoMeio) ? recuoBolaAlta(m, j, b, gx, reac) : null;
  if (recuo && m.partida && !maoPermitida(m, j, recuo.bx, recuo.bz)) { j.defesa = { chave: m.voo?.tickChave, fora: true, semMao: true, tick: m.tick + recuo.i, lido: m.tick }; return; }
  if (recuo) pDefesa = lerp(GOLEIRO.recuoDefesa[0], GOLEIRO.recuoDefesa[1], clamp(recuo.folga / 0.3, 0, 1));
  // passe do próprio time (recuo) não é chute: o goleiro recebe sempre que alcança, sem o sorteio
  // da defesa (antes ~3% dos recuos viravam gol contra quando a "defesa" sorteada falhava)
  // (partida: o cabeceio de passe de um companheiro para ele também — a mão vale depois de cabeça ou peito, Regra 12.2)
  const proprio = m.voo && m.voo.time === j.time && m.voo.tipo !== 'chute'
    && (m.voo.tipo !== 'cabeceio' || (!!m.partida && m.voo.cabeceio === 'passe'));
  if (proprio) pDefesa = alturaOk && dist <= alcance + GOLEIRO.folgaAlcance / 2 ? 1 : 0;
  if (palpiteErrado) pDefesa = 0;
  else if (panenkaNoMeio) pDefesa = recuo || (alturaOk && dist <= alcance + GOLEIRO.folgaAlcance / 2) ? 1 : 0;
  else if (ehPenalti) pDefesa *= GOLEIRO.penalti.fator; // lado certo: o pênalti no canto ainda é difícil de pegar
  const ok = uniforme(m.rng) < pDefesa;
  // segurar ou espalmar: em pé e de longe segura mais; no mergulho e de perto, espalma
  const mergulha = dist > GOLEIRO.alcanceEmPe;
  const S = GOLEIRO.segurar;
  const pSegura = proprio || panenkaNoMeio ? 1 : (mergulha ? S.mergulho : dChute < 12 ? S.perto : S.emPe) * lerp(0.85, 1.15, a.reflexo / 100);
  const encaixe = ok && uniforme(m.rng) < pSegura;
  // a bola no tick do contato (aplicarDefesa roda em defesa.tick − 1, antes de a bola andar nesse passo):
  // é onde as mãos do mergulho desenhado chegam
  const contato = bolaDepois(b, Math.max(0, plano.ticks - 1));
  // o corpo começa a se mexer GOLEIRO.leitura s antes do fim da reação da conta acima (o goleiro lê o corpo do
  // chutador: PESQUISA-RECEPCAO-GOLEIRO.md) — a chance de defesa não muda; o desenho tem tempo de chegar
  const inicio = m.tick + Math.max(1, reac - Math.round(GOLEIRO.leitura / DT));
  // pênalti no lado errado: o mergulho desenhado vai para o lado que ele escolheu (ou ele fica no meio)
  if (palpiteErrado) {
    const zg = j.palpite;
    // Panenka: o mergulho desenhado sai no tempo do pênalti (pico GOLEIRO.penalti.picoPanenka s depois do chute) para o
    // lado escolhido — não em câmera lenta até a bola chegar, nem de volta para ela — e ele fica no chão até a bola
    // passar a linha (chaoAte; iniciarMergulho): não levanta a tempo de pegá-la
    const tk = mergulhou ? m.tick + Math.min(plano.ticks, Math.round(GOLEIRO.penalti.picoPanenka / DT)) : m.tick + plano.ticks;
    j.defesa = {
      chave: m.voo?.tickChave, lido: m.tick, tick: tk, inicio: mergulhou ? m.tick + 1 : inicio, z: zg === 0 ? j.z : zg, y: 0.55,
      sucesso: false, tipo: 'falhou', mergulha: zg !== 0, proprio: false, lado: Math.sign(zg - j.z) || 1, xPlano,
      bx: mergulhou ? xPlano : contato.x, by: mergulhou ? 0.55 : contato.y, bz: mergulhou ? zg : contato.z, palpite: true,
      chaoAte: mergulhou ? m.tick + linha.ticks + Math.round(0.3 / DT) : undefined,
    };
    m.eventos.push({ tipo: 'leituraGoleiro', id: j.id, chega: false, p: 0, palpite: zg });
    return;
  }
  j.defesa = recuo ? {
    chave: m.voo?.tickChave, lido: m.tick, tick: m.tick + recuo.i, inicio, x: recuo.x, z: recuo.z, y: recuo.y,
    sucesso: ok, tipo: ok ? (encaixe ? 'encaixe' : 'espalmada') : 'falhou', mergulha: false, recuo: true, proprio,
    lado: Math.sign(recuo.z - j.z) || 1, xPlano: recuo.x, bx: recuo.bx, by: recuo.by, bz: recuo.bz,
  } : {
    chave: m.voo?.tickChave, lido: m.tick, tick: m.tick + plano.ticks, inicio, z: plano.z, y: plano.y,
    sucesso: ok, tipo: ok ? (encaixe ? 'encaixe' : 'espalmada') : 'falhou', mergulha, proprio,
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
  let px = t.p.x, py = t.p.y, pz = t.p.z;
  for (let i = 1; i <= 150; i++) {
    px = t.p.x; py = t.p.y; pz = t.p.z;
    passoBola(t, null);
    if ((t.p.x - gx) * sentido > 0) return null; // entrou (ou passou da linha)
    if (t.v.y > 0 || t.p.y > GOLEIRO.alturaMax) continue;
    if ((t.p.x - j.x) * sentido < 0) continue; // ainda na frente dele
    const tGoleiro = reac * DT + MD.hypot(t.p.x - j.x, t.p.z - j.z) / GOLEIRO.vRecuo;
    const folga = i * DT - tGoleiro;
    // (bx, by, bz: a bola no tick do contato — aplicarDefesa roda um tick antes de ela chegar ao ponto)
    if (folga >= 0) return { i, x: t.p.x, z: t.p.z, y: t.p.y, folga, bx: px, by: py, bz: pz };
  }
  return null;
}

/** Identidade da leitura (a defesa relida depois de um desvio pode ter o mesmo tick de contato da anterior). */
const idDefesa = d => (d.lido ?? -1) * 4096 + d.tick;

/** Executa a defesa no tick planejado (antes de integrar a bola). */
export function aplicarDefesa(m, j) {
  const d = j.defesa;
  if (!d || d.fora || m.tick !== d.tick - 1) return;
  // bola morta (partida: impedimento ou falta apitados com o chute no ar, a parada ainda sem cobrar — Regra 9.2): não há
  // defesa, ninguém fica com a bola; o goleiro só segue o mergulho desenhado (teste-partida C: na semente 1 o chute do
  // impedido ia para as mãos dele 30 passos antes da montagem do tiro livre)
  if (m.parada && !m.parada.rolou) { d.fora = true; return; }
  if (!d.sucesso) { m.eventos.push({ tipo: 'goleiroBatido', id: j.id }); return; }
  const b = m.bola;
  // a bola não está onde a defesa foi lida (desviou num corpo, na trave ou num domínio depois da leitura): não há
  // defesa — o goleiro foi no lugar lido (o desenho segue o quadro) e a bola segue a física; sem isso a bola ia
  // parar nas mãos de onde estivesse (até 23 m num quadro, na partida)
  if (d.bx != null && MD.hypot(b.p.x - d.bx, b.p.z - d.bz) + Math.abs(b.p.y - d.by) > GOLEIRO.desvioMax) {
    d.fora = true;
    m.eventos.push({ tipo: 'goleiroBatido', id: j.id, desvio: true });
    return;
  }
  // relida (desvio) sem tempo de começar a defesa desenhada nova: o goleiro ainda está na anterior — só defende
  // se a mão desenhada dela estiver na bola
  if (mergulhoAtivo(j, m.tick + 1) && j.mergulho.idDefesa !== idDefesa(d) && !maoNaBola(j, m.tick + 1, b.p)) {
    d.fora = true;
    m.eventos.push({ tipo: 'goleiroBatido', id: j.id, desvio: true });
    return;
  }
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
  registrarToque(m, j, 'defesa');
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
  const N = E.tentativas;
  for (let tent = 0; tent < N; tent++) {
    const abre = tent * 0.9;
    const sp = Math.min(E.vMax, Math.max(E.vMin, v * E.fracaoV)) * (1 + 0.08 * tent);
    if (b.p.y > E.alturaTravessao) {
      // por cima do travessão: sobe e vai para trás da linha
      _ve.x = sentido * sp * 0.5; _ve.y = sp * (0.8 + 0.1 * tent); _ve.z = lado * sp * (0.15 + 0.1 * tent);
    } else {
      // pela linha de fundo por fora da trave (perto da linha) ou bem aberta para o lado (longe dela); a cada
      // tentativa mais aberta e mais alta (passa por cima de quem está na área)
      const longe = dLinha > E.perto;
      const zAlvo = lado * (longe ? E.zAberta + 3 * r1 + 2 * abre : CAMPO.gol.largura / 2 + 1.0 + 1.8 * r1 + abre);
      // (disputa de pênaltis, disputa.js — só nela: o contato fica a ~0,7 m da linha, no meio do gol, e a espalmada "por
      // fora da trave" mirando atrás da linha entrava em 3 de 4; lá ela sai para o lado e para a frente, longe da linha)
      const xAlvo = longe ? gx - sentido * dLinha * 0.5 : m.disputa ? gx - sentido * (dLinha + 1.5 + 0.5 * tent) : gx + sentido * (0.6 + 0.4 * tent);
      let ux = xAlvo - b.p.x, uz = zAlvo - b.p.z;
      const l = MD.hypot(ux, uz) || 1;
      ux /= l; uz /= l;
      _ve.x = ux * sp; _ve.z = uz * sp; _ve.y = 1 + 1.5 * r2 + 0.25 * tent;
    }
    if (espalmadaSegura(b, gx, sentido) || tent === N - 1) break;
  }
  chutar(b, _ve, _w0);
  b.rolando = false;
}

/**
 * A bola saindo com _ve fica fora do perigo? Não entra no gol e, depois de sair das mãos (E.tSai s), não fica
 * jogável na zona perigosa — à frente do gol, a menos de zonaX da linha e |z| < zonaZ, abaixo de jogavelAlt e
 * mais lenta que jogavelV (onde um atacante a pega no rebote) — nos E.tConfere s seguintes.
 */
function espalmadaSegura(b, gx, sentido) {
  const E = GOLEIRO.espalmada, c = _be;
  Object.assign(c.p, b.p); c.v.x = _ve.x; c.v.y = _ve.y; c.v.z = _ve.z; c.w.x = 0; c.w.y = 0; c.w.z = 0; c.rolando = false;
  const n = Math.round(E.tConfere / DT), n0 = Math.round(E.tSai / DT);
  for (let i = 1; i <= n; i++) {
    passoBola(c, null);
    // passou da linha de fundo (gol contra ou escanteio) ou da lateral: decidido
    if ((c.p.x - gx) * sentido > 0) return !(Math.abs(c.p.z) < CAMPO.gol.largura / 2 + 0.15 && c.p.y < CAMPO.gol.altura + 0.15);
    if (Math.abs(c.p.z) > CAMPO.meioZ) return true;
    if (i < n0) continue;
    if (c.p.y < E.jogavelAlt && Math.abs(gx - c.p.x) < E.zonaX && Math.abs(c.p.z) < E.zonaZ && MD.hypot(c.v.x, c.v.z) < E.jogavelV) return false;
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
  let olhar = MD.atan2(b.p.z - j.z, b.p.x - j.x);
  if (comBolaNaMao(m, j)) return { dx: -sentido, dz: 0, vel: 0, rumoAlvo: MD.atan2(0, -sentido) };
  const d = j.defesa;
  // chute vindo: de frente para o chute (de onde a bola veio, até ~35° do campo), sem ir virando atrás da
  // bola que passa do lado dele — o mergulho sai de frente para o campo (iniciarMergulho)
  if (d && !d.fora && d.sucesso !== undefined && m.tick < d.tick + 6 && b.v.x * sentido > 5) {
    const campo = sentido > 0 ? Math.PI : 0;
    olhar = campo + clamp(difAng(campo, MD.atan2(-b.v.z, -b.v.x)), -0.6, 0.6);
  }
  if (d && d.sucesso !== undefined && !d.fora && m.tick >= d.inicio && m.tick < d.tick + 6) {
    // defesa desenhada (mergulho, salto ou em pé): começa uma vez por leitura, no máximo antecipaMergulho s
    // antes do contato (antecipaSalto na bola por cima dele), e daí o corpo anda pela conta do mergulho
    // (sim.js passoMergulho); batido, ele tenta e a mão fica curta. Antes disso, anda de lado para a linha da
    // bola (batido, para a ~1,2 m dela) — ou, na bola por cima, volta correndo para onde ela desce
    if (!j.mergulho || j.mergulho.idDefesa !== idDefesa(d)) {
      const falta = (d.tick - 1 - m.tick) * DT;
      if (d.recuo) {
        if (falta > GOLEIRO.antecipaSalto) {
          const dx = d.x - j.x, dz = d.z - j.z, dd = MD.hypot(dx, dz) || 1;
          const v = Math.min(GOLEIRO.vRecuo * (d.sucesso ? 1 : 0.8), dd / Math.max((d.tick - m.tick) * DT, 0.05));
          return { dx: dx / dd, dz: dz / dd, vel: v, rumoAlvo: olhar };
        }
      } else if (falta > GOLEIRO.antecipaMergulho) {
        const alvoZ = d.sucesso ? d.z : (Math.abs(d.z - j.z) > 1.2 ? d.z - d.lado * 1.2 : j.z);
        const dz = alvoZ - j.z;
        const v = Math.min(GOLEIRO.vLado, Math.abs(dz) / Math.max(falta, 0.05));
        return { dx: 0, dz: Math.sign(dz) || 1, vel: Math.abs(dz) > 0.05 ? v : 0, rumoAlvo: olhar };
      }
      const g = iniciarMergulho(m, j, d);
      if (g) g.idDefesa = idDefesa(d);
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
  // posição: bissetriz, mais adiantado com a bola longe (cruzamento do adversário no ar: a do ponto onde ela desce para a
  // cabeça — GOLEIRO.leCruzamento)
  const pc = pontoDoCruzamento(m, j, gx);
  const bx = pc ? pc.x : b.p.x, bz = pc ? pc.z : b.p.z;
  const dBola = MD.hypot(bx - gx, bz);
  const P = GOLEIRO.profundidade;
  const dLinha = dBola <= 20 ? lerp(P[0], P[1], clamp((dBola - 6) / 14, 0, 1))
    : lerp(P[1], GOLEIRO.profundidadeLonge, clamp((dBola - 20) / 20, 0, 1));
  const p = pontoBissetriz(bx, bz, gx, dLinha);
  // tiro livre com barreira (Etapa 4): ela tapa o lado do 1º pau; o goleiro fica para o lado do 2º
  const pr = m.parada;
  const pz = pr && !pr.rolou && pr.barreira && pr.barreira.n > 0 && pr.time !== j.time ? p.z + pr.barreira.ladoLongo * BARREIRA.goleiro : p.z;
  const dx = p.x - j.x, dz = pz - j.z;
  const dd = MD.hypot(dx, dz);
  const vel = Math.min(4.5, dd * 3);
  return { dx: dd > 1e-6 ? dx / dd : 0, dz: dd > 1e-6 ? dz / dd : 0, vel, rumoAlvo: olhar };
}

const _pc = { x: 0, z: 0 };
/**
 * Cruzamento (ou lançamento) do adversário no ar: o ponto em que a bola desce para a altura da cabeça
 * (GOLEIRO.leCruzamento.y) perto do meu gol, pela física do jogo (conducao.js preverBola) — {x, z} reaproveitado, ou null.
 */
function pontoDoCruzamento(m, j, gx) {
  const v = m.voo, b = m.bola, L = GOLEIRO.leCruzamento;
  if (!v || v.time === j.time || (v.tipo !== 'cruzamento' && v.tipo !== 'lancamento') || m.posse != null || m.naMao != null || b.p.y <= 1) return null;
  const { xs, zs, ys } = preverBola(b, L.ticks);
  for (let i = 1; i <= L.ticks; i++) {
    if (ys[i] > L.y || ys[i] >= ys[i - 1]) continue;
    if (Math.abs(xs[i] - gx) > L.dist || Math.abs(zs[i]) > L.dist) return null;
    _pc.x = xs[i]; _pc.z = zs[i];
    return _pc;
  }
  return null;
}

/**
 * Bola nas mãos acompanha o goleiro: no encaixe da defesa desenhada, as mãos do quadro do próximo tick; de pé,
 * BM.frente m à frente na altura BM.altura (anim.js põe as palmas dos dois lados dela). A diferença de quando
 * ele a pegou (bola solta a até 1 m do centro, tiro de meta no chão) some a BM.vJunta m/s — sem salto de bola.
 */
export function bolaNaMao(m, j) {
  const b = m.bola;
  let alvo = bolaNasMaosMergulho(j, m.tick + 1, _alvoMao);
  if (!alvo) {
    alvo = _alvoMao;
    alvo.x = j.x + MD.cos(j.rumo) * BM.frente;
    alvo.z = j.z + MD.sin(j.rumo) * BM.frente;
    alvo.y = BM.altura;
  }
  const s = j.segura ?? (j.segura = { desde: m.tick });
  const o = s.off ?? (s.off = { x: b.p.x - alvo.x, y: b.p.y - alvo.y, z: b.p.z - alvo.z });
  const d = Math.sqrt(o.x * o.x + o.y * o.y + o.z * o.z), passo = BM.vJunta * DT;
  if (d <= passo) { o.x = 0; o.y = 0; o.z = 0; } else { const k = (d - passo) / d; o.x *= k; o.y *= k; o.z *= k; }
  b.p.x = alvo.x + o.x; b.p.y = alvo.y + o.y; b.p.z = alvo.z + o.z;
  b.v.x = 0; b.v.y = 0; b.v.z = 0;
  b.rolando = false;
}
const _alvoMao = { x: 0, y: 0, z: 0 };

/**
 * Na defesa desenhada: uma das mãos do quadro do tick a ≤ GOLEIRO.pegaMergulho m da bola (só assim ele pega a
 * bola solta no meio do mergulho; antes a bola a 1 m do centro ia parar nas mãos num quadro).
 */
export function maoNaBola(j, tick, p) {
  const q = quadroMergulho(j.mergulho, tick, _qPega);
  const mm = maosMergulho(j.mergulho, q, _mPega, false);
  const a = mm.m0, c = mm.m1;
  const ax = a.x - p.x, ay = a.y - p.y, az = a.z - p.z, cx = c.x - p.x, cy = c.y - p.y, cz = c.z - p.z;
  const d0 = ax * ax + ay * ay + az * az, d1 = cx * cx + cy * cy + cz * cz;
  return Math.min(d0, d1) <= GOLEIRO.pegaMergulho * GOLEIRO.pegaMergulho;
}
const _qPega = {}, _mPega = {};

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
// do tronco, o rumo e os pés saem de uma função do tempo (quadroMergulho) — a simulação anda o corpo por ela
// e a animação (anim.js poseMergulho) desenha pela MESMA conta: o corpo nunca "desliza em pé" e a mão chega à
// bola no tick do contato. Matemática pelo MD: os pés plantados no fim e a bola nas mãos entram no estado
// (hash Node = navegador).
//
// Limites físicos (contraprova de 10/10: com pouco tempo o centro andava até 64 m/s e o tronco virava 90° num
// quadro): o centro de massa vai no máximo GOLEIRO.mergulho.vPico de lado e vFrente para a frente (perfil
// Hermite, conferido amostrando a velocidade), o tronco inclina no máximo `giro` rad/s, curva `dobra` rad/s e o
// quadril sobe no máximo `sobe` m/s; o centro nunca chega a menos de `margemLinha` da linha do gol. O "lado"
// do mergulho é a linha do gol (o corpo de frente para o campo; o tronco gira até lá em `tGiro`), nunca para
// dentro do gol. Defesa que o corpo desenhado não alcança (a mão a mais de `maoOk` da bola, ou a mão teria de
// andar mais rápido que `vMao`) vira goleiro batido: o resultado é o que o jogador vê. Batido com pouco
// tempo, ele mergulha atrasado (o pico `tMinFalha` s depois de começar, com a bola já passando). Rebote: a
// defesa nova parte do quadro em andamento (deitado, ele só alcança o que dá dali).
//
// O mergulho é uma "prancha": no pico, pés (fora do chão), quadril, ombros e mãos ficam quase numa linha que
// aponta para a bola (Spratford: o corpo estendido no voo); o quadril anda de lado o bastante para os pés não
// serem jogados para trás. Depois do contato ele cai de lado, fica no chão e levanta com os pés plantando
// debaixo do quadril.
//
// j.mergulho = {tick0, tc (tick do contato = defesa.tick − 1), tp (tick do pico desenhado: tc, ou mais tarde
//   no batido atrasado), T (s do começo ao pico), tipo: 'mergulho'|'salto'|'baixa'|'peito', sucesso, encaixe,
//   x0, z0 (centro no começo), fx, fz (frente final: o campo), lx, lz (lado do mergulho, na linha do gol),
//   ladoS (l = ladoS·(−fz, fx)), rF (rumo final), dYaw (rumo do começo − rF), tGiro, sC, fC (quanto o centro
//   anda de lado e para a frente até o pico), hC, hLow (quadril no pico e no fim da impulsão), phi0, phiC
//   (inclinação do tronco de lado no começo e no pico: 0 = de pé, π/2 = deitado de lado), th0, thC (para a
//   frente), v0L, v0F (velocidade do corpo no começo), h0, bx, by, bz (a bola no contato), ext (1 = o braço
//   chega à bola), tImp (s de impulsão), tq (s do pico até cair), tChao (s deitado: GOLEIRO.mergulho.tChao, ou até a
//   Panenka passar — defesa.chaoAte), vc, sFim, sLev, fim (tick em que está de pé de novo), pe0 [{x, z, y, ar}], perto (o pé do lado do mergulho), passo, pmL, pmF, pf [{x, z}], passa,
//   durPasso, iniPasso (defesa em pé: o pé que dá um passo curto até a base), rebote (começou no meio de outra
//   defesa), rebaixada (o sorteio dava defesa, mas o corpo não alcançava), lado, alt, ate, idDefesa}

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
const BASE_EM_PE = 0.16;     // m do centro a cada pé na base da defesa em pé
const MG = GOLEIRO.mergulho;
const BM = GOLEIRO.bolaMao;
const MEIO_PI = 1.5707963267948966;
const PI = 3.141592653589793;

const sm = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const cl = (v, a, b) => (v < a ? a : v > b ? b : v);

/**
 * Eixos do corpo: cima do tronco (u) inclinado phi para o lado (F.lx, F.lz) e th para a frente (F.fx, F.fz), e a
 * direita do corpo (r = frente × cima, normalizada). F = o quadro (frente/lado do tick) ou um quadro fixo.
 */
function eixos(F, phi, th, e) {
  const c = MD.cos(phi), s = MD.sin(phi), ct = MD.cos(th), st = MD.sin(th);
  e.ux = F.lx * s * ct + F.fx * st; e.uy = c * ct; e.uz = F.lz * s * ct + F.fz * st;
  const rx = -F.fz * e.uy, ry = F.fz * e.ux - F.fx * e.uz, rz = F.fx * e.uy;
  const n = Math.sqrt(rx * rx + ry * ry + rz * rz) || 1;
  e.rx = rx / n; e.ry = ry / n; e.rz = rz / n;
  return e;
}
const _e = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 }, _ec = { ux: 0, uy: 0, uz: 0, rx: 0, ry: 0, rz: 0 };

/** Eixos do corpo no quadro q do mergulho g (para a animação: a mesma conta). */
export function eixosMergulho(g, q, e) { return eixos(q, q.phi, q.th, e); }

/** Rumo, frente e lado do corpo no tempo t: do rumo do começo ao final (de frente para o campo) em tGiro. */
function frameDo(g, t, q) {
  if (g.dYaw === 0 || t >= g.tGiro) { q.yaw = g.rF; q.fx = g.fx; q.fz = g.fz; q.lx = g.lx; q.lz = g.lz; return q; }
  const yaw = g.rF + g.dYaw * (1 - sm(t / g.tGiro));
  const c = MD.cos(yaw), s = MD.sin(yaw);
  q.yaw = yaw; q.fx = c; q.fz = s; q.lx = -s * g.ladoS; q.lz = c * g.ladoS;
  return q;
}

/**
 * Faixa do deslocamento final X para o perfil x(t) = X·S(u) + v0·H0(u) (u = t/T; S = 2u² − u³; H0 =
 * (u³ − 2u² + u)·T: sai com v0 e chega com X/T) ter |velocidade| ≤ vMax em todo o caminho. Em `out` {lo, hi}.
 */
function faixaDesloc(v0, T, vMax, out) {
  let lo = -Infinity, hi = Infinity;
  for (let k = 1; k <= 20; k++) {
    const u = k / 20;
    const a = 4 * u - 3 * u * u;
    const c = v0 * T * (3 * u * u - 4 * u + 1);
    const l = (-vMax * T - c) / a, h = (vMax * T - c) / a;
    if (l > lo) lo = l;
    if (h < hi) hi = h;
  }
  if (lo > hi) { const mid = (lo + hi) / 2; lo = mid; hi = mid; }
  out.lo = lo; out.hi = hi;
  return out;
}
const _fS = { lo: 0, hi: 0 }, _fF = { lo: 0, hi: 0 };

/** Inclinação do tronco preferida pela altura da bola: rasteira = quase deitado; alta = ainda bem inclinado. */
function inclinacaoPelaAltura(bY) {
  if (bY <= 0.6) return 1.40;
  if (bY <= 1.4) return 1.40 - (0.32 * (bY - 0.6)) / 0.8;
  return cl(1.08 - 0.3 * (bY - 1.4), 0.85, 1.08);
}

/**
 * Pose do mergulho no pico (a prancha): inclinação phi (entre phiLo e phiHi — o que o tronco gira no tempo),
 * quadril (s de lado, entre sLo e sHi — o que o centro anda no tempo; h até hMax — o que sobe) para o ombro do
 * meio ficar a um braço da bola (bL de lado, bY de altura), com o pé de baixo fora do chão e os pés no máximo
 * ATRAS para trás do pé mais adiantado (peL).
 */
function resolverMergulho(bL, bY, peL, sLo, sHi, phiLo, phiHi, hMax) {
  const phiH = cl(inclinacaoPelaAltura(bY), phiLo, phiHi);
  let melhor = Infinity, rPhi = phiH, rH = H_PE, rS = 0;
  const N = 24;
  for (let k = 0; k <= N; k++) {
    const phi = phiLo + ((phiHi - phiLo) * k) / N;
    const s = MD.sin(phi), c = MD.cos(phi);
    for (let ia = 0; ia < 4; ia++) {
      const a = 0.3 + 0.06 * ia;
      let sC = bL - (TRONCO_OMBRO + a) * s;
      let hC = bY - (TRONCO_OMBRO + a) * c;
      const peBaixo = hC - MEIO_QUADRIL * s - 0.03 * c - PERNA * c - DESCE_PERNA * s;
      if (peBaixo < PE_NO_AR) hC += PE_NO_AR - peBaixo;
      const pes = sC - PERNA * s;
      if (pes < peL - ATRAS) sC += peL - ATRAS - pes;
      sC = cl(sC, sLo, sHi);
      hC = cl(hC, H_CHAO, hMax);
      const oL = sC + TRONCO_OMBRO * s, oY = hC + TRONCO_OMBRO * c;
      const dBr = Math.sqrt((bL - oL) * (bL - oL) + (bY - oY) * (bY - oY));
      const custo = Math.abs(phi - phiH) + 3 * Math.max(0, dBr - 0.48) + 2 * Math.max(0, hC - 1.45) + 0.3 * (0.48 - a);
      if (custo < melhor) { melhor = custo; rPhi = phi; rH = hC; rS = sC; }
    }
  }
  return { phi: rPhi, h: rH, s: rS };
}

/**
 * Defesa em pé (baixa / peito): o quadril vai um pouco para o lado e para a frente, agacha e o tronco curva
 * sobre a bola (th) até o ombro do meio ficar a ~0,38 m dela. Os pés: fica plantado o que está no chão perto do
 * corpo; o outro (no ar, ou longe — vinha de um passo de lado largo) dá um passo curto até a base debaixo do
 * quadril. As pernas alcançam os pés em toda a defesa. Limites do tempo: s em [sLo, sHi], f em [fLo, fHi],
 * phi até phiMax, th até thMax, quadril até hMin.
 */
const _gR = { lx: 0, lz: 0, fx: 0, fz: 0 };
function resolverEmPe(j, pe0, lx, lz, fx, fz, bL, bF, bY, sLo, sHi, fLo, fHi, phiMax, thMax, hMin) {
  _gR.lx = lx; _gR.lz = lz; _gR.fx = fx; _gR.fz = fz;
  const phi = cl(bL * 0.5, 0, Math.min(0.35, phiMax));
  const sC = cl(cl(bL - 0.3, 0, 0.3), sLo, sHi), fC = cl(cl(bF - 0.3, -0.25, 0.25), fLo, fHi);
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
    if (h < hMin && ih > 0) break;
    for (let it = 0; it <= 26; it++) {
      const th = 0.05 * it;
      if (th > thMax && it > 0) break;
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

const _qAnt = {}, _qChk = {}, _mChk = {}, _mAnt = {};

/**
 * Começa a defesa desenhada de j para a leitura d (lerChute) no tick de agora. O tipo sai da bola no contato:
 * alta perto do corpo → salto; baixa ou no peito e perto → em pé; senão → mergulho (no chão, num rebote:
 * sempre o mergulho, do quadro em andamento). Calcula a pose do pico (na defesa a mão chega à bola; batido,
 * ele tenta e fica curto) dentro dos limites físicos e onde os pés plantam no fim. A defesa sorteada que o
 * corpo desenhado não alcança vira goleiro batido (d.sucesso = false).
 */
export function iniciarMergulho(m, j, d) {
  const t0 = m.tick;
  const tc = Math.max(t0 + 1, d.tick - 1);
  const gx = linhaDoGol(m, j), sentido = gx > 0 ? 1 : -1;
  // rebote: a defesa nova parte do quadro em andamento (o goleiro ainda no chão), nunca de um salto de pose
  const ant = j.mergulho && j.mergulho.tc != null && mergulhoAtivo(j, t0) ? quadroMergulho(j.mergulho, t0, _qAnt) : null;
  // e as mãos também: saem de onde estavam (em relação ao ombro) e vão às da defesa nova em tMaoRebote s
  const mAnt = ant ? maosMergulho(j.mergulho, ant, _mAnt, m.naMao === j.id) : null;
  const mao0 = mAnt ? [{ x: mAnt.m0.x - mAnt.o0.x, y: mAnt.m0.y - mAnt.o0.y, z: mAnt.m0.z - mAnt.o0.z },
    { x: mAnt.m1.x - mAnt.o1.x, y: mAnt.m1.y - mAnt.o1.y, z: mAnt.m1.z - mAnt.o1.z }] : null;
  // a frente final: o campo; o lado: a linha do gol, para o lado da bola (nunca para dentro do gol)
  const fx = -sentido, fz = 0;
  // pênalti no lado errado (d.palpite): o mergulho desenhado vai para o lado que ele ESCOLHEU (d.z), não para o da bola —
  // quem erra o lado vê o goleiro cair do outro lado (antes ele mergulhava certo e tomava o gol assim mesmo)
  const relX = d.bx - j.x, relZ = (d.palpite ? d.z : d.bz) - j.z;
  const lz = Math.abs(relZ) > 0.05 ? (relZ > 0 ? 1 : -1) : ((d.lado || 1) > 0 ? 1 : -1), lx = 0;
  const ladoS = lz * fx; // (lx, lz) = ladoS·(−fz, fx)
  const r0 = ant ? ant.yaw : j.rumo;
  const rF = MD.atan2(fz, fx);
  const dYaw = difAng(rF, r0);
  const bL = lx * relX + lz * relZ, bF = fx * relX + fz * relZ, bY = d.by;
  // velocidade do corpo no começo (vinha andando de lado, ou o quadro anterior): o perfil do centro parte dela
  const v0L = j.vx * lx + j.vz * lz, v0F = j.vx * fx + j.vz * fz;
  const h0 = ant ? ant.h : (j.quadril ?? H_PE);
  const mesmoLado = ant ? ant.lx * lx + ant.lz * lz >= 0 : true;
  // de pé: o tronco parte da inclinação da pose de pé (anim.js pose: a mesma conta, pelo MD) — de lado (roll,
  // na direita do corpo = ladoS·lado do mergulho) e para a frente (pitch): sem salto de pose no 1º quadro
  let phi0 = 0, th0 = 0;
  if (ant) { phi0 = mesmoLado ? ant.phi : -ant.phi; th0 = ant.th; }
  else {
    const hf = MD.cos(j.rumo), hz = MD.sin(j.rumo);
    const af = j.ax * hf + j.az * hz, al = -j.ax * hz + j.az * hf;
    th0 = cl(0.03 + 0.022 * MD.hypot(j.vx, j.vz) + MD.atan2(af, G) * 0.8, -0.3, 0.42);
    phi0 = ladoS * cl(MD.atan2(al, G) * 0.7, -0.35, 0.35);
  }
  const emPeAgora = !ant || (h0 >= H_PE - 0.1 && Math.abs(phi0) < 0.2);
  // pés no começo: o plantado onde está; o que está no ar continua de onde estava desenhado
  const pe0 = [0, 1].map(p => (j.pes[p].apoio ? { x: j.pes[p].x, z: j.pes[p].z, y: TORN, ar: false } : { x: j.pes[p].tx, z: j.pes[p].tz, y: j.pes[p].ty, ar: true }));
  const perto = (pe0[1].x - pe0[0].x) * lx + (pe0[1].z - pe0[0].z) * lz >= 0 ? 1 : 0;
  const pmX = (pe0[0].x + pe0[1].x) / 2 - j.x, pmZ = (pe0[0].z + pe0[1].z) / 2 - j.z;
  const pmL = pmX * lx + pmZ * lz;
  let tipo;
  if (!emPeAgora) tipo = 'mergulho';
  else if (bY > 1.75 && bL < 0.8) tipo = 'salto';
  else if (bL < 0.75 && bY <= 0.6) tipo = 'baixa';
  else if (bL < 0.65 && bY <= 1.75) tipo = 'peito';
  else tipo = 'mergulho';
  // distância do centro à linha do gol (o centro não chega a menos de margemLinha dela)
  const distLinha = (gx - j.x) * sentido;

  const montar = (sucesso) => {
    // batido com pouco tempo: ele mergulha atrasado (o pico depois de a bola passar), sem correr a 60 m/s
    const tp = sucesso ? tc : Math.max(tc, t0 + Math.round(MG.tMinFalha / DT));
    const T = (tp - t0) * DT;
    const alvoL = sucesso ? bL : Math.max(0, bL - 0.4);
    const ext = sucesso ? 1 : 0.8;
    const fS = faixaDesloc(v0L, T, MG.vPico, _fS), fF = faixaDesloc(v0F, T, MG.vFrente, _fF);
    const sLo = fS.lo, sHi = fS.hi;
    let fLo = Math.max(fF.lo, MG.margemLinha - distLinha);
    const fHi = fF.hi;
    if (fLo > fHi) fLo = fHi;
    const giroMax = 0.75 * MG.giro * T, dobraMax = (MG.dobra * T) / 1.5;
    let tImp = !emPeAgora ? DT : tipo === 'mergulho' ? cl(T - 0.12, 0.05, 0.16) : cl(T - 0.1, 0.05, 0.14);
    if (tImp > T) tImp = T;
    let phiC = 0, thC = 0, hC = H_PE, sC = 0, fC = 0, emPe = null, hLow = h0;
    if (tipo === 'mergulho') {
      hLow = emPeAgora ? h0 - 0.1 : h0;
      const hMax = hLow + (MG.sobe * Math.max(0, T - tImp) * 2) / PI;
      fC = cl(cl(bF - 0.1, -0.6, 0.6), fLo, fHi);
      // os pés no voo não ficam mais que ATRAS para trás do pé que está mais adiantado para o lado da bola
      const peL = Math.max((pe0[0].x - j.x) * lx + (pe0[0].z - j.z) * lz, (pe0[1].x - j.x) * lx + (pe0[1].z - j.z) * lz);
      const r = resolverMergulho(alvoL, bY, peL, sLo, sHi, cl(phi0 - giroMax, -MEIO_PI, MEIO_PI), cl(phi0 + giroMax, 0, 1.5), Math.max(hLow, hMax));
      phiC = r.phi; hC = r.h; sC = r.s;
    } else if (tipo === 'salto') {
      hLow = h0 - 0.15;
      const hMax = hLow + (MG.sobe * Math.max(0, T - tImp) * 2) / PI;
      phiC = cl(bL * 0.35, 0, Math.min(0.35, giroMax));
      const oY = TRONCO_OMBRO * MD.cos(phiC) - MEIO_OMBRO * MD.sin(phiC);
      hC = Math.min(cl(bY - 0.3 - oY, H_PE, H_PE + MG.saltoMax), Math.max(hLow, hMax));
      // a bola atrás dele (cavadinha, bola por cima): o salto continua a volta para o gol
      fC = cl(d.recuo ? bF - 0.1 : cl(bF - 0.3, -0.3, 0.3), fLo, fHi);
      const sL = TRONCO_OMBRO * MD.sin(phiC) + MEIO_OMBRO * MD.cos(phiC);
      const dY = bY - (hC + oY), dF = bF - fC;
      const alcL = Math.sqrt(Math.max(0, (ARM - 0.05) * (ARM - 0.05) - dY * dY - dF * dF));
      sC = cl(cl(alvoL - sL - alcL, 0, 0.6), sLo, sHi);
    } else {
      emPe = resolverEmPe(j, pe0, lx, lz, fx, fz, alvoL, bF, bY, sLo, sHi, fLo, fHi, giroMax, dobraMax, h0 - (MG.agacha * T) / 1.5);
      phiC = emPe.phi; thC = emPe.th; hC = emPe.h; sC = emPe.s; fC = emPe.f;
    }
    const vc = T > 0 ? sC / T : 0;
    let tq = 0, fim, sFim, fFim = fC, passo = 0, tChao = MG.tChao;
    if (tipo === 'mergulho') {
      // queda pela gravidade, e o tronco não gira mais rápido que `giro` até deitar
      tq = Math.max(cl(Math.sqrt((2 * Math.max(0.05, hC - H_CHAO)) / 9.81) * 1.1, 0.15, 0.4), (1.5 * Math.abs(MEIO_PI - phiC)) / MG.giro);
      sFim = sC + vc * tq * 0.5;
      // d.chaoAte (Panenka no meio contra quem mergulhou: lerChute): fica no chão até a bola passar (não levanta e a pega)
      if (d.chaoAte != null) tChao = Math.max(MG.tChao, (d.chaoAte - tp) * DT - tq);
      fim = tp + Math.round((tq + tChao + MG.tLevanta) / DT);
      // o passo do pé do lado da bola na impulsão: menor quando os pés ficam para trás no voo
      const pesC = sC - PERNA * MD.sin(phiC);
      passo = emPeAgora ? cl(0.15 + pesC - pmL, 0.05, 0.3) : 0;
    } else if (tipo === 'salto') {
      tq = MG.tSaltoPouso;
      sFim = sC + vc * tq * 0.5;
      fim = tp + Math.round((tq + 0.3) / DT);
    } else {
      // em pé: volta para cima dos pés (os que ficaram e os que deram o passo)
      const mx = (emPe.pes[0].x + emPe.pes[1].x) / 2 - j.x, mz = (emPe.pes[0].z + emPe.pes[1].z) / 2 - j.z;
      sFim = mx * lx + mz * lz; fFim = mx * fx + mz * fz;
      fim = tp + Math.round(MG.tEmPe / DT);
    }
    // onde os pés plantam no fim: em pé, onde estão; no mergulho e no salto, debaixo do quadril (no mergulho, de
    // pé RECUA de volta: ele sobe por cima dos pés)
    const sLev = tipo === 'mergulho' ? sFim - MG.recua : sFim;
    const cx = j.x + lx * sLev + fx * fFim, cz = j.z + lz * sLev + fz * fFim;
    const rx = -fz, rz = fx; // direita do corpo
    const pf = emPe ? emPe.pes
      : [{ x: cx - rx * MEIO_QUADRIL, z: cz - rz * MEIO_QUADRIL }, { x: cx + rx * MEIO_QUADRIL, z: cz + rz * MEIO_QUADRIL }];
    // em pé: o passo curto de cada pé que muda de lugar (o que estava no ar primeiro; depois o outro), com
    // duração pela distância (pico do pé ~2,7 m/s: um pé humano anda até ~3 m/s parado)
    const passa = emPe ? emPe.passa : [false, false];
    const durPasso = [0, 1].map(p => (passa[p] ? cl(MD.hypot(pf[p].x - pe0[p].x, pf[p].z - pe0[p].z) / 1.8, 0.2, 0.45) : 0));
    const primeiro = passa[0] && passa[1] ? (pe0[1].ar && !pe0[0].ar ? 1 : 0) : (passa[1] ? 1 : 0);
    const iniPasso = [0, 1].map(p => (passa[p] && passa[1 - p] && p !== primeiro ? durPasso[primeiro] : 0));
    return {
      tick0: t0, tc, tp, T, tipo, sucesso, encaixe: sucesso && d.tipo === 'encaixe', x0: j.x, z0: j.z, fx, fz, lx, lz, ladoS,
      rF, dYaw, tGiro: Math.min(MG.tGiro, Math.max(T, 3 * DT)),
      sC, fC, hC, hLow, phi0, phiC, th0, thC, v0L, v0F, h0, bx: d.bx, by: d.by, bz: d.bz, ext, tImp, tq, tChao, vc, sFim, sLev, fim,
      pe0, perto, passo, pmL, pmF: fFim, pf, passa, durPasso, iniPasso, rebote: !!ant, mao0, rebaixada: false,
      lado: d.lado, alt: d.y, ate: fim, idDefesa: undefined,
    };
  };

  let g = montar(!!d.sucesso);
  // bola no corpo (em pé, no peito ou nas pernas): a defesa vale mesmo sem a mão chegar — o corpo bloqueia
  const noCorpo = (tipo === 'peito' || tipo === 'baixa') && bL <= MG.corpoLado && bY <= MG.corpoAlto;
  if (d.sucesso && !maoAlcanca(g)) {
    if (d.proprio) {
      // recuo do próprio time que o corpo desenhado não alcança no ponto lido (ele andou depois da leitura): não é
      // defesa — sem mergulho batido, ele segue no lugar e recebe a bola que passa perto (sim.js bolaLivre)
      d.fora = true;
      return null;
    }
    if (!noCorpo) {
      // o sorteio dava defesa, mas o corpo desenhado não chega à bola a tempo: goleiro batido (o que se vê)
      d.sucesso = false; d.tipo = 'falhou';
      g = montar(false);
      g.rebaixada = true;
    } else if (d.tipo === 'encaixe') {
      // no corpo, sem a mão: a bola bate nele e sai (não vai parar nas mãos de uma vez)
      d.tipo = 'espalmada'; g.encaixe = false;
    }
  }
  j.mergulho = g;
  return g;
}

/**
 * A mão desenhada chega à bola no contato? (a mais perto a ≤ maoOk do centro da bola no tick tc, e sem andar
 * mais rápido que vMao desde a espera)
 */
function maoAlcanca(g) {
  const q = quadroMergulho(g, g.tc, _qChk);
  const mm = maosMergulho(g, q, _mChk, false);
  const d0 = MD.hypot(mm.m0.x - g.bx, mm.m0.y - g.by, mm.m0.z - g.bz), d1 = MD.hypot(mm.m1.x - g.bx, mm.m1.y - g.by, mm.m1.z - g.bz);
  if (Math.min(d0, d1) > MG.maoOk) return false;
  // a mão sai da espera no fim da impulsão e chega no contato: não pode ser um teletransporte de braço (a
  // velocidade da mão em relação ao corpo, no perfil suave: pico 1,5× a média)
  const q0 = quadroMergulho(g, g.tick0, _qChk);
  const m0 = maosMergulho(g, q0, _mChk, false);
  const ex = (m0.m0.x + m0.m1.x) / 2 - q0.x, ey = (m0.m0.y + m0.m1.y) / 2 - q0.h, ez = (m0.m0.z + m0.m1.z) / 2 - q0.z;
  const qc = quadroMergulho(g, g.tc, _qChk);
  const bx = g.bx - qc.x, by = g.by - qc.h, bz = g.bz - qc.z;
  const ini = Math.max(0, g.tImp - 0.06);
  return (1.5 * MD.hypot(bx - ex, by - ey, bz - ez)) / Math.max(DT, g.T - ini) <= MG.vMao;
}

/** A defesa desenhada de j vale no tick? (do começo até ficar de pé) */
export function mergulhoAtivo(j, tick) {
  const g = j.mergulho;
  return !!g && g.tc != null && tick > g.tick0 && tick <= g.fim;
}

/**
 * Quadro da defesa desenhada no tick (pura): escreve em `q` o centro do corpo (x, z), o rumo (yaw) e a frente /
 * lado do tick (fx, fz, lx, lz), a altura do quadril h, a inclinação do tronco de lado (phi) e para a frente
 * (th), quanto os braços vão à bola (braco 0–1), a fase, os tornozelos (a0, a1 {x, y, z}) e se cada pé está
 * plantado (apoio0, apoio1).
 */
export function quadroMergulho(g, tick, q) {
  const t = (tick - g.tick0) * DT;
  corpoMergulho(g, t, q);
  tornozelosMergulho(g, t, g.T, g.T + g.tq, q);
  return q;
}

/** O corpo do quadro no tempo t (s desde o começo): centro, rumo, quadril, inclinações e braços (sem os pés). */
function corpoMergulho(g, t, q) {
  const T = g.T;
  const tPouso = T + g.tq;
  const u = cl(t / Math.max(T, DT), 0, 1);
  const S = 2 * u * u - u * u * u;
  // Hermite: sai com a velocidade que tinha (v0) e chega ao pico com a velocidade da conta (sC/T)
  const H0 = (u * u * u - 2 * u * u + u) * T;
  frameDo(g, t, q);
  let s, f, h, phi, th = 0;
  if (g.tipo === 'mergulho') {
    if (t <= T) { s = g.sC * S + g.v0L * H0; f = g.fC * S + g.v0F * H0; }
    else if (t <= tPouso + g.tChao) { const w = Math.min(1, (t - T) / Math.max(g.tq, DT)); s = g.sC + (g.sFim - g.sC) * (2 * w - w * w); f = g.fC; }
    else { s = g.sFim + (g.sLev - g.sFim) * sm((t - tPouso - g.tChao) / MG.tLevanta); f = g.fC; }
    if (t <= g.tImp) h = g.h0 + (g.hLow - g.h0) * sm(t / g.tImp);
    else if (t <= T) h = g.hLow + (g.hC - g.hLow) * MD.sin(MEIO_PI * cl((t - g.tImp) / Math.max(T - g.tImp, DT), 0, 1));
    else if (t <= tPouso) { const v = (t - T) / g.tq; h = g.hC + (H_CHAO - g.hC) * v * v; }
    else if (t <= tPouso + g.tChao) h = H_CHAO;
    else h = H_CHAO + (H_PE - H_CHAO) * sm((t - tPouso - g.tChao) / MG.tLevanta);
    // o tronco gira junto com o corpo que anda (o mesmo perfil): os pés não são jogados para trás
    if (t <= T) { phi = g.phi0 + (g.phiC - g.phi0) * S; th = g.th0 * (1 - S); }
    else if (t <= tPouso) phi = g.phiC + (MEIO_PI - g.phiC) * sm((t - T) / g.tq);
    else if (t <= tPouso + g.tChao) phi = MEIO_PI;
    else phi = MEIO_PI * (1 - sm((t - tPouso - g.tChao) / MG.tLevanta));
  } else if (g.tipo === 'salto') {
    if (t <= T) { s = g.sC * S + g.v0L * H0; f = g.fC * S + g.v0F * H0; }
    else { const w = Math.min(t - T, g.tq); s = g.sC + g.vc * (w - (0.5 * w * w) / Math.max(g.tq, DT)); f = g.fC; }
    if (t <= g.tImp) h = g.h0 + (g.hLow - g.h0) * sm(t / g.tImp);
    else if (t <= T) h = g.hLow + (g.hC - g.hLow) * MD.sin(MEIO_PI * cl((t - g.tImp) / Math.max(T - g.tImp, DT), 0, 1));
    else if (t <= tPouso) h = g.hC + (g.h0 - 0.06 - g.hC) * sm((t - T) / g.tq);
    else h = g.h0 - 0.06 + 0.06 * sm((t - tPouso) / 0.3);
    if (t <= T) { const k = sm(t / Math.max(T, DT)); phi = g.phi0 + (g.phiC - g.phi0) * k; th = g.th0 * (1 - k); }
    else phi = g.phiC * (1 - sm((t - T) / (g.tq + 0.3)));
  } else {
    // em pé (baixa / peito): agacha, inclina e curva sobre a bola até o contato; depois volta para cima dos pés
    const ida = sm(t / Math.max(T, DT)), volta = t <= T ? 0 : sm((t - T) / MG.tEmPe);
    const k = ida * (1 - volta);
    h = g.h0 + (g.hC - g.h0) * k;
    phi = g.phi0 * (1 - ida) + g.phiC * k;
    th = g.th0 * (1 - ida) + g.thC * k;
    // (os pés estão plantados: o corpo não continua o passo de lado — vai direto para a defesa)
    s = t <= T ? g.sC * S : g.sC + (g.sFim - g.sC) * volta;
    f = t <= T ? g.fC * S : g.fC + (g.pmF - g.fC) * volta;
    // as pernas sempre alcançam os pés plantados: o quadril não fica acima do alcance delas
    const e = eixos(q, phi, th, _ec);
    const cx = g.x0 + g.lx * s + g.fx * f, cz = g.z0 + g.lz * s + g.fz * f, L = LMAX * 0.995;
    for (let p = 0; p < 2; p++) {
      const lado = p === 0 ? -1 : 1;
      const dx = g.pf[p].x - (cx + e.rx * lado * MEIO_QUADRIL - e.ux * 0.03), dz = g.pf[p].z - (cz + e.rz * lado * MEIO_QUADRIL - e.uz * 0.03);
      const hMax = TORN + Math.sqrt(Math.max(0, L * L - dx * dx - dz * dz)) - (e.ry * lado * MEIO_QUADRIL - e.uy * 0.03);
      if (h > hMax) h = hMax;
    }
  }
  // braços: vão à bola do fim da impulsão até o pico; depois voltam
  const ini = Math.max(0, g.tImp - 0.06);
  const braco = t <= T ? sm((t - ini) / Math.max(T - ini, DT)) * g.ext : g.ext * (1 - sm((t - T) / 0.35));
  q.fase = t < g.tImp ? 'impulso' : t <= T ? 'voo' : t <= tPouso ? 'queda' : 'fim';
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

/** Tornozelo da perna p ao longo do corpo (no ar ou deitado) no quadro q, em `out`. */
function pernaNoCorpo(g, q, e, p, hq, out) {
  const longe = p !== g.perto;
  const comp = longe ? PERNA * 0.94 : PERNA;
  const avanco = longe ? 0.08 : 0.03;
  out.x = hq.x - e.ux * comp + q.fx * avanco; out.z = hq.z - e.uz * comp + q.fz * avanco;
  out.y = Math.max(TORN, hq.y - e.uy * comp - DESCE_PERNA * MD.sin(q.phi));
  return out;
}
function pernaDeitada(g, t, p, out) {
  corpoMergulho(g, t, _qi);
  const e = eixos(_qi, _qi.phi, _qi.th, _ei);
  return pernaNoCorpo(g, _qi, e, p, articulacaoQuadril(_qi, e, p, _hl), out);
}

/** Tornozelos e apoio dos pés no quadro (parte de quadroMergulho). */
function tornozelosMergulho(g, t, T, tPouso, q) {
  const a0 = q.a0 ?? (q.a0 = { x: 0, y: 0, z: 0 }), a1 = q.a1 ?? (q.a1 = { x: 0, y: 0, z: 0 });
  if (g.tipo === 'baixa' || g.tipo === 'peito') {
    // em pé: o pé que fica, plantado; o que muda de lugar dá um passo curto (sobe e desce) até a base
    for (let p = 0; p < 2; p++) {
      const a = p === 0 ? a0 : a1, e0 = g.pe0[p];
      if (!g.passa[p]) { a.x = e0.x; a.y = TORN; a.z = e0.z; if (p === 0) q.apoio0 = true; else q.apoio1 = true; continue; }
      const v = sm((t - g.iniPasso[p]) / g.durPasso[p]);
      a.x = e0.x + (g.pf[p].x - e0.x) * v; a.z = e0.z + (g.pf[p].z - e0.z) * v;
      a.y = e0.y + (TORN - e0.y) * v + 0.06 * MD.sin(PI * v);
      if (p === 0) q.apoio0 = v >= 1; else q.apoio1 = v >= 1;
    }
    return q;
  }
  const fimRel = (g.fim - g.tick0) * DT;
  const e = eixos(q, q.phi, q.th, _e);
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
        pePuxado(articulacaoQuadril(_qi, eixos(_qi, _qi.phi, _qi.th, _ei), p, _hq), g.pe0[p].x, g.pe0[p].y, g.pe0[p].z, _pp);
        sx = _pp.x; y0 = _pp.y; sz = _pp.z;
      }
      const tAr = Math.max(0.06, T - g.tImp); // os pés chegam à linha do corpo no pico
      if (t < g.tImp) {
        if (p === g.perto) {
          const v = sm(t / g.tImp);
          x = g.pe0[p].x + g.lx * passo * v; z = g.pe0[p].z + g.lz * passo * v; y = g.pe0[p].y + 0.07 * MD.sin(PI * v);
          apoio = false;
        } else {
          const alcanca = pePuxado(articulacaoQuadril(q, e, p, _hq), g.pe0[p].x, g.pe0[p].y, g.pe0[p].z, _pp);
          x = _pp.x; y = _pp.y; z = _pp.z; apoio = alcanca && !g.pe0[p].ar;
        }
      } else if (t <= fimRel - MG.tLevanta) {
        // no ar e no chão: do ponto de saída para a perna ao longo do corpo
        const v = sm((t - g.tImp) / tAr);
        x = sx + (arX - sx) * v; y = y0 + (arY - y0) * v; z = sz + (arZ - sz) * v;
        apoio = false;
      } else {
        // levantando: de onde o pé estava deitado até debaixo do quadril (onde planta no fim)
        const v = sm((t - (fimRel - MG.tLevanta)) / MG.tLevanta);
        pernaDeitada(g, fimRel - MG.tLevanta, p, _pp);
        x = _pp.x + (g.pf[p].x - _pp.x) * v; y = _pp.y + (TORN - _pp.y) * v; z = _pp.z + (g.pf[p].z - _pp.z) * v;
        apoio = t >= fimRel - 1e-9;
      }
    } else {
      // salto: os dois pés empurram e voltam a pousar debaixo do quadril
      const y0 = g.pe0[p].y;
      if (t < g.tImp) { x = g.pe0[p].x; y = y0; z = g.pe0[p].z; apoio = !g.pe0[p].ar; }
      else if (t < tPouso) {
        const sobe = sm((t - g.tImp) / Math.max(T - g.tImp, DT)), desce = sm((t - T) / Math.max(g.tq, DT));
        const alt = Math.max(0, q.h - (g.h0 - 0.02)) * (t <= T ? sobe : 1 - desce);
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

/** Mão pronta do goleiro (de pé e na espera da defesa): à frente da cintura, a partir do ombro (m). */
export const MAO_PRONTA_FRENTE = 0.3, MAO_PRONTA_BAIXO = 0.25;

/**
 * Ombros e mãos no quadro (em `out`: o0/o1 ombros e m0/m1 mãos, 0 = esquerda): as mãos vão da espera (prontas à
 * frente da cintura — onde a pose de pé do goleiro as deixa) até a bola do contato (com a bola entre as palmas)
 * pelo peso `braco` do quadro, nunca além do alcance do braço. A MESMA conta na simulação (bola nas mãos) e
 * na animação.
 */
export function maosMergulho(g, q, out, segura = false) {
  const e = eixos(q, q.phi, q.th, _e);
  const ox = q.x + e.ux * TRONCO_OMBRO, oy = q.h + e.uy * TRONCO_OMBRO, oz = q.z + e.uz * TRONCO_OMBRO;
  // segurando (encaixe): depois do contato as mãos trazem a bola para junto do peito ("abraça a bola")
  const traz = segura && q.t > g.T ? sm((q.t - g.T) / MG.tAbraca) : 0;
  const peitoX = ox - e.ux * 0.12 + q.fx * 0.2, peitoY = oy - e.uy * 0.12, peitoZ = oz - e.uz * 0.12 + q.fz * 0.2;
  // batido: a mão vai na direção da bola mas fica curta (0,35 m antes dela, do lado do corpo)
  const curta = g.sucesso ? 0 : 0.35;
  const bx = g.bx - g.lx * curta, bz = g.bz - g.lz * curta;
  let alvoX = bx + (peitoX - bx) * traz, alvoY = g.by + (peitoY - g.by) * traz, alvoZ = bz + (peitoZ - bz) * traz;
  let braco = segura && q.t > g.T ? g.ext : q.braco;
  if (segura) {
    // no fim (de pé) a bola desce do peito ao ponto de segurar em pé (bolaNaMao, BM): quando a defesa desenhada
    // acaba, a bola e as mãos já estão onde a pose de pé as põe (anim.js) — sem salto de bola nem de braço
    const w = sm((q.t - (g.fim - g.tick0) * DT + BM.tJunta) / BM.tJunta);
    if (w > 0) {
      alvoX += (q.x + q.fx * BM.frente - alvoX) * w;
      alvoY += (BM.altura - alvoY) * w;
      alvoZ += (q.z + q.fz * BM.frente - alvoZ) * w;
      braco += (1 - braco) * w;
    }
  }
  const m0 = out.m0 ?? (out.m0 = { x: 0, y: 0, z: 0 }), m1 = out.m1 ?? (out.m1 = { x: 0, y: 0, z: 0 });
  const o0 = out.o0 ?? (out.o0 = { x: 0, y: 0, z: 0 }), o1 = out.o1 ?? (out.o1 = { x: 0, y: 0, z: 0 });
  for (let p = 0; p < 2; p++) {
    const lado = p === 0 ? -1 : 1;
    const sx = ox + e.rx * lado * MEIO_OMBRO, sy = oy + e.ry * lado * MEIO_OMBRO, sz = oz + e.rz * lado * MEIO_OMBRO;
    // espera: as mãos prontas à frente da cintura — a mesma posição da pose de pé do goleiro (anim.js
    // MAO_PRONTA): sem salto de braço ao começar nem ao terminar a defesa
    const ex = sx + q.fx * MAO_PRONTA_FRENTE - e.ux * MAO_PRONTA_BAIXO;
    const ey = sy - e.uy * MAO_PRONTA_BAIXO;
    const ez = sz + q.fz * MAO_PRONTA_FRENTE - e.uz * MAO_PRONTA_BAIXO;
    // a bola, com as palmas dos dois lados (ao longo da direita do corpo)
    const bxp = alvoX + e.rx * lado * 0.12, byp = alvoY + e.ry * lado * 0.12, bzp = alvoZ + e.rz * lado * 0.12;
    let tx = ex + (bxp - ex) * braco, ty = ey + (byp - ey) * braco, tz = ez + (bzp - ez) * braco;
    if (g.mao0 && q.t < MG.tMaoRebote) {
      // rebote: a mão sai de onde estava na defesa anterior (em relação ao ombro), sem salto de braço
      const a = g.mao0[p], w = sm(q.t / MG.tMaoRebote);
      tx = sx + a.x + (tx - sx - a.x) * w; ty = sy + a.y + (ty - sy - a.y) * w; tz = sz + a.z + (tz - sz - a.z) * w;
    }
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
  j.rumo = q.yaw; j.giro = 0; j.ax = 0; j.az = 0; j.inv = false;
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
  const mm = maosMergulho(g, q, _mm, true);
  out.x = (mm.m0.x + mm.m1.x) / 2; out.y = Math.max(0.12, (mm.m0.y + mm.m1.y) / 2); out.z = (mm.m0.z + mm.m1.z) / 2;
  return out;
}
