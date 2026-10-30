// PONTOS DE INTERAÇÃO da cidade (dono, 30/10: "crie pontos de interação na cidade"). PURO (sem three.js nem DOM).
// Nos parques: BANCOS (sentar: o Barry descansa e a energia enche três vezes mais rápido) e BANCAS DE JORNAL (a manchete do
// dia, que acompanha a história). Na calçada: os FÃS (foto com quem está olhando o herói). E os DESAFIOS DE CORRIDA: cinco circuitos pelas
// ruas, cada um com a largada marcada no chão, os pontos de passagem, o tempo e as medalhas (bronze, prata e ouro), e o
// recorde de cada um guardado. O desenho (os objetos, a marca da largada, os anéis) e a tela ficam no jogo.
import { CELL, N, MEIO, BLOCO, CALCADA, ehCampus } from './cidade.js';

export const RAIO_ACAO = 2.4;                   // m: perto o bastante para o botão AÇÃO aparecer
export const ITENS = {
  banco: { rotulo: 'Sentar', w: 1.8, d: 0.6, h: 0.9 },
  banca: { rotulo: 'Ler o jornal', w: 2.2, d: 1.4, h: 2.5 },
};
export const DESCANSO = { recarga: 0.15 };      // energia por segundo sentado (a normal é 0,05)

function hash(i, j, s) { let h = (Math.imul(i + 31, 2654435761) ^ Math.imul(j + 77, 2246822519) ^ Math.imul(s + 9091, 3266489917)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; return (h ^ (h >>> 13)) >>> 0; }
function mulberry(a) { return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/**
 * Os itens de um parque (cidade.js chama para o quarteirão de tipo 'parque'): [{tipo, x, z, rot}] e os sólidos de cada um.
 * rot = para onde a frente olha (o banco: o lado de quem senta). Ficam longe das árvores e da calçada (os pedestres andam
 * a 1–1,8 m do meio-fio).
 */
export function itensDoParque(b) {
  const r = mulberry(hash(b.i, b.j, 5)), itens = [], cx = b.cx, cz = b.cz;
  const livre = (x, z, raio) => b.arvores.every((a) => Math.hypot(a.x - x, a.z - z) > raio + 0.6 * a.s) && itens.every((q) => Math.hypot(q.x - x, q.z - z) > raio + 2);
  // os bancos: em volta do meio do parque, de frente para o centro
  const nb = 3 + Math.floor(r() * 3);
  for (let k = 0, tent = 0; k < nb && tent < 40; tent++) {
    const a = r() * Math.PI * 2, d = 9 + r() * 12, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (!livre(x, z, 1.6)) continue;
    itens.push({ tipo: 'banco', x, z, rot: Math.atan2(cx - x, cz - z) }); k++;
  }
  // a banca: num canto, de frente para a rua mais perto
  const cantos = [[-1, -1], [1, -1], [1, 1], [-1, 1]].sort(() => r() - 0.5);
  for (const [tipo, p] of [['banca', 0.8]]) {
    if (r() > p) continue;
    for (const [sx, sz] of cantos.splice(0, 2)) {
      const x = cx + sx * (BLOCO / 2 - 5), z = cz + sz * (BLOCO / 2 - 5);
      if (!livre(x, z, 2)) continue;
      itens.push({ tipo, x, z, rot: Math.abs(sx) >= Math.abs(sz) && r() < 0.5 ? (sx > 0 ? Math.PI / 2 : -Math.PI / 2) : (sz > 0 ? 0 : Math.PI) });
      break;
    }
  }
  const rects = itens.map((q) => solidoDoItem(q));
  return { itens, rects };
}
/** o sólido do item (o banco é baixo: o herói em velocidade pula por cima) */
export function solidoDoItem(q) {
  const I = ITENS[q.tipo], c = Math.abs(Math.cos(q.rot)), s = Math.abs(Math.sin(q.rot));
  const hx = (I.w * c + I.d * s) / 2, hz = (I.w * s + I.d * c) / 2;
  return { x0: q.x - hx, x1: q.x + hx, z0: q.z - hz, z1: q.z + hz, y0: CALCADA, y1: CALCADA + (q.tipo === 'banco' ? 0.5 : I.h), item: q.tipo };
}

// ---------- os desafios de corrida ----------
const NOMES = [['volta-praca', 'Volta da Praça', 5, 3], ['circuito-centro', 'Circuito do Centro', 7, 4], ['rota-norte', 'Rota Norte', 5, 8], ['grande-volta', 'A Grande Volta', 11, 7], ['travessia', 'A Travessia', 16, 12]];
const ANCORAS = [[-0.32, -0.3], [0.28, -0.32], [0.3, 0.26], [-0.3, 0.3], [0.02, 0.04]];
const eixo = (k) => k * CELL - MEIO;                // o eixo da rua k (os cruzamentos ficam em (eixo(ki), eixo(kj)))
let corridasCache = null;
/** Os cinco circuitos: [{id, nome, x, z (a largada, num cruzamento), pontos: [{x, z}] (o último é a chegada), metros, ouro, prata, bronze}] */
export function corridas() {
  if (corridasCache) return corridasCache;
  corridasCache = NOMES.map(([id, nome, w, h], k) => {
    // o retângulo de ruas (w × h quarteirões) em volta da âncora, fora do campus do S.T.A.R. Labs
    let ki = Math.round((ANCORAS[k][0] + 0.5) * N - w / 2), kj = Math.round((ANCORAS[k][1] + 0.5) * N - h / 2);
    ki = Math.max(2, Math.min(N - 2 - w, ki)); kj = Math.max(2, Math.min(N - 2 - h, kj));
    for (let t = 0; t < 20 && passaNoCampus(ki, kj, w, h); t++) { ki = Math.max(2, ki - 1); kj = Math.min(N - 2 - h, kj + 1); }
    const cantos = [[ki, kj], [ki + w, kj], [ki + w, kj + h], [ki, kj + h]];
    const pontos = [];
    for (let c = 0; c < 4; c++) {
      const [a0, b0] = cantos[c], [a1, b1] = cantos[(c + 1) % 4];
      pontos.push({ x: eixo(Math.round((a0 + a1) / 2)), z: eixo(Math.round((b0 + b1) / 2)) }, { x: eixo(a1), z: eixo(b1) });
    }
    const x = eixo(ki), z = eixo(kj);
    let metros = 0, px = x, pz = z; for (const p of pontos) { metros += Math.abs(p.x - px) + Math.abs(p.z - pz); px = p.x; pz = p.z; }
    return { id, nome, x, z, pontos, metros, ouro: Math.round(metros / 105), prata: Math.round(metros / 70), bronze: Math.round(metros / 42) };
  });
  return corridasCache;
}
// algum cruzamento do contorno encosta no campus (as quatro células em volta do cruzamento)?
const cruzaCampus = (a, b) => ehCampus(a, b) || ehCampus(a - 1, b) || ehCampus(a, b - 1) || ehCampus(a - 1, b - 1);
function passaNoCampus(ki, kj, w, h) { for (let a = ki; a <= ki + w; a++) for (let b = kj; b <= kj + h; b++) if ((a === ki || a === ki + w || b === kj || b === kj + h) && cruzaCampus(a, b)) return true; return false; }
export const medalha = (c, t) => (t <= c.ouro ? 'ouro' : t <= c.prata ? 'prata' : t <= c.bronze ? 'bronze' : null);

// ---------- as manchetes da banca (acompanham a história: a parte em que o jogador está) ----------
export const MANCHETES = [
  ['BORRÃO VERMELHO SALVA MAIS UM', 'Testemunhas falam em "um raio de gente" no centro; a polícia não comenta.'],
  ['S.T.A.R. LABS: UM ANO DEPOIS', 'O acelerador que explodiu ainda divide a cidade. Moradores pedem respostas.'],
  ['QUEM É O HOMEM MAIS RÁPIDO?', 'Picture News reúne 40 relatos: ele chega antes do alarme tocar.'],
  ['NEVE EM PLENO VERÃO', 'Rua inteira congelada no bairro norte. A defesa civil fala em "fenômeno raro".'],
  ['O HERÓI GANHA UM NOME', 'Nas ruas, ele já é "o Flash". A redação abre votação com os leitores.'],
  ['TRAJE NOVO, MAIS RÁPIDO?', 'Fotos mostram o herói com outro uniforme. "Ele brilha", diz uma testemunha.'],
  ['SATÉLITE FORA DE ÓRBITA', 'Agência confirma: o aparelho cai sobre a região. Prefeitura monta plano de evacuação.'],
  ['CENTRAL CITY RESPIRA', 'Depois da noite mais longa, a cidade volta às ruas. E agradece ao borrão vermelho.'],
];
/** a manchete para o ponto da história (0..1 = quanto da história já foi) */
export const manchete = (fracao) => MANCHETES[Math.max(0, Math.min(MANCHETES.length - 1, Math.floor(fracao * MANCHETES.length)))];

// ---------- o estado: o item perto, sentado, o jornal aberto, a corrida ----------
/** recordes: {id: segundos} (o jogo guarda no armazenamento) */
export function criarInteracoes({ recordes = {} } = {}) {
  const E = { perto: null, sentado: null, jornal: null, corrida: null, recordes: { ...recordes }, t: 0, fotos: 0 };
  /** o mais perto ao alcance (itens dos quarteirões carregados, os fãs olhando e as largadas), ou null */
  function procurar(P, itens, fas) {
    let melhor = null, dm = RAIO_ACAO;
    for (const q of itens) { const d = Math.hypot(q.x - P.x, q.z - P.z) - (q.tipo === 'banco' ? 0.3 : 0.9); if (d < dm) { dm = d; melhor = { tipo: q.tipo, q, rotulo: ITENS[q.tipo].rotulo }; } }
    for (const p of fas) { const d = Math.hypot(p.x - P.x, p.z - P.z) - 0.6; if (d < dm) { dm = d; melhor = { tipo: 'fa', q: p, rotulo: 'Foto com o fã' }; } }
    for (const c of corridas()) { const d = Math.hypot(c.x - P.x, c.z - P.z) - 2.5; if (d < dm) { dm = d; melhor = { tipo: 'corrida', q: c, rotulo: `Desafio: ${c.nome}` }; } }
    return melhor;
  }
  return {
    get perto() { return E.perto; }, get sentado() { return E.sentado; }, get jornal() { return E.jornal; }, get corrida() { return E.corrida; },
    get recordes() { return E.recordes; }, get fotos() { return E.fotos; },
    /**
     * Um passo. ctx: {itens, fas (pedestres olhando), livre (sem missão em andamento, crime, vilão, cena ou luta), dtM}.
     * Devolve os eventos: largada, ponto, chegada (t, medalha, recorde), abandonou, contagem.
     */
    atualizar(dt, P, ctx) {
      E.t += dt; const ev = [];
      const C = E.corrida;
      if (C) {
        if (!ctx.livre && C.fase !== 'fim') { E.corrida = null; ev.push({ tipo: 'abandonou', motivo: 'interrompido' }); }
        else if (C.fase === 'contagem') { const antes = Math.ceil(C.t); C.t -= dt; if (Math.ceil(C.t) !== antes && C.t > 0) ev.push({ tipo: 'contagem', n: Math.ceil(C.t) }); if (C.t <= 0) { C.fase = 'correndo'; C.t = 0; ev.push({ tipo: 'largada' }); } }
        else if (C.fase === 'correndo') {
          C.t += dt;
          // passou pelo ponto? (o caminho deste quadro, não só onde ele está: a 800 km/h são 4 m por quadro)
          const p = C.c.pontos[C.k], ox = C.ox ?? P.x, oz = C.oz ?? P.z;
          if (distSegmento(p.x, p.z, ox, oz, P.x, P.z) < 9) {
            C.k++; ev.push({ tipo: 'ponto', k: C.k, de: C.c.pontos.length });
            if (C.k >= C.c.pontos.length) {
              const t = C.t, rec = E.recordes[C.c.id], novo = rec === undefined || t < rec;
              if (novo) E.recordes[C.c.id] = +t.toFixed(2);
              ev.push({ tipo: 'chegada', id: C.c.id, nome: C.c.nome, t, medalha: medalha(C.c, t), recorde: novo, anterior: rec });
              C.fase = 'fim'; C.t = 0;
            }
          }
          if (C.fase === 'correndo' && C.t > C.c.bronze * 2.5) { E.corrida = null; ev.push({ tipo: 'abandonou', motivo: 'tempo' }); }
          if (E.corrida) { C.ox = P.x; C.oz = P.z; }
        } else if (C.fase === 'fim') { C.t += dt; if (C.t > 4) E.corrida = null; }
      }
      if (E.jornal) { E.jornal.t += dt; if (Math.hypot(P.vx, P.vz) > 1.5 && E.jornal.t > 0.6) E.jornal = null; }
      // o botão AÇÃO: só parado ou devagar, no chão, fora de corrida e de cena
      const devagar = Math.hypot(P.vx, P.vz) < 6 && P.noChao && !P.parede;
      E.perto = !E.sentado && !E.corrida && ctx.livre && devagar && P.y < 3 ? procurar(P, ctx.itens || [], ctx.fas || []) : null;
      return ev;
    },
    /** apertou AÇÃO: faz o que o item perto oferece. Devolve um evento (ou null). */
    acao(P, fracaoHistoria = 0) {
      if (E.sentado) return this.levantar(P);
      if (E.jornal) { E.jornal = null; return { tipo: 'fechou' }; }
      const p = E.perto; if (!p) return null;
      if (p.tipo === 'banco') {
        const q = p.q; E.sentado = { q, x: q.x - Math.sin(q.rot) * 0.05, z: q.z - Math.cos(q.rot) * 0.05, h: q.rot };
        return { tipo: 'sentou' };
      }
      if (p.tipo === 'banca') { const [titulo, linha] = manchete(fracaoHistoria); E.jornal = { titulo, linha, t: 0 }; return { tipo: 'leu', titulo }; }
      if (p.tipo === 'fa') { E.fotos++; return { tipo: 'foto', p: p.q, n: E.fotos }; }
      if (p.tipo === 'corrida') { E.corrida = { c: p.q, fase: 'contagem', t: 3, k: 0 }; return { tipo: 'desafio', c: p.q }; }
      return null;
    },
    /** levanta do banco: um passo à frente dele */
    levantar(P) {
      const s = E.sentado; if (!s) return null; E.sentado = null;
      P.x = s.q.x + Math.sin(s.q.rot) * 1.0; P.z = s.q.z + Math.cos(s.q.rot) * 1.0;
      return { tipo: 'levantou' };
    },
    cancelar() { if (E.corrida) { E.corrida = null; return { tipo: 'abandonou', motivo: 'cancelado' }; } return null; },
    /** para o guia: o próximo ponto da corrida */
    alvo() {
      const C = E.corrida; if (!C || C.fase === 'fim') return null;
      const p = C.c.pontos[Math.min(C.k, C.c.pontos.length - 1)], ult = C.k >= C.c.pontos.length - 1;
      return { x: p.x, z: p.z, cor: ult ? '#22c55e' : '#ffd23f', rotulo: ult ? 'Chegada' : `Ponto ${C.k + 1}/${C.c.pontos.length}` };
    },
  };
}
function distSegmento(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz; let t = l2 > 1e-9 ? ((px - ax) * dx + (pz - az) * dz) / l2 : 0; t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
