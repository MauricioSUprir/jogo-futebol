// Ânimo da torcida (desenho e som): conta PURA (sem three.js nem DOM) que transforma os eventos da
// simulação e a posição da bola em níveis contínuos para a torcida 3D (torcida.js: quem levanta,
// pula, põe a mão na cabeça) e para o som (som.js: murmúrio que sobe perto do gol, "uuuh", explosão do
// gol, apitos). Roda no relógio do DESENHO (não mexe no mundo nem no hash) e é testada em Node
// (tools/teste-torcida.mjs).
//
// Dois grupos de torcedores: k = 0 torce para o time 0 (o Golaço FC, mandante: a maioria do estádio)
// e k = 1 para o time 1 (o setor visitante). Níveis 0–1 por grupo:
//   excita  — explosão (gol do time): todo mundo em pé, braços para cima, pulando; segura ~2,5 s e cai;
//   tensao  — o time ataca perto do gol: a torcida levanta;
//   lamento — chance perdida ou gol sofrido: mãos na cabeça;
//   palmas  — incentivo (defesa do goleiro do time, boa jogada).
// agito (0–1): o barulho geral (o murmúrio sobe quando a bola chega no terço final de qualquer lado; no
// gol da casa vai ao máximo, no gol do visitante cai quase a zero — a casa é a maioria do estádio).
// Disparos (sons de uma vez): {tipo: 'gol'|'uuuh'|'palmas'|'vaia'|'apito'|'apitoIntervalo'|'apitoFim'|'rede'|
// 'chute', grupo, forca} numa fila que o som consome.
// A festa (festa.js: cantos, batucada, vaia, sinalizadores, bandeirão e ola) anda junto: est.festa recebe os mesmos
// eventos e o mesmo passo; est.ultimaReacao (t do último "uuuh"/palmas/vaia/gol) abaixa o leito na mixagem.
import { criarFesta, zerarFesta, festaEvento, festaPasso, festaReacao } from './festa.js';

export const EMOCAO = {
  casa: 0,                // time da casa (maioria da torcida)
  agitoBase: 0.22,        // murmúrio com a bola no meio-campo
  agitoParado: 0.12,      // intervalo e fim
  terco: [10, 40],        // m à frente do meio (rumo ao gol atacado): o murmúrio sobe nesta faixa
  areaX: 36, areaZ: 20,   // dentro da área atacada: mais um degrau
  sobe: 0.7, desce: 1.8,  // s — constante de tempo do agito subindo e descendo
  golSegura: 2.6,         // s de explosão cheia depois do gol
  golCai: 3.5,            // s — e cai com e^(−t/golCai)
  // gol do VISITANTE: a casa (a maioria do estádio) cala — o barulho geral cai para quase nada e só o setor
  // visitante comemora (som.js toca a explosão deles baixa e abafada, longe). Contraprova I4: antes o
  // agito ia ao máximo no gol de qualquer time.
  agitoGolSofrido: 0.06,
  caiGolSofrido: 0.5,     // s — constante de tempo da queda (o silêncio vem rápido)
  tensaoTau: 0.6,         // s
  lamentoTau: 1.8,        // s
  palmasTau: 2.2,         // s
  chanceJanela: 2.6,      // s depois do chute em que defesa/trave/fora contam como chance perdida
  chanceDist: 34,         // m do gol: chute mais longe não é "chance"
  maxDisparos: 16,
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(e0, e1, x) { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }
function aproxima(v, alvo, dt, tau) { return v + (alvo - v) * (1 - Math.exp(-dt / Math.max(1e-3, tau))); }

function grupoNovo() { return { excita: 0, tensao: 0, lamento: 0, palmas: 0, golAte: -1e9, tensaoAte: -1e9, alvoTensao: 0 }; }

export function criarEmocao() {
  const est = {
    t: 0,
    agito: EMOCAO.agitoBase,
    torcida: [grupoNovo(), grupoNovo()],
    disparos: [],
    chute: null,          // {t, grupo, d}: o último chute perigoso
    golT: -1e9,
    contagem: {},         // disparos por tipo (testes e API)
    ultimaReacao: -1e9,   // t do último som de reação (a mixagem abaixa o leito)
    festa: criarFesta(),
  };
  est.disparar = (tipo, grupo, forca) => disparar(est, tipo, grupo, forca);
  return est;
}

/** Volta ao estado calmo (mundo novo). */
export function zerarEmocao(est) {
  const n = criarEmocao();
  est.agito = n.agito; est.torcida = n.torcida; est.disparos.length = 0; est.chute = null; est.golT = -1e9;
  est.ultimaReacao = -1e9;
  zerarFesta(est.festa);
}

const REACOES = { gol: 1, uuuh: 1, palmas: 1, vaia: 1 };

function disparar(est, tipo, grupo, forca) {
  if (est.disparos.length >= EMOCAO.maxDisparos) est.disparos.shift();
  est.disparos.push({ tipo, grupo, forca: clamp(forca, 0, 1), t: est.t });
  est.contagem[tipo] = (est.contagem[tipo] ?? 0) + 1;
  if (REACOES[tipo]) { est.ultimaReacao = est.t; if (est.festa) festaReacao(est.festa, tipo); }
}

/** Distância da bola ao gol que o grupo k ataca (ataca = {0: ±1, 1: ±1}). */
function distGol(bola, ataca, k) {
  const gx = (ataca?.[k] ?? (k === 0 ? 1 : -1)) * 52.5;
  return Math.hypot(bola.x - gx, bola.z);
}

/** Chance perdida do grupo k: "uuuh" proporcional a quão perto foi; a outra torcida aplaude a defesa. */
function chancePerdida(est, k, forca, defesa) {
  const g = est.torcida[k];
  g.lamento = Math.max(g.lamento, 0.55 + 0.45 * forca);
  g.tensao = Math.max(g.tensao, 0.6);
  disparar(est, 'uuuh', k, 0.45 + 0.55 * forca);
  if (defesa) {
    const o = est.torcida[1 - k];
    o.palmas = Math.max(o.palmas, 0.8);
    disparar(est, 'palmas', 1 - k, 0.5 + 0.3 * forca);
  }
  est.chute = null;
}

/**
 * Um evento da simulação (o mesmo objeto de m.eventos) ou do desenho ({tipo: 'redeImpacto', vel}).
 * ctx = {t, timeDe(id) → 0|1|null, bola {x, y, z}, ataca {0: ±1, 1: ±1}, tick0Tempo?, tick?}.
 */
export function emocaoEvento(est, ev, ctx) {
  const t = ctx.t;
  est.t = t;
  const tipo = ev.tipo;
  if (est.festa) festaEvento(est.festa, ev, ctx, est.disparar);
  const recente = est.chute && t - est.chute.t <= EMOCAO.chanceJanela;
  if (tipo === 'gol') {
    const k = ev.time === 1 ? 1 : 0;
    const g = est.torcida[k], o = est.torcida[1 - k];
    g.excita = 1; g.golAte = t + EMOCAO.golSegura; g.lamento = 0; g.tensao = 1;
    o.lamento = 1; o.excita = 0; o.tensao = 0;
    est.golT = t; est.chute = null;
    disparar(est, 'gol', k, 1);
    return;
  }
  if (tipo === 'chute' || tipo === 'cabeceio') {
    const k = ctx.timeDe(ev.id);
    if (k !== 0 && k !== 1) return;
    const d = distGol(ctx.bola, ctx.ataca, k);
    disparar(est, 'chute', k, tipo === 'cabeceio' ? 0.4 : 0.7);
    if (d > EMOCAO.chanceDist) return;
    est.chute = { t, grupo: k, d };
    const g = est.torcida[k];
    g.tensao = Math.max(g.tensao, 0.9); g.tensaoAte = t + 1.5;
    return;
  }
  if (tipo === 'defesa') {
    const kg = ctx.timeDe(ev.id);
    if (kg !== 0 && kg !== 1) return;
    const k = 1 - kg; // quem chutou
    if (recente && est.chute.grupo === k) chancePerdida(est, k, clamp(1 - est.chute.d / EMOCAO.chanceDist, 0, 1) * 0.6 + 0.4, true);
    else { est.torcida[kg].palmas = Math.max(est.torcida[kg].palmas, 0.5); disparar(est, 'palmas', kg, 0.4); }
    return;
  }
  if (tipo === 'trave') {
    // na trave: o "uuuh" mais forte (de quem chutou, ou de quem ataca aquele gol)
    let k = recente ? est.chute.grupo : null;
    if (k == null) { const lado = ctx.bola.x > 0 ? 1 : -1; k = (ctx.ataca?.[0] ?? 1) === lado ? 0 : 1; }
    chancePerdida(est, k, 1, false);
    return;
  }
  if ((tipo === 'fora' || tipo === 'escanteio' || tipo === 'tiroDeMeta') && recente) {
    // bola pela linha de fundo logo depois do chute: chance perdida (mais forte se passou perto da trave)
    const b = ctx.bola;
    if (Math.abs(b.x) > 49) {
      const perto = clamp(1 - (Math.abs(b.z) - 3.66) / 10, 0, 1);
      chancePerdida(est, est.chute.grupo, 0.35 + 0.65 * perto, false);
      return;
    }
  }
  if (tipo === 'escanteio') {
    const k = ev.time === 1 ? 1 : 0;
    const g = est.torcida[k];
    g.tensao = Math.max(g.tensao, 0.7); g.tensaoAte = t + 2.5;
    return;
  }
  if (tipo === 'saida') { disparar(est, 'apito', -1, 0.8); return; }
  if (tipo === 'impedimento' || tipo === 'apito') { disparar(est, 'apito', -1, 0.6); return; }
  if (tipo === 'penaltiMarcado') {
    // pênalti a favor: a torcida de quem vai cobrar fica tensa
    const k = ev.time === 1 ? 1 : 0;
    const g = est.torcida[k];
    g.tensao = Math.max(g.tensao, 0.9); g.tensaoAte = t + 4;
    return;
  }
  if (tipo === 'intervalo') { disparar(est, 'apitoIntervalo', -1, 0.9); return; }
  if (tipo === 'fimDeJogo') {
    disparar(est, 'apitoFim', -1, 1);
    const p = ev.placar ?? [0, 0];
    const casa = EMOCAO.casa;
    if (p[casa] > p[1 - casa]) { est.torcida[casa].excita = 0.9; est.torcida[casa].golAte = t + 3; disparar(est, 'palmas', casa, 1); }
    else if (p[casa] < p[1 - casa]) est.torcida[casa].lamento = 1;
    else disparar(est, 'palmas', casa, 0.5);
    return;
  }
  if (tipo === 'redeImpacto') {
    disparar(est, 'rede', -1, clamp(ev.vel / 25, 0.15, 1));
    return;
  }
  // substituição: na CENA (js/substituicao.js), quem sai cruzou a linha e aplaude — a torcida do time dele aplaude de volta
  // (o evento da simulação, no tick da troca, não traz `cruzou`: as palmas saem no relógio da cena, não antes)
  if (tipo === 'substituicao' && ev.cruzou) {
    const k = ev.time === 1 ? 1 : 0;
    est.torcida[k].palmas = Math.max(est.torcida[k].palmas, 0.7);
    disparar(est, 'palmas', k, 0.6);
  }
}

/**
 * Passo contínuo (dt s do desenho). ctx = {t, bola {x, z}, posseTime 0|1|null, ataca, estado
 * ('jogo'|'parada'|'gol'|'intervalo'|'fim'|null)}.
 */
export function emocaoPasso(est, ctx, dt) {
  est.t = ctx.t;
  if (!(dt > 0)) return;
  const E = EMOCAO;
  // alvo do murmúrio: a bola perto do gol que o time com a bola ataca
  let alvo = E.agitoBase;
  const k = ctx.posseTime;
  let xAvanco = -1e9;
  if (k === 0 || k === 1) {
    const sentido = ctx.ataca?.[k] ?? (k === 0 ? 1 : -1);
    xAvanco = ctx.bola.x * sentido;
    const naArea = xAvanco > E.areaX && Math.abs(ctx.bola.z) < E.areaZ ? 1 : 0;
    alvo = E.agitoBase + (1 - E.agitoBase) * (0.62 * suave(E.terco[0], E.terco[1], xAvanco) + 0.25 * naArea);
  }
  if (ctx.estado === 'intervalo' || ctx.estado === 'fim') alvo = E.agitoParado;
  // gol da CASA: o barulho fica no máximo enquanto a explosão segura; gol do visitante: a casa cala
  let tau = 0;
  if (ctx.t < est.torcida[E.casa].golAte) alvo = 1;
  else if (ctx.t < est.torcida[1 - E.casa].golAte) { alvo = E.agitoGolSofrido; tau = E.caiGolSofrido; }
  est.agito = aproxima(est.agito, alvo, dt, tau || (alvo > est.agito ? E.sobe : E.desce));
  for (let i = 0; i < 2; i++) {
    const g = est.torcida[i];
    if (ctx.t >= g.golAte) g.excita *= Math.exp(-dt / E.golCai);
    if (g.excita < 1e-3) g.excita = 0;
    // levanta com o próprio time chegando ao gol (e segura um pouco depois do chute)
    let alvoT = i === k ? suave(18, 42, xAvanco) : 0;
    if (ctx.t < g.tensaoAte) alvoT = Math.max(alvoT, 0.8);
    if (ctx.estado === 'intervalo' || ctx.estado === 'fim') alvoT = 0;
    g.alvoTensao = alvoT;
    g.tensao = aproxima(g.tensao, Math.max(alvoT, g.excita), dt, E.tensaoTau);
    g.lamento *= Math.exp(-dt / E.lamentoTau);
    g.palmas *= Math.exp(-dt / E.palmasTau);
  }
  if (est.festa) festaPasso(est.festa, est, ctx, dt, est.disparar);
}

/** Esvazia a fila de disparos (o som toca cada um uma vez). Devolve a lista (reaproveitada). */
const _saida = [];
export function consumirDisparos(est) {
  _saida.length = 0;
  for (const d of est.disparos) _saida.push(d);
  est.disparos.length = 0;
  return _saida;
}
