// teste-mira: a cobrança mirada da bola parada do humano (pedido do dono, 16/10: "igual no FIFA ... essa linha no escanteio,
// e na falta, que tenha como colocar curva"; js/mira.js, acoes.js cobrancaMirada, partida.js cobrar; contrato "Cobrança
// mirada" no CONTRATOS.md). A pessoa = entrada SEM `ia`/`iaCobra` (como a página manda).
//
// Metas:
//  A. A linha É a física: com o erro do cobrador zerado (MIRA.erro = 0), a bola de verdade (a partida inteira rodando:
//     cobrar → passo) passa a ≤ 3 cm da linha prevista (mira-linha.js preverMira, mira.js simularLinha) em todos os ticks do voo —
//     escanteio ALTA sem e com curva, TENSA com curva, tiro livre direto (CHUTE) com barreira e curva e sem barreira com
//     a barra cheia: com a mira no CANTO (a reta dela cruza a linha do gol a 3,1 m do meio) sobe ao ângulo (2,0–2,3 m na
//     linha; a mira alta do C2, mira.js alturaMiraChute) e com a mira no MEIO fica na curva de antes (1,4–1,8 m; a main
//     46dd59ab: 1,66 m; decisão do dono, 28/10: "só o chute mirado sobe — com o analógico apontado para um canto"; a
//     referência da main fora do canto, bit a bit, fica no teste-chutes). Com CURVA (revisão de 29/10) vale onde a bola
//     cruza a linha, não a reta da mira: a reta no canto com a curva levando a bola ao meio do gol ou para fora da boca fica
//     na curva de antes; a reta fora do canto (ou fora do gol) com a curva levando a bola ao ângulo sobe — e a bola que
//     sobe cruza a linha sempre na faixa do canto (meia-boca − 0,9 ≤ |z| ≤ meia-boca), nunca no meio.
//  B. A curva vai para o lado certo: com o efeito +1 a bola cai/cruza a linha do gol ≥ 1,5 m à DIREITA de quem bate (da
//     linha sem efeito), com −1 à esquerda; no escanteio e no tiro livre.
//  C. Controles: o analógico para a direita (na câmera atrás do cobrador) gira a mira para a direita a MIRA.gira rad/s e
//     ela para no cone; cada aperto do efeito anda um degrau (3 apertos = 0,75), segurar repete até ±1; no tiro de meta
//     o efeito não vale e o PASSE sai na direção da mira; o rótulo pelo botão (LANÇAMENTO = ALTA, E + LANÇAMENTO e CHUTE
//     no escanteio = TENSA, CHUTE no tiro livre direto = CHUTE, PASSE = CURTA, tiro de meta = LONGA); a linha some no chute.
//  D. A linha mostra a intenção, não garante: com o erro do cobrador (MIRA.erro = 1) 24 escanteios com a MESMA mira caem
//     espalhados (desvio ≥ 0,3 m).
//  E. Canhão do humano roteirizado com a mira PERFEITA (a melhor mira pela linha): escanteios (gol ≤ 12%, p ≥ 0,05, como o
//     C3 do teste-bolas-paradas; real: 2,6%) e tiros livres diretos de 18–30 m (gol 2–12%, como o D4; real 5–7%).
//     Com --js <pasta sem mira.js> (a main antes desta entrega) o mesmo canhão com o humano de antes (analógico para a zona
//     / o canto e o botão): a tabela antes → depois.
//  F. A IA não usa nada disto: uma partida IA × IA (a demo pelo humano) sem nenhuma mira (m.parada.mira) nem cobrança
//     mirada (m.voo.mirada). O hash da partida IA × IA fica IGUAL: tools/hash-partida.mjs.
//
//   node tools/teste-mira.mjs              (lógica do repositório)
//   node tools/teste-mira.mjs --js <pasta> (outra cópia: sem mira.js, só o canhão do E com o humano de antes)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; };
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-mira: REPROVOU (${falhas})` : '\nteste-mira: PASSOU');
  process.exit(falhas ? 1 : 0);
}
const temMira = fs.existsSync(path.join(JS, 'mira.js'));
const P = await imp('partida.js');
const C = await imp('config.js');
const { uniforme } = await imp('rng.js');
const M = temMira ? { ...(await imp('mira.js')), ...(await imp('mira-linha.js')) } : null;
const { CAMPO, BOTAO, PASSO, ACOES, MIRA } = C;
const MX = CAMPO.meioX;
const f1 = v => v.toFixed(1).replace('.', ','), f2 = v => v.toFixed(2).replace('.', ',');
const pct = (a, b) => (b ? (100 * a / b) : 0);
const NADA = { x: 0, z: 0, botoes: 0 };
const jog = (m, id) => m.jogadores.find(o => o.id === id);

function rolando(s, aquec = 240) {
  const m = P.criarPartida({ semente: s });
  for (let i = 0; i < aquec + 3000 && !(i > aquec && m.partida.estado === 'jogo' && !m.parada); i++) P.passoPartida(m, P.entradaDemoPartida(m));
  return m;
}
const base = new Map();
const copia = (s, aquec = 240) => { const k = `${s}/${aquec}`; if (!base.has(k)) base.set(k, rolando(s, aquec)); return structuredClone(base.get(k)); };
/** Estado do meio do jogo (8 sementes × 60–90 s), o sorteio avançado k vezes; o humano no time 0. */
function cena(k) {
  const m = copia(1001 + (k % 8), 3600 + 600 * (Math.floor(k / 8) % 4));
  for (let i = 0; i < 3 * k + 1; i++) uniforme(m.rng);
  m.humanos = [0];
  return m;
}
function bolaFora(m, x, z, ult) {
  const j = m.jogadores.find(o => o.time === ult && o.posicao !== 'GOL');
  m.posse = null; m.naMao = null; m.voo = null;
  Object.assign(m.bola.p, { x, y: 0.11, z }); Object.assign(m.bola.v, { x: 0, y: 0, z: 0 });
  m.partida.ultimoTime = ult; m.partida.ultimoId = j.id; m.partida.ultimoTick = m.tick;
  m.ultimoToque = { id: j.id, time: ult, tick: m.tick };
}
/** Tiro livre direto para o time t a u m da linha de fundo atacada, w do meio (o do teste-bolas-paradas). */
function tiroLivre(m, t, u, w) {
  const lado = m.ataca[t];
  const x = lado * (MX - u), z = w;
  const At = m.jogadores.find(o => o.time === t && o.posicao === 'ATA') ?? m.jogadores.find(o => o.time === t && o.posicao !== 'GOL');
  const D = m.jogadores.find(o => o.time !== t && o.posicao === 'ZAG');
  P.teleportar(At, x, z, 0); P.teleportar(D, x - lado, z, 0); At.vx = 0;
  m.posse = At.id; m.naMao = null; m.voo = null; m.eventos = [];
  m.faltaPendente = { def: D.id, cond: At.id, time: t, x, z, area: false, chegada: 'tras', v: 3, grau: 'imprudente', cartao: null, motivo: 'imprudente', origem: 'bote', tick: m.tick };
  P.regrasPartida(m);
  return m;
}
/** Anda (sem botão) até a parada `tipo` do humano estar pronta (a mira criada pela 1ª entrada da pessoa). */
function atePronta(m, tipo, max = 600) {
  for (let i = 0; i < max; i++) {
    const pr = m.parada;
    if (pr && pr.tipo === tipo && pr.cobrador != null && !pr.rolou && m.tick >= pr.pronta && (!temMira || pr.mira)) return pr;
    P.passoPartida(m, NADA);
  }
  return null;
}
const escanteio = (m, lado = m.ataca[0], z = 10) => { bolaFora(m, lado * (MX + 0.6), z, 1); return ateMontarPronta(m, 'escanteio'); };
const ateMontarPronta = (m, tipo) => atePronta(m, tipo);
/** Segura o botão `b` por k ticks e solta (devolve a força que o soltar dá e os eventos do tick do chute). */
function carregarESoltar(m, b, k, extra = 0) {
  const c = jog(m, m.parada.cobrador);
  for (let i = 0; i < k; i++) P.passoPartida(m, { x: 0, z: 0, botoes: b | extra });
  const forca = Math.min(1, Math.max(0.08, (m.tick - c.carga.t0) * PASSO / ACOES.cargaCheia));
  return { forca, c };
}
const longe = (m, pr) => { for (const o of m.jogadores) if (o.id !== pr.cobrador) P.teleportar(o, -m.ataca[pr.time] * 8 + (o.id % 7), (o.id % 11) - 5, 0); };

if (temMira) {
  // ------------------------------------------------------------------ A. a linha é a física
  const erro0 = MIRA.erro;
  MIRA.erro = 0;
  const pts = new Float64Array(MIRA.maxPontos * 3);
  const casos = [
    { nome: 'escanteio ALTA', tipo: 'escanteio', b: BOTAO.LANCAMENTO, k: 30, da: 0, curva: 0, t: 'alta' },
    { nome: 'escanteio ALTA curva +1', tipo: 'escanteio', b: BOTAO.LANCAMENTO, k: 36, da: 0.12, curva: 1, t: 'alta' },
    { nome: 'escanteio TENSA curva −0,5', tipo: 'escanteio', b: BOTAO.CHUTE, k: 26, da: -0.08, curva: -0.5, t: 'tensa' },
    { nome: 'falta CHUTE (barreira) curva +0,75', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 34, da: -0.1, curva: 0.75, t: 'chute' },
    // a barra cheia sem barreira (C2): com a mira no CANTO (zLinha: onde a reta da mira cruza a linha do gol) sobe pela
    // mira.js alturaMiraChute, a mesma conta do chute do jogo; no MEIO (a mira padrão) fica na curva de antes
    { nome: 'falta CHUTE sem barreira, barra cheia no canto', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: 3.1, curva: 0, t: 'chute', semBarreira: 'canto' },
    { nome: 'falta CHUTE sem barreira, barra cheia no meio', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, da: 0, curva: 0, t: 'chute', semBarreira: 'meio' },
    // com curva (revisão de 29/10): onde a bola cruza a linha do gol decide (a 22 m, z 3: a reta e a curva escolhidas pela
    // sonda — a reta no canto 3,1 com −1 cruza a z ~1,8; 2,4 com +0,5 a ~3,0; −1,5 com −1 a ~−2,9; 4,5 com −1 a ~3,2; 3,5
    // com +1 a ~4,8)
    { nome: 'falta CHUTE sem barreira, barra cheia, reta no canto e a curva leva ao meio', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: 3.1, curva: -1, t: 'chute', semBarreira: 'meio' },
    { nome: 'falta CHUTE sem barreira, barra cheia, reta no canto e a curva leva para fora da boca', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: 3.5, curva: 1, t: 'chute', semBarreira: 'fora' },
    { nome: 'falta CHUTE sem barreira, barra cheia, reta fora do canto e a curva leva ao ângulo', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: 2.4, curva: 0.5, t: 'chute', semBarreira: 'canto' },
    { nome: 'falta CHUTE sem barreira, barra cheia, reta fora do canto e a curva leva ao ângulo (lado de lá)', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: -1.5, curva: -1, t: 'chute', semBarreira: 'canto' },
    { nome: 'falta CHUTE sem barreira, barra cheia, reta fora do gol e a curva traz ao ângulo', tipo: 'tiroLivre', b: BOTAO.CHUTE, k: 50, zLinha: 4.5, curva: -1, t: 'chute', semBarreira: 'canto' },
  ];
  const res = [];
  for (const cs of casos) {
    const m = copia(1001);
    m.humanos = [0];
    const pr = cs.tipo === 'escanteio' ? escanteio(m) : (tiroLivre(m, 0, 22, 3), ateMontarPronta(m, 'tiroLivre'));
    if (!pr) { res.push({ nome: cs.nome, d: Infinity, n: 0 }); continue; }
    longe(m, pr);
    if (cs.semBarreira && pr.barreira) pr.barreira.n = 0; // a barreira desfeita: a elevação pela altura da mira
    pr.mira.ang = cs.zLinha != null ? Math.atan2(cs.zLinha - pr.z, m.ataca[pr.time] * MX - pr.x) : pr.mira.ang0 + cs.da; pr.mira.curva = cs.curva;
    const { forca, c } = carregarESoltar(m, cs.b, cs.k);
    const r = M.chuteMirado(m, c, pr, cs.t, forca, pr.mira.ang, pr.mira.curva, {});
    const n = M.simularLinha(m, r.v, r.w, pts);
    let yLinha = null, zLinha = null; // onde a linha cruza a linha do gol (a barra cheia no canto: ~2,1 m; no meio: ~1,6 m)
    for (let i = 1; i < n && yLinha == null; i++) if (Math.abs(pts[i * 3]) >= MX) {
      const fr = (MX - Math.abs(pts[i * 3 - 3])) / (Math.abs(pts[i * 3]) - Math.abs(pts[i * 3 - 3]));
      yLinha = pts[i * 3 - 2] + (pts[i * 3 + 1] - pts[i * 3 - 2]) * fr; zLinha = pts[i * 3 - 1] + (pts[i * 3 + 2] - pts[i * 3 - 1]) * fr;
    }
    P.passoPartida(m, NADA); // solta: a cobrança sai (cobrar) e a bola anda um passo
    // (na barra cheia sem barreira, até a linha do gol: dali em diante entram o goleiro e a rede. Na main, com todos
    // levados para o meio-campo, o goleiro a 56 m "espalmava" a bola que cruzava a linha no z dele — goleiro.js: sem o plano
    // dele à frente da bola, a leitura cai no cruzamento da linha do gol e só mede o lado; pendente, fora do C2)
    let d = 0, k = 1, mirada = !!m.voo?.mirada;
    for (; k < n && !(cs.semBarreira && Math.abs(pts[k * 3]) >= MX); k++) {
      d = Math.max(d, Math.hypot(m.bola.p.x - pts[k * 3], m.bola.p.y - pts[k * 3 + 1], m.bola.p.z - pts[k * 3 + 2]));
      P.passoPartida(m, NADA);
    }
    res.push({ nome: cs.nome, d, n, mirada, semB: cs.semBarreira ?? null, yLinha: cs.semBarreira ? yLinha : null, zLinha: cs.semBarreira ? zLinha : null });
  }
  MIRA.erro = erro0;
  // a faixa do canto na linha do gol (a régua do C2): meia-boca − 0,9 ≤ |z| ≤ meia-boca
  const MB = CAMPO.gol.largura / 2, faixa = z => Math.abs(z) >= MB - 0.9 && Math.abs(z) <= MB;
  const okSemB = r => r.yLinha != null && (r.semB === 'canto' ? r.yLinha >= 2.0 && r.yLinha <= 2.3 && faixa(r.zLinha)
    : r.yLinha >= 1.4 && r.yLinha <= 1.8 && (r.semB === 'meio' ? Math.abs(r.zLinha) < MB - 0.9 : Math.abs(r.zLinha) > MB));
  reg('A. a bola de verdade segue a linha prevista (erro do cobrador zerado): a maior distância em todo o voo',
    res.map(r => `${r.nome}: ${f1(r.d * 100)} cm em ${r.n} ticks${r.semB ? ` (na linha do gol a ${r.yLinha != null ? `${f2(r.yLinha)} m, z ${f2(r.zLinha)}` : '—'})` : ''}`).join(' · '),
    '≤ 3 cm em todos (≥ 40 ticks de voo; a barra cheia até a linha do gol); a barra cheia na linha do gol: no canto a 2,0–2,3 m dentro da faixa do canto, no meio (|z| < meia-boca − 0,9) e fora da boca a 1,4–1,8 m (a curva de antes); a bola que sobe (≥ 1,95 m) cruza sempre na faixa do canto',
    res.every(r => r.d <= 0.03 && r.n >= 40 && r.mirada) && res.every(r => !r.semB || okSemB(r)) && res.every(r => !r.semB || r.yLinha == null || r.yLinha < 1.95 || faixa(r.zLinha)));

  // ------------------------------------------------------------------ B. a curva vai para o lado certo
  {
    const lado = (pts, n, ang, x0, z0) => { const k = n - 1; return -(pts[k * 3] - x0) * Math.sin(ang) + (pts[k * 3 + 2] - z0) * Math.cos(ang); };
    const med = [];
    for (const tipo of ['escanteio', 'tiroLivre']) {
      const m = copia(1002);
      m.humanos = [0];
      const pr = tipo === 'escanteio' ? escanteio(m) : (tiroLivre(m, 0, 24, -2), ateMontarPronta(m, 'tiroLivre'));
      const c = jog(m, pr.cobrador), t = tipo === 'escanteio' ? 'alta' : 'chute';
      const off = cv => { const r = M.chuteMirado(m, c, pr, t, 0.6, pr.mira.ang0, cv, {}); const n = M.simularLinha(m, r.v, r.w, pts); return lado(pts, n, pr.mira.ang0, pr.x, pr.z); };
      const o0 = off(0);
      med.push({ tipo, dir: off(1) - o0, esq: off(-1) - o0 });
    }
    reg('B. o efeito +1 curva para a DIREITA de quem bate e o −1 para a esquerda (fim da linha, contra a sem efeito)',
      med.map(x => `${x.tipo}: +1 → ${f1(x.dir)} m · −1 → ${f1(x.esq)} m`).join(' · '),
      '+1 ≥ +1,5 m · −1 ≤ −1,5 m', med.every(x => x.dir >= 1.5 && x.esq <= -1.5));
  }

  // ------------------------------------------------------------------ C. controles
  {
    const m = copia(1003);
    m.humanos = [0];
    const pr = escanteio(m);
    const mi = pr.mira, a0 = mi.ang0;
    const dir = { x: -Math.sin(a0), z: Math.cos(a0) };
    for (let i = 0; i < 30; i++) P.passoPartida(m, { x: dir.x, z: dir.z, botoes: 0 });
    const giro = mi.ang - a0;
    // (mais 1 s: o cone de 0,9 rad chega em 1,3 s; tudo dentro dos PARTIDA.cobrancaHumanoMax s da pessoa)
    for (let i = 0; i < 60; i++) P.passoPartida(m, { x: dir.x, z: dir.z, botoes: 0 });
    const noCone = mi.ang - a0;
    // 3 apertos do efeito para a direita; depois segurar o da esquerda por 1,2 s
    for (let t = 0; t < 3; t++) { P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.EFEITO_D }); P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.EFEITO_D }); P.passoPartida(m, NADA); P.passoPartida(m, NADA); }
    const tres = mi.curva;
    for (let i = 0; i < 72; i++) P.passoPartida(m, { x: 0, z: 0, botoes: BOTAO.EFEITO_E });
    const segura = mi.curva;
    // rótulos pelo botão (carregando)
    const info = {}, ptsC = new Float64Array(MIRA.maxPontos * 3);
    // (cada rótulo com um aperto de 1 tick e solto: o pedido curto sai como cobrança — refaz o escanteio para o próximo)
    const rotulos = [];
    for (const [b, nome] of [[BOTAO.LANCAMENTO, 'LANÇAMENTO'], [BOTAO.LANCAMENTO | BOTAO.MOD, 'E+LANÇAMENTO'], [BOTAO.CHUTE, 'CHUTE'], [BOTAO.PASSE, 'PASSE']]) {
      const q = copia(1003); q.humanos = [0];
      escanteio(q);
      P.passoPartida(q, { x: 0, z: 0, botoes: b });
      rotulos.push(`${nome} ${M.preverMira(q, ptsC, info)?.rotulo}`);
    }
    // tiro livre direto: CHUTE = CHUTE
    const qf = copia(1003); qf.humanos = [0];
    tiroLivre(qf, 0, 21, 0); ateMontarPronta(qf, 'tiroLivre');
    P.passoPartida(qf, { x: 0, z: 0, botoes: BOTAO.CHUTE });
    rotulos.push(`falta CHUTE ${M.preverMira(qf, ptsC, info)?.rotulo}`);
    // a linha some no chute
    for (let i = 0; i < 30; i++) P.passoPartida(qf, { x: 0, z: 0, botoes: BOTAO.CHUTE });
    const antesChute = !!M.preverMira(qf, ptsC, info);
    P.passoPartida(qf, NADA);
    const depoisChute = !!M.preverMira(qf, ptsC, info);
    // tiro de meta: sem efeito; PASSE na direção da mira (girada para a esquerda)
    const qm = copia(1004); qm.humanos = [0];
    bolaFora(qm, -qm.ataca[0] * (MX + 0.6), -9, 1);
    const pm = ateMontarPronta(qm, 'tiroDeMeta');
    let metaRot = null, metaEf = null, metaAng = null;
    if (pm) {
      metaRot = M.preverMira(qm, ptsC, info)?.rotulo;
      for (let i = 0; i < 4; i++) P.passoPartida(qm, { x: 0, z: 0, botoes: BOTAO.EFEITO_D });
      metaEf = pm.mira.curva;
      // o PASSE do jogo escolhe o companheiro no cone da mira: a mira apontada para um companheiro
      const gk = jog(qm, pm.cobrador);
      const alvo = qm.jogadores.filter(o => o.time === 0 && o.id !== gk.id && o.posicao !== 'GOL').sort((a, b) => Math.hypot(a.x - gk.x, a.z - gk.z) - Math.hypot(b.x - gk.x, b.z - gk.z))[0];
      pm.mira.ang = Math.atan2(alvo.z - qm.bola.p.z, alvo.x - qm.bola.p.x);
      for (let i = 0; i < 10; i++) P.passoPartida(qm, { x: 0, z: 0, botoes: BOTAO.PASSE });
      for (let i = 0; i < 40 && !qm.parada?.rolou && qm.parada; i++) P.passoPartida(qm, NADA);
      const v = qm.bola.v;
      metaAng = Math.abs(((Math.atan2(v.z, v.x) - pm.mira.ang + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    }
    reg('C1. o analógico para a direita gira a mira para a direita (0,5 s) e para no cone (1,5 s)',
      `${f2(giro)} rad em 0,5 s (MIRA.gira ${MIRA.gira}) · ${f2(noCone)} rad (cone ${pr.mira.cone})`,
      `${f2(MIRA.gira * 0.5)} ± 0,03 · = cone`, Math.abs(giro - MIRA.gira * 0.5) <= 0.03 && Math.abs(noCone - pr.mira.cone) < 1e-6);
    reg('C2. efeito: 3 apertos para a direita · segurar o da esquerda 1,2 s', `${tres} · ${segura}`, '0,75 · −1', tres === 0.75 && segura === -1);
    reg('C3. rótulo de comando pelo botão (escanteio; falta a 21 m)', rotulos.join(' · '),
      'ALTA · TENSA · TENSA · CURTA · CHUTE', rotulos.join(',') === 'LANÇAMENTO ALTA,E+LANÇAMENTO TENSA,CHUTE TENSA,PASSE CURTA,falta CHUTE CHUTE');
    reg('C4. a linha some no chute', `antes ${antesChute ? 'visível' : 'some'} · depois ${depoisChute ? 'visível' : 'some'}`, 'visível · some', antesChute && !depoisChute);
    reg('C5. tiro de meta: rótulo LONGA, o efeito não vale, o PASSE sai na direção da mira',
      `${metaRot} · efeito ${metaEf} · ${metaAng == null ? '-' : f1(metaAng * 180 / Math.PI)}° da mira`, 'LONGA · 0 · ≤ 20°',
      metaRot === 'LONGA' && metaEf === 0 && metaAng != null && metaAng <= 20 * Math.PI / 180);
  }

  // ------------------------------------------------------------------ D. o erro do cobrador continua
  {
    const quedas = [];
    for (let k = 0; k < 24; k++) {
      const m = cena(k);
      const pr = escanteio(m, m.ataca[0], 12);
      if (!pr) continue;
      carregarESoltar(m, BOTAO.LANCAMENTO, 30);
      P.passoPartida(m, NADA);
      if (m.voo?.mirada) quedas.push({ x: m.voo.alvo.x * Math.sign(m.ataca[0]), z: m.voo.alvo.z, b: m.bola.v });
    }
    // o desvio da DIREÇÃO de saída (a mesma mira e força: só o erro do cobrador muda)
    const angs = quedas.map(q => Math.atan2(q.b.z, q.b.x * Math.sign(1)));
    const mA = angs.reduce((a, b) => a + b, 0) / Math.max(1, angs.length);
    const sdA = Math.sqrt(angs.reduce((a, b) => a + (b - mA) ** 2, 0) / Math.max(1, angs.length));
    const desvio = sdA * 33; // em m a ~33 m (o escanteio na marca do pênalti)
    reg('D. a linha mostra a intenção: 24 escanteios com a mesma mira e força, a saída espalha pelo erro do cobrador',
      `${quedas.length} cobranças · desvio ${f2(desvio)} m a 33 m`, '≥ 20 · ≥ 0,3 m', quedas.length >= 20 && desvio >= 0.3);
  }
}

// ------------------------------------------------------------------ E. canhão do humano roteirizado
/** P(X ≥ k) para X ~ Binomial(n, p). */
function caudaBinomialDe(k, n, p) {
  if (k <= 0) return 1;
  const lg = x => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s; };
  let t = 0;
  for (let i = k; i <= n; i++) t += Math.exp(lg(n) - lg(i) - lg(n - i) + i * Math.log(p) + (n - i) * Math.log(1 - p));
  return Math.min(1, t);
}
const ptsE = new Float64Array((MIRA?.maxPontos ?? 200) * 3);
/** A melhor mira pela linha (mira perfeita): força e rumo para a bola descer a 2 m de altura no ponto (zx, zz). */
function miraEscanteio(m, pr, c, zx, zz) {
  let melhor = null;
  for (let f = 0.15; f <= 1.0001; f += 0.025) {
    const ang = Math.atan2(zz - pr.z, zx - pr.x);
    const r = M.chuteMirado(m, c, pr, 'alta', f, ang, 0, {});
    const n = M.simularLinha(m, r.v, r.w, ptsE);
    let subiu = false, hit = null;
    for (let i = 1; i < n; i++) {
      const y = ptsE[i * 3 + 1];
      if (y > 2.3) subiu = true;
      if (subiu && y <= 2.0 && y < ptsE[i * 3 - 2]) { hit = [ptsE[i * 3], ptsE[i * 3 + 2]]; break; }
    }
    if (!hit) continue;
    const d = Math.hypot(hit[0] - zx, hit[1] - zz);
    if (!melhor || d < melhor.d) melhor = { d, f, ang };
  }
  return melhor;
}
/** A melhor mira de falta: o canto longe da barreira, ~1,9 m de altura, com efeito para dentro. */
function miraFalta(m, pr, c) {
  const lado = m.ataca[pr.time], gx = lado * MX;
  const sz = pr.z >= 0 ? -1 : 1; // o canto longe da barreira (ela cobre o 1º pau)
  const zAlvo = sz * (CAMPO.gol.largura / 2 - 0.55), yAlvo = 1.9;
  let melhor = null;
  // onde a linha cruza a linha do gol (z, y) com o rumo `ang`
  const cruza = (f, ang, cv) => {
    const r = M.chuteMirado(m, c, pr, 'chute', f, ang, cv, {});
    const n = M.simularLinha(m, r.v, r.w, ptsE);
    let k = n - 1;
    for (let i = 1; i < n; i++) if (Math.abs(ptsE[i * 3]) >= MX - 0.05) { k = i; break; }
    return [ptsE[k * 3 + 2], ptsE[k * 3 + 1]];
  };
  for (const cv of [0, 0.5, -0.5]) {
    for (let f = 0.3; f <= 1.0001; f += 0.025) {
      // secante no rumo até a bola cruzar a linha do gol no z do canto
      let a1 = Math.atan2(zAlvo - pr.z, gx - pr.x), a2 = a1 + 0.03;
      let z1 = cruza(f, a1, cv)[0], z2 = cruza(f, a2, cv)[0];
      for (let it = 0; it < 4 && Math.abs(z2 - z1) > 1e-6; it++) {
        const a3 = a2 + (zAlvo - z2) * (a2 - a1) / (z2 - z1);
        a1 = a2; z1 = z2; a2 = a3; z2 = cruza(f, a2, cv)[0];
      }
      const [zg, yg] = cruza(f, a2, cv);
      const d = Math.hypot(zg - zAlvo, (yg - yAlvo) * 1.5);
      if (!melhor || d < melhor.d) melhor = { d, f, ang: a2, cv };
    }
  }
  return melhor;
}
{
  const NE = 96, NF = 96;
  let esc = 0, golE = 0, faltas = 0, golF = 0, alvoF = 0;
  for (let k = 0; k < NE; k++) {
    const m = cena(k);
    const la = m.ataca[0], sz = Math.floor(k / 2) % 2 ? 1 : -1;
    bolaFora(m, la * (MX + 0.6), sz * (6 + (k % 3) * 4), 1);
    const pr = ateMontarPronta(m, 'escanteio');
    if (!pr) continue;
    const c = jog(m, pr.cobrador);
    // a zona: 2º pau, marca do pênalti, 1º pau (alternando)
    const gx = la * MX, zs = [[gx - la * 6.5, -Math.sign(pr.z) * 3.2], [gx - la * 11, 0], [gx - la * 5.5, Math.sign(pr.z) * 2.2]][k % 3];
    let ent, ticks;
    if (temMira) {
      const mm = miraEscanteio(m, pr, c, zs[0], zs[1]);
      if (!mm) continue;
      pr.mira.ang = mm.ang;
      ticks = Math.max(1, Math.round(mm.f * ACOES.cargaCheia / PASSO));
      ent = { x: 0, z: 0 };
    } else {
      const dx = zs[0] - pr.x, dz = zs[1] - pr.z, d = Math.hypot(dx, dz);
      ent = { x: dx / d, z: dz / d };
      ticks = Math.round(0.65 * ACOES.cargaCheia / PASSO);
    }
    for (let i = 0; i < ticks; i++) P.passoPartida(m, { ...ent, botoes: BOTAO.LANCAMENTO });
    let t0 = null;
    for (let i = 0; i < 60 * 10; i++) {
      const e = t0 == null ? { ...ent, botoes: 0 } : P.entradaDemoPartida(m);
      // depois do chute a IA joga pelo humano (o roteiro só cobra)
      const ev = P.passoPartida(m, e);
      for (const x of ev) {
        if (x.tipo === 'cobranca' && x.parada === 'escanteio' && t0 == null) { t0 = m.tick; esc++; }
        if (t0 != null && x.tipo === 'gol' && x.time === 0 && m.tick - t0 < 8 * 60) golE++;
      }
      if (t0 != null && m.tick - t0 > 8 * 60) break;
      if (m.partida.estado === 'gol') break;
    }
  }
  const pontos = [[21, 0], [23, 4], [19, -6], [26, 2], [29, -3], [18, 8], [22, -10], [30, 0]];
  for (let k = 0; k < NF; k++) {
    const [u, w] = pontos[k % pontos.length];
    const m = tiroLivre(cena(k), 0, u, w);
    const pr = ateMontarPronta(m, 'tiroLivre');
    if (!pr || !pr.direto) continue;
    const c = jog(m, pr.cobrador);
    const lado = m.ataca[0], gx = lado * MX;
    let ent, ticks;
    if (temMira) {
      const mm = miraFalta(m, pr, c);
      pr.mira.ang = mm.ang; pr.mira.curva = mm.cv;
      ticks = Math.max(1, Math.round(mm.f * ACOES.cargaCheia / PASSO));
      ent = { x: 0, z: 0 };
    } else {
      // antes: o analógico para o canto longe da barreira e o CHUTE com 0,8 de força (a IA usa 0,7–0,9)
      const sz = pr.z >= 0 ? -1 : 1, dx = gx - pr.x, dz = sz * 3.1 - pr.z, d = Math.hypot(dx, dz);
      ent = { x: dx / d, z: dz / d };
      ticks = Math.round(0.8 * ACOES.cargaCheia / PASSO);
    }
    for (let i = 0; i < ticks; i++) P.passoPartida(m, { ...ent, botoes: BOTAO.CHUTE });
    let res = null, chute = false;
    for (let i = 0; i < 60 * 10 && !res; i++) {
      const ev = P.passoPartida(m, chute ? P.entradaDemoPartida(m) : { ...ent, botoes: 0 });
      for (const e of ev) {
        if (e.tipo === 'chute' && !chute) { chute = true; faltas++; }
        if (!chute) continue;
        if (e.tipo === 'bateuBarreira' && !res) res = 'barreira';
        if (e.tipo === 'gol') res = 'gol';
        if (e.tipo === 'defesa') res = res ?? 'defesa';
        if (e.tipo === 'fora') res = res ?? 'fora';
      }
      if (chute && m.posse != null && !res) res = 'outro';
    }
    if (res === 'gol') golF++;
    if (res === 'gol' || res === 'defesa') alvoF++;
  }
  const pE = caudaBinomialDe(golE, esc, 0.12);
  const quem = temMira ? 'mira perfeita pela linha' : 'humano de antes (analógico + botão)';
  reg(`E1. canhão de ${NE} escanteios do humano roteirizado (${quem}): gol em ≤ 8 s`,
    `${f1(pct(golE, esc))}% (${golE}/${esc}; p = ${f2(pE)} contra 12%)`, '≤ 12% (p ≥ 0,05)', esc >= NE * 0.9 && pE >= 0.05);
  reg(`E2. canhão de ${NF} tiros livres diretos de 18–30 m (${quem}): gol · no alvo`,
    `${f1(pct(golF, faltas))}% · ${f1(pct(alvoF, faltas))}% (${faltas} chutes; p = ${f2(1 - caudaBinomialDe(golF + 1, faltas, 0.02))} contra 2%, ${f2(caudaBinomialDe(golF, faltas, 0.12))} contra 12%)`,
    '2–12% (p ≥ 0,05) · —',
    // (os estados do meio da partida mudam com a IA: 96 chutes a 2% dão 0–5 gols só de sorteio — reprova quando a conta prova)
    faltas >= NF * 0.8 && 1 - caudaBinomialDe(golF + 1, faltas, 0.02) >= 0.05 && caudaBinomialDe(golF, faltas, 0.12) >= 0.05);
}

// ------------------------------------------------------------------ F. a IA não usa
if (temMira) {
  // (as sementes seguem, até 4 partidas, até ≥ 3 cobranças: quantas uma partida tem depende da IA)
  let paradas = 0, comMira = 0, mirada = 0;
  for (let sem = 77; sem < 81 && paradas < 3; sem++) {
    const m = P.criarPartida({ semente: sem });
    for (let i = 0; i < 2 * 4 * 3600 + 4000 && m.partida.estado !== 'fim'; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m));
      for (const e of ev) if (e.tipo === 'cobranca' && ['escanteio', 'tiroLivre', 'tiroDeMeta'].includes(e.parada)) paradas++;
      if (m.parada?.mira) comMira++;
      if (m.voo?.mirada) mirada++;
    }
  }
  reg('F. partida IA × IA (a demo pelo humano): nenhuma mira nem cobrança mirada', `${paradas} escanteios/faltas/tiros de meta · mira em ${comMira} ticks · mirada em ${mirada}`,
    '≥ 3 · 0 · 0', paradas >= 3 && comMira === 0 && mirada === 0);
} else reg('cobrança mirada (mira.js) existe nesta lógica', 'não existe', 'mira.js', false);
fim();
