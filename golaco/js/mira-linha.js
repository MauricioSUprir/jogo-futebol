// O que a tela mostra da cobrança mirada (puro; carregado sob demanda pela página com render/bola-parada.js): a trajetória
// prevista pela física da bola (mira.js chuteMirado + simularLinha, a mesma conta do chute) e o rótulo de COMANDO do tipo.
import { ACOES, MIRA, BOTAO, PASSO } from './config.js';
import { MD } from './matdet.js';
import { clamp } from './mat.js';
import { tipoMirado, comTrajetoria, chuteMirado, simularLinha } from './mira.js';

export const ROTULO_MIRA = { alta: 'ALTA', tensa: 'TENSA', chute: 'CHUTE', curta: 'CURTA', longa: 'LONGA' };
const _cm = {};

/**
 * {tipo, rotulo, curva, carregando, forca, ang, trajetoria, n} da cobrança mirada agora (os pontos em `pts`), ou null.
 * Sem carga a força é MIRA.forcaPadrao; no CHUTE a gol a linha vai só até MIRA.linhaChute m além da barreira.
 */
export function preverMira(m, pts, out = {}) {
  const pr = m.parada;
  if (!pr || pr.rolou || !pr.mira || pr.cobrador == null || m.posse !== pr.cobrador) return null;
  let c = null;
  for (const j of m.jogadores) if (j.id === pr.cobrador) { c = j; break; }
  if (!c) return null;
  const mi = pr.mira, cg = c.carga;
  // na corrida da cobrança (item 70, P1; corrida.js): a linha do pedido guardado (tipo e força do soltar), parada até o chute
  const pc = pr.corrida && pr.corrida.estado === 'corre' ? pr.corrida.pedido : null;
  const tipo = pc && pc.mirada ? pc.mirada.tipo : tipoMirado(m, pr, cg ? cg.tipo : null, (cg && cg.mod) || (c.botoes & BOTAO.MOD) !== 0);
  out.tipo = tipo; out.rotulo = ROTULO_MIRA[tipo]; out.curva = mi.curva; out.carregando = !!cg || !!pc; out.ang = mi.ang;
  out.forca = pc ? pc.forca : cg ? clamp((m.tick - cg.t0) * PASSO / ACOES.cargaCheia, 0.08, 1) : MIRA.forcaPadrao;
  out.trajetoria = comTrajetoria(tipo);
  if (!out.trajetoria) {
    // só a direção (no chão)
    const ux = MD.cos(mi.ang), uz = MD.sin(mi.ang), L = MIRA.direcao;
    for (let i = 0; i <= 12; i++) { pts[i * 3] = pr.x + ux * L * i / 12; pts[i * 3 + 1] = 0.03; pts[i * 3 + 2] = pr.z + uz * L * i / 12; }
    out.n = 13;
    return out;
  }
  const r = chuteMirado(m, c, pr, tipo, out.forca, mi.ang, mi.curva, _cm);
  const br = pr.barreira;
  out.n = simularLinha(m, r.v, r.w, pts, tipo === 'chute' ? (br && br.n > 0 ? br.dist + MIRA.linhaChute : MIRA.semBarreira) : Infinity);
  return out;
}
