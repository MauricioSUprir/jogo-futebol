// LABORATÓRIOS ESTRELA — o plano (puro: sem three.js nem DOM). Uma só fonte para a colisão (retângulos) e para o desenho
// (lab3d.js lê PAREDES, CELAS, CONSOLES... daqui). Coordenadas LOCAIS: u = x - cx, v = z - cz, y para cima.
// A FRENTE (entrada) olha para -z. Sem aleatoriedade: o plano é determinístico.
export const LAB_CELULA = [15, 15];
export const H = 16;                 // altura do telhado
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
  { id: 'fundo', eixo: 'x', c: 26.5, t: 1, a: -27, b: 27, ext: 1, vaos: [], janelas: [[-24, -15], [-11, -3], [3, 11], [15, 24]], jy: [3.2, 8.2] },
  { id: 'oeste', eixo: 'z', c: -26.5, t: 1, a: -26, b: 26, ext: -1, vaos: [], janelas: [[-24, -14], [-11, 11], [14, 24]], jy: [3.2, 8.2] },
  { id: 'leste', eixo: 'z', c: 26.5, t: 1, a: -26, b: 26, ext: 1, vaos: [], janelas: [[-24, -14], [-11, 11], [14, 24]], jy: [3.2, 8.2] },
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
export const ANEL_TELHADO = { R: 24, y: 19.6, tubo: 1.1, pilones: 8 };
export const DOME = { R: 15.2, cy: 10.6, theta: 1.208, furo: 10 };
export const TELHADO_COISAS = {
  torres: [[-22, 22, 4], [22, 22, 4]],                // [u, v, lado] torres de resfriamento
  tanque: [22, -22, 3], parabolica: [-22, -22, 2], mastro: [10, -24],
};
// lajes do telhado [u0, u1, v0, v1] (y 15..16); o Cortex tem um furo de 20 × 20 coberto pela cúpula
export const LAJES = [
  [-26, 26, -26, -13.5], [13.5, 26, -12.5, 12.5], [-26, -13.5, -12.5, 12.5], [-26, 26, 13.5, 26],
  [-12.5, 12.5, 10, 12.5], [-12.5, 12.5, -12.5, -10], [10, 12.5, -10, 10], [-12.5, -10, -10, 10],
];
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
  let cur = p.a;
  for (const [s0, s1] of vaos) { seg(cur, s0, PISO, H); seg(s0, s1, PORTA_Y, H); cur = s1; }
  seg(cur, p.b, PISO, H);
  return out;
}

/** Plano do laboratório centrado em (cx, cz): retângulos de colisão (mundo) e consultas. */
export function planoLab(cx, cz) {
  const L = [];
  const add = (u0, u1, v0, v1, y0, y1) => L.push({ x0: r6(cx + u0), x1: r6(cx + u1), z0: r6(cz + v0), z1: r6(cz + v1), y0, y1 });
  const addLocal = (q) => add(q.x0, q.x1, q.z0, q.z1, q.y0, q.y1);

  for (const p of PAREDES) for (const q of retangulosParede(p)) addLocal(q);

  // lajes do telhado
  for (const [a, b, c, d] of LAJES) add(a, b, c, d, H - 1, H);
  // platibanda (0,5 m de espessura, 1 m de altura) na borda do telhado
  add(-27, 27, -27, -26.5, H, H + 1); add(-27, 27, 26.5, 27, H, H + 1);
  add(-27, -26.5, -26.5, 26.5, H, H + 1); add(26.5, 27, -26.5, 26.5, H, H + 1);

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
  for (let k = 0; k < A.pilones; k++) { const a = (k / A.pilones) * Math.PI * 2; add(A.R * Math.cos(a) - 0.6, A.R * Math.cos(a) + 0.6, A.R * Math.sin(a) - 0.6, A.R * Math.sin(a) + 0.6, H, A.y + 0.4); }
  for (const [u, v, l] of TELHADO_COISAS.torres) add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, H, H + 5);
  { const [u, v, l] = TELHADO_COISAS.tanque; add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, H, H + 6); }
  { const [u, v, l] = TELHADO_COISAS.parabolica; add(u - l / 2, u + l / 2, v - l / 2, v + l / 2, H, H + 1.2); }
  // fora: cerca com portão aberto, guarita, marquise
  const F = FRENTE, c = F.cerca;
  add(-c, F.portao[0], -c - 0.2, -c + 0.2, PISO, 2.4); add(F.portao[1], c, -c - 0.2, -c + 0.2, PISO, 2.4);
  add(-c, c, c - 0.2, c + 0.2, PISO, 2.4); add(-c - 0.2, -c + 0.2, -c, c, PISO, 2.4); add(c - 0.2, c + 0.2, -c, c, PISO, 2.4);
  add(F.guarita.u0, F.guarita.u1, F.guarita.v0, F.guarita.v1, PISO, F.guarita.y1);
  const M = F.marquise;
  add(M.u[0], M.u[1], M.v1, M.v0, M.y, M.y + 0.5);
  for (const u of [-7.4, 7.4]) add(u - 0.3, u + 0.3, M.v1 + 0.3 - 0.3, M.v1 + 0.9, 0, M.y);

  const caixaExterna = { x0: cx - LAB.meio, x1: cx + LAB.meio, z0: cz - LAB.meio, z1: cz + LAB.meio };
  const entrada = { x: cx, z: cz - 31 };

  function dentro(x, z, y = 0) {
    if (y >= H - 0.5) return null;
    const u = x - cx, v = z - cz;
    for (const nome of ['cortex', 'atrio', 'contencao', 'esteira', 'acelerador']) {
      const s = SALAS[nome];
      if (u >= s.u[0] && u <= s.u[1] && v >= s.v[0] && v <= s.v[1]) return nome;
    }
    return null;
  }
  const pt = (nome, u, y, v) => ({ nome, x: cx + u, y, z: cz + v });
  const pontosDeInteresse = [
    pt('entrada', 0, 0.3, -29), pt('atrio', 0, 0.3, -19.5), pt('cortex', 0, 0.3, -8), pt('contencao', 20, 0.3, 0),
    pt('esteira', -20, 0.3, 8), pt('acelerador', 0, 0.3, 16), pt('telhado', -12, H, -18),
  ];
  return { rects: L, caixaExterna, entrada, dentro, pontosDeInteresse };
}
