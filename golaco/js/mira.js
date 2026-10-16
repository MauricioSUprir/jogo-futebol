// Cobrança mirada da bola parada do HUMANO (pedido do dono, 16/10: "igual no FIFA ... essa linha no escanteio, e na
// falta, que tenha como colocar curva"; PESQUISA-ETAPA4.md §12; constantes em config.js MIRA). Puro: sem three.js nem DOM;
// nenhum sorteio aqui (o erro do cobrador é do acoes.js cobrancaMirada, pelo m.rng).
//
// Só a PESSOA cobrando (partida.js cobrar: entrada sem `ia`/`iaCobra`) escanteio, tiro livre ou tiro de meta: a IA e a
// demo cobram como antes (a partida IA × IA não muda: hash-partida IGUAL). Estado em m.parada.mira (criarMira):
//   {ang0, ang, curva, cone, rep: [tick do próximo degrau de cada lado ou -1]}
// O analógico GIRA a mira (o componente dele de lado da direção de partida ang0 — a câmera atrás do cobrador olha por
// ela: o lado da tela), a curva anda em degraus pelos botões de efeito (BOTAO.EFEITO_E / EFEITO_D) e a força é a carga
// do botão. chuteMirado dá a velocidade e o giro PRETENDIDOS — a MESMA conta no chute de verdade (acoes.js) e na linha
// da tela (preverMira, passo a passo pela física da bola: bola.js passoBola).
import { CAMPO, ACOES, MIRA, BOTAO, BARREIRA, PASSO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp, difAng } from './mat.js';
import { criarBola, passoBola, elevacaoParaAltura } from './bola.js';

export const TIPOS_MIRA = ['escanteio', 'tiroLivre', 'tiroDeMeta'];
/** Rótulo de COMANDO de cada tipo (aviso de comando, não narração). */
export const ROTULO_MIRA = { alta: 'ALTA', tensa: 'TENSA', chute: 'CHUTE', curta: 'CURTA', longa: 'LONGA' };

const ladoDe = (m, t) => (m.ataca ? m.ataca[t] : (t === 0 ? 1 : -1));
const jogador = (m, id) => { for (const j of m.jogadores) if (j.id === id) return j; return null; };

/** Distância da bola parada ao meio do gol atacado. */
function distGol(m, pr) {
  const gx = ladoDe(m, pr.time) * CAMPO.meioX;
  return MD.hypot(gx - pr.x, pr.z);
}

/** Tiro livre direto perto o bastante do gol para o CHUTE ir a gol (o resto: cruzamento/passe). */
export function chuteAGol(m, pr) {
  return pr.tipo === 'tiroLivre' && !!pr.direto && distGol(m, pr) <= MIRA.distChute;
}

/**
 * Alvo de partida da cobrança (x, z): para onde a câmera atrás do cobrador olha e a mira começa. Escanteio: a marca do
 * pênalti; tiro livre a gol: o meio do gol; outro tiro livre: 30 m na direção do gol (no máximo a marca do pênalti);
 * tiro de meta: 35 m para a frente, abrindo para o lado em que está; pênalti: o meio do gol. Escreve em `out`.
 */
export function alvoPadrao(m, pr, out = {}) {
  const lado = ladoDe(m, pr.time), gx = lado * CAMPO.meioX;
  if (pr.tipo === 'escanteio') { out.x = gx - lado * CAMPO.marcaPenalti; out.z = 0; }
  else if (pr.tipo === 'penalti' || chuteAGol(m, pr)) { out.x = gx; out.z = 0; }
  else if (pr.tipo === 'tiroDeMeta') { out.x = pr.x + lado * 35; out.z = pr.z * 2.5; }
  else {
    const px = gx - lado * CAMPO.marcaPenalti, dx = px - pr.x, dz = -pr.z, d = MD.hypot(dx, dz) || 1, k = Math.min(1, 30 / d);
    out.x = pr.x + dx * k; out.z = pr.z + dz * k;
  }
  return out;
}

/** Mira nova da parada (a direção de partida = a do alvo padrão). */
export function criarMira(m, pr) {
  const a = alvoPadrao(m, pr);
  const ang0 = MD.atan2(a.z - pr.z, a.x - pr.x);
  return { ang0, ang: ang0, curva: 0, cone: MIRA.cone[pr.tipo] ?? 1, rep: [-1, -1] };
}

/**
 * Um tick da mira pela entrada do cobrador c (j.ix/iz/imag, j.botoes, j.botoesAnt): o lado do analógico gira, os botões
 * de efeito passam a curva um degrau (segurar repete). Sem efeito no tiro de meta (só a direção).
 */
export function atualizarMira(m, c, mi, tipo) {
  if (c.imag > 0) {
    // o lado do analógico em relação à direção de partida (a da câmera): + = para a direita de quem bate
    const lat = (-MD.sin(mi.ang0) * c.ix + MD.cos(mi.ang0) * c.iz) * c.imag;
    if (Math.abs(lat) > 0.15) {
      const a = mi.ang + lat * MIRA.gira * PASSO;
      mi.ang = mi.ang0 + clamp(difAng(mi.ang0, a), -mi.cone, mi.cone);
    }
  }
  if (tipo === 'tiroDeMeta') { mi.curva = 0; return; }
  const bits = [BOTAO.EFEITO_E, BOTAO.EFEITO_D];
  for (let k = 0; k < 2; k++) {
    const b = bits[k], agora = (c.botoes & b) !== 0, antes = (c.botoesAnt & b) !== 0;
    if (!agora) { mi.rep[k] = -1; continue; }
    if (!antes || (mi.rep[k] >= 0 && m.tick >= mi.rep[k])) {
      mi.curva = clamp(Math.round((mi.curva + (k ? 1 : -1) * MIRA.curvaPasso) / MIRA.curvaPasso) * MIRA.curvaPasso, -1, 1);
      mi.rep[k] = m.tick + Math.round((antes ? MIRA.curvaRepete : MIRA.curvaRepete * 2.5) / PASSO);
    }
  }
}

/**
 * Tipo da cobrança pelo botão (tipo do pedido/carga e o modificador): 'alta' | 'tensa' | 'chute' (com a linha da
 * trajetória) ou 'curta' | 'longa' (o passe do jogo; a linha só da direção). Sem botão: o padrão da parada.
 */
export function tipoMirado(m, pr, botao, mod) {
  const aGol = chuteAGol(m, pr);
  if (pr.tipo === 'tiroDeMeta') return botao === 'passe' || botao === 'enfiada' ? 'curta' : 'longa';
  if (botao === 'passe' || botao === 'enfiada') return 'curta';
  if (botao === 'chute') return aGol ? 'chute' : 'tensa';
  if (botao === 'lancamento') return mod ? 'tensa' : 'alta';
  return aGol ? 'chute' : 'alta';
}

/** Os tipos com a trajetória prevista (velocidade e giro desta conta): o resto é o passe do jogo na direção da mira. */
export const comTrajetoria = tipo => tipo === 'alta' || tipo === 'tensa' || tipo === 'chute';

/** Efeito máximo (rad/s) do cobrador: pelo atributo do tipo (finalização no chute, passe longo no cruzamento). */
function giroDe(j, tipo) {
  const a = j.par.attr;
  const at = tipo === 'chute' ? a.finalizacao : a.passeLongo;
  return MIRA.giro * lerp(MIRA.giroAtrib[0], MIRA.giroAtrib[1], clamp((at ?? 70) / 100, 0, 1));
}

/**
 * Velocidade e giro PRETENDIDOS da cobrança mirada (a mesma conta no chute e na linha). tipo 'alta' | 'tensa' | 'chute';
 * forca 0–1; ang = rumo da mira; curva −1..1 (+ = curva para a direita de quem bate). Devolve {v, w, el, s, D} em `out`
 * (D: no chute, a distância pela mira até a linha do gol). A bola parte de m.bola.p.
 */
export function chuteMirado(m, j, pr, tipo, forca, ang, curva, out = {}) {
  const b = m.bola, pp = { x: b.p.x, y: b.p.y, z: b.p.z };
  const ux = MD.cos(ang), uz = MD.sin(ang);
  // efeito: giro no eixo vertical — a força de Magnus (ω × v) com ωy < 0 empurra para a direita de quem bate
  const wy = -clamp(curva, -1, 1) * giroDe(j, tipo);
  let w, el, s, D = 0;
  if (tipo === 'chute') {
    const cfg = ACOES.chute, lado = ladoDe(m, j.time), gx = lado * CAMPO.meioX;
    s = lerp(cfg.v[0], cfg.v[1], forca) * lerp(0.86, 1.08, j.par.attr.finalizacao / 100);
    // com efeito por cima (a bola desce: a mesma do chute de falta do jogo) e o efeito de lado
    w = { x: uz * cfg.giroFalta, y: wy, z: -ux * cfg.giroFalta };
    D = ux * lado > 0.05 ? Math.max(1, (gx - pp.x) / ux - 0.4) : 25;
    const br = pr.barreira;
    if (br && br.n > 0 && D > br.dist + 1) el = elevacaoParaAltura(pp, ux, uz, br.dist, s, BARREIRA.alturaPassar, w);
    else el = elevacaoParaAltura(pp, ux, uz, D, s, lerp(cfg.yAlvo[0], cfg.yAlvo[1], forca * forca), w);
  } else {
    const cfg = tipo === 'tensa' ? MIRA.tensa : MIRA.alta;
    s = lerp(cfg.v[0], cfg.v[1], forca);
    el = cfg.elev;
    w = { x: uz * 6, y: wy, z: -ux * 6 }; // o giro do cruzamento do jogo (acoes.js) e o efeito de lado
  }
  const ce = MD.cos(el), se = MD.sin(el);
  out.v = { x: ux * s * ce, y: s * se, z: uz * s * ce };
  out.w = w; out.el = el; out.s = s; out.D = D;
  return out;
}

/** Força da carga do cobrador agora (a mesma conta do acoes.js soltarCarga), ou null sem carga. */
export function forcaDaCarga(m, c) {
  if (!c.carga) return null;
  return clamp((m.tick - c.carga.t0) * PASSO / ACOES.cargaCheia, 0.08, 1);
}

/**
 * A trajetória simulada passo a passo (a física do jogo: bola.js passoBola), de m.bola.p com (v, w), até: a bola tocar
 * o chão, cruzar a linha de fundo, andar `maxDist` m na horizontal ou `max` pontos. Escreve x, y, z de cada tick em
 * `pts` (o ponto 0 = a bola agora; o ponto k = depois de k passos). Devolve o número de pontos.
 */
export function simularLinha(m, v, w, pts, maxDist = Infinity, max = MIRA.maxPontos) {
  const b0 = m.bola.p;
  const b = criarBola(b0.x, b0.z);
  b.p.y = b0.y;
  b.v.x = v.x; b.v.y = v.y; b.v.z = v.z; b.w.x = w.x; b.w.y = w.y; b.w.z = w.z;
  b.rolando = !(v.y > 0.01);
  const ev = [];
  pts[0] = b.p.x; pts[1] = b.p.y; pts[2] = b.p.z;
  let n = 1;
  while (n < max) {
    ev.length = 0;
    passoBola(b, ev);
    pts[n * 3] = b.p.x; pts[n * 3 + 1] = b.p.y; pts[n * 3 + 2] = b.p.z;
    n++;
    if (ev.length || b.rolando) break; // quique, trave, rede ou placa: a linha para ali
    if (Math.abs(b.p.x) > CAMPO.meioX + 0.3 || Math.abs(b.p.z) > CAMPO.meioZ + 0.3) break;
    if (MD.hypot(b.p.x - b0.x, b.p.z - b0.z) >= maxDist) break;
  }
  return n;
}

const _cm = {};
/**
 * O que a tela mostra da cobrança mirada do humano agora (render/linha-mira.js e o rótulo do HUD), ou null sem ela:
 * {tipo, rotulo, curva, carregando, forca, n (pontos em `pts`), trajetoria (true = a linha da física; false = só a
 * direção, no chão)}. Só lê o mundo.
 */
export function preverMira(m, pts, out = {}) {
  const pr = m.parada;
  if (!pr || pr.rolou || !pr.mira || pr.cobrador == null || m.posse !== pr.cobrador) return null;
  const c = jogador(m, pr.cobrador);
  if (!c) return null;
  const mi = pr.mira;
  const carga = c.carga;
  const tipo = tipoMirado(m, pr, carga ? carga.tipo : null, carga ? (carga.mod || (c.botoes & BOTAO.MOD) !== 0) : (c.botoes & BOTAO.MOD) !== 0);
  const f = forcaDaCarga(m, c);
  out.tipo = tipo; out.rotulo = ROTULO_MIRA[tipo]; out.curva = mi.curva; out.carregando = f != null;
  out.forca = f ?? MIRA.forcaPadrao; out.ang = mi.ang;
  out.trajetoria = comTrajetoria(tipo);
  if (!out.trajetoria) {
    // só a direção (o passe do jogo escolhe quem recebe no cone dela)
    const ux = MD.cos(mi.ang), uz = MD.sin(mi.ang), L = MIRA.direcao;
    const k = 12;
    for (let i = 0; i <= k; i++) { pts[i * 3] = pr.x + ux * L * i / k; pts[i * 3 + 1] = 0.03; pts[i * 3 + 2] = pr.z + uz * L * i / k; }
    out.n = k + 1;
    return out;
  }
  const r = chuteMirado(m, c, pr, tipo, out.forca, mi.ang, mi.curva, _cm);
  // no chute a gol, a linha só até um pouco além da barreira (sem barreira: os primeiros metros)
  const maxDist = tipo === 'chute' ? (pr.barreira && pr.barreira.n > 0 ? pr.barreira.dist + MIRA.linhaChute : MIRA.semBarreira) : Infinity;
  out.n = simularLinha(m, r.v, r.w, pts, maxDist);
  return out;
}
