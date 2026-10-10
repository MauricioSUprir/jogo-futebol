// Medidas da partida 11×11 (Etapa 3) com as MESMAS definições da análise da Metrica
// (scratchpad etapa3/scripts/tatica_metrica.py; PESQUISA-ETAPA3.md §0) e dos jogos/estudos citados.
// Funções puras sobre o mundo, sem importar a lógica (servem para qualquer cópia: --js <pasta>).
//
// Referencial do time t: u = x · ataca (rumo do ataque, +), w = z · ataca (direita de quem ataca, +).
// Terços pela bola, no referencial de quem é medido: t1 = u_bola < −17,5 (meu terço), t2 = meio,
// t3 = u_bola ≥ 17,5. Corredores: centro |w| ≤ 9,16 · meio-espaço 9,16–20,16 · lateral > 20,16.
// "Jogadores de linha" = sem o goleiro (posicao 'GOL'); comprimento e largura do bloco são do
// mais recuado ao mais adiantado e do mais aberto de um lado ao do outro (FIFA EFI).

export const MEIO_X = 52.5, MEIO_Z = 34, TERCO = 17.5;
export const CORREDORES = [9.16, 20.16];
export const AREA = { u: 36, w: 20.16 };      // área adversária no referencial de quem ataca
export const FAIXAS_VEL = [0.2, 2, 4, 5.5, 7]; // m/s: parado | andando | trotando | correndo | alta | sprint
export const NOMES_FAIXAS = ['parado', 'andando', 'trotando', 'correndo', 'alta', 'sprint'];

export const ataca = (m, t) => m.ataca[t];
export const uDe = (m, t, x) => x * m.ataca[t];
export const wDe = (m, t, z) => z * m.ataca[t];

/** Jogador com a bola (no pé ou nas mãos) ou null. */
export function donoDaBola(m) {
  const id = m.naMao ?? m.posse;
  if (id == null) return null;
  for (const j of m.jogadores) if (j.id === id) return j;
  return null;
}

/** Time com a bola: o do dono, senão o do passe/chute no ar (m.voo), senão null (bola livre). */
export function timeComBola(m) {
  const d = donoDaBola(m);
  if (d) return d.time;
  return m.voo && m.voo.time != null ? m.voo.time : null;
}

/** Terço da bola (1, 2, 3) no referencial do time t. */
export function tercoDaBola(m, t) {
  const u = uDe(m, t, m.bola.p.x);
  return u < -TERCO ? 1 : u >= TERCO ? 3 : 2;
}

/** Jogadores de linha (sem o goleiro) do time t, na ordem de m.jogadores. */
export function deLinha(m, t) {
  return m.jogadores.filter(j => j.time === t && j.posicao !== 'GOL' && j.papel !== 'marcador' && j.papel !== 'parado');
}

/** Área do polígono convexo (casco de Andrew) dos pontos [{u, w}]. */
export function areaConvexa(pts) {
  if (pts.length < 3) return 0;
  const p = [...pts].sort((a, b) => a.u - b.u || a.w - b.w);
  const cruz = (o, a, b) => (a.u - o.u) * (b.w - o.w) - (a.w - o.w) * (b.u - o.u);
  const baixo = [], cima = [];
  for (const q of p) { while (baixo.length >= 2 && cruz(baixo[baixo.length - 2], baixo[baixo.length - 1], q) <= 0) baixo.pop(); baixo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (cima.length >= 2 && cruz(cima[cima.length - 2], cima[cima.length - 1], q) <= 0) cima.pop(); cima.push(q); }
  const casco = baixo.slice(0, -1).concat(cima.slice(0, -1));
  let a = 0;
  for (let i = 0; i < casco.length; i++) { const s = casco[i], e = casco[(i + 1) % casco.length]; a += s.u * e.w - e.u * s.w; }
  return Math.abs(a) / 2;
}

/**
 * Forma do time t agora. opc.grupos = Map/objeto id → 'def'|'mei'|'ata' (ex.: pelo grupo da vaga);
 * sem isso, as linhas saem pela profundidade como na Metrica (4 defesa, 4 meio, 2 frente).
 * Devolve {comp, larg, area, alturaLinha (m do defensor de linha mais recuado até a própria linha),
 * espalha4 (máx − mín de u dos 4 mais recuados), centroU, centroW, atrasDaBola (de linha entre a
 * bola e o próprio gol), defMeio, meioAtaque (distância entre as médias das linhas)}.
 */
export function forma(m, t, opc = {}) {
  const js = deLinha(m, t);
  const pts = js.map(j => ({ id: j.id, u: uDe(m, t, j.x), w: wDe(m, t, j.z) }));
  if (!pts.length) return null;
  const us = pts.map(p => p.u).sort((a, b) => a - b), ws = pts.map(p => p.w);
  const ub = uDe(m, t, m.bola.p.x);
  const linhaDe = p => {
    const g = opc.grupos instanceof Map ? opc.grupos.get(p.id) : opc.grupos?.[p.id];
    if (g) return g;
    const k = us.indexOf(p.u);
    return k < 4 ? 'def' : k < 8 ? 'mei' : 'ata';
  };
  const soma = { def: [0, 0], mei: [0, 0], ata: [0, 0] };
  for (const p of pts) { const g = linhaDe(p); soma[g][0] += p.u; soma[g][1]++; }
  const med = g => (soma[g][1] ? soma[g][0] / soma[g][1] : NaN);
  let cu = 0, cw = 0;
  for (const p of pts) { cu += p.u; cw += p.w; }
  return {
    comp: us[us.length - 1] - us[0],
    larg: Math.max(...ws) - Math.min(...ws),
    area: areaConvexa(pts),
    alturaLinha: us[0] + MEIO_X,
    espalha4: us[Math.min(3, us.length - 1)] - us[0],
    centroU: cu / pts.length, centroW: cw / pts.length,
    atrasDaBola: pts.filter(p => p.u < ub).length,
    defMeio: med('mei') - med('def'),
    meioAtaque: med('ata') - med('mei'),
  };
}

/**
 * Portador: o jogador do time com a bola mais perto dela, se estiver a ≤ 1,5 m (Metrica). null se
 * a bola está livre ou longe de todos.
 */
export function portador(m) {
  const t = timeComBola(m);
  if (t == null) return null;
  const b = m.bola.p;
  let mel = null, dm = Infinity;
  for (const j of deLinha(m, t)) { const d = Math.hypot(j.x - b.x, j.z - b.z); if (d < dm) { dm = d; mel = j; } }
  const d = donoDaBola(m);
  if (d && d.posicao === 'GOL') return null; // goleiro com a bola: não é jogo corrido
  return mel && dm <= 1.5 ? mel : null;
}

/** Distâncias (ordenadas) dos jogadores de linha do time que defende até o portador, ou null. */
export function distanciasAoPortador(m) {
  const p = portador(m);
  if (!p) return null;
  return deLinha(m, 1 - p.time).map(o => Math.hypot(o.x - p.x, o.z - p.z)).sort((a, b) => a - b);
}

/**
 * Linhas de passe livres do jogador j (Steiner 2018): companheiros de linha a ≤ raio m sem nenhum
 * adversário a menos de `cone` (12°) da linha, entre o passador e o recebedor.
 */
export function linhasLivres(m, j, raio = 30, cone = 12 * Math.PI / 180) {
  let n = 0;
  for (const o of m.jogadores) {
    if (o.time !== j.time || o === j || o.posicao === 'GOL') continue;
    const dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz);
    if (d > raio || d < 1e-6) continue;
    let livre = true;
    for (const a of m.jogadores) {
      if (a.time === j.time) continue;
      const ax = a.x - j.x, az = a.z - j.z, da = Math.hypot(ax, az);
      if (da < 1e-6 || da > d + 1) continue;
      const ang = Math.acos(Math.max(-1, Math.min(1, (ax * dx + az * dz) / (da * d))));
      if (ang < cone) { livre = false; break; }
    }
    if (livre) n++;
  }
  return n;
}

/** Distância do companheiro de linha mais perto de j. */
export function companheiroMaisPerto(m, j) {
  let dm = Infinity;
  for (const o of m.jogadores) if (o.time === j.time && o !== j && o.posicao !== 'GOL') dm = Math.min(dm, Math.hypot(o.x - j.x, o.z - j.z));
  return dm;
}

/**
 * Companheiros a ≤ 30 m de j por setor em relação ao rumo do ataque: à frente (|ângulo| < 60°),
 * atrás (> 120°) ou de lado. Devolve {frente, lado, atras}.
 */
export function setoresApoio(m, j, raio = 30) {
  const r = { frente: 0, lado: 0, atras: 0 }, lado = m.ataca[j.time];
  for (const o of m.jogadores) {
    if (o.time !== j.time || o === j || o.posicao === 'GOL') continue;
    const du = (o.x - j.x) * lado, dw = (o.z - j.z) * lado, d = Math.hypot(du, dw);
    if (d > raio || d < 1e-6) continue;
    const a = Math.abs(Math.atan2(dw, du));
    if (a < Math.PI / 3) r.frente++; else if (a > 2 * Math.PI / 3) r.atras++; else r.lado++;
  }
  return r;
}

/** Corredor de w: 0 lateral esquerdo · 1 meio-espaço esquerdo · 2 centro · 3 meio-espaço direito · 4 lateral direito. */
export function corredor(w) {
  const a = Math.abs(w);
  if (a <= CORREDORES[0]) return 2;
  if (a <= CORREDORES[1]) return w > 0 ? 3 : 1;
  return w > 0 ? 4 : 0;
}

/** Jogadores de linha do time t dentro da área adversária (u > 36, |w| < 20,16). */
export function naAreaAdversaria(m, t) {
  let n = 0;
  for (const j of deLinha(m, t)) if (uDe(m, t, j.x) > AREA.u && Math.abs(wDe(m, t, j.z)) < AREA.w) n++;
  return n;
}

/**
 * Linha de impedimento para o time t (que ataca): max(penúltimo adversário com o goleiro, bola, 0),
 * no referencial de t. E se alguém de linha de t está além dela (posição de impedimento).
 */
export function impedimento(m, t) {
  const adv = m.jogadores.filter(o => o.time !== t).map(o => uDe(m, t, o.x)).sort((a, b) => b - a);
  const linha = Math.max(adv.length >= 2 ? adv[1] : -Infinity, uDe(m, t, m.bola.p.x), 0);
  let maisAdiantado = -Infinity, alguem = false;
  for (const j of deLinha(m, t)) {
    const u = uDe(m, t, j.x);
    maisAdiantado = Math.max(maisAdiantado, u);
    if (u > linha && u > 0) alguem = true;
  }
  return { linha, ateLinha: linha - maisAdiantado, alguem };
}

/** Faixa de velocidade (índice em NOMES_FAIXAS) de v m/s. */
export function faixaVel(v) {
  let k = 0;
  while (k < FAIXAS_VEL.length && v >= FAIXAS_VEL[k]) k++;
  return k;
}

/**
 * Rastreia as trocas de posse entre os times (ignora a bola livre: a posse muda quando o OUTRO time
 * passa a ter a bola). atualizar(m) → null | {de, para, tick, x, z} (x, z = onde a bola estava).
 */
export function criarRastreioPosse() {
  let atual = null;
  return {
    get time() { return atual; },
    atualizar(m) {
      const t = timeComBola(m);
      if (t == null || t === atual) return null;
      const ant = atual;
      atual = t;
      return ant == null ? null : { de: ant, para: t, tick: m.tick, x: m.bola.p.x, z: m.bola.p.z };
    },
  };
}

/**
 * PPDA no estilo Wyscout (PESQUISA-ETAPA3.md §4.1): passes do time que constrói nos 60% do campo
 * mais perto do gol DELE (u do passador < +10,5) ÷ ações defensivas do outro time na mesma zona
 * (u do defensor > −10,5): desarmes (evento 'roubada'), interceptações (o passe do adversário no ar
 * termina no pé/nas mãos de um defensor de linha) e bloqueios de passe (a bola de um passe do
 * adversário bate no corpo de um defensor, 'bateuCorpo'). Chamar atualizar(m, eventos) a cada passo.
 */
export function criarContadorPPDA() {
  const passes = { 0: 0, 1: 0 }, acoes = { 0: 0, 1: 0 };
  let vooAnt = null;
  const jog = (m, id) => m.jogadores.find(o => o.id === id);
  return {
    passes, acoes,
    atualizar(m, eventos) {
      for (const e of eventos) {
        if (e.tipo === 'passe') {
          const j = jog(m, e.id);
          if (j && uDe(m, j.time, j.x) < 0.1 * 2 * MEIO_X) passes[j.time]++;
        } else if (e.tipo === 'roubada' || (e.tipo === 'bateuCorpo' && vooAnt && vooAnt.tipo !== 'chute')) {
          const j = jog(m, e.id);
          if (!j || j.posicao === 'GOL') continue;
          if (e.tipo === 'bateuCorpo' && vooAnt.time === j.time) continue;
          if (uDe(m, j.time, j.x) > -0.1 * 2 * MEIO_X) acoes[j.time]++;
        }
      }
      // interceptação: havia um passe do adversário no ar e agora a bola é de um defensor de linha
      const d = donoDaBola(m);
      if (vooAnt && vooAnt.tipo !== 'chute' && d && d.time !== vooAnt.time && d.posicao !== 'GOL' && uDe(m, d.time, d.x) > -0.1 * 2 * MEIO_X) acoes[d.time]++;
      vooAnt = m.voo && m.posse == null ? { time: m.voo.time, tipo: m.voo.tipo === 'chute' || m.voo.tipo === 'colocado' || m.voo.tipo === 'cavadinha' ? 'chute' : m.voo.tipo } : (d ? null : vooAnt);
    },
    /** PPDA do time que DEFENDE t: passes do adversário ÷ ações de t. */
    ppda(t) { return passes[1 - t] / Math.max(1, acoes[t]); },
  };
}
