// O humano ROTEIRIZADO do time 0 (era do teste-transicao.mjs; também usado pelo medir-corrida.mjs): o controlado joga por
// um roteiro simples e determinístico. 'agressivo' (padrão): passa para a frente e conduz em disparada; 'conduz': só
// conduz para o gol em disparada e chuta perto; 'calmo': segura e toca; 'passivo': o 'calmo' que não defende. Defendendo
// (menos no 'passivo'): TROCAR para o mais perto, corre no condutor e dá DIVIDIDA.
// gerador local (não mexe no m.rng: o mundo sorteia o mesmo que sortearia com o humano de verdade)
export function sorteio(st) { st.s ^= st.s << 13; st.s >>>= 0; st.s ^= st.s >>> 17; st.s ^= st.s << 5; st.s >>>= 0; return st.s / 4294967296; }

/** Entrada do humano roteirizado: {x, z, botoes} no mundo para o controlado do time 0. */
export function entradaRoteiro(m, M, B, st, ROTEIRO = 'agressivo') {
  const j = m.jogadores.find(o => o.id === m.controlado[0]);
  if (!j || m.partida.estado !== 'jogo') return { x: 0, z: 0, botoes: 0 };
  const lado = m.ataca[0], gx = lado * 52.5, b = m.bola.p;
  // botão carregando: segura até soltar (o analógico fica no alvo)
  if (st.carga) {
    const c = st.carga;
    if (m.tick < c.ate && m.posse === j.id) return { x: c.x, z: c.z, botoes: c.bot };
    st.carga = null;
    return { x: c.x, z: c.z, botoes: 0 };
  }
  const pr = m.parada;
  if (pr && !pr.rolou) {
    // bola parada do humano: espera e passa curto para o mais perto (o cobrador é o controlado)
    if (pr.cobrador === j.id && m.tick - pr.desde > 50) {
      const o = maisPerto(m, j, q => q.time === 0 && q !== j && q.posicao !== 'GOL');
      if (o) { const d = dir(j, o.x, o.z); st.carga = { bot: B.PASSE, x: d.x, z: d.z, ate: m.tick + 15 }; return { x: d.x, z: d.z, botoes: B.PASSE }; }
    }
    return { x: 0, z: 0, botoes: 0 };
  }
  const CONDUZ = ROTEIRO === 'conduz';
  // 'calmo': segura a bola trotando para a frente e toca para o companheiro livre mais perto depois de 1,5–3 s (a posse
  // de quem não arranca: mede se a IA vai buscar a bola ou fica esperando no bloco)
  if ((ROTEIRO === 'calmo' || ROTEIRO === 'passivo') && m.posse === j.id) {
    if (st.id !== j.id) { st.id = j.id; st.desde = m.tick; st.espera = Math.round((1.5 + 1.5 * sorteio(st)) * 60); }
    const dGol = Math.hypot(gx - j.x, j.z);
    if (dGol < 22 && Math.abs(j.z) < 16) { const d = dir(j, gx, 0); st.carga = { bot: B.CHUTE, x: d.x, z: d.z, ate: m.tick + 30 }; return { x: d.x, z: d.z, botoes: B.CHUTE }; }
    if (m.tick - st.desde >= st.espera) {
      let mel = null, nm = -Infinity;
      for (const o of m.jogadores) {
        if (o.time !== 0 || o === j || o.posicao === 'GOL') continue;
        const l = Math.hypot(o.x - j.x, o.z - j.z);
        if (l < 5 || l > 25) continue;
        let marc = Infinity;
        for (const q of m.jogadores) if (q.time === 1) marc = Math.min(marc, Math.hypot(q.x - o.x, q.z - o.z));
        const n = Math.min(marc, 8) - l / 10;
        if (n > nm) { nm = n; mel = o; }
      }
      if (mel) { const d = dir(j, mel.x, mel.z); st.carga = { bot: B.PASSE, x: d.x, z: d.z, ate: m.tick + 15 }; st.desde = m.tick; return { x: d.x, z: d.z, botoes: B.PASSE }; }
      st.espera += 30;
    }
    const d = dir(j, gx, j.z * 0.8);
    return { x: d.x * 0.5, z: d.z * 0.5, botoes: 0 };
  }
  if (m.posse === j.id) {
    if (st.id !== j.id) { st.id = j.id; st.desde = m.tick; st.espera = Math.round((0.5 + sorteio(st)) * 60); }
    const dGol = Math.hypot(gx - j.x, j.z);
    if (dGol < (CONDUZ ? 20 : 28) && Math.abs(j.z) < 18) {
      const d = dir(j, gx, -j.z * 0.3);
      st.carga = { bot: B.CHUTE, x: d.x, z: d.z, ate: m.tick + 30 };
      return { x: d.x, z: d.z, botoes: B.CHUTE };
    }
    // 'conduz': só conduz para o gol em disparada (o contra-ataque individual) e chuta perto
    if (CONDUZ) { const d = dir(j, gx, j.z * 0.5); return { x: d.x, z: d.z, botoes: B.CORRER }; }
    if (m.tick - st.desde >= st.espera) {
      // passe para o companheiro mais à frente com a linha mais livre (a mira do acoes.js acha quem está no cone);
      // para a frente e longe (> 12 m à frente), metade das vezes pela ENFIADA: o contra-ataque rápido
      let mel = null, nm = -Infinity;
      for (const o of m.jogadores) {
        if (o.time !== 0 || o === j || o.posicao === 'GOL') continue;
        const l = Math.hypot(o.x - j.x, o.z - j.z);
        if (l < 6 || l > 32) continue;
        let marc = Infinity;
        for (const q of m.jogadores) if (q.time === 1) marc = Math.min(marc, Math.hypot(q.x - o.x, q.z - o.z));
        const n = (o.x - j.x) * lado / 10 + Math.min(marc, 6) / 6 - l / 60;
        if (n > nm) { nm = n; mel = o; }
      }
      if (mel) {
        const d = dir(j, mel.x, mel.z);
        const bot = (mel.x - j.x) * lado > 12 && sorteio(st) < 0.5 ? B.ENFIADA : B.PASSE;
        st.carga = { bot, x: d.x, z: d.z, ate: m.tick + 18 }; st.desde = m.tick; return { x: d.x, z: d.z, botoes: bot };
      }
      st.espera += 30;
    }
    // conduz para o gol, em disparada
    const d = dir(j, gx, j.z * 0.6);
    return { x: d.x * 0.95, z: d.z * 0.95, botoes: B.CORRER };
  }
  st.id = -1;
  const tb = M.timeComBola(m);
  // 'passivo': com a bola, igual ao 'calmo'; sem ela, não troca nem persegue (mede se os companheiros apertam sozinhos)
  if (ROTEIRO === 'passivo' && tb === 1) return { x: 0, z: 0, botoes: 0 };
  if (tb === 1 && m.naMao == null) {
    // defendendo: TROCAR para o mais perto da bola quando o controlado está longe (borda a cada 1 s)
    const dB = Math.hypot(b.x - j.x, b.z - j.z);
    if (dB > 14 && m.tick - (st.troca ?? -999) > 60) { st.troca = m.tick; return { x: 0, z: 0, botoes: B.TROCAR }; }
    // corre no condutor (entre ele e o gol) e dá DIVIDIDA de perto, de vez em quando
    const gy = -lado * 52.5;
    const tx = b.x + (gy - b.x) * 0.04, tz = b.z * 0.96;
    const d = dir(j, tx, tz);
    let bot = dB > 3 ? B.CORRER : 0;
    if (dB < 1.6 && sorteio(st) < 0.08) bot |= B.DIVIDIDA;
    return { x: d.x, z: d.z, botoes: bot };
  }
  // o próprio time com a bola (ou bola livre): vai um pouco para a frente, trotando
  const d = dir(j, j.x + lado * 6, j.z * 0.9);
  return { x: d.x * 0.5, z: d.z * 0.5, botoes: 0 };
}
function dir(j, x, z) { const dx = x - j.x, dz = z - j.z, l = Math.hypot(dx, dz) || 1; return { x: dx / l, z: dz / l }; }
function maisPerto(m, j, f) { let mel = null, dm = Infinity; for (const o of m.jogadores) if (f(o)) { const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < dm) { dm = d; mel = o; } } return mel; }

