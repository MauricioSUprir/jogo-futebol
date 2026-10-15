// Súmula da partida (ponte com o Total Match; contrato em CONTRATOS.md, "Ponte com o Total Match"). Puro: sem three.js
// nem DOM; só LÊ o mundo e os eventos de cada passo (o hash não muda). A MESMA súmula serve ao jogo ao vivo (main.js
// rodarPasso) e ao "Simular o resto" (os passos sem desenho), e roda em Node (tools/teste-ponte-tm.mjs).
//
//   const s = criarSumula();
//   for (cada passo) { const ev = passoPartida(m, entrada); sumulaPasso(s, m, ev); }
//   resultadoTM(s, m, mapa) → o resultado do contrato (§2): placar, gols, cartões, estatísticas e o jogador travado
//
// Definições (as do painel de equilíbrio, tools/painel-equilibrio.mjs, e de tools/lib/partida-medidas.mjs — copiadas aqui
// porque tools/ não vai para o site):
//  - gol: o autor DE VERDADE (render/autor-gol.js: último toque pelos eventos; chute desviado = de quem chutou; o toque do
//    outro time = gol contra, que conta para o time beneficiado); pênalti = o evento 'penalti' com resultado 'gol' no
//    MESMO passo do gol, ou o chute do cobrador que entra depois de só o goleiro tocar (espalmou para dentro); o rebote
//    (outro toque, inclusive do cobrador) é gol normal;
//  - assistência: o último passe que chegou a um companheiro (o 1º toque de outro jogador do mesmo time depois do passe)
//    e cujo recebedor marcou sem ninguém mais tocar na bola (o desvio do adversário no chute não tira a assistência);
//  - chute: o 'chute' do acoes.js ou o cabeceio PARA O GOL (passe de modo 'cabeceio' com m.voo.cabeceio = 'chute');
//    no alvo = gol do mesmo time ou 'defesa' de um jogador do outro time em até 4 s (o bloqueio na linha não conta; o gol
//    que entrou sem o chute aberto — bloqueado, cruzamento direto — conta como chute no alvo: gols ≤ no alvo ≤ chutes);
//    a defesa só é creditada ao goleiro quando o chute acaba sem gol (espalmada que entra = gol, não defesa);
//  - posse: a cada passo com a bola rolando, o time do dono da bola (no pé ou na mão), senão o do passe/chute no ar;
//  - cartões: um por evento 'cartao' (o 2º amarelo sai como amarelo + vermelho, como o TM espera);
//  - minuto: minutoDeJogo (o do placar: 0–45 e 45–90; os acréscimos ficam em 45 e 90), no mínimo 1 no 1º tempo e 46 no 2º.

import { criarAutorGol, autorEventos, TOQUES } from './render/autor-gol.js';
import { minutoDeJogo } from './partida.js';

/** Ticks em que o desfecho do chute é procurado (4 s, o do painel). */
export const JANELA_CHUTE = 240;

/** Súmula vazia. */
export function criarSumula() {
  return {
    autor: criarAutorGol(),
    gols: [],          // {time (beneficiado), id (autor), contra, penalti, desvio, assist (id | null), tick, minuto}
    cartoes: [],       // {time, id, cor ('amarelo' | 'vermelho'), segundo, tick, minuto}
    chutes: [0, 0], noAlvo: [0, 0], posse: [0, 0],
    aberto: null,      // o chute em aberto {time, id, tick, assist, defendido (id do goleiro que tocou | null)}
    pen: null,         // o pênalti em aberto {time, id (cobrador), chutou} até outro toque que não seja do goleiro
    passe: null,       // o passe ainda sem dono {de, time}
    passeCerto: null,  // o último passe que chegou a um companheiro {de, para, time}
    jog: {},           // por id: números de cada jogador (o travado: a nota)
    dono: null,        // quem tinha a bola no fim do passo anterior (a perda de quem foi desarmado)
    passos: 0,
  };
}

function numeros(s, id) {
  return (s.jog[id] ??= { toques: 0, passes: 0, passesCertos: 0, chutes: 0, noAlvo: 0, gols: 0, assist: 0, roubadas: 0, desarmes: 0, perdas: 0, defesas: 0, faltas: 0, amarelos: 0, vermelhos: 0, contra: 0 });
}

/** Time do jogador `id` (em campo ou já expulso) ou null. */
function timeDoId(m, id) {
  if (id == null) return null;
  for (const j of m.jogadores) if (j.id === id) return j.time;
  for (const j of m.expulsos ?? []) if (j.id === id) return j.time;
  return null;
}
function jogadorDoId(m, id) {
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}

/** O evento é um chute? (tools/lib/partida-medidas.mjs ehChute; chamar logo depois do passo) */
export function ehChute(m, e) {
  if (e.tipo === 'chute') return true;
  return e.tipo === 'passe' && e.modo === 'cabeceio' && !!m.voo && m.voo.de === e.id && m.voo.cabeceio === 'chute';
}

/** Time com a bola: o do dono (pé ou mão), senão o do passe/chute no ar, senão null (tools/lib/partida-medidas.mjs). */
function timeComBola(m) {
  const id = m.naMao ?? m.posse;
  if (id != null) { const t = timeDoId(m, id); if (t != null) return t; }
  return m.voo && m.voo.time != null ? m.voo.time : null;
}

/** Minuto do contrato (1–90): o do placar, no mínimo 1 no 1º tempo e 46 no 2º (os acréscimos ficam em 45 e 90). */
export function minutoTM(m) {
  const mi = minutoDeJogo(m);
  const t = m.partida?.tempo ?? 1;
  return t >= 2 ? Math.max(46, Math.min(90, mi)) : Math.max(1, Math.min(45, mi));
}

/** Fecha o chute em aberto; o defendido que não virou gol (porGol falso) conta no alvo e credita a defesa ao goleiro. */
function fecharChute(s, noAlvo, porGol = false) {
  const a = s.aberto;
  if (!a) return;
  if (a.defendido != null && !porGol) { noAlvo = true; numeros(s, a.defendido).defesas++; }
  if (noAlvo) { s.noAlvo[a.time]++; numeros(s, a.id).noAlvo++; }
  s.aberto = null;
}

/** Um passo: os eventos dele (na ordem) e a posse. Chamar logo depois de passoPartida, com os eventos que ele devolveu. */
export function sumulaPasso(s, m, eventos) {
  s.passos++;
  const timeDe = id => timeDoId(m, id);
  // o autor de verdade (o passo inteiro de uma vez: o gol do passo fica em s.autor.gol)
  autorEventos(s.autor, eventos, m.tick, timeDe);
  const penGol = eventos.some(e => e.tipo === 'penalti' && e.resultado === 'gol');
  // quem tinha a bola antes do passo (para a perda de quem foi desarmado)
  const donoAntes = s.dono ?? null;
  for (const e of eventos) {
    const tipo = e.tipo;
    // a 'cobranca' do pênalti é o chute (não vem outro evento 'chute'): daí até o gol só o goleiro do outro time pode
    // tocar — outro toque (inclusive o rebote do cobrador) vira jogada normal
    if (tipo === 'cobranca' && e.parada === 'penalti') { const t = timeDe(e.id); s.pen = t != null ? { time: t, id: e.id, tick: m.tick } : null; }
    else if (s.pen && TOQUES.has(tipo) && e.id != null) {
      if (e.id === s.pen.id) { if (m.tick !== s.pen.tick) s.pen = null; }
      else { const j = jogadorDoId(m, e.id); if (!(j && j.posicao === 'GOL' && j.time !== s.pen.time)) s.pen = null; }
    }
    // o chute defendido acaba no próximo toque de outro jogador (rebote, corte): conta no alvo e a defesa vale
    if (s.aberto && s.aberto.defendido != null && TOQUES.has(tipo) && e.id != null && e.id !== s.aberto.defendido) fecharChute(s, true);
    // toques (o passe pendente chega a um companheiro ou é cortado; a corrente da assistência)
    if (TOQUES.has(tipo) && e.id != null && !(tipo === 'dividida' && !e.ganhou)) {
      const t = timeDe(e.id);
      const n = numeros(s, e.id);
      n.toques++;
      if (s.passe && e.id !== s.passe.de) {
        if (t === s.passe.time) { s.passeCerto = { de: s.passe.de, para: e.id, time: t }; numeros(s, s.passe.de).passesCertos++; }
        else s.passeCerto = null;
        s.passe = null;
      } else if (s.passeCerto && e.id !== s.passeCerto.para && !(s.aberto && (tipo === 'defesa' || tipo === 'bateuCorpo'))) s.passeCerto = null;
    }
    switch (tipo) {
      case 'gol': {
        const g = s.autor.gol;
        const id = g.ativo && g.tick === m.tick ? g.id : (e.autor ?? null);
        const contra = g.ativo && g.tick === m.tick ? !!g.contra : false;
        let assist = null;
        if (!contra && id != null) {
          if (s.aberto && s.aberto.id === id) assist = s.aberto.assist;
          else if (s.passeCerto && s.passeCerto.para === id && s.passeCerto.time === e.time) assist = s.passeCerto.de;
          if (assist === id) assist = null;
        }
        if (s.aberto && s.aberto.time === e.time) fecharChute(s, true, true);
        else {
          fecharChute(s, false);
          // gol (não contra) sem o chute aberto (o chute bloqueado que entrou, o cruzamento que entrou direto): conta como
          // chute no alvo — o TM nunca recebe mais gols que chutes no alvo
          if (!contra && (e.time === 0 || e.time === 1)) {
            if (s.chutes[e.time] <= s.noAlvo[e.time]) s.chutes[e.time]++;
            s.noAlvo[e.time]++;
          }
        }
        const pen = !contra && (penGol || (!!s.pen && s.pen.time === e.time && s.pen.id === id));
        s.pen = null;
        s.gols.push({ time: e.time, id, contra, penalti: pen, desvio: !!(g.ativo && g.tick === m.tick && g.desvio), assist, tick: m.tick, minuto: minutoTM(m) });
        if (id != null) { if (contra) numeros(s, id).contra++; else numeros(s, id).gols++; }
        if (assist != null) numeros(s, assist).assist++;
        s.passe = null; s.passeCerto = null;
        break;
      }
      case 'defesa': {
        // a defesa só vale quando o chute acaba sem gol (fecharChute): a espalmada que entra é gol, não defesa
        const t = timeDe(e.id);
        if (s.aberto && t != null && t !== s.aberto.time && s.aberto.defendido == null) s.aberto.defendido = e.id;
        break;
      }
      case 'bateuCorpo': {
        const j = jogadorDoId(m, e.id);
        if (s.aberto && e.id !== s.aberto.id && j && j.posicao !== 'GOL') fecharChute(s, false);
        break;
      }
      case 'fora': case 'saida': case 'intervalo': case 'apito': case 'impedimento':
        if (tipo === 'fora') fecharChute(s, false);
        s.passe = null; s.passeCerto = null; s.pen = null;
        break;
      case 'cartao': {
        s.cartoes.push({ time: e.time, id: e.id, cor: e.cor, segundo: !!e.segundo, tick: m.tick, minuto: minutoTM(m) });
        const n = numeros(s, e.id);
        if (e.cor === 'vermelho') n.vermelhos++; else n.amarelos++;
        break;
      }
      case 'roubada': case 'dividida': {
        if (e.id == null || (tipo === 'dividida' && !e.ganhou)) break;
        if (tipo === 'roubada') numeros(s, e.id).roubadas++; else numeros(s, e.id).desarmes++;
        // quem estava com a bola e foi desarmado perde ponto (o evento só traz quem ganhou)
        const t = timeDe(e.id);
        if (donoAntes != null && donoAntes !== e.id && timeDe(donoAntes) != null && timeDe(donoAntes) !== t) numeros(s, donoAntes).perdas++;
        break;
      }
      case 'perda': if (e.id != null) numeros(s, e.id).perdas++; break;
      case 'falta': if (e.def != null) numeros(s, e.def).faltas++; break;
      default: break;
    }
    // chute (depois do toque: a corrente da assistência do chute é a de agora)
    if (e.id != null && ehChute(m, e)) {
      fecharChute(s, false);
      const t = timeDe(e.id);
      if (t != null) {
        s.chutes[t]++;
        numeros(s, e.id).chutes++;
        const assist = s.passeCerto && s.passeCerto.para === e.id && s.passeCerto.time === t ? s.passeCerto.de : null;
        s.aberto = { time: t, id: e.id, tick: m.tick, assist };
      }
    } else if (tipo === 'passe' && e.id != null) {
      const t = timeDe(e.id);
      numeros(s, e.id).passes++;
      s.passe = t != null ? { de: e.id, time: t } : null;
    }
  }
  if (s.aberto && m.tick - s.aberto.tick > JANELA_CHUTE) fecharChute(s, false);
  s.dono = m.posse ?? null;
  // posse: só com a bola rolando (como o painel)
  const p = m.partida;
  if (p && p.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.foraDesde == null && m.golTick == null) {
    const tc = timeComBola(m);
    if (tc === 0 || tc === 1) s.posse[tc]++;
  }
}

/** Posse em % [time 0, time 1] (somam 100; sem nenhum passo com a bola rolando: 50/50). */
export function posseEmPct(s) {
  const tot = s.posse[0] + s.posse[1];
  if (!tot) return [50, 50];
  const a = Math.round(100 * s.posse[0] / tot);
  return [a, 100 - a];
}

/**
 * Nota do jogador (4,5–10; uma casa) pelos números dele, pela posição (goleiro e defensor sentem os gols sofridos) e
 * pelo resultado do time, na escala do Rumo ao Estrelato (média ~6,5–7; 8 ou mais só num jogo bom de verdade). Base 6,0;
 * gol +1,0, assistência +0,6, chute no alvo +0,15, passe certo +0,025 (até +0,6) e errado −0,08, roubada/desarme
 * +0,12 (até +0,6), perda −0,12, defesa do goleiro +0,3, cartão −0,3/−1,5, falta −0,1; vitória +0,3, derrota −0,3.
 */
export function notaDoJogador(n, opc = {}) {
  const errados = Math.max(0, n.passes - n.passesCertos);
  let v = 6.0 + 1.0 * n.gols + 0.6 * n.assist + 0.15 * Math.max(0, n.noAlvo - n.gols) - 0.05 * Math.max(0, n.chutes - n.noAlvo)
    + Math.min(0.6, 0.025 * n.passesCertos) - 0.08 * errados + Math.min(0.6, 0.12 * (n.roubadas + n.desarmes)) - 0.12 * n.perdas
    + 0.3 * n.defesas - 0.3 * n.amarelos - 1.5 * n.vermelhos - 0.1 * n.faltas - 0.8 * n.contra;
  const sofridos = opc.sofridos ?? 0;
  if (opc.posicao === 'GOL') v -= 0.3 * sofridos;
  else if (opc.posicao === 'ZAG' || opc.posicao === 'LAT') v -= 0.15 * sofridos;
  if (opc.saldo > 0) v += 0.3; else if (opc.saldo < 0) v -= 0.3;
  return Math.round(Math.max(4.5, Math.min(10, v)) * 10) / 10;
}

/**
 * O resultado do contrato (§2) — `lado` = o índice do time no GOLAÇO (0 = mandante). mapa: {id: {tmId, nome, lado}}
 * (tm-times.js). O jogador travado (m.trava) entra em `jogador` com a nota.
 */
export function resultadoTM(s, m, mapa = {}) {
  const quem = id => (id != null && mapa[id] ? { tmId: mapa[id].tmId ?? null, nome: mapa[id].nome ?? '' } : { tmId: null, nome: '' });
  const placar = [m.placar?.[0] ?? 0, m.placar?.[1] ?? 0];
  const r = {
    homeGoals: placar[0], awayGoals: placar[1],
    gols: s.gols.map(g => {
      const a = quem(g.id);
      return { lado: g.time, tmId: a.tmId, nome: a.nome, minuto: g.minuto, penalti: !!g.penalti, contra: !!g.contra, assist: g.assist != null ? quem(g.assist) : null };
    }),
    cartoes: s.cartoes.map(c => { const a = quem(c.id); return { lado: c.time, tmId: a.tmId, nome: a.nome, minuto: c.minuto, cor: c.cor === 'vermelho' ? 'red' : 'yellow' }; }),
    stats: { possession: posseEmPct(s), shots: [s.chutes[0], s.chutes[1]], onTarget: [s.noAlvo[0], s.noAlvo[1]] },
  };
  const h = m.timeHumano ?? 0;
  const tv = m.trava?.[h];
  if (tv != null) {
    const n = numeros(s, tv);
    const j = jogadorDoId(m, tv) ?? (m.expulsos ?? []).find(o => o.id === tv) ?? null;
    const saldo = placar[h] - placar[1 - h];
    r.jogador = {
      tmId: quem(tv).tmId, nota: notaDoJogador(n, { posicao: j?.posicao ?? null, sofridos: placar[1 - h], saldo }),
      gols: n.gols, assist: n.assist, toques: n.toques, passes: n.passesCertos,
    };
  }
  return r;
}
