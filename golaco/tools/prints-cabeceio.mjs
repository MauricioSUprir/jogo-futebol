// Prints da entrega "cabeceio na bola rolando + IA intensa" (12/10; navegador, com a torcida e o HUD): o CABECEIO a gol
// (o atacante no alto do pulo, a cabeça na bola), a DISPUTA pelo alto (os dois no ar, ombro com ombro) e a DEFESA
// RECUANDO NO CORREDOR (o time da IA acompanhando a arrancada do condutor do humano). PC 1280×720 Alta e celular 844×390
// dpr 2 Média (toque, entalhe simulado), de dia e de noite. As cenas são montadas no mundo da página (os mesmos módulos,
// pela URL; a montagem do cruzamento é a do canhão do teste-cabeceio, com o time da IA atacando) e a simulação anda
// passo a passo (?prints=1: relógio manual; a câmera anda junto, quadro a quadro, sem desenhar). Salva em
// tools/saida/cabeceio/. Confere erros no console.
//   node tools/prints-cabeceio.mjs [--so pc-dia,celular-noite]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const SAIDA = path.join(RAIZ, 'tools', 'saida', 'cabeceio');
fs.mkdirSync(SAIDA, { recursive: true });

const PERFIS = [
  { nome: 'pc-dia', largura: 1280, altura: 720, dpr: 1, toque: false, url: 'q=alta&hora=dia' },
  { nome: 'pc-noite', largura: 1280, altura: 720, dpr: 1, toque: false, url: 'q=alta&hora=noite' },
  { nome: 'celular-dia', largura: 844, altura: 390, dpr: 2, toque: true, url: 'q=media&hora=dia&toque=1&entalhe=1' },
  { nome: 'celular-noite', largura: 844, altura: 390, dpr: 2, toque: true, url: 'q=media&hora=noite&toque=1&entalhe=1' },
].filter(p => !so || so.has(p.nome));

/**
 * O cruzamento do time 1 (IA) da ponta para a área, com 2 atacantes e 2 zagueiros colados (a cena A do teste-cabeceio)
 * e anda até o quadro pedido: 'cabeceio' = um atacante no alto do pulo a 1–2 passos do contato, sem ninguém do outro
 * time no ar; 'disputa' = um de cada time no ar no mesmo lance. Tenta várias montagens (jitter). Devolve {ok, tick, ids}
 * (a página fica no quadro).
 */
async function cenaCruzamento(pg, tipo) {
  return pg.evaluate(async tipo => {
    const g = window.__golaco;
    const P = await import('/js/partida.js'), A = await import('/js/acoes.js');
    const passo = () => { g.rodarPassos(1, 'demo'); g.relogio.avancar(1000 / 60, { desenhar: false }); };
    for (let tent = 0; tent < 16; tent++) {
      const m = g.mundo;
      for (let i = 0; i < 30; i++) passo();
      m.placar[0] = 0; m.placar[1] = 0;
      m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null; m.posse = null;
      for (const j of m.jogadores) { j.pedido = null; j.carga = null; j.recebe = null; j.cab = null; j.disputaAlta = null; if (j.cond) j.cond.toque = null; }
      const T = 1, lado = m.ataca[T], sz = tent % 2 ? 1 : -1, gx = lado * 52.5;
      const meu = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL'), deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
      const ata = meu.filter(j => j.posicao === 'ATA'), zag = deles.filter(j => j.posicao === 'ZAG' || j.posDetalhe === 'ZAG');
      const cruzador = meu.find(j => !ata.includes(j));
      const a1 = ata[0] ?? meu[1], a2 = ata[1] ?? meu.find(j => j !== cruzador && j !== a1);
      const d1 = zag[0] ?? deles[0], d2 = zag[1] ?? deles[1];
      const jit = k => ((tent * 7 + k * 3) % 10) / 10 - 0.5;
      // na disputa os zagueiros colados (como no canhão); no cabeceio livre, um passo mais longe
      const cola = tipo === 'disputa' ? 0.9 : 2.6;
      P.teleportar(cruzador, gx - lado * (14 + 2 * jit(1)), sz * (27 + 2 * jit(2)), Math.atan2(-sz, lado));
      P.teleportar(a1, gx - lado * (11 + 2 * jit(3)), sz * 1.5 * jit(4), lado > 0 ? 0 : Math.PI);
      P.teleportar(a2, gx - lado * (7 + jit(5)), -sz * (3 + jit(6)), lado > 0 ? 0 : Math.PI);
      P.teleportar(d1, a1.x + lado * (cola + 0.3 * jit(7)), a1.z + 0.4 * jit(8), lado > 0 ? Math.PI : 0);
      P.teleportar(d2, a2.x + lado * (cola + 0.3 * jit(9)), a2.z + 0.4 * jit(10), lado > 0 ? Math.PI : 0);
      let q = 0;
      for (const j of m.jogadores) {
        if ([cruzador, a1, a2, d1, d2].includes(j) || j.posicao === 'GOL') continue;
        // os outros voltando, entre a área e o meio (a cena com gente, como no jogo), longe do lance
        P.teleportar(j, gx - lado * (24 + 5 * (q % 4)), -22 + 11 * (q % 5), j.rumo); q++;
      }
      const gk = m.jogadores.find(j => j.time !== T && j.posicao === 'GOL');
      P.teleportar(gk, gx - lado * 1.5, 0, lado > 0 ? Math.PI : 0);
      // o controlado do humano fica longe do lance (o lance é IA × IA, como no canhão)
      const longe = m.jogadores.filter(j => j.time !== T && ![d1, d2, gk].includes(j)).sort((x, y) => Math.abs(y.x - gx) - Math.abs(x.x - gx))[0];
      if (longe) A.assumirControle(m, 1 - T, longe);
      const b = m.bola;
      b.p.x = cruzador.x + Math.cos(cruzador.rumo) * 0.35; b.p.z = cruzador.z + Math.sin(cruzador.rumo) * 0.35; b.p.y = 0.11;
      b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
      m.posse = cruzador.id; m.ultimoToque = { id: cruzador.id, time: T, tick: m.tick };
      cruzador.pedido = { tipo: 'lancamento', forca: 0.7, tick: m.tick };
      A.executarAcao(m, cruzador, cruzador.par.attr.pePreferido ?? 1, false);
      if (!m.voo || m.voo.tipo !== 'cruzamento') continue;
      for (let i = 0; i < 200; i++) {
        const noAr = m.jogadores.filter(j => j.cab && j.cab.saiu && j.cab.h > 0.15 && m.tick >= j.cab.tc - 2 && m.tick <= j.cab.tc - 1);
        const at = noAr.find(j => j.time === T);
        const df = noAr.find(j => j.time !== T);
        if (at && (tipo === 'disputa' ? !!df : !df && at.cab.cabeceio)) {
          g.relogio.avancar(0);
          return { ok: true, tick: m.tick, ids: noAr.map(j => `${j.id} (h ${j.cab.h.toFixed(2)} m)`), tent, foco: [at.x, at.z], lado };
        }
        passo();
        if (m.posse != null || m.partida.estado !== 'jogo') break;
      }
    }
    return { ok: false };
  }, tipo);
}

/** A arrancada do controlado do time 0 do próprio campo (CORRER para o gol): o time da IA recuando no corredor. */
async function cenaCorredor(pg) {
  return pg.evaluate(async () => {
    const g = window.__golaco;
    const P = await import('/js/partida.js'), CF = await import('/js/config.js');
    const passo = e => { g.rodarPassos(1, e); g.relogio.avancar(1000 / 60, { desenhar: false }); };
    for (let i = 0; i < 30; i++) passo('demo');
    const m = g.mundo;
    m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
    m.placar[0] = 0; m.placar[1] = 0;
    const T = 0, lado = m.ataca[T];
    const j = m.jogadores.find(o => o.id === m.controlado[T]);
    P.teleportar(j, -lado * 16, 8, lado > 0 ? 0 : Math.PI);
    // o bloco da IA arrumado à frente do condutor (o "bloco armado" do teste-defesa-corrida)
    let q = 0;
    for (const o of m.jogadores) {
      if (o.time === T || o.posicao === 'GOL') continue;
      const linha = q < 4 ? 0 : q < 8 ? 1 : 2;
      P.teleportar(o, j.x + lado * (34 - 11 * linha + (q % 2)), -18 + 12 * (q % 4) + 3 * linha, lado > 0 ? Math.PI : 0); q++;
    }
    const b = m.bola;
    b.p.x = j.x + lado * 0.34; b.p.z = j.z; b.p.y = CF.BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true;
    m.posse = j.id; m.ultimoToque = { id: j.id, time: T, tick: m.tick };
    // arrancada em disparada para o gol, puxando para o meio, até o quadro com o defensor do corredor À FRENTE do condutor
    // rápido (2–7 m adiante, < 2,5 m de lado) correndo para o próprio gol (o 'acompanhar' do teste-defesa-corrida)
    let ok = false, info = null;
    for (let i = 0; i < 240; i++) {
      passo({ x: lado, z: -0.25, botoes: CF.BOTAO.CORRER });
      if (m.posse !== j.id) break;
      const v = Math.hypot(j.vx, j.vz);
      if (v < 6.3) continue;
      const ux = j.vx / v, uz = j.vz / v;
      let d = null, dm = Infinity;
      for (const o of m.jogadores) {
        if (o.time === T || o.posicao === 'GOL') continue;
        const dx = o.x - j.x, dz = o.z - j.z, fr = dx * ux + dz * uz, la = Math.abs(-dx * uz + dz * ux);
        if (fr > 1.5 && fr < 8 && la < 3 && fr < dm) { dm = fr; d = o; }
      }
      if (d) (info ??= []).push(`${(m.tick % 1000)}:${d.id} a ${dm.toFixed(1)} m, ${(d.vx * lado).toFixed(1)} m/s`);
      if (d && d.vx * lado > 3.5 && dm < 6) { ok = true; break; }
    }
    g.relogio.avancar(0);
    const B = m.iaBloco?.[1];
    return { ok, rapido: !!B?.rapido, v: +Math.hypot(j.vx, j.vz).toFixed(2), x: +j.x.toFixed(1), frente: (info ?? []).slice(-6).join(' | ') };
  });
}

const srv = await servidor(0, RAIZ);
let falhas = 0;
try {
  for (const P of PERFIS) {
    const { navegador, pagina: pg, erros } = await abrir(P);
    await pg.goto(`${srv.url}?prints=1&demo=1&replay=0&semente=5&${P.url}`, { waitUntil: 'load' });
    await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
    // a partida em andamento (saída feita, a torcida e o estádio prontos)
    await pg.evaluate(() => { const g = window.__golaco; g.pausar(true); g.relogio.usarManual(true); g.rodarPassos(400, 'demo'); g.relogio.avancar(16); });
    // os lances pelo alto na câmera de TV (a do jogo) e, no mesmo quadro, de perto (câmera livre de conferência, do lado
    // do campo, na altura do pulo)
    for (const tipo of ['cabeceio', 'disputa']) {
      const r = await cenaCruzamento(pg, tipo);
      if (!r.ok) { console.log(`${P.nome}: cena ${tipo} não achada`); falhas++; continue; }
      await pg.screenshot({ path: path.join(SAIDA, `${P.nome}-${tipo}.png`) });
      const [fx, fz] = r.foco;
      await pg.evaluate(l => { const g = window.__golaco; g.cameraLivre(l); g.relogio.avancar(0); }, { de: [fx - r.lado * 3.5, 2.1, fz + 8], para: [fx, 1.7, fz], fov: 36 });
      await pg.screenshot({ path: path.join(SAIDA, `${P.nome}-${tipo}-perto.png`) });
      await pg.evaluate(() => { const g = window.__golaco; g.cameraLivre(null); g.relogio.avancar(0, { desenhar: false }); });
      console.log(`${P.nome}: ${tipo} (tick ${r.tick}, montagem ${r.tent}, no ar ${r.ids.join(', ')})`);
    }
    const c = await cenaCorredor(pg);
    await pg.screenshot({ path: path.join(SAIDA, `${P.nome}-corredor.png`) });
    console.log(`${P.nome}: corredor ${JSON.stringify(c)}`);
    if (!c.ok) falhas++;
    if (erros.length) { console.log(`${P.nome}: ${erros.length} erros: ${erros.slice(0, 2).join(' | ')}`); falhas++; }
    await navegador.close();
  }
} finally {
  await srv.fechar();
}
console.log(falhas ? `prints-cabeceio: ${falhas} falha(s)` : `prints-cabeceio: ok (${SAIDA})`);
process.exit(falhas ? 1 : 0);
