// LUGARES DA HISTÓRIA (pontos de referência): a Delegacia Central, o jornal Picture News, o Café Jitters, a Prefeitura com
// o relógio, a casa da família West, a ponte e o Presídio Iron Heights na ilha. PURO (sem three.js nem DOM).
// Cada lugar da cidade ocupa um quarteirão inteiro (no lugar do sorteio): prédios em "lotes" (o mesmo desenho dos prédios
// da cidade, com o estilo de fachada escolhido) + sólidos extras (colunas, marquises, cerca...) + a entrada (onde as
// missões levam). A ponte e o presídio ficam FORA da grade, a leste, sobre o mar: têm os próprios sólidos e o próprio
// limite por onde o herói pode andar (limitarFora).
// Coordenadas LOCAIS dos lugares da cidade: u = x − centro da célula, v = z − centro; a frente olha para −v (rua de cima).
export const MARCOS = [
  {
    id: 'delegacia', nome: 'Delegacia Central', cel: [24, 21], entrada: [0, -27],
    lotes: [
      { u: [-24, 24], v: [-6, 24], h: 22, estilo: 2, tom: 2 },           // o prédio: concreto claro, cinco andares
      { u: [-11, 11], v: [-18, -6], h: 9, estilo: 2, tom: 2 },           // o saguão na frente
    ],
    solidos: [[-10.4, -9.6, -21.6, -20.8, 0, 9], [-3.9, -3.1, -21.6, -20.8, 0, 9], [3.1, 3.9, -21.6, -20.8, 0, 9], [9.6, 10.4, -21.6, -20.8, 0, 9], [-11, 11, -22, -18, 9, 10.2],
      // as viaturas estacionadas de frente para o prédio
      ...[-21, -16, 16, 21].map((u) => [u - 0.95, u + 0.95, -28.4, -24.1, 0, 1.45])],
    viaturas: [-21, -16, 16, 21],
  },
  {
    id: 'jornal', nome: 'Picture News', cel: [20, 20], entrada: [0, -27],
    lotes: [
      { u: [-26, 26], v: [-24, 24], h: 12, estilo: 5, tom: 1 },          // o pódio com o letreiro corrido das notícias
      { u: [-17, 17], v: [-15, 15], h: 66, estilo: 5, tom: 1, y0: 12 },  // a torre art déco
      { u: [-9, 9], v: [-7, 7], h: 12, estilo: 5, tom: 1, y0: 78 },      // o coroamento
    ],
    solidos: [],
  },
  {
    id: 'cafe', nome: 'Café Jitters', cel: [24, 24], entrada: [-14, -29],
    lotes: [
      { u: [-27, -1], v: [-27, -4], h: 13, estilo: 1, tom: 1, loja: true },   // o café no térreo de um prédio de tijolo
      { u: [3, 27], v: [-27, -6], h: 31, estilo: 3, tom: 0 },
      { u: [-27, -6], v: [1, 27], h: 22, estilo: 4, tom: 1 },
      { u: [0, 27], v: [-2, 27], h: 46, estilo: 0, tom: 2 },
    ],
    solidos: [],
  },
  {
    id: 'prefeitura', nome: 'Prefeitura', cel: [21, 24], entrada: [0, -6],
    lotes: [
      { u: [-27, 27], v: [0, 24], h: 17, estilo: 2, tom: 1 },            // a prefeitura, larga e baixa
      { u: [-5, 5], v: [5, 15], h: 30, estilo: 2, tom: 1, y0: 17 },      // a torre do relógio (até 47 m)
    ],
    // as 6 colunas do pórtico, o frontão, a fonte da praça
    solidos: [...[-12.5, -7.5, -2.5, 2.5, 7.5, 12.5].map((u) => [u - 0.5, u + 0.5, -3.5, -2.5, 0, 14]), [-14, 14, -4, 0, 14, 15.2], [-3.2, 3.2, -19.2, -12.8, 0, 0.9]],
    arvores: [[-22, -24, 1], [-22, -12, 0.9], [22, -24, 1], [22, -12, 0.95]],
  },
  {
    id: 'casa', nome: 'Casa da família West', cel: [6, 24], entrada: [0, -12],
    lotes: [
      { u: [-6, 6], v: [-3, 7], h: 6.4, estilo: 4, tom: 1, telhado: 3.2 },   // a casa (dois andares e telhado de duas águas)
      { u: [-27, -13], v: [-27, -12], h: 7, estilo: 4, tom: 0 }, { u: [13, 27], v: [-27, -13], h: 6, estilo: 4, tom: 2 },
      { u: [-27, -14], v: [10, 27], h: 8, estilo: 4, tom: 2 }, { u: [14, 27], v: [9, 27], h: 7, estilo: 4, tom: 0 },
    ],
    // a varanda (o telhadinho), a cerca baixa do quintal (com o portão aberto na frente)
    solidos: [[-6, 6, -5.6, -3, 2.9, 3.1], [-11, -1.2, -9.15, -8.85, 0, 1.0], [1.2, 11, -9.15, -8.85, 0, 1.0], [-11.15, -10.85, -9, 11, 0, 1.0], [10.85, 11.15, -9, 11, 0, 1.0], [-11, 11, 10.85, 11.15, 0, 1.0]],
    arvores: [[-8, 8, 1.1], [8.5, -6.5, 0.8], [-20, -2, 1], [20, 2, 0.9]],
  },
];
export const marcoDaCelula = (i, j) => MARCOS.find((m) => m.cel[0] === i && m.cel[1] === j) || null;

// ---------- fora da grade: a ponte e a ilha do presídio (a leste da cidade, sobre o mar) ----------
// mesmas contas da cidade (cidade.js importa este arquivo; aqui só os números): célula de 76 m, cidade de 44 células
const CELL = 76, N = 44, MEIO = (N * CELL) / 2;
const eixo = (k) => k * CELL - MEIO;
export const PONTE = { z: eixo(18), x0: MEIO + 8, x1: MEIO + 300, larg: 16, torres: [MEIO + 85, MEIO + 220], alturaTorre: 62 };
export const ILHA = { x0: MEIO + 296, x1: MEIO + 556, z0: eixo(18) - 130, z1: eixo(18) + 130 };
const IC = { x: (ILHA.x0 + ILHA.x1) / 2, z: (ILHA.z0 + ILHA.z1) / 2 };
export const PRESIDIO = {
  cx: IC.x + 20, cz: IC.z, meio: 85, muro: 11, esp: 1.6,
  portao: [-9, 9],                                          // o portão no muro oeste (de frente para a ponte), aberto
  torres: 4, ladoTorre: 6, alturaTorre: 20,
  blocos: [                                                 // pavilhões das celas e a administração (mundo)
    { x0: IC.x - 10, x1: IC.x + 72, z0: IC.z - 62, z1: IC.z - 38, h: 14 },
    { x0: IC.x - 10, x1: IC.x + 72, z0: IC.z + 38, z1: IC.z + 62, h: 14 },
    { x0: IC.x + 40, x1: IC.x + 90, z0: IC.z - 16, z1: IC.z + 16, h: 22 },
    { x0: IC.x - 52, x1: IC.x - 30, z0: IC.z - 26, z1: IC.z + 26, h: 10 },
  ],
};
export const ENTRADA_PONTE = { x: MEIO - 2, z: PONTE.z };
export const ENTRADA_PRESIDIO = { x: PRESIDIO.cx - PRESIDIO.meio - 14, z: PRESIDIO.cz };

/** Sólidos de fora da grade (ponte e presídio), em coordenadas do mundo. */
export function solidosFora() {
  const R = [], add = (x0, x1, z0, z1, y0, y1) => R.push({ x0, x1, z0, z1, y0, y1 });
  const P = PONTE, hz = P.larg / 2;
  add(P.x0 - 8, P.x1 + 8, P.z - hz, P.z + hz, -5, 0.3);                       // o tabuleiro (chão)
  add(P.x0, P.x1, P.z - hz - 0.4, P.z - hz, 0.3, 1.4); add(P.x0, P.x1, P.z + hz, P.z + hz + 0.4, 0.3, 1.4);   // guarda-corpos
  add(ILHA.x0, ILHA.x1, ILHA.z0, ILHA.z1, -5, 0.3);                           // o chão da ilha
  const Q = PRESIDIO, m = Q.meio, e = Q.esp, h = Q.muro, cx = Q.cx, cz = Q.cz;
  add(cx - m, cx + m, cz - m - e, cz - m, 0.3, h); add(cx - m, cx + m, cz + m, cz + m + e, 0.3, h);
  add(cx + m, cx + m + e, cz - m - e, cz + m + e, 0.3, h);
  add(cx - m - e, cx - m, cz - m - e, cz + Q.portao[0], 0.3, h); add(cx - m - e, cx - m, cz + Q.portao[1], cz + m + e, 0.3, h);
  add(cx - m - e, cx - m, cz + Q.portao[0], cz + Q.portao[1], 7, h);         // a verga do portão
  const t = Q.ladoTorre / 2;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add(cx + sx * m - t, cx + sx * m + t, cz + sz * m - t, cz + sz * m + t, 0.3, Q.alturaTorre);
  for (const b of Q.blocos) add(b.x0, b.x1, b.z0, b.z1, 0.3, b.h);
  return R;
}
let cacheFora = null;
/** Sólidos de fora perto de (x, z): só quando o herói está na borda leste ou além. */
export function solidosForaPerto(x, z) {
  if (x < MEIO - CELL * 1.5) return [];
  return cacheFora || (cacheFora = solidosFora());
}

/** Onde o herói pode estar: dentro da cidade, no tabuleiro da ponte ou na ilha. Devolve {x, z} (o ponto permitido mais perto). */
export function limitar(x, z, folga = 4) {
  const caixas = [
    [-MEIO + folga, MEIO - folga, -MEIO + folga, MEIO - folga],
    [MEIO - folga - 1, ILHA.x0 + 2, PONTE.z - PONTE.larg / 2 + 1, PONTE.z + PONTE.larg / 2 - 1],
    [ILHA.x0 + 1, ILHA.x1 - folga, ILHA.z0 + folga, ILHA.z1 - folga],
  ];
  let melhor = null, md = Infinity;
  for (const [a, b, c, d] of caixas) {
    const px = Math.max(a, Math.min(b, x)), pz = Math.max(c, Math.min(d, z)), dd = (px - x) ** 2 + (pz - z) ** 2;
    if (dd < md) { md = dd; melhor = { x: px, z: pz }; }
    if (dd === 0) break;
  }
  return melhor;
}


// ---------- onde os aliados (Joe e Iris) esperam o herói em cada passo da história ----------
// h = para onde a pessoa olha (o rumo do jogo: 0 = +z, π = −z, −π/2 = −x). Lugares da cidade em coordenadas locais.
export const PONTOS = {
  delegacia: { marco: 'delegacia', u: 0, v: -23.4, h: Math.PI },
  jornal: { marco: 'jornal', u: -3, v: -26.6, h: Math.PI },
  cafe: { marco: 'cafe', u: -14, v: -28.4, h: Math.PI },
  casa: { marco: 'casa', u: 0, v: -6.2, h: Math.PI },
  prefeitura: { marco: 'prefeitura', u: -2.2, v: -6.6, h: Math.PI },
  prefeitura2: { marco: 'prefeitura', u: 2.2, v: -6.6, h: Math.PI },
  presidio: { x: ENTRADA_PRESIDIO.x + 8, z: ENTRADA_PRESIDIO.z, h: -Math.PI / 2 },
};
/** O ponto em coordenadas do mundo: {x, z, h}. */
export function pontoMundo(id) {
  const p = PONTOS[id]; if (!p) return null;
  if (!p.marco) return { x: p.x, z: p.z, h: p.h };
  const m = MARCOS.find((k) => k.id === p.marco), cx = (m.cel[0] + 0.5) * CELL - MEIO, cz = (m.cel[1] + 0.5) * CELL - MEIO;
  return { x: cx + p.u, z: cz + p.v, h: p.h };
}
/** Subestações de energia que o Zoom desligou (missão "Apagão"): numa esquina de calçada, perto de três cruzamentos. */
export const SUBESTACOES = [[17, 26], [27, 17], [28, 28]].map(([i, j]) => ({ x: eixo(i) + 9, z: eixo(j) + 9 }));
