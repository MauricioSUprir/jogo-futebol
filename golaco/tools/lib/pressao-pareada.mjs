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
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function medirPressaoPareada(JS, { sementes = [1, 2], min = 4, T = 2, alcance = 15, modelos = ['persegue'] } = {}) {
  const imp = f => import(pathToFileURL(path.join(JS, f)).href);
  const P = await imp('partida.js'), S = await imp('sim.js'), CFG = await imp('config.js'), D = await imp('defesa.js');
  const { BOTAO, PASSO } = CFG;
  const NT = Math.round(T / PASSO);
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
          casos.push({ sem, tick: m.tick, modelo, d0, h0, A: ramo(A, false, modelo, d.id), B: ramo(B, true, modelo, d.id) });
          bloqueadoAte = m.tick + NT;
        }
      }
      ultimo = d ? d.id : (m.posse != null ? -2 : ultimo);
      P.passoPartida(m, P.entradaDemoPartida(m));
    }
  }
  return { casos, NT, PASSO };
}
