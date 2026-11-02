// O que a tela mostra da cobrança mirada (puro; carregado sob demanda pela página com render/bola-parada.js): a trajetória
// prevista pela física da bola (mira.js chuteMirado + simularLinha, a mesma conta do chute) e o rótulo de COMANDO do tipo
// (nos dados: a tela não o escreve desde o item 65), e o plano do DESENHO dela (desenhoDaMira, item 65: que parte da linha a
// tela mostra, onde ela esmaece e o anel do alvo).
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

// O desenho da linha (item 65 da FILA, dono 23/10: "alguma coisa mais minimalista"; contrato "Cobrança mirada" no CONTRATOS.md).
// A informação é a de antes (a dificuldade não muda): onde a pessoa via o fim da linha, vê o ANEL do alvo.
//  - ALTA e TENSA: a linha até `altaFim` (45%) do comprimento do arco até o alvo, esmaecendo de `altaEsmaece` (30%) em
//    diante, e o anel no alvo: o ponto em que a bola, depois de passar de yAlto + 0,3 m, desce a yAlto (a altura da cabeça);
//    sem isso, o último ponto — a MESMA regra do alvo do voo na cobrança (acoes.js cobrancaMirada, o `k`), copiada aqui porque
//    mira.js/acoes.js estão no fecho do hash. Guarda: teste-mira G (o anel = m.voo.alvo depois do chute, ≤ 1 cm).
//  - CHUTE (tiro livre direto): a extensão de antes (preverMira: a barreira + MIRA.linhaChute m, ou MIRA.semBarreira m),
//    esmaecendo nos últimos 30%; sem anel.
//  - CURTA e LONGA (só a direção, MIRA.direcao m no chão): esmaecendo nos últimos 40%; sem anel.
// Em todos, a linha começa na borda da bola (`inicio` m do centro, pelo arco) e entra (a opacidade sobe) em `entra` m.
export const DESENHO_MIRA = { inicio: 0.25, entra: 0.35, altaFim: 0.45, altaEsmaece: 0.30, chuteEsmaece: 0.70, passeEsmaece: 0.60 };

/**
 * O plano do desenho da linha (puro): `info` = o que preverMira devolveu, `pts` = os pontos dela. Em out: total (m de arco
 * até o alvo, ou da linha inteira), inicio, entra, esmaece e fim (m de arco a partir da bola), iFim (o 1º ponto em que o arco
 * passa de fim) e alvo ({x, z, i}: o ponto da queda, na ALTA e na TENSA; null nos outros).
 */
export function desenhoDaMira(info, pts, out = {}) {
  const D = DESENHO_MIRA, n = info.n, alto = info.tipo === 'alta' || info.tipo === 'tensa';
  let k = n - 1;
  if (alto) {
    // (a regra do acoes.js cobrancaMirada: o fim da linha; no cruzamento, onde ela desce à altura da cabeça)
    const Y = ACOES.cruzamento.yAlto;
    for (let i = 1, sb = 0; i < n; i++) { const y = pts[i * 3 + 1]; if (y > Y + 0.3) sb = 1; if (sb && y <= Y && y < pts[i * 3 - 2]) { k = i; break; } }
  }
  let total = 0;
  for (let i = 1; i <= k; i++) total += MD.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]);
  const fim = alto ? D.altaFim * total : total;
  const esm = (alto ? D.altaEsmaece : info.trajetoria ? D.chuteEsmaece : D.passeEsmaece) * total;
  out.total = total; out.fim = fim; out.esmaece = esm;
  out.inicio = Math.min(D.inicio, esm); out.entra = Math.min(out.inicio + D.entra, esm);
  let iFim = n - 1;
  for (let i = 1, s = 0; i < n; i++) { s += MD.hypot(pts[i * 3] - pts[i * 3 - 3], pts[i * 3 + 1] - pts[i * 3 - 2], pts[i * 3 + 2] - pts[i * 3 - 1]); if (s >= fim - 1e-9) { iFim = i; break; } }
  out.iFim = iFim;
  out.alvo = alto ? { x: pts[k * 3], z: pts[k * 3 + 2], i: k } : null;
  return out;
}
