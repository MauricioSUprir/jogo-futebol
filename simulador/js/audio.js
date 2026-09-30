// Sons sintetizados com WebAudio (sem arquivos): apito, torcida no gol, "uh" na chance perdida.
// Só liga depois de um gesto do usuário (regra dos navegadores). Falhas viram silêncio.
import { log } from './log.js';

let ctx = null, master = null, crowd = null, enabled = true, noiseBuf = null;

function ensure() {
  if (ctx || !enabled) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.55; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99 * b0 + w * 0.05; b1 = 0.95 * b1 + w * 0.1; d[i] = (b0 + b1) * 0.9; }
  } catch (e) { log.warn('Áudio indisponível', e.message); ctx = null; }
  return ctx;
}

function crowdBed(on) {
  if (!ensure()) return;
  if (on && !crowd) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.6;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(f); f.connect(g); g.connect(master); src.start();
    g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 1.5);
    crowd = { src, g, f };
  } else if (!on && crowd) {
    const c = crowd; crowd = null;
    c.g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
    setTimeout(() => { try { c.src.stop(); } catch { /* já parou */ } }, 800);
  }
}

function swell(level, secs) {
  if (!crowd) return;
  const t = ctx.currentTime;
  crowd.g.gain.cancelScheduledValues(t);
  crowd.g.gain.setValueAtTime(crowd.g.gain.value, t);
  crowd.g.gain.linearRampToValueAtTime(level, t + 0.25);
  crowd.g.gain.linearRampToValueAtTime(0.12, t + secs);
  crowd.f.frequency.setValueAtTime(900, t);
  crowd.f.frequency.linearRampToValueAtTime(700, t + secs);
}

function whistle(times = 1, long = false) {
  if (!ensure()) return;
  let t = ctx.currentTime + 0.02;
  for (let i = 0; i < times; i++) {
    const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 2950;
    lfo.frequency.value = 42; lg.gain.value = 120; lfo.connect(lg); lg.connect(o.frequency);
    const dur = long && i === times - 1 ? 0.9 : 0.28;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.02); g.gain.setValueAtTime(0.16, t + dur - 0.05); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(master); o.start(t); lfo.start(t); o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
    t += dur + 0.12;
  }
}

export const audio = {
  setEnabled(v) {
    enabled = v;
    if (!v) { crowdBed(false); if (ctx) ctx.suspend().catch(() => {}); }
    else if (ctx) ctx.resume().catch(() => {});
  },
  unlock() { if (enabled && ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
  startMatch() { if (!enabled) return; crowdBed(true); whistle(1); },
  pause(p) { if (!ctx) return; if (p) ctx.suspend().catch(() => {}); else if (enabled) ctx.resume().catch(() => {}); },
  stopMatch() { crowdBed(false); },
  event(type) {
    if (!enabled || !ctx) return;
    try {
      switch (type) {
        case 'goal': swell(0.55, 4.5); break;
        case 'bigMiss': case 'post': case 'save': swell(0.3, 1.6); break;
        case 'foul': case 'offside': whistle(1); break;
        case 'penalty': whistle(1, true); swell(0.35, 2); break;
        case 'yellow': case 'red': whistle(1); break;
        case 'halftime': whistle(2, true); break;
        case 'fulltime': whistle(3, true); break;
        case 'secondHalf': case 'kickoff': whistle(1); break;
      }
    } catch (e) { log.warn('Som falhou', e.message); }
  },
};
