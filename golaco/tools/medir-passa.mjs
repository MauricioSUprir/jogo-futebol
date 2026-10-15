// "Passou da bola" (pedido do dono, 15/10: "jogadores passam da bola quando estão com ela praticamente dominada").
// Diagnóstico na partida de verdade (não em cena montada). Definição medível:
//   o jogador que é "da bola" — o condutor (m.posse), o recebedor do passe (j.recebe), quem tem o domínio marcado ou a
//   recepção assistida ativa, ou, com a bola solta, o jogador de linha mais perto dela — chega a ≤ 1 m da bola, no chão
//   e a ≤ 4 m/s, correndo (≥ 2 m/s) com a bola À FRENTE dele; e depois, sem outro jogador tocar nela, o corpo passa por
//   ela: a bola fica ≥ 0,3 m atrás do quadril no sentido em que ele vinha, a ≤ 0,8 m de lado, com ele ainda indo para a
//   frente (≥ 1 m/s) — e a bola não foi mandada para trás (andou ≥ −0,3 m nesse sentido): foi o corpo que passou.
//   Conta se ele tocou na bola nesse meio (o toque deixou a bola para trás) ou não (passou por cima sem tocar), quanto
//   tempo ele leva para voltar a ter a bola à frente e perto (≤ 0,6 m) e se a perdeu para o adversário. Fora da conta
//   (contaPassou) o corte ou a inversão pedidos — o analógico a mais de INV_ANG (60°) do sentido em que ele vinha — com a
//   bola até 1 m atrás (o passo de apoio do corte passa da bola). Também mede a bola de passe para outro, lenta, colada
//   (≤ 0,6 m) no pé de quem não é o recebedor por ≥ 0,2 s sem ele tocar, e o domínio marcado que sobra com a bola no pé
//   de outro (planosVelhos: o plano velho guiava o corpo).
// Cenas: partida IA × IA (a IA joga pelo humano: entradaDemoPartida) e partida com o humano roteirizado como no
// celular (sem o MOD, que o celular não tem): a entrada da demo SEM a marca da IA (recebe como humano), e com a bola
// vindo para o controlado ou com ele conduzindo, o analógico "para a frente" (sentido do ataque, ±30° sorteado por lance)
// — ou "lado" (sorteado). --qps30: a leitura do analógico só muda a cada 2 passos (o celular a 30 qps).
// rodarPartida aceita uma foto do mundo (opc.inicio, structuredClone: continua bit a bit) e tira fotos (opc.fotos) —
// assim cada caso da versão publicada foi reprisado nas variantes (reprise pareada).
//   node tools/medir-passa.mjs [--js <pasta js>] [--sementes 1017,1034] [--min 4] [--cenas ia,frente,lado] [--qps30]
//                              [--ex 12] [--json saida.json] [--sonda cena,sem,tick,id]
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const MIN = +arg('--min', 4);
const SEMS = arg('--sementes', '1017,1034').split(',').map(Number);
const CENAS = arg('--cenas', 'ia,frente').split(',');
const NEX = +arg('--ex', 12);
const QPS30 = args.includes('--qps30'); // a 30 qps (celular): o 2º passo do quadro repete a leitura do 1º (main.js repete)
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js'), C = await imp('config.js'), Cd = await imp('conducao.js'), Jg = await imp('jogador.js');
export const INV_ANG = 60 * Math.PI / 180;
/** O caso conta como "passou da bola"? (seguindo para a frente, ou na inversão com a bola > 1 m atrás) */
export const contaPassou = c => !c.inversao || c.atras > 1.0;

/** Gerador do roteiro (sem tocar no gerador do mundo): xorshift32 com o estado em st.rs (copiável com o mundo). */
function sortear(st) {
  let s = st.rs;
  s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
  st.rs = s;
  return s / 4294967296;
}

/**
 * Entrada do humano roteirizado (como no celular: sem o botão MOD — o celular não tem condução curta nem proteção). A
 * entrada da demo SEM a marca da IA (recebe como humano); com a bola vindo para o controlado, o analógico vai para um
 * lado sorteado ('frente': o sentido do ataque ±30°; 'lado': qualquer) e fica lá até ele dominar e por mais 0,8 s com a
 * bola. st guarda o estado do roteiro (vai junto com a foto do mundo).
 */
function entradaRoteiro(Pm, m, st, cena) {
  let e = Pm.entradaDemoPartida(m);
  if (cena === 'ia' || e.iaCobra) return e;
  e = { x: e.x, z: e.z, botoes: e.botoes & ~C.BOTAO.MOD };
  const j = m.jogadores.find(q => q.id === m.controlado[0]);
  const vem = j && m.posse == null && m.naMao == null && (j.recebe != null || (j.recep && j.recep.ativo && j.recep.tick === m.tick - 1));
  const comBola = j && m.posse === j.id && m.naMao == null;
  if (vem || (comBola && m.tick < st.ate)) {
    if (st.dono !== j.id) {
      st.dono = j.id;
      const base = cena === 'frente' ? (m.ataca[0] > 0 ? 0 : Math.PI) + (sortear(st) - 0.5) * (Math.PI / 3) : sortear(st) * 2 * Math.PI;
      st.lado = { x: Math.cos(base), z: Math.sin(base) };
    }
    if (vem) st.ate = m.tick + 48; // depois do domínio segue para lá por 0,8 s (quem já virou o analógico)
    // os botões da demo (passe/chute/CORRER) continuam — a pessoa joga; o analógico é o do roteiro
    e = { x: st.lado.x, z: st.lado.z, botoes: e.botoes };
  } else if (!comBola || m.tick >= st.ate) st.dono = null;
  return e;
}

export const SITS = ['condutor: logo após o domínio (≤ 0,6 s)', 'condutor: disparada (≥ 6,5 m/s)', 'condutor: outros', 'recepção (passe/domínio marcado)', 'bola solta (o mais perto)'];

/**
 * Roda uma partida e devolve {casos: [...], minutos}. cena: 'ia' | 'frente' | 'lado'.
 * Cada caso: {sem, tick, id, time, hum (é o controlado do time 0), sit, s (m/s), vb, tocou, desdeToque, volta (s|null), perdeu}.
 */
export function rodarPartida(Pm, sem, cena, min, opc = {}) {
  // opc.inicio = {m, st}: continua de uma foto (copiada) em vez de começar a partida; opc.fotos (ticks, em ordem) +
  // opc.aoFoto(tick, {m, st}): tira fotos no caminho; opc.ate: para no tick; opc.so: só detecta este jogador
  const m = opc.inicio ? opc.inicio.m : Pm.criarPartida({ semente: sem, minutosPorTempo: min, log: opc.sonda ? [] : undefined });
  const st = opc.inicio ? opc.inicio.st : { rs: ((sem * 2654435761) >>> 0) ^ (cena === 'lado' ? 0x9e3779b9 : 0x7f4a7c15) || 1, lado: null, dono: null, ate: -1, ult: null };
  const N = Math.round(2 * min * 3600) + 600;
  let porId = new Map(), nPor = -1;
  const pid = id => { if (nPor !== m.jogadores.length || !porId.has(id)) { porId = new Map(m.jogadores.map(j => [j.id, j])); nPor = m.jogadores.length; } return porId.get(id); };
  const jan = new Map();      // id → janela aberta
  const ultToque = new Map(); // id → tick do último toque (evento 'toque' dele)
  const ultDom = new Map();   // id → tick do último domínio
  const casos = [], volta = [], bloqueios = [], bloq = new Map();
  const velho = new Map(), planosVelhos = []; // id → passos seguidos com o domínio marcado e a bola com outro
  let kf = 0;
  while (m.tick < N) {
    while (opc.fotos && kf < opc.fotos.length && opc.fotos[kf] <= m.tick) { if (opc.fotos[kf] === m.tick) opc.aoFoto(m.tick, structuredClone({ m, st })); kf++; }
    let e = entradaRoteiro(Pm, m, st, cena);
    if (opc.qps30 ?? QPS30) {
      // a leitura muda só a cada 2 passos (o quadro de 30 qps); o 2º passo repete a do 1º
      if (m.tick & 1) e = { ...(st.ult ?? e), repete: true, iaCobra: e.iaCobra, ia: e.ia };
      else st.ult = e;
    }
    const nlog = m.log ? m.log.length : 0;
    const ev = Pm.passoPartida(m, e);
    if (opc.sonda && m.tick - 1 >= opc.sonda.t - 14 && m.tick - 1 <= opc.sonda.t + 30) sondar(m, pid(opc.sonda.id), ev, nlog, e);
    for (const x of ev) {
      if (x.tipo === 'toque' && x.id != null) { ultToque.set(x.id, m.tick); if (x.modo === 'dominio') ultDom.set(x.id, m.tick); }
      if ((x.tipo === 'passe' || x.tipo === 'chute' || x.tipo === 'cruzamento' || x.tipo === 'lancamento' || x.tipo === 'enfiada') && x.id != null) ultToque.set(x.id, m.tick);
    }
    const b = m.bola;
    const vb = Math.hypot(b.v.x, b.v.z);
    // fora do jogo, bola no alto ou na mão: nada conta
    if ((m.partida && m.partida.estado !== 'jogo') || m.naMao != null || (m.parada && !m.parada.rolou)) { jan.clear(); volta.length = 0; velho.clear(); continue; }
    // acompanhamento de quem passou: até quanto a bola fica atrás dele, se volta a tê-la à frente e perto, se a perde
    for (let k = volta.length - 1; k >= 0; k--) {
      const v = volta[k], c = v.c, j = pid(c.id);
      const dx = b.p.x - j.x, dz = b.p.z - j.z, d = Math.hypot(dx, dz);
      const adv = (m.posse != null && pid(m.posse)?.time !== j.time) || ev.some(x => (x.tipo === 'roubada' || x.tipo === 'toque' || x.tipo === 'bateuCorpo') && x.id != null && pid(x.id)?.time !== j.time)
        || ev.some(x => x.tipo === 'perda' && x.id === j.id);
      if (adv) { c.perdeu = true; volta.splice(k, 1); continue; }
      // tocou de novo (toque, passe, chute): voltou à bola
      if (ultToque.get(j.id) === m.tick) { c.volta = (m.tick - c.tick) / 60; volta.splice(k, 1); continue; }
      if (m.posse != null && m.posse !== j.id) { volta.splice(k, 1); continue; } // com o companheiro (passe): acabou
      const sj = Math.hypot(j.vx, j.vz);
      const h = sj > 0.5 ? [j.vx / sj, j.vz / sj] : [Math.cos(j.rumo), Math.sin(j.rumo)];
      const atras = -(dx * v.hx + dz * v.hz);
      if (atras > c.atras) c.atras = atras;
      if (d <= 0.6 && dx * h[0] + dz * h[1] > 0) { c.volta = (m.tick - c.tick) / 60; volta.splice(k, 1); continue; }
      if (m.tick - c.tick > 90) volta.splice(k, 1);
    }
    // domínio marcado que sobra com a bola no pé de outro (contraprova, 15/10): o plano de um passe ou de uma bola livre que
    // acabou seguia guiando o corpo (sim.js movimentoRecepcao) — conta o episódio quando ele dura ≥ 2 passos (a posse que
    // muda no fim de um passo só é vista pelo movimento do passo seguinte)
    if (m.posse != null) {
      for (const j of m.jogadores) {
        const t = j.cond?.toque;
        if (j.id === m.posse || !t || t.tipo !== 'dominio') { velho.delete(j.id); continue; }
        const k = (velho.get(j.id) ?? 0) + 1;
        velho.set(j.id, k);
        if (k === 2) planosVelhos.push({ sem, tick: m.tick, id: j.id, hum: j.id === m.controlado[0], modo: t.modo, s: Math.hypot(j.vx, j.vz) });
      }
    } else velho.clear();
    if (b.p.y > 0.35) { jan.clear(); bloq.clear(); continue; }
    // bola de passe para outro, lenta e no chão, colada no pé de quem não é o recebedor (≤ 0,6 m) por ≥ 0,2 s sem ninguém
    // tocar: o recebedor com o domínio só marcado tira a vez de quem está na bola (sim.js bolaLivre)
    if (m.posse == null && m.voo && m.voo.para != null && vb <= 4) {
      for (const j of m.jogadores) {
        if (j.posicao === 'GOL' || j.id === m.voo.para || j.papel === 'parado' || j.papel === 'marcador') continue;
        const d = Math.hypot(b.p.x - j.x, b.p.z - j.z);
        if (d <= 0.6) {
          const n = (bloq.get(j.id) ?? 0) + 1;
          bloq.set(j.id, n);
          if (n === 12) bloqueios.push({ sem, tick: m.tick, id: j.id, hum: j.id === m.controlado[0], adv: j.time !== m.voo.time, para: m.voo.para, vb });
        } else bloq.delete(j.id);
      }
    } else bloq.clear();
    // o jogador de linha mais perto da bola (para a bola solta)
    let maisPerto = null, dMin = Infinity;
    for (const j of m.jogadores) {
      if (j.posicao === 'GOL' || j.papel === 'parado' || j.papel === 'marcador') continue;
      const d = Math.hypot(b.p.x - j.x, b.p.z - j.z);
      if (d < dMin) { dMin = d; maisPerto = j; }
    }
    for (const j of m.jogadores) {
      if (j.posicao === 'GOL' || j.papel === 'parado' || j.papel === 'marcador' || !j.cond) continue;
      if (opc.so != null && j.id !== opc.so) continue;
      const dx = b.p.x - j.x, dz = b.p.z - j.z, d = Math.hypot(dx, dz);
      const w = jan.get(j.id);
      if (w) {
        // outro jogador ficou com a bola / tocou: acabou
        const outro = (m.posse != null && m.posse !== j.id) || ev.some(x => (x.tipo === 'toque' || x.tipo === 'roubada' || x.tipo === 'bateuCorpo' || x.tipo === 'passe' || x.tipo === 'chute') && x.id != null && x.id !== j.id);
        // tocou: a janela recomeça (o toque põe a bola no pé de novo)
        const tocou = ultToque.get(j.id) === m.tick;
        if (outro || tocou || m.tick - w.t0 > 45 || d > 2.2 || (j.cond.puxada) || (j.cond.pedalada)) { jan.delete(j.id); if (!outro && !tocou) continue; if (outro) continue; }
        else {
          const fr = dx * w.hx + dz * w.hz, la = -dx * w.hz + dz * w.hx;
          const aB = (b.p.x - w.bx0) * w.hx + (b.p.z - w.bz0) * w.hz;
          const vAl = j.vx * w.hx + j.vz * w.hz;
          if (fr <= -0.3 && Math.abs(la) <= 0.8 && aB >= -0.3 && vAl >= 1.0) {
            // a intenção agora: o analógico (da pessoa ou da IA) em relação ao sentido em que ele vinha — mais de 100° é
            // inversão pedida (aí deixar a bola um pouco para trás é o giro; só conta se ela ficar > 1 m atrás)
            const aX = j.imag > 0 ? Math.abs(Math.atan2(w.hx * j.iz - w.hz * j.ix, w.hx * j.ix + w.hz * j.iz)) : null;
            const c = { sem, tick: m.tick, t0: w.t0, id: j.id, time: j.time, hum: j.id === m.controlado[0], sit: w.sit, s: w.s, vb: w.vb, tocou: w.desdeToque, posse: m.posse === j.id, volta: null, perdeu: false, tipoUlt: w.tipoUlt, salto: w.salto, aIn: w.aIn, inv: w.inv,
              aX, inversao: aX != null && aX > INV_ANG, atras: -fr, prot: w.prot, mod: w.mod, freada: w.freada };
            casos.push(c); volta.push({ c, hx: w.hx, hz: w.hz });
            jan.delete(j.id);
          }
          continue;
        }
      }
      // abre a janela
      if (d > 1.0 || vb > 4) continue;
      const s = Math.hypot(j.vx, j.vz);
      if (s < 2.0) continue;
      const hx = j.vx / s, hz = j.vz / s;
      if (dx * hx + dz * hz < 0) continue;
      let sit = -1;
      const ctrl = j.cond.toque;
      if (m.posse === j.id) {
        const dom = ultDom.get(j.id);
        sit = dom != null && m.tick - dom <= 36 ? 0 : s >= 6.5 ? 1 : 2;
      } else if (m.posse == null) {
        const passeOutro = m.voo && m.voo.para != null && m.voo.para !== j.id;
        if (j.recebe != null || (ctrl && ctrl.tipo === 'dominio') || (j.recep && j.recep.ativo && j.recep.tick === m.tick - 1)) sit = 3;
        else if (j === maisPerto && !passeOutro) sit = 4;
      }
      if (sit < 0) continue;
      const ut = ultToque.get(j.id);
      // ângulo entre o analógico e a corrida, e se o analógico pulou na leitura deste toque (toque de freio/espera do gesto)
      const aIn = j.imag > 0 ? Math.abs(Math.atan2(hx * j.iz - hz * j.ix, hx * j.ix + hz * j.iz)) : null;
      jan.set(j.id, { t0: m.tick, hx, hz, bx0: b.p.x, bz0: b.p.z, sit, s, vb, desdeToque: ut != null && m.tick - ut <= 30 ? m.tick - ut : null, tipoUlt: j.cond.ult ? j.cond.ult.tipo : null,
        salto: j.saltoTick >= 0 && m.tick - j.saltoTick <= 4, aIn, inv: !!j.inv,
        mod: (j.botoes & C.BOTAO.MOD) !== 0, prot: !!(Cd.emProtecao && Cd.emProtecao(m, j)),
        freada: Jg.velocidadeDesejada(j.par, j.imag, (j.botoes & C.BOTAO.CORRER) !== 0, (j.botoes & C.BOTAO.MOD) !== 0, m.posse === j.id) < s - 1.0 });
    }
    if ((opc.parar && casos.length >= opc.parar) || (opc.ate && m.tick >= opc.ate)) break;
  }
  return { casos, bloqueios, planosVelhos, minutos: 2 * min };
}

const f2 = (x, n = 2) => (x == null ? '-' : (+x).toFixed(n));
/** Uma linha por tick do jogador j (--sonda). */
function sondar(m, j, ev, nlog, e) {
  const b = m.bola, c = j.cond, s = Math.hypot(j.vx, j.vz);
  const hx = Math.cos(j.rumo), hz = Math.sin(j.rumo);
  const dx = b.p.x - j.x, dz = b.p.z - j.z;
  const t = c.toque;
  const novos = m.log.slice(nlog).filter(l => l.id === j.id);
  console.log(`t ${m.tick - 1} posse ${m.posse} j(${f2(j.x)},${f2(j.z)}) v(${f2(j.vx, 1)},${f2(j.vz, 1)}) s ${f2(s, 1)} rumo ${f2(j.rumo)} in(${f2(j.ix)},${f2(j.iz)}) mag ${f2(j.imag)} e(${f2(e.x)},${f2(e.z)}) | bola(${f2(b.p.x)},${f2(b.p.z)}) vb(${f2(b.v.x, 1)},${f2(b.v.z, 1)}) d ${f2(Math.hypot(dx, dz))} fr ${f2(dx * hx + dz * hz)} la ${f2(-dx * hz + dz * hx)} | toque ${t ? `${t.tipo}@${t.tick - m.tick + 1} pe${t.pe}` : '-'} busca ${c.busca ? 1 : 0} pes ${j.pes[0].apoio ? 'A' : 'v'}${j.pes[1].apoio ? 'A' : 'v'} inv ${j.inv ? 1 : 0} salto ${j.saltoTick} ${novos.map(l => `TOQUE ${l.tipo} pe${l.pe} v ${f2(l.v)} dir(${f2(l.dx)},${f2(l.dz)}) ir ${f2(l.ir)}`).join(' ')} ${ev.filter(x => x.tipo !== 'leituraGoleiro' && x.tipo !== 'toque').map(x => x.tipo + '#' + x.id).join(' ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const SONDA = arg('--sonda', null); // --sonda cena,sem,tick,id
  if (SONDA) { const [cena, sem, t, id] = SONDA.split(','); rodarPartida(P, +sem, cena, MIN, { sonda: { t: +t, id: +id }, parar: 0 }); process.exit(0); }
  const saida = {};
  for (const cena of CENAS) {
    const todos = []; let minutos = 0;
    const bl = [];
    for (const sem of SEMS) { const r = rodarPartida(P, sem, cena, MIN); todos.push(...r.casos); bl.push(...r.bloqueios); minutos += r.minutos; }
    saida[cena] = { casos: todos, bloqueios: bl, minutos };
  }
  const NP = SEMS.length;
  console.log(`"Passou da bola" na partida — lógica de ${path.relative(process.cwd(), JS) || '.'} (${NP} sementes × 2 × ${MIN} min; por partida)`);
  const lin = [['cena', 'quem', 'passou / partida', ...SITS.map(x => x.split(':')[0] === 'condutor' ? x.replace('condutor: ', 'cond. ') : x), 'perdeu a bola', 'bola atrás p50 / máx (m)', 'volta p50 (s)', 'inversão pedida (fora da conta)']];
  for (const [cena, o] of Object.entries(saida)) {
    for (const [nq, f] of [['controlado (time 0)', c => c.hum], ['IA (os outros)', c => !c.hum]]) {
      const todos = o.casos.filter(f), cs = todos.filter(contaPassou);
      const at = cs.map(c => c.atras).sort((a, b) => a - b), vs = cs.map(c => c.volta).filter(v => v != null).sort((a, b) => a - b);
      lin.push([cena, nq, `${cs.length} (${fmt(cs.length / NP, 2)})`, ...SITS.map((_, k) => `${cs.filter(c => c.sit === k).length}`), `${cs.filter(c => c.perdeu).length}`,
        at.length ? `${fmt(at[Math.floor(at.length / 2)], 2)} / ${fmt(at[at.length - 1], 2)}` : '—', vs.length ? fmt(vs[Math.floor(vs.length / 2)], 2) : '—', `${todos.length - cs.length}`]);
    }
  }
  console.log(tabelaTexto(lin));
  // causas (todos os casos que contam)
  const lc = [['cena', 'passou', 'sem tocar', 'tocou (≤ 0,5 s antes)', 'proteção (MOD + adversário ≤ 5 m)', 'MOD sem proteção', 'freada pedida', 'analógico pulou', 'analógico solto']];
  for (const [cena, o] of Object.entries(saida)) {
    const cs = o.casos.filter(contaPassou);
    lc.push([cena, cs.length, cs.filter(c => c.tocou == null).length, cs.filter(c => c.tocou != null).length, cs.filter(c => c.prot).length, cs.filter(c => c.mod && !c.prot).length, cs.filter(c => c.freada).length, cs.filter(c => c.salto).length, cs.filter(c => c.aX == null).length]);
  }
  console.log('\ncausas (no começo da janela):');
  console.log(tabelaTexto(lc));
  for (const [cena, o] of Object.entries(saida)) {
    console.log(`\nexemplos (${cena}):`);
    for (const c of o.casos.filter(contaPassou).slice(0, NEX)) console.log(`  sem ${c.sem} t0 ${c.t0} → ${c.tick} #${c.id}${c.hum ? ' (controlado)' : ''} ${SITS[c.sit]} s ${fmt(c.s, 1)} vb ${fmt(c.vb, 1)} ${c.tocou != null ? `tocou ${c.tocou} ticks antes (${c.tipoUlt})` : 'sem tocar'} analógico ${c.aX == null ? 'solto' : fmt(c.aX * 180 / Math.PI, 0) + '°'}${c.prot ? ' PROTEÇÃO' : c.mod ? ' MOD' : ''}${c.freada ? ' freada' : ''}${c.salto ? ' pulou' : ''} atrás ${fmt(c.atras, 2)} m ${c.perdeu ? 'PERDEU' : c.volta != null ? `voltou em ${fmt(c.volta, 2)} s` : ''}`);
  }
  console.log('\nbola de passe para outro colada (≤ 0,6 m) no pé de quem não é o recebedor por ≥ 0,2 s, sem toque (por partida):');
  const lb = [['cena', 'adversário do passe (controlado)', 'adversário do passe (IA)', 'companheiro de quem passou']];
  for (const [cena, o] of Object.entries(saida)) {
    const bl = o.bloqueios;
    lb.push([cena, `${bl.filter(x => x.adv && x.hum).length} (${fmt(bl.filter(x => x.adv && x.hum).length / NP, 2)})`, `${bl.filter(x => x.adv && !x.hum).length} (${fmt(bl.filter(x => x.adv && !x.hum).length / NP, 2)})`, `${bl.filter(x => !x.adv).length} (${fmt(bl.filter(x => !x.adv).length / NP, 2)})`]);
    for (const x of bl.slice(0, NEX)) console.log(`  ${cena} sem ${x.sem} t ${x.tick} #${x.id}${x.hum ? ' (controlado)' : ''} ${x.adv ? 'adversário' : 'companheiro'} — passe para #${x.para}, bola ${fmt(x.vb, 1)} m/s`);
  }
  console.log(tabelaTexto(lb));
  const j = arg('--json', null);
  if (j) fs.writeFileSync(j, JSON.stringify(saida, null, 1));
}
