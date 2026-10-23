// O GUARDADOR DE LANCES em Node, EXATAMENTE como a página (main.js guardarGolPendente / guardarParadaPendente /
// guardarAgora), por cima dos replays nas paradas em Node (lib/paradas-node.mjs): a partida IA × IA gravando o anel, o
// classificador lendo cada passo e, além do que a página toca,
//  - o gol: pendente no passo do gol e guardado no passo da saída, do intervalo ou do fim — com ou sem replay;
//  - a parada: TODO lance classificado (aceito ou não) fica pendente e é guardado no topo da volta, ANTES do replay de
//    parada, quando o próximo passo monta a bola parada ou acaba o tempo (lances.js montaNoProximoPasso);
//  - as batidas da bola na rede (rede-onda.js detectarImpactos + registrarImpacto, no relógio do anel: tick × PASSO) num
//    anel das 8 últimas, como o main.js estadioPasso.
//   const GN = await criarSimGuarda(pastaJs);  const S = GN.novaPartida(semente, {ligado});  const r = GN.passo(S)
//   r = o do paradas-node + {guardou: [{tipo, classe, lance (a cópia guardada), k, jan ({de, ate} | null), anel: {primeiro,
//   ultimo}, quando ('gol' | 'parada'), pred}]} — os guardados ANTES deste passo (a parada, no topo) e DEPOIS dele (o gol)
// Sem render/lances-guarda.js (a versão de antes): criarSimGuarda devolve null.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));

export async function criarSimGuarda(pastaJs, opc = {}) {
  const imp = f => import(pathToFileURL(path.join(pastaJs, f)).href);
  let LG, CC;
  try { LG = await imp('render/lances-guarda.js'); CC = await imp('cenas-config.js'); } catch (_) { return null; }
  if (!LG.guardar || !CC.LANCES_GUARDA) return null;
  const RO = await imp('render/rede-onda.js');
  const { criarSimParadas } = await import(pathToFileURL(path.join(AQUI, 'paradas-node.mjs')).href);
  const P = await criarSimParadas(pastaJs, opc);
  if (!P) return null;
  const { C, LA } = P;
  const NJ = P.GR.NJ;
  function novaPartida(semente, o = {}) {
    const S = P.novaPartida(semente, o);
    S.G = o.guarda ?? LG.criarGuarda(CC.LANCES_GUARDA, { vagas: C.REPLAY.vagas, nj: NJ });
    if (!o.guarda) S.mini = LG.criarMini(S.G);
    S.ondas = RO.criarOndas();
    S.bat = Array.from({ length: 8 }, () => ({ ativo: false, t0: 0, x: 0, y: 0, z: 0, plano: 0, amp: 0, dx: 0, dy: 0, dz: 0 }));
    S.batK = 0; S.imp = [];
    S.golG = null; S.lanceG = null;
    S.p0 = { x: 0, y: 0, z: 0 }; S.v0 = { x: 0, y: 0, z: 0 };
    return S;
  }
  function guardar(S, l, quando, out) {
    const a = S.a;
    const jan = LG.janelaDoLance(S.G, a, l, { de: -1, ate: -1 });
    const k = LG.guardar(S.G, a, l, S.bat);
    out.push({ tipo: l.tipo, classe: l.classe, lance: l, k, jan: jan ? { ...jan } : null, anel: { primeiro: a.primeiro, ultimo: a.ultimo }, quando, tick: S.m.tick });
  }
  function passo(S) {
    const { m } = S;
    const guardou = [];
    // o topo da volta (main.js seguraParaReplayParada → guardarParadaPendente): ANTES do replay de parada
    const lg = S.lanceG;
    if (lg) {
      const pr = m.parada;
      if (!m.partida || m.partida.estado !== 'parada' || !pr || pr.inicio !== lg.morta || pr.cobrador != null) S.lanceG = null;
      else {
        const pred = LA.montaNoProximoPasso(m);
        if (pred) { S.lanceG = null; guardar(S, lg, 'parada', guardou); guardou[guardou.length - 1].pred = pred; }
      }
    }
    const b = m.bola;
    S.p0.x = b.p.x; S.p0.y = b.p.y; S.p0.z = b.p.z; S.v0.x = b.v.x; S.v0.y = b.v.y; S.v0.z = b.v.z;
    const golAntes = S.golPend;
    const r = P.passo(S);
    const ev = r.ev;
    // as batidas na rede (main.js estadioPasso; o relógio do anel-node é tick × PASSO)
    const n = RO.detectarImpactos(S.p0, S.v0, m.bola.p, m.bola.v, S.imp);
    for (let q = 0; q < n; q++) {
      const it = RO.registrarImpacto(S.ondas, S.imp[q], m.tick * C.PASSO);
      if (!it) continue;
      const bt = S.bat[S.batK++ % S.bat.length];
      bt.ativo = true; bt.t0 = it.t0; bt.x = it.x; bt.y = it.y; bt.z = it.z; bt.plano = it.plano; bt.amp = it.amp; bt.dx = it.dx; bt.dy = it.dy; bt.dz = it.dz;
    }
    // o gol (tratarEvento): pendente no passo dele; guardado na saída, no intervalo ou no fim (com ou sem replay)
    if (ev.some(e => e.tipo === 'gol') && m.partida && S.golPend && S.golPend !== golAntes) {
      const g = S.golPend;
      S.golG = {
        tipo: 'gol', classe: 'gol', chave: g.chuteTick ?? Math.max(0, g.golTick - 45), fim: g.golTick, morta: g.golTick, lado: g.lado,
        time: g.time, ids: g.autor != null ? [g.autor] : [], x: m.bola.p.x, z: m.bola.p.z, tempo: m.partida.tempo,
      };
    }
    if (S.golG && ev.some(e => e.tipo === 'saida' || e.tipo === 'intervalo' || e.tipo === 'fimDeJogo')) { const g = S.golG; S.golG = null; guardar(S, g, 'gol', guardou); }
    // a parada classificada (passoLances): toda, com ou sem replay
    if (r.lance && m.partida) S.lanceG = { ...r.lance, ids: [...r.lance.ids], tempo: m.partida.tempo };
    r.guardou = guardou;
    return r;
  }
  return { ...P, LG, CC, RO, NJ, novaPartida, passo };
}
