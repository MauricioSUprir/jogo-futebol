// Passada natural de quem ANDA fora da partida (item 61 da FILA; dono, 23/10, com print: no túnel e na fila "parecem que
// estão marchando, parecendo NPC"). PURO: sem three.js nem DOM, sem m.rng e sem Math.random — a variação de cada um sai
// de um sorteio pelo id (o pré-jogo sai igual sempre). FORA do fecho do hash (tools/fecho-hash.mjs): só o cortejo do
// pré-jogo (cortejo.js), as cenas (cena-atores.js: cartão, intervalo, fim; substituicao.js) e os treinadores (tecnicos.js)
// importam daqui — nenhum módulo da simulação. A pose da partida (anim.js) e a passada (jogador.js) não mudam: os
// jogadores DURANTE O JOGO andam como antes (a corrida aprovada pelo dono; o "completo" é o mocap, itens 50–52).
//
// Duas peças (a auditoria mediu: todos no mesmo pé, cadência igual, o pé direito saindo primeiro e agachando 27 cm, o
// braço 1/4 de ciclo fora da perna e com o cotovelo duro, a pelve e o tórax quase parados — as fontes estão no fim):
//  1) A FASE e o RITMO de cada um (o "cycleOffset" do Unity, a velocidade de reprodução sorteada por agente das multidões
//     do Softimage/Houdini): a fase inicial da passada pelo id (espalharFase: antes todos nasciam com fase 0 e, com o
//     mesmo atraso, o k-ésimo do mandante e o do visitante andavam no mesmo pé — 99,6% das amostras —, os 3 árbitros
//     juntos) e a cadência de cada um ×[1; 1,12] da tabela (o walk ratio varia ~10% entre pessoas, Sekiya 1996; o
//     `ritmoVoo` do jogador.js passoPassada só ACELERA a passada com um pé no chão: quem anda no mesmo passo dá passos
//     mais curtos).
//  2) A CAMADA do desenho (marchar), aplicada logo depois da pose da locomoção (anim.js pose) e ANTES dos gestos de cada
//     cena: o braço balança oposto à perna do mesmo lado, no pico à frente logo depois do toque do pé do outro lado
//     (Collins, Adamczyk & Kuo 2009 — na pose do jogo o balanço é sen(π·fase), zero no toque: 1/4 de ciclo fora), com
//     ±10–15° (ROM do ombro 20–35°) e o cotovelo que dobra mais à frente (ROM ~30°, CiSE 2023); a pelve gira ±4° com a
//     perna da frente e o tórax ±3° ao contrário (Saunders, Inman & Eberhart 1953; Kong 2010; Lamoth 2002). Os tornozelos
//     não se mexem (o joelho é refeito pela IK do anim.js com o quadril girado): o pé plantado continua plantado. Parado,
//     o braço da camada é o da pose do jogo com a fase 0 (pendurado): com a fase 0 a camada não muda nada.
// A camada só entra onde o braço da pose é o da passada (a mesma conta do anim.js refeita aqui: o goleiro com as mãos
// prontas, a bola nas mãos, o cabeceio e o lateral ficam como estão) e sai acima de MARCHA.vSai (a corrida do jogo).
// Medida: tools/teste-marcha.mjs (cortejo e cenas, manequim e corpo novo).
//
// Fontes (o que se aproveitou de cada uma): cadência ~1,7–2,0 passos/s andando e 1,96 a 1,47 m/s (Hansen 2017, a tabela
// do jogo — a média já era real); o walk ratio (passo ÷ cadência) varia ~10–12% entre pessoas e a velocidade de uma pessoa
// ~2% (Sekiya 1996; PMC3756042) → o ritmo por jogador; o braço em oposição de fase à perna do mesmo lado (Collins,
// Adamczyk & Kuo 2009, PMC2817299) e o ombro com ROM ~20–25° a 35° (revisão, Gait Posture 2018) → o balanço −cos e a
// amplitude; o cotovelo com ROM 29,7 ± 10,2° no ciclo (CiSE 2023) → a dobra que muda com o braço; a rotação do tórax
// ~7° de ROM e tórax × pelve ~14° a ~1,2 m/s (Kong 2010, PMC2843703), pelve e tórax indo para a contrafase com a
// velocidade (Lamoth 2002; Bruijn 2008) e a pelve ±4° (Saunders, Inman & Eberhart 1953) → as rotações; o início da marcha
// leva 3–5 passos até o regime (Brenière & Do 1991) → a saída do cortejo (cortejo.js); pessoas lado a lado sincronizam às
// vezes, também a 180°, nunca travadas (Zivotofsky & Hausdorff 2007; Sylos-Labini 2018) → a meta dos pares; o
// "cycleOffset" do Unity (a fase do laço por personagem), a velocidade de reprodução sorteada por agente (Softimage ICE) e
// o defeito clássico das réplicas sincronizadas das multidões do Houdini (SideFX) → a fase e o ritmo pelo id; a animação
// procedural dirigida pela fase da passada (Rosen, GDC 2014) → a camada sobre a fase que o jogo já tem. NÃO entrou (fica
// para o mocap, itens 50–52): o calcanhar que sobe no fim do apoio, que tira ~2/3 do sobe-e-desce da pelve (Kerrigan
// 2000; Della Croce 2001) — o quique de ~13 cm e o joelho dobrado no apoio continuam os da pose do jogo.
import { J, ik, BRACO, ANTEBRACO } from './anim.js';
import { JOGADOR } from './config.js';

export const MARCHA = {
  ligada: true,             // (os testes desligam para comparar a mesma locomoção com e sem a camada)
  ritmo: [1.0, 1.12],       // × a cadência da tabela (PASSADA.tabela: 1,96 passos/s a 1,47 m/s) — só sobe: passo mais curto
  vRitmo: 1.9,              // m/s — o ritmo próprio só abaixo disto (andando há sempre um pé no chão: carga ≥ 0,5)
  rampa: 0.4,               // s — no começo de uma cena a camada entra devagar (o 1º quadro é a pose do jogo)
  vSai: [2.2, 2.8],         // m/s — acima disso volta a pose do jogo inteira (a corrida)
  filtroV: 0.15,            // s — nas cenas, a velocidade que move a camada é filtrada (a do corpo pode mudar de uma vez)
  vCheia: 1.4,              // m/s — as amplitudes crescem com a velocidade até aqui (× até 1,3 depois)
  braco: 0.15,              // rad — amplitude do braço a 1,4 m/s (×[0,8; 1,2] por jogador; o corpo novo amplia ~1,6×)
  bracoFator: [0.8, 1.2],
  atraso: [0.04, 0.12],     // passos — o pico do braço à frente depois do toque do pé do outro lado
  cotovelo: [0.12, 0.80],   // rad — a dobra do cotovelo com o braço todo atrás e todo à frente (7° → 46°)
  cotoveloParado: 0.35,     // rad — a dobra da pose do jogo parado (anim.js flex com s = 0)
  pelve: 0.07,              // rad — rotação da pelve (±4°) com a perna da frente
  torax: 0.055,             // rad — rotação do tórax (±3°) ao contrário
  troncoFator: [0.85, 1.15],
  abre: 0.12,               // rad — o braço aberto para fora (o do anim.js)
  confere: [0.015, 0.06],   // m — o braço da pose é o da passada (a camada inteira) até 1,5 cm; nada além de 6 cm
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function difAng(a, b) { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; else if (d < -Math.PI) d += 2 * Math.PI; return d; }
const LMAX = (JOGADOR.coxa + JOGADOR.canela) * 0.998;

/** Sorteio pelo id em [0, 1) (mistura de 32 bits; `sal` separa os parâmetros). */
export function sorteioMarcha(id, sal) {
  let x = Math.imul((id | 0) * 31 + (sal | 0), 0x9E3779B1) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x85EBCA77) >>> 0;
  x ^= x >>> 13; x = Math.imul(x, 0xC2B2AE3D) >>> 0;
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

/** Os parâmetros da passada de quem tem este id (sempre os mesmos). */
export function parametrosMarcha(id, out = {}) {
  const M = MARCHA, s = k => sorteioMarcha(id, k);
  out.fase = 2 * s(1);
  // arco-seno em [r0, r1] (mais gente nas pontas: o desvio entre jogadores fica ~4% com só 12% de faixa)
  out.ritmo = lerp(M.ritmo[0], M.ritmo[1], 0.5 - 0.5 * Math.cos(Math.PI * s(2)));
  out.braco = lerp(M.bracoFator[0], M.bracoFator[1], s(3));
  out.atraso = lerp(M.atraso[0], M.atraso[1], s(4));
  out.tronco = lerp(M.troncoFator[0], M.troncoFator[1], s(5));
  out.cotovelo = lerp(-0.05, 0.05, s(6));
  out.atrasoSaida = s(7); // 0–1: quem sai antes de quem no mesmo grupo (os árbitros do cortejo)
  return out;
}

/**
 * A fase inicial da passada pelo id (um jogador recém-criado, parado com os dois pés no chão — criarJogador). O pé que
 * sai primeiro passa a ser o de cada um (antes, o direito em todos), e quem anda lado a lado deixa de pisar junto.
 */
export function espalharFase(j, fase) {
  j.fase = fase;
  for (let p = 0; p < 2; p++) j.pes[p].faseApoio = p + 2 * Math.floor((fase - p) / 2);
}

const _C = [0, 0, 0], _H = [0, 0, 0];
/** Cotovelo e mão do braço da passada (a conta do anim.js) a partir do ombro (ox, oy, oz), do lado e dos ângulos. */
function braco(ox, oy, oz, ofx, ofz, orx, orz, lado, b, a2, abre) {
  const sa = Math.sin(abre), ca = Math.cos(abre);
  const cx = ox + (ofx * Math.sin(b) + orx * lado * sa) * BRACO;
  const cy = oy - Math.cos(b) * ca * BRACO;
  const cz = oz + (ofz * Math.sin(b) + orz * lado * sa) * BRACO;
  _C[0] = cx; _C[1] = cy; _C[2] = cz;
  _H[0] = cx + (ofx * Math.sin(a2) + orx * lado * 0.08) * ANTEBRACO;
  _H[1] = cy - Math.cos(a2) * ANTEBRACO;
  _H[2] = cz + (ofz * Math.sin(a2) + orz * lado * 0.08) * ANTEBRACO;
}
function girarY(P, i, cx, cz, c, s) {
  const x = P[i * 3] - cx, z = P[i * 3 + 2] - cz;
  P[i * 3] = cx + x * c - z * s; P[i * 3 + 2] = cz + x * s + z * c;
}
/** Desvio (rad) da linha E → D das juntas a e b em relação à direita do rumo h ((−sen h, cos h)): + = o lado D para trás. */
function desvioLinha(P, a, b, h) {
  return difAng(h + Math.PI / 2, Math.atan2(P[b * 3 + 2] - P[a * 3 + 2], P[b * 3] - P[a * 3]));
}

const _arm = new Float64Array(12);
/**
 * A camada: P = a pose da locomoção (anim.js pose, Float32Array 19×3, alterada no lugar); j = o jogador (fase, vx, vz,
 * rumo, posicao, cond); mp = parametrosMarcha(id); w = 0–1 (a rampa de entrada da cena); est (opcional) = a velocidade
 * FILTRADA no tempo do ator (filtrarMarcha: {v, f}) — nas cenas a velocidade do ator pode mudar de uma vez (o corpo freado
 * no lugar) e o braço da camada pularia junto. As amplitudes andam pela velocidade PARA A FRENTE do rumo (de lado o braço
 * quase não balança; de costas, o balanço vira junto com a passada). Devolve o peso aplicado.
 */
export function marchar(P, j, mp, w = 1, est = null) {
  const M = MARCHA;
  if (!M.ligada || !(w > 0) || j.posicao === 'GOL') return 0;
  const s = Math.hypot(j.vx, j.vz), h = j.rumo, fase = j.fase;
  const v = est ? est.v : s;
  const vf = est ? est.f : j.vx * Math.cos(h) + j.vz * Math.sin(h);
  const wv = w * (1 - suave(M.vSai[0], M.vSai[1], v));
  if (wv <= 0) return 0;
  // ---- o braço que a pose desenhou é o da passada? (a conta do anim.js: o balanço amp·sen(π·fase) e a dobra fixa `flex`)
  const iE = J.ombroE * 3, iD = J.ombroD * 3;
  let orx = P[iD] - P[iE], orz = P[iD + 2] - P[iE + 2];
  let l = Math.hypot(orx, orz) || 1;
  orx /= l; orz /= l;
  let ofx = orz, ofz = -orx;
  const amp = lerp(0.25, 0.95, clamp(s / 7, 0, 1)), flex = lerp(0.35, 1.45, clamp(s / 5, 0, 1));
  const abre = M.abre + (j.cond && j.cond.pedalada ? 0.35 : 0);
  let desvio = 0;
  for (let k = 0; k < 2; k++) {
    const lado = k ? 1 : -1, iO = k ? J.ombroD : J.ombroE, iC = k ? J.cotoveloD : J.cotoveloE, iM = k ? J.maoD : J.maoE;
    const bal = amp * Math.sin(Math.PI * fase) * (lado < 0 ? 1 : -1);
    braco(P[iO * 3], P[iO * 3 + 1], P[iO * 3 + 2], ofx, ofz, orx, orz, lado, bal, bal + flex, abre);
    desvio = Math.max(desvio,
      Math.hypot(P[iC * 3] - _C[0], P[iC * 3 + 1] - _C[1], P[iC * 3 + 2] - _C[2]),
      Math.hypot(P[iM * 3] - _H[0], P[iM * 3 + 1] - _H[1], P[iM * 3 + 2] - _H[2]));
  }
  const wt = wv * (1 - suave(M.confere[0], M.confere[1], desvio));
  if (wt <= 0) return 0;

  // ---- o alvo: +1 no toque do pé D (fase ímpar: a perna D à frente, o braço E à frente); o braço com o atraso
  const ganho = clamp(vf / M.vCheia, -1.3, 1.3);
  const gB = -Math.cos(Math.PI * (fase - mp.atraso));
  const gP = -Math.cos(Math.PI * fase);
  const A = M.braco * mp.braco * ganho;
  const pelveAlvo = -M.pelve * mp.tronco * ganho * gP;   // + = o quadril D para trás: no toque do D, o D à frente
  const toraxAlvo = M.torax * mp.tronco * ganho * gB;     // ao contrário (o ombro E à frente com o braço E)

  // ---- tórax: gira os ombros (com os braços) em volta da vertical do peito, do desvio da pose ao do alvo
  const pcx = P[J.peito * 3], pcz = P[J.peito * 3 + 2];
  const aT = difAng(desvioLinha(P, J.ombroE, J.ombroD, h), toraxAlvo) * wt;
  if (aT !== 0) {
    const c = Math.cos(aT), s = Math.sin(aT);
    for (const i of BRACOS) girarY(P, i, pcx, pcz, c, s);
    // a direita e a frente dos ombros girados
    const x = orx * c - orz * s, z = orx * s + orz * c;
    orx = x; orz = z; ofx = orz; ofz = -orx;
  }

  // ---- braços (no referencial dos ombros girados): o balanço do alvo e o cotovelo que dobra mais à frente
  const wA = suave(0, 0.8, Math.abs(vf)), Aa = Math.abs(A);
  for (let k = 0; k < 2; k++) {
    const lado = k ? 1 : -1, iO = k ? J.ombroD : J.ombroE, iC = k ? J.cotoveloD : J.cotoveloE, iM = k ? J.maoD : J.maoE;
    const ox = P[iO * 3], oy = P[iO * 3 + 1], oz = P[iO * 3 + 2];
    const b = A * gB * (lado < 0 ? 1 : -1);
    const u = Aa > 1e-4 ? clamp(0.5 + 0.5 * b / Aa, 0, 1) : 0.5;   // 0 = o braço todo atrás, 1 = todo à frente
    const dobra = lerp(M.cotoveloParado, lerp(M.cotovelo[0], M.cotovelo[1], u) + mp.cotovelo, wA);
    braco(ox, oy, oz, ofx, ofz, orx, orz, lado, b, b + dobra, abre);
    // mistura com o braço da pose e devolve os comprimentos dela (o osso não estica)
    const L1 = Math.hypot(P[iC * 3] - ox, P[iC * 3 + 1] - oy, P[iC * 3 + 2] - oz);
    const L2 = Math.hypot(P[iM * 3] - P[iC * 3], P[iM * 3 + 1] - P[iC * 3 + 1], P[iM * 3 + 2] - P[iC * 3 + 2]);
    let ex = lerp(P[iC * 3], _C[0], wt) - ox, ey = lerp(P[iC * 3 + 1], _C[1], wt) - oy, ez = lerp(P[iC * 3 + 2], _C[2], wt) - oz;
    l = Math.hypot(ex, ey, ez) || 1;
    ex = ox + ex / l * L1; ey = oy + ey / l * L1; ez = oz + ez / l * L1;
    let hx = lerp(P[iM * 3], _H[0], wt) - ex, hy = lerp(P[iM * 3 + 1], _H[1], wt) - ey, hz = lerp(P[iM * 3 + 2], _H[2], wt) - ez;
    l = Math.hypot(hx, hy, hz) || 1;
    _arm[k * 6] = ex; _arm[k * 6 + 1] = ey; _arm[k * 6 + 2] = ez;
    _arm[k * 6 + 3] = ex + hx / l * L2; _arm[k * 6 + 4] = ey + hy / l * L2; _arm[k * 6 + 5] = ez + hz / l * L2;
  }
  for (let k = 0; k < 2; k++) {
    const iC = (k ? J.cotoveloD : J.cotoveloE) * 3, iM = (k ? J.maoD : J.maoE) * 3;
    P[iC] = _arm[k * 6]; P[iC + 1] = _arm[k * 6 + 1]; P[iC + 2] = _arm[k * 6 + 2];
    P[iM] = _arm[k * 6 + 3]; P[iM + 1] = _arm[k * 6 + 4]; P[iM + 2] = _arm[k * 6 + 5];
  }

  // ---- pelve: gira a linha dos quadris em volta da pelve e refaz os joelhos (os tornozelos ficam onde estão). Se o
  // quadril girado ficasse além do alcance da perna (o tornozelo sairia do lugar), gira só o que cabe.
  let aP = difAng(desvioLinha(P, J.quadrilE, J.quadrilD, h), pelveAlvo) * wt;
  if (aP !== 0) {
    const px = P[J.pelve * 3], pz = P[J.pelve * 3 + 2];
    if (!cabe(P, px, pz, aP)) {
      let lo = 0, hi = 1;
      for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (cabe(P, px, pz, aP * m)) lo = m; else hi = m; }
      aP *= lo;
    }
    if (aP !== 0) {
      const c = Math.cos(aP), s = Math.sin(aP);
      for (let k = 0; k < 2; k++) {
        const iQ = k ? J.quadrilD : J.quadrilE, iK = k ? J.joelhoD : J.joelhoE, iT = k ? J.tornozeloD : J.tornozeloE;
        girarY(P, iQ, px, pz, c, s);
        const hx = P[iQ * 3], hy = P[iQ * 3 + 1], hz = P[iQ * 3 + 2], tx = P[iT * 3], ty = P[iT * 3 + 1], tz = P[iT * 3 + 2];
        // o polo: para onde o joelho já aponta (fora da reta quadril → tornozelo)
        const kx = P[iK * 3] - (hx + tx) / 2, ky = P[iK * 3 + 1] - (hy + ty) / 2, kz = P[iK * 3 + 2] - (hz + tz) / 2;
        ik(hx, hy, hz, tx, ty, tz, kx, ky, kz, P, iK, iT);
        P[iT * 3] = tx; P[iT * 3 + 1] = ty; P[iT * 3 + 2] = tz;
      }
    }
  }
  return wt;
}
const BRACOS = [J.ombroE, J.ombroD, J.cotoveloE, J.cotoveloD, J.maoE, J.maoD];
/** Os dois quadris girados de a em volta de (px, pz) alcançam os tornozelos? */
function cabe(P, px, pz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let k = 0; k < 2; k++) {
    const iQ = (k ? J.quadrilD : J.quadrilE) * 3, iT = (k ? J.tornozeloD : J.tornozeloE) * 3;
    const x = P[iQ] - px, z = P[iQ + 2] - pz;
    const qx = px + x * c - z * s, qz = pz + x * s + z * c;
    if (Math.hypot(P[iT] - qx, P[iT + 1] - P[iQ + 1], P[iT + 2] - qz) > LMAX) return false;
  }
  return true;
}

/**
 * A velocidade do ator filtrada no tempo para a camada (constante MARCHA.filtroV): est = {v: o módulo, f: a componente
 * para a frente do rumo}; `inicio` (a 1ª pose da cena, a elipse): recomeça da de agora. Devolve est.
 */
export function filtrarMarcha(j, est, dt, inicio = false) {
  const v = Math.hypot(j.vx, j.vz), f = j.vx * Math.cos(j.rumo) + j.vz * Math.sin(j.rumo);
  if (inicio || est.v == null) { est.v = v; est.f = f; return est; }
  const k = 1 - Math.exp(-dt / MARCHA.filtroV);
  est.v += (v - est.v) * k; est.f += (f - est.f) * k;
  return est;
}

/** A rampa de entrada da camada pelo tempo (s) desde o começo da cena. */
export function rampaMarcha(t) { return suave(0, MARCHA.rampa, t); }
