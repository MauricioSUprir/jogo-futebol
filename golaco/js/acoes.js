// Ações com bola (Etapa 2): passe rasteiro, enfiada (bola no espaço), enfiada alta, lançamento,
// cruzamento (alto, tenso, rasteiro), chute (força, colocado, cavadinha) e cabeceio. Puro: sem
// three.js nem DOM; aleatoriedade só pelo gerador do mundo; matemática pelo MD (determinística).
//
// Fluxo: apertar um botão começa a carregar a força (j.carga); soltar cria o pedido (j.pedido).
// Com a bola, a ação sai no próximo toque possível (toque marcado com tipo 'acao', o pé de apoio
// no chão); com a bola chegando, sai de primeira no tick do domínio.

import { ACOES, BOTAO, CAMPO, PASSO, JOGADOR } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { normal } from './rng.js';
import {
  chutarRasteiro, chutar, velParaChegarCom, velParaDistancia, velRolandoApos, velParaPousar, elevacaoParaAltura,
  alturaNaDistancia, simularVoo, criarBola,
} from './bola.js';
import { procurarOportunidade } from './conducao.js';
import { passoBola as passoBolaTeste } from './bola.js';
import { passoCorpo, copiaCinematica, infoPassada } from './jogador.js';

const DT = PASSO;
const BOTOES_ACAO = [
  [BOTAO.PASSE, 'passe'], [BOTAO.ENFIADA, 'enfiada'], [BOTAO.LANCAMENTO, 'lancamento'], [BOTAO.CHUTE, 'chute'],
];

/** Lado do gol que o time ataca (+1 ataca x = +52,5). */
export function ataca(m, time) {
  return m.ataca ? m.ataca[time] : (time === 0 ? 1 : -1);
}

// ------------------------------------------------------------------ botões → carga e pedido

/**
 * Atualiza carga/pedido pelas bordas dos botões de ação (chamar depois de aplicarEntrada).
 * Vale para o humano e para a IA (que aperta botões virtuais).
 */
export function atualizarBotoesAcao(m, j) {
  const agora = j.botoes, antes = j.botoesAnt;
  for (const [b, tipo] of BOTOES_ACAO) {
    const apertou = (agora & b) && !(antes & b);
    const soltou = !(agora & b) && (antes & b);
    if (apertou) {
      j.carga = { tipo, t0: m.tick, mod: (agora & BOTAO.MOD) !== 0 };
      j.mira = null;
    } else if (soltou && j.carga && j.carga.tipo === tipo) {
      soltarCarga(m, j);
    }
  }
  // guarda a mira enquanto carrega ou espera o toque
  if ((j.carga || j.pedido) && j.imag > 0.2) j.mira = { x: j.ix, z: j.iz, mag: j.imag };
  if (j.carga && (m.tick - j.carga.t0) * DT >= ACOES.cargaMax) soltarCarga(m, j);
  if (j.pedido) {
    const idade = (m.tick - j.pedido.tick) * DT;
    const esperandoBola = j.cond && j.cond.toque && (j.cond.toque.tipo === 'dominio' || j.cond.toque.tipo === 'aereo');
    if (idade > (esperandoBola || bolaVindo(m, j) ? ACOES.pedidoPrimeira : ACOES.pedidoValidade) && m.posse !== j.id) j.pedido = null;
    else if (idade > ACOES.pedidoValidade * 2 && m.posse === j.id && !(j.cond.toque && j.cond.toque.tipo === 'acao')) j.pedido = null;
  }
}

function soltarCarga(m, j) {
  const c = j.carga;
  const forca = clamp((m.tick - c.t0) * DT / ACOES.cargaCheia, 0.08, 1);
  const mod = c.mod || (j.botoes & BOTAO.MOD) !== 0;
  // dois toques no lançamento = cruzamento rasteiro
  if (c.tipo === 'lancamento' && j.ultLanc != null && (m.tick - j.ultLanc) * DT < ACOES.toqueDuplo && j.pedido && j.pedido.tipo === 'lancamento') {
    j.pedido.rasteiro = true;
  } else {
    j.pedido = { tipo: c.tipo, forca, mod, tick: m.tick };
  }
  if (c.tipo === 'lancamento') j.ultLanc = m.tick;
  j.carga = null;
}

/** A bola (livre) está vindo para perto do jogador? (no ar: o voo passa por ele) */
function bolaVindo(m, j) {
  if (m.posse != null) return false;
  const b = m.bola;
  if (!b.rolando && b.p.y > 0.45 && bolaAltaPassando(m, j, 150)) return true;
  const dx = j.x - b.p.x, dz = j.z - b.p.z;
  const d = MD.hypot(dx, dz);
  const vb = MD.hypot(b.v.x, b.v.z);
  return vb > 1 && d < 25 && (b.v.x * dx + b.v.z * dz) / (vb * Math.max(d, 1e-6)) > 0.8;
}

// ------------------------------------------------------------------ pedido → toque marcado

/**
 * Com a bola: marca o toque da ação no primeiro momento possível (pé de apoio no chão, bola
 * no alcance). Chamar a cada tick para quem tem pedido e a posse.
 */
export function processarPedido(m, j) {
  if (!j.pedido || m.posse !== j.id) return;
  const c = j.cond;
  if (c.toque && c.toque.tipo === 'acao') return;
  let op = procurarOportunidade(m, j, 2, 24, true, null, true);
  // perna boa: parado (os dois pés no chão) com a bola à frente, bate com ela; sem pressão,
  // ajeita o passo para bater com ela
  const pref = j.par.attr.pePreferido ?? 1;
  if (op && op.pe !== pref) {
    const la = -(op.bx - j.x) * MD.sin(j.rumo) + (op.bz - j.z) * MD.cos(j.rumo);
    const parado = MD.hypot(j.vx, j.vz) < 1 && j.pes[0].apoio && j.pes[1].apoio;
    if (parado && Math.abs(la) < 0.35) op = { ...op, pe: pref };
    else if (pressaoSobre(m, j) < 0.3) {
      // andando, a passada é mais lenta: espera até um passo a mais (~0,33 s); correndo, ~0,15 s
      const espera = MD.hypot(j.vx, j.vz) < 3 ? 20 : 9;
      const op2 = procurarOportunidade(m, j, op.i + 1, op.i + espera, true, null, true);
      if (op2 && op2.pe === pref) op = op2;
    }
  }
  if (op) c.toque = { tick: m.tick + op.i, pe: op.pe, bx: op.bx, bz: op.bz, tipo: 'acao' };
}

// ------------------------------------------------------------------ escolha do alvo

/**
 * Mira da ação: o analógico de agora ou, se ele já foi solto, o último segurado durante a carga
 * (quem solta o botão e o analógico juntos não perde a direção). {x, z, mag} ou null.
 */
function mira(j) {
  if (j.imag > 0.2) return { x: j.ix, z: j.iz, mag: j.imag };
  return j.mira ?? null;
}

function dirPedida(j) {
  const a = mira(j);
  if (a) return { x: a.x, z: a.z };
  return { x: MD.cos(j.rumo), z: MD.sin(j.rumo) };
}

/** Risco de um adversário cortar a linha de passe de (ax,az) a (bx,bz) com a bola a v. */
export function riscoLinha(m, j, ax, az, bx, bz, v) {
  let risco = 0;
  const dx = bx - ax, dz = bz - az;
  const L = MD.hypot(dx, dz) || 1;
  const ux = dx / L, uz = dz / L;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const ox = o.x - ax, oz = o.z - az;
    const s = clamp(ox * ux + oz * uz, 0, L);
    const lat = Math.abs(-ox * uz + oz * ux);
    // tempo da bola até s × tempo do adversário até a linha (reação 0,25 s + corrida)
    const tBola = s / Math.max(v, 3);
    const tAdv = 0.25 + Math.max(0, lat - 0.9) / 6.5;
    if (tAdv < tBola + 0.15) risco = Math.max(risco, clamp((tBola + 0.15 - tAdv) / 0.6, 0, 1));
  }
  return risco;
}

/**
 * Companheiro alvo pelo analógico (cone), distância e risco da linha. Devolve o jogador ou null.
 * tipo: 'passe' | 'enfiada' | 'lancamento'
 */
export function escolherAlvo(m, j, tipo) {
  const cfg = ACOES[tipo];
  const d = dirPedida(j);
  const lado = ataca(m, j.time);
  let melhor = null, mScore = Infinity;
  for (let tent = 0; tent < 2 && !melhor; tent++) {
    const cone = cfg.cone * (tent === 0 ? 1 : 1.8);
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id) continue;
      if (o.posicao === 'GOL' && tipo !== 'passe') continue;
      const ox = o.x - j.x, oz = o.z - j.z;
      const L = MD.hypot(ox, oz);
      if (L < cfg.dMin || L > cfg.dMax) continue;
      const a = Math.abs(difAng(MD.atan2(d.z, d.x), MD.atan2(oz, ox)));
      if (a > cone) continue;
      let score = a / cone;
      if (tipo === 'passe') score += Math.abs(L - 14) / 40;
      if (tipo === 'enfiada') score -= clamp((o.x - j.x) * lado / 30, -0.3, 0.6) + clamp((o.vx * lado) / 8, 0, 0.4);
      if (tipo === 'lancamento') score += Math.abs(L - 35) / 60;
      const v = tipo === 'lancamento' ? 20 : 12;
      score += 1.2 * riscoLinha(m, j, j.x, j.z, o.x, o.z, v);
      if (score < mScore) { mScore = score; melhor = o; }
    }
  }
  return melhor;
}

// ------------------------------------------------------------------ utilidades

function pressaoSobre(m, j) {
  let dm = Infinity;
  for (const o of m.jogadores) {
    if (o.time === j.time) continue;
    const d = MD.hypot(o.x - j.x, o.z - j.z);
    if (d < dm) dm = d;
  }
  return clamp((ACOES.pressaoDist - dm) / ACOES.pressaoDist, 0, 1);
}

/**
 * Perna ruim: mais dispersão e menos velocidade. Pesquisa da Etapa 2: erro +40% (Carlsson 2018)
 * e velocidade a 84% (Nunome 2006) em jogadores bons de perna ruim mediana.
 */
function multPeFraco(j, pe) {
  const a = j.par.attr;
  if (pe === a.pePreferido) return 1;
  return lerp(1.8, 1.1, (a.peFraco ?? 50) / 100);
}

function velPeFraco(j, pe) {
  const a = j.par.attr;
  if (pe === a.pePreferido) return 1;
  return lerp(0.78, 0.95, (a.peFraco ?? 50) / 100);
}

/** Tempo (ticks) para o jogador chegar correndo a (px,pz), pela mesma locomoção do jogo. */
export function ticksAteChegar(j, px, pz, max = 360) {
  const k = copiaCinematica(j);
  const vel = j.par.vArrancada;
  for (let i = 1; i <= max; i++) {
    const dx = px - k.x, dz = pz - k.z;
    const d = MD.hypot(dx, dz);
    if (d < 0.6) return i;
    passoCorpo(k, dx / d, dz / d, vel, MD.atan2(dz, dx), j.par, DT, false);
  }
  return max;
}

function dentroDoCampo(x, z, margem = 1) {
  return {
    x: clamp(x, -CAMPO.meioX + margem, CAMPO.meioX - margem),
    z: clamp(z, -CAMPO.meioZ + margem, CAMPO.meioZ - margem),
  };
}

function girar(ux, uz, a) {
  const c = MD.cos(a), s = MD.sin(a);
  return { x: ux * c - uz * s, z: ux * s + uz * c };
}

function finalizarChute(m, j, pe, tipo, v, w, alvo, para, extra = {}) {
  const b = m.bola;
  chutar(b, v, w);
  if (v.y <= 0.01) chutarRasteiro(b, v.x, v.z);
  const c = j.cond;
  const sv = MD.hypot(v.x, v.z) || 1;
  c.ult = { tick: m.tick, pe, bx: b.p.x, bz: b.p.z, dx: v.x / sv, dz: v.z / sv, v: MD.hypot(v.x, v.y, v.z), tipo };
  c.toque = null; c.busca = false; c.longeDesde = -1;
  m.posse = null;
  m.ultimoToque = { id: j.id, time: j.time, tick: m.tick };
  m.voo = { tipo, de: j.id, time: j.time, para: para ? para.id : null, alvo: { x: alvo.x, z: alvo.z }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + (extra.ticks ?? 0), alto: v.y > 1.5, ...extra.voo };
  const ev = tipo === 'chute' || tipo === 'colocado' || tipo === 'cavadinha' ? 'chute' : 'passe';
  m.eventos.push({ tipo: ev, id: j.id, modo: tipo, v: MD.hypot(v.x, v.y, v.z), para: para ? para.id : null });
  if (m.stats) { m.stats[ev === 'chute' ? 'chutes' : 'passes'] = (m.stats[ev === 'chute' ? 'chutes' : 'passes'] ?? 0) + 1; }
  if (m.log) m.log.push({ t: m.tick, id: j.id, pe, tipo, bx: b.p.x, bz: b.p.z, dx: v.x / sv, dz: v.z / sv, v: MD.hypot(v.x, v.y, v.z), alvoX: alvo.x, alvoZ: alvo.z, para: para ? para.id : null, rx: para ? para.x : null, rz: para ? para.z : null, acao: true });
}

/** Marca o recebedor: ele vem ao encontro (passe) ou arranca para o ponto (enfiada, lançamento). */
function marcarRecebedor(m, r, x, z, tipo, tick) {
  if (!r) return;
  r.recebe = { tick: m.tick, x, z, tipo, chega: tick };
  if (m.humanos && m.humanos.includes(r.time) && m.controlado) {
    // o controle passa para quem vai receber (como nos jogos de futebol atuais)
    if (m.controlado[r.time] !== r.id) {
      m.controlado[r.time] = r.id;
      m.eventos.push({ tipo: 'troca', id: r.id, auto: true });
    }
  }
}

// ------------------------------------------------------------------ execução

/**
 * Executa a ação pedida agora (tick do toque, antes de integrar a bola). pe = pé que bate.
 * primeira = de primeira (bola chegando, sem domínio).
 */
export function executarAcao(m, j, pe, primeira = false) {
  const p = j.pedido;
  j.pedido = null;
  if (!p) return false;
  const b = m.bola;
  if (b.p.y > 0.6 && p.tipo !== 'chute') return executarCabeceio(m, j, p);
  if (b.p.y > 1.2) return executarCabeceio(m, j, p);
  if (p.tipo === 'chute') {
    // no chute a pressão só pesa de perto (< 12 m) e pouco; de primeira, ×1,15 (StatsBomb)
    const lado = ataca(m, j.time);
    const perto = MD.hypot(lado * CAMPO.meioX - b.p.x, b.p.z) < 12;
    const em = (primeira ? ACOES.chute.primeiraErro : 1) * (1 + (perto ? ACOES.chute.pressaoErro : 0) * pressaoSobre(m, j)) * multPeFraco(j, pe);
    return chute(m, j, pe, p, em);
  }
  const erroMult = (primeira ? ACOES.primeiraErro : 1) * (1 + 0.8 * pressaoSobre(m, j)) * multPeFraco(j, pe);
  switch (p.tipo) {
    case 'passe': return passeRasteiro(m, j, pe, p, erroMult);
    case 'enfiada': return enfiada(m, j, pe, p, erroMult);
    case 'lancamento': return lancamentoOuCruzamento(m, j, pe, p, erroMult);
    case 'chute': return chute(m, j, pe, p, erroMult);
    default: return false;
  }
}

function passeRasteiro(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.passe;
  const r = escolherAlvo(m, j, 'passe');
  let tx, tz, para = null;
  if (r) {
    para = r;
    const L0 = MD.hypot(r.x - b.p.x, r.z - b.p.z);
    const tVoo = L0 / 11;
    // vai na frente do recebedor no máximo 1 m (passe no pé, não no espaço)
    let lx = r.vx * tVoo, lz = r.vz * tVoo;
    const ll = MD.hypot(lx, lz);
    if (ll > cfg.adiante) { lx *= cfg.adiante / ll; lz *= cfg.adiante / ll; }
    tx = r.x + lx; tz = r.z + lz;
  } else {
    const d = dirPedida(j);
    const L = lerp(8, 25, p.forca);
    tx = j.x + d.x * L; tz = j.z + d.z * L;
  }
  ({ x: tx, z: tz } = dentroDoCampo(tx, tz, 0.3));
  let dx = tx - b.p.x, dz = tz - b.p.z;
  const L = MD.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  // a força se ajusta à distância; a barra corrige (mais fraca / mais forte)
  // chegada mais firme já nos passes médios (StatsBomb: 10,8 m/s de média a 12,5 m, 13,6 a 22,5 m)
  const vChegada = lerp(cfg.vChegada[0], cfg.vChegada[1], Math.sqrt(clamp(L / 35, 0, 1))) * lerp(0.75, 1.3, p.forca);
  let v0 = Math.min(30, velParaChegarCom(Math.max(0, L - 0.3), vChegada));
  const attr = j.par.attr.passe;
  const sig = lerp(cfg.erroRuim, cfg.erroBom, attr / 100) * erroMult;
  const ea = normal(m.rng) * sig;
  v0 *= 1 + normal(m.rng) * sig * 0.8;
  const u = girar(dx, dz, ea);
  finalizarChute(m, j, pe, 'passe', { x: u.x * v0, y: 0, z: u.z * v0 }, { x: 0, y: 0, z: 0 }, { x: tx, z: tz }, para, { voo: { alto: false } });
  if (para) marcarRecebedor(m, para, tx, tz, 'passe', 0);
  tabela(m, j, p);
  return true;
}

function enfiada(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.enfiada;
  const lado = ataca(m, j.time);
  let r = escolherAlvo(m, j, 'enfiada');
  const d = dirPedida(j);
  if (!r) {
    // ninguém no cone: o mais adiantado na direção do analógico
    let melhor = -Infinity;
    for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
      const ox = o.x - j.x, oz = o.z - j.z;
      const s = ox * d.x + oz * d.z;
      if (s > melhor) { melhor = s; r = o; }
    }
  }
  if (!r) return passeRasteiro(m, j, pe, p, erroMult);
  // direção da corrida: a do recebedor se já corre; senão para o gol, puxada pelo analógico
  let rx, rz;
  const sr = MD.hypot(r.vx, r.vz);
  if (sr > 3 && (r.vx * lado) > 0.5 * sr) { rx = r.vx / sr; rz = r.vz / sr; }
  else {
    rx = lado * 0.65 + d.x * 0.35; rz = d.z * 0.35;
    const l = MD.hypot(rx, rz) || 1; rx /= l; rz /= l;
  }
  // bola no espaço: a força diz quanto à frente no mínimo (4,5–12 m) e com que velocidade, no
  // máximo, a bola passa pelo ponto (o "peso"). Procura o ponto da corrida em que a bola chega um
  // pouco antes do recebedor (ele corre para ela) sem passar forte demais; ele arranca já.
  const vNoPonto = lerp(cfg.vNoPonto[0], cfg.vNoPonto[1], p.forca);
  const alta = p.mod;
  const reacao = sr > 3 ? 0 : Math.round(0.15 / DT);
  const lead0 = lerp(cfg.lead[0], cfg.lead[1], p.forca);
  let { x: tx, z: tz } = dentroDoCampo(r.x + rx * lead0, r.z + rz * lead0, 1.5);
  // sem tempo de a bola chegar antes (corredor lançado): bate o mais forte que o peso permite
  // no ponto mínimo, e ele ajusta a corrida para encontrá-la
  let v0Rasteira = Math.min(cfg.vMax, velParaChegarCom(MD.hypot(tx - b.p.x, tz - b.p.z), vNoPonto));
  for (let lead = lead0; !alta && lead <= lead0 + 10; lead += 0.75) {
    const q = dentroDoCampo(r.x + rx * lead, r.z + rz * lead, 1.5);
    const Lp = MD.hypot(q.x - b.p.x, q.z - b.p.z);
    const nBola = Math.max(10, ticksAteChegar(r, q.x, q.z) + reacao - Math.round(0.1 / DT));
    const v0 = velParaDistancia(Lp, nBola);
    if (v0 > cfg.vMax) break; // a bola não chega antes nem indo mais longe
    if (velRolandoApos(v0, nBola) <= vNoPonto) { tx = q.x; tz = q.z; v0Rasteira = v0; break; }
  }
  let dx = tx - b.p.x, dz = tz - b.p.z;
  const L = MD.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  const attr = j.par.attr.passe;
  const sig = lerp(cfg.erroRuim, cfg.erroBom, attr / 100) * erroMult;
  if (alta) {
    // enfiada alta: por cima da defesa, quica um pouco antes do ponto
    const el = 0.6;
    const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
    const Lq = Math.max(4, L - 3);
    let s = velParaPousar(pp, dx, dz, Lq, el, { x: dz * 10, y: 0, z: -dx * 10 });
    s *= 1 + normal(m.rng) * sig * 0.6;
    const u = girar(dx, dz, normal(m.rng) * sig);
    const ce = MD.cos(el), se = MD.sin(el);
    finalizarChute(m, j, pe, 'enfiadaAlta', { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, { x: u.z * 10, y: 0, z: -u.x * 10 }, { x: b.p.x + dx * Lq, z: b.p.z + dz * Lq }, r, { voo: { alto: true } });
  } else {
    let v0 = v0Rasteira * (1 + normal(m.rng) * sig * 0.6);
    const u = girar(dx, dz, normal(m.rng) * sig);
    finalizarChute(m, j, pe, 'enfiada', { x: u.x * v0, y: 0, z: u.z * v0 }, { x: 0, y: 0, z: 0 }, { x: tx, z: tz }, r, { voo: { alto: false } });
  }
  marcarRecebedor(m, r, tx, tz, 'enfiada', m.tick);
  tabela(m, j, p);
  return true;
}

/** Zonas do cruzamento (1º pau, 2º pau, marca do pênalti) para quem cruza de (x,z). */
export function zonasCruzamento(lado, zCruzador) {
  const gx = lado * CAMPO.meioX;
  const sz = zCruzador >= 0 ? 1 : -1;
  return [
    { nome: 'primeiroPau', x: gx - lado * 5.5, z: sz * 2.2 },
    { nome: 'segundoPau', x: gx - lado * 6.5, z: -sz * 3.2 },
    { nome: 'marcaPenalti', x: gx - lado * 11, z: 0 },
  ];
}

function lancamentoOuCruzamento(m, j, pe, p, erroMult) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cc = ACOES.cruzamento;
  const noTerco = (j.x * lado) > cc.terco && Math.abs(j.z) > cc.faixa;
  if (noTerco) return cruzamento(m, j, pe, p, erroMult);
  const cfg = ACOES.lancamento;
  const r = escolherAlvo(m, j, 'lancamento');
  let tx, tz;
  if (r) {
    const L0 = MD.hypot(r.x - b.p.x, r.z - b.p.z);
    const tVoo = 0.6 + L0 / 18;
    let lx = r.vx * tVoo, lz = r.vz * tVoo;
    const ll = MD.hypot(lx, lz);
    if (ll > 5) { lx *= 5 / ll; lz *= 5 / ll; }
    tx = r.x + lx; tz = r.z + lz;
  } else {
    const d = dirPedida(j);
    const L = lerp(20, 50, p.forca);
    tx = j.x + d.x * L; tz = j.z + d.z * L;
  }
  ({ x: tx, z: tz } = dentroDoCampo(tx, tz, 1));
  const L = MD.hypot(tx - b.p.x, tz - b.p.z) || 1;
  // erro no ponto de queda: ±erroBom m a 40 m para um bom lançador (cresce com a distância)
  const sig = lerp(cfg.erroRuim, cfg.erroBom, j.par.attr.passeLongo / 100) * (L / 40) * erroMult;
  const ex = tx + normal(m.rng) * sig * 0.7, ez = tz + normal(m.rng) * sig * 0.7;
  const qx = ex - b.p.x, qz = ez - b.p.z;
  const Lq = MD.hypot(qx, qz) || 1;
  const ux = qx / Lq, uz = qz / Lq;
  const el = lerp(cfg.elev[0], cfg.elev[1], clamp((L - 20) / 40, 0, 1));
  const w = { x: uz * 8, y: 0, z: -ux * 8 }; // um pouco de giro para trás
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const s = velParaPousar(pp, ux, uz, Lq, el, w);
  const ce = MD.cos(el), se = MD.sin(el);
  const voo = simularVoo(pp, { x: ux * s * ce, y: s * se, z: uz * s * ce }, w);
  finalizarChute(m, j, pe, 'lancamento', { x: ux * s * ce, y: s * se, z: uz * s * ce }, w, { x: ex, z: ez }, r, { voo: { alto: true, alvoPedido: { x: tx, z: tz } }, ticks: voo.ticks });
  if (r) marcarRecebedor(m, r, ex, ez, 'lancamento', m.tick + voo.ticks);
  tabela(m, j, p);
  return true;
}

function cruzamento(m, j, pe, p, erroMult) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cc = ACOES.cruzamento;
  const zonas = zonasCruzamento(lado, j.z);
  // a zona pelo analógico, em setores largos (vistas da ponta, as três zonas ficam a ~6° uma da
  // outra): para a linha de fundo = 1º pau; atravessado = 2º pau; para trás = marca do pênalti.
  // Sem analógico: a zona com o companheiro mais perto.
  let zona = zonas[2];
  const mr = mira(j);
  if (mr && mr.mag > 0.3) {
    const sz = j.z >= 0 ? 1 : -1;
    const phi = MD.atan2(mr.x * lado, -mr.z * sz); // 0 = atravessado; + = para a linha de fundo
    zona = phi > cc.setor ? zonas[0] : phi < -cc.setor ? zonas[2] : zonas[1];
  } else {
    let mel = Infinity;
    for (const zz of zonas) for (const o of m.jogadores) {
      if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
      const d = MD.hypot(o.x - zz.x, o.z - zz.z);
      if (d < mel) { mel = d; zona = zz; }
    }
  }
  // quem ataca a zona: o companheiro mais perto dela
  let r = null, dr = Infinity;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o.id === j.id || o.posicao === 'GOL') continue;
    const d = MD.hypot(o.x - zona.x, o.z - zona.z);
    if (d < dr) { dr = d; r = o; }
  }
  const L = MD.hypot(zona.x - b.p.x, zona.z - b.p.z) || 1;
  const sig = lerp(ACOES.lancamento.erroRuim, ACOES.lancamento.erroBom, j.par.attr.passeLongo / 100) * (L / 40) * erroMult;
  const ex = zona.x + normal(m.rng) * sig * 0.7, ez = zona.z + normal(m.rng) * sig * 0.7;
  const qx = ex - b.p.x, qz = ez - b.p.z;
  const Lq = MD.hypot(qx, qz) || 1;
  const ux = qx / Lq, uz = qz / Lq;
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  let tipo = 'cruzamento', v, w, ticks;
  if (p.rasteiro) {
    const v0 = Math.min(30, velParaChegarCom(Lq, cc.vRasteiro));
    v = { x: ux * v0, y: 0, z: uz * v0 }; w = { x: 0, y: 0, z: 0 }; ticks = Math.round(Lq / (v0 * 0.8) / DT);
  } else {
    const el = p.mod ? cc.elevTenso : cc.elevAlto;
    w = { x: uz * 6, y: 0, z: -ux * 6 };
    // a bola passa pela zona na altura do cabeceio (alto) ou da cintura (tenso), já descendo
    const s = velParaAlturaEm(pp, ux, uz, Lq, el, w, p.mod ? cc.yTenso : cc.yAlto);
    const ce = MD.cos(el), se = MD.sin(el);
    v = { x: ux * s * ce, y: s * se, z: uz * s * ce };
    ticks = simularVoo(pp, v, w).ticks;
  }
  finalizarChute(m, j, pe, tipo, v, w, { x: ex, z: ez }, r, { voo: { alto: !p.rasteiro, zona: zona.nome, rasteiro: !!p.rasteiro, tenso: !!p.mod }, ticks });
  if (r) marcarRecebedor(m, r, ex, ez, 'cruzamento', m.tick + ticks);
  return true;
}

/** Velocidade para a bola (elevação el) passar a D metros na altura y. Busca binária. */
function velParaAlturaEm(pp, ux, uz, D, el, w, y) {
  let lo = 3, hi = 42;
  for (let i = 0; i < 26; i++) {
    const s = (lo + hi) / 2;
    if (alturaNaDistancia(pp, ux, uz, D, s, el, w).y < y) lo = s; else hi = s;
  }
  return (lo + hi) / 2;
}

/** Goleiro adversário (o mais perto do gol atacado). */
export function goleiroAdversario(m, time) {
  for (const o of m.jogadores) if (o.time !== time && o.posicao === 'GOL') return o;
  return null;
}

function chute(m, j, pe, p, erroMult) {
  const b = m.bola;
  const cfg = ACOES.chute;
  const lado = ataca(m, j.time);
  const gx = lado * CAMPO.meioX;
  const gk = goleiroAdversario(m, j.time);
  const meio = CAMPO.gol.largura / 2;
  const dGol = MD.hypot(gx - b.p.x, b.p.z);
  // cavadinha: goleiro adiantado entre a bola e o gol
  if (gk && dGol < ACOES.cavadinha.distMax) {
    const fora = (gx - gk.x) * lado;
    const entre = (gk.x - b.p.x) * lado > 1 && MD.hypot(gk.x - b.p.x, gk.z - b.p.z) < 14;
    if (fora > ACOES.cavadinha.goleiroFora && entre) return cavadinha(m, j, pe, p, erroMult, gx);
  }
  // mira: o analógico escolhe o canto; sem analógico, o lado mais longe do goleiro
  const dirGol = MD.atan2(-b.p.z, gx - b.p.x);
  let zMira;
  const mr = mira(j);
  if (mr && mr.mag > 0.3) {
    const lat = MD.sin(difAng(dirGol, MD.atan2(mr.z, mr.x)));
    zMira = clamp(lat * lado * meio * 1.4, -meio + 0.5, meio - 0.5);
    // "lat" positivo = para a direita de quem chuta; no gol de +x a direita é +z
  } else {
    const gz = gk ? gk.z : 0;
    zMira = gz > 0 ? -meio + 0.6 : meio - 0.6;
  }
  const yMira = lerp(cfg.yAlvo[0], cfg.yAlvo[1], p.forca * p.forca);
  const colocado = p.mod;
  let s = lerp(cfg.v[0], cfg.v[1], p.forca) * lerp(0.86, 1.08, j.par.attr.finalizacao / 100) * velPeFraco(j, pe);
  if (colocado) s *= cfg.colocadoV;
  let ux = gx - b.p.x, uz = zMira - b.p.z;
  const D0 = MD.hypot(ux, uz) || 1;
  ux /= D0; uz /= D0;
  // a altura é medida 0,4 m antes da linha: na linha estão as traves, e um voo que bate no
  // travessão confundiria a busca da elevação
  const D = Math.max(1, D0 - 0.4);
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  // colocado: efeito para dentro (curva para o meio do gol)
  let w = { x: 0, y: 0, z: 0 };
  if (colocado) {
    // efeito de dentro do pé: a bola sai por fora e curva para dentro do gol (Magnus ∝ ω × v,
    // com ω no eixo y: a força lateral em z vale −ωy·vx)
    const sinal = (zMira >= 0 ? 1 : -1) * lado;
    w = { x: 0, y: sinal * cfg.giroColocado, z: 0 };
    // gira a saída até a bola cruzar na mira (o desvio é medido em relação à reta original)
    const ux0 = ux, uz0 = uz;
    let a = 0;
    for (let k = 0; k < 3; k++) {
      const g = girar(ux0, uz0, a);
      const el0 = elevacaoParaAltura(pp, g.x, g.z, D, s, yMira, w);
      const r0 = alturaNaDistancia(pp, g.x, g.z, D, s, el0, w);
      a -= (r0.lateral + D * MD.sin(a)) / D;
    }
    const g = girar(ux0, uz0, a);
    ux = g.x; uz = g.z;
  }
  const el = elevacaoParaAltura(pp, ux, uz, D, s, yMira, w);
  // erro: distância, pressão, pé fraco, força no máximo, de primeira
  const base = lerp(cfg.erroRuim, cfg.erroBom, j.par.attr.finalizacao / 100);
  const sig = base * (1 + dGol / 25) * erroMult * (p.forca > 0.9 ? cfg.forcaMaxErro : 1) * (colocado ? cfg.colocadoErro : 1);
  const ea = normal(m.rng) * sig, ee = normal(m.rng) * sig * 0.6;
  const u = girar(ux, uz, ea);
  const ce = MD.cos(el + ee), se = MD.sin(el + ee);
  const tipo = colocado ? 'colocado' : 'chute';
  const ticks = Math.round(D / (s * 0.9) / DT);
  finalizarChute(m, j, pe, tipo, { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, w, { x: gx, z: zMira }, null, { voo: { alto: false, mira: { y: yMira, z: zMira } }, ticks });
  return true;
}

function cavadinha(m, j, pe, p, erroMult, gx) {
  const b = m.bola;
  const cfg = ACOES.cavadinha;
  const lado = ataca(m, j.time);
  // cai logo depois da linha: passa nela abaixo do travessão, descendo
  let ux = gx + lado * cfg.alemDaLinha - b.p.x, uz = -b.p.z * 0.6;
  const D = MD.hypot(ux, uz) || 1;
  ux /= D; uz /= D;
  const pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const w = { x: uz * 12, y: 0, z: -ux * 12 };
  const s = velParaPousar(pp, ux, uz, D, cfg.elev, w);
  // a cavadinha é difícil de dosar (StatsBomb: 41,8% no alvo): erro grande na força e na direção
  const fin = j.par.attr.finalizacao / 100;
  const u = girar(ux, uz, normal(m.rng) * lerp(cfg.erroDir[0], cfg.erroDir[1], fin) * erroMult);
  const s2 = s * (1 + normal(m.rng) * lerp(cfg.erroForca[0], cfg.erroForca[1], fin) * erroMult);
  const ce = MD.cos(cfg.elev), se = MD.sin(cfg.elev);
  finalizarChute(m, j, pe, 'cavadinha', { x: u.x * s2 * ce, y: s2 * se, z: u.z * s2 * ce }, w, { x: b.p.x + ux * D, z: b.p.z + uz * D }, null, { voo: { alto: true } });
  return true;
}

/** Cabeceio (bola alta): PASSE = para um companheiro; CHUTE = no gol; LANÇAMENTO = afastar. */
export function executarCabeceio(m, j, p) {
  const b = m.bola;
  const lado = ataca(m, j.time);
  const cfg = ACOES.cabeceio;
  const attr = j.par.attr.cabeceio;
  const sig = lerp(0.12, 0.03, attr / 100);
  let ux, uz, s, el;
  let para = null;
  if (p.tipo === 'chute') {
    const gx = lado * CAMPO.meioX;
    const meio = CAMPO.gol.largura / 2;
    const mr = mira(j);
    const zM = mr && mr.mag > 0.3 ? clamp(mr.z * meio, -meio + 0.4, meio - 0.4) : (b.p.z > 0 ? -1.5 : 1.5);
    ux = gx - b.p.x; uz = zM - b.p.z;
    const D = MD.hypot(ux, uz) || 1; ux /= D; uz /= D;
    // força própria do cabeceio com corrida (Becker 2021: ~8,3 m/s) + parte da bola que chega
    const vIn = MD.hypot(b.v.x, b.v.y, b.v.z);
    s = clamp(lerp(cfg.potencia[0], cfg.potencia[1], attr / 100) + cfg.redirecao * vIn, cfg.v[0], cfg.v[1]);
    el = -0.08; // cabeçada para baixo
  } else if (p.tipo === 'passe') {
    para = escolherAlvo(m, j, 'passe');
    const tx = para ? para.x : j.x + dirPedida(j).x * 10, tz = para ? para.z : j.z + dirPedida(j).z * 10;
    ux = tx - b.p.x; uz = tz - b.p.z;
    const D = MD.hypot(ux, uz) || 1; ux /= D; uz /= D;
    s = clamp(D * 0.9 + 3, 6, 14);
    el = 0.25;
  } else {
    const d = dirPedida(j);
    ux = d.x * 0.4 + lado * 0.6; uz = d.z * 0.4;
    const l = MD.hypot(ux, uz) || 1; ux /= l; uz /= l;
    s = 16; el = 0.6;
  }
  const u = girar(ux, uz, normal(m.rng) * sig);
  el += normal(m.rng) * sig * 0.5;
  const ce = MD.cos(el), se = MD.sin(el);
  finalizarChute(m, j, j.par.attr.pePreferido, 'cabeceio', { x: u.x * s * ce, y: s * se, z: u.z * s * ce }, { x: 0, y: 0, z: 0 }, { x: b.p.x + u.x * 10, z: b.p.z + u.z * 10 }, para, { voo: { alto: el > 0.2, cabeceio: p.tipo } });
  if (para) marcarRecebedor(m, para, para.x, para.z, 'passe', 0);
  return true;
}

/** Tabela: depois do passe, segurando o modificador, o passador corre para o espaço. */
function tabela(m, j, p) {
  if (!(j.botoes & BOTAO.MOD) && !p.mod) return;
  const lado = ataca(m, j.time);
  const d = dirPedida(j);
  const x = j.x + lado * 12 + d.x * 4, z = j.z + d.z * 6;
  const q = dentroDoCampo(x, z, 2);
  j.corrida = { x: q.x, z: q.z, ate: m.tick + 150, tipo: 'tabela' };
}

// ------------------------------------------------------------------ bola alta: domínio no corpo

/**
 * Altura e ponto em que a bola (no ar) passa pelo jogador: o tick de maior aproximação entre os
 * que ficam a ≤ 0,6 m do corpo na horizontal (onde ela chega ao corpo). {i, y, x, z} ou null.
 */
export function bolaAltaPassando(m, j, max = 60) {
  const b = m.bola;
  if (b.rolando) return null;
  const t = criarBola(b.p.x, b.p.z);
  Object.assign(t.p, b.p); Object.assign(t.v, b.v); Object.assign(t.w, b.w); t.rolando = false;
  const ev = [];
  let melhor = null;
  for (let i = 1; i <= max; i++) {
    passoBolaTeste(t, ev);
    const d = MD.hypot(t.p.x - j.x, t.p.z - j.z);
    if (d < 0.6) {
      if (!melhor || d < melhor.d) melhor = { i, y: t.p.y, x: t.p.x, z: t.p.z, d };
      else break; // já se afastando
    } else if (melhor) break;
    if (t.rolando) break;
  }
  // ainda se aproximando no fim do horizonte: o ponto de contato não está visto
  if (melhor && melhor.i >= max) return null;
  return melhor;
}

