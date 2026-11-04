// A TELA ANTES DO JOGO (item 64; dono, 23/10: "quero que fique NESSE NÍVEL" — a pré-partida do EA FC com a cara do TM;
// contrato "Tela antes do jogo (item 64)" no CONTRATOS.md): a parte PURA, js/prepartida.js. Node, padrão (CI).
//   L1 layout — 13 telas (o celular deitado com o entalhe, os regimes compacto e mínimo, o PC 16:9, 16:10, 4:3 e baixo) × 6
//      formações × 2 times × (o elenco fictício | os 11 nomes mais largos do TM, pela tabela de avanços da TM Cond 800) × 3 e 4
//      abas (+ o Livre "10 contra 10" e a fila dos Pênaltis): 0 ficha sobreposta (2 px na vertical, 3 na horizontal), 0 fora do
//      campinho, da tela ou da área segura, os cantos sem encostar nas fichas nem na borda do campinho (V4), a soma das alturas ≤ a altura útil, o nome ≥ 10 px
//      (compacto e mínimo), ≥ 11 (normal e PC baixo), ≥ 13 (PC ≥ 720 de altura); as abas nos alvos do E6
//   L2 Visão tática — 6 formações × sem/com × 17 táticas (as 16 extremas + a padrão) × 13 telas: 0 disco sobreposto (≥ 1 px), o
//      número ≥ 10 px, o afastamento ≤ 4 px
//   L3 info — a ordem do corte (período → "Árb. R. Salgado" → sem árbitro → sem data → o estádio com "…"); a duração nunca sai;
//      só o estádio ganha "…"; os textos da duração de cada modo
//   L4 árbitro — o mesmo nome para a mesma semente e os mesmos elencos; o m.rng e o hashMundo iguais antes e depois de 100
//      dadosDaPartida; ≤ 15% do nome mais comum em 1000 sementes; nenhum igual a um árbitro real (tools/dados/arbitros-reais.txt)
//   L5 recriação — a edição (troca titular ↔ reserva, troca de goleiro, formação e tática) vira a escalação de criarPartida:
//      subs.feitas 0, saiu vazio, pendente null, o reserva na vaga, o goleiro reserva no gol, 600 passos iguais entre duas
//      chamadas; a contraprova (o caminho de hoje, aplicarEdicao no tick 0) deixa pendente e conta substituição na 1ª parada
//   L6 selo — as 135 combinações dão a 1ª regra; os dois elencos fictícios dão "Equilibrada"
//   L7 fecho — prepartida.js sem three.js nem DOM, fora do fecho do hash; o mundo congelado não quebra dadosDaPartida
// Na base (30ce999f) reprova no import (o módulo não existe).
//   node tools/teste-prepartida.mjs [--js <pasta js>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { tabelaTexto } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(AQUI, '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
function fim() {
  console.log(tabelaTexto(linhas));
  console.log(falhas ? `\nteste-prepartida: REPROVOU (${falhas})` : '\nteste-prepartida: PASSOU');
  process.exit(falhas ? 1 : 0);
}

let PP = null;
try { PP = await imp('prepartida.js'); } catch (e) { PP = null; }
if (!PP) {
  reg('a tela antes do jogo (js/prepartida.js)', 'não existe (o começo é a abertura "Toque para começar")', 'existe', false);
  fim();
}
const { FORMACOES, ORDEM_FORMACOES } = await imp('formacoes.js');
const { ELENCOS, fichaDe } = await imp('elenco.js');
const P = await imp('partida.js');
const { hashMundo } = await imp('sim.js');
const ESC = await imp('escalacao.js');
const { criarLivre } = await imp('livre.js');
const { criarDisputa } = await imp('disputa.js');

// ------------------------------------------------------------------------------------------------ telas
const TELAS = [
  [844, 390, { l: 47, r: 47, b: 21 }], [667, 375], [640, 360], [568, 320], [568, 280], [640, 304], [800, 304],
  [1280, 720], [1920, 1080], [1024, 768], [1280, 800], [1366, 600], [1280, 520],
];
const nomeTela = ([w, h, sa]) => `${w}×${h}${sa ? ' (entalhe)' : ''}`;
// os 11 nomes de camisa mais largos do TM (os 15 744 nomes do jogo, em TM Cond 800 caixa alta; proposta FC §3)
const LARGOS = ['Donnarumma', 'Gouweleeuw', 'Wannemacke', 'Chukwuemek', 'Øhlenschlæ', 'Handwerker', 'Makhamadzh', 'Gartenmann', 'Ward-Prows', 'Vanwesemae', 'Mamardashv'];
const FICTICIOS = t => ELENCOS[t === 0 ? 'golaco' : 'ventania'].jogadores.map(j => j.camisa);

/** A caixa desenhada da ficha: a cabeça (rosto + nota) e o nome (até a largura da ficha, com "…"). */
function caixaFicha(L, f, nome) {
  const F = L.ficha;
  const wNome = Math.min(F.largura, PP.larguraCond(nome, F.nome));
  const w = Math.max(F.cabeca, wNome);
  return { x: f.x - w / 2, r: f.x + w / 2, y: f.y - L.hc / 2, b: f.y + L.hc / 2 };
}
const sobrepoe = (a, b, fx, fy) => a.x < b.r + fx - 1e-6 && b.x < a.r + fx - 1e-6 && a.y < b.b + fy - 1e-6 && b.y < a.b + fy - 1e-6;
const letraMin = L => (L.pc ? (L.H >= 720 ? 13 : 11) : L.regime === 'normal' ? 11 : 10);

// ------------------------------------------------------------------------------------------------ L1
{
  let casos = 0;
  const prob = [];
  const cortados = new Set();
  const corteSelo = 'Jogo pelas pontas';
  for (const tela of TELAS) {
    const [W, H, sa = {}] = tela;
    for (const nAbas of [3, 4]) {
      for (const formacao of ORDEM_FORMACOES) {
        for (const lado of [0, 1]) {
          for (const elenco of ['ficticio', 'largos']) {
            for (const variante of ['partida', 'livre', 'disputa']) {
              if (variante !== 'partida' && (formacao !== '4-3-3' || elenco !== 'largos')) continue;
              casos++;
              let vagas = FORMACOES[formacao].vagas;
              if (variante === 'disputa') vagas = [{ id: 'GOL', fila: 0, col: 0 }, ...[-2, -1, 0, 1, 2].map((c, k) => ({ id: `C${k}`, fila: 3, col: c }))];
              const L = PP.layoutPrepartida(W, H, sa, formacao, nAbas, { vagas, canto: variante !== 'partida' });
              const nomes = elenco === 'ficticio' ? FICTICIOS(lado) : LARGOS;
              const cx = L.fichas.map((f, i) => caixaFicha(L, f, nomes[i % nomes.length]));
              const tag = `${nomeTela(tela)} ${formacao} ${variante} ${elenco} ${nAbas} abas`;
              // fichas sem encostar
              for (let i = 0; i < cx.length; i++) for (let j = i + 1; j < cx.length; j++) if (sobrepoe(cx[i], cx[j], 3, 2)) prob.push(`${tag}: ${L.fichas[i].vaga} × ${L.fichas[j].vaga}`);
              // dentro do campinho, da tela e da área segura
              const C = L.campo;
              for (let i = 0; i < cx.length; i++) {
                const b = cx[i], f = L.fichas[i], wF = L.ficha.largura;
                if (b.y < C.top - 0.5 || b.b > C.top + C.h + 0.5) prob.push(`${tag}: ${f.vaga} fora do campinho (y ${b.y.toFixed(0)}–${b.b.toFixed(0)})`);
                if (f.x - wF / 2 < L.sa.l + 2 || f.x + wF / 2 > W - L.sa.r - 2) prob.push(`${tag}: ${f.vaga} fora da área segura`);
              }
              // os cantos de baixo (a formação ou o "N contra M" e o selo; o geral e as estrelas)
              const K = L.cantos;
              const txt = variante === 'livre' ? '10 contra 10' : variante === 'disputa' ? '' : formacao;
              const wE = Math.max(PP.larguraCond(txt, K.forma), PP.larguraInter(corteSelo, K.selo, 800) + K.selo + 6);
              const wD = Math.max(PP.larguraCond('GERAL 99', K.forma), K.selo * 5.2);
              const cantos = variante === 'disputa' ? [] : [{ x: K.esq.x, r: K.esq.x + wE, y: K.y, b: K.y + K.h }, { x: K.dir.x - wD, r: K.dir.x, y: K.y, b: K.y + K.h }];
              for (const [n, k] of cantos.entries()) {
                if (k.b > C.top + C.h + 0.5) prob.push(`${tag}: canto passa do campinho (${k.b.toFixed(0)} > ${(C.top + C.h).toFixed(0)})`);
                for (let i = 0; i < cx.length; i++) if (sobrepoe(k, cx[i], 3, 1)) prob.push(`${tag}: canto × ${L.fichas[i].vaga}`);
                // dentro do trapézio no ALTO do bloco (a borda inclinada não atravessa o texto; revisão V4)
                const meia = (C.T + (C.B - C.T) * (k.y - C.top) / C.h) / 2;
                if (n === 0 ? k.x < C.cx - meia + 2 - 0.01 : k.r > C.cx + meia - 2 + 0.01) prob.push(`${tag}: canto ${n ? 'direito' : 'esquerdo'} × a borda do campinho (${(n === 0 ? C.cx - meia + 2 - k.x : k.r - C.cx - meia + 2).toFixed(1)} px)`);
              }
              // a ordem das faixas e a altura útil
              const yInfoFim = L.info.y + L.info.h;
              if (L.barra.y < L.sa.t - 0.5) prob.push(`${tag}: barra acima da área segura`);
              if (L.barra.y + L.barra.h > L.info.y + 0.5) prob.push(`${tag}: barra × info`);
              if (yInfoFim > C.top + 0.5) prob.push(`${tag}: info × campinho`);
              if (C.top + C.h > L.abas.y + 0.5) prob.push(`${tag}: campinho × abas`);
              if (L.abas.y + L.abas.h > H - L.sa.b + 0.5) prob.push(`${tag}: abas passam da altura útil`);
              if (L.cmd && L.cmd.y + L.cmd.letra * 1.5 > H) prob.push(`${tag}: linha dos comandos passa da tela`);
              if (L.abas.x < L.sa.l || L.abas.x + L.abas.w > W - L.sa.r + 0.5) prob.push(`${tag}: abas fora da área segura`);
              // o ≡ e o canto [<] sem encostar na barra (a barra centrada pela conta da tela: a largura dos dois lados)
              // a letra
              if (L.ficha.nome < letraMin(L)) prob.push(`${tag}: nome ${L.ficha.nome} px < ${letraMin(L)}`);
              // alvos (E6)
              const aw = L.abas.larguraAba, ah = L.abas.h;
              if (!L.pc && L.regime !== 'minimo' && L.regime !== 'emergencia') {
                const min = W <= 568 ? (nAbas === 4 ? [131, 40] : [177, 40]) : [nAbas === 4 ? 131 : 200, 44];
                if (aw < min[0] - 0.5 || ah < min[1]) prob.push(`${tag}: aba ${aw.toFixed(0)}×${ah} < ${min[0]}×${min[1]}`);
              }
              for (let i = 0; i < L.fichas.length; i++) if (PP.larguraCond(nomes[i % nomes.length], L.ficha.nome) > L.ficha.largura + 0.5) cortados.add(`${nomes[i % nomes.length]}@${L.ficha.nome}px`);
            }
          }
        }
      }
    }
  }
  reg('L1 layout: 13 telas × 6 formações × 2 times × 2 elencos × 3/4 abas (+ Livre e Pênaltis)', prob.length ? `${prob.length} problemas: ${prob.slice(0, 4).join(' · ')}` : `0 problemas em ${casos} casos`, '0 sobreposta, 0 fora, letra no mínimo', prob.length === 0);
  // a medida que a maquete deu (844×390, 4-3-3): fileira 47, rosto 30, nota 15, nome 11, ficha 57; PC 1280×720: 63 / 41 / 21 / 15 / 78
  const a = PP.layoutPrepartida(844, 390, { l: 47, r: 47, b: 21 }, '4-3-3', 3), b = PP.layoutPrepartida(1280, 720, {}, '4-3-3', 3), c = PP.layoutPrepartida(568, 320, {}, '4-3-3', 3);
  const med = L => `${L.hc}/${L.ficha.rosto}/${L.ficha.nota}/${L.ficha.nome}/${L.ficha.largura}`;
  reg('L1 as medidas da maquete (fileira/rosto/nota/nome/ficha)', `844×390 ${med(a)} · 568×320 ${med(c)} · 1280×720 ${med(b)}`, '47/30/15/11/57 · 41/25/13/10/52 · 63/41/21/15/78',
    med(a) === '47/30/15/11/57' && med(c) === '41/25/13/10/52' && med(b) === '63/41/21/15/78');
  reg('L1 nomes com "…" (informativo: a ficha corta só o que passa)', `${cortados.size} (nome@letra): ${[...cortados].slice(0, 6).join(', ') || '—'}`, 'informativo', true);
}

// ------------------------------------------------------------------------------------------------ L2
{
  const taticas = [{ ...{ mentalidade: 0, pressao: 1, largura: 1, linha: 1 } }];
  for (const me of [-2, 2]) for (const pr of [0, 2]) for (const la of [0, 2]) for (const li of [0, 2]) taticas.push({ mentalidade: me, pressao: pr, largura: la, linha: li });
  let casos = 0, maxAf = 0, minLetra = Infinity, minD = Infinity;
  const prob = [];
  for (const tela of TELAS) {
    const [W, H, sa = {}] = tela;
    for (const formacao of ORDEM_FORMACOES) {
      const L = PP.layoutPrepartida(W, H, sa, formacao, 3);
      for (const fase of ['sem', 'com']) for (const t of taticas) {
        casos++;
        const V = PP.layoutVisao(L, PP.pontosVisao(formacao, t, fase));
        maxAf = Math.max(maxAf, V.afastamento); minLetra = Math.min(minLetra, V.letra); minD = Math.min(minD, V.d);
        for (let i = 0; i < V.discos.length; i++) for (let j = i + 1; j < V.discos.length; j++) {
          const a = V.discos[i], b = V.discos[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < V.d + 1 - 1e-3) { prob.push(`${nomeTela(tela)} ${formacao} ${fase} ${JSON.stringify(t)}: ${a.vaga}×${b.vaga} (${Math.hypot(a.x - b.x, a.y - b.y).toFixed(1)} px < ${V.d + 1})`); }
        }
        for (const q of V.discos) if (q.y - V.d / 2 < L.campo.top - 2 || q.y + V.d / 2 > L.campo.top + L.campo.h + 2) prob.push(`${nomeTela(tela)} ${formacao} ${fase}: ${q.vaga} fora do campinho`);
      }
    }
  }
  reg('L2 Visão tática: 13 telas × 6 formações × sem/com × 17 táticas', prob.length ? `${prob.length} de ${casos}: ${prob.slice(0, 3).join(' · ')}` : `0 sobrepostos em ${casos} casos; disco ≥ ${minD} px, número ≥ ${minLetra} px, afastamento ≤ ${maxAf.toFixed(1)} px`,
    '0 sobreposto (≥ 1 px), número ≥ 10, afastamento ≤ 4', prob.length === 0 && minLetra >= 10 && maxAf <= 4 + 1e-6);
}

// ------------------------------------------------------------------------------------------------ L3
{
  const medir = t => PP.larguraInter(t, 12);
  const campos = { estadio: 'Estádio Municipal Doutor Paulo Machado de Carvalho', data: '4 nov. 2026', arbitro: 'Ricardo Salgado', duracao: '2 × 4 min', periodo: 'Noite' };
  const passos = [];
  for (const w of [900, 560, 470, 420, 380, 330, 260, 200]) passos.push([w, PP.linhaInfo(campos, w, medir)]);
  const ordem = ['periodo', 'arbitroCurto', 'arbitro', 'data', 'estadio'];
  let ok = true;
  const det = [];
  for (const [w, r] of passos) {
    // os cortes são um prefixo da ordem; a duração está; o "…" só no estádio; nada passa da linha (com o estádio cortado, até 40%)
    const pref = ordem.slice(0, r.cortes.length).join() === r.cortes.join();
    const l = r.linhas[0];
    const temDur = l.includes('2 × 4 min');
    const reticencias = l.filter(p => p.endsWith('…'));
    const so = reticencias.every(p => p.startsWith('Estádio'));
    const largura = l.reduce((s, p) => s + medir(p), 0) + (l.length - 1) * medir(PP.SEP_INFO);
    if (!pref || !temDur || !so || largura > Math.max(w, 0) + 0.5 && !r.estadioCortado) ok = false;
    det.push(`${w}: ${r.cortes.join('>') || '—'}`);
  }
  // o "Árb. R. Salgado"
  const curto = PP.linhaInfo(campos, 420, medir).linhas[0].find(p => p.startsWith('Árb.'));
  reg('L3 info: a ordem do corte, a duração sempre, "…" só no estádio', det.join(' · ') + (curto ? ` · "${curto}"` : ''), 'período → árbitro curto → sem árbitro → sem data → estádio …', ok);
  // PC em 2 linhas: o período mora na 2ª e não sai pelo estádio longo
  const pc = PP.linhaInfo(campos, 420, medir, 2);
  reg('L3 info no PC (2 linhas): o período fica na 2ª', `${pc.linhas.map(l => l.join(' | ')).join(' / ')}`, '2ª linha com a duração e o período', pc.linhas.length === 2 && pc.linhas[1].includes('Noite') && pc.linhas[1].includes('2 × 4 min'));
  // o separador como a tela o DESENHA (a barra + 0,45 em de cada lado; revisão A3): com a largura dele a linha cabe — nos Pênaltis e
  // no clássico do TM com o estádio longo (a conta com ' | ' achava a linha 3–4 px por separador mais estreita e o CSS cortava a
  // duração do fim). Na HEAD antes da correção o 5º argumento não existia e as linhas passavam.
  {
    const letra = 11, med = t => PP.larguraInter(t, letra), sepW = med('|') + 0.9 * letra;
    const real = l => l.reduce((s, p) => s + med(p), 0) + Math.max(0, l.length - 1) * sepW;
    const casosA3 = [
      ['Pênaltis', { estadio: 'Estádio Golaço', data: '4 nov. 2026', arbitro: 'Patrícia Vasconcelos', duracao: '5 cobranças · Começa: VNT', periodo: 'Noite' }],
      ['clássico do TM', { estadio: 'Clássico · Clássico das Multidões · Estadio Municipal El Molinón – Enrique Castro "Quini"', data: '8 nov. 2026', arbitro: 'Fábio Antunes Leal', duracao: '2 × 4 min', periodo: 'Dia' }],
    ];
    let passa = 0, total = 0, pior = '';
    for (const [nome, c] of casosA3) for (let w = 360; w <= 720; w += 4) {
      const r = PP.linhaInfo(c, w, med, 1, sepW);
      const lw = real(r.linhas[0]);
      total++;
      if (lw <= w + 0.5 && r.linhas[0].includes(c.duracao)) passa++; else if (!pior) pior = `${nome} em ${w} px: ${lw.toFixed(1)} px`;
    }
    reg('L3 info com o separador desenhado (| + 0,9 em): a linha cabe e a duração fica (Pênaltis e o clássico do TM, 360–720 px: a linha do celular tem ≥ 464)', `${passa}/${total}${pior ? `; 1º que passa: ${pior}` : ''}`, `${total}/${total}`, passa === total);
  }
  // os textos de cada modo
  const mP = P.criarPartida({ semente: 3, minutosPorTempo: 4 });
  const mL = criarLivre({ semente: 3, linha: [6, 4], goleiro: [true, false] });
  const mD = criarDisputa({ semente: 3 });
  const dP = PP.dadosDaPartida(mP, { hora: 'noite' }), dL = PP.dadosDaPartida(mL, {}), dD = PP.dadosDaPartida(mD, {});
  const sig = dD.times[mD.disputa.primeiro].sigla;
  reg('L3 textos por modo (duração, árbitro, N contra M, fila dos pênaltis)',
    `partida "${dP.duracao.longa}", árbitro ${dP.arbitro}; Livre "${dL.duracao.longa}", árbitro ${dL.arbitro ?? '—'}, "${dL.times[0].texto}"; pênaltis "${dD.duracao.longa}", fila ${dD.disputa.fila[0].cobradores.length} + goleiro`,
    '2 tempos de 4 min; Livre sem árbitro "7 contra 4"; 5 cobradores', dP.duracao.longa === '2 tempos de 4 min' && !!dP.arbitro && dL.arbitro === null && dL.times[0].texto === '7 contra 4'
      && dD.duracao.longa === `5 cobranças alternadas · Começa: ${sig}` && dD.disputa.fila[0].cobradores.length === 5 && dD.disputa.fila[0].goleiro != null);
  const dMin = PP.dadosDaPartida(P.criarPartida({ semente: 3, minutosPorTempo: 0.5 }), {});
  reg('L3 a duração respeita o ?min= (0,5 min)', dMin.duracao.longa, '2 tempos de 0,5 min', dMin.duracao.longa === '2 tempos de 0,5 min');
  // o clássico sem repetir a palavra (os nomes do TM já começam com "Clássico": revisão V10)
  {
    const casos = [['Clássico Mineiro', 'Clássico Mineiro'], ['Clássico San-São', 'Clássico San-São'], ['clássico vovô', 'clássico vovô'], ['Choque-Rei', 'Clássico · Choque-Rei'], ['Clássico', 'Clássico'], [null, 'Clássico'], ['Classicos do Sul', 'Clássico · Classicos do Sul']];
    const f = typeof PP.textoClassico === 'function' ? PP.textoClassico : null;
    const out = casos.map(([c, quer]) => { const v = f ? f(c) : '(sem textoClassico)'; return { c, v, ok: v === quer }; });
    reg('L3 o clássico sem repetir "Clássico" (Clássico Mineiro, San-São, Vovô; Choque-Rei com o prefixo)', out.map(o => `${o.c ?? '—'} → "${o.v}"`).join(' · '), 'o nome do TM como veio; o prefixo só quando falta', out.every(o => o.ok));
  }
  const dt = PP.textoData(new Date(2026, 10, 4)), dt2 = PP.textoData('2026-03-01');
  reg('L3 a data', `${dt?.curta} / ${dt?.longa} · ${dt2?.curta}`, '4 nov. 2026 / 4 de novembro de 2026 · 1 mar. 2026', dt?.curta === '4 nov. 2026' && dt?.longa === '4 de novembro de 2026' && dt2?.curta === '1 mar. 2026');
}

// ------------------------------------------------------------------------------------------------ L4
{
  const a1 = PP.arbitroDe(77, ['golaco', 'ventania']), a2 = PP.arbitroDe(77, ['golaco', 'ventania']);
  const m = P.criarPartida({ semente: 77 });
  const h0 = hashMundo(m), rng0 = JSON.stringify(m.rng ?? null);
  for (let i = 0; i < 100; i++) PP.dadosDaPartida(m, { hora: 'noite' });
  const h1 = hashMundo(m), rng1 = JSON.stringify(m.rng ?? null);
  const cont = new Map();
  for (let s = 1; s <= 1000; s++) { const n = PP.arbitroDe(s, ['golaco', 'ventania']); cont.set(n, (cont.get(n) ?? 0) + 1); }
  const maisComum = Math.max(...cont.values()) / 1000;
  const norm = t => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z ]/g, '').trim();
  const reais = fs.readFileSync(path.join(AQUI, 'dados', 'arbitros-reais.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const reaisN = new Set(reais.map(norm));
  const pontas = t => { const p = norm(t).split(/\s+/); return `${p[0]} ${p[p.length - 1]}`; };
  const reaisP = new Set(reais.map(pontas));
  const iguais = PP.ARBITROS.filter(n => reaisN.has(norm(n)) || reaisP.has(pontas(n)));
  reg('L4 árbitro: determinístico e puro (m.rng e o hash iguais depois de 100 dadosDaPartida)', `${a1} = ${a2}; hash ${h0 === h1 ? 'igual' : 'MUDOU'}; rng ${rng0 === rng1 ? 'igual' : 'MUDOU'}`, 'iguais', a1 === a2 && h0 === h1 && rng0 === rng1);
  reg('L4 árbitro: espalhado e fictício', `o mais comum em ${(maisComum * 100).toFixed(1)}% de 1000 sementes; ${PP.ARBITROS.length} nomes; iguais a reais (${reais.length} da CBF/FIFA 2026): ${iguais.join(', ') || 'nenhum'}`, '≤ 15%; nenhum real', maisComum <= 0.15 && iguais.length === 0 && PP.ARBITROS.length === 32);
}

// ------------------------------------------------------------------------------------------------ L5
{
  // a edição como a tela faz (escalacao.js: dois toques): 9 → 22 (titular ↔ reserva), 1 → 12 (o goleiro), 4-4-2 e pressão alta
  const m0 = P.criarPartida({ semente: 5 });
  let r = ESC.rascunhoDe(structuredClone(m0.times[0]), null, 0);
  for (const id of [9, 22, 1, 12]) r = ESC.tocar(r, id).rasc;
  r = ESC.mudarFormacao(r, '4-4-2');
  r = ESC.mudarTatica(r, 'pressao', 2);
  const ed = ESC.edicaoDe(r);
  const val = ESC.validarEdicao(m0.times[0], ed, 'golaco');
  const e = PP.edicaoParaTimes(ed);
  const rodar = () => {
    const m = P.criarPartida({ semente: 5, times: { 0: e } });
    const t = m.times[0];
    const ini = { feitas: t.subs.feitas, saiu: t.saiu.length, pendente: t.pendente, em22: m.jogadores.some(j => j.id === 22), em9: m.jogadores.some(j => j.id === 9), gol: t.vagas.GOL, forma: t.formacao, pressao: t.tatica.pressao };
    for (let i = 0; i < 600; i++) P.passoPartida(m, P.entradaDemoPartida(m), null);
    return { ini, h: hashMundo(m) };
  };
  const a = rodar(), b = rodar();
  const okIni = a.ini.feitas === 0 && a.ini.saiu === 0 && a.ini.pendente === null && a.ini.em22 && !a.ini.em9 && a.ini.gol === 12 && a.ini.forma === '4-4-2' && a.ini.pressao === 2;
  reg('L5 recriação: a edição antes do jogo vira a ESCALAÇÃO (sem substituição)', `válida ${val.ok}; feitas ${a.ini.feitas}, saiu ${a.ini.saiu}, pendente ${a.ini.pendente}, 22 em campo ${a.ini.em22}, 9 em campo ${a.ini.em9}, gol ${a.ini.gol}, ${a.ini.forma}, pressão ${a.ini.pressao}; 600 passos ${a.h === b.h ? 'iguais' : 'DIFERENTES'}`,
    'feitas 0, saiu 0, pendente null, 22 na vaga, 12 no gol, 600 passos iguais', val.ok && okIni && a.h === b.h);
  // a contraprova: o caminho do Editar time na pausa (a edição no 1º passo) deixa a troca pendente e conta substituição
  const m = P.criarPartida({ semente: 5 });
  P.passoPartida(m, P.entradaDemoPartida(m), [ed]);
  const pend = m.times[0].pendente != null || m.times[0].subs.feitas > 0;
  let n = 0;
  while (n < 9000 && m.times[0].subs.feitas === 0) { P.passoPartida(m, P.entradaDemoPartida(m), null); n++; }
  reg('L5 contraprova: o caminho da pausa (aplicarEdicao no tick 0) vira substituição', `pendente ou contada no 1º passo: ${pend}; substituições feitas ${m.times[0].subs.feitas} (passo ${n + 1}), saiu [${m.times[0].saiu}]`, 'conta substituição (por isso a tela recria o mundo)', pend && m.times[0].subs.feitas >= 1);
}

// ------------------------------------------------------------------------------------------------ L6
{
  const regra = t => (t.pressao === 2 ? 'pressaoAlta' : t.mentalidade <= -1 && t.linha === 0 ? 'retranca' : t.mentalidade <= -1 ? 'contra' : t.largura === 2 ? 'pontas' : t.mentalidade >= 1 ? 'ofensiva' : t.largura === 0 ? 'dentro' : 'equilibrada');
  let n = 0, err = [];
  for (let me = -2; me <= 2; me++) for (let pr = 0; pr <= 2; pr++) for (let la = 0; la <= 2; la++) for (let li = 0; li <= 2; li++) {
    n++;
    const t = { mentalidade: me, pressao: pr, largura: la, linha: li };
    const s = PP.seloTatica(t);
    if (s.id !== regra(t) || s.nome !== PP.SELOS[s.id]) err.push(JSON.stringify(t));
  }
  const fic = ['golaco', 'ventania'].map(k => PP.seloTatica(ELENCOS[k].taticaPadrao).nome);
  reg('L6 selo da tática: as 135 combinações e os dois elencos fictícios', `${n - err.length}/${n} pela 1ª regra; ${fic.join(', ')}`, '135/135; Equilibrada, Equilibrada', err.length === 0 && n === 135 && fic.every(x => x === 'Equilibrada'));
}

// ------------------------------------------------------------------------------------------------ L7
{
  const src = fs.readFileSync(path.join(pastaJs, 'prepartida.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\/\/[^\n]*/g, '');
  const proibido = ["from 'three'", 'document.', 'window.', 'navigator.', 'Math.random', 'performance.now'].filter(p => src.includes(p));
  let noFecho = [];
  try {
    const out = execFileSync(process.execPath, [path.join(AQUI, 'fecho-hash.mjs')], { encoding: 'utf8' });
    noFecho = out.split('\n').map(l => l.trim()).filter(l => /prepartida/.test(l));
  } catch (e) { noFecho = ['(fecho-hash falhou: ' + e.message + ')']; }
  // o mundo congelado (Object.freeze profundo): dadosDaPartida só lê
  const congelar = o => { if (o && typeof o === 'object' && !Object.isFrozen(o)) { Object.freeze(o); for (const k of Object.keys(o)) congelar(o[k]); } return o; };
  let erro = null;
  try {
    for (const m of [P.criarPartida({ semente: 9 }), criarLivre({ semente: 9, linha: [3, 3], goleiro: [true, true] }), criarDisputa({ semente: 9 })]) PP.dadosDaPartida(congelar(m), { hora: 'dia', trava: 7 });
  } catch (e) { erro = e.message; }
  reg('L7 fecho: prepartida.js sem three.js nem DOM, fora do fecho do hash, só lê o mundo', `proibidos: ${proibido.join(', ') || 'nenhum'}; no fecho: ${noFecho.join(', ') || 'nenhum'}; mundo congelado: ${erro ?? 'ok'}`, 'nenhum, nenhum, ok', !proibido.length && !noFecho.length && !erro);
}

fim();
