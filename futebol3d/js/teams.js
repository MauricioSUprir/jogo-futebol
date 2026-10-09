// Times do GOLAÇO — 8 clubes FICTÍCIOS (nomes, cidades, escudos e jogadores inventados).
// Os elencos são gerados com um RNG com semente, então são sempre os mesmos.
//
// Exporta:
//   TEAMS                      lista dos 8 clubes (formato em tools/CONTRACTS.md)
//   teamById(id)               busca por id (inclui os times registrados com registerTeam)
//   registerTeam(team)         time de fora (Total Match) com escudo/uniformes no formato daqui
//   allTeams()                 os 8 clubes + os registrados
//   detailAttrs(attrs, pos, k) completa os atributos detalhados a partir dos 6 básicos
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

// Atributos detalhados (seção 21 da especificação), derivados dos 6 básicos com uma
// semente própria do jogador — não consome o sorteio do time (nomes e visual seguem iguais).
// ctl = controle de bola / primeiro toque (separado do drible), agi = agilidade,
// bal = equilíbrio, str = força, tkl = desarme em pé, sld = carrinho, ant = antecipação,
// acc = aceleração, sta = fôlego.
export function detailAttrs(a, pos, key) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
  const r = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  const n = (s) => (r() + r() - 1) * s;           // ruído triangular ±s
  const def = ['ZAG', 'VOL', 'LD', 'LE'].includes(pos), tec = ['MEI', 'MC', 'PD', 'PE', 'ATA', 'MD', 'ME'].includes(pos);
  a.ctl = clampI(a.dri * 0.5 + a.pas * 0.4 + 6 + (tec ? 3 : def ? -3 : 0) + n(9), 20, 97);
  a.agi = clampI(a.dri * 0.45 + a.pac * 0.45 - (a.phy - 65) * 0.25 + 7 + n(9), 20, 97);
  a.bal = clampI(a.phy * 0.45 + a.dri * 0.35 + 14 + n(9), 25, 97);
  a.str = clampI(a.phy * 0.95 + (def || pos === 'CA' ? 4 : 0) + n(8), 25, 97);
  a.tkl = clampI(a.def * 0.95 + 3 + n(7), 10, 97);
  a.sld = clampI(a.def * 0.9 + n(9), 10, 95);
  a.ant = clampI(a.def * 0.6 + (a.pas + a.dri) * 0.18 + 6 + n(9), 15, 97);
  a.acc = clampI(a.pac * 0.75 + a.agi * 0.25 + n(6), 20, 97);
  a.sta = clampI(a.phy * 0.55 + 32 + n(10), 35, 97);
}

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
  detailAttrs(attrs, pos, team.id + '|' + name + '|' + num);
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
// Kit = { shirt, sleeves, shorts, socks, pattern, second, trim, number,
//         collar /*'crew'|'v'|'polo'*/, panel /*cor das laterais ou null*/, numberOutline /*contorno do número*/,
//         sponsor /*marca fictícia no peito*/, sponsorColor, club /*id do clube (escudo no peito)*/, gloves? }
// Os campos club/sponsor/collar são preenchidos a partir do clube logo abaixo (DEFS -> TEAMS).
const K = (shirt, sleeves, shorts, socks, pattern, second, trim, number, extra = {}) => ({ shirt, sleeves, shorts, socks, pattern, second, trim, number, ...extra });

// Paleta da identidade GOLAÇO (preto e verde) — o Atlético Serrano é o clube-vitrine.
const G_GREEN = '#12b85a', G_GREEN_D = '#0b7a3c', G_BLACK = '#0b0d0c';

const DEFS = [
  { id: 'serrano', name: 'Atlético Serrano', short: 'SER', city: 'Serra Alta', flavour: 'br', nickname: 'O Falcão da Serra', stadium: 'Arena da Serra',
    formation: '4-3-3', rating: 86, style: { press: 0.75, width: 0.7, tempo: 0.8, directness: 0.45 },
    colors: { primary: G_GREEN, secondary: G_BLACK, accent: '#1ee37a' }, collar: 'v', sponsor: 'ZENTRAX',
    crest: { shape: 'heater', motif: 'stripes', emblem: 'falcon', metal: 'silver', stars: 3, founded: 1921, initials: 'AS',
      field: G_GREEN, motifColor: G_BLACK, disc: G_BLACK, ink: '#f4f7f5', accent: '#1ee37a', chief: G_BLACK, ribbon: G_BLACK, ribbonText: '#ffffff' },
    kits: { home: K(G_GREEN, G_BLACK, G_BLACK, G_BLACK, 'stripes', G_BLACK, '#1ee37a', '#ffffff', { numberOutline: G_BLACK, sponsorColor: '#ffffff' }),
      away: K('#f3f5f4', '#f3f5f4', '#f3f5f4', '#f3f5f4', 'sash', G_BLACK, G_GREEN, G_BLACK, { panel: G_GREEN, sponsorColor: G_BLACK, collar: 'crew' }),
      gk: K('#ffd21f', '#ffd21f', G_BLACK, '#ffd21f', 'plain', G_BLACK, G_BLACK, G_BLACK, { panel: G_BLACK, sponsorColor: G_BLACK, collar: 'crew' }),
      gkAway: K('#7a2bd6', '#7a2bd6', '#7a2bd6', '#7a2bd6', 'plain', '#ffffff', '#ffffff', '#ffffff', { collar: 'crew' }) } },
  { id: 'aurora', name: 'Porto Aurora EC', short: 'PAU', city: 'Porto Aurora', flavour: 'br', nickname: 'Tricolor do Cais', stadium: 'Estádio do Cais',
    formation: '4-2-3-1', rating: 84, style: { press: 0.55, width: 0.6, tempo: 0.65, directness: 0.5 },
    colors: { primary: '#10245c', secondary: '#e3b341' }, collar: 'polo', sponsor: 'MARÉVIA',
    crest: { shape: 'roundel', motif: 'rays', emblem: 'anchor', metal: 'gold', stars: 2, founded: 1908, initials: 'PAEC',
      field: '#10245c', motifColor: '#e3b341', ring: '#0a1838', ink: '#f1c85a', accent: '#ffffff' },
    kits: { home: K('#10245c', '#10245c', '#10245c', '#e3b341', 'hoops', '#e3b341', '#e3b341', '#ffffff', { sponsorColor: '#ffffff', numberOutline: '#10245c' }),
      away: K('#f4f1e8', '#10245c', '#10245c', '#f4f1e8', 'plain', '#10245c', '#e3b341', '#10245c', { panel: '#10245c', sponsorColor: '#10245c' }),
      gk: K('#e8452c', '#e8452c', '#e8452c', '#e8452c', 'plain', '#2a0f0a', '#2a0f0a', '#ffffff', { collar: 'crew' }),
      gkAway: K('#29c2b5', '#29c2b5', '#0e3b38', '#29c2b5', 'plain', '#0e3b38', '#0e3b38', '#0e3b38', { collar: 'crew' }) } },
  { id: 'valdoria', name: 'AC Valdoria', short: 'VAL', city: 'Valdoria', flavour: 'it', nickname: 'I Granata del Lago', stadium: 'Stadio del Lago',
    formation: '3-5-2', rating: 82, style: { press: 0.45, width: 0.8, tempo: 0.5, directness: 0.4 },
    colors: { primary: '#7a1730', secondary: '#8fc8ec' }, collar: 'crew', sponsor: 'LAGOTTI',
    crest: { shape: 'oval', motif: 'halves', emblem: 'tower', metal: 'gold', stars: 1, founded: 1899, initials: 'ACV',
      field: '#7a1730', motifColor: '#8fc8ec', ring: '#5a0f22', disc: '#5a0f22', ink: '#f4ede0', accent: '#8fc8ec' },
    kits: { home: K('#7a1730', '#8fc8ec', '#ffffff', '#7a1730', 'halves', '#8fc8ec', '#ffffff', '#ffffff', { numberOutline: '#3a0a17', sponsorColor: '#ffffff', sponsorOutline: true }),
      away: K('#8fc8ec', '#8fc8ec', '#7a1730', '#8fc8ec', 'plain', '#7a1730', '#7a1730', '#7a1730', { panel: '#7a1730', sponsorColor: '#7a1730' }),
      gk: K('#2b2d33', '#2b2d33', '#2b2d33', '#2b2d33', 'plain', '#f28c28', '#f28c28', '#f28c28'),
      gkAway: K('#b7e34a', '#b7e34a', '#1f2a0a', '#b7e34a', 'plain', '#1f2a0a', '#1f2a0a', '#1f2a0a') } },
  { id: 'nordhafen', name: 'FC Nordhafen', short: 'NOR', city: 'Nordhafen', flavour: 'de', nickname: 'Die Roten vom Hafen', stadium: 'Hafenarena',
    formation: '4-4-2', rating: 81, style: { press: 0.85, width: 0.65, tempo: 0.85, directness: 0.7 },
    colors: { primary: '#d31f2a', secondary: '#ffffff' }, collar: 'crew', sponsor: 'KRONVIK',
    crest: { shape: 'hex', motif: 'sash', emblem: 'helm', metal: 'silver', stars: 4, founded: 1893, initials: 'FCN',
      field: '#d31f2a', motifColor: '#ffffff', disc: '#9e121c', ink: '#ffffff', accent: '#d31f2a', chief: '#1c1c20', ribbon: '#1c1c20', ribbonText: '#ffffff' },
    kits: { home: K('#ffffff', '#ffffff', '#ffffff', '#d31f2a', 'sash', '#d31f2a', '#d31f2a', '#d31f2a', { sponsorColor: '#1c1c20', sponsorOutline: true, numberOutline: '#ffffff' }),
      away: K('#d31f2a', '#d31f2a', '#1c1c20', '#d31f2a', 'plain', '#1c1c20', '#ffffff', '#ffffff', { panel: '#1c1c20', sponsorColor: '#ffffff', collar: 'v' }),
      gk: K('#1d8f5b', '#1d8f5b', '#1d8f5b', '#1d8f5b', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#f5d418', '#f5d418', '#f5d418', '#f5d418', 'plain', '#222222', '#222222', '#222222') } },
  { id: 'monteluz', name: 'Real Monteluz', short: 'MON', city: 'Monteluz', flavour: 'es', nickname: 'Los Violetas', stadium: 'Campo de la Luz',
    formation: '4-3-3', rating: 80, style: { press: 0.6, width: 0.55, tempo: 0.55, directness: 0.3 },
    colors: { primary: '#5b2a8c', secondary: '#f5f5f7' }, collar: 'polo', sponsor: 'SOLANZA',
    crest: { shape: 'french', motif: 'pales', emblem: 'sun', metal: 'gold', stars: 0, crown: true, founded: 1912, initials: 'RM',
      field: '#5b2a8c', motifColor: '#4a2175', ink: '#f5c542', accent: '#f5f5f7', chief: '#f5f5f7', chiefText: '#5b2a8c', ribbon: '#f5c542', ribbonText: '#3a1760' },
    kits: { home: K('#f5f5f7', '#f5f5f7', '#5b2a8c', '#f5f5f7', 'pinstripe', '#5b2a8c', '#5b2a8c', '#5b2a8c', { sponsorColor: '#5b2a8c', numberOutline: '#f5c542' }),
      away: K('#5b2a8c', '#5b2a8c', '#5b2a8c', '#5b2a8c', 'plain', '#f5c542', '#f5c542', '#f5c542', { panel: '#f5c542', sponsorColor: '#f5c542', collar: 'v' }),
      gk: K('#ff7a1a', '#ff7a1a', '#1a1a1a', '#ff7a1a', 'plain', '#1a1a1a', '#1a1a1a', '#1a1a1a'),
      gkAway: K('#1e9bd7', '#1e9bd7', '#1e9bd7', '#1e9bd7', 'plain', '#ffffff', '#ffffff', '#ffffff') } },
  { id: 'ferroviario', name: 'Ferroviário Ribeira', short: 'FER', city: 'Ribeira do Sul', flavour: 'br', nickname: 'Locomotiva', stadium: 'Estádio da Estação',
    formation: '4-4-2', rating: 76, style: { press: 0.7, width: 0.75, tempo: 0.7, directness: 0.75 },
    colors: { primary: '#f5c400', secondary: '#141414' }, collar: 'crew', sponsor: 'VAPORA',
    crest: { shape: 'badge', motif: 'hoops', emblem: 'locomotive', metal: 'dark', stars: 1, founded: 1934, initials: 'FR',
      field: '#f5c400', motifColor: '#141414', disc: '#141414', ink: '#f5c400', accent: '#ffffff', chief: '#141414', chiefText: '#f5c400', ribbon: '#f5c400', ribbonText: '#141414' },
    kits: { home: K('#f5c400', '#141414', '#141414', '#f5c400', 'hoops', '#141414', '#141414', '#141414', { numberOutline: '#f5c400', sponsorColor: '#141414', sponsorOutline: true }),
      away: K('#141414', '#141414', '#141414', '#141414', 'pinstripe', '#f5c400', '#f5c400', '#f5c400', { sponsorColor: '#f5c400', collar: 'polo' }),
      gk: K('#2c6fe0', '#2c6fe0', '#2c6fe0', '#2c6fe0', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#e0e4ea', '#e0e4ea', '#39414d', '#e0e4ea', 'plain', '#39414d', '#39414d', '#39414d') } },
  { id: 'bahiasur', name: 'Unión Bahía Sur', short: 'UBS', city: 'Bahía Sur', flavour: 'es', nickname: 'El Celeste', stadium: 'Estadio Costanera',
    formation: '3-5-2', rating: 73, style: { press: 0.4, width: 0.7, tempo: 0.45, directness: 0.6 },
    colors: { primary: '#5fb4e8', secondary: '#1b2a3f' }, collar: 'v', sponsor: 'COSTAVIVA',
    crest: { shape: 'scallop', motif: 'stripes', emblem: 'palm', metal: 'silver', stars: 2, founded: 1927, initials: 'UBS',
      field: '#5fb4e8', motifColor: '#ffffff', disc: '#1b2a3f', ink: '#ffffff', accent: '#f5c542', chief: '#1b2a3f', chiefText: '#ffffff', ribbon: '#1b2a3f', ribbonText: '#ffffff' },
    kits: { home: K('#5fb4e8', '#5fb4e8', '#1b2a3f', '#ffffff', 'stripes', '#ffffff', '#1b2a3f', '#1b2a3f', { numberOutline: '#ffffff', sponsorColor: '#1b2a3f', sponsorOutline: true }),
      away: K('#1b2a3f', '#1b2a3f', '#1b2a3f', '#1b2a3f', 'sash', '#5fb4e8', '#5fb4e8', '#ffffff', { sponsorColor: '#ffffff', collar: 'crew' }),
      gk: K('#c9e83a', '#c9e83a', '#c9e83a', '#c9e83a', 'plain', '#1a1a1a', '#1a1a1a', '#1a1a1a'),
      gkAway: K('#d63b6a', '#d63b6a', '#d63b6a', '#d63b6a', 'plain', '#ffffff', '#ffffff', '#ffffff') } },
  { id: 'cerrado', name: 'Estrela do Cerrado', short: 'EST', city: 'Cerradópolis', flavour: 'br', nickname: 'O Lobo do Planalto', stadium: 'Arena Ipê',
    formation: '4-2-3-1', rating: 70, style: { press: 0.5, width: 0.5, tempo: 0.6, directness: 0.65 },
    colors: { primary: '#f26b1d', secondary: '#101010' }, collar: 'crew', sponsor: 'IPÊNET',
    crest: { shape: 'clipped', motif: 'halves', emblem: 'wolf', metal: 'gold', stars: 1, founded: 1958, initials: 'EC',
      field: '#f26b1d', motifColor: '#101010', disc: '#101010', ink: '#f26b1d', accent: '#ffd23f', chief: '#101010', ribbon: '#101010', ribbonText: '#ffd23f' },
    kits: { home: K('#f26b1d', '#f26b1d', '#101010', '#f26b1d', 'plain', '#101010', '#101010', '#101010', { panel: '#101010', sponsorColor: '#101010', numberOutline: '#ffd23f' }),
      away: K('#ffffff', '#f26b1d', '#ffffff', '#ffffff', 'halves', '#f26b1d', '#101010', '#101010', { sponsorColor: '#101010', sponsorOutline: true, numberOutline: '#ffffff', collar: 'v' }),
      gk: K('#2a9d5c', '#2a9d5c', '#2a9d5c', '#2a9d5c', 'plain', '#ffffff', '#ffffff', '#ffffff'),
      gkAway: K('#6b6f7a', '#6b6f7a', '#6b6f7a', '#6b6f7a', 'plain', '#ffe14a', '#ffe14a', '#ffe14a') } },
];

// completa cada uniforme com o clube (escudo no peito), o patrocinador e a gola
for (const d of DEFS) {
  for (const [slot, k] of Object.entries(d.kits)) {
    k.club = d.id;
    k.sponsor = d.sponsor;
    if (!k.collar) k.collar = slot.startsWith('gk') ? 'crew' : d.collar;
    if (!k.sponsorColor) k.sponsorColor = k.number;
  }
}

export const TEAMS = DEFS.map(d => {
  const t = { ...d };
  t.players = buildRoster(t);
  return t;
});

// times de fora (Total Match): entram na partida com escudo e uniforme próprios
const EXTRA = [];
export function registerTeam(t) { const i = EXTRA.findIndex(x => x.id === t.id); if (i >= 0) EXTRA[i] = t; else EXTRA.push(t); return t; }
export const teamById = (id) => TEAMS.find(t => t.id === id) || EXTRA.find(t => t.id === id) || null;
export const allTeams = () => TEAMS.concat(EXTRA);

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
// Escudos originais em camadas: sombra, aro metálico chanfrado, campo com padrão e brilho em
// cúpula, frisos internos, faixa superior (chefe) com as iniciais, emblema em relevo (sombra +
// degradê), fita com o ano de fundação e estrelas acima. Abaixo de ~64 px sai uma versão
// simplificada (sem textos miúdos) para ficar nítida no placar (24 px).
let uid = 0;
const VB_W = 200, VB_H = 224, CX = 100, CY = 121;
const SHAPES = {
  heater: 'M16 40 Q58 40 100 26 Q142 40 184 40 L184 110 C184 162 148 196 100 216 C52 196 16 162 16 110 Z',
  roundel: 'M100 28 A92 92 0 1 1 99.99 28 Z',
  oval: 'M100 26 C152 26 184 68 184 121 C184 176 148 216 100 216 C52 216 16 176 16 121 C16 68 48 26 100 26 Z',
  hex: 'M100 24 L186 72 L186 170 L100 218 L14 170 L14 72 Z',
  french: 'M18 36 H182 V122 C182 170 146 200 100 216 C54 200 18 170 18 122 Z',
  badge: 'M38 28 H162 L184 50 V138 C184 176 146 202 100 216 C54 202 16 176 16 138 V50 Z',
  scallop: 'M16 32 Q58 50 100 32 Q142 50 184 32 V118 C184 168 146 200 100 216 C54 200 16 168 16 118 Z',
  clipped: 'M46 28 H154 L184 58 V114 C184 162 146 196 100 216 C54 196 16 162 16 114 V58 Z',
};
const RING = { roundel: 1, oval: 1 };
const METALS = {
  gold: ['#fff6cc', '#f0cf6e', '#b98a2e', '#f8e39a', '#6e4a10'],
  silver: ['#ffffff', '#dde3e8', '#8f99a3', '#f2f5f7', '#48515a'],
  dark: ['#6b7077', '#34383d', '#101214', '#4a4f55', '#050607'],
};
const FOUNDED = { br: 'FUNDADO EM', es: 'FUNDADO EN', it: 'FONDATA NEL', de: 'GEGRÜNDET' };

function shade(hex, t) {   // t > 0 clareia, t < 0 escurece
  const c = hexRgb(hex).map(v => Math.round(t >= 0 ? v + (255 - v) * t : v * (1 + t)));
  return '#' + c.map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
function lumOf(hex) { const [r, g, b] = hexRgb(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
const scaleAt = (k) => `translate(${CX} ${CY}) scale(${k}) translate(${-CX} ${-CY})`;
function starPath(cx, cy, r, ri = r * 0.45) {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? ri : r;
    d += (i ? 'L' : 'M') + (cx + Math.cos(a) * rr).toFixed(2) + ' ' + (cy + Math.sin(a) * rr).toFixed(2);
  }
  return d + 'Z';
}
const FONT = `font-family="'Barlow Condensed','Oswald','Arial Narrow','Roboto Condensed',Impact,sans-serif" font-weight="800"`;

// ---------- emblemas (coordenadas locais, cabem em ±42; y para baixo) ----------
// f = { ink (preenchimento com degradê), inkC (cor sólida), acc, dark, snow }
function leaf(ox, oy, a, L, w, droop) {
  const tx = ox + Math.cos(a) * L, ty = oy + Math.sin(a) * L + droop;
  const dx = tx - ox, dy = ty - oy, l = Math.hypot(dx, dy), nx = -dy / l, ny = dx / l;
  const mx = (ox + tx) / 2, my = (oy + ty) / 2 - droop * 0.35;
  const f = (v) => v.toFixed(1);
  return `M${f(ox)} ${f(oy)} Q${f(mx + nx * w)} ${f(my + ny * w)} ${f(tx)} ${f(ty)} Q${f(mx - nx * w * 0.35)} ${f(my - ny * w * 0.35)} ${f(ox)} ${f(oy)}Z`;
}
const EMBLEMS = {
  // falcão de asas abertas sobre a serra
  falcon: (f) => {
    const wing = 'M7 -13 L43 -30 L40 -21 L9 -4Z M8 -6 L45 -18 L40 -10 L9 2Z M8 1 L42 -6 L36 1.5 L8 8Z M7 7 L36 6 L29 12.5 L6 13.5Z';
    return `<path d="M-46 42 L-27 16 L-19 24 L-6 5 L7 21 L17 11 L30 27 L35 22 L46 42Z" fill="${f.acc}"/>
<path d="M-27 16 L-22 22 L-25 21 L-27 24 L-30 20Z M-6 5 L0 13 L-3 12 L-6 15 L-9 11Z M17 11 L22 17 L19 16 L17 18 L14 15Z" fill="${f.snow}"/>
<g fill="${f.ink}"><path d="${wing}"/><path d="${wing}" transform="scale(-1 1)"/>
<path d="M-8 -14 L8 -14 L10 2 L5 18 L0 22 L-5 18 L-10 2Z"/>
<path d="M-7 18 L-13 35 L-4 30 L0 38 L4 30 L13 35 L7 18Z"/>
<path d="M-7 -13 C-9 -24 -5 -33 2 -33 C8 -33 11 -29 12 -25 L18 -21.5 L11.5 -20 L9 -15.5Z"/></g>
<circle cx="4" cy="-25.5" r="2" fill="${f.dark}"/><path d="M5.5 -25.5 L10 -24" stroke="${f.dark}" stroke-width="1.2"/>
<path d="M-5 -8 L0 -3 L5 -8 M-5 0 L0 5 L5 0 M-4 8 L0 12 L4 8" stroke="${f.dark}" stroke-width="1.5" fill="none" opacity=".45"/>`;
  },
  // âncora com cabo enrolado e raios da aurora
  anchor: (f) => {
    let rays = '';
    for (let i = 0; i < 9; i++) { const a = Math.PI + (i + 0.5) * Math.PI / 9, b = 0.07; rays += `M0 30 L${(Math.cos(a - b) * 58).toFixed(1)} ${(30 + Math.sin(a - b) * 58).toFixed(1)} L${(Math.cos(a + b) * 58).toFixed(1)} ${(30 + Math.sin(a + b) * 58).toFixed(1)}Z`; }
    return `<path d="${rays}" fill="${f.acc}" opacity=".16"/>
<g fill="none" stroke="${f.ink}" stroke-linecap="round"><circle cx="0" cy="-32" r="6.5" stroke-width="4.5"/><path d="M0 -25 V31" stroke-width="7.5"/>
<path d="M-30 5 C-28 24 -14 34 0 34 C14 34 28 24 30 5" stroke-width="6.5"/></g>
<g fill="${f.ink}"><rect x="-21" y="-21" width="42" height="7.5" rx="3.75"/><circle cx="-22" cy="-17.25" r="4.5"/><circle cx="22" cy="-17.25" r="4.5"/>
<path d="M-30 -4 L-39 14 L-22 11Z M30 -4 L39 14 L22 11Z M-6 29 L0 40 L6 29Z"/></g>
<path d="M-18 -13 C-36 -2 -33 15 -17 16 C-3 17 7 3 19 9 C29 14 28 25 17 29" fill="none" stroke="${f.dark}" stroke-width="4.2" stroke-linecap="round"/>
<path d="M-18 -13 C-36 -2 -33 15 -17 16 C-3 17 7 3 19 9 C29 14 28 25 17 29" fill="none" stroke="${f.acc}" stroke-width="2.6" stroke-dasharray="3.4 1.4" stroke-linecap="round"/>`;
  },
  // torre de castelo à beira do lago, com bandeira
  tower: (f) => `<path d="M0 -30 V-44" stroke="${f.ink}" stroke-width="2"/><path d="M1 -44 L15 -40 L1 -35Z" fill="${f.acc}"/>
<g fill="${f.ink}"><path d="M-20 -14 V-29 H-13 V-24 H-9 V-29 H-2 V-24 H2 V-29 H9 V-24 H13 V-29 H20 V-14Z"/>
<rect x="-22" y="-15" width="44" height="4.5" rx="1"/><path d="M-17 -11 H17 L20 30 H-20Z"/></g>
<path d="M-18 -2 H18 M-19 9 H19 M-19.5 20 H19.5 M-8 -11 V-2 M8 -11 V-2 M0 -2 V9 M-12 9 V20 M12 9 V20" stroke="${f.dark}" stroke-width="1" opacity=".35"/>
<path d="M-7 30 V17 A7 7 0 0 1 7 17 V30Z" fill="${f.dark}"/><path d="M-4.5 18 V30 M0 16 V30 M4.5 18 V30 M-7 22 H7 M-7 26 H7" stroke="${f.inkC}" stroke-width=".9" opacity=".6"/>
<rect x="-12" y="-7" width="4" height="9" rx="2" fill="${f.dark}"/><rect x="8" y="-7" width="4" height="9" rx="2" fill="${f.dark}"/>
<path d="M-42 36 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 M-35 43 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="${f.acc}" stroke-width="3.2" stroke-linecap="round"/>`,
  // timão (roda de leme) sobre as ondas
  helm: (f) => {
    let sp = '', kn = '';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8, c = Math.cos(a), s = Math.sin(a);
      sp += `M${(c * 6).toFixed(1)} ${(s * 6).toFixed(1)} L${(c * 34).toFixed(1)} ${(s * 34).toFixed(1)}`;
      kn += `<ellipse cx="${(c * 37).toFixed(1)}" cy="${(s * 37).toFixed(1)}" rx="4.4" ry="3.2" transform="rotate(${(a * 180 / Math.PI).toFixed(1)} ${(c * 37).toFixed(1)} ${(s * 37).toFixed(1)})"/>`;
    }
    return `<path d="${sp}" stroke="${f.ink}" stroke-width="4.6" stroke-linecap="round"/><g fill="${f.ink}">${kn}</g>
<circle r="25" fill="none" stroke="${f.ink}" stroke-width="6"/><circle r="25" fill="none" stroke="${f.dark}" stroke-width="1.1" opacity=".45"/>
<circle r="10" fill="none" stroke="${f.ink}" stroke-width="4.5"/><circle r="4.8" fill="${f.acc}" stroke="${f.inkC}" stroke-width="1.6"/>`;
  },
  // sol radiante nascendo atrás do monte
  sun: (f) => {
    let r = '';
    for (let i = 0; i < 16; i++) {
      const a = i * Math.PI / 8 - Math.PI / 2, L = i % 2 ? 25 : 35, b = i % 2 ? 0.1 : 0.13;
      r += `M${(Math.cos(a - b) * 15).toFixed(1)} ${(-6 + Math.sin(a - b) * 15).toFixed(1)} L${(Math.cos(a) * L).toFixed(1)} ${(-6 + Math.sin(a) * L).toFixed(1)} L${(Math.cos(a + b) * 15).toFixed(1)} ${(-6 + Math.sin(a + b) * 15).toFixed(1)}Z`;
    }
    return `<path d="${r}" fill="${f.ink}"/><circle cx="0" cy="-6" r="14" fill="${f.ink}"/><circle cx="0" cy="-6" r="9.5" fill="none" stroke="${f.dark}" stroke-width="1.2" opacity=".35"/>
<path d="M-44 40 L-14 10 L-4 19 L10 2 L44 40Z" fill="${f.acc}"/><path d="M-14 10 L-8 16 L-11 16 L-14 19 L-18 14Z M10 2 L17 10 L13 9 L10 13 L6 7Z" fill="${f.dark}" opacity=".25"/>`;
  },
  // locomotiva a vapor de frente, com asas
  locomotive: (f) => {
    const w = 'M-17 -12 L-46 -24 L-44 -16 L-19 -5Z M-18 -4 L-47 -11 L-43 -4 L-19 3Z M-19 4 L-43 3 L-38 9 L-19 10Z';
    return `<g fill="${f.acc}"><path d="${w}"/><path d="${w}" transform="scale(-1 1)"/></g>
<g fill="${f.ink}"><path d="M-7 -42 H7 L5 -33 H-5Z"/><rect x="-4.5" y="-34" width="9" height="10"/><circle cx="0" cy="-1" r="21"/>
<rect x="-31" y="18" width="62" height="8" rx="1.5"/><path d="M-27 26 H27 L19 39 H-19Z"/><circle cx="-35" cy="22" r="4.4"/><circle cx="35" cy="22" r="4.4"/></g>
<circle cx="0" cy="-1" r="15" fill="none" stroke="${f.dark}" stroke-width="2.2"/><circle cx="0" cy="-1" r="3.2" fill="${f.dark}"/>
<path d="M0 -1 L10 -7 M0 -1 L-10 -7" stroke="${f.dark}" stroke-width="2" stroke-linecap="round"/>
<circle cx="0" cy="-25" r="4.6" fill="${f.snow}" stroke="${f.dark}" stroke-width="1.6"/>
<path d="M-17 28 V37 M-9 28 V38 M-1 28 V38 M7 28 V38 M15 28 V37" stroke="${f.dark}" stroke-width="2" opacity=".7"/>
<path d="M-31 22 H31" stroke="${f.dark}" stroke-width="1" opacity=".5"/>`;
  },
  // coqueiro com sol e mar
  palm: (f) => {
    const O = [2, -19];
    const fr = [[-2.9, 34, 7, 11], [-2.35, 30, 7, 6], [-1.75, 22, 6, 1], [-1.2, 31, 7, 6], [-0.55, 34, 7, 12], [-3.35, 26, 6, 14], [0.05, 24, 6, 14]]
      .map(([a, L, w, d]) => leaf(O[0], O[1], a, L, w, d)).join('');
    return `<circle cx="-15" cy="-6" r="15" fill="${f.acc}"/>
<path d="M-3 32 C0 12 -6 -4 -1 -20 L5 -20 C2 -4 6 12 5 32Z" fill="${f.ink}"/>
<path d="M-3 22 L4.5 21 M-2 12 L4 11 M-3 2 L3.5 1 M-2.8 -8 L3 -9" stroke="${f.dark}" stroke-width="1.2" opacity=".45"/>
<path d="${fr}" fill="${f.ink}"/>
<circle cx="-1" cy="-17" r="3" fill="${f.dark}"/><circle cx="5" cy="-16" r="3" fill="${f.dark}"/><circle cx="2" cy="-13" r="3" fill="${f.dark}"/>
<path d="M-42 34 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0 t14 0 M-35 42 q7 -6 14 0 t14 0 t14 0 t14 0 t14 0" fill="none" stroke="${f.ink}" stroke-width="3.2" stroke-linecap="round"/>`;
  },
  // lobo-guará facetado à frente da estrela
  wolf: (f) => `<path d="${starPath(0, 2, 44, 19)}" fill="${f.acc}"/>
<path d="M-18 16 L-26 30 L-12 26 L0 40 L12 26 L26 30 L18 16Z" fill="${f.dark}"/>
<path d="M0 36 L-7 31 L-12 19 L-19 7 L-23 -7 L-29 -35 L-15 -21 L-7 -23 L0 -19 L7 -23 L15 -21 L29 -35 L23 -7 L19 7 L12 19 L7 31Z" fill="${f.ink}"/>
<path d="M-26 -29 L-17 -19 L-22 -9Z M26 -29 L17 -19 L22 -9Z" fill="${f.dark}"/>
<path d="M0 -19 L-7 -23 L-15 -21 L-11 -4 L0 3Z M0 -19 L7 -23 L15 -21 L11 -4 L0 3Z" fill="#fff" opacity=".14"/>
<path d="M-6 3 L6 3 L7 24 L0 36 L-7 24Z" fill="#fff" opacity=".82"/>
<path d="M-14 -5 L-5 -2 L-12 1.5Z M14 -5 L5 -2 L12 1.5Z" fill="${f.dark}"/>
<path d="M-4.5 29 L4.5 29 L0 35Z" fill="${f.dark}"/>`,
  // estrela simples (reserva)
  star: (f) => `<path d="${starPath(0, 0, 38, 16)}" fill="${f.ink}"/><path d="${starPath(0, 0, 38, 16)}" fill="none" stroke="${f.dark}" stroke-width="1" opacity=".35"/>`,
};

export function crestSVG(team, size = 64) {
  const id = `cr${team.id || team.short}${++uid}`;
  const C = team.crest || {};
  const small = size < 80, tiny = size < 40, fine = size >= 110;
  const shape = SHAPES[C.shape] ? C.shape : 'heater';
  const path = SHAPES[shape], ring = !!RING[shape];
  const M = METALS[C.metal] || METALS.silver;
  const field = C.field || team.colors.primary, motifC = C.motifColor || team.colors.secondary;
  const ink = C.ink || '#ffffff', acc = C.accent || team.colors.secondary;
  const dark = lumOf(ink) > 0.5 ? shade(field, -0.55) : '#ffffff';
  const kIn = ring ? (small ? 0.84 : 0.74) : 0.9;              // campo interno (fração do contorno)
  const motif = C.motif || 'plain';
  // padrão do campo
  let fill = '';
  if (motif === 'stripes') for (let i = 1; i < 7; i += 2) fill += `<rect x="${(i * 200 / 7).toFixed(2)}" y="0" width="${(200 / 7).toFixed(2)}" height="224" fill="${motifC}"/>`;
  else if (motif === 'hoops') for (let y = 60; y < 224; y += 26) fill += `<rect x="0" y="${y}" width="200" height="13" fill="${motifC}"/>`;
  else if (motif === 'halves') fill = `<rect x="100" y="0" width="100" height="224" fill="${motifC}"/>`;
  else if (motif === 'sash') fill = `<path d="M-20 40 L40 -20 L220 160 L160 220Z" fill="${motifC}"/>`;
  else if (motif === 'pales') for (let x = 12; x < 200; x += 22) fill += `<rect x="${x}" y="0" width="9" height="224" fill="${motifC}"/>`;
  else if (motif === 'rays') for (let i = 0; i < 24; i += 2) {
    const a = i * Math.PI / 12, b = (i + 1) * Math.PI / 12;
    fill += `<path d="M${CX} ${CY} L${(CX + Math.cos(a) * 160).toFixed(1)} ${(CY + Math.sin(a) * 160).toFixed(1)} L${(CX + Math.cos(b) * 160).toFixed(1)} ${(CY + Math.sin(b) * 160).toFixed(1)}Z" fill="${motifC}" opacity=".13"/>`;
  }
  const busy = motif === 'stripes' || motif === 'hoops' || motif === 'halves' || motif === 'sash';
  const disc = busy && C.disc;
  // disposição: com fita/chefe (tamanho grande) ou emblema maior (tamanho pequeno)
  const hasChief = !ring && !small && !!C.chief && !C.crown;
  const hasRibbon = !small && !ring && C.founded != null;   // sem ano de fundação (times do TM), sem fita
  let ex = CX, ey = ring ? (small ? 121 : 110) : hasRibbon ? 114 : 124, es = ring ? (small ? 1.3 : 1.02) : small ? 1.34 : 1.02;
  if (hasChief) ey = 118;
  const f = { ink: `url(#${id}i)`, inkC: ink, acc, dark, snow: '#ffffff' };
  const fs = { ink: '#000', inkC: '#000', acc: '#000', dark: '#000', snow: '#000' };
  const em = (EMBLEMS[C.emblem] || EMBLEMS.star);
  const emblem = `<g transform="translate(${ex + 1.6} ${ey + 2.8}) scale(${es})" opacity=".5">${em(fs)}</g><g transform="translate(${ex} ${ey}) scale(${es})">${em(f)}</g>`;
  const T = (s) => String(s).toUpperCase().replace(/&/g, '&amp;').replace(/</g, '&lt;');

  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" width="${size}" height="${Math.round(size * VB_H / VB_W)}" role="img" aria-label="Escudo ${T(team.name).replace(/"/g, '')}">
<defs>
<clipPath id="${id}c"><path d="${path}" transform="${scaleAt(kIn)}"/></clipPath>
<linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${M[0]}"/><stop offset=".28" stop-color="${M[1]}"/><stop offset=".52" stop-color="${M[2]}"/><stop offset=".74" stop-color="${M[3]}"/><stop offset="1" stop-color="${M[4]}"/></linearGradient>
${C.metal === 'dark' ? `<linearGradient id="${id}m2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset=".5" stop-color="#e9c05a"/><stop offset="1" stop-color="#8a5f16"/></linearGradient>` : ''}
<radialGradient id="${id}g" cx=".36" cy=".24" r=".95"><stop offset="0" stop-color="#fff" stop-opacity=".30"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></radialGradient>
<linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(ink, 0.45)}"/><stop offset=".55" stop-color="${ink}"/><stop offset="1" stop-color="${shade(ink, -0.28)}"/></linearGradient>
</defs>`;
  // sombra projetada + aro metálico
  out += `<path d="${path}" fill="#000" opacity=".35" transform="translate(0 3.5)"/>`;
  out += `<path d="${path}" fill="url(#${id}m)" stroke="#07090a" stroke-width="${small ? 5 : 3}" stroke-linejoin="round"/>`;
  out += `<path d="${path}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="1.4" transform="${scaleAt(0.975)}"/>`;
  if (ring) {
    const rc = C.ring || shade(field, -0.35);
    out += `<path d="${path}" fill="${rc}" transform="${scaleAt(0.905)}"/><path d="${path}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="1.5" transform="${scaleAt(0.905)}"/>`;
  } else out += `<path d="${path}" fill="${M[4]}" transform="${scaleAt(0.925)}"/>`;
  // campo
  out += `<g clip-path="url(#${id}c)"><rect width="200" height="224" fill="${field}"/>${fill}`;
  if (hasChief) out += `<rect x="0" y="0" width="200" height="${shape === 'badge' || shape === 'clipped' ? 70 : 72}" fill="${C.chief}"/><rect x="0" y="${shape === 'badge' || shape === 'clipped' ? 70 : 72}" width="200" height="3" fill="url(#${id}m)"/>`;
  else if (!ring && C.chief && small) out += `<rect x="0" y="0" width="200" height="66" fill="${C.chief}"/>`;
  if (disc) out += `<circle cx="${ex}" cy="${ey}" r="${ring ? 50 : small ? 60 : 50}" fill="${C.disc}"/><circle cx="${ex}" cy="${ey}" r="${ring ? 50 : small ? 60 : 50}" fill="none" stroke="url(#${id}m)" stroke-width="${small ? 5 : 3.2}"/>`;
  out += `<rect width="200" height="224" fill="url(#${id}g)"/><path d="M0 0 H200 V78 Q100 112 0 96Z" fill="#fff" opacity=".06"/></g>`;
  // frisos internos
  out += `<path d="${path}" fill="none" stroke="url(#${id}m)" stroke-width="${small ? 3.4 : 2.2}" transform="${scaleAt(kIn)}"/>`;
  if (!small) out += `<path d="${path}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1" transform="${scaleAt(kIn - 0.025)}"/>`;
  // anel com o nome (redondos/ovais)
  if (ring && !small) {
    const sx = shape === 'oval' ? 84 / 92 : 1, sy = shape === 'oval' ? 95 / 92 : 1;
    const rt = 73.5, rb = 82;
    const col = C.ringText || M[1];
    out += `<path id="${id}t" d="M${CX - rt * sx} ${CY} A${rt * sx} ${rt * sy} 0 0 1 ${CX + rt * sx} ${CY}" fill="none"/>`;
    out += `<path id="${id}b" d="M${CX - rb * sx} ${CY} A${rb * sx} ${rb * sy} 0 0 0 ${CX + rb * sx} ${CY}" fill="none"/>`;
    out += `<text ${FONT} font-size="15.5" letter-spacing="1.6" fill="${col}"><textPath href="#${id}t" startOffset="50%" text-anchor="middle">${T(team.name)}</textPath></text>`;
    const baixo = C.founded != null ? (FOUNDED[team.flavour] || FOUNDED.br) + ' ' + C.founded : (team.city || '');
    if (baixo) out += `<text ${FONT} font-size="11.5" letter-spacing="2.2" fill="${col}"><textPath href="#${id}b" startOffset="50%" text-anchor="middle">${T(baixo)}</textPath></text>`;
    out += `<path d="${starPath(CX - 80 * sx, CY + 2, 5)}${starPath(CX + 80 * sx, CY + 2, 5)}" fill="${col}"/>`;
  }
  // emblema em relevo
  out += emblem;
  // iniciais: no chefe (escudos) ou sob o emblema (redondos)
  if (hasChief) {
    const ty = shape === 'heater' ? 64 : shape === 'hex' ? 66 : 62;
    out += `<text x="${CX}" y="${ty + 1.5}" text-anchor="middle" ${FONT} font-size="27" letter-spacing="4" fill="#000" opacity=".45">${T(C.initials || team.short)}</text>`;
    out += `<text x="${CX}" y="${ty}" text-anchor="middle" ${FONT} font-size="27" letter-spacing="4" fill="${C.chiefText || `url(#${id}m)`}">${T(C.initials || team.short)}</text>`;
  } else if (shape === 'roundel' && !small) {
    out += `<text x="${CX}" y="${ey + 64}" text-anchor="middle" ${FONT} font-size="17" letter-spacing="3" fill="url(#${id}m)" stroke="#000" stroke-opacity=".35" stroke-width=".6">${T(C.initials || team.short)}</text>`;
  }
  // fita com o ano de fundação
  if (hasRibbon) {
    const rc = C.ribbon || shade(field, -0.4), rd = shade(rc === '#000000' ? '#222222' : rc, -0.45);
    const y0 = 162, hgt = 25;
    out += `<path d="M26 ${y0 + 5} L4 ${y0 + 8} L13 ${y0 + 19} L4 ${y0 + 31} L30 ${y0 + 29}Z M174 ${y0 + 5} L196 ${y0 + 8} L187 ${y0 + 19} L196 ${y0 + 31} L170 ${y0 + 29}Z" fill="${rd}" stroke="#000" stroke-opacity=".5" stroke-width="1"/>`;
    out += `<path d="M22 ${y0} Q100 ${y0 + 14} 178 ${y0} L178 ${y0 + hgt} Q100 ${y0 + hgt + 14} 22 ${y0 + hgt}Z" fill="${rc}" stroke="url(#${id}m)" stroke-width="2.2"/>`;
    out += `<path d="M22 ${y0 + hgt} L30 ${y0 + hgt + 4} L30 ${y0 + hgt - 1}Z M178 ${y0 + hgt} L170 ${y0 + hgt + 4} L170 ${y0 + hgt - 1}Z" fill="#000" opacity=".55"/>`;
    out += `<path id="${id}r" d="M24 ${y0 + 17.5} Q100 ${y0 + 31.5} 176 ${y0 + 17.5}" fill="none"/>`;
    const lbl = fine ? `${FOUNDED[team.flavour] || FOUNDED.br} ${C.founded}` : `★ ${C.founded} ★`;
    out += `<text ${FONT} font-size="${fine ? 12.5 : 15}" letter-spacing="${fine ? 1.6 : 2.5}" fill="${C.ribbonText || '#fff'}"><textPath href="#${id}r" startOffset="50%" text-anchor="middle">${T(lbl)}</textPath></text>`;
  }
  // estrelas (títulos) e coroa
  const n = C.stars | 0;
  if (n && !tiny) {
    let st = '';
    for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : i / (n - 1) - 0.5, x = CX + t * (n - 1) * 20, y = (shape === 'heater' ? 13 : 13) + Math.abs(t) * (n > 2 ? 5 : 0); st += starPath(x, y, small ? 10 : 8.2); }
    out += `<path d="${st}" fill="#000" opacity=".4" transform="translate(0 1.6)"/><path d="${st}" fill="url(#${id}${C.metal === 'dark' ? 'm2' : 'm'})" stroke="#000" stroke-opacity=".45" stroke-width=".8"/>`;
  }
  if (C.crown) {
    const cr = 'M62 40 L56 14 L74 26 L86 6 L100 20 L114 6 L126 26 L144 14 L138 40Z';
    out += `<path d="${cr}" fill="#000" opacity=".4" transform="translate(0 2)"/><path d="${cr}" fill="url(#${id}m)" stroke="#000" stroke-opacity=".55" stroke-width="1.2"/>`;
    if (!small) out += `<rect x="61" y="33" width="78" height="7" rx="2" fill="${M[4]}" opacity=".55"/><circle cx="86" cy="6" r="3" fill="#e0314b"/><circle cx="114" cy="6" r="3" fill="#e0314b"/><circle cx="100" cy="29" r="3.2" fill="#2f7de8"/><circle cx="80" cy="30" r="2.4" fill="#2fbf5a"/><circle cx="120" cy="30" r="2.4" fill="#2fbf5a"/>`;
  }
  return out + '</svg>';
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
  if (kit.panel) pat += `<rect x="30" y="30" width="4" height="40" fill="${kit.panel}"/><rect x="66" y="30" width="4" height="40" fill="${kit.panel}"/>`;
  const trim = kit.trim || '#fff';
  const collar = kit.collar === 'v' ? `<path d="M42 6 L50 19 L58 6" fill="none" stroke="${trim}" stroke-width="3" stroke-linejoin="round"/>`
    : kit.collar === 'polo' ? `<path d="M41 5 L50 11 L59 5 L57 11 L50 15 L43 11Z" fill="${trim}"/><path d="M50 13 V22" stroke="${trim}" stroke-width="2"/>`
      : `<path d="M42 6 Q50 14 58 6" fill="none" stroke="${trim}" stroke-width="3"/>`;
  const team = kit.club ? teamById(kit.club) : null;
  const sp = kit.sponsor ? `<text x="50" y="45" text-anchor="middle" font-family="'Barlow Condensed','Arial Narrow',sans-serif" font-style="italic" font-weight="800" font-size="${kit.sponsor.length > 7 ? 8 : 9.5}" letter-spacing=".4" fill="${kit.sponsorColor || kit.number}">${kit.sponsor}</text>` : '';
  const cr = team ? `<g transform="translate(53.5 15.5) scale(.047)">${crestSVG(team, 20).replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 112" width="${size}" height="${size * 1.12}" aria-hidden="true">
<defs><clipPath id="${id}"><path d="${body}"/></clipPath><linearGradient id="${id}s" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".45" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient></defs>
<path d="${shirt}" fill="${kit.sleeves}"/>
<path d="${body}" fill="${kit.shirt}"/><g clip-path="url(#${id})">${pat}</g>
<path d="M13.5 26.5 L21.5 40 M86.5 26.5 L78.5 40" stroke="${trim}" stroke-width="2.4"/><path d="M16 23 L23.5 36.5 M84 23 L76.5 36.5" stroke="${trim}" stroke-width="1" opacity=".8"/>
${collar}
<path d="${shirt}" fill="url(#${id}s)"/>
${sp}${cr}
<path d="M31 72 L69 72 L72 96 L53 96 L50 84 L47 96 L28 96 Z" fill="${kit.shorts}"/>
<path d="M31 72 L69 72" stroke="${trim}" stroke-width="2"/><path d="M29.5 84 L28.5 95 M70.5 84 L71.5 95" stroke="${trim}" stroke-width="1.6"/>
<rect x="30" y="99" width="15" height="11" rx="2" fill="${kit.socks}"/><rect x="55" y="99" width="15" height="11" rx="2" fill="${kit.socks}"/>
<rect x="30" y="101" width="15" height="1.8" fill="${trim}"/><rect x="55" y="101" width="15" height="1.8" fill="${trim}"/>
</svg>`;
}
