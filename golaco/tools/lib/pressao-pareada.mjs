// Medida PAREADA do botão PRESSÃO do humano na partida 11×11 (pedido do dono, 11/10: "o botão de pressão não
// funciona"). Partidas IA × IA (a IA joga pelo controlado do time 0 pela entradaDemoPartida); a cada posse nova do
// adversário (jogador de linha do time 1 com a bola no pé, no chão, fora de bola parada) com um companheiro do humano
// (≠ controlado, ≠ goleiro) a ≤ `alcance` m do condutor, o mundo é copiado (copiarMundo) e roda T s em dois ramos com a
// MESMA entrada do humano pelo `modelo`:
//   A = sem o botão;  B = PRESSÃO segurado o tempo todo.
// Modelos do humano: 'parado' (analógico solto) e 'persegue' (analógico na bola, CORRER a mais de 4 m dela — o jogador
// típico). A partida principal segue pela demo (não aperta nada), então os casos são os mesmos com e sem a mudança.
// Devolve os casos: {sem, tick, modelo, d0 (companheiro mais perto no começo), h0 (os dois ramos começam com o mesmo
// hash), A, B}, cada ramo com: d[i] (distância do companheiro mais perto ao condutor do começo, enquanto ele tem a bola),
// t2 (s até ≤ 2 m), alcBote (s até a bola ficar ao alcance do bote de um companheiro), faltas (do time 0), perdeu (s em
// que o condutor do começo perdeu a bola), e no ramo B: corre/correTot (ticks do escolhido a > 4 m do condutor, ≥ 0,5 s
// depois de escolhido, a ≥ vCorrida / no total), marcaOk/marcaTot (ticks com o pedido valendo e um condutor adversário
// em que o escolhido aparece para o desenho), p1Dobra/p1Tot (ticks com o 1º homem da IA ≠ controlado já apertando por
// conta própria em que o escolhido é OUTRO jogador).
// Com `tres: true` (D1, 23/10: "preciso do botão de pressão funcionando" — medido como o dono joga, sobre TODAS as
// posses, não só as longas), cada caso roda também três ramos de 3 s com o humano PARADO (analógico solto): A3 sem o
// botão, P1 com o PRESSÃO 1 s (um toque segurado e solto) e P3 com ele segurado os 3 s. Em cada um: `g` (o time 0 ganha
// a bola — no pé ou nas mãos — antes de qualquer parada ou falta dele), `f` (faltas do time 0); com o botão, `rb`
// (roubadas do chamado); no P3, `tr` (trocas do chamado: o escolhido que aparece no desenho passa a ser outro), e os passos
// com a bola ao alcance do bote do chamado (≤ ACOES.boteIA.alcance m dele, condutor adversário) fora das duas travas que
// ficam — nas costas do condutor (faltas.js chegada) e o corpo entrando (forcaContato > FALTAS.forca.min) — e fora do
// descanso de outro bote: `alc` (todos), `lib` (o bote do chamado liberado: defesa.js boteContidoDoChamado; na lógica
// antiga, a regra antiga — pela velocidade absoluta); e `ct` (o CONTROLADO chega a ≤ 1 m do condutor adversário: a C1,
// DEFESA_HUMANO.pressao.controlado).
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function medirPressaoPareada(JS, { sementes = [1, 2], min = 4, T = 2, alcance = 15, modelos = ['persegue'], tres = false } = {}) {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const P = await imp('partida.js'), S = await imp('sim.js'), CFG = await imp('config.js'), D = await imp('defesa.js');
  const FA = await imp('faltas.js');
  const { BOTAO, PASSO } = CFG;
  const NT = Math.round(T / PASSO), N3 = Math.round(3 / PASSO), N1 = Math.round(1 / PASSO);
  // a trava do bote do chamado (sim.js boteIA); na lógica de antes do D1, a regra de então (velocidade absoluta)
  const contido = D.boteContidoDoChamado ?? ((m, j, dono) => (Math.hypot(j.vx, j.vz) > CFG.FALTAS.bote.vLivre ? 'embalado'
    : FA.chegada(j, dono) === 'tras' ? 'tras' : FA.forcaContato(m, j, dono) > CFG.FALTAS.forca.min ? 'corpo' : null));
  // o escolhido do PRESSÃO que o desenho mostra (defesa.js pressionadorVisivel; na lógica antiga, o cache do tick)
  const visivel = D.pressionadorVisivel ?? ((m, t) => { const c = m.pressaoHumano?.[t]; return c && c.tick === m.tick - 1 ? c.id : -1; });

  function condutorAdv(m) {
    if (m.posse == null || m.naMao != null) return null;
    if (m.parada && !m.parada.rolou) return null;
    if (m.bola.p.y > 0.5) return null;
    const d = S.jogadorPorId(m, m.posse);
    return d && d.time === 1 && d.posicao !== 'GOL' ? d : null;
  }
  function maisPerto(m, d) {
    let dm = Infinity;
    for (const o of m.jogadores) {
      if (o.time !== 0 || o.posicao === 'GOL' || o.id === m.controlado[0]) continue;
      dm = Math.min(dm, Math.hypot(o.x - d.x, o.z - d.z));
    }
    return dm;
  }
  function entradaHumano(m, modelo) {
    const j = S.jogadorPorId(m, m.controlado[0]);
    if (!j || modelo === 'parado') return { x: 0, z: 0, botoes: 0 };
    const dx = m.bola.p.x - j.x, dz = m.bola.p.z - j.z, d = Math.hypot(dx, dz) || 1;
    return { x: dx / d, z: dz / d, botoes: d > 4 ? BOTAO.CORRER : 0 };
  }
  function ramo(m, com, modelo, cond0) {
    const r = { d: [], t2: null, alcBote: null, faltas: 0, origens: {}, perdeu: null, corre: 0, correTot: 0, corre1: 0, correTot1: 0, dj: {}, esc1: -1, marcaOk: 0, marcaTot: 0, p1Dobra: 0, p1Tot: 0, rouba: false, choques: 0 };
    let segue = true, esc = -1, escDesde = 0, spAnt = -1;
    for (let i = 1; i <= NT; i++) {
      const dAntes = condutorAdv(m);
      const e = entradaHumano(m, modelo);
      const ev = P.passoPartida(m, com ? { ...e, botoes: (e.botoes | 0) | BOTAO.PRESSAO } : e);
      for (const x of ev) {
        if (x.tipo === 'falta' && x.def != null && S.jogadorPorId(m, x.def)?.time === 0) { r.faltas++; r.origens[x.origem] = (r.origens[x.origem] ?? 0) + 1; }
        if (x.tipo === 'roubada' && x.id != null && S.jogadorPorId(m, x.id)?.time === 0) r.rouba = true;
      }
      const d = condutorAdv(m);
      // distância de cada companheiro ao condutor do começo em 0,5 / 1 / 1,5 / 2 s (o escolhido de B, medido também em A)
      if (i % 30 === 0) {
        const c0 = S.jogadorPorId(m, cond0), q = r.dj[i] = {};
        if (c0 && d && d.id === cond0) for (const o of m.jogadores) if (o.time === 0 && o.posicao !== 'GOL' && o.id !== m.controlado[0]) q[o.id] = Math.hypot(o.x - c0.x, o.z - c0.z);
      }
      if (com) {
        const id = visivel(m, 0);
        if (r.esc1 < 0 && id >= 0) r.esc1 = id;
        // (a partir do 2º passo com o botão: no 1º o pedido ainda não estava gravado quando o time decidiu)
        if (i >= 2 && dAntes && D.pressaoPedida(m, 0)) { r.marcaTot++; if (id >= 0) r.marcaOk++; }
        const q = id >= 0 ? S.jogadorPorId(m, id) : null;
        // trombada do escolhido em disparada com quem não é o condutor (sim.js colisaoCorpos: a velocidade cai > 0,6 m/s num
        // passo, correndo a mais de 3 m/s, com alguém além do condutor a menos de 0,7 m)
        if (q && id === esc && d) {
          const sp = Math.hypot(q.vx, q.vz);
          if (spAnt > 3 && spAnt - sp > 0.6) {
            for (const o of m.jogadores) if (o !== q && o.id !== d.id && Math.hypot(o.x - q.x, o.z - q.z) < 0.7) { r.choques++; break; }
          }
        }
        spAnt = q ? Math.hypot(q.vx, q.vz) : -1;
        if (id !== esc) { esc = id; escDesde = i; }
        if (q && d && Math.hypot(q.x - d.x, q.z - d.z) > 4 && (i - escDesde) * PASSO >= 0.5) {
          r.correTot++;
          if (Math.hypot(q.vx, q.vz) >= q.par.vCorrida) r.corre++;
          if ((i - escDesde) * PASSO >= 1.0) { r.correTot1++; if (Math.hypot(q.vx, q.vz) >= q.par.vCorrida) r.corre1++; }
        }
        const B = m.iaBloco?.[0];
        if (B && d && id >= 0 && B.p1 >= 0 && B.p1 !== m.controlado[0] && B.apertaProprio) { r.p1Tot++; if (id !== B.p1) r.p1Dobra++; }
      }
      if (d && r.alcBote == null) {
        const bx = m.bola.p.x, bz = m.bola.p.z, dD = Math.hypot(bx - d.x, bz - d.z);
        for (const o of m.jogadores) {
          if (o.time === 0 && o.posicao !== 'GOL' && o.id !== m.controlado[0] && Math.hypot(bx - o.x, bz - o.z) <= 0.65 && dD >= 0.35) { r.alcBote = i * PASSO; break; }
        }
      }
      if (!segue) continue;
      if (!d || d.id !== cond0) { segue = false; r.perdeu = i * PASSO; continue; }
      const mp = maisPerto(m, d);
      r.d[i] = mp;
      if (r.t2 == null && mp <= 2) r.t2 = i * PASSO;
    }
    return r;
  }

  // um ramo de 3 s com o humano parado e o PRESSÃO segurado nos `segura` primeiros passos
  function ramo3(m, segura) {
    const r = { g: 0, f: 0, rb: 0, tr: 0, alc: 0, lib: 0, ct: 0 };
    let res = false, escAnt = -1, cham = -1;
    for (let i = 1; i <= N3; i++) {
      const ev = P.passoPartida(m, { x: 0, z: 0, botoes: i <= segura ? BOTAO.PRESSAO : 0 });
      for (const x of ev) {
        const q = x.id != null ? S.jogadorPorId(m, x.id) : null;
        if (x.tipo === 'falta' && x.def != null && S.jogadorPorId(m, x.def)?.time === 0) { r.f++; res = true; }
        if (x.tipo === 'roubada' && q && q.time === 0 && x.id === cham) r.rb++;
      }
      if (!res) {
        const dono = m.naMao ?? m.posse, o = dono != null ? S.jogadorPorId(m, dono) : null;
        if (o && o.time === 0) { r.g = 1; res = true; } else if (m.parada && !m.parada.rolou && m.parada.inicio === m.tick) res = true;
      }
      if (!r.ct) {
        const d = condutorAdv(m), c = S.jogadorPorId(m, m.controlado[0]);
        if (d && c && Math.hypot(c.x - d.x, c.z - d.z) <= 1) r.ct = 1;
      }
      if (segura === 0) continue;
      const id = visivel(m, 0);
      if (id >= 0) cham = id;
      if (segura < N3) continue;
      if (i >= 2 && id >= 0) { if (escAnt >= 0 && id !== escAnt) r.tr++; escAnt = id; }
      const d = condutorAdv(m), q = id >= 0 ? S.jogadorPorId(m, id) : null;
      if (!d || !q || (q.descansoBote ?? 0) > 0) continue;
      if (Math.hypot(m.bola.p.x - q.x, m.bola.p.z - q.z) > CFG.ACOES.boteIA.alcance) continue;
      if (FA.chegada(q, d) === 'tras' || FA.forcaContato(m, q, d) > CFG.FALTAS.forca.min) continue;
      r.alc++;
      if (!contido(m, q, d)) r.lib++;
    }
    return r;
  }

  const casos = [];
  for (const sem of sementes) {
    const modelo = modelos[(sem - sementes[0]) % modelos.length];
    const m = P.criarPartida({ semente: sem, minutosPorTempo: min });
    const N = Math.round(2 * min * 60 / PASSO) + 3000;
    let ultimo = -1, bloqueadoAte = -1;
    for (let i = 0; i < N && m.partida.estado !== 'fim'; i++) {
      const d = condutorAdv(m);
      if (d && d.id !== ultimo && m.tick >= bloqueadoAte) {
        const d0 = maisPerto(m, d);
        if (d0 <= alcance) {
          const A = S.copiarMundo(m), B = S.copiarMundo(m);
          const h0 = S.hashMundo(A) === S.hashMundo(B);
          const caso = { sem, tick: m.tick, modelo, d0, h0, A: ramo(A, false, modelo, d.id), B: ramo(B, true, modelo, d.id) };
          if (tres) caso.t3 = { A3: ramo3(S.copiarMundo(m), 0), P1: ramo3(S.copiarMundo(m), N1), P3: ramo3(S.copiarMundo(m), N3) };
          casos.push(caso);
          bloqueadoAte = m.tick + NT;
        }
      }
      ultimo = d ? d.id : (m.posse != null ? -2 : ultimo);
      P.passoPartida(m, P.entradaDemoPartida(m));
    }
  }
  return { casos, NT, PASSO };
}
