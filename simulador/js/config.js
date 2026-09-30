// Constantes centralizadas do LANCE A LANCE.
// Coordenadas do motor (metros): x = comprimento (±52,5), y = largura (±34).
// Cada time tem dir = +1 (ataca para +x) ou -1. "u" = x * dir (quanto maior, mais perto do gol adversário).

export const VERSION = '1.0.0';

export const PITCH = {
  halfL: 52.5,
  halfW: 34,
  goalHalfW: 3.66,
  goalH: 2.44,
  boxDepth: 16.5,
  boxHalfW: 20.16,
  smallDepth: 5.5,
  smallHalfW: 9.16,
  penaltySpot: 11,
  circleR: 9.15,
};

export const SIM = {
  dt: 0.05,              // passo fixo do motor (s de jogo "físico")
  halfPhysical: 300,     // segundos físicos por tempo (= 45 min de relógio)
  get clockScale() { return (45 * 60) / this.halfPhysical; }, // segundos de relógio por segundo físico
  gravity: 9.81,
  rollDecel: 1.1,        // desaceleração da bola rolando na grama (m/s²)
  rollDrag: 0.012,       // arrasto proporcional a v² no chão
  airDrag: 0.008,
  bounce: 0.45,
  controlRadius: 1.0,
  tackleRadius: 1.5,
  maxSubs: 5,
  maxAddedMin: 7,
};

// Duração das bolas paradas (s físicos)
export const RESTART_DELAY = {
  kickoff: 2.2, goal: 5.5, throwin: 1.6, goalkick: 2.4, corner: 2.8, freekick: 2.6, penalty: 3.5, offside: 2.2,
};

// Formações: 10 posições de linha em coordenadas normalizadas (u: -1 zaga … +1 ataque, v: -1 … +1).
// Os códigos dizem quem cabe melhor em cada vaga (ver teams.js → slotFit).
export const FORMATIONS = {
  '4-4-2': [
    ['LE', -0.95, -0.78], ['ZAG', -1, -0.27], ['ZAG', -1, 0.27], ['LD', -0.95, 0.78],
    ['PE', -0.05, -0.74], ['VOL', -0.25, -0.22], ['MC', -0.2, 0.22], ['PD', -0.05, 0.74],
    ['ATA', 0.95, -0.2], ['ATA', 0.9, 0.2],
  ],
  '4-3-3': [
    ['LE', -0.95, -0.78], ['ZAG', -1, -0.27], ['ZAG', -1, 0.27], ['LD', -0.95, 0.78],
    ['VOL', -0.45, 0], ['MC', -0.1, -0.4], ['MEI', -0.05, 0.4],
    ['PE', 0.75, -0.7], ['ATA', 0.95, 0], ['PD', 0.75, 0.7],
  ],
  '4-2-3-1': [
    ['LE', -0.95, -0.78], ['ZAG', -1, -0.27], ['ZAG', -1, 0.27], ['LD', -0.95, 0.78],
    ['VOL', -0.45, -0.22], ['VOL', -0.45, 0.22],
    ['PE', 0.35, -0.7], ['MEI', 0.35, 0], ['PD', 0.35, 0.7],
    ['ATA', 0.95, 0],
  ],
  '3-5-2': [
    ['ZAG', -1, -0.45], ['ZAG', -1.02, 0], ['ZAG', -1, 0.45],
    ['LE', -0.25, -0.85], ['VOL', -0.45, 0], ['MC', -0.15, -0.32], ['MEI', -0.1, 0.32], ['LD', -0.25, 0.85],
    ['ATA', 0.95, -0.2], ['ATA', 0.9, 0.2],
  ],
  '5-3-2': [
    ['LE', -0.75, -0.85], ['ZAG', -1, -0.4], ['ZAG', -1.02, 0], ['ZAG', -1, 0.4], ['LD', -0.75, 0.85],
    ['VOL', -0.4, 0], ['MC', -0.2, -0.4], ['MEI', -0.2, 0.4],
    ['ATA', 0.95, -0.2], ['ATA', 0.9, 0.2],
  ],
};
export const FORMATION_KEYS = Object.keys(FORMATIONS);

// Mentalidade: -2 (muito defensivo) … +2 (muito ofensivo)
export const MENTALITY = [
  { v: -2, label: 'Retranca' },
  { v: -1, label: 'Defensivo' },
  { v: 0, label: 'Equilibrado' },
  { v: 1, label: 'Ofensivo' },
  { v: 2, label: 'Tudo ao ataque' },
];
export const PRESSING = [
  { v: 0, label: 'Baixa' },
  { v: 1, label: 'Média' },
  { v: 2, label: 'Alta' },
];
export const TEMPO = [
  { v: 0, label: 'Cadenciado' },
  { v: 1, label: 'Normal' },
  { v: 2, label: 'Vertical' },
];

export const DEFAULT_TACTICS = { formation: '4-4-2', mentality: 0, pressing: 1, tempo: 1 };

// Velocidades de exibição (multiplicador sobre o tempo físico)
export const SPEEDS = [1, 2, 4, 8];

// Qualidade gráfica. dprMax limita a resolução interna; os demais ligam efeitos.
export const QUALITY = {
  baixo: { label: 'Baixo', dprMax: 1, fpsCap: 30, shadows: false, trail: false, grass: 1, glow: false, numbers: false, particles: 0 },
  medio: { label: 'Médio', dprMax: 1.5, fpsCap: 60, shadows: true, trail: false, grass: 2, glow: false, numbers: true, particles: 40 },
  alto: { label: 'Alto', dprMax: 2, fpsCap: 60, shadows: true, trail: true, grass: 3, glow: true, numbers: true, particles: 90 },
  ultra: { label: 'Ultra', dprMax: 3, fpsCap: 0, shadows: true, trail: true, grass: 4, glow: true, numbers: true, particles: 180 },
};
export const QUALITY_KEYS = ['baixo', 'medio', 'alto', 'ultra'];

// Orçamentos de desempenho (usados pelo monitor e pelo AUTO)
export const BUDGET = {
  frameMs: 16.7,          // meta de 60 fps
  downgradeP95Ms: 26,     // p95 acima disso por alguns segundos → baixa um nível (no AUTO)
  upgradeP95Ms: 11,       // p95 abaixo disso por bastante tempo → pode subir
  engineMsPerFrame: 4,    // tempo máximo do motor por quadro antes de adiar passos
  maxStepsPerFrame: 240,
};

export const STORAGE_KEYS = {
  settings: 'lal.settings.v1',
  season: 'lal.season.v1',
  history: 'lal.history.v1',
};
