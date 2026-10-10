// Troca para quem disputa a bola alta (Etapa 3, Parte 4; plano 3.5 e 5.1; pesquisa §7).
// Partida 11×11 IA × IA (a IA joga pelo controlado do time 0, sem apertar TROCAR) com um "canhão" de bolas
// altas: a cada posse assentada (o mesmo condutor há 0,2 s, fora de parada), alternando os times, o condutor
// recebe o pedido de LANÇAMENTO na direção de um companheiro sorteado pelo gerador do teste (a 16–55 m e à
// frente; perto da linha de fundo o lançamento vira cruzamento para a área, acoes.js) — a bola sai pelas
// regras do jogo, com o time posicionado pela IA. Os voos que a IA faz sozinha contam à parte (natural).
// Disputa = cabeceio ou domínio no peito/coxa de um jogador do time 0 (o do humano). Metas (plano 5.1):
//  - canhão: ≥ 120 bolas (≥ 60 do adversário para o meu campo e a minha área, ≥ 60 do meu time); ≥ 90% das
//    disputas do time 0 com o controlado (no tick antes do contato) sendo quem disputa;
//  - ≤ 1 troca extra por bola (trocas de controle no voo além da 1ª) e média ≤ 0,3;
//  - natural (IA × IA, sem o canhão; os dois times com um humano — a IA joga pelo controlado de cada um,
//    e a disputa de cada time conta contra o controlado dele): ≥ 90% com ≥ 60 disputas (real: 97%
//    reavaliando até 0,5 s antes, Metrica, pesquisa §7).
//   node tools/teste-aereo-troca.mjs                (lógica do repositório)
//   node tools/teste-aereo-troca.mjs --antes        (a mesma partida com a IA de antes, sem a troca aérea)
//   node tools/teste-aereo-troca.mjs --js <pasta>   (outra cópia da lógica)
//   node tools/teste-aereo-troca.mjs --sementes 6 --min 2 --naturais 8 --min-natural 4 --base 1
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const ANTES = args.includes('--antes');
const NS = +arg('--sementes', 6);       // partidas com o canhão
const MIN = +arg('--min', 2);           // minutos de cada uma
const NS_NAT = +arg('--naturais', 8);   // partidas sem o canhão (natural; os dois times com um humano)
const MIN_NAT = +arg('--min-natural', 4);
const NS_SOLTO = +arg('--soltos', 2);   // partidas com o canhão e o analógico largado (assistência)
const BASE = +arg('--base', 1);
const SO = arg('--so', null);           // 'canhao' | 'natural' (o rodar-testes roda as duas partes em paralelo)
const DEPURA = !!process.env.DEPURA;
const DEPURA2 = !!process.env.DEPURA2;
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
const pc = (a, n) => (n ? `${fmt(100 * a / n, 0)}% (${a}/${n})` : '—');
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-aereo-troca: REPROVOU (${falhas})` : '\nteste-aereo-troca: PASSOU');
  process.exit(falhas ? 1 : 0);
}

let P, S, CFG, A, B, IAT;
try {
  P = await imp('partida.js'); S = await imp('sim.js'); CFG = await imp('config.js'); A = await imp('acoes.js'); B = await imp('bola.js');
  IAT = await imp('ia-tatica.js');
} catch (err) {
  reg('a partida 11×11 existe (criarPartida)', `não carregou: ${err.message.split('\n')[0]}`, 'criarPartida', false);
  fim();
}
const { PASSO, CAMPO } = CFG;
const ESPERA = 90; // ticks de jogo corrido entre o fim de um voo do canhão e o próximo
console.log(`lógica: ${JS}${ANTES ? ' (--antes: iaClassica, sem a troca aérea)' : ''} · canhão ${NS} × ${MIN} min, natural ${NS_NAT} × ${MIN_NAT} min, sementes a partir da ${BASE}`);

function rngTeste(s) {
  let a = (s * 2654435761) >>> 0 || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}
const ALTOS = new Set(['lancamento', 'cruzamento']);
// [disputas com o controlado, disputas] por origem; trocas por bola
const R = { canhaoMeu: [0, 0], canhaoAdv: [0, 0], natural: [0, 0], bolas: { canhao: [0, 0], natural: 0 }, extras: [], extraMax: 0 };

/**
 * Canhão: põe a bola no ar saindo de um ponto sorteado do campo de quem lança (`time`), para passar na
 * altura do cabeceio (1,5–2,2 m, já descendo) perto de um jogador do time 0 sorteado no campo de ataque de
 * quem lança — um
 * lançamento (do meio ou da defesa) ou um cruzamento (do corredor lateral, perto da linha de fundo, para a
 * área). No meu time, o recebedor (o companheiro mais perto do ponto) é marcado como no jogo (acoes.js
 * marcarRecebedor) e o controle vai para ele no lançamento. Devolve false se não deu.
 */
function lancar(m, r, time) {
  const lado = m.ataca[time];
  // a bola cai perto de um jogador do time 0 (o do humano) no campo de ataque de quem lança: do adversário,
  // no meu campo e na minha área (um defensor meu disputa); do meu time, no campo dele (um atacante meu)
  const alvos = m.jogadores.filter(o => o.time === 0 && o.posicao !== 'GOL' && o.papel !== 'parado' && o.x * lado > -5 && Math.abs(o.x) < CAMPO.meioX - 4);
  if (!alvos.length) return false;
  const a = alvos[Math.floor(r() * alvos.length)];
  const cruz = a.x * lado > 30 && r() < 0.5;
  let x0, z0;
  if (cruz) { x0 = lado * (40 + r() * 10); z0 = (r() < 0.5 ? -1 : 1) * (24 + r() * 8); }
  else { x0 = a.x - lado * (22 + r() * 22); z0 = a.z + (r() - 0.5) * 30; }
  x0 = Math.max(-CAMPO.meioX + 2, Math.min(CAMPO.meioX - 2, x0)); z0 = Math.max(-CAMPO.meioZ + 2, Math.min(CAMPO.meioZ - 2, z0));
  // o ponto: onde o jogador vai estar (pela velocidade dele) mais um desvio sorteado
  const h = 1.5 + r() * 0.7, el = cruz ? 0.3 + r() * 0.15 : 0.45 + r() * 0.2;
  let tx = a.x + (r() - 0.5) * 3, tz = a.z + (r() - 0.5) * 3;
  let s = 20, sol = null;
  for (let it = 0; it < 2; it++) {
    const D = Math.hypot(tx - x0, tz - z0), ux = (tx - x0) / D, uz = (tz - z0) / D;
    const p = { x: x0, y: 0.11, z: z0 };
    let lo = 5, hi = 42;
    for (let k = 0; k < 28; k++) { s = (lo + hi) / 2; if (B.alturaNaDistancia(p, ux, uz, D, s, el).y < h) lo = s; else hi = s; }
    sol = B.alturaNaDistancia(p, ux, uz, D, s, el);
    if (Math.abs(sol.y - h) > 0.15) return false;
    if (it === 0) { tx += a.vx * sol.ticks * PASSO * 0.7; tz += a.vz * sol.ticks * PASSO * 0.7; }
  }
  const D = Math.hypot(tx - x0, tz - z0), ux = (tx - x0) / D, uz = (tz - z0) / D;
  const ce = Math.cos(el), se = Math.sin(el);
  // quem lança: o jogador do time mais perto da origem; quem tinha a bola a perde
  let de = null;
  for (const o of m.jogadores) if (o.time === time && o.posicao !== 'GOL' && (!de || Math.hypot(o.x - x0, o.z - z0) < Math.hypot(de.x - x0, de.z - z0))) de = o;
  for (const o of m.jogadores) if (o.cond) { o.cond.toque = null; o.cond.busca = false; }
  Object.assign(m.bola, { p: { x: x0, y: 0.11, z: z0 }, v: { x: ux * s * ce, y: s * se, z: uz * s * ce }, w: { x: 0, y: 0, z: 0 }, rolando: false });
  m.posse = null; m.naMao = null;
  m.ultimoToque = { id: de.id, time, tick: m.tick };
  // recebedor só no lançamento do meu time (o do adversário é a bola para o espaço, em cima de um defensor
  // meu: o canhão quer disputas do time 0; com recebedor marcado o atacante dele chegava antes quase sempre)
  let rec = null;
  if (time === 0) for (const o of m.jogadores) if (o.time === time && o.posicao !== 'GOL' && o !== de && (!rec || Math.hypot(o.x - tx, o.z - tz) < Math.hypot(rec.x - tx, rec.z - tz))) rec = o;
  m.voo = { tipo: cruz ? 'cruzamento' : 'lancamento', de: de.id, time, para: rec ? rec.id : null, alvo: { x: tx, z: tz }, tick0: m.tick, tickChave: m.tick, tickChegada: m.tick + sol.ticks, alto: true };
  if (rec) {
    rec.recebe = { tick: m.tick, x: tx, z: tz, tipo: m.voo.tipo, chega: m.tick + sol.ticks };
    if (m.humanos.includes(time) && m.controlado[time] !== rec.id) A.assumirControle(m, time, rec);
  }
  return true;
}

/**
 * O humano (o mesmo nas duas versões): a IA joga pelo controlado; com a bola alta e sem dono, ele corre
 * para o primeiro ponto do voo, na altura da cabeça, a que chega a tempo (lê a bola: a conta é a física do
 * jogo) — ou, com `solto`, larga o analógico (a assistência do jogo decide).
 */
function entradaHumano(m, solto, time = 0) {
  const jc = S.jogadorPorId(m, m.controlado[time]);
  const e = time === 0 ? P.entradaDemoPartida(m) : jc ? IAT.entradaIATatica(m, jc) : { x: 0, z: 0, botoes: 0 };
  const b = m.bola;
  if (b.rolando || m.posse != null || m.naMao != null) return e;
  if (solto) return { x: 0, z: 0, botoes: 0 };
  const j = jc;
  if (!j || j.posicao === 'GOL') return e;
  // o primeiro ponto do voo, já na altura da cabeça (≤ 2,3 m), a que ele chega correndo a tempo; se não
  // chega a nenhum, onde a bola desce a 2 m (o humano relê a bola a cada 0,1 s)
  const L = LEITURAS[time];
  if (!(L.m === m && L.id === j.id && m.tick - L.tick < 6)) lerBola(m, j, b, L);
  const dx = L.x - j.x, dz = L.z - j.z, d = Math.hypot(dx, dz);
  if (d < 0.3) return { x: 0, z: 0, botoes: 0 };
  const mag = Math.min(1, d / 3);
  return { x: dx / d * mag, z: dz / d * mag, botoes: d > 4 ? CFG.BOTAO.CORRER : 0 };
}
const LEITURA = { m: null, id: -1, tick: -1, x: 0, z: 0 };
const LEITURAS = [LEITURA, { m: null, id: -1, tick: -1, x: 0, z: 0 }];
function lerBola(m, j, b, L) {
  const c = B.copiarBola(b);
  let px = null, pz = null, qx = c.p.x, qz = c.p.z;
  const vmax = j.par.vArrancada;
  for (let i = 1; i <= 240; i++) {
    B.passoBola(c, null);
    if (c.p.y <= 2.3) {
      const d = Math.max(0, Math.hypot(c.p.x - j.x, c.p.z - j.z) - 0.5);
      if (d / vmax + 0.25 <= i * PASSO) { px = c.p.x; pz = c.p.z; break; }
    }
    if (qx === null || (c.v.y < 0 && c.p.y > 2.0)) { qx = c.p.x; qz = c.p.z; }
    if (c.rolando) break;
  }
  if (px === null) { px = qx; pz = qz; }
  Object.assign(L, { m, id: j.id, tick: m.tick, x: px, z: pz });
}

function rodar(sem, min, injeta, solto = false) {
  const r = rngTeste(sem * 7 + 3);
  const m = P.criarPartida({ semente: sem, iaClassica: ANTES, minutosPorTempo: min });
  const N = Math.round(min * 60 / PASSO);
  // no jogo natural os DOIS times têm um humano (a IA joga pelo controlado de cada um): as disputas
  // pelo alto dos dois contam, cada uma contra o controlado do próprio time (dobra a amostra no mesmo tempo)
  const dois = !injeta;
  if (dois) {
    m.humanos = [0, 1];
    let c1 = null;
    for (const o of m.jogadores) if (o.time === 1 && o.posicao !== 'GOL' && (!c1 || Math.hypot(o.x, o.z) < Math.hypot(c1.x, c1.z))) c1 = o;
    m.controlado[1] = c1.id;
  }
  let voo = null, fimVoo = 0;
  for (let i = 0; i < N; i++) {
    // ------------------------------------------------ canhão: uma bola alta a cada ~3 s de jogo corrido
    const livre = !(m.parada && !m.parada.rolou) && m.partida.estado === 'jogo' && m.naMao == null;
    let canhao = false, ctrlAntes = m.controlado[0];
    if (injeta && !voo && livre && m.tick - fimVoo > ESPERA && i > 120) {
      // a bola do adversário vira disputa do time 0 bem menos vezes (o atacante dele ganha no alto ou ela
      // cai sem ninguém): o adversário lança de 2 a 3 vezes mais
      // (2 bolas do adversário para 1 do meu time; o meu time não fica sem bola: no máximo 3 por 1)
      const nb = R.bolas.canhao;
      const time = nb[1] >= 3 * nb[0] ? 0 : nb[1] < 2 * nb[0] ? 1 : (R.canhaoAdv[1] <= R.canhaoMeu[1] ? 1 : 0);
      const ctrl0 = m.controlado[0];
      if (lancar(m, r, time)) {
        canhao = true;
        voo = { canhao, time, trocas: m.controlado[0] !== ctrl0 ? 1 : 0, ctrl: m.controlado[0], disputa: false };
        R.bolas.canhao[time]++;
        ctrlAntes = m.controlado[0];
      }
    }
    let ev;
    const ctrlAntes1 = m.controlado[1];
    if (dois) {
      // o mesmo passo da partida (partida.js passoPartida) com a entrada dos dois humanos
      const e0 = entradaHumano(m, solto, 0), e1 = entradaHumano(m, solto, 1);
      const est = m.partida.estado;
      if (est === 'intervalo' || est === 'fim') { m.eventos = []; m.tick++; } else S.passo(m, { 0: e0, 1: e1 });
      P.regrasPartida(m);
      ev = m.eventos;
    } else ev = P.passoPartida(m, entradaHumano(m, solto), null);
    for (const e of ev) if (e.tipo === 'passe' && ALTOS.has(e.modo)) R.bolas.natural++;
    if (!voo) {
      // partidas sem o canhão: as disputas pelo alto do time 0 no jogo da IA (natural)
      if (injeta) continue;
      for (const e of ev) {
        if (e.tipo !== 'cabeceio' && e.tipo !== 'dominioAereo') continue;
        const j = S.jogadorPorId(m, e.id);
        if (!j) continue;
        R.natural[1]++;
        if ((j.time === 0 ? ctrlAntes : ctrlAntes1) === e.id) R.natural[0]++;
        else if (DEPURA) { const st = m.trocaAerea?.[j.time]; console.log(`natural sem ${sem} t ${fmt(m.tick * PASSO, 1)} time ${j.time}: disputou ${e.id} (${e.tipo}), controlado ${j.time === 0 ? ctrlAntes : ctrlAntes1}, melhor ${st?.melhor} i ${st?.iMelhor} ativo ${st?.ativo} trocas ${st?.trocas} corr ${st?.correcoes} voo ${m.voo?.tipo ?? '-'} posse ${m.posse}`); }
        else if (DEPURA) console.log(`semente ${sem} t ${fmt(m.tick * PASSO, 1)} s: natural — disputou ${e.id}, controlado ${ctrlAntes}`);
      }
      continue;
    }
    if (DEPURA2) {
      const st = m.trocaAerea?.[0];
      const marc = m.jogadores.filter(o => o.time === 0 && o.cond?.toque?.tipo === 'aereo').map(o => `${o.id}@${o.cond.toque.tick - m.tick}`).join(' ');
      if (st) (voo.tl ??= []).push(`${m.tick - (voo.t0 ??= m.tick)}: ctrl ${m.controlado[0]} melhor ${st.melhor} i ${st.iMelhor} iCtrl ${st.iCtrl} seg ${st.seguidas} corr ${st.correcoes} marc [${marc}] bola y ${fmt(m.bola.p.y)}`);
    }
    for (const e of ev) {
      if (e.tipo !== 'cabeceio' && e.tipo !== 'dominioAereo') continue;
      const j = S.jogadorPorId(m, e.id);
      if (!j || j.time !== 0) continue;
      const k = voo.time === 0 ? 'canhaoMeu' : 'canhaoAdv';
      if (DEPURA2 && ctrlAntes !== e.id) console.log(`FALHA ${k} sem ${sem}: disputou ${e.id}\n  ` + (voo.tl ?? []).filter((_, q, a) => q % 3 === 0 || q > a.length - 8).join('\n  '));
      R[k][1]++;
      if (ctrlAntes === e.id) R[k][0]++;
      else if (DEPURA) console.log(`semente ${sem} t ${fmt(m.tick * PASSO, 1)} s: ${k} — disputou ${e.id}, controlado ${ctrlAntes}`);
      voo.disputa = true;
    }
    // o voo acaba quando alguém (de qualquer time) toca nela pelo alto, domina, a bola rola, sai ou para o jogo
    const tocou = ev.some(e => e.tipo === 'cabeceio' || e.tipo === 'dominioAereo');
    const acabou = voo.disputa || tocou || m.posse != null || m.naMao != null || m.bola.rolando || m.partida.estado !== 'jogo';
    // trocas de controle no voo (no passo em que ele acaba, só a troca aérea: a da posse ganha/perdida
    // depois do contato não é troca no voo)
    if (m.controlado[0] !== voo.ctrl && (!acabou || ev.some(e => e.tipo === 'trocaAerea'))) {
      voo.trocas++;
      if (DEPURA) voo.log = (voo.log ?? '') + ` →${m.controlado[0]}(${ev.filter(e => e.tipo === 'troca' || e.tipo === 'trocaAerea').map(e => e.tipo).join('+')})`;
    }
    voo.ctrl = m.controlado[0];
    if (acabou) {
      if (DEPURA) console.log(`  fim do voo t ${fmt(m.tick * PASSO, 1)} (time ${voo.time}${voo.log ?? ''}): disputa ${voo.disputa} posse ${m.posse} rolando ${m.bola.rolando} eventos ${ev.map(e => e.tipo).join(',')}`);
      { const x = Math.max(0, voo.trocas - 1); R.extras.push(x); R.extraMax = Math.max(R.extraMax, x); }
      voo = null; fimVoo = m.tick;
    }
  }
}
if (SO !== 'natural') for (let s = 0; s < NS; s++) rodar(BASE + s, MIN, true);
if (SO !== 'canhao') for (let s = 0; s < NS_NAT; s++) rodar(BASE + 500 + s, MIN_NAT, false);
// assistência: o canhão com o analógico largado (o jogo leva o controlado à bola)
const Rc = { canhaoMeu: R.canhaoMeu.slice(), canhaoAdv: R.canhaoAdv.slice() };
if (SO !== 'natural') { R.canhaoMeu = [0, 0]; R.canhaoAdv = [0, 0]; for (let s = 0; s < NS_SOLTO; s++) rodar(BASE + 900 + s, MIN, true, true); }
const Rs = { canhaoMeu: R.canhaoMeu, canhaoAdv: R.canhaoAdv };
R.canhaoMeu = Rc.canhaoMeu; R.canhaoAdv = Rc.canhaoAdv;

const soma = (a, b) => [a[0] + b[0], a[1] + b[1]];
const ok90 = (x, nMin) => x[1] >= nMin && x[0] / x[1] >= 0.9;
if (SO !== 'natural') {
  const can = soma(R.canhaoMeu, R.canhaoAdv), sol = soma(Rs.canhaoMeu, Rs.canhaoAdv);
  console.log(`bolas do canhão: ${R.bolas.canhao[0] + R.bolas.canhao[1]} (meu time ${R.bolas.canhao[0]}, adversário ${R.bolas.canhao[1]}; com o analógico largado inclusive)`);
  reg('canhão: bolas altas lançadas (meu time / adversário)', `${R.bolas.canhao[0]} / ${R.bolas.canhao[1]}`, '≥ 60 / ≥ 60', R.bolas.canhao[0] >= 60 && R.bolas.canhao[1] >= 60);
  reg('canhão: o controlado é quem disputa (bola do adversário)', pc(...R.canhaoAdv), '≥ 90% (≥ 20 disputas)', ok90(R.canhaoAdv, 20));
  reg('canhão: o controlado é quem disputa (bola do meu time)', pc(...R.canhaoMeu), '≥ 90% (≥ 20 disputas)', ok90(R.canhaoMeu, 20));
  reg('canhão: o controlado é quem disputa (todas)', pc(...can), '≥ 90% (≥ 60 disputas)', ok90(can, 60));
  reg('assistência (analógico largado): o controlado é quem disputa', pc(...sol), '≥ 90% (≥ 20 disputas)', ok90(sol, 20));
  const mediaExtra = R.extras.length ? R.extras.reduce((a, b) => a + b, 0) / R.extras.length : NaN;
  reg('trocas extras por bola alta (além da 1ª)', `média ${fmt(mediaExtra)}, máx ${R.extraMax} (${R.extras.length} bolas)`, 'média ≤ 0,3 e máx ≤ 1', R.extras.length > 0 && mediaExtra <= 0.3 && R.extraMax <= 1);
}
if (SO !== 'canhao') {
  console.log(`voos altos da IA (lançamentos e cruzamentos) nas partidas sem o canhão: ${R.bolas.natural}`);
  reg('natural (IA × IA, os dois times): o controlado é quem disputa', pc(...R.natural), '≥ 90% com ≥ 60 disputas', ok90(R.natural, 60));
}
fim();
