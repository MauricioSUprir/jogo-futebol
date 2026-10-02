// Gera os prompts dos retratos (pessoas fictícias) a partir do "look" de cada jogador:
// 4 jogadores por imagem, em grade 2×2. node tools/rostos/prompts.mjs > prompts.json
import { TEAMS } from '../../js/teams.js';
const SKIN = { '#f2d2bb': 'very fair', '#e8bf9f': 'fair', '#dcaa85': 'light', '#c99169': 'light olive', '#b27a52': 'tan medium-brown', '#96603d': 'medium brown', '#7a4a2d': 'brown', '#5c3620': 'dark brown', '#462817': 'very dark brown' };
const HAIR = { curly: 'short curly hair', bun: 'hair tied in a small man bun', short: 'short neat hair', long: 'shoulder-length hair', buzz: 'buzz cut', bald: 'clean shaved bald head', afro: 'short afro hair' };
const HC = { '#15110e': 'black', '#2e1f15': 'dark brown', '#4d321e': 'brown', '#79542f': 'light brown', '#8f4a22': 'auburn', '#8b8580': 'grey', '#b48d52': 'dark blond' };
const all = [];
TEAMS.forEach((t, ti) => t.players.forEach((p, pi) => all.push({ ti, pi, name: p.name, l: p.look })));
const desc = (q, k) => {
  const l = q.l, age = 21 + ((q.ti * 7 + q.pi * 5) % 14);
  const hair = l.hair === 'bald' ? HAIR.bald : `${HC[l.hairColor] || 'black'} ${HAIR[l.hair] || 'short hair'}`;
  return `${k}: man about ${age} years old, ${SKIN[l.skin] || 'medium'} skin, ${hair}${l.beard ? ', short trimmed beard' : ', clean shaven'}`;
};
const groups = [];
for (let i = 0; i < all.length; i += 4) {
  const g = all.slice(i, i + 4);
  const pos = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
  groups.push({
    ids: g.map(q => `${q.ti}-${q.pi}`),
    prompt: 'A 2x2 grid of four separate photorealistic passport-style head portraits of four DIFFERENT fictional male professional soccer players, each in its own equal square cell with a plain light grey background and a thin white gap between cells. In every cell: face perfectly frontal and centered, looking straight at the camera, neutral expression, mouth closed, eyes open, flat even studio lighting with no shadows, head and top of neck only, same framing and scale in all four cells (eyes at the same height, chin near the bottom of the cell). ' + g.map((q, k) => desc(q, pos[k])).join('. ') + '. No text, no logos.',
  });
}
console.log(JSON.stringify(groups, null, 1));
