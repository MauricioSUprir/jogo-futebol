// Placa eletrônica do quarto árbitro (cena de substituição; js/substituicao.js põe o quarto árbitro com ela acima da
// cabeça). Fabricantes de placa (Stramatel; RefereeStore — PESQUISA-ESTADIO.md §11): 582 × 383 × 27 mm, números de LED de
// 2 dígitos, VERMELHO = sai e VERDE = entra, legível dos dois lados. Aqui: uma caixa de 0,58 × 0,38 × 0,03 m com UMA
// textura de canvas (256 × 168) e UM material sem luz (o LED brilha sozinho; de noite também) — 1 chamada de desenho, só
// na cena. Os números em 7 segmentos (os apagados aparecem fracos, como no LED de verdade) e o ▲/▼ ao lado: a cor não é
// a única pista (daltonismo). A textura só é redesenhada quando o par muda (needsUpdate). As duas faces grandes leem
// certo de fora (a BoxGeometry do three.js espelha o u da face de trás); as bordas finas pegam o pixel preto do canto.
// Pré-carga: no 1º quadro desenhado a malha entra com 0 vértices (o shader compila e a textura sobe antes da cena).
import * as THREE from 'three';

export const PLACA_SUBST = { largura: 0.58, altura: 0.38, espessura: 0.03, texW: 256, texH: 168 };
const VERDE = '#19e07a', VERMELHO = '#ff3b30';

// segmentos: a, b, c, d, e, f, g (horário a partir do de cima; g = o do meio)
const DIGITOS = {
  0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

/** Um dígito de 7 segmentos (ou apagado: d = null) na caixa (x, y, w, h), com a espessura e. */
function digito(g, d, x, y, w, h, e, cor) {
  const ligados = d == null ? '' : DIGITOS[d] ?? '';
  const meio = y + h / 2, f = 1.5;
  const segs = {
    a: [x + e * 0.6, y, w - e * 1.2, e], d: [x + e * 0.6, y + h - e, w - e * 1.2, e], g: [x + e * 0.6, meio - e / 2, w - e * 1.2, e],
    f: [x, y + e * 0.6, e, h / 2 - e * 0.9], b: [x + w - e, y + e * 0.6, e, h / 2 - e * 0.9],
    e: [x, meio + e * 0.3, e, h / 2 - e * 0.9], c: [x + w - e, meio + e * 0.3, e, h / 2 - e * 0.9],
  };
  for (const [s, r] of Object.entries(segs)) {
    g.fillStyle = ligados.includes(s) ? cor : 'rgba(255, 255, 255, 0.06)';
    g.fillRect(r[0] + f, r[1] + f, r[2] - 2 * f, r[3] - 2 * f);
  }
}

/** Número de até 2 dígitos alinhado à direita (o da esquerda apagado com 1 dígito). */
function numero(g, n, x, y, cor) {
  const W = 50, H = 64, E = 10, G = 10;
  const s = n == null ? '' : String(Math.max(0, Math.min(99, n | 0)));
  const d0 = s.length === 2 ? +s[0] : null, d1 = s.length ? +s[s.length - 1] : null;
  digito(g, d0, x, y, W, H, E, cor);
  digito(g, d1, x + W + G, y, W, H, E, cor);
}

/** Triângulo ▲ (cima) ou ▼ na caixa (x, y, t). */
function triangulo(g, x, y, t, cima, cor) {
  g.fillStyle = cor;
  g.beginPath();
  if (cima) { g.moveTo(x + t / 2, y); g.lineTo(x + t, y + t * 0.86); g.lineTo(x, y + t * 0.86); }
  else { g.moveTo(x, y + t * 0.14); g.lineTo(x + t, y + t * 0.14); g.lineTo(x + t / 2, y + t); }
  g.closePath();
  g.fill();
}

/** Desenha a placa: em cima o verde (▲ entra), embaixo o vermelho (▼ sai). */
export function desenharPlaca(g, entra, sai) {
  const { texW: W, texH: H } = PLACA_SUBST;
  g.fillStyle = '#050607';
  g.fillRect(0, 0, W, H);
  // moldura de alumínio escuro (os 4 px de fora: as bordas finas da caixa usam o canto preto)
  g.strokeStyle = '#2a2f33';
  g.lineWidth = 6;
  g.strokeRect(5, 5, W - 10, H - 10);
  triangulo(g, 26, 22, 44, true, VERDE);
  numero(g, entra, 108, 12, VERDE);
  triangulo(g, 26, 102, 44, false, VERMELHO);
  numero(g, sai, 108, 92, VERMELHO);
}

/**
 * Placa na cena: criarPlacaSubst(cena) → {mesh, mostrar(entra, sai), atualizar(pos | null, desenha), estado}. pos =
 * {x, y, z, rumo} (substituicao.js placaNasMaos: o meio das mãos + 0,10 m, de frente para onde o quarto olha).
 */
export function criarPlacaSubst(cena) {
  const P = PLACA_SUBST;
  const canvas = Object.assign(document.createElement('canvas'), { width: P.texW, height: P.texH });
  const g = canvas.getContext('2d');
  desenharPlaca(g, null, null);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  const geo = new THREE.BoxGeometry(P.largura, P.altura, P.espessura);
  // as 4 bordas finas (faces ±x e ±y: vértices 0–15) pegam o canto preto da textura
  const uv = geo.attributes.uv;
  for (let v = 0; v < 16; v++) uv.setXY(v, 0.006, 0.006);
  uv.needsUpdate = true;
  const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'placa-subst';
  mesh.visible = false;
  mesh.frustumCulled = false;
  mesh.renderOrder = 2;
  cena.add(mesh);
  let precarga = true, restaurar = false;
  const estado = { visivel: false, entra: null, sai: null, desenhos: 0, x: 0, y: 0, z: 0, rumo: 0 };
  return {
    mesh,
    estado,
    /** Os números da placa (só redesenha quando mudam). */
    mostrar(entra, sai) {
      if (entra === estado.entra && sai === estado.sai) return;
      estado.entra = entra; estado.sai = sai; estado.desenhos++;
      desenharPlaca(g, entra, sai);
      tex.needsUpdate = true;
    },
    /** Um quadro: pos = onde a placa fica (ou null: some); desenha = este quadro vai ser desenhado (pré-carga). */
    atualizar(pos, desenha) {
      if (restaurar) { geo.setDrawRange(0, Infinity); restaurar = false; }
      if (!pos) {
        // pré-carga: no 1º quadro desenhado ela entra com 0 vértices (compila o shader e sobe a textura)
        if (precarga && desenha) { mesh.visible = true; geo.setDrawRange(0, 0); restaurar = true; precarga = false; }
        else mesh.visible = false;
        estado.visivel = false;
        return;
      }
      if (desenha) precarga = false;
      mesh.visible = true;
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.rotation.set(0, -(pos.rumo + Math.PI / 2), 0);
      estado.visivel = true; estado.x = pos.x; estado.y = pos.y; estado.z = pos.z; estado.rumo = pos.rumo;
    },
  };
}
