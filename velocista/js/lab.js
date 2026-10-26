// LABORATÓRIOS ESTRELA — o plano (puro: sem three.js nem DOM). Uma só fonte para a colisão (retângulos) e para o desenho
// (lab3d.js lê PAREDES, CELAS, CONSOLES... daqui). Coordenadas LOCAIS: u = x - cx, v = z - cz, y para cima.
// A FRENTE (entrada) olha para -z. Sem aleatoriedade: o plano é determinístico.
export const LAB_CELULA = [22, 22];          // célula de canto (noroeste) do campus, logo a nordeste do centro da cidade (N = 44)
// o CAMPUS ocupa 2 × 2 células (22–23 nos dois eixos): as ruas de dentro viram praça e o prédio fica no meio dele
export const CAMPUS = { n: 2, meio: 68 };    // meio = metade do lado da praça (2 × 76 − 16 de rua = 136 m)
export const H = 16;                 // altura dos tetos de dentro (as salas ficam abaixo dela)
export const TOPO = 30;              // telhado do prédio principal: a massa de H a TOPO é um bloco só (o Cortex sobe num poço até a cúpula)
export const PISO = 0.3;             // topo da laje do quarteirão (CALCADA)
export const PORTA_Y = 5;            // topo dos vãos (verga: y0 = 5)
export const LAB = { meio: 27, esp: 1 };

/**
 * Paredes: eixo 'x' = corre ao longo de u na posição v = c; eixo 'z' = corre ao longo de v na posição u = c.
 * a..b = trecho; t = espessura; vaos = [[s0, s1]] (portas, de PORTA_Y para baixo livres); janelas = [[s0, s1]] (vidro no
 * desenho; a colisão continua sólida); ext = lado de fora (±1 no eixo perpendicular) ou 0 para parede interna.
 */
export const PAREDES = [
  { id: 'frente', eixo: 'x', c: -26.5, t: 1, a: -27, b: 27, ext: -1, vaos: [[-4, 4]], janelas: [[-26, -5.2], [5.2, 26]], jy: [1.4, 8.8] },
  { id: 'fundo', eixo: 'x', c: 26.5, t: 1, a: -27, b: 27, ext: 1, vaos: [[-3, 3]], janelas: [[-24, -15], [-11, -3], [3, 11], [15, 24]], jy: [3.2, 8.2] },
  { id: 'oeste', eixo: 'z', c: -26.5, t: 1, a: -26, b: 26, ext: -1, vaos: [[-3, 3]], janelas: [[-24, -14], [-11, 11], [14, 24]], jy: [3.2, 8.2] },
  { id: 'leste', eixo: 'z', c: 26.5, t: 1, a: -26, b: 26, ext: 1, vaos: [[-3, 3]], janelas: [[-24, -14], [-11, 11], [14, 24]], jy: [3.2, 8.2] },
  // átrio | alas
  { id: 'atrio', eixo: 'x', c: -13, t: 1, a: -26, b: 26, ext: 0, vaos: [[-24, -16], [-3, 3], [17, 23]], janelas: [[-12.4, -3.8], [3.8, 12.4]], jy: [1.2, 7.2] },
  // alas | acelerador
  { id: 'norte', eixo: 'x', c: 13, t: 1, a: -26, b: 26, ext: 0, vaos: [[-24, -16], [-3, 3], [17, 23]], janelas: [], jy: [1.2, 7.2] },
  // Cortex
  { id: 'cortexO', eixo: 'z', c: -13, t: 1, a: -12.5, b: 12.5, ext: 0, vaos: [[-3, 3]], janelas: [], jy: [1.2, 7.2] },
  { id: 'cortexL', eixo: 'z', c: 13, t: 1, a: -12.5, b: 12.5, ext: 0, vaos: [[-3, 3]], janelas: [], jy: [1.2, 7.2] },
];

export const SALAS = {
  atrio: { u: [-26, 26], v: [-26, -13.5], teto: 12 },
  cortex: { u: [-12.5, 12.5], v: [-12.5, 12.5], teto: H },
  contencao: { u: [13.5, 26], v: [-12.5, 12.5], teto: 8 },
  esteira: { u: [-26, -13.5], v: [-12.5, 12.5], teto: 11 },
  acelerador: { u: [-26, 26], v: [13.5, 26], teto: 13 },
  // os anexos (ANEXO_PAREDES): a Câmara do Núcleo no térreo da torre e duas salas + um saguão em cada ala
  nucleo: { u: [-21, 21], v: [39, 61], teto: 34 },
  medica: { u: [-61, -37], v: [-29, -6.5], teto: 10 },
  alaOeste: { u: [-61, -37], v: [-5.5, 5.5], teto: 10 },
  oficina: { u: [-61, -37], v: [6.5, 39], teto: 10 },
  trajes: { u: [37, 61], v: [-29, -6.5], teto: 10 },
  alaLeste: { u: [37, 61], v: [-5.5, 5.5], teto: 10 },
  fenda: { u: [37, 61], v: [6.5, 39], teto: 10 },
  corredorNorte: { u: [-3.5, 3.5], v: [27, 38], teto: 6 },
  corredorOeste: { u: [-36, -27], v: [-3.5, 3.5], teto: 6 },
  corredorLeste: { u: [27, 36], v: [-3.5, 3.5], teto: 6 },
};

// celas de vidro da Contenção: lado -1 = oeste do corredor (u 14..17), +1 = leste (u 23..26)
export const CELAS = [];
{
  const faixas = [[-11.5, -8], [-7.5, -4], [4, 7.5], [8, 11.5]];
  let n = 1;
  for (const lado of [-1, 1]) for (const [v0, v1] of faixas) {
    CELAS.push({ n: n++, lado, u0: lado < 0 ? 14 : 23, u1: lado < 0 ? 17 : 26, v0, v1, y1: 4.6 });
  }
}
export const BALCAO = { u0: -22, u1: -12, v0: -22, v1: -19.8, y1: 1.25 };
export const COLUNAS = [[-8, -19.5], [8, -19.5], [-8, -15.5], [8, -15.5]];     // centros (u, v); 1 × 1 m
export const CONSOLES = [];
for (const v of [5.2, -6.4]) for (const [u0, u1] of [[-10.5, -4.8], [4.8, 10.5]]) CONSOLES.push({ u0, u1, v0: v, v1: v + 1.3, y1: 1.05 });
export const MESA_HOLO = { u0: -2.2, u1: 2.2, v0: -2.2, v1: 2.2, y1: 1.1 };
export const TUBO = { v: 20, u0: -25, u1: 25, y: 2.6, r: 0.9 };
export const ANEIS_ACEL = [-24, -18, -12, -6, 0, 6, 12, 18, 24].map((u) => ({ u, v: 20, R: 2.4 }));
export const TORRES_ENERGIA = [[-22.5, 23.5], [22.5, 23.5], [-22.5, 15.5], [22.5, 15.5]];  // centros, 2 × 2 m
export const PLATAFORMA_ESTEIRA = { u0: -22, u1: -17.5, v0: -5, v1: 5, y1: 0.36 };
export const ANEL_TELHADO = { R: 24, y: TOPO + 3.6, tubo: 1.1, pilones: 8 };
export const DOME = { R: 15.2, cy: TOPO - 5.4, theta: 1.208, furo: 10 };
export const TELHADO_COISAS = {
  torres: [[-22, 22, 4], [22, 22, 4]],                // [u, v, lado] torres de resfriamento
  tanque: [22, -22, 3], parabolica: [-22, -22, 2], mastro: [10, -24],
};
// lajes [u0, u1, v0, v1]: um bloco de H − 1 até TOPO (os andares de cima, fechados); o Cortex tem um poço de 20 × 20 até a cúpula
export const LAJES = [
  [-26.5, 26.5, -26.5, -10], [-26.5, 26.5, 10, 26.5], [-26.5, -10, -10, 10], [10, 26.5, -10, 10],
];
// O CAMPUS em volta (coordenadas locais do prédio, que fica no meio da praça): a torre principal atrás, as duas alas dos
// lados, as passarelas no alto ligando tudo (por baixo delas se passa) e o anel do acelerador enterrado na praça.
export const TORRE = { u0: -22, u1: 22, v0: 38, v1: 62, y1: 128, coroa: { u0: -15, u1: 15, v0: 43, v1: 57, y1: 140 }, mastro: 26 };
export const ALAS = [
  { lado: -1, u0: -62, u1: -36, v0: -30, v1: 40, y1: 42 },
  { lado: 1, u0: 36, u1: 62, v0: -30, v1: 40, y1: 42 },
];
export const PASSARELAS = [
  { u0: -36, u1: -27, v0: -6, v1: 6, y0: 14, y1: 20 },      // ala oeste ↔ prédio
  { u0: 27, u1: 36, v0: -6, v1: 6, y0: 14, y1: 20 },        // prédio ↔ ala leste
  { u0: -9, u1: 9, v0: 27, v1: 38, y0: 18, y1: 25 },        // prédio ↔ torre
];
export const ANEL_PRACA = { R: 52, larg: 2.6 };               // o acelerador enterrado: um sulco luminoso na praça

// ANEXOS (dono, 26/10: "o laboratório tá maior, mas não tem mais salas, o núcleo não está maior e mais marcante"): o térreo
// da TORRE vira a CÂMARA DO NÚCLEO AURORA (34 m de pé-direito, o reator no meio) e o térreo de cada ALA vira duas salas com
// um saguão no meio — oeste: Ala Médica e Oficina; leste: Sala dos Trajes e Sala da Fenda. Corredores envidraçados ligam
// tudo ao prédio principal pelo térreo (por baixo das passarelas do alto). Acima do teto de cada anexo, um bloco só até o
// alto do prédio (escalável por fora como antes). y1 = altura da parede; fachada = o lado de fora é a fachada do anexo
// (desenhada no campus), então a parede só desenha o lado de dentro.
export const ALA_TETO = 10;
export const CORREDOR = { teto: 6, t: 0.3 };
export const NUCLEO = { u: 0, v: 50, teto: 34, base: 6.6, coluna: 1.5, camisa: 2.3, esfera: { y: 14, r: 3.4 }, aneis: [5.0, 5.9, 6.8], pilares: { n: 6, R: 9.4, y1: 9 } };
const parAla = (lado) => {
  const s = lado, u0 = s < 0 ? -62 : 36, u1 = s < 0 ? -36 : 62, dentroU = s < 0 ? -36.5 : 36.5, foraU = s < 0 ? -61.5 : 61.5;
  const porta = s < 0 ? [-52, -46] : [46, 52], id = s < 0 ? 'ao' : 'al';
  return [
    { id: `${id}Fora`, eixo: 'z', c: foraU, t: 1, a: -30, b: 40, ext: s, fachada: true, y1: ALA_TETO, vaos: [], janelas: [] },
    { id: `${id}Dentro`, eixo: 'z', c: dentroU, t: 1, a: -30, b: 40, ext: -s, fachada: true, y1: ALA_TETO, vaos: [[-3, 3]], janelas: [] },
    { id: `${id}Frente`, eixo: 'x', c: -29.5, t: 1, a: u0, b: u1, ext: -1, fachada: true, y1: ALA_TETO, vaos: [], janelas: [] },
    { id: `${id}Fundo`, eixo: 'x', c: 39.5, t: 1, a: u0, b: u1, ext: 1, fachada: true, y1: ALA_TETO, vaos: [], janelas: [] },
    { id: `${id}Sul`, eixo: 'x', c: -6, t: 1, a: Math.min(dentroU, foraU), b: Math.max(dentroU, foraU), ext: 0, y1: ALA_TETO, vaos: [porta], janelas: [[porta[0] - 8, porta[0] - 1.5], [porta[1] + 1.5, porta[1] + 8]], jy: [1.2, 4.6] },
    { id: `${id}Norte`, eixo: 'x', c: 6, t: 1, a: Math.min(dentroU, foraU), b: Math.max(dentroU, foraU), ext: 0, y1: ALA_TETO, vaos: [porta], janelas: [[porta[0] - 8, porta[0] - 1.5], [porta[1] + 1.5, porta[1] + 8]], jy: [1.2, 4.6] },
  ];
};
export const ANEXO_PAREDES = [
  // a Câmara do Núcleo (térreo da torre: u −22..22, v 38..62)
  { id: 'toFrente', eixo: 'x', c: 38.5, t: 1, a: -22, b: 22, ext: -1, fachada: true, y1: NUCLEO.teto, vaos: [[-3, 3]], janelas: [] },
  { id: 'toFundo', eixo: 'x', c: 61.5, t: 1, a: -22, b: 22, ext: 1, fachada: true, y1: NUCLEO.teto, vaos: [], janelas: [] },
  { id: 'toOeste', eixo: 'z', c: -21.5, t: 1, a: 38, b: 62, ext: -1, fachada: true, y1: NUCLEO.teto, vaos: [], janelas: [] },
  { id: 'toLeste', eixo: 'z', c: 21.5, t: 1, a: 38, b: 62, ext: 1, fachada: true, y1: NUCLEO.teto, vaos: [], janelas: [] },
  ...parAla(-1), ...parAla(1),
];
// corredores: duas paredes de vidro e um teto baixo (a: b ao longo do corredor; c = a linha de cada parede)
export const CORREDORES = [
  { id: 'corredorNorte', eixo: 'z', cs: [-3.5, 3.5], a: 27, b: 38 },
  { id: 'corredorOeste', eixo: 'x', cs: [-3.5, 3.5], a: -36, b: -27 },
  { id: 'corredorLeste', eixo: 'x', cs: [-3.5, 3.5], a: 27, b: 36 },
];
// a mobília que é sólida nos anexos [u0, u1, v0, v1, y1]
export const MOVEIS_ANEXOS = [
  // Ala Médica: 4 leitos junto da parede oeste, os armários do sul e o tomógrafo (anel) no meio
  ...[-26, -21, -16, -11].map((v) => [-60.6, -56.6, v - 1.1, v + 1.1, 0.95]),
  [-60.6, -40, -29, -27.8, 2.4], [-45.2, -42.8, -21.4, -14.6, 1.0], [-46.2, -41.8, -18.5, -17.5, 4.2],
  // Oficina: duas fileiras de bancadas, a parede de ferramentas e as prateleiras do fundo
  ...[[-57, -51], [-47, -41]].flatMap(([u0, u1]) => [[u0, u1, 13, 15, 1.0], [u0, u1, 22, 24, 1.0], [u0, u1, 31, 33, 1.0]]),
  [-61, -60.2, 9, 37, 3.2], [-58, -40, 37.8, 39, 4.2],
  // Sala dos Trajes: as vitrines (de vidro, sólidas)
  ...[-25, -18.5, -12].map((v) => [58, 61, v - 1.5, v + 1.5, 3.4]), ...[-25, -18.5, -12].map((v) => [37, 40, v - 1.5, v + 1.5, 3.4]),
  // Sala da Fenda: a base do anel e os consoles
  [46.6, 51.4, 26.6, 29.4, 1.2], [44, 54, 13, 14.4, 1.05],
  // saguões: bancos
  [-55, -51, -1, 1, 0.5], [51, 55, -1, 1, 0.5],
  // o manequim do traje protótipo na Oficina; os pilares do anel da Fenda
  [-44.4, -43.6, 27.1, 27.9, 2.2], [44.4, 45.6, 27.4, 28.6, 4.8], [52.4, 53.6, 27.4, 28.6, 4.8],
  // Câmara do Núcleo: os consoles dos lados e os conduítes do fundo
  [-19.6, -18.2, 45, 55, 1.05], [18.2, 19.6, 45, 55, 1.05],
  ...[-17, -11, 11, 17].map((u) => [u - 0.5, u + 0.5, 59.7, 61, NUCLEO.teto]),
];
export const MONUMENTO = { u0: 12, u1: 40, v0: -62, v1: -59.6, y1: 4.4 };     // o letreiro de pedra na entrada do campus (ao lado do caminho)
export const FRENTE = { cerca: 29.4, portao: [-6, 6], marquise: { u: [-8, 8], v0: -27, v1: -32, y: 5.3 }, guarita: { u0: 8, u1: 10.6, v0: -29, v1: -27.4, y1: 2.7 } };

const r6 = (n) => Math.round(n * 1e6) / 1e6;

/** Retângulos de uma parede (segmentos entre vãos + a verga sobre cada vão). Local (u, v). */
function retangulosParede(p) {
  const out = [];
  const vaos = p.vaos.slice().sort((x, y) => x[0] - y[0]);
  const seg = (s0, s1, y0, y1) => {
    if (s1 - s0 < 1e-6) return;
    if (p.eixo === 'x') out.push({ x0: s0, x1: s1, z0: p.c - p.t / 2, z1: p.c + p.t / 2, y0, y1 });
    else out.push({ x0: p.c - p.t / 2, x1: p.c + p.t / 2, z0: s0, z1: s1, y0, y1 });
  };
  const topo = p.y1 ?? (p.ext ? TOPO : H);
  let cur = p.a;
  for (const [s0, s1] of vaos) { seg(cur, s0, PISO, topo); seg(s0, s1, PORTA_Y, topo); cur = s1; }
  seg(cur, p.b, PISO, topo);
  return out;
}

/** Plano do laboratório centrado em (cx, cz): retângulos de colisão (mundo) e consultas. */
export function planoLab(cx, cz) {
  const L = [];
  const add = (u0, u1, v0, v1, y0, y1) => L.push({ x0: r6(cx + u0), x1: r6(cx + u1), z0: r6(cz + v0), z1: r6(cz + v1), y0, y1 });
  const addLocal = (q) => add(q.x0, q.x1, q.z0, q.z1, q.y0, q.y1);

  for (const p of [...PAREDES, ...ANEXO_PAREDES]) for (const q of retangulosParede(p)) addLocal(q);

  // os andares de cima (fechados) e o telhado
  for (const [a, b, c, d] of LAJES) add(a, b, c, d, H - 1, TOPO);
  // platibanda (0,5 m de espessura, 1 m de altura) na borda do telhado
  add(-27, 27, -27, -26.5, TOPO, TOPO + 1); add(-27, 27, 26.5, 27, TOPO, TOPO + 1);
  add(-27, -26.5, -26.5, 26.5, TOPO, TOPO + 1); add(26.5, 27, -26.5, 26.5, TOPO, TOPO + 1);

  // átrio
  add(BALCAO.u0, BALCAO.u1, BALCAO.v0, BALCAO.v1, PISO, BALCAO.y1);
  for (const [u, v] of COLUNAS) add(u - 0.5, u + 0.5, v - 0.5, v + 0.5, PISO, H - 1);
  // Cortex
  for (const c of CONSOLES) add(c.u0, c.u1, c.v0, c.v1, PISO, c.y1);
  add(MESA_HOLO.u0, MESA_HOLO.u1, MESA_HOLO.v0, MESA_HOLO.v1, PISO, MESA_HOLO.y1);
  // Contenção
  for (const c of CELAS) add(c.u0, c.u1, c.v0, c.v1, PISO, c.y1);
  // Esteira
  // a esteira é rasa (sem degrau); só os corrimãos das laterais são sólidos (as pontas ficam abertas)
  for (const u of [PLATAFORMA_ESTEIRA.u0 - 0.1, PLATAFORMA_ESTEIRA.u1 + 0.1]) add(u - 0.08, u + 0.08, PLATAFORMA_ESTEIRA.v0, PLATAFORMA_ESTEIRA.v1, PISO, 1.2);
  // Acelerador: o tubo (por baixo passa), os ímãs e as torres de energia
  add(TUBO.u0, TUBO.u1, TUBO.v - TUBO.r, TUBO.v + TUBO.r, 2.2, 3.2);
  for (const a of ANEIS_ACEL) add(a.u - 0.35, a.u + 0.35, a.v - a.R, a.v + a.R, PISO, 5.1);
  for (const [u, v] of TORRES_ENERGIA) add(u - 1, u + 1, v - 1, v + 1, PISO, 7);
  // telhado: pilones do anel, torres de resfriamento, tanque, base da parabólica
  const A = ANEL_TELHADO;
  for (let k = 0; k < A.pilones; k++) { const a = (k / A.pilones) * Math.PI * 2; add(A.R * Math.cos(a) - 0.6, A.R * Math.cos(a) + 0.6, A.R * Math.sin(a) - 0.6, A.R * Math.sin(a) + 0.6, TOPO, A.y + 0.4); }
  for (const [u, v, l] of TELHADO_COISAS.torres) add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, TOPO, TOPO + 5);
  { const [u, v, l] = TELHADO_COISAS.tanque; add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, TOPO, TOPO + 6); }
  { const [u, v, l] = TELHADO_COISAS.parabolica; add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, TOPO, TOPO + 1.2); }
  // o campus: torre (e a coroa), alas, passarelas no alto e o letreiro de pedra
  // (a torre e as alas são ocas no térreo: as paredes vêm de ANEXO_PAREDES; daqui para cima é um bloco só)
  { const T = TORRE; add(T.u0, T.u1, T.v0, T.v1, NUCLEO.teto, T.y1); const c = T.coroa; add(c.u0, c.u1, c.v0, c.v1, T.y1, c.y1); }
  for (const a of ALAS) add(a.u0, a.u1, a.v0, a.v1, ALA_TETO, a.y1);
  for (const k of CORREDORES) for (const c of k.cs) {
    if (k.eixo === 'z') add(c - CORREDOR.t / 2, c + CORREDOR.t / 2, k.a, k.b, PISO, CORREDOR.teto); else add(k.a, k.b, c - CORREDOR.t / 2, c + CORREDOR.t / 2, PISO, CORREDOR.teto);
  }
  for (const k of CORREDORES) { const [c0, c1] = k.cs; if (k.eixo === 'z') add(c0 - 0.15, c1 + 0.15, k.a, k.b, CORREDOR.teto, CORREDOR.teto + 0.5); else add(k.a, k.b, c0 - 0.15, c1 + 0.15, CORREDOR.teto, CORREDOR.teto + 0.5); }
  // o Núcleo: a coluna (do chão ao teto), a esfera do reator e os pilares de contenção
  { const N = NUCLEO;
    add(N.u - N.camisa, N.u + N.camisa, N.v - N.camisa, N.v + N.camisa, PISO, N.teto);
    add(N.u - N.esfera.r, N.u + N.esfera.r, N.v - N.esfera.r, N.v + N.esfera.r, N.esfera.y - N.esfera.r, N.esfera.y + N.esfera.r);
    for (let k = 0; k < N.pilares.n; k++) { const a = (k / N.pilares.n) * Math.PI * 2, u = N.u + N.pilares.R * Math.cos(a), v = N.v + N.pilares.R * Math.sin(a); add(u - 0.7, u + 0.7, v - 0.7, v + 0.7, PISO, N.pilares.y1); } }
  for (const [u0, u1, v0, v1, y1] of MOVEIS_ANEXOS) add(u0, u1, v0, v1, PISO, y1);
  for (const p of PASSARELAS) add(p.u0, p.u1, p.v0, p.v1, p.y0, p.y1);
  add(MONUMENTO.u0, MONUMENTO.u1, MONUMENTO.v0, MONUMENTO.v1, PISO, MONUMENTO.y1);
  // fora: guarita e marquise (a cerca saiu: o campus é aberto para a cidade)
  const F = FRENTE;
  add(F.guarita.u0, F.guarita.u1, F.guarita.v0, F.guarita.v1, PISO, F.guarita.y1);
  const M = F.marquise;
  add(M.u[0], M.u[1], M.v1, M.v0, M.y, M.y + 0.5);
  for (const u of [-7.4, 7.4]) add(u - 0.3, u + 0.3, M.v1 + 0.3 - 0.3, M.v1 + 0.9, 0, M.y);

  const caixaExterna = { x0: cx - LAB.meio, x1: cx + LAB.meio, z0: cz - LAB.meio, z1: cz + LAB.meio };
  const campus = { x0: cx - CAMPUS.meio, x1: cx + CAMPUS.meio, z0: cz - CAMPUS.meio, z1: cz + CAMPUS.meio };
  const entrada = { x: cx, z: cz - 31 };

  function dentro(x, z, y = 0) {
    const u = x - cx, v = z - cz;
    for (const nome of Object.keys(SALAS)) {
      const s = SALAS[nome];
      if (y >= s.teto - 0.5) continue;                     // (acima do teto — o poço do Cortex, por exemplo — não é sala)
      if (u >= s.u[0] && u <= s.u[1] && v >= s.v[0] && v <= s.v[1]) return nome;
    }
    return null;
  }
  const pt = (nome, u, y, v) => ({ nome, x: cx + u, y, z: cz + v });
  const pontosDeInteresse = [
    pt('entrada', 0, 0.3, -29), pt('atrio', 0, 0.3, -19.5), pt('cortex', 0, 0.3, -8), pt('contencao', 20, 0.3, 0),
    pt('esteira', -20, 0.3, 8), pt('acelerador', 0, 0.3, 16), pt('telhado', -12, TOPO, -18),
    pt('nucleo', 0, 0.3, 42), pt('medica', -49, 0.3, -20), pt('alaOeste', -45, 0.3, 0), pt('oficina', -49, 0.3, 19),
    pt('trajes', 50, 0.3, -20), pt('alaLeste', 45, 0.3, 0), pt('fenda', 49, 0.3, 20), pt('corredorNorte', 0, 0.3, 32),
    pt('corredorOeste', -31, 0.3, 0), pt('corredorLeste', 31, 0.3, 0),
  ];
  return { rects: L, caixaExterna, campus, entrada, dentro, pontosDeInteresse };
}
