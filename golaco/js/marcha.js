// Passada natural de quem ANDA fora da partida (item 61 da FILA; dono, 23/10, com print: no túnel e na fila "parecem que
// estão marchando, parecendo NPC"). PURO: sem three.js nem DOM, sem m.rng e sem Math.random — a variação de cada um sai
// de um sorteio pelo id (o pré-jogo sai igual sempre). FORA do fecho do hash (tools/fecho-hash.mjs): só o cortejo do
// pré-jogo (cortejo.js), as cenas (cena-atores.js: cartão, intervalo, fim; substituicao.js), os treinadores (tecnicos.js:
// a pelve e o tórax — os braços ficam nas posturas deles) e a página na comemoração (main.js → avancarComMarcha: a
// comemoracao.js é do fecho, a camada entra depois de cada passo dela) importam daqui — nenhum módulo da simulação. A pose da partida (anim.js) e a passada (jogador.js) não mudam: os
// jogadores DURANTE O JOGO andam como antes (a corrida aprovada pelo dono; o "completo" é o mocap, itens 50–52).
//
// Duas peças (a auditoria mediu: todos no mesmo pé, cadência igual, o pé direito saindo primeiro e agachando 27 cm, o
// braço 1/4 de ciclo fora da perna e com o cotovelo duro, a pelve e o tórax quase parados — as fontes estão no fim):
//  1) A FASE e o RITMO de cada um (o "cycleOffset" do Unity, a velocidade de reprodução sorteada por agente das multidões
//     do Softimage/Houdini): a fase inicial da passada pelo id (espalharFase: antes todos nasciam com fase 0 e, com o
//     mesmo atraso, o k-ésimo do mandante e o do visitante andavam no mesmo pé — 99,6% das amostras —, os 3 árbitros
//     juntos) e a cadência de cada um ×[1; 1,07] da tabela, uniforme (o `ritmoVoo` do jogador.js passoPassada só ACELERA
//     a passada com um pé no chão, e a velocidade é a do caminho: quem tem ritmo alto dá passos mais curtos — o walk ratio
//     cai com o QUADRADO do ritmo; com 1,07 fica em 0,0055–0,0063, até 1,5 desvio abaixo da média real, Sekiya 1996).
//  2) A CAMADA do desenho (marchar), aplicada logo depois da pose da locomoção (anim.js pose) e ANTES dos gestos de cada
//     cena: o braço balança oposto à perna do mesmo lado, no pico à frente logo depois do toque do pé do outro lado
//     (Collins, Adamczyk & Kuo 2009 — na pose do jogo o balanço é sen(π·fase), zero no toque: 1/4 de ciclo fora), com
//     ±11–13° (ROM do ombro 20–35°) e o cotovelo que dobra mais à frente (ROM ~30°, CiSE 2023); a pelve gira ±4° com a
//     perna da frente e o tórax ±3° ao contrário (Saunders, Inman & Eberhart 1953; Kong 2010; Lamoth 2002); na curva, o
//     braço de fora acompanha a inclinação do tronco (abreRoll). Os tornozelos não se mexem (o joelho é refeito pela IK do
//     anim.js com o quadril girado): o pé plantado continua plantado. Parado, o braço da camada é o da pose do jogo com a
//     fase 0 (pendurado): com a fase 0 a camada não muda nada. O braço misturado vai pela MÃO (em linha reta de um braço ao
//     outro) com o cotovelo pela IK e os comprimentos da pose.
// A camada só entra onde o braço da pose é o da passada (conferencia: a mesma conta do anim.js refeita aqui — o goleiro com
// as mãos prontas, a bola nas mãos, o cabeceio, o lateral e os gestos ficam como estão) e, entre MARCHA.vSai[0] e [1],
// VIRA a pose do jogo (a fase, a amplitude e a dobra do braço, a pelve e o tórax: sem misturar dois balanços fora de fase).
// Com o estado de cada ator (filtrarMarcha: cenas, cortejo, treinadores), a velocidade é filtrada e a mistura com a pose, o
// ganho e a conferência andam em rampas de taxa fixa — a mão nunca dá tranco quando a velocidade, o sentido ou o gesto
// mudam de uma vez. Medida: tools/teste-marcha.mjs (cortejo e cenas, manequim e corpo novo; as guardas por boneco e tick).
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
import { JOGADOR, PASSO } from './config.js';

export const MARCHA = {
  ligada: true,             // (os testes desligam para comparar a mesma locomoção com e sem a camada)
  ritmo: [1.0, 1.07],       // × a cadência da tabela (PASSADA.tabela: 1,96 passos/s a 1,47 m/s), uniforme — só sobe: passo
                            // mais curto (o walk ratio de cada um fica em 0,0055–0,0063, até ~1,5 desvio abaixo da média real)
  vRitmo: 1.9,              // m/s — o ritmo próprio só abaixo disto (andando há sempre um pé no chão: carga ≥ 0,5)
  rampa: 0.6,               // s — no começo de uma cena a camada entra devagar (o 1º quadro é a pose do jogo)
  vSai: [2.6, 3.2],         // m/s — de um ao outro, a camada vira a pose do jogo (a fase e a amplitude do braço, a dobra, o
                            // tronco); acima, a pose do jogo inteira (a corrida). Quem sai na substituição anda a 2,2 ± 0,2
  taxaSai: 0.5,             // s — com a velocidade filtrada (cenas, cortejo), a mistura com a pose do jogo anda no máximo 1 em
                            // tanto tempo (a freada de 3,5 a 1,5 m/s cruzava a faixa em ~5 ticks: a mão pulava ~6 cm por tick)
  filtroV: 0.15,            // s — a velocidade que move a camada é filtrada (a do corpo pode mudar de uma vez)
  vCheia: 1.4,              // m/s — as amplitudes crescem com a velocidade até aqui (× até 1,3 depois)
  taxaGanho: 3,             // 1/s — com a velocidade filtrada, o ganho das amplitudes muda no máximo isto por segundo (de
                            // frente para de costas em ~0,7 s: o braço não troca de lado num tick)
  abreRoll: 1,              // × a inclinação do tronco na curva (anim.js roll): o braço de FORA abre isso — balança no plano
                            // do tronco, não na vertical do mundo (com o ombro de fora indo para o meio da curva, a mão de
                            // fora entrava na coxa e passava na frente da virilha)
  braco: 0.19,              // rad — amplitude do braço a 1,4 m/s (×[0,8; 1,2] por jogador): ±11° (ROM do ombro 20–35°)
  bracoFator: [0.8, 1.2],
  atraso: [0.04, 0.12],     // passos — o pico do braço à frente depois do toque do pé do outro lado
  cotovelo: [0.12, 0.80],   // rad — a dobra do cotovelo com o braço todo atrás e todo à frente (7° → 46°)
  pelve: 0.07,              // rad — rotação da pelve (±4°) com a perna da frente
  torax: 0.055,             // rad — rotação do tórax (±3°) ao contrário
  troncoFator: [0.85, 1.15],
  abre: 0.12,               // rad — o braço aberto para fora (o do anim.js)
  confere: [0.015, 0.06],   // m — o braço da pose é o da passada (a camada inteira) até 1,5 cm; nada além de 6 cm
  taxaConfere: 0.3,         // s — com o estado (filtrarMarcha com a pose), a conferência sai e volta em tanto tempo (na
                            // comemoração um gesto que começa a entrar mexia o cotovelo e tirava a camada num tick: 20 cm)
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const suave = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hyp(a, b, c = 0) { return Math.sqrt(a * a + b * b + c * c); }
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
  // uniforme em [r0, r1] (o desvio entre jogadores ~2%: com 1,12 e o sorteio nas pontas, um terço dava passos de 0,66 m, o
  // walk ratio a 2 desvios abaixo da média real)
  out.ritmo = lerp(M.ritmo[0], M.ritmo[1], s(2));
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

/** A inclinação do tronco para o lado na curva (a conta do anim.js, a mesma do tronco desenhado: + para a direita). */
const rollDe = j => clamp(Math.atan2((j.az || 0) * Math.cos(j.rumo) - (j.ax || 0) * Math.sin(j.rumo), 9.81) * 0.7, -0.35, 0.35);
/** O ganho das amplitudes: a velocidade para a frente do rumo, com sinal (de costas, o balanço vira junto com a passada). */
const ganhoAlvo = vf => clamp(vf / MARCHA.vCheia, -1.3, 1.3);
/** A mistura com a pose do jogo pela velocidade (0 = a camada; 1 = a pose do jogo, a corrida). */
const misturaAlvo = v => suave(MARCHA.vSai[0], MARCHA.vSai[1], v);
/**
 * A camada: P = a pose da locomoção (anim.js pose, Float32Array 19×3, alterada no lugar); j = o jogador (fase, vx, vz,
 * rumo, ax, az, posicao, cond); mp = parametrosMarcha(id); w = 0–1 (a rampa de entrada da cena); est (opcional) = o estado
 * FILTRADO no tempo do ator (filtrarMarcha: a velocidade, a mistura com a pose do jogo e o ganho) — nas cenas a velocidade
 * do ator pode mudar de uma vez (o corpo freado no lugar, a meia-volta) e o braço da camada pularia junto. As amplitudes
 * andam pela velocidade PARA A FRENTE do rumo (de lado o braço quase não balança; de costas, o balanço vira junto com a
 * passada); na curva, o braço de fora acompanha a inclinação do tronco. Entre MARCHA.vSai[0] e [1] a camada VIRA a pose do
 * jogo — a fase do braço (o −cos da camada até o sen da pose: 1/2 passo), a amplitude, a dobra, a pelve e o tórax —, em vez
 * de misturar dois braços 1/4 de ciclo fora um do outro (a mão de um e a do outro chegavam a 40 cm). Devolve o peso aplicado.
 */
/**
 * A conferência: o braço que a pose desenhou é o da passada (1) ou outro — um gesto da cena por cima (a comemoração aplica
 * a camada DEPOIS dos gestos), a bola nas mãos, o lateral, o cabeceio (0)? A conta do anim.js refeita: o balanço
 * amp·sen(π·fase) e a dobra fixa `flex`, dos ombros da pose; a camada inteira até MARCHA.confere[0], nada além de [1].
 */
export function conferencia(P, j) {
  const s = hyp(j.vx, j.vz), fase = j.fase;
  const iE = J.ombroE * 3, iD = J.ombroD * 3;
  let orx = P[iD] - P[iE], orz = P[iD + 2] - P[iE + 2];
  const l = hyp(orx, orz) || 1;
  orx /= l; orz /= l;
  const ofx = orz, ofz = -orx;
  const amp = lerp(0.25, 0.95, clamp(s / 7, 0, 1)), flex = lerp(0.35, 1.45, clamp(s / 5, 0, 1));
  const abre = MARCHA.abre + (j.cond && j.cond.pedalada ? 0.35 : 0);
  let desvio = 0;
  for (let q = 0; q < 2; q++) {
    const lado = q ? 1 : -1, iO = q ? J.ombroD : J.ombroE, iC = q ? J.cotoveloD : J.cotoveloE, iM = q ? J.maoD : J.maoE;
    const bal = amp * Math.sin(Math.PI * fase) * (lado < 0 ? 1 : -1);
    braco(P[iO * 3], P[iO * 3 + 1], P[iO * 3 + 2], ofx, ofz, orx, orz, lado, bal, bal + flex, abre);
    desvio = Math.max(desvio,
      hyp(P[iC * 3] - _C[0], P[iC * 3 + 1] - _C[1], P[iC * 3 + 2] - _C[2]),
      hyp(P[iM * 3] - _H[0], P[iM * 3 + 1] - _H[1], P[iM * 3 + 2] - _H[2]));
  }
  return 1 - suave(MARCHA.confere[0], MARCHA.confere[1], desvio);
}

export function marchar(P, j, mp, w = 1, est = null, semBraco = false) {
  const M = MARCHA;
  if (!M.ligada || !(w > 0) || j.posicao === 'GOL') return 0;
  const s = hyp(j.vx, j.vz), h = j.rumo, fase = j.fase;
  const vf = est ? est.f : j.vx * Math.cos(h) + j.vz * Math.sin(h);
  // k: 0 = a camada, 1 = a pose do jogo (a corrida). Com o estado, as misturas filtradas (rampas de taxa fixa) passam por um
  // smoothstep: a mão sai e chega sem o tranco do começo e do fim da rampa
  const k = est ? suave(0, 1, est.k) : misturaAlvo(s);
  if (k >= 1) return 0;
  // a conferência do braço (com o estado: a filtrada, que sai e volta em MARCHA.taxaConfere s — o gesto que começa por cima
  // da camada não a tira de uma vez). Com o braço em parte num gesto (c < 1), a camada também some na faixa de saída: lá ela
  // vira o braço da PASSADA da pose, não o do gesto (o autor do gol freando com o punho no ar ganhava 4 cm num tick quando a
  // camada voltava em k = 1); com o braço livre (c = 1), a faixa de saída é a da fase e da amplitude, abaixo
  const c = est && est.c != null ? suave(0, 1, est.c) : conferencia(P, j);
  const wt = w * c * Math.pow(1 - k, 1 - c);
  if (wt <= 0) return 0;
  const iE = J.ombroE * 3, iD = J.ombroD * 3;
  let orx = P[iD] - P[iE], orz = P[iD + 2] - P[iE + 2];
  let l = hyp(orx, orz) || 1;
  orx /= l; orz /= l;
  let ofx = orz, ofz = -orx;
  const amp = lerp(0.25, 0.95, clamp(s / 7, 0, 1)), flex = lerp(0.35, 1.45, clamp(s / 5, 0, 1));
  const abre = M.abre + (j.cond && j.cond.pedalada ? 0.35 : 0);

  // ---- o alvo: +1 no toque do pé D (fase ímpar: a perna D à frente, o braço E à frente); o braço com o atraso. Na faixa de
  // saída o atraso vai a −1/2 passo (−cos(π(fase + 1/2)) = sen(π·fase): a fase da pose) e a amplitude à da pose
  const ganho = est ? est.g : ganhoAlvo(vf);
  const gB = -Math.cos(Math.PI * (fase - lerp(mp.atraso, -0.5, k)));
  const gP = -Math.cos(Math.PI * fase);
  const A = lerp(M.braco * mp.braco * ganho, amp, k);
  const dO = desvioLinha(P, J.ombroE, J.ombroD, h), dQ = desvioLinha(P, J.quadrilE, J.quadrilD, h);
  const pelveAlvo = lerp(-M.pelve * mp.tronco * ganho * gP, dQ, k);   // + = o quadril D para trás: no toque do D, o D à frente
  const toraxAlvo = lerp(M.torax * mp.tronco * ganho * -Math.cos(Math.PI * (fase - mp.atraso)), dO, k); // ao contrário
  // na curva, o braço de FORA abre o quanto o tronco inclina para dentro dela (a conta do anim.js: roll = atan(aceleração de
  // lado / g)·0,7, + para a direita; o braço da pose pende na vertical do mundo — com o ombro de fora indo para o meio, a mão
  // de fora entrava na coxa de fora; medido no cortejo: a mão na coxa 0,85% → 0,38% das amostras, o pior −10 → −3 cm)
  const roll = rollDe(j) * M.abreRoll * (1 - k);

  // ---- tórax: gira os ombros (com os braços) em volta da vertical do peito, do desvio da pose ao do alvo
  const pcx = P[J.peito * 3], pcz = P[J.peito * 3 + 2];
  const aT = difAng(dO, toraxAlvo) * wt;
  if (aT !== 0) {
    const c = Math.cos(aT), sn = Math.sin(aT);
    for (const i of BRACOS) girarY(P, i, pcx, pcz, c, sn);
    // a direita e a frente dos ombros girados
    const x = orx * c - orz * sn, z = orx * sn + orz * c;
    orx = x; orz = z; ofx = orz; ofz = -orx;
  }

  // ---- braços (no referencial dos ombros girados): o balanço do alvo e o cotovelo que dobra mais à frente. A dobra parte da
  // da pose (flex) e vai à da camada com a velocidade para a frente (de lado ou freando, o cotovelo da pose: esticado ali, a
  // mão descia na coxa); na faixa de saída, volta à da pose
  // (u, a fração do balanço, pela amplitude de referência do jogador: com o ganho passando pelo zero — de frente para de
  // costas — a amplitude some e, por ela, u trocava de lado num tick e o cotovelo pulava ~40°)
  // (a dobra da camada pesa pela velocidade para a frente; com o estado, pelo ganho filtrado — o vf passando pelo zero na
  // meia-volta andando para trás levava o cotovelo da camada à pose e de volta em 3 ticks)
  const wA = suave(0, 0.8, Math.abs(est ? ganho * M.vCheia : vf)), Aa = Math.max(Math.abs(A), M.braco * mp.braco);
  if (!semBraco) for (let q = 0; q < 2; q++) {
    const lado = q ? 1 : -1, iO = q ? J.ombroD : J.ombroE, iC = q ? J.cotoveloD : J.cotoveloE, iM = q ? J.maoD : J.maoE;
    const ox = P[iO * 3], oy = P[iO * 3 + 1], oz = P[iO * 3 + 2];
    const b = A * gB * (lado < 0 ? 1 : -1);
    const u = clamp(0.5 + 0.5 * b / Aa, 0, 1);   // 0 = o braço todo atrás, 1 = todo à frente
    const dobra = lerp(lerp(flex, lerp(M.cotovelo[0], M.cotovelo[1], u) + mp.cotovelo, wA), flex, k);
    const fora = roll * lado < 0 ? Math.abs(roll) : 0;
    braco(ox, oy, oz, ofx, ofz, orx, orz, lado, b, b + dobra, abre + fora);
    // mistura com o braço que está na pose: a MÃO vai em linha reta de uma à outra e o cotovelo sai da IK do braço (o polo
    // misturado) — o osso não estica; misturando o cotovelo, um cotovelo que pula na pose (a IK de um gesto da comemoração
    // que vira de lado) passava o pulo para a mão
    // (os comprimentos são os do braço da pose: o do anim.js não é exatamente BRACO/ANTEBRACO com o braço aberto)
    const L1 = hyp(P[iC * 3] - ox, P[iC * 3 + 1] - oy, P[iC * 3 + 2] - oz);
    const L2 = hyp(P[iM * 3] - P[iC * 3], P[iM * 3 + 1] - P[iC * 3 + 1], P[iM * 3 + 2] - P[iC * 3 + 2]);
    const hx = lerp(P[iM * 3], _H[0], wt), hy = lerp(P[iM * 3 + 1], _H[1], wt), hz = lerp(P[iM * 3 + 2], _H[2], wt);
    const px = lerp(P[iC * 3], _C[0], wt) - ox, py = lerp(P[iC * 3 + 1], _C[1], wt) - oy, pz = lerp(P[iC * 3 + 2], _C[2], wt) - oz;
    ikDois(ox, oy, oz, hx, hy, hz, px, py, pz, L1, L2, P, iC, iM);
  }

  // ---- pelve: gira a linha dos quadris em volta da pelve e refaz os joelhos (os tornozelos ficam onde estão). Se o
  // quadril girado ficasse além do alcance da perna (o tornozelo sairia do lugar), gira só o que cabe.
  let aP = difAng(dQ, pelveAlvo) * wt;
  if (aP !== 0) {
    const px = P[J.pelve * 3], pz = P[J.pelve * 3 + 2];
    if (!cabe(P, px, pz, aP)) {
      let lo = 0, hi = 1;
      for (let it = 0; it < 6; it++) { const m = (lo + hi) / 2; if (cabe(P, px, pz, aP * m)) lo = m; else hi = m; }
      aP *= lo;
    }
    if (aP !== 0) {
      const c = Math.cos(aP), sn = Math.sin(aP);
      for (let q = 0; q < 2; q++) {
        const iQ = q ? J.quadrilD : J.quadrilE, iK = q ? J.joelhoD : J.joelhoE, iT = q ? J.tornozeloD : J.tornozeloE;
        girarY(P, iQ, px, pz, c, sn);
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
/**
 * IK de dois ossos com os comprimentos dados (L1 ombro → cotovelo, L2 cotovelo → mão): a mão em (hx, hy, hz) — além do
 * alcance, na reta até ele —, o cotovelo para o lado do polo (px, py, pz; a parte ao longo do braço não conta).
 */
function ikDois(ox, oy, oz, hx, hy, hz, px, py, pz, L1, L2, P, iC, iM) {
  let dx = hx - ox, dy = hy - oy, dz = hz - oz;
  const d0 = hyp(dx, dy, dz) || 1e-9;
  const ux = dx / d0, uy = dy / d0, uz = dz / d0;
  const d = Math.min(d0, (L1 + L2) * 0.9999);
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
  const hh = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const pd = px * ux + py * uy + pz * uz;
  let qx = px - pd * ux, qy = py - pd * uy, qz = pz - pd * uz;
  const ql = hyp(qx, qy, qz) || 1;
  qx /= ql; qy /= ql; qz /= ql;
  P[iC * 3] = ox + ux * a + qx * hh; P[iC * 3 + 1] = oy + uy * a + qy * hh; P[iC * 3 + 2] = oz + uz * a + qz * hh;
  P[iM * 3] = ox + ux * d; P[iM * 3 + 1] = oy + uy * d; P[iM * 3 + 2] = oz + uz * d;
}
const BRACOS = [J.ombroE, J.ombroD, J.cotoveloE, J.cotoveloD, J.maoE, J.maoD];
/** Os dois quadris girados de a em volta de (px, pz) alcançam os tornozelos? */
function cabe(P, px, pz, a) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let k = 0; k < 2; k++) {
    const iQ = (k ? J.quadrilD : J.quadrilE) * 3, iT = (k ? J.tornozeloD : J.tornozeloE) * 3;
    const x = P[iQ] - px, z = P[iQ + 2] - pz;
    const qx = px + x * c - z * s, qz = pz + x * s + z * c;
    if (hyp(P[iT] - qx, P[iT + 1] - P[iQ + 1], P[iT + 2] - qz) > LMAX) return false;
  }
  return true;
}

/**
 * O estado da camada filtrado no tempo de um ator (cenas, cortejo, treinadores): est = {v: a velocidade, f: a componente para
 * a frente do rumo (MARCHA.filtroV), k: a mistura com a pose do jogo pela velocidade (no máximo 1 em MARCHA.taxaSai s), g: o
 * ganho das amplitudes (no máximo MARCHA.taxaGanho por s)}; `inicio` (a 1ª pose da cena, a elipse, o salto no tempo do
 * cortejo): recomeça do de agora. Devolve est.
 */
export function filtrarMarcha(j, est, dt, inicio = false, P = null) {
  const M = MARCHA;
  const v = hyp(j.vx, j.vz), f = j.vx * Math.cos(j.rumo) + j.vz * Math.sin(j.rumo);
  const ct = P ? conferencia(P, j) : null;
  if (inicio || est.v == null) {
    est.v = v; est.f = f; est.k = misturaAlvo(v); est.g = ganhoAlvo(f); est.c = ct;
    return est;
  }
  const a = 1 - Math.exp(-dt / M.filtroV);
  est.v += (v - est.v) * a; est.f += (f - est.f) * a;
  const dk = dt / M.taxaSai, dg = dt * M.taxaGanho, dc = dt / M.taxaConfere;
  est.k += clamp(misturaAlvo(est.v) - est.k, -dk, dk);
  est.g += clamp(ganhoAlvo(est.f) - est.g, -dg, dg);
  est.c = ct == null ? null : est.c == null ? ct : est.c + clamp(ct - est.c, -dc, dc);
  return est;
}

/** A rampa de entrada da camada pelo tempo (s) desde o começo da cena. */
export function rampaMarcha(t) { return suave(0, MARCHA.rampa, t); }

/**
 * A camada nos atores de uma cena DEPOIS do passo dela — a comemoração (comemoracao.js é do fecho do hash: a página e os
 * testes chamam avancarComMarcha, abaixo). A pose do ator já tem os gestos da cena: a conferência do braço (marchar) deixa
 * de fora quem está com as mãos ocupadas (braços para o céu, avião, abraço). Por ator: a.mp, a.vm (o estado filtrado) e a.wm
 * (a rampa: do 0 no 1º passo e de novo do 0 depois do mergulho, do carrinho, dos joelhos, do pulo, do agachado e do parado
 * fixo — a pose deles fica pura).
 */
export function marcharAtores(atores, dt = PASSO) {
  for (const a of atores) {
    const j = a.j;
    if (!j || !a.atu) continue;
    if (a.mergulha || a.noCarrinho || a.desliza || a.ajoelhado || a.voa || a.noAr || a.fixo || a.agacha > 0.02) { a.wm = 0; continue; }
    const w = a.wm ?? 0;
    filtrarMarcha(j, a.vm ?? (a.vm = { v: null, f: 0 }), dt, !(w > 0), a.atu);
    marchar(a.atu, j, a.mp ?? (a.mp = parametrosMarcha(a.id)), rampaMarcha(w * MARCHA.rampa), a.vm);
    a.wm = Math.min(1, w + dt / MARCHA.rampa);
  }
}

/**
 * O avancarCena da comemoração (a mesma conta de comemoracao.js avancarCena: os ticks inteiros de dt e a sobra em c.alfa)
 * com a camada depois de cada passo: passoCena = comemoracao.js passoCena (a página o passa: este módulo não importa a cena).
 * O passo seguinte copia a pose com a camada para a.ant (o desenho interpola as duas). Devolve quantos ticks rodou.
 */
export function avancarComMarcha(c, dt, passoCena) {
  if (c.acabou) { c.alfa = 1; return 0; }
  c.acum += Math.max(0, dt);
  let n = 0;
  while (c.acum >= PASSO - 1e-9 && !c.acabou) { passoCena(c); marcharAtores(c.atores); c.acum -= PASSO; n++; }
  if (c.acum < 0) c.acum = 0;
  c.alfa = c.acabou ? 1 : Math.min(1, c.acum / PASSO);
  return n;
}
