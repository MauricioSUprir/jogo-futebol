// teste-carrinho (item 34 da FILA; pedido do dono de 17/10: "botão de CARRINHO — dividida deslizando; falta/cartão pela
// Regra 12"): o corpo de quem desliza é um PLANO puro montado no aperto e um QUADRO puro do tempo (carrinho.js), lido pela
// simulação, pela pose e pelas cenas; o contato vale pela perna DESENHADA; a falta, pela Regra 12. Contrato: CONTRATOS.md
// "Carrinho (item 34)"; constantes: config.js DEFESA_HUMANO.carrinho.
//
// Na base (sem js/carrinho.js) REPROVA: "o carrinho existe — não existe nesta lógica" (como o teste-faltas com o faltas.js).
// Commits 1–5 da entrega: o plano e o quadro (A, P pelo quadro), a pose e o corpo novo (P), o corpo na simulação com o
// disparo e as travas (E), o contato da perna com a bola (B, E6), o contato com o homem e a Regra 12 (C, D), o
// determinismo (F) e as cenas (G). 2 processos (o canhão C dividido; --par 1: um só), ~65 s.
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
//        entre o último quadro e a pose normal de pé com os pés onde o quadro os plantou; nesse fim, as mãos e a cabeça além
//        do que a pelve anda ≤ a RÉGUA: o p99,9 do salto de um tick delas na pose normal correndo (≥ 4 m/s, IA × IA);
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
//  C. o canhão contra o condutor (molde do teste-intercepta B: estados do MEIO da partida, semente 3001 + k, k = 0–15, a
//     demo até a bola no pé de um jogador de linha do time 1; 36 casos por estado: o jogador do time 0 a 2/3/4/5,5 m da bola ×
//     frente/lado/trás pela direção do condutor × 3/5/6,5 m/s, o analógico para a bola e o bit no 1º passo; 2 s de partida
//     pela demo; 576 carrinhos). C1 (reprova pela prova binomial, p < 5%): a bola do FANTASMA (a cópia logo depois do aperto
//     com o mesmo plano e sem os contatos da perna: o condutor vê o mesmo corpo deslizando) a ≤ raio + 0,11 m da perna da
//     bola NO MESMO instante, antes de a perna chegar ao homem → toca ≥ 85%; a menor distância ≥ 1,0 m → toca ≤ 5% (pela
//     cópia da DEMO, a da especificação, informativa: o condutor reage ao defensor de pé). C2–C5 informativas (toca, o time
//     com a bola 2 s depois, falta, amarelo/vermelho por falta; todos e o alcançável) contra a Wyscout 2017/18. C6 (reprova):
//     antes da bola com f ≥ 1,5 m/s falta ≥ 85% (chance 0,95); de frente tocando a bola primeiro ≤ 15%; sem contato no
//     homem 0 (exato); por trás informativo (Fuller). C7: nenhum NaN; o Modo Livre (3 estados × 36): nenhuma falta.
//  D. a Regra 12 em contatos MONTADOS (a partida em jogo com os outros longe; o carrinho em andamento e o adversário sobre a
//     perna da bola; o contato do fim do passo chamado direto, com o gerador numa semente achada): D1 chanceFaltaCarrinho =
//     a tabela C.1 (exato); D2 DOGSO fora da área vermelho, na área tentando a bola pênalti + amarelo, sem intenção pênalti +
//     vermelho; D3 SPA na área tentando a bola pênalti SEM cartão só no carrinho (a DIVIDIDA e o bote como hoje); D4 a
//     vantagem (e nenhuma na força excessiva); D5 Modo Livre sem falta; D6 o carrinho por trás com os corpos se tocando: uma
//     falta só, nunca 'carga' (na partida, 40 sementes); D7 o vermelho direto (fExc ≥ 6 antes da bola, o gerador achado por
//     busca) e nunca com o mesmo gerador com fExc < 6 ou depois da bola; D8 o goleiro deitado (num mergulho de verdade) pelo
//     corpo inteiro e com a bola nas mãos falta em 100% e tiro livre dele; D9 a intenção não muda com a fase da passada; D10
//     o tropeço na perna parada (falta a 3,5 m/s; incidental a 0,8; nada no levantar); D11 dois carrinhos opostos: falta só
//     de quem não tocou a bola quando o outro tocou (nas duas ordens e com os times trocados).
//  F1 a mesma semente e as mesmas entradas, com carrinhos: o mesmo hash em 2 rodadas. F2 os sorteios do m.rng por ORIGEM (um
//     Proxy que lê a pilha): 0 do carrinho sem contato no homem (também na partida, e o bloqueio sorteado nunca com o
//     deslizante); com contato exatamente 1 da chance (0 < p < 1) + os do cartão — nos montados e nos 36 casos do estado 0
//     do canhão. F3 o passo com o carrinho (o canhão inteiro, nos dois processos) não chama Math não exato (contado como no
//     teste-math-proibido). F4 online (dois humanos): os dois carrinhos com os times trocados — quem toca a bola e quem faz a
//     falta saem pelo papel, não pelo time.
//  G. as cenas continuam o deslize (a cópia do plano pelo MESMO quadro, no relógio da cena; o deslizante do estado posse1 da
//     parte E, alguns passos depois do aperto): G1 a cópia no meio do carrinho (cena-atores com os braços para o céu o
//     tempo todo em todos, como no meio do jogo e com o `congela` do apito): o 1º quadro = a pose do mundo, a pelve
//     desenhada = a do quadro da cópia até ficar de pé, sem salto além do centro (≤ 0,1 m/tick), nenhum gesto no carrinho
//     nem no 1º tick de pé (= a pose pura, exato), as mãos ≤ 0,15 m/tick além da pelve na rampa dos gestos (no tick do fim do
//     quadro, as mãos e a cabeça ≤ a régua do A6), e o plano do MUNDO igual (comparação profunda) depois de 200 passos; G3 a
//     comemoração com um defensor no carrinho no tick do gol: G1; G3b com o AUTOR no carrinho: a finalização (e o abraço)
//     só depois do levantar, ele corre ≥ 1,5 m para o alvo em 1,5 s de pé e não fica preso (nem fixo nem no carrinho);
//     G2 a cena do cartão com o punido no chão (o amarelo do próprio deslizante no tick da falta, variação 'aceita', a de
//     reação mais cedo): nenhum gesto enquanto ele desliza, a reação depois de ficar de pé e por ≥ 0,5 s, sem salto da pelve
//     (≤ 0,1) nem das mãos (≤ 0,15 m/tick além da pelve; no tick do fim do quadro, mãos e cabeça ≤ a régua do A6), o árbitro no ponto do
//     plano (≤ 0,3 m: a paradaPrevista pelo fim do quadro); G4 o teleportar zera o plano e o quadril (de pé no ponto novo
//     depois de 1 passo) e a cópia da cena de substituição fica de pé no lugar; G5 o intervalo (o carrinho no último tick do
//     1º tempo): a pelve desenhada parada (≤ 0,05 m) e a saída do 2º tempo zera o plano e o quadril; G6 o levar (3, −2 m) no
//     meio do carrinho: sem salto e o pé dobrado parado no 1º tick do levantar (≤ 0,02 m); G7 o Modo Livre, "Bola no meu
//     pé" com o controlado no carrinho: de pé no lugar, plano e quadril zerados, a bola a ≤ 0,5 m; G8 a cena do cartão com o
//     punido no carrinho (≥ 12 cenas do cartão do próprio deslizante, ≥ 6 com a bola a ≤ 0,3 m dele): a bola parada do
//     mundo nunca dentro do corpo desenhado dele (as cápsulas do manequim e a cabeça) enquanto ele está no chão.
//   node tools/teste-carrinho.mjs              (lógica do repositório)
//   node tools/teste-carrinho.mjs --js <pasta> (outra cópia da lógica; a da main antes do carrinho → REPROVA)
//   node tools/teste-carrinho.mjs --detalhe    (a tabela por entrada, cada caso do A9 e os encontros do C1 sem toque)
//   node tools/teste-carrinho.mjs --estados N  (os estados do canhão C; padrão 16 — com poucos, C1/C6 não têm amostra)
//   node tools/teste-carrinho.mjs --par 1      (sem o processo filho do canhão)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const DETALHE = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

// F3 (o caminho do carrinho não usa Math não exato: o online compara o hash dos dois aparelhos): as funções de Math que não são
// exatas pelo IEEE 754 contam as chamadas DENTRO da janela (o passo do mundo com o carrinho), trocadas ANTES de importar a
// lógica (como o teste-math-proibido: a lógica que guardasse `const sin = Math.sin` também conta)
const PROIBIDAS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'expm1', 'log', 'log2', 'log10', 'log1p',
  'pow', 'hypot', 'cbrt', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'random'];
let dentroF3 = false, chamadasF3 = 0;
const ondeF3 = new Map();
for (const n of PROIBIDAS) {
  const f = Math[n];
  Math[n] = function (...a) {
    if (dentroF3) {
      chamadasF3++;
      if (ondeF3.size < 8) { const l = (new Error().stack.split('\n')[2] ?? '?').trim().replace(/.*\/golaco\//, ''); ondeF3.set(`Math.${n} ${l}`, 1); }
    }
    return f.apply(Math, a);
  };
}
/** A janela do F3: o que roda dentro dela é o passo do mundo. */
function janelaF3(f) { dentroF3 = true; try { return f(); } finally { dentroF3 = false; } }

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

// ------------------------------------------------------------------ C: o canhão contra o condutor (estados do MEIO da partida)
// (o molde do teste-intercepta B: estados de saída enganam). 16 estados (semente 3001 + k: a demo por 1600 + 600·(k % 4) passos
// e depois até a bola no pé de um jogador de linha do time 1, em jogo, sem parada, voo nem gol) × 36 casos: o jogador de linha
// do time 0 mais perto da bola posto a 2 / 3 / 4 / 5,5 m dela × de frente / de lado / por trás pela direção do condutor × a 3 /
// 5 / 6,5 m/s na direção da bola, o controle nele, o analógico para a bola e o bit no 1º passo; depois 2 s de partida pela demo.
// As referências, no MESMO instante de cada tick (a bola de um mundo × a perna da bola do quadro):
//  - o FANTASMA: a cópia do mundo logo depois do aperto com o mesmo plano, sem os contatos da perna (o corpo desliza igual: o
//    condutor vê o mesmo defensor) — a bola dela é a de A até o 1º contato de A; o C1 (reprova) usa esta;
//  - a DEMO: a cópia sem o bit, o controlado pela demo (o da especificação; o condutor reage ao defensor de pé — informativo).
const porIdC = (w, id) => { for (const o of w.jogadores) if (o.id === id) return o; return null; };
const RB_C = CFG.BOLA.raio, RAIO_PERNA_C = [0.085, 0.058, 0.045];
const _qC = K.novoQuadroCarrinho();
/** A menor distância do centro da bola p à superfície das 3 cápsulas da perna k do quadro q. */
function dPernaBola(q, k, p) {
  let d = Infinity;
  const juntas = [[q.qd[k], q.jo[k]], [q.jo[k], q.to[k]], [q.to[k], q.po[k]]];
  for (let i = 0; i < 3; i++) {
    const [a, b] = juntas[i];
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, l2 = dx * dx + dy * dy + dz * dz;
    let u = l2 > 0 ? ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) / l2 : 0;
    u = Math.max(0, Math.min(1, u));
    d = Math.min(d, Math.hypot(a.x + dx * u - p.x, a.y + dy * u - p.y, a.z + dz * u - p.z) - RAIO_PERNA_C[i]);
  }
  return d;
}
/** A bola do mundo w pode ser tocada pela perna do carrinho c (do time 0) no instante t? (viva, baixa, fora do meu time) */
function tocavel(w, c, t) {
  if (!(t <= c.tS + 1e-9) || !K.vivaCarrinho(w) || w.naMao != null || w.bola.p.y > CC.altoBola) return false;
  const d = w.posse != null ? porIdC(w, w.posse) : null;
  return !(d && d.time === 0) && !(w.voo && w.voo.time === 0);
}
/** Conta os sorteios do m.rng vindos do caminho do carrinho (a pilha: faltaNoCarrinho, o contato com o homem, carrinho.js). */
function contarSorteios(w) {
  const alvo = w.rng, cont = { carrinho: 0, total: 0 };
  w.rng = new Proxy(alvo, {
    get(t, k) {
      if (k === 's') {
        cont.total++;
        const lim = Error.stackTraceLimit;
        Error.stackTraceLimit = 40;
        const st = new Error().stack;
        Error.stackTraceLimit = lim;
        if (!/hashMundo/.test(st) && /faltaNoCarrinho|contatosHomemCarrinho|homemDoCarrinho|resolverDoisCarrinhos|\/js\/carrinho\.js/.test(st)) cont.carrinho++;
      }
      return t[k];
    },
  });
  return { cont, devolver: () => { w.rng = alvo; } };
}
/** Os sorteios que o 1º contato com o homem deve fazer (C.2): a chance (0 < p < 1) e os do cartão. */
function sorteiosEsperados(h, falta, naMao, livre, outraFalta) {
  if (!h || outraFalta) return 0;
  if (livre) return 0;
  let n = naMao ? 0 : h.f > CFG.FALTAS.forca.min ? 1 : 0;
  if (falta) n += (!h.depois && h.fExc >= CFG.FALTAS.carrinho.excessivoF ? 1 : 0) + (falta.grau === 'excessivo' ? 0 : 1);
  return n;
}
/**
 * O canhão C nos estados k0..k1−1 (`livre`: o Modo Livre, `f2`: conta os sorteios do carrinho em A). Devolve os casos
 * compactos e as contagens (NaN, Math não exato na janela).
 */
function canhaoC(k0, k1, { livre = false, f2 = false } = {}) {
  const out = [];
  let nan = 0;
  const LVm = livre ? LV_C : null;
  const passoC = w => (LVm ? LVm.passoLivre(w, LVm.entradaDemoLivre(w), null) : P.passoPartida(w, P.entradaDemoPartida(w)));
  for (let k = k0; k < k1; k++) {
    const w0 = LVm ? LVm.criarLivre({ semente: 3001 + k }) : P.criarPartida({ semente: 3001 + k, minutosPorTempo: 4 });
    const ok = () => { const d = w0.posse != null ? porIdC(w0, w0.posse) : null; return w0.partida.estado === 'jogo' && !(w0.parada && !w0.parada.rolou) && w0.golTick == null && w0.naMao == null && !w0.voo && d && d.time === 1 && d.posicao !== 'GOL'; };
    const N = 1600 + 600 * (k % 4);
    for (let i = 0; i < N + 3000 && !(i >= N && ok()); i++) passoC(w0);
    if (!ok()) { out.push({ k, sem: true }); continue; }
    const c0 = porIdC(w0, w0.posse), vc = Math.hypot(c0.vx, c0.vz);
    const dx0 = vc >= 1 ? c0.vx / vc : Math.cos(c0.rumo), dz0 = vc >= 1 ? c0.vz / vc : Math.sin(c0.rumo);
    let idx = 0;
    for (const dist of [2.0, 3.0, 4.0, 5.5]) for (const lado of ['frente', 'lado', 'tras']) for (const vel of [3, 5, 6.5]) {
      idx++;
      const ang = lado === 'frente' ? 0 : lado === 'tras' ? Math.PI : ((k + idx) % 2 ? 1 : -1) * Math.PI / 2;
      const ux = dx0 * Math.cos(ang) - dz0 * Math.sin(ang), uz = dx0 * Math.sin(ang) + dz0 * Math.cos(ang);
      const b0 = w0.bola.p;
      const px = Math.max(-51, Math.min(51, b0.x + ux * dist)), pz = Math.max(-33, Math.min(33, b0.z + uz * dist));
      const A0 = SIM.copiarMundo(w0);
      let j = null, dm = Infinity;
      for (const o of A0.jogadores) if (o.time === 0 && o.posicao !== 'GOL') { const d = Math.hypot(o.x - b0.x, o.z - b0.z); if (d < dm) { dm = d; j = o; } }
      const rx = b0.x - px, rz = b0.z - pz, rl = Math.hypot(rx, rz) || 1;
      P.teleportar(j, px, pz, Math.atan2(rz, rx));
      j.vx = vel * rx / rl; j.vz = vel * rz / rl;
      AC.assumirControle(A0, 0, j);
      const id = j.id;
      const Bd = SIM.copiarMundo(A0), A = SIM.copiarMundo(A0);
      const ja = porIdC(A, id);
      const ev1 = janelaF3(() => (LVm ? LVm.passoLivre(A, { x: rx / rl, z: rz / rl, botoes: B_C.CARRINHO }, null) : P.passoPartida(A, { x: rx / rl, z: rz / rl, botoes: B_C.CARRINHO })));
      const c = ja.carrinho;
      if (!c) { out.push({ k, d: dist, l: lado, v: vel, saiu: false }); continue; }
      // o fantasma: o mesmo mundo logo depois do aperto, sem os contatos da perna (a bola não, o homem não)
      const contato1 = c.bola >= 0 || !!c.homem;
      const Bg = SIM.copiarMundo(A), cg = porIdC(Bg, id).carrinho;
      cg.bola = 1e9; cg.homem = { id: -1, fantasma: true };
      const cnt = f2 && !contato1 ? contarSorteios(A) : null;
      let dG = Infinity, nG = -1, dD = Infinity, hT = contato1 && c.homem ? 1 : -1, ganhou = false, fal = null, naMaoH = false, outraFalta = false, div = -1;
      const anota = (ev, n) => {
        for (const e of ev) {
          if (e.tipo === 'dividida' && e.id === id && e.ganhou) ganhou = true;
          if (e.tipo === 'falta' && e.def === id && !fal) fal = { grau: e.grau, cartao: e.cartao, motivo: e.motivo, origem: e.origem, area: e.area };
        }
        if (c.homem && hT < 0) {
          hT = n; naMaoH = A.naMao === c.homem.id;
          outraFalta = ev.some(e => e.tipo === 'falta' && e.origem !== 'carrinho');
        }
      };
      anota(ev1, 1);
      // (o contato já no passo do aperto: o fantasma já sai depois dele — a bola tocada ali é o encontro)
      if (contato1 && c.bola >= 0) { dG = -1; nG = 1; }
      for (let n = 1; n <= 120; n++) {
        const t = n * PASSO;
        if (n > 1) {
          anota(janelaF3(() => passoC(A)), n);
          janelaF3(() => passoC(Bg));
        }
        passoC(Bd);
        if (div < 0 && (A.bola.p.x !== Bg.bola.p.x || A.bola.p.z !== Bg.bola.p.z || A.bola.p.y !== Bg.bola.p.y)) div = n;
        if (!contato1 && tocavel(Bg, c, t)) { K.quadroCarrinho(c, t, _qC); const d = dPernaBola(_qC, c.frente, Bg.bola.p); if (d < dG) dG = d; if (nG < 0 && d <= RB_C) nG = n; }
        if (tocavel(Bd, c, t)) { K.quadroCarrinho(c, t, _qC); const d = dPernaBola(_qC, c.frente, Bd.bola.p); if (d < dD) dD = d; }
        for (const o of A.jogadores) if (!Number.isFinite(o.x + o.z + o.vx + o.vz + (o.quadril ?? 0))) nan++;
        if (!Number.isFinite(A.bola.p.x + A.bola.p.y + A.bola.p.z)) nan++;
      }
      const dono = A.posse != null ? porIdC(A, A.posse) : A.naMao != null ? porIdC(A, A.naMao) : null;
      const h = c.homem;
      const caso = {
        k, d: dist, l: lado, v: vel, saiu: true, toca: c.bola >= 0, tb: c.bola >= 0 ? c.bola - c.tick0 : -1, div, ganhou, com: dono ? dono.time : -1, dG, nG, dD, hT, contato1,
        h: h ? { depois: h.depois, f: h.f, fExc: h.fExc, ch: h.ch, falta: h.falta, naMao: naMaoH } : null, fal,
      };
      if (cnt) {
        cnt.devolver();
        caso.f2 = { obs: cnt.cont.carrinho, esp: sorteiosEsperados(h, fal, naMaoH, !!A.livre, outraFalta) };
      }
      out.push(caso);
    }
  }
  return { casos: out, nan, f3: chamadasF3 };
}
const B_C = CFG.BOTAO;
let LV_C = null;
try { LV_C = await imp('livre.js'); } catch { LV_C = null; }
if (args.includes('--filho-c')) {
  const r = canhaoC(+arg('--k0'), +arg('--k1'));
  await new Promise(ok => process.send(r, ok));
  process.exit(0);
}
// a metade de cima dos estados num processo filho, enquanto este faz o resto (2 processos; --par 1: tudo aqui)
const K_C = +arg('--estados', 16), PAR_C = Math.max(1, Math.min(2, +arg('--par', 2), os.availableParallelism?.() ?? os.cpus().length));
const MEIO_C = PAR_C > 1 ? K_C / 2 : K_C;
const filhoC = PAR_C > 1 && typeof (await imp('defesa.js')).contatosHomemCarrinho === 'function'
  ? new Promise((ok, erro) => {
    // (serialização 'advanced': o Infinity das distâncias nunca medidas chega como Infinity — em JSON viraria null, e null ≤ x)
    const c = fork(fileURLToPath(import.meta.url), [...args, '--filho-c', '--k0', String(MEIO_C), '--k1', String(K_C)], { serialization: 'advanced' });
    c.on('message', ok); c.on('error', erro);
    c.on('exit', cod => { if (cod) erro(new Error(`canhão C, estados ${MEIO_C}–${K_C - 1}: saiu com ${cod}`)); });
  })
  : null;

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
  a6ini: 0, a6fim: 0, a6piorIni: 0, a6piorFim: 0, a6n: 0, a6piorMao: 0, a6piorCab: 0,
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
// o salto de um tick das juntas `ids` além do que a pelve anda (o máximo entre elas)
const MAOS_A6 = [A.J.maoE, A.J.maoD], CAB_A6 = [A.J.cabeca];
function saltoAlemPelve(a, b, ids) {
  const ip = A.J.pelve * 3, dpx = b[ip] - a[ip], dpy = b[ip + 1] - a[ip + 1], dpz = b[ip + 2] - a[ip + 2];
  let s = 0;
  for (const id of ids) { const k = id * 3; s = Math.max(s, Math.hypot(b[k] - a[k] - dpx, b[k + 1] - a[k + 1] - dpy, b[k + 2] - a[k + 2] - dpz)); }
  return s;
}
// A RÉGUA do salto das mãos e da cabeça (A6, G1, G2): o p99,9 do salto de um tick além da pelve na pose NORMAL correndo (≥ 4 m/s;
// os jogadores de linha da partida dos estados de A, IA × IA: sem teleporte, cabeceio nem arremesso). O máximo puro não serve
// de régua: a pose normal tem picos raros (a torção na virada) que chegam a ~0,3 m
const REGUA = { mao: [], cab: [] };
const _poR = new Map();
function amostrarRegua(mm) {
  if (mm.partida.estado !== 'jogo') { _poR.clear(); return; }
  for (const j of mm.jogadores) {
    if (j.posicao === 'GOL') continue;
    const po = A.pose(j, mm, new Float32Array(NJ * 3));
    const a = _poR.get(j.id);
    _poR.set(j.id, { po, x: j.x, z: j.z });
    if (!a || j.cab || j.carrinho || j.arremesso || Math.hypot(j.x - a.x, j.z - a.z) > 0.2 || Math.hypot(j.vx, j.vz) < 4) continue;
    REGUA.mao.push(saltoAlemPelve(a.po, po, MAOS_A6)); REGUA.cab.push(saltoAlemPelve(a.po, po, CAB_A6));
  }
}
const p999 = l => { const s = Float64Array.from(l).sort(); return s.length ? s[Math.min(s.length - 1, Math.floor(0.999 * s.length))] : NaN; };
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
  // A6 (mãos e cabeça): a última pose do carrinho (o fim do levantar) → a 1ª pose normal de pé, além do que a pelve anda
  {
    const pu = poses[poses.length - 1];
    const sm = saltoAlemPelve(pu, poseFim, MAOS_A6), sc = saltoAlemPelve(pu, poseFim, CAB_A6);
    R.a6n++;
    if (sm > R.a6piorMao) { R.a6piorMao = sm; R.a6exMao = nome; }
    if (sc > R.a6piorCab) { R.a6piorCab = sc; R.a6exCab = nome; }
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
    if (i >= 600) amostrarRegua(mm);
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
// (a régua: a pose normal correndo; o levantar terminava nos braços e no tronco da corrida do aperto — as mãos saltavam ~0,35 m)
const REG_MAO = p999(REGUA.mao), REG_CAB = p999(REGUA.cab);
info('A6 a régua: o salto de um tick além da pelve na pose normal correndo (p99,9): mãos / cabeça', `${f3(REG_MAO)} / ${f3(REG_CAB)} m (${REGUA.cab.length} amostras)`, 'IA × IA, semente 3002, ≥ 4 m/s');
reg('A6 mãos e cabeça no fim (último quadro → pose normal de pé), além da pelve', `${R.a6n} fins; pior mãos ${f3(R.a6piorMao)} m (${R.a6exMao ?? '–'}), cabeça ${f3(R.a6piorCab)} m (${R.a6exCab ?? '–'})`,
  '≤ a régua', R.a6n > 0 && REGUA.cab.length >= 1000 && R.a6piorMao <= REG_MAO && R.a6piorCab <= REG_CAB);

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

// ------------------------------------------------------------------ C, D, F: o homem, a Regra 12 e o determinismo
const FT = await imp('faltas.js');
const RNG = await imp('rng.js');
const BIN = await import(pathToFileURL(path.join(AQUI, 'lib/binomial.mjs')).href);
const FALT = CFG.FALTAS, FK = FALT.carrinho;
const TEM_HOMEM = typeof DF.contatosHomemCarrinho === 'function' && typeof FT.faltaNoCarrinho === 'function';
const pctC = (a, b) => `${a}/${b} (${b ? (100 * a / b).toFixed(1) : '–'}%)`;

// ---- os contatos MONTADOS (D, F2): uma partida em jogo com os outros 20 longe (cada um no seu canto); o carrinho de um jogador
// do time 1 (o plano da entrada v m/s no rumo `ang`, montado `n` ticks antes de agora, o corpo no quadro de agora) e o
// adversário (time 0) com o centro sobre a perna da bola do quadro, virado de través (os pés dele na linha da perna). Chama o
// contato do fim do passo (defesa.js contatosHomemCarrinho) direto, com o gerador numa semente dada.
/** O mundo limpo: a partida (ou o Modo Livre) em jogo, sem parada, os outros longe. O time 0 ataca +x. */
function mundoLimpo({ livre = false, sem = 3201 } = {}) {
  const w = livre ? LV_C.criarLivre({ semente: sem }) : P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  w.partida.estado = 'jogo'; w.parada = null; w.golTick = null; w.voo = null; w.naMao = null; w.posse = null; w.faltaPendente = null; w.eventos = [];
  w.ataca = { 0: 1, 1: -1 }; w.tick = 1000; w.partida.tick0Tempo = 0;
  let n = 0;
  for (const o of w.jogadores) {
    if (o.posicao === 'GOL') P.teleportar(o, o.time === 0 ? -51 : 51, 30, o.time === 0 ? 0 : Math.PI);
    else P.teleportar(o, o.time === 0 ? -48 : -44, -32 + (n++ % 11) * 2.5, 0);
  }
  return w;
}
const linhaDe = (w, t, i = 0) => w.jogadores.filter(o => o.time === t && o.posicao !== 'GOL')[i];
/** O corpo de j no quadro do carrinho de agora. */
function seguirQuadro(w, j) {
  const q = K.quadroCarrinho(j.carrinho, K.tempoCarrinho(j.carrinho, w.tick), K.novoQuadroCarrinho());
  j.x = q.x; j.z = q.z; j.vx = q.vx; j.vz = q.vz; j.rumo = q.yaw;
  return q;
}
/** O carrinho de j: a entrada a v m/s no rumo ang a partir de (x, z), montada n ticks antes de agora. */
function porCarrinho(w, j, { x, z, v, ang, n = 0, aposParada = null, mirou = true, bola = false }) {
  P.teleportar(j, x, z, ang);
  j.vx = v * Math.cos(ang); j.vz = v * Math.sin(ang); j.quadril = CC.hPe;
  j.imag = 1; j.ix = Math.cos(ang); j.iz = Math.sin(ang);
  const c = K.montarCarrinho(j, w.tick - n, { bola: null, prever: null });
  // (aposParada: o plano montado agora e o relógio levado a tS + aposParada s)
  if (aposParada != null) { c.tick0 = w.tick - Math.round((c.tS + aposParada) / PASSO); c.fim = c.tick0 + Math.round((c.tS + c.tChao) / PASSO); }
  c.mirou = mirou;
  if (bola) c.bola = c.tick0 + 2; // tocou a bola logo no começo (o "depois")
  j.carrinho = c;
  seguirQuadro(w, j);
  return c;
}
/** O adversário o com o centro sobre a perna da bola do carrinho de j (fr: 0 tornozelo → 1 ponta; ao m ao longo de u; lat m
 * de lado), virado de través (os pés na linha da perna) ou no rumo `ango`, correndo a vo m/s no rumo `angv` (padrão: o rumo). */
function porNaPerna(w, j, o, { fr = 0.5, ao = 0, lat = 0, vo = 0, ango = null, angv = null } = {}) {
  const c = j.carrinho, q = K.quadroCarrinho(c, K.tempoCarrinho(c, w.tick), K.novoQuadroCarrinho());
  const T = q.to[c.frente], Pp = q.po[c.frente];
  const px = T.x + (Pp.x - T.x) * fr + c.ux * ao - c.uz * lat, pz = T.z + (Pp.z - T.z) * fr + c.uz * ao + c.ux * lat;
  const rumo = ango ?? Math.atan2(c.ux, -c.uz);
  P.teleportar(o, px, pz, rumo);
  const av = angv ?? rumo;
  o.vx = vo * Math.cos(av); o.vz = vo * Math.sin(av);
  o.quadril = A.alturaQuadril(o, w);
}
/** O contato numa cópia com o gerador na semente `sem` (null: o do mundo): {w, c (o plano), h (c.homem), f (a falta)}. */
function contatoEm(w0, idC, sem = null, depois = null) {
  const w = SIM.copiarMundo(w0);
  if (sem != null) w.rng = RNG.criarRng(sem);
  w.eventos = []; w.faltaPendente = null;
  DF.contatosHomemCarrinho(w);
  const j = porIdC(w, idC);
  if (depois) depois(w);
  return { w, c: j.carrinho, h: j.carrinho.homem, f: w.faltaPendente };
}
/** A 1ª semente (de 1 em diante) em que `quer(r)` vale para o resultado do contato. */
function acharSemente(w0, idC, quer, max = 4000) {
  for (let s = 1; s <= max; s++) if (quer(contatoEm(w0, idC, s))) return s;
  return null;
}

if (!TEM_HOMEM) reg('C/D o contato com o homem e a falta (defesa.js contatosHomemCarrinho, faltas.js faltaNoCarrinho)', 'não existe nesta lógica', 'contatosHomemCarrinho', false);
else {
  // ---- D1: a tabela C.1 exata (chanceFaltaCarrinho; o d e o c sintéticos: a chegada pela direção do condutor)
  {
    const mm = { livre: null }, ml = { livre: {} };
    const cond = { x: 0, z: 0, vx: 4, vz: 0, rumo: 0 };
    const de = { frente: { x: 2, z: 0 }, lado: { x: 0, z: 2 }, tras: { x: -2, z: 0 } };
    const rampa = f => Math.max(0, Math.min(1, (f - FALT.forca.min) / (FALT.forca.cheia - FALT.forca.min)));
    const fator = f => rampa(f) * (1 + FALT.forca.porForca * Math.max(0, f - FALT.forca.min));
    const r = [];
    const ok = (nome, obtido, esperado) => r.push([nome, Math.abs(obtido - esperado) < 1e-12, `${f3(obtido)} × ${f3(esperado)}`]);
    for (const ch of ['frente', 'lado', 'tras']) {
      const d = { ...de[ch], vx: 0, vz: 0 };
      for (const v of [3, 6.5]) for (const f of [0.5, 1.25, 3]) {
        ok(`depois ${ch} v${v} f${f}`, FT.chanceFaltaCarrinho(mm, d, cond, { depois: true, f, fExc: 0, v }), Math.min(0.95, FK.depois[ch] * (1 + FK.porVel * Math.max(0, v - FK.vLivre)) * rampa(f)));
        ok(`antes ${ch} v${v} f${f}`, FT.chanceFaltaCarrinho(mm, d, cond, { depois: false, f, fExc: 0, v }), Math.min(0.95, FK.antes * fator(f)));
      }
    }
    ok('goleiro com a bola na mão (f 0)', FT.chanceFaltaCarrinho(mm, de.frente, cond, { depois: true, f: 0, v: 3, naMao: true }), 1);
    ok('Livre: antes f 3', FT.chanceFaltaCarrinho(ml, de.tras, cond, { depois: false, f: 3, v: 6 }), 0);
    ok('Livre: goleiro com a bola na mão', FT.chanceFaltaCarrinho(ml, de.tras, cond, { depois: false, f: 3, v: 6, naMao: true }), 0);
    ok('dois carrinhos f 2', FT.chanceFaltaCarrinho(mm, de.lado, cond, { dois: true, depois: false, f: 2, v: 4 }), 1);
    ok('dois carrinhos f 0,8 (incidental)', FT.chanceFaltaCarrinho(mm, de.lado, cond, { dois: true, depois: false, f: 0.8, v: 4 }), 0);
    const ruins = r.filter(x => !x[1]);
    reg('D1 chanceFaltaCarrinho = a tabela C.1 (antes/depois × chegada × v × f, goleiro na mão 1, Livre 0, dois carrinhos)', `${r.length - ruins.length}/${r.length}${ruins.length ? ': ' + ruins.slice(0, 3).map(x => `${x[0]} ${x[2]}`).join('; ') : ''}`, 'exato', ruins.length === 0);
  }

  // ---- montagem comum: o carrinho do time 1 (j) e o condutor do time 0 (a) sobre a perna dele
  /** Monta: o carrinho de j (time 1) e o adversário a (time 0) na perna; opções do carrinho e do adversário; posse: a bola com a a
   * `bolaD` m à frente dele no rumo da corrida. Devolve {w, j, a} (o contato ainda não rodou). */
  function cena(opcC, opcA = {}, { posse = true, bolaD = 0.4, livre = false, x0 = null } = {}) {
    const w = mundoLimpo({ livre });
    const j = linhaDe(w, 1, 0), a = linhaDe(w, 0, 0);
    porCarrinho(w, j, opcC);
    porNaPerna(w, j, a, opcA);
    if (posse) {
      const v = Math.hypot(a.vx, a.vz), ux = v > 0.1 ? a.vx / v : Math.cos(a.rumo), uz = v > 0.1 ? a.vz / v : Math.sin(a.rumo);
      w.posse = a.id; w.ultimoToque = { id: a.id, time: 0, tick: w.tick - 5 };
      const b = w.bola; b.p.x = a.x + ux * bolaD; b.p.z = a.z + uz * bolaD; b.p.y = RB_C; b.v.x = a.vx; b.v.y = 0; b.v.z = a.vz; b.rolando = true;
    } else { const b = w.bola; b.p.x = 0; b.p.z = 30; b.p.y = RB_C; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true; }
    return { w, j, a };
  }
  // o condutor no ataque (+x) atravessado pela perna: o carrinho vem de lado (−z → +z), no deslize (0,55 s a 5 m/s: ~3,3 m/s)
  const lado = (x, z, opc = {}) => cena({ x, z: z - 2.4, v: 5, ang: Math.PI / 2, n: 33, ...opc.c }, { fr: 0.5, vo: opc.vo ?? 5, angv: 0, ango: 0, ...opc.a }, opc.o);

  // ---- D2: DOGSO (Regra 12.4) — fora da área vermelho; na área tentando a bola (mirou, bola ≤ 2 m) pênalti + amarelo; sem
  // intenção (mirou longe) pênalti + vermelho
  {
    const r = [];
    const caso = (nome, x, mirou, esperado) => {
      const { w, j } = lado(x, 2, { c: { mirou } });
      const s = acharSemente(w, j.id, x2 => !!x2.f, 200);
      const res = s != null ? contatoEm(w, j.id, s) : null;
      const f = res?.f;
      const pen = f ? (() => { const w2 = res.w; P.regrasPartida(w2); return w2.eventos.some(e => e.tipo === 'penaltiMarcado'); })() : false;
      const got = f ? `${f.area ? 'pênalti' : 'tiro livre'} + ${f.cartao ?? 'sem cartão'} '${f.motivo}'${pen ? ' (marcado)' : ''}` : (res?.h ? 'contato sem falta' : 'sem contato');
      r.push([nome, got === esperado, got]);
    };
    caso('fora da área', 28, true, "tiro livre + vermelho 'dogso'");
    caso('na área, tentando a bola', 40, true, "pênalti + amarelo 'dogsoArea' (marcado)");
    caso('na área, sem intenção', 40, false, "pênalti + vermelho 'dogso' (marcado)");
    reg('D2 DOGSO: fora da área vermelho; na área tentando a bola pênalti + amarelo; sem intenção pênalti + vermelho', r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'a Regra 12.4', r.every(x => x[1]));
  }

  // ---- D3: SPA na própria área tentando a bola → pênalti SEM cartão (só no carrinho); fora da área → amarelo 'spa'; a DIVIDIDA
  // e o bote da IA no mesmo lance continuam como hoje (amarelo)
  {
    // o condutor na área correndo para a frente e para fora (não é DOGSO: o ângulo do gol; contra a perna que vem de −z), com
    // 2 defensores à frente (o do carrinho e mais um)
    const montar = x => {
      const { w, j, a } = lado(x, -10, { a: { angv: -0.7, vo: 5.5 } });
      let n = 0;
      for (const o of w.jogadores) if (o.time === 1 && o.posicao !== 'GOL' && o !== j && n < 1) { P.teleportar(o, x + 6 + n, -15 + 3 * n, Math.PI); n++; }
      return { w, j, a };
    };
    const r = [];
    for (const [nome, x, origem, tentou, esperado] of [
      ['carrinho na área, tentando', 42, 'carrinho', true, 'pênalti sem cartão'],
      ['carrinho na área, sem tentar', 42, 'carrinho', false, "pênalti + amarelo 'spa'"],
      ['carrinho fora da área', 28, 'carrinho', true, "tiro livre + amarelo 'spa'"],
      ['DIVIDIDA na área (como hoje)', 42, 'dividida', true, "pênalti + amarelo 'spa'"],
      ['bote da IA na área (como hoje)', 42, 'bote', true, "pênalti + amarelo 'spa'"],
    ]) {
      const { w, j, a } = montar(x);
      const spa = FT.ataquePromissor(w, a) && !FT.chanceClara(w, a, j);
      const f = FT.montarFalta(w, j, a, origem, tentou);
      const got = `${f.area ? 'pênalti' : 'tiro livre'}${f.cartao ? ` + ${f.cartao} '${f.motivo}'` : ' sem cartão'}`;
      r.push([nome, spa && got === esperado, `${got}${spa ? '' : ' (o lance não é SPA!)'}`]);
    }
    // e pelo contato montado (origem 'carrinho' de ponta a ponta: o pênalti marcado e nenhum cartão pendente)
    {
      const { w, j } = montar(42);
      // (o amarelo do temerário sorteado não: ele daria cartão por outro motivo)
      const s = acharSemente(w, j.id, x2 => !!x2.f && x2.f.grau === 'imprudente', 400);
      const res = s != null ? contatoEm(w, j.id, s) : null;
      if (res?.f) P.regrasPartida(res.w);
      const ok = !!res?.f && res.f.origem === 'carrinho' && res.f.cartao == null && res.w.eventos.some(e => e.tipo === 'penaltiMarcado') && res.w.partida.cartoesPendentes.length === 0;
      r.push(['o contato montado na área (mirou)', ok, res?.f ? `${res.f.origem}, cartão ${res.f.cartao}, pênalti ${res.w.eventos.some(e => e.tipo === 'penaltiMarcado')}` : 'sem falta']);
    }
    reg('D3 SPA na área tentando a bola: pênalti SEM cartão só no carrinho; fora da área e a DIVIDIDA/bote: amarelo', r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'a Regra 12.4', r.every(x => x[1]));
  }

  // ---- D4: a vantagem — o condutor segue com a bola indo para a frente (8 m/s; a falta tira metade) → evento vantagem; a falta
  // de força excessiva (fExc ≥ 6: o carrinho a 7 m/s no começo) → apito, sem vantagem
  {
    const r = [];
    {
      const { w, j } = lado(10, 0, { vo: 8 });
      const s = acharSemente(w, j.id, x2 => !!x2.f && x2.f.grau !== 'excessivo', 200);
      const res = contatoEm(w, j.id, s);
      P.regrasPartida(res.w);
      r.push(['falta comum', res.w.eventos.some(e => e.tipo === 'vantagem') && !res.w.parada, res.w.eventos.map(e => e.tipo).join(',')]);
    }
    {
      // o carrinho a 7 m/s no começo (o corpo dele a ≥ 6 m/s na normal do contato), de lado no condutor que corre a 8 m/s
      const { w, j } = lado(10, 0, { vo: 8, c: { v: 7, n: 6 } });
      const s = acharSemente(w, j.id, x2 => !!x2.f && x2.f.grau === 'excessivo', 4000);
      const res = s != null ? contatoEm(w, j.id, s) : null;
      if (res) P.regrasPartida(res.w);
      r.push(['força excessiva', !!res && !res.w.eventos.some(e => e.tipo === 'vantagem') && res.w.eventos.some(e => e.tipo === 'apito'), res ? `fExc ${f2(res.h.fExc)}: ${res.w.eventos.map(e => e.tipo).join(',')}` : 'não achou o excessivo']);
    }
    reg('D4 vantagem: o condutor segue com a bola → vantagem; força excessiva → apito, sem vantagem', r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'vantagem; apito', r.every(x => x[1]));
  }

  // ---- D5: Modo Livre — o contato no homem nunca vira falta (antes da bola com força, o goleiro com a bola na mão), 40 sementes
  {
    let contatos = 0, faltas = 0;
    {
      const { w, j } = lado(10, 0, { o: { livre: true } });
      for (let s = 1; s <= 40; s++) { const r = contatoEm(w, j.id, s); if (r.h) contatos++; if (r.f) faltas++; }
    }
    reg('D5 Modo Livre: contato no homem nunca é falta', `${faltas} faltas em ${contatos} contatos`, '0 (≥ 40 contatos)', faltas === 0 && contatos >= 40);
  }

  // ---- D6: o carrinho por trás no condutor com contato de corpo (os discos se tocam no mesmo passo): uma falta só, origem
  // 'carrinho', nunca 'carga' (a carga não roda com o carrinho) — na partida (passoPartida), 40 sementes
  {
    const origens = {};
    let duas = 0, n = 0;
    for (let s = 1; s <= 40; s++) {
      const w = mundoLimpo({ sem: 3300 + s });
      const j = linhaDe(w, 1, 0), a = linhaDe(w, 0, 0);
      porCarrinho(w, j, { x: 0, z: 0, v: 7, ang: 0, n: 4 });
      // o condutor a 0,45 m à frente do corpo do carrinho (os discos de 0,3 m se tocam: a carga por trás, ≥ 1,8 m/s, seria
      // sorteada no colisaoCorpos; a perna chega nele no 1º passo), andando no mesmo sentido
      P.teleportar(a, j.x + 0.45, j.z + 0.05, 0); a.vx = 1; a.vz = 0;
      AC.assumirControle(w, 0, a);
      w.posse = a.id; const b = w.bola; b.p.x = a.x + 0.4; b.p.z = a.z; b.p.y = RB_C; b.v.x = 1; b.v.y = 0; b.v.z = 0; b.rolando = true;
      w.ultimoToque = { id: a.id, time: 0, tick: w.tick - 5 };
      for (let i = 0; i < 6; i++) {
        const ev = P.passoPartida(w, { x: 0.2, z: 0, botoes: 0 });
        const fs = ev.filter(e => e.tipo === 'falta');
        if (fs.length > 1) duas++;
        for (const f of fs) { origens[f.origem] = (origens[f.origem] ?? 0) + 1; n++; }
        if (fs.length) break;
      }
    }
    const txt = Object.entries(origens).map(([k, v]) => `${k} ${v}`).join(', ') || 'nenhuma';
    reg('D6 carrinho por trás com contato de corpo: uma falta só, origem carrinho, nunca carga', `${n} faltas (${txt}); duas no mesmo passo ${duas}`, "só 'carrinho' (≥ 20)", duas === 0 && !origens.carga && (origens.carrinho ?? 0) >= 20);
  }

  // ---- D7: o vermelho direto — antes da bola com fExc ≥ 6 e o gerador achado por busca (o 1º sorteio < p e o 2º < 0,25) →
  // vermelho 'forcaExcessiva'; com o MESMO gerador: fExc < 6 (o carrinho mais devagar; o atacante a 7 m/s entrando na perna
  // parada) e depois da bola → nunca
  {
    const forte = () => lado(10, 0, { vo: 0, c: { v: 7, n: 6 } });
    // a busca do gerador: os dois primeiros uniformes (a falta e o excessivo) abaixo de p e de excessivoP
    let sem = null;
    for (let s = 1; s < 5000 && sem == null; s++) { const r = RNG.criarRng(s); if (RNG.uniforme(r) < 0.9 && RNG.uniforme(r) < FK.excessivoP) sem = s; }
    const r = [];
    {
      const { w, j } = forte();
      const res = contatoEm(w, j.id, sem);
      r.push(['fExc ≥ 6 antes da bola', res.h && res.h.fExc >= FK.excessivoF && res.f?.cartao === 'vermelho' && res.f.motivo === 'forcaExcessiva', res.h ? `fExc ${f2(res.h.fExc)}: ${res.f ? `${res.f.cartao} ${res.f.motivo}` : 'sem falta'}` : 'sem contato']);
    }
    {
      const { w, j } = forte();
      j.carrinho.bola = j.carrinho.tick0 + 2; // tocou a bola antes
      const res = contatoEm(w, j.id, sem);
      r.push(['depois da bola', res.h && res.f?.cartao !== 'vermelho', res.h ? `${res.f ? `${res.f.cartao ?? 'sem cartão'} ${res.f.motivo}` : 'sem falta'}` : 'sem contato']);
    }
    {
      // o carrinho mais devagar (5 m/s no deslize: ~3,3 m/s)
      const { w, j } = lado(10, 0, { vo: 0 });
      const res = contatoEm(w, j.id, sem);
      r.push(['fExc < 6 (o carrinho a ~3,3 m/s)', res.h && res.h.fExc < FK.excessivoF && res.f?.cartao !== 'vermelho', res.h ? `fExc ${f2(res.h.fExc)}: ${res.f ? `${res.f.cartao ?? 'sem cartão'}` : 'sem falta'}` : 'sem contato']);
    }
    {
      // o atacante a 7 m/s entrando na perna parada (depois da parada): f 7, fExc 0
      const { w, j } = lado(10, 0, { vo: 7, c: { aposParada: 0.1 }, a: { angv: -Math.PI / 2 } });
      const res = contatoEm(w, j.id, sem);
      r.push(['o atacante a 7 m/s na perna parada', res.h && res.h.f >= 6 && res.f && res.f.cartao !== 'vermelho', res.h ? `f ${f2(res.h.f)} fExc ${f2(res.h.fExc)}: ${res.f ? `${res.f.cartao ?? 'sem cartão'}` : 'sem falta'}` : 'sem contato']);
    }
    reg('D7 vermelho direto: fExc ≥ 6 antes da bola (gerador achado) → forcaExcessiva; o mesmo gerador com fExc < 6 ou depois da bola → nunca', `semente ${sem}: ` + r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'vermelho só no 1º', r.every(x => x[1]));
  }

  // ---- D8: o goleiro — deitado (no mergulho de verdade: um estado de partida achado pela demo) o contato vale pelo corpo
  // inteiro (a perna passando pelo tronco/cabeça dele, longe das pernas); com a bola nas mãos, falta em 100% e tiro livre para
  // o time dele (nunca pênalti)
  {
    const r = [];
    // (a) deitado: a demo até um goleiro com a pelve desenhada abaixo de pelveDeitado
    let wm = null, gk = null;
    {
      const mm = P.criarPartida({ semente: 3401, minutosPorTempo: 4 });
      for (let i = 0; i < 30000 && !wm; i++) {
        P.passoPartida(mm, P.entradaDemoPartida(mm));
        if (!(mm.partida.estado === 'jogo' && !(mm.parada && !mm.parada.rolou) && mm.golTick == null)) continue;
        for (const g of mm.jogadores) {
          if (g.posicao !== 'GOL' || !g.mergulho) continue;
          const po = A.pose(g, mm);
          if (po[JJ.pelve * 3 + 1] < CC.pelveDeitado - 0.1) { wm = SIM.copiarMundo(mm); gk = g.id; break; }
        }
      }
    }
    if (!wm) r.push(['goleiro deitado (estado achado)', false, 'não achou em 30000 passos']);
    else {
      const g = porIdC(wm, gk), po = A.pose(g, wm);
      const alvo = { x: po[JJ.lombar * 3], z: po[JJ.lombar * 3 + 2] };
      // o carrinho do outro time com a canela da perna da bola sobre o tronco dele: procura a translação do plano em que a
      // perna toca o tronco/cabeça e fica a ≥ 3 cm das pernas dele (a geometria do teste, independente)
      const segsG = (P0, quais) => quais.map(([a, b, rr]) => [{ x: P0[a * 3], y: P0[a * 3 + 1], z: P0[a * 3 + 2] }, { x: P0[b * 3], y: P0[b * 3 + 1], z: P0[b * 3 + 2] }, rr]);
      const SEGR = A.SEGMENTOS.map(s => [s[0], s[1], Math.max(s[2], s[3])]);
      const pernasG = SEGR.filter(s => [JJ.joelhoE, JJ.tornozeloE, JJ.pontaE, JJ.joelhoD, JJ.tornozeloD, JJ.pontaD].includes(s[1]));
      const troncoG = SEGR.filter(s => !pernasG.includes(s));
      const dSegSeg = (a0, a1, b0, b1) => { let d = Infinity; for (let i = 0; i <= 40; i++) { const t = i / 40, p = { x: a0.x + (a1.x - a0.x) * t, y: a0.y + (a1.y - a0.y) * t, z: a0.z + (a1.z - a0.z) * t }; d = Math.min(d, dPS(p.x, p.y, p.z, b0, b1)); } return d; };
      const folgaG = (q, quais, cab) => {
        let gm = Infinity;
        for (const [a, b, ri] of segsQ(q)) {
          for (const [c0, c1, rr] of segsG(po, quais)) gm = Math.min(gm, dSegSeg(a, b, c0, c1) - RAIO_SEG[ri] - rr);
          if (cab) { const h = { x: po[JJ.cabeca * 3], y: po[JJ.cabeca * 3 + 1], z: po[JJ.cabeca * 3 + 2] }; gm = Math.min(gm, dPS(h.x, h.y, h.z, a, b) - RAIO_SEG[ri] - A.RAIO_CABECA); }
        }
        return gm;
      };
      let achou = null;
      const time = 1 - g.time;
      for (let tent = 0; tent < 400 && !achou; tent++) {
        const ang = (tent % 16) * Math.PI / 8, des = 0.05 * Math.floor(tent / 16);
        const w = SIM.copiarMundo(wm), gg = porIdC(w, gk);
        const j = w.jogadores.find(o => o.time === time && o.posicao !== 'GOL');
        // o plano no deslize (0,6 s), transladado para a canela da perna da bola cair no tronco dele
        const c = porCarrinho(w, j, { x: 0, z: 0, v: 5, ang, n: 36 });
        const q = K.quadroCarrinho(c, K.tempoCarrinho(c, w.tick), K.novoQuadroCarrinho());
        const mx = (q.jo[c.frente].x + q.to[c.frente].x) / 2, mz = (q.jo[c.frente].z + q.to[c.frente].z) / 2;
        const tx = alvo.x - mx + Math.cos(ang + Math.PI / 2) * des, tz = alvo.z - mz + Math.sin(ang + Math.PI / 2) * des;
        c.x0 += tx; c.z0 += tz; c.levX += tx; c.levZ += tz; for (const p0 of c.p0) { p0.x += tx; p0.z += tz; }
        const q2 = seguirQuadro(w, j);
        if (folgaG(q2, troncoG, true) <= -0.01 && folgaG(q2, pernasG, false) >= 0.03) achou = { w, j, gg };
      }
      if (!achou) r.push(['a perna no tronco do goleiro deitado (montagem)', false, 'não montou']);
      else {
        const res = contatoEm(achou.w, achou.j.id, 1);
        r.push(['deitado: a perna no tronco/cabeça (longe das pernas) dá contato', res.h?.id === gk, res.h ? `contato com ${res.h.id === gk ? 'o goleiro' : res.h.id}` : 'sem contato']);
      }
    }
    // (b) o goleiro com a bola nas mãos (de pé, na área dele): a perna nas pernas dele → falta em 100% (40 sementes), tiro livre
    // para o time dele
    {
      const w = mundoLimpo();
      const j = linhaDe(w, 0, 0), g = w.jogadores.find(o => o.time === 1 && o.posicao === 'GOL');
      porCarrinho(w, j, { x: 44, z: 0, v: 3, ang: 0, n: 40 });
      porNaPerna(w, j, g, { fr: 0.5, vo: 0, ango: Math.PI / 2 });
      w.naMao = g.id; w.posse = g.id; g.segura = { desde: w.tick - 10 };
      const b = w.bola; b.p.x = g.x; b.p.z = g.z; b.p.y = 1.0; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = false;
      let faltas = 0, livres = 0, n = 0, fmin = Infinity;
      for (let s = 1; s <= 40; s++) {
        const res = contatoEm(w, j.id, s);
        if (!res.h) continue;
        n++; fmin = Math.min(fmin, res.h.f);
        if (res.f) { faltas++; P.regrasPartida(res.w); const pr = res.w.parada; if (pr && pr.tipo === 'tiroLivre' && pr.time === g.time) livres++; }
      }
      r.push(['bola nas mãos: falta 100%, tiro livre do time dele', n === 40 && faltas === 40 && livres === 40, `${faltas}/${n} faltas (f mínima ${f2(fmin)}), ${livres} tiros livres dele`]);
    }
    reg('D8 goleiro: deitado conta o corpo inteiro; com a bola nas mãos falta sempre e tiro livre do time dele', r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'todos', r.every(x => x[1]));
  }

  // ---- D9: a intenção (Regra 12.4) não muda com a fase da passada — o mesmo lance (o mesmo aperto, mirou) com a bola a 0,4 m e
  // a 1,4 m do pé do condutor no contato: o mesmo cartão (DOGSO na área tentando a bola: amarelo 'dogsoArea')
  {
    const res = [];
    for (const bolaD of [0.4, 1.4]) {
      const { w, j } = lado(40, 2, { o: { bolaD } });
      const s = acharSemente(w, j.id, x2 => !!x2.f, 200);
      const rr = s != null ? contatoEm(w, j.id, s) : null;
      res.push(rr?.f ? `${rr.f.cartao} '${rr.f.motivo}'` : 'sem falta');
    }
    reg('D9 a intenção: a bola a 0,4 m e a 1,4 m do pé do condutor (o mesmo aperto) dão o mesmo cartão', res.join(' × '), "amarelo 'dogsoArea' nos dois", res[0] === res[1] && res[0] === "amarelo 'dogsoArea'");
  }

  // ---- D10: o tropeço — depois da parada (tS), sem ter tocado a bola, o condutor a ≥ 3 m/s entrando na perna parada → falta
  // (chance 0,95); andando a < 1 m/s → incidental (0 faltas); no levantar → sem contato
  {
    // a perna parada (tS + aposParada) com o condutor entrando nela (−z, contra o corpo do carrinho) a vo m/s
    const parado = (vo, aposParada) => lado(10, 0, { vo, c: { aposParada }, a: { angv: -Math.PI / 2 } });
    const conta = ({ w, j }) => { let h = 0, f = 0, p = null; for (let s = 1; s <= 60; s++) { const r = contatoEm(w, j.id, s); if (r.h) { h++; if (p == null) p = FT.chanceFaltaCarrinho(r.w, porIdC(r.w, j.id), porIdC(r.w, r.h.id), { depois: r.h.depois, f: r.h.f, v: 0 }); } if (r.f) f++; } return { h, f, p }; };
    const c3 = conta(parado(3.5, 0.1));
    const c05 = conta(parado(0.8, 0.1));
    // no levantar (0,2 s antes de ficar de pé: o pé da bola sobe e pousa ao lado), a mesma entrada no lugar da perna parada
    const cl = conta(parado(3.5, CC.chaoErrou - 0.2));
    const ok3 = c3.h === 60 && Math.abs(c3.p - 0.95) < 1e-12 && !BIN.provaFora(c3.f, c3.h, 0.85, null);
    reg('D10 tropeço: na perna parada a 3,5 m/s falta (chance 0,95); a 0,8 m/s incidental; no levantar sem contato', `3,5 m/s: ${c3.f}/${c3.h} (chance ${f2(c3.p)}); 0,8 m/s: ${c05.f}/${c05.h}; levantar: ${cl.h} contatos`, '≥ 85% (0,95); 0 (≥ 60 contatos); 0', ok3 && c05.f === 0 && c05.h === 60 && cl.h === 0);
  }

  // ---- D11: dois carrinhos de times opostos que se tocam — sem falta se nenhum ou os dois tocaram a bola; falta de quem NÃO
  // tocou se só um tocou; o mesmo com os lados trocados (espelhado) e nas duas ordens de m.jogadores
  {
    /** Os dois carrinhos de frente um para o outro (o de `t0` vem da esquerda); tocou = [o da esquerda, o da direita]. */
    const doisC = (t0, tocou, inverte) => {
      const w = mundoLimpo();
      const jE = linhaDe(w, t0, 0), jD = linhaDe(w, 1 - t0, 0);
      const cE = porCarrinho(w, jE, { x: -1.6, z: -0.15, v: 5, ang: 0, bola: tocou[0] });
      const cD = porCarrinho(w, jD, { x: 1.6, z: 0.15, v: 5, ang: Math.PI, bola: tocou[1] });
      if (inverte) w.jogadores.reverse();
      // o tick do 1º contato: os dois andam pelo quadro até um contato (cópias, até 1 s)
      const tk0 = w.tick;
      for (let n = 1; n <= 60; n++) {
        w.tick = tk0 + n; seguirQuadro(w, jE); seguirQuadro(w, jD);
        const r = contatoEm(w, jE.id, 7);
        if (r.h) {
          const f = r.f;
          return { h: true, quem: f ? (f.def === jE.id ? 'E' : 'D') : '-', hE: !!porIdC(r.w, jE.id).carrinho.homem, hD: !!porIdC(r.w, jD.id).carrinho.homem, fE: r.c.homem.f };
        }
      }
      return { h: false, quem: 'sem contato' };
    };
    const r = [];
    for (const [tocou, esperado] of [[[false, false], '-'], [[true, true], '-'], [[true, false], 'D'], [[false, true], 'E']]) {
      for (const t0 of [0, 1]) for (const inv of [false, true]) {
        const x = doisC(t0, tocou, inv);
        r.push([`tocou ${tocou.map(b => (b ? 's' : 'n')).join('')} t${t0}${inv ? ' inv' : ''}`, x.h && x.hE && x.hD && x.quem === esperado, x.quem]);
      }
    }
    const ruins = r.filter(x => !x[1]);
    reg('D11 dois carrinhos opostos: falta só de quem NÃO tocou a bola quando o outro tocou; espelhado e nas duas ordens', `${r.length - ruins.length}/${r.length}${ruins.length ? ': ' + ruins.map(x => `${x[0]} → ${x[2]}`).join('; ') : ''}`, 'todos', ruins.length === 0);
  }

  // ---- F2: os sorteios por ORIGEM (o m.rng embrulhado: cada sorteio pela pilha). Sem contato no homem: 0 do carrinho (também na
  // partida, com o bloqueio sorteado nunca para o deslizante); com contato: exatamente 1 da chance (0 < p < 1) + os do cartão
  {
    const r = [];
    const conferir = (nome, w0, idC, sem, espFn) => {
      const w = SIM.copiarMundo(w0);
      w.rng = RNG.criarRng(sem);
      w.eventos = []; w.faltaPendente = null;
      const cnt = contarSorteios(w);
      DF.contatosHomemCarrinho(w);
      cnt.devolver();
      const j = porIdC(w, idC), h = j.carrinho.homem, f = w.faltaPendente;
      const esp = espFn(h, f);
      r.push([nome, cnt.cont.carrinho === esp, `${cnt.cont.carrinho} (esperado ${esp})`]);
    };
    // antes da bola com força: 1 + os do cartão
    { const { w, j } = lado(10, 0); for (const s of [1, 2, 3, 4, 5]) conferir(`antes s${s}`, w, j.id, s, (h, f) => sorteiosEsperados(h, f, false, false, false)); }
    // depois da bola, a força abaixo do mínimo (a chance 0): nenhum
    { const { w, j } = lado(10, 0, { c: { bola: true }, vo: 3.2, a: { angv: Math.PI / 2 } }); conferir('depois, f < mínimo', w, j.id, 1, (h, f) => (h && h.f <= FALT.forca.min ? 0 : sorteiosEsperados(h, f, false, false, false))); }
    // o goleiro com a bola nas mãos: só os do cartão
    {
      const w = mundoLimpo();
      const j = linhaDe(w, 0, 0), g = w.jogadores.find(o => o.time === 1 && o.posicao === 'GOL');
      porCarrinho(w, j, { x: 44, z: 0, v: 3, ang: 0, n: 40 });
      porNaPerna(w, j, g, { fr: 0.5, vo: 0, ango: Math.PI / 2 });
      w.naMao = g.id; w.posse = g.id;
      conferir('goleiro com a bola na mão', w, j.id, 3, (h, f) => sorteiosEsperados(h, f, true, false, false));
    }
    // sem contato (o adversário longe da perna): nenhum
    { const { w, j, a } = lado(10, 0); P.teleportar(a, a.x + 3, a.z, 0); conferir('sem contato', w, j.id, 1, () => 0); }
    // na partida: o carrinho na bola livre, sem ninguém perto (40 passos) — nenhum sorteio do carrinho e o bloqueio sorteado
    // nunca com o deslizante
    {
      const w = mundoLimpo();
      const j = linhaDe(w, 1, 0);
      w.humanos = [0, 1]; P.teleportar(j, 0, 0, 0); j.vx = 5; AC.assumirControle(w, 1, j);
      w.bola.p.x = 2; w.bola.p.z = 0.2;
      const cnt = contarSorteios(w);
      let bloq = 0;
      P.passoPartida(w, { 0: { x: 0, z: 0, botoes: 0 }, 1: { x: 1, z: 0, botoes: B.CARRINHO } });
      const saiu = !!j.carrinho;
      for (let i = 0; i < 40; i++) { P.passoPartida(w, { 0: { x: 0, z: 0, botoes: 0 }, 1: { x: 0, z: 0, botoes: 0 } }); if (w.bloq?.feitos?.includes(j.id)) bloq++; }
      cnt.devolver();
      r.push(['na partida, sem contato no homem', saiu && cnt.cont.carrinho === 0 && bloq === 0, `${saiu ? '' : 'não saiu; '}${cnt.cont.carrinho} sorteios do carrinho (de ${cnt.cont.total}), bloqueio com ele ${bloq}`]);
    }
    const ruins = r.filter(x => !x[1]);
    reg('F2 sorteios por origem: 0 sem contato no homem; com contato 1 da chance + os do cartão', `${r.length - ruins.length}/${r.length}${ruins.length ? ': ' + ruins.map(x => `${x[0]} ${x[2]}`).join('; ') : ''}`, 'todos', ruins.length === 0);
  }

  // ---- F4: online (dois humanos, criarPartida({humanos: [0, 1]})): dois carrinhos apertados no mesmo passo, a mesma geometria
  // com os TIMES trocados (o 1º papel no time 0 e no time 1) — quem toca a bola e quem comete a falta saem pelo PAPEL (a
  // geometria), nunca pelo time: (a) o 1º na bola e o 2º entrando de lado nele depois dela (o 2º faz a falta); (b) os papéis
  // trocados; (c) os dois de frente na bola (os dois a tocam: sem falta)
  {
    const rodar = (t1, [x1, z1, a1, x2, z2, a2]) => {
      const w = P.criarPartida({ semente: 3501, minutosPorTempo: 4, humanos: [0, 1] });
      w.partida.estado = 'jogo'; w.parada = null; w.golTick = null; w.voo = null; w.naMao = null; w.posse = null; w.faltaPendente = null;
      let n = 0;
      for (const o of w.jogadores) P.teleportar(o, o.time === 0 ? -40 : 40, -30 + (n++ % 11) * 6, 0);
      const j1 = linhaDe(w, t1, 3), j2 = linhaDe(w, 1 - t1, 3);
      for (const x of [j1, j2]) { x.par.attr.desarme = 70; x.quadril = CC.hPe; }
      P.teleportar(j1, x1, z1, a1); j1.vx = 5 * Math.cos(a1); j1.vz = 5 * Math.sin(a1);
      P.teleportar(j2, x2, z2, a2); j2.vx = 5 * Math.cos(a2); j2.vz = 5 * Math.sin(a2);
      AC.assumirControle(w, t1, j1); AC.assumirControle(w, 1 - t1, j2);
      const b = w.bola; b.p.x = 0; b.p.z = 0; b.p.y = RB_C; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true;
      const ents = bt => ({ [t1]: { x: Math.cos(a1), z: Math.sin(a1), botoes: bt }, [1 - t1]: { x: Math.cos(a2), z: Math.sin(a2), botoes: bt } });
      P.passoPartida(w, ents(B.CARRINHO));
      const c1 = j1.carrinho, c2 = j2.carrinho;
      if (!c1 || !c2) return 'não saiu';
      let falta = null;
      for (let i = 0; i < 90 && !falta; i++) falta = P.passoPartida(w, ents(0)).find(e => e.tipo === 'falta') ?? null;
      const bola = c1.bola >= 0 && c2.bola >= 0 ? (c1.bola < c2.bola ? '1 e 2' : c2.bola < c1.bola ? '2 e 1' : 'juntos') : c1.bola >= 0 ? '1' : c2.bola >= 0 ? '2' : '-';
      return `bola ${bola}, falta ${falta ? (falta.def === j1.id ? '1' : falta.def === j2.id ? '2' : '?') : '-'}`;
    };
    const r = [];
    const L = Math.PI / 2;
    for (const [nome, g] of [['(a) 1º na bola, 2º de lado', [-1.9, 0, 0, -0.5, -2.2, L]], ['(b) os papéis trocados', [-0.5, -2.2, L, -1.9, 0, 0]], ['(c) de frente', [-1.9, 0.05, 0, 2.5, -0.05, Math.PI]]]) {
      const a = rodar(0, g), b = rodar(1, g);
      r.push([nome, a === b, `1º no time 0: ${a}; no time 1: ${b}`]);
    }
    const algumaFalta = r.some(x => /falta [12]/.test(x[2]));
    reg('F4 online: dois carrinhos com os times trocados — quem toca a bola e quem faz a falta pelo papel, não pelo time', r.map(x => `${x[0]}: ${x[2]}`).join('; '), 'iguais (≥ 1 falta)', r.every(x => x[1]) && algumaFalta);
  }
}

// ---- C: o canhão contra o condutor (a metade de baixo dos estados aqui, a de cima no filho) e o Modo Livre (C7)
if (TEM_HOMEM) {
  const meu = canhaoC(0, Math.min(1, MEIO_C), { f2: true });
  const resto = MEIO_C > 1 ? canhaoC(1, MEIO_C) : { casos: [], nan: 0, f3: 0 };
  const deles = filhoC ? await filhoC : { casos: [], nan: 0, f3: 0 };
  const todos = [...meu.casos, ...resto.casos, ...deles.casos];
  const semEstado = todos.filter(x => x.sem).length, s = todos.filter(x => x.saiu);
  const naoSaiu = todos.filter(x => !x.sem && !x.saiu).length;
  info('C canhão: estados × casos (o carrinho saiu)', `${K_C - semEstado} estados, ${s.length} carrinhos (não saiu ${naoSaiu})`, '16 × 36 = 576');
  // C1: o encontro no espaço-tempo pelo FANTASMA (a bola chega à perna antes de a perna chegar ao homem)
  // (o encontro: um instante de verdade, nG ≥ 1; o longe: a bola tocável em algum instante e sempre a ≥ 1 m)
  const enc = s.filter(x => x.nG >= 1 && x.dG <= RB_C && (x.hT < 0 || x.nG <= x.hT));
  const encHomem = s.filter(x => x.nG >= 1 && x.dG <= RB_C && x.hT >= 0 && x.nG > x.hT);
  const longe = s.filter(x => Number.isFinite(x.dG) && x.dG >= 1.0);
  const tocaEnc = enc.filter(x => x.toca).length, tocaLonge = longe.filter(x => x.toca).length;
  reg('C1 encontro (a bola do fantasma na perna da bola no MESMO instante, antes do homem): toca', pctC(tocaEnc, enc.length), '≥ 85% (pela prova, p < 5%)', enc.length >= 20 && !BIN.provaFora(tocaEnc, enc.length, 0.85, null));
  reg('C1 longe (a menor distância no mesmo instante ≥ 1,0 m): toca', pctC(tocaLonge, longe.length), '≤ 5% (pela prova)', longe.length >= 50 && !BIN.provaFora(tocaLonge, longe.length, null, 0.05));
  if (DETALHE) for (const x of enc.filter(x => !x.toca)) console.log(`C1 encontro sem toque: estado ${x.k} ${x.d} m ${x.l} ${x.v} m/s — encontro no tick ${x.nG} (${f2(x.dG)} m), homem ${x.hT}, a bola de A ≠ a do fantasma desde ${x.div}`);
  info('C1 o encontro com o homem antes (a perna chegou ao homem primeiro): toca', pctC(encHomem.filter(x => x.toca).length, encHomem.length), 'a falta apitada mata a bola');
  const encD = s.filter(x => Number.isFinite(x.dD) && x.dD <= RB_C);
  info('C1 pela cópia da DEMO (o controlado de pé pela IA; a especificação): encontro toca', pctC(encD.filter(x => x.toca).length, encD.length), 'o condutor reage ao defensor de pé');
  // C2–C5 (informativas): todos e o alcançável (o fantasma a ≤ 0,3 m)
  const alc = s.filter(x => Number.isFinite(x.dG) && x.dG <= 0.3);
  const fal = s.filter(x => x.fal), falA = alc.filter(x => x.fal);
  info('C2 toca a bola: todos / alcançável', `${pctC(s.filter(x => x.toca).length, s.length)} / ${pctC(alc.filter(x => x.toca).length, alc.length)}`, 'Wyscout contra o condutor: 45,8%');
  info('C3 o time do carrinho com a bola 2 s depois: todos / alcançável', `${pctC(s.filter(x => x.com === 0).length, s.length)} / ${pctC(alc.filter(x => x.com === 0).length, alc.length)}`, '20,3% ganhou; 22,8% no lance seguinte');
  info('C3 desarme (dividida ganhou: a bola tirada do condutor)', pctC(s.filter(x => x.ganhou).length, s.length), '—');
  info('C4 falta: todos / alcançável', `${pctC(fal.length, s.length)} / ${pctC(falA.length, alc.length)}`, 'Wyscout: 19,8% contra o condutor');
  info('C5 amarelo / falta; vermelho direto / falta', `${pctC(fal.filter(x => x.fal.cartao === 'amarelo').length, fal.length)}; ${pctC(fal.filter(x => x.fal.motivo === 'forcaExcessiva').length, fal.length)}`, '39,9%; 1,4%');
  const motivos = {};
  for (const x of fal) { const k = `${x.fal.cartao ?? 'sem'}:${x.fal.motivo}`; motivos[k] = (motivos[k] ?? 0) + 1; }
  info('C5 as faltas do canhão por cartão:motivo', Object.entries(motivos).map(([k, v]) => `${k} ${v}`).join(', '), '—');
  // C6: as condicionais pela regra
  const comH = s.filter(x => x.h);
  const antesF = comH.filter(x => !x.h.depois && x.h.f >= 1.5 && !x.h.naMao), frenteD = comH.filter(x => x.h.depois && x.h.ch === 'frente');
  const fA = antesF.filter(x => x.h.falta).length, fF = frenteD.filter(x => x.h.falta).length;
  reg('C6 antes da bola com f ≥ 1,5 m/s: falta', pctC(fA, antesF.length), '≥ 85% (chance 0,95; pela prova)', antesF.length >= 20 && !BIN.provaFora(fA, antesF.length, 0.85, null));
  reg('C6 de frente tocando a bola primeiro: falta', pctC(fF, frenteD.length), '≤ 15% (pela prova)', frenteD.length >= 5 && !BIN.provaFora(fF, frenteD.length, null, 0.15));
  const semHfalta = s.filter(x => !x.h && x.fal).length, foraOrigem = fal.filter(x => x.fal.origem !== 'carrinho').length;
  reg('C6 sem contato no homem: falta do carrinho (exato)', `${semHfalta} (faltas dele com outra origem: ${foraOrigem})`, '0', semHfalta === 0 && foraOrigem === 0);
  const tras = comH.filter(x => x.h.ch === 'tras');
  info('C6 por trás, todos os contatos: falta', pctC(tras.filter(x => x.h.falta).length, tras.length), 'Fuller B-si 42,5%');
  info('C contato no homem (o 1º): todos', `${pctC(comH.length, s.length)}; antes ${comH.filter(x => !x.h.depois).length}, depois ${comH.filter(x => x.h.depois).length}`, '—');
  // C7: nenhum NaN; o Modo Livre (1 estado do canhão no Livre): nenhuma falta
  const liv = canhaoC(0, 3, { livre: true });
  const lsaiu = liv.casos.filter(x => x.saiu), lfal = lsaiu.filter(x => x.fal).length, lh = lsaiu.filter(x => x.h).length;
  const nan = meu.nan + resto.nan + deles.nan + liv.nan;
  reg('C7 nenhum NaN; Modo Livre: nenhuma falta (3 estados × 36 no Livre)', `NaN ${nan}; Livre: ${lfal} faltas em ${lh} contatos (${lsaiu.length} carrinhos)`, '0; 0 (≥ 5 contatos)', nan === 0 && lfal === 0 && lh >= 5);
  // F2 no canhão (o estado 0): os sorteios do carrinho na partida = os esperados pelo contato
  const f2c = meu.casos.filter(x => x.f2), f2ruins = f2c.filter(x => x.f2.obs !== x.f2.esp);
  reg('F2 na partida (o estado 0 do canhão): os sorteios do carrinho = os esperados pelo contato', `${f2c.length - f2ruins.length}/${f2c.length} casos (${f2c.reduce((a, x) => a + x.f2.obs, 0)} sorteios)${f2ruins.length ? '; ' + f2ruins.slice(0, 3).map(x => `${x.d}/${x.l}/${x.v}: ${x.f2.obs}×${x.f2.esp}`).join(', ') : ''}`, 'todos (≥ 20 casos)', f2c.length >= 20 && f2ruins.length === 0);
  // F3: o caminho do carrinho sem Math não exato (o passo do mundo em todos os casos do canhão, nos dois processos)
  const f3n = chamadasF3 + deles.f3;
  reg('F3 o passo com o carrinho não chama Math não exato (sin, cos, atan2, hypot, exp…)', `${f3n} chamadas${ondeF3.size ? ': ' + [...ondeF3.keys()].slice(0, 3).join('; ') : ''}`, '0', f3n === 0);
}

// ------------------------------------------------------------------ G: as cenas continuam o deslize
// As cenas copiam o mundo (comemoracao.js copiaJogador; cena-atores.js, cena-cartao.js, cena-fim.js, substituicao.js) e andam
// o resto do carrinho pelo MESMO quadro da simulação, no relógio delas (a cópia do plano sem o `congela`), sem escrever no plano
// do mundo; a reação e os gestos só depois de ficar de pé. O deslizante: o controlado do time 0 contra o condutor do time 1 do
// estado posse1 da parte E, alguns passos depois do aperto.
const CM = await imp('comemoracao.js');
let CA = null, CCt = null, SUB = null, EL = null;
try { CA = await imp('cena-atores.js'); CCt = await imp('cena-cartao.js'); SUB = await imp('substituicao.js'); EL = await imp('elenco.js'); } catch { CA = null; }
const TEM_G = !!CA && typeof CA.noCarrinho === 'function' && typeof CM.RAMPA_CARRINHO === 'number';
const { isDeepStrictEqual } = await import('node:util');
const JP = A.J.pelve * 3;
/** O deslizante `n` passos depois do aperto, com o carrinho ainda em andamento: {w, j} ou null. */
function deslizante(n) {
  const ap = ESTADOS.posse1 && apertar(ESTADOS.posse1, w => { const d = porId(w, w.posse); return linhaPerto(w, d.x, d.z); });
  if (!ap) return null;
  for (let i = 0; i < n && ap.j.carrinho; i++) passo(ap.w, entPara(ap.j, ap.w.bola.p.x, ap.w.bola.p.z, 0));
  return ap.j.carrinho && K.carrinhoAtivo(ap.j, ap.w.tick + 1) ? ap : null;
}
/**
 * Anda a cena (passo(c) um tick) e mede o ator `a` (copiado de jm, o deslizante do mundo w): o 1º quadro da cena contra a pose
 * do mundo no tick da cópia; o salto da pelve desenhada além do centro por tick; a pelve fora do quadro da cópia enquanto ele
 * está no carrinho; os GESTOS — a pose desenhada contra a pose sem gestos (anim.js pose, pura: a do quadro no carrinho, a da
 * locomoção de pé) — no carrinho e no 1º tick de pé (a rampa começa do 0: as duas exatas); o salto das mãos além da pelve
 * depois (a rampa) e, das mãos e da cabeça, no tick do fim do quadro (o anim.js poseCarrinho); o tick da 1ª pose de pé; a pelve no fim.
 */
const _qG = K.novoQuadroCarrinho(), _poseG = new Float32Array(A.NJ * 3);
const MAOS_G = [A.J.maoE * 3, A.J.maoD * 3];
function medirCena(c, a, w, jm, passos, passoC) {
  const p0 = A.pose(jm, w);
  const r = { entrada: Math.hypot(a.atu[JP] - p0[JP], a.atu[JP + 1] - p0[JP + 1], a.atu[JP + 2] - p0[JP + 2]), salto: 0, foraQuadro: 0,
    noCarr0: !!a.noCarrinho, kPe: -1, ticksCarr: 0, pelveFim: 0, n: 0, gestoChao: 0, gestoPe: 0, saltoMao: 0, saltoFim: 0, saltoCab: 0 };
  const ant = Float32Array.from(a.atu);
  let cx = a.j.x, cz = a.j.z;
  for (let k = 0; k < passos; k++) {
    if (passoC(c) === false) break;
    r.n++;
    const o = a.atu, j = a.j;
    const dpx = o[JP] - ant[JP], dpy = o[JP + 1] - ant[JP + 1], dpz = o[JP + 2] - ant[JP + 2];
    r.salto = Math.max(r.salto, Math.hypot(dpx - (j.x - cx), dpy, dpz - (j.z - cz)));
    let sm = 0;
    for (const i of MAOS_G) sm = Math.max(sm, Math.hypot(o[i] - ant[i] - dpx, o[i + 1] - ant[i + 1] - dpy, o[i + 2] - ant[i + 2] - dpz));
    const sc = saltoAlemPelve(ant, o, CAB_A6);
    ant.set(o); cx = j.x; cz = j.z;
    A.pose(j, c.mF, _poseG);
    let dif = 0;
    for (let i = 0; i < o.length; i++) dif = Math.max(dif, Math.abs(o[i] - _poseG[i]));
    if (a.noCarrinho) {
      r.ticksCarr++;
      r.gestoChao = Math.max(r.gestoChao, dif);
      K.quadroCarrinho(j.carrinho, K.tempoCarrinho(j.carrinho, c.mF.tick), _qG);
      r.foraQuadro = Math.max(r.foraQuadro, Math.hypot(o[JP] - _qG.x, o[JP + 1] - _qG.h, o[JP + 2] - _qG.z));
    } else if (r.kPe < 0) { r.kPe = c.k; r.gestoPe = dif; r.saltoFim = sm; r.saltoCab = sc; }
    else r.saltoMao = Math.max(r.saltoMao, sm);
  }
  r.pelveFim = a.atu[JP + 1];
  return r;
}
const txtCena = r => `entrada ${f3(r.entrada)} m, salto ${f3(r.salto)} m/tick, fora do quadro ${r.foraQuadro.toExponential(1)} m, ${r.ticksCarr} ticks no carrinho, de pé no tick ${r.kPe} (pelve ${f2(r.pelveFim)}); gesto no chão ${r.gestoChao.toExponential(1)}, no 1º tick de pé ${r.gestoPe.toExponential(1)} m; mãos depois ${f3(r.saltoMao)} m/tick; no fim do quadro mãos / cabeça ${f3(r.saltoFim)} / ${f3(r.saltoCab)} m`;
const okCena = r => r.noCarr0 && r.entrada <= 0.1 && r.salto <= 0.1 && r.foraQuadro <= 1e-4 && r.ticksCarr >= 10 && r.kPe > 0 && r.pelveFim >= 0.85
  && r.gestoChao <= 1e-6 && r.gestoPe <= 1e-6 && r.saltoMao <= 0.15 && r.saltoFim <= REG_MAO && r.saltoCab <= REG_CAB;
const META_CENA = 'entrada e salto ≤ 0,1 m; pelve = quadro; de pé ≥ 0,85; sem gesto no chão nem no 1º tick de pé; mãos ≤ 0,15 m/tick; no fim do quadro ≤ a régua (A6)';
/** A cena das cena-atores com todos copiados e parados (sem gestos): a base do cartão e do fim. */
function cenaParada(w, prep = null) {
  const c = CA.criarBase(w);
  for (const o of w.jogadores) CA.adicionarJogador(c, o, 'resto');
  if (prep) prep(c);
  for (const a of c.atores) CA.poseInicial(c, a);
  return c;
}
const desejoParado = (c, a) => CA.parar(c, a);
// (os dois braços para o céu o tempo todo, em todos: quem está no carrinho não gesticula e de pé os braços sobem na rampa)
const gestoCeu = (c, a) => CA.gCeu(a.atu, a.j.rumo, 1);
const passoParada = c => CA.passoAtores(c, desejoParado, gestoCeu);

if (!TEM_G) reg('G as cenas continuam o deslize (cena-atores.js noCarrinho, comemoracao.js RAMPA_CARRINHO)', 'não existe nesta lógica', 'existe', false);
else {
  // ---- G1: a cópia no meio do carrinho (cena-atores: o molde do cartão e do fim) — com o plano do mundo como está e com o
  // `congela` do apito (partida.js fimDoTempo): a cena anda o deslize, o chão e o levantar pelo quadro da CÓPIA e o plano do
  // mundo fica igual (comparação profunda) depois de 200 passos
  for (const [nome, congela] of [['no meio do jogo', false], ['com o congela do apito', true]]) {
    const st = deslizante(12);
    if (!st) { reg(`G1 cópia no meio do carrinho (${nome})`, 'sem deslizante', 'existe', false); continue; }
    if (congela) st.j.carrinho.congela = st.w.tick;
    const antes = structuredClone(st.j.carrinho);
    const c = cenaParada(st.w);
    const a = c.porId.get(st.j.id);
    const r = medirCena(c, a, st.w, st.j, 200, passoParada);
    const igual = isDeepStrictEqual(st.j.carrinho, antes);
    reg(`G1 cópia no meio do carrinho (${nome}; gestos o tempo todo): o quadro da cópia até de pé; o plano do mundo igual depois de 200 passos`, `${txtCena(r)}; mundo ${igual ? 'igual' : 'MUDOU'}`,
      META_CENA + '; mundo igual', okCena(r) && igual);
  }

  // ---- G3: a comemoração com um DEFENSOR no carrinho no tick do gol (o gol do time 1): G1 na cena do gol
  {
    const st = deslizante(12);
    const cond = st && (porId(st.w, st.w.posse) ?? st.w.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL'));
    if (!st || !cond) reg('G3 comemoração com um defensor no carrinho', 'sem deslizante', 'existe', false);
    else {
      const antes = structuredClone(st.j.carrinho);
      const c = CM.criarCena(CM.planejarComemoracao(st.w, { tipo: 'gol', time: 1, id: cond.id, tick: st.w.tick }, {}), st.w);
      const a = c.atores.find(x => x.id === st.j.id);
      const r = medirCena(c, a, st.w, st.j, 300, CM.passoCena);
      const igual = isDeepStrictEqual(st.j.carrinho, antes);
      reg('G3 comemoração com um defensor no carrinho no tick do gol (G1; o gesto de quem sofreu começa a 0,6 s)', `${txtCena(r)}; mundo ${igual ? 'igual' : 'MUDOU'}`, 'como G1', okCena(r) && igual);
    }
  }

  // ---- G3b: a comemoração com o AUTOR do gol no carrinho (o gol do time 0, dele): a corrida e a finalização só depois do
  // levantar; depois do fim ele não fica preso (nem fixo nem no carrinho: cede e a lente o tratam como quem corre)
  {
    const st = deslizante(12);
    if (!st) reg('G3b comemoração com o autor no carrinho', 'sem deslizante', 'existe', false);
    else {
      const plano = CM.planejarComemoracao(st.w, { tipo: 'gol', time: 0, id: st.j.id, tick: st.w.tick }, { variante: 'bracos' });
      const c = CM.criarCena(plano, st.w);
      const a = c.autor;
      let finalNoChao = 0, kPe = -1, presoDepois = 0, d0 = null, dMin = Infinity, noCarr0 = !!a.noCarrinho, vMax = 0;
      for (let k = 0; k < 420 && CM.passoCena(c); k++) {
        if (a.noCarrinho) { if (c.kFinal >= 0) finalNoChao++; continue; }
        if (kPe < 0) { kPe = c.k; d0 = Math.hypot(a.j.x - plano.alvo.x, a.j.z - plano.alvo.z); }
        if (a.fixo || a.noCarrinho) presoDepois++;
        if (c.k - kPe <= 90) { dMin = Math.min(dMin, Math.hypot(a.j.x - plano.alvo.x, a.j.z - plano.alvo.z)); vMax = Math.max(vMax, Math.hypot(a.j.vx, a.j.vz)); }
      }
      const corre = d0 != null && d0 - dMin >= 1.5;
      reg('G3b comemoração com o AUTOR no carrinho: a finalização (e o abraço) só depois do levantar; depois, ele corre e não fica preso',
        `no carrinho no começo ${noCarr0 ? 'sim' : 'não'}; finalização com ele no chão ${finalNoChao} ticks; de pé no tick ${kPe}, finalização no ${c.kFinal}; em 1,5 s de pé ${d0 != null ? f2(d0 - dMin) : '–'} m para o alvo (v máx ${f2(vMax)}); preso depois do fim ${presoDepois} ticks`,
        'sim; 0; kFinal ≥ de pé; ≥ 1,5 m; 0', noCarr0 && finalNoChao === 0 && kPe > 0 && c.kFinal >= kPe && corre && presoDepois === 0);
    }
  }

  // ---- G2: a cena do CARTÃO com o punido no chão (o carrinho faltoso — o caso comum). O cartão amarelo do próprio deslizante
  // no tick da falta (as entradas do canhão C no estado posse1, a que deixa mais carrinho pela frente), a variação 'aceita'
  // (a desculpa começa antes do plano 'reacao': a mais exigente): a reação (os gestos) só depois de ele ficar de pé e por
  // ≥ 0,5 s (a janela da desculpa é 0,8 s), sem salto da pelve nem das mãos; o árbitro, fixo no fim do cartão no alto, a
  // ≤ 0,3 m do ponto do plano (a paradaPrevista: o fim do quadro, não a freada de quem corre)
  {
    let g = null, nCasos = 0;
    // (os estados: a partida da parte E, semente 3102, com a bola no pé de um jogador de linha do time 1, a cada ≥ 700 passos
    // a partir do 600 — o 1º, o posse1 da parte E, não dá cartão em nenhuma das 60 entradas)
    const mm = P.criarPartida({ semente: 3102, minutosPorTempo: 4 });
    let ultimo = -1e9;
    procura: for (let i = 0; i < 12000; i++) {
      P.passoPartida(mm, P.entradaDemoPartida(mm));
      if (mm.tick < 600 || mm.tick - ultimo <= 700) continue;
      const dm = mm.posse != null ? porId(mm, mm.posse) : null;
      if (!(mm.partida.estado === 'jogo' && !(mm.parada && !mm.parada.rolou) && mm.golTick == null && mm.naMao == null && dm && dm.time === 1 && dm.posicao !== 'GOL')) continue;
      ultimo = mm.tick;
      const base = SIM.copiarMundo(mm);
      for (const dist of [2.0, 2.5, 3.0, 3.5]) for (const ang of [Math.PI, 2.6, -2.6, Math.PI / 2, -Math.PI / 2]) for (const vel of [6.5, 5.5, 4.5]) {
      nCasos++;
      const w = SIM.copiarMundo(base), d = porId(w, w.posse);
      const vc = Math.hypot(d.vx, d.vz), dx0 = vc >= 1 ? d.vx / vc : Math.cos(d.rumo), dz0 = vc >= 1 ? d.vz / vc : Math.sin(d.rumo);
      const ux = dx0 * Math.cos(ang) - dz0 * Math.sin(ang), uz = dx0 * Math.sin(ang) + dz0 * Math.cos(ang);
      const b0 = w.bola.p, px = b0.x + ux * dist, pz = b0.z + uz * dist, j = linhaPerto(w, b0.x, b0.z);
      const rx = b0.x - px, rz = b0.z - pz, rl = Math.hypot(rx, rz) || 1;
      P.teleportar(j, px, pz, Math.atan2(rz, rx)); j.vx = vel * rx / rl; j.vz = vel * rz / rl;
      if (!AC.assumirControle(w, 0, j)) continue;
      passo(w, { x: rx / rl, z: rz / rl, botoes: B.CARRINHO });
      if (!j.carrinho) continue;
      for (let n = 0; n < 200 && j.carrinho; n++) {
        const ev = passo(w, { x: 0, z: 0, botoes: 0 });
        const cart = CCt.escolherCartao(ev);
        if (!cart) continue;
        if (cart.id === j.id && cart.cor === 'amarelo' && K.carrinhoAtivo(j, w.tick + 1)) {
          const resto = (j.carrinho.fim + 1 - w.tick) * PASSO;
          if (!g || Math.abs(resto - 2.0) < Math.abs(g.resto - 2.0)) g = { w: SIM.copiarMundo(w), cart, resto, tick: base.tick };
          if (resto >= 1.8 && resto <= 2.15) break procura;
        }
        break;
      }
      }
    }
    if (!g) reg('G2 cena do cartão com o punido no carrinho', 'nenhum amarelo do deslizante no carrinho achado', 'achado', false);
    else {
      const plano = CCt.planejarCartao(g.w, g.cart, { variante: 'aceita' });
      const c = CCt.criarCenaCartao(plano, g.w);
      const pun = c.punido, T = plano.tempos, tmp = new Float32Array(A.NJ * 3);
      const MAOS = [A.J.maoE * 3, A.J.maoD * 3];
      let kPe = -1, kGesto = -1, ativo = 0, gestoNoChao = 0, salto = 0, saltoMao = 0, saltoFim = 0, saltoCab = 0, arbErro = null, noCarr0 = !!pun.noCarrinho;
      const ant = Float32Array.from(pun.atu);
      for (let k = 0; k < 1500 && !c.acabou; k++) {
        CCt.passoCenaCartao(c);
        const o = pun.atu;
        if (pun.recriado !== c.k) {
          const dpx = o[JP] - ant[JP], dpy = o[JP + 1] - ant[JP + 1], dpz = o[JP + 2] - ant[JP + 2];
          salto = Math.max(salto, Math.hypot(dpx - (pun.x1 - pun.x0), dpy, dpz - (pun.z1 - pun.z0)));
          // (o tick da 1ª pose de pé à parte: o salto do fim do quadro para a pose normal é do anim.js poseCarrinho, no mundo
          // também — a régua do A6 abaixo)
          const transicao = !pun.noCarrinho && kPe < 0;
          for (const i of MAOS) {
            const sm = Math.hypot(o[i] - ant[i] - dpx, o[i + 1] - ant[i + 1] - dpy, o[i + 2] - ant[i + 2] - dpz);
            if (transicao) saltoFim = Math.max(saltoFim, sm); else saltoMao = Math.max(saltoMao, sm);
          }
          if (transicao) { const ic = A.J.cabeca * 3; saltoCab = Math.hypot(o[ic] - ant[ic] - dpx, o[ic + 1] - ant[ic + 1] - dpy, o[ic + 2] - ant[ic + 2] - dpz); }
        }
        ant.set(o);
        // o gesto: as mãos fora da pose sem gestos (a da locomoção, ou a do quadro no carrinho: anim.js pose, pura)
        A.pose(pun.j, c.mF, tmp);
        let dif = 0;
        for (const i of MAOS) dif = Math.max(dif, Math.hypot(o[i] - tmp[i], o[i + 1] - tmp[i + 1], o[i + 2] - tmp[i + 2]));
        if (pun.noCarrinho) { if (dif > 0.02) gestoNoChao++; continue; }
        if (kPe < 0) kPe = c.k;
        if (dif > 0.02) { if (kGesto < 0) kGesto = c.k; ativo++; }
        if (c.arbFixo && arbErro == null) arbErro = Math.hypot(c.arbitro.j.x - plano.arb.x1, c.arbitro.j.z - plano.arb.z1);
      }
      if (arbErro == null && c.arbFixo) arbErro = Math.hypot(c.arbFixo.x - plano.arb.x1, c.arbFixo.z - plano.arb.z1);
      info('G2 o caso (amarelo do deslizante; o carrinho que falta no tick do cartão; o atraso da reação)', `estado @${g.tick}, ${nCasos} entradas; ${f2(g.resto)} s de carrinho; atraso ${f2(c.atrasoPun)} s; variação ${plano.variante}`, 'a desculpa começa a T.alto + 0,5 = ' + f2(T.alto + 0.5) + ' s');
      reg('G2 cena do cartão com o punido no chão: a reação depois de ele ficar de pé, sem salto; o árbitro no ponto do plano',
        `no carrinho no começo ${noCarr0 ? 'sim' : 'não'}; gesto no chão ${gestoNoChao} ticks; de pé no tick ${kPe}, 1º gesto no ${kGesto}; gestos ${f2(ativo * PASSO)} s; salto pelve ${f3(salto)} / mãos ${f3(saltoMao)} m/tick; árbitro a ${arbErro != null ? f2(arbErro) : '–'} m do ponto`,
        'sim; 0; gesto > de pé; ≥ 0,5 s; ≤ 0,1 / ≤ 0,15; ≤ 0,3 m', noCarr0 && gestoNoChao === 0 && kPe > 0 && kGesto > kPe && ativo * PASSO >= 0.5 && salto <= 0.1 && saltoMao <= 0.15 && arbErro != null && arbErro <= 0.3);
      reg('G2 a última pose do carrinho → a 1ª de pé (anim.js poseCarrinho; o mesmo no mundo): mãos / cabeça além da pelve', `${f3(saltoFim)} / ${f3(saltoCab)} m`, `≤ a régua (A6: ${f3(REG_MAO)} / ${f3(REG_CAB)} m)`, kPe > 0 && saltoFim <= REG_MAO && saltoCab <= REG_CAB);
    }
  }

  // ---- G4: teleportar (partida.js) zera o plano e o quadril — de pé no ponto novo, sem a pelve subindo do chão; a cópia da
  // cena de substituição (a troca na parada da falta dele) começa DE PÉ no lugar, e o plano do mundo fica
  {
    const st = deslizante(12);
    if (!st) reg('G4 teleportar e a substituição', 'sem deslizante', 'existe', false);
    else {
      // a substituição: uma troca do time 1 montada (o reserva que entrou já está na vaga, como depois do aplicarPendentes)
      const antes = structuredClone(st.j.carrinho);
      const w = st.w, emCampo = new Set(w.jogadores.map(o => o.id));
      const entra = w.jogadores.find(o => o.time === 1 && o.posicao !== 'GOL' && o.id !== w.posse);
      let sai = null;
      for (let id = 101; id <= 123 && sai == null; id++) if (!emCampo.has(id) && EL.fichaDe(id)) sai = id;
      let txtS = 'sem troca montada', okS = false;
      if (entra && sai != null) {
        const pares = [{ tipo: 'substituicao', time: 1, sai, entra: entra.id }];
        const plS = SUB.planejarSubstituicao(w, pares, { timeHumano: 0, posAntes: id => (id === sai ? { x: entra.x, z: entra.z } : null) });
        const cs = SUB.criarCenaSubst(plS, w);
        const a = cs.atores.find(x => x.id === st.j.id);
        const pe = a.j.pes.every(p => p.apoio), v = Math.hypot(a.j.vx, a.j.vz), pel = a.atu[JP + 1];
        const igual = isDeepStrictEqual(st.j.carrinho, antes);
        okS = !a.j.carrinho && pe && v === 0 && pel >= 0.85 && Math.hypot(a.j.x - st.j.x, a.j.z - st.j.z) < 1e-9 && igual;
        txtS = `cópia: plano ${a.j.carrinho ? 'FICOU' : 'null'}, pés ${pe ? 'plantados' : 'no ar'}, v ${f2(v)}, pelve ${f2(pel)} no mesmo ponto; mundo ${igual ? 'igual' : 'MUDOU'}`;
      }
      // o teleportar do mundo
      P.teleportar(st.j, st.j.x + 5, st.j.z, st.j.rumo);
      const zerou = st.j.carrinho == null && st.j.quadril == null;
      passo(w, { x: 0, z: 0, botoes: 0 });
      const q1 = st.j.quadril, pel1 = A.pose(st.j, w)[JP + 1];
      reg('G4 teleportar: plano e quadril zerados, de pé no ponto novo (sem a pelve subindo); a cópia da substituição de pé no lugar',
        `teleportar: ${zerou ? 'zerou' : 'NÃO zerou'}; 1 passo depois quadril ${f2(q1)}, pelve ${f2(pel1)}; ${txtS}`, 'zerou; ≥ 0,85; de pé, plano null, mundo igual',
        zerou && q1 >= 0.85 && pel1 >= 0.85 && okS);
    }
  }

  // ---- G5: o intervalo (Node, passoPartida até 'intervalo', como `?cenas=0`): o carrinho no último tick do 1º tempo — a pelve
  // desenhada parada durante o intervalo (o congela) e a saída do 2º tempo zera o plano e o quadril
  {
    const st = deslizante(8);
    if (!st) reg('G5 intervalo com o carrinho', 'sem deslizante', 'existe', false);
    else {
      const w = st.w, p = w.partida;
      p.acrescimo = 0; p.ticksPorTempo = w.tick + 1 - p.tick0Tempo;
      passo(w, { x: 0, z: 0, botoes: 0 });
      const noApito = p.estado === 'intervalo' && st.j.carrinho && st.j.carrinho.congela === w.tick && K.carrinhoAtivo(st.j, w.tick);
      const p0 = A.pose(st.j, w);
      let mexeu = 0, n = 0;
      for (; n < 1200 && p.estado === 'intervalo'; n++) {
        passo(w, { x: 0, z: 0, botoes: 0 });
        if (p.estado !== 'intervalo') break;
        const o = A.pose(st.j, w);
        mexeu = Math.max(mexeu, Math.hypot(o[JP] - p0[JP], o[JP + 1] - p0[JP + 1], o[JP + 2] - p0[JP + 2]));
      }
      const zerou = p.tempo === 2 && st.j.carrinho == null && st.j.quadril == null;
      passo(w, { x: 0, z: 0, botoes: 0 });
      const q1 = st.j.quadril;
      reg('G5 intervalo: a pelve desenhada parada no intervalo (congela); a saída do 2º tempo zera o plano e o quadril',
        `no apito ${noApito ? 'congelado' : 'NÃO'}; ${n} ticks de intervalo, a pelve andou ${f3(mexeu)} m; saída: ${zerou ? 'zerou' : 'NÃO zerou'} (quadril depois ${f2(q1)})`,
        'congelado; ≤ 0,05 m; zerou; ≥ 0,85', noApito && n >= 60 && mexeu <= 0.05 && zerou && q1 >= 0.85);
    }
  }

  // ---- G8: a cena do CARTÃO com o punido no carrinho e a bola parada (a página desenha a do mundo, no lugar do apito): o corpo
  // DESENHADO dele (as cápsulas do manequim e a cabeça) nunca entra na bola enquanto ele está no carrinho — a cópia vai de lado
  // antes do 1º quadro (cena-cartao.js desvioDaBola). Os casos: o cartão do próprio deslizante (amarelo ou vermelho) nas
  // entradas do G2, nos estados da semente 3102; "perto": a bola a ≤ 0,3 m do corpo desenhado no mundo, no tick do cartão
  {
    const folgaBola = (o, p) => {
      let d = Infinity;
      for (const [a, b, ra, rb] of A.SEGMENTOS) {
        const ax = o[a * 3], ay = o[a * 3 + 1], az = o[a * 3 + 2], dx = o[b * 3] - ax, dy = o[b * 3 + 1] - ay, dz = o[b * 3 + 2] - az, l2 = dx * dx + dy * dy + dz * dz;
        const u = l2 > 0 ? Math.max(0, Math.min(1, ((p.x - ax) * dx + (p.y - ay) * dy + (p.z - az) * dz) / l2)) : 0;
        d = Math.min(d, Math.hypot(ax + dx * u - p.x, ay + dy * u - p.y, az + dz * u - p.z) - (ra + (rb - ra) * u) - CFG.BOLA.raio);
      }
      const ic = A.J.cabeca * 3;
      return Math.min(d, Math.hypot(o[ic] - p.x, o[ic + 1] - p.y, o[ic + 2] - p.z) - A.RAIO_CABECA - CFG.BOLA.raio);
    };
    const mm = P.criarPartida({ semente: 3102, minutosPorTempo: 4 });
    let ultimo = -1e9, n = 0, perto = 0, dentro = 0, pior = Infinity, piorEx = '', depois = Infinity, estados = 0;
    procura8: for (let i = 0; i < 12000 && estados < 10; i++) {
      P.passoPartida(mm, P.entradaDemoPartida(mm));
      if (mm.tick < 600 || mm.tick - ultimo <= 700) continue;
      const dm = mm.posse != null ? porId(mm, mm.posse) : null;
      if (!(mm.partida.estado === 'jogo' && !(mm.parada && !mm.parada.rolou) && mm.golTick == null && mm.naMao == null && dm && dm.time === 1 && dm.posicao !== 'GOL')) continue;
      ultimo = mm.tick; estados++;
      const base = SIM.copiarMundo(mm);
      for (const dist of [2.0, 2.5, 3.0, 3.5]) for (const ang of [Math.PI, 2.6, -2.6, Math.PI / 2, -Math.PI / 2]) for (const vel of [6.5, 5.5, 4.5]) {
        const w = SIM.copiarMundo(base), d = porId(w, w.posse);
        const vc = Math.hypot(d.vx, d.vz), dx0 = vc >= 1 ? d.vx / vc : Math.cos(d.rumo), dz0 = vc >= 1 ? d.vz / vc : Math.sin(d.rumo);
        const ux = dx0 * Math.cos(ang) - dz0 * Math.sin(ang), uz = dx0 * Math.sin(ang) + dz0 * Math.cos(ang);
        const b0 = w.bola.p, px = b0.x + ux * dist, pz = b0.z + uz * dist, j = linhaPerto(w, b0.x, b0.z);
        const rx = b0.x - px, rz = b0.z - pz, rl = Math.hypot(rx, rz) || 1;
        P.teleportar(j, px, pz, Math.atan2(rz, rx)); j.vx = vel * rx / rl; j.vz = vel * rz / rl;
        if (!AC.assumirControle(w, 0, j)) continue;
        passo(w, { x: rx / rl, z: rz / rl, botoes: B.CARRINHO });
        if (!j.carrinho) continue;
        for (let k = 0; k < 200 && j.carrinho; k++) {
          const ev = passo(w, { x: 0, z: 0, botoes: 0 });
          const cart = CCt.escolherCartao(ev);
          if (!cart) continue;
          if (cart.id === j.id && K.carrinhoAtivo(j, w.tick + 1) && w.bola.p.y < 0.6) {
            n++;
            if (folgaBola(A.pose(j, w), w.bola.p) <= 0.3) perto++;
            const c = CCt.criarCenaCartao(CCt.planejarCartao(w, cart, {}), w);
            const pun = c.punido;
            let fCarr = Infinity, fDepois = Infinity, kPe = -1;
            for (let t = 0; t < 600 && !c.acabou && (kPe < 0 || c.k - kPe <= 60); t++) {
              CCt.passoCenaCartao(c);
              if (!pun.ativo) continue;
              const f = folgaBola(pun.atu, c.mF.bola.p);
              if (pun.noCarrinho) fCarr = Math.min(fCarr, f);
              else { if (kPe < 0) kPe = c.k; fDepois = Math.min(fDepois, f); }
            }
            if (fCarr < 0) dentro++;
            if (fCarr < pior) { pior = fCarr; piorEx = `@${base.tick} ${f2(dist)} m, ${f2(ang)} rad, ${f2(vel)} m/s (${cart.cor})`; }
            depois = Math.min(depois, fDepois);
            if (n >= 24) break procura8;
          }
          break;
        }
      }
    }
    reg('G8 cena do cartão com o punido no carrinho: a bola parada fora do corpo desenhado dele enquanto ele está no chão',
      `${n} cenas (${perto} com a bola a ≤ 0,3 m dele no tick do cartão): ${dentro} com a bola dentro; menor folga ${f3(pior)} m (${piorEx})`,
      '≥ 12 cenas, ≥ 6 perto; 0 dentro (folga ≥ 0)', n >= 12 && perto >= 6 && dentro === 0);
    info('G8 depois de ficar de pé (1 s; separarDaBola): a menor folga do corpo desenhado à bola', `${f3(depois)} m`, '—');
  }

  // ---- G6: o levar da cena (cena-atores.js; o expulso levado ao ponto desenhado no tick anterior) no meio do carrinho: o plano
  // da cópia anda junto — o corpo não volta e o pé dobrado não salta no começo do levantar
  {
    const st = deslizante(6);
    if (!st) reg('G6 levar no meio do carrinho', 'sem deslizante', 'existe', false);
    else {
      const c = cenaParada(st.w, cc => CA.levar(cc.porId.get(st.j.id).j, 3, -2));
      const a = c.porId.get(st.j.id), plano = a.j.carrinho;
      const kd = 1 - (plano?.frente ?? 1), iT = (kd === 0 ? A.J.tornozeloE : A.J.tornozeloD) * 3;
      let tx = a.atu[iT], tz = a.atu[iT + 2], saltoPe = 0, fase4 = false, salto = 0, px = a.atu[JP], pz = a.atu[JP + 2], cx = a.j.x, cz = a.j.z;
      for (let k = 0; k < 300 && (a.noCarrinho || k === 0); k++) {
        passoParada(c);
        const o = a.atu;
        salto = Math.max(salto, Math.hypot(o[JP] - px - (a.j.x - cx), o[JP + 2] - pz - (a.j.z - cz)));
        px = o[JP]; pz = o[JP + 2]; cx = a.j.x; cz = a.j.z;
        if (a.noCarrinho && plano) {
          const f = K.quadroCarrinho(plano, K.tempoCarrinho(plano, c.mF.tick), _qG).fase;
          if (f === 4 && !fase4) { fase4 = true; saltoPe = Math.hypot(o[iT] - tx, o[iT + 2] - tz); }
        }
        tx = o[iT]; tz = o[iT + 2];
      }
      reg('G6 levar no meio do carrinho (3, −2 m): o corpo segue o quadro levado e o pé dobrado não salta no começo do levantar',
        `salto da pelve ${f3(salto)} m/tick; pé dobrado no 1º tick do levantar ${fase4 ? f3(saltoPe) : '(sem levantar)'} m`, '≤ 0,1; ≤ 0,02 m', fase4 && salto <= 0.1 && saltoPe <= 0.02);
    }
  }

  // ---- G7: o Modo Livre, "Bola no meu pé" (livre.js recomecarLivre 'pe') com o controlado no carrinho: de pé no lugar, plano e
  // quadril zerados, a bola no pé dele
  {
    let txt = 'sem Livre', ok = false;
    if (LV_C) {
      const w = LV_C.criarLivre({ semente: 3001 });
      const emJogo = () => w.partida.estado === 'jogo' && !(w.parada && !w.parada.rolou) && w.golTick == null && w.naMao == null && !K.bolaAlta(w);
      for (let i = 0; i < 4000 && !(i >= 900 && emJogo()); i++) LV_C.passoLivre(w, LV_C.entradaDemoLivre(w), null);
      const b0 = w.bola.p;
      const j = linhaPerto(w, b0.x, b0.z);
      if (emJogo() && j && AC.assumirControle(w, 0, j)) {
        // (a bola livre, 6 m à frente dele, do lado do meio do campo: o carrinho sai pelo analógico, sem depender do lance)
        w.posse = null; w.voo = null;
        const sg = b0.x >= 0 ? 1 : -1;
        P.teleportar(j, b0.x - 6 * sg, b0.z, sg > 0 ? 0 : Math.PI); j.vx = 5 * sg;
        LV_C.passoLivre(w, { x: sg, z: 0, botoes: B.CARRINHO }, null);
        const saiu = !!j.carrinho;
        for (let i = 0; i < 10 && j.carrinho; i++) LV_C.passoLivre(w, { x: 0, z: 0, botoes: 0 }, null);
        const x = j.x, z = j.z, deitado = j.carrinho && K.carrinhoAtivo(j, w.tick);
        LV_C.recomecarLivre(w, 'pe');
        const pe = j.pes.every(p => p.apoio), dB = Math.hypot(w.bola.p.x - j.x, w.bola.p.z - j.z);
        const zerou = j.carrinho == null && j.quadril == null && j.x === x && j.z === z;
        LV_C.passoLivre(w, { x: 0, z: 0, botoes: 0 }, null);
        ok = saiu && !!deitado && zerou && pe && dB <= 0.5 && j.quadril >= 0.85;
        txt = `carrinho ${saiu && deitado ? 'deslizando' : 'NÃO'}; recomeço: ${zerou ? 'plano e quadril zerados no lugar' : 'NÃO zerou'}, pés ${pe ? 'plantados' : 'no ar'}, bola a ${f2(dB)} m; quadril depois ${f2(j.quadril)}`;
      }
    }
    reg('G7 Modo Livre, "Bola no meu pé" com o controlado no carrinho: de pé no lugar com a bola no pé', txt, 'zerado; bola ≤ 0,5 m; ≥ 0,85', ok);
  }
}

if (DETALHE) console.log(tabela.map(l => l.join(' | ')).join('\n') + '\n');
fim();
