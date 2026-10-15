// Disputa de pênaltis 3D — o modo Pênaltis (pedido do dono de 15/10: "crie uma versão só de jogador de pênaltis" → "modo
// de pênaltis 3d igual ao golaço, só que versão de pênaltis"). PURO: sem three.js nem DOM; só MD e m.rng. Contrato em
// CONTRATOS.md ("Disputa de pênaltis"); constantes em config.js DISPUTA.
//
// O mundo é o da partida (criarPartida: os dois times, o estádio, a mesma simulação) e cada cobrança é a MESMA do pênalti
// da partida (partida.js prepararPenalti + cobrar: o cobrador com a mira e a força pelo CHUTE — cavadinha com dois toques —,
// o goleiro escolhendo o lado antes do chute; o humano pelo analógico). Só muda o que está em volta, pela Regra 10 da IFAB:
//  - todos num gol só (m.disputa.gol, pela moeda); a cada cobrança m.ataca põe o time que bate atacando esse gol;
//  - 5 cobranças alternadas (ABAB) para cada lado, acabando antes quando um não alcança mais o outro; empatou nas 5 →
//    alternadas até um ter mais gols com o mesmo número de cobranças (vencedorDisputa);
//  - cada jogador só bate de novo depois que todos do time bateram (ordemCobradores: os de linha pela finalização, o
//    goleiro por último; a fila dá a volta);
//  - quem começa pela moeda (m.rng; opc.comeca nos testes);
//  - os que esperam ficam no círculo central (duas filas de frente para o gol, o time que começa mais perto), o goleiro do
//    time que bate na linha de fundo onde ela encontra a linha da área (fora dela);
//  - a cobrança acaba quando a bola entra, sai, para ou não pode mais entrar (voltando do gol depois de tocar o goleiro ou
//    a trave) — a bola que bate no goleiro e entra é gol.
// Estados (m.disputa.estado): 'caminhada' (o cobrador entra a DISPUTA.caminhada.dist m da marca — corte de câmera — e anda
// até a bola pela locomoção do jogo: j.guia, o pedido de movimento que o sim.js usa para quem está 'parado'), 'cobranca'
// (a parada do pênalti montada: prepararPenalti), 'chute' (a bola rolou: esperando o fim da cobrança), 'reacao' (o resultado
// saiu: o cobrador volta para o círculo comemorando ou lamentando; DISPUTA.reacao s) e 'fim'. Todos ficam 'parado' (a IA
// não joga); só o goleiro que defende vira 'ia' na montagem (ou o do humano, controlado por ele).
// Eventos: disputaCobrador {time, id, n, k}, apito {motivo: 'cobranca'} (bola pronta), disputaCobranca {time, id,
// resultado: 'gol'|'defesa'|'fora', n, k, placar}, disputaFim {vencedor, placar} e fimDeJogo (a torcida e os treinadores),
// fora os da cobrança (cobrancaPenalti, cobranca, chute, gol, defesa...). m.placar = o placar da disputa.
// Desenho (só lê o mundo; o hash não muda): poseDisputa (os gestos da comemoração por cima da pose: braços para cima no gol,
// mãos na cabeça no erro, o goleiro com o punho na defesa, o time que venceu no fim) e planoCameraDisputa (atrás do
// cobrador, a reação de frente para quem reage, o círculo na abertura e no fim).

import { DISPUTA, PARTIDA, CAMPO, PASSO, BOTAO, BOLA } from './config.js';
import { MD } from './matdet.js';
import { uniforme } from './rng.js';
import { criarBola } from './bola.js';
import { passo, jogadorPorId } from './sim.js';
import { assumirControle } from './acoes.js';
import { criarPartida, bolaMorta, prepararPenalti, cobrar, rolou, teleportar, entradaCobranca } from './partida.js';
import { gesto, cabeca, G_V, G_PUNHO, G_CABECA, G_CINTURA } from './comemoracao.js';

export const ESTADOS_DISPUTA = ['caminhada', 'cobranca', 'chute', 'reacao', 'fim'];
export const RESULTADOS = ['gol', 'defesa', 'fora'];
const seg = s => Math.round(s / PASSO);
const NEUTRA = Object.freeze({ x: 0, z: 0, botoes: 0 });

// ------------------------------------------------------------------------------------ a regra (Regra 10)

/** Time que bate a k-ésima cobrança (0, 1, 2…): ABAB a partir de `primeiro`. */
export function timeDaCobranca(primeiro, k) { return (primeiro + k) % 2; }

/**
 * Vencedor (0 | 1) pelo placar e pelo número de cobranças de cada time, ou null (a disputa segue). Nas `n` primeiras: acaba
 * quando um não alcança mais o outro nem convertendo todas as que faltam; depois delas (alternadas): com o mesmo número de
 * cobranças, quem fez mais gols.
 */
export function vencedorDisputa(placar, chutes, n = DISPUTA.cobrancas) {
  const g0 = placar[0], g1 = placar[1], c0 = chutes[0], c1 = chutes[1];
  if (c0 <= n && c1 <= n) {
    if (g0 > g1 + (n - c1)) return 0;
    if (g1 > g0 + (n - c0)) return 1;
    if (c0 < n || c1 < n) return null;
  }
  if (c0 === c1 && g0 !== g1) return g0 > g1 ? 0 : 1;
  return null;
}

/**
 * Ordem dos cobradores do time `t` (ids): os de linha pela finalização (desempate pelo id), o goleiro por último. A k-ésima
 * cobrança do time é a do índice k % n: ninguém bate a segunda antes de todos baterem a primeira.
 */
export function ordemCobradores(m, t) {
  return m.jogadores.filter(o => o.time === t)
    .sort((a, b) => (a.posicao === 'GOL' ? 1 : 0) - (b.posicao === 'GOL' ? 1 : 0)
      || (b.par.attr.finalizacao ?? 0) - (a.par.attr.finalizacao ?? 0) || a.id - b.id)
    .map(o => o.id);
}

/** Id de quem bate a n-ésima cobrança (0, 1, 2…) de um time com a ordem `ordem`: a fila dá a volta. */
export function cobradorDa(ordem, n) { return ordem[n % ordem.length]; }

function goleiroDe(m, t) {
  for (const o of m.jogadores) if (o.time === t && o.posicao === 'GOL') return o;
  return null;
}

/** Lugar de cada jogador de linha no círculo central: uma fila por time, de frente para o gol. */
function vagasCirculo(m, D) {
  const C = DISPUTA.circulo;
  for (const t of [0, 1]) {
    const fila = D.ordem[t].filter(id => jogadorPorId(m, id)?.posicao !== 'GOL');
    const x = D.gol * C.x[t === D.primeiro ? 0 : 1];
    fila.forEach((id, i) => { D.vagas[id] = { x, z: (i - (fila.length - 1) / 2) * C.passo }; });
  }
}

// ------------------------------------------------------------------------------------ criação

/**
 * Cria a disputa. opc: {semente, elencos, times, humano (o time do humano, 0|1), comeca (força quem bate primeiro: 0|1),
 * gol (força o gol: ±1)}. O mundo é o da partida (criarPartida, sem a trava do Total Match) com m.modo = 'penaltis' e
 * m.disputa; a 1ª cobrança já começa (o cobrador andando para a marca). A moeda (o gol e quem começa) sai do m.rng mesmo com
 * o valor forçado (a mesma semente sorteia o resto igual).
 */
export function criarDisputa(opc = {}) {
  const m = criarPartida({ semente: opc.semente ?? 1, elencos: opc.elencos, times: opc.times, humano: opc.humano, saida: 0 });
  m.modo = 'penaltis';
  m.eventos = [];
  const moedaGol = uniforme(m.rng), moedaPrimeiro = uniforme(m.rng);
  const D = m.disputa = {
    estado: 'caminhada', desde: 0,
    gol: opc.gol === 1 || opc.gol === -1 ? opc.gol : (moedaGol < 0.5 ? 1 : -1),
    primeiro: opc.comeca === 0 || opc.comeca === 1 ? opc.comeca : (moedaPrimeiro < 0.5 ? 0 : 1),
    ordem: { 0: [], 1: [] }, vagas: {},
    cobrancas: [], placar: [0, 0], chutes: [0, 0], vencedor: null,
    vez: null, cobrador: null, goleiro: null, goleiroCobra: null,
    chuteTick: -1, tocou: false, trave: false, ultima: null, alvo: { x: 0, z: 0 },
  };
  for (const t of [0, 1]) D.ordem[t] = ordemCobradores(m, t);
  vagasCirculo(m, D);
  m.placar = { 0: 0, 1: 0 };
  iniciarCobranca(m);
  return m;
}

/**
 * Próxima cobrança: o time da vez ataca o gol da disputa, a bola na marca (bolaMorta: ninguém toca nela), todos 'parado'
 * nos lugares (os que esperam no círculo; o goleiro que defende na linha do gol; o do time que bate na esquina da área) e o
 * cobrador a DISPUTA.caminhada.dist m atrás da marca — corte de câmera: quem já estava no lugar não é teletransportado.
 */
function iniciarCobranca(m) {
  const D = m.disputa, G = D.gol, C = DISPUTA.caminhada;
  const k = D.cobrancas.length, t = timeDaCobranca(D.primeiro, k), n = D.chutes[t];
  const c = jogadorPorId(m, cobradorDa(D.ordem[t], n));
  const gk = goleiroDe(m, 1 - t), gkC = goleiroDe(m, t);
  m.ataca = t === 0 ? { 0: G, 1: -G } : { 0: -G, 1: G };
  const mx = G * (CAMPO.meioX - CAMPO.marcaPenalti);
  bolaMorta(m, 'penalti', t, mx, 0);
  Object.assign(m.bola, criarBola(mx, 0));
  m.partida.estado = 'parada'; m.partida.desde = m.tick;
  m.partida.penaltiAberto = null;
  const rumoGol = G > 0 ? 0 : Math.PI;
  for (const j of m.jogadores) {
    j.papel = 'parado'; j.guia = null; j.palpite = null;
    j.carga = null; j.pedido = null; j.mira = null; j.miraAuto = null; j.iaAcao = null;
    let x, z, r, sempre = false;
    if (j === c) {
      const s = k % 2 ? -1 : 1;
      x = mx - G * C.dist; z = s * C.lado; r = MD.atan2(-z, mx - x); sempre = true;
    } else if (j === gk) {
      x = G * (CAMPO.meioX - 0.3); z = 0; r = G > 0 ? Math.PI : 0; sempre = true;
    } else if (j === gkC) {
      x = G * (CAMPO.meioX - 0.45); z = -(CAMPO.area.largura / 2 + DISPUTA.esquina); r = MD.atan2(-z, mx - x); sempre = true;
    } else {
      const v = D.vagas[j.id];
      if (!v) continue;
      x = v.x; z = v.z; r = rumoGol;
    }
    if (sempre || MD.hypot(j.x - x, j.z - z) > 0.25 || Math.abs(j.vx) + Math.abs(j.vz) > 0.05) teleportar(j, x, z, r);
  }
  // o humano controla o cobrador do time dele ou o goleiro dele (os botões da vez: a montagem confirma)
  const h = m.timeHumano ?? 0;
  if (m.humanos.includes(h)) {
    const novo = t === h ? c : gk;
    if (novo && m.controlado[h] !== novo.id) assumirControle(m, h, novo);
  }
  D.estado = 'caminhada'; D.desde = m.tick;
  D.vez = t; D.cobrador = c.id; D.goleiro = gk ? gk.id : null; D.goleiroCobra = gkC && gkC !== c ? gkC.id : null;
  D.chuteTick = -1; D.tocou = false; D.trave = false;
  // o ponto em que ele para: 0,4 m atrás da bola, de frente para o gol (o mesmo de partida.js cobradorNoPonto)
  D.alvo.x = mx - G * 0.4; D.alvo.z = 0;
  m.eventos.push({ tipo: 'disputaCobrador', time: t, id: c.id, n: n + 1, k });
}

/** O pedido de movimento de quem anda guiado até (x, z): `vel` m/s freando a `freio` m/s²; no fim, virado para `rumo`. */
function guiar(j, x, z, vel, freio, rumo) {
  const dx = x - j.x, dz = z - j.z, d = MD.hypot(dx, dz);
  const v = Math.min(vel, Math.sqrt(2 * freio * Math.max(0, d - 0.02)));
  const g = j.guia ?? (j.guia = { dx: 1, dz: 0, vel: 0, rumoAlvo: j.rumo });
  if (d > 1e-6) { g.dx = dx / d; g.dz = dz / d; }
  g.vel = d < 0.03 ? 0 : v;
  g.rumoAlvo = d > 0.8 ? MD.atan2(dz, dx) : rumo;
  return d;
}

/** Caminhada: o cobrador anda até a bola; chegou (ou passou do tempo), a cobrança é montada. */
function caminhar(m) {
  const D = m.disputa, C = DISPUTA.caminhada;
  const c = jogadorPorId(m, D.cobrador);
  if (!c) return;
  const d = guiar(c, D.alvo.x, D.alvo.z, C.vel, C.freio, D.gol > 0 ? 0 : Math.PI);
  if ((d <= C.chegou && MD.hypot(c.vx, c.vz) < 0.4) || m.tick - D.desde >= seg(C.max)) montarCobranca(m);
}

/** A parada do pênalti montada (partida.js prepararPenalti): o goleiro que defende volta a ser 'ia' (ou o do humano). */
function montarCobranca(m) {
  const D = m.disputa;
  const c = jogadorPorId(m, D.cobrador), gk = D.goleiro != null ? jogadorPorId(m, D.goleiro) : null;
  c.guia = null;
  if (gk) gk.papel = 'ia';
  prepararPenalti(m, c, gk);
  const pr = m.parada;
  // o humano tem DISPUTA.esperaHumano s a mais para bater (a cobrança da partida conta desde a bola morta)
  pr.inicio = m.tick + seg(DISPUTA.esperaHumano);
  // a força da IA na disputa (o mesmo sorteio, na faixa DISPUTA.forcaIA) e a bola pronta mais cedo (ele já andou até ela)
  const W = PARTIDA.penaltiIA.forca, F = DISPUTA.forcaIA;
  pr.forca = F[0] + (F[1] - F[0]) * (pr.forca - W[0]) / (W[1] - W[0]);
  pr.pronta = Math.min(pr.pronta, m.tick + seg(DISPUTA.pronta));
  D.estado = 'cobranca'; D.desde = m.tick;
}

// ------------------------------------------------------------------------------------ passo

const _e = { x: 0, z: 0, botoes: 0, repete: false, ia: false, iaCobra: false };
/** A entrada do humano na cobrança: quem bate só tem o analógico e o CHUTE; o goleiro só o analógico. */
function entradaDaVez(m, e) {
  const D = m.disputa, h = m.timeHumano ?? 0;
  _e.x = e?.x ?? 0; _e.z = e?.z ?? 0;
  _e.botoes = D.vez === h ? ((e?.botoes ?? 0) | 0) & BOTAO.CHUTE : 0;
  _e.repete = !!e?.repete; _e.ia = !!e?.ia; _e.iaCobra = !!e?.iaCobra;
  return _e;
}

/**
 * Um passo da disputa (1/60 s). entrada = {x, z, botoes} do humano (do time m.timeHumano): só vale com a cobrança montada
 * (o cobrador dele: analógico + CHUTE; o goleiro dele: analógico); na caminhada, na reação e no fim ele assiste. Devolve os
 * eventos do passo.
 */
export function passoDisputa(m, entrada) {
  const D = m.disputa;
  m.eventos = [];
  if (D.estado === 'caminhada') caminhar(m);
  let e = NEUTRA;
  if (D.estado === 'cobranca') {
    e = entradaDaVez(m, entrada);
    cobrar(m, e);
  }
  const ev0 = m.eventos;
  passo(m, { [m.timeHumano ?? 0]: e });
  if (ev0.length) m.eventos = ev0.concat(m.eventos);
  regrasDisputa(m);
  return m.eventos;
}

/** Depois do passo: a cobrança montada (apito, bola no ponto, rolou), o fim da cobrança, a reação e o fim. */
function regrasDisputa(m) {
  const D = m.disputa;
  if (D.estado === 'cobranca') {
    const pr = m.parada;
    if (pr && !pr.rolou) {
      if (m.tick === pr.pronta) m.eventos.push({ tipo: 'apito', motivo: 'cobranca' });
      const b = m.bola;
      const saiu = MD.hypot(b.p.x - pr.x, b.p.z - pr.z) > 0.6;
      if (m.posse !== pr.cobrador || m.voo || saiu || m.tick - pr.inicio > seg(PARTIDA.paradaMax)) rolou(m);
      else {
        // a bola fica no ponto até a cobrança (como na partida: regrasPartida)
        b.p.x = pr.x; b.p.z = pr.z; b.p.y = BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
      }
    }
    if (!m.parada || m.parada.rolou) { D.estado = 'chute'; D.desde = m.tick; D.chuteTick = m.tick; }
  } else if (D.estado === 'chute') {
    const res = fimDaCobranca(m);
    if (res) concluir(m, res);
  } else if (D.estado === 'reacao') {
    segurarBolaNaMao(m);
    const u = D.ultima, c = jogadorPorId(m, u.id);
    const R = DISPUTA.reacao, gol = u.resultado === 'gol';
    if (c) {
      // volta para o lugar dele no círculo (o goleiro que bateu, para o meio do campo): trotando no gol, andando no erro
      const v = D.vagas[c.id] ?? { x: D.gol * 2, z: 0 };
      guiar(c, v.x, v.z, gol ? R.trote : R.anda, 2.5, D.gol > 0 ? 0 : Math.PI);
    }
    if (m.tick - D.desde >= seg(gol ? R.gol : R.erro)) {
      if (D.vencedor != null) terminar(m); else iniciarCobranca(m);
    }
  } else if (D.estado === 'fim') {
    segurarBolaNaMao(m);
  }
  m.placar[0] = D.placar[0]; m.placar[1] = D.placar[1];
}

/** O goleiro com a bola nas mãos depois da cobrança não repõe (a IA reporia em 1,5 s): fica com ela até a próxima. */
function segurarBolaNaMao(m) {
  if (m.naMao == null) return;
  const g = jogadorPorId(m, m.naMao);
  if (g) { if (g.segura) g.segura.desde = m.tick; g.pedido = null; g.carga = null; }
}

/**
 * Fim da cobrança (Regra 10): 'gol' (entrou, também depois de tocar o goleiro ou a trave), 'defesa' (o goleiro tocou e ela
 * não entrou) ou 'fora' (não entrou sem o goleiro tocar: para fora, na trave); null enquanto ela ainda pode entrar.
 */
function fimDaCobranca(m) {
  const D = m.disputa, F = DISPUTA.fimChute, G = D.gol, gk = D.goleiro;
  let outro = false, gol = false;
  for (const e of m.eventos) {
    if (e.tipo === 'gol') gol = true;
    else if ((e.tipo === 'defesa' || e.tipo === 'goleiroBatido' || e.tipo === 'bateuCorpo') && e.id === gk) D.tocou = true;
    else if (e.tipo === 'bateuCorpo') outro = true;
    else if (e.tipo === 'trave') D.trave = true;
  }
  if (m.ultimoToque && m.ultimoToque.id === gk && m.ultimoToque.tick >= D.chuteTick) D.tocou = true;
  if (gol) return 'gol';
  if (m.naMao != null && m.naMao === gk) return 'defesa';
  const semGol = D.tocou ? 'defesa' : 'fora';
  if (outro) return semGol;
  const b = m.bola, dt = (m.tick - D.chuteTick) * PASSO;
  const R = BOLA.raio;
  const fora = Math.abs(b.p.x) > CAMPO.meioX + R || Math.abs(b.p.z) > CAMPO.meioZ + R;
  const volta = (D.tocou || D.trave) && b.v.x * G < -F.volta && CAMPO.meioX - b.p.x * G > F.longe;
  const parada = dt > F.minimo && MD.hypot(b.v.x, MD.hypot(b.v.y, b.v.z)) < F.parada && b.p.y < 0.3;
  if (fora || volta || parada || dt > F.max) return semGol;
  return null;
}

/** O resultado da cobrança: placar, a lista, o vencedor (se já saiu) e a reação. */
function concluir(m, res) {
  const D = m.disputa, t = D.vez;
  const n = ++D.chutes[t];
  if (res === 'gol') D.placar[t]++;
  const k = D.cobrancas.length;
  const c = { time: t, id: D.cobrador, resultado: res, n, k };
  D.cobrancas.push(c);
  D.ultima = c;
  m.partida.penaltiAberto = null;
  for (const o of m.jogadores) if (o.palpite != null) o.palpite = null;
  D.vencedor = vencedorDisputa(D.placar, D.chutes);
  D.estado = 'reacao'; D.desde = m.tick;
  m.eventos.push({ tipo: 'disputaCobranca', time: t, id: c.id, resultado: res, n, k, placar: [D.placar[0], D.placar[1]] });
}

/** Fim da disputa: todos param, eventos disputaFim e fimDeJogo (o apito final, a torcida, os treinadores). */
function terminar(m) {
  const D = m.disputa;
  D.estado = 'fim'; D.desde = m.tick;
  m.partida.estado = 'fim'; m.partida.desde = m.tick;
  for (const j of m.jogadores) { j.guia = null; j.papel = 'parado'; }
  m.eventos.push({ tipo: 'disputaFim', vencedor: D.vencedor, placar: [D.placar[0], D.placar[1]] },
    { tipo: 'fimDeJogo', placar: { 0: D.placar[0], 1: D.placar[1] } });
}

/**
 * Demonstração/testes: a IA joga pelo humano — bate pelo cobrador dele (a mesma entrada da cobrança da IA, `iaCobra`) e,
 * defendendo, o goleiro dele vai para o lado sorteado na montagem (o analógico para esse lado; `ia`: a IA decide o resto).
 */
export function entradaDemoDisputa(m) {
  const D = m.disputa, pr = m.parada;
  const j = jogadorPorId(m, m.controlado[m.timeHumano ?? 0]);
  if (D.estado === 'cobranca' && pr && !pr.rolou && j) {
    if (pr.cobrador === j.id) { const c = entradaCobranca(m, j); return { x: c.x, z: c.z, botoes: c.botoes, iaCobra: true }; }
    if (j.id === D.goleiro) return { x: 0, z: Math.sign(pr.palpite ?? 0), botoes: 0, ia: true };
  }
  return { x: 0, z: 0, botoes: 0, ia: true };
}

/** Resumo para o desenho, os testes e o Total Match (cópias). */
export function resumoDisputa(m) {
  const D = m.disputa;
  if (!D) return null;
  return {
    estado: D.estado, gol: D.gol, primeiro: D.primeiro, vez: D.vez, cobrador: D.cobrador, goleiro: D.goleiro,
    placar: [D.placar[0], D.placar[1]], chutes: [D.chutes[0], D.chutes[1]], vencedor: D.vencedor,
    cobrancas: D.cobrancas.map(c => ({ ...c })), ordem: { 0: D.ordem[0].slice(), 1: D.ordem[1].slice() },
  };
}

/**
 * O resultado da disputa no contrato do Total Match (ponte-tm.js 'tm3d:fim'; CONTRATOS.md "Ponte com o Total Match"):
 * {penaltis: {vencedor: 0|1, placar: [casa, fora], cobrancas: [{lado, tmId, nome, resultado}]}} — o lado 0 é o mandante
 * do TM (o time 0 do mundo); mapa = {id: {tmId, nome}} (tm-times.js); sem ele, tmId null e o nome da ficha. Sem placar
 * do jogo (o TM decide o que fazer com ele). null antes do fim.
 */
export function resultadoPenaltisTM(m, mapa = null, nomeDe = null) {
  const D = m.disputa;
  if (!D || D.vencedor == null || D.estado !== 'fim') return null;
  return {
    penaltis: {
      vencedor: D.vencedor, placar: [D.placar[0], D.placar[1]],
      cobrancas: D.cobrancas.map(c => ({
        lado: c.time, tmId: mapa?.[c.id]?.tmId ?? null, nome: mapa?.[c.id]?.nome ?? (nomeDe ? nomeDe(c.id) : String(c.id)),
        resultado: c.resultado,
      })),
    },
  };
}

// ------------------------------------------------------------------------------------ desenho (só lê o mundo)

function suave(t) { t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); }

/**
 * Gestos da disputa por cima da pose do passo `o` de j (a pose do anim.js; os gestos e a cabeça da comemoração.js, por IK):
 * na reação, o cobrador com os braços para cima (gol) ou as mãos na cabeça (erro), o goleiro com o punho fechado (defesa)
 * ou as mãos na cintura (gol), os companheiros do círculo com um braço para cima no gol; no fim, o time que venceu com os
 * braços para cima (pulando) e o outro com as mãos na cintura e a cabeça baixa. Só desenho: o hash não muda.
 */
export function poseDisputa(m, j, o) {
  const D = m.disputa;
  if (!D || !o) return;
  const t = (m.tick - D.desde) * PASSO, h = j.rumo;
  const naMao = m.naMao === j.id;
  if (D.estado === 'reacao' && D.ultima) {
    const u = D.ultima, gol = u.resultado === 'gol';
    const dur = gol ? DISPUTA.reacao.gol : DISPUTA.reacao.erro;
    const w = suave(t / 0.3) * (1 - suave((t - dur + 0.35) / 0.35));
    if (w <= 0) return;
    if (j.id === u.id) {
      if (gol) { gesto(o, h, -1, G_V, null, 0, w); gesto(o, h, 1, G_V, null, 0, w); cabeca(o, h, -0.5 * w); }
      else { gesto(o, h, -1, G_CABECA, null, 0, w); gesto(o, h, 1, G_CABECA, null, 0, w); cabeca(o, h, 0.8 * w); }
    } else if (j.id === D.goleiro && !naMao) {
      if (gol) { gesto(o, h, -1, G_CINTURA, null, 0, w); gesto(o, h, 1, G_CINTURA, null, 0, w); cabeca(o, h, 0.6 * w); }
      else { gesto(o, h, 1, G_PUNHO, null, 0, w, 0.12 * Math.sin(t * 11)); cabeca(o, h, -0.4 * w); }
    } else if (gol && j.time === u.time && D.vagas[j.id] && j.id % 2 === 0) {
      gesto(o, h, j.id % 4 ? -1 : 1, G_PUNHO, null, 0, w * 0.9, 0.1 * Math.sin(t * 9 + j.id));
    }
    return;
  }
  if (D.estado === 'fim' && D.vencedor != null && !naMao) {
    const w = suave(t / 0.4);
    if (j.time === D.vencedor) {
      const dy = 0.07 * Math.sin(t * 8 + j.id * 1.7);
      gesto(o, h, -1, G_V, null, 0, w, dy); gesto(o, h, 1, G_V, null, 0, w, -dy); cabeca(o, h, -0.4 * w);
    } else {
      gesto(o, h, -1, G_CINTURA, null, 0, w); gesto(o, h, 1, G_CINTURA, null, 0, w); cabeca(o, h, 0.7 * w);
    }
  }
}

/** Rumo da câmera no chão (o analógico vira mundo por ele): a câmera da cobrança olha para o gol da disputa. */
export function yawDisputa(m) { return (m.disputa?.gol ?? 1) > 0 ? 0 : Math.PI; }

/**
 * Plano da câmera de cinema da disputa (camera.js definirCinema: corte quando o nome muda): {nome, de: [x,y,z], para:
 * [x,y,z], fov}. 'abertura' (o 1º segundo e meio: o círculo central com os dois times) e 'fim' — o círculo; 'cobranca' —
 * atrás e acima do cobrador, o gol e o goleiro no quadro (a caminhada, a cobrança e o chute); 'reacao' — de frente para
 * quem reage (o cobrador voltando ao círculo; o goleiro na defesa), a câmera andando com ele. pos(id) = a posição
 * desenhada (interpolada) de um jogador; sem ela, a do passo. Escreve em `out` (sem alocar).
 */
export function planoCameraDisputa(m, out, pos = null) {
  const D = m.disputa, G = D.gol, MX = CAMPO.meioX, mk = MX - CAMPO.marcaPenalti;
  out.de ??= [0, 0, 0]; out.para ??= [0, 0, 0];
  const abertura = D.cobrancas.length === 0 && D.estado === 'caminhada' && m.tick - D.desde < seg(1.6);
  if (abertura || D.estado === 'fim') {
    out.nome = abertura ? 'abertura' : 'fim';
    // (no fim, o círculo na metade de baixo do quadro: a faixa do resultado fica no meio da tela)
    out.de[0] = G * -13; out.de[1] = abertura ? 6.5 : 5.2; out.de[2] = 15;
    out.para[0] = G * 1.2; out.para[1] = abertura ? 1.0 : 3.2; out.para[2] = 0;
    out.fov = 30;
    return out;
  }
  if (D.estado === 'reacao' && D.ultima) {
    const foco = D.ultima.resultado === 'defesa' && D.goleiro != null ? D.goleiro : D.ultima.id;
    const j = jogadorPorId(m, foco);
    if (j) {
      const p = pos ? pos(foco) : null;
      const x = p ? p.x : j.x, z = p ? p.z : j.z;
      out.nome = 'reacao';
      if (foco === D.goleiro) {
        out.de[0] = G * (MX - 6.5); out.de[1] = 1.7; out.de[2] = z + 2.6;
        out.para[0] = x; out.para[1] = 1.0; out.para[2] = z;
      } else {
        out.de[0] = x - G * 4.6; out.de[1] = 1.8; out.de[2] = z + 2.0;
        out.para[0] = x; out.para[1] = 1.35; out.para[2] = z;
      }
      out.fov = 30;
      return out;
    }
  }
  out.nome = 'cobranca';
  out.de[0] = G * (mk - 15); out.de[1] = 4.0; out.de[2] = 1.2;
  out.para[0] = G * (MX - 2.5); out.para[1] = 0.7; out.para[2] = 0;
  out.fov = 22;
  return out;
}
