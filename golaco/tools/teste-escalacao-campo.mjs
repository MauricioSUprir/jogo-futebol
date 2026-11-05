// A escalação do pré-jogo com o campinho EM PÉ (item 29 da FILA; dono, 17/10: "o campinho da escalação do jogo EM PÉ (retrato),
// não deitado (escalacao-tela.js)"; contrato "Pré-jogo" no CONTRATOS.md, PESQUISA-PREJOGO.md "A escalação em pé"). As contas
// puras do js/escalacao-tela.js, do js/campinho.js e do js/letra-cond.js, sem navegador (a tela de verdade: teste-prejogo 4b e 15):
//  N1 tamanhoEscalacao(W, H, {larguraNome, alturaTela}) nas 10 áreas da especificação (celular 844×390 com e sem entalhe, 667×375,
//     640×360, 568×320; PC 1280×720, 1920×1080, 1366×600, 1440×900, 1024×768) × 3 conjuntos de nomes (o elenco fictício, camisas
//     de 10 letras do TM, os de estresse): o campo em pé (0,648 ≤ L/A ≤ 0,85), a carta com a altura de hoje (clamp(44,
//     ⌊(H − 52)/5⌋, 76)), folga ≥ 10 px entre cartas, as letras ≥ o mínimo da tela (§7.4/§7.5: celular nome e posição ≥ 11, ≥ 10
//     em 568×320; PC nome ≥ 13 e posição ≥ 11), a linha da posição cabe, nenhum nome do fictício nem do TM de 10 letras cortado
//     (pela mesma tabela de avanços) e a carta da ponta no máximo meia carta fora da lateral e NUNCA tangente a ela (revisão V1:
//     a borda ≥ 5 px para dentro, ou o centro na lateral); a janela de PC em pé (a largura não dá) desce a altura até o grupo
//     caber;
//  N2 as posições nas 6 formações (posicaoCarta): o GOL o mais baixo (≥ 10 px) e no meio; o lado certo (col menor → x menor;
//     col < 0 à esquerda do meio, > 0 à direita); os centros dentro do campo; nenhum par de cartas encostando (folga ≥ 10 − 0,5);
//  N3 o campinho.js dos outros usuários (o "Editar time" e a pausa) igual ao da base: svgCampinho(true), svgCampinho(false) e o
//     posicaoNaTela (6 formações × 2 orientações × 3 tamanhos) pelo hash FNV-1a gravado; svgCampinho(true, L): viewBox
//     "0 0 L 105", o círculo em L/2 com r 9,15, as áreas centradas, as laterais em 0,5 e L − 0,5;
//  N4 a larguraCond do prepartida.js é a do letra-cond.js (a mesma função) e dá os valores da tabela antiga em 200 textos (hash);
//  N5 a conta das duas folhas (revisões A1/V2: tamanhosDasFolhas): os 22 titulares (nomesTitulares) na ordem das vagas; a MESMA
//     caixa do campo nas duas (w × h), a altura a da conta dos 22 e a largura a maior das duas folhas; as cartas de cada folha
//     pelos 11 nomes dela (a de nomes mais estreitos nunca com a carta maior nem com as pontas mais para fora; cada uma igual à
//     conta dela na caixa) e a regra das pontas do N1 nas duas (o elenco fictício, o pedido do TM com nomes longos —
//     tools/lib/pedidos-tm.mjs PED_NOMES_LONGOS — e o MISTO, PED_NOMES_MISTOS: a folha de nomes curtos com as pontas para dentro).
// Na base 9ce86227 REPROVA N1 (a função deitava a caixa no celular), N2, N3 (a largura é ignorada), N4 (sem o letra-cond.js) e N5;
// no 07836042 (antes da revisão) REPROVA N1 (as pontas tangentes) e N5 (sem tamanhosDasFolhas).
//   node tools/teste-escalacao-campo.mjs [--js <pasta js>]   (--js: mede outra cópia, ex.: a base)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(AQUI, '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const tenta = async f => { try { return await imp(f); } catch (e) { return { erro: e.code ?? e.message.split('\n')[0] }; } };
const ESC = await imp('escalacao-tela.js');
const C = await imp('campinho.js');
const PP = await imp('prepartida.js');
const LC = await tenta('letra-cond.js');
const { FORMACOES } = await imp('formacoes.js');
const { ELENCOS, fichaDe, registrarElenco } = await imp('elenco.js');
const P = await imp('partida.js');
const TT = await imp('tm-times.js');
const { PED_NOMES_LONGOS, PED_NOMES_MISTOS, CAM_LONGAS, CAM_ESTRESSE } = await import(pathToFileURL(path.join(AQUI, 'lib/pedidos-tm.mjs')).href);

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f1 = v => (Number.isFinite(v) ? (Math.round(v * 10) / 10).toString().replace('.', ',') : String(v));
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : String(v));
const clamp = (a, v, b) => Math.max(a, Math.min(b, v));
const fnv = s => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

// a largura do nome (TM Cond 800, caixa normal): o módulo novo, ou a tabela do prepartida.js na base
const larguraCond = LC.larguraCond ?? PP.larguraCond;
const FICT = Object.values(ELENCOS).flatMap(el => (el.jogadores || []).map(j => fichaDe(j.id ?? j)?.camisa)).filter(Boolean);
const CONJUNTOS = [['fictício', FICT], ['TM 10 letras', CAM_LONGAS], ['estresse', [...CAM_LONGAS, ...CAM_ESTRESSE]]];
// as telas: a área útil pela conta do css/prejogo.css (margens clamp(...) e o entalhe simulado: --sa-l/r 47, --sa-b 21)
const TELAS = [['844×390', 844, 390, 0, 0], ['844×390 com entalhe', 844, 390, 47, 21], ['667×375', 667, 375, 0, 0], ['640×360', 640, 360, 0, 0],
  ['568×320', 568, 320, 0, 0], ['1280×720', 1280, 720, 0, 0], ['1920×1080', 1920, 1080, 0, 0], ['1366×600', 1366, 600, 0, 0],
  ['1440×900', 1440, 900, 0, 0], ['1024×768', 1024, 768, 0, 0]];
function area(vw, vh, sl, sb) {
  const padY = clamp(10, 0.034 * vh, 30), padX = clamp(12, 0.03 * vw, 40), gap = clamp(10, 0.02 * vw, 28);
  const H = Math.round(vh - sb - 2 * padY);
  const W = vw - 2 * sl - 2 * padX - clamp(118, 0.34 * vw, 440) - gap;
  return { W, H };
}
const minimos = vh => (vh <= 480 ? (vh < 350 ? { nome: 10, pos: 10 } : { nome: 11, pos: 11 }) : { nome: 13, pos: 11 });
const tam = (W, H, nomes, vh) => ESC.tamanhoEscalacao(W, H, { larguraNome: larguraDe(nomes), alturaTela: vh });
// (cabe pela tabela exata e pela dos avanços arredondados ao px — o Chromium sem posição subpixel do texto)
const larguraTela = (n, px) => Math.max(larguraCond(n, px, false), LC.larguraCondInteira ? LC.larguraCondInteira(n, px, false) : 0);
const cabeNaCarta = (n, T) => larguraTela(n, T.fonteNome) <= 0.94 * (T.cw - 2) + 0.01;
const larguraDe = nomes => px => nomes.reduce((m, n) => Math.max(m, larguraTela(n, px)), 0);
// a ponta nunca tangente à lateral (revisão V1): a borda da carta ≥ 5 px para dentro, ou o centro na lateral
const pontaOk = T => T.inset - T.cw / 2 >= 5 - 1e-9 || Math.abs(T.inset) <= 1e-9;

// ------------------------------------------------------------------ N1
{
  const ruins = [], linhas = [];
  for (const [nome, vw, vh, sl, sb] of TELAS) {
    const { W, H } = area(vw, vh, sl, sb);
    for (const [rot, nomes] of CONJUNTOS) {
      let T;
      try { T = tam(W, H, nomes, vh); } catch (e) { ruins.push(`${nome} ${rot}: ${e.message}`); continue; }
      const mn = minimos(vh);
      const la = T.w / T.h, chHoje = clamp(44, Math.floor((H - 52) / 5), 76);
      const folga = T.passo - T.cw;
      const cortados = nomes.filter(n => !cabeNaCarta(n, T));
      const p = [];
      if (!(la >= 0.648 - 1e-9 && la <= 0.85 + 1e-9)) p.push(`L/A ${f2(la)}`);
      if (T.h !== H || T.ch !== chHoje) p.push(`altura ${T.h}/${H}, carta ${T.ch}/${chHoje}`);
      if (!(folga >= 10 - 1e-9)) p.push(`folga ${f1(folga)}`);
      if (!(T.fonteNome >= mn.nome && T.fontePos >= mn.pos)) p.push(`letra ${T.fonteNome}/${T.fontePos}`);
      if (T.comPos !== true) p.push('sem a linha da posição');
      if (rot !== 'estresse' && cortados.length) p.push(`cortados ${cortados.join(', ')}`);
      if (!(T.fora <= T.cw / 2 + 1e-9 && T.inset >= -1e-9)) p.push(`fora ${f1(T.fora)} (meia carta ${T.cw / 2})`);
      if (!pontaOk(T)) p.push(`ponta tangente (borda ${f1(T.inset - T.cw / 2)} px, centro a ${f1(T.inset)})`);
      if (!(T.w + 2 * T.fora <= W + 0.5)) p.push(`grupo ${Math.ceil(T.w + 2 * T.fora)} > ${Math.floor(W)}`);
      if (!(T.largura >= 68 && T.largura <= 89.3)) p.push(`largura ${T.largura} m`);
      if (p.length) ruins.push(`${nome} ${rot}: ${p.join('; ')}`);
      if (rot !== 'estresse') linhas.push(`${nome} ${rot === 'fictício' ? 'fict.' : 'TM'} ${T.w}×${T.h} (${f2(la)}) carta ${T.cw}×${T.ch} ${f1(T.fonteNome)}/${f1(T.fontePos)}`);
    }
  }
  meta('N1 tamanhoEscalacao em pé: 10 telas × 3 conjuntos de nomes — L/A, carta, folga, letra, linha da posição, cortados, ponta',
    ruins.length ? ruins.slice(0, 4).join(' | ') + (ruins.length > 4 ? ` (+${ruins.length - 4})` : '') : linhas.filter((_, i) => i % 2 === 0).slice(0, 5).join('; ') + ' …',
    '0,648 ≤ L/A ≤ 0,85; carta de hoje; folga ≥ 10; letra ≥ mín.; posição cabe; 0 cortados (fict./TM); ≤ meia carta fora, nunca tangente', ruins.length === 0);
  // a janela de PC em pé: a largura não dá → a altura desce até o grupo caber
  let r = null;
  try {
    r = [[400, 900], [520, 900], [300, 700]].map(([W, H]) => { const T = tam(W, H, CAM_LONGAS, 1000); return { W, H, T, ok: T.w + 2 * T.fora <= W + 0.5 && T.w / T.h <= 0.85 + 1e-9 && T.w / T.h >= 0.648 && T.h < H && pontaOk(T) }; });
  } catch (e) { r = null; }
  meta('N1b janela de PC em pé (largura curta): a altura desce até o campo + as pontas caberem, ainda em pé',
    r ? r.map(x => `${x.W}×${x.H} → ${x.T.w}×${x.T.h} grupo ${Math.ceil(x.T.w + 2 * x.T.fora)}`).join('; ') : 'erro', 'grupo ≤ W; L/A ≤ 0,85; altura menor; pontas', r && r.every(x => x.ok));
}

// ------------------------------------------------------------------ N2
{
  const ruins = [];
  let n = 0;
  const amostras = [[290, 363, FICT, 390], [253, 298, CAM_LONGAS, 320], [600, 671, FICT, 720], [400, 559, [...CAM_LONGAS, ...CAM_ESTRESSE], 600]];
  for (const [W, H, nomes, vh] of amostras) {
    let T;
    try { T = tam(W + 200, H, nomes, vh); } catch (e) { ruins.push(e.message); continue; }
    if (typeof ESC.posicaoCarta !== 'function') { ruins.push('posicaoCarta não existe'); break; }
    for (const [fid, F] of Object.entries(FORMACOES)) {
      const ps = F.vagas.map(v => ({ v, ...ESC.posicaoCarta(v, T) }));
      const gol = ps.find(p => p.v.pos === 'GOL');
      const p = [];
      for (const q of ps) {
        if (q !== gol && !(gol.y >= q.y + 10)) p.push(`GOL acima de ${q.v.id}`);
        if (!(q.x >= -1e-9 && q.x <= T.w + 1e-9 && q.y >= 0 && q.y <= T.h)) p.push(`${q.v.id} fora do campo`);
        if (q.v.col < 0 && !(q.x < T.w / 2)) p.push(`${q.v.id} do lado errado`);
        if (q.v.col > 0 && !(q.x > T.w / 2)) p.push(`${q.v.id} do lado errado`);
        for (const o of ps) {
          if (o === q) continue;
          if (o.v.fila === q.v.fila && o.v.col < q.v.col && !(o.x <= q.x - 5)) p.push(`${o.v.id}/${q.v.id} fora de ordem`);
          if (o.v.id < q.v.id) continue;
          const gx = Math.abs(o.x - q.x) - T.cw, gy = Math.abs(o.y - q.y) - T.ch;
          if (Math.max(gx, gy) < 10 - 0.5) p.push(`${o.v.id}/${q.v.id} encostam (${f1(Math.max(gx, gy))})`);
        }
      }
      if (Math.abs(gol.x - T.w / 2) > 1e-6) p.push(`GOL fora do meio (${f1(gol.x)} × ${f1(T.w / 2)})`);
      n++;
      if (p.length) ruins.push(`${fid} ${T.w}×${T.h}: ${[...new Set(p)].slice(0, 2).join(', ')}`);
    }
  }
  meta('N2 posições nas 6 formações (4 tamanhos): GOL embaixo e no meio, o lado certo, dentro do campo, nada encosta',
    ruins.length ? ruins.slice(0, 3).join(' | ') : `${n} casos limpos`, 'todos limpos', ruins.length === 0 && n === 24);
}

// ------------------------------------------------------------------ N3
{
  const REF = { emPe: '61e32a21', deitado: 'd4964659', posicao: '13a1f01c' };  // a base 9ce86227
  const TAM = [[300, 400, 50, 60], [800, 500, 120, 76], [394, 298, 68, 49]];
  let s = '';
  for (const f of Object.keys(FORMACOES).sort()) for (const v of [true, false]) for (const [W, H, cw, ch] of TAM) for (const vg of FORMACOES[f].vagas) { const p = C.posicaoNaTela(vg, W, H, cw, ch, v); s += `${p.x.toFixed(4)},${p.y.toFixed(4)};`; }
  const h = { emPe: fnv(JSON.stringify(C.svgCampinho(true))), deitado: fnv(JSON.stringify(C.svgCampinho(false))), posicao: fnv(s) };
  meta('N3a o campinho.js do "Editar time" e da pausa igual ao da base (svgCampinho(true/false) e posicaoNaTela, hash FNV-1a)',
    `em pé ${h.emPe}, deitado ${h.deitado}, posições ${h.posicao}`, `${REF.emPe}, ${REF.deitado}, ${REF.posicao}`, h.emPe === REF.emPe && h.deitado === REF.deitado && h.posicao === REF.posicao);
  const ruins = [];
  for (const L of [84.12, 89, 76.5]) {
    const sv = C.svgCampinho(true, L);
    const num = (re, i = 1) => { const m = sv.html.match(re); return m ? +m[i] : NaN; };
    if (sv.viewBox !== `0 0 ${L} 105`) ruins.push(`${L}: viewBox ${sv.viewBox}`);
    const cx = num(/<ellipse cx="([\d.]+)" cy="([\d.]+)" rx="([\d.]+)" ry="([\d.]+)"/), rx = num(/<ellipse cx="[\d.]+" cy="[\d.]+" rx="([\d.]+)" ry="([\d.]+)"/), ry = num(/<ellipse cx="[\d.]+" cy="[\d.]+" rx="[\d.]+" ry="([\d.]+)"/);
    if (Math.abs(cx - L / 2) > 1e-6 || rx !== 9.15 || ry !== 9.15) ruins.push(`${L}: círculo ${cx}/${rx}/${ry}`);
    const rects = [...sv.html.matchAll(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"\/>/g)].map(m => m.slice(1).map(Number));
    const [campo, ...areas] = rects;
    if (!campo || campo[0] !== 0.5 || Math.abs(campo[0] + campo[2] - (L - 0.5)) > 1e-6 || campo[3] !== 104) ruins.push(`${L}: laterais ${campo}`);
    if (areas.length !== 4 || areas.some(a => Math.abs(a[0] + a[2] / 2 - L / 2) > 1e-6)) ruins.push(`${L}: áreas fora do meio`);
    if (!areas.some(a => a[2] === 40.32 && a[3] === 16.5) || !areas.some(a => a[2] === 18.32 && a[3] === 5.5)) ruins.push(`${L}: áreas fora do tamanho real`);
    if (!new RegExp(`<line x1="0.5" y1="52.5" x2="${L - 0.5}" y2="52.5"/>`).test(sv.html)) ruins.push(`${L}: linha do meio`);
  }
  meta('N3b svgCampinho(true, L): viewBox "0 0 L 105", círculo em L/2 (r 9,15), áreas reais centradas, laterais em 0,5 e L − 0,5', ruins.length ? ruins.slice(0, 3).join('; ') : '3 larguras certas', 'tudo certo', ruins.length === 0);
}

// ------------------------------------------------------------------ N4
{
  const REF = '89e53945';  // a tabela antiga (prepartida.js da base 9ce86227)
  let r = 0x9e3779b9 >>> 0;
  const rnd = n => { r ^= r << 13; r >>>= 0; r ^= r >>> 17; r ^= r << 5; r >>>= 0; return r % n; };
  const EXTRA = ['Ł', 'ğ', 'Ş', 'ő', 'ı', 'Ž'];
  let w = '';
  if (LC.larguraCond) for (let i = 0; i < 200; i++) { let t = ''; const n = 1 + rnd(12); for (let k = 0; k < n; k++) t += rnd(20) === 0 ? EXTRA[rnd(EXTRA.length)] : String.fromCharCode(32 + rnd(224)); w += LC.larguraCond(t, [10, 11, 13.7][i % 3], i % 2 === 0).toFixed(6) + ';'; }
  const h = LC.larguraCond ? fnv(w) : `sem o módulo (${LC.erro})`;
  const mesma = !!LC.larguraCond && PP.larguraCond === LC.larguraCond;
  meta('N4 a tabela da TM Cond num módulo só: prepartida.js reexporta a larguraCond do letra-cond.js; 200 textos = a tabela antiga',
    `mesma função ${mesma}; hash ${h}`, `true; ${REF}`, mesma && h === REF);
}

// ------------------------------------------------------------------ N5
{
  const ruins = [], medidas = [];
  // (os nomes lidos logo depois de registrar cada pedido: os elencos do TM de dois pedidos usam os mesmos ids)
  const casos = [];
  const nomesDe = (rot, times) => {
    const porTime = [0, 1].map(t => FORMACOES[times[t].formacao].vagas.map(v => fichaDe(times[t].vagas[v.id])?.camisa).filter(Boolean));
    casos.push([rot, typeof ESC.nomesTitulares === 'function' ? ESC.nomesTitulares(times) : null, porTime]);
  };
  nomesDe('fictício', P.criarPartida({ semente: 3 }).times);
  for (const [rot, ped] of [['TM nomes longos', PED_NOMES_LONGOS], ['TM misto', PED_NOMES_MISTOS]]) {
    try {
      const T = TT.timesDoPedido(ped);
      for (const el of T.elencos) registrarElenco(el);
      nomesDe(rot, P.criarPartida({ semente: 3, elencos: TT.ELENCOS_TM, times: T.times, humano: T.humano }).times);
    } catch (e) { ruins.push(`pedido ${rot}: ${e.message}`); }
  }
  let comPontasDentro = 0;
  for (const [rot, nomes, porTime] of casos) {
    if (!nomes) { ruins.push('nomesTitulares não existe'); break; }
    if (typeof ESC.tamanhosDasFolhas !== 'function') { ruins.push('tamanhosDasFolhas não existe'); break; }
    if (nomes.length !== 22 || nomes.join('|') !== [...porTime[0], ...porTime[1]].join('|')) ruins.push(`${rot}: ${nomes.length} nomes fora da ordem`);
    for (const [nome, vw, vh, sl, sb] of TELAS) {
      const { W, H } = area(vw, vh, sl, sb);
      const ls = porTime.map(ESC.larguraNomes);
      const F = ESC.tamanhosDasFolhas(W, H, { larguras: ls, alturaTela: vh });
      const juntos = ESC.tamanhoEscalacao(W, H, { larguraNome: ESC.larguraNomes(nomes), alturaTela: vh });
      const p = [];
      // a mesma caixa nas duas; a altura a dos 22; a largura nunca menor que a dos 22 e o grupo cabe
      if (!(F[0].w === F[1].w && F[0].h === F[1].h)) p.push(`caixas ${F[0].w}×${F[0].h} × ${F[1].w}×${F[1].h}`);
      if (F[0].h !== juntos.h || F[0].w < juntos.w) p.push(`caixa ${F[0].w}×${F[0].h} × a dos 22 ${juntos.w}×${juntos.h}`);
      for (const t of [0, 1]) {
        const T = F[t], so = ESC.tamanhoEscalacao(W, T.h, { larguraNome: ls[t], alturaTela: vh, caixa: { w: T.w, h: T.h } });
        if (T.cw !== so.cw || T.passo !== so.passo || T.fonteNome !== so.fonteNome) p.push(`folha ${t} ≠ a conta dela na caixa`);
        if (!pontaOk(T)) p.push(`folha ${t}: ponta tangente (borda ${f1(T.inset - T.cw / 2)})`);
        if (!(T.w + 2 * T.fora <= W + 0.5)) p.push(`folha ${t}: grupo ${Math.ceil(T.w + 2 * T.fora)} > ${Math.floor(W)}`);
      }
      // a folha de nomes mais estreitos (na letra da conta) nunca com a carta maior nem com as pontas mais para fora
      const px = Math.min(F[0].fonteNome, F[1].fonteNome);
      const [e, l] = ls[0](px) <= ls[1](px) ? [0, 1] : [1, 0];
      if (F[e].fonteNome === F[l].fonteNome && (F[e].cw > F[l].cw || F[e].inset - F[e].cw / 2 < F[l].inset - F[l].cw / 2 - 1e-9)) p.push(`a folha de nomes estreitos com carta ${F[e].cw} > ${F[l].cw} ou pontas mais para fora`);
      if (rot === 'TM misto' && F[0].inset - F[0].cw / 2 >= 5) comPontasDentro++;
      if (p.length) ruins.push(`${rot} ${nome}: ${p.join('; ')}`);
      if (nome === '844×390' || nome === '568×320') medidas.push(`${rot} ${nome}: ${F[0].w}×${F[0].h}, carta ${F[0].cw}/${F[1].cw}, borda ${f1(F[0].inset - F[0].cw / 2)}/${f1(F[1].inset - F[1].cw / 2)}`);
    }
  }
  meta('N5 as duas folhas: a mesma caixa (a altura dos 22, a largura da maior), as cartas de cada uma pelos nomes dela, pontas nunca tangentes',
    ruins.length ? ruins.slice(0, 3).join(' | ') + (ruins.length > 3 ? ` (+${ruins.length - 3})` : '') : medidas.join('; '),
    'a mesma caixa; a carta e as pontas de cada folha pelos nomes dela; o mandante do misto com as pontas dentro ≥ 8 telas', ruins.length === 0 && casos.length === 3 && comPontasDentro >= 8);
}

let falhas = 0;
for (const r of res) {
  if (!r.ok) falhas++;
  console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome}\n          ${r.medido}   (alvo: ${r.alvo})`);
}
console.log(falhas ? `\nteste-escalacao-campo: REPROVOU (${falhas})` : '\nteste-escalacao-campo: PASSOU');
process.exit(falhas ? 1 : 0);
