// A MÃO DE APOIO NO CHÃO (item 77: "a mão de apoio do manequim deitado fica 0,073 m acima do chão"). SÓ DESENHO: a pose do
// jogo (anim.js poseCarrinho; o fecho do hash) põe o braço de apoio quase em pé e o antebraço DEITADO na altura do
// cotovelo (0,108 m) até a junta `mao` — no manequim a ponta da mão, no corpo novo o punho; a mão ficava no ar nos dois
// (manequim: o fundo da cápsula a 0,073 m; corpo novo: a mão de lado, a palma em pé, a 0,063 m). Aqui, pela POSE (as cenas
// e o replay desenham pela pose, sem marca do carrinho), um peso contínuo 0–1 por braço — a pelve deitada, a mão baixa, o
// antebraço quase deitado e sem a mão acima do cotovelo, o cotovelo dobrado, as mãos separadas (com as duas juntas é a bola
// nas mãos) e o tronco de costas, inclinado até ~65° (o carrinho deita a 40–60°; de bruços — o peixinho do cabeceio — ou de
// lado — o mergulho do goleiro — o tronco fica deitado e o peso é 0) — leva a junta da
// mão até o chão (a altura pedida) e refaz o cotovelo por IK de dois ossos com os MESMOS comprimentos, do lado do cotovelo
// de antes (com o polo subindo junto do peso: com peso 0 nada muda). Puro: sem three.js nem DOM, sem alocar.
// O corpo novo vira ainda a palma para o chão (render/esqueleto.js). Usado pelo manequim (render/jogador3d.js) e pelo
// corpo novo (render/esqueleto.js postura).
// (o "foot IK" — o efetor plantado no chão e girado pela normal do chão: ozz-animation foot_ik; o Two Bone IK com o polo
// do Unity Animation Rigging; a técnica do carrinho com a mão de apoio atrás do quadril: PESQUISA-ETAPA4.md §18)

// as juntas da pose (a ordem de anim.js J e de esqueleto.js JUNTAS_ESQ; teste-ossos e teste-carrinho conferem a igualdade)
const PELVE = 0, PESCOCO = 3;
const BRACOS = [[5, 6, 7], [8, 9, 10]]; // [ombro, cotovelo, mão] esquerdo e direito
export const APOIO_MAO = {
  // as rampas são LARGAS de propósito: a pose do carrinho desce em ~0,4 s e sobe em ~0,4 s, e a palma gira ~90°; com
  // rampas curtas o giro saía em 3 quadros (~45° por quadro: o "salto" do teste-ossos O2)
  pelve: [0.25, 0.55],   // a pelve abaixo de 0,25 m: peso 1; acima de 0,55: 0 (de pé, agachado)
  mao: [0.14, 0.45],     // a junta da mão abaixo de 0,14 m: 1; acima de 0,45: 0
  ante: [0.2, 0.8],      // o seno da inclinação do antebraço com a mão abaixo do cotovelo: até 0,2: 1; a partir de 0,8: 0
  sobe: [0.05, 0.25],    // ... e com a mão ACIMA do cotovelo (o goleiro se levantando do mergulho): até 0,05: 1; 0,25: 0
  tronco: [0.26, 0.42],  // o cosseno da inclinação do tronco (pelve → pescoço): ≥ 0,42 (≤ 65°): 1; ≤ 0,26 (≥ 75°): 0
  dobra: [0.64, 0.9],    // o cosseno entre o braço e o antebraço: dobrado (≤ 0,64, ≥ 50°): 1; reto (≥ 0,9, ≤ 26°): 0
  maos: [0.3, 0.45],     // a distância entre as mãos: juntas (≤ 0,3 m, a bola nas mãos): 0; soltas (≥ 0,45): 1
  polo: 0,               // o polo do cotovelo sobe polo × o peso (0: o cotovelo do lado do de antes)
  alcance: 0.95,         // a mão desce até o ombro ficar a no máximo 0,95 × (braço + antebraço) dela
};
const suave = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** O peso 0–1 da mão de apoio no chão do braço `lado` (0 esquerdo, 1 direito) na pose po (19 juntas × 3). */
export function pesoApoio(po, lado) {
  const [io, ic, im] = BRACOS[lado];
  const o = io * 3, c = ic * 3, m = im * 3;
  let w = 1 - suave(APOIO_MAO.pelve[0], APOIO_MAO.pelve[1], po[PELVE * 3 + 1]);
  if (w <= 0) return 0;
  w *= 1 - suave(APOIO_MAO.mao[0], APOIO_MAO.mao[1], po[m + 1]);
  if (w <= 0) return 0;
  const ax = po[m] - po[c], ay = po[m + 1] - po[c + 1], az = po[m + 2] - po[c + 2];
  const la = Math.sqrt(ax * ax + ay * ay + az * az) || 1e-9;
  w *= ay > 0 ? 1 - suave(APOIO_MAO.sobe[0], APOIO_MAO.sobe[1], ay / la) : 1 - suave(APOIO_MAO.ante[0], APOIO_MAO.ante[1], -ay / la);
  if (w <= 0) return 0;
  const p = PELVE * 3, n = PESCOCO * 3;
  const tx = po[n] - po[p], ty = po[n + 1] - po[p + 1], tz = po[n + 2] - po[p + 2];
  w *= suave(APOIO_MAO.tronco[0], APOIO_MAO.tronco[1], ty / (Math.sqrt(tx * tx + ty * ty + tz * tz) || 1e-9));
  if (w <= 0) return 0;
  const bx = po[c] - po[o], by = po[c + 1] - po[o + 1], bz = po[c + 2] - po[o + 2];
  const lb = Math.sqrt(bx * bx + by * by + bz * bz) || 1e-9;
  w *= 1 - suave(APOIO_MAO.dobra[0], APOIO_MAO.dobra[1], (ax * bx + ay * by + az * bz) / (la * lb));
  if (w <= 0) return 0;
  const e = 7 * 3, d = 10 * 3;
  w *= suave(APOIO_MAO.maos[0], APOIO_MAO.maos[1], Math.sqrt((po[e] - po[d]) ** 2 + (po[e + 1] - po[d + 1]) ** 2 + (po[e + 2] - po[d + 2]) ** 2));
  return w;
}

/**
 * A mão `lado` levada ao chão com o peso w: a junta da mão desce até alvoY (x e z ficam) e o cotovelo sai da IK de dois
 * ossos com os comprimentos de po (ombro → cotovelo, cotovelo → mão), do lado do cotovelo de antes, o polo subindo
 * APOIO_MAO.polo × w. Lê de po e escreve o cotovelo e a mão em out (pode ser o próprio po).
 */
export function maoNoChao(po, out, lado, w, alvoY) {
  if (!(w > 0)) return out;
  const [io, ic, im] = BRACOS[lado];
  const o = io * 3, c = ic * 3, m = im * 3;
  const ox = po[o], oy = po[o + 1], oz = po[o + 2], cx = po[c], cy = po[c + 1], cz = po[c + 2];
  const L1 = Math.sqrt((cx - ox) ** 2 + (cy - oy) ** 2 + (cz - oz) ** 2);
  const L2 = Math.sqrt((po[m] - cx) ** 2 + (po[m + 1] - cy) ** 2 + (po[m + 2] - cz) ** 2);
  // a mão desce, mas nunca além do alcance com o cotovelo dobrado (o braço até APOIO_MAO.alcance × L1 + L2: ~36° de
  // dobra): esticado, o lado da dobra deixa de existir e o cotovelo (e a torção do braço do corpo novo) virava num quadro
  // na entrada e na saída do carrinho, com o corpo ainda alto
  const mx = po[m], mz = po[m + 2], my0 = po[m + 1];
  let my = my0 + (alvoY - my0) * w;
  const R = APOIO_MAO.alcance * (L1 + L2), h2 = (mx - ox) ** 2 + (mz - oz) ** 2;
  if (h2 < R * R) my = Math.max(my, Math.min(oy - Math.sqrt(R * R - h2), my0));
  else my = my0;
  let ux = mx - ox, uy = my - oy, uz = mz - oz;
  const d0 = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1e-9;
  ux /= d0; uy /= d0; uz /= d0;
  const d = Math.min(Math.max(d0, Math.abs(L1 - L2) + 1e-6), L1 + L2 - 1e-6);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  // o polo: o cotovelo de antes (subindo com o peso), sem a parte ao longo de ombro → mão; com o braço quase reto (o seno
  // abaixo de 0,087, ~5°) o lado da dobra não existe e mistura com "para cima" até 20° (como a IK do braço do desenho,
  // esqueleto.js ikBraco): sem isso o cotovelo virava de lado num quadro na entrada e na saída do carrinho
  let px = cx - ox, py = cy + APOIO_MAO.polo * w - oy, pz = cz - oz;
  let pe = px * ux + py * uy + pz * uz;
  px -= pe * ux; py -= pe * uy; pz -= pe * uz;
  let lp = Math.sqrt(px * px + py * py + pz * pz);
  const k = Math.min(1, Math.max(0, (lp / (L1 || 1) - 0.087) / (0.342 - 0.087)));
  if (lp > 1e-9) { px /= lp; py /= lp; pz /= lp; }
  let ax = -uy * ux, ay = 1 - uy * uy, az = -uy * uz; // "cima" sem a parte ao longo de ombro → mão
  const la = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
  px = px * k + ax / la * (1 - k); py = py * k + ay / la * (1 - k); pz = pz * k + az / la * (1 - k);
  pe = px * ux + py * uy + pz * uz;
  px -= pe * ux; py -= pe * uy; pz -= pe * uz;
  lp = Math.sqrt(px * px + py * py + pz * pz) || 1;
  px /= lp; py /= lp; pz /= lp;
  out[c] = ox + ux * a + px * h; out[c + 1] = oy + uy * a + py * h; out[c + 2] = oz + uz * a + pz * h;
  out[m] = ox + ux * d; out[m + 1] = oy + uy * d; out[m + 2] = oz + uz * d;
  return out;
}

/** A folga da mão do manequim acima do chão (o fundo da cápsula a 3 mm: sem brigar com o gramado no z-buffer). */
export const FOLGA_MAO = 0.003;
/**
 * A pose do desenho do MANEQUIM (render/jogador3d.js): a própria pose ou, com uma mão de apoio no chão, a cópia em out com
 * o cotovelo e a mão refeitos — a junta `mao` (a ponta da mão do manequim) no raio da cápsula da mão (rE, rD) + a folga.
 */
export function poseManequim(pose, rE, rD, out) {
  const w0 = pesoApoio(pose, 0), w1 = pesoApoio(pose, 1);
  if (!(w0 > 0) && !(w1 > 0)) return pose;
  out.set(pose);
  if (w0 > 0) maoNoChao(out, out, 0, w0, rE + FOLGA_MAO);
  if (w1 > 0) maoNoChao(out, out, 1, w1, rD + FOLGA_MAO);
  return out;
}
