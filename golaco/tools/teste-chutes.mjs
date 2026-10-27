// Chute (seção 5): velocidade (máximo de 30–34 m/s, nunca > 38), colocado a ~0,85 do forte com
// curva de ~1,5 m em 20 m, dispersão a 20 m (erro médio ~0,68 m no colocado de um bom finalizador),
// perna ruim (+40% de erro), força máxima (+15%), % no alvo caindo com a distância e cavadinha
// da IA só com o goleiro adiantado (a do humano, por dois toques no CHUTE: teste-cavadinha.mjs). Referências: pesquisa da Etapa 2 (PESQUISA-ETAPA2.md).
// Barra cheia (C2, item 13 da FILA; dono, 15/10: "chute com a barra cheia mais alto, com chance de acertar o ângulo"): de
// 18–22 m com o analógico no canto, a MIRA (o erro do chute zerado, separada do sorteio) passa na linha a ~2,1–2,2 m e no
// ângulo; com o sorteio (o erro do jogo, forcaMaxErro valendo), o craque com a perna boa (metade chute forte, metade
// colocado) cruza a linha a ≥ 1,9 m em ≥ 70%, no ângulo (y ≥ 1,9 m e |z| ≥ meia-boca − 0,9 m, dentro do gol) em ≥ 25% e por
// cima do travessão em ≤ 25%; o resto (o bom finalizador, a perna ruim, só o forte) sai na tabela, informativo.
//   node tools/teste-chutes.mjs [--so-cheia] [--sem-cheia <semente base da barra cheia com o sorteio, 7100>]
import { criarMundo, passo, jogadorPorId } from '../js/sim.js';
import { BOTAO, CAMPO, ACOES, BOLA } from '../js/config.js';
import { tabelaTexto, fmt, media, percentil, DEG } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;

/**
 * Um chute do humano de (x, z) para o gol de +x. opc: {attr, forca, canto (rad do analógico em
 * relação ao gol), mod, goleiro: {x, z, papel}, pressao (adversário colado)}. Devolve o log do chute,
 * onde a bola cruzou a linha do gol, a trajetória e o desfecho.
 */
function chute(semente, x, z, opc = {}) {
  const rumo = Math.atan2(-z, GX - x);
  const jog = [{ id: 0, x, z, rumo, time: 0, papel: 'humano', posicao: 'ATA', attr: opc.attr ?? {} }];
  if (opc.goleiro) jog.push({ id: 20, x: opc.goleiro.x, z: opc.goleiro.z ?? 0, rumo: Math.PI, time: 1, papel: opc.goleiro.papel ?? 'ia', posicao: 'GOL', attr: { reflexo: 75, posicionamento: 74, mergulho: 75 } });
  if (opc.pressao) jog.push({ id: 21, x: x - 1.4, z, rumo: 0, time: 1, papel: 'parado', posicao: 'ZAG' });
  const m = criarMundo({ semente, jogadores: jog, bola: { x: x + Math.cos(rumo) * 0.4, z: z + Math.sin(rumo) * 0.4 }, posse: 0, log: true });
  const c = opc.canto ?? 0;
  const ax = c ? Math.cos(rumo + c) : 0, az = c ? Math.sin(rumo + c) : 0;
  const n = Math.max(2, Math.round((opc.forca ?? 0.6) * 48) + (opc.varia ? semente % 5 : 0));
  const bot = BOTAO.CHUTE | (opc.mod ? BOTAO.MOD : 0);
  // ia: a entrada vem da IA jogando pelo humano (a demo): a cavadinha automática com o goleiro adiantado é da IA; a
  // do humano sai com dois toques no CHUTE (teste-cavadinha.mjs)
  const ia = !!opc.ia;
  for (let i = 0; i < n; i++) passo(m, { 0: { x: ax, z: az, botoes: bot, ia } });
  let l = null;
  for (let i = 0; i < 60 && !l; i++) { passo(m, { 0: { x: 0, z: 0, botoes: opc.mod ? BOTAO.MOD : 0, ia } }); l = m.log.find(e => e.acao); }
  if (!l) return null;
  const mira = m.voo?.mira ?? null;
  const traj = [{ x: m.bola.p.x, z: m.bola.p.z }];
  let linha = null, cruza = null, res = null;
  for (let i = 0; i < 240 && !res; i++) {
    const a = { x: m.bola.p.x, y: m.bola.p.y, z: m.bola.p.z, vx: m.bola.v.x, vy: m.bola.v.y, vz: m.bola.v.z };
    passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const b = m.bola.p;
    traj.push({ x: b.x, z: b.z });
    if (!linha && b.x >= GX && a.x < GX) {
      const f = (GX - a.x) / (b.x - a.x);
      linha = { y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    }
    // onde a bola cruzaria a linha sem a trave (barra cheia): batendo na trave ou no travessão antes de cruzar, a reta do
    // passo de antes do toque (a ≤ 0,5 m da linha a ~25–30 m/s: a gravidade quase não pesa)
    if (!cruza && linha) cruza = { ...linha, trave: false };
    if (!cruza && a.x < GX && a.vx > 0 && m.eventos.some(e => e.tipo === 'trave')) {
      const t = (GX - a.x) / a.vx;
      cruza = { y: a.y + a.vy * t - 4.905 * t * t, z: a.z + a.vz * t, trave: true };
    }
    for (const e of m.eventos) { if (e.tipo === 'gol') res = 'gol'; else if (e.tipo === 'defesa') res = 'defesa'; }
    if (!res && (b.x > GX + 1 || Math.hypot(m.bola.v.x, m.bola.v.z) < 0.5)) res = 'fora';
  }
  const noAlvo = linha && Math.abs(linha.z) < MEIO - 0.11 && linha.y < CAMPO.gol.altura - 0.11;
  return { l, mira, linha, cruza, traj, res, noAlvo, m };
}

const SO_CHEIA = process.argv.includes('--so-cheia');

// ------------------------------------------------ velocidade
if (!SO_CHEIA) {
  const fortes = [], colocados = [];
  for (let s = 1; s <= 12; s++) {
    const a = chute(10 + s, GX - 20, ((s % 5) - 2) * 2, { attr: { finalizacao: 99, pePreferido: 1, peFraco: 50 }, forca: 1.0, canto: (s % 2 ? 1 : -1) * 0.3 });
    if (a && a.l.pe === 1) fortes.push(a.l.v);
    const b = chute(10 + s, GX - 20, ((s % 5) - 2) * 2, { attr: { finalizacao: 99, pePreferido: 1, peFraco: 50 }, forca: 1.0, canto: (s % 2 ? 1 : -1) * 0.3, mod: true });
    if (b && b.l.pe === 1) colocados.push(b.l.v);
  }
  const vmax = Math.max(...fortes), vmed = media(fortes);
  reg('velocidade — chute forte do melhor finalizador', `méd ${fmt(vmed, 1)} m/s, máx ${fmt(vmax, 1)} m/s`, '30–34 m/s, nunca > 38', vmed >= 30 && vmed <= 34 && vmax <= 38);
  const razao = media(colocados) / vmed;
  reg('velocidade — colocado ÷ forte', fmt(razao, 2), '0,80–0,90', razao >= 0.8 && razao <= 0.9);
}

// ------------------------------------------------ curva do colocado (~1,5 m em 20 m)
if (!SO_CHEIA) {
  const desvios = [];
  for (let s = 1; s <= 10; s++) {
    const r = chute(30 + s, GX - 20, 0, { attr: { finalizacao: 85 }, forca: 0.6, canto: (s % 2 ? 1 : -1) * 0.35, mod: true });
    if (!r) continue;
    // desvio lateral na linha do gol em relação à direção de saída (como em Whiteside 2010)
    const p0 = r.traj[0], q = r.traj[1];
    const k = r.traj.findIndex(p => p.x >= GX - 0.2);
    const p1 = r.traj[k > 0 ? k : r.traj.length - 1];
    const dx = q.x - p0.x, dz = q.z - p0.z, L = Math.hypot(dx, dz) || 1;
    desvios.push(Math.abs(((p1.x - p0.x) * dz - (p1.z - p0.z) * dx) / L));
  }
  reg('curva — desvio do colocado em 20 m (da direção de saída)', `${fmt(media(desvios), 2)} m`, '1,0–2,0 m (Whiteside 2010: 1,49 m)', media(desvios) >= 1.0 && media(desvios) <= 2.0);
}

// ------------------------------------------------ dispersão a 20 m: colocado, perna ruim, força máxima
function erros(semBase, opc, N = 60) {
  const bom = [], ruim = [];
  for (let s = 1; s <= N; s++) {
    // a perna boa alterna entre as sementes: o pé que bate depende da passada, então assim
    // metade dos chutes sai com a perna boa e metade com a ruim
    const attr = { ...opc.attr, pePreferido: Math.floor(s / 2) % 2 };
    const r = chute(semBase + s, GX - 20, ((s % 7) - 3) * 1.2, { ...opc, attr, canto: (s % 2 ? 1 : -1) * 0.3 });
    if (!r || !r.mira || !r.linha) continue;
    const e = opc.soLateral ? Math.abs(r.linha.z - r.mira.z) : Math.hypot(r.linha.z - r.mira.z, r.linha.y - r.mira.y);
    (r.l.pe === attr.pePreferido ? bom : ruim).push(e);
  }
  return { bom, ruim };
}
if (!SO_CHEIA) {
  const attr = { finalizacao: 85, pePreferido: 1, peFraco: 50 };
  // pressão de trás (sem peso no erro de longe): o toque sai com o pé que estiver na vez
  const col = erros(100, { attr, forca: 0.6, mod: true, pressao: true, varia: true }, 400);
  reg('dispersão — colocado a 20 m (bom finalizador, perna boa)', `erro médio ${fmt(media(col.bom), 2)} m (n ${col.bom.length})`, '0,48–0,88 m (Carlsson 2018: 0,68 m)', media(col.bom) >= 0.48 && media(col.bom) <= 0.88 && col.bom.length >= 120);
  const rz = media(col.ruim) / media(col.bom);
  reg('dispersão — perna ruim ÷ perna boa', `${fmt(rz, 2)} (n ${col.ruim.length})`, '1,25–1,6 (+40%)', rz >= 1.25 && rz <= 1.6 && col.ruim.length >= 120);
  // força máxima × força de jogo, comparando a mesma perna (a de cada grupo com amostra)
  // (só o erro lateral: o vertical em metros depende da curva da bola, mais reta no chute forte)
  const forte = erros(400, { attr, forca: 0.73, pressao: true, soLateral: true, varia: true }, 200), max = erros(400, { attr, forca: 1.0, pressao: true, soLateral: true, varia: true }, 200);
  const razoes = ['bom', 'ruim'].filter(k => forte[k].length >= 15 && max[k].length >= 15).map(k => media(max[k]) / media(forte[k]));
  const rf = razoes.length ? media(razoes) : NaN;
  reg('dispersão — força máxima ÷ força de jogo (mesma perna)', fmt(rf, 2), '1,05–1,3 (+15%)', rf >= 1.05 && rf <= 1.3);
}

// ------------------------------------------------ % no alvo cai com a distância (sem goleiro)
if (!SO_CHEIA) {
  const pct = [];
  for (const d of [11, 18, 25, 32]) {
    let alvo = 0, n = 0;
    for (let s = 1; s <= 60; s++) {
      const ang = (((s * 29) % 61) - 30) / DEG;
      const r = chute(1000 + d * 100 + s, GX - Math.cos(ang) * d, Math.sin(ang) * d, { attr: { finalizacao: 70, pePreferido: 1, peFraco: 50 }, forca: 0.5 + (s % 5) * 0.1, canto: s % 3 ? (s % 2 ? 1 : -1) * 0.3 : 0 });
      if (!r) continue;
      n++; if (r.noAlvo) alvo++;
    }
    pct.push(alvo / n);
  }
  const caindo = pct.every((p, i) => i === 0 || p <= pct[i - 1] + 0.03);
  reg('no alvo — finalizador médio (70), 11/18/25/32 m', pct.map(p => `${fmt(p * 100, 0)}%`).join(' / '), 'cai com a distância; 32 m < 11 m − 20 pts', caindo && pct[3] < pct[0] - 0.2);
}

// ------------------------------------------------ cavadinha da IA: só com o goleiro adiantado
// (a do humano é pedida com dois toques no CHUTE e nunca sai de um toque só: teste-cavadinha.mjs)
if (!SO_CHEIA) {
  let gols = 0, n = 0, naLinha = 0, noAlvo = 0;
  const desf = {};
  for (let s = 1; s <= 80; s++) {
    // goleiro a ~8 m da linha, chutador a ~6 m dele
    const gz = ((s % 5) - 2) * 0.8;
    const r = chute(2000 + s, GX - 14, gz, { attr: { finalizacao: 80 }, forca: 0.35, goleiro: { x: GX - 8, z: gz }, ia: true });
    if (!r) continue;
    if (r.l.tipo === 'cavadinha') { n++; if (r.res === 'gol') gols++; desf[r.res] = (desf[r.res] ?? 0) + 1; if (r.noAlvo) noAlvo++; }
    const q = chute(3000 + s, GX - 14, gz, { attr: { finalizacao: 80 }, forca: 0.35, goleiro: { x: GX - 1.2, z: 0 }, ia: true });
    if (q && q.l.tipo === 'cavadinha') naLinha++;
  }
  const pg = gols / Math.max(1, n);
  reg('cavadinha da IA — goleiro a ~8 m, chutador a ~6 m dele', `${n}/80 cavadinhas, ${fmt(pg * 100, 0)}% de gols, ${fmt(noAlvo / Math.max(1, n) * 100, 0)}% no alvo (${Object.entries(desf).map(([k, v]) => k + ' ' + v).join(', ')})`, 'sai cavadinha; 20–50% de gols (dados: ~30%)', n >= 60 && pg >= 0.2 && pg <= 0.5);
  reg('cavadinha da IA — com o goleiro na linha não sai', `${naLinha}/80`, '0', naLinha === 0);
}

// ------------------------------------------------ barra cheia: mais alto, com chance de acertar o ângulo (C2, item 13)
// De 18–22 m (até 20° da frente do gol), a força cheia (CHUTE segurado ≥ 0,8 s) e o analógico no canto (0,75 rad da
// reta bola–gol), sem goleiro: onde a bola cruza a linha do gol (`cruza`: na trave, onde cruzaria).
// Pesquisa: o canto alto é a colocação que mais converte (StatsBomb, "The Enigma of Shot Placement": canto 50–60% × meio
// 12–13%; Datawrapper sobre 101 mil chutes do StatsBomb Open Data: "quase indefensável") e o chute alto espalha mais que o
// baixo (Hunter 2018, J Biomech, 8.466 chutes): com o erro do jogo (o da pesquisa da Etapa 2: σ ≈ 1,2–2° por eixo no
// craque) o ângulo de 20 m é uma chance, não uma certeza
const R = BOLA.raio, ALT = CAMPO.gol.altura;
const ANG_Z = MEIO - 0.9, ANG_Y = 1.9;
const dentroGol = c => Math.abs(c.z) < MEIO - R && c.y < ALT - R;
const noAngulo = c => dentroGol(c) && c.y >= ANG_Y && Math.abs(c.z) >= ANG_Z;
const porCima = c => c.y > ALT + R;
/** N chutes com a barra cheia; f(s) → {attr, mod}. Devolve as contagens (só a perna `perna`: 'boa', 'ruim' ou 'todas'). */
function barraCheia(semBase, N, f, perna = 'todas') {
  const r = { n: 0, alto: 0, ang: 0, cima: 0, trave: 0, alvo: 0, ys: [], zs: [] };
  for (let s = 1; s <= N; s++) {
    const d = 18 + (s % 5), a = (((s * 29) % 41) - 20) / DEG;
    const o = f(s);
    const q = chute(semBase + s, GX - Math.cos(a) * d, Math.sin(a) * d, { attr: o.attr, forca: 1.0, canto: (s % 2 ? 1 : -1) * 0.75, mod: o.mod, varia: true });
    if (!q || !q.cruza) continue;
    const boa = q.l.pe === (o.attr.pePreferido ?? 1);
    if ((perna === 'boa' && !boa) || (perna === 'ruim' && boa)) continue;
    const c = q.cruza;
    r.n++; r.ys.push(c.y); r.zs.push(Math.abs(c.z));
    if (c.y >= ANG_Y) r.alto++;
    if (noAngulo(c)) r.ang++;
    if (porCima(c)) r.cima++;
    if (dentroGol(c)) r.alvo++;
    if (!porCima(c) && c.y >= ALT - R && Math.abs(c.z) < MEIO + R) r.trave++;
  }
  return r;
}
const pc = (k, r) => fmt(r[k] / Math.max(1, r.n) * 100, 0);
const txtCheia = r => `n ${r.n}: ≥ 1,9 m ${pc('alto', r)}% · no ângulo ${pc('ang', r)}% · por cima ${pc('cima', r)}% · travessão ${pc('trave', r)}% · no gol ${pc('alvo', r)}% · y p10/p50/p90 ${fmt(percentil(r.ys, 0.1))}/${fmt(percentil(r.ys, 0.5))}/${fmt(percentil(r.ys, 0.9))} m`;
{
  // a MIRA (C2: "a meta mede a mira com erro 0, separada do sorteio"): o erro do chute zerado; bom e mau finalizador, as
  // duas pernas, chute forte e colocado
  const e0 = [ACOES.chute.erroBom, ACOES.chute.erroRuim];
  ACOES.chute.erroBom = 0; ACOES.chute.erroRuim = 0;
  const r = barraCheia(7000, 40, s => ({ attr: { finalizacao: [60, 80, 99][s % 3], pePreferido: Math.floor(s / 2) % 2, peFraco: 50 }, mod: s % 4 >= 2 }));
  [ACOES.chute.erroBom, ACOES.chute.erroRuim] = e0;
  const yMed = media(r.ys), yMin = Math.min(...r.ys), yMax = Math.max(...r.ys), zMed = media(r.zs);
  reg('barra cheia — a mira (erro 0), 18–22 m, analógico no canto', `y na linha méd ${fmt(yMed)} m (${fmt(yMin)}–${fmt(yMax)}), |z| méd ${fmt(zMed)} m · no ângulo ${pc('ang', r)}% · por cima ${pc('cima', r)}% (n ${r.n})`,
    `y méd 2,1–2,2 m, todos 2,0–2,3; |z| méd ≥ meia-boca − 0,4 (${fmt(MEIO - 0.4)}); 100% no ângulo, 0 por cima`, r.n >= 36 && yMed >= 2.1 && yMed <= 2.2 && yMin >= 2.0 && yMax <= 2.3 && zMed >= MEIO - 0.4 && r.ang === r.n && r.cima === 0);
}
{
  // com o sorteio: o craque com a perna boa, metade chute forte, metade colocado (a chance de acertar o ângulo)
  const craque = s => ({ attr: { finalizacao: 90 + (s % 10), pePreferido: Math.floor(s / 2) % 2, peFraco: 50 }, mod: s % 4 >= 2 });
  const iSem = process.argv.indexOf('--sem-cheia'), SEM = iSem > 0 ? +process.argv[iSem + 1] : 7100;
  const r = barraCheia(SEM, 480, craque, 'boa');
  reg('barra cheia — craque (90–99), perna boa: cruza a linha a ≥ 1,9 m', txtCheia(r), '≥ 70%', r.n >= 200 && r.alto / r.n >= 0.7);
  reg('barra cheia — craque (90–99), perna boa: no ângulo', `${pc('ang', r)}% (y ≥ 1,9 m, |z| ≥ ${fmt(ANG_Z)} m, dentro do gol)`, '≥ 25%', r.n >= 200 && r.ang / r.n >= 0.25);
  reg('barra cheia — craque (90–99), perna boa: por cima do travessão', `${pc('cima', r)}%`, '≤ 25%', r.n >= 200 && r.cima / r.n <= 0.25);
  // informativo (o que o pedido não fixa): só o chute forte, o bom finalizador, a perna ruim
  const forte = barraCheia(7100, 480, s => ({ ...craque(s), mod: false }), 'boa');
  linhas.push(['barra cheia — craque, perna boa, só o chute forte (informativo)', txtCheia(forte), '—', 'INFO']);
  const bom = barraCheia(7700, 480, s => ({ attr: { finalizacao: 80 + (s % 10), pePreferido: Math.floor(s / 2) % 2, peFraco: 50 }, mod: s % 4 >= 2 }), 'boa');
  linhas.push(['barra cheia — bom finalizador (80–89), perna boa (informativo)', txtCheia(bom), '—', 'INFO']);
  const ruim = barraCheia(7100, 480, craque, 'ruim');
  linhas.push(['barra cheia — craque, perna ruim (informativo)', txtCheia(ruim), '—', 'INFO']);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-chutes: REPROVOU (${falhas})` : '\nteste-chutes: PASSOU');
process.exit(falhas ? 1 : 0);
