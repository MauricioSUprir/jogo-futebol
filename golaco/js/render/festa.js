// Festa da torcida (desenho e som): AGENDA PURA (sem three.js nem DOM) do que a arquibancada faz além do ânimo
// de emocao.js — os CANTOS (qual canto, quando entra e quando sai), a BATUCADA da organizada, a VAIA, os
// SINALIZADORES, o BANDEIRÃO e a OLA. Roda no relógio do DESENHO (como emocao.js: nada do mundo nem do hash), com
// um gerador próprio (mulberry32 de semente fixa). emocao.js chama festaEvento/festaPasso; som.js toca os cantos e
// a vaia (mixagem.js dá os ganhos), torcida.js desenha a ola, bandeiras.js o bandeirão e sinalizadores.js os
// sinalizadores. Testada em Node (tools/teste-torcida.mjs).
//
// Referências (PESQUISA-ESTADIO.md §6): as camadas da torcida do FIFA (base gravada + reações + cantos numa camada
// própria; TV Technology sobre o FIFA 10) e a operação "tipo DJ" de quem fez a torcida das transmissões (um botão
// por lance + um fader de intensidade; Sound Particles/Paul Boechler) — aqui o fader é o ânimo e os botões são os
// eventos; pirotecnia só em momento marcado (entrada dos times, gol), nunca com a bola rolando (FIFA 17); a ola de
// Farkas, Helbing e Vicsek (Nature 419, 2002): ~12 m/s, largura de 6–12 m, quase sempre no sentido horário,
// começa quando a torcida está calma.

export const FESTA = {
  semente: 20261011,
  casa: 0,                     // o time da casa (a maioria do estádio; o mesmo de EMOCAO.casa)
  cantos: {
    // papel de cada clipe de canto (som.js SOM.cantos traz os arquivos NA MESMA ORDEM): 'geral' (qualquer hora),
    // 'incentivo' (a casa atacando) e 'festa' (depois do gol da casa e na vitória). O setor visitante canta o
    // clipe `visitante` (abafado e do lado esquerdo da TV) depois do gol deles.
    papeis: ['geral', 'geral', 'incentivo', 'festa'],
    visitante: 1,
    dur: [16, 34],             // s cantando (sorteado)
    pausa: [7, 13],            // s de pausa entre dois cantos: canta ~2/3 do tempo calmo
    primeiro: [1.5, 3],        // s até o primeiro canto
    entra: 2.5, sai: 2.0,      // s — o canto cresce em 2,5 s e some em 2 s
    incentivo: 22,             // m à frente do meio (rumo ao gol atacado): a casa atacando puxa o canto de incentivo
    festaDur: 32,              // s de canto de festa depois do gol da casa
    golCorta: 0.35,            // s — o gol corta o canto que estava tocando (o grito toma conta)
    golVolta: 5,               // s depois do gol: entra o canto de festa (ou o do setor visitante)
    visitanteDur: 20,          // s de canto do setor visitante depois do gol deles
    reacaoAbaixa: 0.45,        // nível do canto logo depois de uma reação ("uuuh", palmas, vaia)…
    reacaoTau: 1.8,            // …que volta com esta constante de tempo (s)
  },
  // a batucada da organizada: forte com a casa cantando, baixinha no resto (uma organizada quase nunca para)
  batucada: { cantando: 1, resto: 0.3, tau: 1.2 },
  // vaia da casa: o visitante segura a bola perto da área da casa por `segura` s; depois espera `pausa` s
  vaia: { segura: 15, dist: 32, pausa: 30, esvazia: 2 },
  // sinalizadores: só em momento marcado (saída de cada tempo, gol, vitória no fim) — nunca com a bola rolando
  sinalizadores: {
    max: 8,                    // no máximo 8 acesos (uniform vec4[8] da luz falsa)
    dur: [22, 28],             // s acesos (o fogo); a fumaça ainda sobe uns segundos depois
    saida: 6, gol: 5, golVisitante: 2, vitoria: 6,
    atrasoGol: 1.2,            // s depois do gol (o torcedor acende)
    escalona: 0.35,            // s entre um e outro (não acendem todos no mesmo quadro)
  },
  bandeirao: { saida: 16, gol: 18, atrasoGol: 1.5, abre: 2.5, fecha: 2.5 },
  // ola: torcida calma (agito < calmoAgito) por `calmo` s seguidos; no máximo 1 a cada `intervalo` s
  ola: { calmo: 40, intervalo: 180, calmoAgito: 0.3, vel: 0.2, largura: 0.16, voltas: 1.25, inicio: -2.2 },
};

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function suave(x) { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); }
function geradorFesta(semente) {
  let a = semente >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const entre = (r, [a, b]) => a + (b - a) * r();

// Pontos de onde saem os sinalizadores (x, y, z na base do torcedor; o fogo fica 1,9 m acima): a organizada (fundo +x,
// fileiras 2–7 da frente), as quinas do lado de lá e o setor visitante (fundo −x). Medidas de torcida-dados.js
// ARQUIBANCADA (frente do fundo em x = ±62,5, degrau 26 m × 15,6 m; lado de lá em z = −44,5, 30 m × 18,6 m).
const ORG = [[64.6, 2.6, -12], [65.2, 3.0, -4], [64.2, 2.3, 5], [65.8, 3.4, 13], [64.9, 2.8, -16.5], [65.5, 3.2, 9]];
const QUINAS = [[-47, 2.6, -46.6], [48, 3.0, -47.2], [-36, 2.4, -46.2], [37, 2.8, -46.9], [-55, 3.2, -47.5], [56, 2.6, -46.4]];
const VISIT = [[-64.6, 2.6, -8], [-65.2, 3.0, 6]];
export const PONTOS_SINALIZADOR = { organizada: ORG, quinas: QUINAS, visitante: VISIT };

export function criarFesta(semente = FESTA.semente) {
  return {
    rnd: geradorFesta(semente),
    t: 0,
    // cantos: fase 'pausa' até `ate`, ou 'cantando' o clipe `clipe` de `t0` até `ate`; lado 0 = casa, 1 = visitante
    canto: { fase: 'pausa', clipe: -1, lado: 0, t0: 0, ate: -1, ultimo: -1, proximo: -1, papel: null, reacao: 1, festaAte: -1e9, visitanteDe: -1e9, cantados: [] },
    batucada: 0,
    vaia: { acum: 0, ultima: -1e9, n: 0 },
    // sinalizadores: vagas fixas (nada alocado por quadro)
    flares: Array.from({ length: FESTA.sinalizadores.max }, () => ({ ativo: false, t0: 0, dur: 0, x: 0, y: 0, z: 0, cor: 0, semente: 0 })),
    acesos: 0,                 // quantas vezes acendeu (testes)
    bandeirao: { t0: -1e9, t1: -1e9, n: 0 },
    ola: { calmo: 0, ultima: -1e9, t0: -1e9, ativa: false, n: 0 },
    golT: -1e9, inicioTempo: 0, primeiroSaida: true,
  };
}

/** Volta ao começo (mundo novo): a mesma semente, tudo apagado. */
export function zerarFesta(f) { Object.assign(f, criarFesta()); }

// ------------------------------------------------------------------ cantos

function escolherClipe(f, papel) {
  const C = FESTA.cantos, r = f.rnd;
  const ok = [];
  for (let k = 0; k < C.papeis.length; k++) if (C.papeis[k] === papel) ok.push(k);
  if (papel === 'geral') for (let k = 0; k < C.papeis.length; k++) if (C.papeis[k] === 'incentivo' && r() < 0.35) ok.push(k);
  const sem = ok.filter(k => k !== f.canto.ultimo);
  const lista = sem.length ? sem : ok;
  return lista.length ? lista[Math.floor(r() * lista.length) % lista.length] : 0;
}

function comecarCanto(f, clipe, lado, dur, papel) {
  const c = f.canto;
  c.fase = 'cantando'; c.clipe = clipe; c.lado = lado; c.t0 = f.t; c.ate = f.t + dur; c.saiDur = FESTA.cantos.sai; c.papel = papel;
  c.ultimo = clipe; c.proximo = -1;
  if (c.cantados.length < 64) c.cantados.push(clipe + (lado ? 100 : 0));
}

function pausarCanto(f, dur) {
  const c = f.canto;
  c.fase = 'pausa'; c.t0 = f.t; c.ate = f.t + dur;
  // o próximo (o som já decodifica): o de sempre; na hora de começar o contexto pode trocar
  c.proximo = escolherClipe(f, 'geral');
}

/** Corta o canto que toca: some em `dur` s (o gol, o intervalo, o fim). */
function cortarCanto(f, dur) {
  const c = f.canto;
  if (c.fase !== 'cantando' && c.fase !== 'cantando-fim') return;
  if (c.ate > f.t + dur) { c.ate = f.t + dur; c.saiDur = dur; }
}

/** Nível 0–1 do canto agora (entrada, saída e o recuo depois de uma reação). */
export function nivelCanto(f, t = f.t) {
  const c = f.canto, C = FESTA.cantos;
  if ((c.fase !== 'cantando' && c.fase !== 'cantando-fim') || c.clipe < 0 || t >= c.ate) return 0;
  const e = suave((t - c.t0) / C.entra) * suave((c.ate - t) / (c.saiDur || C.sai));
  return e * c.reacao;
}

// ------------------------------------------------------------------ sinalizadores

function acender(f, pontos, n, cor, atraso) {
  const S = FESTA.sinalizadores, r = f.rnd;
  const ord = pontos.map((p, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  let k = 0;
  for (const i of ord) {
    if (k >= n) break;
    // a vaga livre (ou a que apaga primeiro)
    let v = f.flares.find(s => !s.ativo || f.t > s.t0 + s.dur + 12);
    if (!v) v = f.flares.reduce((a, b) => (a.t0 + a.dur < b.t0 + b.dur ? a : b));
    const p = pontos[i];
    Object.assign(v, { ativo: true, t0: f.t + atraso + k * S.escalona, dur: entre(r, S.dur), x: p[0] + (r() - 0.5) * 1.2, y: p[1], z: p[2] + (r() - 0.5) * 1.2, cor, semente: r() });
    k++;
  }
  f.acesos += k;
}

/**
 * Intensidade 0–1 do fogo de um sinalizador agora (acende em 0,6 s, cintila, apaga no último 1,5 s) — a mesma
 * conta da luz falsa (torcida.js, campo.js) e do núcleo (sinalizadores.js).
 */
export function fogoSinalizador(s, t) {
  if (!s.ativo) return 0;
  const a = t - s.t0;
  if (a < 0 || a > s.dur) return 0;
  const e = clamp(a / 0.6, 0, 1) * clamp((s.dur - a) / 1.5, 0, 1);
  const cint = 0.82 + 0.1 * Math.sin(a * 31 + s.semente * 40) + 0.08 * Math.sin(a * 13.7 + s.semente * 17);
  return e * cint;
}

// ------------------------------------------------------------------ bandeirão e ola

function abrirBandeirao(f, atraso, dur) {
  const b = f.bandeirao, t0 = f.t + atraso;
  if (t0 < b.t1) { b.t1 = Math.max(b.t1, t0 + dur); return; } // já aberto: só estica
  b.t0 = t0; b.t1 = t0 + dur; b.n++;
}

/** Quanto o bandeirão está aberto (0 enrolado, 1 aberto) agora. */
export function aberturaBandeirao(f, t = f.t) {
  const b = f.bandeirao, B = FESTA.bandeirao;
  if (t < b.t0 || t > b.t1) return 0;
  return suave((t - b.t0) / B.abre) * suave((b.t1 - t) / B.fecha);
}

/** Ola agora: {ativa, theta (rad, ângulo da crista em volta do centro: atan2(z, x)), largura (rad), forca 0–1}. */
const _ola = { ativa: false, theta: 0, largura: FESTA.ola.largura, forca: 0 };
export function estadoOla(f, t = f.t) {
  const o = f.ola, O = FESTA.ola;
  const dur = O.voltas * 2 * Math.PI / O.vel;
  const a = t - o.t0;
  if (!(a >= 0 && a <= dur)) { _ola.ativa = false; _ola.forca = 0; return _ola; }
  _ola.ativa = true;
  _ola.theta = O.inicio + O.vel * a;            // sentido horário visto de cima (θ = atan2(z, x) crescendo)
  _ola.largura = O.largura;
  _ola.forca = suave(a / 3) * suave((dur - a) / 4);
  return _ola;
}

/** Peso 0–1 da ola num torcedor em (x, z): 1 na crista. A MESMA conta de OLA_GLSL (o vertex shader). */
export function olaPeso(x, z, ola) {
  if (!ola || !ola.ativa || ola.forca <= 0) return 0;
  const th = Math.atan2(z, x);
  let d = th - ola.theta;
  d -= 2 * Math.PI * Math.floor(d / (2 * Math.PI) + 0.5);   // −π…π
  const w = 1 - clamp(Math.abs(d) / ola.largura, 0, 1);
  return w * w * (3 - 2 * w) * ola.forca;
}
const gl = v => (Number.isInteger(v) ? v.toFixed(1) : String(v));
/** float torcidaOla(vec2 xz, vec4 ola) — ola = (theta, largura, forca, ativa 0/1). */
export const OLA_GLSL = `
float torcidaOla(vec2 xz, vec4 ola) {
  if (ola.w < 0.5 || ola.z <= 0.0) return 0.0;
  float th = atan(xz.y, xz.x);
  float d = th - ola.x;
  d -= ${gl(2 * Math.PI)} * floor(d / ${gl(2 * Math.PI)} + 0.5);
  float w = 1.0 - clamp(abs(d) / ola.y, 0.0, 1.0);
  return w * w * (3.0 - 2.0 * w) * ola.z;
}
`;

// ------------------------------------------------------------------ eventos e passo

/**
 * Um evento da simulação (o mesmo de m.eventos) — ctx como em emocao.js; emocao (o estado de emocao.js) para
 * pedir a vaia pela fila de disparos (disparar(tipo, grupo, forca)).
 */
export function festaEvento(f, ev, ctx, disparar) {
  f.t = ctx.t;
  const C = FESTA.cantos, S = FESTA.sinalizadores, B = FESTA.bandeirao;
  const casa = FESTA.casa;
  switch (ev.tipo) {
    case 'gol': {
      const k = ev.time === 1 ? 1 : 0;
      f.golT = f.t;
      // o gol corta o canto (o grito toma conta) e, passado o grito, vem o de festa (ou o do setor visitante)
      const c = f.canto;
      cortarCanto(f, C.golCorta);
      if (c.fase === 'pausa') c.ate = f.t;
      c.fase = 'cantando-fim';
      if (k === casa) {
        c.festaAte = f.t + C.golVolta + C.festaDur;
        acender(f, ORG.concat(QUINAS.slice(0, 2)), S.gol, 0, S.atrasoGol);
        abrirBandeirao(f, B.atrasoGol, B.gol);
      } else {
        c.visitanteDe = f.t + C.golVolta;
        acender(f, VISIT, S.golVisitante, 1, S.atrasoGol);
      }
      c.proximaEm = f.t + C.golVolta;
      return;
    }
    case 'saida': {
      // saída do começo de cada tempo (não a de depois do gol): sinalizadores e bandeirão
      if (f.primeiroSaida || f.t - f.golT > 15) {
        f.primeiroSaida = false;
        f.inicioTempo = f.t;
        acender(f, ORG.concat(QUINAS), S.saida, 0, 0);
        abrirBandeirao(f, 0, B.saida);
      }
      return;
    }
    case 'intervalo': {
      cortarCanto(f, C.sai);
      f.primeiroSaida = true; // a próxima saída é a do 2º tempo
      return;
    }
    case 'fimDeJogo': {
      const p = ev.placar ?? [0, 0];
      cortarCanto(f, 1);
      if (p[casa] > p[1 - casa]) {
        acender(f, ORG.concat(QUINAS), S.vitoria, 0, 0.5);
        const c = f.canto;
        c.festaAte = f.t + 2 + C.festaDur;
        c.proximaEm = f.t + 2;
        if (c.fase === 'pausa') c.ate = f.t;
        c.fase = 'cantando-fim';
      }
      return;
    }
    default: return;
  }
}

/** Chamado por emocao.js a cada disparo de reação: o canto recua um pouco e volta. */
export function festaReacao(f, tipo) {
  if (tipo === 'uuuh' || tipo === 'palmas' || tipo === 'vaia') f.canto.reacao = Math.min(f.canto.reacao, FESTA.cantos.reacaoAbaixa);
}

/**
 * Passo contínuo (dt s do desenho). ctx = {t, bola {x, z}, posseTime, ataca, estado}; emocao = o estado de
 * emocao.js (agito); disparar(tipo, grupo, forca) põe um som na fila.
 */
export function festaPasso(f, emocao, ctx, dt, disparar) {
  f.t = ctx.t;
  if (!(dt > 0)) return;
  const C = FESTA.cantos, casa = FESTA.casa, t = f.t, r = f.rnd;
  const parado = ctx.estado === 'intervalo' || ctx.estado === 'fim';
  const c = f.canto;
  // recuo depois de uma reação
  c.reacao += (1 - c.reacao) * (1 - Math.exp(-dt / C.reacaoTau));
  // a casa atacando (para o canto de incentivo)
  const k = ctx.posseTime;
  const sent = k === 0 || k === 1 ? (ctx.ataca?.[k] ?? (k === 0 ? 1 : -1)) : 0;
  const avanco = sent ? ctx.bola.x * sent : -1e9;
  const casaAtaca = k === casa && avanco > C.incentivo;
  // máquina de estados dos cantos
  if (c.fase === 'cantando-fim') {
    // depois do gol: espera o grito passar
    if (t >= (c.proximaEm ?? t)) {
      if (t < c.festaAte) comecarCanto(f, escolherClipe(f, 'festa'), 0, Math.max(8, c.festaAte - t), 'festa');
      else if (t >= c.visitanteDe && t < c.visitanteDe + C.visitanteDur) comecarCanto(f, C.visitante, 1, C.visitanteDur, 'visitante');
      else pausarCanto(f, entre(r, C.pausa));
    }
  } else if (c.fase === 'cantando') {
    if (t >= c.ate) {
      pausarCanto(f, parado ? 1e9 : entre(r, C.pausa));
    }
  } else if (c.fase === 'pausa') {
    if (c.ate < 0) { c.ate = t + entre(r, C.primeiro); c.proximo = escolherClipe(f, 'geral'); }
    if (parado) c.ate = Math.max(c.ate, t + 1);
    else if (c.ate > t + C.pausa[1] + 1) c.ate = t + entre(r, C.primeiro); // voltou do intervalo
    else if (t >= c.ate || (casaAtaca && t - c.t0 >= 3)) {
      if (t < c.festaAte) comecarCanto(f, escolherClipe(f, 'festa'), 0, Math.max(8, c.festaAte - t), 'festa');
      else if (casaAtaca) comecarCanto(f, escolherClipe(f, 'incentivo'), 0, entre(r, C.dur), 'incentivo');
      else comecarCanto(f, c.proximo >= 0 ? c.proximo : escolherClipe(f, 'geral'), 0, entre(r, C.dur), 'geral');
    }
  }
  // batucada da organizada
  const B = FESTA.batucada;
  const alvoBat = parado ? 0.1 : (c.fase === 'cantando' && c.lado === 0 ? Math.max(B.resto, B.cantando * nivelCanto(f, t)) : B.resto);
  f.batucada += (alvoBat - f.batucada) * (1 - Math.exp(-dt / B.tau));
  // vaia: o visitante com a bola perto da área da casa
  const V = FESTA.vaia, vis = 1 - casa;
  if (!parado && ctx.estado !== 'gol' && k === vis) {
    const gx = -(ctx.ataca?.[casa] ?? 1) * 52.5;   // o gol que a casa defende
    if (Math.hypot(ctx.bola.x - gx, ctx.bola.z) <= V.dist) f.vaia.acum += dt;
    else f.vaia.acum = Math.max(0, f.vaia.acum - V.esvazia * dt);
  } else f.vaia.acum = Math.max(0, f.vaia.acum - V.esvazia * dt);
  if (f.vaia.acum >= V.segura && t - f.vaia.ultima >= V.pausa) {
    f.vaia.ultima = t; f.vaia.acum = 0; f.vaia.n++;
    if (disparar) disparar('vaia', casa, 0.8);
    festaReacao(f, 'vaia');
  }
  // sinalizadores apagados de vez (fumaça já foi)
  for (const s of f.flares) if (s.ativo && t > s.t0 + s.dur + 12) s.ativo = false;
  // ola: torcida calma por muito tempo, com o jogo rolando
  const O = FESTA.ola, o = f.ola;
  if (ctx.estado === 'jogo' && emocao && emocao.agito < O.calmoAgito) o.calmo += dt; else o.calmo = 0;
  const durOla = O.voltas * 2 * Math.PI / O.vel;
  o.ativa = t >= o.t0 && t <= o.t0 + durOla;
  if (!o.ativa && o.calmo >= O.calmo && t - o.ultima >= O.intervalo) {
    o.t0 = t; o.ultima = t; o.ativa = true; o.n++; o.calmo = 0;
  }
}
