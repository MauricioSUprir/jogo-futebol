// Roteiro do PRÉ-JOGO (puro: sem three.js nem DOM). Pedido do dono de 11/10: "cenas de pré-jogo, com fora do estádio,
// aparecendo o estádio, jogadores entrando em campo, fazendo a fila, a câmera passando. No final das cenas pré-jogo,
// mostrando vários cuts de torcida e estádio pré-jogo, aparece a escalação dos dois times em um campinho: primeiro um
// time, aparece grande na tela, com o mesmo fundo, uns 10 seg, aí sai da tela, e entra a escalação do outro time, da
// mesma forma". O diretor (render/prejogo.js) toca isto no relógio do DESENHO; a simulação fica no tick 0.
//
// Planos (PESQUISA-PREJOGO.md §1, a ordem e a linguagem das transmissões e do FC 24/25: aéreo, chegada, túnel,
// entrada, fila com a câmera passando, cortes de torcida, escalação):
//   1 aéreo de fora (drone em órbita) · 2 fachada (grua da praça) · 3 o estádio cheio por dentro (alto da tribuna) ·
//   4 túnel (atrás dos times, olhando a luz do campo) · 5 entrada em campo (steadicam de ré) · 6 plano alto (a fila se
//   formando) · 7a/7b a fila com a câmera passando (mandante, visitante) · 8a–d cortes de torcida e estádio ·
//   9/10 escalação do mandante e do visitante (~10 s cada, o MESMO fundo: órbita lenta dentro do estádio).
// Modos: 'completo' (~81 s), 'curto' (~41 s: 3, 7a, 7b, 8a, 8d e as escalações) e 'escalacao' (só as duas).
//
// Câmera: trilhos Catmull–Rom CENTRÍPETOS percorridos pelo comprimento do arco (velocidade constante no trilho; a
// mesma ideia de THREE.CatmullRomCurve3 'centripetal' + getPointAt, three.js docs), com suavização por plano; órbitas
// paramétricas; cortes secos entre planos (preto no começo e "mergulho" ao preto de fora para dentro). Os trilhos são
// conferidos fora dos sólidos do estádio (estadio-forma.js) por tools/teste-prejogo-roteiro.mjs.
//
// Contrato: criarRoteiro(modo) → r; planoEm(r, t); proximoBloco(r, t); cameraEm(r, t, out); escuroEm(r, t);
// escalacaoEm(r, t); pontosDoPlano(p, n) (testes).

export const PREJOGO = {
  modos: ['completo', 'curto', 'escalacao', 'desligado'],
  escalacao: { entra: 0.55, fica: 10, sai: 0.3 },   // s: desliza para dentro, fica, (a 2ª) some no corte para o jogo
  preto: 0.6,             // s saindo do preto no começo
  mergulho: 0.4,          // s do mergulho ao preto (de fora para dentro do estádio)
  letterbox: 2.39,        // faixas de cinema nas cenas (largura ÷ altura do quadro)
  dt: 1 / 60,
};

// ------------------------------------------------------------------ curvas (Catmull–Rom centrípeta + comprimento do arco)
function crCoef(x0, x1, t0, t1) { return [x0, t0, -3 * x0 + 3 * x1 - 2 * t0 - t1, 2 * x0 - 2 * x1 + t0 + t1]; }
function crNaoUniforme(x0, x1, x2, x3, dt0, dt1, dt2) {
  let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1;
  let t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
  t1 *= dt1; t2 *= dt1;
  return crCoef(x1, x2, t1, t2);
}
/** Ponto da curva no parâmetro t (0–1, não uniforme: o da three.js getPoint). */
function pontoT(P, t, out) {
  const n = P.length;
  const p = (n - 1) * t;
  let i = Math.floor(p), w = p - i;
  if (i >= n - 1) { i = n - 2; w = 1; }
  const p1 = P[i], p2 = P[i + 1];
  // pontas: o ponto "fora" é a reflexão (como a three.js sem fechar)
  const p0 = i > 0 ? P[i - 1] : [2 * p1[0] - p2[0], 2 * p1[1] - p2[1], 2 * p1[2] - p2[2]];
  const p3 = i + 2 < n ? P[i + 2] : [2 * p2[0] - p1[0], 2 * p2[1] - p1[1], 2 * p2[2] - p1[2]];
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  let dt0 = Math.pow(d2(p0, p1), 0.25), dt1 = Math.pow(d2(p1, p2), 0.25), dt2 = Math.pow(d2(p2, p3), 0.25);
  if (dt1 < 1e-4) dt1 = 1;
  if (dt0 < 1e-4) dt0 = dt1;
  if (dt2 < 1e-4) dt2 = dt1;
  for (let k = 0; k < 3; k++) {
    const c = crNaoUniforme(p0[k], p1[k], p2[k], p3[k], dt0, dt1, dt2);
    out[k] = c[0] + c[1] * w + c[2] * w * w + c[3] * w * w * w;
  }
  return out;
}
const AMOSTRAS = 200;
/** Curva pelos pontos [[x, y, z], ...] (≥ 2) com a tabela do comprimento do arco. */
export function criarCurva(pontos) {
  const P = pontos.map(p => [p[0], p[1], p[2]]);
  const comp = new Float64Array(AMOSTRAS + 1);
  const a = [0, 0, 0], b = [0, 0, 0];
  pontoT(P, 0, a);
  for (let i = 1; i <= AMOSTRAS; i++) {
    pontoT(P, i / AMOSTRAS, b);
    comp[i] = comp[i - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    a[0] = b[0]; a[1] = b[1]; a[2] = b[2];
  }
  return { P, comp, L: comp[AMOSTRAS] };
}
/** Ponto no fim de uma fração u do COMPRIMENTO (velocidade constante no trilho; getPointAt da three.js). */
export function pontoCurva(c, u, out = [0, 0, 0]) {
  u = u < 0 ? 0 : u > 1 ? 1 : u;
  const alvo = u * c.L, T = c.comp;
  let lo = 0, hi = AMOSTRAS;
  while (lo < hi) { const m = (lo + hi) >> 1; if (T[m] < alvo) lo = m + 1; else hi = m; }
  const i = Math.max(1, lo);
  const seg = T[i] - T[i - 1];
  const t = (i - 1 + (seg > 0 ? (alvo - T[i - 1]) / seg : 0)) / AMOSTRAS;
  return pontoT(c.P, t, out);
}

// ------------------------------------------------------------------ os planos
// cam: {de: [pontos], para: [pontos], fov: [a, b], suave: 0–1} ou orbita: {centro: [x, z], olhar: [x, y, z], raio: [a, b],
// altura: [a, b], ang: [graus a, b], fov}. som: {filtro (Hz | null), ganho, agito}. torcida: {tensao: [casa, fora],
// palmas: [casa, fora]}. eventos: [{em (s no plano), festa?: {...}, disparo?: {tipo, grupo, forca}}].
// cortejo: {tc} (o cortejo a partir de tc s) | 'fila' (a fila montada) | null. fora: o lado de fora (névoa longe).
const P = {
  aereo: {
    id: 'aereo', nome: 'Aéreo de fora', bloco: 'cenas', dur: 7, fora: true, transicao: 'preto',
    orbita: { centro: [0, 0], olhar: [0, 12, 0], raio: [300, 235], altura: [135, 92], ang: [38, 62], fov: 38 },
    som: { filtro: 600, ganho: 0.55, agito: 0.15 }, torcida: { tensao: [0.2, 0.2], palmas: [0, 0] }, cortejo: null,
  },
  fachada: {
    id: 'fachada', nome: 'Fachada e chegada', bloco: 'cenas', dur: 5, fora: true, transicao: 'corte',
    cam: { de: [[-40, 2.2, 128], [-26, 7, 119], [-12, 13, 110]], para: [[0, 16, 78], [0, 19, 77], [0, 21.5, 76]], fov: [50, 44], suave: 0.7 },
    som: { filtro: 800, ganho: 0.7, agito: 0.25 }, torcida: { tensao: [0.2, 0.2], palmas: [0, 0] }, cortejo: null,
  },
  dentro: {
    id: 'dentro', nome: 'O estádio cheio por dentro', bloco: 'cenas', dur: 5, transicao: 'mergulho',
    cam: { de: [[-46, 23.5, 64], [-33, 23.3, 63.5], [-20, 23, 63]], para: [[-6, 4, -22], [0, 4, -22], [6, 4, -22]], fov: [48, 46], suave: 0.5 },
    som: { filtro: null, ganho: 1, agito: 0.55 }, torcida: { tensao: [0.45, 0.5], palmas: [0.15, 0.1] }, cortejo: null,
  },
  tunel: {
    id: 'tunel', nome: 'Túnel', bloco: 'cenas', dur: 6, transicao: 'corte',
    cam: { de: [[0, 1.55, 55.9], [0, 1.85, 55.6]], para: [[0, 1.4, 40], [0, 1.5, 30]], fov: [52, 50], suave: 0.4 },
    som: { filtro: [900, 2400], ganho: [0.6, 0.85], agito: 0.65 }, torcida: { tensao: [0.6, 0.6], palmas: [0.3, 0.2] }, cortejo: { tc: 0 },
  },
  entrada: {
    id: 'entrada', nome: 'Entrada em campo', bloco: 'cenas', dur: 6, transicao: 'corte',
    cam: { de: [[2.4, 1.6, 31.6], [2.2, 1.6, 23.0]], para: [[0, 1.45, 39], [0, 1.45, 30.4]], fov: [44, 44], suave: 0 },
    som: { filtro: null, ganho: 1, agito: 0.95 }, torcida: { tensao: [0.95, 0.85], palmas: [0.9, 0.7] }, cortejo: { tc: 6 },
    eventos: [{ em: 0, festa: { sinalizadores: true, bandeirao: 14 } }, { em: 0.2, disparo: { tipo: 'palmas', grupo: 0, forca: 1 } }],
  },
  alto: {
    id: 'alto', nome: 'Plano alto da fila se formando', bloco: 'cenas', dur: 5.5, transicao: 'corte',
    cam: { de: [[-6, 21, -50], [6, 20, -50]], para: [[0, 0, 6], [0, 0, 5]], fov: [30, 30], suave: 0.5 },
    som: { filtro: null, ganho: 1, agito: 0.8 }, torcida: { tensao: [0.8, 0.7], palmas: [0.6, 0.4] }, cortejo: { tc: 31 },
  },
  filaMandante: {
    id: 'filaMandante', nome: 'Fila do mandante com a câmera passando', bloco: 'cenas', dur: 8, transicao: 'corte', time: 0,
    cam: { de: [[-2.2, 1.62, 7.8], [-13.5, 1.62, 7.8]], para: [[-2.6, 1.45, 3.2], [-13.9, 1.45, 3.2]], fov: [34, 34], suave: 0.25 },
    som: { filtro: null, ganho: 1, agito: 0.6 }, torcida: { tensao: [0.6, 0.5], palmas: [0.3, 0.2] }, cortejo: 'fila',
  },
  filaVisitante: {
    id: 'filaVisitante', nome: 'Fila do visitante com a câmera passando', bloco: 'cenas', dur: 8, transicao: 'corte', time: 1,
    cam: { de: [[2.2, 1.62, 7.8], [13.5, 1.62, 7.8]], para: [[2.6, 1.45, 3.2], [13.9, 1.45, 3.2]], fov: [34, 34], suave: 0.25 },
    som: { filtro: null, ganho: 1, agito: 0.6 }, torcida: { tensao: [0.55, 0.6], palmas: [0.2, 0.3] }, cortejo: 'fila',
    // o bandeirão e os sinalizadores da organizada já abertos/acesos quando o corte chega nela
    eventos: [{ em: 6.2, festa: { sinalizadores: true, bandeirao: 12 } }],
  },
  organizada: {
    id: 'organizada', nome: 'Organizada atrás do gol', bloco: 'cenas', dur: 2.5, transicao: 'corte',
    cam: { de: [[40, 3.0, -20], [40, 3.4, -16]], para: [[70, 8, -2], [70, 8.5, 2]], fov: [40, 40], suave: 0.3 },
    som: { filtro: null, ganho: 1, agito: 0.8 }, torcida: { tensao: [0.8, 0.5], palmas: [0.3, 0.2] }, cortejo: 'fila',
  },
  ladoDeLa: {
    id: 'ladoDeLa', nome: 'Arquibancada de lá de perto', bloco: 'cenas', dur: 2.5, transicao: 'corte',
    cam: { de: [[-6, 2.2, -36], [2, 2.2, -36]], para: [[-12, 9, -56], [4, 9, -56]], fov: [28, 28], suave: 0.2 },
    som: { filtro: null, ganho: 1, agito: 0.75 }, torcida: { tensao: [0.7, 0.5], palmas: [0.5, 0.2] }, cortejo: 'fila',
  },
  visitantes: {
    id: 'visitantes', nome: 'Setor visitante', bloco: 'cenas', dur: 2.5, transicao: 'corte',
    cam: { de: [[-42, 2.5, 18], [-42, 2.8, 14]], para: [[-70, 7, 0], [-70, 7, -4]], fov: [38, 38], suave: 0.3 },
    som: { filtro: null, ganho: 1, agito: 0.7 }, torcida: { tensao: [0.5, 0.9], palmas: [0.2, 0.8] }, cortejo: 'fila',
  },
  geral: {
    id: 'geral', nome: 'O estádio do alto da tribuna', bloco: 'cenas', dur: 2.5, transicao: 'corte',
    cam: { de: [[-8, 24.5, 64], [8, 24.5, 64]], para: [[0, 0, -12], [0, 0, -12]], fov: [52, 52], suave: 0.3 },
    som: { filtro: null, ganho: 1, agito: 0.75 }, torcida: { tensao: [0.7, 0.6], palmas: [0.4, 0.3] }, cortejo: 'fila',
  },
};
// a escalação: o MESMO fundo (uma órbita lenta, contínua de uma para a outra), escurecido pela tela
const ORBITA_ESCALACAO = { centro: [0, 0], olhar: [0, 1, 3.2], raio: [58, 58], altura: [24, 24], ang: [74, 99.3], fov: 40 };
const escalacao = (t, i) => ({
  id: `escalacao${t}`, nome: t === 0 ? 'Escalação do mandante' : 'Escalação do visitante', bloco: `escalacao${t}`, time: t,
  dur: PREJOGO.escalacao.entra + PREJOGO.escalacao.fica, transicao: i === 0 ? 'corte' : 'continua', orbitaComum: true,
  som: { filtro: null, ganho: 0.85, agito: 0.5 }, torcida: { tensao: [0.5, 0.45], palmas: [0.2, 0.15] }, cortejo: 'fila',
});

const LISTAS = {
  completo: ['aereo', 'fachada', 'dentro', 'tunel', 'entrada', 'alto', 'filaMandante', 'filaVisitante', 'organizada', 'ladoDeLa', 'visitantes', 'geral'],
  curto: ['dentro', 'filaMandante', 'filaVisitante', 'organizada', 'geral'],
  escalacao: [],
};
// no curto as filas ficam com 5 s (a câmera anda o mesmo trilho, mais rápido)
const DUR_CURTO = { dentro: 5, filaMandante: 5, filaVisitante: 5 };

/** Roteiro de um modo: {modo, planos: [{...plano, t0, t1, i}], total, blocos: [{nome, t0, t1}], fimCenas}. */
export function criarRoteiro(modo = 'completo') {
  if (!LISTAS[modo]) modo = 'completo';
  const ids = LISTAS[modo];
  const planos = [];
  let t = 0;
  for (const id of ids) {
    const p = { ...P[id] };
    if (modo === 'curto' && DUR_CURTO[id]) p.dur = DUR_CURTO[id];
    if (modo === 'curto' && id === 'filaVisitante') p.eventos = [{ em: 3.4, festa: { sinalizadores: true, bandeirao: 12 } }];
    p.t0 = t; t += p.dur; p.t1 = t;
    planos.push(p);
  }
  const fimCenas = t;
  for (const tm of [0, 1]) {
    const p = escalacao(tm, tm);
    p.t0 = t; t += p.dur; p.t1 = t;
    planos.push(p);
  }
  planos.forEach((p, i) => {
    p.i = i;
    if (p.cam) { p.curvaDe = criarCurva(p.cam.de); p.curvaPara = criarCurva(p.cam.para); }
    if (p.orbitaComum) p.orbita = ORBITA_ESCALACAO;
  });
  const blocos = [];
  for (const p of planos) {
    const b = blocos[blocos.length - 1];
    if (b && b.nome === p.bloco) b.t1 = p.t1; else blocos.push({ nome: p.bloco, t0: p.t0, t1: p.t1 });
  }
  // a órbita da escalação corre pelas duas (o mesmo fundo): o tempo dela começa na 1ª escalação
  const tEsc = planos.find(p => p.orbitaComum)?.t0 ?? 0;
  return { modo, planos, total: t, blocos, fimCenas, tEscalacao: tEsc, durEscalacao: t - tEsc };
}

/** Índice do plano no instante t (s do roteiro; t ≥ total → o último). */
export function planoEm(r, t) {
  const ps = r.planos;
  for (let i = 0; i < ps.length; i++) if (t < ps[i].t1) return i;
  return ps.length - 1;
}

/** Bloco no instante t ('cenas' | 'escalacao0' | 'escalacao1'). */
export function blocoEm(r, t) { return r.planos[planoEm(r, t)].bloco; }

/** Começo do próximo BLOCO depois de t (cenas → escalação 0 → escalação 1 → fim = r.total). */
export function proximoBloco(r, t) {
  for (const b of r.blocos) if (b.t0 > t + 1e-6) return b.t0;
  return r.total;
}

function suave(x) { x = x < 0 ? 0 : x > 1 ? 1 : x; return x * x * (3 - 2 * x); }
const lerp = (a, b, t) => a + (b - a) * t;
const val = (v, s) => (Array.isArray(v) ? lerp(v[0], v[1], s) : v);

const _a = [0, 0, 0], _b = [0, 0, 0];
/**
 * Câmera no instante t: out = {px, py, pz, lx, ly, lz, fov, plano (índice), tau (s no plano), s (0–1 suavizado)}.
 * Os trilhos andam pelo comprimento (s = mistura de linear e suave pelo `suave` do plano); as órbitas pelo tempo.
 */
export function cameraEm(r, t, out = {}) {
  const i = planoEm(r, t), p = r.planos[i];
  const tau = Math.max(0, Math.min(p.dur, t - p.t0));
  const u = tau / p.dur;
  out.plano = i; out.tau = tau;
  if (p.orbita) {
    const o = p.orbita;
    // a da escalação corre pelas duas escalações (o mesmo fundo, sem corte)
    const uo = p.orbitaComum ? Math.max(0, Math.min(1, (t - r.tEscalacao) / r.durEscalacao)) : u;
    const ang = lerp(o.ang[0], o.ang[1], uo) * Math.PI / 180;
    const raio = lerp(o.raio[0], o.raio[1], suave(uo) * 0.5 + uo * 0.5), alt = lerp(o.altura[0], o.altura[1], suave(uo) * 0.5 + uo * 0.5);
    out.px = o.centro[0] + raio * Math.cos(ang); out.py = alt; out.pz = o.centro[1] + raio * Math.sin(ang);
    out.lx = o.olhar[0]; out.ly = o.olhar[1]; out.lz = o.olhar[2];
    out.fov = o.fov; out.s = uo;
    return out;
  }
  const c = p.cam, k = c.suave ?? 0.5;
  const s = lerp(u, suave(u), k);
  pontoCurva(p.curvaDe, s, _a);
  pontoCurva(p.curvaPara, s, _b);
  out.px = _a[0]; out.py = _a[1]; out.pz = _a[2];
  out.lx = _b[0]; out.ly = _b[1]; out.lz = _b[2];
  out.fov = lerp(c.fov[0], c.fov[1], s); out.s = s;
  return out;
}

/** Câmera da ABERTURA ("Toque para começar"): órbita lenta do estádio visto de fora, pelo tempo real (s). */
export function cameraAbertura(t, out = {}) {
  const ang = (22 + 1.6 * t) * Math.PI / 180;
  out.px = 330 * Math.cos(ang); out.py = 150; out.pz = 330 * Math.sin(ang);
  out.lx = 0; out.ly = 10; out.lz = 0; out.fov = 36; out.plano = -1; out.tau = t; out.s = 0;
  return out;
}

/** Preto por cima (0–1) no instante t: saindo do preto no começo e o mergulho de fora para dentro. */
export function escuroEm(r, t) {
  const i = planoEm(r, t), p = r.planos[i];
  const tau = t - p.t0;
  let e = 0;
  if (p.transicao === 'preto') e = Math.max(e, 1 - tau / PREJOGO.preto);
  if (p.transicao === 'mergulho') e = Math.max(e, 1 - tau / (PREJOGO.mergulho / 2));
  const q = r.planos[i + 1];
  if (q && q.transicao === 'mergulho') e = Math.max(e, 1 - (p.t1 - t) / (PREJOGO.mergulho / 2));
  return Math.max(0, Math.min(1, e));
}

/**
 * Escalação no instante t: {time (0 | 1 | null — a que está NA tela), entrando (0–1 da 0 ou da 1), saindo (0–1 da
 * que sai), cheia: o time totalmente na tela (null na transição)}. A 0 entra em PREJOGO.escalacao.entra s e fica; a 1
 * entra enquanto a 0 sai (mesmo tempo); no fim do roteiro a 1 some com o corte para o jogo.
 */
export function escalacaoEm(r, t, out = {}) {
  const E = PREJOGO.escalacao;
  const i = planoEm(r, t), p = r.planos[i];
  out.time = null; out.entrando = 0; out.saindo = 0; out.cheia = null; out.saiTime = null;
  if (!p.bloco.startsWith('escalacao') || t >= r.total) return out;
  const tau = t - p.t0;
  out.time = p.time;
  out.entrando = Math.min(1, tau / E.entra);
  if (p.time === 1 && tau < E.entra && r.planos[i - 1]?.time === 0) { out.saindo = tau / E.entra; out.saiTime = 0; }
  if (tau >= E.entra) out.cheia = p.time;
  return out;
}

/** Os níveis de som e da torcida do plano no instante t (interpolados no plano). */
export function sinaisEm(r, t, out = {}) {
  const p = r.planos[planoEm(r, t)];
  const s = Math.max(0, Math.min(1, (t - p.t0) / p.dur));
  const S = p.som ?? {};
  out.filtro = S.filtro == null ? null : val(S.filtro, s);
  out.ganho = val(S.ganho ?? 1, s);
  out.agito = val(S.agito ?? 0.4, s);
  const T = p.torcida ?? { tensao: [0, 0], palmas: [0, 0] };
  out.tensao0 = T.tensao[0]; out.tensao1 = T.tensao[1]; out.palmas0 = T.palmas[0]; out.palmas1 = T.palmas[1];
  out.fora = !!p.fora;
  return out;
}

/** Pontos da câmera (posição e alvo) ao longo de um plano — n amostras (testes dos trilhos). */
export function pontosDoPlano(r, i, n = 50) {
  const p = r.planos[i], lista = [], c = {};
  for (let k = 0; k < n; k++) {
    cameraEm(r, p.t0 + (p.dur * k) / (n - 1) - (k === n - 1 ? 1e-6 : 0), c);
    lista.push({ p: [c.px, c.py, c.pz], l: [c.lx, c.ly, c.lz], fov: c.fov });
  }
  return lista;
}
