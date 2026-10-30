// INTERIORES dos lugares da cidade (dono, 26/10: "quero que tenha como entrar nos lugares da cidade também, levando a vida de
// Barry Allen"): a Delegacia Central (com o laboratório de perícia do Barry), o Café Jitters, a redação do Picture News e a
// casa da família West. Cada sala fica NO ALTO, sobre o próprio quarteirão (o piso em y = Y0): fora da vista de quem está na
// rua e sem recortar as fachadas da cidade. A porta da fachada é um GATILHO: encostar nela escurece a tela e põe o herói lá
// dentro; a porta de dentro o devolve para a calçada. PURO (sem three.js nem DOM): a colisão (cidade.js) e o desenho
// (interiores3d.js) saem daqui. Coordenadas LOCAIS da célula do lugar (u = x − centro, v = z − centro); a porta de dentro
// fica sempre na parede de −v (como a fachada de fora).
export const Y0 = 1500;                       // o piso de dentro
export const PE = 0.4;                        // espessura das paredes

/**
 * Cada interior: sala [u0, u1, v0, v1], teto, a porta de saída na parede de −v, paredes de dentro (mesmo formato das do
 * laboratório: eixo 'x' corre ao longo de u na posição v = c; 'z' ao longo de v em u = c; vaos = portas; janelas = vidro),
 * os móveis sólidos [u0, u1, v0, v1, altura, tipo] e os PONTOS (onde ficam as pessoas e as missões).
 * fora: o gatilho na fachada [u0, u1, v0, v1] e onde o herói volta para a rua {u, v, h}.
 */
export const INTERIORES = {
  delegacia: {
    nome: 'Delegacia Central', sala: [-15, 15, -11, 11], teto: 4.6, porta: [-1.8, 1.8],
    paredes: [
      // o laboratório de perícia (à direita, atrás do vidro) e a sala do Joe (no fundo, à esquerda)
      { eixo: 'z', c: 4, a: -11, b: 11, vaos: [[-1.6, 1.6]], janelas: [[-10, -2.2], [2.2, 10]], jy: [1.0, 3.3] },
      { eixo: 'x', c: 4, a: -15, b: -8, vaos: [[-12.4, -10.6]], janelas: [[-14.6, -12.8]], jy: [1.0, 3.3] },
      { eixo: 'z', c: -8, a: 4, b: 11, vaos: [], janelas: [[4.4, 10.6]], jy: [1.0, 3.3] },
    ],
    moveis: [
      [-5, 1, -7.6, -6.6, 1.1, 'balcao'],
      ...[[-12, -4], [-7, -4], [-12, 0.5], [-7, 0.5]].map(([u, v]) => [u - 0.95, u + 0.95, v - 0.5, v + 0.5, 0.78, 'mesa']),
      [-12.6, -10.4, 7.2, 8.4, 0.78, 'mesa'],
      [5.4, 14.6, -10.6, -9.6, 0.95, 'bancada'], [5.4, 14.6, 9.6, 10.6, 0.95, 'bancada'], [8, 12, -1.6, 1.6, 0.95, 'bancada'],
      [14.2, 14.6, -6, 6, 2.4, 'estante'], [6, 8, 3.2, 5, 0.78, 'mesa'],
      // (30/10) a planta do canto, o bebedouro, o banco de espera junto da porta e o arquivo da sala do Joe
      [-14.7, -14.1, -10.7, -10.1, 1.4, 'planta'], [-14.65, -14.15, -6.4, -5.9, 1.5, 'bebedouro'], [2.2, 3.6, -10.75, -10.3, 0.5, 'banco'], [-14, -13, 10.4, 10.95, 1.3, 'arquivo'],
    ],
    // (o Joe espera na porta da perícia olhando para a bancada, e na sala dele atrás da mesa; o canto escuro da perícia é do vulto)
    pontos: { csi: [9.5, 4.1, Math.PI], portaCsi: [6.2, 0.2, 0.7], cantoCsi: [12.8, 7.6, -2.39], mesaJoe: [-11.5, 9.0, Math.PI], balcao: [-2, -8.6, Math.PI], quadro: [-13.6, -1.8, Math.PI / 2] },
    entrada: [0, -9.4, 0],
    fora: { gatilho: [-2.6, 2.6, -19.4, -18], volta: [0, -23, Math.PI] },
  },
  cafe: {
    nome: 'Café Jitters', sala: [-10, 10, -7, 7], teto: 4.2, porta: [-1.6, 1.6],
    paredes: [],
    moveis: [
      [-6.5, 2.5, 3.4, 4.4, 1.1, 'balcao'], [-6.5, 2.5, 6.2, 6.6, 2.2, 'estante'],
      ...[[-6.5, -2.5], [-2.5, -4.2], [2, -2.4], [6.5, -4.4], [6.4, 0.6]].map(([u, v]) => [u - 0.45, u + 0.45, v - 0.45, v + 0.45, 0.76, 'mesaRedonda']),
      [7, 9.6, 3.4, 6.6, 0.8, 'sofa'],
      [9.2, 9.8, -6.8, -6.2, 1.4, 'planta'], [-9.8, -9.2, -6.8, -6.2, 1.4, 'planta'],
    ],
    // (o rumo de quem espera deixa o herói, 3,6 m à frente, fora das mesas)
    pontos: { balcaoJitters: [-1.5, 2.6, Math.PI], mesaIris: [6.4, -0.6, -2.17], mesaCafe: [-6.5, -3.4, 1.07] },
    entrada: [0, -5.4, 0],
    fora: { gatilho: [-16.2, -11.8, -27.7, -26.8], volta: [-14, -29.8, Math.PI] },
  },
  jornal: {
    nome: 'Picture News', sala: [-14, 14, -10, 10], teto: 4.4, porta: [-1.8, 1.8],
    paredes: [
      // a sala do editor, envidraçada, no fundo à direita
      { eixo: 'x', c: 3, a: 6, b: 14, vaos: [[8.4, 10.4]], janelas: [[6.4, 8], [10.8, 13.6]], jy: [1.0, 3.2] },
      { eixo: 'z', c: 6, a: 3, b: 10, vaos: [], janelas: [[3.4, 9.6]], jy: [1.0, 3.2] },
    ],
    moveis: [
      ...[-6, -2, 2].flatMap((v) => [[-11.5, -7.5, v - 0.5, v + 0.5, 0.76, 'mesa'], [-6.5, -2.5, v - 0.5, v + 0.5, 0.76, 'mesa']]),
      [1.8, 4.2, -6.6, -5.4, 0.76, 'mesa'], [8.6, 12.4, 6.6, 7.6, 0.76, 'mesa'], [13.4, 13.9, -8, -2, 1.3, 'estante'],
      [-13.8, -13.2, 9.2, 9.8, 1.4, 'planta'], [3.9, 4.4, 9.4, 9.9, 1.5, 'bebedouro'],
    ],
    pontos: { mesaIrisJornal: [3, -7.2, 1.3], editor: [10.5, 8.2, Math.PI], redacao: [-4.5, 0, Math.PI] },
    entrada: [0, -8.4, 0],
    fora: { gatilho: [-3, 3, -25.2, -24.2], volta: [0, -27, Math.PI] },
  },
  casa: {
    nome: 'Casa da família West', sala: [-8, 8, -6, 6], teto: 3.2, porta: [-1.2, 1.2],
    paredes: [],
    moveis: [
      [-7.2, -3.2, 2.2, 3.2, 0.8, 'sofa'], [-6.2, -4.2, -0.6, 0.6, 0.45, 'mesinha'], [-7.8, -7.2, -3, 1, 1.0, 'estante'],
      [1, 4, -1.2, 1.2, 0.78, 'mesa'], [6.8, 7.8, -5.4, 2.6, 0.95, 'bancada'], [6.8, 7.8, 3.4, 5, 2.0, 'geladeira'],
      [-7.8, -6, 3.8, 5.8, 2.4, 'escada'],
      [-7.8, -7.2, -5.8, -5.2, 1.3, 'planta'],
    ],
    pontos: { sofaWest: [-5.2, 1.6, Math.PI], jantar: [2.5, -1.9, Math.PI], cozinha: [5.8, 0, -2.48] },
    entrada: [0, -4.4, 0],
    fora: { gatilho: [-1.2, 1.2, -3.6, -2.9], volta: [0, -7.6, Math.PI] },
  },
};
export const IDS_INTERIOR = Object.keys(INTERIORES);

/** as paredes de um interior em coordenadas locais (as quatro de fora, com a porta de saída, mais as de dentro) */
export function paredesDoInterior(id) {
  const I = INTERIORES[id], [u0, u1, v0, v1] = I.sala, t = PE;
  return [
    { id: 'frente', eixo: 'x', c: v0 - t / 2, a: u0 - t, b: u1 + t, vaos: [I.porta], janelas: [], ext: -1 },
    { id: 'fundo', eixo: 'x', c: v1 + t / 2, a: u0 - t, b: u1 + t, vaos: [], janelas: [], ext: 1 },
    { id: 'oeste', eixo: 'z', c: u0 - t / 2, a: v0, b: v1, vaos: [], janelas: [], ext: -1 },
    { id: 'leste', eixo: 'z', c: u1 + t / 2, a: v0, b: v1, vaos: [], janelas: [], ext: 1 },
    ...I.paredes.map((p, k) => ({ id: `dentro${k}`, ext: 0, ...p })),
  ];
}
export const PORTA_H = 2.6;                   // altura das portas de dentro
/** retângulos de uma parede (entre os vãos, e a verga sobre cada vão), em y relativo ao piso */
export function pedacosParede(p, teto) {
  const out = [], t = p.ext ? PE : 0.16, vaos = p.vaos.slice().sort((a, b) => a[0] - b[0]);
  const seg = (s0, s1, y0, y1) => { if (s1 - s0 < 1e-6 || y1 - y0 < 1e-6) return; if (p.eixo === 'x') out.push([s0, s1, p.c - t / 2, p.c + t / 2, y0, y1]); else out.push([p.c - t / 2, p.c + t / 2, s0, s1, y0, y1]); };
  let cur = p.a;
  for (const [s0, s1] of vaos) { seg(cur, s0, 0, teto); seg(s0, s1, PORTA_H, teto); cur = s1; }
  seg(cur, p.b, 0, teto);
  return out;
}
const centroCel = (k, CELL, MEIO) => (k + 0.5) * CELL - MEIO;
/** os retângulos de colisão (mundo) de um interior, para o quarteirão do lugar (cx, cz = centro da célula) */
export function retangulosInterior(id, cx, cz) {
  const I = INTERIORES[id], [u0, u1, v0, v1] = I.sala, L = [];
  const add = (a, b, c, d, y0, y1) => L.push({ x0: cx + a, x1: cx + b, z0: cz + c, z1: cz + d, y0: Y0 + y0, y1: Y0 + y1, interior: id });
  add(u0 - 1, u1 + 1, v0 - 1, v1 + 1, -0.6, 0);                                   // piso
  add(u0 - 1, u1 + 1, v0 - 1, v1 + 1, I.teto, I.teto + 0.6);                     // teto
  for (const p of paredesDoInterior(id)) for (const [a, b, c, d, y0, y1] of pedacosParede(p, I.teto)) add(a, b, c, d, y0, y1);
  // a porta de saída leva para fora: um batente fundo atrás dela (o herói não sai da sala por ali; o gatilho o põe na rua)
  add(I.porta[0] - 0.5, I.porta[1] + 0.5, v0 - 2.4, v0 - PE, 0, I.teto);
  for (const [a, b, c, d, h] of I.moveis) add(a, b, c, d, 0, h);
  return L;
}
/** a trava das paredes finas: o caminho do centro do corpo de (x0, z0) a (x1, z1) corta algum sólido da sala na altura do
 *  corpo? (as paredes de dentro têm 16 cm; empurrado contra uma delas por um móvel ou num passo longo, o corpo de 0,45 m de
 *  raio podia sair do outro lado — com a trava ele volta para onde estava) */
export function cruzaSolido(rects, x0, z0, x1, z1, y, alt = 1.8) {
  const dx = x1 - x0, dz = z1 - z0;
  if (Math.abs(dx) + Math.abs(dz) < 1e-6) return null;
  for (const q of rects) {
    if (!q.interior || y + alt <= q.y0 + 0.05 || y >= q.y1 - 0.05) continue;
    if (x0 > q.x0 && x0 < q.x1 && z0 > q.z0 && z0 < q.z1) continue;          // (quem já começou dentro pode sair)
    let t0 = 0, t1 = 1, fora = false;
    for (const [o, d, a, b] of [[x0, dx, q.x0, q.x1], [z0, dz, q.z0, q.z1]]) {
      if (Math.abs(d) < 1e-9) { if (o <= a || o >= b) { fora = true; break; } continue; }
      let ta = (a - o) / d, tb = (b - o) / d; if (ta > tb) [ta, tb] = [tb, ta];
      t0 = Math.max(t0, ta); t1 = Math.min(t1, tb); if (t0 >= t1) { fora = true; break; }
    }
    if (!fora) return q;
  }
  return null;
}
/** o interior onde (x, y, z) está, ou null (só conta no alto, perto de Y0) */
export function interiorEm(x, z, y, marcoDe) {
  if (y < Y0 - 5 || y > Y0 + 20) return null;
  const m = marcoDe(x, z); if (!m || !INTERIORES[m.id]) return null;
  return m.id;
}
/** a sala de dentro com o nome (no laboratório da Delegacia: 'csi'), para as missões */
export function salaDoInterior(id, u, v) {
  if (id === 'delegacia') return u > 4 ? 'csi' : u < -8 && v > 4 ? 'salaJoe' : 'delegacia';
  if (id === 'jornal') return u > 6 && v > 3 ? 'editor' : 'jornal';
  return id;
}
/** o herói encostou no gatilho de fora (porta da fachada) ou no de dentro (a porta de saída)? */
export const noGatilhoFora = (id, u, v) => { const g = INTERIORES[id].fora.gatilho; return u >= g[0] && u <= g[1] && v >= g[2] && v <= g[3]; };
export const noGatilhoDentro = (id, u, v) => { const I = INTERIORES[id]; return u >= I.porta[0] && u <= I.porta[1] && v <= I.sala[2] + 0.35; };
export { centroCel };
