// Chute (seção 5): velocidade (máximo de 30–34 m/s, nunca > 38), colocado a ~0,85 do forte com
// curva de ~1,5 m em 20 m, dispersão a 20 m (erro médio ~0,68 m no colocado de um bom finalizador),
// perna ruim (+40% de erro), força máxima (+15%), % no alvo caindo com a distância e cavadinha
// só com o goleiro adiantado. Referências: pesquisa da Etapa 2 (PESQUISA-ETAPA2.md).
//   node tools/teste-chutes.mjs
import { criarMundo, passo, jogadorPorId } from '../js/sim.js';
import { BOTAO, CAMPO } from '../js/config.js';
import { tabelaTexto, fmt, media, DEG } from './lib/medidas.mjs';

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
  const jog = [{ id: 0, x, z, rumo, time: 0, papel: 'humano', posicao: 'ATA', attr: opc.attr ?? {}, fase: opc.fase ?? 0 }];
  if (opc.goleiro) jog.push({ id: 20, x: opc.goleiro.x, z: opc.goleiro.z ?? 0, rumo: Math.PI, time: 1, papel: opc.goleiro.papel ?? 'ia', posicao: 'GOL', attr: { reflexo: 75, posicionamento: 74, mergulho: 75 } });
  if (opc.pressao) jog.push({ id: 21, x: x - 1.4, z, rumo: 0, time: 1, papel: 'parado', posicao: 'ZAG' });
  const m = criarMundo({ semente, jogadores: jog, bola: { x: x + Math.cos(rumo) * 0.4, z: z + Math.sin(rumo) * 0.4 }, posse: 0, log: true });
  const c = opc.canto ?? 0;
  const ax = c ? Math.cos(rumo + c) : 0, az = c ? Math.sin(rumo + c) : 0;
  const n = Math.max(2, Math.round((opc.forca ?? 0.6) * 48) + (opc.varia ? semente % 5 : 0));
  const bot = BOTAO.CHUTE | (opc.mod ? BOTAO.MOD : 0);
  for (let i = 0; i < n; i++) passo(m, { 0: { x: ax, z: az, botoes: bot } });
  let l = null;
  for (let i = 0; i < 60 && !l; i++) { passo(m, { 0: { x: 0, z: 0, botoes: opc.mod ? BOTAO.MOD : 0 } }); l = m.log.find(e => e.acao); }
  if (!l) return null;
  const mira = m.voo?.mira ?? null;
  const traj = [{ x: m.bola.p.x, z: m.bola.p.z }];
  let linha = null, res = null;
  for (let i = 0; i < 240 && !res; i++) {
    const a = { x: m.bola.p.x, y: m.bola.p.y, z: m.bola.p.z };
    passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    const b = m.bola.p;
    traj.push({ x: b.x, z: b.z });
    if (!linha && b.x >= GX && a.x < GX) {
      const f = (GX - a.x) / (b.x - a.x);
      linha = { y: a.y + (b.y - a.y) * f, z: a.z + (b.z - a.z) * f };
    }
    for (const e of m.eventos) { if (e.tipo === 'gol') res = 'gol'; else if (e.tipo === 'defesa') res = 'defesa'; }
    if (!res && (b.x > GX + 1 || Math.hypot(m.bola.v.x, m.bola.v.z) < 0.5)) res = 'fora';
  }
  const noAlvo = linha && Math.abs(linha.z) < MEIO - 0.11 && linha.y < CAMPO.gol.altura - 0.11;
  return { l, mira, linha, traj, res, noAlvo, m };
}

// ------------------------------------------------ velocidade
{
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
{
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
// O pé "da vez" muda de chute para chute: o batedor começa parado ora com um pé, ora com o outro
// como o próximo a sair do chão (fase da passada). O toque sai sempre do pé livre e a passada é a
// mesma em todos os chutes desta amostra — sem isso, todos saíam com o mesmo pé.
function erros(semBase, opc, N = 60) {
  const bom = [], ruim = [];
  for (let s = 1; s <= N; s++) {
    const r = chute(semBase + s, GX - 20, ((s % 7) - 3) * 1.2, { ...opc, canto: (s % 2 ? 1 : -1) * 0.3, fase: Math.floor(s / 2) % 2 });
    if (!r || !r.mira || !r.linha) continue;
    const e = opc.soLateral ? Math.abs(r.linha.z - r.mira.z) : Math.hypot(r.linha.z - r.mira.z, r.linha.y - r.mira.y);
    (r.l.pe === (opc.attr.pePreferido ?? 1) ? bom : ruim).push(e);
  }
  return { bom, ruim };
}
{
  const attr = { finalizacao: 85, pePreferido: 1, peFraco: 50 };
  // pressão de trás (sem peso no erro de longe): o toque sai com o pé que estiver na vez
  const col = erros(100, { attr, forca: 0.6, mod: true, pressao: true }, 400);
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
{
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

// ------------------------------------------------ cavadinha: só com o goleiro adiantado
{
  let gols = 0, n = 0, naLinha = 0, noAlvo = 0;
  const desf = {};
  for (let s = 1; s <= 80; s++) {
    // goleiro a ~8 m da linha, chutador a ~6 m dele
    const gz = ((s % 5) - 2) * 0.8;
    const r = chute(2000 + s, GX - 14, gz, { attr: { finalizacao: 80 }, forca: 0.35, goleiro: { x: GX - 8, z: gz } });
    if (!r) continue;
    if (r.l.tipo === 'cavadinha') { n++; if (r.res === 'gol') gols++; desf[r.res] = (desf[r.res] ?? 0) + 1; if (r.noAlvo) noAlvo++; }
    const q = chute(3000 + s, GX - 14, gz, { attr: { finalizacao: 80 }, forca: 0.35, goleiro: { x: GX - 1.2, z: 0 } });
    if (q && q.l.tipo === 'cavadinha') naLinha++;
  }
  const pg = gols / Math.max(1, n);
  reg('cavadinha — goleiro a ~8 m, chutador a ~6 m dele', `${n}/80 cavadinhas, ${fmt(pg * 100, 0)}% de gols, ${fmt(noAlvo / Math.max(1, n) * 100, 0)}% no alvo (${Object.entries(desf).map(([k, v]) => k + ' ' + v).join(', ')})`, 'sai cavadinha; 20–50% de gols (dados: ~30%)', n >= 60 && pg >= 0.2 && pg <= 0.5);
  reg('cavadinha — com o goleiro na linha não sai', `${naLinha}/80`, '0', naLinha === 0);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-chutes: REPROVOU (${falhas})` : '\nteste-chutes: PASSOU');
process.exit(falhas ? 1 : 0);
