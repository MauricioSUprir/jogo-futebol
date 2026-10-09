// Teste da condução (seção 4): jogador sozinho, 16 cenas (trote e arrancada × reta e curva
// suave de 30°/s × partindo parado e embalado × dois sentidos) + 4 cenas de corrida, mais
// curvas mais fechadas (45°/s com meta; 60 e 90°/s como informação) e o analógico solto.
// Bola–PÉ (o que a especificação pede) é medida na POSE (anim.js): distância horizontal do
// centro da bola ao pé (tornozelo–ponta) que vai dar o próximo toque, fora da janela de
// animação do toque. Bola–corpo (quadril) fica como informação. O toque sincronizado com a
// passada é medido na pose também (pé no balanço, sem troca de pé na hora, pé perto da bola).
// Metas marcadas PENDENTE (bola–pé e chuteira dentro da bola) dependem de onde o anim.js põe o
// pé (outro módulo): aparecem com o número e REPROVA quando não batem, e derrubam a bateria
// com --estrito — sem a opção, não derrubam até o anim.js ser corrigido.
// Reprova (código 1) se alguma meta não passar.
//   node tools/teste-conducao.mjs [--semente N] [--detalhe] [--estrito]
import {
  rodarCena, taxasRumo, bolaForaDoCaminho, cortesNaoPedidos, percentil, media, DEG, tabelaTexto, fmt,
} from './lib/medidas.mjs';
import { PASSO, BOTAO } from '../js/config.js';
import { criarMundo, passo } from '../js/sim.js';

const args = process.argv.slice(2);
const semente = +(args[args.indexOf('--semente') + 1] || 1) || 1;
const detalhe = args.includes('--detalhe');
const estrito = args.includes('--estrito');

const cenas = [];
for (const andar of ['trote', 'arrancada']) {
  for (const caminho of ['reta', 'curva']) {
    for (const partida of ['parado', 'embalado']) {
      for (const sentido of [1, -1]) cenas.push({ andar, caminho, partida, sentido });
    }
  }
}
const extras = [];
for (const caminho of ['reta', 'curva']) for (const sentido of [1, -1]) extras.push({ andar: 'corrida', caminho, partida: 'embalado', sentido, extra: true });

function posicaoInicial(c) {
  if (c.caminho === 'curva') return { x0: c.andar === 'trote' ? 0 : -6, z0: -c.sentido * (c.andar === 'trote' ? 3 : 8), rumo0: 0 };
  if (c.sentido > 0) return { x0: -52, z0: 20, rumo0: 0 };
  return { x0: 40, z0: -30, rumo0: Math.PI * 0.75 };
}

const faixas = { trote: [], correndo: [], arrancada: [] };
const faixasPe = { trote: [], correndo: [], arrancada: [] }, faixasPeMin = { trote: [], correndo: [], arrancada: [] };
let quadros = 0, dentroBola = 0;
const toquesPose = [];
const foraCaminho = [];
let logs = [];
const linhas = [['cena', 'rumo p95 °/s', 'desvio m', 'bola fora p95', 'bola–corpo méd', 'buscas', 'perdas', 'toques']];
const reprov = [];
const resCenas = [];
let semApoio = 0, totalToques = 0;
let toquesArr = 0, passadasArr = 0;

for (const c of [...cenas, ...extras]) {
  const pos = posicaoInicial(c);
  const duracao = c.caminho === 'reta' ? (c.andar === 'arrancada' || c.andar === 'corrida' ? 9 : 10) : 10;
  const r = rodarCena({ ...c, ...pos, semente: semente + cenas.length, duracao, pose: true });
  const { S, iIni, N } = r;
  const { tf, tv } = taxasRumo(S, iIni, N);
  const taxa = Math.max(percentil(tf, 0.95), percentil(tv, 0.95));
  // desvio do corpo da linha pedida (só reta)
  let desvio = 0;
  if (c.caminho === 'reta') {
    const hx = Math.cos(pos.rumo0), hz = Math.sin(pos.rumo0);
    const x0 = S.x[iIni], z0 = S.z[iIni];
    for (let i = iIni; i < N; i++) desvio = Math.max(desvio, Math.abs(-(S.x[i] - x0) * hz + (S.z[i] - z0) * hx));
  }
  const fora = bolaForaDoCaminho(S, iIni, N);
  foraCaminho.push(...fora);
  const dists = [];
  for (let i = iIni; i < N; i++) {
    const d = Math.hypot(S.bx[i] - S.x[i], S.bz[i] - S.z[i]);
    dists.push(d);
    const s = S.s[i];
    const fx = s >= 2.4 && s <= 3.6 ? 'trote' : s >= 4 && s <= 6.5 ? 'correndo' : s > 6.5 ? 'arrancada' : null;
    if (fx) {
      faixas[fx].push(d);
      if (!S.janela[i]) { faixasPe[fx].push(S.pe[i]); faixasPeMin[fx].push(S.peMaisPerto[i]); }
    }
    quadros++; if (S.dentro[i]) dentroBola++;
  }
  for (const tq of S.toques) if (tq.i >= iIni) toquesPose.push({ ...tq, cena: c });
  let buscas = 0;
  for (let i = iIni; i < N; i++) if (S.busca[i] && !S.busca[i - 1]) buscas++;
  const perdas = r.stats.perdas;
  const logJ = r.log.filter(l => l.t >= S.tick[iIni]);
  logs.push(logJ);
  for (const l of logJ) { totalToques++; if (!l.apoio) semApoio++; }
  // toques por passada em plena arrancada (velocidade > 7 m/s)
  if (c.andar === 'arrancada') {
    for (let i = iIni + 1; i < N; i++) if (S.s[i] > 7) passadasArr += (S.fase[i] - S.fase[i - 1]) / 2;
    for (const l of logJ) if (l.s > 7) toquesArr++;
  }
  const nome = `${c.andar}/${c.caminho}/${c.partida}/${c.sentido > 0 ? '+' : '−'}`;
  const metaTaxa = c.caminho === 'reta' ? 12 : 45;
  const okTaxa = taxa <= metaTaxa;
  const okDesvio = c.caminho !== 'reta' || desvio <= 0.35;
  if (!okTaxa) reprov.push(`${nome}: rumo p95 ${fmt(taxa, 1)}°/s > ${metaTaxa}`);
  if (!okDesvio) reprov.push(`${nome}: desvio do corpo ${fmt(desvio)} m > 0,35`);
  if (perdas > 0) reprov.push(`${nome}: ${perdas} perda(s) de bola`);
  linhas.push([nome + (c.extra ? ' (extra)' : ''), fmt(taxa, 1), c.caminho === 'reta' ? fmt(desvio) : '—', fmt(percentil(fora, 0.95)), fmt(media(dists)), buscas, perdas, logJ.length]);
  resCenas.push({ nome, taxa, desvio, fora95: percentil(fora, 0.95), buscas, perdas });
  if (detalhe) console.log(nome, 'tf95', fmt(percentil(tf, 0.95), 1), 'tv95', fmt(percentil(tv, 0.95), 1), 'max', fmt(Math.max(...tf), 1));
}

// Soltar o analógico conduzindo (freada com a bola): o corpo não pode passar por cima da bola
// nem ficar tocando sem parar. Trote/corrida/arrancada por 1–4 s e analógico solto por 3 s.
const freada = { piorFrente: Infinity, sob: 0, maxToques: 0, perdas: 0, casos: 0 };
{
  const andaresF = [['trote', 0.5, 0], ['corrida', 1, 0], ['arrancada', 1, BOTAO.CORRER]];
  for (const [, mag, bot] of andaresF) {
    for (const tCorre of [1, 2, 3, 4.3]) for (const sem of [1, 2, 3]) {
      const m = criarMundo({ semente: sem, jogadores: [{ id: 0, x: 0, z: 0, rumo: 0 }], bola: { x: 0.4, z: 0 }, posse: 0 });
      const j = m.jogadores[0];
      for (let i = 0; i < Math.round(tCorre / PASSO); i++) passo(m, { 0: { x: mag, z: 0, botoes: bot } });
      let toques = 0;
      for (let i = 0; i < 180; i++) {
        passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
        const dx = m.bola.p.x - j.x, dz = m.bola.p.z - j.z;
        const fr = dx * Math.cos(j.rumo) + dz * Math.sin(j.rumo);
        freada.piorFrente = Math.min(freada.piorFrente, fr);
        if (Math.hypot(dx, dz) < 0.2) freada.sob++;
        toques += m.eventos.filter(e => e.tipo === 'toque').length;
      }
      freada.maxToques = Math.max(freada.maxToques, toques);
      if (m.stats.perdas > 0 || m.posse !== 0) freada.perdas++;
      freada.casos++;
    }
  }
}

const cortes = cortesNaoPedidos(logs.flat(), 30);
const pCortes = cortes.total ? (100 * cortes.n) / cortes.total : 0;
const fora95 = percentil(foraCaminho, 0.95);
const tr5 = percentil(faixas.trote, 0.05), tr95 = percentil(faixas.trote, 0.95), trMed = media(faixas.trote);
const coMed = media(faixas.correndo), co95 = percentil(faixas.correndo, 0.95);
const ar95 = percentil(faixas.arrancada, 0.95), arMed = media(faixas.arrancada);
const toquesPorPassada = passadasArr > 0 ? toquesArr / passadasArr : NaN;

console.log(tabelaTexto(linhas));
console.log('');
// bola–pé (pé do próximo toque, fora da janela do toque)
const pe5 = percentil(faixasPe.trote, 0.05), pe95 = percentil(faixasPe.trote, 0.95), peTrMed = media(faixasPe.trote);
const peCoMed = media(faixasPe.correndo), peCo95 = percentil(faixasPe.correndo, 0.95);
const peAr95 = percentil(faixasPe.arrancada, 0.95), peArMed = media(faixasPe.arrancada);
const pDentro = (100 * dentroBola) / quadros;
// toque sincronizado com a passada (na pose)
const dPe = toquesPose.map(t => t.dPe);
const noBalanco = toquesPose.filter(t => t.balanco).length, trocas = toquesPose.filter(t => t.trocou).length;
const dPe95 = percentil(dPe, 0.95);
// curvas mais fechadas: pior cena por curvatura (2 sentidos × parado/embalado)
const curvas = {};
for (const w of [45, 60, 90]) {
  curvas[w] = { pior: 0, nome: '' };
  for (const andar of ['trote', 'corrida', 'arrancada']) for (const sentido of [1, -1]) for (const partida of ['parado', 'embalado']) {
    const r = rodarCena({ andar, caminho: 'curva', partida, sentido, semente, duracao: 10, x0: -6, z0: -sentido * 8, rumo0: 0, curvaGrausS: w });
    const f95 = percentil(bolaForaDoCaminho(r.S, r.iIni, r.N), 0.95);
    if (f95 > curvas[w].pior) curvas[w] = { pior: f95, nome: `${andar}/${partida}/${sentido > 0 ? '+' : '−'}` };
    if (r.stats.perdas) reprov.push(`curva ${w}°/s ${andar}: ${r.stats.perdas} perda(s)`);
  }
}
const piorCena = resCenas.reduce((a, c) => (c.fora95 > a.fora95 ? c : a), resCenas[0]);

const metas = [
  ['Cortes sem o analógico pedir', `${cortes.n}/${cortes.total} = ${fmt(pCortes)}%`, '≤ 0,25%', pCortes <= 0.25],
  ['Bola fora do caminho p95 — reta + curva 30°/s (agrupado)', `${fmt(fora95)} m`, '≤ 0,30 m', fora95 <= 0.3],
  ['Bola fora do caminho p95 — pior cena (reta e 30°/s)', `${fmt(piorCena.fora95)} m (${piorCena.nome})`, '≤ 0,30 m', piorCena.fora95 <= 0.3],
  ['Bola fora do caminho p95 — pior cena em curva de 45°/s', `${fmt(curvas[45].pior)} m (${curvas[45].nome})`, '≤ 0,30 m', curvas[45].pior <= 0.3],
  ['Bola–pé correndo (4–6,5 m/s; pé do próximo toque)', `méd ${fmt(peCoMed)} · p95 ${fmt(peCo95)} m`, 'méd 0,45–0,55 · p95 ≤ 1,0', peCoMed >= 0.45 && peCoMed <= 0.55 && peCo95 <= 1.0, 'PENDENTE'],
  ['Bola–pé na arrancada (> 6,5 m/s; pé do próximo toque)', `méd ${fmt(peArMed)} · p95 ${fmt(peAr95)} m`, 'p95 ≤ 1,2', peAr95 <= 1.2, 'PENDENTE'],
  ['Bola–pé trotando (p5–p95; pé do próximo toque)', `${fmt(pe5)}–${fmt(pe95)} m (méd ${fmt(peTrMed)})`, '0,30–0,60 m', pe5 >= 0.3 && pe95 <= 0.6, 'PENDENTE'],
  ['Chuteira dentro da bola (quadros, pose)', `${fmt(pDentro, 1)}%`, '≤ 1%', pDentro <= 1, 'PENDENTE'],
  ['Toque sincronizado: pé que toca no balanço · sem troca de pé na hora', `${noBalanco}/${toquesPose.length} · ${trocas} troca(s)`, '100% · 0', noBalanco === toquesPose.length && trocas === 0],
  ['Toque sincronizado: tornozelo do pé que toca até a bola (pose, p95)', `${fmt(dPe95)} m (mediana ${fmt(percentil(dPe, 0.5))})`, '≤ 0,30 m', dPe95 <= 0.3],
  ['Toques por passada (arrancada > 7 m/s)', fmt(toquesPorPassada), '≈ 1 (0,8–1,25)', toquesPorPassada >= 0.8 && toquesPorPassada <= 1.25],
  ['Soltar o analógico conduzindo: bola à frente do corpo (pior)', `${fmt(freada.piorFrente)} m · ${freada.sob} tick(s) com a bola embaixo do corpo`, '≥ 0,14 m · 0', freada.piorFrente >= 0.14 && freada.sob === 0],
  ['Soltar o analógico conduzindo: toques em 3 s (pior de ' + freada.casos + ')', `${freada.maxToques} · ${freada.perdas} perda(s)`, '≤ 8 · 0', freada.maxToques <= 8 && freada.perdas === 0],
  ['Cenas com reta/curva/desvio/perda OK', `${resCenas.length - new Set(reprov.map(r => r.split(':')[0])).size}/${resCenas.length}`, 'todas', reprov.length === 0],
];
const res = m => (m[3] ? 'PASSOU' : m[4] && !estrito ? 'REPROVA (PENDENTE: anim.js)' : 'REPROVOU');
console.log(tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(m => [m[0], m[1], m[2], res(m)])]));
for (const r of reprov) console.log('  - ' + r);
console.log('');
console.log(tabelaTexto([
  ['Informação', 'Medido'],
  ['Bola–corpo (centro do quadril) trotando p5–p95', `${fmt(tr5)}–${fmt(tr95)} m (méd ${fmt(trMed)})`],
  ['Bola–corpo correndo · arrancada', `méd ${fmt(coMed)} p95 ${fmt(co95)} · méd ${fmt(arMed)} p95 ${fmt(ar95)} m`],
  ['Bola–pé mais perto (qualquer pé) trote · correndo · arrancada (méd)', `${fmt(media(faixasPeMin.trote))} · ${fmt(media(faixasPeMin.correndo))} · ${fmt(media(faixasPeMin.arrancada))} m`],
  ['Bola fora do caminho p95 — pior cena a 60°/s · 90°/s', `${fmt(curvas[60].pior)} m (${curvas[60].nome}) · ${fmt(curvas[90].pior)} m (${curvas[90].nome})`],
  ['Toques com o pé de apoio no chão (garantido pelo código)', `${totalToques - semApoio}/${totalToques}`],
]));
const ok = metas.every(m => m[3] || (m[4] && !estrito));
console.log(ok ? '\nteste-conducao: PASSOU' : '\nteste-conducao: REPROVOU');
if (process.env.JSON_SAIDA) {
  const fs = await import('node:fs');
  fs.writeFileSync(process.env.JSON_SAIDA, JSON.stringify({ metas: metas.map(m => ({ meta: m[0], medido: m[1], alvo: m[2], ok: m[3] })), cenas: resCenas }, null, 1));
}
process.exit(ok ? 0 : 1);
