// Formações da partida (Etapa 3): as 6 do "Editar time", com a posição-base de cada vaga sem a bola
// e com a bola (bola no centro, referencial de quem ataca para +x; a direita de quem ataca é +z),
// e o encaixe dos titulares ao trocar de formação (algoritmo húngaro em inteiros).
// Puro: sem three.js nem DOM.
//
// Vaga = {id, pos, fila, col, grupo, sem: {x, z}, com: {x, z}}
//  - id, pos, fila, col: tela "Editar time" §7.4 (fila/col desenham o campinho);
//  - sem, com: pesquisa §1.3 (PESQUISA-ETAPA3.md), calibrada pela Metrica. Onde as duas divergiam,
//    vale a pesquisa (é o que o teste-taticas mede). Os 3 pares da pesquisa que não eram espelhados
//    (4-2-3-1 com bola: volantes; 4-4-2 com bola: meias centrais e atacantes) foram espelhados pela
//    média (diferença ≤ 1 m);
//  - grupo: 'gol' | 'def' | 'mei' | 'ata'. 'def' = a linha de defesa SEM a bola (4 ou 5 mais
//    recuados), alinhada pela altura da linha (tatica.js). No 3-5-2 os alas são 'def': sem a bola o
//    time defende num 5-3-2 (alas a −18).
// A ordem das vagas é fixa (GOL primeiro): é a ordem do hash, do desempate e do vagaIdx.

import { fichaDe, atributosDe, notaNaPosicao, encaixeNaVaga } from './elenco.js';

const V = (id, pos, fila, col, grupo, sx, sz, cx, cz) => ({ id, pos, fila, col, grupo, sem: { x: sx, z: sz }, com: { x: cx, z: cz } });

const GOL = V('GOL', 'GOL', 0, 0, 'gol', -42, 0, -38, 0);
// linha de 4 sem a bola (4-3-3, 4-4-2, 4-2-3-1, 4-1-4-1); com a bola: 4-3-3/4-2-3-1/4-1-4-1 × 4-4-2
const L4 = (cLat, cZag, cLatZ, cZagZ) => [
  V('LE', 'LE', 1, -1.5, 'def', -19, -15, cLat, -cLatZ),
  V('ZE', 'ZAG', 1, -0.5, 'def', -20, -5, cZag, -cZagZ),
  V('ZD', 'ZAG', 1, 0.5, 'def', -20, 5, cZag, cZagZ),
  V('LD', 'LD', 1, 1.5, 'def', -19, 15, cLat, cLatZ),
];

export const FORMACOES = {
  '4-3-3': {
    id: '4-3-3',
    vagas: [
      GOL, ...L4(-3, -13, 21, 9),
      V('VOL', 'VOL', 2, 0, 'mei', -13, 0, -6, 0),
      V('MCE', 'MC', 3, -1, 'mei', -8, -8, 4, -11),
      V('MCD', 'MC', 3, 1, 'mei', -8, 8, 4, 11),
      V('PE', 'PE', 4, -2, 'ata', -6, -17, 14, -24),
      V('ATA', 'ATA', 4, 0, 'ata', 4, 0, 17, 0),
      V('PD', 'PD', 4, 2, 'ata', -6, 17, 14, 24),
    ],
  },
  '4-4-2': {
    id: '4-4-2',
    vagas: [
      GOL, ...L4(-3, -12, 22, 8),
      V('ME', 'ME', 2.5, -1.5, 'mei', -7, -16, 10, -23),
      V('MCE', 'MC', 2.5, -0.5, 'mei', -9, -5, 1, -6),
      V('MCD', 'MC', 2.5, 0.5, 'mei', -9, 5, 1, 6),
      V('MD', 'MD', 2.5, 1.5, 'mei', -7, 16, 10, 23),
      V('ATE', 'ATA', 4, -0.5, 'ata', 4, -4, 15.5, -4.5),
      V('ATD', 'ATA', 4, 0.5, 'ata', 4, 4, 15.5, 4.5),
    ],
  },
  '4-2-3-1': {
    id: '4-2-3-1',
    vagas: [
      GOL, ...L4(-3, -13, 21, 9),
      V('VOLE', 'VOL', 2, -0.5, 'mei', -10, -5, -5.5, -7),
      V('VOLD', 'VOL', 2, 0.5, 'mei', -10, 5, -5.5, 7),
      V('ME', 'ME', 3, -2, 'mei', -7, -16, 12, -23),
      V('MEI', 'MEI', 3, 0, 'mei', -1, 0, 8, 0),
      V('MD', 'MD', 3, 2, 'mei', -7, 16, 12, 23),
      V('ATA', 'ATA', 4, 0, 'ata', 4, 0, 17, 0),
    ],
  },
  '4-1-4-1': {
    id: '4-1-4-1',
    vagas: [
      GOL, ...L4(-3, -13, 21, 9),
      V('VOL', 'VOL', 2, 0, 'mei', -14, 0, -6, 0),
      V('ME', 'ME', 3, -1.5, 'mei', -6, -17, 12, -24),
      V('MCE', 'MC', 3, -0.5, 'mei', -7, -7, 5, -10),
      V('MCD', 'MC', 3, 0.5, 'mei', -7, 7, 5, 10),
      V('MD', 'MD', 3, 1.5, 'mei', -6, 17, 12, 24),
      V('ATA', 'ATA', 4, 0, 'ata', 4, 0, 17, 0),
    ],
  },
  '3-5-2': {
    id: '3-5-2',
    vagas: [
      GOL,
      V('ZE', 'ZAG', 1, -1, 'def', -20, -9, -12, -14),
      V('ZC', 'ZAG', 1, 0, 'def', -21, 0, -15, 0),
      V('ZD', 'ZAG', 1, 1, 'def', -20, 9, -12, 14),
      V('VOL', 'VOL', 2, 0, 'mei', -11, 0, -5, 0),
      V('ADE', 'ADE', 3, -2, 'def', -18, -19, 8, -26),
      V('MCE', 'MC', 3, -1, 'mei', -8, -9, 4, -11),
      V('MCD', 'MC', 3, 1, 'mei', -8, 9, 4, 11),
      V('ADD', 'ADD', 3, 2, 'def', -18, 19, 8, 26),
      V('ATE', 'ATA', 4, -0.5, 'ata', 4, -5, 16, -5),
      V('ATD', 'ATA', 4, 0.5, 'ata', 4, 5, 16, 5),
    ],
  },
  '5-3-2': {
    id: '5-3-2',
    vagas: [
      V('GOL', 'GOL', 0, 0, 'gol', -43, 0, -39, 0),
      V('ADE', 'ADE', 1, -2, 'def', -20, -20, 3, -25),
      V('ZE', 'ZAG', 1, -1, 'def', -21, -9, -14, -14),
      V('ZC', 'ZAG', 1, 0, 'def', -22, 0, -17, 0),
      V('ZD', 'ZAG', 1, 1, 'def', -21, 9, -14, 14),
      V('ADD', 'ADD', 1, 2, 'def', -20, 20, 3, 25),
      V('VOL', 'VOL', 2, 0, 'mei', -12, 0, -7, 0),
      V('MCE', 'MC', 3, -1, 'mei', -10, -10, 3, -11),
      V('MCD', 'MC', 3, 1, 'mei', -10, 10, 3, 11),
      V('ATE', 'ATA', 4, -0.5, 'ata', 2, -5, 15, -5),
      V('ATD', 'ATA', 4, 0.5, 'ata', 2, 5, 15, 5),
    ],
  },
};

/** Ordem do menu (e índice da formação no hash). */
export const ORDEM_FORMACOES = ['4-3-3', '4-2-3-1', '4-4-2', '4-1-4-1', '3-5-2', '5-3-2'];

// derivados (calculados uma vez): vaga por id, índice e o x da linha de defesa sem a bola
for (const f of Object.values(FORMACOES)) {
  f.porId = {};
  for (const v of f.vagas) f.porId[v.id] = v;
  f.indice = {};
  f.vagas.forEach((v, i) => { f.indice[v.id] = i; });
  let xl = Infinity;
  for (const v of f.vagas) if (v.grupo === 'def') xl = Math.min(xl, v.sem.x);
  f.xLinhaSem = xl;   // x do defensor mais recuado sem a bola (bola no centro)
  Object.freeze(f.vagas);
}

/** Lista de vagas da formação (ordem fixa). */
export function vagasDe(formacao) {
  return FORMACOES[formacao].vagas;
}

// ---------------------------------------------------------------- encaixe (algoritmo húngaro)

/** Atribuição de custo mínimo (n×n, inteiros). Devolve col[linha]. Ordem fixa = resultado fixo. */
export function hungaro(custo) {
  const n = custo.length;
  const INF = Number.MAX_SAFE_INTEGER;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0), caminho = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF), usado = new Array(n + 1).fill(false);
    do {
      usado[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (usado[j]) continue;
        const cur = custo[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; caminho[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (usado[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = caminho[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const col = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) if (p[j]) col[p[j] - 1] = j - 1;
  return col;
}

// Bônus de "natural ou alternativa" no encaixe. A tela §7.4 propunha +2; com os atributos de
// elenco.js (§7.3), +2 deixava 3 fora de posição no 4-3-3 → 3-5-2 (o lateral de zagueiro e o ponta
// de ala valiam mais pela nota) e o E4 pede 2 (falta um zagueiro e um atacante). Com +10, ter menos
// jogadores fora vem antes da nota (medido: +5 já bastava).
export const BONUS_ENCAIXE = { mesmaVaga: 3, naPosicao: 10 };

/**
 * Encaixa os titulares na formação nova (tela §7.4): maximiza, em inteiros, nota na vaga +
 * 3·(mesma vaga de antes) + 10·(natural ou alternativa). O goleiro atual fica sempre no GOL.
 * titulares: [id × 11]; formNova: id da formação; vagasAntigas: {vagaId: id} (a escalação atual).
 * Desempate: a ordem fixa das vagas e os jogadores por id (o algoritmo percorre nessa ordem).
 * Devolve {vagaId: id}. Usado só pela tela: a edição leva o resultado pronto.
 */
export function encaixar(titulares, formNova, elenco, vagasAntigas = {}) {
  const f = FORMACOES[formNova];
  const vagaDe = {};
  for (const k in vagasAntigas) vagaDe[vagasAntigas[k]] = k;
  let gol = vagasAntigas.GOL;
  if (gol == null || !titulares.includes(gol)) gol = titulares.find(id => fichaDe(id)?.pos === 'GOL') ?? titulares[0];
  const ids = titulares.filter(id => id !== gol).sort((a, b) => a - b);
  const vagas = f.vagas.filter(v => v.id !== 'GOL');
  const nota = (id, v) => {
    const jog = fichaDe(id);
    if (!jog) return 0;
    let s = notaNaPosicao(atributosDe(jog), v.pos);
    if (vagaDe[id] === v.id) s += BONUS_ENCAIXE.mesmaVaga;
    if (encaixeNaVaga(jog, v.pos) !== 'fora') s += BONUS_ENCAIXE.naPosicao;
    return s;
  };
  const M = 1000;
  const custo = ids.map(id => vagas.map(v => M - nota(id, v)));
  const col = hungaro(custo);
  const dono = { GOL: gol };
  ids.forEach((id, i) => { dono[vagas[col[i]].id] = id; });
  const out = {};
  for (const v of f.vagas) out[v.id] = dono[v.id]; // na ordem da formação
  return out;
}
