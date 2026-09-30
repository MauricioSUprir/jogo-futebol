// Times do GOLAÇO — 8 clubes FICTÍCIOS (nomes, cidades, escudos e jogadores inventados).
// Os elencos são gerados com um RNG com semente, então são sempre os mesmos.
//
// Exporta:
//   TEAMS                      lista dos 8 clubes (formato em tools/CONTRACTS.md)
//   teamById(id)               busca por id
//   crestSVG(team, size)       escudo original em SVG (string)
//   kitSVG(kit, size)          miniatura de camisa + calção (string, usada nos menus)
//   kitClash(kitA, kitB)       true se os uniformes se confundem (distância perceptual)
//   kitDistance(kitA, kitB)    ΔE (CIELAB) ponderado entre camisas/calções
//   resolveKits(home, away, prefs?) -> { homeKit, awayKit, homeGK, awayGK, auto }
//   playerOverall(player)      nota geral 0..99 a partir dos atributos
//   teamStars(team)            0,5..5 estrelas a partir da nota
import { FORMATIONS } from './config.js';

// ---------- RNG com semente (mulberry32) ----------
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rngFrom(seed) {
  let a = typeof seed === 'string' ? hashStr(seed) : seed >>> 0;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const clampI = (v, a, b) => Math.round(v < a ? a : v > b ? b : v);

// ---------- nomes (combinações inventadas; sobrenomes ligados a craques famosos ficam de fora) ----------
const INITIALS = 'ABCDEFGHIJLMNOPRSTVW'.split('');
const SURN = {
  br: ['Tavares', 'Siqueira', 'Batista', 'Lacerda', 'Brandão', 'Quintela', 'Farias', 'Arruda', 'Peixoto', 'Rezende', 'Nogueira',
    'Cordeiro', 'Valente', 'Prado', 'Macedo', 'Barreto', 'Sampaio', 'Paiva', 'Freitas', 'Queiroz', 'Salgado', 'Bastos', 'Leitão',
    'Amaral', 'Esteves', 'Fontes', 'Toledo', 'Vilela', 'Aguiar', 'Pimentel', 'Mendonça', 'Seixas', 'Dantas', 'Bezerra', 'Galvão',
    'Cunha', 'Lobo', 'Portela', 'Serpa', 'Viana', 'Rangel', 'Sodré', 'Monteiro', 'Figueira', 'Ribas', 'Borba', 'Teles', 'Correia',
    'Loureiro', 'Magalhães', 'Pacheco', 'Quaresma', 'Rosário', 'Tenório', 'Uchoa', 'Vasconcelos', 'Brito', 'Carmo', 'Falcone'],
  apelido: ['Tuca', 'Biel', 'Kiko', 'Nando', 'Lelo', 'Dudu Lima', 'Tatá', 'Caio B.', 'Juca', 'Neco'],
  es: ['Ibarra', 'Echeverría', 'Sosa', 'Montoya', 'Arriaga', 'Quiroga', 'Villalba', 'Olmedo', 'Aranda', 'Bustos', 'Cabral', 'Figueroa',
    'Maldonado', 'Acosta', 'Salvatierra', 'Duarte', 'Medina', 'Leguizamón', 'Ocampo', 'Irala', 'Garay', 'Benavídez', 'Solano', 'Toranzo'],
  it: ['Ferraro', 'Bellandi', 'Moretti', 'Rinaldi', 'Galli', 'Vitale', 'Lombardo', 'Orsini', 'Fabbri', 'Cattaneo', 'Donati', 'Sartori',
    'Bassi', 'Ruggeri', 'Valli', 'Testa', 'Negri', 'Pagano', 'Corradi', 'Ferrante', 'Zanetto', 'Brambati'],
  de: ['Kessler', 'Vogel', 'Hartmann', 'Lindqvist', 'Adler', 'Reiter', 'Falk', 'Brenner', 'Ostermann', 'Dreyer', 'Lenz', 'Winkler',
    'Haber', 'Stahl', 'Seidel', 'Pohl', 'Ahlberg', 'Janssen', 'Holmgren', 'Brückner', 'Albers', 'Rautio'],
};

// ---------- aparência ----------
const SKINS = ['#f2d2bb', '#e8bf9f', '#dcaa85', '#c99169', '#b27a52', '#96603d', '#7a4a2d', '#5c3620', '#462817'];
const HAIR_COLORS = { black: '#15110e', dark: '#2e1f15', brown: '#4d321e', light: '#79542f', blond: '#b48d52', ginger: '#8f4a22', gray: '#8b8580' };

function makeLook(r, flavour, pos) {
  // distribuição de tom de pele depende um pouco da "região" do clube, sempre variada
  const bias = { br: 0.45, es: 0.35, it: 0.2, de: 0.15 }[flavour] ?? 0.35;
  const si = clampI((r() * 0.75 + bias * r() * 0.9) * SKINS.length - 0.5, 0, SKINS.length - 1);
  const skin = SKINS[si];
  const dark = si >= 5;
  let hairColor;
  if (dark) hairColor = r() < 0.9 ? HAIR_COLORS.black : HAIR_COLORS.dark;
  else {
    const x = r();
    hairColor = x < 0.3 ? HAIR_COLORS.black : x < 0.58 ? HAIR_COLORS.dark : x < 0.78 ? HAIR_COLORS.brown : x < 0.9 ? HAIR_COLORS.light : x < 0.97 ? HAIR_COLORS.blond : HAIR_COLORS.ginger;
  }
  const styles = dark ? ['short', 'buzz', 'curly', 'afro', 'bald', 'short', 'buzz', 'bun'] : ['short', 'short', 'buzz', 'curly', 'long', 'bald', 'bun', 'short'];
  const hair = pick(r, styles);
  if (hair === 'bald' && r() < 0.3) hairColor = HAIR_COLORS.gray;
  const tall = pos === 'GOL' || pos === 'ZAG' ? 0.1 : pos === 'CA' || pos === 'ATA' ? 0.04 : 0;
  const height = +Math.min(1.96, Math.max(1.68, 1.70 + r() * 0.2 + tall + (r() - 0.5) * 0.06)).toFixed(2);
  return { skin, hair, hairColor, height, build: +(0.25 + r() * 0.6 + (pos === 'ZAG' ? 0.1 : 0)).toFixed(2), beard: r() < 0.32 };
}

// ---------- posições ----------
// Converte cada vaga da formação no rótulo exibido (lado direito = z > 0).
export function slotLabel(role, x, z, slots) {
  if (role === 'GK') return 'GOL';
  const az = Math.abs(z);
  if (role === 'DEF') return az >= 18 ? (z > 0 ? 'LD' : 'LE') : 'ZAG';
  if (role === 'MID') {
    if (az >= 24) return z > 0 ? 'ALD' : 'ALE';
    if (az >= 18) return z > 0 ? 'MD' : 'ME';
    if (x <= -18) return 'VOL';
    if (x > -8) return 'MEI';
    return 'MC';
  }
  if (az >= 18) return z > 0 ? 'PD' : 'PE';
  return slots.filter(s => s[0] === 'ATT' && Math.abs(s[2]) < 18).length === 1 ? 'CA' : 'ATA';
}

// deslocamento de cada atributo em relação à nota do jogador: [pac, sho, pas, dri, def, phy]
const PROFILE = {
  GOL: [-26, -46, -20, -32, -36, -6], ZAG: [-12, -34, -12, -18, 4, 3],
  LD: [3, -22, -4, -5, -3, -8], LE: [3, -22, -4, -5, -3, -8], ALD: [4, -16, -2, -1, -8, -10], ALE: [4, -16, -2, -1, -8, -10],
  VOL: [-10, -18, -2, -8, 2, 2], MC: [-6, -8, 2, -1, -12, -6], MEI: [-2, -2, 3, 3, -34, -14],
  MD: [3, -8, 0, 1, -22, -12], ME: [3, -8, 0, 1, -22, -12], PD: [5, -4, -4, 3, -44, -14], PE: [5, -4, -4, 3, -44, -14],
  CA: [-1, 3, -10, -2, -48, 0], ATA: [2, 2, -8, 0, -46, -3],
};
const CLASSIC_NUM = { GOL: [1], LD: [2], ZAG: [3, 4, 14], LE: [6], VOL: [5, 15], MC: [8, 16], MEI: [10], MD: [7], ME: [11],
  ALD: [2, 13], ALE: [6], PD: [7], PE: [11], CA: [9], ATA: [9, 19, 11] };

function makePlayer(r, team, pos, ovr, used, usedNums, isSub) {
  // nome
  let name;
  for (let tries = 0; tries < 50; tries++) {
    const x = r();
    if (team.flavour === 'br' && x < 0.08) name = pick(r, SURN.apelido);
    else {
      const pool = x < 0.72 || team.flavour === 'br' ? SURN[team.flavour] : SURN[pick(r, ['br', 'es', 'it', 'de'])];
      name = `${pick(r, INITIALS)}. ${pick(r, pool)}`;
    }
    const sur = name.split(' ').pop();
    if (!used.has(sur)) { used.add(sur); break; }
  }
  // número
  let num = (CLASSIC_NUM[pos] || []).find(n => !usedNums.has(n));
  if (isSub || !num) { num = pos === 'GOL' ? 12 : 13; while (usedNums.has(num) || num === 12 && pos !== 'GOL') num = 13 + Math.floor(r() * 17); }
  usedNums.add(num);
  // atributos
  const prof = PROFILE[pos];
  const k = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'];
  const attrs = {};
  k.forEach((key, i) => { attrs[key] = clampI(ovr + prof[i] + (r() - 0.5) * 9, 18, 97); });
  attrs.gk = pos === 'GOL' ? clampI(ovr + 2 + (r() - 0.5) * 4, 40, 97) : clampI(6 + r() * 14, 5, 25);
  return { name, num, pos, attrs, foot: pos === 'LE' || pos === 'ALE' || pos === 'PD' ? (r() < 0.75 ? 'E' : 'D') : (r() < 0.2 ? 'E' : 'D'), look: makeLook(r, team.flavour, pos) };
}

const SUB_POS = (f) => ['GOL', 'ZAG', f === '3-5-2' ? 'ALD' : 'LD', 'VOL', 'MEI', f === '4-4-2' ? 'ME' : 'PE', f === '4-4-2' || f === '3-5-2' ? 'ATA' : 'CA'];

function buildRoster(team) {
  const r = rngFrom('golaco:' + team.id);
  const slots = FORMATIONS[team.formation];
  const used = new Set(), usedNums = new Set();
  const star = 1 + Math.floor(r() * 10);                 // um destaque entre os titulares de linha
  const players = slots.map((s, i) => {
    const pos = slotLabel(s[0], s[1], s[2], slots);
    const ovr = team.rating + (i === star ? 4 + r() * 3 : (r() - 0.5) * 7);
    return makePlayer(r, team, pos, ovr, used, usedNums, false);
  });
  for (const pos of SUB_POS(team.formation)) players.push(makePlayer(r, team, pos, team.rating - 4 - r() * 6, used, usedNums, true));
  return players;
}

// ---------- os clubes ----------
const K = (shirt, sleeves, shorts, socks, pattern, second, trim, number) => ({ shirt, sleeves, shorts, socks, pattern, second, trim, number });

const DEFS = [
  { id: 'serrano', name: 'Atlético Serrano', short: 'SER', city: 'Serra Alta', flavour: 'br', nickname: 'O Verdão da Serra', stadium: 'Arena da Serra',
    formation: '4-3-3', rating: 86, style: { press: 0.75, width: 0.7, tempo: 0.8, directness: 0.45 },
    colors: { primary: '#0f7a3d', secondary: '#ffffff' }, crest: { shape: 'shield', motif: 'stripes', emblem: 'star' },
    kits: { home: K('#0f7a3d', '#0f7a3d', '#ffffff', '#0f7a3d', 'stripes', '#ffffff', '#ffffff', '#ffffff'),
      away: K('#111418', '#111418', '#111418', '#111418', 'plain', '#0f7a3d', '#2fd46f', '#2fd46f'),
      gk: K('#f2c21b', '#f2c21b', '#1b1b1b', '#f2c21b', 'plain', '#1b1b1b', '#1b1b1b', '#1b1b1b'),
      gkAway: K('#7a2bd6', '#7a2bd6', '#7a2bd6', '#7a2bd6', 'plain', '#ffffff', '#ffffff', '#ffffff') } },
  { id: 'aurora', name: 'Porto Aurora EC', short: 'PAU', city: 'Porto Aurora', flavour: 'br', nickname: 'Tricolor do Cais', stadium: 'Estádio do Cais',
    formation: '4-2-3-1', rating: 84, style: { press: 0.55, width: 0.6, tempo: 0.65, directness: 0.5 },
    colors: { primary: '#10245c', secondary: '#e3b341' }, crest: { shape: 'circle', motif: 'hoops', emblem: 'anchor' },
    kits: { home: K('#10245c', '#10245c', '#10245c', '#e3b341', 'hoops', '#e3b341', '#e3b341', '#ffffff'),
      away: K('#f4f1e8', '#10245c', '#10245c', '#f4f1e8', 'plain', '#10245c', '#e3b341', '#10245c'),
      gk: K('#e8452c', '#e8452c', '#e8452c', '#e8452c', 'plain', '#2a0f0a', '#2a0f0a', '#ffffff'),
      gkAway: K('#29c2b5', '#29c2b5', '#0e3b38', '#29c2b5', 'plain', '#0e3b38', '#0e3b38', '#0e3b38') } },
  { id: 'valdoria', name: 'AC Valdoria', short: 'VAL', city: 'Valdoria', flavour: 'it', nickname: 'I Granata del Lago', stadium: 'Stadio del Lago',
    formation: '3-5-2', rating: 82, style: { press: 0.45, width: 0.8, tempo: 0.5, directness: 0.4 },
    colors: { primary: '#7a1730', secondary: '#8fc8ec' }, crest: { shape: 'oval', motif: 'halves', emblem: 'tower' },
    kits: { home: K('#7a1730', '#8fc8ec', '#ffffff', '#7a1730', 'halves', '#8fc8ec', '#ffffff', '#ffffff'),
      away: K('#8fc8ec', '#8fc8ec', '#7a1730', '#8fc8ec', 'plain', '#7a1730', '#7a1730', '#7a1730'),
      gk: K('#2b2d33', '#2b2d33', '#2b2d33', '#2b2d33', 'plain', '#f28c28', '#f28c28', '#f28c28'),
      gkAway: K('#b7e34a', '#b7e34a', '#1f2a0a', '#b7e34a', 'plain', '#1f2a0a', '#1f2a0a', '#1f2a0a') } },
  { id: 'nordhafen', name: 'FC Nordhafen', short: 'NOR', city: 'Nordhafen', flavour: 'de', nickname: 'Die Roten vom Hafen', stadium: 'Hafenarena',
    formation: '4-4-2', rating: 81, style: { press: 0.85, width: 0.65, tempo: 0.85, directness: 0.7 },
    colors: { primary: '#d31f2a', secondary: '#ffffff' }, crest: { shape: 'hex', motif: 'sash', emblem: 'wave' },
    kits: { home: K('#ffffff', '#ffffff', '#ffffff', '#d31f2a', 'sash', '#d31f2a', '#d31f2a', '#d31f2a'),
      away: K('#d31f2a', '#d31f2a', '#1c1c20', '#d31f2a', 'plain', '#1c1c20', '#ffffff', '#ffffff'),
      gk: K('#1d8f5b', '#1d8f5b', '#1d8f5b', '#1d8f5b', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#f5d418', '#f5d418', '#f5d418', '#f5d418', 'plain', '#222222', '#222222', '#222222') } },
  { id: 'monteluz', name: 'Real Monteluz', short: 'MON', city: 'Monteluz', flavour: 'es', nickname: 'Los Violetas', stadium: 'Campo de la Luz',
    formation: '4-3-3', rating: 80, style: { press: 0.6, width: 0.55, tempo: 0.55, directness: 0.3 },
    colors: { primary: '#5b2a8c', secondary: '#f5f5f7' }, crest: { shape: 'crown', motif: 'plain', emblem: 'sun' },
    kits: { home: K('#f5f5f7', '#f5f5f7', '#5b2a8c', '#f5f5f7', 'pinstripe', '#5b2a8c', '#5b2a8c', '#5b2a8c'),
      away: K('#5b2a8c', '#5b2a8c', '#5b2a8c', '#5b2a8c', 'plain', '#f5c542', '#f5c542', '#f5c542'),
      gk: K('#ff7a1a', '#ff7a1a', '#1a1a1a', '#ff7a1a', 'plain', '#1a1a1a', '#1a1a1a', '#1a1a1a'),
      gkAway: K('#1e9bd7', '#1e9bd7', '#1e9bd7', '#1e9bd7', 'plain', '#ffffff', '#ffffff', '#ffffff') } },
  { id: 'ferroviario', name: 'Ferroviário Ribeira', short: 'FER', city: 'Ribeira do Sul', flavour: 'br', nickname: 'Locomotiva', stadium: 'Estádio da Estação',
    formation: '4-4-2', rating: 76, style: { press: 0.7, width: 0.75, tempo: 0.7, directness: 0.75 },
    colors: { primary: '#f5c400', secondary: '#141414' }, crest: { shape: 'shield', motif: 'hoops', emblem: 'wheel' },
    kits: { home: K('#f5c400', '#141414', '#141414', '#f5c400', 'hoops', '#141414', '#141414', '#141414'),
      away: K('#141414', '#141414', '#141414', '#141414', 'pinstripe', '#f5c400', '#f5c400', '#f5c400'),
      gk: K('#2c6fe0', '#2c6fe0', '#2c6fe0', '#2c6fe0', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#e0e4ea', '#e0e4ea', '#39414d', '#e0e4ea', 'plain', '#39414d', '#39414d', '#39414d') } },
  { id: 'bahiasur', name: 'Unión Bahía Sur', short: 'UBS', city: 'Bahía Sur', flavour: 'es', nickname: 'El Celeste', stadium: 'Estadio Costanera',
    formation: '3-5-2', rating: 73, style: { press: 0.4, width: 0.7, tempo: 0.45, directness: 0.6 },
    colors: { primary: '#5fb4e8', secondary: '#ffffff' }, crest: { shape: 'circle', motif: 'stripes', emblem: 'star' },
    kits: { home: K('#5fb4e8', '#5fb4e8', '#1b2a3f', '#ffffff', 'stripes', '#ffffff', '#1b2a3f', '#1b2a3f'),
      away: K('#1b2a3f', '#1b2a3f', '#1b2a3f', '#1b2a3f', 'sash', '#5fb4e8', '#5fb4e8', '#ffffff'),
      gk: K('#c9e83a', '#c9e83a', '#c9e83a', '#c9e83a', 'plain', '#1a1a1a', '#1a1a1a', '#1a1a1a'),
      gkAway: K('#d63b6a', '#d63b6a', '#d63b6a', '#d63b6a', 'plain', '#ffffff', '#ffffff', '#ffffff') } },
  { id: 'cerrado', name: 'Estrela do Cerrado', short: 'EST', city: 'Cerradópolis', flavour: 'br', nickname: 'O Laranjão do Planalto', stadium: 'Arena Ipê',
    formation: '4-2-3-1', rating: 70, style: { press: 0.5, width: 0.5, tempo: 0.6, directness: 0.65 },
    colors: { primary: '#f26b1d', secondary: '#101010' }, crest: { shape: 'hex', motif: 'halves', emblem: 'star' },
    kits: { home: K('#f26b1d', '#f26b1d', '#101010', '#f26b1d', 'plain', '#101010', '#101010', '#101010'),
      away: K('#ffffff', '#f26b1d', '#ffffff', '#ffffff', 'halves', '#f26b1d', '#101010', '#101010'),
      gk: K('#2a9d5c', '#2a9d5c', '#2a9d5c', '#2a9d5c', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#6b6f7a', '#6b6f7a', '#6b6f7a', '#6b6f7a', 'plain', '#ffe14a', '#ffe14a', '#ffe14a') } },
];

export const TEAMS = DEFS.map(d => {
  const t = { ...d };
  t.players = buildRoster(t);
  return t;
});

export const teamById = (id) => TEAMS.find(t => t.id === id) || null;

export function playerOverall(p) {
  const a = p.attrs;
  if (p.pos === 'GOL') return Math.round(a.gk * 0.9 + a.phy * 0.05 + a.pas * 0.05);
  const w = { ZAG: [0.1, 0, 0.1, 0.05, 0.5, 0.25], VOL: [0.1, 0.05, 0.25, 0.1, 0.35, 0.15], CA: [0.15, 0.45, 0.05, 0.2, 0, 0.15],
    ATA: [0.2, 0.4, 0.1, 0.2, 0, 0.1], MEI: [0.1, 0.2, 0.35, 0.3, 0, 0.05], MC: [0.1, 0.1, 0.35, 0.2, 0.15, 0.1] }[p.pos]
    || (['LD', 'LE'].includes(p.pos) ? [0.25, 0.05, 0.2, 0.1, 0.3, 0.1] : [0.25, 0.2, 0.2, 0.3, 0, 0.05]);
  const v = [a.pac, a.sho, a.pas, a.dri, a.def, a.phy];
  return Math.round(v.reduce((s, x, i) => s + x * w[i], 0) + 3);
}

export const teamStars = (team) => Math.max(0.5, Math.min(5, Math.round(((team.rating - 62) / 4.8) * 2) / 2));

// ---------- cores ----------
function hexRgb(h) { const n = parseInt(h.replace('#', ''), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function toLab(hex) {
  const lin = hexRgb(hex).map(c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const x = (lin[0] * 0.4124 + lin[1] * 0.3576 + lin[2] * 0.1805) / 0.95047;
  const y = lin[0] * 0.2126 + lin[1] * 0.7152 + lin[2] * 0.0722;
  const z = (lin[0] * 0.0193 + lin[1] * 0.1192 + lin[2] * 0.9505) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}
const dE = (a, b) => { const p = toLab(a), q = toLab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
// cor "média" da camisa vista de longe (padrão mistura a cor secundária)
const MIX = { plain: 0, stripes: 0.45, hoops: 0.45, halves: 0.5, sash: 0.22, pinstripe: 0.12 };
function blend(a, b, t) { const p = hexRgb(a), q = hexRgb(b); return '#' + p.map((c, i) => Math.round(c + (q[i] - c) * t).toString(16).padStart(2, '0')).join(''); }
const shirtLook = (k) => blend(k.shirt, k.second || k.shirt, MIX[k.pattern] ?? 0);

export function kitDistance(a, b) {
  const shirt = Math.min(dE(shirtLook(a), shirtLook(b)), dE(a.shirt, b.shirt) + 8);
  return { shirt, shorts: dE(a.shorts, b.shorts), total: shirt * 0.75 + dE(a.shorts, b.shorts) * 0.25 };
}
export function kitClash(a, b) {
  const d = kitDistance(a, b);
  return d.shirt < 30 || (d.shirt < 45 && d.shorts < 22);
}

// prefs: { home: 'auto'|'home'|'away', away: 'auto'|'home'|'away' }
export function resolveKits(home, away, prefs = {}) {
  const hk = prefs.home === 'away' ? home.kits.away : home.kits.home;
  let ak, auto = false;
  if (prefs.away === 'home') ak = away.kits.home;
  else if (prefs.away === 'away') ak = away.kits.away;
  else {
    ak = away.kits.home;
    if (kitClash(hk, ak)) { auto = true; ak = kitDistance(hk, away.kits.away).total >= kitDistance(hk, ak).total ? away.kits.away : ak; }
  }
  const avoid = (gkA, gkB, others) => (others.some(o => kitClash(gkA, o)) && !others.some(o => kitClash(gkB, o)) ? gkB : gkA);
  const homeGK = avoid(home.kits.gk, home.kits.gkAway, [ak, hk]);
  const awayGK = avoid(away.kits.gk, away.kits.gkAway, [hk, ak, homeGK]);
  return { homeKit: hk, awayKit: ak, homeGK, awayGK, auto, clash: kitClash(hk, ak) };
}

// ---------- escudo ----------
let uid = 0;
const SHAPES = {
  shield: 'M50 4 L92 14 L92 52 C92 78 72 92 50 100 C28 92 8 78 8 52 L8 14 Z',
  circle: 'M50 4 A46 46 0 1 1 49.99 4 Z',
  oval: 'M50 3 C78 3 92 26 92 52 C92 80 74 99 50 99 C26 99 8 80 8 52 C8 26 22 3 50 3 Z',
  hex: 'M50 3 L92 26 L92 76 L50 99 L8 76 L8 26 Z',
  crown: 'M10 22 L26 8 L38 18 L50 4 L62 18 L74 8 L90 22 L90 58 C90 82 70 94 50 100 C30 94 10 82 10 58 Z',
};
const EMBLEMS = {
  star: (c) => `<path d="M50 20 l5.9 12 13.2 1.9 -9.6 9.3 2.3 13.1 -11.8 -6.2 -11.8 6.2 2.3 -13.1 -9.6 -9.3 13.2 -1.9z" fill="${c}"/>`,
  anchor: (c) => `<g fill="none" stroke="${c}" stroke-width="4.5" stroke-linecap="round"><circle cx="50" cy="22" r="5"/><path d="M50 27 V56 M38 34 H62 M32 46 C34 56 42 60 50 60 C58 60 66 56 68 46"/></g>`,
  tower: (c) => `<path d="M40 56 V30 h-3 v-8 h6 v4 h4 v-4 h6 v4 h4 v-4 h6 v8 h-3 v26 Z M47 56 v-10 a3 3 0 0 1 6 0 v10z" fill="${c}" fill-rule="evenodd"/>`,
  wave: (c) => `<path d="M26 38 q6 -8 12 0 t12 0 t12 0 t12 0 M26 50 q6 -8 12 0 t12 0 t12 0 t12 0" fill="none" stroke="${c}" stroke-width="5" stroke-linecap="round"/>`,
  sun: (c) => `<g fill="${c}"><circle cx="50" cy="38" r="9"/>${Array.from({ length: 12 }, (_, i) => { const a = i * Math.PI / 6; return `<path d="M${50 + Math.cos(a) * 12} ${38 + Math.sin(a) * 12} L${50 + Math.cos(a + 0.12) * 20} ${38 + Math.sin(a + 0.12) * 20} L${50 + Math.cos(a - 0.12) * 20} ${38 + Math.sin(a - 0.12) * 20}Z"/>`; }).join('')}</g>`,
  wheel: (c) => `<g fill="none" stroke="${c}" stroke-width="4"><circle cx="50" cy="38" r="15"/><circle cx="50" cy="38" r="3.5" fill="${c}"/><path d="M50 23 V53 M35 38 H65 M39.4 27.4 L60.6 48.6 M60.6 27.4 L39.4 48.6" stroke-width="2.6"/></g>`,
};

function lumOf(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }

export function crestSVG(team, size = 64) {
  const id = `cr${team.short}${++uid}`;
  const { primary: p, secondary: s } = team.colors;
  const { shape, motif, emblem } = team.crest;
  const path = SHAPES[shape] || SHAPES.shield;
  let fill = '';
  if (motif === 'stripes') for (let i = 0; i < 7; i++) fill += i % 2 ? `<rect x="${i * 14.3}" y="0" width="14.3" height="104" fill="${s}"/>` : '';
  else if (motif === 'hoops') for (let i = 0; i < 8; i++) fill += i % 2 ? `<rect x="0" y="${58 + (i - 1) * 7}" width="100" height="7" fill="${s}"/>` : '';
  else if (motif === 'halves') fill = `<rect x="50" y="0" width="50" height="104" fill="${s}"/>`;
  else if (motif === 'sash') fill = `<path d="M-10 30 L30 -10 L110 70 L70 110 Z" fill="${s}" opacity="0.9" transform="translate(0 6)"/>`;
  const light = lumOf(p) > 0.62;
  const ink = light ? p === s ? '#111' : s : '#ffffff';
  const band = light ? '#111' : s;
  const bandText = lumOf(band) > 0.55 ? '#111' : '#fff';
  const disc = motif === 'stripes' || motif === 'halves';
  const emColor = disc ? (light ? '#111' : s) : motif === 'plain' ? s : ink;
  const em = (EMBLEMS[emblem] || EMBLEMS.star)(emColor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 104" width="${size}" height="${size * 1.04}" role="img" aria-label="Escudo ${team.name}">
<defs><clipPath id="${id}"><path d="${path}"/></clipPath><linearGradient id="${id}g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".25"/></linearGradient></defs>
<g clip-path="url(#${id})"><rect width="100" height="104" fill="${p}"/>${fill}
<rect x="0" y="62" width="100" height="20" fill="${band}"/>
<rect width="100" height="104" fill="url(#${id}g)"/></g>
<g>${disc ? `<circle cx="50" cy="38" r="21" fill="${p}" stroke="${s}" stroke-width="2.5"/>` : ''}${em}</g>
<text x="50" y="77.5" text-anchor="middle" font-family="'Barlow Condensed','Oswald','Arial Narrow',sans-serif" font-weight="800" font-size="16" letter-spacing="2" fill="${bandText}">${team.short}</text>
<path d="${path}" fill="none" stroke="${light ? '#111' : s}" stroke-width="4"/>
<path d="${path}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1" transform="translate(50 52) scale(.9) translate(-50 -52)"/>
</svg>`;
}

// ---------- camisa em miniatura ----------
export function kitSVG(kit, size = 80) {
  const id = `kt${++uid}`;
  const body = 'M30 10 L42 6 Q50 12 58 6 L70 10 L70 70 L30 70 Z';
  const shirt = 'M30 10 L42 6 Q50 12 58 6 L70 10 L88 24 L80 38 L70 32 L70 70 L30 70 L30 32 L20 38 L12 24 Z';
  let pat = '';
  const c = kit.second;
  if (kit.pattern === 'stripes') for (let x = 34; x < 70; x += 10) pat += `<rect x="${x}" y="0" width="5" height="80" fill="${c}"/>`;
  else if (kit.pattern === 'hoops') for (let y = 16; y < 70; y += 12) pat += `<rect x="0" y="${y}" width="100" height="6" fill="${c}"/>`;
  else if (kit.pattern === 'halves') pat = `<rect x="50" y="0" width="30" height="80" fill="${c}"/>`;
  else if (kit.pattern === 'sash') pat = `<path d="M30 24 L42 6 L50 6 L70 52 L70 66 Z" fill="${c}"/>`;
  else if (kit.pattern === 'pinstripe') for (let x = 33; x < 70; x += 4.5) pat += `<rect x="${x}" y="0" width="1" height="80" fill="${c}" opacity=".8"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" width="${size}" height="${size * 1.12}" aria-hidden="true">
<defs><clipPath id="${id}"><path d="${body}"/></clipPath><linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
<path d="${shirt}" fill="${kit.sleeves}"/>
<path d="${body}" fill="${kit.shirt}"/><g clip-path="url(#${id})">${pat}</g>
<path d="M12 24 L20 38 M88 24 L80 38" stroke="${kit.trim}" stroke-width="3"/>
<path d="M42 6 Q50 14 58 6" fill="none" stroke="${kit.trim}" stroke-width="3"/>
<path d="${shirt}" fill="url(#${id}s)"/>
<text x="50" y="50" text-anchor="middle" font-family="'Barlow Condensed',sans-serif" font-weight="800" font-size="22" fill="${kit.number}">10</text>
<path d="M31 72 L69 72 L72 96 L53 96 L50 84 L47 96 L28 96 Z" fill="${kit.shorts}"/>
<path d="M31 72 L69 72" stroke="${kit.trim}" stroke-width="2"/>
<rect x="30" y="99" width="15" height="11" rx="2" fill="${kit.socks}"/><rect x="55" y="99" width="15" height="11" rx="2" fill="${kit.socks}"/>
</svg>`;
}
