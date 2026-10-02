// Banco de rostos (fotos de pessoas que não existem: retratos gerados por IA e o banco
// SFHQ, CC0). Um atlas único (assets/rostos/rostos.jpg) com células alinhadas pelos
// olhos; rostos.json diz qual célula cada jogador de cada time usa (tom de pele parecido).
// Montado por tools/rostos/processar.py.
import { TEAMS } from './teams.js';

let pool = null;
export function loadFacePool() {
  if (pool) return pool;
  pool = (async () => {
    const meta = await (await fetch('assets/rostos/rostos.json')).json();
    const img = new Image();
    img.decoding = 'async';
    img.src = 'assets/rostos/rostos.jpg';
    await img.decode();
    return { img, meta };
  })().catch((e) => { console.warn('rostos indisponíveis', e); return null; });
  return pool;
}

// célula do banco para um jogador (dados de teams.js); -1 se não houver
function cellOf(meta, teamData, playerData) {
  const ti = TEAMS.findIndex(t => t.id === teamData.id);
  const pi = ti >= 0 ? TEAMS[ti].players.indexOf(playerData) : -1;
  const c = ti >= 0 && pi >= 0 ? meta.times[ti]?.[pi] : undefined;
  return c === undefined ? -1 : c;
}

// Rostos da partida: lista por índice de jogador (0..21), sem repetir rosto entre os dois
// times (o visitante troca pela célula livre de tom mais próximo).
export function matchFaces(meta, match) {
  const used = new Set(), out = new Array(match.players.length).fill(-1);
  const lum = (c) => { const p = meta.pele[c]; return 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2]; };
  for (const t of match.teams) {
    for (const p of t.players) {
      let c = cellOf(meta, t.data, p.data);
      if (c < 0) continue;
      if (used.has(c)) {
        let best = -1, bd = 1e9;
        for (let k = 0; k < meta.n; k++) if (!used.has(k)) { const d = Math.abs(lum(k) - lum(c)); if (d < bd) { bd = d; best = k; } }
        c = best;
      }
      if (c >= 0) { used.add(c); out[p.idx] = c; }
    }
  }
  return out;
}

// Retrato pequeno (data URL) de uma célula — usado na escalação
const cache = new Map();
export function portrait(fp, cell, size = 96) {
  if (!fp || cell < 0) return null;
  const k = cell + ':' + size;
  if (cache.has(k)) return cache.get(k);
  const { img, meta } = fp, C = meta.cell;
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d');
  // enquadra do topo da cabeça ao queixo
  const sx = (cell % meta.cols) * C + C * 0.12, sy = Math.floor(cell / meta.cols) * C + C * 0.08, s = C * 0.76;
  g.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  const url = cv.toDataURL('image/jpeg', 0.85);
  cache.set(k, url);
  return url;
}

// cor média da pele do rosto (para o pescoço e os braços combinarem com a foto)
export function faceSkin(fp, cell) {
  if (!fp || cell < 0) return null;
  const p = fp.meta.pele[cell];
  return '#' + p.map(v => Math.round(v * 0.86).toString(16).padStart(2, '0')).join('');
}
