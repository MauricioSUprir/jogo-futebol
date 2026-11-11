// Gramado (item 45, C4; plano em PLANO-GRAFICOS.md passo 2, pesquisa em PESQUISA-ESTADIO.md §19): a conta pura das faixas de
// corte (js/render/gramado.js), que o fragment shader do gramado usa pelo GRAMADO_GLSL gerado das mesmas constantes:
//   A) as bordas e a ordem contra a UEFA (Pitch Quality Guidelines 2025, §4.3.1, Fig. 15; a lista abaixo é a do texto do
//      PDF, independente do módulo): 18 faixas, as 4 primeiras de 5,5 m e as 5 de 6,1 m por metade, a faixa 1 (junto ao gol
//      da esquerda) clara, a 9 clara, a 10 escura, a 18 escura; a pequena área, a marca do pênalti e a grande área em bordas;
//   B) faixaEm(x) em ~140 mil x (o campo, atrás das linhas de fundo — a alternância continua com 5,5 m — e exatamente nas
//      bordas) contra uma referência feita da lista da UEFA; as duas metades simétricas (a mesma distância, a paridade
//      trocada);
//   C) o filtro de caixa sobre o degrau: 0,5 na borda, a paridade longe dela, a média numérica do degrau na caixa e a
//      continuidade em cada borda;
//   D) GPU = JS sem GPU: o TEXTO do GRAMADO_GLSL avaliado num interpretador mínimo de GLSL (o subconjunto que o módulo usa;
//      recusa literal inteiro numa conta de float, desvio, ?: e função desconhecida), em double e em float32 emulado operação
//      a operação (o highp da GPU), contra as funções JS; os uniforms; nenhuma derivada nas funções; as linhas do topo do
//      bloco com o fwidth dado;
//   E) as cores (pontos de partida do C6) pela luz e pelo ACES do r170 (tools/lib/cor-aces.mjs): L/C/h/ΔL nas metas da G1 e
//      da G2 do teste-graficos-celular, a noite com o mesmo albedo, o chão de fora na mesma matiz, as linhas ≤ 0,97;
//   F) a profundidade relativa ao foco (C7): o TEXTO do PROFUNDIDADE_GLSL no interpretador = gProfundidade/termoProfundidade
//      (double e float32), sem derivada e só com as constantes do PROFUNDIDADE; o foco (gFocoDe: o raio do meio da tela no chão,
//      sem tocar o horizonte, g = 1, contínuo nele); o termo NO foco é a identidade, a luminância só muda pelo 1 + p (a
//      dessaturação a guarda) e o brilho fica em ±8%; o modelo (luz e ACES do r170) na TV do celular nas metas da G4; o termo
//      apagado pela altura da câmera (rasanteDaCamera) e, pelo modelo, o chão aos pés do assunto nas câmeras baixas das cenas
//      (comemoração, câmera do gol, pré-jogo, cartão) igual ao sem termo (a G4b; a revisão do C4–C8).
//   G) o shader MONTADO (render/gramado-shader.js, os textos que o campo injeta no shader do three): as derivadas explícitas e
//      implícitas antes do 1º desvio de cada bloco e nenhuma nas funções; o `?gfx=antigo` com o texto e a chave da main (hash
//      gravado); as chaves do cache distintas; a troca que não acha o trecho avisa (a revisão do C4–C8).
// A GPU de verdade fica para a G7 do teste-graficos-celular (a classe da faixa lida no pixel = faixaEm, depois que o C6 liga o
// shader); conferido à parte no C4: o GRAMADO_GLSL compila no Chromium 141 do CI (SwiftShader) e, em 4096 x, dá o índice
// igual e a distância à borda a ≤ 4,2 µm do JS — o mesmo que a emulação em float32 da D6.
// Na main (sem js/render/gramado.js) reprova.
//   node tools/teste-gramado.mjs [--js <pasta js>]
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { tabelaTexto, fmt } from './lib/medidas.mjs';
import * as COR from './lib/cor-aces.mjs';

const args = process.argv.slice(2);
const pastaJs = args.includes('--js') ? path.resolve(args[args.indexOf('--js') + 1]) : path.resolve(path.dirname(new URL(import.meta.url).pathname), '../js');
const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

// ------------------------------------------------------------------ interpretador mínimo de GLSL
// O subconjunto do GRAMADO_GLSL: `uniform T n;`, `const T n = e;`, funções `T f(T a, …) { … }` com `T n = e;`, `n = e;`
// (`+=` `-=` `*=` `/=`) e `return e;`; expressões com + − * /, − unário, parênteses, chamadas (as do jogo, as embutidas e as
// dadas de fora, como o fwidth), `.x .y .z .w` e os construtores vec2/vec3/vec4. T ∈ float, vec2, vec3, vec4. Tudo fora disso
// (if, for, ?:, comparação, int, literal inteiro, função desconhecida) é ERRO: o GLSL ES 3.00 não converte int em float, e
// um desvio pediria conferir as derivadas de novo. Com `f32`, cada literal e cada operação arredondam para float32
// (Math.fround), como o highp da GPU (a divisão da GPU tem até 2,5 ulp; aqui ela é a exata arredondada).
const TIPOS = { float: 1, vec2: 2, vec3: 3, vec4: 4 };
const COMP = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 };
function tokenizar(fonte) {
  const s = fonte.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ');
  const re = /\s*(?:(\d+\.\d*(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?|\d+(?:[eE][+-]?\d+)?)|([A-Za-z_]\w*)|(\+=|-=|\*=|\/=|==|!=|<=|>=|&&|\|\||[-+*/(){},;.=<>!?:#[\]%]))/y;
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (/^\s*$/.test(s.slice(i))) break;
    re.lastIndex = i;
    const m = re.exec(s);
    if (!m) throw new Error(`GLSL: caractere inesperado perto de "${s.slice(i, i + 20).trim()}"`);
    i = re.lastIndex;
    if (m[1] !== undefined) {
      if (!/[.eE]/.test(m[1])) throw new Error(`GLSL: literal inteiro "${m[1]}" (o GLSL ES 3.00 não converte int em float: escreva ${m[1]}.0)`);
      out.push({ t: 'num', v: m[1] });
    } else if (m[2] !== undefined) out.push({ t: 'id', v: m[2] });
    else out.push({ t: 'op', v: m[3] });
  }
  return out;
}
function criarInterpretador(fonte, { f32 = false, externas = {}, uniforms = {} } = {}) {
  const R = f32 ? Math.fround : (v => v);
  const toks = tokenizar(fonte);
  let i = 0;
  const olha = () => toks[i];
  const anda = () => toks[i++];
  const espera = v => { const t = anda(); if (!t || t.v !== v) throw new Error(`GLSL: esperava "${v}", veio "${t ? t.v : 'o fim'}"`); return t; };
  const nomeTipo = () => { const t = anda(); if (!t || !TIPOS[t.v]) throw new Error(`GLSL: tipo "${t ? t.v : 'o fim'}" fora do subconjunto (float, vec2, vec3, vec4)`); return t.v; };
  const nome = () => { const t = anda(); if (!t || t.t !== 'id') throw new Error(`GLSL: esperava um nome, veio "${t ? t.v : 'o fim'}"`); return t.v; };
  const tam = v => (typeof v === 'number' ? 1 : v.length);
  const conferir = (tipo, v, onde) => { if (tam(v) !== TIPOS[tipo]) throw new Error(`GLSL: ${onde} é ${tipo} e recebeu ${tam(v) === 1 ? 'float' : 'vec' + tam(v)}`); return v; };
  // conta componente a componente (escalar com vetor espalha; vetores do mesmo tamanho)
  const cc = (fn, ...a) => {
    const n = Math.max(...a.map(tam));
    if (n === 1) return R(fn(...a));
    for (const x of a) if (tam(x) !== 1 && tam(x) !== n) throw new Error('GLSL: vetores de tamanhos diferentes na mesma conta');
    return Array.from({ length: n }, (_, k) => R(fn(...a.map(x => (typeof x === 'number' ? x : x[k])))));
  };
  const soma = (a, b) => cc((x, y) => x + y, a, b), sub = (a, b) => cc((x, y) => x - y, a, b);
  const mul = (a, b) => cc((x, y) => x * y, a, b), div = (a, b) => cc((x, y) => x / y, a, b);
  const EMB = {
    abs: [1, a => cc(Math.abs, a)], floor: [1, a => cc(Math.floor, a)], sign: [1, a => cc(Math.sign, a)],
    fract: [1, a => sub(a, cc(Math.floor, a))], sqrt: [1, a => cc(Math.sqrt, a)],
    min: [2, (a, b) => cc(Math.min, a, b)], max: [2, (a, b) => cc(Math.max, a, b)],
    step: [2, (e, x) => cc((ee, xx) => (xx < ee ? 0 : 1), e, x)],
    mod: [2, (a, b) => sub(a, mul(b, cc(Math.floor, div(a, b))))],
    clamp: [3, (x, a, b) => cc(Math.min, cc(Math.max, x, a), b)],
    mix: [3, (a, b, t) => soma(mul(a, sub(R(1), t)), mul(b, t))],
    smoothstep: [3, (a, b, x) => { const t = EMB.clamp[1](div(sub(x, a), sub(b, a)), R(0), R(1)); return mul(mul(t, t), sub(R(3), mul(R(2), t))); }],
    length: [1, a => (typeof a === 'number' ? R(Math.abs(a)) : R(Math.sqrt(a.reduce((s, x) => R(s + R(x * x)), 0))))],
    dot: [2, (a, b) => { if (tam(a) !== tam(b)) throw new Error('GLSL: dot de tamanhos diferentes'); return typeof a === 'number' ? R(a * b) : a.reduce((s, x, k) => R(s + R(x * b[k])), 0); }],
  };
  const glob = {}, funcs = {}, decl = [];
  for (const [n, v] of Object.entries(uniforms)) glob[n] = typeof v === 'number' ? R(v) : v.map(R);
  // expressões → funções (escopo) → valor
  function primaria() {
    const t = anda();
    if (!t) throw new Error('GLSL: a expressão acabou');
    if (t.t === 'num') { const v = R(Number(t.v)); return () => v; }
    if (t.v === '(') { const e = expr(); espera(')'); return e; }
    if (t.v === '-') { const e = unaria(); return esc => cc(x => -x, e(esc)); }
    if (t.v === '+') return unaria();
    if (t.t === 'id') {
      if (olha()?.v === '(') {
        anda();
        const a = [];
        if (olha()?.v !== ')') { do a.push(expr()); while (olha()?.v === ',' && anda()); }
        espera(')');
        const n = t.v;
        if (TIPOS[n]) {
          return esc => {
            const vs = a.map(e => e(esc)).flatMap(v => (typeof v === 'number' ? [v] : v));
            const k = TIPOS[n];
            if (vs.length === 1) return Array(k).fill(vs[0]);
            if (vs.length !== k) throw new Error(`GLSL: ${n} com ${vs.length} componentes`);
            return vs;
          };
        }
        return esc => {
          const v = a.map(e => e(esc));
          if (funcs[n]) return funcs[n](v);
          if (EMB[n]) { if (v.length !== EMB[n][0]) throw new Error(`GLSL: ${n} pede ${EMB[n][0]} argumentos`); return EMB[n][1](...v); }
          if (typeof externas[n] === 'function') { const r = externas[n](...v); return typeof r === 'number' ? R(r) : r.map(R); }
          throw new Error(`GLSL: o interpretador mínimo não conhece a função "${n}"`);
        };
      }
      if (!/^[A-Za-z_]\w*$/.test(t.v) || ['if', 'else', 'for', 'while', 'return', 'discard', 'int', 'bool', 'true', 'false'].includes(t.v)) throw new Error(`GLSL: "${t.v}" fora do subconjunto`);
      const n = t.v;
      return esc => {
        if (n in esc) return esc[n];
        if (n in glob) return glob[n];
        throw new Error(`GLSL: "${n}" sem valor (uniform sem valor dado, ou nome desconhecido)`);
      };
    }
    throw new Error(`GLSL: "${t.v}" fora do subconjunto`);
  }
  function posfixa() {
    let e = primaria();
    while (olha()?.v === '.') {
      anda();
      const c = nome();
      if (!/^[xyzwrgba]{1,4}$/.test(c)) throw new Error(`GLSL: componente ".${c}"`);
      const base = e, idx = [...c].map(ch => COMP[ch]);
      e = esc => {
        const v = base(esc);
        if (typeof v === 'number') throw new Error(`GLSL: ".${c}" num float`);
        for (const k of idx) if (k >= v.length) throw new Error(`GLSL: ".${c}" além do vec${v.length}`);
        return idx.length === 1 ? v[idx[0]] : idx.map(k => v[k]);
      };
    }
    return e;
  }
  function unaria() {
    if (olha()?.v === '-') { anda(); const e = unaria(); return esc => cc(x => -x, e(esc)); }
    if (olha()?.v === '+') { anda(); return unaria(); }
    return posfixa();
  }
  function termo() {
    let e = unaria();
    while (olha()?.v === '*' || olha()?.v === '/') {
      const op = anda().v, a = e, b = unaria();
      e = op === '*' ? esc => mul(a(esc), b(esc)) : esc => div(a(esc), b(esc));
    }
    return e;
  }
  function expr() {
    let e = termo();
    while (olha()?.v === '+' || olha()?.v === '-') {
      const op = anda().v, a = e, b = termo();
      e = op === '+' ? esc => soma(a(esc), b(esc)) : esc => sub(a(esc), b(esc));
    }
    const prox = olha()?.v;
    if (['?', '<', '>', '<=', '>=', '==', '!=', '&&', '||', '%'].includes(prox)) throw new Error(`GLSL: "${prox}" fora do subconjunto (o gramado é sem desvio)`);
    return e;
  }
  function corpo(tipoRet, nomeF, ps) {
    const st = [], locais = new Map(ps.map(p => [p.nome, p.tipo])); // os parâmetros moram no escopo do corpo
    espera('{');
    while (olha() && olha().v !== '}') {
      const t = olha();
      if (TIPOS[t.v]) {
        const tipo = nomeTipo(), n = nome();
        if (locais.has(n)) throw new Error(`GLSL: "${n}" declarado duas vezes em ${nomeF}`);
        locais.set(n, tipo);
        espera('=');
        const e = expr();
        espera(';');
        st.push(esc => { esc[n] = conferir(tipo, e(esc), `"${n}"`); });
      } else if (t.v === 'return') {
        anda();
        const e = expr();
        espera(';');
        st.push(esc => ({ ret: conferir(tipoRet, e(esc), `o retorno de ${nomeF}`) }));
      } else if (t.t === 'id' && ['=', '+=', '-=', '*=', '/='].includes(toks[i + 1]?.v)) {
        const n = nome(), op = anda().v, e = expr();
        espera(';');
        if (!locais.has(n)) throw new Error(`GLSL: atribuição a "${n}", que não é local de ${nomeF}`);
        const f = { '=': (a, b) => b, '+=': soma, '-=': sub, '*=': mul, '/=': div }[op], tipo = locais.get(n);
        st.push(esc => { esc[n] = conferir(tipo, f(esc[n], e(esc)), `"${n}"`); });
      } else throw new Error(`GLSL: "${t.v}" fora do subconjunto (só declaração, atribuição e return; nada de if/for)`);
    }
    espera('}');
    return st;
  }
  while (i < toks.length) {
    const t = anda();
    if (t.v === 'uniform') { const tipo = nomeTipo(), n = nome(); espera(';'); decl.push({ tipo, nome: n }); if (n in glob) conferir(tipo, glob[n], `o uniform ${n}`); continue; }
    if (t.v === 'const') { const tipo = nomeTipo(), n = nome(); espera('='); const e = expr(); espera(';'); glob[n] = conferir(tipo, e({}), `a constante ${n}`); continue; }
    if (TIPOS[t.v]) {
      const tipoRet = t.v, n = nome();
      espera('(');
      const ps = [];
      if (olha()?.v !== ')') { do ps.push({ tipo: nomeTipo(), nome: nome() }); while (olha()?.v === ',' && anda()); }
      espera(')');
      const st = corpo(tipoRet, n, ps);
      funcs[n] = valores => {
        if (valores.length !== ps.length) throw new Error(`GLSL: ${n} pede ${ps.length} argumentos`);
        const esc = Object.create(null);
        ps.forEach((p, k) => { esc[p.nome] = conferir(p.tipo, valores[k], `o parâmetro ${p.nome} de ${n}`); });
        for (const s of st) { const r = s(esc); if (r) return r.ret; }
        throw new Error(`GLSL: ${n} terminou sem return`);
      };
      continue;
    }
    throw new Error(`GLSL: "${t.v}" fora do subconjunto no nível de cima`);
  }
  return { funcs, uniforms: decl, chamar: (n, ...a) => { if (!funcs[n]) throw new Error(`GLSL: sem a função ${n}`); return funcs[n](a.map(v => (typeof v === 'number' ? R(v) : v.map(R)))); } };
}

// ------------------------------------------------------------------ a referência da UEFA (o texto do PDF; independente do módulo)
// §4.3.1: "The first four bands of the pitch should always be exactly 5.5m wide. The five remaining bands in each half
// should then be of a uniform width, finishing at the halfway line (on 105m pitches these bands will be 6.10m wide …)".
const UEFA = [0, 5.5, 11, 16.5, 22, 28.1, 34.2, 40.3, 46.4, 52.5];
const LARG_UEFA = [5.5, 5.5, 5.5, 5.5, 6.1, 6.1, 6.1, 6.1, 6.1];
const CAMPO_X = [...UEFA.map(b => -52.5 + b), ...UEFA.slice(0, -1).map(b => 52.5 - b).reverse()]; // 19 bordas, em ordem
const ATRAS = [];
for (let k = 1; k <= 6; k++) ATRAS.push(-52.5 - 5.5 * k, 52.5 + 5.5 * k);
const TODAS = [...CAMPO_X, ...ATRAS].sort((a, b) => a - b);
/** A faixa da referência: o índice (no campo, a da direita da borda; atrás, a continuação de 5,5 m), dB e claro (a 1 —
 *  índice 0 — clara e a alternância da Fig. 15). */
function refIdx(x) {
  if (x < -52.5) return Math.floor((x + 52.5) / 5.5);
  if (x >= 52.5) return 18 + Math.floor((x - 52.5) / 5.5);
  let idx = -1;
  for (const b of CAMPO_X) if (b <= x) idx++;
  return idx;
}
function refEm(x) {
  const idx = refIdx(x);
  let dB = Infinity;
  for (const b of TODAS) dB = Math.min(dB, Math.abs(x - b));
  return { idx, dB, claro: ((idx % 2) + 2) % 2 === 0 };
}

// ------------------------------------------------------------------ o teste
let GR = null, erroImp = null;
try { GR = await imp('render/gramado.js'); } catch (e) { erroImp = e; }
if (!GR || typeof GR.faixaEm !== 'function' || typeof GR.GRAMADO_GLSL !== 'string') {
  reg('gramado.js (as faixas UEFA puras, GLSL = JS)', GR ? 'sem faixaEm/GRAMADO_GLSL' : `sem o módulo (${String(erroImp?.message ?? erroImp).slice(0, 80)})`, 'o módulo', false);
} else {
  const { CAMPO } = await imp('config.js');
  const { faixaEm, misturaFaixa, misturaEm, BORDAS_METADE, bordasX, FAIXAS_NO_CAMPO, BORDA_CORTE, GRAMADO_GLSL, glslTopoGramado,
    UNIFORMS_GRAMADO, GRAMADO_HORAS, valoresGramado } = GR;

  // ---------------------------------------------------------------- A) as bordas e a ordem (Fig. 15)
  {
    const difB = BORDAS_METADE.length === UEFA.length ? Math.max(...UEFA.map((b, k) => Math.abs(BORDAS_METADE[k] - b))) : Infinity;
    const larg = BORDAS_METADE.slice(1).map((b, k) => b - BORDAS_METADE[k]);
    reg('A1 bordas por metade = UEFA §4.3.1 (a partir de cada linha de fundo)', `${BORDAS_METADE.map(b => fmt(b, 1)).join('; ')} (difere até ${difB.toExponential(1)} m); larguras ${larg.map(v => fmt(v, 2)).join(' ')}`,
      '0; 5,5; 11; 16,5; 22; 28,1; 34,2; 40,3; 46,4; 52,5 (± 1e−9)', difB <= 1e-9 && larg.every((v, k) => Math.abs(v - LARG_UEFA[k]) <= 1e-9));
    const bx = bordasX();
    const simX = bx.length === 19 && bx.every((b, k) => Math.abs(b + bx[18 - k]) <= 1e-9) && bx.every((b, k) => Math.abs(b - CAMPO_X[k]) <= 1e-9);
    reg('A2 as bordas em x: 19, simétricas, o 0 é a linha do meio', `${bx.length} bordas; −52,5 … 52,5; meio ${fmt(bx[9], 3)}`, '19, = a UEFA, x ↔ −x', simX && Math.abs(bx[9]) <= 1e-12);
    // as faixas no campo e a largura de cada uma (grade de 1 mm)
    const ext = new Map();
    const o = {};
    for (let k = -52499; k <= 52499; k++) {
      const x = k / 1000;
      faixaEm(x, o);
      const e = ext.get(o.indice) ?? { min: Infinity, max: -Infinity, claro: o.claro };
      e.min = Math.min(e.min, x); e.max = Math.max(e.max, x);
      ext.set(o.indice, e);
    }
    const idx = [...ext.keys()].sort((a, b) => a - b);
    const larguras = idx.map(j => ext.get(j).max - ext.get(j).min + 0.001);
    const larguraUEFA = [...LARG_UEFA, ...[...LARG_UEFA].reverse()];
    const difL = idx.length === 18 ? Math.max(...larguras.map((w, k) => Math.abs(w - larguraUEFA[k]))) : Infinity;
    reg('A3 18 faixas no campo, cada uma na largura da UEFA', `${idx.length} faixas (índices ${idx[0]}…${idx[idx.length - 1]}; FAIXAS_NO_CAMPO ${FAIXAS_NO_CAMPO}); largura difere até ${fmt(difL * 1000, 1)} mm`,
      '18 (0…17); ≤ 2 mm (a grade é de 1 mm)', idx.length === 18 && idx[0] === 0 && idx[17] === 17 && FAIXAS_NO_CAMPO === 18 && difL <= 0.002);
    const c = j => ext.get(j)?.claro;
    const alterna = idx.every((j, k) => k === 0 || c(j) !== c(idx[k - 1]));
    reg('A4 a ordem da Fig. 15: a 1 (junto ao gol da esquerda) clara, a 9 clara, a 10 escura, a 18 escura, alternando',
      `1 ${c(0) ? 'clara' : 'escura'} · 9 ${c(8) ? 'clara' : 'escura'} · 10 ${c(9) ? 'clara' : 'escura'} · 18 ${c(17) ? 'clara' : 'escura'} · alternando ${alterna ? 'sim' : 'NÃO'}`,
      'clara · clara · escura · escura · sim', c(0) === true && c(8) === true && c(9) === false && c(17) === false && alterna);
    // as marcas do campo em bordas, dos dois lados
    const marcas = [['pequena área', CAMPO.pequenaArea.profundidade], ['marca do pênalti', CAMPO.marcaPenalti], ['grande área', CAMPO.area.profundidade]];
    const ruins = [];
    for (const [n, d] of marcas) {
      for (const s of [-1, 1]) {
        const x = s * (CAMPO.meioX - d);
        const a = faixaEm(x - 1e-6, {}), b = faixaEm(x + 1e-6, {}), m = faixaEm(x, {});
        if (!(m.distBorda <= 1e-9 && a.indice !== b.indice && a.claro !== b.claro)) ruins.push(`${n} ${s < 0 ? 'esq.' : 'dir.'}`);
      }
    }
    reg('A5 a pequena área, a marca do pênalti e a grande área caem em bordas (os dois lados)', ruins.length ? `fora: ${ruins.join(', ')}` : '6 de 6 em bordas (5,5 · 11 · 16,5 m)', 'as 6', ruins.length === 0);
    const e = faixaEm(-1e-6, {}), d = faixaEm(1e-6, {}), z = faixaEm(0, {});
    reg('A6 a linha do meio separa a clara (x < 0, a 9) da escura (x > 0, a 10)', `x < 0: índice ${e.indice} ${e.claro ? 'clara' : 'escura'} · x > 0: ${d.indice} ${d.claro ? 'clara' : 'escura'} · no 0: dB ${z.distBorda}`,
      '8 clara · 9 escura · dB 0', e.indice === 8 && e.claro && d.indice === 9 && !d.claro && z.distBorda <= 1e-12);
  }

  // ---------------------------------------------------------------- B) faixaEm em muitos x
  const amostra = [];
  for (let k = -60000; k <= 60000; k++) amostra.push(k / 1000);
  let sem = 0x9e3779b9;
  const rnd = () => { sem = (sem + 0x6d2b79f5) | 0; let t = Math.imul(sem ^ (sem >>> 15), 1 | sem); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let k = 0; k < 20000; k++) amostra.push(-65 + 130 * rnd());
  {
    let idxErr = 0, clErr = 0, dbMax = 0, n = 0;
    const o = {};
    for (const x of amostra) {
      const r = refEm(x);
      faixaEm(x, o);
      dbMax = Math.max(dbMax, Math.abs(o.distBorda - r.dB));
      if (r.dB <= 1e-9) continue;
      n++;
      if (o.indice !== r.idx) idxErr++;
      if (o.claro !== r.claro || o.paridade !== (o.claro ? 0 : 1)) clErr++;
    }
    reg('B1 faixaEm = a referência da UEFA (grade de 1 mm de −60 a 60 m + 20 mil sorteados de −65 a 65)', `${n} x fora das bordas: ${idxErr} índices e ${clErr} claro/escuro diferentes; distBorda difere até ${dbMax.toExponential(1)} m`,
      '0 · 0 · ≤ 1e−9 m', idxErr === 0 && clErr === 0 && dbMax <= 1e-9);
    // exatamente nas bordas (o campo e atrás das linhas de fundo)
    const ruins = [];
    for (const b of TODAS) {
      const m = faixaEm(b, {}), esq = refEm(b - 1e-4).idx, dir = refEm(b + 1e-4).idx;
      const ts = [0, 0.02, 0.3, 2].map(fw => misturaEm(b, fw));
      if (!(m.distBorda <= 1e-9 && (m.indice === esq || m.indice === dir) && ts.every(t => Math.abs(t - 0.5) <= 1e-8))) ruins.push(fmt(b, 1));
    }
    reg('B2 exatamente nas bordas (as 19 do campo e 12 atrás das linhas de fundo)', ruins.length ? `fora: ${ruins.join(', ')}` : `${TODAS.length} de ${TODAS.length}: distBorda 0, o índice de um dos lados, t = 0,5`, `as ${TODAS.length}`, ruins.length === 0);
    // atrás das linhas de fundo: a alternância continua com 5,5 m
    const casos = [[-55, -1, false], [-58.3, -2, true], [-61, -2, true], [55, 18, true], [58.3, 19, false], [61, 19, false]];
    const atras = casos.map(([x, i, cl]) => { const m = faixaEm(x, {}); return { x, ok: m.indice === i && m.claro === cl, m }; });
    const larg = [];
    for (const [a, bb] of [[-63.5, -58], [-58, -52.5], [52.5, 58], [58, 63.5]]) {
      const i0 = faixaEm(a + 0.001, {}).indice;
      let ok = true;
      for (let x = a + 0.001; x < bb - 0.0005; x += 0.01) if (faixaEm(x, {}).indice !== i0) ok = false;
      larg.push(ok && faixaEm(a - 0.001, {}).indice !== i0 && faixaEm(bb + 0.001, {}).indice !== i0);
    }
    reg('B3 atrás das linhas de fundo a alternância continua com 5,5 m', `${atras.map(a => `${fmt(a.x, 1)}: ${a.m.indice} ${a.m.claro ? 'clara' : 'escura'}`).join(' · ')}; faixas de 5,5 m inteiras: ${larg.filter(Boolean).length}/4`,
      '−1 escura · −2 clara · 18 clara · 19 escura; 4/4', atras.every(a => a.ok) && larg.every(Boolean));
    // simetria das duas metades
    let simErr = 0, nS = 0;
    for (const x of amostra) {
      if (x === 0) continue;
      const a = faixaEm(x, {}), b = faixaEm(-x, {});
      nS++;
      if (!(a.distBorda === b.distBorda && a.indice + b.indice === 17 && a.paridade + b.paridade === 1 && a.claro !== b.claro)) simErr++;
    }
    reg('B4 simetria das metades: faixaEm(−x) = o espelho de faixaEm(x)', `${simErr} de ${nS} diferentes (a mesma distância à borda, o índice 17 − i, a paridade trocada)`, '0', simErr === 0);
  }

  // ---------------------------------------------------------------- C) o filtro de caixa sobre o degrau
  {
    let ruimBorda = 0, ruimLonge = 0;
    for (const p of [0, 1]) for (const w of [0.01, 0.1, 0.5, 3, 20]) {
      if (misturaFaixa(p, 0, w) !== 0.5) ruimBorda++;
      for (const k of [0.5, 0.75, 1, 3]) if (misturaFaixa(p, k * w, w) !== p) ruimLonge++;
    }
    reg('C1 o filtro: 0,5 em cima da borda; a paridade a ≥ w/2 dela', `${ruimBorda} fora na borda, ${ruimLonge} fora longe (p 0 e 1, w de 0,01 a 20 m)`, '0 · 0', ruimBorda === 0 && ruimLonge === 0);
    // a média numérica do degrau na caixa [x − w/2, x + w/2] (pela referência da UEFA), perto de cada borda do campo
    let pior = 0, n = 0;
    const N = 2000;
    const escura = x => (refIdx(x) & 1); // a paridade pela referência (só o índice: o C2 chama ~9 milhões de vezes)
    for (const fw of [0, 0.25, 1, 3]) {
      const w = fw + BORDA_CORTE;
      // (o passo de q não cai na grade das amostras: a borda fica em qualquer lugar entre duas delas)
      for (const b of CAMPO_X) for (let q = -0.7 + 0.0123; q <= 0.7; q += 0.0517) {
        const x = b + q * w;
        let esc = 0;
        for (let k = 0; k < N; k++) esc += escura(x - w / 2 + (k + 0.5) * w / N);
        pior = Math.max(pior, Math.abs(misturaEm(x, fw) - esc / N));
        n++;
      }
    }
    reg('C2 t = a média do degrau na caixa (a fração escura), perto das 19 bordas', `${n} pontos (w = fwidth + ${fmt(BORDA_CORTE, 2)} m, fwidth 0 a 3 m): difere até ${pior.toExponential(1)}`, '≤ 1/(2·2000) = 2,5e−4 (o erro da média de 2000 amostras)', pior <= 0.5 / N + 1e-9);
    let salto = 0;
    const eps = 1e-5;
    for (const b of TODAS) for (const fw of [0, 0.3, 2]) salto = Math.max(salto, Math.abs(misturaEm(b - eps, fw) - misturaEm(b + eps, fw)));
    reg('C3 contínuo em cada borda (o lado que o arredondamento escolhe não aparece)', `|t(b − 10 µm) − t(b + 10 µm)| até ${salto.toExponential(1)}`, `≤ 4·10 µm / 0,1 m = 4e−4`, salto <= 4 * eps / BORDA_CORTE + 1e-12);
  }

  // ---------------------------------------------------------------- D) GPU = JS sem GPU (o texto GLSL interpretado)
  {
    const nomes = (GRAMADO_GLSL.match(/uniform\s+\w+\s+\w+/g) ?? []).map(s => s.split(/\s+/)[2]);
    const mesmos = Array.isArray(UNIFORMS_GRAMADO) && nomes.length === UNIFORMS_GRAMADO.length && nomes.every((n, k) => n === UNIFORMS_GRAMADO[k]);
    const pedidos = ['uManchas', 'uRasante', 'uBrancoLinha', 'uBorda', 'uGFoco'];
    reg('D1 os uniforms do GLSL = UNIFORMS_GRAMADO (os do plano)', nomes.join(', '), `os mesmos, com ${pedidos.join(', ')}`, mesmos && pedidos.every(p => nomes.includes(p)));
    // as derivadas: nenhuma nas funções; no topo do bloco, só na 1ª linha (antes de qualquer conta que possa desviar)
    const topo = typeof glslTopoGramado === 'function' ? glslTopoGramado('xMundo') : '';
    const linhasTopo = topo.split('\n').map(l => l.trim()).filter(Boolean);
    const derivFunc = /\b(fwidth|dFdx|dFdy)\b/.test(GRAMADO_GLSL);
    const derivTopo = linhasTopo.map(l => /\b(fwidth|dFdx|dFdy)\b/.test(l));
    // com a pegada dada (o `fwidth(vMundoXZ)` que o bloco do campo já calcula no topo: a revisão do C4–C8, a pegada uma vez
    // só), nenhuma derivada nas linhas do topo — a do bloco montado a guarda G1 confere
    const topoDado = typeof glslTopoGramado === 'function' ? glslTopoGramado('xMundo', 'pegadaX') : '';
    const derivDado = /\b(fwidth|dFdx|dFdy)\b/.test(topoDado), usaDado = /\bpegadaX\b/.test(topoDado);
    reg('D2 as derivadas no topo do bloco, fora das funções (lição do PR #631); com a pegada dada, nenhuma',
      `nas funções: ${derivFunc ? 'SIM' : 'nenhuma'}; no topo: na linha ${derivTopo.map((v, k) => (v ? k + 1 : null)).filter(Boolean).join(', ') || '—'} de ${linhasTopo.length}; com a pegada dada: ${derivDado ? 'SIM' : 'nenhuma'}${usaDado ? ', a dada' : ', SEM a dada'}`,
      'nenhuma nas funções; só a 1ª do topo; nenhuma com a dada', !derivFunc && derivTopo[0] === true && derivTopo.slice(1).every(v => !v) && !derivDado && usaDado);
    // os números do GLSL são as constantes do JS (as da UEFA e do campo; o resto é 0, 0,5, 1 e 2 das contas)
    const nums = [...new Set((GRAMADO_GLSL.replace(/\/\/[^\n]*/g, '').match(/\b\d+\.\d*\b|\b\d+\b/g) ?? []).map(Number))].sort((a, b) => a - b);
    const permitidos = [0, 0.5, 1, 2, CAMPO.meioX, 22, 5.5, 6.1, 4, 17];
    const estranhos = nums.filter(v => !permitidos.some(p => Math.abs(p - v) <= 1e-12));
    reg('D3 os números do GLSL = as constantes (52,5 · 22 · 5,5 · 6,1 · 4 · 17; 0 · 0,5 · 1 · 2)', nums.join(' · '), 'nenhum outro', estranhos.length === 0);
    // o texto avaliado: double e float32
    const FW = 0.07; // o fwidth dado ao topo (m)
    let gD = null, gF = null, erroG = null;
    try {
      const fonte = GRAMADO_GLSL + `\nfloat topoGramado(float xMundo) {\n${topo}\nreturn gramadoT;\n}\n`;
      const U = valoresGramado('dia');
      gD = criarInterpretador(fonte, { uniforms: U, externas: { fwidth: () => FW } });
      gF = criarInterpretador(fonte, { f32: true, uniforms: U, externas: { fwidth: () => FW } });
    } catch (e) { erroG = e.message; }
    if (erroG) reg('D4 o GLSL no interpretador mínimo', erroG, 'avalia', false);
    else {
      let errD = 0, dbD = 0, tD = 0, topoD = 0;
      let idxF = 0, nF = 0, dbF = 0, tF = 0;
      const o = {};
      for (const x of amostra) {
        faixaEm(x, o);
        const v = gD.chamar('gramadoFaixa', x);
        if (v[0] !== o.indice) errD++;
        dbD = Math.max(dbD, Math.abs(v[1] - o.distBorda));
        for (const w of [0.1, 0.4, 2.5]) tD = Math.max(tD, Math.abs(gD.chamar('gramadoMistura', v, w) - misturaFaixa(o.paridade, o.distBorda, w)));
        topoD = Math.max(topoD, Math.abs(gD.chamar('topoGramado', x) - misturaEm(x, FW)));
        // float32: o x já chega à GPU em float; o índice só conta longe da borda (a grade do float a 52 m é ~4 µm)
        const xf = Math.fround(x), r = refEm(xf);
        const vf = gF.chamar('gramadoFaixa', xf);
        faixaEm(xf, o);
        dbF = Math.max(dbF, Math.abs(vf[1] - o.distBorda));
        for (const w of [0.1, 0.4, 2.5]) tF = Math.max(tF, Math.abs(gF.chamar('gramadoMistura', vf, w) - misturaFaixa(o.paridade, o.distBorda, w)));
        if (r.dB > 1e-4) { nF++; if (vf[0] !== o.indice) idxF++; }
      }
      reg('D4 GLSL (double) = JS: gramadoFaixa = faixaEm e gramadoMistura = misturaFaixa', `${amostra.length} x: ${errD} índices diferentes; distBorda até ${dbD.toExponential(1)} m; t até ${tD.toExponential(1)}`, '0 · ≤ 1e−12 · ≤ 1e−12', errD === 0 && dbD <= 1e-12 && tD <= 1e-12);
      reg('D5 as linhas do topo (fwidth dado, + uBorda) = misturaEm(x, fwidth)', `t difere até ${topoD.toExponential(1)} (fwidth ${FW} m, uBorda ${valoresGramado('dia').uBorda} m)`, '≤ 1e−12', topoD <= 1e-12);
      reg('D6 GLSL em float32 (o highp da GPU, emulado operação a operação) = JS', `${nF} x a > 0,1 mm da borda: ${idxF} índices diferentes; distBorda até ${fmt(dbF * 1e6, 1)} µm; t até ${tF.toExponential(1)}`,
        '0 · ≤ 20 µm · ≤ 1e−3 (w ≥ 0,1 m)', idxF === 0 && dbF <= 2e-5 && tF <= 1e-3);
      // o interpretador recusa o que o GLSL ES 3.00 não aceita e o que o gramado não pode ter (prova de que ele confere)
      const recusa = [
        ['literal inteiro', GRAMADO_GLSL.replace(/\b17\.0\b/, '17')],
        ['desvio (if)', GRAMADO_GLSL.replace('float a = u0 + k * L;', 'float a = u0; if (k > 0.0) a = u0 + k * L;')],
        ['?:', GRAMADO_GLSL.replace('step(0.0, x)', '(x < 0.0 ? 0.0 : 1.0)')],
        ['função desconhecida', GRAMADO_GLSL.replace('floor(', 'roundEven(')],
      ];
      const passou = recusa.filter(([, src]) => { try { criarInterpretador(src, { uniforms: valoresGramado('dia') }).chamar('gramadoFaixa', 3.3); return true; } catch { return false; } }).map(([n]) => n);
      const mudou = recusa.filter(([, src]) => src === GRAMADO_GLSL).map(([n]) => n);
      reg('D7 o interpretador recusa o que o GLSL não aceita (literal inteiro, desvio, ?:, função desconhecida)', passou.length || mudou.length ? `aceitou: ${passou.join(', ') || '—'}; a troca não achou o trecho: ${mudou.join(', ') || '—'}` : '4 de 4 recusados', 'os 4', !passou.length && !mudou.length);
    }
  }

  // ---------------------------------------------------------------- E) as cores e os parâmetros por hora (pontos de partida do C6/C7)
  {
    const D = GRAMADO_HORAS?.dia, Nt = GRAMADO_HORAS?.noite;
    const faixas = (hora, fator = 1) => {
      const a = COR.oklab(COR.corNaTela(GRAMADO_HORAS[hora].clara, { hora, fator })), b = COR.oklab(COR.corNaTela(GRAMADO_HORAS[hora].escura, { hora, fator }));
      return { a, b, dL: a.L - b.L, L: (a.L + b.L) / 2, C: (a.C + b.C) / 2, h: a.h + COR.difMatiz(b.h, a.h) / 2 };
    };
    if (!D || !Nt) reg('E as cores por hora (GRAMADO_HORAS)', 'sem a tabela', 'dia e noite', false);
    else {
      const d = faixas('dia');
      reg('E1 dia: o verde realista na tela (luz e ACES do r170; as metas da G1 e da G2)', `${COR.fmt(d)} · ΔL ${fmt(d.dL, 4)} (clara ${COR.hexDeLinear(D.clara)} · escura ${COR.hexDeLinear(D.escura)})`,
        'L 0,58 ± 0,02 · C 0,10 ± 0,01 · h 124 ± 3° · ΔL 0,056 ± 0,008', Math.abs(d.L - 0.58) <= 0.02 && Math.abs(d.C - 0.10) <= 0.01 && Math.abs(COR.difMatiz(d.h, 124)) <= 3 && Math.abs(d.dL - 0.056) <= 0.008);
      const mesmo = ['clara', 'escura', 'fora'].every(k => Nt[k].length === 3 && Nt[k].every((v, i) => v === D[k][i]));
      const n = faixas('noite', COR.pocoNoite(0, 0));
      reg('E2 noite: o MESMO albedo do dia (a seção N do teste-graficos-celular prevê a noite por ele); ΔL no meio do poço de luz', `${mesmo ? 'o mesmo' : 'OUTRO'} albedo; ${COR.fmt(n)} · ΔL ${fmt(n.dL, 4)}`,
        'o mesmo · ΔL 0,056 ± 0,008', mesmo && Math.abs(n.dL - 0.056) <= 0.008);
      const fo = COR.oklab(COR.corNaTela(D.fora));
      reg('E3 o chão de fora: a mesma matiz, mais escuro e não mais saturado que o gramado', `${COR.fmt(fo)} (${COR.hexDeLinear(D.fora)}; o gramado L ${fmt(d.b.L, 3)} na escura, C ${fmt(d.C, 3)})`,
        'h 124 ± 3° · L < a da escura · C ≤ a do gramado + 0,005', Math.abs(COR.difMatiz(fo.h, 124)) <= 3 && fo.L < d.b.L && fo.C <= d.C + 0.005);
      const linha = COR.linearDeHex(0xf3f6f1); // a cor das linhas (campo.js, o MeshLambertMaterial das linhas)
      const ld = COR.oklab(COR.corNaTela(linha, { fator: D.brancoLinha })).L;
      const ln = COR.oklab(COR.corNaTela(linha, { hora: 'noite', fator: Nt.brancoLinha * COR.pocoNoite(0, 0) })).L;
      reg('E4 o pico das linhas com o uBrancoLinha (dia; noite no meio do poço de luz)', `dia ${fmt(ld, 4)} (× ${D.brancoLinha}) · noite ${fmt(ln, 4)} (× ${Nt.brancoLinha})`, '0,952 ± 0,01 e ≤ 0,97 nas duas',
        [ld, ln].every(L => Math.abs(L - 0.952) <= 0.01 && L <= 0.97));
      const vd = valoresGramado('dia'), vn = valoresGramado('noite');
      const chaves = Object.keys(vd);
      const okV = chaves.length === UNIFORMS_GRAMADO.length && UNIFORMS_GRAMADO.every(k => k in vd && k in vn)
        && vd.uBorda === BORDA_CORTE && Math.abs(BORDA_CORTE - 0.10) <= 1e-12
        && [vd, vn].every(v => v.uClara.length === 3 && v.uEscura.length === 3 && [v.uManchas, v.uRasante, v.uBrancoLinha, v.uGFoco].every(Number.isFinite))
        && vd.uManchas > 0 && vd.uManchas <= 0.2 && vd.uRasante > 0 && vn.uRasante > 0;
      vd.uClara[0] = -1;
      const copia = GRAMADO_HORAS.dia.clara[0] > 0;
      reg('E5 valoresGramado: um valor por uniform, a borda macia 0,10 m, cópias (mexer no devolvido não muda a tabela)',
        `${chaves.join(', ')}; uBorda ${vn.uBorda}; manchas ${vn.uManchas}; rasante dia ${valoresGramado('dia').uRasante} · noite ${vn.uRasante}; brancoLinha ${valoresGramado('dia').uBrancoLinha} · ${vn.uBrancoLinha}`,
        'os 7; 0,10; cópias', okV && copia);
    }
  }

  // ---------------------------------------------------------------- F) a profundidade relativa ao foco (C7)
  {
    const { PROFUNDIDADE, PROFUNDIDADE_GLSL, gProfundidade, gFocoDe, termoProfundidade } = GR;
    if (typeof PROFUNDIDADE_GLSL !== 'string' || typeof gFocoDe !== 'function' || typeof termoProfundidade !== 'function') {
      reg('F a profundidade relativa ao foco (PROFUNDIDADE_GLSL, gFocoDe, termoProfundidade)', 'sem a conta', 'o módulo com a conta', false);
    } else {
      // uma amostra determinística (LCG): câmeras de 0,1 a 120 m de altura, pontos no gramado e fora, cores, g e focos
      let semente = 12345;
      const sorte = () => { semente = (Math.imul(semente, 1103515245) + 12345) >>> 0; return semente / 4294967296; };
      const casos = [];
      for (let k = 0; k < 4000; k++) {
        casos.push({
          cam: [(sorte() - 0.5) * 300, 0.1 + sorte() ** 2 * 120, (sorte() - 0.5) * 300], xz: [(sorte() - 0.5) * 200, (sorte() - 0.5) * 140],
          cor: [sorte() * 0.4, sorte() * 0.5, sorte() * 0.2], gf: sorte(), ras: sorte() * 0.6,
        });
      }
      let gD = null, gF = null, erroP = null;
      try {
        gD = criarInterpretador(PROFUNDIDADE_GLSL, {});
        gF = criarInterpretador(PROFUNDIDADE_GLSL, { f32: true });
      } catch (e) { erroP = e.message; }
      if (erroP) reg('F1 o PROFUNDIDADE_GLSL no interpretador mínimo', erroP, 'avalia', false);
      else {
        let dgD = 0, dtD = 0, dgF = 0, dtF = 0;
        for (const c of casos) {
          const gJ = gProfundidade(c.cam[0], c.cam[1], c.cam[2], c.xz[0], c.xz[1]);
          dgD = Math.max(dgD, Math.abs(gD.chamar('gramadoG', c.cam, c.xz) - gJ));
          dgF = Math.max(dgF, Math.abs(gF.chamar('gramadoG', c.cam, c.xz) - gJ));
          const tJ = termoProfundidade(c.cor, gJ, c.gf, c.ras);
          const tD = gD.chamar('gramadoProfundidade', c.cor, gJ, c.gf, c.ras), tF = gF.chamar('gramadoProfundidade', c.cor, gJ, c.gf, c.ras);
          for (let i = 0; i < 3; i++) { dtD = Math.max(dtD, Math.abs(tD[i] - tJ[i])); dtF = Math.max(dtF, Math.abs(tF[i] - tJ[i])); }
        }
        reg('F1 PROFUNDIDADE_GLSL (double) = JS: gramadoG = gProfundidade e gramadoProfundidade = termoProfundidade', `${casos.length} casos: g até ${dgD.toExponential(1)} · cor até ${dtD.toExponential(1)}`, '≤ 1e−12', dgD <= 1e-12 && dtD <= 1e-12);
        reg('F2 PROFUNDIDADE_GLSL em float32 (o highp da GPU, emulado) = JS', `g até ${dgF.toExponential(1)} · cor até ${dtF.toExponential(1)}`, '≤ 2e−6', dgF <= 2e-6 && dtF <= 2e-6);
      }
      // sem derivada e só as constantes do PROFUNDIDADE (o desvio o interpretador já recusa: D7)
      const deriv = /\b(fwidth|dFdx|dFdy)\b/.test(PROFUNDIDADE_GLSL);
      const nums = [...new Set((PROFUNDIDADE_GLSL.match(/\b\d+\.\d*\b|\b\d+\b/g) ?? []).map(Number))].sort((a, b) => a - b);
      const perm = [0, 0.0001, 1, PROFUNDIDADE.limite, PROFUNDIDADE.saturacao, ...PROFUNDIDADE.luminancia];
      const estranhos = nums.filter(v => !perm.some(p => Math.abs(p - v) <= 1e-12));
      reg('F3 sem derivada; os números do GLSL = o PROFUNDIDADE (limite, saturação, luminância; 0 · 1 · 1e−4)', `derivada: ${deriv ? 'SIM' : 'nenhuma'}; ${nums.join(' · ')}`, 'nenhuma; nenhum outro número', !deriv && estranhos.length === 0);
      // o foco: o raio do meio da tela no chão; sem tocar (acima do horizonte, na horizontal, reto para cima), o horizonte: g = 1,
      // o limite de quando o raio toca cada vez mais longe (a revisão do C4–C8: o ponto a 50 m dava um salto no quadro em que o
      // raio cruzava o horizonte — 0,937 com a lente a 1,6 m — e olhando reto para cima, g 0)
      const EQ = await imp('render/enquadramento.js');
      const asp = 844 / 390, perf = EQ.perfilCamera({}, 0, asp, true), tv = EQ.poseTV(perf, 0, 0, asp, true, {});
      const ponto = [0, 0, 0];
      const gTV = gFocoDe(tv.de, [tv.para[0] - tv.de[0], tv.para[1] - tv.de[1], tv.para[2] - tv.de[2]], ponto);
      const okTV = Math.abs(tv.para[1]) <= 1e-9 && Math.hypot(ponto[0] - tv.para[0], ponto[2] - tv.para[2]) <= 1e-9 && Math.abs(gTV - gProfundidade(...tv.de, tv.para[0], tv.para[2])) <= 1e-12;
      const pc = [0, 0, 0], gCima = gFocoDe([10, 1.6, 5], [3, 0.4, 4], pc);
      const pl = [0, 0, 0], gHoriz = gFocoDe([0, 2, 0], [1, 0, 0], pl), gReto = gFocoDe([0, 2, 0], [0, 1, 0]);
      // a continuidade no horizonte: o raio descendo 1,1e−6 (toca a ~1,5 mil km) e 0,9e−6 (não toca), com a lente a 1,6, 3 e 6,6 m
      let saltoH = 0;
      for (const y of [1.6, 3, 6.6]) {
        const a = gFocoDe([0, y, 0], [Math.sqrt(1 - 1.1e-6 ** 2), -1.1e-6, 0]), b = gFocoDe([0, y, 0], [Math.sqrt(1 - 0.9e-6 ** 2), -0.9e-6, 0]);
        saltoH = Math.max(saltoH, Math.abs(a - b));
      }
      reg('F4 o foco (gFocoDe): o raio do meio da tela no chão (a TV do celular: o ponto olhado); sem descer, o horizonte (g = 1), contínuo nele',
        `TV do celular: g ${fmt(gTV, 4)} no (${fmt(ponto[0], 2)}, ${fmt(ponto[2], 2)}) · raio subindo: g ${fmt(gCima, 4)} · na horizontal: g ${fmt(gHoriz, 4)} · reto para cima: g ${fmt(gReto, 4)} · `
        + `o salto ao cruzar o horizonte ${saltoH.toExponential(1)} · sem tocar, o ponto ${Number.isNaN(pc[0]) && Number.isNaN(pl[2]) ? 'NaN (o horizonte)' : `(${fmt(pc[0], 2)}, ${fmt(pc[2], 2)})`}`,
        'o para da TV · 1 · 1 · 1 · ≤ 1e−5 · NaN', okTV && gCima === 1 && gHoriz === 1 && gReto === 1 && saltoH <= 1e-5 && Number.isNaN(pc[0]) && Number.isNaN(pl[2]));
      // no foco a identidade; a luminância só pelo 1 + p; o brilho em ±8%
      const W = PROFUNDIDADE.luminancia, lum = c => c[0] * W[0] + c[1] * W[1] + c[2] * W[2];
      let idErr = 0, lumErr = 0, pMax = 0;
      for (const c of casos) {
        const t0 = termoProfundidade(c.cor, c.gf, c.gf, c.ras);
        for (let i = 0; i < 3; i++) idErr = Math.max(idErr, Math.abs(t0[i] - c.cor[i]));
        const g = gProfundidade(c.cam[0], c.cam[1], c.cam[2], c.xz[0], c.xz[1]);
        const p = Math.max(-PROFUNDIDADE.limite, Math.min(PROFUNDIDADE.limite, c.ras * (g - c.gf)));
        const t = termoProfundidade(c.cor, g, c.gf, c.ras), l0 = lum(c.cor);
        if (l0 > 1e-6) { lumErr = Math.max(lumErr, Math.abs(lum(t) / l0 - (1 + p))); pMax = Math.max(pMax, Math.abs(lum(t) / l0 - 1)); }
      }
      reg('F5 no foco o termo é a identidade; fora dele a luminância × (1 + p) (a dessaturação a guarda), |p| ≤ 0,08', `identidade até ${idErr.toExponential(1)} · luminância até ${lumErr.toExponential(1)} · brilho até ±${fmt(pMax * 100, 2)}%`,
        '≤ 1e−15 · ≤ 1e−12 · ≤ 8%', idErr <= 1e-15 && lumErr <= 1e-12 && pMax <= PROFUNDIDADE.limite + 1e-12);
      // o modelo: a luz do dia e o ACES do r170 nas regiões da G4 do teste-graficos-celular (TV do celular; |x| ≤ 12, perto
      // z 8…18, longe z −32…−22), a média linear de cada região e das duas faixas, o termo com − sem
      const D = GRAMADO_HORAS.dia, ras = valoresGramado('dia').uRasante, gf = gTV;
      const regiao = (z0, z1, comTermo) => {
        const s = [0, 0, 0]; let n = 0;
        for (let x = -12; x <= 12; x += 0.5) for (let z = z0; z <= z1; z += 0.5) for (const alb of [D.clara, D.escura]) {
          const g = gProfundidade(...tv.de, x, z);
          const c = COR.corNaTela(comTermo ? termoProfundidade(alb, g, gf, ras) : alb);
          for (let i = 0; i < 3; i++) s[i] += c[i];
          n++;
        }
        return COR.oklab(s.map(v => v / n));
      };
      const dif = t => { const p = regiao(8, 18, t), l = regiao(-32, -22, t); return { dL: l.L - p.L, dC: l.C - p.C, dh: COR.difMatiz(l.h, p.h) }; };
      const com = dif(true), sem = dif(false), t = { dL: com.dL - sem.dL, dC: com.dC - sem.dC, dh: com.dh - sem.dh };
      reg('F6 o modelo (luz do dia, ACES do r170) na TV do celular: o termo longe − perto com − sem (as metas da G4)', `uRasante ${ras}: ΔL ${fmt(t.dL, 4)} · ΔC ${fmt(t.dC, 4)} · Δh ${fmt(t.dh, 2)}°`,
        'ΔL +0,026 ± 0,008; ΔC ≤ 0; |Δh| ≤ 2°', Math.abs(t.dL - 0.026) <= 0.008 && t.dC <= 0 && Math.abs(t.dh) <= 2);
      // o termo apagado pela altura da câmera (a revisão do C4–C8: nas câmeras baixas o raio do meio toca o chão muito além de
      // quem está no quadro, e o chão aos pés dele caía no teto de −8%): rasanteDaCamera = 0 até 3 m, inteiro de 8 m para cima,
      // smoothstep entre eles; e o MODELO (a luz do dia e o ACES do r170, a média das duas faixas) do chão aos pés do assunto, com
      // − sem o termo, nas câmeras baixas das cenas (as constantes dos módulos) — a G4b do teste-graficos-celular mede na GPU
      const { rasanteDaCamera } = GR;
      if (typeof rasanteDaCamera !== 'function' || !Array.isArray(PROFUNDIDADE.altura)) {
        reg('F7 o termo apagado pela altura da câmera (rasanteDaCamera)', 'sem a conta', 'o módulo com a conta', false);
      } else {
        const [a0, a1] = PROFUNDIDADE.altura;
        const { COMEMORACAO, CAMERA } = await imp('config.js');
        // a TV do celular (a do enquadramento, 13 m), a do PC (19 m) e o aéreo do pré-jogo (113 m): inteiro
        const hs = [0, 1.6, a0, (a0 + a1) / 2, a1, tv.de[1], CAMERA?.altura ?? 19.4, 113];
        const vs = hs.map(h => rasanteDaCamera(ras, h));
        let mono = true;
        for (let h = 0, ant = -1; h <= 20; h += 0.01) { const v = rasanteDaCamera(ras, h); if (v < ant - 1e-15) mono = false; ant = v; }
        const okF = vs[0] === 0 && vs[1] === 0 && vs[2] === 0 && Math.abs(vs[3] - ras / 2) <= 1e-12 && vs[4] === ras && vs[5] === ras && vs[6] === ras && vs[7] === ras && mono;
        let PLANOS = null, CC = null;
        try { PLANOS = (await imp('prejogo-roteiro.js')).PLANOS_PREJOGO; } catch (_) { PLANOS = null; }
        try { CC = (await imp('cenas-config.js')).CENA_CARTAO; } catch (_) { CC = null; }
        const alb = D.clara.map((v, i) => (v + D.escura[i]) / 2), Lsem = COR.oklab(COR.corNaTela(alb)).L;
        const casosB = [];
        const caso = (nome, de, para, pe) => {
          const d = para.map((v, i) => v - de[i]), gF = gFocoDe(de, d), g = gProfundidade(...de, pe[0], pe[1]);
          const r = rasanteDaCamera(ras, de[1]);
          casosB.push({ nome, alt: de[1], dL: COR.oklab(COR.corNaTela(termoProfundidade(alb, g, gF, r))).L - Lsem });
        };
        const C = COMEMORACAO?.camera;
        if (C) {
          // o autor em (0, 0), andando em +x
          caso('steadicam', [C.steadicam.frente, C.steadicam.altura, C.steadicam.lado], [0.3, 1.5, 0], [0, 0]);
          caso('contraplano', [-C.contraplano.atras, C.contraplano.altura, C.contraplano.lado], [C.contraplano.alem, C.contraplano.olharY, 0], [0, 0]);
          caso('reação', [C.reacao.dist, C.reacao.altura, 0], [0, C.reacao.olharY, 0], [0, 0]);
        }
        // a câmera do gol (render/replay: recuo 6,5, lateral 13, altura 2,6, olhando 1 m além da linha a 1,55 m)
        caso('câmera do gol', [52.5 - 6.5, 2.6, 13], [52.5 + 1, 1.55, 0], [52.5 + 1, 0]);
        for (const id of ['tunel', 'entrada', 'filaMandante', 'filaVisitante']) {
          const P = PLANOS?.[id]; if (!P?.cam?.de) continue;
          for (const k of [0, P.cam.de.length - 1]) caso(`${id}[${k}]`, P.cam.de[k], P.cam.para[k], [P.cam.para[k][0], P.cam.para[k][2]]);
        }
        const CCc = CC?.camera;
        if (CCc?.frente) caso('cartão de frente', [CCc.frente.dist, CCc.frente.altura, 0], [0, CCc.frente.olharY, 0], [0, 0]);
        if (CCc?.arbitro) caso('cartão no árbitro', [CCc.arbitro.dist, CCc.arbitro.altura, 0], [0, CCc.arbitro.olharY, 0], [0, 0]);
        const piorB = casosB.reduce((m, c) => (Math.abs(c.dL) > Math.abs(m.dL) ? c : m), { dL: 0, nome: '—' });
        reg('F7 o termo apagado pela altura da câmera (0 até 3 m, inteiro de 8 m para cima); o modelo aos pés do assunto nas câmeras baixas das cenas (a G4b)',
          `rasante ${hs.map((h, k) => `${fmt(h, 1)} m ${fmt(vs[k], 3)}`).join(' · ')}${mono ? '' : ' · NÃO monótono'} · ${casosB.length} câmeras baixas: pior ${piorB.nome} ${fmt(piorB.dL, 4)}`,
          `0 · 0 · 0 · ${fmt(ras / 2, 3)} · ${fmt(ras, 2)} … ; câmeras: |com − sem| ≤ 0,005 (≥ 10 câmeras)`, okF && casosB.length >= 10 && Math.abs(piorB.dL) <= 0.005);
      }
    }
  }
}

// ------------------------------------------------------------------ G) o shader MONTADO (render/gramado-shader.js; a revisão do C4–C8)
// O D2 só lê as linhas do glslTopoGramado; o bloco que o campo injeta no shader do three é conferido aqui, sobre um molde fixo
// com os #include que as trocas procuram (o texto do three r170 não chega ao CI): G1 as derivadas — explícitas (fwidth, dFdx,
// dFdy) e implícitas (a leitura de textura com mip: texture2D/texture sem Lod/Grad) — antes do 1º desvio (if, ?:, discard,
// for, while, return) de cada bloco do main(), e nenhuma nas funções do #include <common> (a lição do PR #631: o SwiftShader
// do CI não acusa derivada em desvio — a mutação com o fwidth dentro de um if passava no teste); G2 o `?gfx=antigo` (o gramado,
// o chão de fora e as linhas) com o texto e a chave da main, pelo hash gravado da main e41aa791 (o sha256 do JSON {v, f,
// chave}: o LUZ_NOITE_GLSL, o comDetalhe e o onBeforeCompile das linhas do campo.js da main extraídos do texto e rodados sobre
// o MESMO molde, uma vez, na revisão do C4–C8); G3 as chaves do cache distintas; G4 a troca que não acha o trecho AVISA.
{
  let SH = null, erroSH = null;
  try { SH = await imp('render/gramado-shader.js'); } catch (e) { erroSH = e; }
  if (!SH || typeof SH.shaderGramado !== 'function') {
    reg('G o shader montado (render/gramado-shader.js)', `sem o módulo (${String(erroSH?.message ?? erroSH).slice(0, 80)})`, 'o módulo', false);
  } else {
    const crypto = await import('node:crypto');
    const MOLDE_VERTEX = '#include <common>\nvoid main() {\n#include <begin_vertex>\n#include <project_vertex>\n}\n';
    const MOLDE_FRAGMENT = '#include <common>\nvoid main() {\n#include <map_fragment>\n#include <alphatest_fragment>\n}\n';
    const avisos = [];
    const montar = S => ({ v: SH.aplicarTrocas(MOLDE_VERTEX, S.vertex, 'teste', m => avisos.push(m)), f: SH.aplicarTrocas(MOLDE_FRAGMENT, S.fragment, 'teste', m => avisos.push(m)), chave: S.chave });
    const hash = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex');
    const novos = {
      gramado: SH.shaderGramado(0.85, { faixas: true, profundidade: true }),
      'chão de fora': SH.shaderGramado(0.6, { profundidade: true }),
      linhas: SH.shaderLinhas({ branco: true }),
    };
    const antigos = { 'gramado 0.85': SH.shaderGramadoAntigo(0.85), 'gramado 0.6': SH.shaderGramadoAntigo(0.6), linhas: SH.shaderLinhas({ branco: false }) };
    // G1: por bloco inserido no main() (os `para` das trocas fora do #include <common>), a posição da última derivada/leitura e
    // a do 1º desvio; no #include <common> (funções), nenhuma
    const RE_DERIV = /\b(fwidth|dFdx|dFdy)\s*\(|\btexture2D\s*\(|\btexture\s*\(/g;
    const RE_DESVIO = /\bif\s*\(|\?|\bdiscard\b|\bfor\s*\(|\bwhile\s*\(|\breturn\b/;
    const semComent = t => t.replace(/\/\/[^\n]*/g, '');
    const g1 = [];
    let okG1 = true;
    for (const [nome, S] of Object.entries(novos)) {
      for (const [de, para] of S.fragment) {
        const t = semComent(para).replace(/#include <[^>]+>/g, '');
        const derivs = [...t.matchAll(RE_DERIV)].map(m => m.index);
        if (de === '#include <common>') {
          if (derivs.length) okG1 = false;
          g1.push(`${nome} (funções): ${derivs.length ? `${derivs.length} DERIVADA(S)` : '0 derivadas'}`);
          continue;
        }
        const desvio = t.search(RE_DESVIO);
        const depois = desvio >= 0 ? derivs.filter(i => i > desvio).length : 0;
        if (depois) okG1 = false;
        g1.push(`${nome} (${de.replace('#include ', '')}): ${derivs.length} derivada(s)/leitura(s), ${desvio >= 0 ? `${depois} depois do 1º desvio` : 'sem desvio'}`);
      }
    }
    // o bloco do gramado tem a pegada uma vez só (a revisão do C4–C8: o fwidth(vMundoXZ.x) saía duas vezes)
    const fwGramado = (semComent(novos.gramado.fragment.find(([de]) => de === '#include <map_fragment>')[1]).match(/\bfwidth\s*\(/g) ?? []).length;
    reg('G1 o shader montado: as derivadas (fwidth/dFdx/dFdy e a leitura de textura com mip) antes do 1º desvio de cada bloco; nenhuma nas funções; a pegada do gramado uma vez',
      `${g1.join(' · ')} · fwidth no bloco do gramado: ${fwGramado}`, 'nenhuma depois de desvio; 0 nas funções; 1 fwidth', okG1 && fwGramado === 1);
    // G2: o ?gfx=antigo = a main
    const HASH_MAIN = {
      'gramado 0.85': '7367c5599508e2361f555e81928e41ec5979ecabe886db49c2a376fcaf5f968a',
      'gramado 0.6': '63975db940bb45c3f057b05dfdf7214a5a60e3ba255326edbf1e40dd282762c0',
      linhas: 'fd0cfb0fd426c2f79766cae5e7c5c6050abf315ef8e1cf0efeaafb3c5cd9fdec',
    };
    const g2 = Object.entries(antigos).map(([nome, S]) => ({ nome, ok: hash(montar(S)) === HASH_MAIN[nome], chave: S.chave }));
    reg('G2 o ?gfx=antigo = a main: o texto do shader (vertex e fragment no molde) e a chave do gramado, do chão de fora e das linhas, pelo hash da main e41aa791',
      g2.map(x => `${x.nome} (${x.chave}) ${x.ok ? 'igual' : 'DIFERENTE'}`).join(' · '), 'os 3 iguais', g2.every(x => x.ok));
    // G3: as chaves do cache distintas (o three reusaria o programa de outro material com a mesma chave)
    const chaves = [...Object.values(novos), ...Object.values(antigos)].map(S => S.chave);
    reg('G3 as chaves do cache distintas (o gramado, o chão de fora e as linhas, novos e antigos)', chaves.join(' · '), `${chaves.length} distintas`, new Set(chaves).size === chaves.length);
    // G4: nada achado = aviso (nunca um replace calado); com o molde, nenhum aviso
    const semAviso = avisos.length;
    const av = [];
    SH.aplicarTrocas('void main() {}', novos.gramado.fragment, 'teste', m => av.push(m));
    reg('G4 a troca que não acha o trecho AVISA; no molde com os #include, nenhum aviso', `sem o trecho: ${av.length} aviso(s) de ${novos.gramado.fragment.length} trocas · no molde: ${semAviso}`, `${novos.gramado.fragment.length} · 0`, av.length === novos.gramado.fragment.length && semAviso === 0);
  }
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-gramado: REPROVOU (${falhas})` : '\nteste-gramado: PASSOU');
process.exit(falhas ? 1 : 0);
