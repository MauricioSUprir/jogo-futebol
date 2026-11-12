// O ritmo dos desenhos (item 45, `golaco/PLANO-GRAFICOS.md` passos 7 e 8; js/render/ritmo-desenho.js, puro), sem navegador — a
// decisão da QUEDA automática da qualidade (C12) e o TETO de quadros (C13):
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
// O teto (C13; os carimbos do rAF na grade da tela com tremor de ±0,5 ms, 8 sementes por caso):
//  T1 n = max(1, floor(Hz/60 + 0,1)): 60, 90 e 100 Hz → 1; 120, 144 e 165 → 2; 240 → 4; sem refresh → 1; a conta do refresh
//     (a média dos intervalos a ± 25% da mediana) em 200 janelas com tremor: ± 1,5% e o n certo; os quadros perdidos fora
//  T2 no celular, 60, 90, 120, 144, 165 e 240 Hz dão 60, 90, 60, 72, 82,5 e 60 desenhos por segundo (± 0,5), 1 a cada n quadros:
//     o desvio dos intervalos entre desenhos ≤ 1 ms (contra n períodos; contra a mediana, informativo) e o n certo
//  T3 o PC (desligado): todo quadro desenha a 144 e a 240 Hz (o refresh medido fica para o painel)
//  T4 a troca de refresh no meio: 120 → 60 desenha todo quadro na hora (nenhum intervalo > 1 período + 1 ms); 120 → 90 e 240 →
//     144 baixam o n pela descida rápida (90 e 72 no 1 s que começa 0,2 s depois; antes da conta de 2 s); 144 → 165 segue 2
//     (82,5 já); 60 → 120 nunca abaixo de 60 e o teto (60) em até 2,5 s
//  T5 a página que perde o vsync (120 Hz; 1 desenho em 3 leva 10 ms, os outros 7): o quadro do ritmo pelo TEMPO não espera um
//     quadro a mais — 60 por segundo, nenhum intervalo > 2 períodos + 1 ms (o contador "1 a cada n quadros" daria 25 ms: medido)
//  T6 n = 1 é o laço de antes: a 60 e a 90 Hz (com tremor, quadros perdidos e uma volta da aba escondida), desligado a 240 Hz e
//     com `forcar` (a tela antes do jogo) a 120 Hz, TODO quadro desenha
//  T7 a queda (C12) com o teto: 30 s de desenhos do teto na Média a 120 e a 240 Hz e na Alta a 144 e a 165 Hz: nenhuma queda (a
//     queda mede os quadros DESENHADOS — 60 a 120 Hz não é "o aparelho não segura")
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
  for (const n of ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'R9', 'R10', 'T1–T7']) meta(`${n} (o módulo js/render/ritmo-desenho.js)`, `não existe (${erroImport})`, 'o módulo', false);
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

  // ================================================================ o TETO (C13)
  if (typeof M.criarTeto !== 'function' || typeof M.nDoTeto !== 'function') {
    for (const n of ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']) meta(`${n} o teto (criarTeto, nDoTeto)`, 'não existe', 'o teto no módulo', false);
  } else testesTeto();
}

/**
 * Roda o teto num rAF simulado: `trechos` = [{hz, s}] em sequência (a grade da tela muda no começo de cada trecho), o carimbo de
 * cada quadro com tremor uniforme de ± `tremor` ms (do vsync: não acumula), e, com `trabalho(desenhou, k)` (ms), o rAF seguinte
 * só no 1º vsync depois do fim do trabalho (a página que perde o vsync). `forcar(k)`: o quadro k é da tela antes do jogo.
 * Devolve {quadros, desenhos (os carimbos), estados (o estado depois de cada quadro), trocas (o instante de cada trecho)}.
 */
function simTeto(trechos, { ligado = true, tremor = 0.5, semente = 1, trabalho = null, forcar = null, contador = false, pulos = {} } = {}) {
  const te = contador ? tetoContador(ligado) : M.criarTeto({ ligado });
  const r = rng(semente * 2654435761);
  const quadros = [], desenhos = [], estados = [], trocas = [];
  let v = 1000, k = 0;
  for (const { hz, s } of trechos) {
    const T = 1000 / hz, fim = v + s * 1000;
    trocas.push(v);
    while (v < fim) {
      if (pulos[k]) v += pulos[k];          // (a aba escondida: o rAF para e volta depois)
      const t = v + (r() * 2 - 1) * tremor;
      const d = te.quadro(t, forcar ? forcar(k) : false);
      quadros.push(t); estados.push(te.estado());
      if (d) desenhos.push(t);
      const w = trabalho ? trabalho(d, desenhos.length) : 0;
      v += T * Math.max(1, Math.ceil(w / T - 1e-9));
      k++;
    }
  }
  return { quadros, desenhos, estados, trocas };
}
/** A alternativa que NÃO entrou (para o T5): desenha 1 a cada n quadros pelo contador, com o mesmo n do módulo. */
function tetoContador(ligado) {
  const te = M.criarTeto({ ligado: false });
  let c = 0;
  return { quadro(t, forcar) { te.quadro(t); const n = ligado ? te.estado().n : 1; if (forcar || n <= 1) { c = 0; return true; } const d = c === 0; c = (c + 1) % n; return d; }, estado: () => te.estado() };
}
/** Os desenhos por segundo entre a e b (ms) e os intervalos entre os desenhos que começam no trecho. */
function janelaDes(desenhos, a, b) {
  const v = desenhos.filter(t => t >= a && t < b);
  const iv = []; for (let i = 1; i < v.length; i++) iv.push(v[i] - v[i - 1]);
  return { porSeg: (v.length * 1000) / (b - a), iv, n: v.length };
}
function mediana(a) { const v = [...a].sort((x, y) => x - y); return v.length ? (v.length % 2 ? v[(v.length - 1) / 2] : (v[v.length / 2 - 1] + v[v.length / 2]) / 2) : NaN; }
/** O maior intervalo entre desenhos de a em diante (com o desenho de antes de a). */
function maiorIntervalo(desenhos, a, b = Infinity) {
  let m = 0;
  for (let i = 1; i < desenhos.length; i++) if (desenhos[i] >= a && desenhos[i] < b) m = Math.max(m, desenhos[i] - desenhos[i - 1]);
  return m;
}

function testesTeto() {
  const { nDoTeto, criarTeto, criarQueda, TETO } = M;
  const SEMENTES = [1, 2, 3, 4, 5, 6, 7, 8];
  const ALVO = { 60: 60, 90: 90, 120: 60, 144: 72, 165: 82.5, 240: 60 };
  const N_ALVO = { 60: 1, 90: 1, 120: 2, 144: 2, 165: 2, 240: 4 };

  // ---------------------------------------------------------------- T1: a tabela do n
  {
    const casos = [[60, 1], [90, 1], [100, 1], [113, 1], [115, 2], [119.5, 2], [120, 2], [144, 2], [165, 2], [170, 2], [175, 3], [180, 3], [240, 4], [NaN, 1], [0, 1], [-5, 1]];
    const errados = casos.filter(([hz, n]) => nDoTeto(hz) !== n);
    // (a folga de 0,1 segura no 2 a tela de 120 medida um pouco abaixo — 119,5 Hz; o preço: de 114 a 119 Hz e de 174 a 179 Hz o
    // teto fica em 57–59,9 desenhos por segundo — nenhuma tela de celular conhecida nessas faixas)
    meta('T1 n = max(1, floor(Hz/60 + 0,1)): 60/90/100 Hz → 1, 115–170 → 2, 175/180 → 3, 240 → 4, sem refresh → 1',
      casos.map(([hz]) => `${Number.isFinite(hz) ? hz : 'NaN'}→${nDoTeto(hz)}`).join(' '), errados.length ? `errados: ${J(errados)}` : 'todos',
      errados.length === 0 && TETO.alvoHz === 60 && TETO.folga === 0.1 && TETO.amostras === 30 && TETO.refazMs === 2000);
  }

  // ---------------------------------------------------------------- T1: a conta do refresh com tremor
  {
    // (200 janelas de 30 intervalos com o carimbo tremido ±0,5 ms: a mediana sozinha dava 231–248 Hz a 240 Hz, o n em 3 em 4%)
    const out = [];
    let ok = true;
    for (const hz of [60, 90, 120, 144, 165, 240]) {
      const T = 1000 / hz, tmp = new Float64Array(30);
      let lo = Infinity, hi = 0, nErr = 0;
      for (let sem = 1; sem <= 200; sem++) {
        const r = rng(sem * 977), ts = [];
        for (let k = 0; k <= 30; k++) ts.push(k * T + (r() * 2 - 1) * 0.5);
        const iv = new Float64Array(30); for (let k = 0; k < 30; k++) iv[k] = ts[k + 1] - ts[k];
        const h = 1000 / M.periodoDaTela(iv, 30, tmp);
        lo = Math.min(lo, h); hi = Math.max(hi, h);
        if (nDoTeto(h) !== nDoTeto(hz)) nErr++;
      }
      out.push(`${hz}: ${f(lo, 1)}–${f(hi, 1)}${nErr ? ` (n errado ${nErr})` : ''}`);
      ok &&= lo >= hz * 0.985 && hi <= hz * 1.015 && nErr === 0;
    }
    // (com um quadro perdido em 5: os de 2 períodos ficam fora)
    const iv = new Float64Array(30); for (let k = 0; k < 30; k++) iv[k] = k % 5 === 4 ? 2000 / 120 : 1000 / 120;
    const hp = 1000 / M.periodoDaTela(iv, 30, new Float64Array(30));
    ok &&= Math.abs(hp - 120) < 1e-6;
    meta('T1 a conta do refresh (200 janelas de 30 intervalos, tremor ±0,5 ms): ± 1,5% e o n certo em todas; os perdidos fora',
      `${out.join(' · ')} Hz · 120 Hz com 1 perdido em 5: ${f(hp, 2)} Hz`, '± 1,5% (o n de 240 Hz vira 3 a −2,5%); n certo; 120,00', ok);
  }

  // ---------------------------------------------------------------- T2: os desenhos por segundo e o ritmo, no celular
  for (const hz of [60, 90, 120, 144, 165, 240]) {
    let piorPorSeg = 0, piorDesvio = 0, piorDesvioMed = 0, nErrado = 0, porSeg = [];
    for (const sem of SEMENTES) {
      const r = simTeto([{ hz, s: 13 }], { semente: sem });
      const a = r.trocas[0] + 3000, b = a + 10000;
      const j = janelaDes(r.desenhos, a, b);
      const n = N_ALVO[hz], esperado = n * 1000 / hz;
      porSeg.push(j.porSeg);
      piorPorSeg = Math.max(piorPorSeg, Math.abs(j.porSeg - ALVO[hz]));
      piorDesvio = Math.max(piorDesvio, ...j.iv.map(x => Math.abs(x - esperado)));
      const md = mediana(j.iv);
      piorDesvioMed = Math.max(piorDesvioMed, ...j.iv.map(x => Math.abs(x - md)));
      if (r.estados[r.estados.length - 1].n !== n) nErrado++;
    }
    meta(`T2 celular a ${hz} Hz (tremor ±0,5 ms, 8 sementes): ${String(ALVO[hz]).replace('.', ',')} desenhos/s, 1 a cada ${N_ALVO[hz]}, regulares`,
      `${f(Math.min(...porSeg), 2)}–${f(Math.max(...porSeg), 2)} desenhos/s · desvio máx ${f(piorDesvio, 3)} ms (contra a mediana ${f(piorDesvioMed, 3)}) · n errado em ${nErrado} de 8`,
      `${String(ALVO[hz]).replace('.', ',')} ± 0,5; desvio ≤ 1 ms; n ${N_ALVO[hz]}`, piorPorSeg <= 0.5 && piorDesvio <= 1 + 1e-9 && nErrado === 0);
  }

  // ---------------------------------------------------------------- T3: o PC (desligado)
  {
    const out = [];
    let ok = true;
    for (const hz of [144, 240]) {
      const r = simTeto([{ hz, s: 6 }], { ligado: false });
      const todos = r.desenhos.length === r.quadros.length;
      const e = r.estados[r.estados.length - 1];
      out.push(`${hz} Hz: ${r.desenhos.length} de ${r.quadros.length} quadros desenham · refresh medido ${f(e.hz, 1)} Hz (n ${e.n}, não aplicado)`);
      ok &&= todos && Math.abs(e.hz - hz) < 1 && e.ligado === false;
    }
    meta('T3 o PC (desligado): todo quadro desenha; o refresh medido fica para o painel', out.join(' · '), 'todos; o refresh ± 1 Hz', ok);
  }

  // ---------------------------------------------------------------- T4: a troca de refresh no meio
  {
    // 120 → 60: na hora (o quadro do ritmo pelo tempo)
    let pior = 0, porSeg = Infinity;
    for (const sem of SEMENTES) {
      const r = simTeto([{ hz: 120, s: 4 }, { hz: 60, s: 4 }], { semente: sem });
      const tt = r.trocas[1];
      pior = Math.max(pior, maiorIntervalo(r.desenhos, tt));
      porSeg = Math.min(porSeg, janelaDes(r.desenhos, tt, tt + 1000).porSeg);
    }
    // (a contagem numa janela de 1 s com carimbos tremidos erra ± 1 desenho: a prova é o maior intervalo)
    meta('T4 120 → 60 Hz: desenha todo quadro na hora (60/s no 1º segundo; nenhum intervalo > 1 período + 1 ms)', `menor ${f(porSeg, 1)} desenhos/s no 1º s · maior intervalo depois da troca ${f(pior, 2)} ms`,
      '≥ 59 (± 1 da janela); ≤ 17,67 ms', porSeg >= 59 && pior <= 1000 / 60 + 1 + 1e-9);
  }
  for (const [de, para] of [[120, 90], [240, 144]]) {
    let piorJan = 0, piorInt = 0, tAte = 0, porSegs = [];
    for (const sem of SEMENTES) {
      const r = simTeto([{ hz: de, s: 4 }, { hz: para, s: 4 }], { semente: sem });
      const tt = r.trocas[1];
      const j = janelaDes(r.desenhos, tt + 200, tt + 1200);
      porSegs.push(j.porSeg);
      piorJan = Math.max(piorJan, Math.abs(j.porSeg - ALVO[para]));
      piorInt = Math.max(piorInt, maiorIntervalo(r.desenhos, tt + 200));
      // (quanto levou até o n certo)
      const k = r.quadros.findIndex((t, i) => t >= tt && r.estados[i].n === N_ALVO[para]);
      tAte = Math.max(tAte, k >= 0 ? r.quadros[k] - tt : Infinity);
    }
    const perAlvo = N_ALVO[para] * 1000 / para;
    meta(`T4 ${de} → ${para} Hz: a descida rápida baixa o n (${String(ALVO[para]).replace('.', ',')}/s no 1 s que começa 0,2 s depois)`,
      `${f(Math.min(...porSegs), 1)}–${f(Math.max(...porSegs), 1)} desenhos/s · o n certo em até ${f(tAte, 0)} ms · maior intervalo depois de +0,2 s ${f(piorInt, 2)} ms`,
      `${String(ALVO[para]).replace('.', ',')} ± 1; n em ≤ 200 ms; ≤ ${f(perAlvo + 1, 2)} ms`, piorJan <= 1 && tAte <= 200 && piorInt <= perAlvo + 1 + 1e-9);
  }
  {
    let pior = 0, piorInt = 0;
    for (const sem of SEMENTES) {
      const r = simTeto([{ hz: 144, s: 4 }, { hz: 165, s: 4 }], { semente: sem });
      const tt = r.trocas[1];
      pior = Math.max(pior, Math.abs(janelaDes(r.desenhos, tt, tt + 1000).porSeg - 82.5));
      piorInt = Math.max(piorInt, maiorIntervalo(r.desenhos, tt));
    }
    meta('T4 144 → 165 Hz: o n segue 2 e o ritmo vira 82,5 na hora', `desvio do 82,5 no 1º s ${f(pior, 2)} · maior intervalo ${f(piorInt, 2)} ms`, '≤ 1; ≤ 14,89 ms (2 períodos de 144 Hz + 1 ms)',
      pior <= 1 && piorInt <= 2000 / 144 + 1 + 1e-9);
  }
  {
    let piorInt = 0, piorDepois = 0, piorDesv = 0, tTeto = 0;
    for (const sem of SEMENTES) {
      // (a troca em fases diferentes da conta de 2 s: logo depois dela é o pior caso, ~2 s esperando a próxima)
      const r = simTeto([{ hz: 60, s: 4 + (sem % 4) * 0.17 }, { hz: 120, s: 6 }], { semente: sem });
      const tt = r.trocas[1];
      // (nunca abaixo de 60: nenhum intervalo entre desenhos maior que 1/60 s + 1 ms depois da troca)
      piorInt = Math.max(piorInt, maiorIntervalo(r.desenhos, tt));
      const j = janelaDes(r.desenhos, tt + 2500, tt + 5500);
      piorDepois = Math.max(piorDepois, Math.abs(j.porSeg - 60));
      piorDesv = Math.max(piorDesv, ...j.iv.map(x => Math.abs(x - 2000 / 120)));
      const k = r.quadros.findIndex((t, i) => t >= tt && r.estados[i].n === 2);
      tTeto = Math.max(tTeto, k >= 0 ? r.quadros[k] - tt : Infinity);
    }
    meta('T4 60 → 120 Hz: nunca abaixo de 60 e o teto (60 regulares) em até 2,5 s (a conta de 2 s)', `maior intervalo depois da troca ${f(piorInt, 2)} ms · o teto em até ${f(tTeto, 0)} ms · depois desvio do 60 ${f(piorDepois, 2)}, intervalos ±${f(piorDesv, 2)} ms`,
      '≤ 17,67 ms; ≤ 2500 ms; ≤ 0,5; ≤ 1 ms', piorInt <= 1000 / 60 + 1 + 1e-9 && tTeto <= 2500 && piorDepois <= 0.5 && piorDesv <= 1 + 1e-9);
  }

  // ---------------------------------------------------------------- T5: a página que perde o vsync
  {
    // (1 desenho em 3 leva 10 ms — passa do vsync de 8,33 ms —, os outros 7; o quadro sem desenho, 0,5 ms)
    const trab = (desenhou, nd) => (desenhou ? (nd % 3 === 0 ? 10 : 7) : 0.5);
    const medir = opc => {
      let piorSeg = Infinity, piorInt = 0;
      for (const sem of SEMENTES) {
        const r = simTeto([{ hz: 120, s: 14 }], { semente: sem, trabalho: trab, ...opc });
        const a = r.trocas[0] + 3000;
        piorSeg = Math.min(piorSeg, janelaDes(r.desenhos, a, a + 10000).porSeg);
        piorInt = Math.max(piorInt, maiorIntervalo(r.desenhos, a, a + 10000));
      }
      return { piorSeg, piorInt };
    };
    const tempo = medir({}), cont = medir({ contador: true }), sem = medir({ ligado: false });
    meta('T5 a página que perde o vsync (120 Hz; 1 desenho em 3 leva 10 ms): o quadro do ritmo pelo tempo não espera um quadro a mais',
      `pelo tempo: ${f(tempo.piorSeg, 1)}/s, maior intervalo ${f(tempo.piorInt, 2)} ms · (o contador: ${f(cont.piorSeg, 1)}/s, ${f(cont.piorInt, 2)} ms · sem teto: ${f(sem.piorSeg, 1)}/s)`,
      '≥ 59,5/s; ≤ 17,67 ms', tempo.piorSeg >= 59.5 && tempo.piorInt <= 2000 / 120 + 1 + 1e-9);
  }

  // ---------------------------------------------------------------- T6: n = 1 é o laço de antes
  {
    const casos = [];
    for (const hz of [60, 90]) {
      // (com um quadro perdido a cada 37 e a aba escondida 3 s no quadro 400)
      const r = simTeto([{ hz, s: 10 }], { trabalho: (d, nd) => (nd % 37 === 0 ? 1500 / hz : 0), pulos: { 400: 3000 } });
      casos.push([`${hz} Hz`, r.desenhos.length, r.quadros.length]);
    }
    const des = simTeto([{ hz: 240, s: 5 }], { ligado: false });
    casos.push(['desligado a 240 Hz', des.desenhos.length, des.quadros.length]);
    const forc = simTeto([{ hz: 120, s: 6 }], { forcar: () => true });
    casos.push(['forcar a 120 Hz', forc.desenhos.length, forc.quadros.length]);
    // (forcar só em parte: os quadros da tela desenham todos)
    const parte = simTeto([{ hz: 120, s: 8 }], { forcar: k => k >= 400 && k < 600 });
    const tela = parte.quadros.slice(400, 600).every(t => parte.desenhos.includes(t));
    meta('T6 n = 1 é o laço de antes: a 60 e a 90 Hz (perdidos, aba escondida), desligado e com forcar, TODO quadro desenha',
      casos.map(([n, d, q]) => `${n}: ${d} de ${q}`).join(' · ') + ` · forcar nos quadros 400–599: ${tela ? 'todos' : 'NÃO'}`, 'todos',
      casos.every(([, d, q]) => d === q) && tela);
  }

  // ---------------------------------------------------------------- T7: a queda com o teto
  {
    const out = [];
    let ok = true;
    for (const [nivel, hz] of [['media', 120], ['media', 240], ['alta', 144], ['alta', 165]]) {
      const r = simTeto([{ hz, s: 31 }], { semente: 3 });
      const q = criarQueda({ podeGravar: true });
      q.reiniciar(r.desenhos[0]);
      let nv = nivel, quedas = 0;
      for (let i = 1; i < r.desenhos.length; i++) {
        const d = q.quadro((r.desenhos[i] - r.desenhos[i - 1]) / 1000, r.desenhos[i], nv, true);
        if (d?.cai) { quedas++; nv = d.cai.para; }
      }
      out.push(`${nivel} a ${hz} Hz (${f(janelaDes(r.desenhos, r.trocas[0] + 3000, r.trocas[0] + 30000).porSeg, 1)}/s): ${quedas} queda(s)`);
      ok &&= quedas === 0;
    }
    meta('T7 a queda com o teto: 30 s na Média a 120/240 Hz e na Alta a 144/165 Hz, nenhuma queda', out.join(' · '), '0 em todos', ok);
  }
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-ritmo-desenho: PASSOU' : '\nteste-ritmo-desenho: REPROVOU');
process.exit(ok ? 0 : 1);
