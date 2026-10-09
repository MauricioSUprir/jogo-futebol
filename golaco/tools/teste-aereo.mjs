// Jogo aéreo (seção 5): domínio no peito (a bola morre: de ~10 m/s sobra ≤ 1 m/s — Iga & Nunome
// 2016), cabeceio pedido com CHUTE vai para o gol com força realista (força própria + redireção),
// alcance da cabeça (~0,56 m acima da estatura com corrida — Fílter 2022: bola a 2,9 m passa por
// cima; a 2,3 m dá para cabecear) e a IA na área cabeceando para o gol sem botão.
//   node tools/teste-aereo.mjs
import { criarMundo, passo, jogadorPorId } from '../js/sim.js';
import { BOTAO, CAMPO } from '../js/config.js';
import { alturaNaDistancia } from '../js/bola.js';
import { tabelaTexto, fmt, media } from './lib/medidas.mjs';

const linhas = [['teste', 'medido', 'meta', 'resultado']];
let falhas = 0;
function reg(nome, medido, meta, ok) { linhas.push([nome, medido, meta, ok ? 'PASSOU' : 'REPROVOU']); if (!ok) falhas++; }
const GX = CAMPO.meioX, MEIO = CAMPO.gol.largura / 2;

/** Lança a bola de (x0, z0) para passar sobre (px, pz) na altura h, com velocidade s. */
function lancar(m, x0, z0, px, pz, h, s) {
  const p = { x: x0, y: 0.11, z: z0 };
  const D = Math.hypot(px - x0, pz - z0), ux = (px - x0) / D, uz = (pz - z0) / D;
  let lo = -0.1, hi = 1.0;
  for (let k = 0; k < 30; k++) {
    const el = (lo + hi) / 2;
    if (alturaNaDistancia(p, ux, uz, D, s, el).y < h) lo = el; else hi = el;
  }
  const el = (lo + hi) / 2;
  const r = alturaNaDistancia(p, ux, uz, D, s, el);
  if (Math.abs(r.y - h) > 0.1) throw new Error(`lançamento impossível: ${s} m/s a ${D.toFixed(1)} m na altura ${h}`);
  Object.assign(m.bola.p, p);
  m.bola.v.x = ux * s * Math.cos(el); m.bola.v.y = s * Math.sin(el); m.bola.v.z = uz * s * Math.cos(el);
  m.bola.w.x = 0; m.bola.w.y = 0; m.bola.w.z = 0;
  m.bola.rolando = false;
  m.posse = null;
  m.voo = { tipo: 'lancamento', de: 9, time: 0, tick0: m.tick, tickChave: m.tick, alto: true };
}

function rodar(m, n, entrada, aoTick) {
  for (let i = 0; i < n; i++) {
    passo(m, entrada ? { 0: entrada(i) } : {});
    if (aoTick && aoTick(m, i)) return i;
  }
  return -1;
}

// ------------------------------------------------ domínio no peito: a bola morre no corpo
{
  const sobras = [], chegadas = [];
  let dominou = 0, N = 0;
  for (let s = 1; s <= 16; s++) {
    const h = 0.9 + (s % 5) * 0.15; // 0,9–1,5 m (coxa/peito)
    const v = 14 + (s % 3);         // sai a 14–16 m/s e chega a ~10 m/s
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'MEI', attr: { controle: 75 } }];
    const m = criarMundo({ semente: 10 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    lancar(m, 14, (s % 4) - 1.5, 0, 0, h, v);
    N++;
    let ok = false;
    rodar(m, 120, () => ({ x: 0, z: 0, botoes: 0 }), (mm) => {
      const e = mm.eventos.find(e => e.tipo === 'dominioAereo');
      if (e) { sobras.push(e.sobra); chegadas.push(e.vChegada); ok = true; return true; }
      return mm.posse === 0;
    });
    if (ok) dominou++;
    else if (process.env.DEPURA) console.log('não dominou', s, h, v, m.eventos.map(e => e.tipo).join(','), m.posse);
  }
  reg('domínio no peito/coxa — bola chegando a ~10 m/s domina', `${dominou}/${N}`, '≥ 90%', dominou >= 0.9 * N);
  reg('domínio no peito/coxa — velocidade que sobra', `méd ${fmt(media(sobras), 2)} m/s (máx ${fmt(Math.max(...sobras), 2)}; chegando a ${fmt(media(chegadas), 1)} m/s)`, '≤ 1,0 m/s (Iga & Nunome 2016: 0,52)', sobras.length > 0 && Math.max(...sobras) <= 1.0);
}

// ------------------------------------------------ cabeceio pedido (CHUTE) vai para o gol
{
  let noGol = 0, N = 0;
  const vs = [];
  for (let s = 1; s <= 20; s++) {
    const jog = [
      { id: 0, x: GX - 9, z: (s % 5) - 2, rumo: 0, time: 0, papel: 'humano', posicao: 'ATA', attr: { cabeceio: 80, impulsao: 75 } },
      { id: 20, x: GX - 1, z: 0, rumo: Math.PI, time: 1, papel: 'parado', posicao: 'GOL' },
    ];
    const m = criarMundo({ semente: 50 + s, jogadores: jog, bola: { x: 30, z: 20 }, posse: null });
    const j = jogadorPorId(m, 0);
    lancar(m, GX - 18, 22, j.x, j.z, 1.95, 20 + (s % 4)); // cruzamento alto sai a 20–23 m/s
    // aperta CHUTE logo no começo do voo (pedido de cabeceio)
    let cab = null;
    rodar(m, 150, (i) => ({ x: 0, z: 0, botoes: i < 8 ? BOTAO.CHUTE : 0 }), (mm) => {
      const e = mm.eventos.find(e => e.tipo === 'cabeceio');
      if (e) { cab = { v: { ...mm.bola.v }, p: { ...mm.bola.p } }; return true; }
      return false;
    });
    if (!cab) continue;
    N++;
    vs.push(Math.hypot(cab.v.x, cab.v.y, cab.v.z));
    // onde cruza a linha do gol (ou para)
    let linha = null, defendeu = false;
    rodar(m, 120, () => ({ x: 0, z: 0, botoes: 0 }), (mm) => {
      if (mm.eventos.some(e => e.tipo === 'defesa')) { defendeu = true; return true; } // no alvo: o goleiro defendeu
      if (mm.bola.p.x >= GX) { linha = { z: mm.bola.p.z, y: mm.bola.p.y }; return true; }
      return Math.hypot(mm.bola.v.x, mm.bola.v.z) < 0.5;
    });
    if (defendeu || (linha && Math.abs(linha.z) < MEIO + 0.5 && linha.y < CAMPO.gol.altura + 0.3)) noGol++;
  }
  reg('cabeceio com CHUTE — sai cabeçada', `${N}/20`, '≥ 18', N >= 18);
  reg('cabeceio com CHUTE — vai na direção do gol', `${noGol}/${N}`, '≥ 70%', N > 0 && noGol >= 0.7 * N);
  reg('cabeceio — velocidade da bola', `méd ${fmt(media(vs), 1)} m/s (${fmt(Math.min(...vs), 1)}–${fmt(Math.max(...vs), 1)})`, '9–16 m/s (força própria 6–8,5 + 35% da bola)', media(vs) >= 9 && media(vs) <= 16);
}

// ------------------------------------------------ alcance da cabeça: 2,3 m dá, 2,9 m passa por cima
for (const [h, espera, nome] of [[2.3, true, 'bola a 2,3 m: cabeceia'], [2.9, false, 'bola a 2,9 m: passa por cima']]) {
  let cabeceou = 0;
  for (let s = 1; s <= 8; s++) {
    const jog = [{ id: 0, x: 0, z: 0, rumo: Math.PI, time: 0, papel: 'humano', posicao: 'ZAG', attr: { impulsao: 65 } }];
    const m = criarMundo({ semente: 80 + s, jogadores: jog, bola: { x: 20, z: 0 }, posse: null });
    lancar(m, 20, (s % 3) - 1, 0, 0, h, 19);
    rodar(m, 120, (i) => ({ x: 0, z: 0, botoes: i < 6 ? BOTAO.PASSE : 0 }), (mm) => {
      if (mm.eventos.some(e => e.tipo === 'cabeceio' || e.tipo === 'dominioAereo')) { cabeceou++; return true; }
      return mm.bola.p.x < -2;
    });
  }
  reg(`alcance — ${nome}`, `${cabeceou}/8`, espera ? '8/8' : '0/8', espera ? cabeceou === 8 : cabeceou === 0);
}

// ------------------------------------------------ IA na área cabeceia para o gol (sem botão)
{
  let paraGol = 0, N = 0;
  for (let s = 1; s <= 12; s++) {
    const jog = [
      { id: 0, x: 30, z: 26, rumo: 0, time: 0, papel: 'humano', posicao: 'PON' },
      { id: 1, x: GX - 8, z: (s % 5) - 2, rumo: 0, time: 0, papel: 'ia', posicao: 'ATA', attr: { cabeceio: 80 } },
    ];
    const m = criarMundo({ semente: 120 + s, jogadores: jog, bola: { x: 30, z: 26 }, posse: null });
    const j = jogadorPorId(m, 1);
    lancar(m, GX - 18, 24, j.x, j.z, 2.0, 21);
    m.voo.para = 1;
    let cab = null;
    rodar(m, 150, () => ({ x: 0, z: 0, botoes: 0 }), (mm) => {
      const e = mm.eventos.find(e => e.tipo === 'cabeceio' && e.id === 1);
      if (e) { cab = mm.voo?.cabeceio ?? null; return true; }
      return false;
    });
    if (cab == null) continue;
    N++;
    if (cab === 'chute') paraGol++;
  }
  reg('IA na área, sem botão — cabeceia para o gol', `${paraGol}/${N}`, `${N}/${N} (≥ 10 cabeçadas)`, N >= 10 && paraGol === N);
}

console.log(tabelaTexto(linhas));
console.log(falhas ? `\nteste-aereo: REPROVOU (${falhas})` : '\nteste-aereo: PASSOU');
process.exit(falhas ? 1 : 0);
