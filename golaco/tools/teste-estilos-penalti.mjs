// teste-estilos-penalti (item 70, P2; pedido do dono de 29/10, aval de 31/10): os jeitos de bater o pênalti — normal, forte
// (CORRER segurado no soltar), colocado (MOD), paradinha, pulinho e a cavadinha de sempre —, a leitura do goleiro por quem
// depende dele (van der Kamp 2006; Noël, van der Kamp & Klatt 2021) e o goleiro NA LINHA até o chute também na partida
// (Regra 14). Contrato "Estilos de pênalti (item 70, P2)" no CONTRATOS.md; constantes em config.js ESTILO_PENALTI; lógica
// em js/corrida.js (os estilos, a leitura), partida.js (a montagem, os botões da pessoa, a leitura da IA no contato),
// goleiro.js (a linha, o passo do que sai cedo, a vantagem do que sai cedo para o lado certo) e disputa.js. Pesquisa em
// PESQUISA-ETAPA4.md §17.
//
// Cenas: cobranças de pênalti forçadas em 8 estados da partida (sementes 5000–5007, 200 passos da demo) com o gerador
// ressemeado por cobrança; o cobrador é um dos 3 de maior finalização do time (quem bate pênalti), o time alterna. A IA
// com o estilo FORÇADO (ESTILO_PENALTI.ia: o estilo pedido sempre) contra o goleiro da IA. Metas:
//  A. A assinatura de cada estilo:
//     A1 forte × normal (os mesmos cobradores e estados): a corrida mais rápida (média do 1º passo ao contato) e a bola
//        mais rápida no contato (≥ +1,5 m/s);
//     A2 colocado × normal: a corrida mais lenta, a bola mais lenta (≥ 1,5 m/s a menos) e o voo do chute colocado;
//     A3 paradinha: depois de a corrida passar de 2 m/s, a velocidade cai ABAIXO de 1 m/s antes do último apoio (o pouso do
//        pé de apoio ao lado da bola) em todas, fica abaixo de 1 m/s ≥ 0,2 s e retoma (≥ 2 m/s no contato);
//     A4 pulinho: no penúltimo apoio (o último pé a sair do chão antes do pé de apoio é o que bate) os dois pés no ar por
//        ≥ ESTILO_PENALTI.pulinho.voo s até o pé de apoio pousar ao lado da bola em todas (o normal: < isso em ≥ 90%), e o
//        salto desenhado (anim.js alturaPulinho) ≥ 8 cm;
//     A5 (a pessoa) cada comando chega ao estilo e à assinatura dele (parte F).
//  B. Nenhuma finta depois da corrida: em ≥ 1000 cobranças (as da IA de todos os estilos e as da pessoa que aperta a
//     PARADINHA em hora sorteada, inclusive depois de não caber mais), depois do último apoio a velocidade do cobrador nunca
//     fica abaixo de 1 m/s até o contato (a Regra 14 nunca precisa ser aplicada: a paradinha é sempre antes do último apoio).
//  C. A leitura: contra o goleiro da IA que se compromete cedo (ESTILO_PENALTI.goleiro: forçado a sair cedo), o cobrador
//     da paradinha e o do pulinho batem no canto OPOSTO ao do goleiro em ≥ 60% (binomial: reprova se a contagem prova
//     menos); o goleiro da PESSOA que segura o analógico para um lado desde antes do pé de apoio do cobrador também é lido
//     (≥ 60%), e o que só escolhe o lado depois do pé de apoio não é (nada para ler); o goleiro da IA que sai cedo dá o passo
//     para o lado escolhido NA linha antes do chute.
//  D. A conversão por estilo (IA × IA, a saída cedo do goleiro como no jogo): o normal ~77% (reprova se a contagem PROVA
//     fora de 72–82%, binomial unilateral p < 5%); a paradinha e o pulinho a ± 10 pontos do normal (reprova se a diferença
//     prova fora de ±10, z unilateral p < 5%). Informativo: forte e colocado, e o padrão de Noël et al. 2021 (contra o
//     goleiro que sai cedo, quem depende do goleiro converte mais que o normal; contra o que espera, menos).
//  E. Regra 14: o goleiro que defende fica NA linha até o chute — o centro dele a ≤ 0,15 m da linha do gol do apito ao
//     contato, em todas as cobranças da partida (antes ia a 0,6 m) e da disputa de pênaltis.
//  F. Os comandos da pessoa: as teclas (F paradinha, barra de espaço pulinho, Shift forte, E colocado), o controle na
//     cobrança do pênalti (LT paradinha, RB colocado, LB pulinho; RT forte), os botões de toque PARADINHA e PULINHO; na
//     partida cada um chega ao estilo (CHUTE → normal, + CORRER no soltar → forte, + MOD → colocado, PARADINHA antes ou na
//     corrida → paradinha, PULINHO antes ou na corrida → pulinho, CHUTE duas vezes → cavadinha; PARADINHA depois de não
//     caber → nada muda); na disputa a PARADINHA e o PULINHO passam (entradaDaVez).
//  G. Online: os bits da PARADINHA e do PULINHO viajam na entrada (online.js codificar/decodificar); dois humanos com os
//     estilos: o mesmo hash nos dois aparelhos.
//  H. A IA: um estilo por jogador (estiloPreferido, puro, pelo id: os 5 aparecem nos 46 do elenco), a mesma semente = os
//     mesmos estilos, e o preferido usado com a chance ESTILO_PENALTI.ia.fiel (binomial), o resto normal.
//
//   node tools/teste-estilos-penalti.mjs                (a lógica do repositório)
//   node tools/teste-estilos-penalti.mjs --js <pasta>   (outra cópia: a base d971fe54 → REPROVA)
//   [--par 3] processos · [--n 400] cobranças por estilo (normal, paradinha, pulinho; forte e colocado: 0,4 × n) ·
//   [--set A.b=json] muda uma constante do config.js (mutações) · [--so A,C,F] só essas partes (A–E usam as cobranças da IA)
import { fork } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { provaFora } from './lib/binomial.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const C = await imp('config.js');
// (mutações: --set ESTILO_PENALTI.leitura.erroTarde=3 — valem também nos processos filhos, que recebem os mesmos argumentos)
for (const kv of args.filter((a, i) => args[i - 1] === '--set')) {
  const k = kv.slice(0, kv.indexOf('=')), v = JSON.parse(kv.slice(kv.indexOf('=') + 1));
  const ks = k.split('.'); let o = C; for (const q of ks.slice(0, -1)) o = o[q]; o[ks.at(-1)] = v;
}
const P = await imp('partida.js');
const S = await imp('sim.js');
const R = await imp('rng.js');
const AN = await imp('anim.js');
const EP = C.ESTILO_PENALTI ?? null;
const temEstilos = !!EP && fs.existsSync(path.join(JS, 'corrida.js'));
const CO = fs.existsSync(path.join(JS, 'corrida.js')) ? await imp('corrida.js') : null;
const { PASSO, BOTAO, CAMPO } = C;
const MX = CAMPO.meioX;
const NADA = { x: 0, z: 0, botoes: 0 };
const N = +arg('--n', 400);
// (--so A,C,F: só essas partes — as mutações; A–E usam as cobranças da IA)
const SO = arg('--so', null);
const faz = k => !SO || SO.split(',').includes(k);
const fazIA = ['A', 'B', 'C', 'D', 'E'].some(faz);
// (o ESTILO_PENALTI de fábrica — com os --set —, para voltar depois das partes que forçam o estilo)
const EP0 = EP ? { fiel: EP.ia.fiel, pesos: EP.ia.pesos, cedo: EP.goleiro.cedo.slice() } : null;
const voltarEP = () => { if (EP) { EP.ia.fiel = EP0.fiel; EP.ia.pesos = EP0.pesos; EP.goleiro.cedo = EP0.cedo.slice(); } };
const jog = (m, id) => m.jogadores.find(o => o.id === id);

// ------------------------------------------------------------------------------------------------- as cenas
const BASES = new Map();
/** Um dos 8 estados da partida (200 passos da demo; cópia) com o gerador ressemeado `k`. */
function estado(k) {
  const s = 5000 + (k % 8);
  if (!BASES.has(s)) {
    const m = P.criarPartida({ semente: s });
    for (let i = 0; i < 200; i++) P.passoPartida(m, P.entradaDemoPartida(m));
    BASES.set(s, m);
  }
  const m = S.copiarMundo(BASES.get(s));
  m.rng = R.criarRng(77000 + k);
  return m;
}
/**
 * O pênalti k: o time k % 2 bate; o cobrador é o (⌊k/2⌋ % 3)-ésimo de maior finalização do time (a escolha da partida —
 * partida.js montarPenalti, o de maior finalização — empurrada para ele até a montagem). humanos: os times da pessoa.
 */
function penalti(k, humanos = []) {
  const m = estado(k);
  m.humanos = humanos.slice();
  if (humanos.length) m.timeHumano = humanos[0];
  const t = k % 2, la = m.ataca[t];
  m.posse = null; m.naMao = null; m.voo = null;
  for (const j of m.jogadores) { j.pedido = null; j.carga = null; }
  const l = m.jogadores.filter(o => o.time === t && o.posicao !== 'GOL').sort((a, b) => b.par.attr.finalizacao - a.par.attr.finalizacao || a.id - b.id);
  const c = l[Math.floor(k / 2) % 3];
  const fin = l.map(o => o.par.attr.finalizacao);
  c.par.attr.finalizacao = 1000;
  const volta = () => l.forEach((o, i) => { o.par.attr.finalizacao = fin[i]; });
  P.bolaMorta(m, 'penalti', t, la * (MX - CAMPO.marcaPenalti), 0);
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  Object.assign(m.bola.p, { x: la * (MX - CAMPO.marcaPenalti), y: 0.11, z: 0 }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
  return { m, t, c: c.id, volta };
}

const TORN = [AN.J.tornozeloE, AN.J.tornozeloD];
/**
 * Roda a cobrança até o resultado (ou 15 s). ent(m, pr, i) = a entrada do time da pessoa (null: nenhuma). Devolve o
 * registro: o estilo, o resultado, a corrida (velocidades, a pausa, o voo do penúltimo apoio, o salto desenhado), a bola no
 * contato, o goleiro (a distância da linha do apito ao contato, comprometido, a leitura) e o canto da bola.
 */
function rodar(q, ent = null) {
  const { m, t } = q;
  const r = { t, id: null, estilo: null, res: null, vMedia: NaN, vContato: NaN, vMax: 0, vMinAntes: Infinity, abaixo: 0, abaixoDepois: false,
    vDepoisMin: Infinity, voo: 0, vooPenult: 0, peUltimo: null, salto: 0, bolaV: NaN, vooTipo: null, gkLinha: 0, gkZ: NaN, comp: false,
    gkLado: 0, leu: null, zBola: NaN, plantou: false, pausaAntesDoApoio: true, quadrilMin: Infinity, tCorrida: NaN };
  let pr = null, t0 = -1, andou = 0, px = 0, pz = 0, ar = 0, ultimaSaida = null, passou2 = false, volta = q.volta;
  const apoioAnt = [true, true];
  for (let i = 0; i < 60 * 15; i++) {
    const p0 = m.parada;
    if (p0 && !p0.rolou && p0.tipo === 'penalti') pr = p0;
    if (volta && pr && pr.corrida) { volta(); volta = null; }
    const cr = pr && pr.corrida;
    const correndo = !!(cr && cr.estado === 'corre' && !pr.rolou);
    const c = pr ? jog(m, pr.cobrador) : null;
    if (correndo && t0 < 0) { t0 = m.tick; px = c.x; pz = c.z; r.id = c.id; apoioAnt[0] = c.pes[0].apoio; apoioAnt[1] = c.pes[1].apoio; }
    const e = ent ? ent(m, pr, i) : null;
    const entrada = e && m.humanos.length > 1 ? e : e ?? NADA;
    const ev = P.passoPartida(m, entrada);
    const gk = pr ? m.jogadores.find(o => o.time !== pr.time && o.posicao === 'GOL') : null;
    // o goleiro na linha do apito (bola pronta) ao contato (Regra 14)
    // (do apito — a bola pronta da cobrança montada — ao contato)
    if (pr && gk && pr.corrida && m.tick >= pr.pronta && r.vooTipo == null) r.gkLinha = Math.max(r.gkLinha, Math.abs(MX - Math.abs(gk.x)));
    if (pr && t0 >= 0 && r.vooTipo == null) {
      const s = Math.hypot(c.vx, c.vz);
      andou += Math.hypot(c.x - px, c.z - pz); px = c.x; pz = c.z;
      r.vMax = Math.max(r.vMax, s);
      r.quadrilMin = Math.min(r.quadrilMin, c.quadril ?? Infinity);
      if (s >= 2) passou2 = true;
      const plantado = cr.plantou >= 0;
      if (!plantado && passou2) {
        r.vMinAntes = Math.min(r.vMinAntes, s);
        if (s < 1) r.abaixo += PASSO;
      }
      if (plantado) { r.plantou = true; r.vDepoisMin = Math.min(r.vDepoisMin, s); if (s < 1) r.abaixoDepois = true; }
      // o voo antes do último apoio: os dois pés no ar (o mais longo) e o pé que saiu por último
      const a0 = c.pes[0].apoio, a1 = c.pes[1].apoio;
      if (!plantado) {
        if (!a0 && !a1) { ar += PASSO; r.voo = Math.max(r.voo, ar); } else ar = 0;
        for (let p = 0; p < 2; p++) if (apoioAnt[p] && !c.pes[p].apoio) ultimaSaida = p;
      }
      if (!plantado && AN.alturaPulinho) r.salto = Math.max(r.salto, AN.alturaPulinho(c, m));
      apoioAnt[0] = a0; apoioAnt[1] = a1;
      if (pr.rolou) {
        // o contato neste passo
        r.vContato = s; r.tCorrida = (m.tick - t0) * PASSO; r.vMedia = andou / Math.max(r.tCorrida, PASSO);
        r.estilo = cr.estilo ?? 'normal';
        r.vooPenult = ar; r.peUltimo = ultimaSaida === cr.pe ? 'bate' : ultimaSaida === cr.ps ? 'apoio' : null;
        r.bolaV = Math.hypot(m.bola.v.x, m.bola.v.y, m.bola.v.z);
        r.vooTipo = m.voo ? m.voo.tipo : 'nenhum';
        r.comp = !!(cr.gk && cr.gk.desde >= 0); r.gkLado = cr.gk ? cr.gk.lado : 0;
        r.leu = cr.leu ? { ...cr.leu } : null;
        r.lido = cr.gkLido ? cr.gkLido.lado : 0;
        r.gkZ = gk ? gk.z : NaN;
        const b = m.bola, G = m.ataca[pr.time] * MX;
        r.zBola = Math.abs(b.v.x) > 1 ? b.p.z + b.v.z * (G - b.p.x) / b.v.x : b.p.z;
      }
    }
    for (const e2 of ev) if (e2.tipo === 'penalti') r.res = e2.resultado;
    if (r.res) break;
  }
  if (r.estilo == null && pr && pr.corrida) r.estilo = pr.corrida.estilo ?? 'normal';
  return r;
}

// ------------------------------------------------------------------------------------------------- os processos filhos
/** Os trabalhos: [tipo, estilo, k] — 'ia' (o estilo forçado; a saída cedo do goleiro como no jogo) e 'cedo' (o goleiro sai cedo). */
function trabalhos() {
  const l = [];
  // (a lógica sem os estilos — a base, --js —: só as cobranças de sempre, para o "antes" do goleiro na linha e da conversão)
  if (!temEstilos) { for (let k = 0; k < N; k++) l.push(['ia', 'normal', k]); return l; }
  const nF = Math.round(0.4 * N), nC = Math.round(0.3 * N);
  for (const [e, n] of [['normal', N], ['paradinha', N], ['pulinho', N], ['forte', nF], ['colocado', nF]]) for (let k = 0; k < n; k++) l.push(['ia', e, k]);
  for (const e of ['paradinha', 'pulinho']) for (let k = 0; k < nC; k++) l.push(['cedo', e, 1000 + k]);
  return l;
}
function forcarEstilo(e, cedo) {
  if (!EP) return;
  EP.ia.fiel = 1; EP.ia.pesos = [[e, 1]];
  if (cedo) EP.goleiro.cedo = [1.01, 1.01];
}
if (args.includes('--filho')) {
  const de = +arg('--de'), ate = +arg('--ate');
  const out = [];
  const l = trabalhos();
  for (let i = de; i < ate && i < l.length; i++) {
    const [tipo, e, k] = l[i];
    voltarEP();
    forcarEstilo(e, tipo === 'cedo');
    const r = rodar(penalti(k));
    r.tipo = tipo; r.pedido = e; r.k = k;
    out.push(r);
  }
  await new Promise(ok => process.send(out, ok));
  process.exit(0);
}

const linhas = [['item', 'medido', 'meta', '']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
const f1 = v => (Number.isFinite(v) ? v.toFixed(1).replace('.', ',') : String(v));
const f2 = v => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : String(v));
const pc = (a, n) => `${f1(100 * a / Math.max(1, n))}%`;
const media = l => (l.length ? l.reduce((x, y) => x + y, 0) / l.length : NaN);
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-estilos-penalti: REPROVOU (${falhas})` : '\nteste-estilos-penalti: PASSOU');
  process.exit(falhas ? 1 : 0);
}

if (!temEstilos) {
  reg('os estilos do pênalti (config.js ESTILO_PENALTI, corrida.js)', 'não existem nesta lógica', 'existem', false);
}

// ------------------------------------------------------------------------------------------------- A–D: as cobranças da IA
let regs = [];
if (fazIA) {
  const l = trabalhos();
  const nPar = Math.max(1, Math.min(+arg('--par', 3), os.availableParallelism?.() ?? os.cpus().length));
  const fatia = Math.ceil(l.length / nPar);
  const partes = await Promise.all(Array.from({ length: nPar }, (_, i) => new Promise((ok, erro) => {
    const ch = fork(fileURLToPath(import.meta.url), [...args, '--filho', '--de', String(i * fatia), '--ate', String((i + 1) * fatia)]);
    let r = null;
    ch.on('message', x => { r = x; });
    ch.on('exit', cod => (cod === 0 && r ? ok(r) : erro(new Error(`filho ${i} saiu com ${cod}`))));
  })));
  regs = partes.flat();
}
const de = (tipo, e) => regs.filter(r => r.tipo === tipo && r.pedido === e && r.res);
if (!temEstilos && fazIA) {
  // o "antes": a conversão das cobranças de sempre e o goleiro na linha (E1) na mesma cena
  const l = de('ia', 'normal'), linha = l.map(r => r.gkLinha), g = l.filter(r => r.res === 'gol').length;
  reg('D1 (sem os estilos) a cobrança da IA × IA: gol / defesa / fora', `${pc(g, l.length)} / ${pc(l.filter(r => r.res === 'defesa').length, l.length)} / ${pc(l.filter(r => r.res === 'fora').length, l.length)} (${l.length})`, 'informativo', true);
  reg('E1 Regra 14 (partida): o goleiro na linha do apito ao chute — o centro dele a … da linha do gol (pior)', `${f2(Math.max(...linha))} m (${linha.length} cobranças; média ${f2(media(linha))})`,
    '≤ 0,15 m', linha.length > 0 && Math.max(...linha) <= 0.15);
}
if (temEstilos && fazIA) {
  const nor = de('ia', 'normal'), fo = de('ia', 'forte'), co = de('ia', 'colocado'), pa = de('ia', 'paradinha'), pu = de('ia', 'pulinho');
  const certo = (l, e) => l.filter(r => r.estilo === e).length;
  reg('A0 o estilo da IA na cobrança é o pedido (normal · forte · colocado · paradinha · pulinho)',
    `${certo(nor, 'normal')}/${nor.length} · ${certo(fo, 'forte')}/${fo.length} · ${certo(co, 'colocado')}/${co.length} · ${certo(pa, 'paradinha')}/${pa.length} · ${certo(pu, 'pulinho')}/${pu.length}`,
    'todos', [nor, fo, co, pa, pu].every((l, i) => l.length > 0 && certo(l, ['normal', 'forte', 'colocado', 'paradinha', 'pulinho'][i]) === l.length));
  // A1/A2: pareado pelo k (o mesmo estado, o mesmo cobrador)
  const par = (a, b, campo) => {
    const mb = new Map(b.map(r => [`${r.t}/${r.id}/${r.k}`, r]));
    const d = [];
    for (const r of a) { const s = mb.get(`${r.t}/${r.id}/${r.k}`); if (s && Number.isFinite(r[campo]) && Number.isFinite(s[campo])) d.push(r[campo] - s[campo]); }
    return d;
  };
  const dvF = par(fo, nor, 'vMedia'), dbF = par(fo, nor, 'bolaV'), dvC = par(co, nor, 'vMedia'), dbC = par(co, nor, 'bolaV');
  reg('A1 forte × normal (pareado): a corrida (velocidade média) · a bola no contato',
    `${dvF.length ? '+' : ''}${f2(media(dvF))} m/s · ${f2(media(dbF))} m/s (${dbF.length} pares; normal ${f2(media(nor.map(r => r.vMedia)))} m/s, bola ${f2(media(nor.map(r => r.bolaV)))} m/s)`,
    '> 0 · ≥ +1,5 m/s', dvF.length >= 20 && media(dvF) > 0 && media(dbF) >= 1.5);
  const vooCol = co.filter(r => r.vooTipo === 'colocado').length;
  reg('A2 colocado × normal (pareado): a corrida · a bola no contato · o voo do chute colocado',
    `${f2(media(dvC))} m/s · ${f2(media(dbC))} m/s (${dbC.length} pares) · ${vooCol}/${co.length}`,
    '< 0 · ≤ −1,5 m/s · todos', dvC.length >= 20 && media(dvC) < 0 && media(dbC) <= -1.5 && vooCol === co.length);
  const pausaOk = pa.filter(r => r.vMinAntes < 1 && r.abaixo >= 0.2 - 1e-9 && r.vContato >= 2).length;
  reg('A3 paradinha: abaixo de 1 m/s ANTES do último apoio por ≥ 0,2 s e retoma (≥ 2 m/s no contato)',
    `${pausaOk}/${pa.length} (a menor antes do apoio ${f2(Math.max(...pa.map(r => r.vMinAntes)))} m/s no pior; abaixo de 1 m/s ${f2(Math.min(...pa.map(r => r.abaixo)))}–${f2(Math.max(...pa.map(r => r.abaixo)))} s; no contato ${f2(Math.min(...pa.map(r => r.vContato)))}–${f2(Math.max(...pa.map(r => r.vContato)))} m/s)`,
    'todas', pa.length > 0 && pausaOk === pa.length);
  const vooP = EP.pulinho.voo, puOk = pu.filter(r => r.vooPenult >= vooP - 1e-9 && r.peUltimo === 'bate' && r.salto >= 0.08).length;
  const norCurto = nor.filter(r => r.vooPenult < vooP - 1e-9).length;
  reg(`A4 pulinho: no penúltimo apoio (o pé que bate sai por último) os dois pés no ar ≥ ${f2(vooP)} s até o pé de apoio pousar e o salto desenhado ≥ 8 cm · o normal com o voo menor`,
    `${puOk}/${pu.length} (voo ${f2(Math.min(...pu.map(r => r.vooPenult)))}–${f2(Math.max(...pu.map(r => r.vooPenult)))} s; salto ${f2(100 * Math.min(...pu.map(r => r.salto)))}–${f2(100 * Math.max(...pu.map(r => r.salto)))} cm) · normal ${pc(norCurto, nor.length)} (voo ${f2(media(nor.map(r => r.vooPenult)))} s)`,
    'todos · ≥ 90%', pu.length > 0 && puOk === pu.length && norCurto >= 0.9 * nor.length);
  // B: a finta depois da corrida (as da IA aqui; as da pessoa somam na parte F)
  const todas = regs.filter(r => r.res);
  globalThis.__finta = { n: todas.length, fintas: todas.filter(r => r.abaixoDepois).length, sem: todas.filter(r => !r.plantou).length,
    pior: Math.min(...todas.filter(r => r.plantou).map(r => r.vDepoisMin)) };
  // C: a leitura do goleiro que sai cedo
  for (const e of ['paradinha', 'pulinho']) {
    const l = de('cedo', e).filter(r => r.leu && r.leu.lado);
    const op = l.filter(r => Math.sign(r.zBola) === -r.leu.lado && Math.abs(r.zBola) > 0.5).length;
    reg(`C1 ${e}: contra o goleiro da IA que se comprometeu cedo, a bola no canto OPOSTO ao dele`, `${pc(op, l.length)} (${op}/${l.length}; r médio ${f2(media(l.map(r => r.leu.r)))})`,
      '≥ 60% (binomial)', l.length >= 30 && !provaFora(op, l.length, 0.6, null) && op / l.length >= 0.6);
  }
  {
    const l = [...de('cedo', 'paradinha'), ...de('cedo', 'pulinho')].filter(r => r.comp);
    const passo = l.filter(r => Math.sign(r.gkZ) === r.gkLado && Math.abs(r.gkZ) >= 0.15).length;
    reg('C3 o goleiro da IA que sai cedo dá o passo para o lado escolhido antes do chute (|z| ≥ 0,15 m) e fica na linha (E)',
      `${passo}/${l.length} (z no chute ${f2(Math.min(...l.map(r => Math.abs(r.gkZ))))}–${f2(Math.max(...l.map(r => Math.abs(r.gkZ))))} m)`, '≥ 90%', l.length >= 30 && passo >= 0.9 * l.length);
  }
  // D: a conversão por estilo
  const gols = l => l.filter(r => r.res === 'gol').length;
  const gN = gols(nor), nN = nor.length;
  reg('D1 normal (IA × IA): gol / defesa / fora', `${pc(gN, nN)} / ${pc(nor.filter(r => r.res === 'defesa').length, nN)} / ${pc(nor.filter(r => r.res === 'fora').length, nN)} (${nN})`,
    '~77% (reprova se a contagem prova fora de 72–82%)', nN >= 100 && !provaFora(gN, nN, 0.72, 0.82));
  for (const [nome, l] of [['paradinha', pa], ['pulinho', pu]]) {
    const p1 = gols(l) / l.length, p0 = gN / nN, d = p1 - p0, se = Math.sqrt(p1 * (1 - p1) / l.length + p0 * (1 - p0) / nN);
    const prova = (d - 0.10) / se > 1.645 || (d + 0.10) / se < -1.645;
    reg(`D2 ${nome}: a conversão × a do normal`, `${pc(gols(l), l.length)} (${l.length}; Δ ${d >= 0 ? '+' : ''}${f1(100 * d)} ± ${f1(196 * se)} pontos) · gol / defesa / fora ${pc(gols(l), l.length)} / ${pc(l.filter(r => r.res === 'defesa').length, l.length)} / ${pc(l.filter(r => r.res === 'fora').length, l.length)}`,
      '± 10 pontos (reprova se a diferença prova fora, p < 5%)', l.length >= 100 && !prova);
  }
  const conv = l => `${pc(gols(l), l.length)} (${l.length})`;
  const cedoS = l => l.filter(r => r.comp), cedoN = l => l.filter(r => !r.comp);
  reg('D3 informativo: forte · colocado; contra o goleiro que sai cedo × o que espera (Noël 2021: independente 60,0 × 79,7%; dependente 81,8 × 63,6%)',
    `forte ${conv(fo)} · colocado ${conv(co)}; normal ${conv(cedoS(nor))} × ${conv(cedoN(nor))}; paradinha ${conv(cedoS(pa))} × ${conv(cedoN(pa))}; pulinho ${conv(cedoS(pu))} × ${conv(cedoN(pu))}`,
    'informativo', true);
  // E: Regra 14 na partida
  const linha = todas.map(r => r.gkLinha);
  reg('E1 Regra 14 (partida): o goleiro na linha do apito ao chute — o centro dele a … da linha do gol (pior)', `${f2(Math.max(...linha))} m (${linha.length} cobranças; média ${f2(media(linha))})`,
    '≤ 0,15 m', linha.length > 0 && Math.max(...linha) <= 0.15);
  reg('A5 informativo: o tempo da corrida (do 1º passo ao contato) · a queda do quadril abaixo de 0,92 m (pior; a régua do C11 do teste-corrida-cobranca) por estilo',
    ['normal', 'forte', 'colocado', 'paradinha', 'pulinho'].map(e => `${e} ${f2(media(de('ia', e).map(r => r.tCorrida)))} s, ${f2(0.92 - Math.min(...de('ia', e).map(r => r.quadrilMin)))} m`).join(' · '), 'informativo', true);
}

// ------------------------------------------------------------------------------------------------- C2: o goleiro da pessoa
if (temEstilos && faz('C')) {
  // o time do goleiro é o da pessoa; ela segura o analógico para um lado desde o apito (comprometida) ou só depois do pé de
  // apoio do cobrador (nada para ler); o cobrador da IA com a paradinha
  forcarEstilo('paradinha', false);
  let leu = 0, op = 0, n = 0, tarde = 0, tardeLido = 0;
  for (let k = 0; k < 60; k++) {
    const q = penalti(2000 + k);
    const tg = 1 - q.t, lado = k % 4 < 2 ? 1 : -1, cedo = k % 2 === 0;
    q.m.humanos = [tg]; q.m.timeHumano = tg;
    // (o analógico na tela de TV: ao longo da linha do gol é o z; ladoPenaltiHumano)
    const r = rodar(q, (m, pr) => {
      const cr = pr && pr.corrida;
      const mexe = cedo || (cr && cr.plantou >= 0);
      return { x: 0, z: mexe ? lado : 0, botoes: 0 };
    });
    if (!r.res) continue;
    n++;
    if (cedo) { if (r.lido) leu++; if (r.leu && r.leu.lado && Math.sign(r.zBola) === -r.leu.lado && Math.abs(r.zBola) > 0.5) op++; }
    else { tarde++; if (r.lido) tardeLido++; }
  }
  const nCedo = n - tarde;
  reg('C2 o goleiro da PESSOA: segurando o lado desde o apito, o cobrador da IA (paradinha) o lê e bate no canto oposto · escolhendo só depois do pé de apoio, nada para ler',
    `lido ${leu}/${nCedo}, oposto ${pc(op, leu)} · lido ${tardeLido}/${tarde}`, `todos, ≥ 60% · 0`, nCedo >= 20 && leu === nCedo && op >= 0.6 * leu && tardeLido === 0);
  voltarEP();
}

// ------------------------------------------------------------------------------------------------- F: os comandos da pessoa
let pessoasFinta = { n: 0, fintas: 0 };
if (temEstilos && faz('F')) {
  const E = await imp('entrada.js');
  const okTeclas = E.TECLA_BIT?.KeyF === BOTAO.PARADINHA && E.TECLA_BIT?.Space === BOTAO.PULINHO && E.TECLA_BIT?.ShiftLeft === BOTAO.CORRER && E.TECLA_BIT?.KeyE === BOTAO.MOD;
  const PP = E.PAD_PENALTI ?? {};
  const okPad = BOTAO[PP.LT] === BOTAO.PARADINHA && BOTAO[PP.RB] === BOTAO.MOD && BOTAO[PP.LB] === BOTAO.PULINHO;
  const bt = id => (E.BOTOES_TOQUE ?? []).find(b => b.id === id);
  const html = fs.existsSync(path.join(JS, '../index.html')) ? fs.readFileSync(path.join(JS, '../index.html'), 'utf8') : '';
  const okToque = bt('btn-paradinha')?.bit === 'PARADINHA' && bt('btn-pulinho')?.bit === 'PULINHO' && /id="btn-paradinha"/.test(html) && /id="btn-pulinho"/.test(html);
  reg('F1 as teclas (F paradinha, espaço pulinho, Shift forte, E colocado) · o controle no pênalti (LT paradinha, RB colocado, LB pulinho) · os botões de toque',
    `${okTeclas ? 'sim' : 'NÃO'} · ${okPad ? 'sim' : 'NÃO'} · ${okToque ? 'sim' : 'NÃO'}`, 'sim · sim · sim', okTeclas && okPad && okToque);

  // F2: na partida, a pessoa bate (o time dela é o que cobra; o goleiro é da IA)
  const CH = BOTAO.CHUTE;
  /** Roteiro: aperta `b` por k ticks a partir da bola pronta e solta; depois `extra(i)` (ticks desde o soltar) = bits a mais. */
  const roteiro = (b, k, extra = null, dir = 0.35) => {
    let t0 = -1;
    return (m, pr) => {
      // (a bola pronta da montagem — o pênalti montado tem o plano da corrida; antes dele o pronta é o provisório)
      if (!pr || pr.rolou || !pr.corrida || m.tick < pr.pronta + 2) return NADA;
      if (t0 < 0) t0 = m.tick;
      const i = m.tick - t0, la = m.ataca[pr.time];
      const x = la, z = dir;
      if (i < k) return { x, z, botoes: b };
      return { x, z, botoes: extra ? extra(i - k, pr) : 0 };
    };
  };
  const CASOS = [
    { nome: 'CHUTE → normal', quer: 'normal', ent: () => roteiro(CH, 28) },
    { nome: 'CHUTE + CORRER no soltar → forte', quer: 'forte', ent: () => roteiro(CH | BOTAO.CORRER, 28, i => (i < 2 ? BOTAO.CORRER : 0)) },
    { nome: 'CHUTE + MOD → colocado', quer: 'colocado', ent: () => roteiro(CH | BOTAO.MOD, 28) },
    { nome: 'PARADINHA antes do soltar → paradinha', quer: 'paradinha', ent: () => roteiro(CH | BOTAO.PARADINHA, 28) },
    { nome: 'PARADINHA na corrida → paradinha', quer: 'paradinha', ent: () => roteiro(CH, 28, i => (i >= 6 && i < 10 ? BOTAO.PARADINHA : 0)) },
    { nome: 'PULINHO antes do soltar → pulinho', quer: 'pulinho', ent: () => roteiro(CH | BOTAO.PULINHO, 28) },
    { nome: 'PULINHO na corrida → pulinho', quer: 'pulinho', ent: () => roteiro(CH, 28, i => (i >= 6 && i < 10 ? BOTAO.PULINHO : 0)) },
    { nome: 'CHUTE duas vezes → cavadinha', quer: 'cavadinha', ent: () => roteiro(CH, 6, i => (i >= 4 && i < 9 ? CH : 0)) },
    // a paradinha que não cabe mais (com o pé de apoio já plantado ou perto): nada muda — nunca vira finta
    { nome: 'PARADINHA depois do último apoio → nada muda', quer: 'normal', ent: () => roteiro(CH, 28, (i, pr) => (pr && pr.corrida && pr.corrida.plantou >= 0 ? BOTAO.PARADINHA : 0)) },
  ];
  const resF = [];
  for (const cs of CASOS) {
    let ok = 0, n = 0, assin = 0;
    for (let k = 0; k < 4; k++) {
      const q = penalti(3000 + 7 * k + CASOS.indexOf(cs));
      q.m.humanos = [q.t]; q.m.timeHumano = q.t;
      const r = rodar(q, cs.ent());
      if (!r.res) continue;
      n++;
      pessoasFinta.n++; if (r.abaixoDepois) pessoasFinta.fintas++;
      if (r.estilo === cs.quer) ok++;
      const a = cs.quer === 'paradinha' ? r.vMinAntes < 1 : cs.quer === 'pulinho' ? r.vooPenult >= EP.pulinho.voo - 1e-9 && r.salto >= 0.08
        : cs.quer === 'cavadinha' ? r.vooTipo === 'cavadinha' : cs.quer === 'colocado' ? r.vooTipo === 'colocado' : true;
      if (a) assin++;
    }
    resF.push(`${cs.nome}: ${ok}/${n}${assin !== n ? ` (assinatura ${assin}/${n})` : ''}`);
    if (!(n >= 3 && ok === n && assin === n)) resF.push('  ↑ ERRADO');
  }
  const errados = resF.filter(x => x.includes('ERRADO')).length;
  reg('F2 a pessoa na partida: cada comando chega ao estilo e à assinatura dele (4 cobranças cada)', resF.filter(x => !x.includes('ERRADO')).join(' · '), 'todos', errados === 0);

  // F3: a pessoa na PARADINHA em hora sorteada (inclusive tarde): nenhuma finta depois da corrida; e a disputa deixa passar
  const rr = R.criarRng(4242);
  for (let k = 0; k < 40; k++) {
    const q = penalti(4000 + k);
    q.m.humanos = [q.t]; q.m.timeHumano = q.t;
    const quando = Math.floor(R.uniforme(rr) * 70);
    const r = rodar(q, roteiro(CH, 20 + (k % 20), i => (i >= quando && i < quando + 3 ? BOTAO.PARADINHA : 0)));
    if (!r.res) continue;
    pessoasFinta.n++; if (r.abaixoDepois) pessoasFinta.fintas++;
  }
  const DS = await imp('disputa.js');
  let dOk = 0, dN = 0;
  for (const [bit, quer] of [[BOTAO.PARADINHA, 'paradinha'], [BOTAO.PULINHO, 'pulinho']]) {
    for (let s = 0; s < 2; s++) {
      const m = DS.criarDisputa({ semente: 31 + s, humano: 0, comeca: 0 });
      let t0 = -1, estilo = null;
      for (let i = 0; i < 60 * 20 && estilo == null; i++) {
        const pr = m.parada, D = m.disputa;
        let e = { x: 0, z: 0, botoes: 0 };
        if (D.estado === 'cobranca' && D.vez === 0 && pr && !pr.rolou && pr.corrida && m.tick >= pr.pronta + 2) {
          if (t0 < 0) t0 = m.tick;
          const k = m.tick - t0;
          e = { x: m.disputa.gol, z: 0.3, botoes: k < 26 ? BOTAO.CHUTE | bit : 0 };
        }
        DS.passoDisputa(m, e);
        if (D.estado === 'chute' && t0 >= 0 && D.vez === 0) estilo = pr?.corrida?.estilo ?? 'normal';
      }
      dN++; if (estilo === quer) dOk++;
    }
  }
  reg('F3 a disputa de pênaltis: a PARADINHA e o PULINHO da pessoa chegam ao estilo (entradaDaVez)', `${dOk}/${dN}`, 'todos', dN === 4 && dOk === dN);
}

// ------------------------------------------------------------------------------------------------- B: a finta
if (temEstilos && faz('B')) {
  const F = globalThis.__finta;
  const n = F.n + pessoasFinta.n, fintas = F.fintas + pessoasFinta.fintas;
  reg('B nenhuma finta depois da corrida: depois do último apoio o cobrador não fica abaixo de 1 m/s até o contato (IA de todos os estilos + a pessoa que aperta a PARADINHA a qualquer hora)',
    `${fintas} em ${n} cobranças (a menor velocidade depois do último apoio, IA: ${f2(F.pior)} m/s; sem o apoio ao lado da bola ${F.sem})`, '0 em ≥ 1000', n >= 1000 && fintas === 0);
}

// ------------------------------------------------------------------------------------------------- E2: a disputa
if (faz('E')) {
  let DS = null;
  try { DS = await imp('disputa.js'); } catch { DS = null; }
  if (DS) {
    let pior = 0, n = 0;
    for (let s = 0; s < 6; s++) {
      const m = DS.criarDisputa({ semente: 101 + s });
      let pr = null;
      for (let i = 0; i < 60 * 240 && m.disputa.estado !== 'fim'; i++) {
        const p0 = m.parada;
        if (p0 && !p0.rolou && p0.tipo === 'penalti' && m.disputa.estado === 'cobranca') pr = p0;
        DS.passoDisputa(m, DS.entradaDemoDisputa(m));
        if (pr && m.tick >= pr.pronta) {
          const gk = m.jogadores.find(o => o.id === m.disputa.goleiro);
          if (gk && !pr.rolou) pior = Math.max(pior, Math.abs(MX - Math.abs(gk.x)));
          if (pr.rolou) { n++; pr = null; }
        }
      }
    }
    reg('E2 Regra 14 (disputa): o goleiro na linha do apito ao chute (pior)', `${f2(pior)} m (${n} cobranças)`, '≤ 0,15 m', n >= 40 && pior <= 0.15);
  }
}

// ------------------------------------------------------------------------------------------------- G: online
if (temEstilos && faz('G')) {
  const O = await imp('online.js');
  const ok = [BOTAO.PARADINHA, BOTAO.PULINHO, BOTAO.CHUTE | BOTAO.PULINHO | BOTAO.EFEITO_D].every(b => O.quantizada({ x: 0.2, z: -0.4, botoes: b, repete: true }).botoes === b);
  let iguais = true, passos = 0, estilo = null;
  {
    const q = penalti(5001);
    const a = q.m;
    a.humanos = [0, 1]; a.timeHumano = q.t;
    let b = null, t0 = -1, volta = q.volta;
    for (let i = 0; i < 60 * 10; i++) {
      const pr = a.parada;
      if (volta && pr && pr.corrida) { volta(); volta = null; }
      let e = NADA;
      if (pr && !pr.rolou && pr.corrida && a.tick >= pr.pronta + 2) {
        if (t0 < 0) t0 = a.tick;
        const k = a.tick - t0;
        e = { x: a.ataca[pr.time], z: 0.3, botoes: k < 24 ? BOTAO.CHUTE : k >= 30 && k < 33 ? BOTAO.PULINHO : 0 };
      }
      const e2 = pr ? { [pr.time]: O.quantizada(e), [1 - pr.time]: O.quantizada(NADA) } : { 0: NADA, 1: NADA };
      if (!b && pr && pr.corrida && pr.corrida.estado === 'corre') b = S.copiarMundo(a);
      P.passoPartida(a, e2);
      if (pr && pr.corrida && pr.rolou && estilo == null) estilo = pr.corrida.estilo;
      if (b) { P.passoPartida(b, structuredClone(e2)); passos++; if (S.hashMundo(a) !== S.hashMundo(b)) { iguais = false; break; } }
    }
  }
  reg('G online: a PARADINHA e o PULINHO viajam na entrada (codificar/decodificar) · dois humanos com o pulinho: o mesmo hash',
    `${ok ? 'sim' : 'NÃO'} · ${iguais ? 'iguais' : 'DIFERENTES'} em ${passos} passos (estilo ${estilo})`, 'sim · iguais · pulinho', ok && iguais && passos > 60 && estilo === 'pulinho');
}

// ------------------------------------------------------------------------------------------------- H: a IA
if (temEstilos && faz('H')) {
  const ids = [...Array.from({ length: 23 }, (_, i) => i + 1), ...Array.from({ length: 23 }, (_, i) => 101 + i)];
  const cont = {};
  for (const id of ids) { const e = CO.estiloPreferido(id); cont[e] = (cont[e] ?? 0) + 1; }
  const puro = ids.every(id => CO.estiloPreferido(id) === CO.estiloPreferido(id));
  reg('H1 o estilo preferido de cada jogador (pelo id, puro): os 5 aparecem nos 46 do elenco', Object.entries(cont).map(([e, n]) => `${e} ${n}`).join(' · '),
    '5 estilos · puro', puro && ['normal', 'forte', 'colocado', 'paradinha', 'pulinho'].every(e => cont[e] > 0));
  // a mesma semente = o mesmo estilo; o preferido com a chance `fiel` (contado nos cobradores cujo preferido não é o normal)
  let iguais = 0, fiel = 0, n = 0, nPref = 0, outros = 0;
  for (let k = 0; k < 240; k++) {
    const est = [];
    for (let v = 0; v < 2; v++) {
      const q = penalti(6000 + k);
      for (let i = 0; i < 200 && !(q.m.parada && q.m.parada.corrida); i++) P.passoPartida(q.m, NADA);
      q.volta();
      const pr = q.m.parada;
      est.push(pr && pr.corrida ? { e: pr.corrida.estiloIA, id: pr.cobrador } : null);
    }
    if (!est[0] || !est[1]) continue;
    n++;
    if (est[0].e === est[1].e) iguais++;
    const pref = CO.estiloPreferido(est[0].id);
    if (est[0].e !== pref && est[0].e !== 'normal') outros++;
    if (pref !== 'normal') { nPref++; if (est[0].e === pref) fiel++; }
  }
  reg('H2 a mesma semente = o mesmo estilo · o preferido com a chance ESTILO_PENALTI.ia.fiel, o resto normal (os cobradores de preferido não normal)',
    `${iguais}/${n} · ${pc(fiel, nPref)} de ${nPref} (fiel ${f2(EP.ia.fiel)}) · outro estilo ${outros}`, 'todos · fiel ± 0,1 (binomial) · 0',
    n >= 100 && nPref >= 50 && iguais === n && outros === 0 && !provaFora(fiel, nPref, EP.ia.fiel - 0.1, EP.ia.fiel + 0.1));
}

fim();
