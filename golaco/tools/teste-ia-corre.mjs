// teste-ia-corre (categoria D; dono, 24/10: "a IA correr, tanto pra marcar, tanto pra atacar, pq ela não corre"): a régua
// da corrida da IA CONTRA A PESSOA (tools/lib/corrida-medidas.mjs), partidas 11×11 de 2 × 4 min contra o humano
// ROTEIRIZADO (tools/lib/humano-roteiro.mjs, time 0). Em volume a IA já corre mais que um time real (188 contra 140 m/min,
// PESQUISA-CATEGORIA-D.md); o que falta é QUEM corre e QUANDO. Seções (cada uma nasce informativa — meta null — e é ligada
// no PR dela; plano da categoria D):
//   P  o portão "só contra a pessoa" (tatica.js contraPessoa/timeDaPessoa; vale sempre): falso na demo do Node (também nas
//      cobranças dela, `iaCobra`), com o travado do Total Match expulso e com dois humanos; ligado contra o roteiro;
//   A  ataque da IA (D2, itens 67 e 21): o condutor arranca com campo à frente, fica com a bola, o apoio perto da bola se
//      mexe, as corridas à frente da bola chegam à área, a IA chuta de dentro da área;
//   M  marcação da IA (D3, informativa aqui);
//   C  os companheiros da pessoa (D4, informativa aqui);
//   V  guardas (valem sempre): volume da IA (m/min atacando e no total), vai e volta, gols da IA contra o roteiro, as
//      roubadas sofridas pela IA (conduzir mais não pode virar entregar a bola no bote).
// O ± é o desvio-padrão de um bootstrap ESTRATIFICADO por roteiro sobre a própria medida agregada (as partidas sorteadas
// com reposição dentro de cada roteiro e a medida recalculada; --boot N, padrão 200; o sorteio é fixo): o dp das medidas
// por partida ÷ √n media outra coisa (a mediana de cada partida, não a de todas as posses juntas) e misturava os roteiros.
// Sai com código 1 se uma meta ligada reprovar.
//   node tools/teste-ia-corre.mjs [--sementes 4] [--roteiros agressivo,calmo,passivo] [--par 4] [--js <pasta>]
//                                 [--set CONST.caminho=valor] [--json saida.json] [--detalhe] [--boot 200]
// No CI: 3 roteiros × 4 sementes (as metas têm folga para essa amostra); para decidir uma calibração, 8 sementes por
// roteiro (a lição das 4 sementes que enganam, CLAUDE.md).
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { filmarPartida, juntar, resumo, imprimir, f1 } from './lib/corrida-medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 4);
const ROTEIROS = arg('--roteiros', 'agressivo,calmo,passivo').split(',').filter(Boolean);
const PAR = Math.max(1, +arg('--par', Math.min(4, os.cpus().length || 2)));
const SETS = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
const JSON_OUT = arg('--json', null);
const BOOT = Math.max(0, +arg('--boot', 200));

// ------------------------------------------------------------------------------------------- P: o portão
// Rápido (no processo pai, sem a régua). Numa lógica sem o portão exportado (a base do D2), a regra que a subida do #500
// usava dentro do ia-ataque.js (o "antes").
async function checarPortao() {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const C = await imp('config.js'), P = await imp('partida.js'), T = await imp('tatica.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const H = await import(pathToFileURL(path.join(AQUI, 'lib/humano-roteiro.mjs')).href);
  const contra = T.contraPessoa ?? ((m, t) => !!m.humanos?.includes(1 - t) && !m.iaJoga?.[1 - t] && !m.humanos.includes(t));
  const daPessoa = T.timeDaPessoa ?? ((m, t) => !!m.humanos?.includes(t) && !m.iaJoga?.[t]);
  const NEUTRA = { x: 0, z: 0, botoes: 0 };
  const L = [];
  // P1 a demo do Node (entradaDemoPartida: `ia`, e só `iaCobra` nas cobranças do controlado — a saída de cada tempo, as
  // laterais, os tiros de meta...): o portão nunca liga, de nenhum lado (o painel e o hash-partida da demo)
  {
    let liga = 0, n = 0, cob = 0;
    for (const sem of [1, 2]) {
      const m = P.criarPartida({ semente: sem, minutosPorTempo: 1 });
      for (let i = 0; i < 2 * 3600 + 3000 && m.partida.estado !== 'fim'; i++) {
        const e = P.entradaDemoPartida(m);
        if (e.iaCobra) cob++;
        P.passoPartida(m, e); n++;
        if (contra(m, 0) || contra(m, 1) || daPessoa(m, 0)) liga++;
      }
    }
    L.push(['P1', 'demo do Node (2 partidas de 2 × 1 min): passos com o portão ligado', liga, `${n} passos, ${cob} com a cobrança da IA (iaCobra)`, liga === 0 && cob > 0]);
  }
  // P2 o travado do "só o meu jogador" (Total Match) expulso: antes, a pessoa joga (a entrada vazia da página é dela); depois
  // do vermelho, o controle fica no expulso — a página entrega a entrada vazia e o Simular o resto a da demo sem marca
  {
    const m0 = P.criarPartida({ semente: 7, humano: 0 });
    const trava = Object.values(m0.times[0].vagas).find(id => m0.jogadores.find(j => j.id === id)?.posicao !== 'GOL');
    const m = P.criarPartida({ semente: 7, humano: 0, trava });
    let antes = 0, nA = 0;
    for (let i = 0; i < 600; i++) { P.passoPartida(m, NEUTRA); nA++; if (contra(m, 1)) antes++; }
    m.partida.cartoesPendentes.push({ id: trava, cor: 'vermelho', motivo: 'teste' });
    P.bolaMorta(m, 'lateral', 1, 0, C.CAMPO.meioZ);
    const expulso = m.partida.expulsos.includes(trava) && !m.jogadores.some(j => j.id === trava);
    let pag = 0, sim = 0;
    for (let i = 0; i < 1200 && m.partida.estado !== 'fim'; i++) { P.passoPartida(m, NEUTRA); if (contra(m, 1) || daPessoa(m, 0)) pag++; }
    for (let i = 0; i < 1200 && m.partida.estado !== 'fim'; i++) { P.passoPartida(m, P.entradaDemoPartida(m)); if (contra(m, 1) || daPessoa(m, 0)) sim++; }
    L.push(['P2', 'travado do TM expulso: passos com o portão ligado depois (entrada vazia da página + Simular o resto)', pag + sim,
      `${expulso ? 'expulso' : 'NÃO expulso'} · antes ${antes}/${nA} ligado · depois página ${pag}/1200, Simular o resto ${sim}/1200`, expulso && antes === nA && pag + sim === 0]);
  }
  // P3 dois humanos (online 1×1): falso dos dois lados
  {
    const m = P.criarPartida({ semente: 3, humanos: [0, 1] });
    let liga = 0;
    for (let i = 0; i < 600; i++) { P.passoPartida(m, { 0: NEUTRA, 1: NEUTRA }); if (contra(m, 0) || contra(m, 1)) liga++; }
    L.push(['P3', 'dois humanos (600 passos): passos com o portão ligado', liga, '', liga === 0]);
  }
  // P4 contra o roteiro (a pessoa de verdade): ligado do lado da IA em todo passo
  {
    const m = P.criarPartida({ semente: 4, minutosPorTempo: 4 });
    const st = { s: 12345, carga: null, id: -1, desde: 0, espera: 0 };
    let liga = 0, n = 0;
    for (let i = 0; i < 1800; i++) { P.passoPartida(m, H.entradaRoteiro(m, M, C.BOTAO, st, 'agressivo')); n++; if (contra(m, 1) && !contra(m, 0) && daPessoa(m, 0)) liga++; }
    L.push(['P4', 'contra o roteiro (1800 passos): passos com o portão ligado no time da IA', liga, `de ${n}`, liga === n]);
  }
  return L;
}

if (args[0] === '--filho') {
  process.on('message', async tf => {
    const r = await filmarPartida({ js: JS, semente: tf.sem, modo: 'humano', perfil: tf.perfil, min: 4, sets: SETS });
    process.send(r, () => process.exit(0));
  });
} else {
  const tarefas = [];
  for (const p of ROTEIROS) for (let s = 1; s <= NSEM; s++) tarefas.push({ sem: s, perfil: p });
  const res = [];
  const t0 = Date.now();
  let prox = 0;
  const partidas = new Promise(fim => {
    let vivos = 0;
    const lanca = () => {
      if (prox >= tarefas.length) { if (!vivos) fim(); return; }
      const tf = tarefas[prox++]; vivos++;
      const f = fork(fileURLToPath(import.meta.url), ['--filho', ...args], { serialization: 'advanced', execArgv: ['--max-old-space-size=1024'] });
      f.on('message', r => res.push(r));
      f.on('exit', codigo => { vivos--; if (codigo) { console.error(`partida ${tf.perfil} ${tf.sem} saiu com ${codigo}`); process.exitCode = 1; } lanca(); });
      f.send(tf);
    };
    for (let k = 0; k < PAR; k++) lanca();
  });
  const portao = await checarPortao();
  await partidas;
  res.sort((a, b) => ROTEIROS.indexOf(a.perfil) - ROTEIROS.indexOf(b.perfil) || a.semente - b.semente);
  // o contexto de um conjunto de partidas (o todo ou uma reamostra): os dois grupos juntados e as somas
  const ctxDe = rs => ({
    adv: resumo(juntar(rs.map(r => r.acc.adv))), comp: resumo(juntar(rs.map(r => r.acc.comp))), nP: rs.length,
    soma: f => rs.reduce((a, r) => a + f(r), 0),
  });
  const pct = (a, b) => 100 * a / Math.max(1, b);
  // [seção, id, nome, medida(ctx), meta (null = informativa), antes (a base do D2 — main ebf0abc6 = o D1 —, 24 partidas: os
  // 3 roteiros × 8 sementes), real (Metrica, a mesma conta; PESQUISA-CATEGORIA-D.md)]
  const M = [
    ['A', 'A1', 'condutor da IA: velocidade mediana (km/h)', c => c.adv.cond.vMed * 3.6, ['>=', 9.5], 7.63, 10.0],
    ['A', 'A2', 'condutor da IA: tempo andando (< 7 km/h, %)', c => c.adv.cond.faixas[0], ['<=', 38], 46.7, 34],
    ['A', 'A3', 'condutor da IA: tempo a ≥ 19,8 km/h (%)', c => c.adv.cond.faixas[3] + c.adv.cond.faixas[4], ['>=', 6], 3.16, 8.7],
    ['A', 'A4', 'posse de cada condutor da IA (mediana, s)', c => c.adv.cond.posseMed, ['>=', 0.8], 0.50, 1.04],
    ['A', 'A5', 'trocas de condutor da IA por min de posse', c => c.adv.cond.trocasPorMin, ['<=', 28], 37.8, 19],
    // o apoio perto da bola SEM o dono (revisão do D2: com o condutor junto, a medida passava com o apoio curto desligado —
    // a queda do "≤ 10 m andando" era sobretudo do condutor). O A6b — com o condutor CONDUZINDO (≥ 10,8 km/h, o caso em que
    // o apoio curto do D2 corre) — é o que reprova o D2 sem o apoio curto (37,1%, 8 sementes; com ele, 26,0%; o A6 sem ele passa: 45,4%)
    ['A', 'A6', 'apoio da IA a ≤ 10 m da bola (sem o condutor): tempo andando (%)', c => c.adv.apoioPerto.tempoPct[0], ['<=', 46], 53.71, 43.3],
    ['A', 'A6b', '...com o condutor conduzindo (≥ 10,8 km/h): tempo andando (%)', c => c.adv.apoioConduz.tempoPct[0], ['<=', 33], 42.82, 33.2],
    ['A', 'A7', 'apoio da IA a ≤ 10 m da bola (sem o condutor): alta + disparada (m/min)', c => c.adv.apoioPerto.hsrMpm, ['>=', 30], 22.49, 29.7],
    ['A', 'A7b', '...com o condutor conduzindo: alta + disparada (m/min)', c => c.adv.apoioConduz.hsrMpm, null, 80.62, 61.7],
    ['A', 'A6c', 'a ≤ 10 m da bola COM o condutor (a conta do real): tempo andando (%)', c => c.adv.fase.com.dist[0].tempoPct[0], null, 52.3, 41],
    ['A', 'A7c', 'a ≤ 10 m da bola COM o condutor (a conta do real): alta + disparada (m/min)', c => c.adv.fase.com.dist[0].hsrMpm, null, 20.5, 31],
    ['A', 'A8', 'corridas da IA à frente da bola que chegam à área (%)', c => 100 * c.adv.corr.area, ['>=', 15], 3.70, 31],
    ['A', 'A9', 'corridas da IA à frente da bola por min de posse (não sobe)', c => c.adv.corr.porMinPosse, ['<=', 18], 17.4, 1.6],
    // (a main já passava do "≥ 55%" do plano — 53 a 64% conforme as sementes —: a meta é a que separa a base do D2)
    ['A', 'A10', 'item 21: chutes da IA de dentro da área (%, sem pênalti)', c => pct(c.soma(r => r.chutes[1].dentro), c.soma(r => r.chutes[1].n)), ['>=', 70], 60.4, null],
    ['A', 'A11', 'item 21: conversão da IA (gols ÷ chutes, %)', c => pct(c.soma(r => r.gols[1]), c.soma(r => r.chutes[1].n)), null, 21.8, null],
    ['A', 'A12', 'chutes da IA por partida', c => c.soma(r => r.chutes[1].n) / c.nP, null, 4.21, null],
    ['M', 'M1', '1º homem da IA sobre o condutor humano (mediana, m)', c => c.adv.h1.dMediana, null, 2.00, 5.2],
    ['M', 'M2', 'aproximação do 1º homem da IA a 4–7 m (km/h)', c => c.adv.h1.aBin[2] * 3.6, null, 2.18, 7.4],
    ['M', 'M3', 'aproximação do 1º homem da IA a 7–12 m (km/h)', c => c.adv.h1.aBin[3] * 3.6, null, 1.11, 7.5],
    ['M', 'M4', 'IA sem a bola (marcando): m/min', c => c.adv.defendendo.mpm, null, 222.8, null],
    ['C', 'C1', '1º companheiro da pessoa sobre o condutor da IA (mediana, m)', c => c.comp.h1.dMediana, null, 7.64, 5.2],
    ['C', 'C2', 'companheiros da pessoa a ≤ 5 m do condutor da IA (% do tempo)', c => 100 * c.comp.h1.le5, null, 29.2, 48],
    ['V', 'V1', 'IA atacando (com a bola): m/min', c => c.adv.atacando.mpm, ['<=', 190], 168.2, null],
    ['V', 'V2', 'IA no total: m/min', c => c.adv.total.mpm, ['<=', 195], 181.9, 140],
    ['V', 'V3', 'vai e volta da IA (> 135° em 0,25–1 s) por jogador-min', c => c.adv.invPorMin, ['<=', 5.8], 5.95, 0.30],
    ['V', 'V4', 'gols da IA contra o roteiro por partida (não caem)', c => c.soma(r => r.gols[1]) / c.nP, ['>=', 0.92], 0.92, null],
    // (revisão do D2: conduzindo mais, a IA entregava a bola no bote — 2,42 → 3,02 por min no pé, +25%; o teto é a base + 15%)
    ['V', 'V5', 'roubadas sofridas pela IA por min de bola no pé (≤ base + 15%)', c => c.soma(r => r.roubadas[1]) / Math.max(1e-9, c.soma(r => r.peMin[1])), ['<=', 2.78], 2.42, null],
    ['V', 'V6', 'chutes do roteiro por partida', c => c.soma(r => r.chutes[0].n) / c.nP, null, 0.83, null],
  ];
  const tB = Date.now();
  const ctx = ctxDe(res);
  const vals = M.map(([, , , f]) => { try { return f(ctx); } catch { return NaN; } });
  // bootstrap estratificado por roteiro (sorteio fixo: a mesma saída para as mesmas partidas)
  const estratos = ROTEIROS.map(p => res.filter(r => r.perfil === p)).filter(E => E.length);
  let sr = 0x9e3779b9;
  const rnd = () => { sr = (sr + 0x6d2b79f5) | 0; let t = Math.imul(sr ^ (sr >>> 15), 1 | sr); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const amostras = M.map(() => []);
  for (let b = 0; b < BOOT; b++) {
    const rs = estratos.flatMap(E => E.map(() => E[Math.floor(rnd() * E.length)]));
    const cb = ctxDe(rs);
    M.forEach(([, , , f], i) => { try { const v = f(cb); if (Number.isFinite(v)) amostras[i].push(v); } catch { /* sem a medida */ } });
  }
  const dp = v => { if (v.length < 2) return NaN; const mu = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1)); };
  const eps = amostras.map(dp);
  const nP = res.length;
  const soma = ctx.soma;
  const chutesIA = soma(r => r.chutes[1].n), dentroIA = soma(r => r.chutes[1].dentro), golsIA = soma(r => r.gols[1]);
  const golsHum = soma(r => r.gols[0]), chutesHum = soma(r => r.chutes[0].n);
  const passa = ([op, x], v) => (op === '>=' ? v >= x : op === '<=' ? v <= x : true);
  const out = [];
  out.push(`teste-ia-corre — lógica: ${JS}`);
  out.push(`${nP} partidas de 2 × 4 min contra o roteiro (${ROTEIROS.join(', ')} × ${NSEM} sementes)${SETS.length ? ` · --set ${SETS.join(' ')}` : ''} · ${((Date.now() - t0) / 1000).toFixed(0)} s (bootstrap ${BOOT}× em ${((Date.now() - tB) / 1000).toFixed(1)} s)`);
  out.push(`gols por partida: IA ${f1(golsIA / nP, 2)} · roteiro ${f1(golsHum / nP, 2)} · chutes: IA ${f1(chutesIA / nP, 1)} (${f1(100 * dentroIA / Math.max(1, chutesIA), 0)}% de dentro da área) · roteiro ${f1(chutesHum / nP, 1)}`);
  let falhas = 0;
  out.push('\nP — o portão "só contra a pessoa" (vale sempre)');
  for (const [id, nome, v, det, ok] of portao) {
    if (!ok) falhas++;
    out.push(`  ${ok ? 'passou  ' : 'REPROVOU'} ${id.padEnd(4)} ${nome}: ${v}${det ? ` (${det})` : ''}`);
  }
  let secAnt = '';
  const NOME_SEC = { A: 'A — ataque da IA (D2)', M: 'M — marcação da IA (informativa: D3)', C: 'C — companheiros da pessoa (informativa: D4)', V: 'V — guardas (valem sempre)' };
  M.forEach(([sec, id, nome, , meta, base, real], i) => {
    const v = vals[i], e = eps[i];
    if (sec !== secAnt) { out.push(`\n${NOME_SEC[sec]}`); secAnt = sec; }
    const ok = !meta || passa(meta, v);
    if (!ok) falhas++;
    const st = !meta ? 'info    ' : ok ? 'passou  ' : 'REPROVOU';
    out.push(`  ${st} ${id.padEnd(4)} ${nome}: ${f1(v, 2)}${Number.isFinite(e) ? ` ± ${f1(e, 2)}` : ''}${meta ? ` (meta ${meta[0] === '>=' ? '≥' : '≤'} ${f1(meta[1], 2)})` : ''}${base != null ? ` · antes ${f1(base, 2)}` : ''}${real != null ? ` · real ${f1(real, 2)}` : ''}`);
  });
  if (args.includes('--detalhe')) { out.push(imprimir('a IA adversária (time 1)', ctx.adv)); out.push(imprimir('os companheiros da pessoa (time 0, sem o controlado)', ctx.comp)); }
  out.push(`\n${falhas ? `REPROVOU: ${falhas} meta(s)` : 'PASSOU: todas as metas ligadas'}`);
  console.log(out.join('\n'));
  if (JSON_OUT) fs.writeFileSync(JSON_OUT, JSON.stringify({ js: JS, sementes: NSEM, roteiros: ROTEIROS, sets: SETS, boot: BOOT,
    portao: portao.map(([id, nome, v, det, ok]) => ({ id, nome, v, det, ok })),
    medidas: M.map(([sec, id, nome, , meta, base], i) => ({ sec, id, nome, v: vals[i], e: eps[i], meta, base })), adv: ctx.adv, comp: ctx.comp,
    porPartida: res.map(r => ({ perfil: r.perfil, semente: r.semente, gols: r.gols, chutes: r.chutes, roubadas: r.roubadas, peMin: r.peMin })) }, null, 1));
  if (falhas) process.exitCode = 1;
}
