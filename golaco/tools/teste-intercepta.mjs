// teste-intercepta (pedido do dono, 12/10: "a defesa mal intercepta passe"): a IA que marca lê a linha de passe e se
// antecipa para cortar/interceptar, SEM deixar o homem livre. Partidas IA × IA de 2 × 4 min (a IA joga pelo humano, como
// no painel), a mesma conta do painel de equilíbrio:
//  - interceptação = o passe (de linha) dominado por um adversário de linha antes de chegar ao destino (m.voo.tickChegada
//    + 0,25 s); por 100 passes do adversário. Referência: FBref (dados Opta), Premier League 2023/24 — 8,5 interceptações
//    por time por jogo (6,1 o Manchester City a 10,0 o Brentford) com ~941 passes por jogo (Opta via The Analyst):
//    ~1,8 por 100 passes do adversário. Meta 1,4–2,4;
//  - passe certo (o mesmo time com a bola depois do passe): Opta, PL 2023/24, 780 certos de 941 = 82,9%. Meta ≤ 86% (a
//    publicada ~88–89%; a faixa do painel é 75–88%);
//  - o homem livre: nos passes do adversário no meu último terço que chegam ao destino, a parte em que o recebedor domina
//    sem ninguém da IA a até 3 m — não pode subir mais que 3 pontos sobre o valor da base (--base-livre; o valor da base
//    gravada no fim deste arquivo).
//   node tools/teste-intercepta.mjs                   (lógica do repositório)
//   node tools/teste-intercepta.mjs --js <pasta>      (outra cópia, ex.: a base — tem de REPROVAR)
//   --partidas N (padrão 12) · --sem0 K (padrão 301) · --par N
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
// homem livre na base 074cfd18 (12 partidas, sementes 301–312): medido com esta mesma conta
const LIVRE_BASE = +arg('--base-livre', 0.40);

async function partida(sem) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  const R = { sem, passes: [0, 0], ok: [0, 0], intercept: [0, 0], recepcoes: 0, livres: 0 };
  const porId = new Map(m.jogadores.map(j => [j.id, j]));
  let passe = null;
  const N = Math.round(2 * 4 * 3600 + 3600);
  for (let i = 0; i < N; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    for (const e of ev) {
      const j = e.id != null ? porId.get(e.id) : null;
      if (e.tipo === 'gol' || e.tipo === 'fora' || e.tipo === 'saida') passe = null;
      else if (j && M.ehChute(m, e)) passe = null;
      else if (e.tipo === 'passe' && j) {
        passe = j.posicao !== 'GOL' ? { time: j.time, para: m.voo?.para ?? null, chega: (m.voo && m.voo.de === j.id ? m.voo.tickChegada : m.tick) + 15 } : null;
        if (passe) R.passes[j.time]++;
      }
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    if (!rolando) { passe = null; continue; }
    const dono = M.donoDaBola(m);
    if (dono && passe) {
      if (dono.time === passe.time) {
        R.ok[passe.time]++;
        // o recebedor no último terço do time dele: algum adversário de linha a até 3 m?
        if (dono.id === passe.para && M.uDe(m, dono.time, dono.x) > 17.5) {
          R.recepcoes++;
          let perto = false;
          for (const o of m.jogadores) if (o.time !== dono.time && o.posicao !== 'GOL' && Math.hypot(o.x - dono.x, o.z - dono.z) <= 3) { perto = true; break; }
          if (!perto) R.livres++;
        }
      } else if (m.tick <= passe.chega && dono.posicao !== 'GOL') R.intercept[dono.time]++;
      passe = null;
    }
  }
  return R;
}

if (args.includes('--filho')) {
  process.send(await partida(+arg('--s', 301)));
  process.exit(0);
}

const NP = +arg('--partidas', 12), S0 = +arg('--sem0', 301);
const nPar = Math.max(1, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length)));
const res = [];
let prox = 0;
const filhos = new Set();
const sair = cod => { for (const c of filhos) c.kill(); process.exit(cod); };
process.on('SIGINT', () => sair(130)); process.on('SIGTERM', () => sair(143));
await Promise.all(Array.from({ length: Math.min(nPar, NP) }, async () => {
  while (prox < NP) {
    const s = S0 + prox++;
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', '--s', String(s), '--js', JS]);
      filhos.add(c);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', (cod, sinal) => { filhos.delete(c); if (cod || sinal) erro(new Error(`semente ${s}: saiu com ${cod ?? sinal}`)); });
    }));
  }
}));
const soma = f => res.reduce((a, r) => a + f(r), 0);
const passes = soma(r => r.passes[0] + r.passes[1]), ok = soma(r => r.ok[0] + r.ok[1]), inter = soma(r => r.intercept[0] + r.intercept[1]);
const i100 = 100 * inter / passes, certo = 100 * ok / passes, livre = soma(r => r.livres) / Math.max(1, soma(r => r.recepcoes));
const f = (x, c = 1) => (Number.isFinite(x) ? x.toFixed(c).replace('.', ',') : '—');
const linhas = [['medida', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, okk) => { linhas.push([nome, medido, meta, okk ? 'PASSOU' : 'REPROVOU']); if (!okk) falhas++; };
console.log(`teste-intercepta — ${JS}: ${NP} partidas IA × IA de 2 × 4 min (sementes ${S0}–${S0 + NP - 1}); ${f(passes / NP, 0)} passes por partida`);
reg('interceptações por 100 passes do adversário', `${f(i100, 2)} (${f(inter / (2 * NP), 2)} por time por partida)`, '1,4–2,4 (PL 23/24: 1,8)', i100 >= 1.4 && i100 <= 2.4);
reg('passe certo', `${f(certo)}%`, '≤ 86% (PL 23/24: 82,9%)', certo <= 86);
reg('homem livre: recepção no último terço sem a IA a até 3 m', `${f(100 * livre)}% de ${soma(r => r.recepcoes)} (base ${f(100 * LIVRE_BASE)}%)`, `≤ base + 3 pontos`, livre <= LIVRE_BASE + 0.03);
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-intercepta: REPROVOU (${falhas})` : '\nteste-intercepta: PASSOU');
process.exit(falhas ? 1 : 0);
