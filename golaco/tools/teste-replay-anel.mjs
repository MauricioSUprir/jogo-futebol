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
//      com a linha no defensor; gravar (com a foto da Regra 11) não muda o hash e custa ≤ 50 µs por passo.
// Impedimento de 12/10 (cena semiautomática, pedido do dono): B8, B11, B16, B17 e C8 esperam os 2 planos (linha → saot),
// "≤ ~6 s" virou ≤ 7,5 s (mudança de produto) e o congelamento ficou mais duro (≥ 1,2 s → ≥ 3,0 s).
// 3ª e 4ª câmeras do gol (12/10: a 1ª pessoa do autor e a visão do treinador; render/replay-olhos.js): B2/B3/B5/C3 medem a
// PARTE ANTIGA do replay (tv + atras [+ lateral]: a mesma grandeza, o mesmo limite; B3 acha a lateral pelo nome) e
//   G)  partidas IA × IA inteiras (sementes 1–N, a gravação do main.js com os treinadores), em cada gol na saída de bola:
//   G1  a ordem pelos nomes: tv, atras, [lateral], primeira, treinador, [saot]; sem 1ª pessoa no gol contra, sem autor no
//       anel e com "reduzir movimento";
//   G2  com os extras, os planos de antes são campo a campo os de {extras: false}; e {extras: false} = o roteiro de --ref
//       (outra versão: git archive) — com --ref;
//   G3  extras ≤ 7,0 s; total ≤ 19 s (golaço ≤ 21; com a checagem ≤ 20/22);
//   G4  os planos dentro do anel, sem atravessar corte (o gol no fim do tempo: o treinador encurta ou sai);
//   G5  pênalti: a 1ª pessoa começa depois da montagem e o goleiro está no quadro em chute − 0,3 s;
//   G6  1ª pessoa: olho ≤ 0,15 m da cabeça gravada e ≤ 0,06 m do olho bruto na HORIZONTAL (14/10: a cabeça do manequim
//       sobe e desce até ±9 cm correndo — a passada de agora —, e um olho a ≤ 6 cm dela na vertical também balançaria ≥ 3 cm:
//       a vertical fica presa pela cabeça e pelo balanço); arfagem em [−60°, 15°]; balanço residual (y − média móvel de
//       0,5 s, com o olho dos dois lados do quadro) ≤ 1 cm correndo (o olho bruto: ~8 cm);
//   G7  1ª pessoa: giro p95 ≤ 90°/s e máximo ≤ 150°/s (tempo de replay); bola no quadro ≥ 95% de chute a gol (fora da janela
//       em que ela some); olhar ≤ 25° da bola (mediana); a boca do gol no quadro em chute − 0,5 s e de chute + 0,3 s ao gol;
//   G8  1ª pessoa: nenhum outro corpo a < 0,3 m da lente no quadro; presente em ≥ 80% dos gols com autor;
//   G9  treinador (parte 1): olho ≤ 0,15 m da cabeça gravada; fov constante; bola no quadro ≥ 95%; a boca do gol no quadro
//       no gol; giro p95 ≤ 15°/s e máximo ≤ 30°/s;
//   G10 treinador (parte 2): ele inteiro no quadro em 100%; centro em x ∈ [0,2; 0,45]; cabeça e peito livres ≥ 90%; câmera
//       fora dos sólidos e a ≥ 0,6 m de qualquer corpo; nada a < 2 m dela no quadro;
//   G11 anel com 26 vagas ≤ 4 MB; lerQuadro marca it.tecnico e zera it.ocultar; defensorDaLinha nunca devolve o treinador;
//   G12 a pose do treinador gravada no passo = a ao vivo, bit a bit;
//   G13 (14/10) a lente da 1ª pessoa e da parte 1 do treinador fora dos sólidos do estádio (solidoEm, 5 cm; acima do chão)
//       em 100% dos quadros; o que se vê do próprio autor (o quadril e as pernas: o resto fica OCULTO) a ≥ 0,20 m da lente;
//       nenhum outro corpo a < 0,3 m da lente do treinador no quadro; na parte 2 ele reage (a mão acima da cabeça ≥ 0,1 s).
// Na versão sem replay os módulos não existem: o teste reprova.
//   node tools/teste-replay-anel.mjs [--js <pasta js>] [--ref <commit> | --base <pasta js>] [--sementes N] [--par N] [--min M] [--so-g5]
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
    const novaPartida = sem => GR.novaPartida(sem);
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
      reg('C5 custo de gravar (Node)', `${fmt(1000 * S.ms / S.n, 1)} µs por passo (${S.n} passos)`, '≤ 50 µs', 1000 * S.ms / S.n <= 50);
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
  const NS = +arg('--sementes', 28), MIN = +arg('--min', 4);
  const nPar = Math.max(1, Math.min(NS, os.availableParallelism?.() ?? os.cpus().length, +arg('--par', 3)));
  const res = [];
  let prox = 1;
  await Promise.all(Array.from({ length: nPar }, async () => {
    while (prox <= NS) {
      const s = prox++;
      res.push(await new Promise((ok, erro) => {
        const c = fork(fileURLToPath(import.meta.url), ['--filho-g', '--s', String(s), '--js', pastaJs, '--min', String(MIN), ...(refJs ? ['--ref-js', refJs] : [])]);
        c.on('message', ok); c.on('error', erro);
        c.on('exit', code => { if (code) erro(new Error(`semente ${s} saiu com ${code}`)); });
      }));
    }
  }));
  const gols = res.flatMap(r => r.gols.filter(g => g.ok));
  const comAutor = gols.filter(g => g.autor != null && !g.contra && g.chute != null);
  // G1
  {
    const ruins = gols.filter(g => !g.ordem), contraCom = gols.filter(g => g.contra && g.temPrimeira);
    reg('G1 ordem tv, atras, [lateral], primeira, treinador, [saot]; gol contra sem 1ª pessoa', `${gols.length} gols (${comAutor.length} com autor, ${gols.filter(g => g.contra).length} contra): ${ruins.length} fora de ordem, ${contraCom.length} contra com 1ª pessoa; ex.: ${gols.slice(0, 3).map(g => g.cams.join('·')).join(' | ')}`,
      'ordem em todos; 0', gols.length >= 20 && ruins.length === 0 && contraCom.length === 0);
  }
  // G2
  {
    const dif = gols.filter(g => !g.igualSemExtras), difRef = gols.filter(g => g.igualRef === false), comRef = gols.filter(g => g.igualRef != null);
    reg('G2 os planos de antes campo a campo iguais com e sem extras; sem extras = --ref', `${gols.length - dif.length}/${gols.length} iguais com e sem extras; ref: ${refJs ? `${comRef.length - difRef.length}/${comRef.length} iguais (${path.relative(process.cwd(), refJs) || refJs})` : 'não pedido (--ref)'}`,
      `todos; ${refJs ? 'todos (≥ 40)' : '-'}`, dif.length === 0 && (!refJs || (comRef.length >= 40 && difRef.length === 0)));
  }
  // G3
  {
    const lim = g => (g.golaco ? 21 : 19) + (g.checagem ? 1 : 0);
    const ruins = gols.filter(g => g.extras > REPLAY.gol.extras.maximo + 1e-9 || g.total > lim(g) + 1e-9);
    const ext = gols.map(g => g.extras), tot = gols.map(g => g.total);
    reg('G3 extras ≤ 7,0 s; total ≤ 19 s (golaço 21; checagem +1)', `extras até ${fmt(Math.max(...ext), 2)} s (mediana ${fmt(mediana(ext), 2)}); total até ${fmt(Math.max(...tot), 2)} s (mediana ${fmt(mediana(tot), 2)}; antes ${fmt(mediana(gols.map(g => g.antiga)), 2)}); ${ruins.length} acima`,
      '≤ 7,0; ≤ 19/21 (+1)', ruins.length === 0);
  }
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
  // G8
  {
    const ps = comAutor.filter(g => g.p).map(g => g.p), lente = ps.filter(p => p.lente >= 0);
    const pres = ps.length / Math.max(1, comAutor.length);
    reg('G8 1ª pessoa: nenhum corpo a < 0,3 m da lente; presente em ≥ 80% dos gols com autor', `${lente.length} planos com corpo na lente; presente em ${ps.length}/${comAutor.length} (${fmt(100 * pres, 0)}%; ${ps.filter(p => p.cortado).length} encurtados pela lente)`, `0; ≥ 80% (≥ 48 gols)`,
      lente.length === 0 && pres >= 0.8 && comAutor.length >= 48);
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
  {
    const g = comAutor.find(x => x.temPrimeira);
    reg('G1b "reduzir movimento": sem 1ª pessoa (o resto igual)', g ? 'conferido no G5 (mesmo gol, com e sem)' : 'sem gol com autor', '-', true);
  }
  console.log(`G: ${res.length} partidas (sementes 1–${NS}) de 2 × ${MIN} min, ${gols.length} gols, ${nPar} processos`);
}

async function itemG5(RO) {
  // um pênalti de verdade: a falta na área (como o __golaco.faltaDeTeste da página), o pênalti batido e, se for gol, o
  // roteiro (sementes até achar um gol de pênalti)
  const { criarGravador } = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'lib/anel-node.mjs')).href);
  const GR = await criarGravador(pastaJs);
  const P = await imp('partida.js'), FA = await imp('faltas.js'), C = await imp('config.js'), AG = await imp('render/autor-gol.js');
  const { J } = await imp('anim.js');
  let achou = null, tentativas = 0;
  for (let sem = 1; sem <= 40 && !achou; sem++) {
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
    if (gol && gol.chuteTick != null) achou = { S, gol, sem };
  }
  if (!achou) { reg('G5 pênalti: a 1ª pessoa depois da montagem, o goleiro no quadro', `nenhum gol de pênalti em ${tentativas} tentativas`, 'um gol', false); return; }
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
  reg('G5 pênalti: a 1ª pessoa começa depois da montagem; o goleiro no quadro em chute − 0,3 s; G1 com "reduzir movimento" sem ela',
    prim ? `semente ${achou.sem}: montagem ${montagem}, 1ª pessoa ${prim.de}–${prim.ate} (chute ${gol.chuteTick}); goleiro no quadro ${goleiroNoQuadro}; reduzir movimento: ${rR?.planos.map(p => p.cam).join('·')}` : `sem 1ª pessoa (${r?.planos.map(p => p.cam).join('·')})`,
    'depois da montagem; sim; sem primeira', !!prim && montagem != null && prim.de >= montagem && goleiroNoQuadro && semPrim);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-replay-anel: REPROVOU (${falhas})` : '\nteste-replay-anel: PASSOU');
process.exit(falhas ? 1 : 0);
