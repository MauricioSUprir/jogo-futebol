// Otimização sem mudar a PARTIDA (Etapa 3, plano 4.3): roda as mesmas partidas 11×11 na lógica do
// repositório e numa cópia de outra versão (git archive) e compara o hash do mundo a cada 300 passos. O
// hash-igual.mjs prova que o treino não mudou; este prova que uma otimização também não mudou a partida.
// Cenas (cada partida inteira: os dois tempos, intervalo, recomeços):
//  - demo: IA × IA (a IA joga pelo humano: entradaDemoPartida);
//  - humano: analógico e botões sorteados por um gerador do próprio teste (inclusive CONTER, DIVIDIDA,
//    PRESSÃO, TROCAR, passe, chute, lançamento, modificador), misturados com a demo, e uma edição do time
//    no meio (formação e tática).
//   node tools/hash-partida.mjs                      (repositório × HEAD: a otimização ainda não commitada)
//   node tools/hash-partida.mjs --ref <commit>       (repositório × outro commit)
//   node tools/hash-partida.mjs --base <pasta js>    (repositório × uma cópia já extraída)
//   node tools/hash-partida.mjs --sementes 4 --min 2 (sementes por cena; minutos reais por tempo)
// Sai com código 1 se algum hash diferir (mostra a primeira diferença de cada partida).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JS_REPO = path.resolve(AQUI, '../js');
const CADA = 300; // passos entre dois hashes
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

// ------------------------------------------------------------------ processo filho: uma partida
if (args[0] === '--filho') {
  const [, js, cena, semTxt, minTxt] = args;
  const imp = f => import(pathToFileURL(path.join(js, f)).href);
  const P = await imp('partida.js'), S = await imp('sim.js'), C = await imp('config.js');
  const sem = +semTxt, min = +minTxt;
  const m = P.criarPartida({ semente: sem, minutosPorTempo: min });
  let s = (sem * 2654435761) >>> 0 || 1;
  const r = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const B = C.BOTAO;
  const botoes = [0, 0, 0, B.CORRER, B.PASSE, B.CHUTE, B.LANCAMENTO, B.TROCAR, B.CONTER, B.CONTER, B.DIVIDIDA, B.PRESSAO, B.MOD].filter(x => x != null);
  let e = { x: 0, z: 0, botoes: 0 }, dura = 0;
  const N = Math.round(2 * min * 3600) + 600;
  const hs = [];
  for (let i = 0; i < N; i++) {
    let ent;
    if (cena === 'demo') ent = P.entradaDemoPartida(m);
    else {
      if (dura-- <= 0) {
        const ang = r() * 2 * Math.PI, mag = r() < 0.2 ? 0 : 0.3 + 0.7 * r();
        e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes: botoes[Math.floor(r() * botoes.length)] };
        dura = 10 + Math.floor(r() * 50);
      }
      ent = r() < 0.5 ? P.entradaDemoPartida(m) : e;
      if (r() < 0.3) ent = { x: ent.x, z: ent.z, botoes: (ent.botoes | e.botoes) };
    }
    const acoes = i === 1500 ? [{ tipo: 'editarTime', time: 0, base: m.times[0].versao, formacao: '4-4-2', vagas: null, substituicoes: [], tatica: { mentalidade: 1, pressao: 2, largura: 2, linha: 2 } }] : null;
    P.passoPartida(m, ent, acoes);
    if (i % CADA === CADA - 1) hs.push(S.hashMundo(m).toString(16));
  }
  process.stdout.write(JSON.stringify(hs));
  process.exit(0);
}

// ------------------------------------------------------------------ processo principal
const NSEM = +arg('--sementes', 4);
const MIN = +arg('--min', 2);
const REF = arg('--ref', 'HEAD');
let JS_BASE = arg('--base', null);
if (JS_BASE) JS_BASE = path.resolve(JS_BASE);
else {
  const raiz = execFileSync('git', ['-C', AQUI, 'rev-parse', '--show-toplevel']).toString().trim();
  const sha = execFileSync('git', ['-C', raiz, 'rev-parse', '--short=12', REF]).toString().trim();
  const dest = path.join(os.tmpdir(), `golaco-base-${sha}`);
  if (!fs.existsSync(path.join(dest, 'golaco/js/partida.js'))) {
    fs.mkdirSync(dest, { recursive: true });
    const tar = execFileSync('git', ['-C', raiz, 'archive', '--format=tar', REF, 'golaco/js'], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dest], { input: tar });
  }
  JS_BASE = path.join(dest, 'golaco/js');
}
if (!fs.existsSync(path.join(JS_BASE, 'partida.js'))) { console.error(`a base não tem partida.js: ${JS_BASE}`); process.exit(2); }

function rodar(js, cena, sem) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--filho', js, cena, String(sem), String(MIN)]);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error(`${cena} ${sem} em ${js}: ${err.slice(0, 500)}`))));
  });
}

const t0 = Date.now();
const tarefas = [];
for (const cena of ['demo', 'humano']) for (let sem = 1; sem <= NSEM; sem++) for (const lado of ['repo', 'base']) tarefas.push({ cena, sem, lado });
const res = {};
let prox = 0, erro = null;
async function trabalhador() {
  while (prox < tarefas.length && !erro) {
    const t = tarefas[prox++];
    try { res[`${t.cena} ${t.sem} ${t.lado}`] = await rodar(t.lado === 'repo' ? JS_REPO : JS_BASE, t.cena, t.sem); } catch (e2) { erro = e2; }
  }
}
await Promise.all(Array.from({ length: Math.max(2, os.cpus().length || 2) }, trabalhador));
if (erro) { console.error(erro.message); process.exit(2); }
console.log(`base: ${JS_BASE}\nrepositório: ${JS_REPO}\n${NSEM} sementes × 2 cenas, ${MIN} min por tempo, hash a cada ${CADA} passos`);
let falhas = 0, total = 0;
for (const cena of ['demo', 'humano']) for (let sem = 1; sem <= NSEM; sem++) {
  const a = res[`${cena} ${sem} repo`], b = res[`${cena} ${sem} base`];
  total += a.length;
  const k = a.findIndex((h, i) => h !== b[i]);
  if (k >= 0 || a.length !== b.length) { falhas++; console.log(`DIFERENTE  ${cena} semente ${sem}: 1ª diferença no passo ${(k + 1) * CADA}`); }
}
console.log(`\nhash-partida: ${falhas ? `REPROVOU (${falhas} partidas mudaram)` : `PASSOU (${total} hashes iguais)`} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
