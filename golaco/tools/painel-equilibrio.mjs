// Painel de equilíbrio da partida (Etapa 4; pedido do dono, seção 11): muitas partidas IA × IA na duração padrão
// (2 tempos de 4 min reais), em paralelo, e todas as medidas numa tabela só — com a faixa da meta e o intervalo de
// 95% da média (amostra pequena engana: decidir com 144 partidas ou mais, mesmas sementes para comparar versões).
// A IA joga também pelo controlado do time 0 (entradaDemoPartida, como o teste-intensidade).
//
// Definições (as mesmas da StatsBomb/Opta, onde dá):
//  - chute = o evento 'chute' ou o cabeceio para o gol (lib/partida-medidas.mjs ehChute). Desfecho, até 4 s: gol
//    (gol do time de quem chutou), defesa (do goleiro adversário), bloqueado (bateu no corpo de alguém), fora (a bola
//    saiu ou a jogada acabou). No alvo = gol + defesa. Defesas do goleiro = defesa ÷ (defesa + gol), por distância
//    do chute ao centro do gol: < 6 m · 6–16,5 m · ≥ 16,5 m (meta do dono: 66–72% no total, 55–60% de 6 a 16,5 m e
//    ~85% de fora da área), SEM os pênaltis (eles têm a linha própria). Gol contra não conta como chute.
//  - dentro da área = a bola no chute dentro da grande área adversária (16,5 m × 40,32 m).
//  - passe certo: o próximo jogador a ter a bola é do time de quem passou (bola fora ou gol antes = errado); passes do
//    goleiro de fora (a mesma conta do teste-intensidade).
//  - posse: começa quando um time ganha a bola (domínio de um jogador dele) ou na cobrança dele; acaba quando o
//    outro time domina ou a bola sai. Chegou ao último terço = a bola esteve a ≥ 17,5 m do meio, no campo de ataque.
//  - origem do gol, pela posse que terminou nele (como o "play pattern" da StatsBomb): bola parada = a posse começou
//    num escanteio, lateral, falta ou pênalti; erro na saída de bola = começou numa recuperação a ≤ 40 m do gol
//    adversário e o gol saiu em ≤ 15 s (high turnover, Opta); contra-ataque = começou numa recuperação mais atrás e o
//    gol saiu em ≤ 15 s; jogada trabalhada = o resto (inclui saída de bola e tiro de meta).
//  - impedimentos, faltas, cartões e pênaltis: contados pelos eventos 'impedimento', 'falta', 'cartao' e 'penalti'
//    (Etapa 4; antes deles existirem a linha mostra 0 e "ainda não existe").
//
//   node tools/painel-equilibrio.mjs                       (144 partidas, sementes 1001…)
//   node tools/painel-equilibrio.mjs --n 48 --sem0 101     (outra amostra)
//   node tools/painel-equilibrio.mjs --js <pasta js>       (outra cópia da lógica, ex.: a publicada)
//   node tools/painel-equilibrio.mjs --base <pasta js>     (roda as duas com as MESMAS sementes, lado a lado)
//   node tools/painel-equilibrio.mjs --json saida.json     (grava as partidas, para comparar depois)
//   node tools/painel-equilibrio.mjs --base-json saida.json (a base é a rodada gravada: não roda de novo)
//   node tools/painel-equilibrio.mjs --set IA_ATAQUE.utilidade.chute=3 (repetível: constante trocada só na versão medida)
//   node tools/painel-equilibrio.mjs --retomar parciais.jsonl (grava cada partida; de novo, continua de onde parou;
//                                                          com --parcial, só mostra as que já estão lá)
//   --par N (processos; padrão: CPUs)   --min 4 (minutos reais por tempo)   --estrito (sai com 1 fora da meta)
//   node tools/painel-equilibrio.mjs --partes a.json,b.json,... [--base <pasta js>]
//        junta partes gravadas com --json (as mesmas versões, sementes diferentes) e monta a tabela de todas, sem
//        rodar nada — é como o CI roda as 144 partidas em pedaços (.github/workflows/golaco-painel.yml)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const BASE = arg('--base', null) ? path.resolve(arg('--base')) : null;
const MIN_TEMPO = +arg('--min', 4);
const ABERTO = 240;          // ticks: até quando o desfecho do chute é procurado (4 s)
const RAPIDO = 15 * 60;      // ticks: contra-ataque / erro na saída de bola = gol em até 15 s da recuperação
const ALTO = 52.5 - 40;      // u: recuperação a ≤ 40 m do gol adversário (high turnover)
const BOLA_PARADA = new Set(['escanteio', 'lateral', 'falta', 'tiroLivre', 'penalti']);

// ------------------------------------------------------------------ uma partida (processo filho)
async function partida(pastaJs, sem) {
  // --set CONST.caminho=valor (repetível; valor em JSON): troca uma constante do config.js antes da partida (triagem de
  // calibração; as constantes são lidas na hora pelos módulos)
  const sets = args.flatMap((a, i) => (a === '--set' ? [args[i + 1]] : []));
  if (sets.length) {
    const CF = await import(pathToFileURL(path.join(pastaJs, 'config.js')).href);
    for (const s of sets) {
      const [chave, valor] = [s.slice(0, s.indexOf('=')), s.slice(s.indexOf('=') + 1)];
      const partes = chave.split('.');
      let o = CF[partes[0]];
      for (const p of partes.slice(1, -1)) o = o[p];
      if (!o || !(partes[partes.length - 1] in o)) throw new Error(`--set: ${chave} não existe`);
      o[partes[partes.length - 1]] = JSON.parse(valor);
    }
  }
  const P = await import(pathToFileURL(path.join(pastaJs, 'partida.js')).href);
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: MIN_TEMPO });
  const R = {
    sem, gols: [0, 0], golsContra: 0, chutes: [], passes: 0, passesOk: 0, posse: [0, 0], intercept: [0, 0],
    posses: 0, possesTerco: 0, origem: { trabalhada: 0, contra: 0, erroSaida: 0, bolaParada: 0, outro: 0 },
    golsFora: 0, cobrancas: {}, impedimentos: 0, faltas: 0, amarelos: 0, vermelhos: 0, penaltis: { total: 0, gol: 0, defesa: 0, fora: 0 },
    ticks: 0,
    // jogo aéreo (entrega "cabeceio na bola rolando"): cabeceios, cabeceios a gol, duelos pelo alto (com a bola rolando =
    // fora da bola parada), gols de cabeça (o chute que virou gol foi um cabeceio); chutes por time
    cabeceios: 0, cabGol: 0, duelos: 0, duelosRolando: 0, golsCabeca: 0, chutesT: [0, 0],
  };
  const porId = new Map(m.jogadores.map(j => [j.id, j]));
  const jog = id => porId.get(id) ?? m.jogadores.find(j => j.id === id);
  let passe = null, aberto = null, pos = null, vBola = 0;
  const N = Math.round(2 * MIN_TEMPO * 3600 + 3600);
  const novaPosse = (time, tipo) => {
    pos = { time, tipo, tick: m.tick, u0: M.uDe(m, time, m.bola.p.x), terco: false };
    R.posses++;
  };
  const fecharChute = res => { if (aberto) { aberto.res = res; R.chutes.push(aberto); aberto = null; } };
  for (let i = 0; i < N; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m));
    R.ticks++;
    for (const e of ev) {
      const j = e.id != null ? jog(e.id) : null;
      switch (e.tipo) {
        case 'gol': {
          const autor = e.autor != null ? jog(e.autor) : null;
          if (autor && autor.time !== e.time) R.golsContra++;
          R.gols[e.time]++;
          if (aberto && aberto.time === e.time) {
            if (!aberto.dentro) R.golsFora++;
            if (aberto.cab) R.golsCabeca++;
            fecharChute('gol');
          } else fecharChute(aberto ? 'fora' : null);
          // origem pela posse que terminou no gol
          let o = 'outro';
          if (pos && pos.time === e.time) {
            if (BOLA_PARADA.has(pos.tipo)) o = 'bolaParada';
            else if (pos.tipo === 'recuperacao' && m.tick - pos.tick <= RAPIDO) o = pos.u0 >= ALTO ? 'erroSaida' : 'contra';
            else o = 'trabalhada';
          }
          R.origem[o]++;
          passe = null; pos = null;
          break;
        }
        case 'defesa':
          if (aberto && j && j.time !== aberto.time) fecharChute('defesa');
          break;
        case 'bateuCorpo':
          if (aberto && j && j.id !== aberto.id && j.posicao !== 'GOL') fecharChute('bloqueado');
          if (passe) passe.bloqueio = true;
          break;
        case 'fora':
          fecharChute('fora'); passe = null; pos = null;
          break;
        case 'cobranca':
          R.cobrancas[e.parada] = (R.cobrancas[e.parada] ?? 0) + 1;
          if (j) novaPosse(j.time, e.parada);
          break;
        case 'disputaAerea': R.duelos++; if (e.bolaParada === false) R.duelosRolando++; break;
        case 'impedimento': R.impedimentos++; break;
        case 'falta': R.faltas++; break;
        case 'cartao': if (e.cor === 'vermelho') R.vermelhos++; else R.amarelos++; break;
        case 'penalti':
          R.penaltis.total++;
          if (e.resultado && R.penaltis[e.resultado] != null) R.penaltis[e.resultado]++;
          break;
        default:
          if (j && e.tipo === 'passe' && e.modo === 'cabeceio') R.cabeceios++;
          if (j && M.ehChute(m, e)) {
            fecharChute('fora');
            const u = M.uDe(m, j.time, m.bola.p.x), w = M.wDe(m, j.time, m.bola.p.z);
            const dist = Math.hypot(52.5 - u, w);
            // (a cobrança de pênalti é marcada: as defesas do goleiro contam sem ela — o pênalti tem a linha dele)
            const pen = ev.some(x => x.tipo === 'cobranca' && x.parada === 'penalti');
            const cab = e.tipo === 'passe';
            if (cab) R.cabGol++;
            R.chutesT[j.time]++;
            aberto = { time: j.time, id: j.id, tick: m.tick, dist, dentro: u > 52.5 - 16.5 && Math.abs(w) < 20.16, res: null, penalti: pen, cab };
            passe = null;
          } else if (e.tipo === 'passe' && j) {
            // (o adversário com a bola ainda andando, ≥ 2 m/s, e a 2 m ou mais do recebedor = interceptação na linha)
            passe = j.posicao !== 'GOL' ? { time: j.time, para: m.voo && m.voo.de === j.id ? m.voo.para : null } : null;
            if (j.posicao !== 'GOL') R.passes++;
          }
      }
    }
    if (aberto && m.tick - aberto.tick > ABERTO) fecharChute('fora');
    if (m.partida.estado === 'fim') break;
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    const vAnt = vBola; vBola = Math.hypot(m.bola.v.x, m.bola.v.z);
    if (!rolando) { passe = null; continue; }
    const dono = M.donoDaBola(m);
    if (dono && passe) {
      if (dono.time === passe.time) R.passesOk++;
      else if (vAnt >= 2 && dono.posicao !== 'GOL') {
        // na LINHA do passe: com destino, a 2 m ou mais do recebedor (a disputa na recepção não conta; Opta: "moving into
        // the line of the intended pass")
        const r = passe.para != null ? jog(passe.para) : null;
        // (a bola que bateu no corpo de alguém no caminho é bloqueio, não interceptação — Opta conta à parte)
        if (r && !passe.bloqueio && Math.hypot(r.x - dono.x, r.z - dono.z) >= 2) R.intercept[dono.time]++;
      }
      passe = null;
    }
    const tc = M.timeComBola(m);
    if (tc != null) R.posse[tc]++;
    if (dono && (!pos || pos.time !== dono.time)) novaPosse(dono.time, 'recuperacao');
    if (pos && !pos.terco && M.uDe(m, pos.time, m.bola.p.x) >= 17.5) { pos.terco = true; R.possesTerco++; }
  }
  fecharChute('fora');
  R.placar = [m.placar?.[0] ?? R.gols[0], m.placar?.[1] ?? R.gols[1]];
  return R;
}

if (args.includes('--filho')) {
  process.send(await partida(arg('--pasta'), +arg('--s', 1)));
  process.exit(0);
}

// ------------------------------------------------------------------ processo principal
const NS = +arg('--n', 144), S0 = +arg('--sem0', 1001);
let SEMENTES = Array.from({ length: NS }, (_, k) => S0 + k);
const nPar = Math.max(1, +arg('--par', os.availableParallelism?.() ?? os.cpus().length));
const sem = a => { const n = a.length, mu = a.reduce((x, y) => x + y, 0) / n; return n > 1 ? Math.sqrt(a.reduce((x, y) => x + (y - mu) ** 2, 0) / (n - 1) / n) : 0; };

// --retomar <arquivo>: cada partida terminada da versão medida vai para o arquivo (uma linha JSON); rodando de novo com o
// mesmo arquivo (e as mesmas opções), as sementes já feitas não rodam outra vez — numa máquina dividida o processo pode cair
// no meio das 144 partidas (limite de tempo) e a rodada continua de onde parou
const RETOMAR = arg('--retomar', null);
// --parcial (com --retomar): só as sementes que já estão no arquivo (uma olhada no meio da rodada, sem rodar nada)
if (RETOMAR && args.includes('--parcial')) {
  const tem = new Set(fs.existsSync(RETOMAR) ? fs.readFileSync(RETOMAR, 'utf8').split('\n').filter(l => l.trim()).map(l => JSON.parse(l).sem) : []);
  SEMENTES = SEMENTES.filter(s => tem.has(s));
}
async function rodar(pastaJs) {
  if (!fs.existsSync(path.join(pastaJs, 'partida.js'))) throw new Error(`${pastaJs}: sem partida.js`);
  const res = [];
  const ret = RETOMAR && pastaJs === JS ? RETOMAR : null;
  const ja = new Set();
  if (ret && fs.existsSync(ret)) {
    for (const l of fs.readFileSync(ret, 'utf8').split('\n')) {
      if (!l.trim()) continue;
      const r = JSON.parse(l);
      if (SEMENTES.includes(r.sem) && !ja.has(r.sem)) { ja.add(r.sem); res.push(r); }
    }
  }
  const falta = SEMENTES.filter(s => !ja.has(s));
  let prox = 0, feitas = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: Math.min(nPar, falta.length) }, async () => {
    while (prox < falta.length) {
      const s = falta[prox++];
      res.push(await new Promise((ok, erro) => {
        const sets = pastaJs === JS ? args.flatMap((a, i) => (a === '--set' ? ['--set', args[i + 1]] : [])) : [];
        const c = fork(fileURLToPath(import.meta.url), ['--filho', '--pasta', pastaJs, '--s', String(s), '--min', String(MIN_TEMPO), ...sets]);
        c.on('message', r => { if (ret) fs.appendFileSync(ret, JSON.stringify(r) + '\n'); ok(r); }); c.on('error', erro);
        c.on('exit', cod => { if (cod) erro(new Error(`semente ${s}: saiu com ${cod}`)); });
      }));
      feitas++;
      if (process.stderr.isTTY) process.stderr.write(`\r${path.basename(path.dirname(pastaJs))}: ${feitas}/${SEMENTES.length}`);
    }
  }));
  if (process.stderr.isTTY) process.stderr.write('\n');
  res.sort((a, b) => a.sem - b.sem);
  return { res, s: (Date.now() - t0) / 1000 };
}

/** As medidas da seção 11 (e do goleiro, seção 8) sobre um conjunto de partidas. */
function medidas(res) {
  const n = res.length;
  const soma = f => res.reduce((a, r) => a + f(r), 0);
  const ch = res.flatMap(r => r.chutes);
  const nc = ch.length, cnt = f => ch.filter(f).length;
  const golsCh = cnt(c => c.res === 'gol'), def = cnt(c => c.res === 'defesa');
  const golsPart = res.map(r => r.gols[0] + r.gols[1]);
  const gols = soma(r => r.gols[0] + r.gols[1]);
  const pct = (a, b) => (b ? 100 * a / b : NaN);
  // defesas do goleiro sem os pênaltis (StatsBomb/Opta: o pênalti tem a conta dele)
  const goleiro = (f) => { const g = cnt(c => c.res === 'gol' && !c.penalti && f(c)), d = cnt(c => c.res === 'defesa' && !c.penalti && f(c)); return { v: pct(d, d + g), n: d + g }; };
  const orig = k => soma(r => r.origem[k]);
  const golsAberto = gols;
  const pen = { total: soma(r => r.penaltis.total), gol: soma(r => r.penaltis.gol), defesa: soma(r => r.penaltis.defesa), fora: soma(r => r.penaltis.fora) };
  const p0 = soma(r => r.posse[0]), p1 = soma(r => r.posse[1]);
  return {
    n,
    gols: gols / n, golsIC: 1.96 * sem(golsPart),
    chutes: nc / n,
    conversao: pct(golsCh, nc),
    noAlvo: pct(golsCh + def, nc),
    fora: pct(cnt(c => !c.dentro), nc),
    longe: pct(cnt(c => c.dist >= 25), nc),
    golsFora: pct(soma(r => r.golsFora), golsCh),
    passe: pct(soma(r => r.passesOk), soma(r => r.passes)), passes: soma(r => r.passes) / n,
    // (partidas gravadas antes da contagem não têm r.intercept: NaN)
    interc100: res.every(r => r.intercept) ? 100 * soma(r => r.intercept[0] + r.intercept[1]) / soma(r => r.passes) : NaN,
    intercT: res.every(r => r.intercept) ? soma(r => r.intercept[0] + r.intercept[1]) / (2 * n) : NaN,
    terco: pct(soma(r => r.possesTerco), soma(r => r.posses)), posses: soma(r => r.posses) / n,
    impedimentos: soma(r => r.impedimentos) / n,
    faltas: soma(r => r.faltas) / n, amarelos: soma(r => r.amarelos) / n, vermelhos: soma(r => r.vermelhos) / n,
    pen, penGol: pct(pen.gol, pen.total), penDef: pct(pen.defesa, pen.total), penFora: pct(pen.fora, pen.total),
    gk: goleiro(() => true), gk6: goleiro(c => c.dist < 6), gkMeio: goleiro(c => c.dist >= 6 && c.dist < 16.5), gkFora: goleiro(c => c.dist >= 16.5),
    origem: { trabalhada: pct(orig('trabalhada'), golsAberto), contra: pct(orig('contra'), golsAberto), erroSaida: pct(orig('erroSaida'), golsAberto), bolaParada: pct(orig('bolaParada'), golsAberto), outro: pct(orig('outro'), golsAberto) },
    golsContra: soma(r => r.golsContra) / n,
    bloqueados: pct(cnt(c => c.res === 'bloqueado'), nc),
    escanteios: soma(r => r.cobrancas.escanteio ?? 0) / n,
    laterais: soma(r => r.cobrancas.lateral ?? 0) / n,
    posse0: pct(p0, p0 + p1),
    cabeceios: soma(r => r.cabeceios ?? 0) / n, cabGol: soma(r => r.cabGol ?? 0) / n,
    duelos: soma(r => r.duelos ?? 0) / n, duelosRolando: soma(r => r.duelosRolando ?? 0) / n,
    golsCabeca: pct(soma(r => r.golsCabeca ?? 0), golsCh),
    chutes0: soma(r => r.chutesT?.[0] ?? 0) / n, chutes1: soma(r => r.chutesT?.[1] ?? 0) / n,
  };
}

const f = (v, c = 1) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const dentro = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
/** Linhas do painel: [nome, meta, ok?(meta), valor(medidas)]. ok = null: informativo (sem meta do dono). */
const LINHAS = [
  ['gols por partida', '2,3–3,5', x => dentro(x.gols, 2.3, 3.5), x => `${f(x.gols, 2)} ± ${f(x.golsIC, 2)}`],
  ['chutes por partida', '—', null, x => f(x.chutes)],
  ['conversão (gols ÷ chutes)', '9–14%', x => dentro(x.conversao, 9, 14), x => `${f(x.conversao)}%`],
  ['chutes no alvo', '~1/3 (28–38%)', x => dentro(x.noAlvo, 28, 38), x => `${f(x.noAlvo)}%`],
  ['chutes de fora da área', '35–40%', x => dentro(x.fora, 35, 40), x => `${f(x.fora)}%`],
  ['chutes de 25 m ou mais', '≤ 15%', x => Number.isFinite(x.longe) && x.longe <= 15, x => `${f(x.longe)}%`],
  ['gols de fora da área', '12–18%', x => dentro(x.golsFora, 12, 18), x => `${f(x.golsFora)}%`],
  ['passe certo', '75–88%', x => dentro(x.passe, 75, 88), x => `${f(x.passe)}% (${f(x.passes, 0)} por partida)`],
  // interceptações (FBref/Opta, PL 2023/24: 8,5 por time por jogo, 6,1–10,0 entre os times): o passe dominado por um
  // adversário de linha antes de chegar ao destino, a 2 m ou mais do recebedor (na linha). Por partida, como o jogador vê; as
  // nossas têm ~1/3 dos passes e quase nenhum outro jeito de errar o passe, então o teto passa um pouco da PL (teste-intercepta)
  ['interceptações na linha por time por partida', '8,5–14 (PL 23/24: 8,5)', x => Number.isFinite(x.intercT) && dentro(x.intercT, 8.5, 14), x => `${f(x.intercT, 2)} (${f(x.interc100, 2)} por 100 passes do adversário)`],
  ['posses que chegam ao último terço', '35–45%', x => dentro(x.terco, 35, 45), x => `${f(x.terco)}% (${f(x.posses, 0)} posses)`],
  ['impedimentos por partida', '≥ 1', x => x.impedimentos >= 1, x => x.impedimentos ? f(x.impedimentos, 2) : '0 (ainda não existe)'],
  ['pênaltis: gol / defesa / fora', '~76 / 18 / 6%', x => x.pen.total >= 10 && dentro(x.penGol, 70, 82), x => x.pen.total ? `${f(x.penGol, 0)} / ${f(x.penDef, 0)} / ${f(x.penFora, 0)}% (${x.pen.total})` : '0 (ainda não existe)'],
  ['goleiro: defesas nos chutes no alvo', '66–72%', x => dentro(x.gk.v, 66, 72), x => `${f(x.gk.v)}% (${x.gk.n})`],
  ['goleiro: chutes de 6 a 16,5 m', '55–60%', x => dentro(x.gkMeio.v, 55, 60), x => `${f(x.gkMeio.v)}% (${x.gkMeio.n})`],
  ['goleiro: chutes de 16,5 m ou mais', '~85% (80–90%)', x => dentro(x.gkFora.v, 80, 90), x => `${f(x.gkFora.v)}% (${x.gkFora.n})`],
  ['goleiro: chutes a menos de 6 m', '—', null, x => `${f(x.gk6.v)}% (${x.gk6.n})`],
  ['origem: jogada trabalhada / contra-ataque', '—', null, x => `${f(x.origem.trabalhada, 0)}% / ${f(x.origem.contra, 0)}%`],
  ['origem: erro na saída de bola', '—', null, x => `${f(x.origem.erroSaida, 0)}%`],
  ['origem: bola parada', '20–30% (Opta, PL 24/25–25/26)', x => dentro(x.origem.bolaParada, 20, 30), x => `${f(x.origem.bolaParada, 0)}%${x.origem.outro ? ` (outros ${f(x.origem.outro, 0)}%)` : ''}`],
  ['faltas / amarelos / vermelhos por partida', '—', null, x => x.faltas || x.amarelos ? `${f(x.faltas)} / ${f(x.amarelos, 2)} / ${f(x.vermelhos, 2)}` : '0 (ainda não existe)'],
  ['chutes bloqueados', '—', null, x => `${f(x.bloqueados)}%`],
  ['escanteios / laterais por partida', '—', null, x => `${f(x.escanteios)} / ${f(x.laterais)}`],
  ['gols contra por partida', '—', null, x => f(x.golsContra, 2)],
  ['posse do time 0 (soma)', '—', null, x => `${f(x.posse0)}%`],
  ['chutes por partida: time 0 / time 1', '—', null, x => `${f(x.chutes0)} / ${f(x.chutes1)}`],
  // jogo aéreo (Opta Analyst, PL 2023/24: 203 de 1.246 gols de cabeça, 16%; FA/Opta: zagueiros cabeceiam ~2× os atacantes)
  ['gols de cabeça', '8–18% (PL 23/24: 16%)', x => dentro(x.golsCabeca, 8, 18), x => `${f(x.golsCabeca)}%`],
  ['cabeceios por partida (a gol)', '—', null, x => `${f(x.cabeceios)} (${f(x.cabGol)})`],
  ['duelos pelo alto por partida (com a bola rolando)', '—', null, x => `${f(x.duelos)} (${f(x.duelosRolando)})`],
];

const versoes = [];
// --base-json <arquivo>: a base vem de uma rodada gravada com --json (as MESMAS sementes; a máquina dividida não roda a
// base de novo a cada comparação)
const BASE_JSON = arg('--base-json', null);
if (BASE_JSON) {
  const g = JSON.parse(fs.readFileSync(BASE_JSON, 'utf8'));
  const e = g.find(x => x.nome === 'base') ?? g[g.length - 1];
  const res = e.partidas.filter(r => SEMENTES.includes(r.sem)).sort((a, b) => a.sem - b.sem);
  if (res.length !== SEMENTES.length) throw new Error(`${BASE_JSON}: ${res.length} de ${SEMENTES.length} sementes`);
  versoes.push({ nome: 'base', pasta: `${e.pasta} (gravada em ${path.basename(BASE_JSON)})`, res, s: 0, gravada: true });
} else if (BASE) versoes.push({ nome: 'base', pasta: BASE });
versoes.push({ nome: BASE || BASE_JSON ? 'agora' : 'medido', pasta: JS });
if (arg('--partes', null)) {
  // junta as partes (cada uma gravada com --json, as versões na mesma ordem: base, agora)
  const lidas = arg('--partes').split(',').filter(Boolean).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
  if (lidas.some(l => l.length !== versoes.length)) throw new Error(`--partes: cada parte tem de ter ${versoes.length} versão(ões) (use o mesmo --base de quando gravou)`);
  versoes.forEach((v, i) => { v.res = lidas.flatMap(l => l[i].partidas).sort((a, b) => a.sem - b.sem); v.s = 0; v.x = medidas(v.res); });
} else for (const v of versoes) { if (!v.gravada) { const r = await rodar(v.pasta); v.res = r.res; v.s = r.s; } v.x = medidas(v.res); }

if (arg('--partes', null)) {
  const ss = versoes[versoes.length - 1].res.map(r => r.sem);
  console.log(`Painel de equilíbrio — ${ss.length} partidas IA × IA (sementes ${Math.min(...ss)}–${Math.max(...ss)}), juntadas de ${arg('--partes').split(',').filter(Boolean).length} partes`);
} else console.log(`Painel de equilíbrio — ${SEMENTES.length} partidas IA × IA de 2 × ${MIN_TEMPO} min (sementes ${S0}–${S0 + NS - 1}${SEMENTES.length < NS ? `: as ${SEMENTES.length} já feitas` : ''}), ${nPar} processos`);
for (const v of versoes) console.log(`  ${v.nome}: ${v.pasta} (${f(v.s, 0)} s)`);
const cab = ['medida', 'meta', ...versoes.map(v => v.nome)];
const tab = [cab];
let fora = 0;
for (const [nome, meta, ok, val] of LINHAS) {
  const cel = versoes.map(v => {
    const s = val(v.x);
    if (!ok) return s;
    const passa = ok(v.x);
    if (!passa && v === versoes[versoes.length - 1]) fora++;
    return `${passa ? '✓' : '✗'} ${s}`;
  });
  tab.push([nome, meta, ...cel]);
}
const larg = cab.map((_, c) => Math.max(...tab.map(l => String(l[c]).length)));
console.log(tab.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(`\n${fora} medida(s) com meta fora da faixa (✗). Gols: média ± intervalo de 95%.`);
if (arg('--json', null)) {
  fs.writeFileSync(arg('--json'), JSON.stringify(versoes.map(v => ({ nome: v.nome, pasta: v.pasta, medidas: v.x, partidas: v.res })), null, 1));
  console.log(`partidas gravadas em ${arg('--json')}`);
}
process.exit(args.includes('--estrito') && fora ? 1 : 0);
