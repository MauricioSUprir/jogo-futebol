// CONTER, DIVIDIDA e PRESSÃO do jogador do humano (Etapa 3, Parte 4; plano 2.8 e 5.1).
// Cenas 1 × 1 na partida 11×11 (criarPartida; os outros 20 parados longe do lance): o condutor é o
// time 1 num roteiro (reta, zigue-zague ou drible que contorna o marcador) e o defensor é o controlado do
// time 0 com os botões da defesa. PRESSÃO: partida IA × IA (a IA joga pelo controlado) com o botão
// segurado a cada posse do adversário.
// Metas (plano 5.1):
//  - CONTER segurado (reta e zigue-zague): a 1–2,5 m do condutor e do lado do gol em ≥ 80% do tempo;
//    o analógico de lado desloca o ponto (0,4–1,2 m para o lado pedido, sem largar o condutor);
//    de frente para o condutor (plano 2.8): com o condutor andando e parando, o tronco do defensor a
//    ≤ 45° da bola em ≥ 85% do tempo em que ele está no "jockey" (≤ 1,2 m/s; correndo atrás do condutor o
//    tronco vai com a corrida, como o "olha a bola" da IA — sim.js troncoConter);
//  - DIVIDIDA na hora certa (bola a ≤ 1 m, entre toques): ganha 35–65% (bote em pé no FC; 44–71% de acerto
//    nos titulares da Premier League 2022/23); errada (logo depois do toque do condutor): o condutor passa
//    em ≥ 70%; de longe (> 1,5 m): ganha 0%;
//  - PRESSÃO (pareado com × sem o botão, tools/lib/pressao-pareada.mjs): o pedido muda o jogo, quem foi chamado
//    aparece para a marca do desenho e, com o 1º homem da IA já apertando, o botão chama outro (as medidas do
//    efeito na partida ficam no tools/teste-pressao-humano.mjs). Quem faz o companheiro apertar é a IA tática lendo
//    o contrato m.pedidoPressao[time]: se a lógica não lê o pedido (com e sem o botão, o mesmo jogo), as linhas saem
//    "AGUARDANDO" e não reprovam (com --estrito, reprovam);
//  - sem recuo: o treino continua bit a bit igual (tools/hash-igual.mjs, à parte).
//   node tools/teste-defesa-humano.mjs                 (lógica do repositório)
//   node tools/teste-defesa-humano.mjs --antes         (a mesma partida com a IA de antes: iaClassica)
//   node tools/teste-defesa-humano.mjs --js <pasta>    (outra cópia da lógica)
//   node tools/teste-defesa-humano.mjs --sementes 24 --base 1000   (quantas cenas por tipo e a 1ª semente)
//   node tools/teste-defesa-humano.mjs --estrito       (PRESSÃO reprova mesmo sem o leitor da Parte 2)
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = args.includes('--js') ? path.resolve(arg('--js')) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const ANTES = args.includes('--antes');
const ESTRITO = args.includes('--estrito');
const NS = +arg('--sementes', 24);
const BASE = +arg('--base', 1);
const DEPURA = !!process.env.DEPURA;
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
const reg = (nome, medido, meta, ok, aguarda = false) => {
  linhas.push([nome, medido, meta, ok ? 'PASSOU' : aguarda ? 'AGUARDANDO PARTE 2' : 'REPROVOU']);
  if (!ok && !aguarda) falhas++;
};
const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : String(v));
const pc = (a, n) => (n ? `${fmt(100 * a / n, 0)}% (${a}/${n})` : '—');
function fim() {
  const larg = linhas[0].map((_, c) => Math.max(...linhas.map(l => String(l[c]).length)));
  console.log(linhas.map(l => l.map((x, c) => String(x).padEnd(larg[c])).join(' | ')).join('\n'));
  console.log(falhas ? `\nteste-defesa-humano: REPROVOU (${falhas})` : '\nteste-defesa-humano: PASSOU');
  process.exit(falhas ? 1 : 0);
}

let P, S, CFG;
try {
  P = await imp('partida.js'); S = await imp('sim.js'); CFG = await imp('config.js');
} catch (err) {
  reg('a partida 11×11 existe (criarPartida)', `não carregou: ${err.message.split('\n')[0]}`, 'criarPartida', false);
  fim();
}
const { BOTAO, PASSO, CAMPO } = CFG;
console.log(`lógica: ${JS}${ANTES ? ' (--antes: iaClassica)' : ''} · ${NS} cenas por tipo a partir da semente ${BASE}`);

// gerador do próprio teste (sorteia as cenas; o jogo usa o m.rng dele)
function rngTeste(s) {
  let a = (s * 2654435761) >>> 0 || 1;
  return () => { a ^= a << 13; a >>>= 0; a ^= a >>> 17; a ^= a << 5; a >>>= 0; return a / 4294967296; };
}

/**
 * Cena 1 × 1: partida criada, todos parados longe do lance menos o condutor (time 1, atacando −x) e o
 * defensor (time 0). Os dois são "humanos" (o teste dá a entrada de cada um).
 */
function cena(sem, c) {
  const m = P.criarPartida({ semente: sem, iaClassica: ANTES });
  m.parada = null;
  const t1 = m.jogadores.filter(j => j.time === 1 && j.posicao !== 'GOL');
  const t0 = m.jogadores.filter(j => j.time === 0 && j.posicao !== 'GOL');
  const cond = t1.find(j => j.posicao === c.posCond) ?? t1[t1.length - 1];
  const def = t0.find(j => j.posicao === c.posDef) ?? t0[0];
  let k = 0;
  for (const j of m.jogadores) {
    if (j === cond || j === def) continue;
    j.papel = 'parado';
    // longe do lance: na linha lateral do outro lado do campo (o lance vai de x = 0 para −x)
    P.teleportar(j, 40 - (k % 11) * 2.2, (j.time === 0 ? -1 : 1) * 33.5, 0);
    k++;
  }
  P.teleportar(cond, c.x0, c.z0, Math.PI);
  P.teleportar(def, c.x0 - c.dist, c.z0 + c.lado, 0);
  Object.assign(m.bola, { p: { x: c.x0 - 0.4, y: 0.11, z: c.z0 }, v: { x: 0, y: 0, z: 0 }, w: { x: 0, y: 0, z: 0 }, rolando: true });
  m.posse = cond.id; m.naMao = null; m.voo = null;
  m.humanos = [0, 1]; m.controlado = { 0: def.id, 1: cond.id };
  return { m, cond, def };
}

/** Entrada do condutor: reta, zigue-zague ou drible (vai para o gol e contorna o marcador à frente). */
function entradaCondutor(m, cond, def, c, t) {
  let a = Math.PI; // ataca −x
  if (c.modo === 'zigue') a += c.amp * (Math.sin(2 * Math.PI * t / c.periodo) >= 0 ? 1 : -1);
  else if (c.modo === 'para') {
    // anda e para (o "jockey": o defensor fica de frente esperando o condutor decidir)
    const anda = Math.floor(t / c.periodo) % 2 === 0;
    return { x: anda ? Math.cos(a) * c.mag * 0.6 : 0, z: 0, botoes: 0 };
  }
  else if (c.modo === 'drible') {
    const dx = def.x - cond.x, dz = def.z - cond.z, d = Math.hypot(dx, dz);
    if (d < 3.2 && dx < 0.5) {
      // marcador à frente: sai para o lado contrário ao dele (o lado sorteado se ele estiver no meio)
      const lado = Math.abs(dz) < 0.3 ? c.ladoDrible : (dz > 0 ? -1 : 1);
      a += lado * 0.85;
    }
  }
  return { x: Math.cos(a) * c.mag, z: Math.sin(a) * c.mag, botoes: c.correr ? BOTAO.CORRER : 0 };
}

const ehFora = b => Math.abs(b.p.x) > CAMPO.meioX - 1 || Math.abs(b.p.z) > CAMPO.meioZ - 1;
/** Do lado do gol: o defensor a até 60° da linha condutor → gol do defensor (x = −52,5). */
function ladoDoGol(cond, def) {
  const gx = -CAMPO.meioX - cond.x, gz = -cond.z, g = Math.hypot(gx, gz) || 1;
  const dx = def.x - cond.x, dz = def.z - cond.z, d = Math.hypot(dx, dz) || 1;
  return (dx * gx + dz * gz) / (g * d) >= 0.5;
}

// ------------------------------------------------------------------------------------- CONTER
const conter = { reta: [0, 0], zigue: [0, 0] };
const conterCenas = { reta: [], zigue: [] };
for (const modo of ['reta', 'zigue']) {
  for (let s = 0; s < NS; s++) {
    const sem = BASE + s + (modo === 'zigue' ? 5000 : 0);
    const r = rngTeste(sem);
    const c = {
      modo, x0: 4 + r() * 6, z0: -8 + r() * 16, dist: 2.5 + r() * 2, lado: -1 + r() * 2,
      mag: 0.65 + r() * 0.35, correr: r() < 0.35, amp: 0.45 + r() * 0.35, periodo: 1.2 + r() * 0.8,
      posCond: r() < 0.5 ? 'ATA' : 'PON', posDef: r() < 0.5 ? 'ZAG' : 'LAT',
    };
    const { m, cond, def } = cena(sem, c);
    let ok = 0, n = 0;
    const N = Math.round(5 / PASSO);
    for (let i = 0; i < N; i++) {
      const t = i * PASSO;
      S.passo(m, { 0: { x: 0, z: 0, botoes: BOTAO.CONTER }, 1: entradaCondutor(m, cond, def, c, t) });
      if (m.posse !== cond.id || ehFora(m.bola)) break;
      if (t < 0.8) continue; // assentar
      const d = Math.hypot(def.x - cond.x, def.z - cond.z);
      n++;
      if (d >= 1 && d <= 2.5 && ladoDoGol(cond, def)) ok++;
    }
    conter[modo][0] += ok; conter[modo][1] += n;
    conterCenas[modo].push(n ? ok / n : NaN);
    if (DEPURA) console.log(`CONTER ${modo} ${sem}: ${pc(ok, n)} ${c.correr ? 'correndo' : ''} mag ${fmt(c.mag)}`);
  }
}
for (const modo of ['reta', 'zigue']) {
  const [a, n] = conter[modo];
  const piores = conterCenas[modo].filter(Number.isFinite).sort((x, y) => x - y);
  reg(`CONTER ao lado do condutor (${modo === 'reta' ? 'reta' : 'zigue-zague'}): a 1–2,5 m e do lado do gol`,
    `${pc(a, n)} do tempo (pior cena ${fmt(100 * (piores[0] ?? NaN), 0)}%)`, '≥ 80%', n > 0 && a / n >= 0.8);
}
// de frente para o condutor no "jockey" (o condutor anda e para; o tronco do defensor a ≤ 45° da bola)
{
  let frente = 0, n = 0, soma = 0;
  for (let s = 0; s < NS; s++) {
    const sem = BASE + s + 7000;
    const r = rngTeste(sem);
    const c = {
      modo: 'para', x0: 4 + r() * 6, z0: -8 + r() * 16, dist: 2.5 + r() * 2, lado: -1 + r() * 2,
      mag: 0.65 + r() * 0.35, correr: false, periodo: 1.2 + r() * 0.8, posCond: r() < 0.5 ? 'ATA' : 'PON', posDef: r() < 0.5 ? 'ZAG' : 'LAT',
    };
    const { m, cond, def } = cena(sem, c);
    for (let i = 0; i < Math.round(5 / PASSO); i++) {
      const t = i * PASSO;
      S.passo(m, { 0: { x: 0, z: 0, botoes: BOTAO.CONTER }, 1: entradaCondutor(m, cond, def, c, t) });
      if (m.posse !== cond.id || ehFora(m.bola)) break;
      if (t < 0.8 || Math.hypot(def.vx, def.vz) > 1.2) continue;
      let d = Math.abs(Math.atan2(m.bola.p.z - def.z, m.bola.p.x - def.x) - def.rumo) % (2 * Math.PI);
      if (d > Math.PI) d = 2 * Math.PI - d;
      n++; soma += d;
      if (d <= Math.PI / 4) frente++;
    }
  }
  reg('CONTER de frente para o condutor (jockey, defensor a ≤ 1,2 m/s): tronco a ≤ 45° da bola',
    `${pc(frente, n)} do tempo (ângulo médio ${fmt(n ? soma / n * 180 / Math.PI : NaN, 0)}°)`, '≥ 85%', n >= 200 && frente / n >= 0.85);
}
// o analógico de lado mostra o lado ao condutor (desloca o ponto)
{
  const desl = [];
  for (let s = 0; s < Math.min(NS, 12); s++) {
    const sem = BASE + s + 9000;
    const lados = [];
    for (const lado of [-1, 1]) {
      const c = { modo: 'reta', x0: 6, z0: 0, dist: 2.5, lado: 0, mag: 0.6, correr: false, posCond: 'ATA', posDef: 'ZAG' };
      const { m, cond, def } = cena(sem, c);
      let soma = 0, n = 0;
      for (let i = 0; i < Math.round(3 / PASSO); i++) {
        S.passo(m, { 0: { x: 0, z: lado, botoes: BOTAO.CONTER }, 1: entradaCondutor(m, cond, def, c, i * PASSO) });
        if (m.posse !== cond.id) break;
        if (i * PASSO > 1.5) { soma += def.z - cond.z; n++; }
      }
      lados.push(n ? soma / n : NaN);
    }
    desl.push((lados[1] - lados[0]) / 2);
  }
  const med = desl.filter(Number.isFinite).sort((a, b) => a - b);
  const md = med.length ? med[Math.floor(med.length / 2)] : NaN;
  reg('CONTER: o analógico de lado desloca o ponto (mostra o lado)', `${fmt(md)} m para o lado pedido (mediana)`, '0,4–1,2 m', md >= 0.4 && md <= 1.2);
}

// ----------------------------------------------------------------------------------- DIVIDIDA
const T_BOTE = Math.round((CFG.DEFESA_HUMANO?.dividida?.tempo ?? 0.15) / PASSO);
const SEM_TOQUE = Math.round((CFG.DEFESA_HUMANO?.dividida?.semToque ?? 0.15) / PASSO);
/**
 * tipo: 'certa' (bola a ≤ 1 m do defensor, contato entre dois toques do condutor; o defensor contém e
 * depois chega trotando na bola), 'errada' (o contato cai
 * logo depois de um toque do condutor), 'longe' (bola a 1,6–3 m). Devolve {apertou, ganhou, passou}.
 */
function cenaDividida(sem, tipo) {
  const r = rngTeste(sem);
  const c = {
    modo: 'drible', x0: 6 + r() * 6, z0: -6 + r() * 12, dist: tipo === 'longe' ? 6 + r() * 2 : 2.5 + r() * 1.5, lado: -0.8 + r() * 1.6,
    mag: 0.55 + r() * 0.3, correr: false, ladoDrible: r() < 0.5 ? -1 : 1,
    posCond: r() < 0.5 ? 'ATA' : 'PON', posDef: r() < 0.5 ? 'ZAG' : 'LAT',
  };
  const { m, cond, def } = cena(sem, c);
  let aperto = -1, ganhou = false, motivo = null;
  const N = Math.round(6 / PASSO);
  for (let i = 0; i < N; i++) {
    const t = i * PASSO;
    // o defensor contém por 0,6 s e depois chega na bola (trotando) para dar o bote; de longe, espera
    let bot = tipo === 'longe' ? 0 : BOTAO.CONTER, ex = 0, ez = 0;
    if (tipo !== 'longe' && aperto < 0 && t > 0.6) {
      const dx = m.bola.p.x - def.x, dz = m.bola.p.z - def.z, d = Math.hypot(dx, dz) || 1;
      bot = 0; ex = dx / d * 0.5; ez = dz / d * 0.5;
    }
    if (aperto < 0 && t > 0.6) {
      const b = m.bola.p, dB = Math.hypot(b.x - def.x, b.z - def.z);
      const ult = cond.cond.ult, prox = cond.cond.toque;
      const contato = m.tick + T_BOTE;
      if (tipo === 'certa' && dB <= 1.0 && ult && prox && prox.tipo === 'conducao'
        && contato - ult.tick >= SEM_TOQUE + 2 && prox.tick > contato) aperto = m.tick;
      else if (tipo === 'errada' && dB <= 1.0 && prox && prox.tipo === 'conducao' && contato >= prox.tick && contato <= prox.tick + 2) aperto = m.tick;
      else if (tipo === 'longe' && dB >= 1.6 && dB <= 3) aperto = m.tick;
    }
    if (aperto >= 0 && m.tick - aperto < 3) bot = (bot & ~BOTAO.CONTER) | BOTAO.DIVIDIDA;
    else if (aperto >= 0) bot = BOTAO.CONTER; // depois do bote volta a conter
    const ev = (S.passo(m, { 0: { x: ex, z: ez, botoes: bot }, 1: entradaCondutor(m, cond, def, c, t) }), m.eventos);
    for (const e of ev) if (e.tipo === 'dividida' && e.id === def.id) { ganhou = e.ganhou; motivo = e.motivo; }
    for (const e of ev) if (e.tipo === 'roubada' && e.id === def.id) ganhou = true;
    if (aperto < 0 && (m.posse !== cond.id || ehFora(m.bola))) return { apertou: false };
    if (aperto >= 0 && m.tick - aperto >= Math.round(1.2 / PASSO)) break;
  }
  if (aperto < 0) return { apertou: false };
  // passou: 1,2 s depois do aperto o condutor segue com a bola e está além do defensor (mais perto do gol dele)
  const passou = m.posse === cond.id && cond.x < def.x - 0.5;
  if (DEPURA) console.log(`DIVIDIDA ${tipo} ${sem}: ganhou ${ganhou} (${motivo}) passou ${passou}`);
  return { apertou: true, ganhou, passou, motivo };
}
const div = { certa: [0, 0, 0], errada: [0, 0, 0], longe: [0, 0, 0] }; // [ganhou, passou, n]
for (const tipo of ['certa', 'errada', 'longe']) {
  let tentativas = 0;
  for (let s = 0; div[tipo][2] < NS * 3 && tentativas < NS * 24; s++, tentativas++) {
    const r = cenaDividida(BASE + 20000 + s + (tipo === 'errada' ? 7000 : tipo === 'longe' ? 14000 : 0), tipo);
    if (!r.apertou) continue;
    div[tipo][2]++;
    if (r.ganhou) div[tipo][0]++;
    if (r.passou) div[tipo][1]++;
  }
}
{
  const [g, , n] = div.certa;
  reg('DIVIDIDA na hora certa (bola a ≤ 1 m, entre toques): ganha', pc(g, n), '35–65%', n >= NS && g / n >= 0.35 && g / n <= 0.65);
  const [, p, n2] = div.errada;
  reg('DIVIDIDA errada (logo depois do toque): o condutor passa', pc(p, n2), '≥ 70%', n2 >= NS && p / n2 >= 0.7);
  const [g3, , n3] = div.longe;
  reg('DIVIDIDA de longe (bola a > 1,5 m): ganha', pc(g3, n3), '0%', n3 >= NS && g3 === 0);
}

// ------------------------------------------------------------------------------------ PRESSÃO
// (pedido do dono, 11/10: "o botão de pressão não funciona") A meta antiga — "um companheiro a ≤ 2 m do condutor em ≤ 2 s
// em ≥ 80%" — passava SEM o botão (79%): não media o botão. Agora a medida é PAREADA (tools/lib/pressao-pareada.mjs: a
// cada posse do adversário o mundo é copiado e roda com e sem o botão, do mesmo hash); aqui, a parte que não depende de
// amostra grande — o pedido muda o jogo, quem foi chamado aparece para o desenho e o botão SOMA um jogador à pressão da
// IA (o perceptível — distâncias com × sem, faltas, corrida — fica no tools/teste-pressao-humano.mjs, 8 partidas).
{
  const { medirPressaoPareada } = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'lib/pressao-pareada.mjs')).href);
  const { casos } = await medirPressaoPareada(JS, { sementes: [BASE + 30001, BASE + 30002], min: 2, T: 2, alcance: 15, modelos: ['persegue', 'parado'] });
  const muda = casos.filter(c => c.A.d.some((x, i) => Number.isFinite(x) && Number.isFinite(c.B.d[i]) && Math.abs(x - c.B.d[i]) > 1e-9)).length;
  const mo = casos.reduce((s, c) => s + c.B.marcaOk, 0), mt = casos.reduce((s, c) => s + c.B.marcaTot, 0);
  const pd = casos.reduce((s, c) => s + c.B.p1Dobra, 0), pt = casos.reduce((s, c) => s + c.B.p1Tot, 0);
  const aguarda = muda === 0 && !ESTRITO && !ANTES;
  reg('PRESSÃO: com o botão o jogo muda (pareado, do mesmo hash)', `${muda}/${casos.length} casos`, '> 0', muda > 0, aguarda);
  reg('PRESSÃO: quem foi chamado aparece para o desenho (marca) com o pedido valendo', pc(mo, mt), '100%', mt > 0 && mo === mt, aguarda);
  reg('PRESSÃO: com o 1º homem da IA já apertando, o botão chama OUTRO', pt ? pc(pd, pt) : '—', '≥ 95%', pt > 0 && pd >= 0.95 * pt, aguarda);
}

fim();
