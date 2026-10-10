// Troca automática no jogo aéreo (Etapa 3, Parte 4; plano 3.5): com a bola no ar e sem dono, o
// controle do humano vai para quem do time vai disputar (o primeiro ponto da trajetória a que ele
// chega a tempo, com y ≤ alcance do salto), reavaliado no voo com histerese (pesquisa §7: quem disputa
// era o mais perto do ponto no lançamento em 80% e o mais perto 0,5 s antes em 97% — Metrica; o EA FC
// tem a troca "em bolas altas" e a "assistência de movimento"). Pura: sem three.js nem DOM. Constantes
// em config.js TROCA_AEREA.
//
// Ganchos em sim.js (só com m.times):
//  - trocaAerea(m) depois de trocarJogador (toda troca passa por assumirControle; evento
//    `trocaAerea {id}`);
//  - alvoAereo(m, j, e) na entrada do controlado: com ele sendo o disputante e o analógico solto
//    (|e| ≤ TROCA_AEREA.analogicoSolto), devolve a entrada que o leva ao ponto da disputa; senão null.
//
// Regras (plano 3.5):
//  1. liga com a bola no ar e sem dono (!b.rolando, m.posse == null, m.naMao == null), fora de parada não
//     cobrada, para cada time humano (também no rebote de chute: a bola espalmada ou desviada no ar); um voo novo (m.voo.tick0 mudou: cabeceio, lançamento)
//     recomeça a contagem;
//  2. a cada avaliaTicks (0,1 s, a 1ª no começo do voo) prevê a trajetória da bola uma vez e acha, para
//     cada jogador de linha do time, o 1º ponto dela a que ele chega a tempo com y ≤ alcance do salto;
//     disputante = quem chega primeiro (menor tick; desempate pela folga de tempo, depois vagaIdx/id).
//     Um companheiro com o toque aéreo marcado (sim.js bolaAltaNoCorpo) para daqui a ≤ janelaMarcado s é o
//     disputante (com mais de um, o primeiro na ordem da bola livre: o recebedor, depois o mais perto dela);
//  3. troca na 1ª avaliação do voo (sem esperar; o passe do meu time já trocou para o recebedor no
//     lançamento e isso conta como a 1ª troca); depois, no máximo correcoesMax correções por bola, cada
//     uma com o mesmo disputante em `confirma` avaliações seguidas e folga ≥ folgaMin s sobre o controlado
//     — ou na hora, se um companheiro já tem o toque aéreo marcado;
//  4. não troca se o controlado já tem o toque aéreo (ainda por vir e o primeiro do time), se carrega uma ação (carga ou pedido: o humano está
//     preparando a jogada com ele) ou se o humano apertou TROCAR há < manualRecente s.
// Estado por time em m.trocaAerea[time] (reaproveitado; não entra no hash — é derivado do mundo).
// iaClassica (o "antes" dos testes): não troca nem ajuda.

import { TROCA_AEREA, ACOES, PASSO, BOTAO, CAMPO } from './config.js';
import { MD } from './matdet.js';
import { copiarBola, passoBola } from './bola.js';
import { assumirControle } from './acoes.js';
import { para } from './ia.js';
import { estadoIA } from './ia-tatica.js';

const T = TROCA_AEREA;
const N_PREV = 210;               // ticks da trajetória prevista (3,5 s: o lançamento mais longo)
const PASSO_VARRE = 2;            // a varredura olha um tick a cada 2 (a trajetória é suave)
// trajetória prevista (reaproveitada: recalculada inteira a cada avaliação, nada é guardado entre mundos)
const XS = new Float64Array(N_PREV + 1), ZS = new Float64Array(N_PREV + 1), YS = new Float64Array(N_PREV + 1);
let nPrev = 0;

/** A troca aérea vale agora para o mundo m? (bola no ar, sem dono, em jogo) */
function bolaAltaLivre(m) {
  if (m.partida && (m.partida.iaClassica || m.partida.estado === 'gol' || m.partida.estado === 'intervalo' || m.partida.estado === 'fim')) return false;
  const b = m.bola;
  if (b.rolando || m.posse != null || m.naMao != null) return false;
  if (m.parada && !m.parada.rolou) return false;
  return true;
}

/** Prevê a bola N_PREV ticks (física pura), parando quando ela sai do campo. */
function preverTrajetoria(b) {
  const c = copiarBola(b);
  XS[0] = c.p.x; ZS[0] = c.p.z; YS[0] = c.p.y;
  let n = N_PREV;
  for (let i = 1; i <= N_PREV; i++) {
    passoBola(c, null);
    XS[i] = c.p.x; ZS[i] = c.p.z; YS[i] = c.p.y;
    if (Math.abs(c.p.x) > CAMPO.meioX || Math.abs(c.p.z) > CAMPO.meioZ) { n = i - 1; break; }
  }
  nPrev = n;
}

/** Alcance do salto (m): a bola até esta altura dá para disputar (sim.js bolaAltaNoCorpo). */
function alcanceY(j) {
  return ACOES.cabeceio.alcanceSalto * (0.92 + 0.12 * (j.par.attr.impulsao ?? 65) / 100);
}

/** Tempo (s) para o jogador chegar correndo a (x, z): aceleração até a máxima (a conta do ia.js). */
function tempoAte(j, x, z) {
  const dx = x - j.x, dz = z - j.z, dist = MD.hypot(dx, dz);
  const d = Math.max(0, dist - 0.5);
  const vmax = j.par.vArrancada;
  // velocidade que já vai na direção do ponto
  const s0 = dist > 1e-6 ? Math.max(0, Math.min(vmax, (j.vx * dx + j.vz * dz) / dist)) : 0;
  const tAcel = (vmax - s0) / 7;
  const dAcel = (s0 + vmax) / 2 * tAcel;
  return d <= dAcel ? d / Math.max((s0 + vmax) / 2, 1) : tAcel + (d - dAcel) / vmax;
}

/**
 * Primeiro ponto da trajetória prevista a que o jogador chega a tempo (com TROCA_AEREA.margem s de folga) e
 * na altura do salto: {i, folga, x, z} em `out` (i = -1: não chega antes de ela sair do campo ou do horizonte).
 */
function pontoDeDisputa(j, out) {
  const ay = alcanceY(j);
  out.i = -1;
  for (let i = PASSO_VARRE; i <= nPrev; i += PASSO_VARRE) {
    if (YS[i] > ay) continue;
    const t = tempoAte(j, XS[i], ZS[i]);
    const folga = i * PASSO - t;
    // chega com folga: quem precisaria de uma corrida perfeita (sem reação nem curva) não é quem disputa.
    // A folga pedida encolhe perto da disputa (a 1 s, a margem inteira; em cima da hora, quase nada)
    if (folga >= T.margem * Math.min(1, i * PASSO)) { out.i = i; out.folga = folga; out.x = XS[i]; out.z = ZS[i]; return out; }
  }
  return out;
}

function estado(m, time) {
  const tab = (m.trocaAerea ??= {});
  return tab[time] ??= {
    ativo: false, chave: -1, inicio: 0, avaliacoes: 0, melhor: -1, seguidas: 0, trocas: 0, correcoes: 0,
    iCtrl: Infinity, px: 0, pz: 0, iMelhor: -1, tickAval: 0, manual: -1e9, primeira: true,
  };
}

const _p = { i: -1, folga: 0, x: 0, z: 0 };

/** Avaliação (a cada 0,1 s): disputante previsto do time e as folgas dele e do controlado. */
function avaliar(m, t, st, ctrl) {
  let mel = null, mi = Infinity, mf = -Infinity, mx = 0, mz = 0;
  st.iCtrl = Infinity; // o controlado não chega: qualquer outro tem folga infinita sobre ele
  for (const o of m.jogadores) {
    if (o.time !== t || o.posicao === 'GOL' || o.papel === 'parado' || o.papel === 'marcador') continue;
    pontoDeDisputa(o, _p);
    if (_p.i < 0) continue;
    if (o === ctrl) st.iCtrl = _p.i;
    const melhor = _p.i < mi || (_p.i === mi && (_p.folga > mf || (_p.folga === mf && mel && (o.vagaIdx ?? o.id) < (mel.vagaIdx ?? mel.id))));
    if (melhor) { mel = o; mi = _p.i; mf = _p.folga; mx = _p.x; mz = _p.z; }
  }
  const id = mel ? mel.id : -1;
  st.seguidas = id === st.melhor ? st.seguidas + 1 : 1;
  st.melhor = id; st.iMelhor = mel ? mi : -1; st.tickAval = m.tick;
  st.px = mx; st.pz = mz;
  st.avaliacoes++;
}

function trocar(m, t, st, novo) {
  assumirControle(m, t, novo);
  m.eventos.push({ tipo: 'trocaAerea', id: novo.id });
  if (!st.primeira || st.trocas > 0) st.correcoes++;
  st.trocas++;
}

/** Reavalia quem do time humano disputa a bola alta e troca o controle se for o caso. */
export function trocaAerea(m) {
  const alta = bolaAltaLivre(m);
  let previu = false;
  for (const t of m.humanos) {
    const st = estado(m, t);
    // TROCAR apertado agora (borda do time): a escolha manual manda por um tempo
    const agora = m.botoesTimeAgora[t] ?? 0, antes = m.botoesTimeAnt[t] ?? 0;
    if ((agora & BOTAO.TROCAR) && !(antes & BOTAO.TROCAR)) st.manual = m.tick;
    if (!alta) { st.ativo = false; continue; }
    // voo novo: começou agora ou a bola foi batida de novo no ar (cabeceio, lançamento: m.voo novo; o voo
    // que some no meio — desvio, goleiro — continua o mesmo, sem nova cota de correções)
    const chave = m.voo ? m.voo.tick0 : st.ativo ? st.chave : -1;
    if (!st.ativo || chave !== st.chave) {
      st.ativo = true; st.chave = chave; st.inicio = m.tick; st.avaliacoes = 0; st.melhor = -1; st.seguidas = 0;
      st.trocas = 0; st.correcoes = 0; st.primeira = true;
      // passe alto do meu time: o controle já foi para o recebedor no lançamento (conta como a 1ª troca)
      const v = m.voo;
      if (v && v.time === t && v.para != null && m.controlado[t] === v.para) st.trocas = 1;
    }
    let ctrl = null;
    for (const o of m.jogadores) if (o.id === m.controlado[t]) { ctrl = o; break; }
    if (!ctrl) continue;
    // companheiro com o toque aéreo marcado para daqui a pouco (≤ janelaMarcado s): é quem vai disputar —
    // de mais longe o toque ainda erra ou outro chega antes (medido no teste-aereo-troca). Com dois marcados,
    // vale a ordem da bola livre (sim.js bolaLivre): o recebedor do passe primeiro, depois o mais perto da
    // bola — quem vem antes nessa ordem com o toque pendente segura a bola para ele
    let marcado = null, dMarc = Infinity;
    const janela = Math.round(T.janelaMarcado / PASSO);
    const para = m.voo ? m.voo.para : null, b = m.bola.p;
    for (const o of m.jogadores) {
      if (o.time !== t || o.posicao === 'GOL') continue;
      const tq = o.cond && o.cond.toque;
      if (!tq || tq.tipo !== 'aereo' || m.tick >= tq.tick || tq.tick - m.tick > janela) continue;
      const d = o.id === para ? -1 : MD.hypot(o.x - b.x, o.z - b.z);
      if (d < dMarc) { dMarc = d; marcado = o; }
    }
    const avalia = (m.tick - st.inicio) % T.avaliaTicks === 0;
    if (avalia) {
      if (!previu) { preverTrajetoria(m.bola); previu = true; }
      avaliar(m, t, st, ctrl);
    }
    // o toque marcado perde para a previsão quando ela (confirmada) põe outro na bola bem antes: alguém mais
    // perto do caminho dela, que só marca o toque em cima da hora (sim.js bolaAltaPassando olha o corpo de
    // agora), chega antes de quem marcou de longe
    const tqc = ctrl.cond && ctrl.cond.toque;
    const tqcVale = tqc && tqc.tipo === 'aereo' && m.tick <= tqc.tick;
    let disputa = marcado ?? (tqcVale ? ctrl : null);
    if (disputa && st.melhor >= 0 && st.melhor !== disputa.id && st.seguidas >= T.confirma) {
      const iAgora = st.iMelhor - (m.tick - st.tickAval);
      if (iAgora < disputa.cond.toque.tick - m.tick - T.antecede) {
        for (const o of m.jogadores) if (o.id === st.melhor) { disputa = o; break; }
        marcado = disputa === ctrl ? null : disputa;
      }
    }
    // travas: o controlado já vai disputar (o toque aéreo dele vem primeiro), carrega uma ação, ou o humano
    // acabou de escolher
    const trava = (tqcVale && disputa === ctrl) || ctrl.carga || ctrl.pedido || (m.tick - st.manual) * PASSO < T.manualRecente;
    if (!trava) {
      const podeCorrigir = st.correcoes < T.correcoesMax;
      if (marcado && marcado !== ctrl) {
        if (st.trocas === 0 || podeCorrigir) trocar(m, t, st, marcado);
      } else if (avalia && st.melhor >= 0 && st.melhor !== ctrl.id) {
        let novo = null;
        for (const o of m.jogadores) if (o.id === st.melhor) { novo = o; break; }
        if (novo) {
          if (st.primeira && st.trocas === 0) trocar(m, t, st, novo);
          else if (podeCorrigir && st.seguidas >= T.confirma && (st.iCtrl - st.iMelhor) * PASSO >= T.folgaMin) trocar(m, t, st, novo);
        }
      }
    }
    if (avalia) st.primeira = false;
  }
}

/**
 * Assistência do controlado na bola alta: sendo ele o disputante previsto e com o analógico solto, vai ao
 * ponto da disputa (pressa, CORRER de longe) — como a assistência do passe. Entrada {x, z, botoes} ou
 * null (o analógico manda; com o toque aéreo marcado, sim.js movimentoAereo já leva ao ponto).
 */
export function alvoAereo(m, j, e) {
  const st = m.trocaAerea?.[j.time];
  if (!st || !st.ativo || st.melhor !== j.id || !bolaAltaLivre(m)) return null;
  if (e && MD.hypot(e.x ?? 0, e.z ?? 0) > T.analogicoSolto) return null;
  const tq = j.cond && j.cond.toque;
  if (tq && tq.tipo === 'aereo' && m.tick <= tq.tick) return null;
  estadoIA(m, j);
  const r = para(j, st.px, st.pz, 1, true, 0, 'pressa');
  return { x: r.x, z: r.z, botoes: ((e?.botoes ?? 0) | 0) | (r.botoes & BOTAO.CORRER) };
}
