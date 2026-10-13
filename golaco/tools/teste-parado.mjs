// teste-parado (pedido do dono, 11/10: "se eu deixo o meu jogador parado, ninguém pega a bola, isso NÃO PODE
// ACONTECER"). Partida 11×11 (criarPartida), o controlado do time 0 com a bola, ANALÓGICO SOLTO e nenhum botão,
// em 8 lugares do campo × 3 sementes (a semente mexe ±3 m no lugar e ±60° no rumo); os outros 21 nas referências da
// tática para a bola ali (posicaoTatica: time 0 com a bola, time 1 sem). Mede por 10 s:
//  - tentativa de bote: evento `roubada` da IA, `falta` com origem 'bote'/'carga'/'tatica' de um defensor do time 1, ou
//    `boteErrado` (o bote que chega e não ganha — evento novo da correção);
//  - o 1º homem: a ≤ 1,5 m da bola;
//  - cobertura: na hora do bote (ou aos 3 s, sem bote), a distância do 2º defensor mais perto até a bola.
// Metas (comportamento certo: o 1º homem fecha e dá o bote no condutor parado; o 2º cobre; ninguém fica parado olhando):
//  - parado: bote tentado em ≤ 3 s quando o defensor mais perto começa a ≤ 10 m, em ≤ 5 s em todas as cenas (100%);
//  - andando devagar (analógico a 0,3 para a frente, ~1,7 m/s): bote tentado em ≤ 5 s em 100% (cena que sai pela
//    lateral antes não conta);
//  - cobertura (guarda: "nunca todo mundo parado olhando"): 2º defensor a ≤ 12 m da bola na hora do bote em ≥ 90%
//    das cenas paradas com a bola dentro da linha de engajamento (IA_DEFESA.engaja da pressão do time 1); fora dela,
//    informativo (o bloco está longe e quem vai é a frente);
//  - nenhuma cena parada termina 10 s com a bola no pé do humano.
// Informativos: tempo mediano, faltas entre as tentativas, a mesma conta de costas (rumo + 180°).
//   node tools/teste-parado.mjs                      (no repositório: golaco/tools/)
//   node teste-parado.mjs --js <pasta js>   [--sementes 3] [--detalhe]  (mede outra cópia da lógica)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const NS = +arg('--sementes', 3);
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const P = await imp('partida.js'), C = await imp('config.js'), T = await imp('tatica.js');
const { PASSO } = C;

const LUGARES = [
  { nome: 'próprio campo, perto da área', x: -34, z: 0 },
  { nome: 'próprio campo, meio', x: -24, z: -8 },
  { nome: 'lateral do próprio campo', x: -20, z: -31 },
  { nome: 'intermediária própria', x: -12, z: 6 },
  { nome: 'meio-campo', x: 0, z: 0 },
  { nome: 'campo de ataque', x: 14, z: -6 },
  { nome: 'lateral do ataque', x: 22, z: 31 },
  { nome: 'ataque, perto da área', x: 30, z: 4 },
];

function cena(sem, L0, costas) {
  let a = (sem * 2654435761) >>> 0 || 1;
  const rr = () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
  const L = { x: L0.x + (sem > 1 ? (rr() * 2 - 1) * 3 : 0), z: Math.max(-33, Math.min(33, L0.z + (sem > 1 ? (rr() * 2 - 1) * 3 : 0))) };
  const rumo = (costas ? Math.PI : 0) + (sem > 1 ? (rr() * 2 - 1) * 1.05 : 0);
  const m = P.criarPartida({ semente: sem, minutosPorTempo: 60 });
  m.parada = null; m.partida.estado = 'jogo'; m.partida.desde = 0; m.golTick = null; m.foraDesde = null;
  const pos = new Map();
  for (const t of [0, 1]) for (const j of m.jogadores) if (j.time === t) pos.set(j.id, T.posicaoTatica(m.times[t].formacao, j.vagaId, m.times[t].tatica, L, t === 0 ? 'com' : 'sem', m.ataca[t]));
  let cond = null, dm = Infinity;
  for (const j of m.jogadores) {
    if (j.time !== 0 || j.posicao === 'GOL') continue;
    const o = pos.get(j.id), d = Math.hypot(o.x - L.x, o.z - L.z);
    if (d < dm) { dm = d; cond = j; }
  }
  const usados = [{ x: L.x, z: L.z }];
  for (const j of m.jogadores) {
    if (j === cond) continue;
    let { x, z } = pos.get(j.id);
    x = Math.max(-52, Math.min(52, x)); z = Math.max(-33.5, Math.min(33.5, z));
    for (let k = 0; k < 10 && usados.some(q => Math.hypot(q.x - x, q.z - z) < 1.5); k++) z += z >= 0 ? -1.6 : 1.6;
    usados.push({ x, z });
    P.teleportar(j, x, z, m.ataca[j.time] > 0 ? 0 : Math.PI);
  }
  P.teleportar(cond, L.x, L.z, rumo);
  Object.assign(m.bola, { p: { x: L.x + 0.34 * Math.cos(rumo), y: 0.11, z: L.z + 0.34 * Math.sin(rumo) }, v: { x: 0, y: 0, z: 0 }, w: { x: 0, y: 0, z: 0 }, rolando: true });
  m.posse = cond.id; m.naMao = null; m.voo = null;
  m.ultimoToque = { id: cond.id, time: 0, tick: 0 };
  m.humanos = [0]; m.controlado[0] = cond.id;
  return { m, cond, rumo };
}

function rodar(sem, L, modo, costas) {
  const { m, cond, rumo } = cena(sem, L, costas);
  const def = m.jogadores.filter(o => o.time === 1 && o.posicao !== 'GOL');
  const meuGol = -m.ataca[1] * 52.5;
  const b0 = m.bola.p;
  const d0 = Math.min(...def.map(o => Math.hypot(o.x - b0.x, o.z - b0.z)));
  const engaja = C.IA_DEFESA.engaja[m.times[1].tatica.pressao];
  const r = { d0, tTent: null, res: '', t15: null, d2: null, eng: Math.hypot(meuGol - b0.x, b0.z) <= engaja, fora: false, segue: false };
  const segundo = () => { const b = m.bola.p; const ds = def.map(o => Math.hypot(o.x - b.x, o.z - b.z)).sort((x, y) => x - y); return ds[1]; };
  const ent = modo === 'devagar' ? { x: 0.3 * Math.cos(rumo), z: 0.3 * Math.sin(rumo), botoes: 0 } : { x: 0, z: 0, botoes: 0 };
  for (let i = 0; i < 600; i++) {
    const t = (i + 1) * PASSO;
    const ev = P.passoPartida(m, ent);
    for (const e of ev) {
      if (r.tTent != null) break;
      const d = e.id != null ? m.jogadores.find(o => o.id === e.id) : null;
      if (e.tipo === 'roubada' && d?.time === 1) { r.tTent = t; r.res = 'roubou'; }
      else if (e.tipo === 'boteErrado' && d?.time === 1) { r.tTent = t; r.res = 'errou'; }
      else if (e.tipo === 'falta' && ['bote', 'carga', 'tatica'].includes(e.origem)) { r.tTent = t; r.res = `falta (${e.origem})`; }
    }
    if (r.tTent != null) { r.d2 ??= segundo(); break; }
    if (i === 179 && r.d2 == null) r.d2 = segundo();
    if (m.posse !== cond.id) { r.fora = !!(m.parada && m.parada.tipo === 'lateral'); r.res = m.parada ? m.parada.tipo : 'perdeu'; break; }
    const b = m.bola.p;
    let q1 = null, dq1 = Infinity;
    for (const o of def) { const d = Math.hypot(o.x - b.x, o.z - b.z); if (d < dq1) { dq1 = d; q1 = o; } }
    if (dq1 <= 1.5 && r.t15 == null) r.t15 = t;
    if (i === 599) r.segue = true;
  }
  return r;
}

const fmt = (v, c = 2) => (v == null ? '—' : Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, info = false) => { linhas.push([nome, medido, meta, info ? 'informativo' : ok ? 'PASSOU' : 'REPROVOU']); if (!ok && !info) falhas++; };
const DET = [];
const bloco = (modo, costas) => {
  const R = [];
  for (const L of LUGARES) for (let s = 1; s <= NS; s++) { const r = rodar(s, L, modo, costas); R.push(r); DET.push(`${modo}${costas ? ' de costas' : ''} · ${L.nome} · semente ${s}: mais perto a ${fmt(r.d0, 1)} m · ≤ 1,5 m em ${fmt(r.t15)} s · bote ${fmt(r.tTent)} s ${r.res} · 2º a ${fmt(r.d2, 1)} m${r.eng ? '' : ' (fora da linha de engajamento)'}`); }
  return R;
};
console.log(`lógica: ${JS} · ${LUGARES.length} lugares × ${NS} sementes · 10 s por cena`);
const PA = bloco('parado', false);
const perto = PA.filter(r => r.d0 <= 10);
const ok3 = perto.filter(r => r.tTent != null && r.tTent <= 3).length, ok5 = PA.filter(r => r.tTent != null && r.tTent <= 5).length;
reg('parado: bote tentado em ≤ 3 s (defensor mais perto a ≤ 10 m no início)', `${ok3}/${perto.length}`, '100%', ok3 === perto.length);
reg('parado: bote tentado em ≤ 5 s (todas as cenas)', `${ok5}/${PA.length}`, '100%', ok5 === PA.length);
const segue = PA.filter(r => r.segue).length;
reg('parado: cenas que terminam 10 s com a bola no pé do humano', `${segue}/${PA.length}`, '0', segue === 0);
const EN = PA.filter(r => r.eng), cob = EN.filter(r => r.d2 != null && r.d2 <= 12).length;
reg('parado: 2º defensor a ≤ 12 m da bola na hora do bote (dentro da linha de engajamento)', `${cob}/${EN.length}`, '≥ 90%', cob >= 0.9 * EN.length);
const FO = PA.filter(r => !r.eng), cobF = FO.filter(r => r.d2 != null && r.d2 <= 12).length;
reg('parado: … fora da linha de engajamento (a frente vai sozinha)', `${cobF}/${FO.length}`, '—', true, true);
const ts = PA.filter(r => r.tTent != null).map(r => r.tTent).sort((a, b) => a - b);
const fal = PA.filter(r => r.res.startsWith('falta')).length;
reg('parado: tempo até o bote (mediana) · faltas entre as tentativas', `${fmt(ts[ts.length >> 1])} s · ${fal}/${ts.length}`, '—', true, true);
const DV = bloco('devagar', false).filter(r => !r.fora);
const okD = DV.filter(r => r.tTent != null && r.tTent <= 5).length;
reg('andando devagar (0,3 do analógico): bote tentado em ≤ 5 s', `${okD}/${DV.length}`, '100%', okD === DV.length);
const CO = bloco('parado', true);
const okC = CO.filter(r => r.tTent != null && r.tTent <= 5).length;
reg('parado de costas para o gol da IA: bote tentado em ≤ 5 s', `${okC}/${CO.length} (faltas ${CO.filter(r => r.res.startsWith('falta')).length})`, '—', true, true);
if (args.includes('--detalhe')) console.log(DET.join('\n'));
const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
console.log(falhas ? `\nteste-parado: REPROVOU (${falhas})` : '\nteste-parado: PASSOU');
process.exit(falhas ? 1 : 0);
