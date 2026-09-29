// Configurações persistentes e níveis de qualidade gráfica.
const KEY = 'jezero.settings.v1';

export const TIERS = {
  low: {
    label: 'Baixa', farStep: 4, minLod: 1, maxPixelRatio: 1.0, minPixelRatio: 0.5, antialias: false,
    cascades: 2, shadowMap: 1024, shadowFar: 90, lodDist: 36, tex: '_1k', normalRes: 2,
    rockDensity: 0.45, rockNear: 34, rockMid: 110, rockFar: 260, dust: 500, triplanar: false,
    envSize: 64, envInterval: 8, lampShadow: false, anisotropy: 2, far: 9000, footprints: 120,
  },
  medium: {
    label: 'Média', farStep: 2, minLod: 0, maxPixelRatio: 1.5, minPixelRatio: 0.6, antialias: true,
    cascades: 3, shadowMap: 2048, shadowFar: 160, lodDist: 52, tex: '_1k', normalRes: 1,
    rockDensity: 0.7, rockNear: 48, rockMid: 170, rockFar: 420, dust: 1200, triplanar: true,
    envSize: 128, envInterval: 4, lampShadow: false, anisotropy: 4, far: 12000, footprints: 250,
  },
  high: {
    label: 'Alta', farStep: 2, minLod: 0, maxPixelRatio: 2.0, minPixelRatio: 0.75, antialias: true,
    cascades: 4, shadowMap: 2048, shadowFar: 260, lodDist: 72, tex: '', normalRes: 1,
    rockDensity: 1.0, rockNear: 64, rockMid: 240, rockFar: 650, dust: 2500, triplanar: true,
    envSize: 256, envInterval: 2, lampShadow: true, anisotropy: 8, far: 14000, footprints: 400,
  },
  ultra: {
    label: 'Ultra', farStep: 1, minLod: 0, maxPixelRatio: 3.0, minPixelRatio: 1.0, antialias: true,
    cascades: 4, shadowMap: 4096, shadowFar: 380, lodDist: 96, tex: '', normalRes: 1,
    rockDensity: 1.25, rockNear: 90, rockMid: 320, rockFar: 900, dust: 4000, triplanar: true,
    envSize: 256, envInterval: 1, lampShadow: true, anisotropy: 16, far: 16000, footprints: 600,
  },
};

const DEFAULTS = {
  quality: 'auto', showFps: false, sensitivity: 1, invertY: false, firstPerson: false,
  uiScale: 1, reduceShake: false, contrast: false, volume: 0.8, helpSeen: false,
};

export function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || '{}');
    return { ...DEFAULTS, ...s };
  } catch { return { ...DEFAULTS }; }
}
export function saveSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* armazenamento bloqueado */ }
}

export const isTouch = () => matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;

// Escolhe um nível pelo aparelho: GPU conhecida, memória, núcleos e tela.
export function detectTier() {
  const touch = isTouch();
  let gpu = '';
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    gpu = (ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER)) || '';
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch { /* sem webgl2 */ }
  const g = gpu.toLowerCase();
  const mem = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  if (/swiftshader|llvmpipe|software/.test(g)) return { tier: 'low', gpu };
  if (touch) {
    // celulares/tablets: Apple A15+ e Adreno 7xx aguentam o médio
    if (/apple gpu/.test(g) && mem >= 4) return { tier: 'medium', gpu };
    if (/adreno \(tm\) (7[3-9]\d|8\d\d)|mali-g7[1-9]|immortalis/.test(g)) return { tier: 'medium', gpu };
    return { tier: 'low', gpu };
  }
  if (/rtx|radeon rx [6-9]|rx 7|apple m[2-9]|apple m1 (pro|max|ultra)|arc a7/.test(g)) return { tier: cores >= 8 ? 'ultra' : 'high', gpu };
  if (/intel|uhd|iris|mali|adreno/.test(g) && !/arc/.test(g)) return { tier: 'medium', gpu };
  if (mem >= 8 && cores >= 8) return { tier: 'high', gpu };
  return { tier: 'medium', gpu };
}
