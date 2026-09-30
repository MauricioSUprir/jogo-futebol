// Qualidade gráfica adaptativa.
// AUTO: escolhe um nível inicial pelo aparelho (núcleos, memória, tela, celular) e depois
// observa o tempo de quadro real; se o p95 passar do orçamento por alguns segundos, desce um nível.
import { QUALITY, QUALITY_KEYS, BUDGET } from './config.js';
import { log } from './log.js';

export function detectDevice() {
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const cores = nav.hardwareConcurrency || 4;
  const mem = nav.deviceMemory || null; // GB (Chrome/Android)
  const touch = (typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in globalThis;
  const small = typeof screen !== 'undefined' ? Math.min(screen.width, screen.height) < 600 : false;
  const dpr = globalThis.devicePixelRatio || 1;
  const saveData = !!nav.connection?.saveData;
  return { cores, mem, touch, small, dpr, saveData, mobile: touch && small };
}

export function autoLevel(dev = detectDevice()) {
  if (dev.saveData) return 'baixo';
  if (dev.mobile) {
    if ((dev.mem && dev.mem <= 3) || dev.cores <= 4) return 'baixo';
    if ((dev.mem && dev.mem <= 6) || dev.cores <= 6) return 'medio';
    return 'alto';
  }
  if ((dev.mem && dev.mem <= 4) || dev.cores <= 2) return 'medio';
  if (dev.cores >= 8 && (!dev.mem || dev.mem >= 8)) return 'ultra';
  return 'alto';
}

/** Monitor de quadros: mede frame time, p95 e ajusta o nível no modo AUTO. */
export class FrameMonitor {
  constructor() {
    this.samples = new Float32Array(180);
    this.i = 0; this.n = 0;
    this.last = 0;
    this.badSince = 0; this.goodSince = 0;
    this.fps = 0; this.p95 = 0; this.avg = 0;
    this.longFrames = 0;
  }
  frame(now) {
    if (this.last) {
      const dt = Math.min(250, now - this.last);
      this.samples[this.i] = dt; this.i = (this.i + 1) % this.samples.length; this.n = Math.min(this.n + 1, this.samples.length);
      if (dt > 50) this.longFrames++;
    }
    this.last = now;
  }
  compute() {
    if (this.n < 10) return;
    const arr = Array.from(this.samples.subarray(0, this.n)).sort((a, b) => a - b);
    this.avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    this.p95 = arr[Math.floor(arr.length * 0.95)];
    this.fps = 1000 / this.avg;
  }
  /** Chamado ~1x/s. Devolve o novo nível quando deve mudar (só no AUTO). */
  adapt(now, current, fpsCap) {
    this.compute();
    if (this.n < 90) return null;
    const idx = QUALITY_KEYS.indexOf(current);
    const target = fpsCap ? 1000 / fpsCap : BUDGET.frameMs;
    const tooSlow = this.p95 > Math.max(BUDGET.downgradeP95Ms, target * 1.6);
    if (tooSlow) {
      this.goodSince = 0;
      if (!this.badSince) this.badSince = now;
      if (now - this.badSince > 3000 && idx > 0) {
        this.badSince = 0; this.n = 0;
        log.info(`Qualidade AUTO: ${current} → ${QUALITY_KEYS[idx - 1]} (p95 ${this.p95.toFixed(1)} ms)`);
        return QUALITY_KEYS[idx - 1];
      }
    } else {
      this.badSince = 0;
      if (this.p95 < BUDGET.upgradeP95Ms && !fpsCap) {
        if (!this.goodSince) this.goodSince = now;
        if (now - this.goodSince > 20000 && idx < QUALITY_KEYS.length - 1) {
          this.goodSince = 0; this.n = 0;
          log.info(`Qualidade AUTO: ${current} → ${QUALITY_KEYS[idx + 1]}`);
          return QUALITY_KEYS[idx + 1];
        }
      } else this.goodSince = 0;
    }
    return null;
  }
}

export const qualityPreset = (k) => QUALITY[k] || QUALITY.medio;
