// O ritmo dos desenhos (item 45, `golaco/PLANO-GRAFICOS.md` passo 7; js/render/ritmo-desenho.js, puro), sem navegador — a decisão
// da QUEDA automática da qualidade (C12; o teto de quadros do C13 entra aqui depois):
//  R1 rAF a 30 "regular" (o iPhone em pouca energia, o economizador do Android: 33,3 ms ± 0,5 com 1 quadro perdido a cada 20,
//     ~28,6 qps) na Média: CAI na sessão (como antes: o limiar é qps < 30) e NÃO grava — o ritmo está preso no divisor da tela
//     com pouco tremor (a mediana a ± 1 ms de 33,3 e p90 − p10 ≤ 2 ms); o 30 exato (1000/30 em ponto flutuante dá 29,999… qps)
//     cai como antes e também não grava
//  R2 25 qps com tremor (40 ms × 0,6 1,4 1,0 0,8 1,2) em duas janelas: CAI na 1ª (Média → Baixa) e GRAVA na 2ª ({media, baixa})
//  R3 uma janela só lenta (depois 60 qps): cai e NÃO grava
//  R4 com webdriver (podeGravar false; o main.js passa false com navigator.webdriver, ?prints=1 e ?demo=1): o R2 e o 20 Hz com o
//     tremor do teste-graficos-pagina Q por 20 s caem e NUNCA gravam
//  R5 o PC: 40 qps com tremor na Alta cai para a Média (40 < 48) e grava {alta, media} na 2ª janela; depois, na Média (40 ≥ 30),
//     nada
//  R6 uma janela inativa entre a queda e a seguinte (a pausa, a aba escondida, a troca na pausa) desfaz o "seguidas": não grava;
//     marcarTroca() segura a queda por 4 s e desfaz o "seguidas"; reiniciar() espera 3 s
//  R7 o 20 Hz preso (50 ms ± 0,4) cai e não grava; o mesmo 20 Hz com o tremor da seção Q (50 ms × 0,6–1,4) não está preso: grava
//  R8 a sessão = a regra de ANTES do item 45 (o main.js adaptarQualidade da main, copiada aqui como oráculo): 8 sequências
//     sorteadas (ritmos de 12 a 75 qps, com e sem tremor, pausas, recomeços) dão as MESMAS quedas, no mesmo quadro e para o mesmo
//     nível
//  R9 as contas: resumoJanela (mediana, p10, p90, preso em 33,3 e 50, não preso em 40 ou com tremor), quedaValida (só {de, para}
//     de cima para baixo), nivelInicial (a gravada mais baixa que a do aparelho vale; nunca sobe; lixo = a do aparelho)
//  R10 pureza: o módulo sem import, DOM, three nem relógio próprio e fora do fecho do hash
// Sem o módulo REPROVA.
//   node tools/teste-ritmo-desenho.mjs [--js <pasta js>]   (--js: mede outra cópia, ex.: a base)
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ia = process.argv.indexOf('--js');
const JS = ia > 0 ? path.resolve(process.argv[ia + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const ARQ = path.join(JS, 'render', 'ritmo-desenho.js');
let M = null, erroImport = null;
try { M = await import(pathToFileURL(ARQ).href); } catch (e) { erroImport = e.code ?? e.message.split('\n')[0]; }

const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('.', ',') : String(v));
const J = o => JSON.stringify(o);
// sorteio determinístico (mulberry32)
function rng(s) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * A regra de ANTES do item 45 (o main.js adaptarQualidade da main e41aa791, o oráculo da sessão): "cai um nível se ficar abaixo de
 * ~48 qps (alta) ou ~30 qps (média)", depois de 3 s, janelas de 2,5 s, uma queda a cada 4 s. Devolve o nível novo ou null.
 */
function regraAntiga() {
  const adapt = { n: 0, soma: 0, ultimaTroca: 0, inicio: 0 };
  return {
    reiniciar(t) { adapt.inicio = t; adapt.n = 0; adapt.soma = 0; },
    quadro(dt, agora, qAtual, ativo) {
      if (!ativo) { adapt.n = 0; adapt.soma = 0; return null; }
      if (agora - adapt.inicio < 3000) return null;
      adapt.n++; adapt.soma += dt;
      if (adapt.soma < 2.5) return null;
      const qps = adapt.n / adapt.soma;
      adapt.n = 0; adapt.soma = 0;
      if (agora - adapt.ultimaTroca < 4000) return null;
      const minimo = qAtual === 'alta' ? 48 : qAtual === 'media' ? 30 : 0;
      if (qps < minimo) { adapt.ultimaTroca = agora; return qAtual === 'alta' ? 'media' : 'baixa'; }
      return null;
    },
  };
}

/**
 * Roda uma sequência de intervalos (ms) pelo criarQueda: o nível segue as quedas (o main.js troca o qAtual), `ativo(k)` diz se o
 * quadro k conta. Devolve as quedas e as gravações com o quadro e o instante (s).
 */
function rodar(ivsMs, { nivel = 'media', podeGravar = true, ativo = () => true, inicio = 1000, eventos = {} } = {}) {
  const q = M.criarQueda({ podeGravar });
  q.reiniciar(inicio);
  let t = inicio, nv = nivel;
  const quedas = [], gravadas = [], janelas = [];
  for (let k = 0; k < ivsMs.length; k++) {
    t += ivsMs[k];
    eventos[k]?.(q, t);
    const r = q.quadro(ivsMs[k] / 1000, t, nv, ativo(k));
    if (r?.cai) { quedas.push({ k, s: (t - inicio) / 1000, ...r.cai }); nv = r.cai.para; }
    if (r?.grava) gravadas.push({ k, s: (t - inicio) / 1000, ...r.grava });
    if (r?.janela) janelas.push(r.janela);
  }
  return { quedas, gravadas, janelas, nivel: nv, estado: q.estado() };
}
/** Intervalos de `ms` por `s` segundos, com o padrão de tremor (multiplicativo) e/ou um quadro perdido (× 2) a cada `perde`. */
function serie(ms, s, { tremor = null, soma = null, perde = 0 } = {}) {
  const out = [];
  let t = 0, k = 0;
  while (t < s * 1000) {
    let v = ms * (tremor ? tremor[k % tremor.length] : 1) + (soma ? soma[k % soma.length] : 0);
    if (perde && k % perde === perde - 1) v *= 2;
    out.push(v); t += v; k++;
  }
  return out;
}
const TREMOR_Q = [0.6, 1.4, 1.0, 0.8, 1.2];   // o do rAF falso do teste-graficos-pagina (seções T e Q)
const resumoQ = r => `quedas ${r.quedas.map(x => `${x.de}→${x.para} em ${f(x.s, 1)} s`).join(', ') || 'nenhuma'} · gravou ${r.gravadas.map(x => `${x.de}→${x.para} em ${f(x.s, 1)} s`).join(', ') || 'nada'}`;

if (!M) {
  for (const n of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10']) meta(`${n} (o módulo js/render/ritmo-desenho.js)`, `não existe (${erroImport})`, 'o módulo', false);
} else {
  const { criarQueda, resumoJanela, quedaValida, nivelInicial, QUEDA } = M;

  // ---------------------------------------------------------------- R1: o 30 "regular" cai e não grava
  {
    const ivs = serie(1000 / 30, 12, { soma: [0.3, -0.3, 0.5, -0.5, 0], perde: 20 });
    const r = rodar(ivs);
    const j = r.janelas[0] ?? {};
    meta('R1 rAF a 30 "regular" (33,3 ms ± 0,5, 1 perdido em 20) na Média: cai na sessão, NÃO grava (ritmo preso no divisor)',
      `${resumoQ(r)} · 1ª janela ${f(j.qps, 1)} qps, mediana ${f(j.mediana, 2)} ms, p90 − p10 ${f(j.tremor, 2)} ms, presa ${j.presa}`,
      'media → baixa; nada gravado; presa', r.quedas.length === 1 && r.quedas[0].para === 'baixa' && r.gravadas.length === 0 && j.presa === true);
    // (o 30 "exato": 1000/30 em ponto flutuante soma 29,999… qps na janela — abaixo do limiar de < 30: cai, como antes, o N9 do
    // plano; e não grava)
    const ex = rodar(serie(1000 / 30, 12));
    const exA = (() => { const o = regraAntiga(); o.reiniciar(1000); let t = 1000, nv = 'media'; const qs = []; for (const v of serie(1000 / 30, 12)) { t += v; const d = o.quadro(v / 1000, t, nv, true); if (d) { qs.push(`${nv}→${d}`); nv = d; } } return qs; })();
    meta('R1 o 30 exato (1000/30 ms): cai como antes (29,999… qps < 30) e NÃO grava (preso)', `${resumoQ(ex)} · a regra de antes: ${exA.join(', ') || 'nenhuma'}`, 'as mesmas quedas; nada gravado',
      J(ex.quedas.map(x => `${x.de}→${x.para}`)) === J(exA) && ex.gravadas.length === 0 && ex.janelas[0]?.presa === true);
  }

  // ---------------------------------------------------------------- R2: 25 qps com tremor em duas janelas: cai e grava
  let r2 = null;
  {
    r2 = rodar(serie(40, 12, { tremor: TREMOR_Q }));
    const j = r2.janelas[0] ?? {};
    meta('R2 25 qps com tremor (40 ms × 0,6–1,4) em duas janelas: cai na 1ª e GRAVA na 2ª',
      `${resumoQ(r2)} · 1ª janela ${f(j.qps, 1)} qps, mediana ${f(j.mediana, 1)} ms, presa ${j.presa}`,
      'media → baixa (~5,5 s); gravada {media, baixa} (~8 s)',
      r2.quedas.length === 1 && r2.quedas[0].de === 'media' && r2.quedas[0].para === 'baixa' && r2.gravadas.length === 1 && r2.gravadas[0].de === 'media' && r2.gravadas[0].para === 'baixa'
        && r2.gravadas[0].k > r2.quedas[0].k && r2.quedas[0].s >= 5.4 && r2.quedas[0].s <= 5.7 && r2.gravadas[0].s >= 7.9 && r2.gravadas[0].s <= 8.3);
  }

  // ---------------------------------------------------------------- R3: uma janela só
  {
    const a = serie(40, 5.6, { tremor: TREMOR_Q });
    const r = rodar([...a, ...serie(1000 / 60, 10)]);
    meta('R3 uma janela só lenta (25 qps com tremor; depois 60 qps): cai, NÃO grava', resumoQ(r), 'media → baixa; nada gravado', r.quedas.length === 1 && r.gravadas.length === 0 && r.estado.pendente === null);
  }

  // ---------------------------------------------------------------- R4: com webdriver, nunca grava
  {
    const r = rodar(serie(40, 12, { tremor: TREMOR_Q }), { podeGravar: false });
    const q = rodar(serie(50, 20, { tremor: TREMOR_Q }), { podeGravar: false });
    meta('R4 com webdriver (podeGravar false): o R2 e o 20 Hz com o tremor da seção Q por 20 s caem e NUNCA gravam', `R2: ${resumoQ(r)} · 20 Hz: ${resumoQ(q)}`,
      'cai nos dois; nada gravado', r.quedas.length === 1 && q.quedas.length === 1 && r.gravadas.length === 0 && q.gravadas.length === 0 && r.estado.podeGravar === false);
  }

  // ---------------------------------------------------------------- R5: o PC (Alta → Média)
  {
    const r = rodar(serie(25, 20, { tremor: TREMOR_Q }), { nivel: 'alta' });
    meta('R5 o PC: 40 qps com tremor na Alta cai para a Média e grava {alta, media}; na Média (40 ≥ 30) nada mais', resumoQ(r),
      'alta → media; gravada {alta, media}; nada depois',
      r.quedas.length === 1 && r.quedas[0].de === 'alta' && r.quedas[0].para === 'media' && r.gravadas.length === 1 && r.gravadas[0].de === 'alta' && r.nivel === 'media');
  }

  // ---------------------------------------------------------------- R6: inativo no meio, marcarTroca, reiniciar
  {
    const ivs = serie(40, 12, { tremor: TREMOR_Q });
    const kQueda = r2.quedas[0].k;
    const r = rodar(ivs, { ativo: k => k !== kQueda + 10 });
    meta('R6 um quadro inativo entre a queda e a janela seguinte (a pausa): não grava', resumoQ(r), 'cai; nada gravado', r.quedas.length === 1 && r.gravadas.length === 0);
    // marcarTroca 1 s antes da queda do R2: nenhuma queda por 4 s (a janela recomeça e a queda vem depois)
    const kTroca = kQueda - 25;
    const m = rodar(ivs, { eventos: { [kTroca]: (q, t) => q.marcarTroca(t) } });
    const tTroca = ivs.slice(0, kTroca + 1).reduce((a, b) => a + b, 0) / 1000;
    meta('R6 marcarTroca() (a escolha na pausa): nenhuma queda por 4 s depois dela', `troca em ${f(tTroca, 1)} s · ${resumoQ(m)}`, 'a queda ≥ 4 s depois da troca',
      m.quedas.length >= 1 && m.quedas[0].s - tTroca >= 4 - 1e-9);
    // marcarTroca entre a queda e a seguinte: desfaz o "seguidas"
    const d = rodar(ivs, { eventos: { [kQueda + 10]: (q, t) => q.marcarTroca(t) } });
    meta('R6 marcarTroca() entre a queda e a janela seguinte: não grava', resumoQ(d), 'cai; nada gravado', d.quedas.length === 1 && d.gravadas.length === 0);
    // reiniciar: nada nos 3 s seguintes, a 1ª janela fecha 2,5 s depois deles
    const q = criarQueda();
    q.reiniciar(10000);
    let t = 10000, primeira = null;
    for (const v of serie(40, 8, { tremor: TREMOR_Q })) { t += v; const x = q.quadro(v / 1000, t, 'media', true); if (x && primeira === null) primeira = (t - 10000) / 1000; }
    meta('R6 reiniciar(): a 1ª janela que conta começa 3 s depois (a queda em ~5,5 s)', `a 1ª decisão em ${f(primeira, 2)} s`, '5,4–5,7 s', primeira >= 5.4 && primeira <= 5.7);
  }

  // ---------------------------------------------------------------- R7: o 20 Hz preso × com tremor
  {
    const preso = rodar(serie(50, 12, { soma: [0.4, -0.4, 0.2, -0.2, 0] }));
    const solto = rodar(serie(50, 12, { tremor: TREMOR_Q }));
    meta('R7 o 20 Hz preso (50 ms ± 0,4) cai e não grava; com o tremor da seção Q (50 ms × 0,6–1,4) grava',
      `preso: ${resumoQ(preso)} (presa ${preso.janelas[0]?.presa}) · com tremor: ${resumoQ(solto)} (presa ${solto.janelas[0]?.presa}, p90 − p10 ${f(solto.janelas[0]?.tremor, 1)} ms)`,
      'preso: cai, nada; com tremor: cai, grava',
      preso.quedas.length === 1 && preso.gravadas.length === 0 && preso.janelas[0]?.presa === true && solto.quedas.length === 1 && solto.gravadas.length === 1 && solto.janelas[0]?.presa === false);
  }

  // ---------------------------------------------------------------- R8: a sessão = a regra de antes (o oráculo)
  {
    const difs = [];
    let nQuedas = 0, nQuadros = 0;
    for (let s = 1; s <= 8; s++) {
      const r = rng(s * 7919);
      const ivs = [], ativos = [], recomeca = new Set();
      let t = 0;
      while (t < 90000) {
        const qps = 12 + r() * 63, dur = 1000 + r() * 7000, tremor = r() < 0.5;
        const pausa = r() < 0.15;
        let u = 0;
        while (u < dur) {
          const v = (1000 / qps) * (tremor ? 0.6 + r() * 0.8 : 1);
          ivs.push(v); ativos.push(!pausa); u += v; t += v;
        }
        if (r() < 0.08) recomeca.add(ivs.length);
      }
      const nivel0 = s % 3 === 0 ? 'alta' : 'media';
      const a = regraAntiga(), q = criarQueda({ podeGravar: s % 2 === 0 });
      a.reiniciar(500); q.reiniciar(500);
      let tt = 500, na = nivel0, nq = nivel0;
      for (let k = 0; k < ivs.length; k++) {
        tt += ivs[k];
        if (recomeca.has(k)) { a.reiniciar(tt); q.reiniciar(tt); }
        const da = a.quadro(ivs[k] / 1000, tt, na, ativos[k]);
        const dq = q.quadro(ivs[k] / 1000, tt, nq, ativos[k]);
        if (da) na = da;
        if (dq?.cai) nq = dq.cai.para;
        if ((da ?? null) !== (dq?.cai?.para ?? null)) difs.push(`semente ${s} quadro ${k}: antes ${da ?? '—'}, agora ${dq?.cai?.para ?? '—'}`);
        if (da) nQuedas++;
      }
      nQuadros += ivs.length;
    }
    meta('R8 a queda na sessão = a regra de antes do item 45 (8 sequências sorteadas: 12–75 qps, tremor, pausas, recomeços)',
      `${nQuadros} quadros, ${nQuedas} quedas na regra de antes · diferenças: ${difs.length ? difs.slice(0, 3).join('; ') : 'nenhuma'}`, 'as mesmas quedas, no mesmo quadro', difs.length === 0 && nQuedas >= 6);
  }

  // ---------------------------------------------------------------- R9: as contas
  {
    const a = resumoJanela([33.0, 33.6, 33.3, 33.2, 33.5, 33.4, 33.1, 33.3, 33.2, 33.4, 33.0, 33.6, 33.3, 33.2, 33.5, 33.4, 33.1, 33.3, 33.2, 66.7], 20);
    const b = resumoJanela([50, 49.8, 50.3, 50.1, 49.9], 5);
    const c = resumoJanela([40, 40.2, 39.9, 40.1], 4);
    const d = resumoJanela([20, 46, 33, 26, 40, 33.3, 33.3], 7);
    const vazia = resumoJanela([], 0);
    const lista = [3, 1, 2];
    resumoJanela(lista, 3);
    meta('R9 resumoJanela: preso em 33,3 e 50 com pouco tremor; não preso em 40 nem com tremor; a lista do chamador fica',
      `33,3: mediana ${f(a.mediana)} p10 ${f(a.p10)} p90 ${f(a.p90)} presa ${a.presa} · 50: ${b.presa} · 40: ${c.presa} · tremor ${f(d.tremor, 1)} ms: ${d.presa} · vazia: ${vazia.presa} · lista ${J(lista)}`,
      'true, true, false, false, false; [3,1,2]',
      a.presa && b.presa && !c.presa && !d.presa && !vazia.presa && J(lista) === '[3,1,2]' && Math.abs(a.mediana - 33.3) < 1e-9 && a.p90 < 34);
    const v = [quedaValida({ de: 'media', para: 'baixa', v: 1 }), quedaValida({ de: 'alta', para: 'baixa' }), quedaValida({ de: 'baixa', para: 'media' }),
      quedaValida({ de: 'media', para: 'media' }), quedaValida({ de: 'x', para: 'baixa' }), quedaValida(null), quedaValida('baixa')];
    meta('R9 quedaValida: só {de, para} de cima para baixo', J(v), '[{media,baixa},{alta,baixa},null,null,null,null,null]',
      J(v) === J([{ de: 'media', para: 'baixa' }, { de: 'alta', para: 'baixa' }, null, null, null, null, null]));
    const n = [nivelInicial('media', { de: 'media', para: 'baixa' }), nivelInicial('alta', { de: 'alta', para: 'media' }), nivelInicial('media', { de: 'alta', para: 'media' }),
      nivelInicial('baixa', { de: 'media', para: 'baixa' }), nivelInicial('media', { de: 'baixa', para: 'alta' }), nivelInicial('alta', null), nivelInicial('media', 'lixo')];
    meta('R9 nivelInicial: a gravada mais baixa vale; nunca sobe; lixo = a do aparelho', J(n), '[baixa, media, media, baixa, media, alta, media]',
      J(n) === J(['baixa', 'media', 'media', 'baixa', 'media', 'alta', 'media']));
    meta('R9 as constantes de antes (3 s, janelas de 2,5 s, 4 s entre trocas, Alta 48, Média 30) e 2 janelas para gravar',
      `${QUEDA.esperaMs} ms, ${QUEDA.janelaS} s, ${QUEDA.entreTrocasMs} ms, ${QUEDA.minimo.alta}/${QUEDA.minimo.media}, ${QUEDA.janelasGravar}`, '3000, 2,5, 4000, 48/30, 2',
      QUEDA.esperaMs === 3000 && QUEDA.janelaS === 2.5 && QUEDA.entreTrocasMs === 4000 && QUEDA.minimo.alta === 48 && QUEDA.minimo.media === 30 && QUEDA.janelasGravar === 2);
  }

  // ---------------------------------------------------------------- R10: pureza
  {
    const fonte = fs.readFileSync(ARQ, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const importa = /\bimport\b/.test(fonte), dom = /\b(document|window|THREE|three|navigator|performance|requestAnimationFrame|localStorage|Date\.now)\b/.test(fonte);
    let noFecho = null;
    const fh = path.join(JS, '..', 'tools', 'fecho-hash.mjs');
    if (fs.existsSync(fh)) noFecho = /ritmo-desenho\.js/.test(execFileSync(process.execPath, [fh], { encoding: 'utf8' }));
    meta('R10 pureza: o módulo sem import, DOM, three nem relógio próprio e fora do fecho do hash',
      `import ${importa ? 'SIM' : 'nenhum'}; DOM/three/relógio ${dom ? 'SIM' : 'não'}; no fecho ${noFecho === null ? '(sem a ferramenta)' : noFecho ? 'SIM' : 'não'}`,
      'nenhum; não; não', !importa && !dom && noFecho === false);
  }
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-ritmo-desenho: PASSOU' : '\nteste-ritmo-desenho: REPROVOU');
process.exit(ok ? 0 : 1);
