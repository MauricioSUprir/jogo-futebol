// GOLAÇO — a TELA ANTES DO JOGO (item 64; dono, 23/10, com o print da pré-partida do EA FC: "quero que fique NESSE NÍVEL; só
// altere para o Total Match com cores e etc, mas é do mesmo nível"; contrato "Tela antes do jogo (item 64)" no CONTRATOS.md):
// a parte PURA — as contas do layout (regimes do celular deitado e as proporções do FC 24 no PC), a projeção do campinho em
// perspectiva, as fichas na formação, a Visão tática (a vista com/sem a bola do FC 25, pela MESMA posicaoTatica da IA), a linha
// de informação com o corte por prioridade, o selo da tática, o árbitro FICTÍCIO e os dados da partida para a tela.
// Sem three.js nem DOM; nunca escreve no mundo nem gasta o m.rng (o árbitro sai de uma mistura própria da semente). Fora do fecho
// do hash (nenhum módulo da simulação importa este); as constantes moram aqui (o config.js é do fecho).
import { PASSO } from './config.js';
import { FORMACOES } from './formacoes.js';
import { ELENCOS, fichaDe, notaExibida, notaTime, estrelas, h32 } from './elenco.js';
import { posicaoTatica, TATICA_PADRAO } from './tatica.js';

/** As constantes da tela (medidas da maquete da proposta FC e as contas da proposta do celular; spec §1). */
export const PREPARTIDA = Object.freeze({
  // celular deitado: altura útil ≤ celularMaxH (ou janela de PC com menos de pcMinW de largura)
  celularMaxH: 480, pcMinW: 560,
  // os regimes do celular pela altura útil (Hu = innerHeight − sa-t − sa-b)
  regimes: Object.freeze({ normal: 352, compacto: 316, minimo: 277 }),
  // o campinho: o topo do trapézio = topo × a base; o meio-campo a ~41% do alto (perspectiva verdadeira)
  topo: 0.70,
  // a base no celular = a largura útil × baseCel; no PC = min(basePcW · W, basePcH · H)
  baseCel: 0.86, basePcW: 0.64, basePcH: 1.03,
  // a folga vertical entre as 5 fileiras (px)
  folga: Object.freeze({ cel: 2, pc: 4 }),
  // a ficha pela fileira hc: nome = clamp(min, round(k·hc), max); a linha do nome; o filete; a nota; a largura (em) do nome
  nome: Object.freeze({ minCel: 10, minPc: 11, k: 0.235, max: 20, linha: 1.15, em: 5.2 }),
  filete: Object.freeze({ cel: 2, pc: 3 }),
  // a Visão tática: o disco (px) e o piso; o afastamento máximo de um disco do ponto dele (só desenho)
  disco: Object.freeze({ celMin: 21, celMax: 25, pc: 32, piso: 18, folga: 1, afasta: 4 }),
  // a janela da Visão tática: o bloco ± janela m
  janela: 6,
  // o 3D atrás da tela: 30 qps
  qps: 30,
  // a reserva: o módulo que não chega até reservaMs depois do 3D pronto → a abertura de texto de hoje
  reservaMs: 1500,
  // o armado (Simular partida, Voltar ao TM, Sair): o 2º toque até armadoMs depois do 1º
  armadoMs: 3000,
});

// ------------------------------------------------------------------------------------------------ medidas de texto
// avanços da TM Cond 800 (Barlow Condensed ExtraBold, a letra da carta do TM) em 1/1000 em, de U+0020 a U+00FF (latin-1);
// medidos da fonte (assets/tm/fontes/tmcond-800-latin.woff2) — a conta do nome não espera a fonte chegar
const AVANCO = [200, 289, 385, 626, 454, 761, 624, 188, 343, 343, 362, 437, 223, 337, 235, 444, 456, 294, 451, 446, 508, 450, 451, 422, 446, 446, 298, 246, 437, 437, 437, 462, 760, 508, 477, 470, 480, 441, 427, 473, 483, 235, 462, 505, 437, 558, 522, 479, 474, 467, 481, 454, 485, 480, 506, 707, 490, 492, 419, 360, 444, 360, 432, 437, 234, 457, 453, 445, 453, 446, 305, 451, 455, 223, 223, 465, 219, 685, 455, 452, 456, 456, 336, 426, 299, 455, 456, 635, 462, 442, 377, 370, 201, 370, 500, 426, 426, 426, 426, 426, 426, 0, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 426, 200, 289, 445, 522, 587, 534, 201, 454, 391, 776, 298, 454, 437, 0, 433, 280, 359, 437, 273, 289, 234, 458, 530, 235, 162, 161, 301, 454, 735, 701, 815, 462, 508, 508, 508, 508, 508, 508, 775, 470, 441, 441, 441, 441, 235, 235, 235, 235, 506, 522, 479, 479, 479, 479, 479, 409, 517, 480, 480, 480, 480, 492, 473, 471, 457, 457, 457, 457, 457, 457, 698, 445, 446, 446, 446, 446, 197, 197, 197, 197, 456, 455, 452, 452, 452, 452, 452, 437, 459, 455, 455, 455, 455, 442, 451, 442];
/** Largura (px) do texto em TM Cond 800 a `px` (caixa alta: o nome de camisa na ficha); fora do latin-1, 0,5 em por letra. */
export function larguraCond(texto, px, caixaAlta = true) {
  const s = caixaAlta ? String(texto).toUpperCase() : String(texto);
  let w = 0;
  for (const ch of s) { const c = ch.codePointAt(0); w += c >= 32 && c <= 255 ? AVANCO[c - 32] : 500; }
  return w / 1000 * px;
}
/** Largura aproximada (px) do texto em Inter 600–800 a `px` (a conta do corte da info e do ícone das abas; a tela mede de verdade). */
export function larguraInter(texto, px, peso = 600) {
  let w = 0;
  for (const ch of String(texto)) {
    if (ch === ' ') w += 0.28;
    else if ('iIlj.,:;|!\'·'.includes(ch)) w += 0.3;
    else if ('mwMW'.includes(ch)) w += 0.88;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else if (ch >= '0' && ch <= '9') w += 0.62;
    else w += 0.56;
  }
  return w * px * (peso >= 800 ? 1.06 : 1);
}

// ------------------------------------------------------------------------------------------------ regime e layout
/** O regime da tela: 'pc' (altura útil > 480 e largura ≥ 560) ou o do celular deitado pela altura útil. */
export function regime(W, H, sa = {}) {
  const hu = H - (sa.t || 0) - (sa.b || 0);
  if (hu > PREPARTIDA.celularMaxH && W >= PREPARTIDA.pcMinW) return 'pc';
  const R = PREPARTIDA.regimes;
  return hu >= R.normal ? 'normal' : hu >= R.compacto ? 'compacto' : hu >= R.minimo ? 'minimo' : 'emergencia';
}

// as réguas do celular por regime (px CSS; spec §1.1: margem · barra · vão · info · vão · campinho · vão · abas · margem)
const CEL = {
  normal: { m: 8, mb: 6, barra: 36, g1: 4, info: 14, fInfo: 12, g2: 6, g3: 6, abas: 44, fAba: 15, fHora: 20, escudo: 28, menu: 40, gb: 6, fComp: 11 },
  compacto: { m: 6, mb: 6, barra: 30, g1: 3, info: 13, fInfo: 11, g2: 4, g3: 4, abas: 40, fAba: 14, fHora: 18, escudo: 24, menu: 34, gb: 5, fComp: 11 },
  minimo: { m: 4, mb: 4, barra: 28, g1: 2, info: 13, fInfo: 11, g2: 2, g3: 2, abas: 36, fAba: 14, fHora: 18, escudo: 22, menu: 34, gb: 5, fComp: 10 },
  emergencia: { m: 4, mb: 4, barra: 28, g1: 0, info: 0, fInfo: 11, g2: 3, g3: 2, abas: 36, fAba: 13, fHora: 18, escudo: 22, menu: 34, gb: 5, fComp: 10 },
};

/**
 * O layout da tela inteira (px CSS) — spec §1. sa = {l, r, t, b} (a área segura), formacao = o id da formação (as fichas pelas
 * fila/col das vagas dela), nAbas = 3 ou 4. opc = {vagas (a lista de vagas a desenhar: o Livre só com quem está em campo, os
 * Pênaltis a fila), canto: há o botão [<] (TM Livre/Pênaltis, online)}. Devolve as caixas de cada peça, a ficha e as fichas.
 */
export function layoutPrepartida(W, H, sa = {}, formacao = '4-3-3', nAbas = 3, opc = {}) {
  sa = { l: sa.l || 0, r: sa.r || 0, t: sa.t || 0, b: sa.b || 0 };
  const reg = regime(W, H, sa);
  const pc = reg === 'pc';
  const L = { W, H, sa, regime: reg, pc };
  if (!pc) {
    const c = CEL[reg];
    const barra = reg === 'normal' && H - sa.t < 380 ? 34 : c.barra;
    L.xL = Math.max(12, sa.l + 8); L.xR = W - Math.max(12, sa.r + 8);
    L.usavel = L.xR - L.xL;
    const yB = sa.t + c.m;
    L.barra = { y: yB, h: barra, escudo: c.escudo, camisa: c.escudo - 4, ctl: c.escudo, hora: c.fHora, g: c.gb, nomes: false };
    L.botaoTime = { h: reg === 'normal' ? Math.max(barra, 36) : Math.max(barra, 30) };
    L.menu = { lado: c.menu, x: L.xR - c.menu, y: yB + (barra - c.menu) / 2 };
    if (L.menu.y < sa.t + 2) L.menu.y = sa.t + 2;
    L.info = c.info ? { y: yB + barra + c.g1, h: c.info, letra: c.fInfo, linhas: 1 } : { y: yB + barra, h: 0, letra: c.fInfo, linhas: 0 };
    // a info nunca passa por baixo do ≡ nem do canto [<]: a largura fica entre eles
    L.info.x = L.xL + c.menu + 6; L.info.w = L.usavel - 2 * (c.menu + 6);
    const yCampo = L.info.y + L.info.h + c.g2;
    const hAbas = c.abas;
    const yAbas = H - sa.b - c.mb - hAbas;
    L.campo = { top: yCampo, h: yAbas - c.g3 - yCampo, cx: (L.xL + L.xR) / 2 };
    L.campo.B = L.usavel * PREPARTIDA.baseCel;
    L.abas = { x: L.xL, y: yAbas, w: L.usavel, h: hAbas, vao: 6, letra: c.fAba };
    L.comp = { x: L.xL, y: yB, h: barra, letra: c.fComp };
    L.cmd = null;
    L.folga = PREPARTIDA.folga.cel;
  } else {
    const vh = H / 100;
    L.xL = Math.max(0.05 * W, sa.l + 12); L.xR = Math.min(0.95 * W, W - sa.r - 12);
    L.usavel = L.xR - L.xL;
    const esc = Math.max(30, 5.8 * vh);
    L.comp = { x: 0, y: 5 * vh, h: 6 * vh, letra: Math.max(13, 2 * vh), centro: true };
    L.menu = { lado: 44, x: L.xR - 44, y: 5 * vh + (6 * vh - 44) / 2 };
    const hb = Math.max(40, 6.5 * vh);
    L.barra = { y: 15.5 * vh, h: hb, escudo: esc, camisa: Math.max(28, 5.8 * vh), ctl: Math.max(28, 5.8 * vh), hora: Math.max(20, 3.75 * vh), g: Math.round(H * 0.011), nomes: true, letraNome: Math.max(14, 2.1 * vh) };
    L.botaoTime = { h: Math.max(hb, 44) };
    const fInfo = Math.max(13, 1.95 * vh);
    L.info = { y: 24.6 * vh, h: Math.round(fInfo * 1.25) * 2, letra: fInfo, linhas: 2, x: L.xL, w: L.usavel };
    L.campo = { top: 32 * vh, h: 46 * vh, cx: W / 2 };
    L.campo.B = Math.min(PREPARTIDA.basePcW * W, PREPARTIDA.basePcH * H, L.usavel);
    const hAbas = Math.max(44, 7.3 * vh);
    L.abas = { x: L.xL, y: 83.5 * vh, w: L.usavel, h: hAbas, vao: Math.round(W * 0.006), letra: Math.max(15, 2.5 * vh) };
    L.cmd = { y: 95.4 * vh, letra: Math.max(12, 1.9 * vh), x: L.xL };
    L.folga = PREPARTIDA.folga.pc;
  }
  // o canto [<]: no celular à esquerda da competição (na linha da barra); no PC no alto à esquerda
  if (opc.canto) {
    const lado = L.menu.lado;
    L.canto = { lado, x: L.xL, y: L.menu.y };
    if (!pc) { L.comp.x = L.xL + lado + 6; }
  } else L.canto = null;
  // as abas: n blocos lado a lado com o vão; o ícone sai quando não cabe
  L.abas.n = nAbas;
  L.abas.larguraAba = (L.abas.w - (nAbas - 1) * L.abas.vao) / nAbas;
  // ---- o campinho: o trapézio (base B embaixo, topo T = topo · B) e as 5 fileiras iguais
  const C = L.campo;
  C.T = PREPARTIDA.topo * C.B;
  const hc = Math.floor((C.h - 4 * L.folga) / 5);
  L.hc = hc;
  L.ficha = medidasFicha(hc, pc, reg);
  C.s = (C.h - hc) / 4;
  // as fichas pela fila/col das vagas
  const vagas = opc.vagas ?? FORMACOES[formacao]?.vagas ?? FORMACOES['4-3-3'].vagas;
  L.fichas = vagas.map(v => { const p = posFicha(L, v.fila, v.col); return { vaga: v.id, fila: v.fila, col: v.col, x: p.x, y: p.y }; });
  // os cantos de baixo do campinho (ao lado do goleiro): a formação e o selo à esquerda, o geral e as estrelas à direita
  const yDef = posFicha(L, 1, 0).y + hc / 2 + 2;
  const fForma = pc ? Math.round(hc * 0.42) : Math.round(Math.min(22, hc * 0.48));
  // (o selo: ≥ 11 px no celular e ≥ 12 no PC — a letra mínima da tela)
  const fSelo = pc ? Math.max(12, Math.round(hc * 0.2)) : 11;
  const base = larguraEm(C, C.top + C.h);
  L.cantos = {
    y: yDef, forma: fForma, selo: Math.max(10, fSelo),
    esq: { x: C.cx - base / 2 + 8 }, dir: { x: C.cx + base / 2 - 8 },
    h: Math.round(fForma * 1.05) + Math.round(Math.max(10, fSelo) * 1.3),
  };
  return L;
}

/** As medidas da ficha pela fileira hc (spec §1.1). Emergência: sem rosto (nota + nome). */
export function medidasFicha(hc, pc, reg = pc ? 'pc' : 'normal') {
  const N = PREPARTIDA.nome;
  const nome = Math.max(pc ? N.minPc : N.minCel, Math.min(N.max, Math.round(N.k * hc)));
  const linha = Math.round(N.linha * nome);
  const filete = pc ? PREPARTIDA.filete.pc : PREPARTIDA.filete.cel;
  const semRosto = reg === 'emergencia';
  const rosto = semRosto ? 0 : hc - linha - filete - 2;
  const nota = Math.max(11, Math.min(26, Math.round((semRosto ? hc - linha - filete - 2 : rosto) / 2)));
  const largura = Math.round(Math.max(rosto * 0.9 + 2 + nota * 0.95, nome * N.em));
  return { hc, nome, linha, filete, rosto, nota, largura, cabeca: Math.round(rosto * 0.9 + 2 + nota * 0.95), chanfro: Math.max(3, Math.round(rosto * 0.17)), semRosto };
}

/** Largura do trapézio na altura y (px). */
function larguraEm(C, y) { return C.T + (C.B - C.T) * (y - C.top) / C.h; }
/** O centro da ficha da fila/col: as filas 0 (goleiro, embaixo) a 4 (ataque, em cima); col −2…2 pela largura naquela altura. */
export function posFicha(L, fila, col) {
  const C = L.campo, hc = L.hc;
  const y = C.top + hc / 2 + (4 - fila) * C.s;
  const u = (larguraEm(C, y) - L.ficha.largura - 12) / 4;
  return { x: C.cx + col * u, y, u };
}

// ------------------------------------------------------------------------------------------------ projeção do campinho
/**
 * O ponto do campo (fx: 0 = a linha de fundo de cá, embaixo; 1 = a de lá, em cima; fz: −1…1, a esquerda à esquerda) → px, em
 * perspectiva verdadeira (o topo = PREPARTIDA.topo da base). janela = {f0, f1}: o trecho do campo que ocupa o campinho (a Visão
 * tática aproxima no bloco).
 */
export function projetar(L, fx0, fz, janela = null) {
  const C = L.campo, k = PREPARTIDA.topo, a = 1 / k - 1;
  const f0 = janela ? janela.f0 : 0, f1 = janela ? janela.f1 : 1;
  const fx = (fx0 - f0) / (f1 - f0);
  const sc = 1 / (1 + a * fx);
  const fy = (sc - k) / (1 - k);
  return [C.cx + fz * C.B / 2 * sc, C.top + C.h * fy];
}

/**
 * As linhas do campinho (para o SVG): o contorno, o meio-campo, o círculo e as áreas — o que cabe na janela. Devolve
 * {contorno: [[x, y] × 4], linhas: [[x1, y1, x2, y2]], polis: [[[x, y]…], fechado]}.
 */
export function linhasCampinho(L, janela = null) {
  const f0 = janela ? janela.f0 : 0, f1 = janela ? janela.f1 : 1;
  const P = (fx, fz) => projetar(L, fx, fz, janela);
  const out = { contorno: [P(f0, -1), P(f1, -1), P(f1, 1), P(f0, 1)], linhas: [], polis: [] };
  if (f0 <= 0.5 && f1 >= 0.5) { const a = P(0.5, -1), b = P(0.5, 1); out.linhas.push([a[0], a[1], b[0], b[1]]); }
  const area = (a, b, z) => [[P(a, -z), P(b, -z), P(b, z), P(a, z)], false];
  if (f0 === 0) out.polis.push(area(0, 16.5 / 105, 20.16 / 34), area(0, 5.5 / 105, 9.16 / 34));
  if (f1 === 1) out.polis.push(area(1, 1 - 16.5 / 105, 20.16 / 34), area(1, 1 - 5.5 / 105, 9.16 / 34));
  if (0.5 - 9.15 / 105 >= f0 && 0.5 + 9.15 / 105 <= f1) {
    const c = [];
    for (let i = 0; i <= 40; i++) { const t = i / 40 * Math.PI * 2; c.push(P(0.5 + Math.cos(t) * 9.15 / 105, Math.sin(t) * 9.15 / 34)); }
    out.polis.push([c, true]);
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ Visão tática
/** As posições da Visão tática (a MESMA posicaoTatica da IA e da prévia do Editar time, a bola no centro, atacando para cima). */
export function pontosVisao(formacao, tatica, fase, vagas = null) {
  const f = FORMACOES[formacao];
  const lista = vagas ?? f.vagas;
  const bola = { x: 0, z: 0 };
  return lista.map(v => { const p = posicaoTatica(formacao, v, tatica ?? TATICA_PADRAO, bola, fase === 'com' ? 'com' : 'sem', 1, { x: 0, z: 0 }); return { vaga: v.id, x: p.x, z: p.z }; });
}

/**
 * Os discos da Visão tática no campinho (spec §3): a janela no bloco (x mínimo/máximo ± PREPARTIDA.janela m), o diâmetro =
 * min(base, 0,9 · a menor distância entre centros) com o piso; abaixo do piso os dois discos se afastam na linha entre eles
 * (≤ PREPARTIDA.disco.afasta px cada; só desenho). Devolve {janela, d, letra, discos: [{vaga, x, y, x0, y0}], afastamento}.
 */
export function layoutVisao(L, pontos) {
  const D = PREPARTIDA.disco;
  let xmin = Infinity, xmax = -Infinity;
  for (const p of pontos) { xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); }
  const janela = { f0: Math.max(0, (xmin - PREPARTIDA.janela + 52.5) / 105), f1: Math.min(1, (xmax + PREPARTIDA.janela + 52.5) / 105) };
  const base = L.pc ? D.pc : Math.max(D.celMin, Math.min(D.celMax, Math.round(L.hc * 0.5)));
  let discos, d;
  // (2 passadas: o disco da ponta inteiro dentro do campinho — a janela abre até a borda dele caber, com a folga do afastamento)
  for (let passada = 0; passada < 3; passada++) {
    discos = pontos.map(p => { const [x, y] = projetar(L, (p.x + 52.5) / 105, p.z / 34, janela); return { vaga: p.vaga, x, y, x0: x, y0: y }; });
    let dmin = Infinity;
    for (let i = 0; i < discos.length; i++) for (let j = i + 1; j < discos.length; j++) dmin = Math.min(dmin, Math.hypot(discos[i].x - discos[j].x, discos[i].y - discos[j].y));
    d = Math.max(D.piso, Math.min(base, Math.floor(0.9 * dmin)));
    let ymin = Infinity, ymax = -Infinity;
    for (const q of discos) { ymin = Math.min(ymin, q.y); ymax = Math.max(ymax, q.y); }
    const r = d / 2 + D.afasta + 1, C = L.campo;
    const sobraCima = ymin - r - C.top, sobraBaixo = C.top + C.h - (ymax + r);
    if (sobraCima >= 0 && sobraBaixo >= 0) break;
    const faixa = janela.f1 - janela.f0;
    if (sobraCima < 0 && janela.f1 < 1) janela.f1 = Math.min(1, janela.f1 + faixa * (-sobraCima / C.h) * 2);
    if (sobraBaixo < 0 && janela.f0 > 0) janela.f0 = Math.max(0, janela.f0 - faixa * (-sobraBaixo / C.h) * 1.5);
  }
  // o afastamento (só quando dois centros ficam a menos de d + folga)
  const precisa = d + D.folga;
  for (let it = 0; it < 24; it++) {
    let mexeu = false;
    for (let i = 0; i < discos.length; i++) for (let j = i + 1; j < discos.length; j++) {
      const a = discos[i], b = discos[j];
      let dx = b.x - a.x, dy = b.y - a.y, dist = Math.hypot(dx, dy);
      if (dist >= precisa - 1e-6) continue;
      if (dist < 1e-6) { dx = 1; dy = 0; dist = 1e-6; }
      const falta = (precisa - dist) / 2 + 0.01, ux = dx / dist, uy = dy / dist;
      const mover = (q, s) => {
        const nx = q.x + s * ux * falta, ny = q.y + s * uy * falta;
        const ox = nx - q.x0, oy = ny - q.y0, o = Math.hypot(ox, oy);
        if (o <= D.afasta) { q.x = nx; q.y = ny; } else { q.x = q.x0 + ox / o * D.afasta; q.y = q.y0 + oy / o * D.afasta; }
      };
      mover(a, -1); mover(b, 1);
      mexeu = true;
    }
    if (!mexeu) break;
  }
  let afastamento = 0;
  for (const q of discos) afastamento = Math.max(afastamento, Math.hypot(q.x - q.x0, q.y - q.y0));
  return { janela, d, letra: Math.max(10, Math.round(d * 0.55)), discos, afastamento };
}

// ------------------------------------------------------------------------------------------------ linha de informação
export const SEP_INFO = ' | ';
/**
 * A linha (ou as 2 linhas do PC) de informação com o corte por PRIORIDADE (sai inteiro, nunca pela metade): (1) o período, (2)
 * "Árbitro: Nome Sobrenome" vira "Árb. N. Sobrenome", (3) o árbitro, (4) a data, (5) o estádio ganha "…" até 40% da linha. A
 * duração nunca sai. campos = {estadio, data, arbitro, duracao, periodo, dificuldade}; medir(texto) → px; larguraSep = a largura
 * do separador COMO ELE É DESENHADO (a tela: a barra com 0,45 em de margem de cada lado; sem ela, medir(SEP_INFO) — a conta com
 * ' | ' dava 10 px a um separador de 13,9 no DOM e o CSS cortava o fim da linha: revisão A3).
 * Devolve {linhas: [[partes]], cortes: [os passos aplicados], estadioCortado}.
 */
export function linhaInfo(campos, largura, medir, nLinhas = 1, larguraSep = null) {
  const c = { ...campos };
  const cortes = [];
  const arb = c.arbitro ? `Árbitro: ${c.arbitro}` : null;
  let arbTexto = arb;
  const sepW = larguraSep ?? medir(SEP_INFO);
  const montar = () => {
    const l1 = [c.estadio, c.data, arbTexto].filter(Boolean);
    const l2 = [c.duracao, c.dificuldade, c.periodo].filter(Boolean);
    return nLinhas >= 2 ? [l1, l2] : [[...l1, ...l2]];
  };
  const larg = l => l.reduce((s, p) => s + medir(p), 0) + Math.max(0, l.length - 1) * sepW;
  const cabe = () => montar().every(l => larg(l) <= largura + 0.5);
  // (no PC, em 2 linhas, o período mora na 2ª: só sai se ela não couber)
  const segundaCabe = () => nLinhas < 2 || larg(montar()[1]) <= largura + 0.5;
  if (!cabe() && c.periodo && (nLinhas < 2 || !segundaCabe())) { c.periodo = null; cortes.push('periodo'); }
  if (!cabe() && arb) { arbTexto = `Árb. ${abreviar(c.arbitro)}`; cortes.push('arbitroCurto'); }
  if (!cabe() && arbTexto) { arbTexto = null; cortes.push('arbitro'); }
  if (!cabe() && c.data) { c.data = null; cortes.push('data'); }
  let estadioCortado = false;
  if (!cabe() && c.estadio) {
    // o estádio com "…": até 40% da linha (o resto da linha cabe sempre: a duração é curta)
    const linhas = montar();
    const outros = larg(linhas[0].filter(p => p !== c.estadio)) + (linhas[0].length > 1 ? sepW : 0);
    const alvo = Math.max(largura * 0.4, largura - outros);
    let t = c.estadio;
    while (t.length > 1 && medir(t + '…') > alvo) t = t.slice(0, -1).trimEnd();
    c.estadio = t + '…'; estadioCortado = true; cortes.push('estadio');
  }
  return { linhas: montar(), cortes, estadioCortado };
}
/** "Ricardo Salgado" → "R. Salgado" (o 1º nome vira a inicial). */
function abreviar(nome) {
  const p = String(nome).trim().split(/\s+/);
  return p.length > 1 ? `${p[0][0]}. ${p.slice(1).join(' ')}` : nome;
}

// ------------------------------------------------------------------------------------------------ selo e árbitro
export const SELOS = Object.freeze({
  pressaoAlta: 'Pressão alta', retranca: 'Retranca', contra: 'Contra-ataque', pontas: 'Jogo pelas pontas',
  ofensiva: 'Ofensiva', dentro: 'Jogo por dentro', equilibrada: 'Equilibrada',
});
/** O selo da tática (as Tactical Visions do FC 24 trazidas ao que o jogo tem): a 1ª regra que casa. */
export function seloTatica(t) {
  t = t ?? TATICA_PADRAO;
  let id = 'equilibrada';
  if (t.pressao === 2) id = 'pressaoAlta';
  else if (t.mentalidade <= -1 && t.linha === 0) id = 'retranca';
  else if (t.mentalidade <= -1) id = 'contra';
  else if (t.largura === 2) id = 'pontas';
  else if (t.mentalidade >= 1) id = 'ofensiva';
  else if (t.largura === 0) id = 'dentro';
  return { id, nome: SELOS[id] };
}

// 32 árbitros FICTÍCIOS (nada licenciado; conferidos contra o quadro FIFA 2026 da CBF: tools/dados/arbitros-reais.txt)
export const ARBITROS = Object.freeze([
  'Ricardo Salgado', 'Fernando Areias', 'Marcelo Quaresma', 'Tiago Bonfim', 'Leonardo Valverde', 'Rafael Junqueira',
  'Paulo Viegas', 'Henrique Saldanha', 'Gustavo Penteado', 'Alexandre Mourão', 'Eduardo Aranha', 'Sérgio Lemos',
  'Vítor Cavalcante', 'Daniel Prates', 'Fábio Antunes Leal', 'Juliano Taveira', 'Renato Esteves', 'César Barcelos',
  'Rodrigo Fontoura', 'Márcio Galvão', 'Camila Barreira', 'Patrícia Vasconcelos', 'Juliana Teles', 'Mariana Coimbra',
  'Otávio Bragança', 'Wellington Faria', 'Jorge Amarante', 'Sílvio Mattos', 'Igor Bastião', 'André Lustosa',
  'Hugo Carneiro', 'Mauro Pacheco',
]);
function hashTexto(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; }
/** O árbitro da partida (fictício): o mesmo para a mesma semente e os mesmos elencos (fora do m.rng: nunca muda o jogo). */
export function arbitroDe(semente, elencos = []) {
  let h = (semente >>> 0) || 1;
  for (const e of elencos) h = h32(h, hashTexto(String(e)));
  return ARBITROS[h32(h, 0x5a17) % ARBITROS.length];
}

// ------------------------------------------------------------------------------------------------ dados
/** A raridade pela nota exibida (os cortes do ultimate.js rarOf): bronze, prata, ouro e o verde do TM. */
export function raridade(nota) { return nota >= 85 ? 'l' : nota >= 75 ? 'g' : nota >= 65 ? 's' : 'b'; }

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const MESES_C = ['jan.', 'fev.', 'mar.', 'abr.', 'maio', 'jun.', 'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.'];
/** A data ({curta: "4 nov. 2026", longa: "4 de novembro de 2026"}) de um Date ou de "AAAA-MM-DD"; null sem data. */
export function textoData(d) {
  if (!d) return null;
  let a, m, dia;
  if (typeof d === 'string') {
    const r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(d);
    if (!r) return null;
    a = +r[1]; m = +r[2] - 1; dia = +r[3];
  } else if (d instanceof Date && !Number.isNaN(d.getTime())) { a = d.getFullYear(); m = d.getMonth(); dia = d.getDate(); } else return null;
  if (m < 0 || m > 11 || dia < 1 || dia > 31) return null;
  return { curta: `${dia} ${MESES_C[m]} ${a}`, longa: `${dia} de ${MESES[m]} de ${a}` };
}
const num = v => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : String(Math.round(v * 10) / 10).replace('.', ','));
const NOMES_TATICA = {
  mentalidade: { '-2': 'Ultradefensiva', '-1': 'Defensiva', 0: 'Equilibrada', 1: 'Ofensiva', 2: 'Ultraofensiva' },
  pressao: ['Pressão Baixa', 'Pressão Média', 'Pressão Alta'],
  largura: ['Largura Estreita', 'Largura Normal', 'Largura Aberta'],
  linha: ['Linha Baixa', 'Linha Média', 'Linha Alta'],
};
/** As 4 escolhas da tática com os nomes do Editar time (a info da Visão tática). */
export function textoTatica(t) {
  t = t ?? TATICA_PADRAO;
  return [NOMES_TATICA.mentalidade[t.mentalidade] ?? 'Equilibrada', NOMES_TATICA.pressao[t.pressao] ?? '', NOMES_TATICA.largura[t.largura] ?? '', NOMES_TATICA.linha[t.linha] ?? ''];
}

/**
 * Os dados da tela (puros: só LEEM o mundo; nada do m.rng). ctx (o que é da página: textos, cores, escudos) = {humano, humanos,
 * modo ('partida' | 'tm' | 'rae' | 'livre' | 'penaltis' | 'online'), competicao, classico, hora ('dia' | 'noite'), estadio, data
 * (Date | 'AAAA-MM-DD' | null), trava (o id do travado do Rumo ao Estrelato), times: [{escudo, camisa, camisaGol, cor, pessoa}]}.
 */
export function dadosDaPartida(m, ctx = {}) {
  const humanos = ctx.humanos ?? [ctx.humano ?? 0];
  const disputa = m.disputa ?? null;
  const livre = m.livre ?? null;
  const fora = livre ? new Set(Object.keys(livre.fora ?? {}).map(Number)) : null;
  const elencosIds = [m.times?.[0]?.elenco, m.times?.[1]?.elenco];
  const times = [0, 1].map(t => {
    const tm = m.times?.[t];
    const el = tm ? ELENCOS[tm.elenco] : null;
    const extra = ctx.times?.[t] ?? {};
    const formacao = tm?.formacao ?? '4-3-3';
    const forma = FORMACOES[formacao];
    const fichas = [];
    if (tm && forma) {
      for (const v of forma.vagas) {
        const id = tm.vagas[v.id];
        if (id == null || (fora && fora.has(id))) continue;
        const f = fichaDe(id);
        if (!f) continue;
        const nota = notaExibida(f, v.pos);
        fichas.push({ vaga: v.id, fila: v.fila, col: v.col, pos: v.pos, id, num: f.num ?? '', nome: f.camisa ?? f.nome ?? '', nota, raridade: raridade(nota), gol: v.pos === 'GOL', voce: ctx.trava != null && id === ctx.trava });
      }
    }
    const nt = tm && forma ? notaTime(tm.vagas, forma) : { geral: 0 };
    return {
      t, nome: el?.nome ?? extra.nome ?? '', sigla: el?.sigla ?? extra.sigla ?? '', elenco: tm?.elenco ?? null,
      escudo: extra.escudo ?? null, camisa: extra.camisa ?? null, camisaGol: extra.camisaGol ?? null, cor: extra.cor ?? null,
      humano: humanos.includes(t), pessoa: extra.pessoa ?? null,
      formacao, tatica: { ...(tm?.tatica ?? TATICA_PADRAO) }, selo: seloTatica(tm?.tatica), geral: nt.geral, estrelas: estrelas(nt.geral || 0),
      fichas, texto: null,
    };
  });
  if (livre) for (const t of [0, 1]) times[t].texto = `${times[t].fichas.length} contra ${times[1 - t].fichas.length}`;
  let fila = null;
  if (disputa) {
    // a fila da disputa: o goleiro + os 5 primeiros cobradores (a ordem do m.disputa: ler não gasta o m.rng)
    fila = {};
    for (const t of [0, 1]) {
      const tm = m.times[t];
      const gk = tm?.vagas?.GOL ?? null;
      const ordem = (disputa.ordem?.[t] ?? []).filter(id => id !== gk).slice(0, 5);
      fila[t] = { goleiro: gk, cobradores: ordem };
    }
  }
  const min = m.partida?.ticksPorTempo ? m.partida.ticksPorTempo * PASSO / 60 : 4;
  let duracao;
  if (disputa) {
    const sig = times[disputa.primeiro ?? 0]?.sigla ?? '';
    duracao = { curta: `5 cobranças · Começa: ${sig}`, longa: `5 cobranças alternadas · Começa: ${sig}` };
  } else if (livre) duracao = { curta: 'Sem relógio', longa: 'Sem relógio · sem impedimento nem faltas' };
  else duracao = { curta: `2 × ${num(min)} min`, longa: `2 tempos de ${num(min)} min` };
  return {
    modo: ctx.modo ?? (disputa ? 'penaltis' : livre ? 'livre' : 'partida'),
    competicao: ctx.competicao ?? 'Amistoso', classico: ctx.classico ?? null,
    hora: ctx.hora === 'dia' ? '16:00' : '21:30', periodo: ctx.hora === 'dia' ? 'Dia' : 'Noite',
    estadio: ctx.estadio ?? 'Estádio Golaço',
    data: textoData(ctx.data ?? null),
    arbitro: livre ? null : arbitroDe(m.semente ?? 1, elencosIds),
    duracao, dificuldade: ctx.dificuldade ?? null,
    times, disputa: disputa ? { comeca: disputa.primeiro ?? 0, fila } : null,
    trava: ctx.trava ?? null,
  };
}

/** A edição do Editar time (escalacao.js edicaoDe) vira a ESCALAÇÃO do time antes do jogo (criarPartida {times}). */
export function edicaoParaTimes(ed) {
  if (!ed) return null;
  return { formacao: ed.formacao, vagas: { ...ed.vagas }, tatica: { ...ed.tatica } };
}
