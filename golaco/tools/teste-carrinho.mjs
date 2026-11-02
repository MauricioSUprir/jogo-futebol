// teste-carrinho (item 34 da FILA; pedido do dono de 17/10: "botão de CARRINHO — dividida deslizando; falta/cartão pela
// Regra 12"): o corpo de quem desliza é um PLANO puro montado no aperto e um QUADRO puro do tempo (carrinho.js), lido pela
// simulação, pela pose e pelas cenas; o contato vale pela perna DESENHADA; a falta, pela Regra 12. Contrato: CONTRATOS.md
// "Carrinho (item 34)"; constantes: config.js DEFESA_HUMANO.carrinho.
//
// Na base (sem js/carrinho.js) REPROVA: "o carrinho existe — não existe nesta lógica" (como o teste-faltas com o faltas.js).
// Commits 1–3 da entrega: o plano e o quadro (A, P pelo quadro), a pose e o corpo novo (P), o corpo na simulação com o
// disparo e as travas (E), o contato da perna com a bola (B, E6) e o F1. O canhão contra o condutor (C), as regras (D), o
// resto de F e as cenas (G) entram nos commits seguintes.
//
// Metas (as exatas reprovam em qualquer caso; "·" = informativa, não reprova):
//  0. estrutura: o campo `carrinho` declarado no jogador (forma única; undefined sem o botão); as constantes; os raios das
//     pernas = os maiores do SEGMENTOS do anim.js; joelho2Ossos = anim.js ik bit a bit; carrinhoAtivo / tempoCarrinho /
//     congela; bolaAlta; o plano é objeto simples (structuredClone dá o mesmo quadro) e montado igual duas vezes.
//  A. física do corpo (entradas sintéticas: parado, 3, 4,75, 6 e 7 m/s alinhadas e os desvios máximos 2 m/s a 90°, 4 a
//     67,5°, 6 a 45° e 8,4 a 34,8°, dos dois lados; 120 estados de uma partida de verdade — a passada, o quadril e os pés
//     como estavam — cada um com o analógico numa direção qualquer e para trás do corpo; e 4 estados de partida gravados, os
//     que levavam o joelho dobrado ao chão sem a guarda carrinho.js joelhoFora):
//     A1 a 4,75 m/s o deslize (aperto → parada) dura 0,95–1,15 s (a ÚNICA régua medida: "~1 s", van den Eijnde 2017); o
//        quadril até parar é consistência do modelo (§3.2 da pesquisa, derivado): informativo;
//     A2 sem teletransporte: o quadro de t = 0 é o corpo no aperto; o centro anda ≤ (v + 0,2)·PASSO por tick; a velocidade
//        muda ≤ 13 m/s²·PASSO por tick fora do impacto e ≤ 23 no impacto (giro + perda); o rumo ≤ 20°/quadro;
//     A3 resposta (regra do projeto: ≤ 0,1 s): a pelve desce no 1º passo e está ≥ 0,05 m abaixo de h0 em 0,1 s, em todas as
//        entradas (h0 ≥ 0,77 m), inclusive no desvio máximo;
//     A4 pés (a régua do teste-patinacao/teste-mergulho): plantado ≤ 0,05 m/s; no ar ≤ 2,5·v + 3 m/s (v do corpo, até
//        6; na transição até tD, v ≥ a velocidade da entrada ve — o corpo que inverte passa por v ≈ 0 enquanto as pernas
//        vão ao deslize); nenhum pé apoiado durante o deslize;
//     A5 da parada até de pé: errou 1,2 s ± 1 tick; ganhou (marcarAcerto antes da parada) 0,5 s ± 1 tick; o toque depois da
//        parada não muda nada (o raspão = errou); no fim os dois pés plantados, v = 0, pelve 0,92 ± 0,02;
//     A6 continuidade: a pelve salta ≤ 0,05 m (além do que o centro anda) entre a pose normal no aperto e o 1º quadro, e
//        entre o último quadro e a pose normal de pé com os pés onde o quadro os plantou;
//     A7 atributo: com desarme 90 o deslize vai mais longe que com 40, na mesma entrada (GOALS 0.42.0);
//     A8 tq ≤ tAr + tImpacto em todas as entradas (0–9,4 m/s × 0–180°) e o desvio pedido além do limite fica no limite
//        (desvioMax); a aceleração da queda ≤ 13 m/s²;
//     A9 ajuda de mira pelo encontro: condutor a 5 m/s cruzando a frente do carrinho a 2, 4 e 5,5 m (entradas a 4,75, 6 e
//        7 m/s), o analógico 15° à frente da direção do encontro: a ponta passa a ≤ 0,3 m da bola NO MESMO instante (um
//        horizonte fixo puxa a mira para trás da bola: 0/6; a mira pelo instante da MENOR distância parava a 0,34 m: 2/6).
//  P. o corpo nos quadros de A: pelo quadro, os dois ossos de cada perna com o comprimento exato e o tornozelo ao alcance
//     (o esqueleto do corpo novo só aceita 0,9–1,1 por osso); o fundo das cápsulas das pernas, da pelve e dos quadris ≥ −1 cm
//     (P1); o joelho dobrado ≥ 0,06 m e a pelve 0,14–0,20 m no deslize (P1); o tronco 40–60° para trás no deslize (P4); o
//     quadro não escreve no plano (P5). Pela pose (anim.js poseCarrinho): P2 as juntas das pernas = as do quadro (o Float32
//     da conta); P1 o fundo de todas as cápsulas do manequim e da cabeça ≥ −1 cm e o vértice mais baixo da pele do corpo novo
//     (LOD0, a carga do teste-ossos; a cada 3 quadros nos estados de partida) ≥ −1 cm; P3 o esqueleto do corpo novo na
//     sequência pose normal no aperto → carrinho → pose normal de pé: O1 juntas ≤ 1 mm, O2 saltos > 40° com o eixo < 20°
//     ≤ 0,03%, O3 NaN 0 e a escala no limite ≤ 0,5% (as réguas do teste-ossos, que só vê IA × IA); P4 a cabeça ≤ 17° da linha
//     peito → pescoço (o portão da postura do corpo novo) e o tronco 40–60° do vertical no deslize; P5 100 leituras da pose
//     e da altura do quadril não escrevem no plano.
//  E. as travas na simulação (estados de uma partida de verdade, semente 3102; o humano no time 0): E1 com o carrinho os
//     outros botões não mexem no corpo dele (bit a bit), ele não domina a bola (colada no pé no tick do aperto; rolando
//     para ele no chão), não recebe o controle (TROCAR, candidatoTroca), o boteIA dele não sai e volta no passo do fim;
//     E2 o disparo bloqueado deixa o mundo bit a bit igual ao sem o aperto (bola no pé do meu time, voo do meu time,
//     goleiro, parada, tick do gol, bola nas mãos, alta, subindo, no ar, DIVIDIDA em andamento ou sem reação, já no
//     carrinho, treino, disputa de pênaltis); E3 a borda (segurar não repete; o segurado na troca não dispara; o aperto novo
//     depois do fim dispara); E4 o TROCAR no meio não muda o carrinho (bit a bit); E5 sai parado (impulso vMin), com a
//     bola livre e no passe rasteiro deles; E7 o aperto zera o pulo no chão, o toque aéreo e a disputa pelo alto; E8 a IA
//     não o escolhe (1º/2º homem, marcação, bola livre, PRESSÃO, alvo de passe) e a forma continua contando com ele.
//     E6 a bola morta (lateral, falta de outro, gol): o carrinho segue sem efeito — 0 eventos e o tempo no chão de erro
//     (a mesma bola na perna com a bola viva toca: o controle).
//  B. o contato da perna desenhada com a bola (defesa.js contatosCarrinho), no mundo mínimo do contato (sim.js passo 5:
//     passoBola e o contato) contra um árbitro INDEPENDENTE (a trajetória livre da bola × as 6 cápsulas do quadro no mesmo
//     instante, 32 amostras por passo + busca ternária): B1 a bola dentro da cápsula varrida (centro ≤ 0,6 m; folga 0,5 cm +
//     |v perna|·PASSO/8) é tocada em 100% (240 posições pela trajetória das pernas × parada e 2/8/20 m/s, 120 no ar, 80
//     altas); B2 a de fora nunca, a de centro acima de 0,6 m nunca, a do próprio time (pé de um companheiro, voo dele)
//     nunca; B3 a bola parada no contato frontal (n·u ≥ 0,866) sai entre 0,8·|vc| (na transição, com o pé ainda saindo do
//     chão atrás do corpo, 0,8·(|vc| − vPernaRel)) e 1,3·(|vc| + 2) m/s, para a frente, e o chute a 20 e 30 m/s não
//     atravessa a canela; B4 um toque por carrinho e a DIVIDIDA do mesmo tick não sai; B5 (na simulação) o bloqueio
//     sorteado nunca vale para o deslizante com a bola 0,5–5 cm fora da perna, e o toque da perna dá UM evento no passo
//     (nem o bloqueio nem o disco do corpo de novo); B6 os eventos — chute → bateuCorpo {bloqueio, carrinho} (o voo e o
//     último toque ficam), cruzamento → roubada {de: passe}, bola livre → roubada {de: livre}, condutor → dividida ganhou +
//     roubada só a ≥ rouboVRel, raspão → a posse fica e nada de TOQUES — e os leitores sem mudar com eles (o gol desviado é
//     de quem chutou; o cruzamento desviado para o próprio gol é gol contra na súmula e no resultado do TM; o passe cortado
//     não conta; o impedido que desliza é marcado); B7 dois carrinhos na mesma bola: o mais cedo, no empate o time
//     m.tick % 2, o mesmo resultado nas duas ordens de m.jogadores.
//  F1 a mesma semente e as mesmas entradas, com carrinhos: o mesmo hash em 2 rodadas.
//   node tools/teste-carrinho.mjs              (lógica do repositório)
//   node tools/teste-carrinho.mjs --js <pasta> (outra cópia da lógica; a da main antes do carrinho → REPROVA)
//   node tools/teste-carrinho.mjs --detalhe    (a tabela por entrada e cada caso do A9)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const DETALHE = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

const linhas = [];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([ok ? '✓' : '✗', nome, String(medido), meta]); if (!ok) falhas++; };
const info = (nome, medido, ref) => linhas.push(['·', nome, String(medido), ref]);
function fim() {
  const larg = [1, 2, 3].map(c => Math.min(70, Math.max(...linhas.map(l => String(l[c]).length))));
  console.log(linhas.map(l => `${l[0]} ${String(l[1]).padEnd(larg[0])} | ${String(l[2]).padEnd(larg[1])} | ${l[3]}`).join('\n'));
  console.log(falhas ? `\nteste-carrinho: REPROVOU (${falhas})` : '\nteste-carrinho: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'carrinho.js'))) {
  reg('o carrinho existe (carrinho.js)', 'não existe nesta lógica', 'carrinho.js', false);
  fim();
}

const K = await imp('carrinho.js');
const CFG = await imp('config.js');
const P = await imp('partida.js');
const A = await imp('anim.js');
const JG = await imp('jogador.js');
const SIM = await imp('sim.js');
const AC = await imp('acoes.js');
const BL = await imp('bola.js');
// o corpo novo (Etapa 5: o esqueleto do desenho e a malha LOD0 — a mesma carga do teste-ossos), para P1 e P3
let ES = null, CORPO = null;
try {
  ES = await imp('render/esqueleto.js');
  const CD = await imp('render/corpo-dados.js');
  const raiz = path.resolve(JS, '..');
  const ix = JSON.parse(fs.readFileSync(path.join(raiz, 'assets/jogador/corpo.json'), 'utf8'));
  const bf = fs.readFileSync(path.join(raiz, 'assets/jogador/corpo.bin'));
  CORPO = CD.lerCorpo(ix, bf.buffer.slice(bf.byteOffset, bf.byteOffset + bf.byteLength));
} catch { ES = null; CORPO = null; }
const TEM_POSE = typeof A.poseCarrinho === 'function';
const CC = CFG.DEFESA_HUMANO.carrinho;
const PASSO = CFG.PASSO;
const T_AR = CC.tAr, T_D = CC.tAr + CC.tImpacto;
const L1 = CFG.JOGADOR.coxa, L2 = CFG.JOGADOR.canela, LMAX = (L1 + L2) * 0.998;
const GRAU = Math.PI / 180;
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const f3 = x => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angDif = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d <= -Math.PI) d += 2 * Math.PI; else if (d > Math.PI) d -= 2 * Math.PI; return d; };

// o mundo da pose (a pose normal lê o mundo: posse, parada, bola) — uma partida de verdade no meio do jogo
const m = P.criarPartida({ semente: 3001, minutosPorTempo: 4 });
for (let i = 0; i < 600; i++) P.passoPartida(m, P.entradaDemoPartida(m));

// ------------------------------------------------------------------ 0. estrutura
{
  const j = JG.criarJogador(1, 0, 0, 0, {}, 0);
  reg('0 campo `carrinho` declarado no jogador (forma única)', 'carrinho' in j ? `undefined: ${j.carrinho === undefined}` : 'ausente',
    'declarado, undefined', 'carrinho' in j && j.carrinho === undefined);
  reg('0 constantes (DEFESA_HUMANO.carrinho)', CC ? 'existem' : 'ausentes', 'config.js', !!CC);
  const S = A.SEGMENTOS, J = A.J;
  const raio = (a, b) => { const s = S.find(x => x[0] === a && x[1] === b); return Math.max(s[2], s[3]); };
  const esperados = [raio(J.quadrilE, J.joelhoE), raio(J.joelhoE, J.tornozeloE), raio(J.tornozeloE, J.pontaE)];
  const iguais = K.RAIOS_PERNA.every((r, i) => r === esperados[i]) && esperados.every((r, i) => r === raio([J.quadrilD, J.joelhoD, J.tornozeloD][i], [J.joelhoD, J.tornozeloD, J.pontaD][i]));
  reg('0 raios das pernas = os do SEGMENTOS (anim.js)', K.RAIOS_PERNA.join(' / '), esperados.join(' / '), iguais);
  // joelho2Ossos = anim.js ik, bit a bit
  let dif = 0, n = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = new Float32Array(A.NJ * 3), jo = {}, to = {};
  for (let i = 0; i < 2000; i++) {
    const v = Array.from({ length: 9 }, () => rnd() * 2 - 1);
    v[1] = 0.2 + rnd() * 0.8; v[4] = rnd() * 0.3;
    A.ik(...v, out, A.J.joelhoE, A.J.tornozeloE);
    K.joelho2Ossos(...v, jo, to);
    // (o anim.js grava num Float32Array: a cópia em Float32 tem de dar o mesmo)
    const f = Math.fround;
    if (f(jo.x) !== out[A.J.joelhoE * 3] || f(jo.y) !== out[A.J.joelhoE * 3 + 1] || f(jo.z) !== out[A.J.joelhoE * 3 + 2]
      || f(to.x) !== out[A.J.tornozeloE * 3] || f(to.y) !== out[A.J.tornozeloE * 3 + 1] || f(to.z) !== out[A.J.tornozeloE * 3 + 2]) dif++;
    n++;
  }
  reg('0 joelho2Ossos = anim.js ik (bit a bit)', `${dif} de ${n} diferentes`, '0', dif === 0);
  // bolaAlta
  const mb = p => ({ bola: { p: { x: 0, y: p.y, z: 0 }, v: { x: 0, y: p.vy, z: 0 }, rolando: p.rol } });
  const casos = [[{ y: 0.11, vy: 0, rol: true }, false], [{ y: 1.0, vy: -2, rol: false }, true], [{ y: 0.3, vy: -2, rol: false }, false],
    [{ y: 0.3, vy: 1, rol: false }, true], [{ y: 0.59, vy: -0.1, rol: false }, false], [{ y: 0.61, vy: -0.1, rol: false }, true]];
  const errBA = casos.filter(([p, e]) => K.bolaAlta(mb(p)) !== e).length;
  reg('0 bolaAlta (no ar acima de 0,6 m ou subindo)', `${casos.length - errBA}/${casos.length} certos`, 'todos', errBA === 0);
}

// ------------------------------------------------------------------ jogadores sintéticos e a amostra dos quadros
let idSint = 900;
/** Um jogador de pé (os pés plantados ao lado) com a velocidade e o analógico pedidos; a pelve (j.quadril) é a da conta do
 * jogo (anim.js alturaQuadril: correndo a 7 m/s ela fica ~6 cm abaixo da parada), ou h0 se dada. */
function jogadorSint({ v = 0, angV = 0.3, rumo = angV, analog = null, desarme = 65, h0 = null, x = 10, z = 5 }) {
  const j = JG.criarJogador(idSint++, x, z, rumo, { desarme }, 0);
  j.posicao = 'ZAG';
  j.vx = v * Math.cos(angV); j.vz = v * Math.sin(angV);
  j.quadril = h0 ?? A.alturaQuadril(j, m);
  if (analog != null) { j.imag = 1; j.ix = Math.cos(analog); j.iz = Math.sin(analog); } else j.imag = 0;
  return j;
}
/** Os quadros de todos os ticks do plano (do aperto ao fim). */
function quadros(c) {
  const n = c.fim - c.tick0, qs = [];
  for (let i = 0; i <= n; i++) qs.push(K.quadroCarrinho(c, i * PASSO, K.novoQuadroCarrinho()));
  return qs;
}
const pelvePose = (j) => { const o = A.pose(j, m); return { x: o[0], y: o[1], z: o[2] }; };

// acumuladores das metas por quadro (A2, A3, A4, A6, P) — sobre todas as entradas
const R = {
  casos: 0, a2t0: 0, a2pos: 0, a2vel: 0, a2velImp: 0, a2yaw: 0, a2piorPos: 0, a2piorVel: 0, a2piorVelImp: 0, a2piorYaw: 0,
  a3: 0, a3n: 0, a3pior: Infinity, a3baixos: 0,
  a4plant: 0, a4ar: 0, a4deslize: 0, a4piorPlant: 0, a4piorArRazao: 0, a4maxPe: 0,
  a6ini: 0, a6fim: 0, a6piorIni: 0, a6piorFim: 0,
  ossos: 0, ossoPior: 0, alcance: 0, fundo: 0, fundoPior: Infinity, joelho: 0, joelhoPior: Infinity, pelve: 0, pelveFaixa: [Infinity, -Infinity],
  tronco: 0, troncoFaixa: [Infinity, -Infinity], p5: 0, nan: 0,
};
const S = A.SEGMENTOS, JJ = A.J;
const segR = (a, b) => { const s = S.find(x => x[0] === a && x[1] === b); return [s[2], s[3]]; };
const R_COXA = segR(JJ.quadrilE, JJ.joelhoE), R_CANELA = segR(JJ.joelhoE, JJ.tornozeloE), R_PE = segR(JJ.tornozeloE, JJ.pontaE);
const R_PELVE = segR(JJ.pelve, JJ.lombar)[0], R_QUADRIS = segR(JJ.quadrilE, JJ.quadrilD)[0];

// ------------------------------------------------------------------ P: a pose (anim.js poseCarrinho) e o corpo novo
const NJ = A.NJ, SEG = A.SEGMENTOS, fr = Math.fround;
const RP = {
  seqs: 0, quadros: 0, p2: 0, p2pior: 0, fundo: 0, fundoPior: Infinity, fundoEx: '', cab: 0, cabPior: 0, troncoN: 0, tronco: 0,
  troncoFaixa: [Infinity, -Infinity], p5: 0, nan: 0,
  // o corpo novo: o vértice mais baixo da pele (LOD0), O1 juntas, O2 saltos, O3 NaN/escala no limite
  peleN: 0, pele: 0, pelePior: Infinity, o1: 0, o1pior: 0, o2: 0, o2n: 0, o2ex: '', o3nan: 0, o3lim: 0, o3n: 0,
};
const angulo = (ax, ay, az, bx, by, bz) => Math.acos(Math.max(-1, Math.min(1, (ax * bx + ay * by + az * bz) / (Math.hypot(ax, ay, az) * Math.hypot(bx, by, bz) || 1)))) / GRAU;
const dif3 = (po, i, a, b) => [po[b * 3] - po[a * 3], po[b * 3 + 1] - po[a * 3 + 1], po[b * 3 + 2] - po[a * 3 + 2]];
// o esqueleto do corpo novo (as contas do teste-ossos)
let EQ = null;
if (ES && CORPO) {
  const E = ES.criarEsqueleto(CORPO.repouso);
  const JE = Object.fromEntries(ES.JUNTAS_ESQ.map((n, i) => [n, i]));
  for (const n of ES.JUNTAS_ESQ) if (JE[n] !== A.J[n]) throw new Error(`a ordem das juntas do esqueleto (${n}) não é a do anim.js`);
  const partes = Object.values(CORPO.lods[0].partes).map(pt => ({ nv: pt.nv, pos: pt.pos, ossos: pt.ossos, w: Float64Array.from(pt.pesos, x => x / 255) }));
  EQ = {
    E, JE, partes, NOS: ES.NOSSOS, NPR: ES.N_PRINC, D0: E.desenhoRepouso, COMPR: E.comprimentos,
    IA: ES.OSSOS.map(o => JE[o[0]]), IB: ES.OSSOS.map(o => (o[1] ? JE[o[1]] : -1)), S: new Float64Array(ES.NOSSOS * 12),
  };
}
const angAxis = (pa, po, a, b) => angulo(pa[b * 3] - pa[a * 3], pa[b * 3 + 1] - pa[a * 3 + 1], pa[b * 3 + 2] - pa[a * 3 + 2], po[b * 3] - po[a * 3], po[b * 3 + 1] - po[a * 3 + 1], po[b * 3 + 2] - po[a * 3 + 2]);
const dobraJ = (q, a, b, c) => angulo(q[b * 3] - q[a * 3], q[b * 3 + 1] - q[a * 3 + 1], q[b * 3 + 2] - q[a * 3 + 2], q[c * 3] - q[b * 3], q[c * 3 + 1] - q[b * 3 + 1], q[c * 3 + 2] - q[b * 3 + 2]);
/** O corpo novo numa sequência de poses (a normal no aperto, as do carrinho, a normal de pé no fim): O1, O2 e O3 como no
 * teste-ossos (O2 entre quadros seguidos) e o vértice mais baixo da pele a cada `cada` quadros. */
function esqueletoSeq(poses, vels, cada, nome) {
  const { E, JE, partes, NOS, NPR, D0, COMPR, IA, IB, S } = EQ;
  let aS = null, aD = null;
  for (let i = 0; i < poses.length; i++) {
    E.pele(poses[i], S, 0, vels[i], 1);
    const D = E.desenho;
    if (!S.every(Number.isFinite)) RP.o3nan++;
    for (let b = 0; b < NPR; b++) {
      const o = b * 12, temEixo = IB[b] >= 0 && b !== 15 && b !== 18;
      if (temEixo) {
        RP.o3n++;
        const a = IA[b] * 3, c2 = IB[b] * 3;
        const k = Math.hypot(D[c2] - D[a], D[c2 + 1] - D[a + 1], D[c2 + 2] - D[a + 2]) / COMPR[b];
        if (k < 0.9 || k > 1.1) { RP.o3lim++; continue; }
      }
      for (const jt of temEixo ? [IA[b], IB[b]] : [IA[b]]) {
        const x = D0[jt * 3], y = D0[jt * 3 + 1], z = D0[jt * 3 + 2];
        const e = Math.hypot(S[o] * x + S[o + 1] * y + S[o + 2] * z + S[o + 3] - D[jt * 3], S[o + 4] * x + S[o + 5] * y + S[o + 6] * z + S[o + 7] - D[jt * 3 + 1],
          S[o + 8] * x + S[o + 9] * y + S[o + 10] * z + S[o + 11] - D[jt * 3 + 2]);
        if (e > RP.o1pior) RP.o1pior = e;
        if (e > 0.001) RP.o1++;
      }
    }
    RP.o2n++;
    if (aS) {
      for (let b = 0; b < NPR; b++) {
        const o = b * 12;
        let tr = 0;
        for (let c2 = 0; c2 < 3; c2++) {
          let na = 0, nb = 0, d = 0;
          for (let r = 0; r < 3; r++) { na += aS[o + r * 4 + c2] ** 2; nb += S[o + r * 4 + c2] ** 2; d += aS[o + r * 4 + c2] * S[o + r * 4 + c2]; }
          tr += d / (Math.sqrt(na * nb) || 1);
        }
        const th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) / GRAU;
        if (th <= 40) continue;
        const bb = IB[b] >= 0 ? b : ES.PAI[b];
        const ang = angAxis(aD, D, IA[bb], IB[bb]);
        let angPe = 0, angDobra = 0;
        if (b >= 13 && b <= 18) {
          const esq = b < 16;
          angPe = angAxis(aD, D, esq ? JE.tornozeloE : JE.tornozeloD, esq ? JE.pontaE : JE.pontaD);
          angDobra = Math.abs(dobraJ(aD, esq ? JE.quadrilE : JE.quadrilD, esq ? JE.joelhoE : JE.joelhoD, esq ? JE.tornozeloE : JE.tornozeloD)
            - dobraJ(D, esq ? JE.quadrilE : JE.quadrilD, esq ? JE.joelhoE : JE.joelhoD, esq ? JE.tornozeloE : JE.tornozeloD));
        } else if (b >= 6 && b <= 12 && b !== 9) {
          const esq = b < 9;
          angDobra = Math.abs(dobraJ(aD, esq ? JE.ombroE : JE.ombroD, esq ? JE.cotoveloE : JE.cotoveloD, esq ? JE.maoE : JE.maoD)
            - dobraJ(D, esq ? JE.ombroE : JE.ombroD, esq ? JE.cotoveloE : JE.cotoveloD, esq ? JE.maoE : JE.maoD));
        }
        if (ang < 20 && angPe < 20 && angDobra < 15) { RP.o2++; if (!RP.o2ex) RP.o2ex = `${nome} quadro ${i} osso ${ES.NOMES_OSSOS[b]} ${th.toFixed(0)}°`; }
      }
    }
    aS = Float64Array.from(S); aD = Float64Array.from(D);
    // o vértice mais baixo da pele (a altura do vértice pela pele linear: só o y)
    if (i > 0 && i < poses.length - 1 && i % cada === 0) {
      let mn = Infinity, osso = -1;
      for (const pt of partes) {
        const { nv, pos, ossos, w } = pt;
        for (let v = 0; v < nv; v++) {
          const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
          let oy = 0;
          for (let k = 0; k < 4; k++) {
            const wk = w[v * 4 + k];
            if (!wk) continue;
            const ib = ossos[v * 4 + k] * 12;
            oy += wk * (S[ib + 4] * x + S[ib + 5] * y + S[ib + 6] * z + S[ib + 7]);
          }
          if (oy < mn) { mn = oy; osso = ossos[v * 4]; }
        }
      }
      RP.peleN++;
      if (mn < RP.pelePior) { RP.pelePior = mn; RP.peleEx = `${nome} quadro ${i} (osso ${ES.NOMES_OSSOS[osso]})`; }
      if (mn < -0.01) RP.pele++;
    }
  }
}
const _poP5 = new Float32Array(NJ * 3);
/** A pose do carrinho nos quadros do plano c (o mundo mw: a página/o mundo com o tick do quadro) e o corpo novo. */
function medirPose(j, c, qs, mw, poseFim, velFim, cada, nome) {
  const antes = JSON.stringify(c), salvo = j.carrinho;
  j.carrinho = c;
  const poses = [], vels = [];
  for (let i = 0; i < qs.length; i++) {
    mw.tick = c.tick0 + i;
    const po = A.pose(j, mw, new Float32Array(NJ * 3));
    poses.push(po);
    vels.push(i === 0 ? Math.hypot(j.vx, j.vz) : Math.hypot(qs[i].vx, qs[i].vz));
    if (i === 0) continue;
    RP.quadros++;
    const q = qs[i];
    for (let k = 0; k < po.length; k++) if (!Number.isFinite(po[k])) { RP.nan++; break; }
    // P2: as pernas da pose = as do quadro (o Float32 da pose: a conta do quadro arredondada)
    for (let p = 0; p < 2; p++) {
      const ids = p === 0 ? [A.J.quadrilE, A.J.joelhoE, A.J.tornozeloE, A.J.pontaE] : [A.J.quadrilD, A.J.joelhoD, A.J.tornozeloD, A.J.pontaD];
      const pts = [q.qd[p], q.jo[p], q.to[p], q.po[p]];
      for (let k = 0; k < 4; k++) {
        const d = Math.max(Math.abs(po[ids[k] * 3] - fr(pts[k].x)), Math.abs(po[ids[k] * 3 + 1] - fr(pts[k].y)), Math.abs(po[ids[k] * 3 + 2] - fr(pts[k].z)));
        if (d > RP.p2pior) RP.p2pior = d;
        if (d !== 0) RP.p2++;
      }
    }
    // P1 (manequim): o fundo de todas as cápsulas e da cabeça ≥ −1 cm
    let fundo = po[A.J.cabeca * 3 + 1] - A.RAIO_CABECA, onde = 'cabeça';
    for (const [a, b, ra, rb] of SEG) {
      const f = Math.min(po[a * 3 + 1] - ra, po[b * 3 + 1] - rb);
      if (f < fundo) { fundo = f; onde = `${A.JUNTAS[a]}–${A.JUNTAS[b]}`; }
    }
    if (fundo < RP.fundoPior) { RP.fundoPior = fundo; RP.fundoEx = `${nome} quadro ${i} (${onde})`; }
    if (fundo < -0.01 - 1e-6) RP.fundo++;
    // P4: a cabeça a ≤ 17° da linha peito → pescoço (o portão da postura do corpo novo); o tronco 40–60° para trás no deslize
    const t1 = dif3(po, 0, A.J.peito, A.J.pescoco), t2 = dif3(po, 0, A.J.pescoco, A.J.cabeca);
    const ac = angulo(...t1, ...t2);
    if (ac > RP.cabPior) RP.cabPior = ac;
    if (ac > 17) RP.cab++;
    if (q.fase === 2) {
      const tr = dif3(po, 0, A.J.pelve, A.J.pescoco), at = angulo(...tr, 0, 1, 0);
      RP.troncoN++;
      RP.troncoFaixa[0] = Math.min(RP.troncoFaixa[0], at); RP.troncoFaixa[1] = Math.max(RP.troncoFaixa[1], at);
      if (at < 40 || at > 60) RP.tronco++;
    }
  }
  // P5: a pose e a altura do quadril não escrevem no plano (100 leituras)
  for (let i = 0; i < 100; i++) { mw.tick = c.tick0 + 1 + (i % (qs.length - 1)); A.pose(j, mw, _poP5); A.alturaQuadril(j, mw); }
  if (JSON.stringify(c) !== antes) RP.p5++;
  j.carrinho = salvo;
  RP.seqs++;
  if (EQ) esqueletoSeq([...poses, poseFim], [...vels, velFim], cada, nome);
}

/** Mede o plano c do jogador j (pel0: a pelve da pose normal no aperto; mw: o mundo da pose) em todas as metas por quadro. */
function medir(j, c, pel0, mw = null, cada = 1, nome = '') {
  R.casos++;
  const antes = JSON.stringify(c);
  const qs = quadros(c);
  const q0 = qs[0];
  // A2: o quadro de t = 0 é o corpo no aperto
  if (Math.hypot(q0.x - j.x, q0.z - j.z) > 1e-9 || Math.hypot(q0.vx - j.vx, q0.vz - j.vz) > 1e-9 || Math.abs(angDif(j.rumo, q0.yaw)) > 1e-9
    || Math.abs(q0.h - (j.quadril ?? CC.hPe)) > 1e-9) R.a2t0++;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    for (const k of ['x', 'z', 'vx', 'vz', 'yaw', 'h']) if (!Number.isFinite(q[k])) R.nan++;
    for (let p = 0; p < 2; p++) for (const jt of [q.qd[p], q.jo[p], q.to[p], q.po[p]]) if (!Number.isFinite(jt.x + jt.y + jt.z)) R.nan++;
    // P: os ossos, o alcance, o fundo das cápsulas
    for (let p = 0; p < 2; p++) {
      const e1 = Math.abs(dist3(q.qd[p], q.jo[p]) - L1), e2 = Math.abs(dist3(q.jo[p], q.to[p]) - L2);
      R.ossoPior = Math.max(R.ossoPior, e1, e2);
      if (e1 > 1e-7 || e2 > 1e-7) R.ossos++;
      if (dist3(q.qd[p], q.to[p]) > LMAX + 1e-9) R.alcance++;
      const fundo = Math.min(q.qd[p].y - R_COXA[0], q.jo[p].y - R_COXA[1], q.jo[p].y - R_CANELA[0], q.to[p].y - R_CANELA[1],
        q.to[p].y - R_PE[0], q.po[p].y - R_PE[1], q.qd[p].y - R_QUADRIS);
      R.fundoPior = Math.min(R.fundoPior, fundo);
      if (fundo < -0.01 - 1e-9) R.fundo++;
    }
    const fp = q.h - R_PELVE;
    R.fundoPior = Math.min(R.fundoPior, fp);
    if (fp < -0.01 - 1e-9) R.fundo++;
    if (q.fase === 2 || q.fase === 3) {
      const jd = q.jo[1 - c.frente].y;
      R.joelhoPior = Math.min(R.joelhoPior, jd);
      if (jd < 0.06) R.joelho++;
    }
    if (q.fase === 2) {
      R.pelveFaixa[0] = Math.min(R.pelveFaixa[0], q.h); R.pelveFaixa[1] = Math.max(R.pelveFaixa[1], q.h);
      if (q.h < 0.14 || q.h > 0.2) R.pelve++;
      const tr = q.incl / GRAU;
      R.troncoFaixa[0] = Math.min(R.troncoFaixa[0], tr); R.troncoFaixa[1] = Math.max(R.troncoFaixa[1], tr);
      if (tr < 40 || tr > 60) R.tronco++;
    }
    // A4: nenhum pé apoiado no deslize (da queda à parada)
    if (q.t > 0 && q.t <= c.tS && (q.apoio0 || q.apoio1)) R.a4deslize++;
    if (i === 0) continue;
    const a = qs[i - 1];
    // A2: centro, velocidade, rumo
    const va = Math.hypot(a.vx, a.vz), vb = Math.hypot(q.vx, q.vz), vmax = Math.max(va, vb);
    const dP = Math.hypot(q.x - a.x, q.z - a.z);
    R.a2piorPos = Math.max(R.a2piorPos, dP / PASSO - vmax);
    if (dP > (vmax + 0.2) * PASSO + 1e-12) R.a2pos++;
    const dV = Math.hypot(q.vx - a.vx, q.vz - a.vz) / PASSO;
    const impacto = q.t > T_AR && a.t < T_D;
    if (impacto) { R.a2piorVelImp = Math.max(R.a2piorVelImp, dV); if (dV > 23 + 1e-9) R.a2velImp++; }
    else { R.a2piorVel = Math.max(R.a2piorVel, dV); if (dV > 13 + 1e-9) R.a2vel++; }
    const dy = Math.abs(angDif(a.yaw, q.yaw)) / GRAU;
    R.a2piorYaw = Math.max(R.a2piorYaw, dy);
    if (dy > 20 + 1e-9) R.a2yaw++;
    // A4: os tornozelos. Na transição (até tD) o v da régua é o maior entre o do corpo e o da entrada (ve): o corpo lento
    // que desliza para trás (a direção é livre abaixo de 2 m/s) passa por v ≈ 0 ao inverter enquanto as pernas vão ao
    // deslize (a spec, A.5.4: o desenho da perna pode ir a ~9–10 m/s nessa transição; com o v do corpo, 2 de 120 estados da
    // partida passavam de 2,5·v + 3 com o pé a ~8 m/s)
    const lim = 2.5 * Math.min(6, q.t <= T_D ? Math.max(vmax, c.ve) : vmax) + 3;
    for (let p = 0; p < 2; p++) {
      const vp = dist3(q.to[p], a.to[p]) / PASSO;
      R.a4maxPe = Math.max(R.a4maxPe, vp);
      const plant = (p === 0 ? q.apoio0 && a.apoio0 : q.apoio1 && a.apoio1);
      if (plant) { R.a4piorPlant = Math.max(R.a4piorPlant, vp); if (vp > 0.05) R.a4plant++; }
      else { R.a4piorArRazao = Math.max(R.a4piorArRazao, vp / lim); if (vp > lim) R.a4ar++; }
    }
  }
  // A3: a resposta da pelve
  const h0 = q0.h;
  if (h0 >= 0.77) {
    R.a3n++;
    const d1 = h0 - qs[1].h, d6 = h0 - qs[6].h;
    R.a3pior = Math.min(R.a3pior, d6);
    if (!(d1 > 0) || d6 < 0.05) R.a3++;
  } else R.a3baixos++;
  // A6: a pelve no começo (pose normal no aperto × 1º quadro, além do que o centro anda) e no fim (último quadro × pose
  // normal de pé com os pés plantados onde o quadro os deixou)
  if (pel0) {
    const q1 = qs[1];
    const dIni = Math.hypot(0 - (pel0.x - j.x), q1.h - pel0.y, 0 - (pel0.z - j.z));
    R.a6piorIni = Math.max(R.a6piorIni, dIni);
    if (dIni > 0.05) R.a6ini++;
  }
  const qF = qs[qs.length - 1];
  const j2 = jogadorSint({ v: 0, rumo: qF.yaw, x: qF.x, z: qF.z, h0: qF.h });
  j2.fase = j.fase;
  for (let p = 0; p < 2; p++) {
    const pe = j2.pes[p];
    pe.apoio = true; pe.x = qF.to[p].x; pe.z = qF.to[p].z; pe.rumo = qF.yaw; pe.lx = pe.x; pe.lz = pe.z; pe.tx = pe.x; pe.tz = pe.z;
  }
  const poseFim = A.pose(j2, m, new Float32Array(NJ * 3)), pf = { x: poseFim[0], y: poseFim[1], z: poseFim[2] };
  const dFim = Math.hypot(pf.x - qF.x, pf.y - qF.h, pf.z - qF.z);
  R.a6piorFim = Math.max(R.a6piorFim, dFim);
  if (dFim > 0.05) R.a6fim++;
  // P5 (a parte do quadro): ler o plano não o muda
  for (let i = 0; i < 100; i++) { K.quadroCarrinho(c, (i % 90) * 0.02, K.novoQuadroCarrinho()); K.carrinhoAtivo({ carrinho: c }, c.tick0 + i); K.tempoCarrinho(c, c.tick0 + i); }
  if (JSON.stringify(c) !== antes) R.p5++;
  if (TEM_POSE && mw) medirPose(j, c, qs, mw, poseFim, 0, cada, nome);
  return qs;
}

// ------------------------------------------------------------------ A. as entradas sintéticas
const ENTRADAS = [
  { nome: 'parado', v: 0, desv: 0 }, { nome: '3,0 alinhado', v: 3, desv: 0 }, { nome: '4,75 alinhado', v: 4.75, desv: 0 },
  { nome: '6,0 alinhado', v: 6, desv: 0 }, { nome: '7,0 alinhado', v: 7, desv: 0 },
  { nome: '2,0 a 90°', v: 2, desv: 90 }, { nome: '4,0 a 67,5°', v: 4, desv: 67.5 }, { nome: '6,0 a 45°', v: 6, desv: 45 },
  { nome: '8,4 a 34,8°', v: 8.4, desv: 34.8 },
];
const tabela = [['entrada', 'tq', 'tS', 'quadril até parar', 'ponta máx.', 'fora do lance (erro)']];
const res = {};
for (const e of ENTRADAS) {
  for (const lado of [1, -1]) {
    const angV = 0.3;
    const j = jogadorSint({ v: e.v, angV, analog: angV + lado * e.desv * GRAU });
    const pel0 = pelvePose(j);
    const c = K.montarCarrinho(j, m.tick, { bola: null, prever: null });
    const qs = medir(j, c, pel0, Object.assign({}, m), 1, `${e.nome} lado ${lado}`);
    if (lado === 1) {
      const qS = K.quadroCarrinho(c, c.tS, K.novoQuadroCarrinho());
      const dq = Math.hypot(qS.x - c.x0, qS.z - c.z0);
      const ponta = Math.max(...qs.map(q => Math.hypot(q.po[c.frente].x - c.x0, q.po[c.frente].z - c.z0)));
      res[e.nome] = { c, dq, ponta };
      tabela.push([e.nome, f2(c.tq), f2(c.tS), `${f2(dq)} m`, `${f2(ponta)} m`, `${f2((c.fim - c.tick0) * PASSO)} s`]);
    }
  }
}
// A1
{
  const r = res['4,75 alinhado'];
  reg('A1 deslize a 4,75 m/s (aperto → parada)', `${f2(r.c.tS)} s`, '0,95–1,15 s (van den Eijnde: ~1 s)', r.c.tS >= 0.95 && r.c.tS <= 1.15);
  info('A1 quadril até parar (modelo §3.2, derivado)', `4,75: ${f2(r.dq)}; 3,0: ${f2(res['3,0 alinhado'].dq)}; 7,0: ${f2(res['7,0 alinhado'].dq)}; parado: ${f2(res.parado.dq)} m`,
    '2,6–3,3 / ≤ 1,8 / ≤ 6,5 / ≥ 0,6');
  info('A1 fora do lance no erro a 4,75 (aperto → de pé)', `${f2((r.c.fim - r.c.tick0) * PASSO)} s`, 'pesquisa: ~2,2 s (estimativa)');
}

// ------------------------------------------------------------------ A. estados de uma partida de verdade
{
  const mm = P.criarPartida({ semente: 3002, minutosPorTempo: 4 });
  let s = 777, n = 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 6000 && n < 120; i++) {
    P.passoPartida(mm, P.entradaDemoPartida(mm));
    if (i < 600 || i % 37 !== 0 || mm.partida.estado !== 'jogo') continue;
    const linha = mm.jogadores.filter(j => j.posicao !== 'GOL');
    for (let r = 0; r < 2 && n < 120; r++) {
      const j0 = linha[(i + r * 7) % linha.length];
      const o = A.pose(j0, mm);
      const pel0 = { x: o[0], y: o[1], z: o[2] };
      const b = mm.bola;
      const bola = { x: b.p.x, z: b.p.z };
      const prever = (t, out) => { out.x = b.p.x + b.v.x * t; out.z = b.p.z + b.v.z * t; return out; };
      // o analógico numa direção qualquer (85%; senão solto) e para TRÁS do corpo (140–180° do rumo): de costas, devagar
      // (a direção é livre abaixo de 2 m/s), é onde as pernas mais giram na queda (o joelho dobrado afundava no chão)
      for (const tras of [false, true]) {
        const j = structuredClone(j0);
        const ang = tras ? j0.rumo + Math.PI + (rnd() - 0.5) * 80 * GRAU : rnd() * 2 * Math.PI;
        j.imag = tras || rnd() < 0.85 ? 1 : 0; j.ix = Math.cos(ang); j.iz = Math.sin(ang);
        const c = K.montarCarrinho(j, mm.tick, { bola, prever });
        medir(j, c, pel0, Object.assign({}, mm), 3, `partida 3002 tick ${mm.tick} j${j.id}${tras ? ' (para trás)' : ''}`);
      }
      n++;
    }
  }
  info('A estados de partida medidos (A2–A4, A6, P)', `${n} × 2 analógicos (semente 3002)`, '120 × 2');
}

// os 4 estados de partida (dos 6 de 6441: 5 partidas, sementes 3002–3006) em que o joelho ia mais fundo no chão sem a guarda do
// carrinho.js joelhoFora (o fundo da cápsula a −2,1 / −1,3 / −1,3 / −1,1 cm), gravados relativos ao corpo (x para a frente
// dele, z para a direita): a pelve agachada (0,58–0,81 m), um pé no ar longe, o analógico de lado ou para trás
{
  const PINADOS = [
    { q: 0.6045, v: [1.3063, 1.39], an: 1.239, bola: [-22.1116, -6.3571], fase: 235.1195, pes: [{ apoio: false, xz: [-0.4789, -0.7939], r: -0.526, t: [-0.4124, -0.7253, 0.1165], lr: 0.3528 }, { apoio: true, xz: [0.2819, 0.3542], r: -0.047, t: [0.2819, 0.3542, 0.08], lr: -0.047 }] },
    { q: 0.5765, v: [1.2183, -1.4821], an: -1.8771, bola: [6.9771, 39.3871], fase: 117.9599, pes: [{ apoio: false, xz: [-0.6634, 0.5707], r: 0.43, t: [0.3024, -0.4593, 0.08], lr: -0.0128 }, { apoio: true, xz: [-0.2401, 0.7958], r: 0.2357, t: [-0.2401, 0.7958, 0.08], lr: 0.2357 }] },
    { q: 0.6027, v: [1.1142, -1.5745], an: -2.2657, bola: [-13.8578, 24.0684], fase: 85.8731, pes: [{ apoio: false, xz: [-0.5169, 0.7524], r: 0.961, t: [0.2558, -0.4463, 0.086], lr: -0.0078 }, { apoio: true, xz: [-0.19, 0.7885], r: 0.1621, t: [-0.19, 0.7885, 0.08], lr: 0.1621 }] },
    { q: 0.8094, v: [0.0495, -0.3156], an: -0.7664, bola: [3.8937, 10.7413], fase: 321.478, pes: [{ apoio: false, xz: [-0.112, 0.7621], r: -1.1931, t: [-0.0675, 0.4365, 0.1438], lr: 1.5 }, { apoio: true, xz: [0.0732, -0.2741], r: -1.2, t: [0.0732, -0.2741, 0.08], lr: -1.5505 }] },
  ];
  const R0 = 0.4, X0 = 10, Z0 = 5, cr = Math.cos(R0), sr = Math.sin(R0);
  const mx = (a, b) => X0 + a * cr - b * sr, mz = (a, b) => Z0 + a * sr + b * cr;
  for (const e of PINADOS) {
    const j = jogadorSint({ v: 0, rumo: R0, x: X0, z: Z0, h0: e.q, analog: R0 + e.an });
    j.vx = e.v[0] * cr - e.v[1] * sr; j.vz = e.v[0] * sr + e.v[1] * cr; j.fase = e.fase;
    e.pes.forEach((pe, k) => {
      const o = j.pes[k];
      o.apoio = pe.apoio; o.x = mx(...pe.xz); o.z = mz(...pe.xz); o.rumo = R0 + pe.r;
      o.tx = mx(pe.t[0], pe.t[1]); o.tz = mz(pe.t[0], pe.t[1]); o.ty = pe.t[2]; o.ox = 0; o.oz = 0; o.lrumo = R0 + pe.lr;
    });
    medir(j, K.montarCarrinho(j, m.tick, { bola: { x: mx(...e.bola), z: mz(...e.bola) } }), null, Object.assign({}, m), 1, `gravado q=${e.q}`);
  }
  info('A estados de partida gravados (o joelho no chão sem a guarda)', PINADOS.length, 'as metas A2–A4, A6 (fim) e P');
}

reg('A2 o quadro de t = 0 é o corpo no aperto', `${R.a2t0} de ${R.casos}`, '0', R.a2t0 === 0);
reg('A2 centro ≤ (v + 0,2)·PASSO por tick', `${R.a2pos} (pior: v + ${f3(R.a2piorPos)} m/s)`, '0', R.a2pos === 0);
reg('A2 velocidade fora do impacto ≤ 13 m/s²', `${R.a2vel} (pior ${f2(R.a2piorVel)} m/s²)`, '0', R.a2vel === 0);
reg('A2 velocidade no impacto ≤ 23 m/s²', `${R.a2velImp} (pior ${f2(R.a2piorVelImp)} m/s²)`, '0', R.a2velImp === 0);
reg('A2 rumo ≤ 20°/quadro', `${R.a2yaw} (pior ${f2(R.a2piorYaw)}°)`, '0', R.a2yaw === 0);
reg('A3 pelve desce no 1º passo e ≥ 0,05 m em 0,1 s', `${R.a3} de ${R.a3n} (pior ${f3(R.a3pior)} m)`, '0', R.a3 === 0 && R.a3n > 0);
if (R.a3baixos) info('A3 estados com h0 < 0,77 m (a gravidade não dá 0,05 m em 0,1 s)', R.a3baixos, 'fora da meta');
reg('A4 pé plantado ≤ 0,05 m/s', `${R.a4plant} (pior ${f3(R.a4piorPlant)} m/s)`, '0', R.a4plant === 0);
reg('A4 pé no ar ≤ 2,5·v + 3 m/s (na transição, v ≥ ve)', `${R.a4ar} (pior ${f2(R.a4piorArRazao)} × o limite)`, '0', R.a4ar === 0);
info('A4 o tornozelo mais rápido (todos os quadros)', `${f2(R.a4maxPe)} m/s`, 'spec A.5.4: ~9–10 m/s na transição');
reg('A4 nenhum pé apoiado no deslize', R.a4deslize, '0', R.a4deslize === 0);
reg('A6 pelve no começo (pose normal → 1º quadro)', `${R.a6ini} (pior ${f3(R.a6piorIni)} m)`, '≤ 0,05 m: 0', R.a6ini === 0);
reg('A6 pelve no fim (último quadro → pose normal)', `${R.a6fim} (pior ${f3(R.a6piorFim)} m)`, '≤ 0,05 m: 0', R.a6fim === 0);

// ------------------------------------------------------------------ A5: o tempo no chão
{
  const j = jogadorSint({ v: 4.75, angV: 0.3, analog: 0.3 });
  const c = K.montarCarrinho(j, 5000, {});
  const chaoErro = (c.fim - c.tick0) * PASSO - c.tS;
  const fimOk = cc => { const q = K.quadroCarrinho(cc, (cc.fim - cc.tick0) * PASSO, K.novoQuadroCarrinho()); return q.apoio0 && q.apoio1 && Math.hypot(q.vx, q.vz) <= 1e-9 && Math.abs(q.h - 0.92) <= 0.02; };
  const c2 = structuredClone(c);
  const mudou = K.marcarAcerto(c2, c2.tick0 + 20);
  const chaoAcerto = (c2.fim - c2.tick0) * PASSO - c2.tS;
  const c3 = structuredClone(c);
  const tarde = K.marcarAcerto(c3, c3.tick0 + Math.ceil(c3.tS / PASSO) + 1);
  const tol = PASSO + 1e-9;
  reg('A5 errou: da parada até de pé', `${f3(chaoErro)} s`, '1,2 ± 1 tick', Math.abs(chaoErro - 1.2) <= tol);
  reg('A5 ganhou: da parada até de pé', `${f3(chaoAcerto)} s (marcou: ${mudou})`, '0,5 ± 1 tick', mudou && Math.abs(chaoAcerto - 0.5) <= tol);
  reg('A5 toque depois da parada não muda (= errou)', tarde ? 'mudou' : 'não mudou', 'não muda', !tarde && c3.fim === c.fim);
  reg('A5 no fim: pés plantados, v = 0, pelve 0,92 ± 0,02', `errou ${fimOk(c)}, ganhou ${fimOk(c2)}`, 'os dois', fimOk(c) && fimOk(c2));
  // carrinhoAtivo / tempoCarrinho / congela
  const jc = { carrinho: c };
  const atv = [K.carrinhoAtivo(jc, c.tick0), K.carrinhoAtivo(jc, c.tick0 + 1), K.carrinhoAtivo(jc, c.fim), K.carrinhoAtivo(jc, c.fim + 1)];
  const cg = structuredClone(c); cg.congela = c.tick0 + 10;
  const jg = { carrinho: cg };
  const congOk = K.carrinhoAtivo(jg, c.fim + 500) && Math.abs(K.tempoCarrinho(cg, c.fim + 500) - 10 * PASSO) < 1e-12
    && Math.abs(K.tempoCarrinho(c, c.tick0 + 7, 0.004) - (7 * PASSO + 0.004)) < 1e-12;
  reg('0 carrinhoAtivo (tick0 não; tick0+1..fim sim; depois não)', atv.join(' '), 'false true true false',
    atv.join(' ') === 'false true true false' && !K.carrinhoAtivo({ carrinho: null }, 1));
  reg('0 congela: o relógio do quadro para no apito', congOk ? 'parado' : 'andou', 'parado', congOk);
  // o plano é objeto simples e determinístico
  const cl = structuredClone(c), qa = K.quadroCarrinho(c, 0.77, K.novoQuadroCarrinho()), qb = K.quadroCarrinho(cl, 0.77, K.novoQuadroCarrinho());
  const c4 = K.montarCarrinho(j, 5000, {});
  reg('0 plano simples (structuredClone dá o mesmo quadro) e montado igual 2×', JSON.stringify(qa) === JSON.stringify(qb) && JSON.stringify(c4) === JSON.stringify(c) ? 'igual' : 'diferente',
    'igual', JSON.stringify(qa) === JSON.stringify(qb) && JSON.stringify(c4) === JSON.stringify(c));
}

// ------------------------------------------------------------------ A7: o atributo
{
  const mk = d => K.montarCarrinho(jogadorSint({ v: 4.75, angV: 0.3, analog: 0.3, desarme: d }), 5000, {});
  const dist = c => { const q = K.quadroCarrinho(c, c.tS, K.novoQuadroCarrinho()); return Math.hypot(q.x - c.x0, q.z - c.z0); };
  const d90 = dist(mk(90)), d40 = dist(mk(40));
  reg('A7 desarme 90 desliza mais que 40 (4,75 m/s)', `${f2(d90)} × ${f2(d40)} m`, '90 > 40', d90 > d40);
}

// ------------------------------------------------------------------ A8: o giro cabe até o impacto
{
  let n = 0, tqFora = 0, desvErr = 0, acelErr = 0, piorDesv = 0, piorAcel = 0;
  for (const v of [0, 1, 1.99, 2, 3, 4, 5, 6, 7, 8.4, 9.4]) {
    for (let req = 0; req <= 180; req += 7.5) {
      for (const lado of [1, -1]) {
        const angV = -1.1;
        const c = K.montarCarrinho(jogadorSint({ v, angV, analog: angV + lado * req * GRAU }), 100, {});
        n++;
        if (c.tq < T_AR - 1e-12 || c.tq > T_D + 1e-12) tqFora++;
        if (v > 0) {
          const real = Math.abs(angDif(angV, Math.atan2(c.uz, c.ux))) / GRAU;
          const esp = v >= CC.desvioLivre ? Math.min(req, K.desvioMax(v) / GRAU) : req;
          piorDesv = Math.max(piorDesv, Math.abs(real - esp));
          if (Math.abs(real - esp) > 1e-6) desvErr++;
        }
        const acel = Math.hypot(c.ve * c.ux - c.vx0, c.ve * c.uz - c.vz0) / c.tq;
        piorAcel = Math.max(piorAcel, acel);
        if (acel > 13 + 1e-9) acelErr++;
      }
    }
  }
  reg('A8 tq entre tAr e tAr + tImpacto', `${tqFora} de ${n}`, '0', tqFora === 0);
  reg('A8 desvio pedido além do limite fica no limite', `${desvErr} (pior ${piorDesv.toExponential(1)}°)`, '0', desvErr === 0);
  reg('A8 aceleração da queda ≤ 13 m/s²', `${acelErr} (pior ${f2(piorAcel)} m/s²)`, '0', acelErr === 0);
  const tqs = ['2,0 a 90°', '4,0 a 67,5°', '6,0 a 45°', '8,4 a 34,8°'].map(k => f2(res[k].c.tq));
  info('A8 tq no desvio máximo (2 / 4 / 6 / 8,4 m/s)', tqs.join(' / ') + ' s', 'spec: 0,30 / 0,33 / 0,35 / 0,40');
}

// ------------------------------------------------------------------ A9: a ajuda de mira pelo encontro
{
  const VC = 5;
  /** A menor distância (horizontal) entre a ponta da perna da bola e a bola no mesmo instante, tick a tick. */
  function pontaMin(c, B) {
    let best = Infinity;
    const q = K.novoQuadroCarrinho(), b = { x: 0, z: 0 };
    const n = Math.ceil(c.tS / PASSO);
    for (let i = 0; i <= n; i++) {
      const t = i * PASSO;
      K.quadroCarrinho(c, t, q); B(t, b);
      const p = q.po[c.frente];
      best = Math.min(best, Math.hypot(b.x - p.x, b.z - p.z));
    }
    return best;
  }
  const casos = [];
  for (const [d, v] of [[2, 4.75], [4, 6], [5.5, 7]]) {
    for (const lado of [1, -1]) {
      const x0 = 0, z0 = 0;
      // o tempo da ponta até a linha do condutor, indo reto: a bola cruza a frente do carrinho nesse instante
      const cr = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: 0, x: x0, z: z0 }), 100, {});
      const qq = K.novoQuadroCarrinho();
      let T = null;
      for (let i = 0; i <= Math.ceil(cr.tS / PASSO); i++) { K.quadroCarrinho(cr, i * PASSO, qq); if (qq.po[cr.frente].x >= d) { T = i * PASSO; break; } }
      if (T == null) { casos.push({ d, v, lado, fora: true }); continue; }
      const zb0 = -lado * VC * T;
      const B = (t, out) => { out.x = d; out.z = zb0 + lado * VC * t; return out; };
      const bola = { x: d, z: zb0 };
      // a direção do encontro (sem ajuda): a melhor por varredura
      let best = Infinity, th = 0;
      for (let a = -40; a <= 40; a += 0.25) {
        const c = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: a * GRAU, x: x0, z: z0 }), 100, { bola });
        const dm = pontaMin(c, B);
        if (dm < best) { best = dm; th = a; }
      }
      if (best > 0.2) { casos.push({ d, v, lado, fora: true, best }); continue; }
      const an = (th + lado * 15) * GRAU;
      const cA = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: an, x: x0, z: z0 }), 100, { bola, prever: B });
      const cS = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: an, x: x0, z: z0 }), 100, { bola });
      casos.push({ d, v, lado, th, best, com: pontaMin(cA, B), sem: pontaMin(cS, B), mirou: cA.mirou });
    }
  }
  const validos = casos.filter(c => !c.fora);
  const ruins = validos.filter(c => !(c.com <= 0.3));
  reg('A9 ajuda de mira: a ponta a ≤ 0,3 m da bola no mesmo instante', `${validos.length - ruins.length}/${validos.length} (pior ${f2(Math.max(...validos.map(c => c.com)))} m)`,
    'todos (6 casos)', ruins.length === 0 && validos.length === 6);
  info('A9 sem a ajuda (o mesmo analógico)', `${f2(Math.min(...validos.map(c => c.sem)))}–${f2(Math.max(...validos.map(c => c.sem)))} m`, 'erra');
  reg('A9 a mira ajudada marca a intenção (mirou)', `${validos.filter(c => c.mirou).length}/${validos.length}`, 'todos', validos.every(c => c.mirou));
  if (DETALHE) for (const c of casos) console.log(`A9 d=${c.d} v=${c.v} lado=${c.lado}: ${c.fora ? `fora (${f2(c.best)})` : `θ*=${c.th}° melhor ${f3(c.best)} com ${f3(c.com)} sem ${f3(c.sem)} mirou ${c.mirou}`}`);
}

// ------------------------------------------------------------------ P: o corpo nos quadros
reg('P ossos: coxa e canela com o comprimento exato', `${R.ossos} (pior ${R.ossoPior.toExponential(1)} m)`, '0', R.ossos === 0);
reg('P tornozelo ao alcance da perna (≤ LMAX)', R.alcance, '0', R.alcance === 0);
reg('P1 fundo das cápsulas (pernas, quadris, pelve) ≥ −1 cm', `${R.fundo} (pior ${f3(R.fundoPior)} m)`, '0', R.fundo === 0);
reg('P1 joelho dobrado ≥ 0,06 m (deslize e chão)', `${R.joelho} (pior ${f3(R.joelhoPior)} m)`, '0', R.joelho === 0);
reg('P1 pelve no deslize 0,14–0,20 m', `${R.pelve} (${f3(R.pelveFaixa[0])}–${f3(R.pelveFaixa[1])} m)`, '0', R.pelve === 0);
reg('P4 tronco 40–60° para trás no deslize', `${R.tronco} (${f2(R.troncoFaixa[0])}–${f2(R.troncoFaixa[1])}°)`, '0', R.tronco === 0);
reg('P5 o quadro não escreve no plano (100 leituras)', R.p5, '0', R.p5 === 0);
reg('nenhum NaN nos quadros', R.nan, '0', R.nan === 0);
// P pela pose (anim.js poseCarrinho) e pelo corpo novo
if (!TEM_POSE) reg('P a pose do carrinho (anim.js poseCarrinho)', 'não existe nesta lógica', 'existe', false);
else {
  reg('P2 as juntas das pernas da pose = as do quadro (Float32)', `${RP.p2} juntas×quadros (pior ${RP.p2pior.toExponential(1)} m) em ${RP.quadros} quadros`, '0', RP.p2 === 0 && RP.quadros > 0);
  reg('P1 fundo das cápsulas do manequim e da cabeça (pose) ≥ −1 cm', `${RP.fundo} (pior ${f3(RP.fundoPior)} m${RP.fundo || DETALHE ? `: ${RP.fundoEx}` : ''})`, '0', RP.fundo === 0);
  reg('P4 cabeça ≤ 17° da linha peito → pescoço', `${RP.cab} (pior ${f2(RP.cabPior)}°)`, '0', RP.cab === 0);
  reg('P4 tronco 40–60° do vertical no deslize (pose)', `${RP.tronco} de ${RP.troncoN} (${f2(RP.troncoFaixa[0])}–${f2(RP.troncoFaixa[1])}°)`, '0', RP.tronco === 0 && RP.troncoN > 0);
  reg('P5 a pose e a altura do quadril não escrevem no plano (100 leituras)', `${RP.p5} de ${RP.seqs}`, '0', RP.p5 === 0);
  reg('P nenhum NaN na pose', RP.nan, '0', RP.nan === 0);
  if (!EQ) reg('P1/P3 o corpo novo (render/esqueleto.js, assets/jogador/corpo.*)', 'não carregou', 'carrega', false);
  else {
    reg('P1 vértice mais baixo da pele do corpo novo (LOD0) ≥ −1 cm', `${RP.pele} de ${RP.peleN} quadros (pior ${f3(RP.pelePior)} m${RP.pele || DETALHE ? `: ${RP.peleEx}` : ''})`, '0', RP.pele === 0 && RP.peleN > 0);
    reg('P3 O1 juntas do esqueleto ≤ 1 mm', `${RP.o1} (pior ${(RP.o1pior * 1000).toFixed(3)} mm)`, '0', RP.o1 === 0);
    const tx = RP.o2 / Math.max(1, RP.o2n);
    reg('P3 O2 saltos (> 40° com o eixo < 20°)', `${RP.o2} em ${RP.o2n} quadros (${(tx * 100).toFixed(4)}%)${RP.o2ex ? '; ex.: ' + RP.o2ex : ''}`, '≤ 0,03%', tx <= 0.0003);
    const tl = RP.o3lim / Math.max(1, RP.o3n);
    reg('P3 O3 NaN e escala no limite [0,9; 1,1]', `NaN ${RP.o3nan}; limite ${(tl * 100).toFixed(3)}%`, '0; ≤ 0,5%', RP.o3nan === 0 && tl <= 0.005);
  }
}

// ------------------------------------------------------------------ E: as travas na simulação
// Estados de uma partida de verdade (semente 3102, a demo nos dois times até cada situação aparecer a 1ª vez: a bola no pé
// do adversário, no pé do meu time, num passe do meu time, num passe rasteiro deles, nas mãos do goleiro deles, uma parada,
// a bola livre, a bola alta deles, um cabeceio no ar do meu time). O humano é o time 0; o controlado vai para quem o caso pede
// (acoes.js assumirControle) e a entrada é a da pessoa (sem a marca `ia`).
const B = CFG.BOTAO;
const porId = (w, id) => w.jogadores.find(o => o.id === id) ?? null;
const ESTADOS = {};
{
  const mm = P.criarPartida({ semente: 3102, minutosPorTempo: 4 });
  const preds = {
    posse1: (w, jogo, d) => jogo && d && d.time === 1 && d.posicao !== 'GOL' && w.naMao == null,
    posse0: (w, jogo, d) => jogo && d && d.time === 0 && w.naMao == null,
    voo0: (w, jogo) => jogo && w.voo && w.voo.time === 0 && w.posse == null,
    passeRas1: (w, jogo) => jogo && w.voo && w.voo.time === 1 && w.posse == null && w.bola.rolando && w.voo.para != null,
    naMao1: (w, jogo) => jogo && w.naMao != null && porId(w, w.naMao).time === 1,
    parada: w => w.parada && !w.parada.rolou && w.partida.estado !== 'intervalo',
    livre: (w, jogo) => jogo && w.posse == null && w.voo == null && w.bola.rolando && w.naMao == null,
    alta1: (w, jogo) => jogo && w.voo && w.voo.time === 1 && w.posse == null && K.bolaAlta(w),
    cab0: (w, jogo) => jogo && w.jogadores.some(o => o.time === 0 && o.posicao !== 'GOL' && o.cab && o.cab.saiu && w.tick <= o.cab.tf),
  };
  for (let i = 0; i < 9000 && Object.keys(ESTADOS).length < Object.keys(preds).length; i++) {
    P.passoPartida(mm, P.entradaDemoPartida(mm));
    if (mm.tick < 600) continue;
    const jogo = mm.partida.estado === 'jogo' && !(mm.parada && !mm.parada.rolou) && mm.golTick == null;
    const d = mm.posse != null ? porId(mm, mm.posse) : null;
    for (const k in preds) if (!ESTADOS[k] && preds[k](mm, jogo, d)) ESTADOS[k] = SIM.copiarMundo(mm);
  }
  info('E estados de partida achados (semente 3102)', Object.keys(ESTADOS).map(k => `${k}@${ESTADOS[k].tick}`).join(' '), '9 situações');
}
/** O jogador de linha do time 0 mais perto de (x, z) (sem `fora`). */
function linhaPerto(w, x, z, fora = -1) {
  let mel = null, dm = Infinity;
  for (const o of w.jogadores) if (o.time === 0 && o.posicao !== 'GOL' && o.id !== fora) { const d = Math.hypot(o.x - x, o.z - z); if (d < dm) { dm = d; mel = o; } }
  return mel;
}
/** A entrada da pessoa: o analógico de j para (x, z) e os botões. */
function entPara(j, x, z, botoes = 0) {
  const dx = x - j.x, dz = z - j.z, l = Math.hypot(dx, dz) || 1;
  return { x: dx / l, z: dz / l, botoes };
}
const passo = (w, e) => P.passoPartida(w, e);
/** Um estado com o controlado em j (do time 0) e o carrinho apertado nele (o analógico para a bola). Devolve {w, j} ou null. */
function apertar(base, escolher, prep = null) {
  const w = SIM.copiarMundo(base);
  if (prep) prep(w);
  const j = escolher(w);
  if (!j || !AC.assumirControle(w, 0, j)) return null;
  passo(w, entPara(j, w.bola.p.x, w.bola.p.z, B.CARRINHO));
  return j.carrinho ? { w, j } : null;
}
const quadroEstado = j => ({ x: j.x, z: j.z, vx: j.vx, vz: j.vz, rumo: j.rumo, q: j.quadril, pes: j.pes.map(p => [p.apoio, p.x, p.z, p.tx, p.ty, p.tz]) });
const igualEstado = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// E1: durante o carrinho (desde o tick do aperto) os outros botões não fazem nada nele; não domina a bola; não recebe o
// controle pelo TROCAR; o boteIA dele não sai — e volta no passo seguinte ao fim (nenhum descansoBote sobrando)
{
  const base = ESTADOS.posse1;
  const ap = base && apertar(base, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
  if (!ap) reg('E1 o carrinho sai no estado com a bola no pé do adversário', 'não saiu', 'sai', false);
  else {
    // (a) os botões: a mesma trajetória com e sem PASSE/CHUTE/LANÇAMENTO/ENFIADA/DIVIDIDA/CONTER/PRESSÃO apertados
    const a = SIM.copiarMundo(ap.w), b = SIM.copiarMundo(ap.w);
    const ja = porId(a, ap.j.id), jb = porId(b, ap.j.id);
    const ciclo = [B.PASSE, 0, B.CHUTE, 0, B.LANCAMENTO, 0, B.ENFIADA, 0, B.DIVIDIDA, 0, B.CONTER, B.CONTER, 0, B.PRESSAO, B.PRESSAO, 0];
    let difs = 0, acoes = 0, passos = 0, divEv = 0;
    for (let i = 0; ja.carrinho && i < 400; i++) {
      passo(a, entPara(ja, a.bola.p.x, a.bola.p.z, 0));
      const ang = i * 0.7;
      passo(b, { x: Math.cos(ang), z: Math.sin(ang), botoes: ciclo[i % ciclo.length] });
      if (!ja.carrinho) break; // (o passo em que o plano sai já é da locomoção: lá as entradas diferentes valem)
      passos++;
      if (!igualEstado(quadroEstado(ja), quadroEstado(jb))) difs++;
      if (jb.carga || jb.pedido || jb.defH) acoes++;
      for (const e of b.eventos) if (e.tipo === 'dividida' && e.id === jb.id && !e.carrinho) divEv++; // (a do carrinho: o erro/acerto dele)
    }
    reg('E1 com PASSE/CHUTE/LANÇAMENTO/ENFIADA/DIVIDIDA/CONTER/PRESSÃO: o corpo é o mesmo', `${difs} de ${passos} passos diferentes; ação/DIVIDIDA nele ${acoes}/${divEv}`, '0; 0/0', difs === 0 && acoes === 0 && divEv === 0 && passos > 30);
    // (b) não domina: a bola parada colada no pé no tick do aperto e a bola rolando para ele no chão
    let dominou = 0, casos = 0, semCarrinho = 0;
    {
      const w = SIM.copiarMundo(base), w2 = SIM.copiarMundo(base);
      for (const x of [w, w2]) {
        const j = linhaPerto(x, x.bola.p.x, x.bola.p.z);
        AC.assumirControle(x, 0, j);
        x.posse = null; x.voo = null;
        const bb = x.bola;
        bb.p.x = j.x + Math.cos(j.rumo) * 0.35; bb.p.z = j.z + Math.sin(j.rumo) * 0.35; bb.p.y = CFG.BOLA.raio; bb.v.x = 0; bb.v.y = 0; bb.v.z = 0; bb.rolando = true;
      }
      const j = porId(w, linhaPerto(w, w.bola.p.x, w.bola.p.z).id), j2 = porId(w2, j.id);
      passo(w, entPara(j, w.bola.p.x, w.bola.p.z, B.CARRINHO)); casos++;
      if (!j.carrinho) casos = -999;
      for (let i = 0; i < 200 && (j.carrinho || i === 0); i++) { if (w.posse === j.id) { dominou++; break; } passo(w, entPara(j, 0, 0, 0)); }
      for (let i = 0; i < 30; i++) { passo(w2, entPara(j2, w2.bola.p.x, w2.bola.p.z, 0)); if (w2.posse === j2.id) { semCarrinho++; break; } }
    }
    {
      // no chão (depois da parada): a bola rolando para o corpo dele a 1 m/s
      const w = SIM.copiarMundo(ap.w), j = porId(w, ap.j.id);
      while (j.carrinho && w.tick < j.carrinho.tick0 + Math.ceil(j.carrinho.tS / PASSO) + 2) passo(w, entPara(j, 0, 0, 0));
      if (j.carrinho) {
        const bb = w.bola; w.posse = null; w.voo = null;
        bb.p.x = j.x + 0.6; bb.p.z = j.z; bb.p.y = CFG.BOLA.raio; bb.v.x = -1; bb.v.y = 0; bb.v.z = 0; bb.rolando = true;
        casos++;
        for (let i = 0; j.carrinho && i < 200; i++) { passo(w, entPara(j, 0, 0, 0)); if (w.posse === j.id) { dominou++; break; } }
      }
    }
    reg('E1 não domina a bola no carrinho (colada no pé no tick do aperto; rolando para ele no chão)', `${dominou} de ${casos}`, '0 de 2', dominou === 0 && casos === 2);
    info('E1 a mesma bola colada no pé, sem o carrinho', semCarrinho ? 'domina' : 'não domina em 0,5 s', 'mostra a trava');
    // (c) o controle: com o controle em outro, o TROCAR e o candidatoTroca nunca dão o deslizante; o boteIA dele não sai
    {
      const w = SIM.copiarMundo(ap.w), j = porId(w, ap.j.id);
      const k = linhaPerto(w, j.x, j.z, j.id);
      AC.assumirControle(w, 0, k);
      j.descansoBote = 30;
      let escolhido = 0, semGuarda = 0, trocouPara = 0, desc = 0, n = 0;
      for (let i = 0; j.carrinho && i < 400; i++) {
        const c = j.carrinho; j.carrinho = undefined;
        if (SIM.candidatoTroca(w, 0)?.id === j.id) semGuarda++;
        j.carrinho = c;
        if (SIM.candidatoTroca(w, 0)?.id === j.id) escolhido++;
        passo(w, { x: 0, z: 0, botoes: i % 4 === 0 ? B.TROCAR : 0 });
        if (w.controlado[0] === j.id) trocouPara++;
        if (j.carrinho && j.descansoBote !== 30) desc++;
        n++;
      }
      reg('E1 TROCAR e candidato à troca nunca dão o deslizante', `escolhido ${escolhido}, controle nele ${trocouPara} (de ${n} passos)`, '0; 0', escolhido === 0 && trocouPara === 0);
      info('E1 o candidatoTroca sem a guarda', `${semGuarda} de ${n} passos dariam o deslizante`, 'mostra a guarda');
      // (o laço sai no passo em que o plano acaba — o 1º com m.tick ≥ fim —: ali o boteIA já roda e desconta 1)
      reg('E1 boteIA parado no carrinho e de volta no passo que começa no fim', `descansoBote mudou ${desc}× no carrinho; 30 → ${j.descansoBote} no passo do fim`, '0×; 30 → 29',
        desc === 0 && j.descansoBote === 29);
    }
  }
}

// E2: o disparo bloqueado deixa o mundo IGUAL (bit a bit, 30 passos) ao mundo sem o aperto
{
  const casos = [];
  /** (w) → j (o controlado), opcional prep(w) nos dois mundos e a sequência de botões do aperto. */
  function bloqueio(nome, base, escolher, prep = null, seq = [B.CARRINHO]) {
    if (!base) { casos.push([nome, 'sem estado']); return; }
    const a = SIM.copiarMundo(base), b = SIM.copiarMundo(base);
    let jid = -1;
    for (const w of [a, b]) {
      if (prep) prep(w);
      const j = escolher(w);
      jid = j.id;
      if (w.controlado[0] !== j.id) AC.assumirControle(w, 0, j);
    }
    const ja = porId(a, jid), jb = porId(b, jid);
    let dif = 0, plano = 0;
    for (let i = 0; i < 30; i++) {
      const bot = seq[i] ?? 0;
      passo(a, entPara(ja, a.bola.p.x, a.bola.p.z, bot));
      passo(b, entPara(jb, b.bola.p.x, b.bola.p.z, bot & ~B.CARRINHO));
      if (SIM.hashMundo(a) !== SIM.hashMundo(b)) dif++;
      if (a.jogadores.some(o => o.carrinho)) plano++;
    }
    casos.push([nome, dif || plano ? `${dif} hashes diferentes, plano em ${plano}` : null]);
  }
  const doTime = (w, t) => w.jogadores.find(o => o.time === t && o.posicao === 'GOL');
  const pertoBola = w => linhaPerto(w, w.bola.p.x, w.bola.p.z, w.posse ?? -1);
  bloqueio('bola no pé de um companheiro', ESTADOS.posse0, w => pertoBola(w));
  bloqueio('bola no pé dele mesmo', ESTADOS.posse0, w => porId(w, w.posse));
  bloqueio('voo do próprio time', ESTADOS.voo0, w => linhaPerto(w, w.bola.p.x, w.bola.p.z, w.voo.de ?? -1));
  bloqueio('goleiro', ESTADOS.posse1, w => doTime(w, 0));
  bloqueio('parada não cobrada', ESTADOS.parada, w => pertoBola(w));
  bloqueio('tick do gol (m.golTick)', ESTADOS.posse1, w => pertoBola(w), w => { w.golTick = w.tick - 1; });
  bloqueio('bola nas mãos do goleiro', ESTADOS.naMao1, w => pertoBola(w));
  bloqueio('bola alta (no ar acima de 0,6 m)', ESTADOS.alta1, w => pertoBola(w));
  bloqueio('bola subindo (0,3 m)', ESTADOS.livre, w => pertoBola(w), w => { w.bola.p.y = 0.3; w.bola.v.y = 3; w.bola.rolando = false; });
  bloqueio('no ar (o pulo do cabeceio saído)', ESTADOS.cab0, w => w.jogadores.find(o => o.time === 0 && o.posicao !== 'GOL' && o.cab && o.cab.saiu));
  bloqueio('sem reação depois da DIVIDIDA', ESTADOS.posse1, w => pertoBola(w), w => { const j = pertoBola(w); j.defH = { bote: null, semReacaoAte: w.tick + 40, tick: w.tick - 1 }; });
  {
    // a DIVIDIDA em andamento: o defensor a 0,8 m do condutor aperta a DIVIDIDA e, no passo seguinte, o CARRINHO
    const prepD = w => { const d = porId(w, w.posse), j = linhaPerto(w, d.x, d.z); P.teleportar(j, d.x - 0.8, d.z, 0); };
    bloqueio('DIVIDIDA em andamento', ESTADOS.posse1, w => linhaPerto(w, porId(w, w.posse).x, porId(w, w.posse).z), prepD, [B.DIVIDIDA, B.CARRINHO]);
  }
  {
    // já no carrinho: soltar e apertar de novo no meio dele não monta outro plano
    const ap = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
    if (ap) {
      const c0 = ap.j.carrinho;
      for (let i = 0; i < 20; i++) passo(ap.w, entPara(ap.j, 0, 0, i % 2 ? B.CARRINHO : 0));
      casos.push(['já no carrinho (apertos de novo)', ap.j.carrinho === c0 && c0.tick0 === ap.j.carrinho.tick0 ? null : 'outro plano']);
    } else casos.push(['já no carrinho (apertos de novo)', 'o 1º não saiu']);
  }
  {
    // o treino (sem m.times): o bit cru não faz nada
    const mk = () => SIM.criarMundo({ semente: 5, jogadores: [{ id: 1, x: 0, z: 0, rumo: 0 }, { id: 2, x: 3, z: 0, rumo: Math.PI, time: 1, papel: 'marcador' }], bola: { x: 2.5, z: 0 } });
    const a = mk(), b = mk();
    let dif = 0;
    for (let i = 0; i < 60; i++) { SIM.passo(a, { 0: { x: 1, z: 0, botoes: i === 3 ? B.CARRINHO : 0 } }); SIM.passo(b, { 0: { x: 1, z: 0, botoes: 0 } }); if (SIM.hashMundo(a) !== SIM.hashMundo(b)) dif++; }
    casos.push(['treino (sem m.times)', dif || a.jogadores.some(o => o.carrinho) ? `${dif} hashes diferentes` : null]);
  }
  {
    // a disputa de pênaltis: o bit cru junto da entrada da demo, o tempo todo
    const D = await imp('disputa.js');
    const md = D.criarDisputa({ semente: 7 });
    let plano = 0;
    for (let i = 0; i < 1500; i++) { const e = D.entradaDemoDisputa(md); D.passoDisputa(md, { ...e, botoes: (e.botoes | 0) | (i % 2 ? B.CARRINHO : 0) }); if (md.jogadores.some(o => o.carrinho)) plano++; }
    casos.push(['disputa de pênaltis', plano ? `plano em ${plano} passos` : null]);
  }
  const ruins = casos.filter(c => c[1]);
  reg('E2 disparo bloqueado: o mundo bit a bit igual ao sem o aperto (30 passos)', `${casos.length - ruins.length}/${casos.length}${ruins.length ? ': ' + ruins.map(c => `${c[0]} (${c[1]})`).join('; ') : ''}`,
    'todos', ruins.length === 0 && casos.length >= 15);
  if (DETALHE) console.log('E2 casos: ' + casos.map(c => c[0]).join(' | '));
}

// E3: a borda — segurar não repete; o botão segurado na troca de controle não dispara no novo; o aperto novo depois do fim
// dispara. E4: o TROCAR no meio não muda nada no carrinho (a trajetória e o fim bit a bit iguais)
{
  const ap = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
  if (!ap) reg('E3 o carrinho sai', 'não saiu', 'sai', false);
  else {
    const { j } = ap;
    // segurado o tempo todo (e 60 passos depois do fim): um carrinho só
    const w1 = SIM.copiarMundo(ap.w), j1 = porId(w1, j.id);
    let inicios = 0;
    for (let i = 0; i < 260; i++) { passo(w1, entPara(j1, 0, 0, B.CARRINHO)); for (const e of w1.eventos) if (e.tipo === 'carrinho' && e.fase === 'inicio') inicios++; }
    // segurado + TROCAR no meio: o novo controlado não dispara
    const w2 = SIM.copiarMundo(ap.w), j2 = porId(w2, j.id);
    let novo = 0, trocou = -1;
    for (let i = 0; i < 80; i++) {
      passo(w2, { x: 0, z: 0, botoes: B.CARRINHO | (i === 10 ? B.TROCAR : 0) });
      if (i >= 10 && w2.controlado[0] !== j2.id) { trocou = w2.controlado[0]; if (porId(w2, trocou)?.carrinho) novo++; }
    }
    // solto e apertado de novo depois do fim: outro carrinho
    const w3 = SIM.copiarMundo(ap.w), j3 = porId(w3, j.id);
    while (j3.carrinho) passo(w3, entPara(j3, 0, 0, 0));
    passo(w3, entPara(j3, w3.bola.p.x, w3.bola.p.z, 0));
    const pode = !(w3.parada && !w3.parada.rolou) && !K.bolaAlta(w3) && w3.partida.estado === 'jogo';
    passo(w3, entPara(j3, w3.bola.p.x, w3.bola.p.z, B.CARRINHO));
    reg('E3 segurar não repete; o segurado na troca não dispara no novo; o aperto novo depois do fim dispara',
      `inícios ${inicios}; no novo controlado ${novo} (trocou: ${trocou >= 0}); de novo ${j3.carrinho ? 'sim' : 'não'}${pode ? '' : ' (bola morta/alta no 2º aperto)'}`,
      '0 (além do do aperto); 0; sim', inicios === 0 && novo === 0 && trocou >= 0 && (!!j3.carrinho || !pode));
    // E4: TROCAR no 20º passo do carrinho × sem TROCAR
    const a = SIM.copiarMundo(ap.w), b = SIM.copiarMundo(ap.w), ja = porId(a, j.id), jb = porId(b, j.id);
    const fimA = ja.carrinho.fim;
    let difs = 0, n = 0, trocouB = false;
    for (let i = 0; ja.carrinho && i < 400; i++) {
      passo(a, { x: 0, z: 0, botoes: 0 });
      passo(b, { x: 0, z: 0, botoes: i === 20 ? B.TROCAR : 0 });
      if (b.controlado[0] !== jb.id) trocouB = true;
      if (!ja.carrinho) break; // (o passo em que o plano sai já é da locomoção)
      if (!igualEstado(quadroEstado(ja), quadroEstado(jb)) || (jb.carrinho && jb.carrinho.fim !== fimA)) difs++;
      n++;
    }
    reg('E4 TROCAR no meio: a trajetória do carrinho (corpo, pés, quadril, fim) bit a bit a mesma', `${difs} de ${n} passos diferentes (trocou: ${trocouB})`, '0', difs === 0 && trocouB && n > 30);
  }
}
// (o "inícios" do E3 conta os eventos depois do aperto: o do aperto ficou no passo do apertar)

// E5: vale parado, com a bola livre e num passe rasteiro do adversário (o corte do passe pela perna: B6)
{
  const r = [];
  const parado = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse), j = linhaPerto(w, d.x, d.z); j.vx = 0; j.vz = 0; return j; });
  r.push(['parado', !!parado && Math.abs(parado.j.carrinho.ve - CC.vMin * parado.j.carrinho.esc) < 1e-12]);
  r.push(['bola livre', !!(ESTADOS.livre && apertar(ESTADOS.livre, w => linhaPerto(w, w.bola.p.x, w.bola.p.z)))]);
  r.push(['passe rasteiro do adversário', !!(ESTADOS.passeRas1 && apertar(ESTADOS.passeRas1, w => linhaPerto(w, w.bola.p.x, w.bola.p.z)))]);
  reg('E5 o carrinho sai parado (impulso vMin), com a bola livre e no passe rasteiro deles', r.map(([n, ok]) => `${n} ${ok ? 'sim' : 'NÃO'}`).join('; '), 'os três', r.every(x => x[1]));
  // na simulação, a perna corta o passe rasteiro deles: o passe de um adversário cruzando a canela da perna da bola no
  // deslize (0,15 s à frente) — evento roubada {carrinho, de: 'passe'} e o passe acaba
  if (typeof (await imp('defesa.js')).contatosCarrinho === 'function') {
    const ap = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
    let ok = false, txt = 'o carrinho não saiu';
    if (ap) {
      const { w, j } = ap;
      for (let i = 0; i < 25; i++) passo(w, entPara(j, 0, 0, 0));
      const c = j.carrinho, tc = (w.tick - c.tick0) * PASSO + 0.15;
      const q = K.quadroCarrinho(c, tc, K.novoQuadroCarrinho()), k = c.frente;
      const M = { x: (q.jo[k].x + q.to[k].x) / 2, z: (q.jo[k].z + q.to[k].z) / 2 };
      let px = -(q.to[k].z - q.jo[k].z), pz = q.to[k].x - q.jo[k].x; const pl = Math.hypot(px, pz); px /= pl; pz /= pl;
      const de = w.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL');
      w.posse = null; w.naMao = null;
      w.voo = { tipo: 'passe', de: de.id, time: 1, para: null, alvo: { x: M.x + px * 10, z: M.z + pz * 10 }, tick0: w.tick, tickChave: w.tick, tickChegada: w.tick + 60, alto: false };
      w.ultimoToque = { id: de.id, time: 1, tick: w.tick };
      w.bola.p.x = M.x - px * 10 * 0.15; w.bola.p.z = M.z - pz * 10 * 0.15; BL.chutarRasteiro(w.bola, px * 10, pz * 10);
      let ev = null;
      for (let i = 0; i < 30 && !ev; i++) { passo(w, entPara(j, 0, 0, 0)); ev = w.eventos.find(e => e.id === j.id && e.carrinho); }
      ok = !!ev && ev.tipo === 'roubada' && ev.de === 'passe' && w.voo === null;
      txt = ev ? `${ev.tipo} {de: ${ev.de}}, voo ${w.voo ? 'segue' : 'acabou'}` : 'não tocou';
    }
    reg('E5 na simulação a perna corta o passe rasteiro deles', txt, 'roubada {carrinho, de: passe}; o passe acaba', ok);
  }
}

// E7: o cabeceio planejado — o aperto zera o pulo ainda no chão, o toque 'aereo' e a disputa pelo alto marcada (senão o
// alguemNoAlto, o agendarDisputa e a trocaAerea o contariam como quem vai cabecear)
{
  const ap = ESTADOS.livre && apertar(ESTADOS.livre, w => linhaPerto(w, w.bola.p.x, w.bola.p.z), w => {
    const j = linhaPerto(w, w.bola.p.x, w.bola.p.z), t = w.tick;
    w.bola.p.y = 0.3; w.bola.v.y = -1; w.bola.rolando = false; // a bola baixa, descendo (o carrinho sai)
    j.cab = { saiu: false, h: 0.3, td: t + 20, tc: t + 30, tp: t + 40, tf: t + 50, cabeceio: true, bx: j.x + 2, by: 2, bz: j.z, cx: j.x + 1.8, cz: j.z };
    j.cond.toque = { tick: t + 30, pe: 1, bx: j.x + 2, bz: j.z, tipo: 'aereo', y: 2 };
    j.disputaAlta = { contra: -1, tc: t + 30 };
  });
  reg('E7 o aperto zera o pulo no chão, o toque aéreo e a disputa pelo alto', ap ? `cab ${ap.j.cab}, toque ${ap.j.cond.toque}, disputa ${ap.j.disputaAlta}` : 'o carrinho não saiu',
    'null, null, null', !!ap && ap.j.cab === null && ap.j.cond.toque === null && ap.j.disputaAlta === null);
}

// E8: a IA — o deslizante (o controle em outro) não é escolhido pelo 1º/2º homem, pela marcação, pela bola livre, pelo chamado
// da PRESSÃO nem como alvo de passe; na forma (a referência do bloco) continua contando
{
  const IAt = await imp('ia-tatica.js'), IA = await imp('ia.js'), DF = await imp('defesa.js');
  const ap = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
  if (!ap) reg('E8 o carrinho sai', 'não saiu', 'sai', false);
  else {
    const w = ap.w, j = ap.j, k = linhaPerto(w, j.x, j.z, j.id);
    AC.assumirControle(w, 0, k);
    const st = { n: 0, p12: 0, p12sem: 0, marca: 0, marcaSem: 0, livre: 0, livreSem: 0, press: 0, pressSem: 0, alvo: 0, alvoSem: 0, forma: 0 };
    /** f(copia) na cópia com o plano e na cópia sem ele (o "sem a guarda"). */
    const dois = f => { const c1 = SIM.copiarMundo(w), c2 = SIM.copiarMundo(w); porId(c2, j.id).carrinho = undefined; return [f(c1), f(c2)]; };
    for (let i = 0; j.carrinho && i < 400; i++) {
      st.n++;
      const [b1, b2] = dois(c => { const B2 = IAt.blocoDoTime(c, 0); return { p: [B2.p1, B2.p2], ref: Array.from(B2.ref) }; });
      if (b1.p.includes(j.id)) st.p12++;
      if (b2.p.includes(j.id)) st.p12sem++;
      if (JSON.stringify(b1.ref) !== JSON.stringify(b2.ref)) st.forma++;
      const mg = c => -c.ataca[1] * CFG.CAMPO.meioX;
      const [m1, m2] = dois(c => { const a0 = IA.marcacao(c, 0, null, -c.ataca[0] * CFG.CAMPO.meioX), a1 = IA.marcacao(c, 1, null, mg(c)); return a0.alvo.has(j.id) || [...a1.alvo.values()].some(o => o.id === j.id); });
      if (m1) st.marca++;
      if (m2) st.marcaSem++;
      // a bola livre aos pés dele: ele não vai; o companheiro mais perto vai
      const [l1, l2] = dois(c => { const jj = porId(c, j.id); c.posse = null; c.voo = null; c.bola.p.x = jj.x + 0.3; c.bola.p.z = jj.z; return IA.vaiNaBolaLivre(c, jj); });
      if (l1) st.livre++;
      if (l2) st.livreSem++;
      // o chamado da PRESSÃO (o controlado é o k)
      const [q1, q2] = dois(c => DF.pressionadorDe(c, 0) === j.id);
      if (q1) st.press++;
      if (q2) st.pressSem++;
      // o alvo de passe do companheiro k com a bola e o analógico para o deslizante
      const [a1, a2] = dois(c => {
        const kk = porId(c, k.id), jj = porId(c, j.id);
        c.posse = kk.id; c.voo = null; c.naMao = null; c.bola.p.x = kk.x + 0.3; c.bola.p.z = kk.z;
        const dx = jj.x - kk.x, dz = jj.z - kk.z, l = Math.hypot(dx, dz) || 1;
        kk.imag = 1; kk.imx = dx / l; kk.imz = dz / l; kk.miraAuto = null;
        return AC.escolherAlvo(c, kk, 'passe')?.id === j.id;
      });
      if (a1) st.alvo++;
      if (a2) st.alvoSem++;
      passo(w, { x: 0, z: 0, botoes: B.PRESSAO });
    }
    reg('E8 a IA não escolhe o deslizante (1º/2º homem, marcação, bola livre, PRESSÃO, alvo de passe)',
      `${st.p12}, ${st.marca}, ${st.livre}, ${st.press}, ${st.alvo} de ${st.n} passos`, '0 em todos', st.p12 + st.marca + st.livre + st.press + st.alvo === 0 && st.n > 30);
    info('E8 sem a guarda (o mesmo estado sem o plano)', `${st.p12sem}, ${st.marcaSem}, ${st.livreSem}, ${st.pressSem}, ${st.alvoSem}`, 'mostra cada guarda');
    reg('E8 na forma ele continua contando (a referência do bloco igual com e sem o plano)', `${st.forma} de ${st.n} diferentes`, '0', st.forma === 0);
  }
}

// ------------------------------------------------------------------ B: o contato da perna desenhada com a bola
// O contato do passo (defesa.js contatosCarrinho) num mundo MÍNIMO (o que ele lê: a partida em jogo, a bola, a posse, o voo
// e os jogadores) e na ordem do sim.js passo 5 (passoBola e logo o contato). O árbitro é INDEPENDENTE: a trajetória livre da
// bola (passoBola numa cópia, sem contato), amostrada 32 vezes por passo em linha, contra as 6 cápsulas do quadro no MESMO
// instante (a distância ponto–segmento escrita aqui), com o mínimo refinado (busca ternária) — a janela do contato: do aperto
// até o fim do trecho que contém a parada (0 < t ≤ tS; depois dela o quadro das pernas fica parado), com o centro da bola
// a ≤ altoBola. Folga das metas: 0,5 cm + o que a perna anda em meio trecho (|v perna|·PASSO/8: a perna da conta é a do FIM
// do trecho; com o trecho inteiro, PASSO/4, o resultado é o mesmo).
const DF = await imp('defesa.js');
const SU = await imp('sumula.js');
const AG = await imp('render/autor-gol.js');
const IM = await imp('impedimento.js');
const RB = CFG.BOLA.raio, SUBP = CC.subpassos, TR = PASSO / SUBP;
const RAIO_SEG = [Math.max(...R_COXA), Math.max(...R_CANELA), Math.max(...R_PE)];
const TEM_CONTATO = typeof DF.contatosCarrinho === 'function';
/** O mundo mínimo do contato (o que contatosCarrinho e os eventos dele leem). */
function mundoContato(js, bola) {
  return {
    tick: 0, partida: { estado: 'jogo' }, parada: null, golTick: null, naMao: null, posse: null, voo: null, eventos: [],
    stats: { roubadas: 0 }, jogadores: js, bola, ultimoToque: null, desvio: null,
  };
}
/** Um passo da bola no mundo mínimo (sim.js passo 5): passoBola e o contato. */
function passoContato(w) {
  w.eventos.length = 0;
  const b = w.bola, x0 = b.p.x, y0 = b.p.y, z0 = b.p.z;
  BL.passoBola(b, w.eventos);
  const t = DF.contatosCarrinho(w, x0, y0, z0);
  w.tick++;
  return t;
}
/** A distância do ponto p ao segmento a→b (do árbitro: independente do carrinho.js). */
function dPS(px, py, pz, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz;
  let t = l2 > 0 ? ((px - a.x) * dx + (py - a.y) * dy + (pz - a.z) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(a.x + dx * t - px, a.y + dy * t - py, a.z + dz * t - pz);
}
const segsQ = q => [[q.qd[0], q.jo[0], 0], [q.jo[0], q.to[0], 1], [q.to[0], q.po[0], 2], [q.qd[1], q.jo[1], 0], [q.jo[1], q.to[1], 1], [q.to[1], q.po[1], 2]];
const _qArb = K.novoQuadroCarrinho(), _qArb2 = K.novoQuadroCarrinho();
/** A folga (distância − raio da cápsula − raio da bola) da bola p às pernas do quadro em t (a menor das 6). */
function folgaEm(c, t, px, py, pz) {
  K.quadroCarrinho(c, t, _qArb);
  let g = Infinity;
  for (const [a, b, i] of segsQ(_qArb)) g = Math.min(g, dPS(px, py, pz, a, b) - RAIO_SEG[i] - RB);
  return g;
}
/** A maior velocidade das juntas das pernas no quadro em t (m/s; diferença em 1 ms). */
function vPernaEm(c, t) {
  K.quadroCarrinho(c, Math.max(0, t - 1e-3), _qArb2);
  K.quadroCarrinho(c, t, _qArb);
  let v = 0;
  for (const nome of ['qd', 'jo', 'to', 'po']) for (let k = 0; k < 2; k++) v = Math.max(v, dist3(_qArb[nome][k], _qArb2[nome][k]) / 1e-3);
  return v;
}
/** O árbitro: na trajetória livre da bola, a menor folga com a bola a ≤ altoBola (baixa), a menor ignorando a altura (toda) e
 * a velocidade da perna no instante da menor baixa. */
function arbitro(c, bola0) {
  const tFim = Math.ceil(c.tS / TR - 1e-9) * TR;
  const nT = Math.ceil(tFim / PASSO) + 1;
  const b = BL.copiarBola(bola0), pos = [{ x: b.p.x, y: b.p.y, z: b.p.z }];
  for (let n = 0; n < nT; n++) { BL.passoBola(b, []); pos.push({ x: b.p.x, y: b.p.y, z: b.p.z }); }
  const bolaEm = t => { const n = Math.min(nT - 1, Math.floor(t / PASSO)), f = t / PASSO - n, a = pos[n], e = pos[n + 1]; return [a.x + (e.x - a.x) * f, a.y + (e.y - a.y) * f, a.z + (e.z - a.z) * f]; };
  const NS = 32;
  let gB = Infinity, tB = -1, gT = Infinity, tT = -1;
  const corpo = K.novoQuadroCarrinho();
  for (let n = 0; n < nT; n++) {
    for (let k = 1; k <= NS; k++) {
      const t = (n + k / NS) * PASSO;
      if (t > tFim + 1e-12) break;
      const [x, y, z] = bolaEm(t);
      K.quadroCarrinho(c, t, corpo);
      if (Math.hypot(x - corpo.x, z - corpo.z) > 2.6) continue; // (as pernas alcançam ~1,6 m do centro)
      const g = folgaEm(c, t, x, y, z);
      if (g < gT) { gT = g; tT = t; }
      if (y <= CC.altoBola && g < gB) { gB = g; tB = t; }
    }
  }
  // o mínimo refinado (busca ternária em ± uma amostra)
  const refina = (t0, alto) => {
    let lo = Math.max(1e-9, t0 - PASSO / NS), hi = Math.min(tFim, t0 + PASSO / NS);
    const f = t => { const [x, y, z] = bolaEm(t); return alto || y <= CC.altoBola ? folgaEm(c, t, x, y, z) : Infinity; };
    for (let it = 0; it < 30; it++) { const a = lo + (hi - lo) / 3, d = hi - (hi - lo) / 3; if (f(a) < f(d)) hi = d; else lo = a; }
    return Math.min(f((lo + hi) / 2), f(t0));
  };
  if (tB >= 0) gB = refina(tB, false);
  if (tT >= 0) gT = refina(tT, true);
  return { gB, gT, vp: tB >= 0 ? vPernaEm(c, tB) : tT >= 0 ? vPernaEm(c, tT) : 0 };
}
/** Roda o contato do aperto (tick 0) até o fim do trecho da parada: o tick do toque (c.bola) ou −1, e a bola logo depois. */
function rodarContato(c, bola, jogs = []) {
  const jc = { id: 500, time: 0, carrinho: c };
  const w = mundoContato([jc, ...jogs], bola);
  const nT = Math.ceil(c.tS / PASSO) + 2;
  let pos = null;
  for (let n = 0; n < nT && c.bola < 0; n++) {
    passoContato(w);
    if (c.bola >= 0) pos = { x: bola.p.x, y: bola.p.y, z: bola.p.z, vx: bola.v.x, vy: bola.v.y, vz: bola.v.z, ev: w.eventos.slice() };
  }
  return { tick: c.bola, pos, w };
}
let rnd = (() => { let s = 777; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
const PLANOS_B = [
  { v: 0, desv: 0 }, { v: 3, desv: 0 }, { v: 4.75, desv: 0 }, { v: 7, desv: 0 }, { v: 6, desv: 45 }, { v: 4, desv: -67.5 },
].map((e, i) => {
  const j = jogadorSint({ v: e.v, angV: 0.3, analog: 0.3 + e.desv * GRAU, x: 0, z: 0 });
  // (a bola de um lado ou do outro decide a perna da bola: metade dos planos com cada)
  const bola = { x: Math.cos(0.3 + (i % 2 ? 1 : -1)) * 2, z: Math.sin(0.3 + (i % 2 ? 1 : -1)) * 2 };
  return K.montarCarrinho(j, 0, { bola, prever: null });
});
const novoPlano = i => structuredClone(PLANOS_B[i % PLANOS_B.length]);
if (!TEM_CONTATO) reg('B o contato da perna com a bola (defesa.js contatosCarrinho)', 'não existe nesta lógica', 'contatosCarrinho', false);
else {
  // ---- B1/B2/B3: o canhão geométrico (240 posições pela trajetória das pernas × parada e rolando a 2, 8 e 20 m/s, + 120 no ar)
  const st = { n: 0, dentro: 0, dentroOk: 0, fora: 0, foraOk: 0, alta: 0, altaOk: 0, amb: 0, ex1: [], ex2: [], b3: 0, b3ok: 0, b3ex: [], rasp: 0, b3faixa: [Infinity, 0], b3des: 0, b3tr: 0 };
  const casoB = (c, bola) => {
    const ar = arbitro(c, bola);
    const marg = 0.005 + ar.vp * TR / 2;
    const b0 = BL.copiarBola(bola);
    const r = rodarContato(c, bola);
    const tocou = r.tick >= 0;
    st.n++;
    if (ar.gB < -marg) { st.dentro++; if (tocou) st.dentroOk++; else if (st.ex1.length < 3) st.ex1.push(`folga ${f3(ar.gB)} m (perna ${f2(ar.vp)} m/s)`); }
    else if (ar.gB > marg && ar.gT > marg) { st.fora++; if (!tocou) st.foraOk++; else if (st.ex2.length < 3) st.ex2.push(`folga ${f3(ar.gB)} m, tocou no tick ${r.tick}`); }
    else if (ar.gT < -marg && ar.gB > marg) { st.alta++; if (!tocou) st.altaOk++; else if (st.ex2.length < 3) st.ex2.push(`alta: folga baixa ${f3(ar.gB)} m, tocou`); }
    else st.amb++;
    // B3: a bola parada, contato frontal (n·u ≥ 0,866) — a saída entre 0,8·|vc| e 1,3·(|vc| + 2) m/s, para a frente
    if (tocou && Math.hypot(b0.v.x, b0.v.y, b0.v.z) === 0 && r.pos) {
      // o trecho e a cápsula do toque: a bola ficou na superfície da perna do fim daquele trecho (a menor |folga|)
      const t0 = r.tick * PASSO;
      let mel = null;
      for (let s = 1; s <= SUBP; s++) {
        const q = K.quadroCarrinho(c, t0 + s * TR, K.novoQuadroCarrinho());
        for (const [a, b, i] of segsQ(q)) {
          const d = dPS(r.pos.x, r.pos.y, r.pos.z, a, b) - RAIO_SEG[i] - RB;
          if (Math.abs(d) < 2e-3 && (!mel || Math.abs(d) < Math.abs(mel.d))) mel = { d, a, b, q, t: t0 + s * TR };
        }
      }
      if (mel) {
        const { a, b, q } = mel;
        const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz;
        const tt = Math.max(0, Math.min(1, ((r.pos.x - a.x) * dx + (r.pos.y - a.y) * dy + (r.pos.z - a.z) * dz) / l2));
        const nx = r.pos.x - (a.x + dx * tt), ny = r.pos.y - (a.y + dy * tt), nz = r.pos.z - (a.z + dz * tt), nl = Math.hypot(nx, ny, nz);
        const nu = (nx * c.ux + nz * c.uz) / nl;
        const vc = Math.hypot(q.vx, q.vz), vb = Math.hypot(r.pos.vx, r.pos.vz), vu = r.pos.vx * c.ux + r.pos.vz * c.uz;
        if (nu >= 0.866) {
          // no deslize a perna anda com o corpo: 0,8·|vc|; na transição o pé desenhado ainda sai do chão (atrás do corpo) e a
          // perna da conta fica a até vPernaRel do corpo: 0,8·(|vc| − vPernaRel)⁺
          const desl = mel.t >= T_D;
          st.b3++; if (desl) st.b3des++; else st.b3tr++;
          const piso = 0.8 * (desl ? vc : Math.max(0, vc - CC.vPernaRel));
          const ok = vb >= piso - 1e-9 && vb <= 1.3 * (vc + 2) + 1e-9 && vu >= -1e-9;
          if (ok) st.b3ok++; else if (st.b3ex.length < 3) st.b3ex.push(`|vc| ${f2(vc)}, saiu a ${f2(vb)} m/s, em u ${f2(vu)}`);
          if (vc > 0.5) { st.b3faixa[0] = Math.min(st.b3faixa[0], vb / vc); st.b3faixa[1] = Math.max(st.b3faixa[1], vb / vc); }
        } else st.rasp++;
      }
    }
  };
  for (let n = 0; n < 240; n++) {
    for (const vel of [0, 2, 8, 20]) {
      const c = novoPlano(n);
      const tS = c.tS, ts = 0.02 + rnd() * (tS - 0.02);
      const q = K.quadroCarrinho(c, ts, K.novoQuadroCarrinho());
      const [a, b, i] = segsQ(q)[Math.floor(rnd() * 6)];
      const wq = rnd();
      const Q = { x: a.x + (b.x - a.x) * wq, y: a.y + (b.y - a.y) * wq, z: a.z + (b.z - a.z) * wq };
      const Rr = RAIO_SEG[i] + RB + (rnd() * 2 - 1) * 0.05;
      const dy = RB - Q.y, dh = Math.sqrt(Math.max(0, Rr * Rr - dy * dy));
      const fi = rnd() * 2 * Math.PI, psi = rnd() * 2 * Math.PI;
      const tx = Q.x + Math.cos(fi) * dh, tz = Q.z + Math.sin(fi) * dh;
      const bola = BL.criarBola(tx - Math.cos(psi) * vel * ts, tz - Math.sin(psi) * vel * ts);
      if (vel > 0) BL.chutarRasteiro(bola, Math.cos(psi) * vel, Math.sin(psi) * vel);
      casoB(c, bola);
    }
  }
  for (let n = 0; n < 120; n++) {
    // no ar: perto do caminho do corpo (à frente até 3 m, ±1,2 m de lado), 0,15–1,0 m de altura, descendo ou subindo devagar
    const c = novoPlano(n);
    const f = rnd() * 3, l = (rnd() * 2 - 1) * 1.2, y = 0.15 + rnd() * 0.85, vh = rnd() * 6, ang = rnd() * 2 * Math.PI;
    const bola = BL.criarBola(c.x0 + c.ux * f - c.uz * l, c.z0 + c.uz * f + c.ux * l);
    bola.p.y = y; bola.rolando = false;
    BL.chutar(bola, { x: Math.cos(ang) * vh, y: -2 + rnd() * 3, z: Math.sin(ang) * vh }, { x: 0, y: 0, z: 0 });
    casoB(c, bola);
  }
  for (let n = 0; n < 80; n++) {
    // ALTA: a bola subindo (3–5 m/s) passa pela coxa perto do quadril no começo da queda, com o centro acima de 0,6 m
    const c = novoPlano(n);
    const ts = 0.02 + rnd() * 0.12;
    const q = K.quadroCarrinho(c, ts, K.novoQuadroCarrinho());
    const k = rnd() < 0.5 ? 0 : 1, wq = rnd() * 0.4, a = q.qd[k], b = q.jo[k];
    const Q = { x: a.x + (b.x - a.x) * wq, y: a.y + (b.y - a.y) * wq, z: a.z + (b.z - a.z) * wq };
    if (Q.y < 0.68) continue;
    const fi = rnd() * 2 * Math.PI, d = RAIO_SEG[0] + RB - rnd() * 0.05, vy = 3 + rnd() * 2, vh = rnd() * 2, psi = rnd() * 2 * Math.PI;
    const tx = Q.x + Math.cos(fi) * d, tz = Q.z + Math.sin(fi) * d;
    const bola = BL.criarBola(tx - Math.cos(psi) * vh * ts, tz - Math.sin(psi) * vh * ts);
    bola.rolando = false; bola.p.y = Q.y - (vy * ts - 0.5 * CFG.G * ts * ts);
    BL.chutar(bola, { x: Math.cos(psi) * vh, y: vy, z: Math.sin(psi) * vh }, { x: 0, y: 0, z: 0 });
    casoB(c, bola);
  }
  info('B canhão: casos (dentro / fora / alta / ambíguos na folga)', `${st.n}: ${st.dentro} / ${st.fora} / ${st.alta} / ${st.amb}`, '240 posições × 4 velocidades + 120 no ar + 80 altos');
  reg('B1 a bola dentro da cápsula varrida (≤ 0,6 m) é tocada', `${st.dentroOk}/${st.dentro}${st.ex1.length ? ': ' + st.ex1.join('; ') : ''}`, '100%', st.dentro > 200 && st.dentroOk === st.dentro);
  reg('B2 a bola fora da cápsula (+ folga) nunca é tocada', `${st.fora - st.foraOk} de ${st.fora}${st.ex2.length ? ': ' + st.ex2.join('; ') : ''}`, '0', st.fora > 200 && st.foraOk === st.fora);
  reg('B2 a bola com o centro acima de 0,6 m nunca é tocada', `${st.alta - st.altaOk} de ${st.alta}`, '0', st.alta > 5 && st.altaOk === st.alta);
  reg('B3 bola parada, contato frontal: sai entre 0,8·|vc| (transição: 0,8·(|vc| − 2)) e 1,3·(|vc| + 2), para a frente',
    `${st.b3ok}/${st.b3} (deslize ${st.b3des}, transição ${st.b3tr}; saída/|vc| ${f2(st.b3faixa[0])}–${f2(st.b3faixa[1])})${st.b3ex.length ? ': ' + st.b3ex.join('; ') : ''}`,
    'todos (≥ 10 no deslize)', st.b3des >= 10 && st.b3ok === st.b3);
  info('B3 bola parada, contato de raspão (n·u < 0,866)', `${st.rasp} casos`, 'sem faixa (a perna anda ao longo do eixo)');
  // B3: o chute a 20 e 30 m/s na canela da perna da bola, no deslize, não atravessa
  {
    const r = [];
    for (const vel of [20, 30]) for (const lado of [1, -1]) {
      const c = novoPlano(2);
      const ts = T_D + 0.25;
      const q = K.quadroCarrinho(c, ts, K.novoQuadroCarrinho());
      const k = c.frente, a = q.jo[k], b = q.to[k];
      const M = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
      // perpendicular à canela no chão, chegando no meio dela em ts
      let px = -(b.z - a.z), pz = b.x - a.x; const pl = Math.hypot(px, pz); px = px / pl * lado; pz = pz / pl * lado;
      const bola = BL.criarBola(M.x - px * vel * ts, M.z - pz * vel * ts);
      BL.chutarRasteiro(bola, px * vel, pz * vel);
      const ida = rodarContato(c, bola);
      for (let n = 0; n < 12; n++) BL.passoBola(bola, []);
      const qf = K.quadroCarrinho(c, Math.min(c.tS, (ida.tick + 13) * PASSO), K.novoQuadroCarrinho());
      const Mf = { x: (qf.jo[k].x + qf.to[k].x) / 2, z: (qf.jo[k].z + qf.to[k].z) / 2 };
      const lado1 = (bola.p.x - Mf.x) * px + (bola.p.z - Mf.z) * pz;
      r.push([`${vel} m/s ${lado > 0 ? '+' : '−'}`, ida.tick >= 0 && lado1 < 0]);
    }
    reg('B3 o chute a 20 e 30 m/s na canela (deslize) não atravessa', r.map(([n, ok]) => `${n} ${ok ? 'ok' : 'ATRAVESSOU/não tocou'}`).join('; '), 'todos voltam', r.every(x => x[1]));
  }
  // ---- B2: a bola do próprio time (no pé de um companheiro ou num voo dele) a perna atravessa: nenhum toque
  {
    const r = [];
    for (const caso of ['pé de um companheiro', 'voo do meu time', 'voo deles (o controle)']) {
      const c = novoPlano(2);
      const q = K.quadroCarrinho(c, 0.5, K.novoQuadroCarrinho());
      const bola = BL.criarBola(q.po[c.frente].x + c.ux * 0.02, q.po[c.frente].z + c.uz * 0.02);
      const comp = { id: 501, time: caso === 'voo deles (o controle)' ? 1 : 0, vx: 0, vz: 0, cond: { toque: null } };
      const w = mundoContato([{ id: 500, time: 0, carrinho: c }, comp], bola);
      if (caso === 'pé de um companheiro') w.posse = 501;
      else w.voo = { tipo: 'passe', de: 501, time: comp.time, para: null, alvo: { x: 0, z: 0 }, tick0: 0, tickChave: 0, tickChegada: 30, alto: false };
      for (let n = 0; n < 80 && c.bola < 0 && w.tick * PASSO < c.tS; n++) passoContato(w);
      r.push([caso, caso === 'voo deles (o controle)' ? c.bola >= 0 : c.bola < 0]);
    }
    reg('B2 a bola do próprio time (no pé de um companheiro, num voo dele) nunca é tocada', r.map(([n, ok]) => `${n} ${ok ? 'ok' : 'NÃO'}`).join('; '), 'nunca (a deles toca)', r.every(x => x[1]));
  }
  // ---- B4: um toque por carrinho (a bola posta de novo na perna depois do 1º: nada)
  {
    const c = novoPlano(2);
    const q = K.quadroCarrinho(c, 0.3, K.novoQuadroCarrinho());
    const bola = BL.criarBola(q.po[c.frente].x + c.ux * 0.05, q.po[c.frente].z + c.uz * 0.05);
    const r = rodarContato(c, bola);
    let novos = 0, mudou = 0;
    if (r.tick >= 0) {
      const w = r.w, t1 = c.bola;
      for (let n = 0; n < 30 && w.tick * PASSO < c.tS; n++) {
        const qq = K.quadroCarrinho(c, (w.tick + 1) * PASSO, K.novoQuadroCarrinho());
        bola.p.x = qq.po[c.frente].x; bola.p.z = qq.po[c.frente].z; bola.p.y = RB; bola.v.x = 0; bola.v.y = 0; bola.v.z = 0; bola.rolando = true;
        passoContato(w);
        novos += w.eventos.filter(e => e.id === 500).length;
        if (c.bola !== t1) mudou++;
      }
    }
    reg('B4 um toque de bola por carrinho (a bola na perna de novo depois do 1º)', r.tick >= 0 ? `eventos novos ${novos}, c.bola mudou ${mudou}×` : 'o 1º não tocou', '0, 0', r.tick >= 0 && novos === 0 && mudou === 0);
  }
}
// ---- B6: os eventos (o que todos já leem) e os leitores de hoje sem mudar (o autor do gol, a súmula, o resultado do TM e o
// impedimento) com os eventos que o contato EMITE (ids de jogadores de verdade da partida da semente 3102)
if (TEM_CONTATO && ESTADOS.posse1) {
  const wr = SIM.copiarMundo(ESTADOS.posse1);
  const D0 = linhaPerto(wr, 0, 0), A1 = wr.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL'), X1 = wr.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL' && o.id !== A1.id);
  const idD = D0.id, idA = A1.id, idX = X1.id;
  const timeDe = id => wr.jogadores.find(o => o.id === id)?.time ?? null;
  /** Um contato montado no mundo mínimo: o plano 4,75 alinhado, a bola em `bola(q, c)` no tick 0 e `prep(w)` (posse, voo). */
  function emitir(bolaDe, prep = null, t0 = 0) {
    const c = novoPlano(2);
    const jc = { id: idD, time: 0, carrinho: c };
    const bola = bolaDe(c);
    const w = mundoContato([jc], bola);
    w.tick = t0;
    if (prep) prep(w, c);
    let ev = [], antes = null;
    for (let n = 0; n < 80 && c.bola < 0 && w.tick * PASSO < c.tS; n++) {
      antes = { voo: w.voo, ult: w.ultimoToque, posse: w.posse };
      passoContato(w);
      if (c.bola >= 0) ev = w.eventos.slice();
    }
    return { w, c, ev, antes };
  }
  // a bola rolando a `vel` m/s perpendicular à canela da perna da bola, chegando ao meio dela em 0,55 s (no deslize)
  const naCanela = (vel, tc = 0.55) => c => {
    const q = K.quadroCarrinho(c, tc, K.novoQuadroCarrinho()), k = c.frente, a = q.jo[k], b = q.to[k];
    let px = -(b.z - a.z), pz = b.x - a.x; const pl = Math.hypot(px, pz); px /= pl; pz /= pl;
    const bola = BL.criarBola((a.x + b.x) / 2 - px * vel * tc, (a.z + b.z) / 2 - pz * vel * tc);
    BL.chutarRasteiro(bola, px * vel, pz * vel);
    return bola;
  };
  // a bola parada à frente da ponta da perna da bola (a perna chega nela no deslize)
  const naPonta = c => { const q = K.quadroCarrinho(c, 0.5, K.novoQuadroCarrinho()); return BL.criarBola(q.po[c.frente].x + c.ux * 0.02, q.po[c.frente].z + c.uz * 0.02); };
  const vooDe = (tipo, de) => w => { w.voo = { tipo, de, time: 1, para: idX, alvo: { x: 0, z: 0 }, tick0: 0, tickChave: 0, tickChegada: 20, alto: false }; w.ultimoToque = { id: de, time: 1, tick: 0 }; };
  const ok = [];
  // o chute deles: bateuCorpo {bloqueio, carrinho}; o voo e o último toque ficam (o gol desviado é de quem chutou)
  const ch = emitir(naCanela(15), vooDe('chute', idA));
  const evCh = ch.ev.filter(e => e.id === idD);
  ok.push(['chute → bateuCorpo {bloqueio, carrinho}', evCh.length === 1 && evCh[0].tipo === 'bateuCorpo' && evCh[0].bloqueio && evCh[0].carrinho
    && ch.w.voo === ch.antes.voo && ch.w.ultimoToque.id === idA && ch.w.desvio === ch.c.bola && ch.c.tChao === CC.chaoAcertou]);
  {
    const est = AG.criarAutorGol();
    AG.autorEventos(est, [{ tipo: 'chute', id: idA }], 1, timeDe);
    AG.autorEventos(est, ch.ev, 2, timeDe);
    AG.autorEventos(est, [{ tipo: 'gol', time: 1 }], 3, timeDe);
    ok.push(['o gol desviado é de quem chutou (autor-gol)', est.gol.id === idA && !est.gol.contra && est.gol.desvio]);
  }
  // o cruzamento deles: roubada {carrinho, de: 'passe'} — o cruzamento desviado para o próprio gol é gol contra (súmula e TM)
  const cz = emitir(naCanela(12), vooDe('cruzamento', idA));
  const evCz = cz.ev.filter(e => e.id === idD);
  ok.push(['cruzamento → roubada {carrinho, de: passe}', evCz.length === 1 && evCz[0].tipo === 'roubada' && evCz[0].carrinho && evCz[0].de === 'passe'
    && cz.w.voo === null && cz.w.ultimoToque.id === idD && cz.c.tChao === CC.chaoAcertou]);
  {
    const s = SU.criarSumula();
    SU.sumulaPasso(s, wr, [{ tipo: 'passe', id: idA, modo: 'cruzamento', para: idX }]);
    SU.sumulaPasso(s, wr, cz.ev);
    SU.sumulaPasso(s, wr, [{ tipo: 'gol', time: 1 }]);
    const r = SU.resultadoTM(s, wr);
    ok.push(['o cruzamento desviado para o próprio gol: gol contra (súmula e resultadoTM)', s.gols.length === 1 && s.gols[0].contra && s.gols[0].id === idD && r.gols[0].contra === true]);
    const s2 = SU.criarSumula();
    SU.sumulaPasso(s2, wr, [{ tipo: 'passe', id: idA, modo: 'passe', para: idX }]);
    SU.sumulaPasso(s2, wr, cz.ev);
    SU.sumulaPasso(s2, wr, [{ tipo: 'toque', id: idX }]);
    ok.push(['o passe cortado não conta como certo (súmula)', (s2.jog[idA]?.passesCertos ?? 0) === 0 && (s2.jog[idD]?.roubadas ?? 0) === 1]);
  }
  // a bola livre: roubada {carrinho, de: 'livre'}; o impedido que desliza nela é marcado (impedimento.js, peso 1)
  const lv = emitir(naPonta);
  const evLv = lv.ev.filter(e => e.id === idD);
  ok.push(['bola livre → roubada {carrinho, de: livre}', evLv.length === 1 && evLv[0].tipo === 'roubada' && evLv[0].de === 'livre' && lv.w.ultimoToque.id === idD]);
  {
    const wi = SIM.copiarMundo(ESTADOS.posse1);
    wi.posse = null; wi.naMao = null; wi.voo = null;
    wi.partida.imped = { time: 0, ids: [idD], tick: wi.tick, linhaX: 0, por: wi.jogadores.find(o => o.time === 0 && o.id !== idD && o.posicao !== 'GOL').id, defensor: null };
    wi.eventos = lv.ev.slice();
    const inf = IM.regraImpedimento(wi);
    ok.push(['o impedido que desliza no passe do companheiro: impedimento marcado', !!inf && inf.id === idD]);
  }
  // o condutor deles: perde a bola só com ela saindo a ≥ rouboVRel dele (dividida ganhou + roubada); abaixo, raspão (a posse fica)
  const condutor = (vx, vz) => ({ id: idA, time: 1, x: 0, z: 0, vx, vz, cond: { toque: { tick: 0 }, busca: true, semDominioAte: -1, bolaDesviada: false } });
  const gh = emitir(naPonta, w => { const d = condutor(0, 0); w.jogadores.push(d); w.posse = idA; });
  const evGh = gh.ev.filter(e => e.id === idD);
  const vRel = gh.c.bola >= 0 ? Math.hypot(gh.w.bola.v.x, gh.w.bola.v.z) : 0;
  ok.push([`condutor (bola a ${f2(vRel)} m/s dele) → dividida ganhou + roubada`, evGh.length === 2 && evGh[0].tipo === 'dividida' && evGh[0].ganhou && evGh[0].carrinho && evGh[1].tipo === 'roubada' && evGh[1].carrinho
    && gh.w.posse === null && gh.w.stats.roubadas === 1 && gh.w.ultimoToque.id === idD && gh.w.jogadores[1].cond.semDominioAte === gh.c.bola + Math.round(CFG.DEFESA_HUMANO.dividida.semDominio / PASSO)]);
  // raspão: no deslize, a bola do condutor encostando na perna da bola (1 cm dentro dela no fim do 1º trecho) e indo embora
  // mais rápido que ela, com o condutor junto — o toque não a empurra (a velocidade relativa na normal já é de saída)
  const T_RP = 30;
  const rp = emitir(c => {
    const tq = T_RP * PASSO + TR, q = K.quadroCarrinho(c, tq, K.novoQuadroCarrinho());
    let melhor = null;
    for (let d = 0; d <= 0.4 && !melhor; d += 0.002) {
      const x = q.po[c.frente].x + c.ux * d, z = q.po[c.frente].z + c.uz * d, g = folgaEm(c, tq, x, RB, z);
      if (g < -0.005 && g > -0.02) melhor = { x, z };
    }
    const bola = BL.criarBola(melhor ? melhor.x : 0, melhor ? melhor.z : 0);
    const v = Math.hypot(q.vx, q.vz) + 3;
    BL.chutarRasteiro(bola, c.ux * v, c.uz * v);
    return bola;
  }, (w) => { const d = condutor(w.bola.v.x, w.bola.v.z); w.jogadores.push(d); w.posse = idA; }, T_RP);
  const evRp = rp.ev.filter(e => e.id === idD);
  ok.push(['raspão (bola < rouboVRel do condutor) → a posse fica, nenhum evento de TOQUES', rp.c.bola >= 0 && evRp.length === 1 && evRp[0].tipo === 'carrinho' && evRp[0].fase === 'bola' && evRp[0].de === 'raspao'
    && !evRp.some(e => AG.TOQUES.has(e.tipo)) && rp.w.posse === idA && rp.c.tChao === CC.chaoErrou && rp.w.jogadores[1].cond.bolaDesviada === true]);
  const ruins = ok.filter(x => !x[1]);
  reg('B6 eventos que todos já leem (chute, cruzamento, livre, condutor, raspão) e os leitores sem mudar', `${ok.length - ruins.length}/${ok.length}${ruins.length ? ': ' + ruins.map(x => x[0]).join('; ') : ''}`, 'todos', ruins.length === 0);
  if (DETALHE) console.log('B6 casos: ' + ok.map(x => `${x[0]} ${x[1] ? 'ok' : 'NÃO'}`).join(' | '));
}

// ---- B7: dois carrinhos na mesma bola — vale o contato mais cedo; no empate exato, o time m.tick % 2; o resultado não depende
// da ordem de m.jogadores
if (TEM_CONTATO) {
  /** Os dois carrinhos (planos pa, pb; times ta, tb) na bola parada `bola(c)`, começando no tick t0, na ordem dada. */
  const dois = (pa, pb, ta, tb, t0, ordem, bolaDe) => {
    const ca = structuredClone(pa), cb = structuredClone(pb);
    for (const c of [ca, cb]) { c.tick0 += t0; c.fim += t0; }
    const ja = { id: 701, time: ta, carrinho: ca }, jb = { id: 702, time: tb, carrinho: cb };
    const bola = bolaDe(ca);
    const w = mundoContato(ordem ? [ja, jb] : [jb, ja], bola);
    w.tick = t0;
    for (let n = 0; n < 80 && ca.bola < 0 && cb.bola < 0; n++) passoContato(w);
    return { quem: ca.bola >= 0 ? 701 : cb.bola >= 0 ? 702 : -1, bola: JSON.stringify(w.bola), tick: w.tick };
  };
  const naPontaB = c => { const q = K.quadroCarrinho(c, 0.45, K.novoQuadroCarrinho()); return BL.criarBola(q.po[c.frente].x + c.ux * 0.03, q.po[c.frente].z + c.uz * 0.03); };
  const r = [];
  // o mesmo plano nos dois (times 0 e 1): o empate exato — o time m.tick % 2, nas duas ordens
  for (const t0 of [0, 1]) {
    const a = dois(PLANOS_B[2], PLANOS_B[2], 0, 1, t0, true, naPontaB), b = dois(PLANOS_B[2], PLANOS_B[2], 0, 1, t0, false, naPontaB);
    const esperado = 701 + ((a.tick - 1) % 2 === 0 ? 0 : 1); // o time do tick do toque (time 0 = 701)
    r.push([`empate exato, começando no tick ${t0}`, a.quem === b.quem && a.bola === b.bola && a.quem === esperado, `${a.quem}/${b.quem}`]);
  }
  // planos diferentes (7 m/s × 4,75 m/s do mesmo ponto, a bola à frente): o de 7 m/s chega antes, nas duas ordens e paridades
  for (const t0 of [0, 1]) {
    const a = dois(PLANOS_B[3], PLANOS_B[2], 0, 1, t0, true, naPontaB), b = dois(PLANOS_B[3], PLANOS_B[2], 0, 1, t0, false, naPontaB);
    const c = dois(PLANOS_B[3], PLANOS_B[2], 1, 0, t0, true, naPontaB);
    r.push([`o mais cedo (tick ${t0})`, a.quem === 701 && b.quem === 701 && c.quem === 701 && a.bola === b.bola, `${a.quem}/${b.quem}/${c.quem}`]);
  }
  reg('B7 dois carrinhos na mesma bola: o mais cedo; no empate o time m.tick % 2; igual nas duas ordens', r.map(x => `${x[0]} ${x[1] ? 'ok' : 'NÃO'} (${x[2]})`).join('; '), 'todos', r.every(x => x[1]));
}

// ---- B4 (na simulação): a DIVIDIDA apertada no mesmo tick do aperto não sai; B5: o bloqueio sorteado (sim.js bloqueioPerna)
// nunca bloqueia pelo deslizante o chute que passa a ≤ 1,0 m da pelve dele e FORA da perna desenhada (0,5–5 cm além)
if (TEM_CONTATO && ESTADOS.posse1) {
  {
    const w = SIM.copiarMundo(ESTADOS.posse1);
    const d = porId(w, w.posse), j = linhaPerto(w, d.x, d.z);
    AC.assumirControle(w, 0, j);
    let div = 0;
    passo(w, entPara(j, w.bola.p.x, w.bola.p.z, B.CARRINHO | B.DIVIDIDA));
    const saiu = !!j.carrinho;
    for (let i = 0; i < 20; i++) {
      for (const e of w.eventos) if (e.tipo === 'dividida' && e.id === j.id && !e.carrinho) div++;
      if (j.defH) div++;
      passo(w, entPara(j, w.bola.p.x, w.bola.p.z, i % 2 ? B.DIVIDIDA : 0));
    }
    reg('B4 a DIVIDIDA no mesmo tick do aperto (e depois) não sai', saiu ? `${div} DIVIDIDAs/estados` : 'o carrinho não saiu', '0', saiu && div === 0);
  }
  {
    const ap = apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
    for (let i = 0; ap && i < 30; i++) passo(ap.w, entPara(ap.j, 0, 0, 0)); // no deslize
    let aceitos = 0, bloq = 0, toque = 0, tent = 0, cruza = 0, cruzaEv = 0;
    const r2 = (() => { let s = 4242; return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648); })();
    /** a menor folga do caminho do passo (b0 → b1) às pernas nos fins dos trechos (o que o contato confere) */
    const folgaPasso = (c, tick, b0, b1) => {
      let g = Infinity;
      for (let s = 1; s <= SUBP; s++) {
        const t = (tick - c.tick0) * PASSO + s * TR;
        if (t - TR >= c.tS) break;
        for (let k = 0; k <= 20; k++) {
          const f = (s - 1 + k / 20) / SUBP;
          g = Math.min(g, folgaEm(c, t, b0.x + (b1.x - b0.x) * f, RB, b0.z + (b1.z - b0.z) * f));
        }
      }
      return g;
    };
    while (ap && ap.j.carrinho && (aceitos < 40 || cruza < 6) && tent < 6000) {
      tent++;
      const w = ap.w, j = ap.j, c = j.carrinho;
      const fi = r2() * 2 * Math.PI, rho = 0.35 + r2() * 0.6, lado = r2() < 0.5 ? 1 : -1, vel = 15;
      const dx = Math.cos(fi), dz = Math.sin(fi);
      const C = { x: j.x - dz * rho * lado, z: j.z + dx * rho * lado };
      const b0 = { x: C.x - dx * vel * PASSO / 2, z: C.z - dz * vel * PASSO / 2 }, b1 = { x: C.x + dx * vel * PASSO / 2, z: C.z + dz * vel * PASSO / 2 };
      const g = folgaPasso(c, w.tick, b0, b1);
      const dentroDoBloq = g >= 0.005 && g <= 0.05;
      const cruzando = g < -0.03 && cruza < 6;
      if (!dentroDoBloq && !cruzando) continue;
      if (dentroDoBloq && aceitos >= 40) continue;
      const w2 = SIM.copiarMundo(w), j2 = porId(w2, j.id);
      const k1 = w2.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL' && o.id !== w2.posse);
      P.teleportar(k1, j2.x + Math.cos(j2.rumo) * 4, j2.z + Math.sin(j2.rumo) * 4, j2.rumo + Math.PI);
      w2.posse = null; w2.naMao = null; w2.bloq = undefined;
      w2.voo = { tipo: 'chute', de: k1.id, time: 1, para: null, alvo: { x: -w2.ataca[1] * CFG.CAMPO.meioX, z: 0 }, tick0: w2.tick, tickChave: w2.tick, tickChegada: w2.tick + 30, alto: false };
      w2.ultimoToque = { id: k1.id, time: 1, tick: w2.tick };
      const bb = w2.bola;
      bb.p.x = b0.x; bb.p.z = b0.z; BL.chutarRasteiro(bb, dx * vel, dz * vel);
      passo(w2, entPara(j2, 0, 0, 0));
      const ev = w2.eventos.filter(e => e.id === j2.id && (e.tipo === 'bateuCorpo' || e.tipo === 'roubada'));
      if (w2.posse != null) continue; // (alguém dominou a bola no passo 3: o caminho não é mais o montado)
      if (dentroDoBloq) {
        aceitos++;
        if (ev.some(e => e.bloqueio && !e.carrinho)) bloq++;
        if (j2.carrinho && j2.carrinho.bola >= 0) toque++;
      } else {
        cruza++;
        // a perna tocou: UM evento só (o bateuCorpo {bloqueio, carrinho}; nem o bloqueio sorteado nem o disco do corpo no mesmo passo)
        if (ev.length === 1 && ev[0].tipo === 'bateuCorpo' && ev[0].carrinho) cruzaEv++;
      }
    }
    // o chute deles que encosta na coxa perto do quadril (dentro do disco do corpo, 0,31 m) indo para o centro: no passo do
    // toque da perna o disco não a rebate de novo (sim.js colisaoBolaCorpo; no chute o último toque continua de quem chutou,
    // então só esta guarda o segura) — um evento só
    let quadril = 0, quadrilEv = 0, noDisco = 0;
    for (let n = 0; ap && ap.j.carrinho && n < 400 && quadril < 12; n++) {
      const w = ap.w, j = ap.j, c = j.carrinho;
      const q = K.quadroCarrinho(c, (w.tick + 1 - c.tick0) * PASSO, K.novoQuadroCarrinho());
      const k = r2() < 0.5 ? 0 : 1, H = q.qd[k], Kn = q.jo[k], wq = 0.05 + r2() * 0.4;
      const Cx = H.x + (Kn.x - H.x) * wq, Cz = H.z + (Kn.z - H.z) * wq;
      let ex = H.x - Kn.x, ez = H.z - Kn.z; const el = Math.hypot(ex, ez) || 1; ex /= el; ez /= el;
      const lado = r2() < 0.5 ? 1 : -1, off = RAIO_SEG[0] + RB - 0.01 - r2() * 0.04, vel = 2 + r2() * 6;
      const E = { x: Cx - ez * off * lado, z: Cz + ex * off * lado };
      if (Math.hypot(E.x - j.x, E.z - j.z) > 0.31) continue;
      const w2 = SIM.copiarMundo(w), j2 = porId(w2, j.id);
      const k1 = w2.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL' && o.id !== w2.posse);
      w2.posse = null; w2.naMao = null; w2.bloq = undefined;
      w2.voo = { tipo: 'chute', de: k1.id, time: 1, para: null, alvo: { x: -w2.ataca[1] * CFG.CAMPO.meioX, z: 0 }, tick0: w2.tick, tickChave: w2.tick, tickChegada: w2.tick + 30, alto: false };
      w2.ultimoToque = { id: k1.id, time: 1, tick: w2.tick };
      const bb = w2.bola;
      bb.p.x = E.x - ex * vel * PASSO; bb.p.z = E.z - ez * vel * PASSO; BL.chutarRasteiro(bb, ex * vel, ez * vel);
      passo(w2, entPara(j2, 0, 0, 0));
      if (!(j2.carrinho && j2.carrinho.bola === w2.tick - 1)) continue;
      quadril++;
      const ev = w2.eventos.filter(e => e.id === j2.id && (e.tipo === 'bateuCorpo' || e.tipo === 'roubada'));
      if (ev.length === 1 && ev[0].carrinho) quadrilEv++;
      if (Math.hypot(bb.p.x - j2.x, bb.p.z - j2.z) < 0.31) noDisco++;
    }
    reg('B5 a perna tocou perto do quadril (dentro do disco): um evento só no passo', `${quadrilEv}/${quadril} (a bola no disco depois: ${noDisco})`, 'todos (≥ 4)', quadril >= 4 && quadrilEv === quadril);
    reg('B5 o bloqueio sorteado nunca vale para o deslizante (chute a ≤ 1 m da pelve, 0,5–5 cm fora da perna)', `${bloq} bloqueios, ${toque} toques da perna em ${aceitos} chutes`, '0, 0 (≥ 30 chutes)', aceitos >= 30 && bloq === 0 && toque === 0);
    reg('B5 o chute que cruza a perna: um evento só (bateuCorpo {bloqueio, carrinho})', `${cruzaEv}/${cruza}`, 'todos (≥ 4)', cruza >= 4 && cruzaEv === cruza);
  }
}

// ---- E6: a bola morta — o carrinho segue pelo quadro sem efeito: nenhum toque, evento ou tempo no chão (a cópia com a bola
// VIVA, a mesma bola na perna, toca: o controle). Bola na lateral, falta apitada por outro motivo (a parada do tiro livre) e o
// gol (m.golTick: o tick do gol e depois)
if (TEM_CONTATO && ESTADOS.posse1) {
  const ap = apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
  const r = [];
  if (ap) {
    for (let i = 0; i < 5; i++) passo(ap.w, entPara(ap.j, 0, 0, 0));
    const casos = [
      ['lateral', w => P.bolaMorta(w, 'lateral', 1, w.bola.p.x, 34)],
      ['falta de outro (tiro livre)', w => P.bolaMorta(w, 'tiroLivre', 1, w.bola.p.x, w.bola.p.z)],
      ['gol (m.golTick)', w => { w.golTick = w.tick; }],
      ['viva (o controle)', null],
    ];
    for (const [nome, matar] of casos) {
      const w = SIM.copiarMundo(ap.w), j = porId(w, ap.j.id), c = j.carrinho;
      if (matar) matar(w);
      // a bola parada à frente da ponta da perna da bola, onde ela chega em ~0,1 s
      const q = K.quadroCarrinho(c, (w.tick - c.tick0) * PASSO + 0.1, K.novoQuadroCarrinho());
      w.posse = null; w.voo = null;
      const bb = w.bola; bb.p.x = q.po[c.frente].x + c.ux * 0.02; bb.p.z = q.po[c.frente].z + c.uz * 0.02; BL.chutarRasteiro(bb, 0, 0);
      // (os eventos do carrinho: os do contato levam `carrinho: true`; o raspão é `carrinho {fase: 'bola'}`)
      const doCarrinho = e => e.id === j.id && (e.carrinho === true || (e.tipo === 'carrinho' && e.fase !== 'inicio'));
      let ev = 0;
      for (let n = 0; n < 300 && j.carrinho; n++) {
        const morta0 = !K.vivaCarrinho(w);
        if (matar && !morta0) break; // a bola rolou de novo: o que vem depois é jogo
        passo(w, entPara(j, 0, 0, 0));
        if (matar && K.vivaCarrinho(w)) break; // (o passo da cobrança)
        for (const e of w.eventos) if (doCarrinho(e)) ev++;
        if (!matar && ev) break;
      }
      const cc = j.carrinho ?? c;
      r.push([nome, matar ? ev === 0 && cc.bola < 0 && cc.tChao === CC.chaoErrou : ev > 0, `${ev} eventos, tChao ${f2(cc.tChao)}`]);
    }
  }
  reg('E6 bola morta: 0 eventos do carrinho até rolar, tChao 1,2 (a viva toca)', ap ? r.map(x => `${x[0]}: ${x[2]}`).join('; ') : 'o carrinho não saiu', 'mortas 0; viva > 0', !!ap && r.length === 4 && r.every(x => x[1]));
}

// F1 (o determinismo com carrinhos; a parte F completa vem com as faltas): a mesma semente e as mesmas entradas — o aperto, o
// analógico e os botões — dão o mesmo hash em duas rodadas
{
  const rodar = () => {
    const w = SIM.copiarMundo(ESTADOS.posse1);
    const d = porId(w, w.posse), j = linhaPerto(w, d.x, d.z);
    AC.assumirControle(w, 0, j);
    const hs = [];
    for (let i = 0; i < 240; i++) { passo(w, entPara(j, w.bola.p.x, w.bola.p.z, i === 0 || i === 150 ? B.CARRINHO : 0)); hs.push(SIM.hashMundo(w)); }
    return hs;
  };
  const h1 = rodar(), h2 = rodar();
  const dif = h1.filter((h, i) => h !== h2[i]).length;
  reg('F1 mesma semente e mesmas entradas com carrinhos: o mesmo hash em 2 rodadas', `${dif} de ${h1.length} diferentes`, '0', dif === 0);
}

linhas.push(['…', 'C, D, F2–F4, G (contato com o homem, canhão, Regra 12, sorteios, cenas)', 'PENDENTE', 'commits 4–5']);
if (DETALHE) console.log(tabela.map(l => l.join(' | ')).join('\n') + '\n');
fim();
