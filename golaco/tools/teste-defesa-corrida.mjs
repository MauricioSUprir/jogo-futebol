// teste-defesa-corrida (pedido do dono, 11/10: "O JOGO TEM QUE SER MAIS INTENSO, ninguém do outro time corre, ninguém
// marca, mas tem que marcar com responsabilidade e consciência"; entrega "cabeceio + IA intensa", 12/10). Diagnóstico e
// contraprova de 11/10 (roteiros reaproveitados): contra o humano que conduz em disparada (7,6 m/s) a IA não para a
// arrancada — o 1º homem fica parado ou subindo no corredor (3,0 m/s para o próprio gol com o condutor a 3 m), quem foi
// batido continua 1º homem, a roubada da IA é desfeita pelo mesmo condutor em 26% (sem o bloqueio de domínio da DIVIDIDA)
// e 30% das arrancadas do próprio campo chegam à área mesmo contra o bloco armado.
// Partidas de 2 × 4 min com o humano ROTEIRIZADO no time 0 (a IA no time 1):
//  - sprint: com a bola, CORRER direto ao gol (puxando para o meio) e chuta a < 18 m (|z| < 16); sem a bola, defesa MANSA
//    (trota até um ponto a 8 m da bola, do lado do gol; TROCAR se ficar a > 20 m) — separa o ataque dele da roubada dele;
//  - trote: o mesmo sem o CORRER (~5,6 m/s).
// Definições (as da contraprova): arrancada = o controlado do time 0 com a bola no pé, rolando, andando ≥ 3 m; do próprio
// campo = começou com u < 0; bloco armado = ≥ 8 da IA do lado do gol na largada; chegou à área = u > 36 e |z| < 20,16;
// gol dela = gol do time 0 em até 5 s do chute que a encerrou. Roubada desfeita = roubada da IA no condutor do time 0
// (evento 'roubada' com ia) com o MESMO condutor com a bola 1 s depois. Defensor do corredor = da IA, à frente do condutor
// rápido (> 6,3 m/s; 0 < dx < 6 m na linha da corrida e < 2 m de lado) que acabou ultrapassado: a velocidade dele para o
// próprio gol quando o condutor estava a 3 m.
// Metas (contraprova, proposta 7; hoje entre parênteses na publicada/branch):
//  - roubada desfeita ≤ 5% (26%);
//  - gols do roteiro sprint ≤ 1,5 por partida (2,5–3,1);
//  - gols de arrancada de 40 m ou mais ≤ 0,5 por partida (1,9);
//  - gol por chute nas arrancadas do próprio campo ≤ 20% (36%; com menos de 10 chutes, ≤ 0,25 gol dessas arrancadas por partida);
//  - defensor do corredor, com o condutor a 3 m: mediana ≥ 5 m/s para o próprio gol (3,0);
//  - chegada à área nas arrancadas do próprio campo com o bloco armado ≤ 25% (30%; abaixo de 12% só mexendo na vantagem
//    de velocidade da condução — decisão do dono);
//  - faltas da IA no humano ≤ 5 por partida;
//  - roteiro trote: chegada à área nas arrancadas do próprio campo ≤ 5%.
//   node tools/teste-defesa-corrida.mjs                 (lógica do repositório)
//   node tools/teste-defesa-corrida.mjs --js <pasta>    (outra cópia, ex.: a base — tem de REPROVAR)
//   --sementes N (sprint; padrão 12) · --trote N (padrão 6) · --sem0 K (padrão 101) · --par N (processos; padrão 4)
import { fork } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));

// ------------------------------------------------------------------ processo filho: uma partida com o roteiro
async function partida(sem, rot) {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const P = await imp('partida.js');
  const { BOTAO: B } = await imp('config.js');
  const M = await import(pathToFileURL(path.join(AQUI, 'lib/partida-medidas.mjs')).href);
  const porId = (m, id) => m.jogadores.find(o => o.id === id);
  const dir = (j, x, z) => { const dx = x - j.x, dz = z - j.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; };
  const st = { carga: null, troca: -999 };
  function entrada(m) {
    const j = porId(m, m.controlado[0]);
    if (!j || m.partida.estado !== 'jogo') return { x: 0, z: 0, botoes: 0 };
    const lado = m.ataca[0], gx = lado * 52.5, b = m.bola.p;
    if (st.carga) {
      const c = st.carga;
      if (m.tick < c.ate && m.posse === j.id) return { x: c.x, z: c.z, botoes: c.bot };
      st.carga = null; return { x: c.x, z: c.z, botoes: 0 };
    }
    const pr = m.parada;
    if (pr && !pr.rolou) {
      if (pr.cobrador === j.id && m.tick - pr.desde > 50) {
        let o = null, dm = Infinity;
        for (const q of m.jogadores) if (q.time === 0 && q !== j && q.posicao !== 'GOL') { const d = Math.hypot(q.x - j.x, q.z - j.z); if (d < dm) { dm = d; o = q; } }
        if (o) { const d = dir(j, o.x, o.z); st.carga = { bot: B.PASSE, x: d.x, z: d.z, ate: m.tick + 15 }; return { x: d.x, z: d.z, botoes: B.PASSE }; }
      }
      return { x: 0, z: 0, botoes: 0 };
    }
    if (m.posse === j.id) {
      const dGol = Math.hypot(gx - j.x, j.z);
      if (dGol < 18 && Math.abs(j.z) < 16) {
        const d = dir(j, gx, -j.z * 0.3);
        st.carga = { bot: B.CHUTE, x: d.x, z: d.z, ate: m.tick + 30 };
        return { x: d.x, z: d.z, botoes: B.CHUTE };
      }
      const d = dir(j, gx, j.z * 0.5);
      return { x: d.x, z: d.z, botoes: rot === 'sprint' ? B.CORRER : 0 };
    }
    if (M.timeComBola(m) === 1 && m.naMao == null) {
      // defesa mansa: ponto a 8 m da bola, do lado do meu gol, trotando
      const dB = Math.hypot(b.x - j.x, b.z - j.z);
      if (dB > 20 && m.tick - st.troca > 90) { st.troca = m.tick; return { x: 0, z: 0, botoes: B.TROCAR }; }
      const gy = -lado * 52.5, gl = Math.hypot(gy - b.x, b.z) || 1;
      const tx = b.x + (gy - b.x) / gl * 8, tz = b.z + (-b.z) / gl * 8;
      const dd = Math.hypot(tx - j.x, tz - j.z);
      if (dd < 1) return { x: 0, z: 0, botoes: 0 };
      const d = dir(j, tx, tz), mg = Math.min(0.7, dd / 4);
      return { x: d.x * mg, z: d.z * mg, botoes: 0 };
    }
    const d = dir(j, j.x + lado * 6, j.z * 0.9);
    return { x: d.x * 0.5, z: d.z * 0.5, botoes: 0 };
  }
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 4 });
  const R = { sem, rot, gols: 0, golsIA: 0, eps: [], roubadas: 0, desfeitas: 0, faltasIA: 0, v3: [] };
  const N = Math.round(2 * 4 * 3600 + 1500);
  let ep = null, chuteEp = null;
  const abertas = [];
  const hist = new Map();
  let condAnt = -1;
  for (let i = 0; i < N; i++) {
    const ev = P.passoPartida(m, entrada(m));
    if (m.partida.estado === 'fim') break;
    for (const e of ev) {
      if (e.tipo === 'gol') {
        if (e.time === 0) { R.gols++; if (chuteEp && m.tick - chuteEp.tick < 300) chuteEp.ep.gol = true; }
        else R.golsIA++;
        chuteEp = null;
      }
      if (e.tipo === 'falta') { const d = porId(m, e.def); if (d && d.time === 1) R.faltasIA++; }
      if (e.tipo === 'roubada' && e.ia && condAnt >= 0) { const j = porId(m, e.id); if (j && j.time === 1) abertas.push({ t: m.tick, cond: condAnt }); }
    }
    const dono = M.donoDaBola(m);
    for (let k = abertas.length - 1; k >= 0; k--) {
      const a = abertas[k];
      if (m.tick - a.t === 60) {
        R.roubadas++;
        if (!(m.faltaPendente || (m.parada && !m.parada.rolou)) && dono && dono.id === a.cond) R.desfeitas++;
        abertas.splice(k, 1);
      }
    }
    const rolando = m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null;
    const cond = dono && m.naMao == null && dono.time === 0 && dono.posicao !== 'GOL' && dono.id === m.controlado[0] && rolando ? dono : null;
    condAnt = cond ? cond.id : -1;
    // arrancadas (episódios do controlado com a bola)
    if (ep && (!cond || cond.id !== ep.id)) {
      ep.fim = m.voo && m.voo.de === ep.id ? (['chute', 'colocado', 'cavadinha'].includes(m.voo.tipo) ? 'chute' : 'passe') : 'outro';
      if (ep.fim === 'chute') chuteEp = { ep, tick: m.tick };
      if (ep.dist >= 3) R.eps.push(ep);
      ep = null;
    }
    if (!ep && cond && m.bola.p.y < 0.5) {
      const u0 = M.uDe(m, 0, cond.x);
      let atras = 0;
      for (const o of M.deLinha(m, 1)) if (M.uDe(m, 0, o.x) > u0) atras++;
      ep = { id: cond.id, u0, atras, area: false, dist: 0, x: cond.x, z: cond.z, gol: false, fim: null };
    }
    if (ep && cond) {
      ep.dist += Math.hypot(cond.x - ep.x, cond.z - ep.z); ep.x = cond.x; ep.z = cond.z;
      if (M.uDe(m, 0, cond.x) > 36 && Math.abs(cond.z) < 20.16) ep.area = true;
    }
    // duelos com o condutor rápido: o defensor do corredor ultrapassado
    if (!cond) { hist.clear(); continue; }
    const vc = Math.hypot(cond.vx, cond.vz);
    if (vc < 0.5) continue;
    const ux = cond.vx / vc, uz = cond.vz / vc, ladoIA = m.ataca[1];
    for (const o of M.deLinha(m, 1)) {
      const rx = o.x - cond.x, rz = o.z - cond.z;
      const dx = rx * ux + rz * uz, lat = -rx * uz + rz * ux;
      let h = hist.get(o.id); if (!h) hist.set(o.id, h = []);
      h.push({ dx, lat, vg: -(o.vx * ladoIA), d: Math.hypot(rx, rz), vc, ramo: o.ia?.ramo || '—' });
      if (h.length > 120) h.shift();
      if (dx < -0.5 && h.length > 10) {
        let k0 = -1;
        for (let k = h.length - 2; k >= 0; k--) { if (h[k].dx < -0.5) break; if (h[k].dx > 0 && h[k].dx < 6 && Math.abs(h[k].lat) < 2) k0 = k; }
        if (k0 >= 0 && h[k0].vc > 6.3) {
          const a3 = h.slice(0, h.length - 1).reverse().find(x => x.dx > 0 && x.d <= 3);
          if (a3) { R.v3.push(a3.vg); (R.v3r ??= []).push([a3.ramo, a3.vg]); }
          h.length = 0;
        }
      }
    }
  }
  return R;
}

if (args.includes('--filho')) {
  process.send(await partida(+arg('--s', 101), arg('--rot', 'sprint')));
  process.exit(0);
}

const NS = +arg('--sementes', 12), NT = +arg('--trote', 6), S0 = +arg('--sem0', 101);
const nPar = Math.max(1, +arg('--par', Math.min(4, os.availableParallelism?.() ?? os.cpus().length)));
const tarefas = [...Array.from({ length: NS }, (_, k) => ({ s: S0 + k, rot: 'sprint' })), ...Array.from({ length: NT }, (_, k) => ({ s: S0 + k, rot: 'trote' }))];
const res = [];
let prox = 0;
await Promise.all(Array.from({ length: Math.min(nPar, tarefas.length) }, async () => {
  while (prox < tarefas.length) {
    const t = tarefas[prox++];
    res.push(await new Promise((ok, erro) => {
      const c = fork(fileURLToPath(import.meta.url), ['--filho', '--s', String(t.s), '--rot', t.rot, '--js', JS]);
      c.on('message', ok); c.on('error', erro);
      c.on('exit', (cod, sinal) => { if (cod || sinal) erro(new Error(`semente ${t.s} (${t.rot}): saiu com ${cod ?? sinal}`)); });
    }));
  }
}));
const sp = res.filter(r => r.rot === 'sprint'), tr = res.filter(r => r.rot === 'trote');
const soma = (a, f) => a.reduce((x, r) => x + f(r), 0);
const eps = sp.flatMap(r => r.eps), epsT = tr.flatMap(r => r.eps);
const meuCampo = eps.filter(e => e.u0 < 0), armado = meuCampo.filter(e => e.atras >= 8);
const chutes = meuCampo.filter(e => e.fim === 'chute');
const longas = eps.filter(e => e.dist >= 40 && e.gol);
const trMeu = epsT.filter(e => e.u0 < 0);
const v3 = sp.flatMap(r => r.v3).sort((a, b) => a - b);
// (informativo) o papel da IA de quem foi ultrapassado, com a mediana da velocidade para o gol a 3 m
const porRamo = {};
for (const [ramo, vg] of sp.flatMap(r => r.v3r ?? [])) (porRamo[ramo] ??= []).push(vg);
console.log('informativo: ultrapassados por papel (n, mediana m/s): ' + Object.entries(porRamo).sort((a, b) => b[1].length - a[1].length)
  .map(([r, a]) => { a.sort((x, y) => x - y); return `${r} ${a.length} (${a[a.length >> 1].toFixed(1)})`; }).join(' · '));
const pc = (a, b) => (b ? 100 * a / b : NaN);
const f = (x, c = 1) => (Number.isFinite(x) ? x.toFixed(c) : '—');
const linhas = [['medida', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const desf = soma(sp, r => r.desfeitas), roub = soma(sp, r => r.roubadas);
reg('roubada da IA desfeita pelo mesmo condutor em 1 s', `${desf}/${roub} (${f(pc(desf, roub), 0)}%)`, '≤ 5%', roub >= 20 && pc(desf, roub) <= 5);
reg('gols do roteiro sprint por partida', f(soma(sp, r => r.gols) / NS, 2), '≤ 1,5', soma(sp, r => r.gols) / NS <= 1.5);
reg('gols de arrancada de 40 m ou mais por partida', f(longas.length / NS, 2), '≤ 0,5', longas.length / NS <= 0.5);
// (com menos de 10 chutes a conversão não se mede: vale então o número de gols dessas arrancadas, ≤ 0,25 por partida — a
// defesa que não deixa chutar não reprova por falta de amostra)
const golsCh = chutes.filter(e => e.gol).length;
reg('gol por chute nas arrancadas do próprio campo', `${golsCh}/${chutes.length} (${f(pc(golsCh, chutes.length), 0)}%)`, '≤ 20% (< 10 chutes: ≤ 0,25 gol/partida)',
  chutes.length >= 10 ? pc(golsCh, chutes.length) <= 20 : golsCh / NS <= 0.25);
reg('defensor do corredor ultrapassado: velocidade para o gol com o condutor a 3 m (mediana)', `${f(v3[v3.length >> 1], 2)} m/s (${v3.length} duelos)`, '≥ 5 m/s', v3.length >= 20 && v3[v3.length >> 1] >= 5);
reg('arrancadas do próprio campo, bloco armado: chegam à área', `${armado.filter(e => e.area).length}/${armado.length} (${f(pc(armado.filter(e => e.area).length, armado.length), 0)}%)`, '≤ 25%', armado.length >= 40 && pc(armado.filter(e => e.area).length, armado.length) <= 25);
reg('faltas da IA no humano por partida', f(soma(sp, r => r.faltasIA) / NS, 2), '≤ 5', soma(sp, r => r.faltasIA) / NS <= 5);
if (NT > 0) reg('roteiro trote: arrancadas do próprio campo que chegam à área', `${trMeu.filter(e => e.area).length}/${trMeu.length} (${f(pc(trMeu.filter(e => e.area).length, trMeu.length), 0)}%)`, '≤ 5%', trMeu.length >= 20 && pc(trMeu.filter(e => e.area).length, trMeu.length) <= 5);
console.log(`teste-defesa-corrida — ${JS}: ${NS} partidas sprint (sementes ${S0}–${S0 + NS - 1}) + ${NT} trote`);
console.log(`informativo: arrancadas do próprio campo que chegam à área (todas) ${f(pc(meuCampo.filter(e => e.area).length, meuCampo.length), 0)}% de ${meuCampo.length}; gols da IA por partida ${f(soma(sp, r => r.golsIA) / NS, 2)}`);
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-defesa-corrida: REPROVOU (${falhas})` : '\nteste-defesa-corrida: PASSOU');
process.exit(falhas ? 1 : 0);
