// Gol ROTEIRIZADO no navegador (teste-estadio e prints do estádio): um gol de verdade da partida (o mesmo
// caminho até o "GOL!": sim.js verificarGol → partida.js → main.js → HUD, rede, torcida, som), mas que não
// depende da IA nem do goleiro — as outras frentes mudam a IA e o goleiro, e o teste preso a um gol da
// semente 6 deixava o CI vermelho assim que elas entrassem (contraprova B1).
//
// Roteiro (só nos testes: escreve direto no mundo, nunca no jogo de verdade):
//   1) partida IA × IA até um jogador de linha do `time` ficar com a bola, sendo o último toque de verdade
//      dele (autor-gol.js) — ele é o autor;
//   2) ele vai para a meia-lua (com os pés: nada de perna esticada), o goleiro adversário sai do gol e quem
//      estiver no corredor do chute vai para longe (corredor de 9 m para os adversários, 3 m para os colegas);
//   3) a bola sai do pé dele com a FÍSICA da bola (bola.js passoBola: vy achado por bisseção para passar a
//      linha na altura pedida) a v m/s para o ponto (y, z) da boca do gol.
// Devolve {ok, golTick, autor, lado, n, tickChute} (ok = o gol saiu em até 90 passos).
//   golRoteirizado(pagina, {semente = 5, time = 0, v = 23, y = 1.0, z = -1.4, z0 = 3.0, dist = 9.5, reiniciar = true,
//     marcarChute = false (o chute conta para o autor como um de verdade: replay.chuteDeTeste — a 1ª pessoa do replay),
//     preparo = (marcarChute ? 60 : 0) (passos da corrida do autor até a bola antes do chute, com o corte para trás)})

export async function golRoteirizado(pagina, opc = {}) {
  return pagina.evaluate(async o => {
    const g = window.__golaco;
    const { criarBola, passoBola } = await import('./js/bola.js');
    const { CAMPO } = await import('./js/config.js');
    const MX = CAMPO.meioX;
    const time = o.time ?? 0;
    if (o.reiniciar !== false) g.reiniciar({ modo: 'partida', semente: o.semente ?? 5 });
    const porId = id => g.mundo.jogadores.find(j => j.id === id);
    // 1) bola com um jogador de linha do time, último toque dele
    // (versões sem estadio.ultimoToque: basta a posse)
    const temU = !!g.estadio && 'ultimoToque' in g.estadio;
    let n = 0;
    for (; n < 6000; n++) {
      g.rodarPassos(1, 'demo');
      const m = g.mundo, u = temU ? g.estadio.ultimoToque : null, j = m.posse != null ? porId(m.posse) : null;
      if (m.partida.estado === 'jogo' && j && m.naMao == null && !m.voo && j.time === time && j.posicao !== 'GOL' && (!temU || (u && u.id === j.id))) break;
    }
    const m = g.mundo;
    const autor = porId(m.posse);
    if (!autor) return { ok: false, n, motivo: 'ninguém do time com a bola' };
    const s = m.ataca[time];
    const levar = (j, x, z) => {
      const dx = x - j.x, dz = z - j.z;
      j.x = x; j.z = z; j.vx = 0; j.vz = 0;
      for (const p of j.pes) { p.x += dx; p.z += dz; p.lx += dx; p.lz += dz; p.gx += dx; p.gz += dz; p.tx += dx; p.tz += dz; p.bx += dx; p.bz += dz; }
    };
    // 2) chute da meia-lua para (y, z) da boca do gol
    const dist = o.dist ?? 9.5, z0 = o.z0 ?? 3.0, yAlvo = o.y ?? 1.0, zAlvo = o.z ?? -1.4, v = o.v ?? 23;
    const P0 = { x: s * (MX - dist), z: z0 };
    let dx = s * MX - P0.x, dz = zAlvo - P0.z;
    const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const ladoCorredor = (j, larg) => {
      // distância do jogador ao segmento P0 → fundo do gol
      const ax = j.x - P0.x, az = j.z - P0.z, t = Math.max(0, Math.min(L + 2.5, ax * dx + az * dz));
      return Math.hypot(ax - dx * t, az - dz * t) < larg;
    };
    let k = 0;
    for (const j of m.jogadores) {
      if (j === autor) continue;
      const adv = j.time !== time;
      if ((adv && (j.posicao === 'GOL' || ladoCorredor(j, 9))) || (!adv && ladoCorredor(j, 3))) {
        levar(j, s * (MX - 26 - (k % 3) * 2), (k % 2 ? 1 : -1) * (14 + 2 * Math.floor(k / 2)));
        k++;
      }
    }
    levar(autor, P0.x - dx * 0.55, P0.z - dz * 0.55);
    autor.rumo = Math.atan2(dz, dx);
    // vy por bisseção na física da bola: passa 0,3 m antes da linha na altura pedida
    const xm = s * (MX - 0.3);
    const altura = vy => {
      const b = criarBola(P0.x, P0.z); b.p.y = 0.25; b.v.x = dx * v; b.v.z = dz * v; b.v.y = vy; b.rolando = false;
      for (let i = 0; i < 200; i++) { const xa = b.p.x, ya = b.p.y; passoBola(b, []); if ((b.p.x - xm) * s >= 0 && (xa - xm) * s < 0) return ya + (b.p.y - ya) * (xm - xa) / (b.p.x - xa); }
      return -1;
    };
    let lo = -2, hi = 8;
    for (let it = 0; it < 40; it++) { const mid = (lo + hi) / 2; if (altura(mid) < yAlvo) lo = mid; else hi = mid; }
    const vy = (lo + hi) / 2;
    // {preparo: n passos (padrão: 60 com marcarChute, 0 sem)}: a corrida do autor até a bola ANTES do chute (3 m/s pela
    // linha do chute; a bola parada em P0), para o corte do teletransporte acima ficar ANTES do chute — sem isso o anel
    // tem o autor do outro lado do campo até o chute e o corte no passo seguinte a ele (contraprova 15/10: a 1ª pessoa do
    // replay atravessava esse corte; agora ela só existe com a corrida antes do chute no anel)
    const prep = o.preparo ?? (o.marcarChute ? 60 : 0), vCorre = 3;
    for (let i = 0; i < prep; i++) {
      const d = 0.55 + vCorre * (prep - i) / 60;
      m.posse = null; m.naMao = null; m.voo = null;
      if (autor.cond) { autor.cond.toque = null; autor.cond.busca = false; }
      Object.assign(m.bola, criarBola(P0.x, P0.z));
      levar(autor, P0.x - dx * d, P0.z - dz * d);
      autor.rumo = Math.atan2(dz, dx); autor.vx = dx * vCorre; autor.vz = dz * vCorre;
      g.rodarPassos(1, 'demo');
    }
    levar(autor, P0.x - dx * 0.55, P0.z - dz * 0.55);
    autor.rumo = Math.atan2(dz, dx);
    // 3) a bola sai do pé do autor
    m.posse = null; m.naMao = null; m.voo = null;
    if (autor.cond) { autor.cond.toque = null; autor.cond.busca = false; }
    Object.assign(m.bola, criarBola(P0.x, P0.z));
    m.bola.p.y = 0.25; m.bola.v.x = dx * v; m.bola.v.z = dz * v; m.bola.v.y = vy; m.bola.rolando = false;
    m.ultimoToque = { id: autor.id, time: autor.time, tick: m.tick };
    // {marcarChute}: o chute conta para o autor do gol como um de verdade (o replay da 1ª pessoa precisa dele)
    if (o.marcarChute && g.replay?.chuteDeTeste) g.replay.chuteDeTeste(autor.id);
    const tickChute = m.tick;
    let golTick = null;
    for (let i = 0; i < 90 && golTick == null; i++) {
      g.rodarPassos(1, 'demo');
      if (g.mundo.eventos.some(e => e.tipo === 'gol')) golTick = g.mundo.tick;
    }
    return { ok: golTick != null, golTick, autor: autor.id, lado: s, n, tickChute, movidos: k, vy: +vy.toFixed(2) };
  }, opc);
}
