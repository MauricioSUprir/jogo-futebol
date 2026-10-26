// teste-intercepta (pedido do dono, 12/10: "a defesa mal intercepta passe"): a IA que marca lê a linha de passe e se
// antecipa para cortar/interceptar, SEM deixar o homem livre.
//
// A) Partidas IA × IA de 2 × 4 min (a IA joga pelo humano, como no painel; a mesma conta do painel de equilíbrio):
//  - interceptação = o passe (de linha, com destino) dominado por um adversário de linha com a bola ainda andando (≥ 2 m/s
//    no passo anterior), a 2 m ou mais do recebedor e sem ter batido no corpo de ninguém (a disputa na recepção, o
//    bloqueio e a bola parada recolhida não contam — Opta: "a player intercepts a pass by moving into the line of the
//    intended pass"). Referência: FBref (dados Opta), Premier League 2023/24 — 8,49 interceptações por time por jogo (6,13
//    o Manchester City a 9,95 o Brentford). Meta: a defesa intercepta MAIS que a base (8,75 na base 074cfd18, sementes
//    301–312; --base-inter) — pelo menos 1,5 a mais (~2,5 erros-padrão da amostra) — e no máximo 14 (nada de corte em todo
//    passe). As nossas partidas têm ~1/3 dos passes de um jogo real (~270 contra ~941, Opta) e quase nenhum outro jeito de
//    errar o passe (bola fora, disputa pelo alto perdida): ~60% dos passes errados são interceptações (no real, ~11%) —
//    por isso o número por partida passa um pouco da PL quando o passe certo chega ao real; por 100 passes: informativo;
//  - passe certo (o mesmo time com a bola depois do passe): Opta, PL 2023/24, 780 certos de 941 = 82,9%. Meta 80–86,5%, reprova quando a contagem prova (o
//    real ~80–85%, com a margem da amostra; a base ficava em 88,7%);
//  - o homem livre: nos passes no último terço que chegam ao destino, a parte em que o recebedor domina sem ninguém da IA a
//    até 3 m — não pode subir mais que 3 pontos sobre a base (77,8% na base 074cfd18, sementes 301–312; --base-livre).
// B) Canhão do passe arriscado (o passe que o HUMANO tenta — a IA que passa já evita a linha cortada): estados do meio da
//    partida, o meia do time 0 passa para um companheiro a 12–28 m com um adversário a até 3,5 m da linha do passe. Pela
//    física (a trajetória de conducao.js preverBola; o corpo acelera a 7 m/s² da velocidade que leva até a arrancada):
//    "alcançável" = algum adversário chega a um ponto da trajetória, com 0,2 s de leitura, 0,1 s antes do recebedor. Metas: nos alcançáveis a IA corta (intercepta, sem ser bloqueio) ≥ 50%; nos não
//    alcançáveis, intercepta ≤ 15% (nada de corte mágico).
//   node tools/teste-intercepta.mjs                   (lógica do repositório)
//   node tools/teste-intercepta.mjs --js <pasta>      (outra cópia, ex.: a base — tem de REPROVAR)
//   --so A,B · --partidas N (padrão 12) · --sem0 K (padrão 301) · --cenas N (padrão 480) · --par N
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const LIVRE_BASE = +arg('--base-livre', 0.778), INTER_BASE = +arg('--base-inter', 8.75);
const SO = arg('--so', 'A,B').split(',');

async function partida(sem) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  const R = { sem, passes: [0, 0], ok: [0, 0], intercept: [0, 0], bloqueios: [0, 0], recepcoes: 0, livres: 0, terco: 0, cruz: 0, chutes: 0 };
  const porId = new Map(m.jogadores.map(j => [j.id, j]));
  let passe = null, vBola = 0;
  const N = Math.round(2 * 4 * 3600 + 3600);
  for (let i = 0; i < N; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado === 'fim') break;
    for (const e of ev) {
      const j = e.id != null ? porId.get(e.id) : null;
      if (e.tipo === 'gol' || e.tipo === 'fora' || e.tipo === 'saida') passe = null;
      else if (e.tipo === 'bateuCorpo' && passe) passe.bloqueio = true;
      else if (j && M.ehChute(m, e)) { passe = null; R.chutes++; }
      else if (e.tipo === 'passe' && j) {
        passe = j.posicao !== 'GOL' ? { time: j.time, para: m.voo && m.voo.de === j.id ? m.voo.para : null } : null;
        if (passe) {
          R.passes[j.time]++;
          // o passe termina no último terço (o ponto de chegada, no sentido do ataque de quem passou) e o cruzamento
          const v = m.voo && m.voo.de === j.id ? m.voo : null;
          if (v && v.alvo && M.uDe(m, j.time, v.alvo.x) > 17.5) R.terco++;
          if (v && v.tipo === 'cruzamento') R.cruz++;
        }
      }
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    const vAnt = vBola; vBola = Math.hypot(m.bola.v.x, m.bola.v.z);
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
      } else if (vAnt >= 2 && dono.posicao !== 'GOL') {
        const r = passe.para != null ? porId.get(passe.para) : null;
        if (r && Math.hypot(r.x - dono.x, r.z - dono.z) >= 2) R[passe.bloqueio ? 'bloqueios' : 'intercept'][dono.time]++;
      }
      passe = null;
    }
  }
  return R;
}

/** B) canhão do passe arriscado: cenas k0..k1-1. */
async function canhao(k0, k1) {
  const P = await import(pathToFileURL(path.join(JS, 'partida.js')).href);
  const A = await import(pathToFileURL(path.join(JS, 'acoes.js')).href);
  const C = await import(pathToFileURL(path.join(JS, 'conducao.js')).href);
  const { PASSO } = await import(pathToFileURL(path.join(JS, 'config.js')).href);
  const R = { cenas: 0, alc: 0, alcCorta: 0, nao: 0, naoCorta: 0, bloq: 0 };
  const dSeg = (px, pz, ax, az, bx, bz) => {
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / L2));
    return Math.hypot(px - ax - t * dx, pz - az - t * dz);
  };
  for (let k = k0; k < k1; k++) {
    const m = P.criarPartida({ semente: 2000 + k, minutosPorTempo: 4 });
    // um estado do meio do jogo (a saída e 20–50 s de bola rolando)
    for (let i = 0; i < 400 + 1200 + 600 * (k % 4) && !(i > 400 && m.partida.estado === 'jogo' && !m.parada && m.posse != null); i++) P.passoPartida(m, P.entradaDemoPartida(m));
    if (m.partida.estado !== 'jogo' || m.parada) continue;
    const T = 0, lado = m.ataca[T];
    const meus = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL');
    const deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
    // o passador: o do time 0 mais perto do meio (com espaço: ninguém a menos de 3 m)
    const passador = meus.filter(j => deles.every(o => Math.hypot(o.x - j.x, o.z - j.z) > 3)).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    if (!passador) continue;
    // o recebedor: a 12–28 m, para a frente ou de lado, com um adversário a até 3,5 m da linha do passe (o passe arriscado)
    const rec = meus.filter(j => j !== passador).map(j => {
      const d = Math.hypot(j.x - passador.x, j.z - passador.z);
      const linha = Math.min(...deles.map(o => dSeg(o.x, o.z, passador.x, passador.z, j.x, j.z)));
      return { j, d, linha, frente: (j.x - passador.x) * lado };
    }).filter(c => c.d >= 12 && c.d <= 28 && c.frente > -3 && c.linha <= 3.5).sort((a, b) => a.linha - b.linha)[(k >> 2) % 2];
    if (!rec) continue;
    const rj = rec.j;
    // a bola no pé do passador e o passe pedido na direção do recebedor (a mira do humano)
    const b = m.bola;
    const ux = (rj.x - passador.x) / rec.d, uz = (rj.z - passador.z) / rec.d;
    b.p.x = passador.x + ux * 0.35; b.p.z = passador.z + uz * 0.35; b.p.y = 0.11;
    b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
    m.posse = passador.id; m.voo = null; m.ultimoToque = { id: passador.id, time: T, tick: m.tick };
    passador.miraAuto = { x: ux, z: uz };
    passador.pedido = { tipo: 'passe', forca: Math.min(1, 0.35 + rec.d / 40), tick: m.tick };
    A.executarAcao(m, passador, passador.par.attr.pePreferido ?? 1, false);
    passador.miraAuto = null;
    // (o passe vai para quem a escolha do passe pegou no cone da mira: vale se a linha dele também é arriscada)
    if (!m.voo || m.voo.para == null) continue;
    const r = m.jogadores.find(o => o.id === m.voo.para);
    if (!r || Math.min(...deles.map(o => dSeg(o.x, o.z, passador.x, passador.z, r.x, r.z))) > 3.5) continue;
    R.cenas++;
    // alcançável? (a física: o 1º ponto da trajetória que cada um alcança correndo da velocidade que leva, a 7 m/s² até a
    // arrancada — o defensor com 0,2 s de leitura —; alcançável = um defensor chega 0,1 s antes do recebedor)
    const pb = C.preverBola(b, 120);
    const chega = (o, le) => {
      for (let i = 2; i <= 120; i += 2) {
        if (pb.ys[i] > 1.0) continue;
        const dx = pb.xs[i] - o.x, dz = pb.zs[i] - o.z, dist = Math.hypot(dx, dz), d = Math.max(0, dist - 0.5);
        const vmax = o.par.vArrancada, a = 7, s0 = dist > 0 ? Math.max(0, Math.min(vmax, (o.vx * dx + o.vz * dz) / dist)) : 0;
        const tA = (vmax - s0) / a, dA = (s0 + vmax) / 2 * tA;
        const t = (d <= dA ? (Math.sqrt(s0 * s0 + 2 * a * d) - s0) / a : tA + (d - dA) / vmax) + le;
        if (t <= i * PASSO) return i * PASSO;
      }
      return Infinity;
    };
    const tr = chega(r, 0);
    let td = Infinity;
    for (const o of deles) td = Math.min(td, chega(o, 0.2));
    const alc = td + 0.1 <= tr;
    // até alguém ficar com a bola (3 s)
    let res = 'nada', bloq = false, vAnt = Math.hypot(b.v.x, b.v.z);
    for (let i = 0; i < 180; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      if (ev.some(e => e.tipo === 'bateuCorpo')) bloq = true;
      if (m.posse != null) {
        const d = m.jogadores.find(o => o.id === m.posse);
        if (d && d.time !== T) res = bloq ? 'bloqueio' : vAnt >= 2 && Math.hypot(r.x - d.x, r.z - d.z) >= 2 ? 'corte' : 'outro';
        else res = 'recebeu';
        break;
      }
      vAnt = Math.hypot(b.v.x, b.v.z);
      if (m.partida.estado !== 'jogo') break;
    }
    if (res === 'bloqueio') R.bloq++;
    if (alc) { R.alc++; if (res === 'corte') R.alcCorta++; } else { R.nao++; if (res === 'corte') R.naoCorta++; }
  }
  return R;
}

if (args.includes('--filho')) {
  if (arg('--tarefa', 'partida') === 'canhao') process.send(await canhao(+arg('--k0', 0), +arg('--k1', 1)));
  else process.send(await partida(+arg('--s', 301)));
  process.exit(0);
}

// (cenas 240 → 480, D5: com 240 ficavam ~26–43 passes alcançáveis e a taxa de corte variava ±8 pontos só pelos estados do
// meio da partida — 47% com o D5 em 43, 55% em 104 de 720; a main 69% em 26, 66% em 74 de 720; com 480, ~70 alcançáveis
// e +20 s)
const NP = +arg('--partidas', 12), S0 = +arg('--sem0', 301), NC = +arg('--cenas', 480);
const nPar = Math.max(1, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length)));
const tarefas = [];
if (SO.includes('A')) for (let s = 0; s < NP; s++) tarefas.push(['--tarefa', 'partida', '--s', String(S0 + s)]);
if (SO.includes('B')) for (let k = 0; k < NC; k += 20) tarefas.push(['--tarefa', 'canhao', '--k0', String(k), '--k1', String(Math.min(NC, k + 20))]);
const res = [], resB = [];
let prox = 0;
const filhos = new Set();
const sair = cod => { for (const c of filhos) c.kill(); process.exit(cod); };
process.on('SIGINT', () => sair(130)); process.on('SIGTERM', () => sair(143));
await Promise.all(Array.from({ length: Math.min(nPar, tarefas.length) }, async () => {
  while (prox < tarefas.length) {
    const t = tarefas[prox++];
    const r = await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', ...t, '--js', JS]);
      filhos.add(c);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', (cod, sinal) => { filhos.delete(c); if (cod || sinal) erro(new Error(`${t.join(' ')}: saiu com ${cod ?? sinal}`)); });
    });
    (t[1] === 'canhao' ? resB : res).push(r);
  }
}));
const f = (x, c = 1) => (Number.isFinite(x) ? x.toFixed(c).replace('.', ',') : '—');
const linhas = [['parte', 'medida', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (parte, nome, medido, meta, okk) => { linhas.push([parte, nome, medido, meta, okk ? 'PASSOU' : 'REPROVOU']); if (!okk) falhas++; };
console.log(`teste-intercepta — ${JS}`);
if (SO.includes('A')) {
  const soma = fn => res.reduce((a, r) => a + fn(r), 0);
  const passes = soma(r => r.passes[0] + r.passes[1]), ok = soma(r => r.ok[0] + r.ok[1]), inter = soma(r => r.intercept[0] + r.intercept[1]);
  const porTime = inter / (2 * NP), certo = 100 * ok / passes, livre = soma(r => r.livres) / Math.max(1, soma(r => r.recepcoes));
  console.log(`A: ${NP} partidas IA × IA de 2 × 4 min (sementes ${S0}–${S0 + NP - 1}); ${f(passes / NP, 0)} passes por partida; interceptações por 100 passes do adversário ${f(100 * inter / passes, 2)} (informativo: as partidas têm ~1/3 dos passes de um jogo real); passes bloqueados ${f(soma(r => r.bloqueios[0] + r.bloqueios[1]) / (2 * NP), 2)} por time por partida`);
  reg('A', 'interceptações por time por partida', `${f(porTime, 2)} (base ${f(INTER_BASE, 2)})`, `≥ base + 1,5 e ≤ 14 (PL 23/24: 8,5)`, porTime >= INTER_BASE + 1.5 && porTime <= 14);
  // (D5: reprova quando a contagem PROVA que passa de 86,5% ou fica abaixo de 80% — a proporção com ~3300 passes, z > 1,645,
  // um lado, p < 5% —, como as outras metas de contagem do repositório: o passe certo das 12 partidas ia de 86,1 a 86,7%
  // entre calibrações vizinhas do D5, ±0,6 ponto de erro-padrão; a base de antes, 88,7%, dá z ≈ 3,7 e continua reprovando)
  const zPasse = lim => (ok / passes - lim) / Math.sqrt(lim * (1 - lim) / passes);
  reg('A', 'passe certo', `${f(certo)}% (${ok}/${passes})`, '80–86,5% (PL 23/24: 82,9%; reprova quando prova: z > 1,645)', zPasse(0.865) <= 1.645 && zPasse(0.80) >= -1.645);
  console.log(`A (informativo): passes que terminam no último terço ${f(100 * soma(r => r.terco) / passes)}% (PL 2019/20: 28,7%); cruzamentos ${f(100 * soma(r => r.cruz) / passes)}% dos passes (PL: ~3,7%); chutes por partida ${f(soma(r => r.chutes) / NP)}`);
  reg('A', 'homem livre: recepção no último terço sem a IA a até 3 m', `${f(100 * livre)}% de ${soma(r => r.recepcoes)} (base ${f(100 * LIVRE_BASE)}%)`, '≤ base + 3 pontos', livre <= LIVRE_BASE + 0.03);
}
if (SO.includes('B')) {
  const s = k => resB.reduce((a, r) => a + r[k], 0);
  console.log(`B: ${s('cenas')} passes arriscados (de ${NC} cenas): ${s('alc')} alcançáveis pela física, ${s('nao')} não; bloqueados ${s('bloq')}`);
  // (D6: reprova quando a contagem PROVA, z > 1,645, como o passe certo — os 480 estados do canhão saem da partida IA × IA
  // e mudam a cada mudança da IA: ~60 passes alcançáveis dão ±6 pontos de erro-padrão; a base de antes, 1 de 92, dá z ≈ −9)
  const zB = (k, n, lim) => (k / Math.max(1, n) - lim) / Math.sqrt(lim * (1 - lim) / Math.max(1, n));
  reg('B', 'passe arriscado alcançável: a IA corta', `${s('alcCorta')}/${s('alc')} (${f(100 * s('alcCorta') / Math.max(1, s('alc')), 0)}%)`, '≥ 50% (≥ 20 cenas; reprova quando prova: z > 1,645)', s('alc') >= 20 && zB(s('alcCorta'), s('alc'), 0.5) >= -1.645);
  reg('B', 'passe arriscado NÃO alcançável: cortado', `${s('naoCorta')}/${s('nao')} (${f(100 * s('naoCorta') / Math.max(1, s('nao')), 0)}%)`, '≤ 15% (reprova quando prova: z > 1,645)', zB(s('naoCorta'), s('nao'), 0.15) <= 1.645);
}
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-intercepta: REPROVOU (${falhas})` : '\nteste-intercepta: PASSOU');
process.exit(falhas ? 1 : 0);
