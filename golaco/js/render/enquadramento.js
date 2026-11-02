// O enquadramento da câmera de TV, PURO (sem three nem DOM; fora do fecho do hash): o perfil das câmeras de jogo (TV,
// aproximada, celular deitado, retrato), a geometria da TV (a lente em (fx, H, fz + D) olhando (fx, oy, fz), yaw −π/2) com
// a projeção em conta fechada, e o FOCO — o de hoje (alvoLegado/molaLegada: a aproximada, o retrato, a transição e o plano
// 'fechada' do replay) e o da TV nova do item 66 (pedido do dono, 23/10: "a câmera não acompanha a bola e não dá pra ver a
// área completamente ... afastar muito pouco mais e centralizar mais"; contrato "Câmera de TV (item 66)" no CONTRATOS.md,
// pesquisa em PESQUISA-ESTADIO.md §14). render/camera.js aplica no three; os testes em Node (teste-camera) usam as MESMAS
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
/** s (= z − fz) que põe um ponto da altura y em NDC y = Y (NDC y cai quando s cresce: perto = embaixo). */
function sDeY(g, y, Y) {
  const K = g.D * g.D + g.h * (g.H - y);
  return (Y * g.tanV * K - (y - g.oy) * g.D) / (Y * g.tanV * g.D - g.h);
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

