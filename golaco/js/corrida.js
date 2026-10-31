// Cobranças com corrida (item 70, P1; pedido do dono de 29/10: "no pênalti, no escanteio e no tiro de meta o cobrador corre
// até a bola e bate"; aval de 31/10, com a falta junto). PURO: sem three.js nem DOM; matemática pelo MD; sem sorteio (a
// corrida de cada jogador sai do id dele). Contrato "Cobranças com corrida (item 70, P1)" no CONTRATOS.md; constantes em
// config.js CORRIDA_COBRANCA; pesquisa em PESQUISA-ETAPA4.md §16.
//
// O plano (m.parada.corrida, montado pelo partida.js no fim da montagem do pênalti, do escanteio, do tiro de meta e do tiro
// livre): o PONTO DE PARTIDA (x0, z0) atrás da bola, pelo perfil do tipo e pelo pé que bate (o lado do pé de apoio), o ponto
// do pé de apoio ao lado da bola (sx, sz) e o do corpo no meio desse apoio (mx, mz). Estados:
//  - 'espera': o cobrador ('parado') fica no ponto de partida; a pessoa mira e carrega (partida.js cobrar);
//  - 'corre': o pedido (força, mira, tipo) ficou guardado no plano e o cobrador corre pela LOCOMOÇÃO do jogo — j.guia (o
//    pedido de movimento que o sim.js usa para quem está 'parado') → passoCorpo/passoPassada; nada de teletransporte. A
//    velocidade é a de uma REGULAGEM DA PASSADA: a cada passo, quantas passadas faltam para o pé de apoio pousar no ponto
//    dele (a fase da passada e o ritmo do jogador.js) com a velocidade mais perto da do perfil; na última passada o pouso é
//    ajustado no tempo (passoPassada pousoEm: o ritmo, sem salto de fase), como o atleta que ajusta as últimas passadas
//    pela vista (Lee, Lishman & Thomson 1982);
//  - o CONTATO (sim.js, no lugar da condução do cobrador): com o pé de apoio plantado ao lado da bola, no meio do apoio (ou o
//    corpo chegando à altura da bola), o toque de ação de sempre (acoes.js executarAcao) com o pé que bate — o gesto do pé
//    (conducao.js atualizarGesto) sobe com o toque 'acao' marcado na hora prevista. A bola fica presa no ponto até lá
//    (partida.js regrasPartida): a linha da cobrança mirada continua a física da bola real.
// A IA começa a corrida `ticks` antes da hora de hoje (a previsão da corrida pela mesma locomoção: estimarTicks), para a
// bola rolar no mesmo tempo (o relógio não para nas bolas paradas).
//
// Estilos do pênalti (item 70, P2; contrato "Estilos de pênalti (item 70, P2)"; config.js ESTILO_PENALTI; pesquisa §17):
// cr.estilo ∈ normal | forte | colocado | paradinha | pulinho | cavadinha. A corrida da paradinha tem fases (cr.fasePar:
// 'antes' → 'freia' → 'pausa' → 'retoma'): a pausa abaixo de 1 m/s acontece com o corpo a pausaEm m do meio do apoio — sempre
// ANTES do último apoio: a finta depois da corrida (Regra 14) não existe por construção. O pulinho: no penúltimo apoio (o
// pé que bate sai do chão na última passada) o corpo fica no ar mais tempo (cr.pulo; o ritmo é lógica, o salto é desenho:
// anim.js). O goleiro: cr.gk = {lado, desde} o lado em que ele está comprometido (o da IA que saiu cedo; o da pessoa pelo
// analógico) e cr.gkLido, o que o cobrador viu até o pé de apoio pousar — a leitura do cobrador que depende do goleiro.

import { CORRIDA_COBRANCA as CC, CAMPO, PASSO, PASSADA, GESTO, CONDUCAO, ESTILO_PENALTI as EP, GOLEIRO } from './config.js';
import { MD } from './matdet.js';
import { clamp, lerp } from './mat.js';
import { uniforme } from './rng.js';
import { passoCorpo, copiaCinematica, freqPassada, cargaPassada, faseLocal, progressoBalanco } from './jogador.js';
import { executarAcao } from './acoes.js';

export const TIPOS_CORRIDA = CC.tipos;
/**
 * Ganchos do partida.js (ligados na importação dele; corrida.js não importa o partida.js). pedidoIA(m, j): o pedido da
 * cobrança da IA decidido de novo no contato (o pedido marcado `ia`). rolou(m), a bola rolou — chamado no
 * passo do contato, LOGO depois da batida, como a cobrança de antes (partida.js cobrar → rolou, antes do passo): o goleiro
 * lê o chute do pênalti com o pênalti em aberto (m.partida.penaltiAberto: o lado escolhido antes), a barreira pula no
 * chute, o escanteio marca os lugares (m.partida.bp) e o cobrador volta a se mexer no mesmo passo.
 */
export const ganchosCorrida = { rolou: null, pedidoIA: null };
export const ESTADOS_CORRIDA = ['espera', 'corre'];
const s60 = s => Math.round(s / PASSO);
const RAD = Math.PI / 180;

/** Fração [0, 1) do jogador `id` para a faixa `k` do perfil (cada jogador tem a sua corrida; só inteiros: igual em todo motor). */
export function fracDoJogador(id, k) {
  const h = Math.imul((id | 0) * 31 + k * 977 + 7, 0x9e3779b1) >>> 0;
  return (h % 10007) / 10007;
}

/** Nome do perfil (config.js CORRIDA_COBRANCA.perfis) da parada `pr` com o cobrador da pessoa (`pessoa`) ou da IA. */
export function perfilDaParada(m, pr, pessoa) {
  if (pr.tipo === 'penalti' || pr.tipo === 'escanteio') return pr.tipo;
  if (pr.tipo === 'tiroDeMeta') return !pessoa && pr.curta ? 'tiroDeMetaCurto' : 'tiroDeMetaLongo';
  if (pr.tipo === 'tiroLivre') {
    const lado = m.ataca ? m.ataca[pr.time] : 1, dGol = MD.hypot(lado * CAMPO.meioX - pr.x, pr.z);
    return pr.direto && dGol <= 30 && Math.abs(pr.z) < CAMPO.area.largura / 2 ? 'tiroLivreChute' : 'tiroLivrePasse';
  }
  return null;
}

/** O ponto (x, z) está num lugar de onde ninguém corre (além das placas ou dentro do gol)? */
function foraDoLugar(x, z) {
  if (Math.abs(x) > CAMPO.meioX + CAMPO.entorno - CC.borda || Math.abs(z) > CAMPO.meioZ + CAMPO.entorno - CC.borda) return true;
  return Math.abs(x) > CAMPO.meioX - CC.linhaGol && Math.abs(z) < CAMPO.gol.largura / 2 + 1;
}

/**
 * O plano da corrida do cobrador `c` para a bola em (bx, bz) com o eixo da cobrança `rumo` e o perfil `perfil` (pura; sem
 * sorteio): {estado, perfil, pe (o pé que bate), ps (o de apoio), ux, uz (eixo), x0, z0, rumo0 (o ponto de partida, de
 * frente para a corrida), dx, dz (a direção da corrida), sx, sz (o pé de apoio), mx, mz (o corpo no meio do apoio), vel (m/s
 * do perfil), ticks (a previsão da corrida), t0, k, plantou, meio, supApoio, contato, pedido, mira0}.
 */
export function planejarCorrida(c, bx, bz, rumo, perfil) {
  const P = CC.perfis[perfil];
  const pe = (c.par.attr.pePreferido ?? 1) === 0 ? 0 : 1, ps = 1 - pe;
  const lado = ps === 0 ? -1 : 1; // o pé de apoio do lado dele (pé esquerdo: −1, à esquerda do eixo)
  const ux = MD.cos(rumo), uz = MD.sin(rumo), rx = -uz, rz = ux;
  let D = lerp(P.dist[0], P.dist[1], fracDoJogador(c.id, 0));
  const ang = lerp(P.ang[0], P.ang[1], fracDoJogador(c.id, 1)) * RAD;
  const ca = MD.cos(ang), sa = MD.sin(ang);
  // o pé de apoio: ao lado do centro da bola e um pouco atrás (Scurr & Hall 2009)
  const sx = bx + rx * lado * CC.apoio.lado - ux * CC.apoio.atras, sz = bz + rz * lado * CC.apoio.lado - uz * CC.apoio.atras;
  let x0 = bx - ux * D * ca + rx * lado * D * sa, z0 = bz - uz * D * ca + rz * lado * D * sa;
  // longe das placas e fora do gol: a distância encolhe na mesma reta (no mínimo 1,8 m)
  for (let i = 0; i < 40 && foraDoLugar(x0, z0) && D > 1.8; i++) {
    D -= 0.1;
    x0 = bx - ux * D * ca + rx * lado * D * sa; z0 = bz - uz * D * ca + rz * lado * D * sa;
  }
  let dx = sx - x0, dz = sz - z0;
  const L = MD.hypot(dx, dz) || 1;
  dx /= L; dz /= L;
  // o corpo no meio do apoio: o pé pousa ao lado do centro do corpo (jogador.js pontoPouso: PASSADA.afastamentoLateral)
  const mx = sx + dz * lado * PASSADA.afastamentoLateral, mz = sz - dx * lado * PASSADA.afastamentoLateral;
  const vel = lerp(P.vel[0], P.vel[1], fracDoJogador(c.id, 2));
  return {
    estado: 'espera', perfil, pe, ps, ux, uz, x0, z0, rumo0: MD.atan2(dz, dx), dx, dz, sx, sz, mx, mz, vel, ticks: 0,
    t0: -1, k: -1, ritmo: 0, plantou: -1, meio: 0, supApoio: true, contato: -1, pedido: null, mira0: null,
    // estilos do pênalti (P2): o estilo da corrida, o que a IA usaria, a paradinha, o pulinho, o goleiro e a troca de mira
    estilo: 'normal', estiloIA: 'normal', fasePar: null, par: null, pausaAte: -1, pulo: null, pul: null,
    gk: { lado: 0, desde: -1 }, gkLido: null, troca: -1, ladoMira: 0, penult: -1,
  };
}

// ---------------------------------------------------------------------------- estilos do pênalti (item 70, P2)

export const ESTILOS_PENALTI = EP.estilos;
/** O estilo depende do goleiro (van der Kamp 2006: o cobrador olha o goleiro na corrida)? */
export const dependeDoGoleiro = e => e === 'paradinha' || e === 'pulinho';

/** O estilo preferido do jogador `id` (pura: pelo id, ESTILO_PENALTI.ia.pesos). */
export function estiloPreferido(id) {
  const P = EP.ia.pesos;
  let r = fracDoJogador(id, 5) * P.reduce((a, q) => a + q[1], 0);
  for (const [e, w] of P) { if (r < w) return e; r -= w; }
  return P[P.length - 1][0];
}

/** O estilo da IA nesta cobrança: o preferido com a chance ESTILO_PENALTI.ia.fiel, senão o normal (um sorteio do m.rng). */
export function sortearEstilo(m, c) {
  return uniforme(m.rng) < EP.ia.fiel ? estiloPreferido(c.id) : 'normal';
}

/** O perfil da corrida do estilo (config.js CORRIDA_COBRANCA.perfis; o normal é o 'penalti'). */
export const perfilDoEstilo = e => EP.perfil[e] ?? 'penalti';

/**
 * O estilo `e` no plano `cr` do cobrador `c` (puro; os números do jogador pelo id): a velocidade da corrida do perfil do estilo
 * (o ponto de partida fica: o da IA já é o do estilo; o da pessoa, o do normal), a pausa da paradinha e o salto do pulinho.
 */
export function definirEstilo(c, cr, e) {
  cr.estilo = e;
  const P = CC.perfis[perfilDoEstilo(e)];
  cr.vel = lerp(P.vel[0], P.vel[1], fracDoJogador(c.id, 2));
  const A = EP.paradinha;
  cr.fasePar = e === 'paradinha' ? 'antes' : null;
  cr.par = e === 'paradinha' ? {
    em: lerp(A.pausaEm[0], A.pausaEm[1], fracDoJogador(c.id, 3)), t: lerp(A.tPausa[0], A.tPausa[1], fracDoJogador(c.id, 4)),
    vRetoma: lerp(A.vRetoma[0], A.vRetoma[1], fracDoJogador(c.id, 6)),
  } : null;
  cr.pul = e === 'pulinho' ? { h: lerp(EP.pulinho.altura[0], EP.pulinho.altura[1], fracDoJogador(c.id, 7)) } : null;
}

/**
 * A paradinha ou o pulinho ainda cabem nesta corrida (o pedido da pessoa no meio dela)? A paradinha precisa de espaço para
 * frear até a pausa antes do último apoio; o pulinho, de o pé de apoio ainda não estar na última passada.
 */
export function cabeEstilo(c, cr, e) {
  if (cr.estado === 'espera') return true;
  if (cr.plantou >= 0 || cr.estado !== 'corre' || cr.fasePar || cr.pulo) return false;
  const Dl = (cr.mx - c.x) * cr.dx + (cr.mz - c.z) * cr.dz, s = MD.hypot(c.vx, c.vz);
  if (e === 'paradinha') return Dl > distFreio(c, s) + lerp(EP.paradinha.pausaEm[0], EP.paradinha.pausaEm[1], fracDoJogador(c.id, 3)) + 0.2;
  if (e === 'pulinho') return cr.k !== 0 && Dl > 1.2;
  return false;
}

/** m que o corpo a s m/s leva para frear até a velocidade da pausa da paradinha (a freada suave, `paradinha.freio`) + a folga. */
function distFreio(c, s) {
  const vP = EP.paradinha.vPausa;
  return Math.max(0, (s * s - vP * vP) / (2 * EP.paradinha.freio)) + EP.paradinha.folgaFreio;
}

/** O goleiro que defende a parada (o do outro time) ou null. */
function goleiroDaParada(m) {
  const t = m.parada.time;
  for (const o of m.jogadores) if (o.time !== t && o.posicao === 'GOL') return o;
  return null;
}

/**
 * Canto do pênalti contra escolhido pelo analógico do goleiro do humano (Regra 14): −1/+1 = o sinal de z (o canto do lado
 * de lá / de cá da linha do gol), 0 = nenhum (fica no meio). Só a componente AO LONGO da linha do gol escolhe: o empurrão
 * principalmente para o batedor ou para o gol (|iz| < GOLEIRO.penalti.ladoMin × o módulo; com a câmera de TV, esquerda e
 * direita da tela) ou o analógico solto não escolhe — antes o sinal de iz ≈ 0 dava sempre +z. Pura (partida.js reexporta).
 */
export function ladoPenaltiHumano(j) {
  if (!(j.imag > 0.3)) return 0;
  const iz = j.iz ?? 0, mod = MD.hypot(j.ix ?? 0, iz);
  return mod > 1e-6 && Math.abs(iz) >= GOLEIRO.penalti.ladoMin * mod ? (iz > 0 ? 1 : -1) : 0;
}

/**
 * O goleiro na corrida do pênalti (antes do passo; P2): o da pessoa está comprometido com o lado do analógico (cr.gk, desde
 * quando); o da IA que sai CEDO (pr.gkCedo s antes do contato, sorteado na montagem) se compromete com o lado do palpite
 * quando o contato previsto chega a isso — e dá o passo para lá (goleiro.js). Até o pé de apoio pousar, o cobrador vê
 * (cr.gkLido: contatoCorrida guarda no pouso).
 */
function vigiarGoleiro(m, c, cr) {
  const pr = m.parada, gk = goleiroDaParada(m);
  if (!gk || pr.tipo !== 'penalti') return;
  const humano = m.humanos.includes(gk.time) && m.controlado[gk.time] === gk.id && !m.iaJoga?.[gk.time];
  if (humano) {
    const l = ladoPenaltiHumano(gk);
    if (l !== cr.gk.lado) { cr.gk.lado = l; cr.gk.desde = l ? m.tick : -1; }
    return;
  }
  if (cr.gk.desde >= 0 || !(pr.gkCedo > 0) || !gk.palpite) return;
  const s = MD.hypot(c.vx, c.vz), Dl = (cr.mx - c.x) * cr.dx + (cr.mz - c.z) * cr.dz;
  const falta = cr.contato >= 0 ? (cr.contato - m.tick) * PASSO
    : cr.plantou >= 0 ? (cr.plantou + cr.meio - m.tick) * PASSO : Math.max(0, Dl) / Math.max(s, 0.5);
  if (falta <= pr.gkCedo) { cr.gk.lado = gk.palpite > 0 ? 1 : -1; cr.gk.desde = m.tick; cr.gk.ia = true; }
}

/** Rampa da leitura (van der Kamp 2006): o goleiro comprometido L s antes do contato — 0 em 150 ms (o acaso), 1 em 400 ms. */
export const rampaLeitura = L => clamp((L - EP.leitura.tempo[0]) / (EP.leitura.tempo[1] - EP.leitura.tempo[0]), 0, 1);

/**
 * A leitura do cobrador da IA que depende do goleiro (no contato; P2): {lado (o sinal de z do goleiro visto, 0 = nada para
 * ler), L (s do compromisso ao contato), r (a rampa)} — o que o cobrador viu até o pé de apoio pousar (cr.gkLido).
 */
export function leituraDoGoleiro(m, cr) {
  const g = cr.gkLido;
  if (!g || !g.lado || g.desde < 0) return { lado: 0, L: 0, r: 0 };
  const L = (m.tick - g.desde) * PASSO;
  return { lado: g.lado, L, r: rampaLeitura(L) };
}

/**
 * O estilo no pedido da batida (no contato; P2): forte (mais força, mais erro), colocado (o chute colocado), a corrida que
 * espera (paradinha, pulinho: a força × kd.forca) e, da pessoa que trocou de canto na corrida, o erro pela rampa da troca
 * (tarde erra mais). A leitura da IA é do partida.js (pedidoDaIA: a direção do canto). Muda p; devolve p.
 */
export function estiloNoPedido(m, cr, p) {
  if (!p || p.tipo !== 'chute') return p;
  if (p.cavadinha) { cr.estilo = 'cavadinha'; return p; }
  const e = cr.estilo;
  if (e === 'forte') { p.forca = p.forca + (1 - p.forca) * EP.forte.forca; p.erroEstilo = (p.erroEstilo ?? 1) * EP.forte.erro; p.mod = false; }
  else if (e === 'colocado') p.mod = true;
  else if (dependeDoGoleiro(e)) {
    p.forca *= EP.kd.forca;
    if (!p.ia && cr.troca >= 0) p.erroEstilo = (p.erroEstilo ?? 1) * (1 + EP.leitura.erroTarde * (1 - rampaLeitura((m.tick - cr.troca) * PASSO)));
  }
  return p;
}

/**
 * Previsão da corrida (ticks do ponto de partida, parado, até o corpo chegar ao meio do apoio), pela mesma locomoção
 * (passoCorpo com a bola, a velocidade do perfil). A IA começa a corrida isto antes da hora de bater de hoje.
 */
export function estimarTicks(c, cr) {
  const k = copiaCinematica(c);
  k.x = cr.x0; k.z = cr.z0; k.vx = 0; k.vz = 0; k.ax = 0; k.az = 0; k.rumo = cr.rumo0; k.giro = 0; k.inv = false;
  for (let i = 1; i <= 360; i++) {
    const ex = cr.mx - k.x, ez = cr.mz - k.z, d = MD.hypot(ex, ez);
    if (ex * cr.dx + ez * cr.dz <= 0.02 || d < 0.05) return i;
    passoCorpo(k, ex / d, ez / d, cr.vel, cr.rumo0, c.par, PASSO, true);
  }
  return 360;
}

/**
 * O cobrador `j` tem a cobrança com corrida (a parada não rolou; esperando ou correndo)? O sim.js não conduz a bola dele nem
 * conta a "bola perdida" (ele está longe dela, no ponto de partida): a bola fica presa no ponto (partida.js regrasPartida).
 */
export function naCorrida(m, j) {
  const pr = m.parada;
  return !!pr && !pr.rolou && !!pr.corrida && pr.cobrador === j.id;
}

/** O cobrador `j` está na corrida da cobrança (a parada não rolou, o plano corre)? */
export function correndo(m, j) {
  const pr = m.parada;
  return !!pr && !pr.rolou && !!pr.corrida && pr.corrida.estado === 'corre' && pr.cobrador === j.id;
}

/**
 * Começa a corrida com o pedido `p` (o da pessoa, ao soltar o botão, ou o da IA): guarda o pedido e a mira do momento (o
 * analógico e a mira guardada do cobrador: no contato valem os de agora, como se o pedido saísse já).
 */
export function iniciarCorrida(m, c, cr, p) {
  cr.estado = 'corre'; cr.t0 = m.tick; cr.pedido = p;
  cr.mira0 = { ix: c.ix, iz: c.iz, imx: c.imx, imz: c.imz, imag: c.imag, mira: c.mira ? { x: c.mira.x, z: c.mira.z, mag: c.mira.mag } : null };
  // passe/lançamento sem mira nenhuma (o analógico solto): a direção é o eixo da cobrança (antes, o rumo do corpo parado
  // no ponto — agora o corpo chega pela corrida, de lado)
  if (p.tipo !== 'chute' && !p.dir && !(c.imag > 0.2) && !c.mira) p.dir = { x: cr.ux, z: cr.uz };
  cr.supApoio = c.pes[cr.ps].apoio;
  c.pedido = null; c.carga = null;
}

/** Fase que falta para o pé de apoio pousar de novo (no ar: o pouso marcado; no chão: depois do passo do outro pé). */
function faseAtePouso(c, ps) {
  const pe = c.pes[ps];
  return pe.apoio ? 2 - faseLocal(c.fase, ps) : Math.max(0.02, pe.fasePouso - c.fase);
}

/** s para andar d m saindo a s m/s e indo a v (acelerando a `a` m/s² ou freando a `fr` m/s²) e seguindo em v. */
function tempoAte(d, s, v, a, fr) {
  if (d <= 0) return 0;
  const ac = v >= s ? a : fr, tv = Math.abs(v - s) / ac, dv = (s + v) / 2 * tv;
  if (dv >= d) {
    // chega antes de terminar a mudança de velocidade
    if (v >= s) return (-s + Math.sqrt(s * s + 2 * a * d)) / a;
    const disc = s * s - 2 * fr * d;
    return disc >= 0 ? (s - Math.sqrt(disc)) / fr : tv;
  }
  return tv + (d - dv) / Math.max(v, 0.1);
}

/**
 * Um passo da corrida, ANTES do passo da simulação (partida.js cobrar): o pedido de movimento (c.guia) pela regulagem da
 * passada e o toque 'acao' marcado na hora prevista do contato (o gesto do pé sobe com ele: conducao.js atualizarGesto).
 */
export function guiarCorrida(m, c, cr) {
  const g = c.guia ?? (c.guia = { dx: cr.dx, dz: cr.dz, vel: 0, rumoAlvo: cr.rumo0 });
  vigiarGoleiro(m, c, cr);
  const ex = cr.mx - c.x, ez = cr.mz - c.z, d = MD.hypot(ex, ez);
  const Dl = ex * cr.dx + ez * cr.dz; // o que falta ao longo da corrida
  // a direção: para o ponto do corpo no meio do apoio (corrige o lado); perto dele, a da corrida
  if (d > 0.3 && Dl > 0.2) { g.dx = ex / d; g.dz = ez / d; } else { g.dx = cr.dx; g.dz = cr.dz; }
  g.rumoAlvo = cr.rumo0;
  const s = MD.hypot(c.vx, c.vz);
  // o pulinho (P2): na última passada (o pé de apoio no ar, pousando no ponto) o pé que bate pisa — o PENÚLTIMO apoio (cr.penult)
  // — e sai do chão mais cedo (saidaCorrida: a carga do pulinho), num voo longo até o pé de apoio pousar ao lado da bola. O
  // salto é desenho (anim.js, pela fração do balanço do pé de apoio desde u0)
  if (cr.estilo === 'pulinho' && !cr.pulo && cr.k === 0 && cr.plantou < 0 && !c.pes[cr.ps].apoio) {
    if (c.pes[cr.pe].apoio) { if (cr.penult < 0) cr.penult = m.tick; }
    else if (cr.penult >= 0) cr.pulo = { t0: m.tick, u0: progressoBalanco(c, cr.ps, true).u, h: cr.pul ? cr.pul.h : EP.pulinho.altura[0] };
  }
  // a paradinha (P2): até a pausa a corrida segue no ritmo natural (sem a regulagem); com o corpo a pausaEm m do meio do apoio
  // + o que ele leva para frear, freia até a velocidade da pausa; abaixo de `abaixo` m/s fica tPausa s e retoma pela regulagem
  // (a vRetoma) — a pausa é sempre antes do último apoio (o pé de apoio ainda vai pousar ao lado da bola)
  let regula = true;
  if (cr.fasePar && cr.fasePar !== 'retoma' && cr.plantou < 0) {
    const P = cr.par, A = EP.paradinha;
    if (cr.fasePar === 'antes' && Dl <= P.em + distFreio(c, s)) cr.fasePar = 'freia';
    if (cr.fasePar === 'freia' && s < A.abaixo) { cr.fasePar = 'pausa'; cr.pausaAte = m.tick + Math.max(1, Math.round(P.t / PASSO)); }
    // (retoma com o pé de apoio no chão — ou passada a espera dele: dois passos até o último apoio, o do pé que bate e o do
    // pé de apoio ao lado da bola; com o pé de apoio no ar a regulagem fazia uma passada só, longa e lenta)
    if (cr.fasePar === 'pausa' && m.tick >= cr.pausaAte && (c.pes[cr.ps].apoio || m.tick >= cr.pausaAte + Math.round(A.esperaApoio / PASSO))) {
      cr.fasePar = 'retoma'; cr.vel = P.vRetoma;
    }
    // (a freada é suave — a velocidade pedida cai como √(vPausa² + 2·freio·d) até o ponto da pausa: pedir a vPausa de uma vez
    // freava no limite do corpo, com a passada longa da corrida, e o quadril afundava entre os dois pés plantados)
    if (cr.fasePar === 'freia') g.vel = Math.min(cr.vel, Math.sqrt(A.vPausa * A.vPausa + 2 * A.freio * Math.max(0, Dl - P.em)));
    else g.vel = cr.fasePar === 'antes' ? cr.vel : A.vPausa;
    if (cr.fasePar !== 'retoma') { cr.ritmo = 0; cr.k = -1; regula = false; }
  }
  if (!regula) {
    // (a paradinha antes da retomada: o pedido já está em g.vel)
  } else if (cr.plantou >= 0 || Dl <= 0) {
    // o pé de apoio já está no lugar (ou o corpo passou do ponto): segue embalado até o contato
    g.vel = Math.max(s, 1);
  } else {
    // regulagem da passada (a dos saltadores: Lee, Lishman & Thomson 1982): para k = 0, 1, 2… passadas a mais até o pouso do
    // pé de apoio no ponto, e a velocidade de cruzeiro v perto da do perfil, o tempo T até o corpo chegar ao meio do apoio
    // (com a aceleração ou a freada de agora até v) e o RITMO da passada que põe a fase ali nesse tempo; a escolha é a de
    // velocidade e ritmo mais perto dos naturais (o ritmo dentro de CC.ritmo × o da velocidade)
    const f0 = faseAtePouso(c, cr.ps);
    const a = c.par.acel0 * c.par.acelComBola * CC.acelUsa, fr = c.par.freio * CC.acelUsa;
    let melhor = Infinity, vMelhor = cr.vel, kMelhor = 0, rMelhor = 0;
    for (let k = 0; k <= 5; k++) {
      for (let iv = -3; iv <= 3; iv++) {
        const v = cr.vel * (1 + CC.velVaria * iv / 3);
        const T = tempoAte(Dl, s, v, a, fr);
        if (!(T > 0.05)) continue;
        const R = (f0 + 2 * k + cargaPassada(v)) / T, rel = R / Math.max(freqPassada(Dl / T, true), 0.5);
        const nota = Math.abs(v - cr.vel) / cr.vel + 2 * Math.abs(rel - 1) + (rel < CC.ritmo[0] ? 20 * (CC.ritmo[0] - rel) : 0)
          + (rel > CC.ritmo[1] ? 20 * (rel - CC.ritmo[1]) : 0);
        if (nota < melhor) { melhor = nota; vMelhor = v; kMelhor = k; rMelhor = R; }
      }
    }
    cr.ritmo = rMelhor;
    cr.k = kMelhor;
    g.vel = clamp(vMelhor, 0.5, CC.velMax + 0.3);
  }
  // a hora prevista do contato: o pouso do pé de apoio + meio apoio (ou o já plantado + o meio)
  const f = Math.max(freqPassada(Math.max(s, 0.5), true), 0.5), meio = cargaPassada(s) / f;
  let falta = Infinity;
  if (cr.plantou >= 0) falta = Math.max(0, (cr.plantou + cr.meio - m.tick) * PASSO);
  else if (cr.k === 0 && !c.pes[cr.ps].apoio) falta = (c.pes[cr.ps].fasePouso - c.fase) / f + meio;
  if (falta <= GESTO.janela + 0.1) {
    const n = Math.max(1, Math.round(falta / PASSO));
    const t = c.cond.toque;
    if (t && t.tipo === 'acao') { t.tick = m.tick + n; t.pe = cr.pe; }
    else c.cond.toque = { tick: m.tick + n, pe: cr.pe, bx: m.bola.p.x, bz: m.bola.p.z, tipo: 'acao' };
    cr.contato = m.tick + n;
  }
}

/**
 * O pedido à passada do cobrador na corrida (sim.js, no passo 2, depois do corpo): na última passada (o pé de apoio no ar e
 * pousando no ponto), o pouso daqui a pousoEm s — o tempo em que o ponto de pouso (o corpo no meio do apoio) chega ao do pé
 * de apoio. Fora disso, null (a passada de sempre; o toque marcado pede o pé que bate).
 */
export function saidaCorrida(m, j) {
  const pr = m.parada, cr = pr && pr.corrida;
  if (!cr || cr.estado !== 'corre' || pr.rolou || pr.cobrador !== j.id || cr.plantou >= 0) return null;
  const sup = j.pes[cr.ps];
  // o pulinho (P2): no penúltimo apoio (a última passada, o pé que bate no chão) ele sai mais cedo — a carga do pulinho: os
  // dois pés no ar por mais tempo até o pé de apoio pousar
  const carga = cr.estilo === 'pulinho' && cr.k === 0 && !sup.apoio ? EP.pulinho.carga : undefined;
  // a última passada (o pé de apoio no ar, pousando no ponto): o pouso quando o ponto de pouso chega ao dele
  if (cr.k === 0 && !sup.apoio) {
    const s = MD.hypot(j.vx, j.vz), f = Math.max(freqPassada(Math.max(s, 0.5), true), 0.5);
    const Dl = (cr.mx - j.x) * cr.dx + (cr.mz - j.z) * cr.dz;
    const t = Dl / Math.max(s, 1) - cargaPassada(s) / f;
    if (t <= CC.pousoUltimo) return { pe: cr.ps, em: PASSO, pousoEm: Math.max(t, PASSO), carga };
  }
  // antes: o pé no ar pousa no ritmo da regulagem (cr.ritmo, fase por segundo)
  if (!(cr.ritmo > 0)) return null;
  const p = !sup.apoio ? cr.ps : !j.pes[cr.pe].apoio ? cr.pe : -1;
  if (p < 0) return null;
  return { pe: p, em: PASSO, pousoEm: Math.max(PASSO, (j.pes[p].fasePouso - j.fase) / cr.ritmo), carga };
}

/**
 * O contato (sim.js, no passo 3, no lugar da condução do cobrador): marca o pouso do pé de apoio perto da bola e, no meio
 * do apoio (ou com o corpo chegando à altura da bola), o toque de ação de sempre (acoes.js executarAcao) com o pé que bate e
 * a mira guardada no começo da corrida. Passou do ponto sem o apoio certo, ou da corrida prevista + CC.max s: bate assim
 * mesmo (trava proibida). Devolve true se a bola saiu.
 */
export function contatoCorrida(m, j) {
  const cr = m.parada.corrida, b = m.bola.p;
  const sup = j.pes[cr.ps];
  if (sup.apoio && !cr.supApoio && cr.plantou < 0 && MD.hypot(sup.x - b.x, sup.z - b.z) <= CC.planta) {
    const s = MD.hypot(j.vx, j.vz);
    cr.plantou = m.tick;
    cr.meio = Math.max(1, Math.round(cargaPassada(s) / Math.max(freqPassada(Math.max(s, 0.5), true), 0.5) / PASSO));
    // o que o cobrador viu do goleiro até o último apoio (P2: a leitura de quem depende do goleiro)
    cr.gkLido = { lado: cr.gk.lado, desde: cr.gk.desde };
  }
  cr.supApoio = sup.apoio;
  const hx = MD.cos(j.rumo), hz = MD.sin(j.rumo);
  const fr = (b.x - j.x) * hx + (b.z - j.z) * hz;               // a bola à frente do corpo (m)
  const fa = (b.x - j.x) * cr.dx + (b.z - j.z) * cr.dz;         // ... ao longo da corrida
  let bate = false;
  if (cr.plantou >= 0) bate = sup.apoio ? m.tick >= cr.plantou + cr.meio || fr <= 0.02 : true;
  else if (fa < CONDUCAO.alcanceFrente || m.tick - cr.t0 > cr.ticks + s60(CC.max)) bate = true; // passou do ponto / passou da hora
  if (!bate) return false;
  return baterCorrida(m, j, cr);
}

/** A batida: o pedido guardado sai com a mira do começo da corrida (pé que bate: o do plano). */
function baterCorrida(m, j, cr) {
  const a = cr.mira0;
  if (a) { j.ix = a.ix; j.iz = a.iz; j.imx = a.imx; j.imz = a.imz; j.imag = a.imag; j.mira = a.mira; }
  j.pedido = cr.pedido && cr.pedido.ia && ganchosCorrida.pedidoIA ? ganchosCorrida.pedidoIA(m, j) : cr.pedido;
  // o estilo do pênalti no chute (P2: forte, colocado, a corrida que espera; a leitura da IA vem no pedidoIA)
  if (m.parada.tipo === 'penalti') estiloNoPedido(m, cr, j.pedido);
  if (j.cond) j.cond.toque = null;
  const ok = executarAcao(m, j, cr.pe, false);
  j.miraAuto = null;
  // segue embalado e freia (sem o pedido de corrida: na partida ele volta a jogar; na disputa, para)
  if (j.guia) j.guia.vel = 0;
  if (!ok) { cr.estado = 'espera'; cr.pedido = null; cr.plantou = -1; cr.k = -1; cr.contato = -1; }
  else if (ganchosCorrida.rolou) ganchosCorrida.rolou(m);
  return ok;
}
