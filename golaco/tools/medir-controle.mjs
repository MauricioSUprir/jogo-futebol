// Controle de bola em jogo (pedido do dono, 10/10: "os jogadores podem ter um controle de bola melhor").
// Mede no jogo de verdade — não em cena montada — para decidir se a condução precisa mudar (a condução "está
// bem boa, continue assim": só mexer com medida). Cenas:
//  - partida IA × IA (a IA joga pelo humano: entradaDemoPartida);
//  - partida com humano roteirizado: a entrada da demo SEM a marca da IA (recebe como humano) e, quando a
//    bola vem para o controlado, o analógico já vai para um lado sorteado e fica lá até ele dominar ("eu já
//    mudo o analógico pro lado que eu quero") e por mais 0,6 s com a bola (segue para onde queria ir);
//  - treino de ataque, IA e humano roteirizado do mesmo jeito.
// Medidas:
//  1. domínio que escapa: dos domínios sem adversário a < 3 m nos 0,6 s seguintes e sem passe/chute dele,
//     quantos têm a bola a > 2 m de quem dominou (ou com outro) 0,6 s depois — meta ≤ 2% (fora da conta: bola
//     parada, gol ou intervalo nesse tempo — a bola é recolocada — e a bola que sai do campo);
//  2. perdas sozinho (a bola fica longe e a posse cai sem adversário a < 3 m) — meta ≈ 0 (por 90 min);
//  3. distância bola–pé na condução por velocidade do corpo (p50/p95; pé mais perto: o plantado ou o
//     desenhado no balanço);
//  4. 1º toque por atributo de controle: bola a quantos m do jogador 0,5 s depois do domínio (p50/p95, com
//     ou sem adversário perto) — o bom tem que ser mais limpo que o fraco;
//  5. recepção do humano roteirizado: com a bola a ≤ 3 m ainda vindo para ele, quantas vezes o corpo se
//     afastou dela > 0,15 m somando o que a distância cresce com ele indo para longe (o defeito que o dono
//     viu; a bola que passa longe de quem não chega não conta) — meta 0.
//   node tools/medir-controle.mjs [--js <pasta js>] [--sementes 3] [--min 3] [--json saida.json] [--cenas 0,1]
//                                 [--sonda tipo,h|i,sem,tick]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt, percentil } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const NSEM = +arg('--sementes', 3), MIN = +arg('--min', 3);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const SONDA_ARG = args.includes('--sonda');
// --sonda partida,h,1017,5219: imprime 45 ticks em volta do tick na cena (h = humano roteirizado, i = IA)
const SONDA = (() => { const v = arg('--sonda', null); if (!v) return null; const [tipo, h, sem, t] = v.split(','); return { tipo, humano: h === 'h', sem: +sem, t: +t }; })();
const P = await imp('partida.js'), S = await imp('sessao.js'), C = await imp('config.js');
const R = SONDA_ARG ? await imp('recepcao.js') : null;

const FAIXAS = [[0, 2, 'parado/andando (< 2 m/s)'], [2, 5, 'trote (2–5 m/s)'], [5, 7, 'corrida (5–7 m/s)'], [7, 99, 'arrancada (≥ 7 m/s)']];
const GRUPOS = [[0, 70, 'controle < 70'], [70, 80, 'controle 70–79'], [80, 101, 'controle ≥ 80']];

function novoAcum() {
  return { dominios: 0, dominiosLivres: 0, escapes: 0, perdas: 0, perdasSozinho: 0, minutos: 0, pe: FAIXAS.map(() => []), toque1: GRUPOS.map(() => []), recep: 0, afastou: 0, exAfastou: [], exEscapa: [], exPerda: [] };
}

/** Gerador simples do roteiro (sem tocar no gerador do mundo). */
function gerador(sem) {
  let s = (sem * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

/** Roda uma cena e acumula em A. tipo: 'partida' | 'treino'; humano: roteiro do humano (true) ou IA. */
function rodar(tipo, humano, sem, A) {
  const m = tipo === 'partida' ? P.criarPartida({ semente: sem, minutosPorTempo: MIN }) : S.criarTreino({ semente: sem });
  const passoX = tipo === 'partida' ? (e => P.passoPartida(m, e)) : (e => S.passoTreino(m, e));
  const demo = tipo === 'partida' ? (() => P.entradaDemoPartida(m)) : (() => S.entradaDemo(m));
  const N = tipo === 'partida' ? Math.round(2 * MIN * 3600) + 600 : MIN * 2 * 3600;
  const r = gerador(sem * 7 + (humano ? 1 : 0));
  const porId = new Map(m.jogadores.map(j => [j.id, j]));
  const timeDe = id => porId.get(id)?.time;
  const pendentes = []; // domínios acompanhados por 0,6 s
  let lado = null, recebendo = null, minD = Infinity, dAnt = 0, seguir = -1; // minD: o quanto já se afastou nesta recepção (−1: contado)
  const advPerto = (x, z, time, raio) => m.jogadores.some(o => o.time !== time && o.posicao !== 'GOL' && Math.hypot(o.x - x, o.z - z) < raio);
  for (let i = 0; i < N; i++) {
    let e = demo();
    if (humano) {
      e = { x: e.x, z: e.z, botoes: e.botoes };
      const j = porId.get(m.controlado[0]);
      const vem = j && m.posse == null && m.naMao == null && j.recebe != null;
      // dominou: segue para o lado que queria por 0,6 s (a intenção de quem já virou o analógico) — sem isso a
      // entrada da demo puxava para outro lado logo depois do domínio orientado e "perdia" a bola sozinha
      if (j && m.posse === j.id && recebendo === j.id && lado) { seguir = m.tick + 36; recebendo = null; }
      if (j && m.posse === j.id && m.tick < seguir && lado) e = { x: lado.x, z: lado.z, botoes: 0 };
      else if (vem) {
        if (recebendo !== j.id) { recebendo = j.id; const a = r() * 2 * Math.PI; lado = { x: Math.cos(a), z: Math.sin(a) }; minD = Infinity; }
        e = { x: lado.x, z: lado.z, botoes: 0 };
        // recepção: a bola a ≤ 3 m, ainda vindo para ele (não passou) — o corpo não pode se afastar dela: soma o
        // quanto a distância cresce com o corpo indo para longe da bola (> 0,3 m/s); mais de 0,15 m = se afastou
        const b = m.bola, dx = b.p.x - j.x, dz = b.p.z - j.z, d = Math.hypot(dx, dz);
        const vem = -(b.v.x * dx + b.v.z * dz) > 0;
        const foge = d > 0 && -(j.vx * dx + j.vz * dz) / d > 0.3;
        if (d <= 3 && vem && b.p.y < 1.2) {
          if (minD === Infinity) { A.recep++; minD = 0; dAnt = d; }
          if (minD >= 0 && foge && d > dAnt) minD += d - dAnt;
          if (minD > 0.15) { A.afastou++; if (A.exAfastou.length < 5) A.exAfastou.push(`${tipo} sem ${sem} t ${m.tick}`); minD = -1; }
          dAnt = d;
        }
      } else if (m.tick >= seguir || m.posse !== j?.id) recebendo = null;
    }
    const ev = passoX(e);
    if (SONDA && SONDA.tipo === tipo && SONDA.humano === humano && SONDA.sem === sem && Math.abs(m.tick - SONDA.t) <= 45) {
      const j = porId.get(m.controlado[0]), b = m.bola, rp = j.recep;
      const mvA = rp && rp.ativo ? R.movimentoAssistido(j, rp, m.tick - 1, b.p.x, b.p.z, j.par, j.ix, j.iz, j.imag) : null;
      console.log(`t ${m.tick} ctrl ${j.id} (${fmt(j.x, 2)}, ${fmt(j.z, 2)}) v ${fmt(Math.hypot(j.vx, j.vz), 1)} bola (${fmt(b.p.x, 2)}, ${fmt(b.p.y, 2)}, ${fmt(b.p.z, 2)}) vb ${fmt(Math.hypot(b.v.x, b.v.z), 1)} d ${fmt(Math.hypot(b.p.x - j.x, b.p.z - j.z), 2)} posse ${m.posse} recebe ${j.recebe != null ? 'sim' : '-'} recep ${rp && rp.ativo && rp.tick === m.tick - 1 ? rp.modo + (rp.livre ? '/livre' : '') + ` q(${fmt(rp.qx, 2)}, ${fmt(rp.qz, 2)}) em ${rp.alvo - m.tick} vmax ${fmt(rp.vmax, 1)}${rp.rapido ? ' rápido' : ''}` : '-'} e (${fmt(e.x, 2)}, ${fmt(e.z, 2)}) vel (${fmt(j.vx, 1)}, ${fmt(j.vz, 1)}) ${mvA ? `mv (${fmt(mvA.dx * mvA.vel, 1)}, ${fmt(mvA.dz * mvA.vel, 1)})` : ''} viz ${(() => { let o = null, dm = Infinity; for (const q of m.jogadores) { if (q === j) continue; const dd = Math.hypot(q.x - j.x, q.z - j.z); if (dd < dm) { dm = dd; o = q; } } return `#${o.id}(t${o.time}) a ${fmt(dm, 2)} (${fmt(o.x - j.x, 2)}, ${fmt(o.z - j.z, 2)})`; })()} ${ev.filter(x => x.tipo !== 'leituraGoleiro').map(x => x.tipo + (x.modo ? ':' + x.modo : '') + '#' + x.id).join(' ')}`);
    }
    // fora do jogo (bola parada, gol, intervalo): os domínios acompanhados não contam (a bola é recolocada)
    if (m.partida && m.partida.estado !== 'jogo') { pendentes.length = 0; continue; }
    // eventos
    for (const x of ev) {
      if (x.tipo === 'toque' && x.modo === 'dominio') {
        const j = porId.get(x.id);
        A.dominios++;
        pendentes.push({ id: x.id, time: j.time, tick: m.tick, controle: j.par.attr.controle ?? 70, adv: false, acao: false, d05: null, vb: x.v });
      }
      if (x.tipo === 'perda') {
        const j = porId.get(x.id);
        A.perdas++;
        if (!advPerto(j.x, j.z, j.time, 3)) { A.perdasSozinho++; if (A.exPerda.length < 5) A.exPerda.push(`${tipo} sem ${sem} t ${m.tick} #${j.id}`); }
      }
      if ((x.tipo === 'passe' || x.tipo === 'chute') && x.id != null) for (const p of pendentes) if (p.id === x.id) p.acao = true;
    }
    // acompanha os domínios
    for (let k = pendentes.length - 1; k >= 0; k--) {
      const p = pendentes[k], j = porId.get(p.id), b = m.bola.p;
      if (advPerto(b.x, b.z, p.time, 3) || advPerto(j.x, j.z, p.time, 3)) p.adv = true;
      // a bola saiu do campo nesse tempo (domínio embalado na linha): é decisão, não controle — fora da conta
      if (Math.abs(b.x) > C.CAMPO.meioX || Math.abs(b.z) > C.CAMPO.meioZ) p.acao = true;
      const t = m.tick - p.tick;
      if (t === 30) p.d05 = Math.hypot(b.x - j.x, b.z - j.z);
      if (t >= 36) {
        pendentes.splice(k, 1);
        if (p.acao) continue;
        // 1º toque (com ou sem adversário perto: a pressão faz parte do erro do domínio)
        const g = GRUPOS.findIndex(([a, z]) => p.controle >= a && p.controle < z);
        if (p.d05 != null) A.toque1[g].push(p.d05);
        if (p.adv) continue;
        A.dominiosLivres++;
        const d = Math.hypot(b.x - j.x, b.z - j.z);
        if (d > 2 || (m.posse != null && m.posse !== p.id)) {
          A.escapes++;
          if (A.exEscapa.length < 8) A.exEscapa.push(`${tipo} sem ${sem} t ${p.tick} #${p.id} controle ${p.controle} toque ${fmt(p.vb, 1)} m/s: a ${fmt(d, 1)} m, posse ${m.posse}`);
        }
      }
    }
    // condução: bola–pé por velocidade
    if (m.posse != null && m.naMao == null && m.bola.p.y < 0.3) {
      const j = porId.get(m.posse);
      if (j && j.posicao !== 'GOL' && j.cond && !j.cond.busca) {
        const b = m.bola.p;
        let dp = Infinity;
        for (const pe of j.pes) { const px = pe.apoio ? pe.x : pe.tx, pz = pe.apoio ? pe.z : pe.tz; dp = Math.min(dp, Math.hypot(b.x - px, b.z - pz)); }
        const v = Math.hypot(j.vx, j.vz), f = FAIXAS.findIndex(([a, z]) => v >= a && v < z);
        A.pe[f].push(dp);
      }
    }
  }
  A.minutos += (tipo === 'partida' ? 2 * MIN : 2 * MIN);
  void timeDe;
}

const cenas = [['partida', false, 'partida IA × IA'], ['partida', true, 'partida, humano roteirizado'], ['treino', false, 'treino de ataque, IA'], ['treino', true, 'treino de ataque, humano roteirizado']];
if (SONDA) { rodar(SONDA.tipo, SONDA.humano, SONDA.sem, novoAcum()); process.exit(0); }
const res = {};
const SO = arg('--cenas', null); // ex.: --cenas 0,1 (índices de `cenas`)
for (const [k, [tipo, humano, nome]] of cenas.entries()) {
  if (SO && !SO.split(',').map(Number).includes(k)) continue;
  const A = novoAcum();
  for (let s = 1; s <= NSEM; s++) rodar(tipo, humano, 1000 + s * 17, A);
  res[nome] = A;
}

const saida = {};
const linhas = [['cena', 'domínios (sem adversário a < 3 m)', 'escapa', 'perdas sozinho / 90 min', 'recepções do humano', 'se afastou da bola']];
for (const [nome, A] of Object.entries(res)) {
  const esc = A.escapes / Math.max(1, A.dominiosLivres);
  const p90 = (A.perdasSozinho / Math.max(1, A.minutos)) * 90;
  linhas.push([nome, `${A.dominios} (${A.dominiosLivres})`, `${fmt(100 * esc, 1)}% (${A.escapes})`, `${fmt(p90, 1)} (${A.perdasSozinho} de ${A.perdas})`, A.recep || '—', A.recep ? `${A.afastou}` : '—']);
  saida[nome] = { dominios: A.dominios, dominiosLivres: A.dominiosLivres, escapa: esc, perdasSozinho90: p90, recep: A.recep, afastou: A.afastou, exAfastou: A.exAfastou,
    pe: A.pe.map(a => ({ n: a.length, p50: percentil(a, 0.5), p95: percentil(a, 0.95) })), toque1: A.toque1.map(a => ({ n: a.length, p50: percentil(a, 0.5), p95: percentil(a, 0.95) })) };
}
console.log(`Controle de bola em jogo — lógica de ${path.relative(process.cwd(), JS) || '.'} (${NSEM} sementes × ${MIN} min por tempo)`);
console.log(tabelaTexto(linhas));
console.log('\nbola–pé na condução (m), p50 / p95:');
const lp = [['cena', ...FAIXAS.map(f => f[2])]];
for (const [nome, o] of Object.entries(saida)) lp.push([nome, ...o.pe.map(x => (x.n ? `${fmt(x.p50, 2)} / ${fmt(x.p95, 2)} (${x.n})` : '—'))]);
console.log(tabelaTexto(lp));
console.log('\n1º toque: bola a quantos m do jogador 0,5 s depois do domínio, p50 / p95:');
const lt = [['cena', ...GRUPOS.map(g => g[2])]];
for (const [nome, o] of Object.entries(saida)) lt.push([nome, ...o.toque1.map(x => (x.n ? `${fmt(x.p50, 2)} / ${fmt(x.p95, 2)} (${x.n})` : '—'))]);
console.log(tabelaTexto(lt));
for (const [nome, o] of Object.entries(saida)) if (o.exAfastou.length) console.log(`  se afastou (${nome}): ${o.exAfastou.join('; ')}`);
for (const [nome, A] of Object.entries(res)) if (A.exEscapa.length) console.log(`  escapou (${nome}): ${A.exEscapa.join('; ')}`);
for (const [nome, A] of Object.entries(res)) if (A.exPerda.length) console.log(`  perda sozinho (${nome}): ${A.exPerda.join('; ')}`);
const j = arg('--json', null);
if (j) fs.writeFileSync(j, JSON.stringify(saida, null, 1));

// metas (informativas: a ferramenta não está na bateria — leva minutos; o teste-recepcao cobre a recepção)
const todos = Object.values(saida);
const piorEsc = Math.max(...todos.map(o => (o.dominiosLivres >= 30 ? o.escapa : 0)));
const perdas90 = Math.max(...todos.map(o => o.perdasSozinho90));
const afast = todos.reduce((a, o) => a + (o.afastou || 0), 0), recs = todos.reduce((a, o) => a + (o.recep || 0), 0);
const limpo = todos.every(o => !(o.toque1[0].n >= 20 && o.toque1[2].n >= 20) || o.toque1[2].p95 <= o.toque1[0].p95);
const metas = [
  ['domínio que escapa (pior cena com ≥ 30 domínios sem adversário)', `${fmt(100 * piorEsc, 1)}%`, '≤ 2%', piorEsc <= 0.02],
  ['perdas sozinho por 90 min (pior cena)', fmt(perdas90, 1), '≈ 0 (≤ 2)', perdas90 <= 2],
  ['recepção do humano: se afastou da bola vindo', recs ? `${afast} de ${recs}` : '—', '0', afast === 0],
  ['1º toque: o bom (≥ 80) mais limpo que o fraco (< 70), p95', limpo ? 'sim' : 'não', 'sim', limpo],
];
console.log('\n' + tabelaTexto([['Meta', 'Medido', 'Alvo', 'Resultado'], ...metas.map(x => [x[0], x[1], x[2], x[3] ? 'PASSOU' : 'REPROVOU'])]));
process.exit(metas.every(x => x[3]) ? 0 : 1);
