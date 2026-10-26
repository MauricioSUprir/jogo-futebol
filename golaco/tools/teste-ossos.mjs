// Esqueleto do corpo humano (Etapa 5.1a): os ossos do DESENHO montados a partir das 19 juntas da pose do jogo
// (js/render/esqueleto.js) e a malha do Rocketbox encaixada nas medidas do jogo (assets/jogador/corpo.*,
// tools/humano/). Só desenho: nada daqui entra na simulação. Poses reais, a cada passo de 1/60 s: 8 partidas IA × IA
// (os 22 e os 2 treinadores; mergulhos e cabeceios acontecem nelas) e as comemorações de 4 gols (os atores da cena).
//   O1 juntas: cada osso leva a junta do descanso à junta de agora — a origem e a ponta (com a escala ao longo do osso):
//      ≤ 1 mm em todo quadro (fora dos quadros em que a escala bate no limite);
//   O2 saltos "do esqueleto": giro de um osso > 40° num passo com o eixo dele (as juntas) mudando < 20° (na perna, o pé
//      também; e a dobra do joelho/cotovelo mudando < 15°: senão foi a pose que pulou): ≤ 0,03% das amostras (o protótipo
//      v3 da pesquisa, com as juntas cruas: 86 em 316.664);
//   O3 NaN: 0; a escala bate no limite [0,9; 1,1] em ≤ 0,5% dos ossos×quadros;
//   O4 sola no apoio: o vértice mais baixo da chuteira do pé apoiado na simulação a 0–1,5 cm do chão em ≥ 95% dos
//      quadros de apoio (a cada 4 passos);
//   O5 volume na dobra a 90° (joelho e cotovelo; a pele linear na CPU com a malha de verdade, LOD0): a seção perto da
//      junta guarda ≥ 85% da área do descanso (o raio médio dos vértices divididos entre os dois ossos, ao quadrado);
//   O6 assets: corpo.bin = o tamanho e o sha256 do corpo.json; triângulos por LOD dentro da tabela (LOD0 ≤ 9,5 mil,
//      LOD1 ≤ 4,2 mil, LOD2 ≤ 1,9 mil, LOD3 ≤ 0,95 mil); 25 ossos; ≤ 4 influências com soma 255.
//   O7 postura do desenho (dono, 22/10: "os jogadores parecem meio curvados"; esqueleto.js postura), nas poses das
//      partidas pela velocidade do jogador: joelho do jogador de linha PARADO (< 0,3 m/s) — mediana da dobra ≤ 20° (a
//      pose do jogo: ~42°); na DISPARADA (≥ 6 m/s) a mediana do joelho muda ≤ 3° (a corrida fica a do jogo); tronco
//      correndo (3,6–6 m/s) ≤ 17° de inclinação (jogo ~22°); nada muda NO AR (tornozelo mais baixo ≥ 0,25 m); com as
//      duas mãos a < 0,3 m (segurando a bola) elas nunca saem do lugar (≤ 1 mm); os pés nunca (≤ 1 mm).
// Na versão sem o corpo humano (main antes da 5.1a) reprova: o esqueleto e os assets não existem.
//   node tools/teste-ossos.mjs [--sementes 8] [--detalhe]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt as fmtP } from './lib/medidas.mjs';
import { carregarNode, golRoteirizadoNode } from './lib/gol-node.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const N_SEM = args.includes('--sementes') ? Number(args[args.indexOf('--sementes') + 1]) : 8;
const detalhe = args.includes('--detalhe');
const fmt = (v, d = 2) => fmtP(v, d).replace('.', ',');
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const imp = f => import(pathToFileURL(path.join(RAIZ, 'js', f)).href);
let ES, CD;
try { ES = await imp('render/esqueleto.js'); CD = await imp('render/corpo-dados.js'); } catch (e) { ES = null; }
const arqJ = path.join(RAIZ, 'assets/jogador/corpo.json'), arqB = path.join(RAIZ, 'assets/jogador/corpo.bin');
if (!ES || !fs.existsSync(arqJ) || !fs.existsSync(arqB)) {
  reg('esqueleto do desenho e corpo humano (js/render/esqueleto.js, assets/jogador/corpo.*)', 'não existem', 'existem', false);
  console.log(tabelaTexto(linhas)); process.exit(1);
}
const P = await imp('partida.js');
const A = await imp('anim.js');
const TE = await imp('tecnicos.js');
const CM = await imp('comemoracao.js');
const { J, NJ } = A;
const indice = JSON.parse(fs.readFileSync(arqJ, 'utf8'));
const buf = fs.readFileSync(arqB);
const bin = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const corpo = CD.lerCorpo(indice, bin);
const E = ES.criarEsqueleto(corpo.repouso);
const { NOSSOS, OSSOS, N_PRINC, JUNTAS_ESQ, peleVertice } = ES;
const JE = Object.fromEntries(JUNTAS_ESQ.map((n, i) => [n, i]));
for (const n of JUNTAS_ESQ) if (J[n] !== JE[n]) throw new Error(`a ordem das juntas do esqueleto (${n}) não é a do anim.js`);
const IA = OSSOS.map(o => JE[o[0]]), IB = OSSOS.map(o => (o[1] ? JE[o[1]] : -1));
const D0 = E.desenhoRepouso, COMPR = E.comprimentos;

// ------------------------------------------------------------------------------------------------ O6 assets
{
  const sha = crypto.createHash('sha256').update(buf).digest('hex');
  const TETO = [9500, 4200, 1900, 950];
  const tris = corpo.lods.map(l => l.triangulos);
  let infl = true;
  for (const l of corpo.lods) for (const p of Object.values(l.partes)) for (let v = 0; v < p.nv; v++) {
    let s = 0;
    for (let k = 0; k < 4; k++) { s += p.pesos[v * 4 + k]; if (p.ossos[v * 4 + k] >= NOSSOS) infl = false; }
    if (s !== 255) infl = false;
  }
  reg('O6 assets: sha256 e tamanho do corpo.bin, triângulos por LOD, 25 ossos, ≤ 4 influências (soma 255)',
    `sha ${sha === indice.bin.sha256 ? 'igual' : 'DIFERENTE'}; ${buf.length} bytes; LODs ${tris.join(' / ')}; ${indice.ossos.length} ossos; pesos ${infl ? 'ok' : 'COM ERRO'}`,
    'igual; ≤ 9,5 mil / 4,2 mil / 1,9 mil / 0,95 mil; 25; ok',
    sha === indice.bin.sha256 && buf.length === indice.bin.bytes && tris.length === 4 && tris.every((t, i) => t <= TETO[i]) && indice.ossos.length === NOSSOS && NOSSOS === 25 && infl);
}

// ------------------------------------------------------------------------------------------------ medidor por quadro
const S = new Float64Array(NOSSOS * 12);
const ant = new Map();          // id → {S, po}
const st = { amostras: 0, erroJ: 0, nErroJ: 0, nan: 0, limite: 0, ossosQ: 0, saltos: 0, saltosPorOsso: new Int32Array(NOSSOS), maxTronco: 0, exemplo: '', porFonte: {} };
const p3 = new Float64Array(3);
const angAxis = (pa, po, a, b) => {
  const ux = pa[b * 3] - pa[a * 3], uy = pa[b * 3 + 1] - pa[a * 3 + 1], uz = pa[b * 3 + 2] - pa[a * 3 + 2];
  const vx = po[b * 3] - po[a * 3], vy = po[b * 3 + 1] - po[a * 3 + 1], vz = po[b * 3 + 2] - po[a * 3 + 2];
  const c = (ux * vx + uy * vy + uz * vz) / (Math.sqrt(ux * ux + uy * uy + uz * uz) * Math.sqrt(vx * vx + vy * vy + vz * vz) || 1);
  return Math.acos(Math.max(-1, Math.min(1, c))) * 57.29578;
};
const dobra = (q, a, b, c) => {
  const ux = q[b * 3] - q[a * 3], uy = q[b * 3 + 1] - q[a * 3 + 1], uz = q[b * 3 + 2] - q[a * 3 + 2];
  const vx = q[c * 3] - q[b * 3], vy = q[c * 3 + 1] - q[b * 3 + 1], vz = q[c * 3 + 2] - q[b * 3 + 2];
  const k = (ux * vx + uy * vy + uz * vz) / (Math.sqrt(ux * ux + uy * uy + uz * uz) * Math.sqrt(vx * vx + vy * vy + vz * vz) || 1);
  return Math.acos(Math.max(-1, Math.min(1, k))) * 57.29578;
};
function medir(chave, po, corte, v = 1.5, peso = 1) {
  E.pele(po, S, 0, v, peso);
  const D = E.desenho;
  st.amostras++;
  for (let k = 0; k < NOSSOS * 12; k++) if (!Number.isFinite(S[k])) { st.nan++; break; }
  // O1: origem e ponta de cada osso principal
  for (let b = 0; b < N_PRINC; b++) {
    const o = b * 12;
    const ap = (j, out) => {
      const x = D0[j * 3], y = D0[j * 3 + 1], z = D0[j * 3 + 2];
      out[0] = S[o] * x + S[o + 1] * y + S[o + 2] * z + S[o + 3];
      out[1] = S[o + 4] * x + S[o + 5] * y + S[o + 6] * z + S[o + 7];
      out[2] = S[o + 8] * x + S[o + 9] * y + S[o + 10] * z + S[o + 11];
    };
    const juntas = IB[b] >= 0 && b !== 15 && b !== 18 ? [IA[b], IB[b]] : [IA[b]]; // o pé é rígido: só a origem
    let noLimite = false;
    if (IB[b] >= 0 && b !== 15 && b !== 18) {
      st.ossosQ++;
      const a = IA[b] * 3, c = IB[b] * 3;
      const k = Math.sqrt((D[c] - D[a]) ** 2 + (D[c + 1] - D[a + 1]) ** 2 + (D[c + 2] - D[a + 2]) ** 2) / COMPR[b];
      if (k < 0.9 || k > 1.1) { st.limite++; noLimite = true; }
    }
    if (noLimite) continue;
    for (const j of juntas) {
      ap(j, p3);
      const e = Math.sqrt((p3[0] - D[j * 3]) ** 2 + (p3[1] - D[j * 3 + 1]) ** 2 + (p3[2] - D[j * 3 + 2]) ** 2);
      if (e > st.erroJ) st.erroJ = e;
      if (e > 0.001) st.nErroJ++;
    }
  }
  // O2: saltos
  const a = ant.get(chave);
  if (a && !corte) {
    for (let b = 0; b < NOSSOS; b++) {
      const o = b * 12;
      // giro relativo entre as rotações de pele (sem a escala: colunas normalizadas)
      let tr = 0;
      for (let c = 0; c < 3; c++) {
        let na = 0, nb = 0, d = 0;
        for (let r = 0; r < 3; r++) { na += a.S[o + r * 4 + c] ** 2; nb += S[o + r * 4 + c] ** 2; d += a.S[o + r * 4 + c] * S[o + r * 4 + c]; }
        tr += d / (Math.sqrt(na * nb) || 1);
      }
      const th = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2))) * 57.29578;
      if (b <= 4 && th > st.maxTronco) st.maxTronco = th;
      if (th <= 40) continue;
      if (b >= N_PRINC) continue; // ajudantes: contados pelos ossos de que são o meio
      // osso sem eixo (cabeça, mão): o eixo do pai (pescoço, antebraço)
      const bb = IB[b] >= 0 ? b : ES.PAI[b];
      const ang = angAxis(a.D, D, IA[bb], IB[bb]);
      let angPe = 0;
      if (b >= 13 && b <= 18) {
        const t = b < 16 ? JE.tornozeloE : JE.tornozeloD, pt = b < 16 ? JE.pontaE : JE.pontaD;
        angPe = angAxis(a.D, D, t, pt);
      }
      // a dobra do joelho/cotovelo também tem de ficar parada (< 15° no passo): a torção do membro sai do plano da dobra,
      // e o chute que estica o joelho 24° num passo vira a torção junto — é a pose que pulou, não o esqueleto
      let angDobra = 0;
      if (b >= 13 && b <= 18) { const e = b < 16; angDobra = Math.abs(dobra(a.D, e ? JE.quadrilE : JE.quadrilD, e ? JE.joelhoE : JE.joelhoD, e ? JE.tornozeloE : JE.tornozeloD) - dobra(D, e ? JE.quadrilE : JE.quadrilD, e ? JE.joelhoE : JE.joelhoD, e ? JE.tornozeloE : JE.tornozeloD)); }
      else if (b >= 6 && b <= 12 && b !== 9) { const e = b < 9; angDobra = Math.abs(dobra(a.D, e ? JE.ombroE : JE.ombroD, e ? JE.cotoveloE : JE.cotoveloD, e ? JE.maoE : JE.maoD) - dobra(D, e ? JE.ombroE : JE.ombroD, e ? JE.cotoveloE : JE.cotoveloD, e ? JE.maoE : JE.maoD)); }
      if (ang < 20 && angPe < 20 && angDobra < 15) {
        st.saltos++; st.saltosPorOsso[b]++;
        const fonte = chave[0] === 'c' ? 'comemoração' : chave.includes('t') ? 'técnico' : 'partida';
        st.porFonte[fonte] = (st.porFonte[fonte] ?? 0) + 1;
        if (!st.exemplo) st.exemplo = `${chave} osso ${ES.NOMES_OSSOS[b]} ${fmt(th, 0)}°`;
      }
    }
  }
  if (a) { a.S.set(S); a.D.set(D); } else ant.set(chave, { S: Float64Array.from(S), D: Float64Array.from(D) });
}

// ------------------------------------------------------------------------------------------------ O4 sola
const L0 = corpo.lods[0].partes.corpo;
const sola = [[], []];
for (let v = 0; v < L0.nv; v++) {
  const y = L0.pos[v * 3 + 1];
  if (y > 0.035) continue;
  for (let k = 0; k < 4; k++) {
    const o = L0.ossos[v * 4 + k], w = L0.pesos[v * 4 + k];
    if (w > 128 && (o === 15 || o === 18)) sola[o === 15 ? 0 : 1].push(v);
  }
}
const solaSt = { n: 0, ok: 0, min: Infinity, max: -Infinity, abaixo: 0, acima: 0 };
const pv = new Float64Array(3), w4 = new Float64Array(4);
function medirSola(p) {
  let mn = Infinity;
  for (const v of sola[p]) {
    for (let k = 0; k < 4; k++) w4[k] = L0.pesos[v * 4 + k] / 255;
    peleVertice(S, 0, L0.ossos.subarray(v * 4, v * 4 + 4), w4, L0.pos[v * 3], L0.pos[v * 3 + 1], L0.pos[v * 3 + 2], pv);
    if (pv[1] < mn) mn = pv[1];
  }
  solaSt.n++;
  if (mn >= -0.002 && mn <= 0.015) solaSt.ok++;
  else if (mn < -0.002) solaSt.abaixo++; else solaSt.acima++;
  if (mn < solaSt.min) solaSt.min = mn;
  if (mn > solaSt.max) solaSt.max = mn;
}

// ------------------------------------------------------------------------------------------------ O7 postura
const PS7 = new Float64Array(NJ * 3);
const pst = { parado: [[], []], disparada: [[], []], troncoCorrida: [[], []], noAr: 0, nAr: 0, maoPresa: 0, nMao: 0, pes: 0 };
const mediana = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const inclinacao = q => { const x = q[JE.pescoco * 3] - q[JE.pelve * 3], y = q[JE.pescoco * 3 + 1] - q[JE.pelve * 3 + 1], z = q[JE.pescoco * 3 + 2] - q[JE.pelve * 3 + 2]; return Math.acos(Math.max(-1, Math.min(1, y / Math.hypot(x, y, z)))) * 57.29578; };
const dist3 = (a, b, j) => Math.hypot(a[j * 3] - b[j * 3], a[j * 3 + 1] - b[j * 3 + 1], a[j * 3 + 2] - b[j * 3 + 2]);
function medirPostura(po, v, goleiro) {
  if (!E.postura) return;
  const q = E.postura(po, v, goleiro ? 0.4 : 1, PS7);
  const joelho = r => Math.min(dobra(r, JE.quadrilE, JE.joelhoE, JE.tornozeloE), dobra(r, JE.quadrilD, JE.joelhoD, JE.tornozeloD));
  if (!goleiro && v < 0.3) { pst.parado[0].push(joelho(po)); pst.parado[1].push(joelho(q)); }
  if (!goleiro && v >= 6) { pst.disparada[0].push(joelho(po)); pst.disparada[1].push(joelho(q)); }
  if (!goleiro && v >= 3.6 && v < 6) { pst.troncoCorrida[0].push(inclinacao(po)); pst.troncoCorrida[1].push(inclinacao(q)); }
  let dMax = 0;
  for (let k = 0; k < NJ * 3; k++) dMax = Math.max(dMax, Math.abs(q[k] - po[k]));
  if (Math.min(po[JE.tornozeloE * 3 + 1], po[JE.tornozeloD * 3 + 1]) >= 0.25) { pst.nAr++; if (dMax > 1e-6) pst.noAr++; }
  const me = JE.maoE * 3, md = JE.maoD * 3;
  if (Math.hypot(po[me] - po[md], po[me + 1] - po[md + 1], po[me + 2] - po[md + 2]) < 0.3) {
    pst.nMao++; if (dist3(q, po, JE.maoE) > 0.001 || dist3(q, po, JE.maoD) > 0.001) pst.maoPresa++;
  }
  for (const j of [JE.tornozeloE, JE.tornozeloD, JE.pontaE, JE.pontaD]) if (dist3(q, po, j) > 0.001) pst.pes++;
}

// ------------------------------------------------------------------------------------------------ partidas
const SALTO_TELEPORTE = 0.5;
const t0 = Date.now();
const po = new Float32Array(NJ * 3);
for (let sem = 1; sem <= N_SEM; sem++) {
  const m = P.criarPartida({ semente: 100 + sem, minutosPorTempo: 1 });
  const T = TE.criarTecnicos(m.times, sem), Lt = TE.criarLeitura();
  const pos = new Map();
  for (let i = 0; i < 3600; i++) {
    const ev = P.passoPartida(m, P.entradaDemoPartida(m), null) ?? m.eventos;
    TE.leituraDoMundo(m, ev, Lt); TE.passoTecnicos(T, Lt);
    for (const j of m.jogadores) {
      A.pose(j, m, po);
      const pa = pos.get(j.id);
      const corte = pa && Math.hypot(j.x - pa[0], j.z - pa[1]) > SALTO_TELEPORTE;
      pos.set(j.id, [j.x, j.z]);
      const vj = Math.hypot(j.vx, j.vz), gol = j.posicao === 'GOL';
      medir(`s${sem}j${j.id}`, po, corte, vj, gol ? 0.4 : 1);
      if (i % 3 === 0) medirPostura(po, vj, gol);
      if (i % 4 === 0) for (let p = 0; p < 2; p++) if (j.pes[p].apoio && j.pes[1 - p].apoio === false || (j.pes[p].apoio && i % 8 === 0)) medirSola(p);
    }
    for (const tc of T.tecs) {
      const pa = pos.get('t' + tc.time);
      const corte = pa && Math.hypot(tc.j.x - pa[0], tc.j.z - pa[1]) > SALTO_TELEPORTE;
      pos.set('t' + tc.time, [tc.j.x, tc.j.z]);
      medir(`s${sem}t${tc.time}`, tc.atu, corte, pa ? Math.hypot(tc.j.x - pa[0], tc.j.z - pa[1]) * 60 : 0);
    }
  }
}
// comemorações (os atores da cena: corrida, finalização, abraço; o goleiro termina o mergulho)
let cenas = 0;
const LN = await carregarNode(path.join(RAIZ, 'js'));
for (const o of [{ semente: 5 }, { semente: 7, time: 1 }, { semente: 9, dist: 14 }, { semente: 11, z0: -4 }]) {
  const g = golRoteirizadoNode(LN, o);
  if (!g) continue;
  const c = CM.criarCena(CM.planejarComemoracao(g.m, g.gol, { timeHumano: 0 }), g.m);
  cenas++;
  for (let k = 0; k < 2400 && !c.acabou; k++) {
    CM.passoCena(c);
    c.atores.forEach((at, i) => medir(`c${cenas}a${i}`, at.atu, false, Math.hypot(at.x1 - at.x0, at.z1 - at.z0) * 60, at.goleiro ? 0.4 : 1));
  }
}
const seg = (Date.now() - t0) / 1000;

reg('O1 juntas: origem e ponta de cada osso = as juntas de agora (fora do limite da escala)',
  `pior ${fmt(st.erroJ * 1000, 3)} mm; > 1 mm em ${st.nErroJ}`, '≤ 1 mm', st.erroJ <= 0.001);
const taxa = st.saltos / Math.max(1, st.amostras);
reg('O2 saltos do esqueleto (> 40° num passo com o eixo do osso < 20° e a dobra < 15°)',
  `${st.saltos} em ${st.amostras} amostras (${fmt(taxa * 100, 4)}%)${st.exemplo ? '; ex.: ' + st.exemplo : ''}; maior giro do tronco/cabeça num passo ${fmt(st.maxTronco, 1)}° (informativo)`,
  '≤ 0,03%', taxa <= 0.0003);
const tLim = st.limite / Math.max(1, st.ossosQ);
reg('O3 NaN e escala no limite [0,9; 1,1]', `NaN ${st.nan}; limite em ${fmt(tLim * 100, 3)}% dos ossos×quadros`, '0; ≤ 0,5%', st.nan === 0 && tLim <= 0.005);
const tSola = solaSt.ok / Math.max(1, solaSt.n);
reg('O4 sola da chuteira no apoio a 0–1,5 cm do chão',
  `${fmt(tSola * 100, 1)}% de ${solaSt.n} (abaixo ${solaSt.abaixo}, acima ${solaSt.acima}; de ${fmt(solaSt.min * 100, 1)} a ${fmt(solaSt.max * 100, 1)} cm)`,
  '≥ 95%', tSola >= 0.95 && solaSt.n > 1000);

// ------------------------------------------------------------------------------------------------ O5 volume na dobra
function rodarEm(pose, centro, eixo, ang, juntas) {
  const [ax, ay, az] = eixo, c = Math.cos(ang), s = Math.sin(ang);
  for (const j of juntas) {
    const x = pose[j * 3] - centro[0], y = pose[j * 3 + 1] - centro[1], z = pose[j * 3 + 2] - centro[2];
    const d = ax * x + ay * y + az * z;
    const cx = ay * z - az * y, cy = az * x - ax * z, cz = ax * y - ay * x;
    pose[j * 3] = centro[0] + x * c + cx * s + ax * d * (1 - c);
    pose[j * 3 + 1] = centro[1] + y * c + cy * s + ay * d * (1 - c);
    pose[j * 3 + 2] = centro[2] + z * c + cz * s + az * d * (1 - c);
  }
}
const R0 = new Float32Array(NJ * 3);
JUNTAS_ESQ.forEach((n, i) => R0.set(corpo.repouso.juntas[n], i * 3));
function volume(nome, jDobra, juntasFilhas, eixo, ang, ossosPar) {
  const pose = Float32Array.from(R0);
  const c = [R0[jDobra * 3], R0[jDobra * 3 + 1], R0[jDobra * 3 + 2]];
  rodarEm(pose, c, eixo, ang, juntasFilhas);
  E.pele(pose, S, 0);
  const D = E.desenho, Dr = E.desenhoRepouso;
  let r0 = 0, r1 = 0, n = 0;
  for (let v = 0; v < L0.nv; v++) {
    const x = L0.pos[v * 3], y = L0.pos[v * 3 + 1], z = L0.pos[v * 3 + 2];
    const dr = Math.hypot(x - Dr[jDobra * 3], y - Dr[jDobra * 3 + 1], z - Dr[jDobra * 3 + 2]);
    if (dr > 0.09) continue;
    let wPar = 0, wMax = 0;
    for (let k = 0; k < 4; k++) { const w = L0.pesos[v * 4 + k] / 255; w4[k] = w; if (ossosPar.includes(L0.ossos[v * 4 + k])) wPar += w; wMax = Math.max(wMax, w); }
    if (wPar < 0.99 || wMax > 0.9) continue;
    peleVertice(S, 0, L0.ossos.subarray(v * 4, v * 4 + 4), w4, x, y, z, pv);
    r0 += dr; r1 += Math.hypot(pv[0] - D[jDobra * 3], pv[1] - D[jDobra * 3 + 1], pv[2] - D[jDobra * 3 + 2]); n++;
  }
  return { nome, n, area: n ? (r1 / r0) ** 2 : 0 };
}
const vols = [
  volume('joelho E', JE.joelhoE, [JE.tornozeloE, JE.pontaE], [0, 0, 1], -Math.PI / 2, [13, 14, 19]),
  volume('joelho D', JE.joelhoD, [JE.tornozeloD, JE.pontaD], [0, 0, 1], -Math.PI / 2, [16, 17, 20]),
  volume('cotovelo E', JE.cotoveloE, [JE.maoE], [1, 0, 0], -Math.PI / 2, [6, 7, 21]),
  volume('cotovelo D', JE.cotoveloD, [JE.maoD], [1, 0, 0], Math.PI / 2, [10, 11, 22]),
];
if (!E.postura) reg('O7 postura do desenho (esqueleto.js postura)', 'não existe', 'existe', false);
else {
  const [pj, pd] = pst.parado.map(mediana), [dj, dd] = pst.disparada.map(mediana), [tj, td] = pst.troncoCorrida.map(mediana);
  reg('O7a joelho do jogador parado (mediana da dobra, desenho)', `${fmt(pj, 1)}° → ${fmt(pd, 1)}° (${pst.parado[0].length} poses)`, '≤ 20°', pd <= 20);
  reg('O7b joelho na disparada (a corrida do jogo)', `${fmt(dj, 1)}° → ${fmt(dd, 1)}°`, 'muda ≤ 3°', Math.abs(dd - dj) <= 3);
  reg('O7c tronco correndo 3,6–6 m/s (mediana da inclinação)', `${fmt(tj, 1)}° → ${fmt(td, 1)}°`, '≤ 17°', td <= 17);
  reg('O7d no ar, mãos juntas (segurando a bola) e pés: nada muda', `no ar ${pst.noAr}/${pst.nAr}; mão ${pst.maoPresa}/${pst.nMao}; pés ${pst.pes}`, '0; 0; 0',
    pst.noAr === 0 && pst.maoPresa === 0 && pst.pes === 0 && pst.nAr > 0);
}
reg('O5 volume na dobra a 90° (área da seção perto da junta ÷ a do descanso)',
  vols.map(v => `${v.nome} ${fmt(v.area * 100, 0)}% (${v.n} v)`).join('; '), '≥ 85% em cada', vols.every(v => v.area >= 0.85 && v.n >= 8));

console.log(`teste-ossos: ${N_SEM} partidas (1 min por tempo) + ${cenas} comemorações, ${st.amostras} amostras em ${fmt(seg, 1)} s`);
if (detalhe) console.log('  saltos por fonte:', JSON.stringify(st.porFonte));
if (detalhe) ES.NOMES_OSSOS.forEach((n, b) => st.saltosPorOsso[b] && console.log(`  saltos ${n}: ${st.saltosPorOsso[b]}`));
console.log(tabelaTexto(linhas));
process.exit(falhas ? 1 : 0);
