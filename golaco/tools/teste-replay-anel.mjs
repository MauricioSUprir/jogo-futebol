// Replay — as partes puras (js/render/replay-anel.js e js/render/replay-roteiro.js), em Node:
//   A) o anel: 700 passos gravados → os últimos 600 em ordem; leitura exata no passo e interpolação exata no meio;
//      corte não interpolado; substituição (a ordem das vagas muda) segue o id; rumo pelo caminho curto; recomeço
//      (mundo novo) zera; memória fixa ≤ 4 MB e nada realocado;
//   B) os roteiros: gol (TV 1× do chute − 4 s ou do último corte até o gol + 0,8 s; atrás do gol 0,5×; ≤ 12 s; o golaço
//      ganha a lateral 0,35×), impedimento (P1 'linha' até o toque e P2 'saot': a análise semiautomática congelada no
//      passe ≥ 3,0 s; a linha só do passe em diante, no x do lance, sem apagar até o fim; ≤ 7,5 s), "Replay" da pausa
//      (últimos 10 s sem atravessar corte) e o relógio do replay;
//   C) partida de verdade (IA × IA, partida.js + anim.js, a mesma gravação do main.js — lib/anel-node.mjs): o replay de
//      um gol mostra o chute e a bola entrando, sem atravessar a montagem da saída; o de um impedimento congela no passe
//      com a linha no defensor; gravar (com a foto da Regra 11) não muda o hash e custa ≤ 50 µs por passo (16/10: a parede
//      menos a espera do fio na fila do escalonador, depois de 600 passos de aquecimento — como o teste-custo).
// Impedimento de 12/10 (cena semiautomática, pedido do dono): B8, B11, B16, B17 e C8 esperam os 2 planos (linha → saot),
// "≤ ~6 s" virou ≤ 7,5 s (mudança de produto) e o congelamento ficou mais duro (≥ 1,2 s → ≥ 3,0 s).
// 3ª e 4ª câmeras do gol (12/10: a 1ª pessoa do autor e a visão do treinador; render/replay-olhos.js): B2/B3/B5/C3 medem a
// PARTE ANTIGA do replay (tv + atras [+ lateral]: a mesma grandeza, o mesmo limite; B3 acha a lateral pelo nome) e
//   G)  partidas IA × IA inteiras (sementes 1–N, a gravação do main.js com os treinadores), em cada gol na saída de bola:
//   G1  a ordem pelos nomes: tv, atras, [lateral], primeira, treinador, [saot]; sem 1ª pessoa no gol contra, sem autor no
//       anel e com "reduzir movimento";
//   G2  com os extras, os planos de antes são campo a campo os de {extras: false}; e {extras: false} = o roteiro de --ref
//       (outra versão: git archive) — com --ref (28/10: menos o gol em que a base da ref passava do teto, contado à parte);
//   G3  base (tv, atras [, lateral] [, checagem]) ≤ 12 s (golaço ≤ 14; com a checagem + 1) — 28/10 —; extras ≤ 7,0 s;
//       total ≤ 19 s (golaço ≤ 21; com a checagem ≤ 20/22);
//   G3b (28/10) o gol LENTO SINTÉTICO (o chute bloqueado que sobe, quica, bate na trave e entra Δ s depois; 24 e 14 m, Δ de 1
//       a 6,5 s): os tetos do G3 em cada gol e a leitura do lance (a TV com o chute e o desvio inteiros; até Δ 5 s o de trás
//       do gol com o gol; o golaço até Δ 4 s com a lateral; com Δ 1 s, o roteiro de sempre) — ver o item;
//   G4  os planos dentro do anel, sem atravessar corte (o gol no fim do tempo: o treinador encurta ou sai);
//   G5  pênalti: a 1ª pessoa começa depois da montagem e o goleiro está no quadro em chute − 0,3 s;
//   G6  1ª pessoa: olho ≤ 0,15 m da cabeça gravada e ≤ 0,06 m do olho bruto na HORIZONTAL (14/10: a cabeça do manequim
//       sobe e desce até ±9 cm correndo — a passada de agora —, e um olho a ≤ 6 cm dela na vertical também balançaria ≥ 3 cm:
//       a vertical fica presa pela cabeça e pelo balanço); arfagem em [−60°, 15°]; balanço residual (y − média móvel de
//       0,5 s, com o olho dos dois lados do quadro) ≤ 1 cm correndo (o olho bruto: ~8 cm);
//   G7  1ª pessoa: giro p95 ≤ 90°/s e máximo ≤ 150°/s (tempo de replay); bola no quadro ≥ 95% de chute a gol (fora da janela
//       em que ela some); olhar ≤ 25° da bola (mediana); a boca do gol no quadro em chute − 0,5 s e de chute + 0,3 s ao gol;
//   G8  1ª pessoa: nenhum outro corpo a < 0,3 m da lente no quadro; presente em ≥ 80% dos gols com autor em que ela CABE
//       pelas regras fixas do roteiro (28/10: lib/replay-g.mjs semLugarPrimeira — sem 'corte' a < extras.primeiraMin s antes
//       do chute e sem passar do 'orçamento' dos extras com a 1ª pessoa e o treinador mínimos: a bola que demora a entrar;
//       conta só do relógio do lance, nunca do enquadramento) e nenhuma 1ª pessoa num gol em que ela não cabe;
//   G9  treinador (parte 1): olho ≤ 0,15 m da cabeça gravada; fov constante; bola no quadro ≥ 95%; a boca do gol no quadro
//       no gol; giro p95 ≤ 15°/s e máximo ≤ 30°/s;
//   G10 treinador (parte 2): ele inteiro no quadro em 100%; centro em x ∈ [0,2; 0,45]; cabeça e peito livres ≥ 90%; câmera
//       fora dos sólidos e a ≥ 0,6 m de qualquer corpo; nada a < 2 m dela no quadro;
//   G11 anel com 26 vagas ≤ 4 MB; lerQuadro marca it.tecnico e zera it.ocultar; defensorDaLinha nunca devolve o treinador;
//   G12 a pose do treinador gravada no passo = a ao vivo, bit a bit;
//   G13 (14/10) a lente da 1ª pessoa e da parte 1 do treinador fora dos sólidos do estádio (solidoEm, 5 cm; acima do chão)
//       em 100% dos quadros; o que se vê do próprio autor (o quadril e as pernas: o resto fica OCULTO) a ≥ 0,20 m da lente;
//       nenhum outro corpo a < 0,3 m da lente do treinador no quadro; na parte 2 ele reage (a mão acima da cabeça ≥ 0,1 s).
//   G14 (contraprova 15/10) gol de cabeça SINTÉTICO (sem partida, determinístico): o autor cabeceia a 7 m do gol e segue
//       correndo para dentro dele, passando pela bola que morre na rede (a 1ª pessoa acaba antes, pela lente no gol): de
//       chute + 0,3 s ao gol a boca do gol no quadro (16:9 e celular) e o olhar a ≤ 60° do rumo para ela em cada um dos 30
//       gols (5 velocidades do autor × 2 linhas de corrida × 3 lados da bola); a bola no quadro em ≥ 95% de chute a gol (as
//       metas do G7). (Na partida da cabeceio-ia, semente 80, os passos depois do fim do plano — o olho já dentro do gol, o "para
//       o gol" virado para trás — puxavam o olhar pela suavização e pelo limite do giro: ele girou até 107° do gol.)
//   G15 (16/10, frente "cenas robustas") a cabeça que desce de repente andando, antes da corrida, SINTÉTICO: o balanço
//       residual correndo ≤ 1 cm e o olho a ≤ 0,15 m da cabeça em cada gol (ver o item);
//   G16 (16/10) gol de perto pelo canto, SINTÉTICO: a boca do gol no quadro em chute − 0,5 s e de chute + 0,3 s ao gol em
//       cada gol, com a bola longe do centro dela (ver o item).
//   G17 (16/10) a passada CORRENDO com o sobe-e-desce grande e um passo mais fundo, SINTÉTICO: o balanço residual ≤ 1 cm e o
//       olho a ≤ 0,15 m da cabeça em cada gol (ver o item).
//   G18 (29/10, C3) o PULO do cabeceio a gol de verdade (o canhão de cruzamentos do teste-cabeceio gravado no anel): a lente
//       da 1ª pessoa nunca ruim em volta do contato e o olho a ≥ −6 cm do centro da cabeça no pulo (ver o item).
// Na versão sem replay os módulos não existem: o teste reprova.
// 15/10 (frente "replay robusto"): --estresse = 3× as sementes (84); a amostra do G8 (≥ 48 gols com autor; 28/10: ≥ 48 em
// que a 1ª pessoa cabe) cresce com as sementes seguintes, em ordem, até + 20 (nunca escolhe sementes).
// 28/10 (goleiro realista, C1): o G8 reprovou no CI com 37/48 (77%), sem nenhum gol sem a corrida antes do chute (0 em 312
// gols com autor, main e branch). Nas sementes do CI (1–29) faltaram: 7 cabeceios com a lente bloqueada (o zagueiro ombro a
// ombro; o próprio quadril com o olho na esfera de baixo da cabeça no salto), 2 chutes de primeira com o adversário colado no
// rosto e 2 gols em que a 1ª pessoa não CABE no orçamento dos extras (≤ 7 s): a falta de 27 m que leva 1,5 s até o gol e o
// chute de 24,5 m que leva 2,4 s. A main, nas dela (1–40): 45/52 (86,5%), 1 sem lugar. Em 60 partidas novas (41–100):
// branch 81/92 (88,0%), main 99/118 (83,9%); juntando as duas amostras, a 1ª pessoa onde ela cabe fica em 85,7% nas duas
// versões: o 77% era sorteio da amostra fixa (erro-padrão de ~5 pontos com 48 gols). A 1ª pessoa sair do gol sem lugar no
// orçamento é a regra do contrato (ela não existe ali, como no gol contra e no gol sem chute, que já ficavam fora): o G8 mede
// a presença onde ela cabe — a lente e o enquadramento que a tiram de onde ela cabia seguem contados inteiros, a amostra
// passa a ser de 48 gols em que ela cabe e uma 1ª pessoa num gol em que ela não cabe reprova.
// 28/10 (goleiro realista, C1, revisão do G8): nas sementes 101–128 o G3 reprovou (total 22,01 s > 21) no gol da semente
// 102 — golaço com o chute BLOQUEADO no mesmo passo (a bola que sobe da perna fica livre: a classe nova do 0537a78f), quique,
// trave e gol 2,97 s depois; a base, 16,94 s, contra os 14 do contrato. Nas do CI a semente 14 (Δ 2,38 s) já furava a base
// (15,19 s) e o G3 não via: só olhava o total. A causa estava no roteiro (igual na main): os pisos davam a base ≥ 4,9 + 3Δ
// s (+ 3,14 da lateral) sem nada que cortasse. Agora o G3 confere a base em todo gol, o G3b cobre o lance lento sem depender
// de semente e o roteiro (replay-roteiro.js montarGol/planosExtrasGol) encolhe o de trás do gol até o gol, tira a lateral e,
// por último, o de trás do gol; os extras, a parte 1 do treinador até o gol. Medido (o G2 com --base na versão de antes):
// nas sementes do CI, 101–128 e 201–240 (branch: 169 gols; main com a correção: 178) só os dois gols lentos (s14 e s102 da
// branch) mudaram a base — 15,19 → 13,99 s e 16,94 → 13,98 s —; todo o resto igual campo a campo.
//   node tools/teste-replay-anel.mjs [--js <pasta js>] [--ref <commit> | --base <pasta js>] [--sementes N] [--de S] [--par N] [--min M] [--so-g5] [--so-g3b] [--so-g14] [--so-g18] [--estresse]
// (28/10: --de S = as sementes do G a partir de S, padrão 1; --so-g3b = só o gol lento sintético)
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { fork, execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
// G (processo filho): uma partida inteira e as medidas de cada gol
if (args.includes('--filho-g')) {
  const { medirSemente } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  process.send(await medirSemente(pastaJs, +arg('--s', 1), { ref: arg('--ref-js', null), min: +arg('--min', 4) }));
  process.exit(0);
}

const linhas = [['teste', 'medido', 'meta', 'resultado']];
// 28/10: o teto da BASE do replay do gol (tv, atras [, lateral] [, checagem]) — contrato "Replay": 12 s, golaço 14, com a
// checagem de posição legal + REPLAY.saot.extraGol
const limBase = (REPLAY, g) => (g.golaco ? REPLAY.gol.maximoGolaco : REPLAY.gol.maximo) + (g.checagem ? (REPLAY.saot?.extraGol ?? 1) : 0);
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

let RA = null, RR = null;
try { RA = await imp('render/replay-anel.js'); RR = await imp('render/replay-roteiro.js'); } catch (e) { RA = null; }
if (!RA || !RR) {
  reg('módulos do replay (render/replay-anel.js, render/replay-roteiro.js)', 'não existem (sem replay)', 'existem', false);
} else {
  const { criarAnel, lerQuadro, tempoEstadio, bolaNoTick, jogadorNoTick, defensorDaLinha } = RA;
  const { roteiroGol, roteiroImpedimento, roteiroMenu, duracao, criarRelogio, iniciarRelogio, avancarRelogio, linhaDoReplay, velocidadeAgora } = RR;
  const C = await imp('config.js');
  const { NJ, pose } = await imp('anim.js');
  const { REPLAY, CAMPO, PASSO, BOLA } = C;
  const P = NJ * 3;

  // ---------------------------------------------------------------- A) o anel (mundo sintético: tudo função do tick)
  const val = (t, id, k) => Math.sin(t * 0.013 + id * 0.7 + k * 0.11) * 3 + id;
  const xDe = (t, id) => -40 + id * 3 + t * 0.01, zDe = (t, id) => Math.cos(t * 0.02 + id) * 20;
  const rumoDe = (t, id) => (id === 3 ? (t % 2 ? Math.PI - 0.05 : -Math.PI + 0.05) : t * 0.01 + id);
  const pose0 = new Float32Array(P);
  function gravar(a, t, ordem, cortes = new Set()) {
    a.inicio(t, t * PASSO, cortes.has(t));
    let v = 0;
    for (const id of ordem) {
      for (let k = 0; k < P; k++) pose0[k] = val(t, id, k);
      a.jogador(v++, id, id >= 11 ? 1 : 0, id === 0 || id === 11, xDe(t, id), zDe(t, id), rumoDe(t, id), pose0);
    }
    a.fim({ x: t * 0.05, y: 0.11 + (t % 7) * 0.01, z: -t * 0.02 }, { x: 0, y: Math.sin(t * 0.01), z: 0, w: Math.cos(t * 0.01) });
  }
  {
    const a = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    const buf = a.dados;
    const ordem = Array.from({ length: 22 }, (_, i) => i);
    const ordemSub = ordem.slice().reverse(); // de 1500 em diante a ordem das vagas muda (substituição/expulsão)
    const cortes = new Set([1430]);
    for (let t = 1001; t <= 1700; t++) gravar(a, t, t >= 1500 ? ordemSub : ordem, cortes);
    let emOrdem = true;
    for (let t = a.primeiro; t <= a.ultimo; t++) if (a.slot(t) < 0 || a.tickDe[a.slot(t)] !== t) emOrdem = false;
    reg('A1 700 passos gravados: ficam os últimos 600, em ordem', `primeiro ${a.primeiro}, último ${a.ultimo}; ${a.slot(1100)} para o 1100; todos em ordem ${emOrdem}`, '1101–1700, o 1100 fora', a.primeiro === 1101 && a.ultimo === 1700 && a.slot(1100) === -1 && emOrdem);
    const lista = [], bp = {}, bq = {};
    let errExato = 0;
    const n0 = lerQuadro(a, 1250, lista, bp, bq, null);
    for (const it of lista) for (let k = 0; k < P; k++) errExato = Math.max(errExato, Math.abs(it.pose[k] - Math.fround(val(1250, it.id, k))));
    reg('A2 leitura no passo: a pose gravada exata', `${n0} jogadores; erro máx ${errExato.toExponential(1)}`, '22, 0', n0 === 22 && errExato === 0);
    // interpolação no meio: (1 − f)·t0 + f·t1, como o desenho ao vivo (interpolarPose)
    const f = 0.4;
    lerQuadro(a, 1250 + f, lista, bp, bq, null);
    let errInt = 0, errX = 0;
    for (const it of lista) {
      for (let k = 0; k < P; k++) { const e = Math.fround(val(1250, it.id, k)) + (Math.fround(val(1251, it.id, k)) - Math.fround(val(1250, it.id, k))) * f; errInt = Math.max(errInt, Math.abs(it.pose[k] - e)); }
      errX = Math.max(errX, Math.abs(it.x - (Math.fround(xDe(1250, it.id)) + (Math.fround(xDe(1251, it.id)) - Math.fround(xDe(1250, it.id))) * f)));
    }
    const bx = Math.fround(1250 * 0.05) + (Math.fround(1251 * 0.05) - Math.fround(1250 * 0.05)) * f;
    reg('A3 interpolação no meio do passo (pose, x, bola)', `erro máx pose ${errInt.toExponential(1)}, x ${errX.toExponential(1)}, bola ${Math.abs(bp.x - bx).toExponential(1)}`, '≤ 1e-5', errInt <= 1e-5 && errX <= 1e-5 && Math.abs(bp.x - bx) <= 1e-5);
    const q = Math.hypot(bq.x, bq.y, bq.z, bq.w);
    reg('A4 quaternion da bola normalizado', fmt(q, 6), '1', Math.abs(q - 1) < 1e-6);
    // corte: entre 1429 e 1430 não interpola (fica no 1429); em 1430 já é o novo
    lerQuadro(a, 1429.7, lista, bp, bq, null);
    const c0 = lista.find(it => it.id === 5).x;
    reg('A5 corte não é interpolado (fica no passo de antes)', `x em 1429,7 = ${fmt(c0, 4)} (1429: ${fmt(xDe(1429, 5), 4)})`, 'igual ao 1429', Math.abs(c0 - Math.fround(xDe(1429, 5))) < 1e-5);
    reg('A6 ultimoCorte acha o corte', `${a.ultimoCorte(1200, 1700)} e ${a.ultimoCorte(1431, 1700)}`, '1430 e null', a.ultimoCorte(1200, 1700) === 1430 && a.ultimoCorte(1431, 1700) === null);
    // a ordem das vagas muda em 1500: a interpolação 1499 → 1500 segue o id
    lerQuadro(a, 1499.5, lista, bp, bq, null);
    const j7 = lista.find(it => it.id === 7);
    const e7 = Math.fround(xDe(1499, 7)) + (Math.fround(xDe(1500, 7)) - Math.fround(xDe(1499, 7))) * 0.5;
    reg('A7 substituição (vagas em outra ordem): a interpolação segue o id', `x do 7 ${fmt(j7.x, 4)} (esperado ${fmt(e7, 4)})`, '|Δ| ≤ 1e-5', Math.abs(j7.x - e7) <= 1e-5);
    // rumo pelo caminho curto (perto de ±π)
    lerQuadro(a, 1300.5, lista, bp, bq, null);
    const r3 = lista.find(it => it.id === 3).rumo;
    reg('A8 rumo interpolado pelo caminho curto (±π)', `${fmt(r3, 3)} rad`, '|rumo| ≈ π', Math.abs(Math.abs(r3) - Math.PI) < 0.06);
    reg('A9 relógio do estádio interpolado', `${fmt(tempoEstadio(a, 1300.5), 4)} s`, fmt(1300.5 * PASSO, 4), Math.abs(tempoEstadio(a, 1300.5) - 1300.5 * PASSO) < 1e-9);
    const b = bolaNoTick(a, 1600), jg = jogadorNoTick(a, 1600, 12);
    reg('A10 bola e jogador num passo', `bola x ${fmt(b.x, 2)}; jogador 12 x ${fmt(jg.x, 2)}, time ${jg.time}, goleiro ${jg.goleiro}`, '80; 25,6, 1, não', Math.abs(b.x - 80) < 1e-3 && Math.abs(jg.x - Math.fround(xDe(1600, 12))) < 1e-4 && jg.time === 1 && !jg.goleiro);
    reg('A11 nada realocado (o mesmo buffer depois de 700 passos)', `mesmo buffer ${a.dados === buf}`, 'sim', a.dados === buf);
    // mundo novo: o tick volta → recomeça
    gravar(a, 1, ordem);
    reg('A12 mundo novo (o tick volta): o anel recomeça', `primeiro ${a.primeiro}, último ${a.ultimo}, 1600 ${a.slot(1600)}`, '1, 1, −1', a.primeiro === 1 && a.ultimo === 1 && a.slot(1600) === -1);
    const aCfg = criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    reg('A13 memória do anel (REPLAY: 10 s, 24 vagas)', `${fmt(aCfg.bytes / 1048576, 2)} MB`, '≤ 4 MB', aCfg.bytes <= 4 * 1048576);
    // contraprova: expulsão (um jogador a menos a partir de 1650) — a última vaga do passo seguinte guarda o que foi
    // gravado 600 passos antes (o mesmo id na mesma vaga): a interpolação não pode ler esse resto
    const aEx = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    const sem5 = ordem.filter(id => id !== 5);
    for (let t = 1001; t <= 1700; t++) gravar(aEx, t, t >= 1650 ? sem5 : ordem);
    lerQuadro(aEx, 1649.5, lista, bp, bq, null);
    const j21 = lista.find(it => it.id === 21);
    const e21 = Math.fround(xDe(1649, 21)) + (Math.fround(xDe(1650, 21)) - Math.fround(xDe(1649, 21))) * 0.5;
    reg('A14 expulsão (vaga vazia no passo seguinte): a interpolação segue o id, sem ler o resto velho do anel', `x do 21 ${fmt(j21.x, 4)} (esperado ${fmt(e21, 4)})`, '|Δ| ≤ 1e-5', Math.abs(j21.x - e21) <= 1e-5);
  }

  // ---------------------------------------------------------------- B) roteiros e relógio (anel sintético)
  {
    const a = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    const ordem = Array.from({ length: 22 }, (_, i) => i);
    for (let t = 2001; t <= 2600; t++) gravar(a, t, ordem);
    // gol em 2400, chute em 2350 (lado +1); a bola do anel sintético no chute: x 117,5 → golaço "longe" é decidido abaixo
    const r = roteiroGol(a, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: false });
    const [tv, at] = r.planos;
    reg('B1 gol: TV 1× do chute − 4 s até o gol + 0,8 s; atrás do gol 0,5× do chute − 1 s até o gol + 1 s',
      r.planos.map(p => `${p.cam} ${p.de}–${p.ate} @${p.vel}`).join(' · '), 'tv 2110–2448 @1 · atras 2290–2460 @0,5',
      r.planos.length === 2 && tv.cam === 'tv' && tv.de === 2110 && tv.ate === 2448 && tv.vel === 1 && at.cam === 'atras' && at.de === 2290 && at.ate === 2460 && at.vel === 0.5);
    // (a parte antiga: tv, atras e lateral — os planos novos têm orçamento próprio, nos itens G)
    const antiga = ro => ro ? duracao({ ...ro, planos: ro.planos.filter(p => p.cam === 'tv' || p.cam === 'atras' || p.cam === 'lateral') }) : NaN;
    reg('B2 gol: duração (a parte antiga) ≤ REPLAY.gol.maximo', `${fmt(antiga(r), 2)} s`, `≤ ${REPLAY.gol.maximo} s`, antiga(r) <= REPLAY.gol.maximo + 1e-9);
    const rG = roteiroGol(a, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: true });
    const latG = rG.planos.find(p => p.cam === 'lateral');
    reg('B3 golaço: + a lateral baixa 0,35× em volta do chute (pelo nome), a parte antiga ≤ maximoGolaco', `${rG.planos.map(p => `${p.cam} @${p.vel}`).join(' · ')}; ${fmt(antiga(rG), 2)} s`, `tv · atras · lateral @0,35; ≤ ${REPLAY.gol.maximoGolaco} s`,
      rG.planos[0].cam === 'tv' && rG.planos[1].cam === 'atras' && !!latG && latG.vel === 0.35 && latG.de <= 2350 && latG.ate >= 2350 && antiga(rG) <= REPLAY.gol.maximoGolaco + 1e-9);
    // corte entre o começo e o gol: o replay começa nele
    const a2 = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    for (let t = 2001; t <= 2600; t++) gravar(a2, t, ordem, new Set([2200]));
    const rc = roteiroGol(a2, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: false });
    reg('B4 gol: não atravessa um corte (começa nele)', `TV de ${rc.planos[0].de}`, '2200', rc.planos[0].de === 2200);
    // chute longe do gol: TV + atrás passariam de 12 s → o começo da TV encolhe (até 1,5 s antes do chute)
    const rl = roteiroGol(a, { golTick: 2420, chuteTick: 2300, lado: 1, golaco: false });
    reg('B5 gol de chute longo: a TV encolhe para caber em 12 s (a parte antiga)', `TV de ${rl.planos[0].de} (chute 2300); ${fmt(antiga(rl), 2)} s`, `≤ 12 s, começo ≤ chute − 1,5 s`, antiga(rl) <= REPLAY.gol.maximo + 1e-9 && rl.planos[0].de <= 2300 - 90);
    reg('B6 gol fora do anel: sem roteiro', String(roteiroGol(a, { golTick: 1500, chuteTick: 1450, lado: 1 })), 'null', roteiroGol(a, { golTick: 1500, chuteTick: 1450, lado: 1 }) === null);
    // relógio do replay do gol: anda os planos e acaba
    const rel = criarRelogio();
    iniciarRelogio(rel, r);
    let q = 0, viu = new Set(), menor = Infinity, maior = -Infinity;
    while (avancarRelogio(rel, 1 / 60) && q < 5000) { q++; viu.add(rel.roteiro.planos[rel.i].cam); menor = Math.min(menor, rel.t); maior = Math.max(maior, rel.t); }
    reg('B7 relógio: TV e depois atrás do gol, acaba sozinho no tempo do roteiro', `${q + 1} quadros (${fmt((q + 1) / 60, 2)} s; roteiro ${fmt(duracao(r), 2)} s), planos ${[...viu].join(', ')}`, '±2 quadros, tv e atras',
      Math.abs(q + 1 - duracao(r) * 60) <= 2 && viu.has('tv') && viu.has('atras') && !rel.ativo);
    // impedimento: passe em 2450, apito em 2537
    const ri = roteiroImpedimento(a, { fotoTick: 2450, apitoTick: 2537, linhaX: -25.48, idImpedido: 9, time: 0, lado: -1, defensor: 14, por: 4 });
    const [r1, r2] = ri.planos;
    reg('B8 impedimento: P1 câmera da linha até o apito (troca de velocidade no passe) e P2 a análise congelada no passe',
      `${ri.planos.map(p => p.cam).join(' → ')}; P1 ${r1.de}–${r1.ate} (passe ${r1.congela.tick}, ${r1.congela.s} s); P2 ${r2?.de}–${r2?.ate}, congela ${r2?.congela.s} s`,
      `linha ${2450 - Math.round(REPLAY.impedimento.antes * 60)}–2537 → saot 2450–2450, ≥ 3,0 s`,
      ri.planos.length === 2 && r1.cam === 'linha' && r1.de === 2450 - Math.round(REPLAY.impedimento.antes * 60) && r1.ate === 2537 && r1.congela.tick === 2450 && r1.congela.s === 0
        && r2.cam === 'saot' && r2.de === 2450 && r2.ate === 2450 && r2.congela.tick === 2450 && r2.congela.s >= 3.0 && r2.saot?.idAtac === 9 && r2.saot?.idDef === 14);
    iniciarRelogio(rel, ri);
    const ln = { visivel: false, x: 0, opacidade: 0 };
    let antesComLinha = 0, depoisSem = 0, congelados = 0, xOk = true, comLinha = 0, opMax = 0, primeiroComLinha = null;
    do {
      linhaDoReplay(rel, 1 / 60, ln);
      if (velocidadeAgora(rel) === 0) congelados++;
      if (rel.t < 2450 - 1e-6 && ln.visivel) antesComLinha++;
      if (rel.t >= 2450 && !ln.visivel) depoisSem++;
      if (ln.visivel) { comLinha++; if (Math.abs(ln.x + 25.48) > 1e-9) xOk = false; opMax = Math.max(opMax, ln.opacidade); if (primeiroComLinha == null) primeiroComLinha = rel.t; }
    } while (avancarRelogio(rel, 1 / 60));
    reg('B9 a linha só aparece do quadro do passe em diante e não apaga', `antes do passe ${antesComLinha}; depois sem linha ${depoisSem}; 1º tick com linha ${fmt(primeiroComLinha, 1)}; ${comLinha} quadros`, '0, 0, 2450', antesComLinha === 0 && depoisSem === 0 && Math.abs(primeiroComLinha - 2450) < 1e-6);
    reg('B10 linha no x do lance, entrando até 0,95', `x ok ${xOk}, opacidade máx ${fmt(opMax, 2)}`, 'sim, 0,95', xOk && Math.abs(opMax - 0.95) < 1e-9);
    const dSaot = REPLAY.saot?.impedimento.dura ?? 3.6; // (a versão sem a análise não tem REPLAY.saot: a meta é 3,6 s)
    reg('B11 congela no passe (a análise)', `${fmt(congelados / 60, 2)} s`, `${dSaot} s (≥ 3,0)`, congelados / 60 >= 3.0 && Math.abs(congelados / 60 - dSaot) <= 2 / 60);
    reg('B12 impedimento com o passe fora do anel: sem roteiro', String(roteiroImpedimento(a, { fotoTick: 1800, apitoTick: 2537, linhaX: 0, idImpedido: 9, time: 0, lado: 1 })), 'null', roteiroImpedimento(a, { fotoTick: 1800, apitoTick: 2537, linhaX: 0, idImpedido: 9, time: 0, lado: 1 }) === null);
    const rm = roteiroMenu(a);
    reg('B13 "Replay" da pausa: os últimos 10 s na TV', `${rm.planos[0].cam} ${rm.planos[0].de}–${rm.planos[0].ate} @${rm.planos[0].vel} (${fmt(duracao(rm), 2)} s)`, 'tv 2001–2600 @1', rm.planos[0].cam === 'tv' && rm.planos[0].de === 2001 && rm.planos[0].ate === 2600);
    const rm2 = roteiroMenu(a2);
    reg('B14 "Replay" da pausa não atravessa o último corte', `de ${rm2.planos[0].de}`, '2200', rm2.planos[0].de === 2200);
    // contraprova: corte logo DEPOIS do gol (montagem que chegasse antes do fim dos planos) — nenhum plano o atravessa
    const a3 = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    for (let t = 2001; t <= 2600; t++) gravar(a3, t, ordem, new Set([2420]));
    const rd = roteiroGol(a3, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: true });
    const fimD = Math.max(...rd.planos.map(p => p.ate));
    reg('B15 gol: nenhum plano atravessa um corte depois do gol (para antes dele)', `corte 2420; planos até ${fimD} (${rd.planos.map(p => `${p.cam} ${p.de}–${p.ate}`).join(' · ')})`, '≤ 2419', fimD <= 2419 && rd.planos.every(p => p.ate > p.de));
    // contraprova: o apito longe do passe (passe longo, o impedido corre antes de tocar: 14% dos lances IA × IA) — o
    // replay vai até o apito (o toque) em ≤ depoisMax s reais, mais depressa
    const I = REPLAY.impedimento;
    const rl4 = roteiroImpedimento(a, { fotoTick: 2300, apitoTick: 2540, linhaX: -25.48, idImpedido: 9, time: 0, lado: -1, defensor: 14, por: 4 });
    const p4 = rl4.planos[0];
    reg('B16 impedimento com o apito 4 s depois do passe: vai até o apito, mais depressa, + a análise, ≤ 7,5 s', `${rl4.planos.map(p => p.cam).join(' → ')}; P1 ${p4.de}–${p4.ate}, depois do passe a ${fmt(p4.congela.velDepois, 2)}×; ${fmt(duracao(rl4), 2)} s`, `linha → saot; até 2540, ${fmt(4 / I.depoisMax, 2)}×, ≤ 7,5 s`,
      rl4.planos.length === 2 && rl4.planos[1].cam === 'saot' && p4.ate === 2540 && Math.abs(p4.congela.velDepois - 4 / I.depoisMax) < 1e-9 && duracao(rl4) <= 7.5 + 1e-9);
    const rl6 = roteiroImpedimento(a, { fotoTick: 2200, apitoTick: 2560, linhaX: -25.48, idImpedido: 9, time: 0, lado: -1, defensor: 14, por: 4 });
    const p6 = rl6.planos[0];
    reg('B17 impedimento com o apito 6 s depois: no máximo velDepoisMax, para antes; + a análise, ≤ 7,5 s', `${rl6.planos.map(p => p.cam).join(' → ')}; P1 ${p6.de}–${p6.ate} a ${fmt(p6.congela.velDepois, 2)}×; ${fmt(duracao(rl6), 2)} s`, `linha → saot; até ${2200 + Math.round(I.depoisMax * I.velDepoisMax * 60)}, ${I.velDepoisMax}×, ≤ 7,5 s`,
      rl6.planos.length === 2 && rl6.planos[1].cam === 'saot' && p6.congela.velDepois === I.velDepoisMax && p6.ate === 2200 + Math.round(I.depoisMax * I.velDepoisMax * 60) && duracao(rl6) <= 7.5 + 1e-9);
    // contraprova: pausa logo depois de uma montagem (corte há 0,33 s) — o "Replay" mostra o lance que parou o jogo
    const a4 = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    for (let t = 2001; t <= 2600; t++) gravar(a4, t, ordem, new Set([2150, 2580]));
    const rm4 = roteiroMenu(a4);
    reg('B18 "Replay" da pausa logo depois de uma montagem: o lance antes dela (sem atravessar o corte anterior)', rm4 ? `${rm4.planos[0].de}–${rm4.planos[0].ate}` : 'nenhum', '2150–2579', !!rm4 && rm4.planos[0].de === 2150 && rm4.planos[0].ate === 2579);
    // contraprova 15/10: corte ENTRE o chute e o gol (o autor levado longe no passo seguinte ao chute, como no gol
    // roteirizado dos testes de navegador) — nenhum plano, nem os extras, o atravessa (antes a 1ª pessoa e a visão do
    // treinador começavam antes dele: a câmera da 1ª pessoa pulava 52 m no meio do plano); sem a corrida antes do chute
    // no anel, sem 1ª pessoa
    const a5 = criarAnel({ ticks: 600, vagas: 26, nj: NJ });
    for (let t = 2001; t <= 2600; t++) gravar(a5, t, [...ordem, 210, 211], new Set([2351]));
    const re = roteiroGol(a5, { golTick: 2400, chuteTick: 2350, lado: 1, time: 0, autor: 5, tipoChute: 'chute', golaco: false });
    const cruza = re ? re.planos.filter(p => p.cam !== 'saot' && a5.primeiroCorte(p.de + 1, p.ate) != null) : [];
    reg('B19 corte entre o chute e o gol: nenhum plano (os extras também) o atravessa; sem a corrida antes do chute, sem 1ª pessoa',
      re ? `${re.planos.map(p => `${p.cam} ${p.de}–${p.ate}`).join(' · ')}; atravessam: ${cruza.map(p => p.cam).join(', ') || 'nenhum'}` : 'sem roteiro',
      'nenhum; sem primeira; com treinador', !!re && cruza.length === 0 && !re.planos.some(p => p.cam === 'primeira') && re.planos.some(p => p.cam === 'treinador'));
  }

  // ---------------------------------------------------------------- C) partida de verdade (IA × IA)
  {
    const { hashMundo } = await imp('sim.js');
    // a mesma gravação do main.js (rodarPasso + gravarNoAnel: pose deste passo, corte com teletransporte > 2 m — jogador
    // — ou > 2,5 m — bola —, a foto da Regra 11 e as marcas do passo): lib/anel-node.mjs
    const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(new URL(import.meta.url).pathname), 'lib/anel-node.mjs')).href);
    const GR = await criarGravador(pastaJs);
    const novaPartida = sem => GR.novaPartida(sem, { medirCusto: true });
    const passo = (S, gravar = true) => GR.passo(S, gravar);
    // C1–C3: o 1º gol com chute de verdade (sementes em ordem) e a saída de bola
    let achou = null;
    for (let sem = 1; sem <= 30 && !achou; sem++) {
      const S = novaPartida(sem);
      let gol = null, chute = null, roteiro = null;
      for (let i = 0; i < 9000; i++) {
        const evs = passo(S);
        for (const e of evs) if ((e.tipo === 'chute' || e.tipo === 'cabeceio')) chute = { tick: S.m.tick, id: e.id };
        const eg = evs.find(e => e.tipo === 'gol');
        if (eg && !gol) gol = { golTick: S.m.tick, chuteTick: chute && S.m.tick - chute.tick < 240 ? chute.tick : null, lado: S.m.bola.p.x > 0 ? 1 : -1 };
        if (gol && evs.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) {
          if (gol.chuteTick != null) { roteiro = roteiroGol(S.a, gol); achou = { sem, S, gol, roteiro, saida: S.m.tick }; }
          break;
        }
      }
    }
    if (!achou) reg('C1 gol de verdade (IA × IA) nas sementes 1–30', 'nenhum', '≥ 1', false);
    else {
      const { S, gol, roteiro, saida, sem } = achou;
      const tv = roteiro.planos[0];
      const bp = {}, bq = {}, lista = [];
      let cruzou = false, chuteNoTV = tv.de <= gol.chuteTick;
      for (let t = tv.de; t <= tv.ate; t += 0.5) { lerQuadro(S.a, t, lista, bp, bq, null); if (Math.abs(bp.x) > CAMPO.meioX + BOLA.raio) cruzou = true; }
      reg('C1 gol de verdade: o replay vai do chute (ou antes) até a bola entrar', `semente ${sem}: chute ${gol.chuteTick}, gol ${gol.golTick}; TV ${tv.de}–${tv.ate}; bola passa a linha no replay ${cruzou}`, 'começa ≤ chute, termina ≥ gol, cruza', chuteNoTV && tv.ate >= gol.golTick && cruzou);
      const corteSaida = S.a.ultimoCorte(gol.golTick, saida);
      const ultimoTick = Math.max(...roteiro.planos.map(p => p.ate));
      reg('C2 não atravessa a montagem da saída (o corte depois do gol)', `corte da saída ${corteSaida}; o replay vai até ${ultimoTick}`, 'corte existe; replay antes dele', corteSaida != null && ultimoTick < corteSaida);
      const dAnt = duracao({ ...roteiro, planos: roteiro.planos.filter(p => p.cam === 'tv' || p.cam === 'atras' || p.cam === 'lateral') });
      reg('C3 duração do replay do gol (a parte antiga: tv, atras, lateral)', `${fmt(dAnt, 2)} s, ${roteiro.planos.length} planos (${roteiro.planos.map(p => p.cam).join(', ')})${roteiro.golaco ? ', golaço' : ''}`, `6–${REPLAY.gol.maximo} s (golaço: ≤ ${REPLAY.gol.maximoGolaco})`,
        dAnt >= 6 && dAnt <= (roteiro.golaco ? REPLAY.gol.maximoGolaco : REPLAY.gol.maximo) + 1e-9);
      // gravar não muda nada: o mesmo número de passos sem gravar dá o mesmo hash
      const S2 = novaPartida(sem);
      for (let i = 0; i < S.m.tick; i++) passo(S2, false);
      reg('C4 gravar não muda a simulação (hash no mesmo tick com e sem anel)', `${hashMundo(S.m)} × ${hashMundo(S2.m)} (tick ${S.m.tick})`, 'iguais', hashMundo(S.m) === hashMundo(S2.m) && S.m.tick === S2.m.tick);
      // (16/10: sem a espera do fio na fila do escalonador e sem os 600 primeiros passos — o JIT —, como o teste-custo; a
      // parede, com a máquina dividida, media a vez dos outros processos: 66,8 e 95,3 µs; a parede fica impressa)
      const usL = S.nLimpo > 0 ? 1000 * S.msLimpo / S.nLimpo : 1000 * S.ms / S.n;
      reg('C5 custo de gravar (Node; parede − espera na fila, depois do aquecimento)', `${fmt(usL, 1)} µs por passo (${S.nLimpo || S.n} passos; a parede com tudo: ${fmt(1000 * S.ms / S.n, 1)} µs em ${S.n})`, '≤ 50 µs', usL <= 50);
    }
    // C6–C8: o 1º impedimento de verdade
    let im = null;
    for (let sem = 1; sem <= 30 && !im; sem++) {
      const S = novaPartida(sem);
      for (let i = 0; i < 9000; i++) {
        const evs = passo(S);
        const e = evs.find(x => x.tipo === 'impedimento');
        if (e) { im = { sem, S, e, apito: S.m.tick, lado: S.m.ataca[e.time] }; break; }
      }
    }
    if (!im) reg('C6 impedimento de verdade (IA × IA) nas sementes 1–30', 'nenhum', '≥ 1', false);
    else {
      const { S, e, apito, sem } = im;
      reg('C6 o evento do impedimento traz o tick da foto (o passe)', `semente ${sem}: apito ${apito}, foto ${e.tickFoto} (${fmt((apito - e.tickFoto) / 60, 2)} s antes)`, 'foto < apito, no anel', e.tickFoto != null && e.tickFoto < apito && S.a.slot(e.tickFoto) >= 0);
      const ri = roteiroImpedimento(S.a, { fotoTick: e.tickFoto, apitoTick: apito, linhaX: e.linhaX, idImpedido: e.id, time: e.time, lado: im.lado, defensor: e.defensor, por: e.por });
      const imp0 = jogadorNoTick(S.a, e.tickFoto, e.id);
      const def = defensorDaLinha(S.a, e.tickFoto, 1 - e.time, e.linhaX, 1.5);
      const alem = imp0 ? (imp0.x - e.linhaX) * im.lado : NaN;
      reg('C7 no quadro do passe o impedido está além da linha', `impedido ${e.id} a ${fmt(alem, 2)} m além; linha em x ${fmt(e.linhaX, 2)}${def ? `, defensor ${def.id} em x ${fmt(def.x, 2)}` : ' (linha da bola/meio)'}`, '> 0,1 m (tolerância)', imp0 && alem > C.IMPEDIMENTO.tolerancia);
      // até o apito (o toque do impedido) se ele vier até depoisMax × velDepoisMax s depois do passe
      const I = REPLAY.impedimento, cabe = (apito - e.tickFoto) / 60 <= I.depoisMax * I.velDepoisMax;
      const fimEsp = cabe ? apito : e.tickFoto + Math.round(I.depoisMax * I.velDepoisMax * 60);
      const p2 = ri?.planos[1];
      reg('C8 roteiro do impedimento: P1 até o apito (o toque) e a análise congelada no passe, ≤ 7,5 s', ri ? `${ri.planos.map(p => p.cam).join(' → ')}; P1 ${ri.planos[0].de}–${ri.planos[0].ate} (passe ${ri.planos[0].congela.tick}, depois a ${fmt(ri.planos[0].congela.velDepois, 2)}×); P2 no ${p2?.congela.tick} por ${p2?.congela.s} s; ${fmt(duracao(ri), 2)} s` : 'sem roteiro',
        `linha → saot; P1 termina em ${fimEsp}; P2 na foto ≥ 3,0 s; ≤ 7,5 s`,
        !!ri && ri.planos.length === 2 && ri.planos[0].congela.tick === e.tickFoto && ri.planos[0].ate === fimEsp && !!p2 && p2.cam === 'saot' && p2.congela.tick === e.tickFoto && p2.congela.s >= 3.0 && duracao(ri) <= 7.5 + 1e-9);
    }
  }
}

// ---------------------------------------------------------------- G) 3ª e 4ª câmeras (12/10)
if (RA && RR) await itensG();

async function itensG() {
  let RO = null, TE = null;
  try { RO = await imp('render/replay-olhos.js'); TE = await imp('tecnicos.js'); } catch (_) { RO = null; }
  if (!RO || !RR.planosExtrasGol) { reg('G 3ª e 4ª câmeras do gol (render/replay-olhos.js, planosExtrasGol)', 'não existem', 'existem', false); return; }
  // --so-g5: só o pênalti (diagnóstico)
  if (args.includes('--so-g5')) { await itemG5(RO); return; }
  if (args.includes('--so-g14')) { await itemG3b(); await itemG14(); await itemG15(); await itemG16(); await itemG17(); await itemG18(); return; }
  if (args.includes('--so-g18')) { await itemG18(); return; }
  if (args.includes('--so-g3b')) { await itemG3b(); return; }
  const C = await imp('config.js');
  const { REPLAY, CAMPO } = C;
  const { J, NJ } = await imp('anim.js');
  const { mediana, quantil } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  // --ref <commit>: a versão de comparação do G2 (git archive numa pasta temporária); --base <pasta js>: já extraída
  let refJs = args.includes('--base') ? path.resolve(arg('--base')) : null;
  if (!refJs && args.includes('--ref')) {
    const ref = arg('--ref'), raiz = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
    const sha = execFileSync('git', ['rev-parse', '--short=12', ref], { encoding: 'utf8', cwd: raiz }).trim();
    const dest = path.join(os.tmpdir(), `golaco-base-${sha}`);
    if (!fs.existsSync(path.join(dest, 'golaco/js/render/replay-roteiro.js'))) { fs.mkdirSync(dest, { recursive: true }); execFileSync('sh', ['-c', `git archive ${sha} golaco/js | tar -x -C ${dest}`], { cwd: raiz }); }
    refJs = path.join(dest, 'golaco/js');
  }
  // --estresse: 3× as sementes (84); a amostra mínima do G8 (48 gols com autor) cresce com mais sementes, em ordem, até
  // NS + 20 (15/10: uma versão com menos gols por partida reprovava o G8 por falta de amostra, não de 1ª pessoa)
  const ESTRESSE = args.includes('--estresse');
  let NS = +arg('--sementes', ESTRESSE ? 84 : 28);
  const MIN = +arg('--min', 4), NS0 = NS;
  // --de S (28/10): as sementes S, S + 1, ... (padrão 1: as do CI) — para medir em outras partidas sem ferramenta à parte
  const DE = Math.max(1, Math.floor(+arg('--de', 1)) || 1);
  const nPar = Math.max(1, Math.min(NS, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
  const res = [];
  let prox = DE;
  const rodarAte = () => Promise.all(Array.from({ length: nPar }, async () => {
    while (prox <= DE + NS - 1) {
      const s = prox++;
      res.push(await new Promise((ok, erro) => {
        const c = fork(fileURLToPath(import.meta.url), ['--filho-g', '--s', String(s), '--js', pastaJs, '--min', String(MIN), ...(refJs ? ['--ref-js', refJs] : [])]);
        c.on('message', ok); c.on('error', erro);
        c.on('exit', code => { if (code) erro(new Error(`semente ${s} saiu com ${code}`)); });
      }));
    }
  }));
  // (28/10: a amostra conta os gols com autor em que a 1ª pessoa cabe — G8)
  const elegiveisDe = r => r.flatMap(x => x.gols.filter(g => g.ok && g.autor != null && !g.contra && g.chute != null && !g.inelegivel));
  await rodarAte();
  while (elegiveisDe(res).length < 48 && NS < NS0 + 20) { NS = Math.min(NS0 + 20, NS + Math.max(1, Math.ceil((48 - elegiveisDe(res).length) / 1.6))); await rodarAte(); }
  res.sort((a, b) => a.sem - b.sem);
  const gols = res.flatMap(r => r.gols.filter(g => g.ok).map(g => ({ ...g, sem: r.sem })));
  const comAutor = gols.filter(g => g.autor != null && !g.contra && g.chute != null);
  // G1
  {
    const ruins = gols.filter(g => !g.ordem), contraCom = gols.filter(g => g.contra && g.temPrimeira);
    reg('G1 ordem tv, atras, [lateral], primeira, treinador, [saot]; gol contra sem 1ª pessoa', `${gols.length} gols (${comAutor.length} com autor, ${gols.filter(g => g.contra).length} contra): ${ruins.length} fora de ordem, ${contraCom.length} contra com 1ª pessoa; ex.: ${gols.slice(0, 3).map(g => g.cams.join('·')).join(' | ')}`,
      'ordem em todos; 0', gols.length >= 20 && ruins.length === 0 && contraCom.length === 0);
  }
  // G2
  {
    // (28/10: com uma ref de antes do gol lento, o gol em que a base DELA passava do teto do contrato — 12/14 s, + 1 com a
    // checagem — sai diferente de propósito: contado à parte; todo o resto tem de ser igual)
    const dif = gols.filter(g => !g.igualSemExtras), comRef = gols.filter(g => g.igualRef != null);
    const difRef = gols.filter(g => g.igualRef === false && !g.refEstoura), lentosRef = gols.filter(g => g.igualRef === false && g.refEstoura);
    reg('G2 os planos de antes campo a campo iguais com e sem extras; sem extras = --ref', `${gols.length - dif.length}/${gols.length} iguais com e sem extras; ref: ${refJs ? `${comRef.length - difRef.length - lentosRef.length}/${comRef.length} iguais (${path.relative(process.cwd(), refJs) || refJs}); ${lentosRef.length} diferentes onde a base da ref passava do teto (o gol lento)${lentosRef.length ? `: ${lentosRef.map(g => `s${g.sem} gol ${g.golTick}`).join(', ')}` : ''}` : 'não pedido (--ref)'}`,
      `todos; ${refJs ? 'todos (≥ 40) fora os que a ref estourava' : '-'}`, dif.length === 0 && (!refJs || (comRef.length >= 40 && difRef.length === 0)));
  }
  // G3 (28/10: também a BASE — tv, atras [, lateral] [, checagem] — em todo gol: o gol lento passava dela sem o G3 ver)
  {
    const lim = g => (g.golaco ? 21 : 19) + (g.checagem ? 1 : 0);
    const ruins = gols.filter(g => g.extras > REPLAY.gol.extras.maximo + 1e-9 || g.total > lim(g) + 1e-9 || g.antiga > limBase(REPLAY, g) + 1e-9);
    const ext = gols.map(g => g.extras), tot = gols.map(g => g.total), bas = gols.map(g => g.antiga);
    const ex = ruins.slice(0, 3).map(g => `s${g.sem} gol ${g.golTick}${g.golaco ? ' golaço' : ''}: base ${fmt(g.antiga, 2)}, extras ${fmt(g.extras, 2)}, total ${fmt(g.total, 2)}${g.chute != null ? ` (Δ ${fmt((g.golTick - g.chute) / 60, 2)} s)` : ''}`).join('; ');
    reg('G3 base ≤ 12 s (golaço 14; checagem +1); extras ≤ 7,0 s; total ≤ 19 s (golaço 21; checagem +1)', `base até ${fmt(Math.max(...bas), 2)} s (mediana ${fmt(mediana(bas), 2)}); extras até ${fmt(Math.max(...ext), 2)} s (mediana ${fmt(mediana(ext), 2)}); total até ${fmt(Math.max(...tot), 2)} s (mediana ${fmt(mediana(tot), 2)}); ${ruins.length} acima${ex ? ` (${ex})` : ''}`,
      '≤ 12/14 (+1); ≤ 7,0; ≤ 19/21 (+1)', ruins.length === 0);
  }
  await itemG3b();
  // G4
  {
    const ruins = gols.filter(g => !g.dentro);
    reg('G4 planos dentro do anel, sem atravessar corte', `${gols.length - ruins.length}/${gols.length}`, 'todos', ruins.length === 0);
  }
  // G6
  {
    const ps = comAutor.filter(g => g.p).map(g => g.p);
    const oc = Math.max(...ps.map(p => p.olhoCab)), ob = Math.max(...ps.map(p => p.olhoBrutoH)), ob3 = Math.max(...ps.map(p => p.olhoBruto));
    const a0 = Math.min(...ps.map(p => p.arfMin)), a1 = Math.max(...ps.map(p => p.arfMax));
    const cr = ps.filter(p => p.nCorrendo > 10), rs = Math.max(...cr.map(p => p.resid)), rb = mediana(cr.map(p => p.residBruto));
    reg('G6 1ª pessoa: olho perto da cabeça e do olho bruto (na horizontal); arfagem; balanço residual correndo', `olho–cabeça ${fmt(oc, 3)} m, olho–bruto ${fmt(ob, 3)} m na horizontal (${fmt(ob3, 3)} m com a vertical estabilizada); arfagem ${fmt(a0, 0)}°…${fmt(a1, 0)}°; balanço ${fmt(rs * 100, 2)} cm (${cr.length} planos correndo; o olho bruto: ${fmt(rb * 100, 1)} cm de mediana)`,
      '≤ 0,15; ≤ 0,06; [−60°, 15°]; ≤ 1 cm', ps.length > 0 && oc <= 0.15 && ob <= 0.06 && a0 >= -60 - 1e-6 && a1 <= 15 + 1e-6 && cr.length > 0 && rs <= 0.01);
  }
  // G7
  {
    const ps = comAutor.filter(g => g.p).map(g => g.p);
    const giros = ps.flatMap(p => p.giros), p95 = quantil(giros, 0.95), mx = Math.max(...giros);
    const bIn = ps.reduce((s, p) => s + p.bolaIn, 0), bN = ps.reduce((s, p) => s + p.bolaN, 0);
    const olhar = mediana(ps.map(p => p.olharBolaMed));
    const g0 = ps.filter(p => p.gol0 != null), g1 = ps.filter(p => p.gol1 != null);
    reg('G7 1ª pessoa: giro, bola no quadro, olhar na bola, boca do gol no quadro', `giro p95 ${fmt(p95, 0)}°/s, máx ${fmt(mx, 0)}°/s; bola ${fmt(100 * bIn / Math.max(1, bN), 1)}%; olhar ${fmt(olhar, 1)}° (mediana); gol em chute − 0,5 s ${g0.filter(p => p.gol0).length}/${g0.length}, de chute + 0,3 s ao gol ${g1.filter(p => p.gol1).length}/${g1.length}`,
      '≤ 90; ≤ 150; ≥ 95%; ≤ 25°; todos', ps.length > 0 && p95 <= 90 && mx <= 150 && bIn / Math.max(1, bN) >= 0.95 && olhar <= 25 && g0.every(p => p.gol0) && g1.every(p => p.gol1));
  }
  // G8 (28/10: a presença nos gols em que a 1ª pessoa cabe pelas regras fixas do roteiro — lib/replay-g.mjs semLugarPrimeira)
  {
    const lente = comAutor.filter(g => g.p).map(g => g.p).filter(p => p.lente >= 0);
    const eleg = comAutor.filter(g => !g.inelegivel), fora = comAutor.filter(g => g.inelegivel);
    const ps = eleg.filter(g => g.p).map(g => g.p), semLugarCom = fora.filter(g => g.temPrimeira);
    const pres = ps.length / Math.max(1, eleg.length), presTodos = comAutor.filter(g => g.p).length / Math.max(1, comAutor.length);
    const nFora = k => fora.filter(g => g.inelegivel === k).length;
    reg('G8 1ª pessoa: nenhum corpo a < 0,3 m da lente; presente em ≥ 80% dos gols com autor em que ela cabe (corte e orçamento dos extras); nenhuma onde não cabe',
      `${lente.length} planos com corpo na lente; presente em ${ps.length}/${eleg.length} (${fmt(100 * pres, 1)}%; ${ps.filter(p => p.cortado).length} encurtados pela lente); sem lugar: ${nFora('corte')} pelo corte, ${nFora('orçamento')} pelo orçamento, ${semLugarCom.length} com 1ª pessoa; de todos os ${comAutor.length} com autor: ${fmt(100 * presTodos, 1)}%`,
      `0; ≥ 80% (≥ 48 gols); 0`,
      lente.length === 0 && pres >= 0.8 && eleg.length >= 48 && semLugarCom.length === 0);
  }
  // G9
  {
    const ts = gols.filter(g => g.t).map(g => g.t);
    const oc = Math.max(...ts.map(t => t.olhoCab)), fovs = Math.max(...ts.map(t => t.fovs));
    const bIn = ts.reduce((s, t) => s + t.bolaIn, 0), bN = ts.reduce((s, t) => s + t.bolaN, 0);
    const giros = ts.flatMap(t => t.giros), gg = ts.filter(t => t.golGol != null);
    reg('G9 treinador (parte 1): olho, fov fixo, bola no quadro, gol no quadro, giro', `${ts.length} planos de ${gols.length} gols; olho–cabeça ${fmt(oc, 3)} m; fov ${fovs === 1 ? 'constante' : fovs + ' valores'}; bola ${fmt(100 * bIn / Math.max(1, bN), 1)}%; gol no quadro no gol ${gg.filter(t => t.golGol).length}/${gg.length}; giro p95 ${fmt(quantil(giros, 0.95), 1)}°/s, máx ${fmt(Math.max(...giros), 1)}°/s`,
      '≤ 0,15; constante; ≥ 95%; todos; ≤ 15; ≤ 30', ts.length > 0 && oc <= 0.15 && fovs === 1 && bIn / Math.max(1, bN) >= 0.95 && gg.every(t => t.golGol) && quantil(giros, 0.95) <= 15 && Math.max(...giros) <= 30);
  }
  // G10
  {
    const p2 = gols.filter(g => g.t && g.t.p2).map(g => g.t.p2);
    const inteiro = p2.reduce((s, q) => s + q.inteiro, 0), n = p2.reduce((s, q) => s + q.n, 0), livre = p2.reduce((s, q) => s + q.livre, 0);
    const x0 = Math.min(...p2.map(q => q.xMin)), x1 = Math.max(...p2.map(q => q.xMax)), cc = Math.min(...p2.map(q => q.camCorpo));
    const solido = p2.filter(q => q.camSolido).length, perto = p2.reduce((s, q) => s + q.perto2, 0);
    reg('G10 treinador (parte 2): inteiro no quadro, terço esquerdo, sem ninguém na frente, câmera livre', `${p2.length} partes 2 (de ${gols.filter(g => g.t).length} planos): inteiro ${inteiro}/${n}; x ${fmt(x0, 2)}–${fmt(x1, 2)}; livre ${fmt(100 * livre / Math.max(1, n), 1)}%; câmera em sólido ${solido}, a ${fmt(cc, 2)} m do corpo mais perto; corpo a < 2 m no quadro ${perto}`,
      '100%; [0,2; 0,45]; ≥ 90%; 0, ≥ 0,6; 0', p2.length > 0 && inteiro === n && x0 >= 0.2 && x1 <= 0.45 && livre / Math.max(1, n) >= 0.9 && solido === 0 && cc >= 0.6 && perto === 0);
  }
  // G13 (14/10: "nada atravessa, lente nunca dentro de sólido" e o treinador reagindo)
  {
    const ps = comAutor.filter(g => g.p).map(g => g.p), ts = gols.filter(g => g.t).map(g => g.t), p2 = ts.filter(t => t.p2).map(t => t.p2);
    const sp = ps.reduce((s, p) => s + p.solido, 0), np = ps.reduce((s, p) => s + p.n, 0), prop = Math.min(...ps.map(p => p.proprio));
    const st = ts.reduce((s, t) => s + t.solido, 0), nt = ts.reduce((s, t) => s + t.n, 0), cl = ts.reduce((s, t) => s + t.corpoLente, 0), cm = Math.min(...ts.map(t => t.corpoMin).filter(v => v != null));
    const reagem = p2.filter(q => q.reage >= 6).length;
    const exP = ps.find(p => p.solido)?.solidoEx, exT = ts.find(t => t.solido)?.solidoEx, exC = ts.find(t => t.corpoLente)?.corpoEx;
    reg('G13 a lente fora dos sólidos (1ª pessoa e treinador); nada do próprio corpo na lente; ninguém na lente do treinador; ele reage no plano 2',
      `1ª pessoa: ${sp}/${np} quadros em sólido${exP ? ` (${exP})` : ''}, o corpo dele que aparece a ≥ ${fmt(prop, 2)} m da lente; treinador: ${st}/${nt} em sólido${exT ? ` (${exT})` : ''}, ${cl} quadros com corpo a < ${REPLAY.primeira.corpo} m no quadro${exC ? ` (${exC})` : ''} (${Number.isFinite(cm) ? `o mais perto a ${fmt(cm, 2)} m` : 'ninguém a < 2,5 m dela'}); a mão acima da cabeça (≥ 0,1 s) em ${reagem}/${p2.length} partes 2`,
      `0; ≥ 0,20 m; 0; 0; todas`, ps.length > 0 && ts.length > 0 && p2.length > 0 && sp === 0 && prop >= 0.2 && st === 0 && cl === 0 && reagem === p2.length);
  }
  // G12
  {
    const c = res.reduce((s, r) => s + r.g12.comparados, 0), d = res.reduce((s, r) => s + r.g12.diferentes, 0);
    reg('G12 a pose do treinador gravada = a ao vivo (bit a bit, 57 floats)', `${c - d}/${c} passos iguais`, 'todos', c > 0 && d === 0);
  }
  // ---------------------------------------------------------------- G11 (anel sintético)
  {
    const aCfg = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / C.PASSO), vagas: REPLAY.vagas, nj: NJ });
    const a = RA.criarAnel({ ticks: 60, vagas: REPLAY.vagas, nj: NJ });
    const P0 = new Float32Array(NJ * 3);
    a.inicio(100, 1, false);
    // a linha em x 20: o defensor 11 em x 19,3 e o treinador 210 (do mesmo time 1) em 20,05 (mais perto da linha)
    for (let k = 0; k < P0.length; k += 3) { P0[k] = 19.3; P0[k + 2] = 3; }
    a.jogador(0, 11, 1, false, 19.3, 3, 0, P0);
    a.jogador(1, 211, 1, false, 20.05, 36, 0, P0, true);
    a.fim({ x: 0, y: 0.11, z: 0 }, { x: 0, y: 0, z: 0, w: 1 });
    const lista = [{ pose: new Float32Array(NJ * 3), ocultar: 6, tecnico: false }, { pose: new Float32Array(NJ * 3), ocultar: 6 }];
    RA.lerQuadro(a, 100, lista, {}, {}, null);
    const tec = lista.find(it => it.id === 211), jog = lista.find(it => it.id === 11);
    const def = RA.defensorDaLinha(a, 100, 1, 20, 1.5);
    reg('G11 anel com 26 vagas ≤ 4 MB; lerQuadro marca it.tecnico e zera it.ocultar; defensorDaLinha nunca o treinador',
      `${REPLAY.vagas} vagas, ${fmt(aCfg.bytes / 1048576, 2)} MB; treinador tecnico ${tec?.tecnico}, ocultar ${tec?.ocultar}/${jog?.ocultar}; defensor da linha ${def ? def.id : 'nenhum'}`,
      '26, ≤ 4 MB; true, 0/0; 11', REPLAY.vagas === 26 && aCfg.bytes <= 4 * 1048576 && tec?.tecnico === true && jog?.tecnico === false && tec?.ocultar === 0 && jog?.ocultar === 0 && def?.id === 11);
  }
  // ---------------------------------------------------------------- G5 (pênalti) e G1 com "reduzir movimento"
  await itemG5(RO);
  await itemG14();
  await itemG15();
  await itemG16();
  await itemG17();
  await itemG18();
  {
    const g = comAutor.find(x => x.temPrimeira);
    reg('G1b "reduzir movimento": sem 1ª pessoa (o resto igual)', g ? 'conferido no G5 (mesmo gol, com e sem)' : 'sem gol com autor', '-', true);
  }
  console.log(`G: ${res.length} partidas (sementes ${DE}–${DE + NS - 1}${NS > NS0 ? `: ${NS0} + ${NS - NS0} até 48 gols com autor em que a 1ª pessoa cabe` : ''}) de 2 × ${MIN} min, ${gols.length} gols, ${nPar} processos${ESTRESSE ? ' (--estresse)' : ''}`);
}

/**
 * G18 (29/10, C3 — item 14 da FILA: "o olho da 1ª pessoa no cabeceio fica na esfera de baixo da cabeça no salto") o PULO de
 * verdade: o canhão de cruzamentos do teste-cabeceio (60 cenas, sementes 3000–3059: o cruzamento da ponta para 2 atacantes
 * marcados, o resto longe) gravado no anel como a página (lib/anel-node.mjs), e em cada cabeceio A GOL o enquadramento da 1ª
 * pessoa do autor de chute − 0,9 s (ou da montagem da cena) a chute + 0,9 s: a. a lente nunca fica ruim (a < solidoFolga
 * de um sólido ou a < `proprio` do próprio quadril e das pernas: replay-olhos.js lenteRuimPrimeira, a regra que corta o
 * plano) de chute − 0,5 s a chute + 0,4 s; b. o olho nunca desce mais de 6 cm abaixo do centro da cabeça de chute − 0,4 s a
 * chute + 0,3 s (o olho bruto fica 3 cm ACIMA dele). Na versão de antes: a lente ruim ~0,15 s antes do contato e o olho a
 * −0,14 m (o fundo da faixa) em TODOS os cabeceios — a altura suavizada por 0,33 s + σ 0,26 s não acompanhava a cabeça
 * subindo ~0,3–0,6 m no pulo, e a 1ª pessoa saía de quase todo gol de cabeça (~4–5% dos gols).
 */
async function itemG18() {
  const C = await imp('config.js'), RO = await imp('render/replay-olhos.js'), A = await imp('acoes.js'), PA = await imp('partida.js');
  const { J } = await imp('anim.js');
  const { uniforme } = await imp('rng.js');
  const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/anel-node.mjs')).href);
  const GR = await criarGravador(pastaJs);
  const MX = C.CAMPO.meioX, F = C.REPLAY.primeira, s60 = x => Math.round(x * 60);
  let n = 0, ruins = 0, baixos = 0, olhoMin = Infinity, comPrim = 0, ex = '';
  for (let k = 0; k < 60; k++) {
    const S = GR.novaPartida(3000 + k, { minutosPorTempo: 4, tecnicos: false });
    const m = S.m;
    for (let i = 0; i < 400 && !(m.partida.estado === 'jogo' && (!m.parada || m.parada.rolou)); i++) GR.passo(S, true);
    for (let i = 0; i < 30; i++) GR.passo(S, true);
    // (a cena do canhão A do teste-cabeceio)
    const T = 1, lado = m.ataca[T], sz = k % 2 ? 1 : -1;
    const meu = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL'), deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
    const ata = meu.filter(j => j.posicao === 'ATA'), zag = deles.filter(j => j.posicao === 'ZAG' || j.posDetalhe === 'ZAG');
    const cruzador = meu.find(j => !ata.includes(j));
    const a1 = ata[0] ?? meu[1], a2 = ata[1] ?? meu.find(j => j !== cruzador && j !== a1), d1 = zag[0] ?? deles[0], d2 = zag[1] ?? deles[1];
    const jit = () => (uniforme(m.rng) - 0.5), gx = lado * MX;
    PA.teleportar(cruzador, gx - lado * (14 + 2 * jit()), sz * (27 + 2 * jit()), Math.atan2(-sz, lado));
    PA.teleportar(a1, gx - lado * (11 + 2 * jit()), sz * 1.5 * jit(), lado > 0 ? 0 : Math.PI);
    PA.teleportar(a2, gx - lado * (7 + jit()), -sz * (3 + jit()), lado > 0 ? 0 : Math.PI);
    PA.teleportar(d1, a1.x + lado * (0.9 + 0.3 * jit()), a1.z + 0.4 * jit(), lado > 0 ? Math.PI : 0);
    PA.teleportar(d2, a2.x + lado * (0.9 + 0.3 * jit()), a2.z + 0.4 * jit(), lado > 0 ? Math.PI : 0);
    let q = 0;
    for (const j of m.jogadores) { if ([cruzador, a1, a2, d1, d2].includes(j) || j.posicao === 'GOL') continue; PA.teleportar(j, -lado * (5 + 3 * (q % 4)), -30 + 6 * (q % 11), j.rumo); q++; }
    PA.teleportar(m.jogadores.find(j => j.time !== T && j.posicao === 'GOL'), gx - lado * 1.5, 0, lado > 0 ? Math.PI : 0);
    const b = m.bola;
    b.p.x = cruzador.x + Math.cos(cruzador.rumo) * 0.35; b.p.z = cruzador.z + Math.sin(cruzador.rumo) * 0.35; b.p.y = 0.11;
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
    m.posse = cruzador.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    m.ultimoToque = { id: cruzador.id, time: T, tick: m.tick };
    cruzador.pedido = { tipo: 'lancamento', forca: 0.7, tick: m.tick };
    A.executarAcao(m, cruzador, cruzador.par.attr.pePreferido ?? 1, false);
    if (!m.voo || m.voo.tipo !== 'cruzamento') continue;
    let ch = null, autor = null;
    for (let i = 0; i < 240; i++) {
      const ev = GR.passo(S, true);
      for (const e of ev) if (ch == null && e.tipo === 'passe' && e.modo === 'cabeceio' && m.voo && m.voo.cabeceio === 'chute') { ch = m.tick; autor = e.id; }
      if (ch != null && m.tick >= ch + 75) break;
    }
    if (ch == null) continue;
    n++;
    const golTick = ch + 30;
    const r = RR.roteiroGol(S.a, { golTick, chuteTick: ch, lado, time: T, autor, contra: false, desvio: false, tipoChute: 'cabeceio' });
    if (r?.planos.some(pl => pl.cam === 'primeira')) comPrim++;
    // o enquadramento inteiro (sem o corte pela lente do roteiro), da montagem da cena (ou chute − antes) a chute + 0,9 s
    let de = Math.max(S.a.primeiro, ch - s60(F.antes));
    const c0 = S.a.ultimoCorte(de, ch); if (c0 != null) de = c0;
    const e = RO.enquadrarPrimeira(S.a, { de, ate: Math.min(S.a.ultimo, golTick + s60(F.depois)), autor, chuteTick: ch, golTick, lado, tipoChute: 'cabeceio', vel: F.vel });
    if (!e) { ruins++; if (!ex) ex = `semente ${3000 + k}: sem enquadramento`; continue; }
    const todos = [];
    RO.lenteRuimPrimeira(S.a, e, F.solidoFolga, F.proprio, todos);
    const ruim = todos.find(t => t >= ch - 30 && t <= ch + 24);
    if (ruim != null) { ruins++; if (!ex) ex = `semente ${3000 + k}: lente ruim no passo chute ${ruim - ch >= 0 ? '+' : ''}${ruim - ch}`; }
    const cam = {}, cab = { x: 0, y: 0, z: 0 };
    let mn = Infinity;
    for (let t = Math.max(e.de, ch - 24); t <= Math.min(e.ate, ch + 18); t++) { RO.cameraPrimeira(e, t, cam); if (RA.juntaNoTick(S.a, t, autor, J.cabeca, cab)) mn = Math.min(mn, cam.y - cab.y); }
    olhoMin = Math.min(olhoMin, mn);
    if (mn < -0.06) { baixos++; if (!ex) ex = `semente ${3000 + k}: o olho a ${fmt(100 * mn, 1)} cm do centro da cabeça`; }
  }
  reg('G18 o PULO do cabeceio a gol de verdade (canhão de cruzamentos, 60 cenas): a lente da 1ª pessoa nunca ruim de chute − 0,5 s a + 0,4 s e o olho a ≥ −6 cm do centro da cabeça de chute − 0,4 s a + 0,3 s, em cada cabeceio',
    `${n} cabeceios: lente ruim ${ruins}, olho baixo ${baixos} (o mais baixo ${fmt(100 * olhoMin, 1)} cm)${ex ? ` (${ex})` : ''}; com a 1ª pessoa no roteiro ${comPrim} (o resto: a montagem da cena perto do chute)`,
    '≥ 20; 0 e 0', n >= 20 && ruins === 0 && baixos === 0);
}

/**
 * G3b (28/10) o gol LENTO, SINTÉTICO (sem partida, determinístico): o chute BLOQUEADO no passo seguinte — a bola sobe da
 * perna do zagueiro, quica, bate na trave e entra Δ s depois (a classe nova do goleiro realista: na revisão do C1, semente
 * 102, golaço com Δ 2,97 s e a base em 16,94 s; nas do CI, semente 14, Δ 2,38 s e 15,19 s — o G3 só olhava o total) —, de
 * 24 m (golaço) e de 14 m, Δ ∈ {1,0; 2,0; 2,4; 3,0; 4,0; 5,0; 6,5} s, com o autor e os dois treinadores no anel e o replay
 * montado na saída (gol + 150, como a página): em cada gol a base ≤ 12/14 s, os extras ≤ 7 s e o total ≤ 19/21 s (o G3) e
 * a LEITURA do lance: a TV (1×) do chute − 1,5 s (ou do começo do anel) até depois do gol — o chute e o desvio inteiros —;
 * até Δ 5 s, o de trás do gol mostra o GOL (começa ≥ 1 s antes dele e acaba depois dele); o golaço até Δ 4 s com a
 * lateral (o 3º ângulo só sai quando o de trás do gol já está no piso); com Δ 1 s, o de trás do gol começa 1 s antes do
 * chute (o roteiro de sempre). Na versão de antes, a base passa do teto a partir de Δ 2,0 s (golaço) e 2,4 s.
 */
async function itemG3b() {
  const RA = await imp('render/replay-anel.js'), RR = await imp('render/replay-roteiro.js'), C = await imp('config.js');
  const EF = await imp('estadio-forma.js');
  const { criarJogador } = await imp('jogador.js');
  const { pose, NJ } = await imp('anim.js');
  const { REPLAY, CAMPO, PASSO } = C;
  const j0 = criarJogador(9, 0, 0, 0, {}, 0);
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [j0] };
  const P0 = pose(j0, mini, new Float32Array(NJ * 3)), Pt = new Float32Array(NJ * 3);
  const gx = CAMPO.meioX, lin = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
  const ponha = (a, v, id, time, gk, x, z, rumo, tec = false) => {
    for (let k = 0; k < NJ; k++) { Pt[k * 3] = P0[k * 3] + x; Pt[k * 3 + 1] = P0[k * 3 + 1]; Pt[k * 3 + 2] = P0[k * 3 + 2] + z; }
    a.jogador(v, id, time, gk, x, z, rumo, Pt, tec);
  };
  const at = [EF.areaTecnica(0), EF.areaTecnica(1)].map(r => ({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2 }));
  const durP = p => (p.ate - p.de) / 60 / p.vel;
  const ruins = [], linhasG = [];
  let casos = 0;
  for (const dist of [24, 14]) for (const D of [1.0, 2.0, 2.4, 3.0, 4.0, 5.0, 6.5]) {
    casos++;
    const ch = 700, gol = ch + Math.round(D * 60), xCh = gx - dist, xBl = xCh + 1.1, fim = gol + 150;
    const a = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    for (let t = 0; t <= fim; t++) {
      a.inicio(t, t * PASSO, false);
      // o autor (9) chega a 6 m/s e, depois do chute, segue um pouco e para; o zagueiro (14) bloqueia na frente dele; o
      // goleiro (12) na meta; os treinadores (210, 211) no meio das áreas técnicas
      const xA = t <= ch ? xCh - 0.4 - 6 * (ch - t) * PASSO : xCh - 0.4 + 1.2 * (1 - Math.exp(-(t - ch) / 30));
      ponha(a, 0, 9, 0, false, xA, 0.8, 0);
      ponha(a, 1, 14, 1, false, xBl + 0.3, 0.9, Math.PI);
      ponha(a, 2, 12, 1, true, gx - 1.2, 0, Math.PI);
      ponha(a, 3, 210, 0, false, at[0].x, at[0].z, -Math.PI / 2, true);
      ponha(a, 4, 211, 1, false, at[1].x, at[1].z, -Math.PI / 2, true);
      // a bola: no pé até o chute; bate no zagueiro e SOBE (até 3,5 m), quica perdendo altura até a trave (gol − 12) e entra
      let b;
      if (t <= ch) b = { x: xA + 0.4, y: 0.11, z: 0.8 };
      else if (t <= ch + 3) b = { x: lin(xCh, xBl, (t - ch) / 3), y: 0.3, z: 0.85 };
      else if (t <= gol - 12) {
        const u = (t - ch - 3) / (gol - 15 - ch);
        b = { x: lin(xBl, gx - 0.3, u), y: 0.11 + 3.4 * (1 - u) * Math.abs(Math.sin(Math.PI * Math.min(1, u * 1.6) * 2)), z: lin(0.85, 3.5, u) };
      } else if (t <= gol) b = { x: lin(gx - 0.3, gx + 0.15, (t - gol + 12) / 12), y: 0.11, z: lin(3.5, 3.1, (t - gol + 12) / 12) };
      else b = { x: lin(gx + 0.15, gx + 1.3, (t - gol) / 40), y: 0.11, z: 3.0 };
      if (a.marcar) a.marcar(t === ch ? 1 : t === gol ? 2 : 0);
      a.fim(b, { x: 0, y: 0, z: 0, w: 1 });
    }
    const g = { golTick: gol, chuteTick: ch, lado: 1, time: 0, autor: 9, contra: false, desvio: true, tipoChute: 'chute' };
    const r = RR.roteiroGol(a, g), r0 = RR.roteiroGol(a, { ...g, extras: false });
    const nome = `${dist} m, Δ ${fmt(D, 1)} s`;
    if (!r || !r0) { ruins.push(`${nome}: sem roteiro`); continue; }
    const base = RR.duracao(r0), total = RR.duracao(r);
    const extras = r.planos.filter(p => p.cam === 'primeira' || p.cam === 'treinador').reduce((s, p) => s + durP(p), 0);
    const tv = r.planos.find(p => p.cam === 'tv'), atras = r.planos.find(p => p.cam === 'atras'), lat = r.planos.find(p => p.cam === 'lateral');
    const golaco = !!r.golaco;
    const lB = limBase(REPLAY, r), lT = (golaco ? 21 : 19) + (r.checagem ? 1 : 0);
    const prob = [];
    if (golaco !== dist >= REPLAY.gol.golaco) prob.push(`golaço ${golaco}`);
    if (base > lB + 1e-9) prob.push(`base ${fmt(base, 2)} > ${lB}`);
    if (extras > REPLAY.gol.extras.maximo + 1e-9) prob.push(`extras ${fmt(extras, 2)}`);
    if (total > lT + 1e-9) prob.push(`total ${fmt(total, 2)} > ${lT}`);
    if (!tv || tv.de > Math.max(a.primeiro, ch - Math.round(REPLAY.gol.antesMin * 60)) || tv.ate < gol) prob.push(`TV ${tv ? `${tv.de - ch}..${tv.ate - ch}` : 'sem'}`);
    if (D <= 5 && (!atras || atras.de > gol - Math.round(REPLAY.gol.lentoAntes * 60) || atras.ate <= gol)) prob.push(`atrás ${atras ? `${atras.de - ch}..${atras.ate - ch}` : 'sem'}`);
    if (golaco && D <= 4 && !lat) prob.push('sem a lateral');
    if (D <= 1 && atras && atras.de !== ch - Math.round(REPLAY.gol.lentoAntes * 60)) prob.push(`atrás de ${atras.de - ch} (não o de sempre)`);
    linhasG.push(`${nome}: ${r.planos.map(p => `${p.cam} ${fmt(durP(p), 1)}`).join('·')} (base ${fmt(base, 2)}, total ${fmt(total, 2)})`);
    if (prob.length) ruins.push(`${nome}${golaco ? ' golaço' : ''}: ${prob.join(', ')}`);
  }
  reg('G3b gol LENTO sintético (o chute bloqueado que sobe, quica, bate na trave e entra Δ s depois; 24 e 14 m, Δ 1–6,5 s): base ≤ 12/14 s, extras ≤ 7 s, total ≤ 19/21 s; a TV do chute − 1,5 s até o gol; até Δ 5 s o de trás do gol com o gol (≥ 1 s antes dele); o golaço até Δ 4 s com a lateral',
    `${casos} gols: ${ruins.length} ruins${ruins.length ? ` (${ruins.slice(0, 4).join('; ')})` : ''}; ex.: ${linhasG.filter((_, i) => i === 3 || i === 5 || i === 13).join(' | ')}`,
    'todos', ruins.length === 0 && casos === 14);
}

async function itemG14() {
  const { criarMedidor } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  const { medirGol } = await criarMedidor(pastaJs);
  const RA = await imp('render/replay-anel.js'), RO = await imp('render/replay-olhos.js'), RR = await imp('render/replay-roteiro.js'), C = await imp('config.js');
  const { criarJogador } = await imp('jogador.js');
  const { pose, NJ, J } = await imp('anim.js');
  const { REPLAY, CAMPO, PASSO } = C;
  const GRAU = 180 / Math.PI;
  // a pose de pé (de frente para +x) levada pelo caminho: o olho e o corpo do autor do jeito que o anel guarda
  const j0 = criarJogador(9, 0, 0, 0, {}, 0);
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [j0] };
  const P0 = pose(j0, mini, new Float32Array(NJ * 3)), Pt = new Float32Array(NJ * 3);
  const gx = CAMPO.meioX, ch = 300, gol = ch + 52, xCh = 45.3;
  const lin = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
  let n = 0, nRuins = 0, ex = '', piorAng = 0, casos = 0, bolaMin = 1, bIn = 0, bN = 0;
  // (até 7,5 m/s: mais depressa, o olho chega à linha do gol antes da bola e o centro da boca fica abaixo do quadro de
  // qualquer jeito — o limite da medida do G7, nas duas versões)
  for (const v of [5, 6, 6.5, 7, 7.5]) for (const zA of [0.5, -1.5]) for (const zb of [3.5, 1.4, -2.5]) {
    casos++;
    const a = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    for (let t = 0; t <= gol + 150; t++) {
      // o autor: a v m/s em +x até o fundo da rede (x 54,3), pela linha z = zA
      const x = Math.min(54.3, xCh + v * (t - ch) * PASSO), z = zA;
      for (let k = 0; k < NJ; k++) { Pt[k * 3] = P0[k * 3] + x; Pt[k * 3 + 1] = P0[k * 3 + 1]; Pt[k * 3 + 2] = P0[k * 3 + 2] + z; }
      a.inicio(t, t * PASSO, false);
      a.jogador(0, 9, 0, false, x, z, 0, Pt);
      // a bola: o cruzamento da esquerda até a cabeça (no chute), depois para (52,4; 2,2; zb), entra e morre na rede perto
      // da linha (o autor passa por ela)
      const hx = Pt[J.cabeca * 3], hy = Pt[J.cabeca * 3 + 1];
      let b;
      if (t <= ch) { const u = (t - (ch - 60)) / 60; b = { x: lin(38, hx + 0.15, u), y: lin(1.5, hy + 0.1, u), z: lin(14, zA + 0.05, u) }; }
      else if (t <= gol - 16) { const u = (t - ch) / (gol - 16 - ch); b = { x: lin(xCh + 0.3, 52.4, u), y: lin(1.75, 2.2, u), z: lin(zA, zb, u) }; }
      else if (t <= gol) { const u = (t - (gol - 16)) / 16; b = { x: lin(52.4, gx + 0.1, u), y: lin(2.2, 1.2, u), z: lin(zb, zb * 0.4, u) }; }
      else { const u = (t - gol) / 40; b = { x: lin(gx + 0.1, gx + 0.5, u), y: lin(1.2, 0.5, u), z: lin(zb * 0.4, zb * 0.2, u) }; }
      if (a.marcar) a.marcar(t === ch ? 1 : t === gol ? 2 : 0);
      a.fim(b, { x: 0, y: 0, z: 0, w: 1 });
    }
    const g = { golTick: gol, chuteTick: ch, lado: 1, time: 0, autor: 9, contra: false, desvio: false, tipoChute: 'cabeceio' };
    const m = medirGol(a, g);
    const prim = RR.roteiroGol(a, g)?.planos.find(p => p.cam === 'primeira');
    const nome = `${v} m/s pela linha z ${zA}, a bola para z ${zb}`;
    if (!prim || !m.p) { nRuins++; if (!ex) ex = `${nome}: sem 1ª pessoa`; continue; }
    // o olhar × o rumo para a boca do gol, de chute + 0,3 s ao gol (no plano)
    const cam = {};
    let angMax = 0;
    for (let t = ch + 18; t <= Math.min(gol, prim.ate); t++) {
      RO.cameraPrimeira(prim.enq, t, cam);
      const yv = Math.atan2(cam.lz - cam.z, cam.lx - cam.x), yg = Math.atan2(-cam.z, gx - cam.x);
      let d = Math.abs(yv - yg); if (d > Math.PI) d = 2 * Math.PI - d;
      angMax = Math.max(angMax, d * GRAU);
      n++;
    }
    const bolaFr = m.p.bolaIn / Math.max(1, m.p.bolaN);
    piorAng = Math.max(piorAng, angMax); bolaMin = Math.min(bolaMin, bolaFr); bIn += m.p.bolaIn; bN += m.p.bolaN;
    if (m.p.gol1 === false || angMax > 60) {
      nRuins++;
      if (!ex) ex = `${nome}: boca do gol no quadro ${m.p.gol1}, bola no quadro ${fmt(100 * bolaFr, 0)}%, olhar a ${fmt(angMax, 0)}° dela (1ª pessoa ${prim.de}–${prim.ate}${prim.cortadoPelaLente ? ', cortada' : ''})`;
    }
  }
  reg('G14 gol de cabeça sintético, o autor seguindo para dentro do gol: a boca do gol no quadro de chute + 0,3 s ao gol e o olhar a ≤ 60° dela em cada gol; a bola no quadro ≥ 95% de chute a gol (as metas do G7)',
    `${casos} gols (${n} passos): ${nRuins} ruins${ex ? ` (${ex})` : ''}; o olhar a até ${fmt(piorAng, 0)}° da boca do gol; bola no quadro ${fmt(100 * bIn / Math.max(1, bN), 1)}% (no pior gol ${fmt(100 * bolaMin, 0)}%)`, '0; ≤ 60°; ≥ 95%', nRuins === 0 && bIn / Math.max(1, bN) >= 0.95);
}

/**
 * G15 (16/10, frente "cenas robustas") a cabeça que desce DE REPENTE andando, sem partida (determinístico): o autor anda a
 * 1,8 m/s, a cabeça (e o tronco) desce D m e volta em 0,13 ou 0,2 s (um agachado, um tranco), e ele arranca para 5 m/s e chuta:
 * o balanço residual da 1ª pessoa correndo (a medida do G6: y − média móvel de 0,5 s) ≤ 1 cm e o olho a ≤ 0,15 m da
 * cabeça, em cada um dos 36 gols com ela (D 0,20/0,24/0,28 m — o olho tem de descer 9 a 17 cm; na partida, 8 — em 8 ou
 * 12 passos, com o sobe-e-desce da passada, acabando 6 a 14 passos antes da corrida, × 2 lados); presente em ≥ 80% (G8). (Na lógica do
 * domínio-sem-passar, semente 32: a esfera em volta da cabeça puxou o olho 8 cm para baixo em 3 passos e, 15 passos depois,
 * correndo, a média móvel ainda via o degrau: 1,12 cm.)
 */
async function itemG15() {
  const { criarMedidor } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  const { medirGol } = await criarMedidor(pastaJs);
  const RA = await imp('render/replay-anel.js'), C = await imp('config.js');
  const { criarJogador } = await imp('jogador.js');
  const { pose, NJ, J } = await imp('anim.js');
  const { REPLAY, PASSO } = C;
  const j0 = criarJogador(9, 0, 0, 0, {}, 0);
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [j0] };
  const P0 = pose(j0, mini, new Float32Array(NJ * 3)), Pt = new Float32Array(NJ * 3);
  // o que desce com o tronco (os pés e as canelas ficam)
  const FICA = new Set([J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD, J.joelhoE, J.joelhoD].filter(k => k != null));
  const ch = 400, gol = ch + 40, corre = ch - 20;
  const bump = u => (u <= 0 || u >= 1 ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * u));
  let casos = 0, ruins = 0, ex = '', residMax = 0, olhoMax = 0, presentes = 0;
  for (const D of [0.20, 0.24, 0.28]) for (const dur of [8, 12]) for (const antes of [6, 10, 14]) for (const zs of [1, -1]) {
    casos++;
    const a = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    let x = 20, fase = 0;
    // (a descida termina `antes` passos antes do 1º passo correndo — a v > 3 m/s, ~corre + 4)
    const z = zs * 6, dip0 = corre + 4 - antes - dur;
    for (let t = 0; t <= gol + 150; t++) {
      const v = t < corre ? 1.8 : t < corre + 10 ? 1.8 + (5 - 1.8) * (t - corre) / 10 : 5;
      if (t <= ch + 10) x += v * PASSO;
      // a descida e o sobe-e-desce da passada (±4 cm, 1,8 Hz andando → 2,8 Hz correndo)
      fase += 2 * Math.PI * (v < 3 ? 1.8 : 2.8) * PASSO;
      const dy = -D * bump((t - dip0) / dur) + 0.04 * Math.cos(fase);
      for (let k = 0; k < NJ; k++) { Pt[k * 3] = P0[k * 3] + x; Pt[k * 3 + 1] = P0[k * 3 + 1] + (FICA.has(k) ? 0 : dy); Pt[k * 3 + 2] = P0[k * 3 + 2] + z; }
      a.inicio(t, t * PASSO, false);
      a.jogador(0, 9, 0, false, x, z, 0, Pt);
      let b;
      if (t <= ch) b = { x: x + 0.6, y: 0.11, z };
      else { const u = Math.min(1, (t - ch) / (gol - ch)); b = { x: (x + 0.6) + (52.6 - (x + 0.6)) * u, y: 0.11 + 0.9 * Math.sin(Math.PI * u * 0.8), z: z + (0.5 * zs - z) * u }; }
      if (a.marcar) a.marcar(t === ch ? 1 : t === gol ? 2 : 0);
      a.fim(b, { x: 0, y: 0, z: 0, w: 1 });
    }
    const g = { golTick: gol, chuteTick: ch, lado: 1, time: 0, autor: 9, contra: false, desvio: false, tipoChute: 'chute' };
    const m = medirGol(a, g);
    const nome = `descida de ${fmt(D, 2)} m em ${dur} passos, ${antes} passos antes da corrida, z ${z}`;
    // (sem a 1ª pessoa — o plano que sai pelo corte da lente, como o contrato deixa — não é ruim: conta na presença, a
    // meta do G8)
    if (!m.p) continue;
    presentes++;
    residMax = Math.max(residMax, m.p.resid); olhoMax = Math.max(olhoMax, m.p.olhoCab);
    if (!(m.p.resid <= 0.01) || !(m.p.olhoCab <= 0.15) || !(m.p.nCorrendo > 0)) { ruins++; if (!ex) ex = `${nome}: balanço ${fmt(100 * m.p.resid, 2)} cm, olho–cabeça ${fmt(m.p.olhoCab, 3)} m, ${m.p.nCorrendo} passos correndo`; }
  }
  reg('G15 a cabeça que desce de repente andando, antes da corrida (sem partida): balanço residual da 1ª pessoa correndo ≤ 1 cm e olho a ≤ 0,15 m da cabeça em cada gol com ela (as metas do G6); presente em ≥ 80% (a do G8)',
    `${casos} gols: ${ruins} ruins${ex ? ` (${ex})` : ''}; balanço até ${fmt(100 * residMax, 2)} cm; olho–cabeça até ${fmt(olhoMax, 3)} m; presente em ${presentes}/${casos}`, '0; ≤ 1 cm; ≤ 0,15 m; ≥ 80%', ruins === 0 && presentes >= 0.8 * casos);
}

/**
 * G16 (16/10, frente "cenas robustas") gol de PERTO pelo canto, sem partida (determinístico): o autor corre para o gol a
 * 4,5–7,5 m/s e cabeceia (o cruzamento do lado para onde a bola vai) ou chuta a 2,5–5 m da linha, a bola vai para perto da
 * trave (z ±2,5/±3,1, baixa) e ele segue na corrida até 0,5–0,8 m da linha: a boca do gol no quadro em chute − 0,5 s e de
 * chute + 0,3 s ao gol (as metas do G7) em cada um dos 192 gols. (Na lógica da
 * faltas-sentido, semente 11: cabeçada a 3 m da linha para o canto, o olho chegou a 0,8 m do gol e o centro da boca ficou
 * fora do quadro nos 2 últimos passos — 38/39.)
 */
async function itemG16() {
  const { criarMedidor } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  const { medirGol } = await criarMedidor(pastaJs);
  const RA = await imp('render/replay-anel.js'), RO = await imp('render/replay-olhos.js'), RR = await imp('render/replay-roteiro.js'), C = await imp('config.js');
  const { criarJogador } = await imp('jogador.js');
  const { pose, NJ, J } = await imp('anim.js');
  const { REPLAY, CAMPO, PASSO } = C;
  const j0 = criarJogador(9, 0, 0, 0, {}, 0);
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [j0] };
  const P0 = pose(j0, mini, new Float32Array(NJ * 3)), Pt = new Float32Array(NJ * 3);
  const gx = CAMPO.meioX, ch = 300, cam = {}, pr = {};
  let piorNdc = 0, piorEx = '';
  const lin = (a, b, u) => a + (b - a) * Math.max(0, Math.min(1, u));
  let casos = 0, ruins = 0, ex = '', bIn = 0, bN = 0;
  for (const tipo of ['cabeceio', 'chute']) for (const v of [4.5, 6, 7.5]) for (const dl of [2.5, 3, 3.5, 5]) for (const zb of [2.5, 3.1, -2.5, -3.1]) for (const para of [0.5, 0.8]) {
    casos++;
    const zA = zb > 0 ? 0.15 : -0.15, xCh = gx - dl, vb = tipo === 'cabeceio' ? 11 : 16;
    const gol = ch + Math.max(6, Math.round(Math.hypot(dl, zb - zA) / vb / PASSO));
    const a = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    for (let t = 0; t <= gol + 150; t++) {
      // o autor: a v m/s em +x até `para` m da linha (como na partida: ele segue na corrida até o gol)
      const x = Math.min(gx - para, xCh + v * (t - ch) * PASSO);
      for (let k = 0; k < NJ; k++) { Pt[k * 3] = P0[k * 3] + x; Pt[k * 3 + 1] = P0[k * 3 + 1]; Pt[k * 3 + 2] = P0[k * 3 + 2] + zA; }
      a.inicio(t, t * PASSO, false);
      a.jogador(0, 9, 0, false, x, zA, 0, Pt);
      const hx = Pt[J.cabeca * 3], hy = Pt[J.cabeca * 3 + 1];
      let b;
      if (tipo === 'cabeceio' && t <= ch) { const u = (t - (ch - 50)) / 50; b = { x: lin(xCh - 3, hx + 0.15, u), y: lin(3.9, hy + 0.1, u), z: lin(zA + 10 * Math.sign(zb), zA + 0.2 * Math.sign(zb), u) }; }
      else if (t <= ch) b = { x: x + 0.5, y: 0.11, z: zA };
      else { const u = (t - ch) / (gol - ch), x0 = tipo === 'cabeceio' ? xCh + 0.3 : xCh + 0.5, y0 = tipo === 'cabeceio' ? 1.75 : 0.11; b = { x: lin(x0, gx + 0.1, u), y: lin(y0, 0.5, u), z: lin(zA, zb, u) }; }
      if (a.marcar) a.marcar(t === ch ? 1 : t === gol ? 2 : 0);
      a.fim(b, { x: 0, y: 0, z: 0, w: 1 });
    }
    const g = { golTick: gol, chuteTick: ch, lado: 1, time: 0, autor: 9, contra: false, desvio: false, tipoChute: tipo };
    const m = medirGol(a, g);
    const nome = `${tipo} a ${dl} m da linha, ${v} m/s, a bola para z ${zb}`;
    if (!m.p) { ruins++; if (!ex) ex = `${nome}: sem 1ª pessoa`; continue; }
    bIn += m.p.bolaIn; bN += m.p.bolaN;
    // (a margem: o pior |x| e |y| do centro da boca na tela, de chute + 0,3 s ao gol — informativo)
    const prim = RR.roteiroGol(a, g)?.planos.find(p => p.cam === 'primeira');
    if (prim) for (let t = ch + 18; t <= Math.min(gol, prim.ate); t++) {
      RO.cameraPrimeira(prim.enq, t, cam);
      for (const asp of [16 / 9, 844 / 390]) { RO.projetar(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz, RO.fovVerticalDe(REPLAY.primeira.fovH, asp), asp, gx, CAMPO.gol.altura / 2, 0, pr); const q = Math.max(Math.abs(pr.x), Math.abs(pr.y)); if (q > piorNdc) { piorNdc = q; piorEx = nome; } }
    }
    if (m.p.gol1 === false || m.p.gol0 === false) { ruins++; if (!ex) ex = `${nome}: boca do gol em chute − 0,5 s ${m.p.gol0}, de chute + 0,3 s ao gol ${m.p.gol1}`; }
  }
  reg('G16 gol de perto pelo canto (sem partida): a boca do gol no quadro em chute − 0,5 s e de chute + 0,3 s ao gol em cada gol (as metas do G7)',
    `${casos} gols: ${ruins} ruins${ex ? ` (${ex})` : ''}; o centro da boca até ${fmt(piorNdc, 2)} da meia tela (${piorEx}); bola no quadro ${fmt(100 * bIn / Math.max(1, bN), 1)}% (informativo)`, '0', ruins === 0);
}

/**
 * G17 (16/10, frente "cenas robustas") a passada CORRENDO com o sobe-e-desce grande e um passo mais fundo, sem partida
 * (determinístico): o autor corre a 6 m/s para o gol e chuta; a cabeça sobe e desce ±A m na passada (2,8 Hz; A 0,10/0,12 —
 * na partida, até ±0,12) e, no fundo de uma passada a ~k passos do chute (k 20/30/40), desce E m a mais num passo só (E 0/
 * 0,015/0,025; um tropeço da passada): o balanço residual da 1ª pessoa correndo (a medida do G6) ≤ 1 cm e o olho a ≤ 0,15 m
 * da cabeça em cada gol com ela (as metas do G6); presente em ≥ 80% (a do G8). (Na lógica do domínio-sem-passar, semente 29:
 * no fundo da passada a 37 passos do chute a cabeça desceu 2,3 cm a mais num passo, a esfera em volta dela puxou o olho
 * 1,2 cm para baixo só naquele passo — a presa pequena, abaixo de prendeMin, não era dilatada — e o G6 viu 1,24 cm.)
 */
async function itemG17() {
  const { criarMedidor } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/replay-g.mjs')).href);
  const { medirGol } = await criarMedidor(pastaJs);
  const RA = await imp('render/replay-anel.js'), C = await imp('config.js');
  const { criarJogador } = await imp('jogador.js');
  const { pose, NJ, J } = await imp('anim.js');
  const { REPLAY, PASSO } = C;
  const j0 = criarJogador(9, 0, 0, 0, {}, 0);
  const mini = { tick: 0, posse: null, naMao: null, parada: null, voo: null, bola: { p: { x: 0, y: -10, z: 0 }, v: { x: 0, y: 0, z: 0 }, q: { x: 0, y: 0, z: 0, w: 1 } }, jogadores: [j0] };
  const P0 = pose(j0, mini, new Float32Array(NJ * 3)), Pt = new Float32Array(NJ * 3);
  // o que desce com o tronco (os pés e as canelas ficam); o tronco correndo mais baixo: a cabeça em 1,45 m na média (a da
  // partida correndo)
  const FICA = new Set([J.tornozeloE, J.tornozeloD, J.pontaE, J.pontaD, J.joelhoE, J.joelhoD].filter(k => k != null));
  const base = 1.45 - P0[J.cabeca * 3 + 1];
  const ch = 400, gol = ch + 40, W = 2 * Math.PI * 2.8 * PASSO;
  let casos = 0, ruins = 0, ex = '', residMax = 0, olhoMax = 0, presentes = 0;
  for (const A of [0.10, 0.12]) for (const E of [0, 0.015, 0.025]) for (const k of [20, 30, 40]) for (const zs of [1, -1]) {
    casos++;
    const a = RA.criarAnel({ ticks: Math.round(REPLAY.segundos / PASSO), vagas: REPLAY.vagas, nj: NJ });
    // o fundo da passada (cos = −1) mais perto de ch − k
    const tFundo = Math.round((Math.round(((ch - k) * W - Math.PI) / (2 * Math.PI)) * 2 * Math.PI + Math.PI) / W);
    const z = zs * 6;
    for (let t = 0; t <= gol + 150; t++) {
      const x = 32 - 6 * (ch - Math.min(t, ch + 10)) * PASSO;
      const dy = base + A * Math.cos(W * t) - (t === tFundo ? E : 0);
      for (let q = 0; q < NJ; q++) { Pt[q * 3] = P0[q * 3] + x; Pt[q * 3 + 1] = P0[q * 3 + 1] + (FICA.has(q) ? 0 : dy); Pt[q * 3 + 2] = P0[q * 3 + 2] + z; }
      a.inicio(t, t * PASSO, false);
      a.jogador(0, 9, 0, false, x, z, 0, Pt);
      let b;
      if (t <= ch) b = { x: x + 0.6, y: 0.11, z };
      else { const u = Math.min(1, (t - ch) / (gol - ch)); b = { x: (x + 0.6) + (52.6 - (x + 0.6)) * u, y: 0.11 + 0.9 * Math.sin(Math.PI * u * 0.8), z: z + (0.5 * zs - z) * u }; }
      if (a.marcar) a.marcar(t === ch ? 1 : t === gol ? 2 : 0);
      a.fim(b, { x: 0, y: 0, z: 0, w: 1 });
    }
    const g = { golTick: gol, chuteTick: ch, lado: 1, time: 0, autor: 9, contra: false, desvio: false, tipoChute: 'chute' };
    const m = medirGol(a, g);
    const nome = `sobe-e-desce ±${fmt(A, 2)} m, ${fmt(100 * E, 1)} cm a mais no fundo da passada a ${ch - tFundo} passos do chute, z ${z}`;
    if (!m.p) continue;
    presentes++;
    residMax = Math.max(residMax, m.p.resid); olhoMax = Math.max(olhoMax, m.p.olhoCab);
    if (!(m.p.resid <= 0.01) || !(m.p.olhoCab <= 0.15) || !(m.p.nCorrendo > 10)) { ruins++; if (!ex) ex = `${nome}: balanço ${fmt(100 * m.p.resid, 2)} cm, olho–cabeça ${fmt(m.p.olhoCab, 3)} m, ${m.p.nCorrendo} passos correndo`; }
  }
  reg('G17 a passada correndo com o sobe-e-desce grande e um passo mais fundo (sem partida): balanço residual da 1ª pessoa correndo ≤ 1 cm e olho a ≤ 0,15 m da cabeça em cada gol com ela (as metas do G6); presente em ≥ 80% (a do G8)',
    `${casos} gols: ${ruins} ruins${ex ? ` (${ex})` : ''}; balanço até ${fmt(100 * residMax, 2)} cm; olho–cabeça até ${fmt(olhoMax, 3)} m; presente em ${presentes}/${casos}`, '0; ≤ 1 cm; ≤ 0,15 m; ≥ 80%', ruins === 0 && presentes >= 0.8 * casos);
}

async function itemG5(RO) {
  // um pênalti de verdade: a falta na área (como o __golaco.faltaDeTeste da página), o pênalti batido e, se for gol, o
  // roteiro (sementes até achar um gol de pênalti)
  const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/anel-node.mjs')).href);
  const GR = await criarGravador(pastaJs);
  const P = await imp('partida.js'), FA = await imp('faltas.js'), C = await imp('config.js'), AG = await imp('render/autor-gol.js');
  const { J } = await imp('anim.js');
  // (--estresse: os 4 primeiros gols de pênalti, em ordem de semente, até a 120; todos têm de passar)
  const QUANTOS = args.includes('--estresse') ? 4 : 1, achados = [];
  let achou = null, tentativas = 0;
  for (let sem = 1; sem <= (QUANTOS > 1 ? 120 : 40) && achados.length < QUANTOS; sem++) {
    const S = GR.novaPartida(sem);
    const ag = AG.criarAutorGol();
    const timeDe = id => S.m.jogadores.find(j => j.id === id)?.time ?? null;
    for (let i = 0; i < 700; i++) AG.autorEventos(ag, GR.passo(S), S.m.tick, timeDe);
    const m = S.m;
    if (m.partida.estado !== 'jogo') continue;
    const meu = m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL' && j.posicao !== 'ZAG');
    const outro = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL').sort((a, b) => Math.hypot(a.x - meu.x, a.z - meu.z) - Math.hypot(b.x - meu.x, b.z - meu.z))[0];
    if (!meu || !outro) continue;
    tentativas++;
    const lado = m.ataca[0];
    P.teleportar(meu, lado * (C.CAMPO.meioX - 9), 3, lado > 0 ? 0 : Math.PI);
    P.teleportar(outro, meu.x - lado * 1.1, meu.z + 0.3, lado > 0 ? 0 : Math.PI);
    m.bola.p.x = meu.x + lado * 0.4; m.bola.p.z = meu.z; m.bola.p.y = C.BOLA.raio;
    m.posse = meu.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    const f = FA.montarFalta(m, outro, meu, 'bote', true);
    m.eventos = []; m.faltaPendente = f;
    P.regrasPartida(m);
    if (m.parada?.tipo !== 'penalti') continue;
    let gol = null;
    for (let i = 0; i < 1500; i++) {
      const evs = GR.passo(S);
      AG.autorEventos(ag, evs, S.m.tick, timeDe);
      const eg = evs.find(e => e.tipo === 'gol');
      if (eg && !gol) gol = { golTick: S.m.tick, chuteTick: ag.chute.ativo ? ag.chute.tick : null, lado: S.m.bola.p.x > 0 ? 1 : -1, time: eg.time, autor: ag.gol.id, contra: ag.gol.contra, desvio: ag.gol.desvio, tipoChute: ag.chute.ativo ? ag.chute.tipo : null };
      if (gol && evs.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) break;
      if (!gol && i > 400 && !S.m.parada) break;
    }
    if (gol && gol.chuteTick != null) achados.push({ S, gol, sem });
  }
  if (!achados.length) { reg('G5 pênalti: a 1ª pessoa depois da montagem, o goleiro no quadro', `nenhum gol de pênalti em ${tentativas} tentativas`, 'um gol', false); return; }
  const txts = [];
  let todos = achados.length === QUANTOS;
  for (achou of achados) { const r = medirG5(achou); txts.push(r.txt); if (!r.ok) todos = false; }
  reg('G5 pênalti: a 1ª pessoa começa depois da montagem; o goleiro no quadro em chute − 0,3 s; G1 com "reduzir movimento" sem ela',
    txts.join(' | ') + (achados.length < QUANTOS ? ` (só ${achados.length} de ${QUANTOS} gols de pênalti)` : ''), `depois da montagem; sim; sem primeira${QUANTOS > 1 ? ` (${QUANTOS} pênaltis)` : ''}`, todos);

  function medirG5(achou) {
  const { S, gol } = achou;
  const r = RR.roteiroGol(S.a, gol), prim = r?.planos.find(p => p.cam === 'primeira');
  const montagem = S.a.ultimoCorte(S.a.primeiro, gol.chuteTick);
  let goleiroNoQuadro = false;
  if (prim) {
    const gk = S.m.jogadores.find(j => j.time !== gol.time && j.posicao === 'GOL');
    const cam = RO.cameraPrimeira(prim.enq, gol.chuteTick - 18, {}), pr = {}, jj = RA.juntaNoTick(S.a, gol.chuteTick - 18, gk.id, J.peito, {});
    if (jj) for (const asp of [16 / 9]) { RO.projetar(cam.x, cam.y, cam.z, cam.lx, cam.ly, cam.lz, RO.fovVerticalDe(90, asp), asp, jj.x, jj.y, jj.z, pr); goleiroNoQuadro = pr.z > 0 && Math.abs(pr.x) <= 1 && Math.abs(pr.y) <= 1; }
  }
  // "reduzir movimento": sem 1ª pessoa, o resto igual (G1)
  const rR = RR.roteiroGol(S.a, { ...gol, reduzirMovimento: true });
  const semPrim = rR && !rR.planos.some(p => p.cam === 'primeira') && rR.planos.some(p => p.cam === 'treinador') === r.planos.some(p => p.cam === 'treinador');
  return {
    txt: prim ? `semente ${achou.sem}: montagem ${montagem}, 1ª pessoa ${prim.de}–${prim.ate} (chute ${gol.chuteTick}); goleiro no quadro ${goleiroNoQuadro}; reduzir movimento: ${rR?.planos.map(p => p.cam).join('·')}` : `semente ${achou.sem}: sem 1ª pessoa (${r?.planos.map(p => p.cam).join('·')})`,
    ok: !!prim && montagem != null && prim.de >= montagem && goleiroNoQuadro && semPrim,
  };
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-replay-anel: REPROVOU (${falhas})` : '\nteste-replay-anel: PASSOU');
process.exit(falhas ? 1 : 0);
