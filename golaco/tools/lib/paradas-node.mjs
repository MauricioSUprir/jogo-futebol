// Replays nas paradas em Node, EXATAMENTE como a página (main.js rodarPasso + passoLances + seguraParaReplayParada): a
// partida IA × IA gravando o anel (lib/anel-node.mjs), o classificador (js/lances.js) lendo cada passo, o lance aceito
// ARMADO e o replay "tocado" no passo antes da montagem (lances.js montaNoProximoPasso: o roteiro sai do anel daquele
// instante — render/replay-roteiro.js roteiroParada). Os replays automáticos do gol (na saída de bola, com o chute de
// render/autor-gol.js) e do impedimento (no apito) contam no espaço, como na página. Nada aqui escreve no mundo: o passo
// da simulação é o mesmo com e sem o classificador (teste-replay-paradas P4).
//   const P = await criarSimParadas(pastaJs);  const S = P.novaPartida(semente, {comoPagina});  const r = P.passo(S)
//   r = {ev, pred (montaNoProximoPasso antes do passo), espera ({tick, lance, roteiro, dur, anel} | null: o replay de parada
//   que começou ANTES deste passo; anel = {primeiro, ultimo} do anel de onde o roteiro saiu e que a página toca), lance (o
//   classificado neste passo ou null), aceito, gol ({roteiro, dur} | null), imped ({roteiro, dur} | null)}
// (28/10) O passo depois do replay grava mais um passo no anel (o 1º sai): quem confere o roteiro usa `espera.anel`, o do
// momento do roteiro — na página a simulação fica parada enquanto o replay toca e o anel não anda (main.js
// seguraParaReplayParada no topo da volta; o anel só grava em rodarPasso). Conferido com o anel de DEPOIS do passo, o
// plano que começa no 1º passo do anel (a chave a < tv.antes s dele: o amarelo dado depois da vantagem) parecia fora dele
// (teste-replay-paradas P2, main, s207: plano [25062, 25179], anel do roteiro [25062, 25661], o de depois [25063, 25662]).
// Sem js/lances.js (a versão de antes): criarSimParadas devolve null.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export async function criarSimParadas(pastaJs, opc = {}) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  let LA, RR;
  try { LA = await imp('lances.js'); RR = await imp('render/replay-roteiro.js'); } catch (_) { return null; }
  if (!RR.roteiroParada) return null;
  const AG = await imp('render/autor-gol.js');
  const { criarGravador } = await import(pathToFileURL(path.join(AQUI, 'anel-node.mjs')).href);
  const GR = await criarGravador(pastaJs);
  const extras = opc.extras !== false;
  function novaPartida(semente, o = {}) {
    const S = GR.novaPartida(semente, { comoPagina: !!o.comoPagina, minutosPorTempo: o.minutosPorTempo, tecnicos: o.tecnicos });
    S.LC = LA.criarLances(); S.armado = null; S.ag = AG.criarAutorGol(); S.golPend = null; S.lancesLigado = o.lances !== false;
    S.ligado = o.ligado !== false;
    S.timeDe = id => { for (const j of S.m.jogadores) if (j.id === id) return j.time; return null; };
    return S;
  }
  function passo(S) {
    const { m } = S;
    const r = { ev: null, pred: false, espera: null, lance: null, aceito: false, gol: null, imped: null };
    // o topo da volta do laço (seguraParaReplayParada): a parada do lance acabou sem montagem → desarma; o passo seguinte
    // monta → o replay toca agora (a simulação espera) e o passo roda depois, no mesmo tick
    const lc = S.armado;
    if (lc) {
      const pr = m.parada;
      if (!m.partida || m.partida.estado !== 'parada' || !pr || pr.inicio !== lc.morta || pr.cobrador != null || !S.ligado) S.armado = null;
      else if (LA.montaNoProximoPasso(m)) {
        S.armado = null;
        const ro = RR.roteiroParada(S.a, lc);
        if (ro && ro.planos.length && ro.planos[0].ate > ro.planos[0].de) {
          LA.registrarReplay(S.LC, m.tick, 'parada');
          r.espera = { tick: m.tick, lance: lc, roteiro: ro, dur: RR.duracao(ro), anel: { primeiro: S.a.primeiro, ultimo: S.a.ultimo } };
        }
      }
    }
    r.pred = LA.montaNoProximoPasso(m);
    const ev = GR.passo(S);
    r.ev = ev;
    AG.autorEventos(S.ag, ev, m.tick, S.timeDe);
    // tratarEvento: o gol fica pendente; na saída (ou no intervalo / fim) o replay do gol; o impedimento no apito
    const eg = ev.find(e => e.tipo === 'gol');
    if (eg && m.partida) {
      const g = S.ag.gol, deAgora = g.ativo && g.tick === m.tick;
      S.golPend = {
        golTick: m.tick, chuteTick: S.ag.chute.ativo ? S.ag.chute.tick : null, lado: m.bola.p.x > 0 ? 1 : -1, time: eg.time,
        autor: deAgora ? g.id : (eg.autor ?? null), contra: deAgora ? !!g.contra : false, desvio: deAgora ? !!g.desvio : false,
        tipoChute: S.ag.chute.ativo ? S.ag.chute.tipo : null, extras,
      };
    }
    if (S.golPend && ev.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) {
      const ro = RR.roteiroGol(S.a, S.golPend);
      S.golPend = null;
      if (ro && S.ligado) { r.gol = { roteiro: ro, dur: RR.duracao(ro) }; LA.registrarReplay(S.LC, m.tick, 'gol'); }
    }
    const ei = ev.find(e => e.tipo === 'impedimento');
    if (ei && S.ligado) {
      const ro = RR.roteiroImpedimento(S.a, { fotoTick: ei.tickFoto, apitoTick: m.tick, linhaX: ei.linhaX, idImpedido: ei.id, time: ei.time, lado: m.ataca?.[ei.time] ?? 1, defensor: ei.defensor ?? null, por: ei.por ?? null });
      if (ro) { r.imped = { roteiro: ro, dur: RR.duracao(ro) }; LA.registrarReplay(S.LC, m.tick, 'impedimento'); }
    }
    // passoLances: o classificador lê o passo; gol, intervalo, fim, recomeço desarmam; o lance aceito arma
    if (S.lancesLigado) {
      const l = LA.lancesPasso(S.LC, m, ev);
      if (S.armado && ev.some(e => e.tipo === 'gol' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo' || e.tipo === 'recomeco' || e.tipo === 'saida')) S.armado = null;
      if (l) {
        r.lance = { ...l, ids: [...l.ids] };
        if (LA.decidirReplay(S.LC, l, { tempo: m.partida.tempo, ligado: S.ligado })) { S.armado = { ...l, ids: [...l.ids] }; r.aceito = true; }
      }
    }
    return r;
  }
  return { LA, RR, GR, C: GR.C, PA: GR.PA, novaPartida, passo };
}
