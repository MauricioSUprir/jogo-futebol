// Chute (seção 5): velocidade (máximo de 30–34 m/s, nunca > 38), colocado a ~0,85 do forte com
// curva de ~1,5 m em 20 m, dispersão a 20 m (erro médio ~0,68 m no colocado de um bom finalizador),
// perna ruim (+40% de erro), força máxima (+15%), % no alvo caindo com a distância e cavadinha
// da IA só com o goleiro adiantado (a do humano, por dois toques no CHUTE: teste-cavadinha.mjs). Referências: pesquisa da Etapa 2 (PESQUISA-ETAPA2.md).
// Barra cheia (C2, item 13 da FILA; dono, 15/10: "chute com a barra cheia mais alto, com chance de acertar o ângulo"): de
// 18–22 m com o analógico no canto, a MIRA (o erro do chute zerado, separada do sorteio) passa NA linha a cheia.y (~2,1 m)
// e no ângulo; com o erro zerado, de perto (4–9 m) é 100% gol sem tocar no travessão e na varredura de 9–35 m (até 45°,
// analógico solto e no canto, forte e colocado, força 0,92 e 1) ≤ 1% sem gol (a busca da saída com o voo que bate no
// travessão saltava: main 3,7%); com o sorteio (o erro do jogo, forcaMaxErro valendo), o craque com a perna boa (metade
// chute forte, metade colocado) cruza a linha a ≥ 1,9 m em ≥ 70%, no ângulo (y ≥ 1,9 m e |z| ≥ meia-boca − 0,9 m, dentro
// do gol) em ≥ 25% e por cima do travessão em ≤ 25% — em 9 sementes juntas (~2.160 chutes, ep ≤ 1 ponto; 28/10); com o
// analógico SOLTO a barra cheia fica na altura de antes, bit a bit (decisão do dono, 28/10: "só o chute mirado sobe"); o
// resto (com o goleiro, o bom finalizador, a perna ruim, só o forte) sai na tabela, informativo, com o número da main ao lado.
//   node tools/teste-chutes.mjs [--so-cheia] [--sem-cheia <sementes da barra cheia com o sorteio, separadas por vírgula;
//   padrão as 9: 7100,31100,47100,13100,23100,59100,67100,83100,97100>] [--js <pasta js>]
//   (--js: mede outra cópia da lógica, ex.: a main — o "antes")
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tabelaTexto, fmt, media, percentil, DEG } from './lib/medidas.mjs';
const iJs = process.argv.indexOf('--js');
const JS = iJs > 0 ? path.resolve(process.argv[iJs + 1]) : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../js');
const imp = f => import(pathToFileURL(path.join(JS, f)).href);
const { criarMundo, passo, jogadorPorId } = await imp('sim.js');
const { BOTAO, CAMPO, ACOES, BOLA } = await imp('config.js');
const P = await imp('partida.js');
const { assumirControle } = await imp('acoes.js');
const { parametros } = await imp('jogador.js');
const { criarRng } = await imp('rng.js');
const { lerp } = await imp('mat.js');

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
  // a bola logo depois do toque (a assinatura do chute: o caso "analógico solto" compara bit a bit com a curva de antes)
  const v0 = [m.bola.p.x, m.bola.p.y, m.bola.p.z, m.bola.v.x, m.bola.v.y, m.bola.v.z, m.bola.w.x, m.bola.w.y, m.bola.w.z];
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
  return { l, mira, v0, linha, cruza, traj, res, noAlvo, m };
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
// reta bola–gol): onde a bola cruza a linha do gol (`cruza`: batendo na trave ou no travessão antes, onde cruzaria).
// Pesquisa: o canto alto é a colocação que mais converte (StatsBomb, "The Enigma of Shot Placement": canto 50–60% × meio
// 12–13%; Datawrapper sobre 101 mil chutes do StatsBomb Open Data: "quase indefensável") e o chute alto espalha mais que o
// baixo (Hunter 2018, J Biomech, 8.466 chutes): com o erro do jogo (o da pesquisa da Etapa 2: σ ≈ 1,2–2° por eixo no
// craque) o ângulo de 20 m é uma chance, não uma certeza
const R = BOLA.raio, ALT = CAMPO.gol.altura;
const ANG_Z = MEIO - 0.9, ANG_Y = 1.9;
const dentroGol = c => Math.abs(c.z) < MEIO - R && c.y < ALT - R;
const noAngulo = c => dentroGol(c) && c.y >= ANG_Y && Math.abs(c.z) >= ANG_Z;
const porCima = c => c.y > ALT + R;
const GOLEIRO_LINHA = { x: GX - 1.2, z: 0 };
const GK_ATTR = { reflexo: 75, posicionamento: 74, mergulho: 75 };
// O goleiro REALISTA (C1, #558: goleiro.js chanceReal, a defesa pela folga física; só na partida — o mundo de treino do
// chute() acima defende pela logística de antes, GOLEIRO.logit): uma partida de verdade com a bola rolando (o 1º tempo de
// uma IA × IA, semente 5), os outros 20 longe da jogada, o atacante e o goleiro com os atributos do chute() (jogador.js
// parametros). O goleiro começa na linha e tem 1 s com o atacante parado com a bola para ir à posição dele (a bissetriz, ~1,8
// m da linha, "set"); o atacante volta ao lugar com os pés recomeçando (o pé do chute não muda) e carrega o CHUTE como no
// chute(). Devolve {l, res, trave} (trave: bateu na trave ou no travessão antes do desfecho).
let partidaBase = null;
function chuteNaPartida(semente, x, z, opc) {
  if (!partidaBase) {
    const m0 = P.criarPartida({ semente: 5, minutosPorTempo: 60, log: true });
    for (let i = 0; i < 900 && !(m0.partida.estado === 'jogo' && !m0.parada && i > 300); i++) P.passoPartida(m0, P.entradaDemoPartida(m0));
    if (m0.partida.estado !== 'jogo' || m0.parada || m0.ataca[0] !== 1) throw new Error('teste-chutes: a partida base não ficou com a bola rolando');
    partidaBase = m0;
  }
  const m = structuredClone(partidaBase);
  m.rng = criarRng(semente); m.log.length = 0;
  m.voo = null; m.naMao = null; m.posse = null; m.ultimoToque = null; m.desvio = -1;
  if (m.regraMao) { m.regraMao.semMao = -1; m.regraMao.soltou = -1; }
  for (const j of m.jogadores) { j.defesa = null; j.mergulho = null; j.pedido = null; j.carga = null; j.recebe = null; j.segura = null; j.saindo = false; }
  const a = m.jogadores.find(j => j.time === 0 && j.posicao === 'ATA'), g = m.jogadores.find(j => j.time === 1 && j.posicao === 'GOL');
  a.par = parametros(opc.attr); g.par = parametros(GK_ATTR);
  let k = 0;
  for (const o of m.jogadores) {
    if (o === a || o === g) continue;
    if (o.posicao === 'GOL') P.teleportar(o, -GX + 1.2, 0, 0);
    else { P.teleportar(o, -20 - (k % 4) * 6, -24 + (k % 9) * 6, o.time === 0 ? 0 : Math.PI); k++; }
  }
  const rumo = Math.atan2(-z, GX - x);
  const poe = () => {
    P.teleportar(a, x, z, rumo);
    const b = m.bola;
    b.p.x = x + Math.cos(rumo) * 0.4; b.p.z = z + Math.sin(rumo) * 0.4; b.p.y = BOLA.raio;
    b.v.x = b.v.y = b.v.z = 0; b.w.x = b.w.y = b.w.z = 0; b.rolando = true;
    m.posse = a.id;
    assumirControle(m, 0, a);
  };
  poe();
  P.teleportar(g, GX - 1.2, 0, Math.PI);
  for (let i = 0; i < 60; i++) P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
  m.log.length = 0; poe();
  const c = opc.canto ?? 0;
  const ax = c ? Math.cos(rumo + c) : 0, az = c ? Math.sin(rumo + c) : 0;
  const n = Math.max(2, Math.round((opc.forca ?? 0.6) * 48) + (opc.varia ? semente % 5 : 0));
  const bot = BOTAO.CHUTE | (opc.mod ? BOTAO.MOD : 0);
  for (let i = 0; i < n; i++) P.passoPartida(m, { x: ax, z: az, botoes: bot });
  let l = null;
  for (let i = 0; i < 60 && !l; i++) { P.passoPartida(m, { x: 0, z: 0, botoes: opc.mod ? BOTAO.MOD : 0 }); l = m.log.find(e => e.acao && e.id === a.id); }
  if (!l) return null;
  let res = null, trave = false;
  for (let i = 0; i < 240 && !res; i++) {
    const ev = P.passoPartida(m, { x: 0, z: 0, botoes: 0 });
    for (const e of ev) {
      if (e.tipo === 'gol') res = e.time === 0 || e.time == null ? 'gol' : 'contra';
      else if (e.tipo === 'defesa' && e.id === g.id) res = 'defesa';
      else if (e.tipo === 'bateuCorpo' && e.id !== g.id && e.id !== a.id) res = 'bloq';
      else if (e.tipo === 'trave' && !res) trave = true;
    }
    const b = m.bola.p;
    if (!res && (b.x > GX + 1 || Math.hypot(m.bola.v.x, m.bola.v.z) < 0.5)) res = 'fora';
    if (!res && m.naMao === g.id) res = 'defesa';
  }
  return { l, res: res ?? 'fora', trave };
}
/**
 * N chutes com a barra cheia; f(s) → {attr, mod}. Devolve as contagens (só a perna `perna`: 'boa', 'ruim' ou 'todas').
 * goleiro: 'treino' = o goleiro da IA no mundo de treino, começando na linha (GOLEIRO.logit); 'partida' = o goleiro
 * realista da partida posicionado pela IA dele (chuteNaPartida) — os desfechos gol/defesa/fora; o chute defendido não
 * cruza a linha.
 */
function barraCheia(semBase, N, f, perna = 'todas', goleiro = false) {
  const r = { n: 0, alto: 0, ang: 0, cima: 0, trave: 0, toque: 0, alvo: 0, gol: 0, def: 0, fora: 0, ys: [], zs: [] };
  for (let s = 1; s <= N; s++) {
    const d = 18 + (s % 5), a = (((s * 29) % 41) - 20) / DEG;
    const o = f(s);
    const opc = { attr: o.attr, forca: 1.0, canto: (s % 2 ? 1 : -1) * 0.75, mod: o.mod, varia: true, goleiro: goleiro === 'treino' ? GOLEIRO_LINHA : null };
    const q = goleiro === 'partida' ? chuteNaPartida(semBase + s, GX - Math.cos(a) * d, Math.sin(a) * d, opc) : chute(semBase + s, GX - Math.cos(a) * d, Math.sin(a) * d, opc);
    if (!q || (!goleiro && !q.cruza)) continue;
    const boa = q.l.pe === (o.attr.pePreferido ?? 1);
    if ((perna === 'boa' && !boa) || (perna === 'ruim' && boa)) continue;
    r.n++;
    if (q.res === 'gol') r.gol++; else if (q.res === 'defesa') r.def++; else r.fora++;
    if (q.cruza?.trave || q.trave) r.toque++; // trave ou travessão antes de cruzar a linha
    const c = q.cruza;
    if (!c) continue;
    r.ys.push(c.y); r.zs.push(Math.abs(c.z));
    if (c.y >= ANG_Y) r.alto++;
    if (noAngulo(c)) r.ang++;
    if (porCima(c)) r.cima++;
    if (dentroGol(c)) r.alvo++;
    if (!porCima(c) && c.y >= ALT - R && Math.abs(c.z) < MEIO + R) r.trave++;
  }
  return r;
}
/** Soma as contagens de várias rodadas de barraCheia (as metas em 9 sementes juntas). */
function juntar(rs) {
  const o = { n: 0, alto: 0, ang: 0, cima: 0, trave: 0, toque: 0, alvo: 0, gol: 0, def: 0, fora: 0, ys: [], zs: [] };
  for (const r of rs) for (const k in o) { if (Array.isArray(o[k])) o[k].push(...r[k]); else o[k] += r[k]; }
  return o;
}
const pc = (k, r) => fmt(r[k] / Math.max(1, r.n) * 100, 0);
const pc1 = (k, r) => fmt(r[k] / Math.max(1, r.n) * 100, 1);
const txtCheia = r => `n ${r.n}: ≥ 1,9 m ${pc('alto', r)}% · no ângulo ${pc('ang', r)}% · por cima ${pc('cima', r)}% · travessão ${pc('trave', r)}% · trave ou travessão ${pc('toque', r)}% · no gol ${pc('alvo', r)}% · y p10/p50/p90 ${fmt(percentil(r.ys, 0.1))}/${fmt(percentil(r.ys, 0.5))}/${fmt(percentil(r.ys, 0.9))} m`;
const txtGoleiro = r => `n ${r.n}: gols ${pc('gol', r)}% · defesas ${pc('def', r)}% · fora ${pc('fora', r)}% · trave ou travessão ${pc('toque', r)}%`;
// a população: metade chute forte, metade colocado, os dois cantos, destros e canhotos — independentes (antes o
// pePreferido e o colocado andavam juntos e a "perna boa" era só o colocado)
const populacao = fin0 => s => ({ attr: { finalizacao: fin0 + (s % 10), pePreferido: Math.floor(s / 4) % 2, peFraco: 50 }, mod: Math.floor(s / 2) % 2 === 1 });
/** Com o erro do chute zerado (a mira, separada do sorteio). */
function semErro(fn) {
  const e0 = [ACOES.chute.erroBom, ACOES.chute.erroRuim];
  ACOES.chute.erroBom = 0; ACOES.chute.erroRuim = 0;
  try { return fn(); } finally { [ACOES.chute.erroBom, ACOES.chute.erroRuim] = e0; }
}
{
  // a MIRA (C2: "a meta mede a mira com erro 0, separada do sorteio"): bom e mau finalizador, as duas pernas, chute forte
  // e colocado; a mira passa NA linha a cheia.y (a conta no voo sem o gol: mira.js saidaNaLinha)
  const r = semErro(() => barraCheia(7000, 40, s => ({ attr: { finalizacao: [60, 80, 99][s % 3], pePreferido: Math.floor(s / 2) % 2, peFraco: 50 }, mod: s % 4 >= 2 })));
  const yMed = media(r.ys), yMin = Math.min(...r.ys), yMax = Math.max(...r.ys), zMin = Math.min(...r.zs), zMed = media(r.zs);
  reg('barra cheia — a mira (erro 0), 18–22 m, analógico no canto', `y na linha méd ${fmt(yMed)} m (${fmt(yMin)}–${fmt(yMax)}), |z| méd ${fmt(zMed)} m (mín ${fmt(zMin)}) · no ângulo ${pc('ang', r)}% · por cima ${pc('cima', r)}% · trave ou travessão ${r.toque} (n ${r.n})`,
    `y 2,0–2,2 m em todos; |z| ≥ meia-boca − 0,9 (${fmt(ANG_Z)}); 100% no ângulo, 0 por cima e 0 na trave`, r.n >= 36 && yMin >= 2.0 && yMax <= 2.2 && zMin >= ANG_Z && r.ang === r.n && r.cima === 0 && r.toque === 0);
}
{
  // de perto (revisão do C2): a mira medida 0,4 m antes da linha subia mais até ela (a 4–5 m a elevação é de 38–44°) e a
  // barra cheia passava na linha a 2,24–2,49 m — no travessão, com o erro zerado (main: 100% de gols e 0 no travessão)
  let n = 0, gols = 0, toque = 0, s = 0;
  semErro(() => {
    for (let d = 4; d <= 9; d++) for (let ang = -30; ang <= 30; ang += 10) for (const canto of [-0.75, 0, 0.75]) {
      s++;
      const a = ang / DEG;
      const q = chute(7300 + s, GX - Math.cos(a) * d, Math.sin(a) * d, { attr: { finalizacao: [60, 80, 99][s % 3], pePreferido: 1, peFraco: 50 }, forca: 1.0, canto });
      if (!q) continue;
      n++; if (q.res === 'gol') gols++; if (q.cruza?.trave) toque++;
    }
  });
  reg('barra cheia — de perto (4–9 m, até 30°), chute forte, erro 0', `${fmt(gols / Math.max(1, n) * 100, 1)}% de gols, ${toque} na trave ou no travessão (n ${n})`, '100% de gols, 0 na trave (main: 100%, 0)', n >= 120 && gols === n && toque === 0);
}
{
  // a varredura (revisão do C2): a busca do giro do colocado e a da elevação usavam o voo com o gol; com a mira alta o voo
  // de teste batia no travessão, na haste ou no véu no passo em que chegava à distância da mira, voltava 'caiu' e a busca
  // saltava (o colocado a 19 m passava a 8 m do gol; a 35 m, na trave). Erro zerado: forte e colocado, analógico solto e no
  // canto, 9–35 m, até 45°, força 0,92 e 1. Com o analógico solto na conta de antes (28/10, decisão do dono) 0,8%: 7 dos 9
  // sem gol são o colocado solto de 23–35 m, o mesmo da main (a conta de antes, bit a bit); os 2 no canto, 35 m a 45°
  let n = 0, sem = 0, s = 0;
  const pior = [];
  semErro(() => {
    for (const forca of [0.92, 1.0]) for (const mod of [false, true]) for (let d = 9; d <= 35; d += 2) for (let ang = -45; ang <= 45; ang += 15) for (const canto of [-0.75, 0, 0.75]) {
      s++;
      const a = ang / DEG;
      const q = chute(7400 + s, GX - Math.cos(a) * d, Math.sin(a) * d, { attr: { finalizacao: [60, 80, 99][s % 3], pePreferido: s % 2, peFraco: 50 }, forca, canto, mod });
      if (!q) continue;
      n++;
      if (q.res !== 'gol') { sem++; if (pior.length < 3) pior.push(`${d} m ${ang}° ${mod ? 'col' : 'forte'} ${fmt(forca)}`); }
    }
  });
  reg('barra cheia — varredura com o erro zerado (9–35 m, até 45°, solto e no canto, forte e colocado)', `${fmt(sem / Math.max(1, n) * 100, 1)}% sem gol (${sem}/${n}${pior.length ? ': ' + pior.join(', ') : ''})`, '≤ 1% (main: 3,7%; a versão anterior do C2, ad44206f, com o solto subindo, 0,2%)', n >= 1000 && sem / n <= 0.01);
}
{
  // o analógico SOLTO (decisão do dono, 28/10: "só o chute mirado sobe"): sem mirar (o jogo escolhe o lado longe do goleiro),
  // a barra cheia fica na altura de antes, BIT A BIT — a mira (y, z), a bola logo depois do toque (posição, velocidade,
  // giro) e onde ela cruza a linha iguais aos da mesma conta com a barra cheia desligada (ACOES.chute.cheia.de = 1: o
  // caminho da main 46dd59ab, conferido com --js na main), e a altura da mira na curva de antes, lerp(yAlvo, força²) com a
  // força acima de 0,9: de 1,44 a 1,70 m (a barra cheia mirada vai a 2,1 m na linha).
  // Com o erro zerado (a mira) e com o sorteio (o chute inteiro); 9–30 m, até 40°, forte e colocado, força 0,92 e 1, as
  // duas pernas. Antes (ad44206f) a mira solta subia a 2,1 m na linha (contra o goleiro realista: −6,9 pontos de gol)
  const casos = [];
  for (const erro0 of [true, false]) for (const forca of [0.92, 1.0]) for (const mod of [false, true]) for (let d = 9; d <= 30; d += 3) for (let ang = -40; ang <= 40; ang += 20) casos.push({ s: casos.length + 1, erro0, forca, mod, d, ang });
  const roda = () => casos.map(c => {
    const a = c.ang / DEG;
    const run = () => chute(7600 + c.s, GX - Math.cos(a) * c.d, Math.sin(a) * c.d, { attr: { finalizacao: [60, 80, 99][c.s % 3], pePreferido: c.s % 2, peFraco: 50 }, forca: c.forca, canto: 0, mod: c.mod });
    const q = c.erro0 ? semErro(run) : run();
    return q ? [...q.v0, q.mira?.y ?? null, q.mira?.z ?? null, q.linha?.y ?? null, q.linha?.z ?? null, q.res] : null;
  });
  const agora = roda(), kc = ACOES.chute.cheia;
  let antes = agora; // (--js na main: sem a barra cheia, ela mesma é o "antes")
  if (kc) { const de0 = kc.de; kc.de = 1; try { antes = roda(); } finally { kc.de = de0; } }
  let n = 0, dif = 0, curva = 0;
  const ys = [], yc = f => lerp(ACOES.chute.yAlvo[0], ACOES.chute.yAlvo[1], f * f), yLo = yc(0.9) - 1e-9, yHi = yc(1) + 1e-9;
  casos.forEach((c, i) => {
    const x = agora[i], y = antes[i];
    if (!x || !y) { if (x !== y) dif++; return; }
    n++;
    if (x.some((v, k) => !Object.is(v, y[k]))) dif++;
    if (!(x[9] >= yLo && x[9] <= yHi)) curva++;
    if (c.erro0 && x[11] != null) ys.push(x[11]);
  });
  reg('barra cheia — analógico SOLTO: a altura de antes, bit a bit (erro 0 e com o sorteio; 9–30 m, forte e colocado, força 0,92 e 1)',
    `${dif} de ${n} chutes diferentes da curva de antes · mira fora da curva de antes (${fmt(yLo)}–${fmt(yHi)} m): ${curva} · y na linha (erro 0) méd ${fmt(media(ys))} m`,
    '0 diferente (a mira, a saída e a linha iguais à main), n ≥ 300', n >= 300 && dif === 0 && curva === 0);
}
{
  // com o sorteio: o craque com a perna boa, metade chute forte, metade colocado (a chance de acertar o ângulo). As metas
  // em 9 sementes JUNTAS (revisão de 28/10): numa semente só (n ~240, ep ~3 pontos) as três passavam na 7100 do CI e
  // reprovavam alguma em 3 de 9 (juntas: ≥ 1,9 m 72,3%, ângulo 27,0%, por cima 8,7%); juntas, n ~2.160 e ep ≤ 1 ponto. A
  // meta é a mesma, sobre o número medido (sem "reprova só quando prova": com a margem do ângulo a ~2 ep, aceitar o
  // intervalo seria afrouxar a meta)
  const craque = populacao(90);
  const iSem = process.argv.indexOf('--sem-cheia');
  const SEMS = iSem > 0 ? process.argv[iSem + 1].split(',').map(Number) : [7100, 31100, 47100, 13100, 23100, 59100, 67100, 83100, 97100];
  const SEM = SEMS[0];
  const porSem = SEMS.map(s0 => barraCheia(s0, 480, craque, 'boa'));
  const r = juntar(porSem), nMin = 200 * SEMS.length;
  const ep = k => fmt(Math.sqrt((r[k] / r.n) * (1 - r[k] / r.n) / r.n) * 100, 1);
  linhas.push([`barra cheia — craque, perna boa, por semente (${SEMS.length}; informativo)`, porSem.map((q, i) => `${SEMS[i]}: ${pc('alto', q)}/${pc('ang', q)}/${pc('cima', q)}%`).join(' · '), '≥ 1,9 m / ângulo / por cima (cada uma ep ~3 pontos)', 'INFO']);
  reg(`barra cheia — craque (90–99), perna boa: cruza a linha a ≥ 1,9 m (${SEMS.length} sementes)`, `${pc1('alto', r)}% · ep ${ep('alto')} ponto · ${txtCheia(r)}`, '≥ 70% (main: 22%)', r.n >= nMin && r.alto / r.n >= 0.7);
  reg(`barra cheia — craque (90–99), perna boa: no ângulo (${SEMS.length} sementes)`, `${pc1('ang', r)}% (y ≥ 1,9 m, |z| ≥ ${fmt(ANG_Z)} m, dentro do gol) · ep ${ep('ang')} ponto`, '≥ 25% (main: 9%)', r.n >= nMin && r.ang / r.n >= 0.25);
  reg(`barra cheia — craque (90–99), perna boa: por cima do travessão (${SEMS.length} sementes)`, `${pc1('cima', r)}% · ep ${ep('cima')} ponto`, '≤ 25% (main: 1%)', r.n >= nMin && r.cima / r.n <= 0.25);
  // informativo (o que o pedido não fixa), com a main ao lado (a mesma conta: `--js` na pasta da main)
  const forte = barraCheia(SEM, 480, s => ({ ...craque(s), mod: false }), 'boa');
  linhas.push(['barra cheia — craque, perna boa, só o chute forte (informativo)', txtCheia(forte), 'main: ≥ 1,9 m 29% · ângulo 9% · por cima 2% · trave ou travessão 18%', 'INFO']);
  const bom = barraCheia(7700, 480, populacao(80), 'boa');
  linhas.push(['barra cheia — bom finalizador (80–89), perna boa (informativo)', txtCheia(bom), 'main: ≥ 1,9 m 29% · ângulo 10% · por cima 3% · trave ou travessão 15%', 'INFO']);
  const ruim = barraCheia(SEM, 480, craque, 'ruim');
  linhas.push(['barra cheia — craque, perna ruim (informativo)', txtCheia(ruim), 'main: ≥ 1,9 m 26% · ângulo 10% · por cima 3% · trave ou travessão 15%', 'INFO']);
  // com o goleiro (revisão do C2): a barra cheia não pode fazer bem menos gols que antes sem o dono decidir (CONTRATOS.md, C2:
  // as opções com os números). Dois goleiros: o do mundo de treino (a logística de antes, GOLEIRO.logit: quase não premia o
  // ângulo) e o REALISTA da partida (C1, #558; posicionado pela IA dele). Com os dois a diferença é a bola que sai (por cima
  // e no travessão), não a defesa: o realista deixa entrar ~95% das bolas no canto a meia altura e ~97% no ângulo
  const gk = barraCheia(SEM, 480, craque, 'boa', 'treino');
  linhas.push(['barra cheia — craque, perna boa, COM o goleiro do treino na linha (informativo)', txtGoleiro(gk), 'main: gols 55% · defesas 18% · fora 27% · trave ou travessão 16%', 'INFO']);
  const gkBom = barraCheia(7700, 480, populacao(80), 'boa', 'treino');
  linhas.push(['barra cheia — bom finalizador, perna boa, COM o goleiro do treino (informativo)', txtGoleiro(gkBom), 'main: gols 42% · defesas 23% · fora 35% · trave ou travessão 15%', 'INFO']);
  const gkReal = barraCheia(SEM, 480, craque, 'boa', 'partida');
  // (main × C2 na grade de 3.240 chutes contra o realista posicionado, sonda-rev do C2, 28/10: 69,5 → 67,7% de gols, o
  // analógico solto igual, 66,1%, e no canto 71,3 → 68,5%; a versão anterior, ad44206f, com o solto subindo, 65,4%)
  linhas.push(['barra cheia — craque, perna boa, COM o goleiro REALISTA da partida (informativo)', txtGoleiro(gkReal), 'main: gols 72% · defesas 10% · fora 18% · trave ou travessão 15% (grade de 3.240: main 69,5% → C2 67,7%; solto igual, no canto 71,3 → 68,5%)', 'INFO']);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-chutes: REPROVOU (${falhas})` : '\nteste-chutes: PASSOU');
process.exit(falhas ? 1 : 0);
