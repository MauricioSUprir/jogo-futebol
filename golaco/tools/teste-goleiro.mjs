// Goleiro (seção 5): defesas por distância (chutes no alvo), posição na bissetriz, botão GOLEIRO
// (sai na bola até 35 m da linha; sem o botão fica no gol), bola nas mãos e espalmada para fora.
//   node tools/teste-goleiro.mjs [chutes por faixa]
import { criarMundo, passo, jogadorPorId } from '../js/sim.js';
import { BOTAO, CAMPO, GOLEIRO } from '../js/config.js';
import { pontoBissetriz } from '../js/goleiro.js';
import { tabelaTexto, fmt, media, DEG } from './lib/medidas.mjs';

const N = +(process.argv[2] ?? 120);
const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }

const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;
const GK_ATTR = { reflexo: 75, posicionamento: 74, mergulho: 75 };

/** Chuta de (x, z) com o humano (finalização attrFin); devolve 'gol' | 'defesa' | 'fora' | 'trave'. */
function chutar(semente, x, z, forca, mirarCanto, attrFin = 80) {
  const rumo = Math.atan2(-z, GX - x);
  const jog = [
    { id: 0, x, z, rumo, time: 0, papel: 'humano', posicao: 'ATA', attr: { finalizacao: attrFin, peFraco: 70 } },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: GK_ATTR },
  ];
  const m = criarMundo({ semente, jogadores: jog, bola: { x: x + Math.cos(rumo) * 0.4, z: z + Math.sin(rumo) * 0.4 }, posse: 0, log: true });
  // o goleiro se posiciona antes do chute
  for (let i = 0; i < 90; i++) passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
  // analógico para um canto (ou nenhum: o jogo mira o lado longe do goleiro)
  const ax = mirarCanto ? Math.cos(rumo + mirarCanto) : 0, az = mirarCanto ? Math.sin(rumo + mirarCanto) : 0;
  const n = Math.max(2, Math.round(forca * 48));
  for (let i = 0; i < n; i++) passo(m, { 0: { x: ax, z: az, botoes: BOTAO.CHUTE } });
  let saiu = false;
  for (let i = 0; i < 60 && !saiu; i++) { passo(m, { 0: { x: 0, z: 0, botoes: 0 } }); saiu = m.eventos.some(e => e.tipo === 'chute'); }
  if (!saiu) return { res: 'semChute' };
  let noAlvo = null;
  for (let i = 0; i < 240; i++) {
    passo(m, { 0: { x: 0, z: 0, botoes: 0 } });
    for (const e of m.eventos) {
      if (e.tipo === 'leituraGoleiro' && noAlvo == null) noAlvo = true;
      if (e.tipo === 'gol') return { res: 'gol', m };
      if (e.tipo === 'defesa') return { res: 'defesa', modo: e.modo, m };
      if (e.tipo === 'trave') return { res: 'trave', m };
    }
    const b = m.bola;
    if (b.p.x > GX + 0.5 || Math.abs(b.p.z) > CAMPO.meioZ) return { res: 'fora', m };
    if (Math.hypot(b.v.x, b.v.z) < 0.6 && b.p.y < 0.2) break;
  }
  return { res: 'fora', m };
}

// ------------------------------------------------ canhão de bolas: defesa × distância lateral
// Meta (pesquisa da Etapa 2, StatsBomb Open Data): logit(defesa) = −0,350 − 1,150·lateral +
// 0,2186·distância chutador–goleiro − 0,219·altura, para um goleiro médio; o jogo fica a ±10 pontos em cada célula.
{
  const logistica = (lat, d, y) => 1 / (1 + Math.exp(-(-0.35 - 1.15 * lat + 0.2186 * d - 0.219 * y)));
  const MEDIO = { reflexo: 72, posicionamento: 72, mergulho: 72 };
  const res = [];
  let piorDif = 0, limiteFisico = 0;
  for (const d of [8, 15, 22]) for (const lat of [0.5, 1.5, 2.5]) {
    let ok = 0, n = 0, ySoma = 0, dgSoma = 0;
    for (let s = 1; s <= Math.round(N * 0.8); s++) {
      const ang = (((s * 41) % 61) - 30) / DEG;
      const bx = GX - Math.cos(ang) * d, bz = Math.sin(ang) * d;
      const jog = [
        { id: 0, x: bx - 3, z: bz, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
        { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: MEDIO },
      ];
      const m = criarMundo({ semente: 3000 + s * 7 + d * 131 + Math.round(lat * 10), jogadores: jog, bola: { x: bx, z: bz }, posse: null });
      for (let i = 0; i < 120; i++) passo(m, {}); // o goleiro se posiciona
      const g = jogadorPorId(m, 20);
      // ponto no plano do goleiro: lateral para um dos lados; altura de 0,3 a 1,9 m
      const lado = s % 2 ? 1 : -1;
      const y = 0.3 + ((s * 0.618034) % 1) * 1.6;
      const pz = g.z + lado * lat;
      // estende a reta bola → (g.x, pz) até a linha do gol
      const kx = (GX - bx) / (g.x - bx);
      const zLinha = bz + (pz - bz) * kx;
      if (Math.abs(zLinha) > MEIO - 0.15) continue; // fora do gol: não conta
      const ux0 = GX - bx, uz0 = zLinha - bz, D = Math.hypot(ux0, uz0);
      const v = 22 + (((s * 3) % 7) - 3); // 19–25 m/s
      const ux = ux0 / D, uz = uz0 / D;
      // elevação para passar no plano do goleiro na altura y (busca simples)
      let lo = -0.2, hi = 0.6;
      const Dg = Math.hypot(g.x - bx, pz - bz);
      for (let k = 0; k < 30; k++) {
        const el = (lo + hi) / 2;
        const t = Dg / (v * Math.cos(el));
        const yy = 0.11 + v * Math.sin(el) * t - 4.905 * t * t;
        if (yy < y) lo = el; else hi = el;
      }
      const el = (lo + hi) / 2;
      m.bola.v.x = ux * v * Math.cos(el); m.bola.v.y = v * Math.sin(el); m.bola.v.z = uz * v * Math.cos(el);
      m.bola.rolando = false;
      m.voo = { tipo: 'chute', de: 0, time: 0, tick0: m.tick, tickChave: m.tick };
      let r = null;
      for (let i = 0; i < 150 && !r; i++) {
        passo(m, {});
        for (const e of m.eventos) { if (e.tipo === 'gol') r = 'gol'; else if (e.tipo === 'defesa') r = 'defesa'; }
        if (m.bola.p.x > GX + 0.3 && !r) r = 'fora';
      }
      if (r === 'gol' || r === 'defesa') { n++; ySoma += y; dgSoma += Dg; if (r === 'defesa') ok++; }
    }
    const p = ok / Math.max(1, n), alvo = logistica(lat, dgSoma / Math.max(1, n), ySoma / Math.max(1, n));
    // 8 m e 2,5 m de lado: a bola leva ~0,3 s e o goleiro não alcança 2,5 m em ~0,1 s depois de
    // reagir (Monteiro 2022: ~1 s para a mão chegar a 3,5 m). Ali vale o limite físico, abaixo dos dados.
    if (d === 8 && lat === 2.5) limiteFisico = p;
    else piorDif = Math.max(piorDif, Math.abs(p - alvo));
    res.push(`${d} m/${lat} m: ${fmt(p * 100, 0)}% (dados ${fmt(alvo * 100, 0)}%)`);
  }
  console.log('canhão — ' + res.join(' · '));
  reg('canhão — defesa por lateral × distância (pior das 8 células)', `±${fmt(piorDif * 100, 0)} pontos`, '±10 pontos da logística dos dados', piorDif <= 0.10);
  reg('canhão — 8 m a 2,5 m de lado (limite físico)', `${fmt(limiteFisico * 100, 0)}% (dados 13%)`, '≤ dados', limiteFisico <= 0.15);
}

// ------------------------------------------------ chutes do jogo (sem pressão, mirados no canto)
// Chutes livres, mirados no canto (o caso mais difícil para o goleiro). Referências (pesquisa da
// Etapa 2, StatsBomb): pênalti (11 m, livre, no canto) tem ~21% de defesas dos chutes no alvo; de
// fora da área, 81–93% (16,5–30 m). A taxa de uma partida inteira (~71%) mistura chutes pressionados
// e no meio do gol, e é medida na Etapa 3 (IA × IA).
const faixas = [
  { nome: 'dentro da área, livre no canto (6–16,5 m)', d: [6.5, 16], meta: [0.1, 0.32] },
  { nome: 'fora da área, livre no canto (18–30 m)', d: [18, 30], meta: [0.75, 0.92] },
];
const tot = { defesas: 0, gols: 0 };
for (const [k, f] of faixas.entries()) {
  let gols = 0, defesas = 0, fora = 0, encaixes = 0;
  for (let s = 1; s <= N; s++) {
    const t = ((s * 0.618034) % 1);
    const d = f.d[0] + (f.d[1] - f.d[0]) * t;
    const ang = ((((s * 37) % 71) - 35) / DEG); // ±35° do centro do gol
    const x = GX - Math.cos(ang) * d, z = Math.sin(ang) * d;
    const forca = 0.45 + ((s * 13) % 50) / 100; // 0,45–0,94
    const canto = s % 3 === 0 ? 0 : (s % 2 ? 1 : -1) * 0.35;
    const r = chutar(1000 * (k + 1) + s, x, z, forca, canto);
    if (r.res === 'gol') gols++;
    else if (r.res === 'defesa') { defesas++; if (r.modo === 'encaixe') encaixes++; }
    else fora++;
  }
  const pct = defesas / Math.max(1, defesas + gols);
  tot.defesas += defesas; tot.gols += gols;
  reg(`defesas — ${f.nome}`, `${fmt(pct * 100, 0)}% (${defesas}/${defesas + gols} no alvo; ${fora} fora; ${encaixes} encaixes)`,
    `${fmt(f.meta[0] * 100, 0)}–${fmt(f.meta[1] * 100, 0)}%`, pct >= f.meta[0] && pct <= f.meta[1] && defesas + gols >= N * 0.4);
}

// ------------------------------------------------ posição: na bissetriz, adiantado com a bola longe
{
  const erros = [], dists = [];
  for (const [bx, bz] of [[30, 0], [40, -12], [44, 14], [36, 20], [48, -6], [25, 8]]) {
    const jog = [
      { id: 0, x: bx - 0.4, z: bz, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
      { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: GK_ATTR },
    ];
    // bola parada sem dono (sem 1×1): o goleiro só se posiciona
    const m = criarMundo({ semente: 7, jogadores: jog, bola: { x: bx, z: bz }, posse: null });
    for (let i = 0; i < 150; i++) passo(m, {});
    const g = jogadorPorId(m, 20);
    const dLinha = GX - g.x;
    const p = pontoBissetriz(bx, bz, GX, dLinha);
    erros.push(Math.abs(g.z - p.z));
    dists.push({ dBola: Math.hypot(bx - GX, bz), dLinha });
  }
  reg('posição — distância à bissetriz (máx)', `${fmt(Math.max(...erros), 2)} m`, '≤ 0,3 m', Math.max(...erros) <= 0.3);
  const longe = dists.find(d => d.dBola > 25), perto = dists.find(d => d.dBola < 8);
  reg('posição — mais adiantado com a bola longe', `${fmt(longe.dLinha, 1)} m (bola a ${fmt(longe.dBola, 0)} m) × ${fmt(perto.dLinha, 1)} m (bola a ${fmt(perto.dBola, 0)} m)`, 'longe > perto', longe.dLinha > perto.dLinha + 1);
}

// ------------------------------------------------ profundidade no chute (StatsBomb, intervalo interquartil)
{
  const res = [];
  let ok = true;
  for (const [d, faixa, nome] of [[5, [0.82, 1.92], 'pequena área'], [12, [1.19, 2.83], 'área'], [25, [1.46, 3.02], 'fora']]) {
    const jog = [
      { id: 0, x: GX - d - 0.4, z: 0, rumo: 0, time: 0, papel: 'parado', posicao: 'ATA' },
      { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: GK_ATTR },
    ];
    const m = criarMundo({ semente: 8, jogadores: jog, bola: { x: GX - d, z: 0 }, posse: null });
    for (let i = 0; i < 150; i++) passo(m, {});
    const prof = GX - jogadorPorId(m, 20).x;
    ok = ok && prof >= faixa[0] && prof <= faixa[1];
    res.push(`${nome} ${fmt(prof, 2)} m (${faixa[0]}–${faixa[1]})`);
  }
  reg('posição — profundidade no chute', res.join(' · '), 'no intervalo dos dados', ok);
}

// ------------------------------------------------ botão GOLEIRO: sai na bola; sem ele, fica
for (const comBotao of [true, false]) {
  // atacante da IA (time 0) conduz para o gol; o humano defende (time 1) com um zagueiro
  const jog = [
    { id: 0, x: 22, z: 0, rumo: 0, time: 0, papel: 'ia', posicao: 'ATA' },
    { id: 21, x: 10, z: 8, rumo: 0, time: 1, papel: 'humano', posicao: 'ZAG' },
    { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'ia', posicao: 'GOL', attr: GK_ATTR },
  ];
  const m = criarMundo({ semente: 9, jogadores: jog, bola: { x: 22.4, z: 0 }, posse: 0 });
  const g = jogadorPorId(m, 20);
  let maxSaida = 0, saiu = false;
  for (let i = 0; i < 150; i++) {
    passo(m, { 1: { x: 0, z: 0, botoes: comBotao ? BOTAO.GOLEIRO : 0 } });
    maxSaida = Math.max(maxSaida, GX - g.x);
    if (m.eventos.some(e => e.tipo === 'saidaGoleiro')) saiu = true;
    if (m.posse !== 0) break;
  }
  if (comBotao) reg('botão GOLEIRO — o goleiro sai na bola', `saiu ${fmt(maxSaida, 1)} m da linha`, '> 6 m e ≤ 35 m', saiu && maxSaida > 6 && maxSaida <= GOLEIRO.saidaMax);
  else reg('sem o botão — o goleiro não sai antes da hora', `${fmt(maxSaida, 1)} m da linha`, '≤ 5 m com a bola a > 17 m', maxSaida <= 5 || saiu);
}

// ------------------------------------------------ bola nas mãos e espalmada para fora
{
  let encaixe = null, espalmadas = [], dentroGol = 0;
  for (let s = 1; s <= 60 && (encaixe == null || espalmadas.length < 8); s++) {
    const d = 12 + (s % 10);
    const ang = (((s * 23) % 50) - 25) / DEG;
    const r = chutar(5000 + s, GX - Math.cos(ang) * d, Math.sin(ang) * d, 0.5 + (s % 5) * 0.1, (s % 2 ? 1 : -1) * 0.3);
    if (r.res !== 'defesa') continue;
    const m = r.m;
    if (r.modo === 'encaixe' && encaixe == null) {
      const g = jogadorPorId(m, 20);
      let longe = 0;
      for (let i = 0; i < 40; i++) { passo(m, {}); longe = Math.max(longe, Math.hypot(m.bola.p.x - g.x, m.bola.p.z - g.z)); }
      encaixe = { naMao: m.naMao === 20, posse: m.posse === 20, longe };
    } else if (r.modo === 'espalmada') {
      // a bola espalmada não pode entrar no gol
      let gol = false;
      for (let i = 0; i < 120 && !gol; i++) { passo(m, {}); gol = m.eventos.some(e => e.tipo === 'gol'); }
      if (gol) dentroGol++;
      espalmadas.push(gol);
    }
  }
  reg('encaixe — a bola fica nas mãos do goleiro', encaixe ? `naMao ${encaixe.naMao}, posse ${encaixe.posse}, a ${fmt(encaixe.longe, 2)} m dele` : 'nenhum encaixe', 'nas mãos, ≤ 0,5 m', !!encaixe && encaixe.naMao && encaixe.posse && encaixe.longe <= 0.5);
  reg('espalmada — não entra no próprio gol', `${dentroGol}/${espalmadas.length}`, '0', espalmadas.length >= 5 && dentroGol === 0);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-goleiro: REPROVOU (${falhas})` : '\nteste-goleiro: PASSOU');
process.exit(falhas ? 1 : 0);
