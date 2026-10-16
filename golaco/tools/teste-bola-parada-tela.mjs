// teste-bola-parada-tela: a câmera atrás do cobrador e a linha da cobrança mirada no navegador (pedido do dono, 16/10, com a
// imagem do EA FC; render/camera.js CAMERA_BOLA_PARADA, render/linha-mira.js, js/mira.js; contrato "Cobrança mirada" no
// CONTRATOS.md). Relógio manual (o laço da página, quadro a quadro). Em PC 1280×720, celular 844×390 e 568×320 (toque):
//  1  Nos 4 tipos (escanteio, tiro livre, tiro de meta, pênalti) do humano e no pênalti CONTRA: a câmera vai para trás do
//     cobrador (a lente do lado de trás da bola, a 2–8 m dela, a 1,8–4 m de altura), o cobrador inteiro no quadro e na
//     metade de baixo (a cabeça abaixo de 40% da altura), o alvo (a área / o gol) no quadro e fora da caixa do cobrador.
//  2  Nada sólido na lente: fora de placas, gol, arquibancada (estadio-forma.js solidoEm, folga 0,3 m) e a ≥ 0,8 m de
//     todo jogador.
//  3  A linha: visível no escanteio, no tiro livre e no tiro de meta (não no pênalti), mexe ≥ 150 px do quadro (com ×
//     sem ela) e custa ≤ +1 chamada de desenho; o rótulo do tipo no HUD; some no chute.
//  4  A volta para a TV no chute: a mistura cai até 0 em ≤ 1,3 s, sem salto (nenhum quadro anda mais que 2,5 m nem 3× a
//     mediana dos passos da câmera).
//  5  Controles: no PC (teclado, a entrada da página) D gira a mira para a direita da tela e X/Z põem curva; o painel com
//     Z/X; no celular com toque os dois botões CURVA aparecem (só na cobrança mirada), sem encostar em outro botão, e o
//     toque no da direita põe +0,25.
//  6  Nenhum erro no console.
//   node tools/teste-bola-parada-tela.mjs [--prints <pasta>]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const PRINTS = args.includes('--prints') ? path.resolve(args[args.indexOf('--prints') + 1]) : null;
const res = [];
const meta = (nome, medido, ok) => { res.push({ nome, medido, ok: !!ok }); console.log(`${ok ? 'PASSOU  ' : 'REPROVOU'}  ${nome} — ${medido}`); };
const srv = await servidor(0, RAIZ);
const f1 = v => (v == null ? '-' : v.toFixed(1).replace('.', ','));
const TELAS = [
  { nome: 'PC 1280×720', largura: 1280, altura: 720, toque: false, q: 'baixa' },
  { nome: 'celular 844×390', largura: 844, altura: 390, toque: true, q: 'baixa' },
  { nome: 'celular 568×320', largura: 568, altura: 320, toque: true, q: 'baixa' },
];
const TIPOS = ['escanteio', 'falta', 'meta', 'penalti', 'contra'];

/** Monta a bola parada `tipo` (os ganchos de teste da página) e anda até a câmera estar atrás do cobrador. */
async function montar(pg, tipo) {
  return pg.evaluate(tipo => {
    const g = window.__golaco;
    if (tipo === 'escanteio') g.bolaParadaDeTeste('escanteio');
    else if (tipo === 'meta') g.bolaParadaDeTeste('tiroDeMeta');
    else if (tipo === 'falta') g.faltaDeTeste({ u: 22, w: 4 });
    else if (tipo === 'penalti') g.faltaDeTeste({ area: true });
    else g.faltaDeTeste({ doMeu: true, area: true });
    let e = null;
    for (let i = 0; i < 600; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      e = g.bolaParada.estado;
      const pronta = g.mundo.parada && g.mundo.tick >= g.mundo.parada.pronta;
      if (e.ativa && e.mistura >= 1 && pronta) break;
    }
    for (let i = 0; i < 12; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 11 });
    return g.bolaParada.estado;
  }, tipo);
}
/** Medidas do quadro: lente, cobrador, alvo, sólidos e jogadores perto (na página). */
async function medir(pg) {
  return pg.evaluate(async () => {
    const g = window.__golaco, e = g.bolaParada.estado;
    const { solidoEm } = await import('./js/estadio-forma.js');
    const W = window.innerWidth, H = window.innerHeight, c = e.camera;
    const m = g.mundo, pr = m.parada;
    const cob = m.jogadores.find(o => o.id === pr.cobrador);
    const cab = g.naTela(cob.x, 1.85, cob.z), pes = g.naTela(cob.x, 0.03, cob.z);
    const lados = [-0.35, 0.35].map(d => g.naTela(cob.x + d * Math.cos(e.yaw + Math.PI / 2), 1, cob.z + d * Math.sin(e.yaw + Math.PI / 2)));
    const ty = pr.tipo === 'penalti' || (pr.tipo === 'tiroLivre' && pr.direto) ? 1.0 : 0;
    const alvo = g.naTela(e.alvo.x, ty, e.alvo.z);
    const bx = { l: Math.min(...lados.map(p => p.x), cab.x, pes.x) - 4, r: Math.max(...lados.map(p => p.x), cab.x, pes.x) + 4, t: cab.y - 4, b: pes.y + 4 };
    let perto = Infinity;
    for (const o of m.jogadores) perto = Math.min(perto, Math.hypot(o.x - c.x, o.z - c.z) + Math.max(0, c.y - 1.9));
    const dxB = c.x - e.bola.x, dzB = c.z - e.bola.z, dxA = e.alvo.x - e.bola.x, dzA = e.alvo.z - e.bola.z;
    return {
      W, H, tipo: pr.tipo, atras: (dxB * dxA + dzB * dzA) < 0, dist: Math.hypot(dxB, dzB), altura: c.y,
      cab, pes, alvo, caixa: bx, solido: solidoEm(c.x, c.y, c.z, 0.3, false), perto,
      linha: e.linha, hud: e.hud, classe: e.classe,
    };
  });
}

for (const tela of TELAS) {
  const s = await abrir({ largura: tela.largura, altura: tela.altura, toque: tela.toque });
  const pg = s.pagina;
  await pg.goto(`${srv.url}?semente=5&q=${tela.q}&replay=0&comemoracao=0`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 180000 });
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 300; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  const q1 = [], q2 = [], q3 = [];
  for (const tipo of TIPOS) {
    const e = await montar(pg, tipo);
    if (!e.ativa) { q1.push(`${tipo}: câmera não veio`); continue; }
    const md = await medir(pg);
    const dentro = (p, f = 0) => !p.atras && p.x >= f * md.W && p.x <= (1 - f) * md.W && p.y >= f * md.H && p.y <= (1 - f) * md.H;
    const okCam = md.atras && md.dist >= 2 && md.dist <= 8 && md.altura >= 1.8 && md.altura <= 4;
    const okCob = dentro(md.cab) && dentro(md.pes) && md.cab.y >= 0.4 * md.H && md.pes.y <= 0.985 * md.H;
    const okAlvo = dentro(md.alvo, 0.03) && !(md.alvo.x > md.caixa.l && md.alvo.x < md.caixa.r && md.alvo.y > md.caixa.t && md.alvo.y < md.caixa.b);
    q1.push(`${tipo}: ${okCam && okCob && okAlvo ? 'ok' : `câmera ${okCam ? 'ok' : `atrás ${md.atras} ${f1(md.dist)} m alt ${f1(md.altura)}`} · cobrador ${okCob ? 'ok' : `cabeça ${f1(md.cab.y / md.H * 100)}% pés ${f1(md.pes.y / md.H * 100)}%`} · alvo ${okAlvo ? 'ok' : JSON.stringify(md.alvo)}`}`);
    q2.push(`${tipo}: ${md.solido ?? 'livre'}, jogador a ${f1(md.perto)} m`);
    if (!(okCam && okCob && okAlvo)) q1.ok = false;
    if (md.solido || md.perto < 0.8) q2.ok = false;
    // 3) a linha (não no pênalti)
    const comLinha = tipo !== 'penalti' && tipo !== 'contra';
    const px = await pg.evaluate(() => {
      const g = window.__golaco, cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = Math.round(cv.width / 2); off.height = Math.round(cv.height / 2);
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      g.bolaParada.linha(true); g.relogio.avancar(1000 / 60); const a = ler(); const ca = g.estado().desenhoChamadas;
      g.bolaParada.linha(false); g.relogio.avancar(1000 / 60); const b = ler(); const cb = g.estado().desenhoChamadas;
      g.bolaParada.linha(true); g.relogio.avancar(1000 / 60);
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 18) n++;
      return { n: n * 4, ca, cb, vis: g.bolaParada.estado.linha.visivel, hud: g.bolaParada.estado.hud };
    });
    if (PRINTS && tela.toque && tela.largura === 844 && (tipo === 'escanteio' || tipo === 'falta')) {
      await pg.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60); });
      await pg.screenshot({ path: path.join(PRINTS, `bola-parada-${tipo}-844x390.png`) });
    }
    if (PRINTS && !tela.toque && (tipo === 'escanteio' || tipo === 'falta')) await pg.screenshot({ path: path.join(PRINTS, `bola-parada-${tipo}-1280x720.png`) });
    // chute (LANÇAMENTO; no pênalti o CHUTE; no contra o goleiro espera) e a volta para a TV
    const volta = await pg.evaluate(tipo => {
      const g = window.__golaco, B = tipo === 'penalti' ? 32 : 16;
      const pos = [], mist = [];
      if (tipo !== 'contra') { g.forcarEntrada({ x: 0, z: 0, botoes: B }); for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada({ x: 0, z: 0, botoes: 0 }); }
      let chute = -1, linhaDepois = null, cortou = false;
      for (let i = 0; i < 600; i++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const e = g.bolaParada.estado;
        if (chute < 0 && (!e.ativa)) { chute = i; linhaDepois = e.linha.visivel; }
        // (o gol corta para a câmera do gol: um corte de propósito — a medida da volta para ali)
        if (chute >= 0 && g.estadio.planoCamera !== 'jogo') { cortou = true; break; }
        if (chute >= 0) { pos.push([e.camera.x, e.camera.y, e.camera.z]); mist.push(e.mistura); if (e.mistura === 0 && pos.length > 5) break; }
      }
      g.forcarEntrada(null);
      for (let i = 0; i < 200; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return { pos, mist, chute, linhaDepois, cortou };
    }, tipo);
    const passos = volta.pos.slice(1).map((p, i) => Math.hypot(p[0] - volta.pos[i][0], p[1] - volta.pos[i][1], p[2] - volta.pos[i][2]));
    const med = [...passos].sort((a, b) => a - b)[Math.floor(passos.length / 2)] ?? 0;
    const maxP = Math.max(0, ...passos);
    const tVolta = volta.mist.findIndex(x => x === 0) / 60;
    q3.push({ tipo, comLinha, px, volta: { t: tVolta, maxP, med, chute: volta.chute, linhaDepois: volta.linhaDepois, cortou: volta.cortou, passos: passos.length } });
  }
  meta(`1 ${tela.nome}: câmera atrás do cobrador, o cobrador inteiro na metade de baixo, o alvo no quadro e livre dele`, q1.join(' · '), q1.ok !== false && q1.length === TIPOS.length);
  meta(`2 ${tela.nome}: nada sólido na lente e nenhum jogador a < 0,8 m`, q2.join(' · '), q2.ok !== false && q2.length === TIPOS.length);
  const l = q3.map(x => `${x.tipo}: ${x.comLinha ? `${x.px.vis ? 'visível' : 'não'} ${x.px.n} px +${x.px.ca - x.px.cb} chamada ${x.px.hud?.rotulo ?? '-'}` : (x.px.vis ? 'linha no pênalti!' : 'sem linha')}; some no chute ${x.volta.linhaDepois === false ? 'sim' : 'não'}`);
  meta(`3 ${tela.nome}: a linha (visível ≥ 150 px, ≤ +1 chamada, rótulo no HUD; nada no pênalti) e some no chute`, l.join(' · '),
    q3.every(x => (x.comLinha ? x.px.vis && x.px.n >= 150 && x.px.ca - x.px.cb <= 1 && !!x.px.hud?.rotulo : !x.px.vis) && x.volta.linhaDepois === false));
  // (a cobrança que vira gol corta para a câmera do gol antes do fim da volta: conta o que andou até o corte, ≥ 3 sem gol)
  const semCorte = q3.filter(x => !x.volta.cortou);
  meta(`4 ${tela.nome}: a volta para a TV no chute sem salto`, q3.map(x => `${x.tipo}: ${x.volta.cortou ? `gol (corte) depois de ${x.volta.passos} quadros, ` : `${f1(x.volta.t)} s, `}maior passo ${f1(x.volta.maxP)} m (mediana ${f1(x.volta.med)})`).join(' · '),
    semCorte.length >= 3 && q3.every(x => (x.volta.cortou || (x.volta.t > 0 && x.volta.t <= 1.3)) && x.volta.maxP <= 2.5 && x.volta.maxP <= Math.max(3 * x.volta.med, 0.3)));
  // 5) controles
  if (!tela.toque) {
    await montar(pg, 'escanteio');
    const a0 = await pg.evaluate(() => window.__golaco.bolaParada.estado.mira);
    await pg.keyboard.down('KeyD');
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
    await pg.keyboard.up('KeyD');
    for (let k = 0; k < 2; k++) {
      await pg.keyboard.down('KeyX'); await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      await pg.keyboard.up('KeyX'); await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 2 }); });
    }
    const r = await pg.evaluate(() => {
      const g = window.__golaco, e = g.bolaParada.estado, el = document.getElementById('mira');
      const kb = [...el.querySelectorAll('.mira-kbd')].map(k => getComputedStyle(k).display !== 'none');
      return { mira: e.mira, painel: !el.hidden && getComputedStyle(el).display !== 'none', kbd: kb.every(Boolean), rot: e.hud?.rotulo };
    });
    const giro = r.mira.ang - a0.ang;
    meta(`5 ${tela.nome}: D gira a mira para a direita da tela, X põe curva (2 apertos), o painel com Z/X`,
      `giro ${f1(giro * 180 / Math.PI)}° · curva ${r.mira.curva} · painel ${r.painel ? 'sim' : 'não'} (${r.rot}) · teclas ${r.kbd ? 'sim' : 'não'}`,
      giro > 0.25 && giro < 0.45 && r.mira.curva === 0.5 && r.painel && r.kbd);
    await pg.evaluate(() => { const g = window.__golaco; g.forcarEntrada({ x: 0, z: 0, botoes: 16 }); for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada(null); for (let i = 0; i < 200; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  } else {
    const fora = await pg.evaluate(() => {
      const vis = id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
      return vis('btn-efeito-e') || vis('btn-efeito-d');
    });
    await montar(pg, 'escanteio');
    const r = await pg.evaluate(() => {
      const caixa = e => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, id: e.id }; };
      const vis = e => getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0;
      const bts = [...document.querySelectorAll('#toque .btn-toque')].filter(vis).map(caixa);
      const ef = bts.filter(b => b.id.startsWith('btn-efeito'));
      const painel = document.getElementById('mira'); const pc = painel && !painel.hidden ? caixa(painel) : null;
      const todos = pc ? [...bts, { ...pc, id: 'mira' }] : bts;
      // os botões são círculos (border-radius 50%); o painel, um retângulo
      const circ = a => a.id !== 'mira';
      const toca = (a, b) => {
        if (circ(a) && circ(b)) { const ra = (a.r - a.l) / 2, rb = (b.r - b.l) / 2; return Math.hypot((a.l + a.r) / 2 - (b.l + b.r) / 2, (a.t + a.b) / 2 - (b.t + b.b) / 2) < ra + rb - 1; }
        const [c, r] = circ(a) ? [a, b] : [b, a];
        const cx = (c.l + c.r) / 2, cy = (c.t + c.b) / 2, rc = (c.r - c.l) / 2;
        const px = Math.max(r.l, Math.min(cx, r.r)), py = Math.max(r.t, Math.min(cy, r.b));
        return Math.hypot(cx - px, cy - py) < rc - 1;
      };
      let enc = [];
      for (let i = 0; i < todos.length; i++) for (let j = i + 1; j < todos.length; j++) if (toca(todos[i], todos[j])) enc.push(`${todos[i].id}×${todos[j].id}`);
      const d = document.getElementById('btn-efeito-d').getBoundingClientRect();
      return { n: ef.length, enc, cx: d.left + d.width / 2, cy: d.top + d.height / 2, dentro: ef.every(b => b.l >= 0 && b.t >= 0 && b.r <= window.innerWidth && b.b <= window.innerHeight) };
    });
    await pg.touchscreen.tap(r.cx, r.cy);
    const curva = await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.bolaParada.estado.mira?.curva; });
    meta(`5 ${tela.nome}: os 2 botões CURVA só na cobrança mirada, sem encostar em nada; o toque no da direita põe +0,25`,
      `fora da cobrança: ${fora ? 'aparecem' : 'escondidos'} · na cobrança: ${r.n} ${r.dentro ? 'na tela' : 'fora da tela'} · encostam: ${r.enc.join(', ') || 'nada'} · curva ${curva}`,
      !fora && r.n === 2 && r.dentro && !r.enc.length && curva === 0.25);
    await pg.evaluate(() => { const g = window.__golaco; g.forcarEntrada({ x: 0, z: 0, botoes: 16 }); for (let i = 0; i < 20; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.forcarEntrada(null); for (let i = 0; i < 200; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  }
  meta(`6 ${tela.nome}: nenhum erro no console`, s.erros.length ? s.erros.slice(0, 3).join(' | ') : 'nenhum', !s.erros.length);
  await s.navegador.close();
}
await srv.fechar?.();
const falhas = res.filter(r => !r.ok).length;
console.log(falhas ? `\nteste-bola-parada-tela: REPROVOU (${falhas} de ${res.length})` : `\nteste-bola-parada-tela: PASSOU (${res.length})`);
process.exit(falhas ? 1 : 0);
