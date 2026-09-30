// Salvamento local (localStorage) com validação. Qualquer falha de acesso (modo privado, cota,
// bloqueio do navegador) vira aviso no log e o app segue funcionando sem salvar.
import { STORAGE_KEYS, QUALITY_KEYS } from './config.js';
import { log } from './log.js';

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { log.warn('Leitura falhou', key, e.message); return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch (e) { log.warn('Gravação falhou', key, e.message); return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch { /* ignora */ } }

export const DEFAULT_SETTINGS = {
  quality: 'auto',        // auto | baixo | medio | alto | ultra
  view: 'completo',       // completo | bola (só a bolinha, como na tela de simulação)
  numbers: true,
  speed: 2,
  sound: true,
  pauseOnBlur: true,
  showStats: false,       // painel de desempenho
  reducedMotion: false,
};

export function loadSettings() {
  const s = read(STORAGE_KEYS.settings) || {};
  const out = { ...DEFAULT_SETTINGS };
  if (s.quality === 'auto' || QUALITY_KEYS.includes(s.quality)) out.quality = s.quality;
  if (s.view === 'completo' || s.view === 'bola') out.view = s.view;
  if ([1, 2, 4, 8].includes(s.speed)) out.speed = s.speed;
  for (const k of ['numbers', 'sound', 'pauseOnBlur', 'showStats', 'reducedMotion']) if (typeof s[k] === 'boolean') out[k] = s[k];
  return out;
}
export const saveSettings = (s) => write(STORAGE_KEYS.settings, s);

export const loadSeasonRaw = () => read(STORAGE_KEYS.season);
export const saveSeason = (s) => write(STORAGE_KEYS.season, s);
export const clearSeason = () => remove(STORAGE_KEYS.season);

export function loadHistory() {
  const h = read(STORAGE_KEYS.history);
  if (!Array.isArray(h)) return [];
  return h.filter((r) => r && typeof r.home === 'string' && typeof r.away === 'string' && Number.isInteger(r.hs) && Number.isInteger(r.as)).slice(0, 30);
}
export function pushHistory(entry) {
  const h = loadHistory();
  h.unshift(entry);
  write(STORAGE_KEYS.history, h.slice(0, 30));
}
