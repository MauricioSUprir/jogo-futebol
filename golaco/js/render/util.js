// Utilidades do desenho (three.js): junção de geometrias, ruído determinístico e canvas.
import * as THREE from 'three';

/** Hash inteiro → [0, 1). Determinístico (as texturas saem iguais em toda abertura). */
export function hash2(x, y, s = 0) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Gerador simples com semente para enfeites (nunca usado na lógica do jogo). */
export function gerador(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruído de valor 2D periódico (período px, py em células). */
export function ruido(x, y, px, py, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const x0 = ((xi % px) + px) % px, x1 = (x0 + 1) % px;
  const y0 = ((yi % py) + py) % py, y1 = (y0 + 1) % py;
  const a = hash2(x0, y0, s), b = hash2(x1, y0, s), c = hash2(x0, y1, s), d = hash2(x1, y1, s);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

export function criarCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/** CanvasTexture com mipmaps, anisotropia e espaço de cor sRGB (cor) ou linear (dados). */
export function texturaCanvas(canvas, { repetir = false, aniso = 1, cor = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = cor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  if (repetir) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  t.needsUpdate = true;
  return t;
}

/**
 * Junta geometrias (com ou sem índice) numa só, mantendo os atributos que TODAS têm.
 * Cores por geometria opcionais: cores[i] = THREE.Color → vira atributo 'color'.
 */
export function juntarGeometrias(geos, cores = null) {
  const lista = geos.map(g => (g.index ? g.toNonIndexed() : g));
  const nomes = Object.keys(lista[0].attributes).filter(n => lista.every(g => g.attributes[n]));
  let total = 0;
  for (const g of lista) total += g.attributes.position.count;
  const saida = new THREE.BufferGeometry();
  for (const n of nomes) {
    const tam = lista[0].attributes[n].itemSize;
    const arr = new Float32Array(total * tam);
    let o = 0;
    for (const g of lista) {
      const a = g.attributes[n];
      for (let i = 0; i < a.count; i++) for (let k = 0; k < tam; k++) arr[o++] = a.getComponent(i, k);
    }
    saida.setAttribute(n, new THREE.BufferAttribute(arr, tam));
  }
  if (cores) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    lista.forEach((g, i) => {
      const c = cores[i];
      for (let k = 0; k < g.attributes.position.count; k++) { arr[o++] = c.r; arr[o++] = c.g; arr[o++] = c.b; }
    });
    saida.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  }
  saida.computeBoundingSphere();
  return saida;
}

/** Cilindro entre dois pontos (para traves, mastros, estruturas); `aberto` = sem as tampas das pontas. */
export function cilindroEntre(a, b, raio, segs = 12, aberto = false) {
  const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(vb, va);
  const len = dir.length();
  const g = new THREE.CylinderGeometry(raio, raio, len, segs, 1, aberto);
  g.translate(0, len / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.applyQuaternion(q);
  g.translate(va.x, va.y, va.z);
  return g;
}

/**
 * Os atributos da LARGURA MÍNIMA de uma peça do gol feita por cilindroEntre(a, b, raio, segs) (item 45, C9; render/campo.js
 * criarGols, `PLANO-GRAFICOS.md` passo 5):
 * - aFino = a MEIA LARGURA MÍNIMA do prisma (0 = a peça não cresce: postes e travessão). A largura de um polígono regular de n
 *   lados vai de raio × (1 + cos(π/n)) com n ímpar, ou 2 × raio × cos(π/n) com n par, até 2 × raio: com o raio, a corda de 5
 *   lados ficava com 0,90 de "1 px" no lado mais estreito e caía entre os centros dos pixels;
 * - aEixo = o ponto do eixo a–b mais perto do vértice (o centro do corte dele) e aDir = a direção do eixo (unitária);
 * - aChao = 1 na corda deitada no gramado (`noChao`, eixo horizontal): o corte cresce a partir do contato com o chão
 *   (crescendo em volta do eixo, a metade de baixo ficaria atrás do gramado).
 * O juntarGeometrias só mantém o atributo que TODAS as peças têm: toda peça da malha passa por aqui. Devolve a geometria.
 */
export function atributosFino(geo, a, b, raio, { noChao = false, segs = 0 } = {}) {
  const p = geo.attributes.position, n = p.count;
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz || 1, l = Math.sqrt(l2);
  const meia = segs >= 3 ? raio * (segs % 2 ? (1 + Math.cos(Math.PI / segs)) / 2 : Math.cos(Math.PI / segs)) : raio;
  const fino = new Float32Array(n).fill(meia), chao = new Float32Array(n).fill(noChao ? 1 : 0);
  const eixo = new Float32Array(n * 3), dir = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const t = Math.min(1, Math.max(0, ((p.getX(i) - a[0]) * dx + (p.getY(i) - a[1]) * dy + (p.getZ(i) - a[2]) * dz) / l2));
    eixo[3 * i] = a[0] + t * dx; eixo[3 * i + 1] = a[1] + t * dy; eixo[3 * i + 2] = a[2] + t * dz;
    dir[3 * i] = dx / l; dir[3 * i + 1] = dy / l; dir[3 * i + 2] = dz / l;
  }
  geo.setAttribute('aFino', new THREE.BufferAttribute(fino, 1));
  geo.setAttribute('aEixo', new THREE.BufferAttribute(eixo, 3));
  geo.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
  geo.setAttribute('aChao', new THREE.BufferAttribute(chao, 1));
  return geo;
}

/**
 * Troca cada trecho `de` do texto de um shader por `para`, AVISANDO no console quando não acha (uma troca calada que não acha
 * passa despercebida: a lição do PR #631; o mesmo de render/gramado-shader.js aplicarTrocas). Devolve o texto.
 */
export function trocarNoShader(texto, trocas, onde) {
  let t = texto;
  for (const [de, para] of trocas) {
    if (!t.includes(de)) console.error(`render: a troca de "${de}" não achou o trecho (${onde}) — o shader saiu sem ela`);
    t = t.replace(de, () => para);
  }
  return t;
}

// a troca do alphatest_fragment do r170 (onBeforeCompile: os #include ainda FECHADOS, a lição do PR #631) pelo alfa para
// cobertura CENTRADO no limiar (Golus, "Anti-aliased Alpha Test": a = (a − limiar) / fwidth(a) + 0,5 — metade das amostras no
// limiar, como o descarte); sem ALPHA_TO_COVERAGE, o descarte de sempre
const TROCA_RECORTE = [['#include <alphatest_fragment>', `#ifdef ALPHA_TO_COVERAGE
  diffuseColor.a = (diffuseColor.a - alphaTest) / max(fwidth(diffuseColor.a), 1e-4) + 0.5;
  if (diffuseColor.a <= 0.0) discard;
#else
  if (diffuseColor.a < alphaTest) discard;
#endif`]];

/**
 * O antisserrilhado de RECORTES por alphaTest (item 45, C10; `PLANO-GRAFICOS.md` passo 5: os letreiros do pré-jogo) pelas
 * AMOSTRAS do contexto que desenha (o SAMPLES: o `cena.amostras`, nunca o nome da qualidade — a queda deixa a Baixa num contexto
 * com MSAA). Só os materiais OPACOS: o recorte transparente já tem a borda pela MISTURA (o alfa da textura é a cobertura) — medido
 * contra o SSAA 3× na região do letreiro (o pré-jogo do celular Média), a A2C ficava pior que a mistura: Estádio Golaço 0,035 →
 * 0,067–0,072 na fachada, Aflitos 0,075 → 0,077–0,093. No opaco (o letreiro dos pórticos do Maracanã, limiar 0,5), com MSAA (≥ 2) o
 * alfa para cobertura CENTRADO no limiar (TROCA_RECORTE): fachada 0,059 → 0,044, aéreo 0,035 → 0,035; o do r170 (o
 * smoothstep(limiar, limiar + fwidth, a) do alphatest_fragment, three.module.js:13990) começa no limiar e afina a letra meio pixel:
 * 0,059 → 0,076. Sem MSAA, o descarte de hoje (o A2C não faz nada sem amostras). fisico(true) = os desenhos seguintes sem a A2C (o
 * gancho dos testes). Muda o material FORA do desenho, sempre reescreve tudo (um material estragado por fora volta ao certo) e só
 * pede o programa novo quando algo mudou (o alphaToCoverage é o bit 21 da chave do programa). Devolve {definirAA(n), fisico(v),
 * estado}.
 */
export function recorteAA(materiais) {
  const lista = materiais.filter(m => m && !m.transparent && m.alphaTest > 0);
  for (const m of lista) {
    m.onBeforeCompile = sh => { sh.fragmentShader = trocarNoShader(sh.fragmentShader, TROCA_RECORTE, 'recorte com A2C, fragment'); };
    m.customProgramCacheKey = () => 'recorte-a2c';
  }
  let amostras = 0, fisico = false;
  const aplicar = () => {
    const a2c = !fisico && amostras >= 2;
    for (const m of lista) if (m.alphaToCoverage !== a2c) { m.alphaToCoverage = a2c; m.needsUpdate = true; }
  };
  return {
    definirAA(n) { amostras = n | 0; aplicar(); },
    fisico(v) { fisico = !!v; aplicar(); },
    /** {a2c (o dos materiais agora), amostras, fisico, materiais (os opacos com alphaTest: os que a A2C pega)}. */
    get estado() { return { a2c: lista.length > 0 && lista.every(m => m.alphaToCoverage), amostras, fisico, materiais: lista.length }; },
  };
}

/** Caixa com centro e tamanho. */
export function caixa(cx, cy, cz, sx, sy, sz) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  g.translate(cx, cy, cz);
  return g;
}

/** Mola crítica exata (estável com qualquer dt). Devolve [x, v]. Daniel Holden, "Spring-It-On". */
export function molaCritica(x, v, alvo, w, dt) {
  const y = x - alvo;
  const j1 = v + y * w;
  const e = Math.exp(-w * dt);
  return [alvo + (y + j1 * dt) * e, (v - j1 * w * dt) * e];
}
