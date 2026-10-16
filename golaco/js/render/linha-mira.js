// Linha da cobrança mirada (pedido do dono, 16/10, com a imagem do EA FC: "eu quero que tenha essa linha no escanteio, e
// na falta"): sai da bola e segue a trajetória PREVISTA pela física da bola (mira.js preverMira: a mesma conta do chute
// de verdade, passo a passo) — amarela na bola, azul-clara no fim, sumindo nos últimos metros. Uma fita virada para a
// câmera com o miolo claro e as bordas escuras (contraste na grama e no céu), UMA malha (1 chamada de desenho). A
// largura cresce com a distância (no fundo do quadro ela não some). Antes de carregar fica um pouco mais apagada (a força
// da linha é a padrão); carregando, cheia (a força da carga). Na direção só (passe curto, tiro de meta) ela fica no chão.
// Some no chute (preverMira devolve null). Só lê o mundo: não muda o hash.
import * as THREE from 'three';
import { MIRA } from '../config.js';

const LARG = 0.2;             // m — largura da fita (perto)
const LARG_DIST = 0.009;      // × a distância até a câmera (longe)
const AMARELA = [1.0, 0.82, 0.08], AZUL = [0.3, 0.72, 1.0], BORDA = [0.02, 0.03, 0.03];
const MUDA = [0.5, 0.72];     // fração do comprimento em que a cor vai do amarelo ao azul (curta: o meio não fica cinza)

export function criarLinhaMira(cena) {
  const N = MIRA.maxPontos;
  // 3 vértices por ponto: borda esquerda, miolo, borda direita
  const pos = new Float32Array(N * 3 * 3), cor = new Float32Array(N * 3 * 4);
  const idx = new Uint16Array((N - 1) * 12);
  for (let i = 0; i < N - 1; i++) {
    const a = i * 3, b = a + 3, k = i * 12;
    for (let s = 0; s < 2; s++) {
      const q = k + s * 6;
      idx[q] = a + s; idx[q + 1] = a + s + 1; idx[q + 2] = b + s;
      idx[q + 3] = a + s + 1; idx[q + 4] = b + s + 1; idx[q + 5] = b + s;
    }
  }
  const geo = new THREE.BufferGeometry();
  const aPos = new THREE.BufferAttribute(pos, 3), aCor = new THREE.BufferAttribute(cor, 4);
  aPos.setUsage(THREE.DynamicDrawUsage); aCor.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', aPos); geo.setAttribute('color', aCor);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4); // muda a cada quadro: nada de recorte errado
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -8,
  });
  const malha = new THREE.Mesh(geo, mat);
  malha.name = 'linha-mira';
  malha.renderOrder = 6;
  malha.frustumCulled = false;
  malha.visible = false;
  cena.add(malha);
  let vis = 0, nUlt = 0;
  const _c = new THREE.Vector3();

  return {
    malha,
    /** Estado (testes): {visivel, pontos, opacidade}. */
    get estado() { return { visivel: malha.visible, pontos: nUlt, opacidade: vis }; },
    /**
     * pts (x, y, z por ponto), n pontos e info = preverMira (ou null: some). camera = a câmera do quadro (a fita vira
     * para ela). dt em s.
     */
    atualizar(pts, n, info, camera, dt) {
      const ativo = !!info && n >= 2;
      const alvo = ativo ? (info.carregando ? 1 : 0.85) : 0;
      // some na hora no chute (não fica pendurada atrás da bola); aparece em 0,15 s
      vis = ativo ? Math.min(alvo, vis + dt / 0.15) : 0;
      if (ativo && vis < alvo && info.carregando) vis = alvo;
      malha.visible = vis > 0.01;
      nUlt = ativo ? n : 0;
      if (!malha.visible) return;
      _c.copy(camera.position);
      // comprimento total (o desbotado do fim é pelos últimos ~12% dele)
      let tot = 0;
      for (let i = 1; i < n; i++) tot += Math.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
      tot = Math.max(tot, 1e-3);
      let s = 0;
      for (let i = 0; i < n; i++) {
        const x = pts[i * 3], y = pts[i * 3 + 1], z = pts[i * 3 + 2];
        const j0 = Math.max(0, i - 1), j1 = Math.min(n - 1, i + 1);
        let tx = pts[j1 * 3] - pts[j0 * 3], ty = pts[j1 * 3 + 1] - pts[j0 * 3 + 1], tz = pts[j1 * 3 + 2] - pts[j0 * 3 + 2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        // lado da fita = tangente × (para a câmera); no chão (quase de cima) fica deitada
        const vx = _c.x - x, vy = _c.y - y, vz = _c.z - z;
        let ox = ty * vz - tz * vy, oy = tz * vx - tx * vz, oz = tx * vy - ty * vx;
        const ol = Math.hypot(ox, oy, oz) || 1;
        const w = Math.max(LARG, LARG_DIST * Math.hypot(vx, vy, vz)) / 2 / ol;
        ox *= w; oy *= w; oz *= w;
        const k = i * 9;
        pos[k] = x - ox; pos[k + 1] = y - oy; pos[k + 2] = z - oz;
        pos[k + 3] = x; pos[k + 4] = y; pos[k + 5] = z;
        pos[k + 6] = x + ox; pos[k + 7] = y + oy; pos[k + 8] = z + oz;
        if (i > 0) s += Math.hypot(x - pts[i * 3 - 3], y - pts[i * 3 - 2], z - pts[i * 3 - 1]);
        const u = s / tot;
        const a = vis * (u < 0.03 ? u / 0.03 : u > 0.88 ? Math.max(0, (1 - u) / 0.12) : 1);
        const m = Math.min(1, Math.max(0, (u - MUDA[0]) / (MUDA[1] - MUDA[0])));
        const q = i * 12;
        for (let c = 0; c < 3; c++) {
          const borda = c !== 1;
          for (let e = 0; e < 3; e++) cor[q + c * 4 + e] = borda ? BORDA[e] : AMARELA[e] + (AZUL[e] - AMARELA[e]) * m;
          cor[q + c * 4 + 3] = borda ? a * 0.55 : a;
        }
      }
      geo.setDrawRange(0, (n - 1) * 12);
      aPos.needsUpdate = true; aCor.needsUpdate = true;
      aPos.clearUpdateRanges?.(); aCor.clearUpdateRanges?.();
      aPos.addUpdateRange?.(0, n * 9); aCor.addUpdateRange?.(0, n * 12);
    },
  };
}
