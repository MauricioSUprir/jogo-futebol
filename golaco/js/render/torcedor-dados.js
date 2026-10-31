// Torcedor 3D (dados: conta PURA, sem three.js nem DOM; item 69 da FILA, PR 2 de 4 — pedido do dono de 29/10: "cadeiras
// parecidas com as reais e torcida 3D, em todos os estádios"). Só desenho: nada daqui toca a simulação (fora do fecho do
// hash). SOB DEMANDA, junto do render/torcedor3d.js (o 1º quadro e a TV não precisam dele).
//
// O modelo (assets/torcedor/torcedor.bin, ~56 KB; tools/torcedor/README.md): dois avatares Rocketbox (MIT) — homem e
// mulher — reduzidos a ~300 e ~125 triângulos (2 níveis de detalhe), com as 8 POSES da torcida (as de torcida-dados.js
// POSE: sentado, sentado batendo palmas, de pé, de pé batendo palmas, braços em V, um braço, cachecol e mãos na cabeça)
// ASSADAS vértice a vértice: a textura de animação (VAT) — cada linha uma pose (posição e normal), cada coluna um vértice
// (o gl_VertexID). O vertex shader escolhe a pose pela MESMA conta do quadro (render/torcedor-pose.js ESTADO_GLSL) e lê a
// linha dela: o mesmo instante dá a mesma pose no quadro e no 3D. O lugar é o da CADEIRA da grade
// (render/cadeiras-dados.js): a origem no piso, no centro do assento, virado para o rumo dela (o campo); x é a esquerda da
// pessoa, y para cima, z para a frente. Sentado, o quadril no assento (0,43 m) e os pés no piso; de pé, na passagem livre
// na frente do assento.
// Fontes (PESQUISA-ESTADIO.md §15): a VAT do Houdini (SideFX Labs "Vertex Animation Textures": posição e normal por
// vértice e quadro numa textura, o vértice achado pelo índice), a multidão por instâncias e nível de detalhe de GPU Gems 3
// cap. 2 e de Millán & Rudomín, e a InstancedBufferGeometry/DataTexture do three.js 0.170.
import { CADEIRA } from './cadeiras-dados.js';

export const TORCEDOR3D = Object.freeze({
  arquivo: 'assets/torcedor/torcedor.bin',
  poses: 8,
  sentadas: 2,                     // as poses 0 e 1 (POSE.SENTADO, POSE.SENTADO_PALMAS) são sentadas; as outras de pé
  assento: CADEIRA.assento.altura, // m: o pivô da escala de quem está sentado (a escala não tira a pessoa do assento)
  escala: [0.94, 1.06],            // a escala do torcedor (aPos.w) limitada: o maior do quadro do Maracanã vale 2 lugares
  alturaBal: 1.2,                  // m: o balanço (± 3,5 cm) cresce do piso (ou do assento) até esta altura
  mulher: 0.36,                    // fração de mulheres (pela semente)
  // por qualidade: o teto de TRIÂNGULOS dos torcedores 3D (o pior plano do pré-jogo no celular não tem folga: ≤ 130 mil —
  // medido com tools/medir-cadeiras.mjs), os px da cadeira na tela para o bloco ganhar o torcedor 3D (entra/sai, com
  // histerese) e para o nível 0 (~300 triângulos; abaixo, o nível 1). Baixa: nenhum (o quadro de hoje). Na Média só
  // perto da câmera; na Alta mais longe (as recomendações do dono, FILA "Depende do dono" 11).
  qual: Object.freeze({
    baixa: Object.freeze({ teto: 0, pxEntra: Infinity, pxSai: Infinity, pxLod0: Infinity, pxLod0Sai: Infinity }),
    media: Object.freeze({ teto: 9000, pxEntra: 14, pxSai: 11, pxLod0: 30, pxLod0Sai: 26 }),
    alta: Object.freeze({ teto: 160000, pxEntra: 10, pxSai: 7.5, pxLod0: 28, pxLod0Sai: 24 }),
  }),
  favorAnterior: 1.2,              // no ranking do teto, o bloco que já estava em 3D vale 20% mais (não pisca)
  // as cores que o quadro não tem: a calça (jeans, preta, cinza, bege) e o tênis — sRGB, pela semente
  calca: Object.freeze(['#2a3a56', '#4f6585', '#1c1e21', '#45484d', '#7d6e52']),
  sapato: Object.freeze(['#d9d9d4', '#1b1b1c', '#6b6d70']),
});
export const REGIAO = Object.freeze({ camisa: 0, pele: 1, cabelo: 2, calca: 3, sapato: 4, acento: 5 });

/**
 * Lê o assets/torcedor/torcedor.bin: 'TCD1', nVar, nLod, nPoses; por (variação, nível): nV, nTri, os índices (u16), as
 * regiões (u8) e, por pose, as posições (int16, 1/10000 m) e as normais (int8, /127). Devolve {nVar, nLod, nPoses,
 * malhas: [variação][nível] = {nV, nTri, indice: Uint16Array, regiao: Uint8Array, pos: Float32Array(nPoses·nV·3), nor},
 * bytes}.
 */
export function lerModelo(buf) {
  const dv = new DataView(buf);
  const tag = String.fromCharCode(dv.getUint8(0), dv.getUint8(1), dv.getUint8(2), dv.getUint8(3));
  if (tag !== 'TCD1') throw new Error('torcedor.bin: cabeçalho ' + tag);
  const nVar = dv.getUint16(4, true), nLod = dv.getUint16(6, true), nPoses = dv.getUint16(8, true);
  let o = 12;
  const malhas = [];
  for (let v = 0; v < nVar; v++) {
    const porLod = [];
    for (let l = 0; l < nLod; l++) {
      const nV = dv.getUint16(o, true), nTri = dv.getUint16(o + 2, true);
      o += 4;
      const indice = new Uint16Array(3 * nTri);
      for (let i = 0; i < 3 * nTri; i++) indice[i] = dv.getUint16(o + 2 * i, true);
      o += 6 * nTri;
      const regiao = new Uint8Array(buf.slice(o, o + nV));
      o += nV + (nV % 2);
      const pos = new Float32Array(nPoses * nV * 3), nor = new Float32Array(nPoses * nV * 3);
      for (let i = 0; i < pos.length; i++) pos[i] = dv.getInt16(o + 2 * i, true) / 10000;
      o += 2 * pos.length;
      for (let i = 0; i < nor.length; i++) nor[i] = dv.getInt8(o + i) / 127;
      o += nor.length;
      o += (4 - (o % 4)) % 4;
      porLod.push({ nV, nTri, indice, regiao, pos, nor });
    }
    malhas.push(porLod);
  }
  return { nVar, nLod, nPoses, malhas, bytes: buf.byteLength };
}

/**
 * A VAT: uma textura RGBA float (largura = o maior nº de vértices; altura = variações × níveis × poses × 2): na linha
 * `linha(v, l) + 2·pose` as posições (xyz) e na seguinte as normais. Devolve {dados: Float32Array, largura, altura,
 * linha(v, l)}.
 */
export function vatDados(modelo) {
  const { nVar, nLod, nPoses, malhas } = modelo;
  let largura = 1;
  for (const pl of malhas) for (const m of pl) largura = Math.max(largura, m.nV);
  const altura = nVar * nLod * nPoses * 2;
  const dados = new Float32Array(largura * altura * 4);
  const linha = (v, l) => (v * nLod + l) * nPoses * 2;
  for (let v = 0; v < nVar; v++) for (let l = 0; l < nLod; l++) {
    const m = malhas[v][l], l0 = linha(v, l);
    for (let p = 0; p < nPoses; p++) for (let i = 0; i < m.nV; i++) {
      const s = 3 * (p * m.nV + i), a = 4 * ((l0 + 2 * p) * largura + i), b = a + 4 * largura;
      dados[a] = m.pos[s]; dados[a + 1] = m.pos[s + 1]; dados[a + 2] = m.pos[s + 2]; dados[a + 3] = 1;
      dados[b] = m.nor[s]; dados[b + 1] = m.nor[s + 1]; dados[b + 2] = m.nor[s + 2]; dados[b + 3] = 0;
    }
  }
  return { dados, largura, altura, linha };
}

const fract = v => v - Math.floor(v);
/** A variação do torcedor (0 homem, 1 mulher) pela semente dele (h = aPele.w, h2 = aInfo.w, já em 0–1). */
export function variacaoDe(h, h2) { return fract(h * 31.7 + h2 * 7.3) < TORCEDOR3D.mulher ? 1 : 0; }

/**
 * Um vértice do modelo na pose, no espaço da CADEIRA (a MESMA conta de TORCEDOR_GLSL torcedorLocal): a escala (pelo piso
 * de pé, pelo assento sentado), o balanço de lado (cresce com a altura) e o pulo (só de pé: quem está sentado não sai do
 * assento). vat = vatDados(...); linha0 = vat.linha(v, l). Devolve {p: [x, y, z], n: [x, y, z]}.
 */
export function torcedorLocal(vat, linha0, vi, pose, esc, pulo, bal) {
  const T = TORCEDOR3D, p = Math.floor(pose + 0.5), lin = linha0 + 2 * p;
  const a = 4 * (lin * vat.largura + vi), b = a + 4 * vat.largura, D = vat.dados;
  const q = [D[a], D[a + 1], D[a + 2]], n = [D[b], D[b + 1], D[b + 2]];
  const sentado = p < T.sentadas;
  const piv = sentado ? T.assento : 0;
  const e = Math.min(T.escala[1], Math.max(T.escala[0], esc));
  q[1] = piv + (q[1] - piv) * e; q[0] *= e; q[2] *= e;
  const alto = Math.min(1, Math.max(0, (q[1] - piv) / T.alturaBal));
  q[0] += bal * alto;
  if (!sentado) q[1] += pulo;
  return { p: q, n };
}
/** Do espaço da cadeira para o mundo: cad = [x, z, cos rumo, sen rumo], yPiso (a MESMA conta de torcedorMundo). */
export function torcedorMundo(q, cad, yPiso) {
  return [cad[0] + q[0] * cad[3] + q[2] * cad[2], yPiso + q[1], cad[1] - q[0] * cad[2] + q[2] * cad[3]];
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/**
 * vec3 torcedorLocal(int vi, float pose, float esc, float pulo, float bal, out vec3 nl), vec3 torcedorMundo(vec3 q, vec4
 * cad, float yPiso) e vec3 torcedorNormal(vec3 nl, vec4 cad) — com uniform sampler2D uVat e uniform float uLinha (a 1ª
 * linha desta malha na VAT). A MESMA conta de torcedorLocal/torcedorMundo em JS.
 */
export const TORCEDOR_GLSL = (() => {
  const T = TORCEDOR3D;
  return `
uniform highp sampler2D uVat;
uniform float uLinha;
vec3 torcedorLocal(int vi, float pose, float esc, float pulo, float bal, out vec3 nl) {
  int p = int(floor(pose + 0.5));
  int lin = int(uLinha + 0.5) + 2 * p;
  vec3 q = texelFetch(uVat, ivec2(vi, lin), 0).xyz;
  nl = texelFetch(uVat, ivec2(vi, lin + 1), 0).xyz;
  bool sentado = p < ${T.sentadas};
  float piv = sentado ? ${g(T.assento)} : 0.0;
  float e = clamp(esc, ${g(T.escala[0])}, ${g(T.escala[1])});
  q.y = piv + (q.y - piv) * e;
  q.x *= e;
  q.z *= e;
  float alto = clamp((q.y - piv) / ${g(T.alturaBal)}, 0.0, 1.0);
  q.x += bal * alto;
  if (!sentado) q.y += pulo;
  return q;
}
vec3 torcedorMundo(vec3 q, vec4 cad, float yPiso) {
  return vec3(cad.x + q.x * cad.w + q.z * cad.z, yPiso + q.y, cad.y - q.x * cad.z + q.z * cad.w);
}
vec3 torcedorNormal(vec3 nl, vec4 cad) {
  return vec3(nl.x * cad.w + nl.z * cad.z, nl.y, -nl.x * cad.z + nl.z * cad.w);
}
`;
})();

/**
 * Quem ganha o torcedor 3D neste quadro. A unidade é a FILEIRA de um bloco de cadeiras 3D (os blocos que escolherBlocos já
 * escolheu: o torcedor 3D sempre senta numa cadeira 3D) — um bloco inteiro no nível 1 passava sozinho do teto da Média.
 * unidades: [{chave, px (da cadeira na tela, pela distância da câmera ao meio da fileira), n (quantos torcedores dela esta
 * qualidade desenha)}]; anteriores: Map(chave → nível) do quadro anterior; opc = TORCEDOR3D.qual[q] com {tri: [triângulos
 * do nível 0, do nível 1]}. As de mais px primeiro (quem já estava vale `favorAnterior` mais); cada uma no nível 0 se tiver
 * px e couber no teto, senão no 1; a que não cabe nem no 1 fica no quadro. Devolve {escolha: Map(chave → nível),
 * triangulos, torcedores}.
 */
export function escolherTorcedores(unidades, anteriores, opc) {
  const O = { favorAnterior: TORCEDOR3D.favorAnterior, ...opc };
  const escolha = new Map();
  let tri = 0, tor = 0;
  if (!(O.teto > 0) || !unidades.length) return { escolha, triangulos: 0, torcedores: 0 };
  const cands = [];
  for (const u of unidades) {
    if (!u.n) continue;
    const ja = anteriores.has(u.chave);
    if (u.px < (ja ? O.pxSai : O.pxEntra)) continue;
    cands.push([u, u.px * (ja ? O.favorAnterior : 1)]);
  }
  cands.sort((a, b) => b[1] - a[1] || (a[0].chave < b[0].chave ? -1 : 1));
  for (const [u] of cands) {
    const quer0 = u.px >= (anteriores.get(u.chave) === 0 ? O.pxLod0Sai : O.pxLod0);
    for (const l of quer0 ? [0, 1] : [1]) {
      const c = u.n * O.tri[l];
      if (tri + c > O.teto) continue;
      escolha.set(u.chave, l); tri += c; tor += u.n;
      break;
    }
  }
  return { escolha, triangulos: tri, torcedores: tor };
}

/** Os px de uma cadeira (0,5 m) a `d` m da câmera: cam = {fov (graus, vertical), alturaPx} (a conta de escolherBlocos). */
export function pxCadeira(d, cam) {
  const tg = Math.tan((Math.min(170, Math.max(1, cam.fov)) * Math.PI) / 360);
  return (CADEIRA.largura * cam.alturaPx) / (2 * Math.max(0.5, d) * tg);
}
