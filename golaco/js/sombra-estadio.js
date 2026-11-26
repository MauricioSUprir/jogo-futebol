// A SOMBRA DO ESTÁDIO no gramado e em quem está nele, de dia (item 46; desenho, PURO: sem three.js nem DOM, fora do fecho do
// hash). Pesquisa e o que veio de cada fonte: `PESQUISA-ESTADIO.md` §20; contrato "Sombra do estádio (item 46)" no
// `CONTRATOS.md`.
//
// O sol do dia é FIXO (render/cena.js HORAS.dia, que lê o SOL_DIA daqui) e o estádio também: a sombra do estádio no chão é
// uma forma parada por partida. Ela sai das PEÇAS do estádio — a cobertura e as arquibancadas pela PLANTA (o mesmo sólido de
// estadio-forma.js solidoEm: estadio-planta.js no Maracanã, estadio-generico.js nas 5 famílias da edição pro e, sem forma,
// o Estádio Golaço), as placas e os bancos (iguais em todos), e as peças finas pelo DESENHO delas (as torres de refletor, os
// telões, o cubo e as vigas: o sólido da câmera é uma folga em volta delas, não a forma) — como sólidos CONVEXOS: cada um,
// projetado no chão pelo raio do sol, é o fecho convexo dos vértices projetados. Os polígonos vão para uma grade fina (0,25
// m), a distância euclidiana com sinal sai pela transformada exata (Felzenszwalb e Huttenlocher, "Distance Transforms of
// Sampled Functions", Theory of Computing 8, 2012) e vira uma textura de 8 bits de 0,5 m (a DISTÂNCIA, não a cobertura: a
// borda filtrada em bilinear fica reta e nítida em qualquer distância — Green, "Improved Alpha-Tested Magnification for Vector
// Textures and Special Effects", SIGGRAPH 2007). Nenhum mapa de sombra novo: nada é desenhado nela, nenhum render target,
// nenhuma chamada de desenho; ela é calculada UMA vez por estádio.
//
// No shader (SOMBRA_GLSL_V / SOMBRA_GLSL_F, render/sombra-estadio-gpu.js): o ponto do mundo P vai ao chão pelo raio do sol,
// G = (P.x, P.z) + P.y·k (k = −(sx, sz)/sy: o chão que o raio que passa por P toca) — exato para tudo que está ABAIXO do que faz
// sombra (o gramado, as linhas, os jogadores, a bola, os gols e as placas, ≤ ~3 m; a cobertura está a 20–40 m) —, a distância
// lida em G dá o sol pela borda macia (a penumbra do disco do sol, 0,53°: ~0,4 m a 40 m da borda da cobertura) e o fator
// multiplica SÓ a luz direta do sol (a luz de índice 0 do three: a que faz sombra vem primeiro) — o céu (a HemisphereLight)
// continua. Dentro da sombra do estádio a luz direta já é zero: a sombra do jogador (o mapa de sombra de cena.js) não escurece
// de novo (o mesmo produto de visibilidades da luz do three: getShadow × este fator). De noite (refletores) o fator é 1.
import { CAMPO, ESTADIO } from './config.js';
import { ARQUIBANCADA as A } from './render/torcida-dados.js';
import { REFLETORES, DESENHO_TORRES } from './estadio-forma.js';

/** O sol do DIA (a direção para o sol, não normalizada): render/cena.js HORAS.dia.solDir lê daqui; as plantas (luzDoSol das
 *  cadeiras) têm a mesma (o teste-sombra-estadio confere). */
export const SOL_DIA = Object.freeze([-0.42, 0.74, 0.52]);

/**
 * A máscara: `caixa` = [x0, z0, x1, z1] (m) do chão que ela cobre (o fundo do estádio até a frente das arquibancadas de
 * qualquer família: a pista vai até |x| ~89; fora dela, sol), `passo` = o texel (m), `fino` = a célula da grade de onde sai a
 * distância (m), `faixa` = a distância (m) que cabe nos 8 bits (±), `penumbra` = a largura da borda (m: a do disco do sol a ~40
 * m da borda), `fatias` = as fatias da volta (as plantas curvas: a cobertura e as arquibancadas), `perfil` = os trechos do perfil
 * das arquibancadas por fatia.
 */
export const SOMBRA_ESTADIO = Object.freeze({
  caixa: Object.freeze([-96, -72, 96, 72]), passo: 0.5, fino: 0.25, faixa: 3, penumbra: 0.4, fatias: 360, perfil: 8, lote: 250,
  bloco: 128,
});

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;

/** k = −(sx, sz)/sy do sol `sol`: o chão tocado pelo raio que passa por (x, y, z) é (x + y·k[0], z + y·k[1]). */
export function deslocamentoSol(sol = SOL_DIA) {
  return [-sol[0] / sol[1], -sol[2] / sol[1]];
}

// ------------------------------------------------------------------ as peças (sólidos convexos)
// {tipo: 'caixa', c: [x, y, z], w (ao longo do rumo h), a (altura), d (de lado), h} (a caixa do render/estadio-generico.js
// malha().caixa), {tipo: 'cilindro', x, z, y0, y1, r0, r1} (o tronco de cone em pé) ou {tipo: 'pontos', pts: [x, y, z, …]}
// (o fecho convexo dos pontos: as fatias da cobertura e das arquibancadas). `classe`: de onde veio (o teste separa).

function caixa(classe, cx, cy, cz, w, a, d, h) { return { tipo: 'caixa', classe, c: [cx, cy, cz], w, a, d, h }; }
function cilindro(classe, x, z, y0, y1, r0, r1 = r0) { return { tipo: 'cilindro', classe, x, z, y0, y1, r0, r1 }; }
/** A barra de seção quadrada de lado e de a até b (malha().barra), como caixa. */
function barra(classe, a, b, e) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.hypot(dx, dy, dz);
  const t = [dx / L, dy / L, dz / L];
  const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  let n1 = [t[1] * up[2] - t[2] * up[1], t[2] * up[0] - t[0] * up[2], t[0] * up[1] - t[1] * up[0]];
  const l1 = Math.hypot(...n1); n1 = n1.map(v => (v / l1) * e / 2);
  const n2 = [t[1] * n1[2] - t[2] * n1[1], t[2] * n1[0] - t[0] * n1[2], t[0] * n1[1] - t[1] * n1[0]];
  const pts = [];
  for (const p of [a, b]) for (const [s1, s2] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pts.push(p[0] + n1[0] * s1 + n2[0] * s2, p[1] + n1[1] * s1 + n2[1] * s2, p[2] + n1[2] * s1 + n2[2] * s2);
  // (o eixo, para o teste de dentro: os lados n1 e n2 unitários e a meia seção)
  const u1 = n1.map(v => v / (e / 2)), u2 = n2.map(v => v / (e / 2));
  return { tipo: 'pontos', classe, pts, barra: { a, t, L, u1, u2, m: e / 2 } };
}

/** Os vértices 3D de uma peça (x, y, z, …). */
export function verticesDe(p) {
  if (p.tipo === 'pontos') return p.pts;
  const out = [];
  if (p.tipo === 'caixa') {
    const ch = Math.cos(p.h), sh = Math.sin(p.h), [cx, cy, cz] = p.c;
    for (const i of [-1, 1]) for (const j of [-1, 1]) for (const k of [-1, 1]) out.push(cx + ch * i * p.w / 2 - sh * k * p.d / 2, cy + j * p.a / 2, cz + sh * i * p.w / 2 + ch * k * p.d / 2);
    return out;
  }
  const N = 16;
  for (let i = 0; i < N; i++) {
    const t = (2 * Math.PI * i) / N, c = Math.cos(t), s = Math.sin(t);
    // (o polígono de N lados por FORA do círculo: o raio do vértice r / cos(π/N))
    const k = 1 / Math.cos(Math.PI / N);
    out.push(p.x + p.r0 * k * c, p.y0, p.z + p.r0 * k * s, p.x + p.r1 * k * c, p.y1, p.z + p.r1 * k * s);
  }
  return out;
}

/** O ponto (x, y, z) está dentro da peça? (a caixa, a barra e o cilindro, exatos — o polígono de 16 lados do cilindro fica
 *  por fora do círculo: o teste confere a projeção das peças finas; as outras 'pontos' não). */
export function dentroDaPeca(p, x, y, z) {
  if (p.tipo === 'caixa') {
    const ch = Math.cos(p.h), sh = Math.sin(p.h), dx = x - p.c[0], dz = z - p.c[2];
    return Math.abs(dx * ch + dz * sh) <= p.w / 2 && Math.abs(-dx * sh + dz * ch) <= p.d / 2 && Math.abs(y - p.c[1]) <= p.a / 2;
  }
  if (p.barra) {
    const B = p.barra, q = [x - B.a[0], y - B.a[1], z - B.a[2]], dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
    const s = dot(q, B.t);
    return s >= 0 && s <= B.L && Math.abs(dot(q, B.u1)) <= B.m && Math.abs(dot(q, B.u2)) <= B.m;
  }
  if (p.tipo === 'cilindro') {
    if (y < p.y0 || y > p.y1) return false;
    return Math.hypot(x - p.x, z - p.z) <= lerp(p.r0, p.r1, (y - p.y0) / Math.max(1e-9, p.y1 - p.y0));
  }
  return false;
}

/** As peças comuns a todo estádio (o gramado é o mesmo: estadio-forma.js solidoEm): as placas e os bancos. */
function pecasComuns() {
  const out = [];
  // placas de publicidade (0,96 m, 0,14 m de espessura) em volta do campo — o sólido de estadio-forma.js solidoEm
  const PX = CAMPO.meioX + CAMPO.entorno, PZ = CAMPO.meioZ + CAMPO.entorno, e = 0.14, y = 0.96;
  for (const s of [-1, 1]) {
    out.push(caixa('placas', s * (PX + e / 2), y / 2, 0, e, y, 2 * (PZ + e), 0));
    out.push(caixa('placas', 0, y / 2, s * (PZ + e / 2), 2 * (PX + e), y, e, 0));
  }
  // bancos de reservas (lado de cá), o sólido de solidoEm
  const B = ESTADIO.bancos;
  for (const s of [-1, 1]) {
    const x0 = B.x[0] - 0.3, x1 = B.x[1] + 0.3, z0 = B.z[0] - 0.6, z1 = B.z[1], a = B.altura + 0.15;
    out.push(caixa('banco', s * (x0 + x1) / 2, a / 2, (z0 + z1) / 2, x1 - x0, a, z1 - z0, 0));
  }
  return out;
}

/** O Estádio Golaço do jogo (sem forma): as arquibancadas (o degrau linear de cadeiras-dados.js ARQ_GOLACO, a frente em pé
 *  até yBase), a marquise de lá, o teto de cá e as 4 torres de refletor pelo desenho (render/campo.js criarRefletores). */
function pecasGolaco() {
  const out = [];
  const M = A.meioComprimento, z0 = A.frenteZ, z1 = A.frenteZ + A.profLado;
  // lados: o prisma do degrau (a frente em pé até yBase, a rampa até yTopoLado)
  for (const s of [-1, 1]) {
    const pts = [];
    for (const x of [-M, M]) for (const [z, y] of [[z0, 0], [z0, A.yBase], [z1, A.yTopoLado], [z1, 0]]) pts.push(x, y, s * z);
    out.push({ tipo: 'pontos', classe: 'arquibancada', pts });
  }
  // fundos (atrás dos gols): de z −74,5 a +44,5
  const x0 = A.fundoX0, x1 = A.fundoX0 + A.profFundo;
  for (const s of [-1, 1]) {
    const pts = [];
    for (const z of [-z1, z0]) for (const [x, y] of [[x0, 0], [x0, A.yBase], [x1, A.yTopoFundo], [x1, 0]]) pts.push(s * x, y, z);
    out.push({ tipo: 'pontos', classe: 'arquibancada', pts });
  }
  // a parede de trás dos fundos (até yTopoFundo + 5)
  for (const s of [-1, 1]) out.push(caixa('arquibancada', s * (x1 + 0.15), (A.yTopoFundo + 5) / 2, (z0 - z1) / 2, 0.3, A.yTopoFundo + 5, z0 + z1, 0));
  // a parede de trás dos lados (até yTopoLado + 5) e a marquise de lá (z −74,5 → −58,5, y 25 → 26,5), o teto curto de cá
  const yT = A.yTopoLado + 5;
  for (const s of [-1, 1]) out.push(caixa('arquibancada', 0, yT / 2, s * (z1 + 0.15), 2 * M, yT, 0.3, 0));
  {
    const pts = [];
    for (const x of [-M, M]) for (const [z, y] of [[z1, yT], [z1 - 16, yT + 1.5]]) for (const dy of [-0.3, 0.3]) pts.push(x, y + dy, -z);
    out.push({ tipo: 'pontos', classe: 'marquise', pts });
  }
  {
    const pts = [];
    for (const x of [-M, M]) for (const [z, y] of [[z1, yT], [z1 - 4.5, yT + 0.6]]) for (const dy of [-0.3, 0.3]) pts.push(x, y + dy, z);
    out.push({ tipo: 'pontos', classe: 'marquise', pts });
  }
  // torres dos refletores: o poste e o painel virado para o meio do campo (o desenho)
  const R = REFLETORES;
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const x = s * R.x, z = t * R.z;
    out.push(cilindro('refletor', x, z, 0, R.alto, R.raio));
    out.push(caixa('refletor', x, R.painel.y, z, R.painel.esp, R.painel.alt, R.painel.larg, Math.atan2(-z, -x)));
  }
  return out;
}

/** As fatias da volta: [θ0, θ1] de N fatias iguais. */
function* fatias(N) { for (let i = 0; i < N; i++) yield [-Math.PI + (2 * Math.PI * i) / N, -Math.PI + (2 * Math.PI * (i + 1)) / N]; }
const pol = (r, th) => [r * Math.cos(th), r * Math.sin(th)];

/**
 * O pedaço [t0, t1] × [q0, q1] (o ângulo e o parâmetro do perfil: s nas arquibancadas, u na cobertura) onde `existe(θ, q)`:
 * existindo nos 4 cantos e no meio, a peça inteira (montar); em nenhum, nada; senão, em 2 × 2 até `prof` vezes (a ponta da
 * cobertura parcial e a ponta reta da arquibancada nos cantos abertos: ~1/16 da fatia e do trecho; no fim, pelo meio).
 */
function refinar(t0, t1, q0, q1, existe, montar, out, prof = 4) {
  const tm = (t0 + t1) / 2, qm = (q0 + q1) / 2;
  const v = [existe(t0, q0), existe(t1, q0), existe(t0, q1), existe(t1, q1), existe(tm, qm)];
  const n = v.filter(Boolean).length;
  if (n === 5 || (prof <= 0 && v[4])) { const p = montar(t0, t1, q0, q1); if (p) out.push(p); return; }
  if (n === 0 || prof <= 0) return;
  for (const [a0, a1] of [[t0, tm], [tm, t1]]) for (const [b0, b1] of [[q0, qm], [qm, q1]]) refinar(a0, a1, b0, b1, existe, montar, out, prof - 1);
}

/** As arquibancadas de uma planta curva: por fatia e por trecho do perfil, o trapézio em pé do chão até o degrau (o sólido
 *  `y <= perfil(s) + f` entre rF e rB; na genérica só onde há arquibancada — temArquibancada no ponto e rB − rF ≥ 2,5 m —,
 *  com as pontas refinadas) e a parede de trás. */
function* arquibancadasDaPlanta(P, opc, out) {
  const NS = opc.perfil, gen = !!P.generica;
  const existe = gen ? (th, s) => P.rB(th) - P.rF(th) >= 2.5 && P.temArquibancada(...P.ponto(th, s)) : () => true;
  const montar = (t0, t1, s0, s1) => {
    const pts = [];
    for (const th of [t0, t1]) {
      const a = P.rF(th), b = P.rB(th);
      for (const s of [s0, s1]) {
        const [x, z] = pol(a + s * (b - a), th), y = gen ? P.perfil(s, th) : P.perfil(s);
        pts.push(x, 0, z, x, y, z);
      }
    }
    return { tipo: 'pontos', classe: 'arquibancada', pts };
  };
  // a parede de trás (o parapeito da última fileira e o miolo até a fachada; o sólido 'parede de trás'): de rB até a face
  // de fora da fachada (no talude, rB + 2,6), do chão até o topo + 1,3 m (genérica) ou até a laje/o muro (Maracanã)
  const parede = (t0, t1) => {
    const pts = [];
    for (const th of [t0, t1]) {
      const b = P.rB(th), rf = gen && P.talude ? b + 2.6 : P.rFach(th);
      const y = gen ? P.yTopo(th) + 1.3 : paredeMaracana(P);
      for (const r of [b, rf]) { const [x, z] = pol(r, th); pts.push(x, 0, z, x, y, z); }
    }
    return { tipo: 'pontos', classe: 'arquibancada', pts };
  };
  let nf = 0;
  for (const [t0, t1] of fatias(opc.fatias)) {
    for (let j = 0; j < NS; j++) refinar(t0, t1, j / NS, (j + 1) / NS, existe, montar, out);
    refinar(t0, t1, 1, 1, existe, (a, b) => parede(a, b), out);
    if (++nf % opc.fatiasPorPausa === 0) yield 'peças';
  }
}
/** A altura da parede de trás do Maracanã (estadio-planta.js solido: a laje + o parapeito ou o topo + o parapeito + o muro). */
function paredeMaracana(P) {
  const Pf = P.forma.perfil;
  return Math.max(Pf.laje + Pf.parapeito, Pf.yTopo + Pf.parapeito + (Pf.muro ?? 0));
}

/** A cobertura de uma planta genérica (estadio-generico.js cobEm: a chapa de yFora a yDentro, ±1,2 m, e a treliça e a
 *  testeira penduradas embaixo da borda de dentro — 15% de dentro, 3,6 m com treliça ou 2,2 m; só onde cobEm existe e, nos
 *  cantos abertos, onde há arquibancada na mesma fileira — as pontas refinadas). */
function* coberturaGenerica(P, opc, out) {
  const C = P.forma.cobertura;
  if (!C || C.tipo === 'nenhuma') return;
  const baixoIn = C.sust === 'trelica' ? 3.6 : 2.2;
  const existe = (th, u) => {
    const c = P.cobEm(th);
    if (!c) return false;
    if (!P.abertos) return true;
    const r = c.fora - u * (c.fora - c.dentro), a = P.rF(th), b = P.rB(th), s = clamp((r - a) / Math.max(1e-6, b - a), 0, 1);
    return P.temArquibancada(...P.ponto(th, s));
  };
  const montar = (t0, t1, u0, u1) => {
    const baixo = (u0 + u1) / 2 > 0.85 ? baixoIn : 1.2, pts = [], cm = P.cobEm((t0 + t1) / 2);
    for (const th of [t0, t1]) {
      // (no último refino a ponta pode cair fora da cobertura: a do meio do pedaço)
      const c = P.cobEm(th) ?? cm;
      if (!c) return null;
      for (const u of [u0, u1]) {
        const r = c.fora - u * (c.fora - c.dentro), y = lerp(c.yFora, c.yDentro, u), [x, z] = pol(r, th);
        pts.push(x, y - baixo, z, x, y + 1.2, z);
      }
    }
    return { tipo: 'pontos', classe: 'cobertura', pts };
  };
  let nf = 0;
  for (const [t0, t1] of fatias(opc.fatias)) {
    for (const [u0, u1] of [[0, 0.85], [0.85, 1]]) refinar(t0, t1, u0, u1, existe, montar, out);
    if (++nf % opc.fatiasPorPausa === 0) yield 'peças';
  }
}

/** As peças finas de uma planta genérica pelo DESENHO (render/estadio-generico.js estruturaExtra, as medidas em
 *  estadio-forma.js DESENHO_TORRES): as torres de refletor (o poste no alto da arquibancada, a estrutura larga por cima do
 *  lado, a torre de canto com a cabeça virada para o meio), o telão, o cubo e as vigas-treliça. */
function finasGenericas(P) {
  const out = [], D = DESENHO_TORRES;
  for (const t of P.torres) {
    const h = Math.atan2(-t.z, -t.x);
    if (t.poste) {
      out.push(cilindro('refletor', t.x, t.z, t.alto - D.poste.abaixo, t.alto - 1, D.poste.raio));
      out.push(caixa('refletor', t.x, t.alto - 0.6, t.z, D.poste.cabeca[0], D.poste.cabeca[1], D.poste.cabeca[2], h));
    } else if (t.larga) {
      for (const s of [-1, 1]) out.push(cilindro('refletor', s * D.larga.x, t.z, 0, t.alto, D.larga.raio[0], D.larga.raio[1]));
      out.push(caixa('refletor', 0, t.alto - 2, t.z, D.larga.viga[0], D.larga.viga[1], D.larga.viga[2], 0));
    } else {
      out.push(cilindro('refletor', t.x, t.z, 0, t.alto - 3, D.torre.raio[0], D.torre.raio[1]));
      out.push(caixa('refletor', t.x, t.alto - 1.5, t.z, D.torre.cabeca[0], D.torre.cabeca[1], D.torre.cabeca[2], h));
    }
  }
  for (const m of P.marcas) {
    if (m.tipo === 'telao') out.push(caixa('telão', m.x, m.y, m.z, m.larg, m.alt, D.telao, m.th + Math.PI / 2));
    else if (m.tipo === 'cubo') out.push(caixa('cubo', 0, m.y, 0, m.lado, m.alt, m.lado, 0));
    else if (m.tipo === 'vigas') {
      const y1 = m.y, y0 = m.y - m.alto, X = D.vigas.ponta;
      const lados = [[[-m.hx - X, -m.hz], [m.hx + X, -m.hz]], [[-m.hx - X, m.hz], [m.hx + X, m.hz]], [[-m.hx, -m.hz - X], [-m.hx, m.hz + X]], [[m.hx, -m.hz - X], [m.hx, m.hz + X]]];
      for (const [a, b] of lados) {
        out.push(barra('viga', [a[0], y1, a[1]], [b[0], y1, b[1]], D.vigas.cima));
        out.push(barra('viga', [a[0], y0, a[1]], [b[0], y0, b[1]], D.vigas.baixo));
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.round(L / D.vigas.passo);
        for (let i = 0; i < n; i++) {
          const p = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], [xa, za] = p(i / n), [xb, zb] = p((i + 1) / n);
          out.push(barra('viga', [xa, i % 2 ? y0 : y1, za], [xb, i % 2 ? y1 : y0, zb], D.vigas.diagonal));
        }
      }
    }
  }
  // a caixa do túnel por cima da pista (o sólido 'túnel (paredes)': da boca até a 1ª fileira do lado de cá)
  const T = ESTADIO.tunel, za = T.z, zb = P.rF(Math.PI / 2);
  if (zb > T.z + 0.5) out.push(caixa('túnel', 0, (T.altura + T.laje) / 2, (za + zb) / 2, T.largura + 0.8, T.altura + T.laje, zb - za, 0));
  return out;
}

/** A cobertura do Maracanã (estadio-planta.js: a membrana de rCobFora a rCobDentro pelos nós de alturaCob, com o relevo dos
 *  cones, e a passarela debaixo da linha dos mastros) e os telões (o sólido: a caixa de larg × alt × 2 m). */
function* coberturaMaracana(P, opc, out) {
  const C = P.forma.cobertura, NC = P.nosCob;
  const cima = 1.0 + (C.cone ?? 0), baixo = 1.0 + (C.vale ?? 0);
  // os trechos de u pelos nós (a altura é linear entre eles) e a borda do sólido (u de −0,03 a 1,01)
  const us = [-0.03, ...NC.map(n => n[0]).filter(u => u > 0 && u < 1), 1.01];
  let nf = 0;
  for (const [t0, t1] of fatias(opc.fatias)) {
    if (++nf % opc.fatiasPorPausa === 0) yield 'peças';
    for (let j = 0; j + 1 < us.length; j++) {
      const pts = [];
      for (const th of [t0, t1]) for (const u of [us[j], us[j + 1]]) {
        const [x, z] = P.pontoCob(th, u), y = P.alturaCob(clamp(u, 0, 1));
        pts.push(x, y - baixo, z, x, y + cima, z);
      }
      out.push({ tipo: 'pontos', classe: 'cobertura', pts });
    }
    // a passarela: 1,4 m de cada lado da linha dos mastros, de yPassarela − 0,6 até yMastro
    const pts = [];
    for (const th of [t0, t1]) {
      const o = P.pontoCob(th, 0)[2], d = P.pontoCob(th, 1)[2], rm = o - P.uMastro * (o - d);
      for (const r of [rm - 1.4, rm + 1.4]) { const [x, z] = pol(r, th); pts.push(x, C.yPassarela - 0.6, z, x, C.yMastro, z); }
    }
    out.push({ tipo: 'pontos', classe: 'passarela', pts });
  }
  if (opc.finas) for (const t of P.TELOES ?? []) out.push(caixa('telão', t.x, t.y, t.z, 2, t.alt, t.larg, t.th));
}

/**
 * As peças do estádio que fazem sombra: `planta` = a planta da forma (estadio-planta.js criarPlanta ou estadio-generico.js
 * criarPlantaGenerica; null = o Estádio Golaço). opc: {fatias, perfil} (SOMBRA_ESTADIO), `finas` (false: sem as peças finas).
 */
export function pecasDoEstadio(planta = null, opc = {}) {
  const out = [], it = gerarPecas(planta, opc, out);
  while (!it.next().done) { /* até o fim */ }
  return out;
}
/** As peças em `out`, EM FATIAS (um gerador: pára a cada `fatiasPorPausa` fatias da volta) — o calcularMascara da página. */
export function* gerarPecas(planta = null, opc = {}, out = []) {
  const o = { ...SOMBRA_ESTADIO, finas: true, fatiasPorPausa: 40, ...opc };
  out.push(...pecasComuns());
  if (!planta) {
    const g = pecasGolaco();
    out.push(...(o.finas ? g : g.filter(p => p.classe !== 'refletor')));
    return out;
  }
  yield* arquibancadasDaPlanta(planta, o, out);
  if (planta.generica) {
    yield* coberturaGenerica(planta, o, out);
    if (o.finas) out.push(...finasGenericas(planta));
    else { const T = ESTADIO.tunel, zb = planta.rF(Math.PI / 2); if (zb > T.z + 0.5) out.push(caixa('túnel', 0, (T.altura + T.laje) / 2, (T.z + zb) / 2, T.largura + 0.8, T.altura + T.laje, zb - T.z, 0)); }
  } else yield* coberturaMaracana(planta, o, out);
  return out;
}

// ------------------------------------------------------------------ a projeção, a grade e a distância

/** O fecho convexo (cadeia monótona de Andrew) de pontos 2D [x, z, …]: os vértices em sentido anti-horário [x, z, …]. */
export function fechoConvexo(xs) {
  const n = xs.length / 2, idx = Array.from({ length: n }, (_, i) => i);
  idx.sort((a, b) => xs[2 * a] - xs[2 * b] || xs[2 * a + 1] - xs[2 * b + 1]);
  const cruz = (o, a, b) => (xs[2 * a] - xs[2 * o]) * (xs[2 * b + 1] - xs[2 * o + 1]) - (xs[2 * a + 1] - xs[2 * o + 1]) * (xs[2 * b] - xs[2 * o]);
  const lo = [], hi = [];
  for (const i of idx) { while (lo.length >= 2 && cruz(lo[lo.length - 2], lo[lo.length - 1], i) <= 0) lo.pop(); lo.push(i); }
  for (let k = idx.length - 1; k >= 0; k--) { const i = idx[k]; while (hi.length >= 2 && cruz(hi[hi.length - 2], hi[hi.length - 1], i) <= 0) hi.pop(); hi.push(i); }
  lo.pop(); hi.pop();
  const out = [];
  for (const i of lo.concat(hi)) out.push(xs[2 * i], xs[2 * i + 1]);
  return out;
}

/** A sombra da peça no chão: o polígono convexo [x, z, …] (os vértices projetados pelo raio do sol, k = deslocamentoSol). */
export function sombraDaPeca(p, k) {
  const v = verticesDe(p), xs = [];
  for (let i = 0; i < v.length; i += 3) xs.push(v[i] + v[i + 1] * k[0], v[i + 2] + v[i + 1] * k[1]);
  return fechoConvexo(xs);
}

/** Pinta o polígono convexo `poli` na grade binária g (nx × nz, células de h m a partir de x0, z0; o centro da célula dentro). */
function pintar(g, nx, nz, x0, z0, h, poli) {
  const n = poli.length / 2;
  if (n < 3) return;
  let zmin = Infinity, zmax = -Infinity;
  for (let i = 0; i < n; i++) { zmin = Math.min(zmin, poli[2 * i + 1]); zmax = Math.max(zmax, poli[2 * i + 1]); }
  const j0 = Math.max(0, Math.ceil((zmin - z0) / h - 0.5)), j1 = Math.min(nz - 1, Math.floor((zmax - z0) / h - 0.5));
  for (let j = j0; j <= j1; j++) {
    const zc = z0 + (j + 0.5) * h;
    let xa = Infinity, xb = -Infinity;
    for (let i = 0; i < n; i++) {
      const ax = poli[2 * i], az = poli[2 * i + 1], bx = poli[(2 * i + 2) % (2 * n)], bz = poli[(2 * i + 3) % (2 * n)];
      if ((az <= zc && bz >= zc) || (bz <= zc && az >= zc)) {
        const x = Math.abs(bz - az) < 1e-12 ? Math.min(ax, bx) : ax + (bx - ax) * (zc - az) / (bz - az);
        const x2 = Math.abs(bz - az) < 1e-12 ? Math.max(ax, bx) : x;
        xa = Math.min(xa, x); xb = Math.max(xb, x2);
      }
    }
    if (!(xb >= xa)) continue;
    const i0 = Math.max(0, Math.ceil((xa - x0) / h - 0.5)), i1 = Math.min(nx - 1, Math.floor((xb - x0) / h - 0.5));
    const lin = j * nx;
    for (let i = i0; i <= i1; i++) g[lin + i] = 1;
  }
}

const INF = 1e20;
/** A transformada de distância (quadrada) 1D exata de Felzenszwalb e Huttenlocher (2012) em f[0..n) (passo 1), em d. */
function dt1(f, n, d, v, z) {
  let k = 0;
  v[0] = 0; z[0] = -INF; z[1] = INF;
  for (let q = 1; q < n; q++) {
    let s;
    do { const p = v[k]; s = ((f[q] + q * q) - (f[p] + p * p)) / (2 * q - 2 * p); } while (s <= z[k] && --k >= 0);
    k++; v[k] = q; z[k] = s; z[k + 1] = INF;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; const p = v[k]; d[q] = (q - p) * (q - p) + f[p]; }
}
/** O espaço da transformada 1D (n = o maior lado). */
function auxDistancia(n) { return { f: new Float64Array(n), d: new Float64Array(n), v: new Int32Array(n), z: new Float64Array(n + 1) }; }
/** 1ª passada (as colunas): out = a distância quadrada (em células) até a célula mais perto com g == alvo na mesma coluna.
 *  Gerador: pára a cada `bloco` colunas. */
function* colunas(g, nx, nz, alvo, out, { f, d, v, z }, bloco) {
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) f[j] = g[j * nx + i] === alvo ? 0 : INF;
    dt1(f, nz, d, v, z);
    for (let j = 0; j < nz; j++) out[j * nx + i] = d[j];
    if ((i + 1) % bloco === 0) yield 'distância';
  }
}
/** 2ª passada (as linhas), no lugar: a distância quadrada euclidiana exata (Felzenszwalb e Huttenlocher, §3: separável).
 *  Gerador: pára a cada `bloco` linhas. */
function* linhas(nx, nz, out, { f, d, v, z }, bloco) {
  for (let j = 0; j < nz; j++) {
    const lin = j * nx;
    for (let i = 0; i < nx; i++) f[i] = out[lin + i];
    dt1(f, nx, d, v, z);
    for (let i = 0; i < nx; i++) out[lin + i] = d[i];
    if ((j + 1) % bloco === 0) yield 'distância';
  }
}

/**
 * A MÁSCARA do chão: a distância com sinal (m) à borda da sombra do estádio — > 0 ao sol, < 0 na sombra — numa textura de
 * 8 bits (R; 0,5 = a borda, ±`faixa` m nos extremos), texel de `passo` m sobre a `caixa`. EM FATIAS (um gerador: pára depois
 * de cada `lote` de peças e de cada passada da distância — a página roda no tempo ocioso, render/sombra-estadio-gpu.js); o
 * `return` é a máscara {nx, nz, x0, z0, passo, faixa, penumbra, k (o deslocamento do sol), dados (Uint8Array nx·nz, linha a
 * linha a partir de z0), npecas, sombra (a fração da caixa na sombra)}. `opc.pecas` = as peças já montadas (pecasDoEstadio).
 */
export function* calcularMascara(planta = null, sol = SOL_DIA, opc = {}) {
  const o = { ...SOMBRA_ESTADIO, ...opc };
  const [X0, Z0, X1, Z1] = o.caixa, h = o.fino, k = deslocamentoSol(sol);
  const nfx = Math.round((X1 - X0) / h), nfz = Math.round((Z1 - Z0) / h);
  const g = new Uint8Array(nfx * nfz);
  let pecas = o.pecas;
  if (!pecas) { pecas = []; yield* gerarPecas(planta, o, pecas); }
  yield 'peças';
  for (let i = 0; i < pecas.length; i++) {
    pintar(g, nfx, nfz, X0, Z0, h, sombraDaPeca(pecas[i], k));
    if ((i + 1) % o.lote === 0) yield 'pintura';
  }
  // a distância com sinal nos centros das células finas: ao sol, até o centro da célula de sombra mais perto − h/2; na
  // sombra, −(até o centro da célula ao sol mais perto − h/2)
  const dSol = new Float32Array(nfx * nfz), dSom = new Float32Array(nfx * nfz), aux = auxDistancia(Math.max(nfx, nfz));
  // (em blocos de `bloco` linhas da grade fina: ~1/6 de uma passada)
  const B = o.bloco;
  yield* colunas(g, nfx, nfz, 1, dSol, aux, B); yield* linhas(nfx, nfz, dSol, aux, B);
  yield* colunas(g, nfx, nfz, 0, dSom, aux, B); yield* linhas(nfx, nfz, dSom, aux, B);
  // a textura: o texel de `passo` m (r = passo / fino células finas) no CANTO comum das r × r do meio — com r = 2, a média
  // das 4 em volta do centro do texel
  const sd = (i) => (g[i] ? -(Math.sqrt(dSom[i]) - 0.5) * h : (Math.sqrt(dSol[i]) - 0.5) * h);
  let nSom = 0;
  for (let i = 0; i < g.length; i++) nSom += g[i];
  const r = Math.round(o.passo / h), nx = Math.round((X1 - X0) / o.passo), nz = Math.round((Z1 - Z0) / o.passo);
  const dados = new Uint8Array(nx * nz);
  const a = r / 2 - 1, b = r / 2;
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const fi = i * r, fj = j * r;
      const m = (sd((fj + a) * nfx + fi + a) + sd((fj + a) * nfx + fi + b) + sd((fj + b) * nfx + fi + a) + sd((fj + b) * nfx + fi + b)) / 4;
      dados[j * nx + i] = Math.round(clamp(0.5 + m / (2 * o.faixa), 0, 1) * 255);
    }
    if ((j + 1) % (B / 2) === 0) yield 'textura';
  }
  return { nx, nz, x0: X0, z0: Z0, passo: o.passo, faixa: o.faixa, penumbra: o.penumbra, k, dados, npecas: pecas.length, sombra: nSom / g.length };
}

/** A máscara de uma vez (Node, testes): calcularMascara até o fim, com o tempo em `ms` e as peças em `pecas`. */
export function mascaraDoChao(planta = null, sol = SOL_DIA, opc = {}) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const pecas = opc.pecas ?? pecasDoEstadio(planta, { ...SOMBRA_ESTADIO, ...opc });
  const it = calcularMascara(planta, sol, { ...opc, pecas });
  let r;
  do r = it.next(); while (!r.done);
  r.value.pecas = pecas;
  r.value.ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - t0;
  return r.value;
}

/** A máscara VAZIA (tudo ao sol): 1 × 1, o valor máximo. A de antes de o estádio chegar e a da noite. */
export function mascaraVazia() {
  const [X0, Z0, X1, Z1] = SOMBRA_ESTADIO.caixa;
  return { nx: 1, nz: 1, x0: X0, z0: Z0, passo: X1 - X0, passoZ: Z1 - Z0, faixa: SOMBRA_ESTADIO.faixa, penumbra: SOMBRA_ESTADIO.penumbra, k: deslocamentoSol(), dados: new Uint8Array([255]), npecas: 0, sombra: 0 };
}

// ------------------------------------------------------------------ a leitura (a MESMA do shader)

/** Os uniforms da máscara: uSombraCaixa = (x0, z0, 1/largura, 1/profundidade), uSombraK = k, uSombraFaixa, uSombraBorda (a
 *  meia penumbra). */
export function uniformsDaMascara(m) {
  const lx = m.nx * m.passo, lz = m.nz * (m.passoZ ?? m.passo);
  return { caixa: [m.x0, m.z0, 1 / lx, 1 / lz], k: [...m.k], faixa: m.faixa, borda: m.penumbra / 2 };
}

/** A distância com sinal (m) lida na máscara no chão (x, z): a filtragem BILINEAR do texel (o LinearFilter, borda presa) e a
 *  decodificação — o que a GPU faz no SOMBRA_GLSL_F. Fora da caixa, +faixa (sol). */
export function distanciaNoChao(m, x, z) {
  const U = uniformsDaMascara(m);
  const u = (x - U.caixa[0]) * U.caixa[2], v = (z - U.caixa[1]) * U.caixa[3];
  if (u < 0 || u > 1 || v < 0 || v > 1) return m.faixa;
  const fx = u * m.nx - 0.5, fz = v * m.nz - 0.5;
  const i0 = Math.floor(fx), j0 = Math.floor(fz), ax = fx - i0, az = fz - j0;
  const T = (i, j) => m.dados[clamp(j, 0, m.nz - 1) * m.nx + clamp(i, 0, m.nx - 1)] / 255;
  const t = lerp(lerp(T(i0, j0), T(i0 + 1, j0), ax), lerp(T(i0, j0 + 1), T(i0 + 1, j0 + 1), ax), az);
  return (t - 0.5) * 2 * m.faixa;
}

/** O sol no chão (x, z): 0 na sombra, 1 ao sol, a borda pela smoothstep de ±(meia penumbra + w) — w = a pegada do pixel (m;
 *  o fwidth do shader, 0 aqui por padrão). A conta do sombraSol do SOMBRA_GLSL_F. */
export function solNoChao(m, x, z, w = 0) {
  const d = distanciaNoChao(m, x, z), e = m.penumbra / 2 + w;
  const t = clamp((d + e) / (2 * e), 0, 1);
  return t * t * (3 - 2 * t);
}

/** O sol no ponto (x, y, z) perto do chão (abaixo do que faz sombra): o chão tocado pelo raio do sol que passa por ele. */
export function solEm(m, x, y, z, w = 0) {
  return solNoChao(m, x + y * m.k[0], z + y * m.k[1], w);
}

// ------------------------------------------------------------------ o GLSL (o render/sombra-estadio-gpu.js injeta)

/** Vertex: as declarações (depois do #include <common>). Com SOMBRA_SO_CHAO (o piso das plantas, na malha das
 *  arquibancadas: a pista, o piso em volta, a faixa azul) o fator só vale abaixo dessa altura do mundo (m). */
export const SOMBRA_GLSL_V_DECL = `
uniform vec2 uSombraK;
varying vec2 vSombraChao;
#ifdef SOMBRA_SO_CHAO
varying float vSombraY;
#endif`;
/** Vertex: o chão tocado pelo raio do sol (depois do #include <project_vertex>: a posição do mundo com a instância e o lote,
 *  a mesma conta do project_vertex do three). */
export const SOMBRA_GLSL_V = `
{
  vec4 sombraP = vec4( transformed, 1.0 );
  #ifdef USE_BATCHING
    sombraP = batchingMatrix * sombraP;
  #endif
  #ifdef USE_INSTANCING
    sombraP = instanceMatrix * sombraP;
  #endif
  sombraP = modelMatrix * sombraP;
  vSombraChao = sombraP.xz + sombraP.y * uSombraK;
  #ifdef SOMBRA_SO_CHAO
    vSombraY = sombraP.y;
  #endif
}`;
/** Fragment: as declarações e a leitura (depois do #include <common>). Sem derivada nas funções: a pegada vem pronta. */
export const SOMBRA_GLSL_F_DECL = `
uniform sampler2D uSombraMapa;
uniform vec4 uSombraCaixa;
uniform float uSombraFaixa;
uniform float uSombraBorda;
uniform float uSombraForca;
varying vec2 vSombraChao;
#ifdef SOMBRA_SO_CHAO
varying float vSombraY;
#endif
float sombraSol(vec2 g, float w) {
  vec2 uv = (g - uSombraCaixa.xy) * uSombraCaixa.zw;
  float d = (textureLod(uSombraMapa, uv, 0.0).r - 0.5) * 2.0 * uSombraFaixa;
  vec2 dentro = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  float e = uSombraBorda + w;
  float s = smoothstep(-e, e, d);
  return mix(1.0, s, uSombraForca * dentro.x * dentro.y);
}`;
/** Fragment, no TOPO do main (antes do 1º desvio e do discard do recorte): a pegada do pixel no chão e o fator do sol. */
export const SOMBRA_GLSL_F_TOPO = `
vec2 sombraFw = fwidth( vSombraChao );
float sombraFator = sombraSol( vSombraChao, 0.5 * max( sombraFw.x, sombraFw.y ) );
#ifdef SOMBRA_SO_CHAO
  sombraFator = mix( sombraFator, 1.0, step( SOMBRA_SO_CHAO, vSombraY ) );
#endif`;
/** Fragment: o fator só na luz direta do SOL — a luz de índice 0 (no laço das direcionais de lights_fragment_begin; o three
 *  põe primeiro a que faz sombra e, sem sombra, a ordem da cena: a do sol vem antes da `extra`). */
export const SOMBRA_GLSL_LUZ = `getDirectionalLightInfo( directionalLight, directLight );
		directLight.color *= ( UNROLLED_LOOP_INDEX == 0 ) ? sombraFator : 1.0;`;
/** O trecho do lights_fragment_begin do three r170 onde o fator entra (a troca avisa quando não acha). */
export const SOMBRA_TRECHO_LUZ = 'getDirectionalLightInfo( directionalLight, directLight );';
/** A altura (m do mundo) abaixo da qual vale o fator com `soChao` (o piso das plantas está a 0,012–0,03 m; a 1ª fileira a ≥ 1 m). */
export const SOMBRA_SO_CHAO = 0.25;

/**
 * As TROCAS no texto do shader do three (o onBeforeCompile vê os #include fechados) para um material receber a sombra do
 * estádio: {vertex, fragment} = listas de [de, para] (a 1ª ocorrência de cada `de`, em ordem, como o aplicarTrocas de
 * render/gramado-shader.js). `luzes` = o texto do THREE.ShaderChunk.lights_fragment_begin (o include sai aberto, com o fator
 * na luz do sol). `soChao`: o define do piso das plantas.
 */
export function trocasSombra(luzes, { soChao = false } = {}) {
  const def = soChao ? `\n#define SOMBRA_SO_CHAO ${SOMBRA_SO_CHAO.toFixed(2)}` : '';
  return {
    vertex: [
      ['#include <common>', '#include <common>' + def + SOMBRA_GLSL_V_DECL],
      ['#include <project_vertex>', '#include <project_vertex>' + SOMBRA_GLSL_V],
    ],
    fragment: [
      ['#include <common>', '#include <common>' + def + SOMBRA_GLSL_F_DECL],
      ['#include <clipping_planes_fragment>', SOMBRA_GLSL_F_TOPO + '\n#include <clipping_planes_fragment>'],
      ['#include <lights_fragment_begin>', luzes.includes(SOMBRA_TRECHO_LUZ) ? luzes.replace(SOMBRA_TRECHO_LUZ, () => SOMBRA_GLSL_LUZ) : '#include <lights_fragment_begin>'],
    ],
  };
}
