// Forma PARAMÉTRICA do estádio (pura: sem three.js nem DOM). Pedido do dono (16/10), depois de ver o Maracanã do
// pré-jogo: "não tem nada a ver com o maracanã. imagino que outros estádios estejam assim tb" — até aqui todo estádio
// real tinha a MESMA forma (a caixa de cantos arredondados de estadio-forma.js) e só mudavam as cores e a textura.
// Este módulo descreve a forma de verdade e é a fonte única das contas que o desenho (render/estadio-real.js), a
// torcida (onde cada um senta), os sólidos da câmera (estadio-forma.js solidoEm delega para cá) e os trilhos do
// pré-jogo usam. SÓ DESENHO: nada aqui toca a simulação (as placas, os gols, o túnel e os bancos são os de config.js).
//
// 1ª família: TIGELA OVAL COM ANEL DE COBERTURA (o Maracanã desde a reforma de 2010–2013). Medidas reais (pesquisa
// de 16/10: SBP/ArchDaily, Structurae, OSM, Wikipédia; o referencial é o do jogo, origem no centro do campo, x no
// comprimento, z na largura, +z = lado de cá = Leste/Bellini):
//   - 1ª fileira: superelipse (a 73, b 44,5, n 5,5) — ~11 m da lateral (b = a frente do túnel, config.js), ~20 m atrás
//     dos gols e livre da quina das placas (≥ 1,5 m na diagonal);
//   - última fileira: elipse 136 × 118 a 24,2 m; anel inferior até 27% da profundidade (9,2 m), a linha de camarotes
//     (vidro, até 11 m) e o anel superior em curva até o topo (a fresta de céu até a cobertura);
//   - cobertura: anel de 68 m de profundidade CONSTANTE (borda de fora elipse 148 × 129, a 30,6 m; o furo ~80 × 61),
//     60 eixos, a linha dos mastros a 46 m da borda (35,5 m) e a passarela técnica embaixo dela (22 m);
//   - fachada de 1950: 60 costelas em gancho na elipse 152 × 133 (cinta a 21 m, almofadas 21,5–26 m), 2 rampas
//     retas no meio dos lados compridos até os pórticos (r ≈ 247 m) e o entorno (Maracanãzinho, Bellini, trilhos,
//     Mangueira, maciço da Tijuca com o Cristo).
// Contas por ÂNGULO POLAR θ = atan2(z, x): cada fileira é a interpolação RADIAL entre a 1ª e a última (r = rF + s·(rB
// − rF)), então os corredores são radiais (os 60 vomitórios) e a conta inversa (ponto → fileira) é O(1) por tabela.
import { ESTADIO, CAMPO } from './config.js';
import { criarGradeAnel } from './render/cadeiras-dados.js';

const RAD = Math.PI / 180;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, p) => (Number.isFinite(Number(v)) ? Number(v) : p);

/** A forma padrão da família tigela (o Maracanã); o estadios.json pode trocar os números de cima. */
export const TIGELA_PADRAO = Object.freeze({
  familia: 'tigela',
  frente: { a: 73, b: ESTADIO.tunel.z, n: 5.5 },
  fundo: { a: 136, b: 118 },
  // perfil: y da mureta, fração e y do fim do anel inferior, camarote (degrau de vidro até yCam, laje até sCam), topo
  // (rodada 1 da prévia: o vidro dos camarotes é uma LINHA fina entre os anéis, ~1,8 m — antes 3,4 m pareciam dois
  // estádios —, e o topo a 24,2 m deixa a fresta de céu entre a última fileira e a cobertura, como no panorama de 2021)
  // (rodada 2: "a bacia é quase contínua, com a frente baixa: o anel inferior é maior e mais raso" — 42% da profundidade
  // até 10,6 m, ~16°, e o de cima mais em pé)
  // (rodada 3: "um vão preto entre o último degrau e a cobertura; no real é a fileira de camarotes e uma borda cinza-clara")
  // o muro dos camarotes de cima: `muro` m acima do parapeito, com a faixa de vidro, a `muroR` m atrás da última fileira
  // (rodada 4: "a bacia de DOIS anéis com uma faixa no meio; o Maracanã de hoje é UM anel contínuo"): o degrau entre os
  // anéis vira o espelho de 0,4 m do corredor de circulação (0,7 m de piso), onde abrem os vomitórios
  perfil: { y0: 1.8, sInf: 0.42, yInf: 10.6, sCam: 0.012, yCam: 11.0, yTopo: 24.2, curva: 1.1, parapeito: 1.2, laje: 24.0, muro: 3.4, muroR: 1.4 },
  // lugares da torcida: fileiras (inferior, superior), passo na fileira (m) e escala do torcedor (o de cima vale ~2)
  // (a escala do torcedor de cima: 1,3 → 1,15 no item 69, PR 4 — com o sorteio de ± 8%, dentro da escala do impostor, 1,25)
  fileiras: [32, 22], passo: [0.66, 0.88], escala: [1, 1.15],
  corredores: 60, corredorU: 0.08,
  // a borda de fora 2,8 m acima das almofadas (o vão de luz que a faz "flutuar"; a face do anel de compressão tem 1,6 m);
  // rodada 2: o furo ~10% maior (172 × 134; "160 × 122 em 296 × 259 parece pequeno" nas aéreas), a linha dos nós a ~2/3
  // da profundidade e o relevo dos cones entre os nós (`cone`: o pico no nó e o vale no meio da baia, em m)
  // rodada 3: os vincos em cone mais fundos ("gomos planos e iguais" vistos de cima)
  // rodada 4 ("de cima uma coroa de dentes; no real a membrana é quase lisa, só com as costuras radiais"; "do chão os cones
  // furam o céu como tenda de circo"): o relevo raso
  cobertura: { a: 148, b: 129, prof: 62, yFora: 30.6, yMastro: 35.5, yDentro: 33, mastro: 41, yPassarela: 22, eixos: 60, anel: 1.6, cone: 0.6, vale: 0.4 },
  fachada: { a: 152, b: 133, cinta: 21, alto: 27.6, eixos: 60 },
  // rodada 2: UMA rampa reta e larga (18 m) com guarda-corpo baixo (antes duas pistas, que pareciam um V) e o pórtico com
  // os degraus em leque (5 de 0,18 m)
  rampas: { larg: 18, zFim: 238, alto: 10.5, portico: { r: 247, larg: 66, alt: 14, base: 0.9 } },
  letreiro: 'ESTÁDIO MÁRIO FILHO',
  cadeiras: ['#f2c21b', '#2e6fc0', '#e9e9e4'],
  entorno: 'maracana',
});

/** Os vomitórios (rodada 4, ref-08): a boca escura no meio de cada gomo (g em graus dentro da fatia de 6°), nas
 * `fileiras` de cima do anel de baixo — a textura das cadeiras e os lugares da torcida usam o MESMO vão. */
export const VOM = Object.freeze({ fileiras: 3, g0: 2.3, g1: 3.7 });

// ------------------------------------------------------------------ superelipse em polar
/** Raio polar da superelipse (a, b, n) no ângulo θ. */
export function raioSuper(th, a, b, n = 2) {
  const c = Math.abs(Math.cos(th)) / a, s = Math.abs(Math.sin(th)) / b;
  // sem underflow (n alto): divide pelo maior
  const m = Math.max(c, s);
  if (m <= 0) return Math.max(a, b);
  return 1 / (m * Math.pow(Math.pow(c / m, n) + Math.pow(s / m, n), 1 / n));
}

/** Tabela de 3600 amostras (0,1°) de uma função de θ ∈ [−π, π), com leitura por interpolação. */
function tabela(fn) {
  const N = 3600, t = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) t[i] = fn(-Math.PI + (2 * Math.PI * i) / N);
  return th => {
    let u = ((th + Math.PI) / (2 * Math.PI)) * N;
    u = ((u % N) + N) % N;
    const i = Math.floor(u), w = u - i;
    return t[i] + (t[i + 1] - t[i]) * w;
  };
}

/** Validação da forma (estadios.json → números): devolve a forma completa ou null (sem família conhecida). */
export function validarForma(f) {
  if (!f || typeof f !== 'object' || (f.familia ?? 'tigela') !== 'tigela') return null;
  const P = TIGELA_PADRAO;
  const o = (k, sub) => ({ ...P[k], ...(f[k] && typeof f[k] === 'object' && !Array.isArray(f[k]) ? Object.fromEntries(Object.entries(f[k]).filter(([, v]) => Number.isFinite(Number(v)) || typeof v === 'object').map(([kk, v]) => [kk, typeof v === 'object' ? v : Number(v)])) : {}), ...(sub ?? {}) });
  const forma = {
    familia: 'tigela',
    frente: o('frente'), fundo: o('fundo'), perfil: o('perfil'),
    fileiras: P.fileiras, passo: P.passo, escala: P.escala, corredores: P.corredores, corredorU: P.corredorU,
    cobertura: o('cobertura'), fachada: o('fachada'), rampas: o('rampas'),
    letreiro: typeof f.letreiro === 'string' && f.letreiro.trim() ? f.letreiro.trim().slice(0, 40) : P.letreiro,
    cadeiras: Array.isArray(f.cadeiras) && f.cadeiras.length >= 2 && f.cadeiras.every(c => /^#[0-9a-f]{6}$/i.test(c)) ? f.cadeiras.slice(0, 4) : P.cadeiras,
    entorno: f.entorno === 'maracana' ? 'maracana' : 'generico',
  };
  // a frente do lado de cá em x = 0 é a boca do túnel (config.js; a simulação e o cortejo dependem dele)
  forma.frente.b = ESTADIO.tunel.z;
  // a 1ª fileira contém a quina das placas com folga ≥ 1,5 m na diagonal (senão abre o n)
  const PX = CAMPO.meioX + CAMPO.entorno + 0.14, PZ = CAMPO.meioZ + CAMPO.entorno + 0.14;
  const thq = Math.atan2(PZ, PX), rq = Math.hypot(PX, PZ);
  for (let k = 0; k < 40 && raioSuper(thq, forma.frente.a, forma.frente.b, forma.frente.n) < rq + 1.5; k++) forma.frente.n += 0.25;
  forma.fundo.a = Math.max(forma.fundo.a, forma.frente.a + 30); forma.fundo.b = Math.max(forma.fundo.b, forma.frente.b + 30);
  return forma;
}

/**
 * A planta da tigela: tudo o que o desenho, a torcida, os sólidos e os trilhos precisam saber da forma.
 * forma: a de validarForma (ou o próprio objeto do estadios.json).
 */
export function criarPlanta(formaBruta, opc = {}) {
  // dividida (identidade.js torcida.dividida: clássico): metade de cada torcida, a do mandante do lado +x (a organizada)
  const dividida = !!opc?.dividida;
  const F = formaBruta && formaBruta.perfil && formaBruta.frente && formaBruta.fundo && formaBruta.cobertura ? formaBruta : validarForma(formaBruta ?? {});
  if (!F) return null;
  const Fr = F.frente, Fu = F.fundo, Pf = F.perfil, C = F.cobertura, Fa = F.fachada;
  const rF = tabela(th => raioSuper(th, Fr.a, Fr.b, Fr.n));
  const rB = tabela(th => raioSuper(th, Fu.a, Fu.b, 2));
  const rCobFora = tabela(th => raioSuper(th, C.a, C.b, 2));
  const rFach = tabela(th => raioSuper(th, Fa.a, Fa.b, 2));
  // borda de dentro da cobertura: a curva PARALELA da de fora a C.prof m (profundidade constante), em polar
  const rCobDentro = (() => {
    const M = 7200, th = new Float64Array(M), rr = new Float64Array(M);
    for (let i = 0; i < M; i++) {
      const t = (2 * Math.PI * i) / M, cx = C.a * Math.cos(t), cz = C.b * Math.sin(t);
      let nx = Math.cos(t) / C.a, nz = Math.sin(t) / C.b;
      const l = Math.hypot(nx, nz); nx /= l; nz /= l;
      const x = cx - C.prof * nx, z = cz - C.prof * nz;
      th[i] = Math.atan2(z, x); rr[i] = Math.hypot(x, z);
    }
    const ord = Array.from({ length: M }, (_, i) => i).sort((p, q) => th[p] - th[q]);
    const ths = ord.map(i => th[i]), rs = ord.map(i => rr[i]);
    return tabela(a => {
      let lo = 0, hi = ths.length - 1;
      if (a <= ths[0] || a >= ths[hi]) { const w = (a - ths[hi] + 2 * Math.PI) % (2 * Math.PI) / ((ths[0] - ths[hi] + 2 * Math.PI) % (2 * Math.PI) || 1); return lerp(rs[hi], rs[0], clamp(w, 0, 1)); }
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ths[m] <= a) lo = m; else hi = m; }
      return lerp(rs[lo], rs[hi], (a - ths[lo]) / (ths[hi] - ths[lo] || 1));
    });
  })();

  // ---------------------------------------------------------------- perfil das cadeiras (s: 0 = 1ª fileira, 1 = última)
  const sC = Pf.sInf + Pf.sCam;
  const NUP = 6;
  /** Nós do perfil [s, y, v (textura)] na ordem — a malha e os lugares usam a MESMA interpolação linear. */
  const nos = [[0, Pf.y0, 0.04], [Pf.sInf, Pf.yInf, 0.46], [Pf.sInf + 0.002, Pf.yCam, 0.49], [sC, Pf.yCam, 0.51]];
  for (let k = 1; k <= NUP; k++) { const u = k / NUP; nos.push([sC + (1 - sC) * u, Pf.yCam + (Pf.yTopo - Pf.yCam) * Math.pow(u, Pf.curva), 0.51 + 0.46 * u]); }
  /** y do degrau na fração s da profundidade (linear entre os nós). */
  function perfil(s) {
    if (s <= 0) return Pf.y0;
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) { const [s0, y0] = nos[i - 1], [s1, y1] = nos[i]; return y0 + (y1 - y0) * (s - s0) / ((s1 - s0) || 1); }
    return Pf.yTopo;
  }
  /** v da textura das cadeiras em s (o mesmo mapa dos nós). */
  function vDe(s) {
    if (s <= 0) return nos[0][2];
    for (let i = 1; i < nos.length; i++) if (s <= nos[i][0]) { const [s0, , v0] = nos[i - 1], [s1, , v1] = nos[i]; return v0 + (v1 - v0) * (s - s0) / ((s1 - s0) || 1); }
    return nos[nos.length - 1][2];
  }
  /** Ponto (x, z) da fileira s no ângulo polar th. */
  function ponto(th, s) { const r = rF(th) + s * (rB(th) - rF(th)); return [r * Math.cos(th), r * Math.sin(th)]; }
  /** Fração da profundidade do ponto (x, z): < 0 antes da 1ª fileira, > 1 depois da última. */
  function sDe(x, z) { const th = Math.atan2(z, x), a = rF(th), b = rB(th); return (Math.hypot(x, z) - a) / (b - a); }
  // setores (os de torcida-dados.js): ψ normalizado pela 1ª fileira — a diagonal do canto em ±45°
  const psi = (x, z) => Math.atan2(z / Fr.b, x / Fr.a) / RAD;
  /** 0 lado de lá (z −), 1 fundo +x, 2 fundo −x, 3 lado de cá (z +). */
  function setor(x, z) { const p = psi(x, z); return p >= -135 && p <= -45 ? 0 : p > -45 && p < 45 ? 1 : p >= 45 && p <= 135 ? 3 : 2; }
  // ângulos polares das divisas dos setores (a malha corta ali: cada setor numa malha)
  const thDivisa = [Math.atan2(-Fr.b, Fr.a), Math.atan2(Fr.b, Fr.a), Math.atan2(Fr.b, -Fr.a), Math.atan2(-Fr.b, -Fr.a)];

  // ---------------------------------------------------------------- cobertura (u: 0 borda de fora → 1 borda de dentro)
  const uMastro = C.mastro / C.prof;
  const nosCob = [[0, C.yFora], [0.05, C.yFora + 0.7], [0.3, lerp(C.yFora, C.yMastro, 0.55)], [uMastro, C.yMastro], [lerp(uMastro, 1, 0.5), lerp(C.yMastro, C.yDentro, 0.4)], [1, C.yDentro]];
  function alturaCob(u) {
    for (let i = 1; i < nosCob.length; i++) if (u <= nosCob[i][0]) { const [u0, y0] = nosCob[i - 1], [u1, y1] = nosCob[i]; return y0 + (y1 - y0) * (u - u0) / ((u1 - u0) || 1); }
    return C.yDentro;
  }
  /** Relevo dos cones (0 nas duas bordas, 1 na linha dos nós): × C.cone na nervura (o nó), × −C.vale no meio da baia. */
  function cone(u) { const k = u <= uMastro ? u / uMastro : (1 - u) / (1 - uMastro); return Math.pow(clamp(k, 0, 1), 0.85); }
  /** Ponto da cobertura no ângulo th e na fração u (de fora para dentro): [x, z, r]. */
  function pontoCob(th, u) { const r = rCobFora(th) - u * (rCobFora(th) - rCobDentro(th)); return [r * Math.cos(th), r * Math.sin(th), r]; }
  /** u da cobertura no ponto (x, z) (< 0 fora dela, > 1 no furo). */
  function uCob(x, z) { const th = Math.atan2(z, x), o = rCobFora(th), d = rCobDentro(th); return (o - Math.hypot(x, z)) / (o - d); }

  // ---------------------------------------------------------------- fachada (costelas em gancho)
  // perfil da costela [n (para fora da elipse da fachada), y]: o GANCHO de concreto (rodada 2: "saem do chão inclinadas
  // para fora, se abrem e, no topo, viram para dentro abraçando a almofada branca"). Rodada 3 ("pilares grossos inclinados
  // para fora em PARÊNTESE"): até a cinta a curva n = 4,6·(y/cinta)^1,5 (quase de pé embaixo, abrindo em cima), sobe por
  // fora da almofada e dobra para DENTRO até o anel de compressão
  const yAnel = C.yFora - (C.anel ?? 1.6);
  const COSTELA = [];
  for (let k = 0; k <= 7; k++) { const y = (Fa.cinta * k) / 7; COSTELA.push([4.6 * Math.pow(y / Fa.cinta, 1.5), y]); }
  const iCinta = COSTELA.length - 1;
  COSTELA.push([5.4, 23], [5.1, 25.4], [3.0, 27.3], [-1.0, yAnel - 0.7], [-Fa.a + C.a - 0.3, yAnel]);
  /** Recuo da face de fora da fachada (n) na altura y (pela costela, só até a cinta). */
  function nFachada(y) {
    if (y >= Fa.cinta) return COSTELA[iCinta][0];
    for (let i = 1; i <= iCinta; i++) if (y <= COSTELA[i][1]) { const [n0, y0] = COSTELA[i - 1], [n1, y1] = COSTELA[i]; return n0 + (n1 - n0) * (y - y0) / ((y1 - y0) || 1); }
    return COSTELA[iCinta][0];
  }

  // ---------------------------------------------------------------- rampas e pórticos (x ≈ 0, nos dois lados compridos)
  const R = F.rampas;
  const zFach0 = Fa.b;                         // a fachada em x = 0
  /** y do tabuleiro da rampa em |z| (sobe para a fachada; null fora dela). */
  function yRampa(az) { if (az < zFach0 - 1 || az > R.zFim) return null; return R.alto * clamp((R.zFim - az) / (R.zFim - zFach0), 0, 1) + (R.portico.base ?? 0.6); }

  // ---------------------------------------------------------------- entorno (posições reais no referencial do jogo)
  const E = {
    maracanazinho: { x: -120, z: 181, r: 59, parede: 9, cupula: 19 },
    bellini: { x: 2, z: 280 },
    aquatico: { x: 97, z: 222 },
    // trilhos: o PÁTIO da SuperVia e do metrô no chão (rodada 2: "muitos trilhos paralelos ao lado longo norte/nordeste";
    // sem viaduto), reta por (214, −129) na direção (0,515; 0,857); a estação Maracanã (plataformas cobertas) em t e a
    // passarela curva da esplanada por cima dos trilhos até ela
    trilhos: { p: [214, -129], d: [0.515, 0.857], larg: 64, estacao: { t: -150, comp: 170 } },
    mangueira: { x: 330, z: -900, r: 380, h: 95 },
    uerj: { x: -142, z: -441 },
    // Estádio de Atletismo Célio de Barros (a pista vermelha) ao lado do parque aquático
    celio: { x: 228, z: 208, a: 88, b: 46 },
    esplanada: 340,
    bairro: 1300,      // o chão do bairro (texturas pintadas: telhados, árvores, ruas tortas, a favela no morro)
    // gramados e bosques da esplanada [x0, z0, x1, z1] (o desenho pinta e põe as copas de árvore)
    // (rodada 3: "gramados verde-saturado demais; no real é esplanada de concreto cinza com estacionamentos grandes e
    // árvores esparsas" — sobram 7 gramados; os outros viraram estacionamentos, só pintados no chão)
    gramados: [[-340, 150, -230, 340], [-340, -340, -200, -260], [-150, 300, 80, 340], [150, -330, 260, -250], [175, -150, 300, -60], [175, 40, 225, 160], [240, 260, 330, 335]],
    estacPintados: [[-300, -200, -215, -110], [-290, -105, -215, -20], [-335, -250, -250, -160], [-260, -330, -175, -272], [-130, -330, -60, -282], [60, 292, 160, 334], [-130, -250, -62, -192], [-205, 0, -181, 90]],
  };
  // a rampa CURVA de concreto (rodada 4, ref-01: "faltam as duas rampas grandes da vista de cima"): a helicoidal de 3
  // pavimentos encostada na fachada do lado da UERJ (a boca virada para a fachada) e a passarela comprida sobre pilares
  // que sai dela por cima da esplanada e da avenida até o campus (a passarela da UERJ)
  {
    const t = -158 * RAD, bx = Fa.a * Math.cos(t), bz = Fa.b * Math.sin(t);
    let nx = Math.cos(t) / Fa.a, nz = Math.sin(t) / Fa.b; const l = Math.hypot(nx, nz); nx /= l; nz /= l;
    E.rampaCurva = { x: bx + nx * 27, z: bz + nz * 27, nx, nz, r0: 8, r1: 21, niveis: [3.7, 7.3, 10.9] };
    const a = [E.rampaCurva.x - 6, E.rampaCurva.z - 19], b = [-150, -405];
    E.passarelaUerj = { a, b, y: 9.6, larg: 7 };
  }
  const naRampaUerj = (x, z, m = 0) => {
    const Rc = E.rampaCurva, Pu = E.passarelaUerj;
    if (Math.hypot(x - Rc.x, z - Rc.z) < Rc.r1 + m) return true;
    const dx = Pu.b[0] - Pu.a[0], dz = Pu.b[1] - Pu.a[1], t = clamp(((x - Pu.a[0]) * dx + (z - Pu.a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
    return Math.hypot(x - Pu.a[0] - dx * t, z - Pu.a[1] - dz * t) < Pu.larg / 2 + m;
  };
  // distância (com sinal) à reta dos trilhos
  const distTrilho = (x, z) => { const T = E.trilhos; return (x - T.p[0]) * T.d[1] - (z - T.p[1]) * T.d[0]; };

  // ---------------------------------------------------------------- lugares da torcida
  /**
   * Os lugares (um torcedor desenhado vale ~1 cadeira embaixo e ~2 em cima): {n, fileiras, iterar(cadeira)} no formato
   * de torcida-dados.js gerarTorcidaNiveis (cadeira(setor, f, a, x, y, z, escala, iMascara)). f = 0 é a fileira de cima;
   * corredores radiais (os mesmos da textura) e nada em cima da boca do túnel.
   */
  /** 1 ao sol, ~0,6 na sombra da cobertura (o sol do dia de render/cena.js; o raio até a altura da borda de fora). */
  const SOLD = [-0.42, 0.74, 0.52];
  function luzDoSol(x, y, z) {
    const t = (C.yFora + 1.5 - y) / SOLD[1];
    if (t <= 0) return 1;
    const u = uCob(x + SOLD[0] * t, z + SOLD[2] * t);
    return u >= -0.02 && u <= 1.0 ? 0.66 : 1;
  }
  // ---------------------------------------------------------------- a grade das cadeiras (item 69)
  // As fileiras de ~0,8 m (render/cadeiras-dados.js criarGradeAnel: o número pela profundidade média de cada anel) e, em
  // cada uma, as cadeiras de ≥ 0,5 m entre as 60 escadas radiais (o gomo: 1/60 da volta pelo arco no meio; a escada nos
  // primeiros corredorU dele).
  // Fonte única da textura das cadeiras (render/estadio-real.js), do degrau em escada e dos lugares da torcida.
  const passoCorrG = 360 / F.corredores;
  const TT = ESTADIO.tunel, mtT = TT.largura / 2 + 0.4, topoTunelT = TT.altura + TT.laje + 0.3;
  // o u da textura das cadeiras pelo ARCO no meio da profundidade (s = 0,5): os 30 ladrilhos (60 gomos, cada um com a
  // escada no começo) de comprimento igual pela volta — as escadas radiais a distâncias iguais e a cadeira com ~a mesma
  // largura nos lados e nos fundos (por ângulo, a frente dos lados tinha cadeiras de 0,36 m e a dos fundos de 0,77 m)
  const NLAD = F.corredores / 2;
  const arcoU = (() => {
    const N = 3600, acc = new Float64Array(N + 1);
    let px = 0, pz = 0;
    for (let i = 0; i <= N; i++) {
      const th = -Math.PI + (2 * Math.PI * i) / N, [x, z] = ponto(th, 0.5);
      if (i > 0) acc[i] = acc[i - 1] + Math.hypot(x - px, z - pz);
      px = x; pz = z;
    }
    const tot = acc[N];
    for (let i = 0; i <= N; i++) acc[i] = (acc[i] / tot) * NLAD - NLAD / 2;
    const uDe = th => { let u = ((th + Math.PI) / (2 * Math.PI)) * N; u = clamp(u, 0, N); const i = Math.min(N - 1, Math.floor(u)); return acc[i] + (acc[i + 1] - acc[i]) * (u - i); };
    const thDe = u => {
      let lo = 0, hi = N;
      const uu = clamp(u, acc[0], acc[N]);
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (acc[m] <= uu) lo = m; else hi = m; }
      const w = (uu - acc[lo]) / ((acc[hi] - acc[lo]) || 1);
      return -Math.PI + (2 * Math.PI * (lo + w)) / N;
    };
    return { uDe, thDe, u0: -NLAD / 2, u1: NLAD / 2 };
  })();
  /** O u da textura das cadeiras no ângulo th (ladrilhos de 2 gomos) e a posição no gomo (0–1). */
  const uTex = th => arcoU.uDe(th);
  const noGomo = th => { const u = arcoU.uDe(th) * 2; return u - Math.floor(u); };
  let _grade = null;
  function grade() {
    if (_grade) return _grade;
    let soma = 0;
    const N = 360;
    for (let i = 0; i < N; i++) { const th = -Math.PI + (2 * Math.PI * (i + 0.5)) / N; soma += rB(th) - rF(th); }
    const profMedia = soma / N;
    // a metade do ladrilho (um gomo) na fileira s: o perímetro dela pelos 60 gomos
    const meiaMedia = sm => { let t = 0, px = 0, pz = 0; for (let i = 0; i <= N; i++) { const [x, z] = ponto(-Math.PI + (2 * Math.PI * i) / N, sm); if (i) t += Math.hypot(x - px, z - pz); px = x; pz = z; } return t / F.corredores; };
    _grade = criarGradeAnel({
      faixas: [[0, Pf.sInf], [sC, 1]], profMedia,
      perfil: s2 => perfil(s2), ponto, vDe, setor,
      trechos: [arcoU],
      corredor: F.corredorU, meiaMedia,
      existe: (th, r, x, z, y) => {
        if (z > 0 && Math.abs(x) < mtT && y < topoTunelT) return false;
        // os vomitórios: a boca escura no meio de cada gomo, nas VOM.fileiras de cima do anel de baixo
        if (r.faixa === 0 && r.iFaixa >= r.nFaixa - VOM.fileiras) { const g = noGomo(th) * passoCorrG; if (g >= VOM.g0 && g <= VOM.g1) return false; }
        return true;
      },
    });
    return _grade;
  }
  /** O piso do degrau (y) da fileira que contém o ponto (x, z) — onde o torcedor senta (null fora das cadeiras). */
  function pisoEm(x, z) { const r = grade().fileiraDe(sDe(x, z)); return r ? perfil(r.s0) : null; }

  /**
   * Os lugares (um torcedor desenhado vale ~1 cadeira embaixo e ~2 em cima): {n, fileiras, iterar(cadeira)} no formato
   * de torcida-dados.js gerarTorcidaNiveis (cadeira(setor, f, a, x, y, z, escala, iMascara, luz)). Cada lugar é uma
   * CADEIRA da grade (item 69: o piso do degrau, o centro do assento): embaixo todas as fileiras dela, em cima uma sim,
   * uma não (o torcedor maior vale 2); f = 0 é a fileira de cima; nada na escada, nos vomitórios nem na boca do túnel.
   */
  function gerarLugares() {
    const G = grade();
    const k1 = G.fileiras.find(q => q.faixa === 1).k;
    const usadas = G.fileiras.filter(r => r.faixa === 0 || (r.k - k1) % 2 === 0);
    const nI = usadas.filter(r => r.faixa === 0).length, nS = usadas.length - nI, NF = usadas.length;
    // o mesmo número de lugares de antes (32 fileiras a 0,66 m embaixo, 22 a 0,88 m em cima)
    const passos = [F.passo[0] * nI / F.fileiras[0], F.passo[1] * nS / F.fileiras[1]];
    const lista = [];
    const vistos = new Set();
    const M = 2880;   // amostras da fileira (0,125°)
    // ninguém a menos de 6 m da lente do plano de dentro do pré-jogo (rodada 4: "torcedores quadrados colados na câmera")
    const lente = PLANOS.dentro.cam.de, l0 = lente[0], l1 = lente[lente.length - 1];
    const pertoDaLente = (x, y, z) => { const xa = l0[0] - 4, xb = l1[0] + 16, xc = clamp(x, xa, xb); return z > 0 && Math.hypot(x - xc, z - l0[2]) < 7 && y < 9; };
    usadas.forEach((r, j) => {
      const f = NF - 1 - j;                                    // 0 = a de cima
      const inf = r.faixa === 0;
      const s = r.sAssento;
      const passo = inf ? passos[0] : passos[1], esc = inf ? F.escala[0] : F.escala[1];
      // a fileira como polilinha; um lugar a cada `passo` m de arco, puxado para a cadeira da grade em que cai
      let acum = passo * 0.5, px = 0, pz = 0, a = 0;
      for (let i = 0; i <= M; i++) {
        const th = -Math.PI + (2 * Math.PI * i) / M;
        const [x0, z0] = ponto(th, s);
        if (i > 0) acum += Math.hypot(x0 - px, z0 - pz);
        px = x0; pz = z0;
        if (acum < passo) continue;
        acum -= passo;
        const c = G.assentoEm(th, s, 0, true);
        if (!c || vistos.has(c.chave)) continue;
        const { x, y, z } = c;
        const st = setor(x, z);
        // cadeiras à mostra (rodada 1 da prévia: "o vermelho em 100% apaga o Maracanã"): as fileiras de cima (debaixo da
        // borda da cobertura) e manchas soltas, mais no setor visitante (fundo −x); rodada 2: sem o vão ao lado de cada
        // escada ("vãos regulares" que dividiam a bacia em blocos) e, no clássico, a divisa vazia no meio dos lados
        const hs = h2(i, f);
        // (rodada 4: "gente de pé em cima da viga da cobertura"): as 3 de cima vazias (as cadeiras debaixo da borda)
        if (!inf && j - nI >= nS - 3) continue;
        if (!inf && j - nI === nS - 4 && hs < 0.7) continue;
        // as cadeiras soltas à mostra entre a torcida (o mosaico amarelo/azul/branco nas brechas)
        if (hs < 0.05) continue;
        if (pertoDaLente(x, y, z)) continue;
        if (h2(Math.floor((th / RAD + 180) / 1.6), Math.floor(j / 3) + 977) < (st === 2 && !dividida ? 0.26 : 0.22)) continue;
        if (dividida && Math.abs(x) < 3 && (st === 0 || st === 3)) continue;
        // mosaico (a máscara de 250 × 36 do lado de lá): o anel de cima do lado de lá (no clássico, não: cada metade é de um)
        let im = -1;
        if (st === 0 && !inf && !dividida) {
          const u = (psi(x, z) + 135) / 90, k = j - nI;
          im = Math.min(249, Math.max(0, Math.floor(u * 250))) + Math.min(35, Math.floor(((nS - 1 - k) * 36) / nS)) * 250;
        }
        vistos.add(c.chave);
        // a sombra da cobertura só onde o sol bate (o lado de lá e o fundo +x; os outros dois já ficam de costas para ele)
        lista.push(st, f, a++, x, y, z, esc, im, st < 2 ? luzDoSol(x, y + 1.2, z) : 1);
      }
    });
    const n = lista.length / 9;
    return {
      n, fileiras: NF, dividida,
      iterar(cadeira) { for (let i = 0; i < lista.length; i += 9) cadeira(lista[i], lista[i + 1], lista[i + 2], lista[i + 3], lista[i + 4], lista[i + 5], lista[i + 6], lista[i + 7], lista[i + 8]); },
    };
  }
  let _lugares = null;

  // ---------------------------------------------------------------- sólidos (a câmera de cinema fica fora deles)
  // rodada 3: os 4 telões nas cabeceiras, dois em cada uma, perto do eixo (ref-08)
  const TELOES = [9, -9, 171, -171].map(g => {
    const th = g * RAD, [x, z, r] = pontoCob(th, 0.88);
    return { x, z, th, r, y: 25.5, larg: 11, alt: 6 };
  });
  /**
   * O ponto está dentro de algo sólido da forma (ou a menos de `f` m)? Nome ou null. `fora`: conta também a fachada,
   * as rampas e o entorno (o estádio do pré-jogo). `noTunel`: o corredor do túnel (livre).
   */
  function solido(x, y, z, f = 0.3, fora = true, noTunel = false) {
    const r = Math.hypot(x, z), th = Math.atan2(z, x);
    const a = rF(th), b = rB(th);
    // tigela: cadeiras, parede de trás e a laje do anel de circulação até a fachada
    if (r >= a - f && r <= b + f && !noTunel) {
      const s = (r - a) / (b - a);
      if (y <= perfil(clamp(s, 0, 1)) + f) return z > 0 && Math.abs(x) < ESTADIO.tunel.largura / 2 + 0.4 + f && y < ESTADIO.tunel.altura + ESTADIO.tunel.laje + f ? 'túnel (paredes)' : 'arquibancada';
    }
    const rf = rFach(th);
    if (r > b - f && r <= rf + f && y <= Math.max(Pf.laje + Pf.parapeito, Pf.yTopo + Pf.parapeito + (Pf.muro ?? 0)) + f) return 'parede de trás';
    // cobertura (a membrana e a passarela) e os telões
    const o = rCobFora(th), d = rCobDentro(th), u = (o - r) / (o - d);
    if (u >= -0.03 && u <= 1.01) {
      const yc = alturaCob(clamp(u, 0, 1));
      if ((y - yc <= 1.0 + (C.cone ?? 0) + f && yc - y <= 1.0 + (C.vale ?? 0) + f) || (y > yc && u < 0.02)) return 'cobertura';
      if (Math.abs(u - uMastro) * (o - d) <= 1.4 + f && y >= C.yPassarela - 0.6 - f && y <= C.yMastro + f) return 'passarela';
    }
    for (const t of TELOES) {
      const lx = (x - t.x) * -Math.sin(t.th) + (z - t.z) * Math.cos(t.th), lr = (x - t.x) * Math.cos(t.th) + (z - t.z) * Math.sin(t.th);
      if (Math.abs(lx) <= t.larg / 2 + f && Math.abs(lr) <= 1 + f && Math.abs(y - t.y) <= t.alt / 2 + f) return 'telão';
    }
    if (!fora) return null;
    // fachada (costelas e lajes; a casca entre a parede de trás e a face de fora)
    if (r > rf - 3 - f && r <= rf + nFachada(y) + 2.2 + f && y <= Fa.alto + 0.6 + f) return 'fachada';
    // rampas (o tabuleiro e o vão embaixo dele) e os pórticos
    const az = Math.abs(z), ax = Math.abs(x);
    const yr = yRampa(az);
    if (yr != null && ax <= R.larg / 2 + f && y <= yr + 1.3 + f) return 'rampa';
    const P = R.portico;
    if (Math.abs(r - P.r) <= 8 + f && ax <= P.larg / 2 + f && y <= P.alt + 1.2 + f) return 'pórtico';
    // entorno
    const Mz = E.maracanazinho, dm = Math.hypot(x - Mz.x, z - Mz.z);
    if (dm <= Mz.r + f) { const h = Mz.parede + Mz.cupula * Math.sqrt(Math.max(0, 1 - (dm / Mz.r) ** 2)); if (y <= h + f) return 'maracanãzinho'; }
    if (Math.hypot(x - E.bellini.x, z - E.bellini.z) <= 3.2 + f && y <= 11 + f) return 'bellini';
    if (y <= E.rampaCurva.niveis[2] + 1.3 + f && Math.hypot(x - E.rampaCurva.x, z - E.rampaCurva.z) <= E.rampaCurva.r1 + f) return 'rampa curva';
    if (y <= E.passarelaUerj.y + 4.4 + f && naRampaUerj(x, z, f)) return 'passarela';
    if (r > E.esplanada - 40) {
      for (const p of predios()) {
        const c = Math.cos(-p.rumo), sn = Math.sin(-p.rumo);
        const lx = (x - p.x) * c - (z - p.z) * sn, lz = (x - p.x) * sn + (z - p.z) * c;
        if (Math.abs(lx) <= p.lx / 2 + f && Math.abs(lz) <= p.lz / 2 + f && y <= p.h + f) return 'prédio';
      }
    }
    for (const p of palmeiras()) if (Math.hypot(x - p.x, z - p.z) <= (y > p.h - 2 ? 3.2 : 0.5) + f && y <= p.h + 1 + f) return 'palmeira';
    return null;
  }

  /** A câmera está dentro do volume do lado de cá da tigela (a câmera de TV)? Aí o lado de cá sai do desenho. */
  function cameraNoLadoDeCa(p) {
    if (p.z <= 0 || p.y > C.yFora + 1) return false;
    const th = Math.atan2(p.z, p.x), r = Math.hypot(p.x, p.z);
    return setor(p.x, p.z) === 3 && r > rF(th) - 1 && r < rB(th) + 4;
  }

  // ---------------------------------------------------------------- entorno (listas puras, com semente)
  const h2 = (a, b) => { let t = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263); t = Math.imul(t ^ (t >>> 13), 1274126177); return ((t ^ (t >>> 16)) >>> 0) / 4294967296; };
  const gerador = semente => { let s = semente >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // sem os estacionamentos de carros em fileira (rodada 1: "gritam jogo de celular"); a esplanada é concreto e praças
  const ESTAC = [];
  const noEstac = (x, z, m = 0) => ESTAC.some(e => x > e.x[0] - m && x < e.x[1] + m && z > e.z[0] - m && z < e.z[1] + m);
  const naRampa = (x, z, m = 0) => Math.abs(x) < R.larg / 2 + m && Math.abs(z) > zFach0 - 2 && Math.abs(z) < R.portico.r + 14 + m;
  let _palmeiras = null, _carros = null, _torcedores = null;
  /**
   * O bairro (Tijuca, Vila Isabel, São Cristóvão): quadras numa malha TORTA (o centro de cada uma anda por um campo suave,
   * as ruas não ficam em grade), cada uma com um tipo — prédio (8 a 20 andares, bege, branco, ocre), casas baixas
   * (telhado de barro, só pintadas no chão) ou verde (praça, copa de árvore). Nada no leito dos trilhos, no Morro da
   * Mangueira (a favela é pintada no morro), na UERJ e na esplanada. {quadras, predios, arvores}, com semente.
   */
  let _bairro = null;
  function bairro() {
    if (_bairro) return _bairro;
    const r = gerador(20261016), quadras = [], pred = [], arv = [];
    const Q = 36, B = E.bairro;
    for (let i = -37; i <= 37; i++) for (let k = -37; k <= 37; k++) {
      let cx = i * Q, cz = k * Q;
      cx += 9 * Math.sin(cz / 160 + 1.3) + 6 * Math.sin(cx / 97);
      cz += 9 * Math.sin(cx / 190 + 0.4) + 6 * Math.cos(cz / 113);
      if (Math.abs(cx) > B - 22 || Math.abs(cz) > B - 22) continue;
      if (Math.abs(cx) < E.esplanada + 14 && Math.abs(cz) < E.esplanada + 14) continue;
      const dt = Math.abs(distTrilho(cx, cz));
      if (dt < 64) continue;
      if (Math.hypot(cx - E.mangueira.x, cz - E.mangueira.z) < E.mangueira.r + 6) continue;
      if (Math.hypot(cx - E.uerj.x, cz - E.uerj.z) < 105) continue;
      const rumo = 0.42 * Math.sin(cx / 420 + 0.7) + 0.35 * Math.cos(cz / 360) + 0.1 * Math.sin((cx + cz) / 230);
      const tijuca = cz > 140 || cx < -170;
      const sx = r();
      // (rodada 2: "grade de torres pastel" → prédios médios, mais casas e mais verde com árvore grande e copada)
      // (rodada 3: "muita cidade alta: prédios brancos de 10 a 20 andares da Tijuca misturados às casas")
      const tipo = sx < 0.15 ? 'verde' : sx < (tijuca ? 0.5 : 0.3) ? 'predio' : 'casas';
      const q = { x: cx, z: cz, l: Q - 7 - r() * 3, rumo, tipo, s: r() };
      quadras.push(q);
      if (tipo === 'predio') {
        const alto = r() < (tijuca ? 0.5 : 0.16), c = Math.floor(r() * 16);
        pred.push({ x: cx + (r() - 0.5) * 4, z: cz + (r() - 0.5) * 4, lx: 12 + r() * 12, lz: 12 + r() * 13, h: alto ? 29 + r() * 30 : 10 + r() * 16, rumo, cor: alto ? [1, 6, 8, 14, 1, 8, 4, 10][c % 8] : c });
      }
      // copas de árvore em 3D só até ~950 m (mais longe a copa é pintada no chão)
      const d = Math.hypot(cx, cz);
      const nA = d > 820 ? 0 : tipo === 'verde' ? 3 : tipo === 'casas' ? (r() < 0.45 ? 1 : 0) : (r() < 0.3 ? 1 : 0);
      for (let a = 0; a < nA; a++) arv.push({ x: cx + (r() - 0.5) * (Q - 8), z: cz + (r() - 0.5) * (Q - 8), raio: 4 + r() * 4 });
    }
    // as copas dos gramados e bosques da esplanada (fora das palmeiras, das rampas e dos prédios)
    for (const [x0, z0, x1, z1] of E.gramados) {
      const n = Math.round(((x1 - x0) * (z1 - z0)) / 600);
      for (let a = 0; a < n; a++) {
        const x = x0 + 6 + r() * (x1 - x0 - 12), z = z0 + 6 + r() * (z1 - z0 - 12);
        if (Math.hypot(x, z) < rFach(Math.atan2(z, x)) + 30 || naRampa(x, z, 8) || naRampaUerj(x, z, 8) || Math.abs(distTrilho(x, z)) < E.trilhos.larg + 26) continue;
        arv.push({ x, z, raio: 4 + r() * 4 });
      }
    }

    // as fileiras de árvores na borda da esplanada (dentro da avenida) e nas vias de serviço
    const livreE = (x, z) => !naRampa(x, z, 10) && !naRampaUerj(x, z, 8) && Math.abs(distTrilho(x, z)) > E.trilhos.larg + 26 && Math.hypot(x - E.maracanazinho.x, z - E.maracanazinho.z) > E.maracanazinho.r + 10
      && ((x - E.celio.x) / (E.celio.a + 14)) ** 2 + ((z - E.celio.z) / (E.celio.b + 22)) ** 2 > 1 && Math.hypot(x - E.aquatico.x - 20, z - E.aquatico.z) > 60 && Math.hypot(x - E.bellini.x, z - E.bellini.z) > 40;
    const Mb = E.esplanada - 22;
    for (let t = -Mb; t <= Mb; t += 13) for (const [x, z] of [[t, -Mb], [t, Mb], [-Mb, t], [Mb, t]]) if (livreE(x, z)) arv.push({ x: x + (r() - 0.5) * 2, z: z + (r() - 0.5) * 2, raio: 3.2 + r() * 2.6 });
    for (let x = 175; x <= 325; x += 12) for (const sx of [1, -1]) for (const z of [-13, 13]) if (livreE(sx * x, z)) arv.push({ x: sx * x, z, raio: 2.8 + r() * 2 });
    // UERJ: os blocos modernistas altos
    for (const [dx, dz, lx, lz, h] of [[0, 0, 110, 26, 46], [-30, 60, 26, 70, 22], [60, 55, 40, 40, 18], [-80, -20, 30, 50, 30]]) pred.push({ x: E.uerj.x + dx, z: E.uerj.z + dz, lx, lz, h, rumo: 0.52, cor: 1 });
    _bairro = { quadras, predios: pred, arvores: arv };
    return _bairro;
  }
  /** Prédios do bairro (caixas): [{x, z, lx, lz, h, rumo, cor}]. */
  function predios() { return bairro().predios; }
  /** Palmeiras-imperiais na esplanada (em fileiras pelas praças e caminhos): [{x, z, h}]. */
  function palmeiras() {
    if (_palmeiras) return _palmeiras;
    const r = gerador(20261017), lista = [];
    const livre = (x, z) => {
      const th = Math.atan2(z, x), rr = Math.hypot(x, z);
      if (rr < rFach(th) + 12) return false;
      if (naRampa(x, z, 6) || noEstac(x, z, 4) || naRampaUerj(x, z, 6)) return false;
      if (Math.hypot(x - E.maracanazinho.x, z - E.maracanazinho.z) < E.maracanazinho.r + 8) return false;
      if (Math.hypot(x - E.aquatico.x, z - E.aquatico.z) < 34) return false;
      if (((x - E.celio.x) / (E.celio.a + 10)) ** 2 + ((z - E.celio.z) / (E.celio.b + 10)) ** 2 < 1) return false;
      if (Math.abs(distTrilho(x, z)) < E.trilhos.larg) return false;
      return Math.abs(x) < E.esplanada - 8 && Math.abs(z) < E.esplanada - 8;
    };
    // rodada 3 ("palmeiras demais, grossas, tapando a fachada; no real poucas palmeiras-imperiais finas numa fileira só"):
    // UMA fileira de cada lado da rampa de cá (a entrada leste) e a avenida do Bellini, nada em volta da fachada
    // (rodada 4: "palmeiras grandes demais no primeiro plano da fachada"; e nenhuma na frente da lente do pórtico leste)
    for (let z = 290; z < 336; z += 14) for (const x of [-40, 40]) if (livre(x, z)) lista.push({ x: x + (r() - 0.5), z, h: 20 + r() * 4 });
    for (let z = zFach0 + 22; z < R.zFim - 8; z += 15) for (const x of [-(R.larg / 2 + 8), R.larg / 2 + 8]) lista.push({ x, z, h: 13 + r() * 4 });
    _palmeiras = lista;
    return lista;
  }
  /** Carros nos estacionamentos: [{x, z, rumo, cor}]. */
  function carros() {
    if (_carros) return _carros;
    const r = gerador(20261018), lista = [];
    for (const e of ESTAC) for (let z = e.z[0] + 4; z < e.z[1] - 3; z += 6.5) for (let x = e.x[0] + 2; x < e.x[1] - 2; x += 2.7) {
      if (r() < 0.55) continue;
      lista.push({ x, z: z + (r() - 0.5) * 0.3, rumo: Math.PI / 2 + (r() < 0.5 ? 0 : Math.PI) + (r() - 0.5) * 0.08, cor: Math.floor(r() * 8) });
    }
    _carros = lista;
    return lista;
  }
  /** Torcedores chegando: nas duas rampas (em cima do tabuleiro), nos pórticos e pela esplanada: [{x, y, z, time}]. */
  function torcedoresFora() {
    if (_torcedores) return _torcedores;
    const r = gerador(20261019), lista = [];
    for (const lado of [1, -1]) {
      for (let i = 0; i < 420; i++) {
        const az = zFach0 + 3 + Math.pow(r(), 0.9) * (R.zFim - zFach0 - 6);
        const x = (r() - 0.5) * (R.larg - 3);
        lista.push({ x, y: yRampa(az), z: lado * az, time: lado < 0 && r() < 0.5 ? 1 : (r() < 0.06 ? 1 : 0) });
      }
      // a praça na frente do pórtico
      for (let i = 0; i < 160; i++) {
        const az = R.portico.r + 13 + r() * 36, x = (r() - 0.5) * (40 + az - R.portico.r);
        const t = lado < 0 && r() < 0.5 ? 1 : 0;
        // (rodada 3: ninguém colado na lente do plano do pórtico leste, que passa ao pé dos degraus)
        if (lado > 0 && x > 22 && az < 290) continue;
        lista.push({ x, y: 0.06, z: lado * az, time: t });
      }
    }
    // em volta da fachada (os acessos)
    for (let i = 0; i < 380; i++) {
      const th = r() * 2 * Math.PI, rr = rFach(th) + 5 + r() * 18;
      const x = rr * Math.cos(th), z = rr * Math.sin(th);
      if (naRampa(x, z, 1) || noEstac(x, z, 2) || naRampaUerj(x, z, 2)) continue;
      lista.push({ x, y: 0.06, z, time: x < -80 ? (r() < 0.6 ? 1 : 0) : (r() < 0.05 ? 1 : 0) });
    }
    _torcedores = lista;
    return lista;
  }

  // ---------------------------------------------------------------- festa (faixas, bandeiras, bandeirões, sinalizadores)
  /** Ponto no degrau: ângulo polar th e d m da 1ª fileira para dentro → {x, y, z, nx, nz (para o campo), ex, ez}. */
  function noDegrau(th, d) {
    const a = rF(th), b = rB(th), s = d / (b - a);
    const [x, z] = ponto(th, s);
    const nx = -Math.cos(th), nz = -Math.sin(th);
    return { x, y: perfil(s), z, nx, nz, ex: -nz, ez: nx, s };
  }
  /** O ângulo polar da 1ª fileira com esta coordenada x no lado de lá (z < 0). */
  function thLadoDeLa(x) { let lo = -Math.PI + 0.01, hi = -0.01; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rF(m) * Math.cos(m) > x) hi = m; else lo = m; } return (lo + hi) / 2; }
  /** O ângulo polar da 1ª fileira com esta coordenada z no fundo (s = +1 → x > 0). */
  function thFundo(sx, z) { let lo = -Math.PI / 2 + 0.01, hi = Math.PI / 2 - 0.01; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (rF(m) * Math.sin(m) < z) lo = m; else hi = m; } const t = (lo + hi) / 2; return sx > 0 ? t : Math.PI - t; }
  /** Faixas na mureta: as mesmas 12 (textos e ordem de bandeiras-dados.js), nos trechos retos da 1ª fileira. */
  function faixas(lista) {
    // as do lado de lá lado a lado, na ordem de antes, 10% mais curtas, no trecho quase reto da mureta (|x| ≲ 48 m)
    const la = lista.map((f, i) => ({ f, i })).filter(o => o.f.setor === 0).sort((p, q2) => p.f.centro - q2.f.centro);
    const KL = 0.9, VAO = 1.2, centros = new Map();
    if (dividida) {
      // clássico (rodada 3: "faixas da mesma torcida juntas no mesmo setor"): as do visitante (posições 0, 1, 4 e 7 de
      // identidade.js textosFaixas) na metade −x e as da casa na +x, cada grupo do meio para a ponta, a divisa no meio
      const VIS = new Set([0, 1, 4, 7]), MEIO = 2.5, LIM = 47;
      for (const [sx, g] of [[-1, la.filter(o => VIS.has(o.i)).reverse()], [1, la.filter(o => !VIS.has(o.i))]]) {
        const k = Math.min(KL, (LIM - MEIO - VAO * (g.length - 1)) / (g.reduce((s2, o) => s2 + o.f.larg, 0) || 1));
        let x = MEIO;
        for (const o of g) { const l = o.f.larg * k; centros.set(o.i, [sx * (x + l / 2), l]); x += l + VAO; }
      }
    } else {
      let x = -(la.reduce((s2, o) => s2 + o.f.larg * KL, 0) + VAO * (la.length - 1)) / 2;
      for (const o of la) { const l = o.f.larg * KL; centros.set(o.i, [x + l / 2, l]); x += l + VAO; }
    }
    const zF = xx => { const th = thLadoDeLa(xx); return rF(th) * Math.sin(th); };
    return lista.map((f, i) => {
      if (f.setor === 0) {
        const [c, l] = centros.get(i);
        return { ...f, centro: c, larg: l, z: Math.max(zF(c), zF(c - l / 2), zF(c + l / 2)) };
      }
      const s = f.setor === 1 ? 1 : -1;
      return { ...f, x: s * Math.min(rF(thFundo(s, f.centro - f.larg / 2)) * Math.abs(Math.cos(thFundo(s, f.centro - f.larg / 2))), rF(thFundo(s, f.centro + f.larg / 2)) * Math.abs(Math.cos(thFundo(s, f.centro + f.larg / 2)))) };
    });
  }
  /** Bandeiras de mastro: a mão do torcedor nas fileiras da frente do lado de lá e da organizada (fundo +x). */
  function bandeiras(n, mao) {
    const r = gerador(20261012), lista = [];
    const longe = (x, z) => lista.every(b => Math.hypot(b.x - x, b.z - z) >= 4);
    for (let t = 0; lista.length < n && t < 5000; t++) {
      // no clássico, só na metade do mandante (o lado de lá em +x e a organizada): mais fileiras para caberem as mesmas
      const org = r() < (dividida ? 0.42 : 0.3);
      const d = (org ? 1 + Math.floor(r() * 7) : Math.floor(r() * (dividida ? 9 : 6))) * 0.8 + 0.4;
      const th = org ? thFundo(1, -16 + 32 * r()) : thLadoDeLa(dividida ? 5 + 58 * r() : -55 + 110 * r());
      const p = noDegrau(th, d);
      if (!longe(p.x, p.z)) continue;
      lista.push({ x: p.x, y: p.y + mao, z: p.z, ex: p.ex, ez: p.ez, nx: p.nx, nz: p.nz, desenho: Math.floor(r() * 4) % 4, fase: r() * 2 * Math.PI, org });
    }
    return lista;
  }
  /** Bandeirões (o do lado de lá e o da organizada) pela rampa do anel de baixo, no formato de bandeiras-dados.js. */
  function bandeiroes(altura) {
    const out = [];
    const rampa = (th, prof, larg, nome, slot, eixoU, pts = null) => {
      const p0 = pts ? pts[0] : noDegrau(th, 0.4), p1 = pts ? pts[1] : noDegrau(th, 0.4 + prof);
      const V = [p1.x - p0.x, p1.y - p0.y, p1.z - p0.z], L = Math.hypot(...V);
      const Vn = V.map(v => v / L);
      // N: perpendicular a V e a U, para cima
      const U = eixoU;
      let N = [U[1] * Vn[2] - U[2] * Vn[1], U[2] * Vn[0] - U[0] * Vn[2], U[0] * Vn[1] - U[1] * Vn[0]];
      if (N[1] < 0) N = N.map(v => -v);
      const ln = Math.hypot(...N); N = N.map(v => v / ln);
      const A = [p0.x - U[0] * larg / 2, p0.y, p0.z - U[2] * larg / 2].map((v, i) => v + N[i] * altura);
      out.push({ nome, A, U: U.map(v => v * larg), V: Vn.map(v => v * prof), N, larg, prof, slot });
    };
    // no clássico o do lado de lá vai para a metade do mandante (+x)
    // (o pano ao longo da mureta, quase reta ali, subindo em −z)
    if (dividida) {
      const th = thLadoDeLa(29), zf = rF(th) * Math.sin(th) - 0.4, q2 = z => ({ x: 29, y: perfil(sDe(29, z)), z });
      rampa(th, 10, 34, 'lado', 0, [1, 0, 0], [q2(zf), q2(zf - 10)]);
      // a mureta encurva um pouco para o campo nas pontas: o pano sobe o que for preciso para nenhuma cabeça furar
      const b = out[out.length - 1];
      let sobe = 0;
      (_lugares ?? (_lugares = gerarLugares())).iterar((st, f, a, x, y, z, esc) => {
        const d = [x - b.A[0], y - b.A[1], z - b.A[2]];
        const lu = (d[0] * b.U[0] + d[1] * b.U[1] + d[2] * b.U[2]) / (b.larg * b.larg), lv = (d[0] * b.V[0] + d[1] * b.V[1] + d[2] * b.V[2]) / (b.prof * b.prof);
        if (lu < 0 || lu > 1 || lv < 0 || lv > 1) return;
        sobe = Math.max(sobe, d[0] * b.N[0] + (d[1] + 2.2 * esc) * b.N[1] + d[2] * b.N[2]);
      });
      b.A = b.A.map((v, i) => v + b.N[i] * sobe);
    } else rampa(-Math.PI / 2, 10, 40, 'lado', 0, [1, 0, 0]);
    rampa(0, 14, 24, 'organizada', 1, [0, 0, 1]);
    return out;
  }
  /** Os pontos dos sinalizadores (a base do torcedor): organizada, quinas do lado de lá e setor visitante. */
  function sinalizadores() {
    const org = [[-12, 2.6], [-4, 3.4], [5, 2.0], [13, 4.0], [-16.5, 3.0], [9, 3.6]].map(([z, d]) => noDegrau(thFundo(1, z), d));
    const quinas = [[-47, 2.6], [48, 3.2], [-36, 2.0], [37, 2.8], [-55, 3.6], [56, 2.6]].map(([x, d]) => noDegrau(thLadoDeLa(x), d));
    const visit = [[-8, 2.6], [6, 3.2]].map(([z, d]) => noDegrau(thFundo(-1, z), d));
    const xyz = p => [p.x, p.y, p.z];
    return { organizada: org.map(xyz), quinas: quinas.map(xyz), visitante: visit.map(xyz) };
  }

  // ---------------------------------------------------------------- pré-jogo: os planos que dependem do estádio
  const K = Math.max(Fa.a, Fa.b) / 93;      // ~1,6: quanto maior que o Estádio Golaço
  const PLANOS = {
    // o drone alto e longe do lado do Maracanãzinho, como a aérea de referência (ref-10; rodada 2: "colado demais e
    // cortado"): o Maracanãzinho inteiro embaixo à direita, o estádio no meio, o pátio dos trilhos atrás e a Mangueira
    aereo: { orbita: { centro: [0, 0], olhar: [-10, 0, 40], raio: [640, 560], altura: [340, 290], ang: [146, 156], fov: 40 } },
    // o pórtico da rampa de lá (UERJ) da ponta onde começa o letreiro (+x), de baixo, ao pé dos degraus (ref-05): a faixa
    // curva com "ESTÁDIO MÁRIO FILHO" indo embora; a grua sobe por cima até a rampa e a fachada (costelas e almofadas)
    // rodada 3 ("a câmera colada vê o pórtico de lado e de baixo: vira gaiola; o quadro certo é o da ref-05"): o pórtico
    // LESTE (o de cá, ao sol da manhã), na altura do olho a ~15 m da ponta do "FILHO", o letreiro em diagonal indo embora
    // para a esquerda e as colunas ritmando; a grua sobe por cima da rampa até a fachada
    // rodada 4 ("o quadro baixo e perto demais: corta o topo das colunas e perde os postes, a ponta da cobertura e o morro"):
    // a lente a 2,4 m e ~8 m mais para trás, olhando um pouco mais para cima, com o quadro mais aberto
    fachada: { cam: { de: [[60, 2.4, 281], [50, 2.4, 279], [40, 2.5, 277], [35, 2.8, 275.5], [24, 12, 266], [12, 25, 250]], para: [[-14, 8.6, 251], [-16, 8.7, 250.5], [-18, 8.9, 250], [-18, 9.1, 249], [-8, 11, 215], [0, 13, 150]], fov: [54, 44], suave: 0.7 } },
    // de dentro olhando PARA CIMA (ref-07): a cobertura branca com a treliça e os refletores no terço de cima do quadro
    // (rodada 3: "a cobertura vira uma faixa reta, baixa e preta"): da beira do campo, atrás das placas, como a ref-07 —
    // o campo à esquerda, a bacia de cá indo embora à direita e a cobertura em leque por cima, com os telões no eixo
    dentro: { cam: { de: [[24, 1.9, 42.6], [30, 2.0, 42.5], [36, 2.1, 42.3]], para: [[100, 25, 14], [104, 26, 10], [108, 27, 6]], fov: [60, 58], suave: 0.5 } },
    // o plano alto da fila (rodada 2: "nada no quadro diz Maracanã"): mais aberto, com a bacia de cá e a cobertura em cima
    alto: { cam: { de: [[-6, 21, -50], [6, 20, -50]], para: [[0, 7, 24], [0, 7, 22]], fov: [44, 42], suave: 0.5 } },
    organizada: { cam: { de: [[48, 3.0, -20], [48, 3.4, -15]], para: [[84, 6.2, -3], [84, 6.6, 2]], fov: [40, 40], suave: 0.3 } },
    ladoDeLa: { cam: { de: [[-6, 2.2, -34], [2, 2.2, -34]], para: [[-12, 6.5, -55], [4, 6.5, -55]], fov: [30, 30], suave: 0.2 } },
    visitantes: { cam: { de: [[-48, 2.5, 18], [-48, 2.8, 14]], para: [[-84, 6, 0], [-84, 6, -4]], fov: [40, 40], suave: 0.3 } },
    geral: { cam: { de: [[-8, 23, 60], [8, 23, 60]], para: [[0, 0, -16], [0, 0, -16]], fov: [56, 56], suave: 0.3 } },
  };
  /** Troca, no lugar, a câmera dos planos que dependem do estádio (prejogo-roteiro.js criarRoteiro chama antes das curvas). */
  function ajustarPlano(p) {
    const q = PLANOS[p.id];
    if (q && q.cam) p.cam = { ...p.cam, ...q.cam };
    if (q && q.orbita) p.orbita = { ...q.orbita };
    // a das escalações: o MESMO objeto nas duas (o mesmo fundo)
    if (p.orbitaComum) p.orbita = orbitaEsc ?? (orbitaEsc = { ...p.orbita, raio: [52, 52], altura: [20, 20] });
  }
  let orbitaEsc = null;
  /** A câmera da abertura ("Toque para começar"), mais longe e mais alta na mesma proporção do estádio. */
  function ajustarAbertura(c) { c.px *= 1.42; c.pz *= 1.42; c.py *= 1.3; c.ly = 6; return c; }

  return {
    forma: F, familia: 'tigela',
    rF, rB, rCobFora, rCobDentro, rFach, ponto, sDe, perfil, vDe, nos, sC, setor, psi, thDivisa,
    nosCob, alturaCob, pontoCob, uCob, uMastro, cone, luzDoSol, dividida, COSTELA, nFachada, yRampa, entorno: E, distTrilho, estacionamentos: ESTAC, TELOES, vom: VOM,
    get lugares() { return _lugares ?? (_lugares = gerarLugares()); },
    get grade() { return grade(); }, pisoEm, uTex, noGomo,
    solido, cameraNoLadoDeCa, noDegrau,
    predios, bairro, palmeiras, carros, torcedoresFora,
    faixas, bandeiras, bandeiroes, sinalizadores,
    ajustarPlano, ajustarAbertura, escala: K, planos: PLANOS,
    // o plano geral do intervalo e do fim (camera.js CAMERA_GERAL): debaixo da borda da cobertura, olhando o campo
    cameraGeral: { de: [0, 27, 58], para: [0, 3, -16], fov: 40 },
  };
}
