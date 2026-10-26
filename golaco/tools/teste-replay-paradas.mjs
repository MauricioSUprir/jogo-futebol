// Replays nas paradas (pedido do dono de 22/10: "os replays de faltas e jogadas passando na tela enquanto o jogo tá
// parado"; PLANO-CENAS.md §2.7; contrato "Cenas das paradas" no CONTRATOS.md): o classificador (js/lances.js) e o roteiro
// (render/replay-roteiro.js roteiroParada) em partidas IA × IA inteiras, com o anel gravado como o main.js e os replays
// "tocados" como a página toca (lib/paradas-node.mjs: o do gol na saída, o do impedimento no apito, o da parada no passo
// antes da montagem).
//   P1 gatilhos: um árbitro INDEPENDENTE escrito aqui (pelos eventos, pelas marcas do anel e pelas posições da bola)
//      classifica cada bola morta; o classificador bate 100% nas classes A (pênalti, vermelho, trave) e ≥ 98% nas B
//      (amarelo, falta perto do gol, espalmada, chute de dentro da área que passou perto); nenhum replay em bola morta sem
//      lance;
//   P2 roteiro: ≤ 2 planos, ≤ 8,0 s, a chave dentro do P1, o P2 a 0,5×, os planos dentro do anel sem atravessar corte; null
//      com a chave fora do anel;
//   P3 orçamento: ≤ 3 replays de classe B por tempo; ≥ 30 s de bola rolando antes de cada um desde o último replay automático
//      (gol, impedimento ou parada; contado aqui, por fora); um por parada; média de 2–5 por partida; o ar em replay (gol +
//      impedimento + paradas) entre 8% e 16% do tempo de jogo (SoccerNet-v2: 13,3%) com os gols do real (2,3–3,5 por
//      partida; os segundos de replay por gol medidos) — o medido também ≤ 16%;
//   P4 pureza: o hashMundo é o mesmo com e sem o classificador lendo cada passo, e ler o passo (lancesPasso,
//      montaNoProximoPasso) não muda o hash;
//   P5 predicado: montaNoProximoPasso(m) antes de cada passo bate 100% com o passo real (a parada montou — o cobrador saiu
//      de null — ou o tempo acabou), a cópia da regra do partida.js regrasPartida guardada contra mudanças nele.
// Na versão sem os replays de parada reprova (js/lances.js e roteiroParada não existem).
//   node tools/teste-replay-paradas.mjs [--js <pasta da lógica>] [--n 24] [--sem0 1] [--par 4]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

// ------------------------------------------------------------------ o filho: uma semente
if (args.includes('--filho')) {
  const { criarSimParadas } = await import(pathToFileURL(path.join(AQUI, 'lib/paradas-node.mjs')).href);
  const P = await criarSimParadas(JS);
  const { CAMPO, PASSO } = await imp('config.js');
  const { hashMundo } = await imp('sim.js');
  const { marcasDoPasso } = await imp('render/replay-anel.js');
  const s = +arg('--s', 1);
  process.send(rodarSemente(P, { CAMPO, PASSO, hashMundo, marcasDoPasso }, s, args.includes('--p4')));
  process.exit(0);
}

const tipoA = new Set(['penalti', 'vermelho', 'trave']);

/** O árbitro independente: a bola morta classificada pelo que aconteceu desde a anterior. */
function criarArbitro(K) {
  const { CAMPO } = K;
  const MX = CAMPO.meioX, AU = MX - CAMPO.area.profundidade, AZ = CAMPO.area.largura / 2;
  const RP = CAMPO.gol.raioPoste, ZP = CAMPO.gol.largura / 2 + RP, YT = CAMPO.gol.altura + RP;
  const R = { chutes: [], traves: [], defesas: [], corpos: [], faltas: [], bolas: [] };
  const zerar = () => { R.chutes.length = 0; R.traves.length = 0; R.defesas.length = 0; R.corpos.length = 0; R.faltas.length = 0; };
  // distância do ponto (z, y) da linha de fundo aos eixos dos postes e do travessão (por amostragem: outra conta)
  function distArmacao(z, y) {
    let d = Infinity;
    for (let k = 0; k <= 200; k++) {
      const yy = YT * k / 200;
      d = Math.min(d, Math.hypot(Math.abs(z) - ZP, y - yy));
      const zz = -ZP + 2 * ZP * k / 200;
      d = Math.min(d, Math.hypot(z - zz, y - YT));
    }
    return d;
  }
  function passo(m, ev) {
    const t = m.tick, b = m.bola.p;
    R.bolas.push({ t, x: b.x, y: b.y, z: b.z });
    if (R.bolas.length > 600) R.bolas.shift();
    const chute = marcas => (marcas & 1) !== 0;
    if (chute(K.marcasDoPasso(ev, m.voo))) {
      const e = ev.find(x => x.tipo === 'chute' || x.tipo === 'cabeceio');
      const j = m.jogadores.find(q => q.id === e.id);
      if (j) {
        const lado = m.ataca[j.time] >= 0 ? 1 : -1;
        const v = e.tipo === 'chute' ? (e.v ?? 0) : Math.hypot(m.bola.v.x, m.bola.v.y, m.bola.v.z);
        R.chutes.push({ t, id: j.id, time: j.time, v, x: j.x, z: j.z, lado, area: j.x * lado >= AU && Math.abs(j.z) <= AZ });
      }
    }
    for (const e of ev) {
      // a trave só conta com a bola viva (ou morta neste passo): depois do apito ela não é lance
      if (e.tipo === 'trave') { if (m.partida.estado === 'jogo' || (m.parada && m.parada.inicio === t)) R.traves.push({ t, x: b.x }); }
      else if (e.tipo === 'defesa') R.defesas.push({ t, modo: e.modo, id: e.id });
      else if (e.tipo === 'bateuCorpo') R.corpos.push({ t, id: e.id });
      else if (e.tipo === 'falta') R.faltas.push({ t, def: e.def, time: e.time, x: e.x, z: e.z });
    }
  }
  /** Bola morta neste passo: o tipo do lance mais forte (ou null). */
  function classificar(m, ev) {
    const pr = m.parada, t = m.tick, J = 240;
    let r = null;
    const cartoes = ev.filter(e => e.tipo === 'cartao');
    const faltaDe = id => [...R.faltas].reverse().find(f => f.def === id);
    if (ev.some(e => e.tipo === 'impedimento')) r = null;
    else if (ev.some(e => e.tipo === 'penaltiMarcado') && pr.tipo === 'penalti' && R.faltas.some(f => f.time === pr.time)) r = 'penalti';
    else if (cartoes.some(c => c.cor === 'vermelho' && faltaDe(c.id))) r = 'vermelho';
    else if (R.traves.length && t - R.traves[R.traves.length - 1].t <= J) r = 'trave';
    else if (cartoes.some(c => c.cor === 'amarelo' && !c.segundo && faltaDe(c.id))) r = 'amarelo';
    else {
      const f = [...R.faltas].reverse().find(q => q.time === pr.time);
      const lado = f ? (m.ataca[f.time] >= 0 ? 1 : -1) : 1;
      if (pr.tipo === 'tiroLivre' && pr.direto && f && Math.hypot(f.x - lado * MX, f.z) <= 25) r = 'faltaPerto';
      else if (R.chutes.length) {
        const c = R.chutes[R.chutes.length - 1];
        const depois = R.defesas.filter(d => d.t >= c.t);
        const esp = depois.find(d => d.modo === 'espalmada');
        const segura = depois.some(d => d.modo !== 'espalmada');
        const bloq = R.corpos.some(q => q.id !== c.id && q.t > c.t && (!esp || q.t < esp.t));
        if (t - c.t <= J && !segura && !bloq) {
          if (esp && (c.area || c.v >= 22)) r = 'espalmada';
          else if (!esp && c.area) {
            // onde a bola cruzou a linha de fundo atacada depois do chute
            const bs = R.bolas.filter(q => q.t >= c.t);
            for (let k = 1; k < bs.length; k++) {
              const u0 = bs[k - 1].x * c.lado, u1 = bs[k].x * c.lado;
              if (bs[k].t > c.t && u0 < MX && u1 >= MX) {
                const a = (MX - u0) / (u1 - u0);
                const zc = bs[k - 1].z + (bs[k].z - bs[k - 1].z) * a, yc = bs[k - 1].y + (bs[k].y - bs[k - 1].y) * a;
                if (distArmacao(zc, yc) <= 1.5 + 0.02) r = 'passouPerto';
                break;
              }
            }
          }
        }
      }
    }
    zerar();
    return r;
  }
  return { passo, classificar, zerar };
}

function rodarSemente(P, K, s, comP4) {
  const out = { s, mortas: [], esperas: [], p2: [], p3: [], durGol: 0, nGol: 0, durImp: 0, durPar: 0, ticks: 0, jogo: 0,
    p5: { n: 0, erros: [] }, p4: null, porTempoB: [0, 0], duplas: 0 };
  const S = P.novaPartida(s);
  const A = criarArbitro(K);
  let rolando = 1e9;
  const rolandoNaMorta = new Map();
  const esperaPorMorta = new Set();
  for (let i = 0; i < 40000 && S.m.partida.estado !== 'fim'; i++) {
    const m = S.m;
    // antes do passo: o estado para o P5
    const pr0 = m.parada, cob0 = pr0 ? pr0.cobrador : null, est0 = m.partida.estado;
    const r = P.passo(S);
    const ev = r.ev;
    // P5: o predicado (calculado antes do passo pela harness) × o que o passo fez
    if (est0 === 'parada' && pr0 && cob0 == null) {
      const acabou = ev.some(e => e.tipo === 'intervalo' || e.tipo === 'fimDeJogo');
      const montou = !acabou && m.parada === pr0 && pr0.cobrador != null;
      const real = acabou ? 'fimDoTempo' : montou ? 'monta' : false;
      out.p5.n++;
      if ((r.pred || false) !== real && out.p5.erros.length < 5) out.p5.erros.push(`tick ${m.tick}: previu ${r.pred}, foi ${real}`);
      else if ((r.pred || false) !== real) out.p5.erros.push('…');
    }
    // o replay de parada que começou ANTES deste passo
    if (r.espera) {
      const e = r.espera, l = e.lance, ro = e.roteiro, a = S.a;
      if (esperaPorMorta.has(l.morta)) out.duplas++;
      esperaPorMorta.add(l.morta);
      out.durPar += e.dur;
      const pl = ro.planos;
      const falhas = [];
      if (pl.length < 1 || pl.length > 2) falhas.push(`${pl.length} planos`);
      if (e.dur > 8.0 + 1e-6) falhas.push(`${e.dur.toFixed(2)} s`);
      if (!(pl[0].de <= l.chave && l.chave <= pl[0].ate)) falhas.push(`chave ${l.chave} fora do P1 [${pl[0].de}, ${pl[0].ate}]`);
      if (pl[1] && Math.abs(pl[1].vel - 0.5) > 1e-9) falhas.push(`P2 a ${pl[1].vel}×`);
      for (const q of pl) {
        if (q.de < a.primeiro || q.ate > a.ultimo || q.ate <= q.de) falhas.push(`plano [${q.de}, ${q.ate}] fora do anel [${a.primeiro}, ${a.ultimo}]`);
        else if (a.primeiroCorte(q.de + 1, q.ate) != null) falhas.push(`plano [${q.de}, ${q.ate}] atravessa o corte ${a.primeiroCorte(q.de + 1, q.ate)}`);
        if (l.ateMax != null && q.ate > l.ateMax) falhas.push(`plano até ${q.ate} > ateMax ${l.ateMax}`);
      }
      if (P.RR.roteiroParada(a, { ...l, chave: a.primeiro - 5 }) !== null) falhas.push('chave fora do anel não deu null');
      if (P.RR.roteiroParada(a, { ...l, chave: -1 }) !== null) falhas.push('chave −1 não deu null');
      out.p2.push({ tick: e.tick, tipo: l.tipo, cams: pl.map(q => q.cam), dur: e.dur, falhas });
      if (l.classe === 'B') {
        const tt = m.partida.tempo === 2 ? 1 : 0;
        out.porTempoB[tt]++;
        const rol = rolandoNaMorta.get(l.morta);
        out.p3.push({ tick: e.tick, tipo: l.tipo, rolando: rol ?? -1 });
      }
      out.esperas.push({ tick: e.tick, morta: l.morta, tipo: l.tipo, classe: l.classe, dur: e.dur, cams: pl.map(q => q.cam) });
      rolando = 0;
    }
    if (r.gol) { out.durGol += r.gol.dur; out.nGol++; rolando = 0; }
    if (r.imped) { out.durImp += r.imped.dur; rolando = 0; }
    // o árbitro independente
    A.passo(m, ev);
    const p = m.partida;
    if (p.estado === 'jogo') { rolando++; out.jogo++; }
    if (ev.some(e => e.tipo === 'gol' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) A.zerar();
    const pr = m.parada;
    if (p.estado === 'parada' && pr && pr.inicio === m.tick && pr.cobrador == null && !ev.some(e => e.tipo === 'gol')) {
      const ref = A.classificar(m, ev);
      rolandoNaMorta.set(m.tick, rolando);
      out.mortas.push({ tick: m.tick, parada: pr.tipo, ref, got: r.lance ? r.lance.tipo : null, aceito: r.aceito });
    }
    out.ticks++;
  }
  if (comP4) out.p4 = pureza(P, K, s);
  return out;
}

/** P4: a mesma semente com e sem o classificador; e o hash antes = depois de ler cada passo. */
function pureza(P, K, s) {
  const n = 9000;
  const S1 = P.novaPartida(s, { lances: false, ligado: false }), S2 = P.novaPartida(s, { lances: false, ligado: false });
  const L = P.LA.criarLances();
  let difer = -1, escreve = -1;
  for (let i = 0; i < n; i++) {
    P.GR.passo(S1);
    const ev = P.GR.passo(S2);
    const h0 = K.hashMundo(S2.m);
    P.LA.lancesPasso(L, S2.m, ev);
    P.LA.montaNoProximoPasso(S2.m);
    if (K.hashMundo(S2.m) !== h0 && escreve < 0) escreve = S2.m.tick;
    if (i % 60 === 0 && K.hashMundo(S1.m) !== K.hashMundo(S2.m) && difer < 0) difer = S2.m.tick;
  }
  if (K.hashMundo(S1.m) !== K.hashMundo(S2.m) && difer < 0) difer = S2.m.tick;
  return { n, difer, escreve };
}

// ------------------------------------------------------------------ o pai
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fimTeste = () => { console.log(tabelaTexto(linhas)); console.log(`\nteste-replay-paradas: ${falhas ? 'REPROVOU' : 'PASSOU'}`); process.exit(falhas ? 1 : 0); };

let temModulo = fs.existsSync(path.join(JS, 'lances.js'));
if (temModulo) { const RR = await imp('render/replay-roteiro.js'); temModulo = typeof RR.roteiroParada === 'function'; }
if (!temModulo) {
  for (const k of ['P1 gatilhos', 'P2 roteiro', 'P3 orçamento', 'P5 predicado'])
    reg(k, 'js/lances.js ou roteiroParada não existe nesta versão', 'existe', false);
  fimTeste();
}

const N = +arg('--n', 24), S0 = +arg('--sem0', 1);
const SEMENTES = Array.from({ length: N }, (_, k) => S0 + k);
const P4 = new Set([S0, S0 + 1]);
const nPar = Math.max(1, Math.min(N, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length))));
const t0 = Date.now();
const res = [];
let prox = 0;
await Promise.all(Array.from({ length: nPar }, async () => {
  while (prox < SEMENTES.length) {
    const s = SEMENTES[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', '--js', JS, '--s', String(s), ...(P4.has(s) ? ['--p4'] : [])]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
    }));
  }
}));
res.sort((a, b) => a.s - b.s);
console.log(`lógica: ${JS}\n${N} partidas IA × IA (sementes ${S0}–${S0 + N - 1}), ${nPar} processos, ${((Date.now() - t0) / 1000).toFixed(1).replace('.', ',')} s`);

// P1
const mortas = res.flatMap(r => r.mortas.map(q => ({ ...q, s: r.s })));
const ehA = t => tipoA.has(t);
const emA = mortas.filter(q => ehA(q.ref) || ehA(q.got)), emB = mortas.filter(q => (q.ref && !ehA(q.ref)) || (q.got && !ehA(q.got)));
const okA = emA.filter(q => q.ref === q.got).length, okB = emB.filter(q => q.ref === q.got).length;
const difs = mortas.filter(q => q.ref !== q.got);
const semLance = res.flatMap(r => r.esperas).filter(e => !e.tipo).length;
const porTipo = {};
for (const q of mortas) if (q.got) porTipo[q.got] = (porTipo[q.got] ?? 0) + 1;
const pctA = emA.length ? 100 * okA / emA.length : 100, pctB = emB.length ? 100 * okB / emB.length : 100;
reg('P1 classes A (pênalti, vermelho, trave) = o árbitro independente', `${okA}/${emA.length} (${pctA.toFixed(1).replace('.', ',')}%)`, '100%', pctA === 100);
reg('P1 classes B (amarelo, falta perto, espalmada, passou perto) = o árbitro', `${okB}/${emB.length} (${pctB.toFixed(1).replace('.', ',')}%)${difs.length ? '; ex.: s' + difs[0].s + ' t' + difs[0].tick + ' ' + difs[0].parada + ' árbitro ' + difs[0].ref + ' × ' + difs[0].got : ''}`,
  '≥ 98%', pctB >= 98 && emB.length > 0);
reg('P1 nenhum replay sem lance; lances por tipo', `${semLance} sem lance; ${Object.entries(porTipo).map(([k, v]) => k + ' ' + v).join(', ')} em ${mortas.length} bolas mortas`, '0', semLance === 0);

// P2
const p2 = res.flatMap(r => r.p2.map(q => ({ ...q, s: r.s })));
const p2ruins = p2.filter(q => q.falhas.length);
const durMax = Math.max(0, ...p2.map(q => q.dur));
const cams = {};
for (const q of p2) { const k = q.cams.join('+'); cams[k] = (cams[k] ?? 0) + 1; }
reg('P2 roteiro: ≤ 2 planos, ≤ 8,0 s, chave no P1, P2 a 0,5×, dentro do anel sem corte, null fora dele',
  `${p2.length} roteiros; ${p2ruins.length} ruins${p2ruins.length ? ' (s' + p2ruins[0].s + ': ' + p2ruins[0].falhas[0] + ')' : ''}; máx ${durMax.toFixed(2).replace('.', ',')} s; ${Object.entries(cams).map(([k, v]) => k + ' ' + v).join(', ')}`,
  '0 ruins', p2.length > 0 && p2ruins.length === 0);

// P2b: casos de borda num anel de mentira (2001 passos, sem corte)
{
  const RR = await imp('render/replay-roteiro.js');
  const { REPLAY_PARADA: R } = await imp('lances.js');
  const anelF = { primeiro: 0, ultimo: 2000, slot: t => (t >= 0 && t <= 2000 ? t : -1), primeiroCorte: () => null, ultimoCorte: () => null };
  const dur = ro => ro.planos.reduce((a, q) => a + (q.ate - q.de) / 60 / q.vel, 0);
  const ruins = [];
  // (a) a chance com o desfecho longe (o P2 não cabe): o P1 sozinho começa em chave − tv.antes, ≤ máximo
  for (const D of [60, 100, 115, 140, 200, 240]) {
    const ro = RR.roteiroParada(anelF, { tipo: 'trave', classe: 'A', chave: 1000, fim: 1000 + D, x: 50, z: 2, lado: 1 });
    if (!ro || dur(ro) > R.maximo + 1e-9) ruins.push(`trave D=${D}: ${ro ? dur(ro).toFixed(2) + ' s' : 'null'}`);
    else if (ro.planos.length === 1 && ro.planos[0].de !== 1000 - Math.round(R.tv.antes * 60)) ruins.push(`trave D=${D}: só o P1, começando em ${ro.planos[0].de} (e não em ${1000 - Math.round(R.tv.antes * 60)})`);
  }
  // (b) o vermelho com a falta no passo da bola morta (o replay acaba no contato): P1 até a chave, P2 'fechada' com a
  // aproximação inteira (antes + depois) antes dela
  const rv = RR.roteiroParada(anelF, { tipo: 'vermelho', classe: 'A', chave: 1000, fim: 1000, ateMax: 1000, x: 30, z: 5, lado: 1 });
  const lento = Math.round((R.lento.antes + R.lento.depois) * 60);
  if (!rv || rv.planos.length !== 2 || rv.planos[0].ate !== 1000 || rv.planos[1].cam !== 'fechada' || rv.planos[1].de !== 1000 - lento || rv.planos[1].ate !== 1000)
    ruins.push(`vermelho no contato: ${JSON.stringify(rv?.planos ?? null)}`);
  reg('P2b bordas (anel de mentira): o P1 inteiro quando o P2 sai; o vermelho acaba no contato com o lento inteiro', `${ruins.length} ruins${ruins.length ? ' (' + ruins[0] + ')' : ''}`, '0', ruins.length === 0);
}

// P3
const tetoRuim = res.filter(r => r.porTempoB[0] > 3 || r.porTempoB[1] > 3);
const espacoRuim = res.flatMap(r => r.p3.map(q => ({ ...q, s: r.s }))).filter(q => q.rolando < 30 * 60);
const duplas = res.reduce((a, r) => a + r.duplas, 0);
reg('P3 ≤ 3 de classe B por tempo; ≥ 30 s de bola rolando antes de cada um; um por parada',
  `${tetoRuim.length} tempos acima do teto; ${espacoRuim.length} sem o espaço${espacoRuim.length ? ' (s' + espacoRuim[0].s + ' t' + espacoRuim[0].tick + ': ' + (espacoRuim[0].rolando / 60).toFixed(1).replace('.', ',') + ' s)' : ''}; ${duplas} paradas com 2`,
  '0; 0; 0', tetoRuim.length === 0 && espacoRuim.length === 0 && duplas === 0);
const nEsp = res.reduce((a, r) => a + r.esperas.length, 0), media = nEsp / res.length;
reg('P3 replays de parada por partida (média)', `${media.toFixed(2).replace('.', ',')} (${nEsp} em ${res.length})`, '2–5', media >= 2 && media <= 5);
const ar = res.reduce((a, r) => a + r.durGol + r.durImp + r.durPar, 0), jogoS = res.reduce((a, r) => a + r.ticks, 0) / 60;
const fat = 100 * ar / jogoS;
const pPar = 100 * res.reduce((a, r) => a + r.durPar, 0) / jogoS;
// o replay do gol acompanha os gols da amostra (24 partidas: ±1,3 por partida só de sorteio, e a IA de hoje marca abaixo do
// real): a meta vale com os gols do real (2,3–3,5 por partida, a meta do painel) e os segundos de replay por gol medidos
const nGol = res.reduce((a, r) => a + r.nGol, 0), segGol = nGol ? res.reduce((a, r) => a + r.durGol, 0) / nGol : NaN;
const semGol = res.reduce((a, r) => a + r.durImp + r.durPar, 0);
const arCom = g => 100 * (semGol + segGol * g * res.length) / jogoS, [arLo, arHi] = [arCom(2.3), arCom(3.5)];
const f1 = v => v.toFixed(1).replace('.', ',');
reg('P3 o ar em replay (gol + impedimento + paradas) / o tempo de jogo, com 2,3–3,5 gols por partida',
  `${f1(arLo)}–${f1(arHi)}% (medido ${f1(fat)}% com ${nGol} gols, ${f1(segGol)} s por gol; paradas ${f1(pPar)}%)`, '8–16% (SoccerNet 13,3%)',
  nGol > 0 && arLo >= 8 && arHi <= 16 && fat <= 16);

// P4
const p4 = res.filter(r => r.p4).map(r => ({ s: r.s, ...r.p4 }));
const p4ruim = p4.filter(q => q.difer >= 0 || q.escreve >= 0);
reg('P4 pureza: hash igual com e sem o classificador; ler o passo não muda o hash', `${p4.length} sementes × ${p4[0]?.n ?? 0} passos; ${p4ruim.length ? 's' + p4ruim[0].s + ': difere no tick ' + p4ruim[0].difer + ', escreve no ' + p4ruim[0].escreve : 'iguais'}`,
  'iguais', p4.length > 0 && p4ruim.length === 0);

// P5
const p5n = res.reduce((a, r) => a + r.p5.n, 0), p5e = res.flatMap(r => r.p5.erros.map(e => `s${r.s} ${e}`));
reg('P5 montaNoProximoPasso = o passo real (montou / fim do tempo / nada)', `${p5n - p5e.length}/${p5n}${p5e.length ? ' (ex.: ' + p5e[0] + ')' : ''}`, '100%', p5n > 0 && p5e.length === 0);

fimTeste();
