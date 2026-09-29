// Configurações persistentes e níveis de qualidade gráfica.
const KEY = 'ceudorio.settings.v1';

export const TIERS = {
  low: {
    label: 'Baixa', maxPixelRatio: 1.0, minPixelRatio: 0.55, antialias: false, cascades: 2, shadowMap: 1024, shadowFar: 700,
    lodDist: 1400, minLod: 1, farStep: 2, sat: '_2k', buildingDist: 3500, cloudPuffs: 600, envInterval: 12, anisotropy: 4, far: 70000,
  },
  medium: {
    label: 'Média', maxPixelRatio: 1.5, minPixelRatio: 0.65, antialias: true, cascades: 3, shadowMap: 2048, shadowFar: 1500,
    lodDist: 2200, minLod: 0, farStep: 1, sat: '_2k', buildingDist: 6000, cloudPuffs: 1400, envInterval: 6, anisotropy: 8, far: 90000,
  },
  high: {
    label: 'Alta', maxPixelRatio: 2.0, minPixelRatio: 0.75, antialias: true, cascades: 4, shadowMap: 2048, shadowFar: 2500,
    lodDist: 3200, minLod: 0, farStep: 1, sat: '', buildingDist: 9000, cloudPuffs: 2600, envInterval: 3, anisotropy: 12, far: 110000,
  },
  ultra: {
    label: 'Ultra', maxPixelRatio: 3.0, minPixelRatio: 1.0, antialias: true, cascades: 4, shadowMap: 4096, shadowFar: 3500,
    lodDist: 4500, minLod: 0, farStep: 1, sat: '', buildingDist: 14000, cloudPuffs: 4000, envInterval: 1.5, anisotropy: 16, far: 130000,
  },
};

const DEFAULTS = {
  quality: 'auto', showFps: false, sensitivity: 1, invertPitch: false, assist: 'basic', tilt: false,
  uiScale: 1, contrast: false, volume: 0.8, helpSeen: false, lights: true,
  start: 'sdu20', time: 'manha', weather: 'poucas', wind: 'calmo',
};

export function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* bloqueado */ } }
export const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;

export function detectTier() {
  const touch = isTouch();
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER)) || '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* sem webgl2 */ }
  const g = gpu.toLowerCase(), mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
  if (/swiftshader|llvmpipe|software/.test(g)) return { tier: 'low', gpu };
  if (touch) {
    if (/apple gpu/.test(g) && mem >= 4) return { tier: 'medium', gpu };
    if (/adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g7[1-9]|immortalis/.test(g)) return { tier: 'medium', gpu };
    return { tier: 'low', gpu };
  }
  if (/rtx|radeon rx [6-9]|rx 7|apple m[2-9]|apple m1 (pro|max|ultra)|arc a7/.test(g)) return { tier: cores >= 8 ? 'ultra' : 'high', gpu };
  if (/intel|uhd|iris|mali|adreno/.test(g)) return { tier: 'medium', gpu };
  if (mem >= 8 && cores >= 8) return { tier: 'high', gpu };
  return { tier: 'medium', gpu };
}
