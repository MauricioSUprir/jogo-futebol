// Atores das CENAS de cartão e de fim de tempo (pedido do dono de 12/10: "temos que ter cenas de final de primeiro tempo,
// final de segundo tempo, cartão amarelo (3 cenas diferentes) e cartão vermelho (outras 3 cenas diferentes)"). PURO: sem
// three.js nem DOM, sem m.rng e sem Math.random — testado em Node (tools/teste-cenas.mjs). A receita é a da comemoração
// (js/comemoracao.js): no tick do evento os jogadores são COPIADOS (copiaJogador + criarAtor) para um mundo de cena à
// parte (o mundo falso mF, só o que a pose e a passada leem), que anda com a MESMA locomoção do jogo e na mesma ordem do
// passoCena (passoCorpo → separação → passoPassada → passoPeDesenhado → quadril → pose): pé plantado não patina, pé no
// ar anda na velocidade de um pé humano. Por cima da pose da locomoção, os GESTOS por IK do braço (anim.js ikBraco, pela
// maoEm da comemoração) e as POSTURAS (cabisbaixo, agachado, mãos nos joelhos).
//
// Aqui fica o que as duas cenas usam: o árbitro e os assistentes (criarJogador 200–202, posição 'ARB', uniforme
// 'arbitro', como o cortejo do pré-jogo), os gestos e posturas novos (tabela em CONTRATOS.md), a escolha da variação sem
// repetir a anterior (escolherVariante, a forma de escolherFinal), a ELIPSE (recriarAtor: depois de um corte de câmera o
// ator reaparece noutro lugar, com a passada e os pés zerados — nunca um teleporte com a passada viva), o passo de todos
// (passoAtores), "quem não é do lance freia e fica parado respirando" (parado e plantado por CENAS.parado ticks: fica
// fixo, sem locomoção, e o peito sobe e desce) e as contas de câmera (posição válida, lente livre, enquadramento).
// Nada é alocado por tick (vetores e objetos reaproveitados).
import { PASSO, CAMPO, CENAS, JOGADOR, COMEMORACAO } from './config.js';
import { criarJogador, passoCorpo, passoPassada, passoPeDesenhado } from './jogador.js';
import { pose, alturaQuadril, J, NJ, ikBraco, RAIO_CABECA, BRACO, ANTEBRACO } from './anim.js';
import {
  criarAtor, maoEm, gesto, hashGol, limitarCamera, ajustarCelular, inclinarTronco, cabeca, poseAgachado, flexionar,
  moverJuntas, G_CEU, G_SOCO, G_CABECA,
} from './comemoracao.js';

/** Sobe a pose inteira dy m (o pulo: os pés saem do chão; quem chama marca a.noAr). */
export function moverTudo(o, dy) { for (let i = 1; i < o.length; i += 3) o[i] += dy; }
import { mergulhoAtivo, passoMergulho, fixarMergulho, pesMergulho } from './goleiro.js';
import { solidoEm } from './estadio-forma.js';

const MX = CAMPO.meioX, MZ = CAMPO.meioZ;
const BRACO_TOTAL = (BRACO + ANTEBRACO) * 0.998;
export const TOPO_CABECA = RAIO_CABECA * 1.1;   // a cabeça desenhada (jogador3d.js: esfera com 1,1·R na vertical)
const s60 = s => Math.round(s / PASSO);
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
export function lerp(a, b, t) { return a + (b - a) * t; }
/** Peso que entra em `e` s a partir de t0 e sai em `s` s a partir de t1 (0 fora, 1 no meio). */
export function janela(t, t0, t1, e = 0.25, s = 0.25) { return Math.min(suave((t - t0) / e), 1 - suave((t - t1) / s)); }
export { hashGol, limitarCamera, ajustarCelular, s60 };

// ------------------------------------------------------------------------------------------------ variação
/**
 * Variação pelo hash do (tick, id) entre as disponíveis menos a `ultima` (a forma de escolherFinal da comemoração).
 * Com a `penultima` também (opcional), a que não saiu nas duas últimas pesa 3/4 do sorteio: a sequência gira pelas três
 * (A → B → C) quase sempre, e em 100 cartões seguidos cada variação fica perto de 1/3 (sorteio puro: de 24% a 43%; assim:
 * 28–39%). Sem nenhuma disponível além da última, a primeira disponível (não há o que variar).
 */
export function escolherVariante(tick, id, ultima, disponiveis, penultima = null) {
  let n = 0;
  for (const v of disponiveis) if (v !== ultima) n++;
  if (!n) return disponiveis[0] ?? null;
  const h = hashGol(tick, id);
  if (n === 2 && penultima != null && penultima !== ultima && disponiveis.includes(penultima)) {
    // a terceira (a que não saiu nas duas últimas) com 3/4
    let outra = null;
    for (const v of disponiveis) if (v !== ultima && v !== penultima) outra = v;
    if (outra != null) return (h & 1023) < 768 ? outra : penultima;
  }
  let k = h % n;
  for (const v of disponiveis) { if (v === ultima) continue; if (k-- === 0) return v; }
  return disponiveis[0];
}

// ------------------------------------------------------------------------------------------------ cena e atores
/** Mundo falso da cena (o que a pose e a passada leem) a partir da bola do mundo. */
export function mundoFalso(m) {
  const b = m.bola.p;
  return {
    tick: m.tick, posse: null, naMao: null, parada: null, voo: null,
    bola: { p: { x: b.x, y: b.y, z: b.z }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } },
    jogadores: [], ataca: m.ataca,
  };
}

/** Estado comum de uma cena (cena-cartao.js, cena-fim.js completam). */
export function criarBase(m) {
  return {
    mF: mundoFalso(m), atores: [], porId: new Map(), k: 0, acum: 0, alfa: 0, acabou: false, kFim: 0, ticksUltimo: 0,
    eventos: [], ip: -1, cortes: 0, cams: [], recriados: [],
    _d: { dx: 1, dz: 0, vel: 0, rumo: 0 },
  };
}

function prepararAtor(a, tipo) {
  a.tipo = tipo; a.cede = 1; a.ativo = true; a.fixo = false; a.parado = 0; a.podeFixar = true; a.kit = null;
  a.base = null; a.recriado = -1; a.respira = (a.id * 0.618) % 1;
  a.mergulha = false; a.gestoT = 0; a.olho = 0; a.cabecaW = 0; a.alvoX = a.j.x; a.alvoZ = a.j.z;
  return a;
}

/** Ator copiado de um jogador do mundo (o goleiro sem defesa em andamento anda como jogador de linha: as mãos livres). */
export function adicionarJogador(c, j, tipo = 'resto') {
  const a = prepararAtor(criarAtor(j, c.atores.length), tipo);
  if (a.goleiro && !(a.j.mergulho && mergulhoAtivo(a.j, c.mF.tick))) { a.j.posicao = 'MEI'; a.j.mergulho = null; }
  c.atores.push(a); c.mF.jogadores.push(a.j); c.porId.set(a.id, a);
  return a;
}

/** Árbitro ou assistente (criarJogador, posição 'ARB', uniforme 'arbitro'). */
export function adicionarArbitro(c, id, x, z, rumo, tipo = 'arbitro') {
  const j = criarJogador(id, x, z, rumo, {}, 2);
  j.posicao = 'ARB';
  const a = prepararAtor(criarAtor(j, c.atores.length), tipo);
  a.kit = 'arbitro'; a.time = 2; a.goleiro = false;
  c.atores.push(a); c.mF.jogadores.push(a.j); c.porId.set(a.id, a);
  return a;
}

/** Ator novo para quem não está no mundo (o treinador do gancho): {id, time, x, z, rumo, kit}. */
export function adicionarNovo(c, o, tipo, posicao = 'TEC') {
  const j = criarJogador(o.id, o.x, o.z, o.rumo ?? 0, {}, o.time ?? 0);
  j.posicao = posicao;
  const a = prepararAtor(criarAtor(j, c.atores.length), tipo);
  a.kit = o.kit ?? null; a.time = o.time ?? 0; a.goleiro = false;
  c.atores.push(a); c.mF.jogadores.push(a.j); c.porId.set(a.id, a);
  return a;
}

/** Desloca o jogador (corpo e pés: o desenho e os alvos) em (dx, dz). */
export function levar(j, dx, dz) {
  j.x += dx; j.z += dz;
  for (const p of j.pes) { p.x += dx; p.z += dz; p.lx += dx; p.lz += dz; p.gx += dx; p.gz += dz; p.tx += dx; p.tz += dz; p.bx += dx; p.bz += dz; }
}

/** Um passo da locomoção de um jogador sozinho (pré-rolagem): corpo, passada, pé desenhado e quadril. */
export function passoSozinho(j, mF, dx, dz, vel, rumo) {
  passoCorpo(j, dx, dz, vel, rumo, j.par, PASSO, false);
  passoPassada(j, false, PASSO, null, null);
  passoPeDesenhado(j, mF, PASSO);
  j.quadril = alturaQuadril(j, mF);
}

/** Pose inicial do ator (ant = atu, sem interpolar). */
export function poseInicial(c, a) {
  a.j.quadril = a.j.quadril ?? alturaQuadril(a.j, c.mF);
  pose(a.j, c.mF, a.atu);
  a.ant.set(a.atu);
  a.x0 = a.x1 = a.j.x; a.z0 = a.z1 = a.j.z; a.r0 = a.r1 = a.j.rumo;
}

/**
 * ELIPSE: o ator reaparece em (x, z) com rumo, a passada e os pés zerados (criarJogador; os parâmetros do corpo e o
 * uniforme ficam). Só no tick de um CORTE de câmera (quem chama garante; o teste confere). Com `anda` = {dx, dz, vel,
 * ticks}, ele já entra no plano andando: anda sozinho (pré-rolagem invisível) `ticks` passos e é levado de volta para
 * (x, z) — a passada fica viva e o 1º quadro do plano já é de quem está andando.
 */
export function recriarAtor(c, a, x, z, rumo, anda = null) {
  const v = a.j;
  const j = criarJogador(a.id, x, z, rumo, {}, v.time);
  j.par = v.par; j.posicao = v.posicao === 'GOL' ? 'MEI' : v.posicao;
  if (anda) {
    for (let t = 0; t < anda.ticks; t++) passoSozinho(j, c.mF, anda.dx, anda.dz, anda.vel, rumo);
    levar(j, x - j.x, z - j.z);
  }
  a.j = j;
  const i = c.mF.jogadores.indexOf(v);
  if (i >= 0) c.mF.jogadores[i] = j;
  a.fixo = false; a.parado = 0; a.base = null; a.mergulha = false;
  a.recriado = c.k;
  c.recriados.push({ id: a.id, k: c.k });
  j.quadril = alturaQuadril(j, c.mF);
  pose(j, c.mF, a.atu);
  a.ant.set(a.atu);
  a.x0 = a.x1 = j.x; a.z0 = a.z1 = j.z; a.r0 = a.r1 = j.rumo;
  return a;
}

/** O ator volta a se mexer (deixa de ser fixo). */
export function soltar(a) { if (a.fixo) { a.fixo = false; a.parado = 0; a.base = null; } }

// ------------------------------------------------------------------------------------------------ desejos
export function para(c, vel, rumo) {
  const d = c._d;
  d.dx = Math.cos(rumo); d.dz = Math.sin(rumo); d.vel = vel; d.rumo = rumo;
  return d;
}
/** Vai até (x, z) a `vel` (freando para chegar: √(2·freio·d)); perto (< tol), para com o `rumoFim`. */
export function irPara(c, a, x, z, vel, rumoFim = null, tol = 0.12, freio = 2.2) {
  const j = a.j, ex = x - j.x, ez = z - j.z, d = Math.hypot(ex, ez);
  const r = rumoFim ?? j.rumo;
  if (d < tol) return para(c, 0, r);
  const dd = c._d;
  dd.dx = ex / d; dd.dz = ez / d; dd.vel = Math.min(vel, Math.sqrt(2 * freio * Math.max(0, d - tol * 0.5)));
  dd.rumo = d < 1 && rumoFim != null ? rumoFim : Math.atan2(ez, ex);
  return dd;
}
/** Freia até parar, olhando para (x, z) (ou no rumo de agora). */
export function parar(c, a, ox = null, oz = null) {
  const j = a.j;
  return para(c, 0, ox == null ? j.rumo : Math.atan2(oz - j.z, ox - j.x));
}

/**
 * Desvio de quem anda (Reynolds, "Steering Behaviors", GDC 1999 — o mesmo da cena de substituição): alguém à frente (até
 * 1,8 m) e perto da reta (< 0,8 m de lado) empurra o rumo pedido para o lado contrário. Escreve em d.
 */
export function desviar(c, a, d) {
  if (d.vel < 0.3) return d;
  const j = a.j;
  let lat = 0;
  for (const b of c.atores) {
    if (b === a || !b.ativo) continue;
    const ex = b.j.x - j.x, ez = b.j.z - j.z;
    const u = ex * d.dx + ez * d.dz;
    if (u <= 0 || u > 1.8) continue;
    const w = -ex * d.dz + ez * d.dx;
    if (Math.abs(w) >= 0.8) continue;
    lat += (w >= 0 ? -1 : 1) * ((0.8 - Math.abs(w)) / 0.8) * (1 - u / 1.8);
  }
  if (lat === 0) return d;
  lat = clamp(lat, -1, 1) * 0.9;
  const nx = d.dx - d.dz * lat, nz = d.dz + d.dx * lat, l = Math.hypot(nx, nz) || 1;
  d.dx = nx / l; d.dz = nz / l;
  return d;
}

/**
 * Ninguém dentro de ninguém (antes da passada, como o colisaoCorpos do jogo): centros a ≥ min m. Cada ator cede `a.cede`
 * (0 = não sai do lugar: quem está num gesto com alguém, o fixo); a velocidade de aproximação sai.
 */
export function separarCena(c, min = CENAS.separacao) {
  const at = c.atores, n = at.length, min2 = min * min;
  for (let it = 0; it < 2; it++) {
    for (let p = 0; p < n; p++) {
      const A = at[p];
      if (!A.ativo) continue;
      const ja = A.j, fa = A.fixo || A.mergulha ? 0 : A.cede;
      for (let q = p + 1; q < n; q++) {
        const B = at[q];
        if (!B.ativo) continue;
        const jb = B.j;
        const dx = jb.x - ja.x, dz = jb.z - ja.z, d2 = dx * dx + dz * dz;
        if (d2 >= min2) continue;
        const fb = B.fixo || B.mergulha ? 0 : B.cede, tot = fa + fb;
        if (!tot) continue;
        const d = Math.sqrt(d2);
        let nx = 1, nz = 0;
        if (d > 1e-6) { nx = dx / d; nz = dz / d; }
        const pen = min - d, ka = pen * fa / tot, kb = pen * fb / tot;
        ja.x -= nx * ka; ja.z -= nz * ka; jb.x += nx * kb; jb.z += nz * kb;
        const rv = (jb.vx - ja.vx) * nx + (jb.vz - ja.vz) * nz;
        if (rv < 0) {
          ja.vx += nx * rv * fa / tot; ja.vz += nz * rv * fa / tot;
          jb.vx -= nx * rv * fb / tot; jb.vz -= nz * rv * fb / tot;
        }
      }
    }
  }
}

// ------------------------------------------------------------------------------------------------ passo
/**
 * Um tick de todos os atores, na ordem do passoCena da comemoração: desejo → passoCorpo (o goleiro na defesa desenhada
 * termina a defesa), separação, passoPassada, passoPeDesenhado, tick, quadril e a pose (a da locomoção + o gesto do
 * papel: gestos(c, a, t)). Quem pode (a.podeFixar) e ficou parado e plantado por CENAS.parado ticks fica FIXO: sem
 * locomoção, a pose de base e a respiração por cima. desejo(c, a, t) → {dx, dz, vel, rumo} (c._d).
 */
export function passoAtores(c, desejo, gestos) {
  const t = c.k * PASSO, mF = c.mF, at = c.atores;
  for (let i = 0; i < at.length; i++) {
    const a = at[i];
    a.mergulha = false;
    if (!a.ativo || a.fixo) continue;
    const j = a.j;
    if (a.goleiro && j.mergulho && mergulhoAtivo(j, mF.tick + 1)) { passoMergulho(mF, j); a.mergulha = true; continue; }
    const d = desejo(c, a, t);
    passoCorpo(j, d.dx, d.dz, d.vel, d.rumo, j.par, PASSO, false);
  }
  separarCena(c);
  for (let i = 0; i < at.length; i++) {
    const a = at[i];
    if (!a.ativo || a.fixo) continue;
    if (a.mergulha) { fixarMergulho(mF, a.j); pesMergulho(mF, a.j); continue; }
    passoPassada(a.j, false, PASSO, null, null);
  }
  for (let i = 0; i < at.length; i++) { const a = at[i]; if (a.ativo && !a.fixo && !a.mergulha) passoPeDesenhado(a.j, mF, PASSO); }
  mF.tick++;
  c.k++;
  const tk = c.k * PASSO;
  for (let i = 0; i < at.length; i++) {
    const a = at[i];
    if (!a.ativo) continue;
    const j = a.j;
    if (!a.fixo) j.quadril = alturaQuadril(j, mF);
    // o goleiro que terminou a defesa desenhada passa a andar como jogador de linha (as mãos livres para os gestos)
    if (a.goleiro && j.posicao === 'GOL' && !(j.mergulho && mergulhoAtivo(j, mF.tick))) { j.posicao = 'MEI'; j.mergulho = null; }
    a.ant.set(a.atu);
    a.x0 = a.x1; a.z0 = a.z1; a.r0 = a.r1;
    a.noAr = false;
    if (a.fixo) respirar(a, tk);
    else {
      pose(j, mF, a.atu);
      gestos(c, a, tk);
      // parado e plantado: fica fixo (a pose de agora é a base; a respiração vai por cima)
      if (a.podeFixar && Math.hypot(j.vx, j.vz) < 0.02 && j.pes[0].apoio && j.pes[1].apoio && !j.pes[0].pendente && !j.pes[1].pendente) {
        if (++a.parado >= CENAS.parado) { a.fixo = true; a.base ??= new Float32Array(NJ * 3); a.base.set(a.atu); a.tFixo = tk; }
      } else a.parado = 0;
    }
    a.x1 = j.x; a.z1 = j.z; a.r1 = j.rumo;
  }
}

const RESPIRA = [J.lombar, J.peito, J.pescoco, J.cabeca, J.ombroE, J.ombroD, J.cotoveloE, J.cotoveloD, J.maoE, J.maoD];
/**
 * Parado respirando (só no desenho, sobre a pose de base: os pés plantados e as pernas não mexem): o peito sobe e desce
 * ±1 cm a ~0,25 Hz e o peso passa de um pé para o outro (o tronco ±1,2 cm de lado), cada um no seu ritmo (pelo id). Entra
 * devagar (do 0 no tick em que ficou fixo: sem salto).
 */
function respirar(a, t) {
  const o = a.atu, b = a.base;
  o.set(b);
  const w = suave((t - a.tFixo) / 0.6);
  if (w <= 0) return;
  const f = 0.22 + a.respira * 0.08, fase = a.id * 1.7, dt = t - a.tFixo;
  const sobe = CENAS.respira.sobe * Math.sin(2 * Math.PI * f * dt + fase) * w;
  const lado = CENAS.respira.lado * Math.sin(2 * Math.PI * 0.09 * dt + fase * 0.37) * w;
  const h = a.j.rumo, rx = -Math.sin(h), rz = Math.cos(h);
  for (let k = 0; k < RESPIRA.length; k++) {
    const q = RESPIRA[k], i = q * 3, wl = q === J.lombar ? 0.4 : 1;
    o[i] += rx * lado * wl; o[i + 1] += sobe * (q === J.lombar ? 0.3 : 1); o[i + 2] += rz * lado * wl;
  }
}

/** Avança a cena dt s reais (o relógio do desenho). passo(c) anda um tick. Devolve alfa; os ticks em c.ticksUltimo. */
export function avancarCom(c, dt, passo) {
  c.ticksUltimo = 0;
  if (c.acabou) { c.alfa = 1; return 1; }
  c.acum += Math.max(0, dt);
  while (c.acum >= PASSO - 1e-9 && !c.acabou) { passo(c); c.acum -= PASSO; c.ticksUltimo++; }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou ? 1 : Math.min(1, c.acum / PASSO);
  return c.alfa;
}
/** Tempo (s) da cena no estado desenhado. */
export function tempoDe(c) { return Math.max(0, c.k - 1 + c.alfa) * PASSO; }
/** Índice do plano no tempo t (s); planos.length = fim. */
export function planoNoTempo(c, t) {
  const pl = c.plano.planos;
  if (c.acabou) return pl.length;
  for (let i = pl.length - 1; i >= 0; i--) if (t >= pl[i].t0 - 1e-9) return i;
  return 0;
}

// ------------------------------------------------------------------------------------------------ gestos e posturas
// Referencial do corpo: f = frente (cos h, sin h), r = direita (−sin h, cos h), y = para cima. Cada gesto põe a(s) mão(s)
// num ponto por IK do braço (maoEm da comemoração: os ossos com o comprimento certo), com peso w (0 = a pose da
// locomoção). Os pontos são do esqueleto da pose de agora (ombro, peito, pelve, cabeça): seguem o corpo.
const _p = { x: 0, y: 0, z: 0 };
function junta(o, i, out = _p) { out.x = o[i * 3]; out.y = o[i * 3 + 1]; out.z = o[i * 3 + 2]; return out; }
const POLO_BAIXO = [0, 1, -1, -0.3, 1, -1];        // cotovelo para fora e para baixo
const POLO_TRAS = [0, 0, 0, -0.6, 1, -0.4];         // cotovelo para fora e para trás
const POLO_FORA = [0, 0, 0, -0.2, 1, 0.1];          // cotovelo para fora

/** Mão do lado `lado` no ponto do corpo: junta `ij` + f·df + r·(lado·dr) + y·dy. */
function maoNoCorpo(o, h, lado, ij, df, dr, dy, w, polo) {
  if (w <= 0) return;
  const fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx, i = ij * 3;
  maoEm(o, h, lado, o[i] + fx * df + rx * lado * dr, o[i + 1] + dy, o[i + 2] + fz * df + rz * lado * dr, w, polo);
}

/** G_TIRA_AMARELO: a mão direita no bolso da frente da camisa (peito esquerdo). */
export function gTiraAmarelo(o, h, w) { maoNoCorpo(o, h, 1, J.peito, 0.13, -0.09, -0.02, w, POLO_BAIXO); }
/** G_TIRA_VERMELHO: a mão direita atrás do quadril direito (bolso de trás do calção). */
export function gTiraVermelho(o, h, w) { maoNoCorpo(o, h, 1, J.pelve, -0.15, 0.13, -0.03, w, POLO_TRAS); }

/**
 * G_CARTAO: o braço direito reto acima da cabeça (ombro a 170–180°, cotovelo estendido), a mão ≥ 0,25 m acima do topo da
 * cabeça: com o braço no alto o ombro sobe (a escápula gira e sobe — elevação; CENA_CARTAO.ombroSobe) e a mão fica no
 * alcance todo, inclinada `incl` rad para (dx, dz) (o lado do punido: o cartão de frente para ele). O cotovelo vai um
 * pouco para fora.
 */
export function gCartao(o, h, w, dx, dz, sobe, incl = 0.12) {
  if (w <= 0) return;
  const iO = J.ombroD * 3;
  // o ombro sobe e chega um pouco para o pescoço (o peso entra junto)
  const n = J.pescoco * 3;
  o[iO] += (o[n] - o[iO]) * 0.08 * w; o[iO + 2] += (o[n + 2] - o[iO + 2]) * 0.08 * w; o[iO + 1] += sobe * w;
  const l = Math.hypot(dx, dz) || 1, ux = dx / l, uz = dz / l;
  const ci = Math.cos(incl), si = Math.sin(incl);
  const tx = o[iO] + ux * si * BRACO_TOTAL, ty = o[iO + 1] + ci * BRACO_TOTAL, tz = o[iO + 2] + uz * si * BRACO_TOTAL;
  maoEm(o, h, 1, tx, ty, tz, w, POLO_FORA);
}

/** G_APONTA: o braço do lado `lado` estendido para o ponto (px, py, pz). */
export function gAponta(o, h, lado, px, py, pz, w) {
  if (w <= 0) return;
  const iO = (lado < 0 ? J.ombroE : J.ombroD) * 3;
  const dx = px - o[iO], dy = py - o[iO + 1], dz = pz - o[iO + 2], l = Math.hypot(dx, dy, dz) || 1;
  const k = BRACO_TOTAL * 0.97 / l;
  maoEm(o, h, lado, o[iO] + dx * k, o[iO + 1] + dy * k, o[iO + 2] + dz * k, w, POLO_BAIXO);
}

/** G_ANOTA: a mão esquerda no peito com o "caderno", a direita junto (escrevendo), a cabeça baixa. */
export function gAnota(o, h, t, w) {
  if (w <= 0) return;
  maoNoCorpo(o, h, -1, J.peito, 0.24, -0.04, -0.1, w, POLO_BAIXO);
  maoNoCorpo(o, h, 1, J.peito, 0.25, -0.03 + 0.015 * Math.sin(2 * Math.PI * 3 * t), -0.06, w, POLO_BAIXO);
  cabeca(o, h, 0.8 * w);
}

/**
 * G_AFASTA (IFAB, "only the captain"): os braços cruzados pelos pulsos acima da cabeça (`u` 0–0,5) e depois as palmas
 * abertas empurrando para a frente (0,5–1). u = progresso do gesto (0–1).
 */
export function gAfasta(o, h, u, w) {
  if (w <= 0) return;
  const c = J.cabeca * 3, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  if (u < 0.5) {
    // cruzados: a mão esquerda passa para a direita do meio e a direita para a esquerda, acima da cabeça
    const k = suave(u / 0.2);
    for (const lado of [-1, 1]) {
      const tx = o[c] + fx * 0.1 - rx * lado * 0.05, ty = o[c + 1] + 0.3, tz = o[c + 2] + fz * 0.1 - rz * lado * 0.05;
      maoEm(o, h, lado, tx, ty, tz, w * k, POLO_FORA);
    }
  } else {
    // palmas abertas para a frente, na altura do peito, empurrando duas vezes
    const e = 0.32 + 0.1 * Math.sin(2 * Math.PI * 2 * (u - 0.5) * 1.2);
    maoNoCorpo(o, h, -1, J.peito, e, 0.16, 0.05, w, POLO_BAIXO);
    maoNoCorpo(o, h, 1, J.peito, e, 0.16, 0.05, w, POLO_BAIXO);
  }
}

/** G_APITO: a mão direita na boca (o apito), a esquerda para cima. */
export function gApito(o, h, w) {
  if (w <= 0) return;
  maoNoCorpo(o, h, 1, J.cabeca, 0.12, 0, -0.06, w, POLO_BAIXO);
  gesto(o, h, -1, G_CEU, null, 0, w);
}

/** G_ABERTOS: os braços abertos a ~60° do tronco, palmas para cima, antebraço um pouco dobrado. */
export function gAbertos(o, h, w) {
  if (w <= 0) return;
  for (const lado of [-1, 1]) maoNoCorpo(o, h, lado, lado < 0 ? J.ombroE : J.ombroD, 0.17, 0.4, -0.22, w, POLO_TRAS);
}

/** G_CABECA (da comemoração): as duas mãos na cabeça. */
export function gCabeca(o, h, w) {
  if (w <= 0) return;
  gesto(o, h, -1, G_CABECA, null, 0, w); gesto(o, h, 1, G_CABECA, null, 0, w);
}

/** G_DESCULPA: a mão direita aberta erguida na altura do ombro, a palma para o árbitro. */
export function gDesculpa(o, h, w) { maoNoCorpo(o, h, 1, J.ombroD, 0.3, 0.06, 0.1, w, POLO_BAIXO); }

/** G_SEGURA: as duas mãos no peito do alvo (≤ 0,2 m do esterno). alvo = a pose dele. */
export function gSegura(o, h, alvo, w) {
  if (w <= 0) return;
  const p = J.peito * 3, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  // a frente do peito dele (do lado de quem segura) e as mãos uma de cada lado do esterno
  const ex = alvo[p] - fx * 0.11, ey = alvo[p + 1] + 0.02, ez = alvo[p + 2] - fz * 0.11;
  for (const lado of [-1, 1]) maoEm(o, h, lado, ex + rx * lado * 0.09, ey, ez + rz * lado * 0.09, w, POLO_BAIXO);
}

/** G_TAPINHA: a mão do lado `lado` nas costas do alvo (≤ 0,15 m), dando tapinhas. alvo = pose; ah = rumo dele. */
export function gTapinha(o, h, lado, alvo, ah, t, w) {
  if (w <= 0) return;
  const p = J.peito * 3, fx = Math.cos(ah), fz = Math.sin(ah);
  const bate = 0.025 * Math.max(0, Math.sin(2 * Math.PI * 2.2 * t));
  maoEm(o, h, lado, alvo[p] - fx * (0.11 + bate), alvo[p + 1] - 0.04, alvo[p + 2] - fz * (0.11 + bate), w, POLO_BAIXO);
}

/** Ponto das costas do ator (a pose `alvo`, rumo ah): onde a mão do tapinha encosta. */
export function costas(alvo, ah, out) {
  const p = J.peito * 3;
  out.x = alvo[p] - Math.cos(ah) * 0.11; out.y = alvo[p + 1] - 0.04; out.z = alvo[p + 2] - Math.sin(ah) * 0.11;
  return out;
}

/** G_ABANA: a mão direita abanando para baixo (1,5 Hz), ao lado do corpo. */
export function gAbana(o, h, t, w) {
  if (w <= 0) return;
  maoNoCorpo(o, h, 1, J.ombroD, 0.22, 0.14, -0.33 + 0.08 * Math.sin(2 * Math.PI * 1.5 * t), w, POLO_BAIXO);
}

/** G_ROSTO: as duas mãos fechadas na frente do nariz e da boca, cotovelos para fora ("puxa a camisa", sem pano). */
export function gRosto(o, h, w) {
  if (w <= 0) return;
  maoNoCorpo(o, h, -1, J.cabeca, 0.13, 0.03, -0.05, w, POLO_FORA);
  maoNoCorpo(o, h, 1, J.cabeca, 0.13, 0.03, -0.05, w, POLO_FORA);
}
/** Ponto do rosto (nariz e boca) da pose o, rumo h. */
export function rosto(o, h, out) {
  const c = J.cabeca * 3;
  out.x = o[c] + Math.cos(h) * 0.1; out.y = o[c + 1] - 0.03; out.z = o[c + 2] + Math.sin(h) * 0.1;
  return out;
}

/** G_PALMAS_ALTO: palmas acima da cabeça a 2 Hz (os pulsos ≥ 0,10 m acima do topo da cabeça). */
export function gPalmasAlto(o, h, t, w) {
  if (w <= 0) return;
  const ab = 0.5 + 0.5 * Math.cos(2 * Math.PI * 2 * t);
  for (const lado of [-1, 1]) maoNoCorpo(o, h, lado, J.cabeca, 0.1, 0.03 + 0.06 * ab, 0.26, w, POLO_FORA);
}

/** G_CINTURA (fim de tempo): as mãos na cintura, na crista do quadril (≤ 0,12 m da articulação do quadril). */
export function gCintura(o, h, w) {
  if (w <= 0) return;
  maoNoCorpo(o, h, -1, J.pelve, -0.01, 0.165, 0.035, w, POLO_TRAS);
  maoNoCorpo(o, h, 1, J.pelve, -0.01, 0.165, 0.035, w, POLO_TRAS);
}

/** G_JOELHOS: o quadril desce um pouco, o tronco inclina ~35° e as mãos vão aos joelhos (os pés plantados). */
export function gJoelhos(o, j, w) {
  if (w <= 0) return;
  const h = j.rumo, fx = Math.cos(h), fz = Math.sin(h);
  flexionar(o, j, -0.12 * w);
  inclinarTronco(o, fx, fz, 0.6 * w);
  for (const lado of [-1, 1]) {
    const k = (lado < 0 ? J.joelhoE : J.joelhoD) * 3;
    maoEm(o, h, lado, o[k] + fx * 0.06, o[k + 1] + 0.05, o[k + 2] + fz * 0.06, w, POLO_FORA);
  }
}

/** G_APERTO: a mão direita no ponto (px, py, pz) (o meio entre os dois), sacudindo duas vezes. */
export function gAperto(o, h, px, py, pz, w) { if (w > 0) maoEm(o, h, 1, px, py, pz, w, POLO_BAIXO); }

/** G_CEU e G_SOCO (da comemoração): os dois braços para o céu; o soco no ar (lado). */
export function gCeu(o, h, w) { if (w > 0) { gesto(o, h, -1, G_CEU, null, 0, w); gesto(o, h, 1, G_CEU, null, 0, w); } }
export function gSoco(o, h, lado, w, dy = 0) { if (w > 0) gesto(o, h, lado, G_SOCO, null, 0, w, dy); }

/** Postura cabisbaixo: cabeça e pescoço ~30° para a frente, o tronco +8° (os braços soltos: os da locomoção). */
export function posturaCabisbaixo(o, h, w) {
  if (w <= 0) return;
  inclinarTronco(o, Math.cos(h), Math.sin(h), 0.14 * w);
  cabeca(o, h, w);
}
/** Postura agachado (cócoras, os pés plantados): a da comemoração. */
export function posturaAgachado(o, j, w) { poseAgachado(o, j, w); }
/** A cabeça para trás (olhando o céu: as mãos na cabeça do A2). */
export function cabecaCeu(o, h, w) { if (w > 0) cabeca(o, h, -w); }
/** A cabeça balançando de lado (±12°, 2 Hz: "não", A1) ou acenando (sim: 2 acenos). */
export function balancaCabeca(o, h, t, w, sim = false) {
  if (w <= 0) return;
  const c = J.cabeca * 3, n = J.pescoco * 3, fx = Math.cos(h), fz = Math.sin(h), rx = -fz, rz = fx;
  const dx = o[c] - o[n], dy = o[c + 1] - o[n + 1], dz = o[c + 2] - o[n + 2];
  if (sim) {
    // aceno: a cabeça gira para a frente no plano (frente, cima) e volta (o lado fica)
    const a = 0.32 * w * Math.max(0, Math.sin(2 * Math.PI * 2.5 * t));
    const fw = dx * fx + dz * fz, rw = dx * rx + dz * rz, ca = Math.cos(a), sa = Math.sin(a);
    const nf = fw * ca + dy * sa, ny = -fw * sa + dy * ca;
    o[c] = o[n] + fx * nf + rx * rw; o[c + 1] = o[n + 1] + ny; o[c + 2] = o[n + 2] + fz * nf + rz * rw;
    return;
  }
  const a = 0.21 * w * Math.sin(2 * Math.PI * 2 * t);
  // gira a cabeça (o ponto dela à frente do pescoço) em volta do eixo vertical: o "não"
  const fw = dx * fx + dz * fz, rw = dx * rx + dz * rz, ca = Math.cos(a), sa = Math.sin(a);
  const nf = fw * ca - rw * sa, nr = fw * sa + rw * ca;
  o[c] = o[n] + fx * nf + rx * nr; o[c + 2] = o[n + 2] + fz * nf + rz * nr;
}

/** Ângulo (rad) da cabeça para a frente em relação ao vertical (pescoço → cabeça, no rumo h): > 0 = baixa. */
export function anguloCabeca(o, h) {
  const c = J.cabeca * 3, n = J.pescoco * 3;
  const dx = o[c] - o[n], dy = o[c + 1] - o[n + 1], dz = o[c + 2] - o[n + 2];
  return Math.atan2(dx * Math.cos(h) + dz * Math.sin(h), dy);
}

// ------------------------------------------------------------------------------------------------ câmera
/** A câmera pode ficar em (x, y, z)? Dentro dos limites da comemoração, fora do gol e de qualquer sólido do estádio. */
export function camValida(x, y, z) {
  const L = CENAS.camLimite;
  if (Math.abs(x) > MX + L || Math.abs(z) > MZ + L) return false;
  if (Math.abs(x) > MX - 0.5 && Math.abs(z) < 4.6) return false;
  return !solidoEm(x, y, z, 0.3, false);
}

/**
 * Custo de uma câmera em (cx, cz) para os assuntos (atores): Infinity com alguém a menos de CENAS.lente (+ folga) da lente
 * agora ou onde vai parar (o alvo dele) — o assunto também —, senão a oclusão (alguém entre a lente e um assunto, perto da
 * reta) e quem fica grande no quadro (perto da lente, no ângulo do plano).
 */
export function custoCamera(c, cx, cz, assuntos, folga = 0.4) {
  let custo = 0;
  const lim = CENAS.lente + folga;
  for (const a of c.atores) {
    if (!a.ativo) continue;
    const pts = [a.j.x, a.j.z, a.alvoX ?? a.j.x, a.alvoZ ?? a.j.z];
    for (let q = 0; q < 4; q += 2) if (Math.hypot(pts[q] - cx, pts[q + 1] - cz) < lim) return Infinity;
    if (assuntos.includes(a)) continue;
    for (const s of assuntos) {
      const ex = s.j.x - cx, ez = s.j.z - cz, el2 = ex * ex + ez * ez || 1;
      for (let q = 0; q < 4; q += 2) {
        const ax = pts[q] - cx, az = pts[q + 1] - cz;
        const w = (ax * ex + az * ez) / el2;
        if (w > 0.05 && w < 0.97) {
          const lado = Math.hypot(ax - ex * w, az - ez * w);
          if (lado < 0.75) custo += 0.75 - lado;
        }
        const da = Math.hypot(ax, az);
        if (da < 7 && w > 0) {
          const cosA = (ax * ex + az * ez) / (da * Math.sqrt(el2));
          if (cosA > 0.85) custo += (7 - da) * 0.15;
        }
      }
    }
  }
  return custo;
}

/**
 * A melhor câmera entre candidatas [{x, y, z, pref}] (pref = custo extra da preferência): válida, sem ninguém na lente e
 * com a menor oclusão. Devolve {x, y, z} (a primeira candidata, se nenhuma servir).
 */
export function melhorCamera(c, cands, assuntos) {
  let melhor = null, menor = Infinity;
  for (const k of cands) {
    if (!camValida(k.x, k.y, k.z)) continue;
    const cc = custoCamera(c, k.x, k.z, assuntos) + (k.pref ?? 0);
    if (cc < menor - 1e-9) { menor = cc; melhor = k; }
  }
  if (!melhor) {
    // nenhuma livre: a válida com menos gente perto da lente (o teste mostra)
    for (const k of cands) if (camValida(k.x, k.y, k.z)) { melhor = k; break; }
  }
  const m = melhor ?? cands[0];
  return { x: m.x, y: m.y, z: m.z, custo: menor };
}

/** Plano de câmera: de, para, fov; o celular fecha e põe o assunto no terço esquerdo (ajustarCelular). */
export function definirPlano(out, nome, cx, cy, cz, px, py, pz, fov, opc) {
  out.nome = nome;
  out.de[0] = cx; out.de[1] = cy; out.de[2] = cz;
  out.para[0] = px; out.para[1] = py; out.para[2] = pz;
  out.fov = fov;
  limitarCamera(out);
  ajustarCelular(out, opc);
  return out;
}
/**
 * Plano de um GRUPO (plano de dois, de três): o olhar no meio do grupo (pelo ângulo horizontal de cada um, visto da
 * câmera, com a largura do corpo) a `olharY` m de altura. No celular (opc.pequena) o fov fecha (×COMEMORACAO.camera
 * .celular) e o grupo vai para a esquerda do quadro (o "Pular" fica à direita) só até a ponta esquerda dele chegar a
 * 0,85 da borda. pts = [x0, z0, x1, z1, ...].
 */
export function definirPlanoGrupo(out, nome, cx, cy, cz, pts, olharY, fov, opc) {
  out.nome = nome;
  out.de[0] = cx; out.de[1] = cy; out.de[2] = cz;
  limitarCamera(out);
  cx = out.de[0]; cz = out.de[2];
  let a0 = Infinity, a1 = -Infinity, ref = null, dm = 0, n = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const dx = pts[i] - cx, dz = pts[i + 1] - cz, d = Math.hypot(dx, dz) || 1;
    const a = Math.atan2(dz, dx);
    if (ref == null) ref = a;
    let r = a - ref; r -= 2 * Math.PI * Math.round(r / (2 * Math.PI));
    const meia = Math.atan(0.35 / d);
    a0 = Math.min(a0, r - meia); a1 = Math.max(a1, r + meia);
    dm += d; n++;
  }
  dm /= Math.max(1, n);
  let centro = ref + (a0 + a1) / 2;
  let f = fov;
  if (opc && opc.pequena) {
    f *= COMEMORACAO.camera.celular;
    const asp = Math.max(1, opc.aspecto ?? 16 / 9);
    const th = Math.tan((f * Math.PI) / 360) * asp;           // tangente da meia largura do quadro
    // para a direita (o grupo à esquerda): o desejado (1/3 da meia largura) até a ponta esquerda chegar a 0,85
    const desejado = Math.atan(th * COMEMORACAO.camera.terco);
    const folga = Math.atan(th * 0.85) - (a1 - a0) / 2;
    centro += clamp(Math.min(desejado, folga), 0, desejado);
  }
  out.para[0] = cx + Math.cos(centro) * dm; out.para[1] = olharY; out.para[2] = cz + Math.sin(centro) * dm;
  out.fov = f;
  return out;
}

/** Objeto de saída do plano de câmera (um por página/teste, reaproveitado). */
export function criarPlanoCena() { return { nome: 'fim', de: [0, 0, 0], para: [0, 0, 0], fov: 32, tunel: false }; }

export { J, NJ };
export const ALTURA_OMBRO = 1.4;
export const PERNA = JOGADOR.coxa + JOGADOR.canela;
