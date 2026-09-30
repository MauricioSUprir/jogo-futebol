// Clubes FICTÍCIOS do LANCE A LANCE (nomes, cidades, escudos e jogadores inventados).
// Os elencos saem de um RNG com semente: são sempre os mesmos em qualquer aparelho.
import { createRng } from './rng.js';
import { FORMATIONS } from './config.js';

const CLUBS = [
  { id: 'serrano', name: 'Atlético Serrano', short: 'ASE', city: 'Vale Alto', primary: '#1f7a3a', secondary: '#f2f2ea', pattern: 'stripes', strength: 78, tactics: { formation: '4-3-3', mentality: 1, pressing: 2, tempo: 2 } },
  { id: 'portoazul', name: 'Porto Azul FC', short: 'PAZ', city: 'Porto Azul', primary: '#1d4fa8', secondary: '#ffffff', pattern: 'band', strength: 77, tactics: { formation: '4-2-3-1', mentality: 0, pressing: 1, tempo: 1 } },
  { id: 'cordilheira', name: 'Real Cordilheira', short: 'RCO', city: 'Pedra Branca', primary: '#f1f1ee', secondary: '#6b2fa0', pattern: 'band', strength: 76, tactics: { formation: '4-3-3', mentality: 1, pressing: 1, tempo: 1 } },
  { id: 'litoranea', name: 'União Litorânea', short: 'ULI', city: 'Maré Mansa', primary: '#f2c230', secondary: '#12305c', pattern: 'half', strength: 74, tactics: { formation: '4-4-2', mentality: 0, pressing: 1, tempo: 2 } },
  { id: 'cerrado', name: 'EC Cerrado', short: 'ECC', city: 'Chapadão', primary: '#b3261e', secondary: '#f5e9d0', pattern: 'cross', strength: 73, tactics: { formation: '4-4-2', mentality: 1, pressing: 2, tempo: 2 } },
  { id: 'valeverde', name: 'Sport Vale Verde', short: 'SVV', city: 'Vale Verde', primary: '#0f5a4a', secondary: '#e4c35a', pattern: 'star', strength: 72, tactics: { formation: '3-5-2', mentality: 0, pressing: 1, tempo: 1 } },
  { id: 'ferroviario', name: 'Ferroviário do Norte', short: 'FEN', city: 'Entroncamento', primary: '#1b1b1f', secondary: '#e2231a', pattern: 'stripes', strength: 71, tactics: { formation: '4-2-3-1', mentality: 0, pressing: 1, tempo: 1 } },
  { id: 'pampa', name: 'Nacional do Pampa', short: 'NPA', city: 'Coxilha', primary: '#7fb3e0', secondary: '#1c2a44', pattern: 'band', strength: 70, tactics: { formation: '5-3-2', mentality: -1, pressing: 0, tempo: 0 } },
  { id: 'aurora', name: 'Grêmio Aurora', short: 'GAU', city: 'Aurora do Sul', primary: '#ff7a1a', secondary: '#2b2b2b', pattern: 'half', strength: 69, tactics: { formation: '4-3-3', mentality: 1, pressing: 1, tempo: 2 } },
  { id: 'tupa', name: 'Tupã Futebol Clube', short: 'TUP', city: 'Tupã Mirim', primary: '#6d1f2f', secondary: '#f0d9a8', pattern: 'cross', strength: 68, tactics: { formation: '4-4-2', mentality: -1, pressing: 1, tempo: 1 } },
  { id: 'estrela', name: 'Estrela do Mar', short: 'EDM', city: 'Ilha Clara', primary: '#e8f4ff', secondary: '#00a0b0', pattern: 'star', strength: 67, tactics: { formation: '4-2-3-1', mentality: 0, pressing: 0, tempo: 1 } },
  { id: 'lapa', name: 'Boêmios da Lapa', short: 'BLA', city: 'Arcos Velhos', primary: '#4a2a82', secondary: '#f6d44a', pattern: 'stripes', strength: 66, tactics: { formation: '3-5-2', mentality: 1, pressing: 2, tempo: 2 } },
];

const FIRST = ['Rafael', 'Lucas', 'Diego', 'Thiago', 'Matheus', 'Gabriel', 'Bruno', 'Caio', 'Vinícius', 'André', 'Henrique', 'Leandro',
  'Murilo', 'Otávio', 'Renan', 'Samuel', 'Túlio', 'Wesley', 'Yuri', 'Igor', 'Júlio', 'Felipe', 'Daniel', 'Heitor', 'Enzo', 'Davi',
  'Pedro', 'João', 'Luan', 'Kauã', 'Ícaro', 'Nícolas', 'Érick', 'Marcos', 'Fábio', 'Gustavo', 'Rodrigo', 'Alan', 'Wallace', 'Everton',
  'Ramón', 'Iker', 'Tomás', 'Luca', 'Matteo', 'Jonas', 'Emil', 'Nahuel', 'Santiago', 'Bento'];
const LAST = ['Tavares', 'Siqueira', 'Batista', 'Lacerda', 'Brandão', 'Quintela', 'Farias', 'Arruda', 'Peixoto', 'Rezende', 'Nogueira',
  'Cordeiro', 'Valente', 'Prado', 'Macedo', 'Barreto', 'Sampaio', 'Paiva', 'Freitas', 'Queiroz', 'Salgado', 'Bastos', 'Leitão',
  'Amaral', 'Esteves', 'Fontes', 'Toledo', 'Vilela', 'Aguiar', 'Pimentel', 'Seixas', 'Dantas', 'Bezerra', 'Galvão', 'Cunha', 'Lobo',
  'Portela', 'Serpa', 'Viana', 'Rangel', 'Sodré', 'Monteiro', 'Figueira', 'Ribas', 'Borba', 'Teles', 'Loureiro', 'Pacheco', 'Tenório',
  'Uchoa', 'Brito', 'Carmo', 'Ibarra', 'Quiroga', 'Villalba', 'Olmedo', 'Aranda', 'Garay', 'Ferraro', 'Bellandi', 'Rinaldi', 'Orsini',
  'Kessler', 'Vogel', 'Brenner', 'Dreyer', 'Lenz', 'Holmgren'];
const NICK = ['Tuca', 'Biel', 'Kiko', 'Nando', 'Lelo', 'Tatá', 'Juca', 'Neco', 'Dedé', 'Pipo', 'Zeca', 'Tito', 'Guto', 'Didi', 'Nenê', 'Cacá'];

// Composição do elenco (20 jogadores)
const SQUAD_POS = ['GOL', 'GOL', 'ZAG', 'ZAG', 'ZAG', 'LE', 'LE', 'LD', 'LD', 'VOL', 'VOL', 'MC', 'MC', 'MEI', 'MEI', 'PE', 'PD', 'ATA', 'ATA', 'ATA'];

// Perfil de atributos por posição: [ritmo, passe, chute, drible, defesa, físico, goleiro]
const PROFILE = {
  GOL: [-18, -12, -30, -25, -25, 0, 10],
  ZAG: [-6, -8, -22, -14, 8, 6, -60],
  LE: [4, -2, -16, 0, 0, -2, -60],
  LD: [4, -2, -16, 0, 0, -2, -60],
  VOL: [-4, 2, -10, -4, 5, 4, -60],
  MC: [0, 5, -4, 2, -4, 0, -60],
  MEI: [0, 6, 2, 6, -14, -6, -60],
  PE: [8, 0, 0, 7, -20, -6, -60],
  PD: [8, 0, 0, 7, -20, -6, -60],
  ATA: [4, -6, 8, 3, -26, 2, -60],
};
export const POS_LABEL = { GOL: 'Goleiro', ZAG: 'Zagueiro', LE: 'Lateral-esq.', LD: 'Lateral-dir.', VOL: 'Volante', MC: 'Meio-campo', MEI: 'Meia', PE: 'Ponta-esq.', PD: 'Ponta-dir.', ATA: 'Atacante' };

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function makePlayer(r, club, pos, idx, usedNames, number) {
  let name;
  for (let tries = 0; tries < 20; tries++) {
    name = r.chance(0.12) ? r.pick(NICK) : `${r.pick(FIRST)[0]}. ${r.pick(LAST)}`;
    if (!usedNames.has(name)) break;
  }
  usedNames.add(name);
  const starterBias = idx < 11 ? 3 : -3;
  const base = club.strength + starterBias + r.gauss() * 3.2;
  const prof = PROFILE[pos];
  const a = (i) => Math.round(clamp(base + prof[i] + r.gauss() * 5, 20, 97));
  const attrs = {
    pace: a(0), passing: a(1), shooting: a(2), dribbling: a(3), defending: a(4), physical: a(5),
    goalkeeping: pos === 'GOL' ? Math.round(clamp(base + prof[6] + r.gauss() * 3, 40, 95)) : Math.round(clamp(12 + r.next() * 12, 5, 30)),
    stamina: Math.round(clamp(base - 2 + r.gauss() * 7, 40, 97)),
  };
  const p = { id: `${club.id}-${idx}`, name, pos, number, age: r.int(18, 35), attrs };
  p.overall = playerOverall(p);
  return p;
}

export function playerOverall(p) {
  const t = p.attrs;
  if (p.pos === 'GOL') return Math.round(t.goalkeeping * 0.82 + t.physical * 0.08 + t.passing * 0.1);
  const w = {
    ZAG: [0.1, 0.12, 0.02, 0.06, 0.5, 0.2],
    LE: [0.2, 0.18, 0.04, 0.16, 0.3, 0.12], LD: [0.2, 0.18, 0.04, 0.16, 0.3, 0.12],
    VOL: [0.08, 0.26, 0.04, 0.1, 0.36, 0.16],
    MC: [0.1, 0.34, 0.12, 0.2, 0.16, 0.08],
    MEI: [0.1, 0.34, 0.2, 0.28, 0.02, 0.06],
    PE: [0.28, 0.18, 0.2, 0.3, 0.0, 0.04], PD: [0.28, 0.18, 0.2, 0.3, 0.0, 0.04],
    ATA: [0.18, 0.08, 0.44, 0.2, 0.0, 0.1],
  }[p.pos];
  return Math.round(t.pace * w[0] + t.passing * w[1] + t.shooting * w[2] + t.dribbling * w[3] + t.defending * w[4] + t.physical * w[5]);
}

function buildTeam(club) {
  const r = createRng('lal-' + club.id);
  const used = new Set();
  // números "de camisa" clássicos por posição, o resto sorteado sem repetir
  const classic = { GOL: [1, 12], ZAG: [3, 4, 14], LE: [6, 16], LD: [2, 13], VOL: [5, 15], MC: [8, 18], MEI: [10, 20], PE: [11], PD: [7], ATA: [9, 19, 21] };
  const cursor = {};
  // ordena para que os titulares naturais venham primeiro (idx < 11 recebe bônus de titular)
  const order = ['GOL', 'ZAG', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'PE', 'PD', 'ATA', 'GOL', 'ZAG', 'LE', 'LD', 'VOL', 'MC', 'MEI', 'ATA', 'ATA'];
  const players = order.map((pos, i) => {
    const k = cursor[pos] = (cursor[pos] ?? -1) + 1;
    return makePlayer(r, club, pos, i, used, classic[pos][k] ?? 22 + i);
  });
  // o melhor de cada posição fica com o número clássico (o goleiro titular veste a 1)
  const byPos = {};
  for (const p of players) (byPos[p.pos] ||= []).push(p);
  for (const [pos, list] of Object.entries(byPos)) {
    const nums = list.map((p) => p.number).sort((a, b) => a - b);
    list.sort((a, b) => b.overall - a.overall).forEach((p, i) => { p.number = nums[i]; });
  }
  const team = { ...club, players };
  team.overall = teamOverall(team);
  return team;
}

export function teamOverall(team) {
  const xi = pickLineup(team, team.tactics.formation);
  return Math.round(xi.reduce((s, p) => s + p.overall, 0) / xi.length);
}
export function teamStars(team) {
  return clamp(Math.round(((team.overall - 60) / 4) * 2) / 2, 0.5, 5);
}

// Quanto um jogador de posição "pos" serve na vaga "slot" (0..1)
const FIT = {
  GOL: { GOL: 1 },
  ZAG: { ZAG: 1, VOL: 0.85, LE: 0.75, LD: 0.75 },
  LE: { LE: 1, LD: 0.8, PE: 0.78, ZAG: 0.78, VOL: 0.7 },
  LD: { LD: 1, LE: 0.8, PD: 0.78, ZAG: 0.78, VOL: 0.7 },
  VOL: { VOL: 1, MC: 0.92, ZAG: 0.82, MEI: 0.75 },
  MC: { MC: 1, VOL: 0.92, MEI: 0.92, PE: 0.75, PD: 0.75 },
  MEI: { MEI: 1, MC: 0.92, PE: 0.85, PD: 0.85, ATA: 0.8 },
  PE: { PE: 1, PD: 0.9, MEI: 0.85, ATA: 0.85, LE: 0.7 },
  PD: { PD: 1, PE: 0.9, MEI: 0.85, ATA: 0.85, LD: 0.7 },
  ATA: { ATA: 1, PE: 0.85, PD: 0.85, MEI: 0.8 },
};
export function slotFit(pos, slot) {
  if (slot === 'GOL' || pos === 'GOL') return pos === slot ? 1 : 0.05;
  return FIT[slot]?.[pos] ?? 0.55;
}

/**
 * Escolhe os 11 titulares para a formação (guloso: vagas mais "raras" primeiro).
 * Retorna a lista na ordem das vagas: [GOL, ...10 de linha]. `exclude` = ids indisponíveis.
 */
export function pickLineup(team, formation, exclude = new Set()) {
  const slots = ['GOL', ...FORMATIONS[formation].map((s) => s[0])];
  const avail = team.players.filter((p) => !exclude.has(p.id));
  const chosen = new Array(slots.length).fill(null);
  const order = slots.map((s, i) => i).sort((a, b) => rarity(slots[a]) - rarity(slots[b]));
  const used = new Set();
  for (const i of order) {
    let best = null, bestScore = -1;
    for (const p of avail) {
      if (used.has(p.id)) continue;
      const sc = p.overall * slotFit(p.pos, slots[i]);
      if (sc > bestScore) { bestScore = sc; best = p; }
    }
    chosen[i] = best;
    if (best) used.add(best.id);
  }
  return chosen;
}
const rarity = (s) => ({ GOL: 0, LE: 1, LD: 1, PE: 2, PD: 2, ZAG: 3, ATA: 4, VOL: 5, MEI: 6, MC: 7 }[s] ?? 9);

export const TEAMS = CLUBS.map(buildTeam);
export const teamById = (id) => TEAMS.find((t) => t.id === id) || null;

// ---------- cores / uniformes ----------
function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function colorDistance(a, b) {
  const [r1, g1, b1] = hexToRgb(a), [r2, g2, b2] = hexToRgb(b);
  const rm = (r1 + r2) / 2;
  return Math.sqrt((2 + rm / 256) * (r1 - r2) ** 2 + 4 * (g1 - g2) ** 2 + (2 + (255 - rm) / 256) * (b1 - b2) ** 2);
}
export function luminance(h) {
  const [r, g, b] = hexToRgb(h).map((c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Uniformes da partida: o visitante troca para o reserva se as cores se confundirem. */
const GRASS = '#217c3e';
/** Uniforme que aparece bem no gramado: se a camisa principal for verde como a grama, usa a cor secundária. */
function kitOnGrass(t) {
  if (colorDistance(t.primary, GRASS) < 170) return { fill: t.secondary, trim: t.primary, alt: true };
  return { fill: t.primary, trim: t.secondary };
}
export function matchKits(home, away) {
  const hk = kitOnGrass(home);
  let ak = kitOnGrass(away);
  if (colorDistance(hk.fill, ak.fill) < 190) ak = ak.alt ? { fill: '#202226', trim: away.secondary } : { fill: away.secondary, trim: away.primary, alt: true };
  if (colorDistance(hk.fill, ak.fill) < 150 || colorDistance(ak.fill, GRASS) < 150) ak = { fill: '#202226', trim: '#e8e8e8', alt: true };
  for (const k of [hk, ak]) k.text = luminance(k.fill) > 0.45 ? '#111' : '#fff';
  return [hk, ak];
}

// ---------- escudo (SVG original, gerado a partir das cores) ----------
export function crestSVG(team, size = 48) {
  const p = team.primary, s = team.secondary;
  const txt = luminance(p) > 0.5 ? '#111' : '#fff';
  const clip = `c-${team.id}`;
  const shield = 'M24 3 L43 9 V24 C43 36 34 43 24 46 C14 43 5 36 5 24 V9 Z';
  let pat = '';
  switch (team.pattern) {
    case 'stripes': pat = [11, 21, 31].map((x) => `<rect x="${x}" y="0" width="5" height="50" fill="${s}"/>`).join(''); break;
    case 'band': pat = `<rect x="0" y="19" width="48" height="10" fill="${s}"/>`; break;
    case 'half': pat = `<rect x="24" y="0" width="24" height="50" fill="${s}"/>`; break;
    case 'cross': pat = `<rect x="20" y="0" width="8" height="50" fill="${s}"/><rect x="0" y="17" width="48" height="8" fill="${s}"/>`; break;
    case 'star': pat = `<path d="M24 10 L27 19 L36 19 L29 25 L32 34 L24 28 L16 34 L19 25 L12 19 L21 19 Z" fill="${s}"/>`; break;
  }
  const initials = team.short;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="${size}" height="${size}" role="img" aria-label="Escudo ${team.name}">`
    + `<defs><clipPath id="${clip}"><path d="${shield}"/></clipPath></defs>`
    + `<path d="${shield}" fill="${p}"/>`
    + `<g clip-path="url(#${clip})">${pat}</g>`
    + `<path d="${shield}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="2"/>`
    + `<path d="${shield}" fill="none" stroke="${s}" stroke-width="1" stroke-opacity=".8" transform="translate(2.4 2.6) scale(.9)"/>`
    + (team.pattern === 'star' ? '' : `<text x="24" y="${team.pattern === 'band' ? 27.5 : 29}" text-anchor="middle" font-family="system-ui,Segoe UI,Roboto,sans-serif" font-weight="800" font-size="10" fill="${team.pattern === 'band' ? (luminance(s) > 0.5 ? '#111' : '#fff') : txt}" stroke="${team.pattern === 'band' ? 'none' : 'rgba(0,0,0,.35)'}" stroke-width=".6" paint-order="stroke">${initials}</text>`)
    + `</svg>`;
}
