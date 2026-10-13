// Estados do MEIO da partida e cartões forçados para os testes das cenas em Node (tools/teste-cenas.mjs). O mesmo
// caminho do jogo: a partida IA × IA (entradaDemoPartida) anda até o tick pedido e a falta é montada por faltas.js
// montarFalta e decidida por partida.js regrasPartida (como __golaco.faltaDeTeste na página e o teste-faltas): o cartão
// sai pelos eventos de verdade (o 2º amarelo, o pênalti, o goleiro expulso, o cartão guardado que sai no gol). Só escreve
// no mundo do próprio teste.
//   const L = await carregarCenas(pastaJs);
//   estadoDoMeio(L, semente, ticks) → m
//   forcarCartao(L, m, situacao) → {m, eventos, tickCena} | null — situacao: 'amarelo' | 'vermelho' | 'segundo' |
//      'penalti' | 'vantagemGol' (o cartão guardado sai no gol; a cena é montada em gol + 149, como na página) | 'goleiro'
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function carregarCenas(pastaJs) {
  const imp = f => import(pathToFileURL(path.join(path.resolve(pastaJs), f)).href);
  return { P: await imp('partida.js'), F: await imp('faltas.js'), C: await imp('config.js'), S: await imp('sim.js') };
}

/** A partida IA × IA da semente andada até o tick (na bola rolando: se parou, anda até rolar de novo, no máx. +600). */
export function estadoDoMeio(L, semente, ticks) {
  const { P } = L;
  const m = P.criarPartida({ semente });
  for (let i = 0; i < ticks; i++) P.passoPartida(m, P.entradaDemoPartida(m), null);
  for (let i = 0; i < 600 && (m.partida.estado !== 'jogo' || m.naMao != null); i++) P.passoPartida(m, P.entradaDemoPartida(m), null);
  return m;
}

const porId = (m, id) => m.jogadores.find(j => j.id === id) ?? null;

/**
 * Força o cartão da situação no mundo m (estado do meio): o controlado do time 0 (ou o atacante mais perto da bola) sofre
 * a falta do adversário de linha mais perto (no 'goleiro', do goleiro do outro time). Devolve os eventos do tick do cartão
 * e o mundo no tick em que a cena começa.
 */
export function forcarCartao(L, m, situacao) {
  const { P, F, C } = L;
  const MX = C.CAMPO.meioX;
  // o pênalti e o goleiro expulso: o lance de verdade perto da área (um time com a bola a ≤ 30 m do gol que ataca; o
  // primeiro que acontecer, de qualquer um dos dois) — a falta dentro da área num estado com a bola no meio-campo deixava
  // a defesa longe (sem companheiro perto)
  if (situacao === 'penalti' || situacao === 'goleiro') {
    let achou = false;
    for (let i = 0; i < 6000 && !achou; i++) {
      const j = m.posse != null ? porId(m, m.posse) : null;
      if (m.partida.estado === 'jogo' && m.naMao == null && j && j.posicao !== 'GOL' && Math.hypot(j.x - m.ataca[j.time] * MX, j.z) <= 30) { achou = true; break; }
      P.passoPartida(m, P.entradaDemoPartida(m), null);
    }
    if (!achou) return null;
  }
  let c = porId(m, m.controlado?.[0]);
  if (situacao === 'penalti' || situacao === 'goleiro') c = porId(m, m.posse);
  if (!c || c.posicao === 'GOL') c = m.jogadores.find(j => j.time === 0 && j.posicao !== 'GOL');
  let d = null;
  if (situacao === 'goleiro') d = m.jogadores.find(j => j.time !== c.time && j.posicao === 'GOL');
  else {
    let dm = Infinity;
    for (const o of m.jogadores) { if (o.time === c.time || o.posicao === 'GOL') continue; const q = Math.hypot(o.x - c.x, o.z - c.z); if (q < dm) { dm = q; d = o; } }
  }
  if (!c || !d) return null;
  const lado = m.ataca[c.time];
  // a parada em andamento acaba
  const pr = m.parada;
  if (pr && pr.cobrador != null && pr.papel != null) { const c0 = porId(m, pr.cobrador); if (c0 && c0.papel === 'parado') c0.papel = pr.papel; }
  if (situacao === 'penalti' && !(c.x * lado > MX - 15 && Math.abs(c.z) < 18)) P.teleportar(c, lado * (MX - 11), Math.max(-12, Math.min(12, c.z)), lado > 0 ? 0 : Math.PI);
  if (situacao === 'goleiro') P.teleportar(c, lado * Math.max(MX - 22, Math.min(MX - 17, c.x * lado)), c.z * 0.5, lado > 0 ? 0 : Math.PI);
  if (situacao === 'vantagemGol') {
    // um gol com o cartão guardado (vantagem que acabou em gol): o cartão sai na parada do gol (bolaMorta 'saida')
    m.partida.cartoesPendentes.push({ id: d.id, cor: 'amarelo', motivo: 'spa' });
    m.posse = null; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
    const b = m.bola;
    // a bola entra perto da trave do lado contrário ao goleiro (ele não chega)
    const gk = m.jogadores.find(j => j.time !== c.time && j.posicao === 'GOL');
    const zb = gk && gk.z > 0 ? -2.7 : 2.7;
    b.p.x = lado * (MX - 0.5); b.p.y = 0.4; b.p.z = zb; b.v.x = lado * 16; b.v.y = 0; b.v.z = 0; b.rolando = false;
    if (b.w) { b.w.x = 0; b.w.y = 0; b.w.z = 0; }
    m.ultimoToque = { id: c.id, time: c.time, tick: m.tick };
    for (let i = 0; i < 30; i++) {
      const ev = P.passoPartida(m, P.entradaDemoPartida(m), null);
      if (ev.some(e => e.tipo === 'gol')) {
        const eventos = ev.slice();
        if (!eventos.some(e => e.tipo === 'cartao')) return null;
        const golTick = m.tick;
        // a página segura a simulação no gol + 149 (a comemoração); a cena do cartão copia o mundo dali
        while (m.tick < golTick + 149) P.passoPartida(m, P.entradaDemoPartida(m), null);
        return { m, eventos, tickCena: m.tick, golTick };
      }
    }
    return null;
  }
  P.teleportar(d, c.x - lado * 1.1, c.z + 0.3, lado > 0 ? 0 : Math.PI);
  c.vx = 0; c.vz = 0; d.vx = lado * 5; d.vz = 0;
  m.bola.p.x = c.x + lado * 0.4; m.bola.p.z = c.z; m.bola.p.y = C.BOLA.raio;
  m.posse = c.id; m.naMao = null; m.voo = null; m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null;
  if (situacao === 'segundo') m.partida.cartoes[d.id] = 1;
  const f = F.montarFalta(m, d, c, 'bote', true);
  f.cartao = situacao === 'vermelho' || situacao === 'goleiro' ? 'vermelho' : 'amarelo';
  if (situacao === 'vermelho') f.motivo = 'forcaExcessiva';
  if (situacao === 'goleiro') f.motivo = 'dogso';
  m.eventos = []; m.faltaPendente = f;
  P.regrasPartida(m);
  const eventos = m.eventos.slice();
  if (!eventos.some(e => e.tipo === 'cartao')) return null;
  return { m, eventos, tickCena: m.tick, punido: d.id, vitima: c.id };
}
