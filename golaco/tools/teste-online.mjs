// Online 1×1, etapa 2 (contrato "Online 1×1" no CONTRATOS.md): a sessão de troca de entradas (js/online.js) em Node,
// com dois "aparelhos" — cada um com o seu mundo, a sua sessão e o seu relógio — ligados por uma rede de mentira
// (tools/lib/rede-memoria.mjs: latência, variação, perda, rajada, duplicação, controle confiável). Confere:
//  O1 formato: 100 mil entradas sorteadas + extremos — decodificar(codificar(e)) = a quantização do jogo (1/1024, ±1);
//     pacotes inválidos (tipo, tamanho, k > 16, bits reservados) descartados;
//  O2 o MESMO jogo nos dois: em 5 redes (15±10 ms; 40±20 com 2% de perda; 80±40 com 5%; 40±20 com B a 30 qps e o relógio
//     de B 0,5% mais rápido; 40±20 com 10% duplicados, degrau de latência 20 → 120 → 20 ms e rajada de 300 ms sem nada),
//     com "replays" locais (um aparelho para sozinho 2–6 s), menu aberto (bit IA) e edições do time dos dois lados: o hash
//     dos dois a cada 60 passos = o de uma REFERÊNCIA que roda as mesmas entradas sem rede — 0 diferenças;
//  O3 paradas: nas redes que cabem no atraso, ≤ 1 parada a cada 10 s fora dos replays (o outro esperando é parada dele);
//  O7 ação: a edição de cada time entra no mesmo passo nos dois; a de time trocado é recusada;
//  O9 ausência: B some 20 s (aba escondida: nenhum quadro, nenhum pacote) — A mostra "aguardando" em ≤ 5,5 s; B volta e o
//     jogo segue com o hash igual;
//  O10 dessincronia: um bit do mundo de B trocado no passo 1200 — os dois acusam em ≤ 2 × 60 passos;
//  O12 custo: a sessão sem o passo, por quadro (média) e a banda por sentido.
//   node tools/teste-online.mjs [--passos 3600]
import { tabelaTexto } from './lib/medidas.mjs';
import { criarRede } from './lib/rede-memoria.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const PASSOS = +arg('--passos', 3600);
const JS = arg('--js', '../js');
const imp = f => import(new URL(`${JS}/${f}`, import.meta.url).href);
const O = await imp('online.js');
const P = await imp('partida.js');
const S = await imp('sim.js');
const { BOTAO } = await imp('config.js');
const FNS = { passoPartida: P.passoPartida, entradaDemoPartida: P.entradaDemoPartida };
const PASSO_MS = 1000 / 60;
const t0 = Date.now();
const linhas = [];
let reprovou = 0;
function linha(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) reprovou++; }

function gerador(sem) {
  let s = (sem * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// ------------------------------------------------------------------ O1 formato
{
  const r = gerador(7);
  const q = v => { const k = Math.round(v * 1024); return (k < -1024 ? -1024 : k > 1024 ? 1024 : k) / 1024 + 0; };
  let ruins = 0;
  const b = new Uint8Array(O.BYTES);
  const extremos = [{ x: 1, z: -1, botoes: 0x7fff, repete: true, ia: true, acao: true }, { x: -1.7, z: 3, botoes: 0, repete: false },
    { x: 0, z: 0, botoes: 0 }, { x: -0, z: 1e-9, botoes: BOTAO.CHUTE }, { x: 0.99951171875, z: -0.00048828125, botoes: 1 }];
  const casos = extremos.concat(Array.from({ length: 100000 }, () => ({ x: (r() * 2.4 - 1.2), z: (r() * 2.4 - 1.2), botoes: Math.floor(r() * 0x8000), repete: r() < 0.5, ia: r() < 0.2, acao: r() < 0.1 })));
  for (const e of casos) {
    O.codificar(e, b, 0);
    const d = O.decodificar(b, 0);
    if (d.x !== q(e.x) || d.z !== q(e.z) || d.botoes !== (e.botoes & 0x7fff) || d.repete !== !!e.repete || d.ia !== !!e.ia || d.acao !== !!e.acao) ruins++;
    if (!Object.is(d.x, d.x + 0) || !Object.is(d.z, d.z + 0)) ruins++; // nunca −0
  }
  // pacotes inválidos
  const s = O.criarSessao({ lado: 0, D: 4 });
  const bom = O.pacote(s, 1000);
  const ruimTipo = bom.slice(0); new Uint8Array(ruimTipo)[0] = 9;
  const ruimTam = bom.slice(0, bom.byteLength - 1);
  const ruimBit = bom.slice(0); new Uint8Array(ruimBit)[O.CABECALHO + 5] = 0x80;
  const ruimK = new ArrayBuffer(O.CABECALHO + O.BYTES * 17); new DataView(ruimK).setUint8(0, 1); new DataView(ruimK).setUint8(20, 17);
  const invalidos = [ruimTipo, ruimTam, ruimBit, ruimK, new ArrayBuffer(3)].filter(x => O.lerPacote(x) !== null).length;
  linha('O1 formato: decodificar(codificar(e)) = a quantização do jogo (100 mil + extremos)', `${ruins} diferentes de ${casos.length}`, '0', ruins === 0);
  linha('O1 pacotes inválidos (tipo, tamanho, bit reservado, k > 16) descartados', `${5 - invalidos} de 5`, '5 de 5', invalidos === 0 && O.lerPacote(bom) !== null);
}

// ------------------------------------------------------------------ dois aparelhos
function edicao(m, t, k) {
  // a tática (a escalação como está): sempre válida — a de base velha (o time mudou entre pedir e entrar) é recusada nos dois
  const T = m.times[t];
  return { tipo: 'editarTime', time: t, base: T.versao, formacao: T.formacao, vagas: { ...T.vagas }, substituicoes: [], tatica: { mentalidade: k % 3, pressao: (k + 1) % 3, largura: 1, linha: 1 + (k % 2) } };
}

/** Uma pessoa jogando: analógico e botões sorteados; às vezes o menu aberto (bit IA). */
function criarPessoa(sem, lado) {
  const r = gerador(sem * 13 + lado + 1);
  let e = { x: 0, z: 0, botoes: 0 }, dura = 0, menu = 0;
  const LISTA = [0, 0, 0, BOTAO.CORRER, BOTAO.PASSE, BOTAO.CHUTE, BOTAO.LANCAMENTO, BOTAO.ENFIADA, BOTAO.TROCAR, BOTAO.CONTER, BOTAO.DIVIDIDA, BOTAO.PRESSAO, BOTAO.CORRER | BOTAO.PASSE];
  return () => {
    if (menu > 0) { menu--; return { x: 0, z: 0, botoes: 0, ia: true }; }
    if (r() < 0.0008) { menu = 120 + Math.floor(r() * 300); }
    if (dura-- <= 0) {
      const ang = r() * 2 * Math.PI, mag = r() < 0.2 ? 0 : 0.3 + 0.7 * r();
      e = { x: Math.cos(ang) * mag, z: Math.sin(ang) * mag, botoes: LISTA[Math.floor(r() * LISTA.length)] };
      dura = 10 + Math.floor(r() * 50);
    }
    return e;
  };
}

/**
 * Roda uma rede. cfg: {nome, rede: opções da rede, qpsB, relogioB (fator), sem, ausencia: {de, ate} (ms) de B,
 * dessinc: passo, replays: true}. Devolve as medidas.
 */
function rodar(cfg) {
  const rede = criarRede({ semente: cfg.sem * 31, ...cfg.rede });
  const D = O.atrasoPorRtt(2 * ((cfg.rede.lat ?? 40) + (cfg.rede.var ?? 20)), cfg.qpsB === 30);
  const r = gerador(cfg.sem * 977);
  const mk = (lado, qps, fator) => ({
    lado, m: P.criarPartida({ semente: 300 + cfg.sem, humanos: [0, 1], humano: lado, minutosPorTempo: 2 }),
    s: O.criarSessao({ lado, D }), pessoa: criarPessoa(cfg.sem, lado), qps, fator,
    prox: 0, acum: 0, hashes: [], ent: [], acoes: new Map(), segura: null, edicoes: 0, paradasFora: 0, msSessao: 0, quadros: 0, bytes: 0,
    estados: [],
  });
  const A = mk(0, 60, 1), B = mk(1, cfg.qpsB ?? 60, cfg.relogioB ?? 1);
  const devs = [A, B];
  const fim = d => d.s.n >= PASSOS || d.m.partida.estado === 'fim';
  let viuAguardando = null, dessincA = null, dessincB = null;
  for (let ms = 0; !(fim(A) && fim(B)) && ms < PASSOS * PASSO_MS * 6; ms++) {
    rede.agora = ms;
    for (const d of devs) {
      // o que chegou
      const tq = performance.now();
      for (const msg of rede.entregar(d.lado)) {
        if (msg.tipo === 'j') O.receber(d.s, msg.dado, ms);
        else if (msg.dado.tipo === 'acao') O.receberAcao(d.s, msg.dado.n, msg.dado.acao);
        else if (msg.dado.tipo === 'hash') O.receberHash(d.s, msg.dado.n, msg.dado.h);
      }
      d.msSessao += performance.now() - tq;
      const oculto = d === B && cfg.ausencia && ms >= cfg.ausencia.de && ms < cfg.ausencia.ate;
      if (oculto || ms < d.prox || fim(d)) continue;
      const dtq = 1000 / d.qps / d.fator;
      d.prox += dtq;
      d.quadros++;
      // "replay" local: o aparelho para sozinho (não roda passo nem produz entrada)
      if (cfg.replays && !d.segura && r() < 0.0006) d.segura = ms + 2000 + r() * 4000;
      if (d.segura && ms >= d.segura) d.segura = null;
      let quer = 0;
      if (!d.segura) { d.acum += dtq * d.fator; quer = O.passosDoQuadro(d.s, Math.min(5, Math.floor(d.acum / PASSO_MS)), ms); }
      let rodou = 0;
      const leitura = d.pessoa(); // uma leitura por quadro (a 30 qps, o 2º passo é a mesma leitura: `repete`)
      for (let i = 0; i < quer; i++) {
        const tp = performance.now();
        if (!O.podePassar(d.s)) { d.msSessao += performance.now() - tp; break; }
        const { e, acoes } = O.entradas(d.s);
        d.msSessao += performance.now() - tp;
        d.ent.push([d.s.n, e, acoes]);
        O.passoOnline(d.m, e, acoes, FNS);
        const t1 = performance.now();
        O.passou(d.s);
        O.ajustarAtraso(d.s, d.qps === 30);
        const n = d.s.n - 1;
        if (n % O.HASH_CADA === 0) { const h = S.hashMundo(d.m); d.hashes.push([n, h]); O.registrarHash(d.s, n, h); rede.controle(d.lado, { tipo: 'hash', n, h }); }
        // dessincronia de propósito (O10): um bit trocado no mundo de B
        if (cfg.dessinc && d === B && n === cfg.dessinc) d.m.bola.p.x += 1e-9;
        // a minha entrada do passo n + D (e, às vezes, uma edição do meu time)
        let acao = null;
        if (r() < 0.0015 && d.m.partida.estado === 'jogo') { acao = edicao(d.m, d.lado, d.edicoes++); }
        const nProd = O.produzir(d.s, { ...leitura, repete: i > 0 }, acao);
        if (acao) { d.acoes.set(nProd, acao); rede.controle(d.lado, { tipo: 'acao', n: nProd, acao }); }
        d.msSessao += performance.now() - t1;
        rodou++;
      }
      d.acum -= rodou * PASSO_MS;
      // parado esperando o outro: o tempo parado NÃO é recuperado depois (correr para alcançar gasta a folga do atraso D e
      // vira outra parada logo em seguida); só a fração de um passo fica
      if (rodou < quer) d.acum = Math.min(d.acum, PASSO_MS / 2);
      // parada = o quadro sem passo nenhum (o jogo congela na tela); a 30 qps, rodar 1 dos 2 passos não congela nada
      const parado = quer > 0 && rodou === 0;
      O.marcarParado(d.s, parado, ms);
      const outro = devs.find(x => x !== d);
      if (outro.segura) outro.fimSegura = ms;
      const depoisDoOutro = outro.fimSegura != null && ms - outro.fimSegura < 3000;
      if (parado && !outro.segura && !depoisDoOutro && d.s.paradoDesde === ms && !(cfg.ausencia && ms >= cfg.ausencia.de && ms < cfg.ausencia.ate + 3000)) d.paradasFora++;
      const tp = performance.now();
      const ab = O.pacote(d.s, ms, d.qps === 30 ? O.E_30QPS : 0);
      d.bytes += ab.byteLength + 90;
      rede.jogo(d.lado, ab);
      const est = O.estadoConexao(d.s, ms);
      d.msSessao += performance.now() - tp;
      if (d === A && cfg.ausencia && est.estado === 'aguardando' && viuAguardando == null && ms >= cfg.ausencia.de) viuAguardando = ms - cfg.ausencia.de;
      if (d.s.dessinc && d === A && dessincA == null) dessincA = d.s.n;
      if (d.s.dessinc && d === B && dessincB == null) dessincB = d.s.n;
      if (cfg.degrau) { if (ms === cfg.degrau[0]) rede.definirLatencia(120); if (ms === cfg.degrau[1]) rede.definirLatencia(20); }
    }
  }
  // a REFERÊNCIA: as mesmas entradas (as que cada um produziu), sem rede
  const ref = P.criarPartida({ semente: 300 + cfg.sem, humanos: [0, 1], humano: 0, minutosPorTempo: 2 });
  const nMax = Math.min(A.s.n, B.s.n);
  const refHash = new Map();
  for (let n = 0; n < nMax; n++) {
    const e0 = O.decodificar(A.s.loc.buf, n * O.BYTES), e1 = O.decodificar(B.s.loc.buf, n * O.BYTES);
    const ac = [];
    if (e0.acao && A.acoes.get(n)) ac.push(A.acoes.get(n));
    if (e1.acao && B.acoes.get(n)) ac.push(B.acoes.get(n));
    O.passoOnline(ref, { 0: e0, 1: e1 }, ac.length ? ac : null, FNS);
    if (n % O.HASH_CADA === 0) refHash.set(n, S.hashMundo(ref));
  }
  let difs = 0, comparados = 0;
  for (const d of devs) for (const [n, h] of d.hashes) { if (!refHash.has(n)) continue; comparados++; if (refHash.get(n) !== h) difs++; }
  const segJogo = nMax / 60;
  const edic = [A.edicoes, B.edicoes];
  const aplic = ref.times[0].versao + ref.times[1].versao;
  if (process.env.DIAG) console.log('DIAG', cfg.nome, 'D', D, '→', A.s.D, B.s.D, 'freios', A.s.freios, B.s.freios, 'vant', A.s.vantagem?.toFixed(2), B.s.vantagem?.toFixed(2), 'rtt', A.s.rtt?.toFixed(0), B.s.rtt?.toFixed(0), 'paradasTot', A.s.paradas, B.s.paradas, 'fora', A.paradasFora, B.paradasFora);
  return { cfg, D, Df: [A.s.D, B.s.D], nA: A.s.n, nB: B.s.n, difs, comparados, paradas: [A.paradasFora, B.paradasFora], segJogo, viuAguardando, dessincA, dessincB,
    dessincEm: cfg.dessinc, msPorQuadro: (A.msSessao + B.msSessao) / (A.quadros + B.quadros), kbs: A.bytes / 1024 / (A.quadros / A.qps),
    edic, aplic, rtt: A.s.rtt, descartados: A.s.descartados + B.s.descartados, perdidos: rede.perdidos, enviados: rede.enviados };
}

const REDES = [
  { nome: '15±10 ms', rede: { lat: 15, var: 10 }, sem: 1, replays: true },
  { nome: '40±20 ms, 2% de perda', rede: { lat: 40, var: 20, perda: 0.02 }, sem: 2, replays: true },
  { nome: '80±40 ms, 5% de perda', rede: { lat: 80, var: 40, perda: 0.05 }, sem: 3, replays: true },
  { nome: '40±20 ms, B a 30 qps e relógio de B 0,5% mais rápido', rede: { lat: 40, var: 20, perda: 0.01 }, sem: 4, qpsB: 30, relogioB: 1.005, replays: true },
  { nome: '40±20 ms, 10% duplicados, degrau 20→120→20 ms, rajada de 300 ms', rede: { lat: 20, var: 20, dup: 0.1, rajada: { de: 20000, ate: 20300 } }, sem: 5, degrau: [15000, 30000], replays: true },
];
const res = REDES.map(rodar);
for (const x of res) {
  linha(`O2 o mesmo jogo nos dois = a referência — ${x.cfg.nome} (D ${x.D} → ${x.Df.join('/')})`, `${x.difs} diferentes de ${x.comparados} hashes; ${x.nA}/${x.nB} passos`, '0 e ≥ 30 hashes', x.difs === 0 && x.comparados >= 30);
  const por10 = (x.paradas[0] + x.paradas[1]) / 2 / (x.segJogo / 10);
  if (!x.cfg.degrau) linha(`O3 paradas fora dos replays — ${x.cfg.nome}`, `${x.paradas.join(' / ')} em ${x.segJogo.toFixed(0)} s (${por10.toFixed(2)} a cada 10 s)`, '≤ 1 a cada 10 s', por10 <= 1);
  linha(`O7 edições do time entraram nos dois — ${x.cfg.nome}`, `pedidas ${x.edic.join(' + ')}, aplicadas ${x.aplic}`, '≥ 1 aplicada e hash igual (O2)', x.difs === 0 && x.aplic >= 1);
}
// O7 ação de time trocado: recusada
{
  const s = O.criarSessao({ lado: 0, D: 4 });
  const okOutro = O.receberAcao(s, 10, { tipo: 'editarTime', time: 1 });
  const okMeu = O.receberAcao(s, 10, { tipo: 'editarTime', time: 0 });
  linha('O7 ação do time trocado recusada (a do outro aceita)', `outro ${okOutro} · meu time ${okMeu}`, 'true · false', okOutro === true && okMeu === false);
}
// O9 ausência
{
  const x = rodar({ nome: 'ausência', rede: { lat: 30, var: 10 }, sem: 6, ausencia: { de: 10000, ate: 30000 } });
  linha('O9 B some 20 s: A mostra "aguardando" e o jogo segue igual depois', `aguardando em ${x.viuAguardando == null ? '—' : (x.viuAguardando / 1000).toFixed(2) + ' s'}; ${x.difs} diferentes de ${x.comparados}; ${x.nA}/${x.nB} passos`, '≤ 5,5 s e 0 diferentes', x.viuAguardando != null && x.viuAguardando <= 5500 && x.difs === 0 && x.comparados >= 30);
}
// O10 dessincronia
{
  const x = rodar({ nome: 'dessincronia', rede: { lat: 30, var: 10 }, sem: 7, dessinc: 1200 });
  const okA = x.dessincA != null && x.dessincA - x.dessincEm <= 2 * O.HASH_CADA + 30, okB = x.dessincB != null && x.dessincB - x.dessincEm <= 2 * O.HASH_CADA + 30;
  linha('O10 um bit trocado no mundo de B no passo 1200: os dois acusam', `A no passo ${x.dessincA ?? '—'} · B no ${x.dessincB ?? '—'}`, `≤ ${1200 + 2 * O.HASH_CADA + 30}`, okA && okB);
}
// O12 custo e banda
{
  const ms = res.reduce((a, x) => a + x.msPorQuadro, 0) / res.length, kbs = Math.max(...res.map(x => x.kbs));
  linha('O12 a sessão (sem o passo) por quadro, média', `${(ms * 1000).toFixed(1)} µs`, '≤ 50 µs', ms <= 0.05);
  linha('O12 banda por sentido (com ~90 B de cabeçalho do WebRTC por pacote)', `${kbs.toFixed(1)} KB/s`, '≤ 15 KB/s', kbs <= 15);
}

console.log(tabelaTexto([['item', 'medido', 'meta', 'resultado'], ...linhas]));
console.log(`\nteste-online: ${reprovou ? `REPROVOU (${reprovou} itens)` : 'PASSOU'} em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
process.exit(reprovou ? 1 : 0);
