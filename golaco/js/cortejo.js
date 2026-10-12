// Cortejo do pré-jogo (pedido do dono de 11/10: "jogadores entrando em campo, fazendo a fila, a câmera passando"):
// os 22 titulares e os 3 árbitros saem do TÚNEL do lado de cá (config.js ESTADIO.tunel) e fazem a fila no meio-campo,
// de frente para a tribuna (z +), andando SÓ pela locomoção pura do jogo (jogador.js passoCorpo, passoPassada e
// passoPeDesenhado; anim.js alturaQuadril e pose) num MUNDO À PARTE — nada do mundo da partida é lido depois de
// criado nem escrito, nada de rng (o hash da partida não muda: tools/teste-cortejo.mjs confere).
//
// Desenho (PESQUISA-PREJOGO.md §2): os árbitros na frente, no meio do túnel (0 e ±0,85 m); as duas colunas lado a
// lado (mandante, o time 0, à esquerda da TV: x −; visitante à direita: x +), o capitão na frente e o goleiro em 2º.
// Parados no túnel um atrás do outro a 0,9 m; a fila "estica" ao andar (cada um sai um pouco depois do da frente,
// até 1,55 m de um para o outro) e, no meio-campo, cada coluna vira para o seu lado e vai até a sua vaga: o 1º
// da coluna vai mais longe e cada um para 1,05 m antes do da frente (ninguém passa por cima de quem já parou). Na
// vaga o corpo vira de frente para a tribuna (rumo π/2) e os pés ficam plantados.
//
// Mini-mundo: só o que a pose e a passada leem ({tick, posse, naMao, parada, bola: {p}}): o goleiro anda com
// posicao 'MEI' (com 'GOL' a pose põe as mãos "prontas" à frente da cintura); o uniforme dele vem só da lista do
// desenho (goleiro: true).
//
// Contrato: criarCortejo(times) → c; passoCortejo(c) (1/60 s); tempoCortejo(c); fotoCortejo(c) / restaurarCortejo(c, f)
// (os planos de câmera cortam e pulam no tempo do cortejo); filaFinal(c) monta a fila já parada sem simular;
// vagaFinal(c, i); chegaram(c). Sem three.js nem DOM.
import { criarJogador, passoCorpo, passoPassada, passoPeDesenhado } from './jogador.js';
import { alturaQuadril } from './anim.js';
import { PASSO, ESTADIO } from './config.js';
import { ELENCOS, fichaDe, atributosDe } from './elenco.js';
import { FORMACOES } from './formacoes.js';

export const CORTEJO = {
  vel: 1.45,              // m/s — o passo da entrada em campo (caminhada de cerimônia)
  correcao: [0.6, 1.2],   // até +0,6 m/s para alcançar o ponto do caminho (ganho 1,2/s pelo atraso)
  gapTunel: 0.9,          // m entre um e outro parados no túnel (cabe a coluna de 11 nos 12 m dele)
  gapColuna: 1.55,        // m andando (cada um sai um pouco depois do da frente)
  gapFila: 1.05,          // m entre um e outro na fila
  zFila: 3.2,             // m do meio, do lado da tribuna
  xColuna: 1.2,           // m do meio: as duas colunas lado a lado
  xPonta: 2.0,            // m: a ponta de dentro da fila (ao lado do assistente)
  curva: 2.2,             // m antes da linha da fila em que a coluna começa a virar
  zCabeca: 46.4,          // z do 1º da coluna dentro do túnel (a boca em z = 44,5)
  zArbitro: 45.3,
  xArbitros: [0, -0.85, 0.85],
  atrasoTimes: 1.6,       // s — os times saem depois dos árbitros
  chegada: 1.6,           // ganho (1/s) da freada na vaga
  paraEm: 0.04,           // m da vaga: parado
  viraEm: 0.3,            // m da vaga: o corpo vira para a tribuna
  idArbitro: 200,         // 200 árbitro, 201 e 202 assistentes
  rumoFila: Math.PI / 2,  // de frente para a tribuna (z +)
};

// ---------------------------------------------------------------- caminhos (polilinhas, com o comprimento de cada trecho)
function poli(pts) {
  const seg = [];
  let L = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
    const l = Math.hypot(bx - ax, bz - az);
    seg.push({ ax, az, ux: (bx - ax) / l, uz: (bz - az) / l, l, s0: L });
    L += l;
  }
  return { pts, seg, L };
}
/** Ponto do caminho no comprimento s (antes do começo: o 1º trecho para trás — a coluna parada no túnel). */
export function pontoCaminho(p, s, out = {}) {
  let g = p.seg[0];
  if (s > 0) for (const q of p.seg) { g = q; if (s <= q.s0 + q.l) break; }
  const d = Math.min(s - g.s0, g.l);
  out.x = g.ax + g.ux * d; out.z = g.az + g.uz * d; out.rumo = Math.atan2(g.uz, g.ux);
  return out;
}

/** Caminho da coluna do time t (0 mandante: x −; 1 visitante: x +). */
function caminhoTime(t) {
  const C = CORTEJO, lado = t === 0 ? -1 : 1;
  const xFim = C.xPonta + 10 * C.gapFila;
  return poli([[lado * C.xColuna, C.zCabeca], [lado * C.xColuna, C.zFila + C.curva], [lado * C.xPonta, C.zFila], [lado * xFim, C.zFila]]);
}
function caminhoArbitro(dx) { return poli([[dx, CORTEJO.zArbitro], [dx, CORTEJO.zFila]]); }

/**
 * Ordem da coluna de um time: o capitão (o de linha de maior nível; empate: o de menor número) na frente, o goleiro
 * em 2º e o resto na ordem das vagas da formação (da defesa para o ataque). times[t] = {elenco, formacao, vagas}.
 */
export function ordemDaColuna(tm) {
  const ids = FORMACOES[tm.formacao].vagas.map(v => tm.vagas[v.id]).filter(id => id != null);
  const ficha = id => fichaDe(id) ?? { pos: 'MEI', nivel: 0, num: 99 };
  const gol = ids.find(id => ficha(id).pos === 'GOL');
  let cap = null;
  for (const id of ids) {
    if (id === gol) continue;
    const f = ficha(id), c = cap == null ? null : ficha(cap);
    if (!c || f.nivel > c.nivel || (f.nivel === c.nivel && f.num < c.num)) cap = id;
  }
  const resto = ids.filter(id => id !== gol && id !== cap);
  return [cap, gol, ...resto].filter(id => id != null);
}

/**
 * Monta o cortejo. times = m.times da partida (só leitura, na criação). Devolve
 * {tick, mini, andantes: [{j, id, time, arb, goleiro, kit, k, caminho, s0, sFim, atraso, chegou}]}.
 */
export function criarCortejo(times) {
  const C = CORTEJO;
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 } }, jogadores: [] };
  const andantes = [];
  const q = {};
  for (const t of [0, 1]) {
    const tm = times[t];
    const el = ELENCOS[tm.elenco];
    const cam = caminhoTime(t);
    ordemDaColuna(tm).forEach((id, k) => {
      const ficha = fichaDe(id);
      const s0 = -k * C.gapTunel;
      pontoCaminho(cam, s0, q);
      const j = criarJogador(id, q.x, q.z, q.rumo, atributosDe(ficha), t);
      // anda como jogador de linha (a pose do goleiro com 'GOL' põe as mãos prontas); o uniforme vem da lista
      j.posicao = 'MEI';
      const goleiro = ficha.pos === 'GOL';
      mini.jogadores.push(j);
      andantes.push({
        j, id, time: t, arb: false, goleiro, kit: el ? (goleiro ? el.uniforme.goleiro : el.uniforme.linha) : null,
        k, caminho: cam, s0, sFim: cam.L - k * C.gapFila, atraso: C.atrasoTimes + k * (C.gapColuna - C.gapTunel) / C.vel, chegou: null,
      });
    });
  }
  C.xArbitros.forEach((dx, i) => {
    const cam = caminhoArbitro(dx);
    const id = C.idArbitro + i;
    const j = criarJogador(id, dx, C.zArbitro, -Math.PI / 2, {}, 2);
    j.posicao = 'ARB';
    mini.jogadores.push(j);
    andantes.push({ j, id, time: 2, arb: true, goleiro: false, kit: 'arbitro', k: i, caminho: cam, s0: 0, sFim: cam.L, atraso: 0, chegou: null });
  });
  for (const a of andantes) a.j.quadril = alturaQuadril(a.j, mini);
  return { tick: 0, mini, andantes };
}

export const tempoCortejo = c => c.tick * PASSO;

// ---------------------------------------------------------------- condução de cada um (pura): segue o ponto do caminho
const _q = {}, _cmd = { ux: 0, uz: 0, vel: 0, rumo: 0, fim: false };
function comando(a, t) {
  const C = CORTEJO;
  const tt = Math.max(0, t - a.atraso);
  // quem já chegou fica na vaga (a fila montada por filaFinal também)
  const sAlvo = a.chegou != null ? a.sFim : Math.min(a.s0 + C.vel * tt, a.sFim);
  pontoCaminho(a.caminho, sAlvo, _q);
  const j = a.j;
  const dx = _q.x - j.x, dz = _q.z - j.z, d = Math.hypot(dx, dz);
  const fim = sAlvo >= a.sFim - 1e-6;
  // a velocidade do cortejo + a correção do atraso; chegando na vaga, freia pela distância
  let vel = fim ? Math.min(C.vel, d * C.chegada) : Math.max(0, Math.min(C.vel + C.correcao[0], C.vel + (d - 0.25) * C.correcao[1]));
  if (d < C.paraEm) vel = 0;
  _cmd.ux = d > 1e-6 ? dx / d : Math.cos(j.rumo);
  _cmd.uz = d > 1e-6 ? dz / d : Math.sin(j.rumo);
  _cmd.vel = vel;
  // rumo: o do caminho; perto da vaga, de frente para a tribuna (antes de começar a andar: o do caminho, já)
  _cmd.rumo = fim && d < C.viraEm ? C.rumoFila : _q.rumo;
  _cmd.fim = fim && d < C.paraEm;
  return _cmd;
}

/** Um passo (1/60 s) de todos, na mesma ordem do passo da simulação (sim.js): corpo, passada, pé desenhado, quadril. */
export function passoCortejo(c) {
  const t = c.tick * PASSO;
  const As = c.andantes;
  for (let i = 0; i < As.length; i++) {
    const a = As[i];
    const cm = comando(a, t);
    passoCorpo(a.j, cm.ux, cm.uz, cm.vel, cm.rumo, a.j.par, PASSO, false);
    if (cm.fim && a.chegou == null) a.chegou = t;
  }
  for (let i = 0; i < As.length; i++) passoPassada(As[i].j, false, PASSO, null, null);
  for (let i = 0; i < As.length; i++) passoPeDesenhado(As[i].j, c.mini, PASSO);
  c.tick++;
  c.mini.tick = c.tick;
  for (let i = 0; i < As.length; i++) As[i].j.quadril = alturaQuadril(As[i].j, c.mini);
}

/** Todos parados na vaga? */
export function chegaram(c) { return c.andantes.every(a => a.chegou != null); }

/** Vaga final (x, z) do andante i. */
export function vagaFinal(c, i, out = {}) { const a = c.andantes[i]; return pontoCaminho(a.caminho, a.sFim, out); }

/** Foto do estado (os planos de câmera cortam e voltam a um instante do cortejo). */
export function fotoCortejo(c) {
  return structuredClone({ tick: c.tick, js: c.andantes.map(a => a.j), chegou: c.andantes.map(a => a.chegou) });
}
export function restaurarCortejo(c, f) {
  const g = structuredClone(f);
  c.tick = g.tick; c.mini.tick = g.tick;
  c.andantes.forEach((a, i) => { a.j = g.js[i]; a.chegou = g.chegou[i]; c.mini.jogadores[i] = a.j; });
}

/**
 * A fila já montada (sem simular): cada um parado na vaga, de frente para a tribuna, com os pés plantados lado a
 * lado (a postura de criarJogador). O tick fica (a pose não depende dele parado).
 */
export function filaFinal(c) {
  const q = {};
  c.andantes.forEach((a, i) => {
    pontoCaminho(a.caminho, a.sFim, q);
    const v = a.j;
    const j = criarJogador(a.id, q.x, q.z, CORTEJO.rumoFila, a.arb ? {} : atributosDe(fichaDe(a.id)), v.time);
    j.posicao = v.posicao;
    a.j = j; c.mini.jogadores[i] = j;
    a.chegou = a.chegou ?? c.tick * PASSO;
  });
  for (const a of c.andantes) a.j.quadril = alturaQuadril(a.j, c.mini);
}

/** O túnel do cortejo cabe na boca e no corredor (o 1º e o último de cada coluna dentro). Para o teste. */
export function cabeNoTunel() {
  const T = ESTADIO.tunel, C = CORTEJO;
  const fundo = T.z + T.profundidade;
  const ultimo = C.zCabeca + 10 * C.gapTunel;
  return { ultimo, fundo, folga: fundo - ultimo, largura: T.largura / 2 - C.xColuna };
}
