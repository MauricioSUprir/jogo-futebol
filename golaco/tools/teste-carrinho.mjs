// teste-carrinho (item 34 da FILA; pedido do dono de 17/10: "botão de CARRINHO — dividida deslizando; falta/cartão pela
// Regra 12"): o corpo de quem desliza é um PLANO puro montado no aperto e um QUADRO puro do tempo (carrinho.js), lido pela
// simulação, pela pose e pelas cenas; o contato vale pela perna DESENHADA; a falta, pela Regra 12. Contrato: CONTRATOS.md
// "Carrinho (item 34)"; constantes: config.js DEFESA_HUMANO.carrinho.
//
// Na base (sem js/carrinho.js) REPROVA: "o carrinho existe — não existe nesta lógica" (como o teste-faltas com o faltas.js).
// Este é o commit 1 da entrega (o plano e o quadro): as partes A e P medem o carrinho.js puro, sem a simulação. As metas
// que dependem da pose (anim.js poseCarrinho: P1 pele, P2, P3, P4 cabeça, P5 pela pose) e as partes B–G (contato, canhão,
// regras, travas, determinismo, cenas) entram nos commits seguintes — listadas no fim como PENDENTE, sem reprovar.
//
// Metas (as exatas reprovam em qualquer caso; "·" = informativa, não reprova):
//  0. estrutura: o campo `carrinho` declarado no jogador (forma única; undefined sem o botão); as constantes; os raios das
//     pernas = os maiores do SEGMENTOS do anim.js; joelho2Ossos = anim.js ik bit a bit; carrinhoAtivo / tempoCarrinho /
//     congela; bolaAlta; o plano é objeto simples (structuredClone dá o mesmo quadro) e montado igual duas vezes.
//  A. física do corpo (entradas sintéticas: parado, 3, 4,75, 6 e 7 m/s alinhadas e os desvios máximos 2 m/s a 90°, 4 a
//     67,5°, 6 a 45° e 8,4 a 34,8°, dos dois lados; 120 estados de uma partida de verdade — a passada, o quadril e os pés
//     como estavam — cada um com o analógico numa direção qualquer e para trás do corpo; e 4 estados de partida gravados, os
//     que levavam o joelho dobrado ao chão sem a guarda carrinho.js joelhoFora):
//     A1 a 4,75 m/s o deslize (aperto → parada) dura 0,95–1,15 s (a ÚNICA régua medida: "~1 s", van den Eijnde 2017); o
//        quadril até parar é consistência do modelo (§3.2 da pesquisa, derivado): informativo;
//     A2 sem teletransporte: o quadro de t = 0 é o corpo no aperto; o centro anda ≤ (v + 0,2)·PASSO por tick; a velocidade
//        muda ≤ 13 m/s²·PASSO por tick fora do impacto e ≤ 23 no impacto (giro + perda); o rumo ≤ 20°/quadro;
//     A3 resposta (regra do projeto: ≤ 0,1 s): a pelve desce no 1º passo e está ≥ 0,05 m abaixo de h0 em 0,1 s, em todas as
//        entradas (h0 ≥ 0,77 m), inclusive no desvio máximo;
//     A4 pés (a régua do teste-patinacao/teste-mergulho): plantado ≤ 0,05 m/s; no ar ≤ 2,5·v + 3 m/s (v do corpo, até
//        6; na transição até tD, v ≥ a velocidade da entrada ve — o corpo que inverte passa por v ≈ 0 enquanto as pernas
//        vão ao deslize); nenhum pé apoiado durante o deslize;
//     A5 da parada até de pé: errou 1,2 s ± 1 tick; ganhou (marcarAcerto antes da parada) 0,5 s ± 1 tick; o toque depois da
//        parada não muda nada (o raspão = errou); no fim os dois pés plantados, v = 0, pelve 0,92 ± 0,02;
//     A6 continuidade: a pelve salta ≤ 0,05 m (além do que o centro anda) entre a pose normal no aperto e o 1º quadro, e
//        entre o último quadro e a pose normal de pé com os pés onde o quadro os plantou;
//     A7 atributo: com desarme 90 o deslize vai mais longe que com 40, na mesma entrada (GOALS 0.42.0);
//     A8 tq ≤ tAr + tImpacto em todas as entradas (0–9,4 m/s × 0–180°) e o desvio pedido além do limite fica no limite
//        (desvioMax); a aceleração da queda ≤ 13 m/s²;
//     A9 ajuda de mira pelo encontro: condutor a 5 m/s cruzando a frente do carrinho a 2, 4 e 5,5 m (entradas a 4,75, 6 e
//        7 m/s), o analógico 15° à frente da direção do encontro: a ponta passa a ≤ 0,3 m da bola NO MESMO instante (um
//        horizonte fixo puxa a mira para trás da bola: 0/6; a mira pelo instante da MENOR distância parava a 0,34 m: 2/6).
//  P. o corpo nos quadros de A (o que não depende da pose): os dois ossos de cada perna com o comprimento exato e o
//     tornozelo ao alcance (o esqueleto do corpo novo só aceita 0,9–1,1 por osso); o fundo das cápsulas das pernas, da pelve
//     e dos quadris ≥ −1 cm (P1); o joelho dobrado ≥ 0,06 m e a pelve 0,14–0,20 m no deslize (P1); o tronco 40–60° para
//     trás no deslize (P4); o quadro não escreve no plano (P5).
//   node tools/teste-carrinho.mjs              (lógica do repositório)
//   node tools/teste-carrinho.mjs --js <pasta> (outra cópia da lógica; a da main antes do carrinho → REPROVA)
//   node tools/teste-carrinho.mjs --detalhe    (a tabela por entrada e cada caso do A9)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const JS = path.resolve(arg('--js', path.join(AQUI, '../js')));
const DETALHE = args.includes('--detalhe');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);

const linhas = [];
let falhas = 0;
const reg = (nome, medido, meta, ok) => { linhas.push([ok ? '✓' : '✗', nome, String(medido), meta]); if (!ok) falhas++; };
const info = (nome, medido, ref) => linhas.push(['·', nome, String(medido), ref]);
function fim() {
  const larg = [1, 2, 3].map(c => Math.min(70, Math.max(...linhas.map(l => String(l[c]).length))));
  console.log(linhas.map(l => `${l[0]} ${String(l[1]).padEnd(larg[0])} | ${String(l[2]).padEnd(larg[1])} | ${l[3]}`).join('\n'));
  console.log(falhas ? `\nteste-carrinho: REPROVOU (${falhas})` : '\nteste-carrinho: PASSOU');
  process.exit(falhas ? 1 : 0);
}
if (!fs.existsSync(path.join(JS, 'carrinho.js'))) {
  reg('o carrinho existe (carrinho.js)', 'não existe nesta lógica', 'carrinho.js', false);
  fim();
}

const K = await imp('carrinho.js');
const CFG = await imp('config.js');
const P = await imp('partida.js');
const A = await imp('anim.js');
const JG = await imp('jogador.js');
const CC = CFG.DEFESA_HUMANO.carrinho;
const PASSO = CFG.PASSO;
const T_AR = CC.tAr, T_D = CC.tAr + CC.tImpacto;
const L1 = CFG.JOGADOR.coxa, L2 = CFG.JOGADOR.canela, LMAX = (L1 + L2) * 0.998;
const GRAU = Math.PI / 180;
const f2 = x => (Number.isFinite(x) ? x.toFixed(2) : String(x));
const f3 = x => (Number.isFinite(x) ? x.toFixed(3) : String(x));
const dist3 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const angDif = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d <= -Math.PI) d += 2 * Math.PI; else if (d > Math.PI) d -= 2 * Math.PI; return d; };

// o mundo da pose (a pose normal lê o mundo: posse, parada, bola) — uma partida de verdade no meio do jogo
const m = P.criarPartida({ semente: 3001, minutosPorTempo: 4 });
for (let i = 0; i < 600; i++) P.passoPartida(m, P.entradaDemoPartida(m));

// ------------------------------------------------------------------ 0. estrutura
{
  const j = JG.criarJogador(1, 0, 0, 0, {}, 0);
  reg('0 campo `carrinho` declarado no jogador (forma única)', 'carrinho' in j ? `undefined: ${j.carrinho === undefined}` : 'ausente',
    'declarado, undefined', 'carrinho' in j && j.carrinho === undefined);
  reg('0 constantes (DEFESA_HUMANO.carrinho)', CC ? 'existem' : 'ausentes', 'config.js', !!CC);
  const S = A.SEGMENTOS, J = A.J;
  const raio = (a, b) => { const s = S.find(x => x[0] === a && x[1] === b); return Math.max(s[2], s[3]); };
  const esperados = [raio(J.quadrilE, J.joelhoE), raio(J.joelhoE, J.tornozeloE), raio(J.tornozeloE, J.pontaE)];
  const iguais = K.RAIOS_PERNA.every((r, i) => r === esperados[i]) && esperados.every((r, i) => r === raio([J.quadrilD, J.joelhoD, J.tornozeloD][i], [J.joelhoD, J.tornozeloD, J.pontaD][i]));
  reg('0 raios das pernas = os do SEGMENTOS (anim.js)', K.RAIOS_PERNA.join(' / '), esperados.join(' / '), iguais);
  // joelho2Ossos = anim.js ik, bit a bit
  let dif = 0, n = 0, s = 12345;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out = new Float32Array(A.NJ * 3), jo = {}, to = {};
  for (let i = 0; i < 2000; i++) {
    const v = Array.from({ length: 9 }, () => rnd() * 2 - 1);
    v[1] = 0.2 + rnd() * 0.8; v[4] = rnd() * 0.3;
    A.ik(...v, out, A.J.joelhoE, A.J.tornozeloE);
    K.joelho2Ossos(...v, jo, to);
    // (o anim.js grava num Float32Array: a cópia em Float32 tem de dar o mesmo)
    const f = Math.fround;
    if (f(jo.x) !== out[A.J.joelhoE * 3] || f(jo.y) !== out[A.J.joelhoE * 3 + 1] || f(jo.z) !== out[A.J.joelhoE * 3 + 2]
      || f(to.x) !== out[A.J.tornozeloE * 3] || f(to.y) !== out[A.J.tornozeloE * 3 + 1] || f(to.z) !== out[A.J.tornozeloE * 3 + 2]) dif++;
    n++;
  }
  reg('0 joelho2Ossos = anim.js ik (bit a bit)', `${dif} de ${n} diferentes`, '0', dif === 0);
  // bolaAlta
  const mb = p => ({ bola: { p: { x: 0, y: p.y, z: 0 }, v: { x: 0, y: p.vy, z: 0 }, rolando: p.rol } });
  const casos = [[{ y: 0.11, vy: 0, rol: true }, false], [{ y: 1.0, vy: -2, rol: false }, true], [{ y: 0.3, vy: -2, rol: false }, false],
    [{ y: 0.3, vy: 1, rol: false }, true], [{ y: 0.59, vy: -0.1, rol: false }, false], [{ y: 0.61, vy: -0.1, rol: false }, true]];
  const errBA = casos.filter(([p, e]) => K.bolaAlta(mb(p)) !== e).length;
  reg('0 bolaAlta (no ar acima de 0,6 m ou subindo)', `${casos.length - errBA}/${casos.length} certos`, 'todos', errBA === 0);
}

// ------------------------------------------------------------------ jogadores sintéticos e a amostra dos quadros
let idSint = 900;
/** Um jogador de pé (os pés plantados ao lado) com a velocidade e o analógico pedidos; a pelve (j.quadril) é a da conta do
 * jogo (anim.js alturaQuadril: correndo a 7 m/s ela fica ~6 cm abaixo da parada), ou h0 se dada. */
function jogadorSint({ v = 0, angV = 0.3, rumo = angV, analog = null, desarme = 65, h0 = null, x = 10, z = 5 }) {
  const j = JG.criarJogador(idSint++, x, z, rumo, { desarme }, 0);
  j.posicao = 'ZAG';
  j.vx = v * Math.cos(angV); j.vz = v * Math.sin(angV);
  j.quadril = h0 ?? A.alturaQuadril(j, m);
  if (analog != null) { j.imag = 1; j.ix = Math.cos(analog); j.iz = Math.sin(analog); } else j.imag = 0;
  return j;
}
/** Os quadros de todos os ticks do plano (do aperto ao fim). */
function quadros(c) {
  const n = c.fim - c.tick0, qs = [];
  for (let i = 0; i <= n; i++) qs.push(K.quadroCarrinho(c, i * PASSO, K.novoQuadroCarrinho()));
  return qs;
}
const pelvePose = (j) => { const o = A.pose(j, m); return { x: o[0], y: o[1], z: o[2] }; };

// acumuladores das metas por quadro (A2, A3, A4, A6, P) — sobre todas as entradas
const R = {
  casos: 0, a2t0: 0, a2pos: 0, a2vel: 0, a2velImp: 0, a2yaw: 0, a2piorPos: 0, a2piorVel: 0, a2piorVelImp: 0, a2piorYaw: 0,
  a3: 0, a3n: 0, a3pior: Infinity, a3baixos: 0,
  a4plant: 0, a4ar: 0, a4deslize: 0, a4piorPlant: 0, a4piorArRazao: 0, a4maxPe: 0,
  a6ini: 0, a6fim: 0, a6piorIni: 0, a6piorFim: 0,
  ossos: 0, ossoPior: 0, alcance: 0, fundo: 0, fundoPior: Infinity, joelho: 0, joelhoPior: Infinity, pelve: 0, pelveFaixa: [Infinity, -Infinity],
  tronco: 0, troncoFaixa: [Infinity, -Infinity], p5: 0, nan: 0,
};
const S = A.SEGMENTOS, JJ = A.J;
const segR = (a, b) => { const s = S.find(x => x[0] === a && x[1] === b); return [s[2], s[3]]; };
const R_COXA = segR(JJ.quadrilE, JJ.joelhoE), R_CANELA = segR(JJ.joelhoE, JJ.tornozeloE), R_PE = segR(JJ.tornozeloE, JJ.pontaE);
const R_PELVE = segR(JJ.pelve, JJ.lombar)[0], R_QUADRIS = segR(JJ.quadrilE, JJ.quadrilD)[0];

/** Mede o plano c do jogador j (pel0: a pelve da pose normal no aperto) em todas as metas por quadro. */
function medir(j, c, pel0) {
  R.casos++;
  const antes = JSON.stringify(c);
  const qs = quadros(c);
  const q0 = qs[0];
  // A2: o quadro de t = 0 é o corpo no aperto
  if (Math.hypot(q0.x - j.x, q0.z - j.z) > 1e-9 || Math.hypot(q0.vx - j.vx, q0.vz - j.vz) > 1e-9 || Math.abs(angDif(j.rumo, q0.yaw)) > 1e-9
    || Math.abs(q0.h - (j.quadril ?? CC.hPe)) > 1e-9) R.a2t0++;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    for (const k of ['x', 'z', 'vx', 'vz', 'yaw', 'h']) if (!Number.isFinite(q[k])) R.nan++;
    for (let p = 0; p < 2; p++) for (const jt of [q.qd[p], q.jo[p], q.to[p], q.po[p]]) if (!Number.isFinite(jt.x + jt.y + jt.z)) R.nan++;
    // P: os ossos, o alcance, o fundo das cápsulas
    for (let p = 0; p < 2; p++) {
      const e1 = Math.abs(dist3(q.qd[p], q.jo[p]) - L1), e2 = Math.abs(dist3(q.jo[p], q.to[p]) - L2);
      R.ossoPior = Math.max(R.ossoPior, e1, e2);
      if (e1 > 1e-7 || e2 > 1e-7) R.ossos++;
      if (dist3(q.qd[p], q.to[p]) > LMAX + 1e-9) R.alcance++;
      const fundo = Math.min(q.qd[p].y - R_COXA[0], q.jo[p].y - R_COXA[1], q.jo[p].y - R_CANELA[0], q.to[p].y - R_CANELA[1],
        q.to[p].y - R_PE[0], q.po[p].y - R_PE[1], q.qd[p].y - R_QUADRIS);
      R.fundoPior = Math.min(R.fundoPior, fundo);
      if (fundo < -0.01 - 1e-9) R.fundo++;
    }
    const fp = q.h - R_PELVE;
    R.fundoPior = Math.min(R.fundoPior, fp);
    if (fp < -0.01 - 1e-9) R.fundo++;
    if (q.fase === 2 || q.fase === 3) {
      const jd = q.jo[1 - c.frente].y;
      R.joelhoPior = Math.min(R.joelhoPior, jd);
      if (jd < 0.06) R.joelho++;
    }
    if (q.fase === 2) {
      R.pelveFaixa[0] = Math.min(R.pelveFaixa[0], q.h); R.pelveFaixa[1] = Math.max(R.pelveFaixa[1], q.h);
      if (q.h < 0.14 || q.h > 0.2) R.pelve++;
      const tr = q.incl / GRAU;
      R.troncoFaixa[0] = Math.min(R.troncoFaixa[0], tr); R.troncoFaixa[1] = Math.max(R.troncoFaixa[1], tr);
      if (tr < 40 || tr > 60) R.tronco++;
    }
    // A4: nenhum pé apoiado no deslize (da queda à parada)
    if (q.t > 0 && q.t <= c.tS && (q.apoio0 || q.apoio1)) R.a4deslize++;
    if (i === 0) continue;
    const a = qs[i - 1];
    // A2: centro, velocidade, rumo
    const va = Math.hypot(a.vx, a.vz), vb = Math.hypot(q.vx, q.vz), vmax = Math.max(va, vb);
    const dP = Math.hypot(q.x - a.x, q.z - a.z);
    R.a2piorPos = Math.max(R.a2piorPos, dP / PASSO - vmax);
    if (dP > (vmax + 0.2) * PASSO + 1e-12) R.a2pos++;
    const dV = Math.hypot(q.vx - a.vx, q.vz - a.vz) / PASSO;
    const impacto = q.t > T_AR && a.t < T_D;
    if (impacto) { R.a2piorVelImp = Math.max(R.a2piorVelImp, dV); if (dV > 23 + 1e-9) R.a2velImp++; }
    else { R.a2piorVel = Math.max(R.a2piorVel, dV); if (dV > 13 + 1e-9) R.a2vel++; }
    const dy = Math.abs(angDif(a.yaw, q.yaw)) / GRAU;
    R.a2piorYaw = Math.max(R.a2piorYaw, dy);
    if (dy > 20 + 1e-9) R.a2yaw++;
    // A4: os tornozelos. Na transição (até tD) o v da régua é o maior entre o do corpo e o da entrada (ve): o corpo lento
    // que desliza para trás (a direção é livre abaixo de 2 m/s) passa por v ≈ 0 ao inverter enquanto as pernas vão ao
    // deslize (a spec, A.5.4: o desenho da perna pode ir a ~9–10 m/s nessa transição; com o v do corpo, 2 de 120 estados da
    // partida passavam de 2,5·v + 3 com o pé a ~8 m/s)
    const lim = 2.5 * Math.min(6, q.t <= T_D ? Math.max(vmax, c.ve) : vmax) + 3;
    for (let p = 0; p < 2; p++) {
      const vp = dist3(q.to[p], a.to[p]) / PASSO;
      R.a4maxPe = Math.max(R.a4maxPe, vp);
      const plant = (p === 0 ? q.apoio0 && a.apoio0 : q.apoio1 && a.apoio1);
      if (plant) { R.a4piorPlant = Math.max(R.a4piorPlant, vp); if (vp > 0.05) R.a4plant++; }
      else { R.a4piorArRazao = Math.max(R.a4piorArRazao, vp / lim); if (vp > lim) R.a4ar++; }
    }
  }
  // A3: a resposta da pelve
  const h0 = q0.h;
  if (h0 >= 0.77) {
    R.a3n++;
    const d1 = h0 - qs[1].h, d6 = h0 - qs[6].h;
    R.a3pior = Math.min(R.a3pior, d6);
    if (!(d1 > 0) || d6 < 0.05) R.a3++;
  } else R.a3baixos++;
  // A6: a pelve no começo (pose normal no aperto × 1º quadro, além do que o centro anda) e no fim (último quadro × pose
  // normal de pé com os pés plantados onde o quadro os deixou)
  if (pel0) {
    const q1 = qs[1];
    const dIni = Math.hypot(0 - (pel0.x - j.x), q1.h - pel0.y, 0 - (pel0.z - j.z));
    R.a6piorIni = Math.max(R.a6piorIni, dIni);
    if (dIni > 0.05) R.a6ini++;
  }
  const qF = qs[qs.length - 1];
  const j2 = jogadorSint({ v: 0, rumo: qF.yaw, x: qF.x, z: qF.z, h0: qF.h });
  j2.fase = j.fase;
  for (let p = 0; p < 2; p++) {
    const pe = j2.pes[p];
    pe.apoio = true; pe.x = qF.to[p].x; pe.z = qF.to[p].z; pe.rumo = qF.yaw; pe.lx = pe.x; pe.lz = pe.z; pe.tx = pe.x; pe.tz = pe.z;
  }
  const pf = pelvePose(j2);
  const dFim = Math.hypot(pf.x - qF.x, pf.y - qF.h, pf.z - qF.z);
  R.a6piorFim = Math.max(R.a6piorFim, dFim);
  if (dFim > 0.05) R.a6fim++;
  // P5 (a parte do quadro): ler o plano não o muda
  for (let i = 0; i < 100; i++) { K.quadroCarrinho(c, (i % 90) * 0.02, K.novoQuadroCarrinho()); K.carrinhoAtivo({ carrinho: c }, c.tick0 + i); K.tempoCarrinho(c, c.tick0 + i); }
  if (JSON.stringify(c) !== antes) R.p5++;
  return qs;
}

// ------------------------------------------------------------------ A. as entradas sintéticas
const ENTRADAS = [
  { nome: 'parado', v: 0, desv: 0 }, { nome: '3,0 alinhado', v: 3, desv: 0 }, { nome: '4,75 alinhado', v: 4.75, desv: 0 },
  { nome: '6,0 alinhado', v: 6, desv: 0 }, { nome: '7,0 alinhado', v: 7, desv: 0 },
  { nome: '2,0 a 90°', v: 2, desv: 90 }, { nome: '4,0 a 67,5°', v: 4, desv: 67.5 }, { nome: '6,0 a 45°', v: 6, desv: 45 },
  { nome: '8,4 a 34,8°', v: 8.4, desv: 34.8 },
];
const tabela = [['entrada', 'tq', 'tS', 'quadril até parar', 'ponta máx.', 'fora do lance (erro)']];
const res = {};
for (const e of ENTRADAS) {
  for (const lado of [1, -1]) {
    const angV = 0.3;
    const j = jogadorSint({ v: e.v, angV, analog: angV + lado * e.desv * GRAU });
    const pel0 = pelvePose(j);
    const c = K.montarCarrinho(j, m.tick, { bola: null, prever: null });
    const qs = medir(j, c, pel0);
    if (lado === 1) {
      const qS = K.quadroCarrinho(c, c.tS, K.novoQuadroCarrinho());
      const dq = Math.hypot(qS.x - c.x0, qS.z - c.z0);
      const ponta = Math.max(...qs.map(q => Math.hypot(q.po[c.frente].x - c.x0, q.po[c.frente].z - c.z0)));
      res[e.nome] = { c, dq, ponta };
      tabela.push([e.nome, f2(c.tq), f2(c.tS), `${f2(dq)} m`, `${f2(ponta)} m`, `${f2((c.fim - c.tick0) * PASSO)} s`]);
    }
  }
}
// A1
{
  const r = res['4,75 alinhado'];
  reg('A1 deslize a 4,75 m/s (aperto → parada)', `${f2(r.c.tS)} s`, '0,95–1,15 s (van den Eijnde: ~1 s)', r.c.tS >= 0.95 && r.c.tS <= 1.15);
  info('A1 quadril até parar (modelo §3.2, derivado)', `4,75: ${f2(r.dq)}; 3,0: ${f2(res['3,0 alinhado'].dq)}; 7,0: ${f2(res['7,0 alinhado'].dq)}; parado: ${f2(res.parado.dq)} m`,
    '2,6–3,3 / ≤ 1,8 / ≤ 6,5 / ≥ 0,6');
  info('A1 fora do lance no erro a 4,75 (aperto → de pé)', `${f2((r.c.fim - r.c.tick0) * PASSO)} s`, 'pesquisa: ~2,2 s (estimativa)');
}

// ------------------------------------------------------------------ A. estados de uma partida de verdade
{
  const mm = P.criarPartida({ semente: 3002, minutosPorTempo: 4 });
  let s = 777, n = 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let i = 0; i < 6000 && n < 120; i++) {
    P.passoPartida(mm, P.entradaDemoPartida(mm));
    if (i < 600 || i % 37 !== 0 || mm.partida.estado !== 'jogo') continue;
    const linha = mm.jogadores.filter(j => j.posicao !== 'GOL');
    for (let r = 0; r < 2 && n < 120; r++) {
      const j0 = linha[(i + r * 7) % linha.length];
      const o = A.pose(j0, mm);
      const pel0 = { x: o[0], y: o[1], z: o[2] };
      const b = mm.bola;
      const bola = { x: b.p.x, z: b.p.z };
      const prever = (t, out) => { out.x = b.p.x + b.v.x * t; out.z = b.p.z + b.v.z * t; return out; };
      // o analógico numa direção qualquer (85%; senão solto) e para TRÁS do corpo (140–180° do rumo): de costas, devagar
      // (a direção é livre abaixo de 2 m/s), é onde as pernas mais giram na queda (o joelho dobrado afundava no chão)
      for (const tras of [false, true]) {
        const j = structuredClone(j0);
        const ang = tras ? j0.rumo + Math.PI + (rnd() - 0.5) * 80 * GRAU : rnd() * 2 * Math.PI;
        j.imag = tras || rnd() < 0.85 ? 1 : 0; j.ix = Math.cos(ang); j.iz = Math.sin(ang);
        const c = K.montarCarrinho(j, mm.tick, { bola, prever });
        medir(j, c, pel0);
      }
      n++;
    }
  }
  info('A estados de partida medidos (A2–A4, A6, P)', `${n} × 2 analógicos (semente 3002)`, '120 × 2');
}

// os 4 estados de partida (dos 6 de 6441: 5 partidas, sementes 3002–3006) em que o joelho ia mais fundo no chão sem a guarda do
// carrinho.js joelhoFora (o fundo da cápsula a −2,1 / −1,3 / −1,3 / −1,1 cm), gravados relativos ao corpo (x para a frente
// dele, z para a direita): a pelve agachada (0,58–0,81 m), um pé no ar longe, o analógico de lado ou para trás
{
  const PINADOS = [
    { q: 0.6045, v: [1.3063, 1.39], an: 1.239, bola: [-22.1116, -6.3571], fase: 235.1195, pes: [{ apoio: false, xz: [-0.4789, -0.7939], r: -0.526, t: [-0.4124, -0.7253, 0.1165], lr: 0.3528 }, { apoio: true, xz: [0.2819, 0.3542], r: -0.047, t: [0.2819, 0.3542, 0.08], lr: -0.047 }] },
    { q: 0.5765, v: [1.2183, -1.4821], an: -1.8771, bola: [6.9771, 39.3871], fase: 117.9599, pes: [{ apoio: false, xz: [-0.6634, 0.5707], r: 0.43, t: [0.3024, -0.4593, 0.08], lr: -0.0128 }, { apoio: true, xz: [-0.2401, 0.7958], r: 0.2357, t: [-0.2401, 0.7958, 0.08], lr: 0.2357 }] },
    { q: 0.6027, v: [1.1142, -1.5745], an: -2.2657, bola: [-13.8578, 24.0684], fase: 85.8731, pes: [{ apoio: false, xz: [-0.5169, 0.7524], r: 0.961, t: [0.2558, -0.4463, 0.086], lr: -0.0078 }, { apoio: true, xz: [-0.19, 0.7885], r: 0.1621, t: [-0.19, 0.7885, 0.08], lr: 0.1621 }] },
    { q: 0.8094, v: [0.0495, -0.3156], an: -0.7664, bola: [3.8937, 10.7413], fase: 321.478, pes: [{ apoio: false, xz: [-0.112, 0.7621], r: -1.1931, t: [-0.0675, 0.4365, 0.1438], lr: 1.5 }, { apoio: true, xz: [0.0732, -0.2741], r: -1.2, t: [0.0732, -0.2741, 0.08], lr: -1.5505 }] },
  ];
  const R0 = 0.4, X0 = 10, Z0 = 5, cr = Math.cos(R0), sr = Math.sin(R0);
  const mx = (a, b) => X0 + a * cr - b * sr, mz = (a, b) => Z0 + a * sr + b * cr;
  for (const e of PINADOS) {
    const j = jogadorSint({ v: 0, rumo: R0, x: X0, z: Z0, h0: e.q, analog: R0 + e.an });
    j.vx = e.v[0] * cr - e.v[1] * sr; j.vz = e.v[0] * sr + e.v[1] * cr; j.fase = e.fase;
    e.pes.forEach((pe, k) => {
      const o = j.pes[k];
      o.apoio = pe.apoio; o.x = mx(...pe.xz); o.z = mz(...pe.xz); o.rumo = R0 + pe.r;
      o.tx = mx(pe.t[0], pe.t[1]); o.tz = mz(pe.t[0], pe.t[1]); o.ty = pe.t[2]; o.ox = 0; o.oz = 0; o.lrumo = R0 + pe.lr;
    });
    medir(j, K.montarCarrinho(j, m.tick, { bola: { x: mx(...e.bola), z: mz(...e.bola) } }), null);
  }
  info('A estados de partida gravados (o joelho no chão sem a guarda)', PINADOS.length, 'as metas A2–A4, A6 (fim) e P');
}

reg('A2 o quadro de t = 0 é o corpo no aperto', `${R.a2t0} de ${R.casos}`, '0', R.a2t0 === 0);
reg('A2 centro ≤ (v + 0,2)·PASSO por tick', `${R.a2pos} (pior: v + ${f3(R.a2piorPos)} m/s)`, '0', R.a2pos === 0);
reg('A2 velocidade fora do impacto ≤ 13 m/s²', `${R.a2vel} (pior ${f2(R.a2piorVel)} m/s²)`, '0', R.a2vel === 0);
reg('A2 velocidade no impacto ≤ 23 m/s²', `${R.a2velImp} (pior ${f2(R.a2piorVelImp)} m/s²)`, '0', R.a2velImp === 0);
reg('A2 rumo ≤ 20°/quadro', `${R.a2yaw} (pior ${f2(R.a2piorYaw)}°)`, '0', R.a2yaw === 0);
reg('A3 pelve desce no 1º passo e ≥ 0,05 m em 0,1 s', `${R.a3} de ${R.a3n} (pior ${f3(R.a3pior)} m)`, '0', R.a3 === 0 && R.a3n > 0);
if (R.a3baixos) info('A3 estados com h0 < 0,77 m (a gravidade não dá 0,05 m em 0,1 s)', R.a3baixos, 'fora da meta');
reg('A4 pé plantado ≤ 0,05 m/s', `${R.a4plant} (pior ${f3(R.a4piorPlant)} m/s)`, '0', R.a4plant === 0);
reg('A4 pé no ar ≤ 2,5·v + 3 m/s (na transição, v ≥ ve)', `${R.a4ar} (pior ${f2(R.a4piorArRazao)} × o limite)`, '0', R.a4ar === 0);
info('A4 o tornozelo mais rápido (todos os quadros)', `${f2(R.a4maxPe)} m/s`, 'spec A.5.4: ~9–10 m/s na transição');
reg('A4 nenhum pé apoiado no deslize', R.a4deslize, '0', R.a4deslize === 0);
reg('A6 pelve no começo (pose normal → 1º quadro)', `${R.a6ini} (pior ${f3(R.a6piorIni)} m)`, '≤ 0,05 m: 0', R.a6ini === 0);
reg('A6 pelve no fim (último quadro → pose normal)', `${R.a6fim} (pior ${f3(R.a6piorFim)} m)`, '≤ 0,05 m: 0', R.a6fim === 0);

// ------------------------------------------------------------------ A5: o tempo no chão
{
  const j = jogadorSint({ v: 4.75, angV: 0.3, analog: 0.3 });
  const c = K.montarCarrinho(j, 5000, {});
  const chaoErro = (c.fim - c.tick0) * PASSO - c.tS;
  const fimOk = cc => { const q = K.quadroCarrinho(cc, (cc.fim - cc.tick0) * PASSO, K.novoQuadroCarrinho()); return q.apoio0 && q.apoio1 && Math.hypot(q.vx, q.vz) <= 1e-9 && Math.abs(q.h - 0.92) <= 0.02; };
  const c2 = structuredClone(c);
  const mudou = K.marcarAcerto(c2, c2.tick0 + 20);
  const chaoAcerto = (c2.fim - c2.tick0) * PASSO - c2.tS;
  const c3 = structuredClone(c);
  const tarde = K.marcarAcerto(c3, c3.tick0 + Math.ceil(c3.tS / PASSO) + 1);
  const tol = PASSO + 1e-9;
  reg('A5 errou: da parada até de pé', `${f3(chaoErro)} s`, '1,2 ± 1 tick', Math.abs(chaoErro - 1.2) <= tol);
  reg('A5 ganhou: da parada até de pé', `${f3(chaoAcerto)} s (marcou: ${mudou})`, '0,5 ± 1 tick', mudou && Math.abs(chaoAcerto - 0.5) <= tol);
  reg('A5 toque depois da parada não muda (= errou)', tarde ? 'mudou' : 'não mudou', 'não muda', !tarde && c3.fim === c.fim);
  reg('A5 no fim: pés plantados, v = 0, pelve 0,92 ± 0,02', `errou ${fimOk(c)}, ganhou ${fimOk(c2)}`, 'os dois', fimOk(c) && fimOk(c2));
  // carrinhoAtivo / tempoCarrinho / congela
  const jc = { carrinho: c };
  const atv = [K.carrinhoAtivo(jc, c.tick0), K.carrinhoAtivo(jc, c.tick0 + 1), K.carrinhoAtivo(jc, c.fim), K.carrinhoAtivo(jc, c.fim + 1)];
  const cg = structuredClone(c); cg.congela = c.tick0 + 10;
  const jg = { carrinho: cg };
  const congOk = K.carrinhoAtivo(jg, c.fim + 500) && Math.abs(K.tempoCarrinho(cg, c.fim + 500) - 10 * PASSO) < 1e-12
    && Math.abs(K.tempoCarrinho(c, c.tick0 + 7, 0.004) - (7 * PASSO + 0.004)) < 1e-12;
  reg('0 carrinhoAtivo (tick0 não; tick0+1..fim sim; depois não)', atv.join(' '), 'false true true false',
    atv.join(' ') === 'false true true false' && !K.carrinhoAtivo({ carrinho: null }, 1));
  reg('0 congela: o relógio do quadro para no apito', congOk ? 'parado' : 'andou', 'parado', congOk);
  // o plano é objeto simples e determinístico
  const cl = structuredClone(c), qa = K.quadroCarrinho(c, 0.77, K.novoQuadroCarrinho()), qb = K.quadroCarrinho(cl, 0.77, K.novoQuadroCarrinho());
  const c4 = K.montarCarrinho(j, 5000, {});
  reg('0 plano simples (structuredClone dá o mesmo quadro) e montado igual 2×', JSON.stringify(qa) === JSON.stringify(qb) && JSON.stringify(c4) === JSON.stringify(c) ? 'igual' : 'diferente',
    'igual', JSON.stringify(qa) === JSON.stringify(qb) && JSON.stringify(c4) === JSON.stringify(c));
}

// ------------------------------------------------------------------ A7: o atributo
{
  const mk = d => K.montarCarrinho(jogadorSint({ v: 4.75, angV: 0.3, analog: 0.3, desarme: d }), 5000, {});
  const dist = c => { const q = K.quadroCarrinho(c, c.tS, K.novoQuadroCarrinho()); return Math.hypot(q.x - c.x0, q.z - c.z0); };
  const d90 = dist(mk(90)), d40 = dist(mk(40));
  reg('A7 desarme 90 desliza mais que 40 (4,75 m/s)', `${f2(d90)} × ${f2(d40)} m`, '90 > 40', d90 > d40);
}

// ------------------------------------------------------------------ A8: o giro cabe até o impacto
{
  let n = 0, tqFora = 0, desvErr = 0, acelErr = 0, piorDesv = 0, piorAcel = 0;
  for (const v of [0, 1, 1.99, 2, 3, 4, 5, 6, 7, 8.4, 9.4]) {
    for (let req = 0; req <= 180; req += 7.5) {
      for (const lado of [1, -1]) {
        const angV = -1.1;
        const c = K.montarCarrinho(jogadorSint({ v, angV, analog: angV + lado * req * GRAU }), 100, {});
        n++;
        if (c.tq < T_AR - 1e-12 || c.tq > T_D + 1e-12) tqFora++;
        if (v > 0) {
          const real = Math.abs(angDif(angV, Math.atan2(c.uz, c.ux))) / GRAU;
          const esp = v >= CC.desvioLivre ? Math.min(req, K.desvioMax(v) / GRAU) : req;
          piorDesv = Math.max(piorDesv, Math.abs(real - esp));
          if (Math.abs(real - esp) > 1e-6) desvErr++;
        }
        const acel = Math.hypot(c.ve * c.ux - c.vx0, c.ve * c.uz - c.vz0) / c.tq;
        piorAcel = Math.max(piorAcel, acel);
        if (acel > 13 + 1e-9) acelErr++;
      }
    }
  }
  reg('A8 tq entre tAr e tAr + tImpacto', `${tqFora} de ${n}`, '0', tqFora === 0);
  reg('A8 desvio pedido além do limite fica no limite', `${desvErr} (pior ${piorDesv.toExponential(1)}°)`, '0', desvErr === 0);
  reg('A8 aceleração da queda ≤ 13 m/s²', `${acelErr} (pior ${f2(piorAcel)} m/s²)`, '0', acelErr === 0);
  const tqs = ['2,0 a 90°', '4,0 a 67,5°', '6,0 a 45°', '8,4 a 34,8°'].map(k => f2(res[k].c.tq));
  info('A8 tq no desvio máximo (2 / 4 / 6 / 8,4 m/s)', tqs.join(' / ') + ' s', 'spec: 0,30 / 0,33 / 0,35 / 0,40');
}

// ------------------------------------------------------------------ A9: a ajuda de mira pelo encontro
{
  const VC = 5;
  /** A menor distância (horizontal) entre a ponta da perna da bola e a bola no mesmo instante, tick a tick. */
  function pontaMin(c, B) {
    let best = Infinity;
    const q = K.novoQuadroCarrinho(), b = { x: 0, z: 0 };
    const n = Math.ceil(c.tS / PASSO);
    for (let i = 0; i <= n; i++) {
      const t = i * PASSO;
      K.quadroCarrinho(c, t, q); B(t, b);
      const p = q.po[c.frente];
      best = Math.min(best, Math.hypot(b.x - p.x, b.z - p.z));
    }
    return best;
  }
  const casos = [];
  for (const [d, v] of [[2, 4.75], [4, 6], [5.5, 7]]) {
    for (const lado of [1, -1]) {
      const x0 = 0, z0 = 0;
      // o tempo da ponta até a linha do condutor, indo reto: a bola cruza a frente do carrinho nesse instante
      const cr = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: 0, x: x0, z: z0 }), 100, {});
      const qq = K.novoQuadroCarrinho();
      let T = null;
      for (let i = 0; i <= Math.ceil(cr.tS / PASSO); i++) { K.quadroCarrinho(cr, i * PASSO, qq); if (qq.po[cr.frente].x >= d) { T = i * PASSO; break; } }
      if (T == null) { casos.push({ d, v, lado, fora: true }); continue; }
      const zb0 = -lado * VC * T;
      const B = (t, out) => { out.x = d; out.z = zb0 + lado * VC * t; return out; };
      const bola = { x: d, z: zb0 };
      // a direção do encontro (sem ajuda): a melhor por varredura
      let best = Infinity, th = 0;
      for (let a = -40; a <= 40; a += 0.25) {
        const c = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: a * GRAU, x: x0, z: z0 }), 100, { bola });
        const dm = pontaMin(c, B);
        if (dm < best) { best = dm; th = a; }
      }
      if (best > 0.2) { casos.push({ d, v, lado, fora: true, best }); continue; }
      const an = (th + lado * 15) * GRAU;
      const cA = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: an, x: x0, z: z0 }), 100, { bola, prever: B });
      const cS = K.montarCarrinho(jogadorSint({ v, angV: 0, analog: an, x: x0, z: z0 }), 100, { bola });
      casos.push({ d, v, lado, th, best, com: pontaMin(cA, B), sem: pontaMin(cS, B), mirou: cA.mirou });
    }
  }
  const validos = casos.filter(c => !c.fora);
  const ruins = validos.filter(c => !(c.com <= 0.3));
  reg('A9 ajuda de mira: a ponta a ≤ 0,3 m da bola no mesmo instante', `${validos.length - ruins.length}/${validos.length} (pior ${f2(Math.max(...validos.map(c => c.com)))} m)`,
    'todos (6 casos)', ruins.length === 0 && validos.length === 6);
  info('A9 sem a ajuda (o mesmo analógico)', `${f2(Math.min(...validos.map(c => c.sem)))}–${f2(Math.max(...validos.map(c => c.sem)))} m`, 'erra');
  reg('A9 a mira ajudada marca a intenção (mirou)', `${validos.filter(c => c.mirou).length}/${validos.length}`, 'todos', validos.every(c => c.mirou));
  if (DETALHE) for (const c of casos) console.log(`A9 d=${c.d} v=${c.v} lado=${c.lado}: ${c.fora ? `fora (${f2(c.best)})` : `θ*=${c.th}° melhor ${f3(c.best)} com ${f3(c.com)} sem ${f3(c.sem)} mirou ${c.mirou}`}`);
}

// ------------------------------------------------------------------ P: o corpo nos quadros
reg('P ossos: coxa e canela com o comprimento exato', `${R.ossos} (pior ${R.ossoPior.toExponential(1)} m)`, '0', R.ossos === 0);
reg('P tornozelo ao alcance da perna (≤ LMAX)', R.alcance, '0', R.alcance === 0);
reg('P1 fundo das cápsulas (pernas, quadris, pelve) ≥ −1 cm', `${R.fundo} (pior ${f3(R.fundoPior)} m)`, '0', R.fundo === 0);
reg('P1 joelho dobrado ≥ 0,06 m (deslize e chão)', `${R.joelho} (pior ${f3(R.joelhoPior)} m)`, '0', R.joelho === 0);
reg('P1 pelve no deslize 0,14–0,20 m', `${R.pelve} (${f3(R.pelveFaixa[0])}–${f3(R.pelveFaixa[1])} m)`, '0', R.pelve === 0);
reg('P4 tronco 40–60° para trás no deslize', `${R.tronco} (${f2(R.troncoFaixa[0])}–${f2(R.troncoFaixa[1])}°)`, '0', R.tronco === 0);
reg('P5 o quadro não escreve no plano (100 leituras)', R.p5, '0', R.p5 === 0);
reg('nenhum NaN nos quadros', R.nan, '0', R.nan === 0);
for (const [k, txt] of [
  ['P1', 'vértice mais baixo da pele do corpo novo ≥ −1 cm (LOD0)'], ['P2', 'as juntas das pernas da pose = as do quadro'],
  ['P3', 'esqueleto nos quadros (O1, O2, O3)'], ['P4', 'cabeça ≤ 17° da linha do tronco'], ['P5', 'a pose não escreve no plano'],
  ['B–G', 'contato, canhão, regras, travas, determinismo, cenas'],
]) linhas.push(['…', `${k} ${txt}`, 'PENDENTE', 'commits 2–5 (poseCarrinho, contato, faltas, cenas)']);

if (DETALHE) console.log(tabela.map(l => l.join(' | ')).join('\n') + '\n');
fim();
