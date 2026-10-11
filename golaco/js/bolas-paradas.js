// Lugar de cada jogador da IA nas bolas paradas da Etapa 4 (pedido do dono, seção 8). Puro: sem three.js nem DOM;
// matemática pelo MD. O ia-tatica.js pergunta aqui antes do papel de sempre, enquanto a parada não foi cobrada
// (m.parada && !m.parada.rolou); quem não tem lugar aqui (null) segue o papel de sempre.
//
//  - Tiro de meta (Regra 16; TIRO_DE_META): do time que cobra, os zagueiros abrem nos cantos da área (dentro dela: só os
//    adversários ficam fora), o volante encosta na meia-lua e os laterais sobem pelos lados — a saída curta.
//  - Escanteio (ESCANTEIO): os papéis dos dois times saem da montagem (papeisEscanteio, guardados em m.parada.papeis e,
//    depois do chute, em m.partida.bp por ESCANTEIO.janela s ou até alguém dominar a bola). Ataque: 5 nas zonas (centro,
//    1º pau, 2º pau, marca do pênalti, entrada da área), saindo de perto da marca do pênalti e atacando a zona no chute;
//    2 ficam atrás; o resto na segunda bola. Defesa mista: zona na pequena área (meio, 1º pau, frente do 1º pau; o 2º
//    pau com gente sobrando), individual nos 4 melhores no alto da área (do lado do gol), um na borda da área e um lá na
//    frente para o contra-ataque.
//  - Barreira (Regra 13; BARREIRA): no tiro livre direto perto do gol, quantos e onde (barreiraDoTiroLivre), o pulo no
//    chute (alturaSalto) e a bola que bate nela (colisaoBarreira, chamada pelo sim.js depois da colisão de sempre).
// Coordenadas: as vagas estão no referencial de quem ataca para +x (a direita dele é +z); no mundo, x e z × m.ataca.

import { TIRO_DE_META, ESCANTEIO, BARREIRA, CAMPO, PASSO, BOLA } from './config.js';
import { FORMACOES } from './formacoes.js';
import { MD } from './matdet.js';
import { clamp, difAng } from './mat.js';

const MX = CAMPO.meioX;

const LADO_CAMPO = { LD: 1, LE: 1, ADD: 1, ADE: 1 };

/** Lado da vaga do jogador no mundo (+1 / −1 / 0 no meio) — pela posição-base sem a bola dela. */
function ladoDaVaga(m, j) {
  const f = m.times?.[j.time] && FORMACOES[m.times[j.time].formacao];
  const v = f && f.vagas[j.vagaIdx];
  if (!v) return j.z >= 0 ? 1 : -1;
  const z = v.sem.z * m.ataca[j.time];
  return z > 0.5 ? 1 : z < -0.5 ? -1 : 0;
}

/**
 * Lugar do jogador j (da IA, sem a bola) na bola parada por cobrar: escreve {x, z, correr} em out e devolve out, ou
 * null (sem lugar especial: o papel de sempre).
 */
export function alvoBolaParada(m, j, out) {
  if (j.posicao === 'GOL') return null;
  const pr = m.parada;
  if (pr && !pr.rolou && pr.cobrador != null) {
    if (j.id === pr.cobrador) return null;
    if (pr.tipo === 'tiroDeMeta' && j.time === pr.time) return tiroDeMeta(m, j, out);
    if (pr.tipo === 'escanteio' && pr.papeis) return escanteio(m, j, out, pr, false);
    return null;
  }
  // depois do chute do escanteio: os lugares ainda valem por um tempo (o cruzamento no ar)
  const bp = bolaParadaAtiva(m);
  if (bp && bp.tipo === 'escanteio') return escanteio(m, j, out, bp, true);
  return null;
}

/**
 * Os lugares da última bola parada ainda valem (m.partida.bp: o escanteio, até ESCANTEIO.janela s depois do chute e
 * enquanto ninguém domina a bola)? Devolve o registro ou null.
 */
export function bolaParadaAtiva(m) {
  const bp = m.partida?.bp;
  if (!bp || m.posse != null || m.naMao != null || (m.parada && !m.parada.rolou)) return null;
  if ((m.tick - bp.tick) * PASSO > ESCANTEIO.janela) return null;
  return bp;
}

/** Nota no alto (cabeceio, impulsão e altura, 0–100): quem ganha a bola alta. */
export function notaAerea(j) {
  const a = j.par.attr;
  return 0.5 * (a.cabeceio ?? 50) + 0.25 * (a.impulsao ?? 50) + 0.25 * clamp(((a.altura ?? 180) - 165) * 100 / 35, 0, 100);
}

const porNota = (p, q) => notaAerea(q) - notaAerea(p) || p.id - q.id;

/**
 * Papéis do escanteio que o jogador `c` (do time pr.time) vai cobrar, na montagem (pura; ordem fixa): lista de
 * {id, papel, u, w, su, sw, marca} — u, w no referencial do escanteio (ESCANTEIO: u da linha de fundo para dentro, w
 * para o lado do escanteio); su, sw = de onde o atacante sai; marca = id de quem ele marca.
 */
export function papeisEscanteio(m, c) {
  const E = ESCANTEIO, t = c.time;
  const lista = [];
  const form = FORMACOES[m.times[t].formacao];
  const ata = m.jogadores.filter(o => o.time === t && o !== c && o.posicao !== 'GOL').sort(porNota);
  // os 2 piores no alto da linha de defesa ficam atrás
  const ficam = ata.filter(o => form.vagas[o.vagaIdx]?.grupo === 'def').slice(-2);
  const resto = ata.filter(o => !ficam.includes(o));
  const area = resto.slice(0, E.zonas.length);
  area.forEach((o, i) => { const z = E.zonas[i]; lista.push({ id: o.id, papel: 'atacaZona', zona: z.nome, u: z.u, w: z.w, su: z.sai.u, sw: z.sai.w, marca: -1 }); });
  resto.slice(E.zonas.length).forEach((o, i) => { const z = E.segundaBola[i % E.segundaBola.length]; lista.push({ id: o.id, papel: 'segundaBola', u: z.u + 3 * Math.floor(i / 2), w: z.w, su: 0, sw: 0, marca: -1 }); });
  ficam.forEach((o, i) => lista.push({ id: o.id, papel: 'fica', u: E.ficam.u, w: i === 0 ? E.ficam.w : -E.ficam.w, su: 0, sw: 0, marca: -1 }));
  // defesa mista
  const def = m.jogadores.filter(o => o.time !== t && o.posicao !== 'GOL').sort(porNota);
  const marcar = area.slice(0, 4).sort(porNota); // os 4 da área (sem o da entrada), do melhor no alto ao pior
  const entrada = area[4] ?? null;
  let k = 0;
  const prox = () => (k < def.length ? def[k++] : null);
  const zd = E.zonasDefesa;
  let o = prox(); if (o) lista.push({ id: o.id, papel: 'zona', zona: zd[0].nome, u: zd[0].u, w: zd[0].w, su: 0, sw: 0, marca: -1 });
  for (const a of marcar) { o = prox(); if (o) lista.push({ id: o.id, papel: 'marca', u: 0, w: 0, su: 0, sw: 0, marca: a.id }); }
  for (const z of [zd[1], zd[2]]) { o = prox(); if (o) lista.push({ id: o.id, papel: 'zona', zona: z.nome, u: z.u, w: z.w, su: 0, sw: 0, marca: -1 }); }
  o = prox(); if (o) lista.push({ id: o.id, papel: 'borda', u: E.borda.u, w: E.borda.w, su: 0, sw: 0, marca: entrada ? entrada.id : -1 });
  o = prox(); if (o) lista.push({ id: o.id, papel: 'frente', u: E.frente.u, w: E.frente.w, su: 0, sw: 0, marca: -1 });
  o = prox(); if (o) lista.push({ id: o.id, papel: 'zona', zona: zd[3].nome, u: zd[3].u, w: zd[3].w, su: 0, sw: 0, marca: -1 });
  for (o = prox(); o; o = prox()) lista.push({ id: o.id, papel: 'frente', u: E.frente.u + 6, w: -E.frente.w * 2, su: 0, sw: 0, marca: -1 });
  return lista;
}

/** j é o de linha do time dele mais perto do ponto `a` (empate: o menor id)? */
function atacaABola(m, j, a) {
  const dj = MD.hypot(a.x - j.x, a.z - j.z);
  for (const o of m.jogadores) {
    if (o === j || o.time !== j.time || o.posicao === 'GOL' || o.papel === 'parado') continue;
    const d = MD.hypot(a.x - o.x, a.z - o.z);
    if (d < dj || (d === dj && o.id < j.id)) return false;
  }
  return true;
}

/** Ponto (x, z) no mundo do referencial do escanteio do time `t` no lado `sz` (escreve em out). */
export function pontoEscanteio(m, t, sz, u, w, out) {
  const lado = m.ataca[t];
  out.x = lado * MX - lado * u;
  out.z = sz * w;
  return out;
}

/** Ponto do marcador individual: do lado do gol do atacante `a`, a ESCANTEIO.marca m dele (escreve em out). */
export function pontoMarcador(m, t, a, out) {
  const gx = m.ataca[t] * MX;
  const dx = gx - a.x, dz = -a.z, d = MD.hypot(dx, dz) || 1;
  out.x = a.x + dx / d * ESCANTEIO.marca;
  out.z = a.z + dz / d * ESCANTEIO.marca;
  return out;
}

function escanteio(m, j, out, B, depois) {
  let p = null;
  for (const q of B.papeis) if (q.id === j.id) { p = q; break; }
  if (!p) return null;
  const t = B.time;
  // com o cruzamento no ar, o defensor (de linha) mais perto do ponto dele vai disputar a bola — a zona e a marcação
  // seguram o resto (sem isso ninguém da IA atacava a bola: só o controlado do humano, levado pela troca aérea)
  const v = m.voo;
  if (depois && j.time !== t && v && v.alvo && v.time === t && atacaABola(m, j, v.alvo)) {
    out.x = v.alvo.x; out.z = v.alvo.z; out.correr = true;
    return out;
  }
  if (p.papel === 'atacaZona') {
    if (depois) pontoEscanteio(m, t, B.sz, p.u, p.w, out);
    else pontoEscanteio(m, t, B.sz, p.su, p.sw, out);
  } else if (p.papel === 'marca' || (p.papel === 'borda' && p.marca >= 0)) {
    let a = null;
    for (const q of m.jogadores) if (q.id === p.marca) { a = q; break; }
    if (a) pontoMarcador(m, t, a, out);
    else pontoEscanteio(m, t, B.sz, p.u || ESCANTEIO.borda.u, p.w, out);
  } else pontoEscanteio(m, t, B.sz, p.u, p.w, out);
  out.correr = depois || MD.hypot(out.x - j.x, out.z - j.z) > 3;
  return out;
}

function tiroDeMeta(m, j, out) {
  const T = TIRO_DE_META, lado = m.ataca[j.time], gx = -lado * CAMPO.meioX;
  const pos = j.posDetalhe;
  let u, w;
  const s = ladoDaVaga(m, j);
  if (pos === 'ZAG') { u = T.aberto.u - (s === 0 ? 2 : 0); w = s * T.aberto.z; }
  else if (pos === 'VOL') { u = T.volante.u; w = s * 6; }
  else if (LADO_CAMPO[pos]) { u = T.laterais.u; w = (s || 1) * T.laterais.z; }
  else return null;
  out.x = gx + lado * u; out.z = w; out.correr = true;
  return out;
}

// ------------------------------------------------------------------------------------------- barreira

/**
 * Barreira do tiro livre direto do time `t` com a bola em (bx, bz) (pura): {n, pontos: [{x, z}], cx, cz (centro), px,
 * pz (direção ao longo dela), dist (da bola), ladoLongo (+1/−1: o lado do 2º pau, em z)} ou null (longe: sem barreira).
 * Cobre BARREIRA.cobre do gol a partir de um pouco por fora do 1º pau; n = a largura da sombra ÷ BARREIRA.espaco.
 */
export function barreiraDoTiroLivre(m, t, bx, bz) {
  const B = BARREIRA, lado = m.ataca[t], gx = lado * MX, meio = CAMPO.gol.largura / 2;
  if (MD.hypot(gx - bx, bz) > B.longe) return null;
  const sz = bz >= 0 ? 1 : -1;                     // o 1º pau é o do lado da bola
  const z1 = sz * (meio + B.foraPau), z2 = sz * meio - sz * B.cobre * CAMPO.gol.largura;
  // ângulos medidos a partir da direção do meio do gol (sem o salto de ±π de quem ataca para −x)
  const a0 = MD.atan2(-bz, gx - bx);
  const ang = z => difAng(a0, MD.atan2(z - bz, gx - bx));
  const d1 = ang(z1), d2 = ang(z2);
  let n = Math.round(B.distancia * Math.abs(d1 - d2) / B.espaco);
  n = clamp(n, B.min, B.max);
  // de lado (a bola longe do eixo do gol: falta de cruzamento), no máximo 2 — para o cruzamento rasteiro
  if (MD.atan2(Math.abs(bz), Math.abs(gx - bx)) > B.deLado) n = Math.min(n, 2);
  const ac = a0 + (d1 + d2) / 2;
  const cx = bx + MD.cos(ac) * B.distancia, cz = bz + MD.sin(ac) * B.distancia;
  const px = -MD.sin(ac), pz = MD.cos(ac);
  const pontos = [];
  for (let k = 0; k < n; k++) {
    const o = (k - (n - 1) / 2) * B.espaco;
    pontos.push({ x: cx + px * o, z: cz + pz * o });
  }
  return { n, pontos, cx, cz, px, pz, dist: B.distancia, ladoLongo: -sz };
}

/** Altura do pulo do jogador da barreira no tick (0 sem pulo): seno de 0 a BARREIRA.salto.tempo s depois do chute. */
export function alturaSalto(j, tick) {
  const s = j.salto;
  if (!s) return 0;
  const t = (tick - s.tick) * PASSO, T = BARREIRA.salto.tempo;
  if (t <= 0 || t >= T) return 0;
  return s.h * MD.sin(Math.PI * t / T);
}

/**
 * Bola na barreira (o sim.js chama no passo da bola, com m.partida.barreira — a barreira do último tiro livre, até o
 * fim do pulo): a bola que passa pelo corpo de alguém da barreira (raio BARREIRA.corpo; do chão ou do pé no ar até o
 * topo da cabeça, com o pulo) volta com BARREIRA.restituicao da velocidade normal e perde BARREIRA.amortece do resto.
 * Uma batida por jogador. Evento 'bateuCorpo' (o goleiro relê o chute) e 'bateuBarreira'.
 */
export function colisaoBarreira(m) {
  const br = m.partida?.barreira;
  if (!br) return;
  if ((m.tick - br.tick) * PASSO > BARREIRA.salto.tempo + 0.4) { m.partida.barreira = null; return; }
  const b = m.bola, R = BOLA.raio, lim = BARREIRA.corpo + R;
  for (const id of br.ids) {
    if (br.bateu.includes(id)) continue;
    let j = null;
    for (const o of m.jogadores) if (o.id === id) { j = o; break; }
    if (!j) continue;
    const h = alturaSalto(j, m.tick);
    if (b.p.y - R > BARREIRA.topo + h || b.p.y + R < h) continue;
    const dx = b.p.x - j.x, dz = b.p.z - j.z, d = MD.hypot(dx, dz);
    if (d >= lim || d < 1e-9) continue;
    const nx = dx / d, nz = dz / d;
    const vn = b.v.x * nx + b.v.z * nz;
    if (vn >= 0) continue;
    const tx = b.v.x - vn * nx, tz = b.v.z - vn * nz, A = BARREIRA.amortece;
    b.v.x = -vn * nx * BARREIRA.restituicao + tx * (1 - A);
    b.v.z = -vn * nz * BARREIRA.restituicao + tz * (1 - A);
    b.v.y *= 1 - A;
    b.w.x = 0; b.w.y = 0; b.w.z = 0;
    b.p.x = j.x + nx * lim; b.p.z = j.z + nz * lim;
    br.bateu.push(id);
    m.eventos.push({ tipo: 'bateuCorpo', id }, { tipo: 'bateuBarreira', id });
    m.desvio = m.tick;
  }
}
