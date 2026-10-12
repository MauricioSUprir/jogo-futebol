// Prints da entrega "cabeceio na bola rolando + IA intensa" (12/10; navegador, com a torcida e o HUD): o CABECEIO a gol
// (o atacante no alto do pulo, a cabeça na bola), a DISPUTA pelo alto (os dois no ar, ombro com ombro) e a DEFESA
// RECUANDO NO CORREDOR (o time da IA acompanhando a arrancada do condutor do humano). PC 1280×720 Alta e celular 844×390
// dpr 2 Média (toque, entalhe simulado), de dia e de noite. As cenas são montadas no mundo da página (os mesmos módulos,
// pela URL) e a simulação anda passo a passo (?prints=1: relógio manual; ?demo=1: a IA joga pelo humano). Salva em
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
 * Monta o cruzamento do time 0 (o do humano) da ponta para a área, com 2 atacantes e 2 zagueiros colados (a cena A do
 * teste-cabeceio) e anda até o quadro pedido: 'cabeceio' = um atacante no alto do pulo, a 1 passo do contato (sem disputa
 * ou com ela); 'disputa' = dois de times diferentes no ar no mesmo contato. Tenta várias sementes do jitter. Devolve
 * {ok, tick, ids} (a página fica no quadro).
 */
async function cenaCruzamento(pg, tipo) {
  return pg.evaluate(async tipo => {
    const g = window.__golaco;
    const P = await import('/js/partida.js'), A = await import('/js/acoes.js');
    for (let tent = 0; tent < 12; tent++) {
      const m = g.mundo;
      m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null; m.posse = null;
      for (const j of m.jogadores) { j.pedido = null; j.carga = null; j.recebe = null; j.cab = null; j.disputaAlta = null; if (j.cond) j.cond.toque = null; }
      const T = 0, lado = m.ataca[T], sz = tent % 2 ? 1 : -1, gx = lado * 52.5;
      const meu = m.jogadores.filter(j => j.time === T && j.posicao !== 'GOL'), deles = m.jogadores.filter(j => j.time !== T && j.posicao !== 'GOL');
      const ata = meu.filter(j => j.posicao === 'ATA'), zag = deles.filter(j => j.posicao === 'ZAG' || j.posDetalhe === 'ZAG');
      const cruzador = meu.find(j => !ata.includes(j));
      const a1 = ata[0] ?? meu[1], a2 = ata[1] ?? meu.find(j => j !== cruzador && j !== a1);
      const d1 = zag[0] ?? deles[0], d2 = zag[1] ?? deles[1];
      const jit = k => ((tent * 7 + k * 3) % 10) / 10 - 0.5;
      P.teleportar(cruzador, gx - lado * (14 + 2 * jit(1)), sz * (27 + 2 * jit(2)), Math.atan2(-sz, lado));
      P.teleportar(a1, gx - lado * (11 + 2 * jit(3)), sz * 1.5 * jit(4), lado > 0 ? 0 : Math.PI);
      P.teleportar(a2, gx - lado * (7 + jit(5)), -sz * (3 + jit(6)), lado > 0 ? 0 : Math.PI);
      P.teleportar(d1, a1.x + lado * (0.9 + 0.3 * jit(7)), a1.z + 0.4 * jit(8), lado > 0 ? Math.PI : 0);
      P.teleportar(d2, a2.x + lado * (0.9 + 0.3 * jit(9)), a2.z + 0.4 * jit(10), lado > 0 ? Math.PI : 0);
      let q = 0;
      for (const j of m.jogadores) {
        if ([cruzador, a1, a2, d1, d2].includes(j) || j.posicao === 'GOL') continue;
        // os outros perto da área também (a cena com gente, como no jogo), mas longe do lance
        P.teleportar(j, gx - lado * (22 + 4 * (q % 4)), -18 + 9 * (q % 5), j.rumo); q++;
      }
      const gk = m.jogadores.find(j => j.time !== T && j.posicao === 'GOL');
      P.teleportar(gk, gx - lado * 1.5, 0, lado > 0 ? Math.PI : 0);
      const b = m.bola;
      b.p.x = cruzador.x + Math.cos(cruzador.rumo) * 0.35; b.p.z = cruzador.z + Math.sin(cruzador.rumo) * 0.35; b.p.y = 0.11;
      b.v.x = 0; b.v.y = 0; b.v.z = 0; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
      m.posse = cruzador.id; m.ultimoToque = { id: cruzador.id, time: T, tick: m.tick };
      cruzador.pedido = { tipo: 'lancamento', forca: 0.7, tick: m.tick };
      A.executarAcao(m, cruzador, cruzador.par.attr.pePreferido ?? 1, false);
      if (!m.voo || m.voo.tipo !== 'cruzamento') continue;
      for (let i = 0; i < 200; i++) {
        // o quadro: 2 passos antes do contato de um atacante no ar (o alto do pulo)
        const noAr = m.jogadores.filter(j => j.cab && j.cab.saiu && j.cab.h > 0 && m.tick >= j.cab.tc - 2 && m.tick <= j.cab.tc - 1);
        const at = noAr.find(j => j.time === T && j.cab.cabeceio);
        const df = noAr.find(j => j.time !== T);
        if (at && (tipo === 'disputa' ? !!df : !df)) {
          for (let k = 0; k < 3; k++) g.relogio.avancar(0);
          return { ok: true, tick: m.tick, ids: noAr.map(j => j.id), tent };
        }
        g.rodarPassos(1, 'demo');
        if (m.posse != null || m.partida.estado !== 'jogo') break;
      }
    }
    return { ok: false };
  }, tipo);
}

/** A arrancada do controlado do time 0 do próprio campo (CORRER para o gol): o time da IA recuando no corredor. */
async function cenaCorredor(pg) {
  return pg.evaluate(async () => {
    const g = window.__golaco, m = g.mundo;
    const P = await import('/js/partida.js'), CF = await import('/js/config.js');
    m.parada = null; m.partida.estado = 'jogo'; m.golTick = null; m.foraDesde = null; m.voo = null; m.naMao = null;
    // todos nas referências de agora; a bola no pé do controlado no próprio campo
    const T = 0, lado = m.ataca[T];
    const j = m.jogadores.find(o => o.id === m.controlado[T]);
    P.teleportar(j, -lado * 14, 6, lado > 0 ? 0 : Math.PI);
    for (const o of m.jogadores) if (o.time !== T && o.posicao !== 'GOL' && (o.x - j.x) * lado < 4) P.teleportar(o, j.x + lado * (8 + (o.vagaIdx % 5) * 4), o.z * 0.8, o.rumo);
    const b = m.bola;
    b.p.x = j.x + lado * 0.34; b.p.z = j.z; b.p.y = CF.BOLA.raio; b.v.x = 0; b.v.y = 0; b.v.z = 0; b.rolando = true;
    m.posse = j.id;
    // 1,6 s de arrancada em disparada para o gol
    const e = { x: lado, z: -0.15, botoes: CF.BOTAO.CORRER };
    for (let i = 0; i < 96; i++) { g.rodarPassos(1, e); if (m.posse !== j.id) break; }
    for (let k = 0; k < 3; k++) g.relogio.avancar(0);
    const B = m.iaBloco?.[1];
    return { ok: m.posse === j.id, rapido: !!B?.rapido, v: Math.hypot(j.vx, j.vz), p1: B?.p1, ramos: m.jogadores.filter(o => o.time === 1 && o.ia).map(o => `${o.id}:${o.ia.ramo}`).join(' ') };
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
    for (const tipo of ['cabeceio', 'disputa']) {
      const r = await cenaCruzamento(pg, tipo);
      if (!r.ok) { console.log(`${P.nome}: cena ${tipo} não achada`); falhas++; continue; }
      await pg.screenshot({ path: path.join(SAIDA, `${P.nome}-${tipo}.png`) });
      console.log(`${P.nome}: ${tipo} (tick ${r.tick}, no ar ${r.ids.join(', ')})`);
    }
    const c = await cenaCorredor(pg);
    await pg.screenshot({ path: path.join(SAIDA, `${P.nome}-corredor.png`) });
    console.log(`${P.nome}: corredor (${JSON.stringify(c)})`);
    if (erros.length) { console.log(`${P.nome}: ${erros.length} erros: ${erros.slice(0, 2).join(' | ')}`); falhas++; }
    await navegador.close();
  }
} finally {
  srv.close?.();
}
console.log(falhas ? `prints-cabeceio: ${falhas} falha(s)` : `prints-cabeceio: ok (${SAIDA})`);
process.exit(falhas ? 1 : 0);
