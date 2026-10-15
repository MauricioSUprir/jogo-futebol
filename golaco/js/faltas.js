// Faltas e cartões (IFAB Regra 12; Etapa 4). Puro: sem three.js nem DOM; sorteios pelo m.rng. Constantes em config.js
// FALTAS. Só age na partida (m.partida): o treino não tem árbitro e o hash dele não muda.
//
// Onde nasce uma falta (ganchos, todos só com m.partida):
//  - sim.js boteIA: o bote da IA que chega pode ser falta (chegada por trás/lado/frente, velocidade, desarme);
//  - defesa.js resolverBote: a DIVIDIDA do humano que não ganha a bola com o pé no condutor;
//  - sim.js colisaoCorpos: carga por trás no condutor fechando rápido (e a memória do choque, guardarChoque: a força com
//    que cada um entrou no outro, para o bote do passo seguinte — forcaContato);
//  - sim.js boteIA (antes do alcance da bola): o marcador batido, colado por trás do condutor, segura — no contra-ataque é a
//    falta tática (SPA, amarelo); fora dele, às vezes, sem cartão ('segurar').
// A falta vira m.faltaPendente (a 1ª do passo) e o evento 'falta'; partida.js regrasPartida decide: vantagem, tiro livre
// direto ou pênalti, e o cartão (agora ou na próxima parada).
//
// Gravidade (Regra 12.1): imprudente (sem cartão), temerária (amarelo) e com força excessiva (vermelho). Cartões por
// conduta (Regra 12.3): amarelo por parar um ataque promissor (SPA); vermelho por tirar uma chance clara de gol (DOGSO)
// — dentro da própria área, tentando jogar a bola, é amarelo (e o pênalti).

import { FALTAS, CAMPO, ACOES, PASSO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';

const MX = CAMPO.meioX, AREA_U = CAMPO.meioX - CAMPO.area.profundidade, AREA_W = CAMPO.area.largura / 2;
const COS_DOGSO = MD.cos(FALTAS.dogso.angulo);

function porId(m, id) {
  for (const o of m.jogadores) if (o.id === id) return o;
  return null;
}

/** Direção do condutor: a da corrida (≥ 1 m/s), senão o rumo do corpo. */
function direcao(c) {
  const v = MD.hypot(c.vx, c.vz);
  if (v >= 1) return { x: c.vx / v, z: c.vz / v, v };
  return { x: MD.cos(c.rumo), z: MD.sin(c.rumo), v };
}

/** De onde o defensor `d` chega ao condutor `c`: 'frente' | 'lado' | 'tras' (pela direção do condutor). */
export function chegada(d, c) {
  const u = direcao(c);
  const dx = d.x - c.x, dz = d.z - c.z, l = MD.hypot(dx, dz) || 1;
  const cos = (dx * u.x + dz * u.z) / l;
  return cos > 0.35 ? 'frente' : cos < -0.45 ? 'tras' : 'lado';
}

/** O ponto (x, z) está dentro da área que o time `t` defende? */
export function naAreaDe(m, t, x, z) {
  const s = -m.ataca[t]; // o gol do time t fica em x = s · 52,5
  return x * s > AREA_U && Math.abs(z) < AREA_W;
}

/**
 * Chance clara de gol (DOGSO, os 4 critérios da Regra 12.3): o condutor `c` está a ≤ FALTAS.dogso.dist do gol que ataca,
 * indo para ele (ângulo entre a corrida e o gol ≤ dogso.angulo, a ≥ 2 m/s), com a bola dominada, e nenhum defensor de
 * linha (fora o que fez a falta) entre ele e o gol.
 */
export function chanceClara(m, c, def) {
  if (m.posse !== c.id) return false;
  const lado = m.ataca[c.time];
  const gx = lado * MX;
  const dist = MD.hypot(gx - c.x, c.z);
  if (dist > FALTAS.dogso.dist) return false;
  const u = direcao(c);
  if (u.v < 2) return false;
  // (cosseno do ângulo entre a corrida e o gol, sem acos: a conta fica igual em todo motor JS)
  if ((u.x * (gx - c.x) + u.z * (0 - c.z)) / (dist || 1) < COS_DOGSO) return false;
  for (const o of m.jogadores) {
    if (o.time === c.time || o === def || o.posicao === 'GOL') continue;
    // entre ele e o gol: mais perto do gol que ele e dentro do cone de ±25° até o gol
    if ((o.x - c.x) * lado <= 0) continue;
    const ox = o.x - c.x, oz = o.z - c.z, ol = MD.hypot(ox, oz) || 1;
    const cosG = (ox * (gx - c.x) + oz * (0 - c.z)) / (ol * (dist || 1));
    if (cosG > 0.9) return false;
  }
  return true;
}

/**
 * Ataque promissor (SPA): o condutor dominando a bola no campo de ataque (a ≥ spa.u m do meio), indo para a frente a ≥
 * spa.vFrente m/s, com no máximo spa.defensores defensores de linha entre ele e a linha de fundo.
 */
export function ataquePromissor(m, c) {
  if (m.posse !== c.id) return false;
  const lado = m.ataca[c.time];
  if (c.x * lado < FALTAS.spa.u || c.vx * lado < FALTAS.spa.vFrente) return false;
  let n = 0;
  for (const o of m.jogadores) if (o.time !== c.time && o.posicao !== 'GOL' && (o.x - c.x) * lado > 0) n++;
  return n <= FALTAS.spa.defensores;
}

/**
 * Monta a falta do defensor `d` no condutor `c` (pura, sem sortear): {def, cond, time (de quem sofreu), x, z, area
 * (pênalti), chegada, v (de quem chegou), grau, cartao, motivo, origem}. O cartão: excessivo → vermelho; DOGSO →
 * vermelho (na área, com tentativa de jogar a bola → amarelo); temerário → amarelo; SPA → amarelo; senão nenhum.
 * `tentouBola`: o bote/dividida (tentou jogar a bola) × carga/segurar (não tentou).
 */
export function montarFalta(m, d, c, origem, tentouBola, excessivo = false) {
  const ch = chegada(d, c);
  const v = MD.hypot(d.vx, d.vz);
  const area = naAreaDe(m, d.time, c.x, c.z);
  let grau = 'imprudente';
  if (excessivo) grau = 'excessivo';
  else if (ch === 'tras' && v >= FALTAS.temerario) grau = 'temerario';
  // a carga nas costas com força é no mínimo temerária (IFAB Regra 12.1: "sem ligar para o perigo" para o adversário)
  else if (ch === 'tras' && origem === 'carga' && forcaContato(m, d, c) >= FALTAS.carga.temeraria) grau = 'temerario';
  const dogso = chanceClara(m, c, d);
  let cartao = null, motivo = grau;
  if (grau === 'excessivo') { cartao = 'vermelho'; motivo = 'forcaExcessiva'; }
  else if (dogso && !(area && tentouBola)) { cartao = 'vermelho'; motivo = 'dogso'; }
  else if (dogso) { cartao = 'amarelo'; motivo = 'dogsoArea'; }
  else if (grau === 'temerario') cartao = 'amarelo';
  else if (origem === 'tatica' || ataquePromissor(m, c)) { cartao = 'amarelo'; motivo = 'spa'; }
  return { def: d.id, cond: c.id, time: c.time, x: c.x, z: c.z, area, chegada: ch, v, grau, cartao, motivo, origem, tick: m.tick };
}

/** Registra a falta do passo (a 1ª vale): m.faltaPendente e o evento 'falta'. */
export function registrarFalta(m, f) {
  if (m.faltaPendente) return false;
  m.faltaPendente = f;
  m.eventos.push({ tipo: 'falta', def: f.def, id: f.cond, time: f.time, x: f.x, z: f.z, area: f.area, grau: f.grau, cartao: f.cartao, motivo: f.motivo, origem: f.origem });
  return true;
}

/**
 * Força do contato que o defensor `d` faz no condutor `c` (m/s, ≥ 0): a velocidade com que ELE entra no homem, limitada
 * pela aproximação dos dois — min(v_d · n, (v_d − v_c) · n)⁺, n de d para c (IFAB Regra 12: imprudente é o desafio sem
 * cuidado; o contato a passo, sem ninguém entrar no outro, é incidental). O defensor que recua ou só acompanha não entra
 * (0); o condutor que recua para dentro de quem estava atrás não vira carga de quem estava atrás. A colisão dos corpos
 * (sim.js colisaoCorpos) zera a aproximação no passo do choque: vale também a força guardada no choque com ele
 * (guardarChoque) nos últimos FALTAS.forca.janela s. A mais de FALTAS.forca.alcance m do condutor: 0 (não há contato).
 */
export function forcaContato(m, d, c) {
  const rx = c.x - d.x, rz = c.z - d.z, l = MD.hypot(rx, rz) || 1;
  // longe do condutor (a bola entre os dois, ele a mais de FALTAS.forca.alcance m: corpo + perna esticada + o pé dele) não
  // há contato possível — o bote na bola é desarme limpo
  if (l > FALTAS.forca.alcance) return 0;
  const nx = rx / l, nz = rz / l;
  let f = Math.max(0, Math.min(d.vx * nx + d.vz * nz, (d.vx - c.vx) * nx + (d.vz - c.vz) * nz));
  const ch = d.choque;
  if (ch && ch.id === c.id && (m.tick - ch.tick) * PASSO <= FALTAS.forca.janela) f = Math.max(f, ch.f);
  return f;
}

/**
 * Memória do choque (sim.js colisaoCorpos, só na partida, ANTES da resposta que zera a aproximação): a força com que cada
 * um entrou no outro (n de p para q) — a maior dos últimos FALTAS.forca.janela s (encostados correndo juntos, o choque
 * de antes não vale para sempre: depois da janela vale a força de agora).
 */
export function guardarChoque(m, p, q, nx, nz) {
  const rv = (p.vx - q.vx) * nx + (p.vz - q.vz) * nz; // > 0: fechando
  if (rv <= 0) return;
  const fp = Math.max(0, Math.min(p.vx * nx + p.vz * nz, rv)), fq = Math.max(0, Math.min(-(q.vx * nx + q.vz * nz), rv));
  anotarChoque(m, p, q.id, fp);
  anotarChoque(m, q, p.id, fq);
}
function anotarChoque(m, j, id, f) {
  const ch = j.choque;
  if (ch && ch.id === id && f < ch.f && (m.tick - ch.tick) * PASSO <= FALTAS.forca.janela) return;
  if (ch) { ch.id = id; ch.tick = m.tick; ch.f = f; } else j.choque = { id, tick: m.tick, f };
}

/**
 * Fator da força do contato no bote: 0 até FALTAS.forca.min m/s (contato incidental), sobe até FALTAS.forca.cheia e, de
 * min para cima, × (1 + porForca · (f − min)): quanto mais forte o defensor entra no homem, mais o bote vira falta.
 */
export function fatorForca(f) {
  const F = FALTAS.forca;
  return clamp((f - F.min) / (F.cheia - F.min), 0, 1) * (1 + F.porForca * Math.max(0, f - F.min));
}

/** Chance de o bote/dividida de `d` em `c` ser falta (sem sortear). */
export function chanceFaltaBote(d, c) {
  const B = FALTAS.bote;
  const ch = chegada(d, c);
  const v = MD.hypot(d.vx, d.vz);
  const base = ch === 'tras' ? B.tras : ch === 'lado' ? B.lado : B.frente;
  const des = lerp(B.desarme[0], B.desarme[1], clamp((d.par.attr.desarme - 40) / 50, 0, 1));
  // no condutor parado/lento o bote vem devagar e de perto: menos falta (B.lento)
  const lento = MD.hypot(c.vx, c.vz) < ACOES.boteIA.vParado ? B.lento : 1;
  return clamp(base * (1 + B.porVel * Math.max(0, v - B.vLivre)) * des * lento, 0, 0.95);
}

/**
 * Chance de a DIVIDIDA do humano que não ganhou a bola (defesa.js resolverBote; motivo 'perdeu' ou 'tocou') ser falta: a
 * MESMA régua do bote da IA — chegada, velocidade, desarme e a força do contato (fatorForca(forcaContato): o pé que sai
 * na bola sem o corpo entrar no condutor é desarme errado, não falta) — × FALTAS.dividida[motivo]. Sem o cuidado da área
 * e da chance clara (FALTAS.bote.naArea/naChanceClara: ali quem decide entrar é a pessoa). Contraprova de 15/10: só o
 * bote da IA tinha ganhado a força do contato, e ~60% das faltas da DIVIDIDA eram com o corpo entrando a < 1 m/s.
 */
export function chanceFaltaDividida(m, d, c, motivo) {
  return Math.min(0.95, chanceFaltaBote(d, c) * fatorForca(forcaContato(m, d, c))) * (FALTAS.dividida[motivo] ?? 0);
}

/** faltaNoBote: o defensor tirou o corpo (na própria área ou na chance clara) — o bote não sai neste passo. */
export const BOTE_EVITADO = Object.freeze({ evitado: true });

/**
 * O bote da IA (sim.js boteIA, depois do sorteio de que ele chega) é falta? Sorteia pelo m.rng (só na partida).
 * Devolve a falta montada, BOTE_EVITADO (ele tirou o corpo: sem bote) ou null (bote limpo: a IA leva a bola como antes).
 */
export function faltaNoBote(m, d, c) {
  if (!m.partida) return null;
  // o bote da IA só sai com a bola mais perto do defensor que do condutor (ou parada/encostada nele): ele chega na bola
  // antes do homem. Falta é o desafio sem cuidado que leva o corpo para dentro do condutor — pela força do contato
  // (forcaContato × fatorForca). Contato a passo (o defensor recuando de frente, acompanhando de lado, a bola encostada)
  // é desarme limpo. Pedido do dono, 15/10 ("faltas muito forçadas e sem sentido": 53% das faltas da IA no humano que
  // conduz eram com o defensor entrando a < 1 m/s; tools/teste-faltas-sentido.mjs)
  // na própria área (seria pênalti) e na chance clara de gol (seria vermelho) o defensor evita entrar no homem, como na
  // carga: × FALTAS.bote.naArea, × FALTAS.bote.naChanceClara. Evitar é TIRAR O CORPO (BOTE_EVITADO: sem bote neste passo),
  // não o árbitro deixar passar — o bote que entraria no homem seguia como desarme limpo, e o mesmo contato era falta fora
  // da área e roubada limpa dentro dela (contraprova de 15/10). A régua do contato é a mesma no campo todo (IFAB Regra 12)
  const cuidado = (naAreaDe(m, d.time, c.x, c.z) ? FALTAS.bote.naArea : 1) * (chanceClara(m, c, d) ? FALTAS.bote.naChanceClara : 1);
  const p = Math.min(0.95, chanceFaltaBote(d, c) * fatorForca(forcaContato(m, d, c)));
  const u = uniforme(m.rng);
  if (u >= p) return null;
  if (u >= p * cuidado) return BOTE_EVITADO;
  const v = MD.hypot(d.vx, d.vz);
  const exc = chegada(d, c) === 'tras' && v >= FALTAS.excessivo && uniforme(m.rng) < FALTAS.excessivoP;
  return montarFalta(m, d, c, 'bote', true, exc);
}

/**
 * Falta tática (sim.js boteIA, antes do alcance da bola): o defensor da IA batido — atrás do condutor, colado (≤
 * FALTAS.tatica.dist) — num ataque promissor (não na chance clara: seria vermelho) puxa a camisa (SPA: amarelo). Fora do
 * ataque promissor ele também segura, menos (FALTAS.tatica.semSPA por passo; IFAB Regra 12.1, "segura o adversário": tiro
 * livre direto, sem cartão — origem 'segurar'), e nunca na própria área (seria pênalti: ele evita). Chance por passo; só
 * na partida. Pedido do dono, 15/10: sem as faltas sem contato, a IA × IA caía para ~1,1 falta por partida (real ~0,40 por
 * minuto de bola rolando ≈ 3 por partida daqui); segurar quem passou é falta de verdade que só existia no contra-ataque.
 */
export function faltaTatica(m, d, c) {
  if (!m.partida || m.posse !== c.id) return null;
  if (MD.hypot(d.x - c.x, d.z - c.z) > FALTAS.tatica.dist) return null;
  if (chegada(d, c) !== 'tras') return null;
  if (chanceClara(m, c, d)) return null;
  const spa = ataquePromissor(m, c);
  // fora do contra-ataque ele só segura quem está ESCAPANDO dele (escapando): segurar o condutor parado, andando ou que
  // ele está alcançando não tem motivo — era falta "do nada" (contraprova de 15/10: ~1/3 das 'segurar')
  const p = spa ? FALTAS.tatica.chancePorPasso : naAreaDe(m, d.time, c.x, c.z) || !escapando(d, c) ? 0 : FALTAS.tatica.semSPA;
  if (!(p > 0) || uniforme(m.rng) >= p) return null;
  return montarFalta(m, d, c, spa ? 'tatica' : 'segurar', false);
}

/**
 * O condutor `c` está escapando do defensor `d` (que ficou para trás)? Ele se afasta de d a ≥ FALTAS.tatica.escapa m/s e d
 * não ganha terreno (aproximação ≤ FALTAS.tatica.ganhando m/s: quem está alcançando dá o bote, não segura).
 */
function escapando(d, c) {
  const rx = c.x - d.x, rz = c.z - d.z, l = MD.hypot(rx, rz) || 1;
  const nx = rx / l, nz = rz / l;
  const foge = c.vx * nx + c.vz * nz;
  const fecha = (d.vx - c.vx) * nx + (d.vz - c.vz) * nz;
  return foge >= FALTAS.tatica.escapa && fecha <= FALTAS.tatica.ganhando;
}

/**
 * Carga por trás (sim.js colisaoCorpos): `a` e `b` se tocaram fechando a `rv` m/s (> 0). Se um deles é o condutor e o
 * outro um adversário chegando por trás a ≥ FALTAS.carga.vMin, sorteia a falta. Só na partida.
 */
export function faltaNaCarga(m, a, b, rv) {
  if (!m.partida || m.posse == null || rv < FALTAS.carga.vMin) return null;
  let c = null, d = null;
  if (a.id === m.posse) { c = a; d = b; } else if (b.id === m.posse) { c = b; d = a; }
  if (!c || d.time === c.time || d.posicao === 'GOL') return null;
  if (chegada(d, c) !== 'tras') return null;
  // quem fez a carga é quem ENTROU: com o condutor travando na frente de quem vinha atrás devagar, a aproximação é dele
  // (forcaContato: a velocidade do defensor para dentro do condutor, limitada pela aproximação)
  if (forcaContato(m, d, c) < FALTAS.carga.vMin) return null;
  // quem acabou de perder a bola (tocou nela há menos de FALTAS.carga.perdeu s) e segue a corrida no defensor que a tirou
  // não deu carga: é o embalo da condução (o bote limpo não vira falta de quem perdeu a bola)
  const ult = d.cond?.ult;
  if (ult && (m.tick - ult.tick) * PASSO < FALTAS.carga.perdeu) return null;
  // na chance clara de gol quem volta evita o contato (seria vermelho): a carga vira falta bem menos
  const p = FALTAS.carga.chance * (chanceClara(m, c, d) ? FALTAS.carga.naChanceClara : 1);
  if (uniforme(m.rng) >= p) return null;
  return montarFalta(m, d, c, 'carga', false);
}

export { porId };
