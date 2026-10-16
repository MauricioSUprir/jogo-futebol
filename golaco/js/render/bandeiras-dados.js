// Faixas, bandeiras e bandeirões da torcida (dados): conta PURA (sem three.js nem DOM) de onde fica cada faixa
// (nomes FICTÍCIOS), cada bandeira de mastro (na mão de um torcedor das fileiras da frente) e cada bandeirão, e a
// ONDA do pano — a mesma conta no JS (testes) e no vertex shader (BANDEIRA_GLSL; tools/teste-estadio confere na GPU).
// bandeiras.js monta a malha com isto (uma chamada de desenho para tudo); tools/teste-torcida confere em Node.
//
// Referências (PESQUISA-ESTADIO.md §6): a bandeira no vertex shader de godotshaders ("3D simple animated flag shader",
// "Waving flag"): deslocamento sin(k·u − ω·t)·amp·u (a borda do mastro, u = 0, parada) mais um ruído; o balanço do
// mastro de quem agita a bandeira; as festas de torcida com bandeiras, faixas e bandeirão (Eintracht Frankfurt, ESPN).
import { ARQUIBANCADA, geradorTorcida } from './torcida-dados.js';

export const BANDEIRAS = {
  // faixas presas na mureta da frente (0,15–1,25 m): quantas por qualidade (as primeiras da lista)
  faixas: { baixa: 8, media: 10, alta: 12 },
  faixaAlt: 1.1, faixaY: 0.15,
  // bandeiras de mastro na mão de torcedores das fileiras da frente do lado de lá e da organizada
  bandeiras: { baixa: 6, media: 16, alta: 32 },
  mastro: 3.0, largura: 2.0, altura: 1.4, mao: 1.45,      // m (o mastro sai da mão, 1,45 m acima do degrau)
  // onda do pano: d = amp·u·sin(k·u·L − ω·t + fase) + ruído; balanço do mastro θ = bal·sin(2π·balHz·t + fase)
  onda: { amp: 0.28, k: 3.4, w: 6.9, ruido: 0.06, bal: 0.55, balHz: 0.6 },
  // bandeirões: abre na saída de cada tempo e no gol da casa (festa.js); a onda corre na largura (o povo empurra).
  // altura (pela normal) e onda escolhidas para o pano nunca descer abaixo das mãos de quem está embaixo segurando
  // (braços em V, sem pular: vão livre na vertical (2,3 − 0,25)/0,85 ≈ 2,4 m > 2,15 m do torcedor mais alto) —
  // contraprova de 12/10: com 2,1 e 0,45, 1134 torcedores pulando e 15 das 32 bandeiras de mastro furavam o pano
  bandeirao: { altura: 2.3, onda: 0.25, ondaK: 0.7, ondaW: 2.2, divisoes: [24, 10] },
  // debaixo do bandeirão aberto (sobBandeirao): margem [na largura, na profundidade] em m — o torcedor (o quadro tem
  // 1,1 m) segura o pano (braços em V, sem pular) e a bandeira de mastro (pano de 2 m ao lado do mastro) abaixa
  sob: { torcedor: [0.6, 0], bandeira: [2.4, 0.6] },
};

// Faixas: [texto, fundo, letra, detalhe] — tudo FICTÍCIO (Golaço FC de preto e verde; Ventania FC de branco e cinza)
const TEXTOS = [
  ['FÚRIA VERDE', '#07090a', '#19e07a', 'borda'],
  ['GALERA GOLAÇO', '#19e07a', '#07090a', 'nenhum'],
  ['NAÇÃO VERDINEGRA', '#f2f4f3', '#0d8447', 'listras'],
  ['AQUI É GOLAÇO', '#07090a', '#f2f4f3', 'verde'],
  ['OS INCANSÁVEIS', '#0d8447', '#f2f4f3', 'borda'],
  ['BONDE DO GOLAÇO', '#07090a', '#19e07a', 'listras'],
  ['SEMPRE CONTIGO', '#19e07a', '#07090a', 'borda'],
  ['VAI, GOLAÇO!', '#07090a', '#f2f4f3', 'verde'],
  ['TORCIDA JOVEM GFC', '#07090a', '#19e07a', 'listras'],
  ['VENTANIA ATÉ O FIM', '#e9ecee', '#2b3238', 'borda'],
  ['GUERREIROS DA ARQUIBANCADA', '#0d8447', '#07090a', 'nenhum'],
  ['FORÇA VENTANIA', '#2b3238', '#e9ecee', 'verde'],
];
export const TEXTOS_FAIXAS = TEXTOS;
// estádio com forma própria (estadio-planta.js, sob demanda: render/estadio-real.js ligarForma): os lugares DELE
let forma = null;
export function definirFormaBandeiras(p) { forma = p || null; }

/**
 * Faixas, na ordem de prioridade (a Baixa desenha as 8 primeiras): {texto, fundo, letra, detalhe, setor (0 lado de
 * lá, 1 fundo +x, 2 fundo −x), centro (x ou z na mureta), larg (m), slot (linha do atlas)}.
 * textos (só com ?tm; identidade.js faixas): os 12 [texto, fundo, letra, detalhe, cor do detalhe?] com os nomes dos
 * times do Total Match, na MESMA ordem dos lugares (9 e 11 no setor visitante). Sem eles, os de hoje.
 */
export function faixas(textos = TEXTOS) {
  if (forma) return forma.faixas(faixasPadrao(textos));
  return faixasPadrao(textos);
}
function faixasPadrao(textos) {
  const A = ARQUIBANCADA;
  // 8 no lado de lá (o que a câmera de TV mostra), depois a organizada e o setor visitante
  const pos = [
    [0, -50, 11], [0, -27, 12], [0, 3, 13], [0, 30, 11], [0, -39, 9], [0, 15, 10], [0, 45, 12], [0, -12.5, 9],
    [1, -6, 14], [2, -4, 13], [0, 56.5, 9.5], [2, 9, 11],
  ];
  return pos.map(([setor, c, larg], i) => {
    const [texto, fundo, letra, detalhe, detalheCor] = textos[i] ?? TEXTOS[i];
    return { texto, fundo, letra, detalhe, ...(detalheCor ? { detalheCor } : {}), setor, centro: c, larg, slot: i, z: setor === 0 ? -A.frenteZ : null, x: setor === 0 ? null : (setor === 1 ? 1 : -1) * A.fundoX0 };
  });
}

/**
 * Bandeiras de mastro, na ordem de prioridade (Baixa ⊂ Média ⊂ Alta): {x, y, z (a mão do torcedor), ex, ez (eixo do
 * pano na horizontal, ao longo da mureta), nx, nz (normal do pano: para o campo), desenho 0–3, fase 0–2π}.
 * Fileiras 0–5 da frente do lado de lá e 1–7 da organizada (fundo +x, z −18…18), espalhadas (nunca duas a < 4 m).
 */
export function bandeiras() {
  if (forma) return forma.bandeiras(BANDEIRAS.bandeiras.alta, BANDEIRAS.mao);
  const A = ARQUIBANCADA, B = BANDEIRAS;
  const r = geradorTorcida(20261012);
  const lista = [];
  const longe = (x, z) => lista.every(b => Math.hypot(b.x - x, b.z - z) >= 4);
  let tentativas = 0;
  while (lista.length < B.bandeiras.alta && tentativas < 5000) {
    tentativas++;
    const org = r() < 0.3;
    const fileira = org ? 1 + Math.floor(r() * 7) : Math.floor(r() * 6);        // da frente (0) para cima
    const s = (fileira + 0.5) / A.fileiras;                                       // fração da profundidade
    let x, y, z, ex, ez, nx, nz;
    if (org) {
      const sF = s / A.vFundo;
      x = A.fundoX0 + A.profFundo * sF; y = A.yBase + (A.yTopoFundo - A.yBase) * sF; z = -17 + 34 * r();
      ex = 0; ez = 1; nx = -1; nz = 0;
    } else {
      x = -58 + 116 * r(); y = A.yBase + (A.yTopoLado - A.yBase) * s; z = -(A.frenteZ + A.profLado * s);
      ex = 1; ez = 0; nx = 0; nz = 1;
    }
    if (!longe(x, z)) continue;
    lista.push({ x, y: y + B.mao, z, ex, ez, nx, nz, desenho: Math.floor(r() * 4) % 4, fase: r() * 2 * Math.PI, org });
  }
  return lista;
}

/**
 * Bandeirões: {nome, A (canto da frente à esquerda, no ar sobre as cabeças), U (vetor da largura), V (vetor da
 * profundidade, subindo a arquibancada), N (normal, para cima e para o campo), larg, prof, slot}. O lado de lá (40 ×
 * 10 m nas fileiras da frente, no meio) e a organizada (24 × 14 m, fundo +x).
 */
export function bandeiroes() {
  if (forma) return forma.bandeiroes(BANDEIRAS.bandeirao.altura);
  const A = ARQUIBANCADA, B = BANDEIRAS.bandeirao;
  const out = [];
  {
    // lado de lá: a rampa vai de (y 1,4, z −44,5) a (y 20, z −74,5)
    const dz = -A.profLado, dy = A.yTopoLado - A.yBase, L = Math.hypot(dz, dy);
    const V = [0, dy / L, dz / L], N = [0, -dz / L, dy / L];   // N para cima e para o campo (+z)
    const prof = 10, larg = 40, s0 = 0.4;                         // começa 0,4 m rampa acima da mureta
    const base = [-larg / 2, A.yBase + V[1] * s0, -A.frenteZ + V[2] * s0];
    out.push({ nome: 'lado', A: base.map((v, i) => v + N[i] * B.altura), U: [larg, 0, 0], V: V.map(v => v * prof), N, larg, prof, slot: 0 });
  }
  {
    // organizada (fundo +x): a rampa vai de (x 62,5, y 1,4) a (x 88,5, y 17)
    const dx = A.profFundo, dy = A.yTopoFundo - A.yBase, L = Math.hypot(dx, dy);
    const V = [dx / L, dy / L, 0], N = [-dy / L, dx / L, 0];   // N para cima e para o campo (−x)
    const prof = 14, larg = 24, s0 = 0.4;
    // visto do campo (olhando para +x) a direita é +z: a largura vai de −z para +z (o desenho lê certo)
    const base = [A.fundoX0 + V[0] * s0, A.yBase + V[1] * s0, -larg / 2];
    out.push({ nome: 'organizada', A: base.map((v, i) => v + N[i] * B.altura), U: [0, 0, larg], V: V.map(v => v * prof), N, larg, prof, slot: 1 });
  }
  return out;
}

/**
 * O ponto p (x, y, z) está debaixo do bandeirão b (bandeiroes()) aberto `abre` (0–1, festa.js aberturaBandeirao)? A
 * projeção de p no plano do pano (U na largura, V na profundidade; o pano sobe pela normal N, perpendicular aos dois)
 * cai no pedaço já aberto, com a margem [mu, mv] em m. A MESMA conta de SOB_GLSL (torcida.js e bandeiras.js).
 */
export function sobBandeirao(p, b, abre, [mu, mv] = [0, 0]) {
  if (!(abre > 0)) return false;
  const dx = p[0] - b.A[0], dy = p[1] - b.A[1], dz = p[2] - b.A[2];
  const lu = Math.hypot(b.U[0], b.U[1], b.U[2]), lv = Math.hypot(b.V[0], b.V[1], b.V[2]);
  const u = (dx * b.U[0] + dy * b.U[1] + dz * b.U[2]) / lu, v = (dx * b.V[0] + dy * b.V[1] + dz * b.V[2]) / lv;
  return u > -mu && u < lu + mu && v > -mv && v < lv * abre + mv;
}

const TAU = Math.PI * 2;
/**
 * Pano da bandeira no tempo t: o ponto (a, b) do pano (a = m ao longo do pano a partir do mastro, b = m abaixo do topo)
 * → {la, lb, ln}: coordenadas locais já com o balanço do mastro (no plano do pano, em volta da mão) e a onda (para fora
 * do pano). base = a mão; o mastro sobe B.mastro e o pano fica no topo. animada = 0 na Baixa (parada).
 */
export function pontoBandeira(a, b, fase, t, animada = 1) {
  const B = BANDEIRAS, O = B.onda;
  const u = a / B.largura;
  const d = animada ? O.amp * u * Math.sin(O.k * a - O.w * t + fase) + O.ruido * u * Math.sin(2.3 * O.k * a - 1.7 * O.w * t + 2 * fase + 1.3 * b) : 0;
  // o pano cai um pouco na ponta (gravidade) quando não há vento
  const cai = 0.12 * u * u;
  // posição no plano antes do balanço: x = ao longo, y = altura acima da mão
  const px = a, py = B.mastro - b - cai;
  const th = animada ? O.bal * Math.sin(TAU * O.balHz * t + fase) : 0;
  const c = Math.cos(th), s = Math.sin(th);
  return { la: c * px - s * py, lb: s * px + c * py, ln: d };
}

const g = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** vec3 bandeiraPonto(float a, float b, float fase, float t, float animada) → (la, lb, ln): a MESMA conta. */
export const BANDEIRA_GLSL = (() => {
  const B = BANDEIRAS, O = B.onda;
  return `
vec3 bandeiraPonto(float a, float b, float fase, float t, float animada) {
  float u = a / ${g(B.largura)};
  float d = animada > 0.5 ? ${g(O.amp)} * u * sin(${g(O.k)} * a - ${g(O.w)} * t + fase) + ${g(O.ruido)} * u * sin(${g(2.3 * O.k)} * a - ${g(1.7 * O.w)} * t + 2.0 * fase + 1.3 * b) : 0.0;
  float cai = 0.12 * u * u;
  float px = a;
  float py = ${g(B.mastro)} - b - cai;
  float th = animada > 0.5 ? ${g(O.bal)} * sin(${g(TAU * O.balHz)} * t + fase) : 0.0;
  float c = cos(th), s = sin(th);
  return vec3(c * px - s * py, s * px + c * py, d);
}
`;
})();

/** Bandeirão: deslocamento (m, pela normal) do ponto (u, v) 0–1 aberto, no tempo t (a onda que corre na largura). */
export function ondaBandeirao(u, v, larg, t, animada = 1) {
  const B = BANDEIRAS.bandeirao;
  if (!animada) return 0;
  return B.onda * Math.sin(B.ondaK * u * larg - B.ondaW * t) * (0.6 + 0.4 * Math.sin(3.1 * v + 0.7 * t));
}
/** float sobBandeirao(vec3 p, vec3 A, vec3 U, vec3 V, float abre, vec2 margem) → 1 debaixo do pano aberto: a MESMA conta. */
export const SOB_GLSL = `
float sobBandeirao(vec3 p, vec3 A, vec3 U, vec3 V, float abre, vec2 margem) {
  if (!(abre > 0.0)) return 0.0;
  vec3 d = p - A;
  float lu = length(U), lv = length(V);
  float u = dot(d, U) / lu, v = dot(d, V) / lv;
  return (u > -margem.x && u < lu + margem.x && v > -margem.y && v < lv * abre + margem.y) ? 1.0 : 0.0;
}
`;
export const BANDEIRAO_GLSL = (() => {
  const B = BANDEIRAS.bandeirao;
  return `
float ondaBandeirao(float u, float v, float larg, float t, float animada) {
  if (animada < 0.5) return 0.0;
  return ${g(B.onda)} * sin(${g(B.ondaK)} * u * larg - ${g(B.ondaW)} * t) * (0.6 + 0.4 * sin(3.1 * v + 0.7 * t));
}
`;
})();
