// Cenas de CARTÃO e de FIM DE TEMPO e os cortes de TORCIDA e TREINADOR no gol (pedido do dono de 12/10: "temos que ter
// cenas de final de primeiro tempo, final de segundo tempo, cartão amarelo (3 cenas diferentes) e cartão vermelho (outras
// 3 cenas diferentes). Quando sai gol, pode ter cenas de torcida e treinador comemorando"). Contas PURAS em Node
// (js/cena-atores.js, js/cena-cartao.js, js/cena-fim.js, js/comemoracao.js, render/emocao.js):
//   A) canhão de cartões a partir de estados do MEIO da partida (montarFalta + regrasPartida, como o teste-faltas): 8
//      estados × 6 situações (amarelo; vermelho direto; 2º amarelo; pênalti com amarelo; vantagem → gol, com a cena
//      montada em gol + 149; goleiro expulso) × 3 variações forçadas = 144 cenas; por tick: árbitro (mão do cartão
//      ≥ 0,25 m acima do topo da cabeça ≥ 1,2 s contínuos, 1,5–3,2 m do punido, o cartão a ≤ 35° da câmera no plano
//      'arbitro'), IFAB (A1, V2: só o capitão e o punido a < 4 m do árbitro), as assinaturas das 6 variações, o expulso
//      (termina com z > 34, chegando ao túnel em todo o P3b), corpo (NaN, ossos ±0,5 cm, pé plantado ≤ 0,05 m/s, pé no ar
//      pela régua do teste-patinacao, pelves ≥ 0,4 m, todo salto > 0,5 m/tick junto com um corte), câmera (nunca dentro
//      de sólido nem do gol, ≤ 5,5 m além das linhas, lente ≥ 2,5 m, o punido no quadro ≥ 95% em 16:9 e 844/390 com
//      ≥ 25% da altura no plano 'reacao') e as durações;
//   B) variedade: escolherVariante em 2000 sequências (amarelo, vermelho e o enquadramento da torcida com memórias
//      separadas): nunca a mesma seguida; em 100 cartões seguidos cada variação ≥ 25%; exclusão por falta de companheiro
//      ≤ 10% no canhão A;
//   C) fim de tempo: 8 estados do meio × {intervalo, vitória da casa, derrota da casa, empate}: 2 s depois do apito
//      ninguém acima de 1,6 m/s; ≥ 60% com as mãos na cintura no P2; ≥ 2 (intervalo) / ≥ 3 (fim) apertos de mão; no P3
//      ≥ 80% chegando ao túnel; vitória: ≥ 3 com os dois pulsos acima da cabeça; derrota: ≥ 3 cabisbaixos ou com as mãos
//      na cabeça/joelhos; empate: ninguém com as duas mãos acima da cabeça por > 0,5 s; corpo e câmera; o treinador pelo
//      gancho (um técnico falso: +2,0 s; null: nenhum buraco);
//   D) gol: as 8 cenas do teste-comemoracao com a fase de câmera 'torcida' entre o abraço e a reação (0,8–1,5 s), os
//      atores e o kFim IDÊNTICOS aos da cena sem os cortes (opc.cortes = false), a câmera na torcida do time que marcou
//      (≤ 30°), baixa (≤ 2 m), fov 30–40, fora dos sólidos; o gancho do treinador (+90 ticks exatos, braços acima da
//      cabeça ≥ 0,5 s, dentro da área técnica; null: nada muda); a cena curta não muda;
//   E) pureza: hashMundo antes = depois de cada cena (A, C e D);
//   F) relógio do estádio: relogioEstadio anda com o laço segurado (a festa — bandeirão, fogo dos sinalizadores — anda
//      junto) e, sem espera, é o relógio de antes (idêntico);
//   G) custo: p95 ms/tick ≤ 0,6 (25 atores).
// Na base (sem os módulos) cada seção REPROVA com o motivo.
//   node tools/teste-cenas.mjs [--js <pasta js>] [--so A,B,...] [--detalhe]
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(AQUI, '../js');
const SO = args.includes('--so') ? new Set(args[args.indexOf('--so') + 1].split(',')) : null;
const detalhe = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
async function tentar(f) { try { return await imp(f); } catch (e) { if (detalhe) console.log(`(${f}: ${e.message})`); return null; } }
const roda = s => !SO || SO.has(s);

const linhas = [];
let falhas = 0;
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));
const f3 = v => (Number.isFinite(v) ? v.toFixed(3) : String(v));
function reg(nome, medido, meta, ok, info = false) { linhas.push({ nome, medido, meta, ok: !!ok, info }); if (!ok && !info) falhas++; }
function imprimir() {
  const larg = Math.max(...linhas.map(l => l.nome.length));
  for (const l of linhas) console.log(`${l.info ? 'INFO    ' : l.ok ? 'PASSOU  ' : 'REPROVOU'}  ${l.nome.padEnd(larg)}  ${l.medido}   (meta: ${l.meta})`);
  console.log(falhas ? `\nteste-cenas: REPROVOU (${falhas})` : '\nteste-cenas: PASSOU');
}

const C = await imp('config.js');
const { PASSO } = C;
const EMO = await tentar('render/emocao.js');
const FE = await tentar('render/festa.js');

// ------------------------------------------------------------------------------------------------ F) relógio do estádio
if (roda('F')) {
  if (!EMO || typeof EMO.relogioEstadio !== 'function') {
    reg('F relógio do estádio (render/emocao.js relogioEstadio)', 'não existe: com o laço segurado (cena, replay, comemoração parada) bandeiras, bandeirão, sinalizadores e ola ficam CONGELADOS no último passo', 'existe e anda no dt do desenho', false);
  } else {
    // F1: anda com o laço segurado (300 quadros de 1/60 s = 5 s), parado sem ele
    const est = EMO.criarRelogioEstadio();
    est.tSim = 42;
    let t0 = EMO.relogioEstadio(est, 0, false), mono = true, ult = t0;
    for (let i = 0; i < 300; i++) { const t = EMO.relogioEstadio(est, 1 / 60, true); if (!(t > ult)) mono = false; ult = t; }
    const andou = ult - t0;
    let parado = true;
    for (let i = 0; i < 60; i++) if (EMO.relogioEstadio(est, 1 / 60, false) !== ult) parado = false;
    reg('F1 relógio do estádio com o laço segurado: anda pelo dt do desenho', `${f3(andou)} s em 300 quadros de 1/60 s (sempre subindo: ${mono}); sem segurar, parado: ${parado}`, '5,000 s; subindo; parado sem segurar', Math.abs(andou - 5) < 1e-9 && mono && parado);
    // F2: sem espera é o relógio de antes (passos × 1/60 s), número a número
    const e2 = EMO.criarRelogioEstadio();
    let dif = 0;
    for (let k = 0; k < 20000; k++) { e2.tSim = k * PASSO; if (EMO.relogioEstadio(e2, 0, false) !== k * PASSO) dif++; }
    reg('F2 sem espera o relógio do estádio é o de antes (idêntico)', `${dif} diferentes em 20000 passos`, '0', dif === 0);
    // F3: a festa anda durante a espera — gol da casa, depois 4 s com o laço segurado: o bandeirão abre, o fogo dos
    // sinalizadores muda e a ola/os cantos andam (antes: o t da festa ficava no do último passo — tudo parado)
    const emo = EMO.criarEmocao(), rel = EMO.criarRelogioEstadio();
    const ctx = { t: 0, timeDe: () => 0, bola: { x: 50, y: 0.11, z: 0 }, ataca: { 0: 1, 1: -1 } };
    const passo = { t: 0, bola: ctx.bola, posseTime: 0, ataca: ctx.ataca, estado: 'jogo' };
    for (let k = 1; k <= 120; k++) { rel.tSim = k * PASSO; passo.t = EMO.relogioEstadio(rel, 0, false); EMO.emocaoPasso(emo, passo, PASSO); }
    ctx.t = rel.tSim; EMO.emocaoEvento(emo, { tipo: 'gol', time: 0 }, ctx);
    passo.estado = 'gol';
    const abre = new Set(), fogo = new Set(), tsF = new Set();
    for (let q = 0; q < 240; q++) {
      passo.t = EMO.relogioEstadio(rel, 1 / 60, true);
      EMO.emocaoPasso(emo, passo, 1 / 60);
      tsF.add(emo.festa.t);
      abre.add(FE.aberturaBandeirao(emo.festa, emo.t).toFixed(4));
      let f = 0; for (const s of emo.festa.flares) f += FE.fogoSinalizador(s, emo.t);
      fogo.add(f.toFixed(4));
    }
    reg('F3 a festa anda com o laço segurado (gol da casa e 4 s de espera)', `relógio da festa ${tsF.size} valores; abertura do bandeirão ${abre.size} valores; fogo dos sinalizadores ${fogo.size} valores (em 240 quadros)`, '≥ 200, ≥ 60, ≥ 100', tsF.size >= 200 && abre.size >= 60 && fogo.size >= 100);
  }
}

imprimir();
process.exit(falhas ? 1 : 0);
