// Sem recuo no treino (Etapa 3, plano 1.5): o treino de ataque e o de condução têm de continuar
// BIT A BIT iguais aos da base. Roda os mesmos roteiros na lógica do repositório e numa cópia da
// base (git archive) e compara o hash do mundo a cada 600 passos (10 s).
//
// Cenas (cada uma com N sementes × M minutos):
//  - ataque-demo      treino de ataque com a IA jogando pelo humano (entradaDemo, como no ?demo=1)
//                     e um 'recomecar' no meio;
//  - ataque-roteiro   treino de ataque com o humano no roteiro sorteado de condução
//                     (tools/lib/roteiros.mjs) mais botões de ação (PASSE, ENFIADA, LANÇAMENTO,
//                     CHUTE, TROCAR, GOLEIRO) em ritmos fixos;
//  - conducao-roteiro modo condução com o roteiro sorteado, marcador ligado/desligado e máquina
//                     de passes;
//  - conducao-demo    modo condução com a entradaDemo (círculo com arrancadas).
// Nenhuma cena aperta CONTER, DIVIDIDA nem PRESSÃO (os botões de defesa da Etapa 3 só agem
// quando apertados).
//
//   node tools/hash-igual.mjs                      (base = 980b0b0, extraída para a pasta temporária)
//   node tools/hash-igual.mjs --ref <commit>       (outra base do git)
//   node tools/hash-igual.mjs --base <pasta js>    (pasta js/ de uma cópia da base já extraída)
//   node tools/hash-igual.mjs --sementes 20 --min 3 [--rapido = 4 sementes × 1 min]
// Sai com código 1 se algum hash diferir (mostra a primeira diferença de cada cena).
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const JS_REPO = path.resolve(AQUI, '../js');
const CENAS = ['ataque-demo', 'ataque-roteiro', 'conducao-roteiro', 'conducao-demo'];
const CADA = 600; // passos entre dois hashes

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };

// ------------------------------------------------------------------ processo filho: roda uma cena
if (args[0] === '--filho') {
  const [, jsDir, cena, sementesTxt, minTxt] = args;
  const imp = f => import(pathToFileURL(path.join(jsDir, f)).href);
  const S = await imp('sessao.js');
  const { hashMundo, jogadorPorId } = await imp('sim.js');
  const { PASSO, BOTAO } = await imp('config.js');
  const { maquinaPasse, alternarMarcador } = await imp('treino.js');
  const { criarRoteiro, entrada } = await import(pathToFileURL(path.join(AQUI, 'lib/roteiros.mjs')).href);
  const N = Math.round(+minTxt * 60 / PASSO);
  const saida = {};
  for (const sem of sementesTxt.split(',').map(Number)) {
    const hashes = [];
    let m, rot = null;
    if (cena.startsWith('ataque')) m = S.criarTreino({ modo: 'ataque', semente: sem });
    else if (cena === 'conducao-roteiro') {
      rot = criarRoteiro(sem);
      m = S.criarTreino({ modo: 'conducao', semente: sem, rumo: rot.rumo0 });
    } else m = S.criarTreino({ modo: 'conducao', semente: sem, x: S.DEMO.inicio.x, z: S.DEMO.inicio.z, rumo: S.DEMO.inicio.rumo });
    if (cena === 'ataque-roteiro') rot = criarRoteiro(sem + 1000, { duro: sem % 2 === 0 });
    for (let i = 0; i < N; i++) {
      let e, acoes = null;
      if (cena === 'ataque-demo') {
        e = S.entradaDemo(m);
        if (i === Math.floor(N / 2)) acoes = ['recomecar'];
      } else if (cena === 'ataque-roteiro') {
        const j = jogadorPorId(m, m.controlado[0]) ?? m.jogadores[0];
        const r = entrada(rot, (i % 3600) * PASSO, j);
        let b = r.botoes;
        const c = i % 1500;
        if (c >= 200 && c < 218) b |= BOTAO.PASSE;
        if (c >= 520 && c < 560) b |= BOTAO.ENFIADA;
        if (c >= 800 && c < 836) b |= BOTAO.LANCAMENTO;
        if (c >= 1100 && c < 1140) b |= BOTAO.CHUTE;
        if (c >= 1300 && c < 1304) b |= BOTAO.TROCAR;
        if (c >= 1350 && c < 1420) b |= BOTAO.GOLEIRO;
        e = { x: r.x, z: r.z, botoes: b };
        if (i % 2700 === 2699) acoes = ['recomecar'];
      } else if (cena === 'conducao-roteiro') {
        e = entrada(rot, (i % 3600) * PASSO, m.jogadores[0]);
        if (i % 2400 === 900) acoes = ['marcador'];
        if (i % 1800 === 1500) acoes = ['maquina'];
      } else {
        e = S.entradaDemo(m);
        if (i % 3000 === 2000) acoes = ['maquina'];
      }
      S.passoTreino(m, e, acoes);
      if (i % CADA === CADA - 1) hashes.push(hashMundo(m));
    }
    // sanidade: o treino não tem estado de partida
    if (m.times !== undefined || m.partida !== undefined) hashes.push('m.times/m.partida no treino');
    saida[sem] = hashes;
  }
  process.stdout.write(JSON.stringify(saida));
  process.exit(0);
}

// ------------------------------------------------------------------ processo principal
const rapido = args.includes('--rapido');
const NSEM = +arg('--sementes', rapido ? 4 : 20);
const MIN = +arg('--min', rapido ? 1 : 3);
const REF = arg('--ref', '980b0b0');
let JS_BASE = arg('--base', null);
if (JS_BASE) JS_BASE = path.resolve(JS_BASE);
else {
  // cópia da base pelo git (cache na pasta temporária, por commit)
  const raiz = execFileSync('git', ['-C', AQUI, 'rev-parse', '--show-toplevel']).toString().trim();
  const sha = execFileSync('git', ['-C', raiz, 'rev-parse', '--short=12', REF]).toString().trim();
  const dest = path.join(os.tmpdir(), `golaco-base-${sha}`);
  if (!fs.existsSync(path.join(dest, 'golaco/js/sim.js'))) {
    fs.mkdirSync(dest, { recursive: true });
    const tar = execFileSync('git', ['-C', raiz, 'archive', '--format=tar', REF, 'golaco/js'], { maxBuffer: 1 << 28 });
    execFileSync('tar', ['-x', '-C', dest], { input: tar });
  }
  JS_BASE = path.join(dest, 'golaco/js');
}
if (path.resolve(JS_BASE) === JS_REPO) { console.error('a base é a própria pasta do repositório'); process.exit(2); }

function rodar(jsDir, cena, sementes) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [fileURLToPath(import.meta.url), '--filho', jsDir, cena, sementes.join(','), String(MIN)]);
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', c => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error(`${cena} em ${jsDir}: ${err}`))));
  });
}

const t0 = Date.now();
const sementes = Array.from({ length: NSEM }, (_, k) => k + 1);
// lotes de até 5 sementes por processo (os dois lados em paralelo, até o número de núcleos)
const lotes = [];
for (const cena of CENAS) for (let k = 0; k < sementes.length; k += 5) lotes.push({ cena, sem: sementes.slice(k, k + 5) });
const tarefas = [];
for (const l of lotes) for (const lado of ['repo', 'base']) tarefas.push({ ...l, lado });
const res = { repo: {}, base: {} };
let prox = 0, erro = null;
async function trabalhador() {
  while (prox < tarefas.length && !erro) {
    const t = tarefas[prox++];
    try {
      const r = await rodar(t.lado === 'repo' ? JS_REPO : JS_BASE, t.cena, t.sem);
      Object.assign((res[t.lado][t.cena] ??= {}), r);
    } catch (e) { erro = e; }
  }
}
await Promise.all(Array.from({ length: Math.max(2, os.cpus().length || 2) }, trabalhador));
if (erro) { console.error(erro.message); process.exit(2); }

let falhas = 0;
console.log(`base: ${JS_BASE}\nrepositório: ${JS_REPO}\n${NSEM} sementes × ${MIN} min por cena, hash a cada ${CADA} passos`);
for (const cena of CENAS) {
  let n = 0, dif = null;
  for (const s of sementes) {
    const a = res.repo[cena][s], b = res.base[cena][s];
    for (let k = 0; k < Math.max(a.length, b.length); k++) {
      n++;
      if (a[k] !== b[k] && !dif) dif = `semente ${s}, passo ${(k + 1) * CADA}: ${a[k]} × ${b[k]}`;
    }
  }
  console.log(`${dif ? 'DIFERENTE' : 'IGUAL    '}  ${cena.padEnd(17)} ${n} hashes${dif ? ` — 1ª diferença: ${dif}` : ''}`);
  if (dif) falhas++;
}
console.log(`\nhash-igual: ${falhas ? 'REPROVOU (o treino mudou)' : 'PASSOU (treino bit a bit igual à base)'} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(falhas ? 1 : 0);
