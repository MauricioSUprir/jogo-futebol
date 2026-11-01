// Reposição do goleiro com a bola nas mãos (C5, item 16 da FILA; contrato "Reposição do goleiro com a mão" no
// CONTRATOS.md; pesquisa em PESQUISA-ETAPA4.md §15): a IA escolhe entre o arremesso (rolar / por cima do ombro) e o chutão
// pela pressão; o humano rola/arremessa com o PASSE, dá o bate-pronto com o LANÇAMENTO e o chutão com o CHUTE; o gesto é
// função pura do estado (reposicao.js) e a pose desenha a bola na mão (anim.js).
//
// A — IA × IA (canhão de estados do MEIO da partida — a lição das bolas paradas: estados de saída são quase iguais e
//     enganam): N partidas da demo; a cada 5 s com o time A com a bola no campo de B, a cópia do mundo com a bola nas mãos
//     do goleiro de B (como se ele tivesse acabado de pegar) até a reposição e o desfecho (a próxima posse):
//  A1 fração de reposições com a mão (rolar + por cima) entre as reposições da mão: 55–82% (StatsBomb open data, 149
//     partidas medidas para esta entrega: 56,3% Premier League 15/16, 61,2% Bundesliga 15/16, 79,4% Copa 2022, 80,9%
//     Euro 2024; 68,1% no total). Reprova na main (0%: a IA só dava o chutão);
//  A2 as reposições com a mão que chegam a um companheiro (a próxima posse é do time): ≥ 90% (StatsBomb 96,1%; 93,6% na
//     competição mais baixa, menos ~1,5 desvio da amostra do teste) — reprova quando a contagem PROVA menos de 90% (binomial,
//     p < 5%). (31/10, item 70: com a corrida das cobranças o CI deu 89,8% (53/59) nas 6 partidas; com 24, a main 93,3%
//     (251/269) e a corrida 91,2% (229/251) — empate; a amostra passa a 12 partidas, ~120 reposições com a mão);
//  A3 distância das reposições com a mão: a mediana entre o p25 e o p75 do real (14,3–27,4 m; mediana 19,4);
//  A4 nenhuma reposição com a mão para dentro da própria área (o ponto e o recebedor), nenhuma para o goleiro e o 1º a ter
//     a bola depois dela nunca é o próprio goleiro (0);
//  A5 (informativo) perda a < 40 m do próprio gol logo depois da reposição — a linha "erro na saída de bola" é do painel
//     (tools/painel-equilibrio.mjs, 144 partidas contra a base, no CI do PR).
// B — o gesto (o goleiro do humano com a bola nas mãos, um companheiro parado a ~15 m, os adversários longe):
//  B1 a bola sai da altura da MÃO DESENHADA: a mão que arremessa a ≤ 0,15 m do centro da bola do começo do gesto à soltura
//     (rolar e por cima; as duas mãos no bate-pronto/chutão, ≤ 0,2 m); rolando sai a ≤ 0,35 m do chão, por cima a ≥ 1,8 m;
//  B2 o bate-pronto toca o chão ANTES do pé (no máximo 2 ticks antes do chute) e o chutão bate no ar (sem tocar o chão); o
//     bate-pronto sai mais baixo (elevação) e mais rápido que o chutão do mesmo aperto;
//  B3 o gesto existe na pose: rolando o quadril desce ≥ 0,25 m; por cima a mão passa de 1,75 m; no chute o tornozelo do pé
//     que chuta chega a ≤ 0,2 m da bola no tick do chute, depois de sair ≥ 0,3 m do lugar plantado;
//  B4 sem salto: mão e tornozelo desenhados andam ≤ 0,25 m por tick (15 m/s) em todo o gesto;
//  B5 os botões: PASSE perto = rolar, PASSE com a barra cheia = por cima, LANÇAMENTO = bate-pronto, CHUTE = chutão.
//   node tools/teste-reposicao.mjs                     (lógica do repositório)
//   node tools/teste-reposicao.mjs --js <pasta js>     (outra cópia da lógica, ex.: a main)   [--partidas 12]
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const NP = +arg('--partidas', 12);
/** P(X ≤ k) para X ~ Binomial(n, p) (termos em log). */
function caudaBinomialAte(k, n, p) {
  let lt = n * Math.log(1 - p), soma = 0;
  const r = Math.log(p / (1 - p));
  for (let i = 0; i <= k; i++) { soma += Math.exp(lt); lt += Math.log((n - i) / (i + 1)) + r; }
  return Math.min(1, soma);
}
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js');
const S = await imp('sim.js');
const AN = await imp('anim.js');
const A = await imp('acoes.js');
const { BOTAO, BOLA } = await imp('config.js');
const J = AN.J;
const MX = 52.5;

const linhas = [['item', 'medido', 'meta', '']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const naArea = (gx, x, z) => Math.abs(x - gx) < 16.5 && Math.abs(z) < 20.16;
const MAO = new Set(['rolar', 'ombro']);

// ---------------------------------------------------------------- A: IA × IA
{
  const t = { n: 0, mao: 0, maoCerto: 0, maoFim: 0, area: 0, paraGol: 0, deVolta: 0, perdaPerto: 0, dist: [], tipos: {} };
  for (let s = 1; s <= NP; s++) {
    const m = P.criarPartida({ semente: s });
    for (let n = 1; m.partida.estado !== 'fim' && n < 40000; n++) {
      P.passoPartida(m, P.entradaDemoPartida(m));
      if (n % 300 || m.partida.estado !== 'jogo' || m.parada || m.naMao != null || m.posse == null) continue;
      const dono = m.jogadores.find(j => j.id === m.posse);
      const At = dono.time, B = 1 - At;
      if (dono.x * m.ataca[At] < 5) continue; // o time A com a bola no campo de B
      const c = S.copiarMundo(m);
      const g = c.jogadores.find(j => j.time === B && j.posicao === 'GOL');
      for (const j of c.jogadores) { j.pedido = null; j.carga = null; j.recebe = null; j.defesa = null; j.mergulho = null; }
      c.voo = null; c.naMao = g.id; c.posse = g.id; g.segura = { desde: c.tick };
      const b = c.bola; b.p.x = g.x + Math.cos(g.rumo) * 0.32; b.p.y = 1.05; b.p.z = g.z + Math.sin(g.rumo) * 0.32;
      b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
      for (let i = 0; i < 60 * 6 && c.naMao != null; i++) P.passoPartida(c, P.entradaDemoPartida(c));
      if (c.naMao != null || !c.voo || c.voo.de !== g.id) continue;
      const v = c.voo, tipo = v.reposicao ?? 'chutao', mao = MAO.has(tipo);
      t.n++; t.tipos[tipo] = (t.tipos[tipo] ?? 0) + 1;
      const gx = -c.ataca[B] * MX;
      if (mao) {
        t.mao++;
        t.dist.push(Math.hypot(v.alvo.x - g.x, v.alvo.z - g.z));
        const r = v.para != null ? c.jogadores.find(j => j.id === v.para) : null;
        if (naArea(gx, v.alvo.x, v.alvo.z) || (r && naArea(gx, r.x, r.z))) t.area++;
        if (r && r.posicao === 'GOL') t.paraGol++;
      }
      // desfecho: a próxima posse (até 8 s; bola parada encerra sem contar)
      for (let i = 0; i < 60 * 8; i++) {
        P.passoPartida(c, P.entradaDemoPartida(c));
        if (c.posse === g.id || c.naMao === g.id) { t.deVolta++; break; }
        if (c.posse != null) {
          const q = c.jogadores.find(j => j.id === c.posse);
          if (mao) { t.maoFim++; if (q.time === B) t.maoCerto++; }
          if (q.time !== B && Math.abs(q.x - gx) < 40) t.perdaPerto++;
          break;
        }
        if (c.parada && !c.parada.rolou) { if (mao) t.maoFim++; break; }
      }
    }
  }
  const frac = 100 * t.mao / Math.max(1, t.n), cert = 100 * t.maoCerto / Math.max(1, t.maoFim);
  const ds = [...t.dist].sort((a, b) => a - b), med = ds.length ? ds[Math.floor((ds.length - 1) / 2)] : NaN;
  const tipos = Object.entries(t.tipos).map(([k, n]) => `${k} ${n}`).join(', ');
  reg(`A1 IA × IA: reposições com a mão entre as da mão (${NP} partidas: ${tipos})`, `${frac.toFixed(1)}% (${t.mao}/${t.n})`, '55–82%', t.n >= 30 && frac >= 55 && frac <= 82);
  const pA2 = caudaBinomialAte(t.maoCerto, t.maoFim, 0.9);
  reg('A2 reposições com a mão que chegam a um companheiro', `${cert.toFixed(1)}% (${t.maoCerto}/${t.maoFim}; p = ${pA2.toFixed(2)} contra 90%)`, '≥ 90% (p ≥ 0,05)', t.maoFim >= 30 && pA2 >= 0.05);
  reg('A3 distância das reposições com a mão (mediana)', ds.length ? `${med.toFixed(1)} m (p25 ${ds[Math.floor((ds.length - 1) / 4)].toFixed(1)}, p75 ${ds[Math.floor(3 * (ds.length - 1) / 4)].toFixed(1)})` : '—', '14,3–27,4 m', med >= 14.3 && med <= 27.4);
  reg('A4 para dentro da própria área / para o goleiro / de volta ao goleiro', `${t.area} / ${t.paraGol} / ${t.deVolta}`, '0 / 0 / 0', t.area === 0 && t.paraGol === 0 && t.deVolta === 0);
  linhas.push(['A5 (informativo) perda a < 40 m do próprio gol logo depois da reposição', `${t.perdaPerto}/${t.n}`, 'painel: "erro na saída de bola"', '—']);
}

// ---------------------------------------------------------------- B: o gesto
function cena(sem) {
  const m = P.criarPartida({ semente: sem });
  for (let i = 0; i < 600 && !(m.partida.estado === 'jogo' && !m.parada); i++) P.passoPartida(m, P.entradaDemoPartida(m));
  for (const j of m.jogadores) { j.defesa = null; j.mergulho = null; j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; }
  m.voo = null;
  const lado = m.ataca[0], g = m.jogadores.find(j => j.time === 0 && j.posicao === 'GOL');
  P.teleportar(g, -lado * MX + lado * 6, 3, lado > 0 ? 0 : Math.PI);
  m.naMao = g.id; m.posse = g.id; g.segura = { desde: m.tick };
  const b = m.bola; b.p.x = g.x + Math.cos(g.rumo) * 0.32; b.p.y = 1.05; b.p.z = g.z + Math.sin(g.rumo) * 0.32;
  b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0;
  const z = m.jogadores.find(j => j.time === 0 && j.posicao === 'ZAG');
  P.teleportar(z, g.x + lado * 14, 3 + 0.3 * 14, 0); z.papel = 'parado';
  let k = 0;
  for (const o of m.jogadores) if (o.time === 1 && o.posicao !== 'GOL') { P.teleportar(o, lado * (10 + (k % 5) * 6), -25 + (k % 7) * 8, 0); k++; }
  A.assumirControle(m, 0, g);
  return { m, g, lado };
}
const casos = [['rolar', BOTAO.PASSE, 6], ['ombro', BOTAO.PASSE, 60], ['bate', BOTAO.LANCAMENTO, 6], ['chutao', BOTAO.CHUTE, 6]];
const R = {};
for (const [nome, bot, carga] of casos) {
  const { m, g, lado } = cena(3);
  for (let i = 0; i < 60; i++) P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
  for (let i = 0; i < carga; i++) P.passoPartida(m, { x: lado, z: 0.3, botoes: bot });
  const r = { plano: null, maoMax: 0, maoSolta: null, ySolta: null, desce: 0, maoAlta: 0, chao: null, chute: null, peBola: null, peSaiu: 0, salto: 0, v: null, el: null };
  const pose = new Float32Array(AN.NJ * 3);
  let ant = null, pelve0 = null, plantado = null, ar = null;
  for (let i = 0; i < 160; i++) {
    P.passoPartida(m, { x: lado, z: 0.3, botoes: 0 });
    ar = g.arremessoGk ?? ar;
    AN.pose(g, m, pose);
    if (pelve0 == null) pelve0 = pose[J.pelve * 3 + 1];
    if (ant) for (const k of [J.maoE, J.maoD, J.tornozeloE, J.tornozeloD]) r.salto = Math.max(r.salto, Math.hypot(pose[k * 3] - ant[k * 3], pose[k * 3 + 1] - ant[k * 3 + 1], pose[k * 3 + 2] - ant[k * 3 + 2]));
    ant = Float32Array.from(pose);
    if (!ar) continue;
    r.plano = ar.tipo;
    const b = m.bola.p, dois = ar.chuta != null;
    const dm = iM => Math.hypot(pose[iM * 3] - b.x, pose[iM * 3 + 1] - b.y, pose[iM * 3 + 2] - b.z);
    const dMao = dois ? Math.max(dm(J.maoE), dm(J.maoD)) : dm(ar.lado > 0 ? J.maoD : J.maoE);
    if (m.naMao === g.id && m.tick <= ar.solta) { r.maoMax = Math.max(r.maoMax, dMao); r.desce = Math.max(r.desce, pelve0 - pose[J.pelve * 3 + 1]); }
    if (m.tick === ar.solta) { r.maoSolta = dMao; r.ySolta = b.y; }
    if (m.naMao === g.id || (ar.feito != null && m.tick <= ar.feito + 20)) r.maoAlta = Math.max(r.maoAlta, pose[(ar.lado > 0 ? J.maoD : J.maoE) * 3 + 1]);
    if (dois) {
      const iT = ar.pe ? J.tornozeloD : J.tornozeloE;
      if (m.tick === ar.solta) plantado = { x: pose[iT * 3], y: pose[iT * 3 + 1], z: pose[iT * 3 + 2] };
      if (plantado && m.tick <= ar.chuta) r.peSaiu = Math.max(r.peSaiu, Math.hypot(pose[iT * 3] - plantado.x, pose[iT * 3 + 1] - plantado.y, pose[iT * 3 + 2] - plantado.z));
      if (m.tick > ar.solta && m.tick <= ar.chuta && b.y <= BOLA.raio + 1e-6 && r.chao == null) r.chao = m.tick;
      if (m.tick === ar.chuta) { r.chute = m.tick; r.peBola = Math.hypot(pose[iT * 3] - b.x, pose[iT * 3 + 1] - b.y, pose[iT * 3 + 2] - b.z); }
    }
    if (ar.feito != null && r.v == null && m.tick === ar.feito + 1) { const bv = m.bola.v; r.v = Math.hypot(bv.x, bv.y, bv.z); r.el = Math.atan2(bv.y, Math.hypot(bv.x, bv.z)) * 180 / Math.PI; }
  }
  R[nome] = r;
}
const f2 = x => (x == null ? '—' : x.toFixed(2));
{
  const ro = R.rolar, ob = R.ombro, ba = R.bate, ch = R.chutao;
  const okMao = ro.plano === 'rolar' && ob.plano === 'ombro' && ro.maoMax <= 0.15 && ob.maoMax <= 0.15 && ba.maoMax <= 0.2 && ch.maoMax <= 0.2
    && ro.maoSolta != null && ob.maoSolta != null;
  reg('B1 a mão desenhada na bola até a soltura (rolar / por cima / bate-pronto / chutão)', `${f2(ro.maoMax)} / ${f2(ob.maoMax)} / ${f2(ba.maoMax)} / ${f2(ch.maoMax)} m`, '≤ 0,15 / 0,15 / 0,2 / 0,2', okMao);
  reg('B1 altura da soltura: rolando / por cima', `${f2(ro.ySolta)} / ${f2(ob.ySolta)} m`, '≤ 0,35 / ≥ 1,8', ro.ySolta != null && ro.ySolta <= 0.35 && ob.ySolta != null && ob.ySolta >= 1.8);
  reg('B2 bate-pronto: toca o chão antes do pé (tick do chão → do chute)', `${ba.chao ?? '—'} → ${ba.chute ?? '—'}`, 'chão < chute ≤ chão + 2', ba.chao != null && ba.chute != null && ba.chao < ba.chute && ba.chute - ba.chao <= 2);
  reg('B2 chutão: bate no ar (sem tocar o chão antes)', ch.chute != null ? (ch.chao == null ? 'no ar' : `chão no tick ${ch.chao}`) : '—', 'no ar', ch.chute != null && ch.chao == null);
  reg('B2 bate-pronto × chutão do mesmo aperto: elevação / velocidade', `${f2(ba.el)}° × ${f2(ch.el)}° / ${f2(ba.v)} × ${f2(ch.v)} m/s`, 'mais baixo e mais rápido', ba.el != null && ch.el != null && ba.el < ch.el && ba.v > ch.v);
  reg('B3 o gesto na pose: rolando o quadril desce / por cima a mão sobe', `${f2(ro.desce)} / ${f2(ob.maoAlta)} m`, '≥ 0,25 / ≥ 1,75', ro.desce >= 0.25 && ob.maoAlta >= 1.75);
  reg('B3 o pé do chute: na bola no tick do chute / saiu do lugar (bate-pronto, chutão)', `${f2(ba.peBola)}, ${f2(ch.peBola)} / ${f2(ba.peSaiu)}, ${f2(ch.peSaiu)} m`, '≤ 0,2 / ≥ 0,3', ba.peBola != null && ch.peBola != null && ba.peBola <= 0.2 && ch.peBola <= 0.2 && ba.peSaiu >= 0.3 && ch.peSaiu >= 0.3);
  const salto = Math.max(ro.salto, ob.salto, ba.salto, ch.salto);
  reg('B4 mão e tornozelo desenhados: maior passo por tick no gesto', `${salto.toFixed(3)} m`, '≤ 0,25 m', salto <= 0.25);
  reg('B5 PASSE perto / PASSE barra cheia / LANÇAMENTO / CHUTE', `${ro.plano} / ${ob.plano} / ${ba.plano} / ${ch.plano}`, 'rolar / ombro / bate / chutao', ro.plano === 'rolar' && ob.plano === 'ombro' && ba.plano === 'bate' && ch.plano === 'chutao');
}

const lg = linhas[0].map((_, i) => Math.max(...linhas.map(l => String(l[i]).length)));
for (const l of linhas) console.log(l.map((c, i) => String(c).padEnd(lg[i])).join(' | '));
console.log(falhas ? `teste-reposicao: REPROVOU (${falhas})` : 'teste-reposicao: PASSOU');
process.exit(falhas ? 1 : 0);
