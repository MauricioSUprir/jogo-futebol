// Ponte com o Total Match: este 3D é o motor das partidas do TM ("Jogar em 3D").
// O TM (legacy-total-match/js/tm3d.js) grava o pedido em localStorage["tm3d:pedido:<id>"] e
// abre index.html?tm=<id> num quadro (iframe) por cima dele — mesmo site, mesmo armazenamento.
// Aqui o pedido vira um MatchCfg (tools/CONTRACTS.md) e, no apito final, o resultado volta
// ao TM por postMessage (e fica em localStorage["tm3d:resultado:<id>"], caso a mensagem se perca).
//   avisos ao TM: { tipo: 'tm3d:pronto' | 'tm3d:fim' | 'tm3d:sair', id, resultado? }
//   resultado = { homeGoals, awayGoals, minuto?, gols: [{ lado, tmId, nome, minuto, penalti, contra, assist? }],
//                 cartoes: [{ lado, tmId, nome, minuto, cor }], stats, jogador?: { tmId, nota, gols, assist } }
// Os titulares chegam na ordem da escalação do TM, cada um com a vaga de lá (slot: [grupo, x, y]);
// cada um vai para a vaga mais parecida da formação daqui (menor deslocamento somado, método húngaro).
// "Controlar só o meu jogador" (Rumo ao Estrelato): pedido.controle = { tmId } trava o controle nele.
// Sem import de three.js/DOM pesado: só lê/escreve localStorage e conversa com a janela de cima.
import { FORMATIONS } from './config.js';
import { slotLabel, registerTeam, detailAttrs, resolveKits } from './teams.js';

export const TM_ID = new URLSearchParams(location.search).get('tm');

export function lerPedido(id) {
  try {
    const p = JSON.parse(localStorage.getItem('tm3d:pedido:' + id) || 'null');
    return p && p.home && p.away && Array.isArray(p.home.players) && Array.isArray(p.away.players) ? p : null;
  } catch { return null; }
}

// ------------------------------------------------------------ escalação
// método húngaro (atribuição de menor custo), matriz n×n: devolve res[linha] = coluna
export function hungaro(c) {
  const n = c.length, INF = 1e18;
  const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = c[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = new Array(n);
  for (let j = 1; j <= n; j++) if (p[j]) res[p[j] - 1] = j - 1;
  return res;
}

// as duas pranchetas na mesma escala: prof 0 = linha do goleiro … 1 = centroavante; lado −1 esquerda … +1 direita
const GRUPO = { GK: 'GK', DF: 'DEF', MF: 'MID', FW: 'ATT' };
const daVagaTM = (s) => ({ prof: (88 - s[2]) / 73, lado: (s[1] - 50) / 50 });          // [grupo, x 0..100, y 88 = gol … 15]
const daVaga3D = (s) => ({ prof: (s[1] + 50) / 58, lado: s[2] / 26 });                // [papel, x −50 = gol … 8, z > 0 = direita]
// sem a vaga do TM: pela posição do jogador
const POS_XY = { GOL: [0, 0, 'GK'], ZAG: [0.27, 0, 'DEF'], LD: [0.33, 0.85, 'DEF'], LE: [0.33, -0.85, 'DEF'], VOL: [0.48, 0, 'MID'],
  MC: [0.58, 0, 'MID'], MEI: [0.75, 0, 'MID'], MD: [0.62, 0.85, 'MID'], ME: [0.62, -0.85, 'MID'], ALD: [0.55, 0.95, 'MID'], ALE: [0.55, -0.95, 'MID'],
  PD: [0.88, 0.8, 'ATT'], PE: [0.88, -0.8, 'ATT'], CA: [1, 0, 'ATT'], ATA: [0.97, 0, 'ATT'] };
function ondeJoga(p) {
  if (Array.isArray(p.slot) && p.slot.length >= 3) { const v = daVagaTM(p.slot); return { ...v, grupo: GRUPO[p.slot[0]] || 'MID' }; }
  const q = POS_XY[p.pos] || POS_XY.MC;
  return { prof: q[0], lado: q[1], grupo: q[2] };
}

// devolve os 18 na ordem da formação daqui (11 titulares nas vagas + reservas)
export function encaixa(jogadores, formacao) {
  const vagas = FORMATIONS[formacao] || FORMATIONS['4-4-2'];
  const xi = jogadores.slice(0, 11), banco = jogadores.slice(11);
  // elenco curto (lesões, time do Ultimate sem banco): completa com reservas genéricos
  for (let k = 0; xi.length < 11; k++) {
    const base = xi[xi.length - 1] || {};
    xi.push({ name: 'Reserva ' + (k + 1), num: 90 + k, pos: 'MC', foot: 'D', overall: base.overall || 55,
      attrs: { pac: 55, sho: 50, pas: 55, dri: 52, def: 50, phy: 55, gk: 10 },
      look: base.look || { skin: '#c99169', hair: 'short', hairColor: '#15110e', height: 1.78, build: 0.5, beard: false } });
  }
  const onde = xi.map(ondeJoga);
  let gi = onde.findIndex(o => o.grupo === 'GK');
  if (gi < 0) gi = xi.findIndex(p => p.pos === 'GOL');
  if (gi < 0) gi = 0;
  const linha = xi.map((p, i) => i).filter(i => i !== gi);
  const vl = vagas.slice(1);
  const custo = linha.map(i => vl.map(v => {
    const a = onde[i], b = daVaga3D(v);
    // fora da faixa (zagueiro no ataque) pesa mais que trocar de lado; o grupo desempata
    return (a.prof - b.prof) ** 2 * 1.6 + (a.lado - b.lado) ** 2 + (a.grupo === v[0] ? 0 : 0.06);
  }));
  const at = linha.length === vl.length ? hungaro(custo) : linha.map((_, k) => k);
  const ordem = new Array(11);
  ordem[0] = xi[gi];
  at.forEach((j, k) => { ordem[j + 1] = xi[linha[k]]; });
  return ordem.map((p, k) => ({ p, vaga: vagas[k] })).concat(banco.map(p => ({ p, vaga: null })));
}

function montaJogador(p, vaga, vagas, teamId) {
  const pos = vaga ? slotLabel(vaga[0], vaga[1], vaga[2], vagas) : (POS_XY[p.pos] ? p.pos : 'MC');
  const attrs = { ...p.attrs };
  for (const k of ['pac', 'sho', 'pas', 'dri', 'def', 'phy', 'gk']) attrs[k] = Math.max(5, Math.min(99, Math.round(+attrs[k] || 50)));
  detailAttrs(attrs, pos, teamId + '|' + (p.tmId || p.name));
  return { ...p, pos, posTM: p.pos, attrs };
}

function montaTime(t) {
  const formation = FORMATIONS[t.formation] ? t.formation : '4-4-2';
  const vagas = FORMATIONS[formation];
  const players = encaixa(t.players, formation).map(({ p, vaga }) => montaJogador(p, vaga, vagas, t.id));
  const kits = {};
  for (const [k, kit] of Object.entries(t.kits || {})) {
    kits[k] = { collar: 'crew', ...kit, club: t.id };
    if (!kits[k].sponsor) kits[k].sponsor = t.sponsor || 'TOTAL MATCH';
    if (!kits[k].sponsorColor) kits[k].sponsorColor = kits[k].number;
  }
  if (!kits.gkAway) kits.gkAway = kits.gk;
  return registerTeam({ city: '', nickname: '', style: { press: 0.5, width: 0.5, tempo: 0.5, directness: 0.5 }, ...t, formation, players, kits });
}

// uniforme escolhido no pré-jogo do TM (0 = 1º, 1 = 2º, 2 = 3º); sem escolha, o 3D evita confusão de cores
function uniformes(home, away, hv, av) {
  if (hv == null && av == null) return resolveKits(home, away, {});
  const pega = (t, v) => (v === 2 ? t.kits.third || t.kits.away : v === 1 ? t.kits.away : t.kits.home);
  const h = { ...home, kits: { ...home.kits, home: pega(home, hv ?? 0) } };
  const a = { ...away, kits: { ...away.kits, home: pega(away, av ?? 1) } };
  return resolveKits(h, a, { home: 'home', away: 'home' });
}

export function montaCfg(pedido, settings) {
  const home = montaTime(pedido.home), away = montaTime(pedido.away);
  const k = uniformes(home, away, pedido.home.kitEscolhido, pedido.away.kitEscolhido);
  return {
    mode: 'amistoso', home, away, homeKit: k.homeKit, awayKit: k.awayKit, homeGK: k.homeGK, awayGK: k.awayGK,
    userSide: pedido.userSide === 'away' ? 'away' : pedido.userSide === 'none' ? 'none' : 'home',
    knockout: false, settings: { ...settings }, tm: { id: pedido.id, titulo: pedido.titulo || '', controle: pedido.controle || null },
  };
}

// ------------------------------------------------------------ durante a partida
export class PonteTM {
  constructor(id, pedido) {
    this.id = id; this.pedido = pedido;
    this.gols = []; this.cartoes = [];
    this.alvo = null;            // jogador travado ("Controlar só o meu jogador")
    this.guardado = null;        // time do jogador emprestado à IA por um passo (bola parada / goleiro)
    this.ultimo = null;          // último a tocar na bola (para passe certo/assistência)
    this.passes = [];            // [{ de, para, t }] passes certos recentes
    this.st = { toques: 0, passeOk: 0, passeErro: 0, chutes: 0, recuperou: 0 };
    this.lk = null;
    this.acabou = false;
  }

  avisa(tipo, extra) {
    const msg = { tipo, id: this.id, ...(extra || {}) };
    try { if (window.parent && window.parent !== window) window.parent.postMessage(msg, location.origin); } catch { /* sem a janela do TM */ }
  }
  pronto() { this.avisa('tm3d:pronto'); }

  // trava o controle no jogador do pedido (Rumo ao Estrelato)
  inicio(m) {
    const c = this.pedido.controle;
    if (!c || !c.tmId || !m.userTeam) return;
    const alvo = m.userTeam.players.find(p => p.data.tmId === c.tmId);
    if (!alvo) return;
    this.alvo = alvo;
    const troca = m.setControlled.bind(m);
    // ninguém mais assume o controle: nem a troca automática no passe, nem o botão TROCAR
    m.setControlled = (p) => { if (p && p !== alvo) return; if (p && alvo.sentOff) return; troca(p); };
    troca(alvo);
  }
  get travado() { return !!this.alvo; }

  // antes de cada passo: bola parada que não é do meu jogador, ou goleiro com a bola, ficam com a IA
  antes(m) {
    const a = this.alvo;
    if (!a || this.guardado) return;
    const t = a.team, sp = m.sp;
    const empresta = a.sentOff
      || (m.phase === 'setpiece' && sp && sp.team === t && sp.taker !== a)
      || (t.gk !== a && t.gk.holdingBall && m.holder === t.gk);
    if (empresta && m.userTeam) { this.guardado = m.userTeam; m.userTeam = null; t.human = false; }
  }
  depois(m) {
    if (this.guardado) { m.userTeam = this.guardado; this.guardado.human = !this.alvo?.sentOff; this.guardado = null; }
    // só o meu jogador: o botão GOLEIRO (sair com o goleiro) não vale — o goleiro é da IA
    if (this.alvo && this.alvo !== this.alvo.team.gk) m.userGKRush = false;
    // números do jogo para a nota do jogador e as assistências
    const lt = m.lastTouch;
    if (lt && lt !== this.ultimo) {
      const de = this.ultimo;
      if (de && m.lastKick && m.lastKick.p === de && m.time - m.lastKick.t < 6) {
        if (lt.team === de.team) this.passes.push({ de, para: lt, t: m.time });
        if (de === this.alvo) { if (lt.team === de.team) this.st.passeOk++; else this.st.passeErro++; }
      }
      if (lt === this.alvo) { this.st.toques++; if (de && de.team !== lt.team) this.st.recuperou++; }
      if (this.passes.length > 30) this.passes.splice(0, this.passes.length - 30);
      this.ultimo = lt;
    }
    if (this.alvo && m.lastKick && m.lastKick !== this.lk) {
      this.lk = m.lastKick;
      if (m.lastKick.p === this.alvo && /shot|volley|finesse|chip|header|power/.test(m.lastKick.kind || '')) this.st.chutes++;
    }
  }

  gol(m, e) {
    const sc = m.goalInfo && m.goalInfo.scorer;
    const ls = m.lastSetpiece;
    const penalti = !!(sc && !e.own && ls && ls.type === 'penalty' && ls.taker === sc && m.time - (ls.endT ?? -99) < 6);
    let assist = null;
    if (sc && !e.own && !penalti) {
      for (let i = this.passes.length - 1; i >= 0; i--) {
        const ps = this.passes[i];
        if (m.time - ps.t > 12) break;
        if (ps.para === sc && ps.de !== sc) { assist = ps.de; break; }
      }
    }
    this.gols.push({ lado: e.side, tmId: sc ? sc.data.tmId ?? null : null, nome: e.name, minuto: e.minute, penalti, contra: !!e.own,
      assist: assist ? { tmId: assist.data.tmId ?? null, nome: assist.data.name } : null });
    this.passes.length = 0;
  }

  cartao(m, e) {
    const t = m.teams[e.side];
    const p = t && (t.players.find(q => q.data.name === e.name && (e.color === 'red' ? q.sentOff : q.yellow > 0)) || t.players.find(q => q.data.name === e.name));
    this.cartoes.push({ lado: e.side, tmId: p ? p.data.tmId ?? null : null, nome: e.name, minuto: m.minute(), cor: e.color === 'red' ? 'red' : 'yellow' });
  }

  resultado(m, r) {
    const res = { homeGoals: r.homeGoals, awayGoals: r.awayGoals, gols: this.gols, cartoes: this.cartoes,
      stats: { possession: r.stats.possession, shots: r.stats.shots, onTarget: r.stats.onTarget } };
    const a = this.alvo;
    if (a) {
      const lado = a.team.i, meus = lado === 0 ? r.homeGoals : r.awayGoals, deles = lado === 0 ? r.awayGoals : r.homeGoals;
      const gols = this.gols.filter(g => !g.contra && g.tmId === a.data.tmId).length;
      const assist = this.gols.filter(g => g.assist && g.assist.tmId === a.data.tmId).length;
      const s = this.st;
      let nota = 6 + gols * 1.0 + assist * 0.6 + Math.min(0.9, s.passeOk * 0.04) - Math.min(0.8, s.passeErro * 0.05)
        + Math.min(0.5, s.recuperou * 0.08) + Math.min(0.3, s.chutes * 0.05) + (meus > deles ? 0.5 : meus === deles ? 0.1 : -0.3);
      if (a.sentOff) nota -= 1.2;
      if (s.toques < 3) nota = Math.min(nota, 6);
      nota = Math.max(4.5, Math.min(10, Math.round(nota * 10) / 10));
      res.jogador = { tmId: a.data.tmId, nota, gols, assist, toques: s.toques, passes: s.passeOk };
    }
    return res;
  }

  fim(m, r) {
    if (this.acabou) return;
    this.acabou = true;
    const res = this.resultado(m, r);
    try { localStorage.setItem('tm3d:resultado:' + this.id, JSON.stringify(res)); } catch { /* sem espaço: vai só pela mensagem */ }
    this.avisa('tm3d:fim', { resultado: res });
    // aberto fora do TM (aba solta): volta para o jogo
    if (window.parent === window) setTimeout(() => { location.href = '../index.html'; }, 600);
  }

  sair() {
    if (this.acabou) return;
    this.acabou = true;
    this.avisa('tm3d:sair');
    if (window.parent === window) location.href = '../index.html';
  }
}
