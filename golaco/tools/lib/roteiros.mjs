// Roteiros de entrada sorteados para os testes de condução (curvas, zigue-zague, arrancadas,
// freadas, condução curta e cortes). Determinísticos pela semente.
import { BOTAO, PASSO, CAMPO } from '../../js/config.js';
import { criarRng, entre, uniforme } from '../../js/rng.js';

/**
 * Roteiro sorteado: segmentos de 0,5–2 s com um tipo de comando cada. opc.duro: também giros de
 * 180° de uma vez (correndo e na arrancada) e cortes fortes (69°–115°) em vez de 34°–86°.
 */
export function criarRoteiro(semente, opc = {}) {
  const r = criarRng(semente * 977 + 13 + (opc.duro ? 5003 : 0));
  const segs = [];
  let t = 0, rumo = entre(r, -Math.PI, Math.PI);
  while (t < 60) {
    const u = uniforme(r);
    const dur = entre(r, 0.5, 2);
    let tipo;
    if (opc.duro) {
      if (u < 0.16) tipo = 'curva';
      else if (u < 0.3) tipo = 'zigue';
      else if (u < 0.44) tipo = 'arrancada';
      else if (u < 0.52) tipo = 'freia';
      else if (u < 0.6) tipo = 'curta';
      else if (u < 0.78) tipo = 'corte';
      else if (u < 0.92) tipo = 'giro';
      else tipo = 'trote';
    } else if (u < 0.22) tipo = 'curva';
    else if (u < 0.42) tipo = 'zigue';
    else if (u < 0.56) tipo = 'arrancada';
    else if (u < 0.66) tipo = 'freia';
    else if (u < 0.78) tipo = 'curta';
    else if (u < 0.88) tipo = 'corte';
    else tipo = 'trote';
    // (mesma ordem de sorteio do roteiro original: o roteiro normal não muda)
    const w = entre(r, -2.2, 2.2), lado = uniforme(r) < 0.5 ? -1 : 1;
    const ang = opc.duro ? entre(r, 1.2, 2.0) : entre(r, 0.6, 1.5);
    const correr = opc.duro ? uniforme(r) < 0.5 : false;
    segs.push({ t0: t, t1: t + dur, tipo, w, lado, ang, correr });
    t += dur;
  }
  return { segs, rumo0: rumo };
}

export function entrada(rot, t, j) {
  const s = rot.segs.find(g => t >= g.t0 && t < g.t1) ?? rot.segs[rot.segs.length - 1];
  const dt = t - s.t0;
  // rumo base: volta para o meio do campo quando chega perto das linhas
  let base = rot.rumoAtual ?? rot.rumo0;
  const lim = 8;
  if (Math.abs(j.x) > CAMPO.meioX - lim || Math.abs(j.z) > CAMPO.meioZ - lim) base = Math.atan2(-j.z, -j.x);
  let r = base, mag = 1, botoes = 0;
  switch (s.tipo) {
    case 'curva': r = base + s.w * dt * 0.5; mag = 0.85; break;
    case 'zigue': r = base + s.lado * (Math.floor(dt / 0.6) % 2 ? 0.7 : -0.7); mag = 0.9; break;
    case 'arrancada': mag = 1; botoes = BOTAO.CORRER; r = base + s.w * 0.15 * dt; break;
    case 'freia': mag = dt < 0.6 ? 0 : 0.5; break;
    case 'curta': r = base + s.w * dt; mag = 0.7; botoes = BOTAO.MOD; break;
    case 'corte': r = base + (dt > 0.3 ? s.lado * s.ang : 0); mag = 1; break;
    case 'giro': r = base + (dt > 0.4 ? Math.PI : 0); mag = 1; botoes = s.correr ? BOTAO.CORRER : 0; break;
    default: mag = 0.5;
  }
  if (dt > s.t1 - s.t0 - PASSO * 1.5) rot.rumoAtual = r; // o próximo segmento continua daqui
  return { x: Math.cos(r) * mag, z: Math.sin(r) * mag, botoes };
}

