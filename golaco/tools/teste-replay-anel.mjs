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
// Na versão sem replay os módulos não existem: o teste reprova.
//   node tools/teste-replay-anel.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

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
    reg('B2 gol: duração ≤ REPLAY.gol.maximo', `${fmt(duracao(r), 2)} s`, `≤ ${REPLAY.gol.maximo} s`, duracao(r) <= REPLAY.gol.maximo + 1e-9);
    const rG = roteiroGol(a, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: true });
    reg('B3 golaço: + a lateral baixa 0,35× em volta do chute, tudo ≤ maximoGolaco', `${rG.planos.map(p => `${p.cam} @${p.vel}`).join(' · ')}; ${fmt(duracao(rG), 2)} s`, `tv · atras · lateral @0,35; ≤ ${REPLAY.gol.maximoGolaco} s`,
      rG.planos.length === 3 && rG.planos[2].cam === 'lateral' && rG.planos[2].vel === 0.35 && rG.planos[2].de <= 2350 && rG.planos[2].ate >= 2350 && duracao(rG) <= REPLAY.gol.maximoGolaco + 1e-9);
    // corte entre o começo e o gol: o replay começa nele
    const a2 = criarAnel({ ticks: 600, vagas: 24, nj: NJ });
    for (let t = 2001; t <= 2600; t++) gravar(a2, t, ordem, new Set([2200]));
    const rc = roteiroGol(a2, { golTick: 2400, chuteTick: 2350, lado: 1, golaco: false });
    reg('B4 gol: não atravessa um corte (começa nele)', `TV de ${rc.planos[0].de}`, '2200', rc.planos[0].de === 2200);
    // chute longe do gol: TV + atrás passariam de 12 s → o começo da TV encolhe (até 1,5 s antes do chute)
    const rl = roteiroGol(a, { golTick: 2420, chuteTick: 2300, lado: 1, golaco: false });
    reg('B5 gol de chute longo: a TV encolhe para caber em 12 s', `TV de ${rl.planos[0].de} (chute 2300); ${fmt(duracao(rl), 2)} s`, `≤ 12 s, começo ≤ chute − 1,5 s`, duracao(rl) <= REPLAY.gol.maximo + 1e-9 && rl.planos[0].de <= 2300 - 90);
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
      reg('C3 duração do replay do gol', `${fmt(duracao(roteiro), 2)} s, ${roteiro.planos.length} planos (${roteiro.planos.map(p => p.cam).join(', ')})${roteiro.golaco ? ', golaço' : ''}`, `6–${REPLAY.gol.maximo} s (golaço: ≤ ${REPLAY.gol.maximoGolaco})`,
        duracao(roteiro) >= 6 && duracao(roteiro) <= (roteiro.golaco ? REPLAY.gol.maximoGolaco : REPLAY.gol.maximo) + 1e-9);
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

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-replay-anel: REPROVOU (${falhas})` : '\nteste-replay-anel: PASSOU');
process.exit(falhas ? 1 : 0);
