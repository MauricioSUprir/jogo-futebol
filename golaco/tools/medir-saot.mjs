// Frequência da cena semiautomática nas partidas IA × IA (informativo, fora do CI; as mesmas sementes do
// painel-equilibrio: 1001…, partidas inteiras de 2 × 4 min). Antes de fixar o limite da POSIÇÃO LEGAL (meta 12 da
// especificação de 12/10): a cena legal em 5–30% dos gols é o alvo; acima de 30%, o limite cai para 0,5 m (fonte direta
// da FIFA: a faixa antiga sem alerta automático); abaixo de 5%, informar e NÃO alargar além de 1,0 m.
// Mede: % dos gols com a cena legal (limites 0,5 e 1,0 m; no replay de verdade, com o orçamento do gol), as margens de
// todas as cadeias de passe do time que fez o gol no lance, a contradição centro × partes do corpo (impedidos pelo
// centro e legais pelas partes; legais pelo centro e não pelas partes), cenas por partida (impedimento + legal) e a
// espera extra média do replay do gol com checagem.
//   node tools/medir-saot.mjs [--partidas 144] [--threads 4] [--json saida.json]
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const pastaJs = path.resolve(arg('--js', path.join(AQUI, '../js')));
const N = +arg('--partidas', 144), THREADS = +arg('--threads', Math.max(1, Math.min(4, os.cpus().length)));
const { varrerSaot } = await import(pathToFileURL(path.join(AQUI, 'lib/varre-saot.mjs')).href);
const sementes = Array.from({ length: N }, (_, i) => 1001 + i);
const t0 = Date.now();
const saida = arg('--json', null);
// a cada partida terminada: o progresso e (com --json) as partidas até agora (máquina carregada: dá para ler a parcial)
const res = await varrerSaot({
  pastaJs, sementes, maxTicks: 2 * 4 * 3600 + 8000, threads: THREADS, limites: [0.5, 1.0],
  aoTerminar: (r, k, n, todos) => {
    process.stdout.write(`\r${k}/${n} partidas (${((Date.now() - t0) / 1000).toFixed(0)} s)   `);
    if (saida && todos) fs.writeFileSync(saida, JSON.stringify({ sementes, parcial: true, res: todos }, null, 1));
  },
});
console.log('');
const gols = res.flatMap(r => r.gols), imped = res.flatMap(r => r.imped);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : '-');
const f2 = v => (v == null || !Number.isFinite(v) ? '-' : v.toFixed(2));
const l05 = gols.filter(g => g.legais['0.5'] != null).length, l10 = gols.filter(g => g.legais['1'] != null).length;
const noReplay = gols.filter(g => g.checagem);
const c10 = gols.filter(g => g.legaisCentro['1'] != null).length;
const margens = gols.flatMap(g => g.margens);
const faixas = [[-Infinity, -0.1, '< −0,10 (impedido)'], [-0.1, 0, '−0,10–0 (mesma linha)'], [0, 0.5, '0–0,5'], [0.5, 1, '0,5–1,0'], [1, 2, '1–2'], [2, 5, '2–5'], [5, Infinity, '> 5']];
const contraImp = imped.filter(i => i.partes && i.partes.legalPartes).length;
const extra = noReplay.map(g => g.dur - g.durHoje);
console.log(`medir-saot: ${res.length} partidas (sementes ${sementes[0]}–${sementes.at(-1)}), ${gols.length} gols, ${imped.length} impedimentos, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`  gols com a cena de POSIÇÃO LEGAL pela regra: ${l10} (${pct(l10, gols.length)}) com 1,0 m · ${l05} (${pct(l05, gols.length)}) com 0,5 m`);
console.log(`  no replay de verdade (com o orçamento do gol): ${noReplay.length} (${pct(noReplay.length, gols.length)}); margens ${noReplay.map(g => f2(g.margem)).join(', ') || '-'}`);
console.log(`  espera extra nos gols com checagem: média ${f2(extra.length ? extra.reduce((a, b) => a + b, 0) / extra.length : NaN)} s (máx ${f2(extra.length ? Math.max(...extra) : NaN)} s)`);
console.log(`  cadeias de passe do time que fez o gol, no lance (margem pelo centro, m): ${margens.length}`);
for (const [a, b, n] of faixas) { const k = margens.filter(m => m >= a && m < b).length; console.log(`    ${n.padEnd(22)} ${String(k).padStart(5)} (${pct(k, margens.length)})`); }
console.log(`  contradição centro × partes: impedidos pelo centro e legais pelas partes ${contraImp} de ${imped.length}; gols com passe legal pelo centro (≤ 1,0 m) e não pelas partes ${c10 - l10} de ${c10}`);
console.log(`  cenas por partida: impedimento ${f2(imped.length / res.length)}, legal no replay ${f2(noReplay.length / res.length)}`);
const fr = 100 * l10 / Math.max(1, gols.length);
console.log(`  conclusão (meta 12): ${fr > 30 ? 'ACIMA de 30% — o limite cai para 0,5 m' : fr < 5 ? 'ABAIXO de 5% — informar; o limite fica em 1,0 m (não alargar)' : 'dentro de 5–30% — o limite fica em 1,0 m'}`);
if (saida) fs.writeFileSync(saida, JSON.stringify({ sementes, res }, null, 1));
