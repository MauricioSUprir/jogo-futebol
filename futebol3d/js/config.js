// Constantes compartilhadas por todos os módulos do GOLAÇO.
//
// Sistema de coordenadas (metros):
//   x = comprimento do campo, de -52,5 (gol oeste) a +52,5 (gol leste)
//   z = largura do campo, de -34 a +34
//   y = para cima (gramado em y = 0)
// Um "heading" h (radianos) aponta para o vetor (cos h, 0, sin h).
// Olhando para +x, a direita é +z.

export const PITCH = {
  length: 105,
  width: 68,
  halfL: 52.5,
  halfW: 34,
  // área grande (16,5 m) e pequena (5,5 m), medidas a partir da linha de fundo
  boxDepth: 16.5,
  boxHalfW: 20.16,
  smallBoxDepth: 5.5,
  smallBoxHalfW: 9.16,
  penaltySpot: 11,
  centerRadius: 9.15,
  cornerRadius: 1,
  lineWidth: 0.12,
  // gramado além das linhas, até as placas de publicidade
  runoffX: 6,
  runoffZ: 5,
};

export const GOAL = {
  halfWidth: 3.66,   // 7,32 m entre as traves (medida interna)
  height: 2.44,
  postRadius: 0.06,  // traves de 12 cm
  depth: 2.2,        // fundo da rede no chão
  topDepth: 1.0,     // fundo da rede no alto
};

export const BALL = {
  radius: 0.11,
  mass: 0.43,
  gravity: 9.81,
  airDensity: 1.2,
  dragCoef: 0.25,          // Cd de bola de futebol em velocidade de jogo
  magnusCoef: 0.0036,      // aceleração lateral = k · (ω × v)
  spinDecayAir: 0.35,      // 1/s
  restitution: 0.62,       // quique vertical no gramado
  groundFriction: 0.45,    // atrito de deslizamento ao quicar
  rollResistance: 0.55,    // m/s² rolando no gramado (grama curta e seca)
  grassDrag: 0.10,         // 1/s de resistência extra da grama rolando
  postRestitution: 0.72,
  netDamping: 0.12,        // fração da velocidade que sobra ao bater na rede
};

export const PHYS_HZ = 120;       // passo fixo da simulação

export const PLAYER = {
  radius: 0.38,          // raio de colisão entre corpos
  height: 1.80,
  // velocidades em m/s; o atributo de velocidade (0..99) interpola entre min e max
  jogMin: 4.6, jogMax: 5.8,
  sprintMin: 7.4, sprintMax: 9.3,
  accelMin: 4.2, accelMax: 6.8,
  decel: 9.0,
  turnRateStill: 14,     // rad/s parado
  turnRateSprint: 3.2,   // rad/s em arrancada
  controlRange: 0.75,    // distância em que pode tocar na bola com o pé
  headerReach: 2.55,     // altura máxima de cabeceio com salto
};

// Animações: duração (s) e momento do contato (fração 0..1).
// O módulo de animação (anim.js) e a jogabilidade usam os mesmos números.
export const ANIM = {
  kick:      { dur: 0.50, contact: 0.42 },
  pass:      { dur: 0.42, contact: 0.40 },
  chip:      { dur: 0.50, contact: 0.44 },
  header:    { dur: 0.70, contact: 0.45 },
  volley:    { dur: 0.60, contact: 0.45 },
  slide:     { dur: 1.10, contact: 0.25 },
  tackle:    { dur: 0.45, contact: 0.45 },
  throwin:   { dur: 1.00, contact: 0.62 },
  gk_dive:   { dur: 1.30, contact: 0.35 },
  gk_catch:  { dur: 0.50, contact: 0.30 },
  gk_throw:  { dur: 0.80, contact: 0.60 },
  gk_kick:   { dur: 0.90, contact: 0.55 },
  fall:      { dur: 1.60, contact: 0.00 },
  getup:     { dur: 0.80, contact: 0.00 },
  celebrate: { dur: 3.00, contact: 0.00 },
  dejected:  { dur: 3.00, contact: 0.00 },
};

// Formações para o time que ataca para +x, com a bola no meio-campo.
// [papel, x, z]. Papéis: GK, DEF, MID, ATT. A ordem casa com a ordem dos
// titulares em teams.js (índice 0 é sempre o goleiro).
export const FORMATIONS = {
  '4-3-3': [
    ['GK', -50, 0], ['DEF', -30, 22], ['DEF', -34, 8], ['DEF', -34, -8], ['DEF', -30, -22],
    ['MID', -20, 0], ['MID', -10, 12], ['MID', -10, -12],
    ['ATT', 4, 24], ['ATT', 8, 0], ['ATT', 4, -24],
  ],
  '4-4-2': [
    ['GK', -50, 0], ['DEF', -30, 22], ['DEF', -34, 8], ['DEF', -34, -8], ['DEF', -30, -22],
    ['MID', -12, 22], ['MID', -16, 6], ['MID', -16, -6], ['MID', -12, -22],
    ['ATT', 6, 6], ['ATT', 6, -6],
  ],
  '4-2-3-1': [
    ['GK', -50, 0], ['DEF', -30, 22], ['DEF', -34, 8], ['DEF', -34, -8], ['DEF', -30, -22],
    ['MID', -20, 7], ['MID', -20, -7],
    ['ATT', -4, 22], ['MID', -4, 0], ['ATT', -4, -22],
    ['ATT', 8, 0],
  ],
  '3-5-2': [
    ['GK', -50, 0], ['DEF', -34, 13], ['DEF', -36, 0], ['DEF', -34, -13],
    ['MID', -12, 26], ['MID', -20, 0], ['MID', -12, 10], ['MID', -12, -10], ['MID', -12, -26],
    ['ATT', 6, 6], ['ATT', 6, -6],
  ],
};

// Presets de qualidade gráfica.
export const QUALITY = {
  // pixelRatio = fração da densidade da tela; maxPR limita a densidade (celular 3x → até maxPR)
  baixa: { label: 'Baixa', pixelRatio: 1.0, maxPR: 1.5, shadows: true,  shadowSize: 1024, crowd: 0.45, post: false, bloom: false, msaa: true, grassDetail: 0, anisotropy: 4 },
  media: { label: 'Média', pixelRatio: 1.0, maxPR: 2,   shadows: true,  shadowSize: 2048, crowd: 0.70, post: false, bloom: false, msaa: true, grassDetail: 1, anisotropy: 8 },
  alta:  { label: 'Alta',  pixelRatio: 1.0, maxPR: 2,   shadows: true,  shadowSize: 4096, crowd: 1.00, post: true,  bloom: true,  msaa: true, grassDetail: 2, anisotropy: 16, ao: true },
  ultra: { label: 'Ultra', pixelRatio: 1.0, maxPR: 3,   shadows: true,  shadowSize: 4096, crowd: 1.00, post: true,  bloom: true,  msaa: true, grassDetail: 2, anisotropy: 16, ao: true },
};

export const DIFFICULTY = {
  amador:       { label: 'Amador',       aiReaction: 0.42, aiSkill: 0.70, gkSkill: 0.72 },
  profissional: { label: 'Profissional', aiReaction: 0.28, aiSkill: 0.88, gkSkill: 0.86 },
  lenda:        { label: 'Lenda',        aiReaction: 0.16, aiSkill: 1.00, gkSkill: 0.95 },
};

export const DEFAULT_SETTINGS = {
  difficulty: 'profissional',
  halfMinutes: 4,        // minutos reais por tempo
  camera: 'tv',          // tv | pro | aerea
  quality: 'auto',       // auto | baixa | media | alta | ultra
  timeOfDay: 'noite',    // dia | tarde | noite
  wind: true,
  volMaster: 0.9,
  volCrowd: 0.8,
  volSfx: 0.9,
  vibration: true,
  radar: true,
  passAssist: true,
  names: true,           // nome acima do jogador controlado
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const angDiff = (a, b) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};
