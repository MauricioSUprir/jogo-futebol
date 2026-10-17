// Online 1×1, etapa 0 (determinismo blindado; contrato "Online 1×1" no CONTRATOS.md, seção 8.3 do contrato do online):
// nenhuma função de Math que NÃO é exata pelo IEEE 754 (sin, cos, tan, asin, acos, atan, atan2, exp, expm1, log*, pow,
// hypot, cbrt, sinh, cosh, tanh e as inversas hiperbólicas) roda dentro da simulação da partida, nem Math.random,
// Date.now ou performance.now. Elas variam no último bit entre motores (V8 de versões diferentes, SpiderMonkey,
// JavaScriptCore): dois aparelhos com navegadores diferentes jogando a MESMA partida pela troca de entradas sairiam
// diferentes. A lógica usa o MD (matdet.js, fdlibm).
//
// Como mede: troca as funções de Math (e Date.now, performance.now) por versões que CONTAM as chamadas, ANTES de importar
// a lógica (a lógica que guardasse `const sin = Math.sin` no carregamento também é contada), e só conta dentro da janela
// do passo: os times do pedido do Total Match (tm-times.js, na 2ª semente), criarPartida, passoPartida (com a edição do
// time no meio) e a entrada da IA pelo humano
// (entradaDemoPartida — no online ela roda dentro do passo, nos dois aparelhos, para o lado com o bit IA). Partida
// inteira (2 tempos de PARTIDA.minutosPorTempo), DOIS humanos (um em cada time), 2 sementes; cada humano com analógico
// e botões sorteados (quantizados como a rede: 1/1024), a entrada "de pessoa" vinda da IA dele sem a marca `ia`
// (recepção assistida, mira, cavadinha) e a IA pelo humano (bit IA).
// A parte B confere o TEXTO de todo módulo que o passo carrega (também os caminhos que as partidas não visitaram) e o
// operador **, que não pode ser contado assim (anim.js e cabeceio.js trocaram `a ** 2` por a * a). A parte C confere que todo .sort( dentro do passo tem comparador
// total (desempate pelo id ou pela ordem de origem).
//   node tools/teste-math-proibido.mjs                 (2 sementes, partida inteira)
//   node tools/teste-math-proibido.mjs --sementes 1 --min 1 --onde   (rápido; --onde lista de onde vêm as chamadas)
// Meta: 0 chamadas. Sai com código 1 se houver alguma.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const NSEM = +arg('--sementes', 2);
const MIN = arg('--min', null);
const ONDE = args.includes('--onde');

// ------------------------------------------------------------------ instrumentação (antes de importar a lógica)
const PROIBIDAS = ['sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'exp', 'expm1', 'log', 'log2', 'log10', 'log1p',
  'pow', 'hypot', 'cbrt', 'sinh', 'cosh', 'tanh', 'asinh', 'acosh', 'atanh', 'random'];
const M0 = {};
for (const n of PROIBIDAS) M0[n] = Math[n];
let dentro = false;
const conta = new Map();      // nome → chamadas dentro da janela
const onde = new Map();       // 'nome  arquivo:linha' → chamadas (amostra)
let amostra = 0;
function registrar(nome) {
  conta.set(nome, (conta.get(nome) ?? 0) + 1);
  // de onde veio (a pilha custa caro: as 20 mil primeiras e depois 1 em 97)
  if (++amostra > 20000 && amostra % 97 !== 0) return;
  const lim = Error.stackTraceLimit;
  Error.stackTraceLimit = 4;
  const linhas = new Error().stack.split('\n');
  Error.stackTraceLimit = lim;
  const l = (linhas[3] ?? '?').trim().replace(/^at /, '').replace(/.*\/golaco\//, '').replace(/\)$/, '');
  const k = `${nome}  ${l}`;
  onde.set(k, (onde.get(k) ?? 0) + 1);
}
for (const n of PROIBIDAS) {
  const f = M0[n];
  Math[n] = function (...a) { if (dentro) registrar(`Math.${n}`); return f.apply(Math, a); };
}
// C) .sort( com comparador TOTAL (seção 8.3 do contrato do online): o resultado de um comparador inconsistente (empate que
// devolve 1 dos dois lados, NaN) depende do algoritmo de ordenação de cada motor. Confere, em todo sort dentro da janela,
// que cada par vizinho do resultado sai estritamente ordenado nos dois sentidos (empate só entre valores idênticos).
const sort0 = Array.prototype.sort;
let nSorts = 0;
const sortRuim = new Map();
Array.prototype.sort = function (cmp) {
  const r = sort0.call(this, cmp);
  if (dentro && typeof cmp === 'function') {
    nSorts++;
    for (let i = 0; i + 1 < r.length; i++) {
      const c1 = cmp(r[i], r[i + 1]), c2 = cmp(r[i + 1], r[i]);
      if ((c1 < 0 && c2 > 0) || (c1 === 0 && c2 === 0 && Object.is(r[i], r[i + 1]))) continue;
      const lim = Error.stackTraceLimit; Error.stackTraceLimit = 3;
      const l = (new Error().stack.split('\n')[2] ?? '?').trim().replace(/^at /, '').replace(/.*\/golaco\//, '').replace(/\)$/, '');
      Error.stackTraceLimit = lim;
      sortRuim.set(l, (sortRuim.get(l) ?? 0) + 1);
      break;
    }
  }
  return r;
};
const dataNow = Date.now, perfNow = performance.now.bind(performance);
Date.now = () => { if (dentro) registrar('Date.now'); return dataNow(); };
performance.now = () => { if (dentro) registrar('performance.now'); return perfNow(); };

const P = await import('../js/partida.js');
const S = await import('../js/sim.js');
const { BOTAO, PARTIDA } = await import('../js/config.js');
const TT = await import('../js/tm-times.js');
const EL = await import('../js/elenco.js');
const { PED_C } = await import('./lib/pedidos-tm.mjs');

// (provisório, até a etapa 1: dois humanos emulados como o protótipo do relatório B, medir/comum.mjs)
const DOIS = (() => { const m = P.criarPartida({ semente: 1, humanos: [0, 1], minutosPorTempo: 0.1 }); return m.humanos.length === 2; })();
function criar2(opc) {
  const m = P.criarPartida(opc);
  if (!DOIS) { m.humanos.push(1); m.controlado[1] = P.cobradorDaSaida(m.times[1]); S.jogadorPorId(m, m.controlado[1]).papel = 'humano'; }
  return m;
}
function demo2(m, t) {
  if (DOIS) return P.entradaDemoPartida(m, t);
  const h = m.timeHumano; m.timeHumano = t;
  try { return P.entradaDemoPartida(m); } finally { m.timeHumano = h; }
}
function passo2(m, ents, acoes) {
  if (DOIS) return P.passoPartida(m, ents, acoes);
  const est = m.partida.estado;
  if (acoes) for (const a of acoes) if (a.tipo === 'editarTime') ESC.aplicarEdicao(m, a);
  m.faltaPendente = null; m.infracaoMao = null;
  if (est === 'intervalo' || est === 'fim') { m.eventos = []; m.tick++; }
  else {
    m.eventos = [];
    const pr = m.parada;
    const c = pr && !pr.rolou && pr.cobrador != null ? S.jogadorPorId(m, pr.cobrador) : null;
    P.cobrar(m, c ? ents[c.time] : ents[0]);
    const ev = m.eventos;
    S.passo(m, ents);
    if (ev.length) m.eventos = ev.concat(m.eventos);
  }
  P.regrasPartida(m);
  return m.eventos;
}
const ESC = await import('../js/escalacao.js');

/** A janela em que as chamadas contam. */
function janela(f) { dentro = true; try { return f(); } finally { dentro = false; } }

// gerador do próprio teste (xorshift; usa só + − × ÷ e as funções originais, fora da janela)
function gerador(sem) {
  let s = (sem * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
const q = v => Math.round(v * 1024) / 1024 + 0; // quantizado como a rede (round é exata)
const LISTA = [0, 0, 0, BOTAO.CORRER, BOTAO.PASSE, BOTAO.CHUTE, BOTAO.CHUTE, BOTAO.LANCAMENTO, BOTAO.ENFIADA, BOTAO.TROCAR,
  BOTAO.CONTER, BOTAO.DIVIDIDA, BOTAO.PRESSAO, BOTAO.MOD, BOTAO.GOLEIRO, BOTAO.PEGAR, BOTAO.EFEITO_E, BOTAO.CORRER | BOTAO.PASSE];

/** Entrada de "pessoa" do time t: sorteada, a IA dele sem a marca `ia` (caminhos do humano) ou a IA pelo humano. */
function criarPessoa(sem, t) {
  const r = gerador(sem * 7 + t + 1);
  let e = { x: 0, z: 0, botoes: 0 }, dura = 0, modo = 0, durModo = 0;
  return function entrada(m) {
    if (durModo-- <= 0) { const u = r(); modo = u < 0.3 ? 2 : u < 0.6 ? 1 : 0; durModo = 120 + Math.floor(r() * 600); }
    if (dura-- <= 0) {
      const ang = r() * 2 * Math.PI, mag = r() < 0.2 ? 0 : 0.3 + 0.7 * r();
      e = { x: M0.cos(ang) * mag, z: M0.sin(ang) * mag, botoes: LISTA[Math.floor(r() * LISTA.length)] };
      dura = 10 + Math.floor(r() * 50);
    }
    if (modo === 2) return janela(() => demo2(m, t)); // bit IA: dentro do passo
    let ent = e;
    if (modo === 1) {
      const d = janela(() => demo2(m, t));
      ent = { x: d.x, z: d.z, botoes: d.botoes };
      if (r() < 0.3) ent.botoes |= e.botoes;
    }
    return { x: q(ent.x), z: q(ent.z), botoes: ent.botoes | 0 };
  };
}

function edicao(m, t) {
  return { tipo: 'editarTime', time: t, base: m.times[t].versao, formacao: t === 0 ? '4-4-2' : '4-3-3', vagas: null, substituicoes: [], tatica: { mentalidade: 1 + t, pressao: 2, largura: 1, linha: 2 } };
}

const t0 = Date.now();
const resumo = [];
const cobrancas = {};
for (let sem = 1; sem <= NSEM; sem++) {
  const opc = { semente: 100 + sem, humanos: [0, 1] };
  if (MIN != null) opc.minutosPorTempo = +MIN;
  // a 2ª semente com os times de um pedido do Total Match (tm-times.js: o húngaro das vagas também roda nos dois aparelhos)
  if (sem % 2 === 0) {
    const T = janela(() => { const T = TT.timesDoPedido(PED_C); for (const el of T.elencos) EL.registrarElenco(el); return T; });
    opc.elencos = TT.ELENCOS_TM; opc.times = T.times;
  }
  const m = janela(() => criar2(opc));
  const pessoas = [criarPessoa(sem, 0), criarPessoa(sem, 1)];
  const N = 2 * (MIN != null ? +MIN : PARTIDA.minutosPorTempo) * 3600 + 3000;
  let i = 0;
  for (; i < N && m.partida.estado !== 'fim'; i++) {
    const ents = { 0: pessoas[0](m), 1: pessoas[1](m) };
    const acoes = i === 2000 ? [edicao(m, 0)] : i === 2600 ? [edicao(m, 1)] : null;
    const pr = m.parada;
    if (pr && !pr.rolou && pr.cobrador != null) { const c = S.jogadorPorId(m, pr.cobrador); if (c) cobrancas[`${pr.tipo} t${c.time}`] = 1; }
    janela(() => passo2(m, ents, acoes));
  }
  resumo.push(`semente ${100 + sem}: ${i} passos, estado ${m.partida.estado}, placar ${m.placar[0]}×${m.placar[1]}, humanos [${m.humanos}]`);
}
const total = [...conta.values()].reduce((s, v) => s + v, 0);

// ------------------------------------------------------------------ parte B: o texto dos módulos do passo
// Os caminhos que as partidas acima não visitaram (pênalti, expulsão...) também contam: todo módulo que o passo carrega
// (o grafo de imports a partir de partida.js e tm-times.js) não pode ter no código (fora dos comentários) uma função
// proibida de Math, Date.now, performance.now nem o operador ** (que não dá para instrumentar).
const JS = path.resolve(AQUI, '../js');
const modulos = new Set();
(function andar(f) {
  if (modulos.has(f)) return;
  modulos.add(f);
  const txt = fs.readFileSync(path.join(JS, f), 'utf8');
  for (const r of txt.matchAll(/(?:from|import\()\s*'\.\/([^']+\.js)'/g)) andar(r[1]);
  if (f === 'partida.js') andar('tm-times.js');
})('partida.js');
const RE_PROIBIDA = new RegExp(`Math\\.(${PROIBIDAS.join('|')})\\b|Date\\.now|performance\\.now|[^*/]\\*\\*[^*/]`);
const texto = [];
for (const f of [...modulos].sort()) {
  if (f === 'matdet.js') continue; // o próprio MD (só + − × ÷ e sqrt; conferido pelo teste-matdet)
  let bloco = false;
  fs.readFileSync(path.join(JS, f), 'utf8').split('\n').forEach((l, k) => {
    // tira comentários (bloco /* */ de várias linhas, // e strings de uma linha com a palavra Math)
    let cod = l;
    if (bloco) { const e = cod.indexOf('*/'); if (e < 0) return; cod = cod.slice(e + 2); bloco = false; }
    cod = cod.replace(/\/\*.*?\*\//g, '');
    const a = cod.indexOf('/*'); if (a >= 0) { cod = cod.slice(0, a); bloco = true; }
    cod = cod.replace(/\/\/.*$/, '').replace(/'[^']*'|`[^`]*`/g, "''");
    if (RE_PROIBIDA.test(cod)) texto.push(`${f}:${k + 1}  ${l.trim().slice(0, 90)}`);
  });
}

console.log(resumo.join('\n'));
console.log(`cobranças vistas: ${Object.keys(cobrancas).sort().join(', ')}`);
console.log(`\nA) chamadas proibidas dentro do passo: ${total}`);
for (const [n, v] of [...conta.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${n.padEnd(16)} ${v}`);
if (total && ONDE) {
  console.log('   de onde (amostra):');
  for (const [k, v] of [...onde.entries()].sort((a, b) => b[1] - a[1])) console.log(`     ${String(v).padStart(7)}  ${k}`);
}
console.log(`B) ${modulos.size} módulos do passo; linhas com função proibida, relógio ou **: ${texto.length}`);
for (const l of texto) console.log(`   ${l}`);
const ruins = [...sortRuim.values()].reduce((s, v) => s + v, 0);
console.log(`C) sorts com comparador dentro do passo: ${nSorts}; com empate ou inconsistência: ${ruins}`);
for (const [k, v] of sortRuim) console.log(`   ${String(v).padStart(7)}  ${k}`);
const ok = total === 0 && texto.length === 0 && ruins === 0;
console.log(`\nteste-math-proibido: ${ok ? 'PASSOU' : 'REPROVOU'} (meta: 0 chamadas, 0 linhas e todo sort total) em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(ok ? 0 : 1);
