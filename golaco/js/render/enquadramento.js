// O enquadramento da câmera de TV, PURO (sem three nem DOM; fora do fecho do hash): o perfil das câmeras de jogo (TV,
// aproximada, celular deitado, retrato), a geometria da TV (a lente em (fx, H, fz + D) olhando (fx, oy, fz), yaw −π/2) com
// a projeção em conta fechada, e o FOCO — o de hoje (alvoLegado/molaLegada: a aproximada, o retrato, a transição e o plano
// 'fechada' do replay) e o da TV nova do item 66 (pedido do dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a
// área completamente ... afastar muito pouco mais e centralizar mais"; contrato "Câmera de TV (item 66)" no CONTRATOS.md,
// pesquisa em PESQUISA-ESTADIO.md §18). render/camera.js aplica no three; os testes em Node (teste-camera) usam as MESMAS
// funções.
import { CAMERA, CAMPO } from '../config.js';

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }

/** Mola crítica exata (a mesma de util.js molaCritica), escrevendo no estado: sem alocar. */
export function mola(est, kx, kv, alvo, w, dt) {
  const y = est[kx] - alvo;
  const j1 = est[kv] + y * w;
  const e = Math.exp(-w * dt);
  est[kx] = alvo + (y + j1 * dt) * e;
  est[kv] = (est[kv] - j1 * w * dt) * e;
}

// ------------------------------------------------------------------------------------------------ os perfis
export const ASPECTO_TV = 16 / 9;
export const PERFIS_CAMERA = {
  tv: {
    largura: CAMERA.largura, distancia: CAMERA.distancia, altura: CAMERA.altura,
    pesoBola: 0.45, antecipa: 0.55, anteVoo: 0.42, limX: CAMPO.meioX - 14, limZ0: -CAMPO.meioZ + 12, limZ1: CAMPO.meioZ - 11, olharY: 0,
  },
  aproximada: {
    largura: CAMERA.aproximada.largura, distancia: CAMERA.aproximada.distancia, altura: CAMERA.aproximada.altura,
    pesoBola: 0.3, antecipa: 0.35, anteVoo: 0.3, limX: CAMPO.meioX - 3, limZ0: -CAMPO.meioZ + 3, limZ1: CAMPO.meioZ - 2, olharY: 0.6,
  },
};
// celular deitado: a TV mais baixa e mais longe (a torcida no alto do quadro); a mesma largura vista no foco
export const TV_CELULAR = { ...PERFIS_CAMERA.tv, ...CAMERA.celular };
// celular em pé: mesmos pesos, câmera mais alta/inclinada e limites que deixam chegar às linhas
export const RETRATO = {
  tv: { ...PERFIS_CAMERA.tv, ...CAMERA.retrato, limX: CAMPO.meioX - 8, limZ0: -CAMPO.meioZ + 6, limZ1: CAMPO.meioZ - 6 },
  aproximada: { ...PERFIS_CAMERA.aproximada, ...CAMERA.retratoAproximada },
};
const CHAVES = Object.keys(PERFIS_CAMERA.tv);

/** O perfil da câmera de jogo (em `out`): TV ↔ aproximada pela mistura; paisagem ↔ retrato pelo formato (1,25 → 0,75). */
export function perfilCamera(out, mistura, aspecto, pequena) {
  const s = suave(mistura);
  const r = suave((1.25 - aspecto) / 0.5);
  const tv = pequena ? TV_CELULAR : PERFIS_CAMERA.tv;
  for (const k of CHAVES) {
    const pais = lerp(tv[k], PERFIS_CAMERA.aproximada[k], s);
    const ret = lerp(RETRATO.tv[k], RETRATO.aproximada[k], s);
    out[k] = lerp(pais, ret, r);
  }
  out.retrato = r;
  return out;
}
/** fov vertical (graus) que mostra a largura do perfil no foco, para o formato desta tela. */
export function fovPara(p, aspecto, pequena) {
  const a = aspecto;
  let larg = p.largura;
  // paisagem mais estreita que 16:9 (4:3) perde só metade da largura; o retrato já tem a sua
  if (a < ASPECTO_TV) larg *= lerp(Math.sqrt(Math.max(a, 1.25) / ASPECTO_TV), 1, p.retrato);
  if (pequena) larg *= CAMERA.telaPequena;
  const d = Math.hypot(p.distancia, p.altura - p.olharY);
  return (2 * Math.atan(larg / 2 / d / a) * 180) / Math.PI;
}
/** A largura vista no foco (m) com o perfil p: a do perfil, × telaPequena no celular. */
export function larguraVista(p, pequena) { return p.largura * (pequena ? CAMERA.telaPequena : 1); }

// ------------------------------------------------------------------------------------------------ a geometria da TV
/**
 * A pose da TV com o perfil p (em `g`): a lente em (fx, H, fz + D) olhando (fx, oy, fz), yaw −π/2, o fov do fovPara.
 * g = {H, D, oy, h = H − oy, n = |(D, h)|, tanV = tan(fov/2), asp, fov}.
 */
export function geometriaTV(g, p, aspecto, pequena) {
  g.H = p.altura; g.D = p.distancia; g.oy = p.olharY; g.h = g.H - g.oy; g.n = Math.hypot(g.h, g.D);
  g.fov = fovPara(p, aspecto, pequena); g.tanV = Math.tan((g.fov * Math.PI) / 360); g.asp = aspecto;
  return g;
}
/** Profundidade (ao longo do olhar) de um ponto na altura y a s = z − fz do foco. */
function profundidade(g, y, s) { return (g.D * g.D + g.h * (g.H - y) - s * g.D) / g.n; }
/**
 * NDC do ponto (x, y, z) na TV com o foco (fx, fz) — a conta fechada da projeção perspectiva (a mesma do `project` do three
 * para esta pose): out = {x, y, c (profundidade, m), ok (c > 0,5: na frente da lente)}.
 */
export function projetarTV(g, fx, fz, x, y, z, out) {
  const s = z - fz, c = profundidade(g, y, s);
  out.x = (x - fx) / (c * g.tanV * g.asp);
  out.y = ((y - g.oy) * g.D - g.h * s) / (g.n * c * g.tanV);
  out.c = c; out.ok = c > 0.5;
  return out;
}
/**
 * s (= z − fz) que põe um ponto da altura y (abaixo da lente) em NDC y = Y (NDC y cai quando s cresce: perto = embaixo, longe
 * = o horizonte, h/(D·tanV)). Com Y no horizonte ou acima dele (a TV baixa e longe do Livre) a linha Y da tela não desce até
 * essa altura: todo ponto fica abaixo dela — −∞ (o intervalo de fz sem teto).
 */
function sDeY(g, y, Y) {
  const den = Y * g.tanV * g.D - g.h;
  if (den >= 0) return -Infinity;
  const K = g.D * g.D + g.h * (g.H - y);
  return (Y * g.tanV * K - (y - g.oy) * g.D) / den;
}
/** Intervalo de fz que põe o ponto (y, z) com NDC y em [lo, hi]. */
function intervaloFz(g, y, z, lo, hi, out) { out.min = z - sDeY(g, y, lo); out.max = z - sDeY(g, y, hi); return out; }
/** Intervalo de fx (com o fz dado) que põe o ponto (x, y, z) com |NDC x| ≤ X. */
function intervaloFx(g, fz, x, y, z, X, out) { const w = X * profundidade(g, y, z - fz) * g.tanV * g.asp; out.min = x - w; out.max = x + w; return out; }
/** A pose da TV com o foco (fx, fz): {de, para, fov} (o que camera.js aplica no three e os testes em Node usam). */
export function poseTV(p, fx, fz, aspecto, pequena, out) {
  out.de ??= [0, 0, 0]; out.para ??= [0, 0, 0];
  out.de[0] = fx; out.de[1] = p.altura; out.de[2] = fz + p.distancia;
  out.para[0] = fx; out.para[1] = p.olharY; out.para[2] = fz;
  out.fov = fovPara(p, aspecto, pequena);
  return out;
}

// ------------------------------------------------------------------------------------------------ o foco de HOJE (legado)
/**
 * O alvo do foco de hoje (render/camera.js da 79bbfbc2, atualizar, antes do efeito do gol e dos limites): entre o
 * controlado e o ponto da bola (no ar, parte do caminho até a queda), com a antecipação pela velocidade do controlado; a
 * bola (de verdade) nunca sai do quadro. Escreve em out {x, z}.
 */
export function alvoLegado(alvo, p, out) {
  // ponto da bola: no ar, antecipa a queda (parte do caminho até o alvo)
  let px = alvo.bx, pz = alvo.bz;
  if (Number.isFinite(alvo.ax) && Number.isFinite(alvo.az)) {
    px += (alvo.ax - alvo.bx) * p.anteVoo;
    pz += (alvo.az - alvo.bz) * p.anteVoo;
  }
  // foco: entre jogador e bola. Perto, a bola pesa pesoBola; um pouco longe (passe da
  // máquina chegando) pesa menos; muito longe, a bola manda (o foco fica a ≤ R dela)
  const dbx = px - alvo.jx, dbz = pz - alvo.jz;
  const db = Math.hypot(dbx, dbz);
  const R = p.largura * 0.31;
  const w = db > 12 ? Math.max(p.pesoBola * 12 / db, 1 - R / db) : p.pesoBola;
  let fx = alvo.jx + dbx * w + alvo.jvx * p.antecipa;
  let fz = alvo.jz + dbz * w + alvo.jvz * p.antecipa;
  // a bola (de verdade) nunca sai do quadro: na profundidade se vê menos que na largura
  const mx = p.largura * 0.38, mz = p.largura * 0.24;
  fx = clamp(fx, alvo.bx - mx, alvo.bx + mx);
  fz = clamp(fz, alvo.bz - mz, alvo.bz + mz);
  out.x = fx; out.z = fz;
  return out;
}
/** A mola de hoje: crítica, CAMERA.rigidez em x e × 0,8 em z (no corte o foco vai direto: quem chama). */
export function molaLegada(est, fx, fz, dt) {
  const wr = CAMERA.rigidez;
  mola(est, 'x', 'vx', fx, wr, dt);
  mola(est, 'z', 'vz', fz, wr * 0.8, dt);
}


// ------------------------------------------------------------------------------------------------ a TV nova (item 66)
// Pesquisa e fontes em PESQUISA-ESTADIO.md §18: o foco segue a BOLA (Chen & Carr 2015; Chen 2016), com a previsão do caso
// (no voo, o ponto onde a bola estará — o "projected focus" de Keren, GDC 2015; Kato 1996), o espaço à frente com histerese
// ("dual forward focus" de Keren; Schmitt em Carr 2013), a zona morta ("camera-window"; Cinemachine Dead Zone), a área
// inteira no último terço ("zoom-to-fit"; Chen & Carr 2014), a bola com prioridade por limites na tela (Nesky, GDC 2014,
// #40 e #47; Cinemachine Hard Limits) e a mola com a velocidade do alvo (Cinemachine Lookahead Smoothing; Kato: correção
// em ~0,3 s e aceleração do pan ≤ ~200°/s²).
export const ENQUADRAMENTO = {
  pesoBola: 0.75,            // o ponto da bola P pesa 75%: o controlado puxa no máximo 25% …
  raio: 0.22,                // … e nunca leva o foco a mais de raio × W (a largura vista no foco) de P
  meioCondutor: 0.5,         // bola no pé: o condutor + esta fração do caminho até a bola (o corpo não oscila entre os toques)
  anteBola: 0.3, anteMax: 6, // s e m: a antecipação pela velocidade (do condutor; da bola solta)
  anteVoo: 0.5,              // s: no voo, onde a bola estará daqui a anteVoo s na reta até a queda (para nela)
  filtroVel: 0.15,           // s: passa-baixa exponencial das velocidades (exato para qualquer dt)
  frente: 0.07,              // × W: o espaço à frente, na direção do ataque de quem tem a bola …
  frenteDe: 25, frenteAte: 45, // … que some entre 45 e 25 m da linha de fundo atacada (no último terço a TV centra a bola)
  frenteVel: 6,              // m/s: quanto o espaço à frente anda (uma virada leva ~1 s, nada de tranco a cada roubada)
  histerese: 0.5,            // s seguidos com o outro lado para o espaço à frente virar
  zonaMorta: 2.0,            // m, em x e em z, separados: o foco desejado só anda quando sai disso (antes da área)
  area: { de: 32, ate: 18, limX: 44.5, margem: 0.94 }, // m da linha de fundo: a área e o alto das traves no quadro (|NDC| ≤ margem)
  bola: { x: 0.78, baixo: -0.62, cima: 0.8 },          // NDC: a bola dentro disto no ALVO (embaixo ficam os botões)
  bolaDuro: { x: 0.86, baixo: -0.72, cima: 0.86, tempo: 0.25 }, // NDC: na saída da mola, pela velocidade (volta em `tempo` s)
  bolaCampo: { x: 53.5, z: 35 }, // m: nas contas, a bola presa às linhas (atrás do gol, dentro da rede, na placa)
  profMin: 5,                // m: com a bola a menos disto da lente (profundidade), o limite da bola não vale no quadro
  bolaAlta: 18,              // m: além do limite do campo do lado de lá (limZ0), só para a bola ALTA do lado de lá não sair
                             // por cima (a câmera não inclina — anda — e volta quando a bola desce). A altura que entra na
                             // conta é no máximo a que cabe com o chão debaixo dela (alturaQueCabe): o chão nunca sai do
                             // quadro (revisão R1; antes o chutão de 13 m levava o foco a −40 e o chão saía)
  salto: 6,                  // m num quadro: a bola teletransportada (montagem sem evento de corte) = corte
  omega: 4.5,                // 1/s: a mola crítica, em x e em z (hoje 3,2 e 2,56)
  avanco: 0.5,               // a mola segue o alvo andando com esta fração da velocidade dele (o atraso cai de 0,62 para 0,22 s × v)
  filtroAlvo: 0.12,          // s: a velocidade do alvo filtrada (filtrar atrasa: só a velocidade)
  saltoAlvo: 3,              // m num quadro: o alvo que salta (troca de controlado, entrada da área) vira mola sem tranco
  acelMax: 150,              // m/s² na soma dos eixos (~175°/s² a 49 m da lente)
  velMax: 36,                // m/s: o foco nunca anda mais que isto (≤ 1,2 m por quadro a 30 qps; o chute mais forte ~35 m/s)
  paradaPerto: 35,           // m da linha atacada: o tiro livre perto (a bola, a área e o gol no quadro, sem espaço à frente)
  // o controlado TRAVADO (Rumo ao Estrelato no ?tm: só o meu jogador, sem troca — alvo.jCaixa; revisão R2): os pés e a cabeça
  // dentro desta caixa no ALVO quando cabem junto com a bola (prioridade menor: senão, só a bola). Com a troca automática o
  // controlado é quase sempre quem está perto da bola e não precisa dela
  jogador: { x: 0.85, baixo: -0.8, cima: 0.85, altura: 1.8 },
};
const Q = ENQUADRAMENTO;
const MX = CAMPO.meioX, AP = CAMPO.area.profundidade, AL = CAMPO.area.largura / 2, GL = CAMPO.gol.largura / 2, GA = CAMPO.gol.altura;
const PASSO = 1 / 60;
const RAIO_BOLA = 0.11;

/** O estado da TV nova (um por câmera). */
export function criarEnquadramento() {
  return {
    ok: false, cortou: false,
    bvx: 0, bvz: 0, cvx: 0, cvz: 0,                   // as velocidades filtradas (bola; condutor)
    dir: 0, dirPend: 0, trocaT: 0, frente: 0,         // o lado do ataque com histerese e o espaço à frente (m)
    zx: 0, zz: 0,                                     // o foco desejado depois da zona morta
    rx: 0, rz: 0, rvx: 0, rvz: 0,                     // o alvo da mola e a velocidade dele (filtrada)
    bx0: NaN, bz0: NaN,                               // a bola no quadro anterior (o salto = corte)
    wA: 0, limX: CAMPO.meioX - 14, limZ0: -22, limZ1: 23, parada: false, duro: false,
  };
}

function jogadorDe(m, id) {
  if (id == null) return null;
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}
/**
 * Os campos novos do alvo da câmera (a MESMA no main.js e no teste-camera): a bola desenhada (bx, by, bz) e a velocidade
 * dela (bvx, bvz), a queda do voo em andamento (ax, az) e o tempo até ela (tRest), o condutor (cx, cz: a posição DESENHADA
 * por posDe(id) → {x, z} | null; cvx, cvz) — m.posse sem a bola nas mãos —, dir (±1: o ataque de quem tem a bola, pela
 * posse → voo.time → ultimoToque.time; 0 sem ninguém) e parada ({tipo, x, z, dir} enquanto a bola parada não rolou).
 * jx, jz, jvx, jvz (o controlado) ficam com quem chama.
 */
export function preencherAlvo(alvo, m, posDe, bola) {
  alvo.bx = bola.x; alvo.by = Number.isFinite(bola.y) ? bola.y : RAIO_BOLA; alvo.bz = bola.z;
  const v = m.bola?.v;
  alvo.bvx = v ? v.x : 0; alvo.bvy = v ? v.y : 0; alvo.bvz = v ? v.z : 0;
  const voo = m.voo;
  const vooAtivo = !!(voo && voo.alvo && Number.isFinite(voo.alvo.x) && (voo.tickChegada == null || m.tick <= voo.tickChegada));
  alvo.ax = vooAtivo ? voo.alvo.x : NaN; alvo.az = vooAtivo ? voo.alvo.z : NaN;
  alvo.tRest = vooAtivo && voo.tickChegada != null ? Math.max(0, voo.tickChegada - m.tick) * PASSO : 0;
  const dono = jogadorDe(m, m.posse);
  const c = dono && m.naMao == null ? dono : null;
  if (c) {
    const d = posDe ? posDe(c.id) : null;
    alvo.cx = d ? d.x : c.x; alvo.cz = d ? d.z : c.z; alvo.cvx = c.vx || 0; alvo.cvz = c.vz || 0;
  } else { alvo.cx = NaN; alvo.cz = NaN; alvo.cvx = 0; alvo.cvz = 0; }
  const tm = dono ? dono.time : (voo?.time ?? m.ultimoToque?.time ?? null);
  alvo.dir = tm != null && m.ataca ? (m.ataca[tm] || 0) : 0;
  const pr = m.parada;
  if (pr && !pr.rolou && m.partida) {
    const P = alvo.parada ?? (alvo.parada = { tipo: null, x: 0, z: 0, dir: 0 });
    P.tipo = pr.tipo; P.x = pr.x; P.z = pr.z; P.dir = m.ataca ? (m.ataca[pr.time] || 0) : 0;
    alvo.temParada = true;
  } else alvo.temParada = false;
  return alvo;
}

const _i = { min: 0, max: 0, y: 0 }, _j = { min: 0, max: 0 }, _l = { x: 0, z: 0 }, _r = { x: 0, z: 0 };
// os pontos da área que têm de caber: os 4 cantos da grande área e o alto das 2 traves (u = da linha de fundo para dentro)
const PONTOS_AREA = [[0, 0, AL], [AP, 0, AL], [0, 0, -AL], [AP, 0, -AL], [0, GA, GL], [0, GA, -GL]];
/** A bola, presa às linhas para as contas (atrás do gol, na rede, além da lateral). */
function bolaNasLinhas(a, out) {
  out.x = clamp(a.bx, -Q.bolaCampo.x, Q.bolaCampo.x); out.z = clamp(a.bz, -Q.bolaCampo.z, Q.bolaCampo.z);
  out.y = Math.max(RAIO_BOLA, Number.isFinite(a.by) ? a.by : RAIO_BOLA);
  return out;
}
const _b = { x: 0, y: 0, z: 0 }, _c = { min: 0, max: 0 };
/**
 * A altura mais alta em que a bola ainda cabe na caixa B (NDC y ≤ B.cima) com o CHÃO debaixo dela também dentro (NDC y ≥
 * B.baixo) — a conta fechada, que não depende de z (revisão R1). A TV não inclina, anda: acima disto não há foco que mostre
 * os dois. O limite da bola usa no máximo esta altura: o chão (onde estão os jogadores e onde ela cai) fica no quadro e a bola
 * sai por cima até descer — antes a TV andava até 37 m para a frente atrás dela, o chão saía e a bola continuava fora. TV do
 * celular (15°): 9,5 m com a caixa do alvo, 10,0 com a dura; PC (24,6°): 13,6 e 14,4 m. Com a linha de cima da caixa no
 * horizonte ou acima dele (a TV baixa e longe do Livre), 1 m abaixo da lente.
 */
export function alturaQueCabe(g, B) {
  const t = B.cima * g.tanV, den = t * g.D - g.h;
  if (den >= 0) return g.H - 1;
  const s0 = sDeY(g, 0, B.baixo);
  return Math.min(g.H - 1, (t * (g.D * g.D + g.h * g.H) + g.oy * g.D - s0 * den) / (t * g.h + g.D));
}
/**
 * O intervalo de fz que põe a bola (y, z) — na altura que cabe — dentro da caixa B: o teto pela bola, o piso pelo chão
 * debaixo dela (o ponto mais baixo dos dois na tela). Devolve em out a altura usada (out.y).
 */
function intervaloBola(g, y, z, B, out) {
  const yc = Math.min(y, alturaQueCabe(g, B));
  intervaloFz(g, yc, z, B.baixo, B.cima, out);
  intervaloFz(g, 0, z, B.baixo, B.cima, _c);
  if (_c.min > out.min) out.min = _c.min;
  if (_c.max < out.max) out.max = _c.max;
  if (out.min > out.max) out.min = out.max = 0.5 * (out.min + out.max); // (só o arredondamento: a altura que cabe garante)
  out.y = yc;
  return out;
}
/**
 * O foco mais perto de (fx, fz) que põe a bola (bx, by, bz) dentro da caixa B (NDC) — a bola acima da altura que cabe, por
 * ela (alturaQueCabe), e o chão debaixo dela também dentro —; a bola perto da lente: não mexe. j = {x, z} (opcional): o
 * jogador travado com os pés e a cabeça na caixa Q.jogador, quando cabe junto com a bola (em z e depois em x; senão só a bola).
 */
export function limitarBola(g, bx, by, bz, B, fx, fz, out, j = null) {
  intervaloBola(g, by, bz, B, _i);
  const y = _i.y;
  let zlo = _i.min, zhi = _i.max;
  const J = Q.jogador;
  if (j) {
    // os pés no piso e a cabeça no teto (a cabeça sobe na tela com o foco andando para lá antes dos pés: o mais baixo e o
    // mais alto dos dois)
    intervaloFz(g, 0, j.z, J.baixo, J.cima, _c); const lo = Math.max(zlo, _c.min);
    intervaloFz(g, J.altura, j.z, J.baixo, J.cima, _c); const hi = Math.min(zhi, _c.max);
    if (lo <= hi) { zlo = lo; zhi = hi; }
  }
  const fz2 = clamp(fz, zlo, zhi);
  if (!(profundidade(g, y, bz - fz2) >= Q.profMin)) { out.x = fx; out.z = fz; return out; }
  intervaloFx(g, fz2, bx, y, bz, B.x, _j);
  let xlo = _j.min, xhi = _j.max;
  if (j && profundidade(g, J.altura, j.z - fz2) >= Q.profMin) {
    // (a cabeça, mais perto da lente que os pés, dá o intervalo mais estreito)
    intervaloFx(g, fz2, j.x, J.altura, j.z, J.x, _j);
    const lo = Math.max(xlo, _j.min), hi = Math.min(xhi, _j.max);
    if (lo <= hi) { xlo = lo; xhi = hi; }
  }
  out.x = clamp(fx, xlo, xhi); out.z = fz2;
  return out;
}
const _jt = { x: 0, z: 0 };
/** A bola parada que a TV enquadra com a área: o escanteio e o tiro livre a ≤ paradaPerto m da linha atacada. */
function paradaComArea(a) {
  const pr = a.temParada ? a.parada : null;
  if (!pr) return false;
  if (pr.tipo === 'escanteio') return true;
  return pr.tipo === 'tiroLivre' && !!pr.dir && MX - pr.x * pr.dir <= Q.paradaPerto;
}

/**
 * O alvo do foco (fx, fz) da TV neste quadro, em out. a = o alvo (preencherAlvo + jx, jz); g = geometriaTV; W = a largura
 * vista no foco; p = o perfil (os limites do campo). corte = reposiciona (zera os filtros). Guarda em E o peso da área (wA),
 * o lado do ataque e os limites do quadro.
 */
export function alvoTV(E, a, g, W, p, dt, corte, out) {
  const reinicia = corte || !E.ok;
  const k = reinicia ? 1 : 1 - Math.exp(-Math.max(0, dt) / Q.filtroVel);
  E.bvx += ((a.bvx || 0) - E.bvx) * k; E.bvz += ((a.bvz || 0) - E.bvz) * k;
  const b = bolaNasLinhas(a, _b);
  const parada = paradaComArea(a);
  // 1) o ponto da bola P: a previsão certa para cada caso
  let px = b.x, pz = b.z;
  if (parada) { /* a bola parada: P = a bola */ }
  else if (Number.isFinite(a.ax) && Number.isFinite(a.az)) {
    // no voo: onde a bola estará daqui a anteVoo s, na reta até a queda (com ≤ anteVoo s faltando, a queda)
    const tr = Math.max(0, a.tRest || 0), f = tr > 1e-3 ? Math.min(1, Q.anteVoo / tr) : 1;
    px += (clamp(a.ax, -Q.bolaCampo.x, Q.bolaCampo.x) - b.x) * f; pz += (clamp(a.az, -Q.bolaCampo.z, Q.bolaCampo.z) - b.z) * f;
  } else if (Number.isFinite(a.cx)) {
    // bola no pé: o condutor (o corpo não oscila como a bola entre os toques) + metade do caminho até ela, adiantado
    // pela velocidade DELE (filtrada)
    E.cvx += ((a.cvx || 0) - E.cvx) * k; E.cvz += ((a.cvz || 0) - E.cvz) * k;
    px = a.cx + (b.x - a.cx) * Q.meioCondutor; pz = a.cz + (b.z - a.cz) * Q.meioCondutor;
    let ex = E.cvx * Q.anteBola, ez = E.cvz * Q.anteBola; const l = Math.hypot(ex, ez);
    if (l > Q.anteMax) { ex *= Q.anteMax / l; ez *= Q.anteMax / l; }
    px += ex; pz += ez;
  } else {
    // bola solta: pela velocidade dela (filtrada)
    let ex = E.bvx * Q.anteBola, ez = E.bvz * Q.anteBola; const l = Math.hypot(ex, ez);
    if (l > Q.anteMax) { ex *= Q.anteMax / l; ez *= Q.anteMax / l; }
    px += ex; pz += ez;
  }
  // 2) o lado do ataque com histerese e o espaço à frente (some no último terço e na bola parada com a área)
  const d = a.dir || 0;
  if (reinicia) { E.dir = d; E.dirPend = d; E.trocaT = 0; }
  else if (d !== E.dir) {
    if (d === E.dirPend) E.trocaT += dt; else { E.dirPend = d; E.trocaT = dt; }
    if (E.trocaT >= Q.histerese) { E.dir = d; E.trocaT = 0; }
  } else { E.dirPend = d; E.trocaT = 0; }
  const dA = E.dir ? MX - px * E.dir : 99;
  const frenteAlvo = parada ? 0 : E.dir * Q.frente * W * suave((dA - Q.frenteDe) / (Q.frenteAte - Q.frenteDe));
  if (reinicia) E.frente = frenteAlvo;
  else { const pp = Q.frenteVel * Math.max(0, dt); E.frente += clamp(frenteAlvo - E.frente, -pp, pp); }
  // 3) o foco desejado: P com o espaço à frente e um pouco do controlado (≤ 25%, nunca a mais de raio × W de P)
  let fx = px + E.frente, fz = pz;
  if (!parada && Number.isFinite(a.jx)) {
    const jx = a.jx - px, jz = a.jz - pz, dj = Math.hypot(jx, jz);
    if (dj > 1e-6) { const w = Math.min(1 - Q.pesoBola, (Q.raio * W) / dj); fx += jx * w; fz += jz * w; }
  }
  // 4) a zona morta: o foco desejado só anda quando sai de ±zonaMorta m do seguido (não caça cada toque)
  if (reinicia) { E.zx = fx; E.zz = fz; }
  else {
    const ZM = Q.zonaMorta;
    if (fx > E.zx + ZM) E.zx = fx - ZM; else if (fx < E.zx - ZM) E.zx = fx + ZM;
    if (fz > E.zz + ZM) E.zz = fz - ZM; else if (fz < E.zz - ZM) E.zz = fz + ZM;
  }
  fx = E.zx; fz = E.zz;
  // 5) a área e o gol inteiros: do lado do gol mais perto de P, de `de` a `ate` m da linha de fundo (a conta fechada)
  const sg = (parada ? b.x : px) >= 0 ? 1 : -1, gx = sg * MX, dl = MX - Math.abs(px);
  const wA = parada ? 1 : suave((Q.area.de - dl) / (Q.area.de - Q.area.ate));
  if (wA > 0) {
    const M = Q.area.margem;
    let zmin = -1e9, zmax = 1e9;
    for (const [u, y, z] of PONTOS_AREA) { intervaloFz(g, y, z, -M, M, _i); if (_i.min > zmin) zmin = _i.min; if (_i.max < zmax) zmax = _i.max; }
    const fzA = zmin <= zmax ? clamp(fz, zmin, zmax) : 0.5 * (zmin + zmax);
    let xmin = -1e9, xmax = 1e9;
    for (const [u, y, z] of PONTOS_AREA) { intervaloFx(g, fzA, gx - sg * u, y, z, M, _j); if (_j.min > xmin) xmin = _j.min; if (_j.max < xmax) xmax = _j.max; }
    const fxA = xmin <= xmax ? clamp(fx, xmin, xmax) : 0.5 * (xmin + xmax);
    fx += (fxA - fx) * wA; fz += (fzA - fz) * wA;
  }
  // 6) os limites do campo (o x vai mais longe perto do gol)
  E.limX = p.limX + (Q.area.limX - p.limX) * wA; E.limZ0 = p.limZ0; E.limZ1 = p.limZ1;
  fx = clamp(fx, -E.limX, E.limX); fz = clamp(fz, E.limZ0, E.limZ1);
  // 7) a bola (de verdade) dentro do limite do alvo — prioridade —, e o foco sempre dentro dos limites do campo
  // (só a bola ALTA leva o foco além do limite do lado de lá, até bolaAlta m: limiteDuro; a bola que SOBE entra pela
  // altura que terá em até anteVoo s — a câmera sai antes, sem chicotear atrás dela —, no máximo a que cabe com o chão
  // debaixo dela no quadro: acima disto a bola sai por cima e o chão fica — limitarBola/alturaQueCabe)
  // (o controlado travado do Rumo ao Estrelato, com prioridade menor: os pés e a cabeça no quadro quando cabem com a bola)
  const vy = Number.isFinite(a.bvy) ? a.bvy : 0, tSobe = clamp(vy / 9.81, 0, Q.anteVoo);
  const jt = a.jCaixa && !parada && Number.isFinite(a.jx) ? _jt : null;
  if (jt) { jt.x = a.jx; jt.z = a.jz; }
  limitarBola(g, b.x, b.y + Math.max(0, vy * tSobe - 4.905 * tSobe * tSobe), b.z, Q.bola, fx, fz, _l, jt);
  out.x = clamp(_l.x, -E.limX, E.limX); out.z = clamp(_l.z, E.limZ0 - Q.bolaAlta, E.limZ1);
  E.wA = wA; E.parada = parada;
  return out;
}

/**
 * A mola crítica com avanço: o erro medido contra o alvo andando com `avanco` × a velocidade dele (filtrada; o alvo que
 * salta > saltoAlvo m num quadro não tem velocidade) — solução exata para qualquer dt. No corte, o foco vai direto; na volta
 * do legado (E.ok falso, sem corte), parte do estado atual, sem salto.
 */
export function passoMola(E, est, rx, rz, dt, corte) {
  if (corte) {
    est.x = rx; est.z = rz; est.vx = 0; est.vz = 0;
    E.rx = rx; E.rz = rz; E.rvx = 0; E.rvz = 0; E.ok = true;
    return;
  }
  if (!(dt > 0)) return;
  if (!E.ok) { E.rvx = 0; E.rvz = 0; }
  else {
    let vx = (rx - E.rx) / dt, vz = (rz - E.rz) / dt;
    if (Math.hypot(rx - E.rx, rz - E.rz) > Q.saltoAlvo) { vx = 0; vz = 0; }
    const k = 1 - Math.exp(-dt / Q.filtroAlvo);
    E.rvx += (vx - E.rvx) * k; E.rvz += (vz - E.rvz) * k;
  }
  E.rx = rx; E.rz = rz; E.ok = true;
  const w = Q.omega, ex = Math.exp(-w * dt);
  // x
  let u = E.rvx * Q.avanco, e = est.x - (rx - u * dt), ev = est.vx - u, j1 = ev + e * w;
  est.x = rx + (e + j1 * dt) * ex; est.vx = u + (ev - j1 * w * dt) * ex;
  // z
  u = E.rvz * Q.avanco; e = est.z - (rz - u * dt); ev = est.vz - u; j1 = ev + e * w;
  est.z = rz + (e + j1 * dt) * ex; est.vz = u + (ev - j1 * w * dt) * ex;
}

/**
 * Na saída da mola: a bola (de verdade) dentro de bolaDuro e o foco dentro dos limites do campo — pela VELOCIDADE, nunca
 * movendo a posição direto (o "Hard Limit" do Cinemachine; Nesky #40 e #47: frear suave nos limites). Fora do limite, a
 * velocidade do foco no eixo passa a ser no mínimo a do próprio limite (ele anda com a bola) mais a que o traz de volta em
 * `tempo` s — um piso, sem acumular de um quadro para o outro. Depois, o teto de aceleração na soma dos eixos e a freada
 * antes da caixa do campo (a velocidade que para nela com a aceleração do teto). vx0/vz0 = a velocidade antes da mola.
 */
export function limiteDuro(E, est, a, g, dt, vx0, vz0, px0 = NaN, pz0 = NaN) {
  if (!(dt > 0)) return;
  const B = Q.bolaDuro, b = bolaNasLinhas(a, _b);
  const x1 = est.x, z1 = est.z, vx1 = est.vx, vz1 = est.vz;
  // os limites deste quadro (o intervalo do foco que põe a bola — na altura que cabe — e o chão debaixo dela na caixa B, preso
  // aos limites do campo) e a velocidade deles
  intervaloBola(g, b.y, b.z, B, _i);
  const yB = _i.y, zMin = E.limZ0 - Q.bolaAlta;
  let z0 = clamp(_i.min, zMin, E.limZ1), zz1 = clamp(_i.max, zMin, E.limZ1);
  const zc = clamp(z1, z0, zz1);
  const valido = profundidade(g, yB, b.z - zc) >= Q.profMin;
  intervaloFx(g, zc, b.x, yB, b.z, B.x, _j);
  let x0 = clamp(_j.min, -E.limX, E.limX), xx1 = clamp(_j.max, -E.limX, E.limX);
  if (!valido) { x0 = -E.limX; xx1 = E.limX; z0 = zMin; zz1 = E.limZ1; }
  const L = E.lim ?? (E.lim = { ok: false, x0: 0, x1: 0, z0: 0, z1: 0 });
  const vl = (v, v0) => (L.ok ? (v - v0) / dt : 0);
  const vX0 = vl(x0, L.x0), vX1 = vl(xx1, L.x1), vZ0 = vl(z0, L.z0), vZ1 = vl(zz1, L.z1);
  L.x0 = x0; L.x1 = xx1; L.z0 = z0; L.z1 = zz1; L.ok = true;
  let vdx = vx1, vdz = vz1;
  E.duro = false;
  if (x1 < x0) { vdx = Math.max(vdx, vX0 + (x0 - x1) / B.tempo); E.duro = true; }
  else if (x1 > xx1) { vdx = Math.min(vdx, vX1 + (xx1 - x1) / B.tempo); E.duro = true; }
  if (z1 < z0) { vdz = Math.max(vdz, vZ0 + (z0 - z1) / B.tempo); E.duro = true; }
  else if (z1 > zz1) { vdz = Math.min(vdz, vZ1 + (zz1 - z1) / B.tempo); E.duro = true; }
  // o teto de aceleração (a mola e a correção juntas)
  const ax = (vdx - vx0) / dt, az = (vdz - vz0) / dt, am = Math.hypot(ax, az);
  if (am > Q.acelMax) { const f = Q.acelMax / am; vdx = vx0 + ax * f * dt; vdz = vz0 + az * f * dt; }
  // a freada antes da caixa do campo (|x| ≤ area.limX, limZ0..limZ1): a velocidade com que ainda se para nela
  const A = Q.acelMax, LX = Q.area.limX;
  const freia = (v, d) => Math.sqrt(2 * A * Math.max(0, d));
  if (vdx > 0) vdx = Math.min(vdx, freia(vdx, LX - x1)); else if (vdx < 0) vdx = Math.max(vdx, -freia(-vdx, x1 + LX));
  if (vdz > 0) vdz = Math.min(vdz, freia(vdz, E.limZ1 - z1)); else if (vdz < 0) vdz = Math.max(vdz, -freia(-vdz, z1 - zMin));
  // e o teto de velocidade (a bola que sobe muito empurra o limite depressa: a câmera não chicoteia atrás dela)
  const vm = Math.hypot(vdx, vdz);
  if (vm > Q.velMax) { vdx *= Q.velMax / vm; vdz *= Q.velMax / vm; }
  // a posição pela velocidade: com a velocidade mudada, a média da do começo e a do fim do quadro (aceleração constante no
  // quadro — a 2ª diferença da posição fica no teto), senão a da mola
  if (vdx !== vx1 || vdz !== vz1) {
    if (Number.isFinite(px0)) { est.x = px0 + 0.5 * (vx0 + vdx) * dt; est.z = pz0 + 0.5 * (vz0 + vdz) * dt; }
    else { est.x = x1 + (vdx - vx1) * dt; est.z = z1 + (vdz - vz1) * dt; }
  }
  est.vx = vdx; est.vz = vdz;
  // a guarda: o foco nunca sai da caixa do campo (só a sobra do último quadro da freada chega aqui)
  if (est.x > LX) { est.x = LX; if (est.vx > 0) est.vx = 0; } else if (est.x < -LX) { est.x = -LX; if (est.vx < 0) est.vx = 0; }
  if (est.z > E.limZ1) { est.z = E.limZ1; if (est.vz > 0) est.vz = 0; } else if (est.z < zMin) { est.z = zMin; if (est.vz < 0) est.vz = 0; }
}

/**
 * Um quadro da TV nova sobre o foco `est` ({x, z, vx, vz}): a bola teletransportada vira corte, o alvo, a mola e o limite
 * duro. Devolve se cortou (o corte pedido ou o da bola).
 */
export function focoTV(E, est, a, p, g, W, dt, corte) {
  if (!corte && E.ok && Number.isFinite(E.bx0) && Math.hypot(a.bx - E.bx0, a.bz - E.bz0) > Q.salto) corte = true;
  E.bx0 = a.bx; E.bz0 = a.bz;
  alvoTV(E, a, g, W, p, dt, corte, _r);
  const vx0 = est.vx, vz0 = est.vz, px0 = est.x, pz0 = est.z;
  passoMola(E, est, _r.x, _r.z, dt, corte);
  if (!corte) limiteDuro(E, est, a, g, dt, vx0, vz0, px0, pz0);
  else if (E.lim) E.lim.ok = false;
  E.cortou = !!corte;
  return E.cortou;
}
