// Estádio no navegador (Chromium): rede que balança, efeito de gol, torcida e som.
//   1) a página abre sem erro no console, com a torcida na cena (≤ 3 chamadas de desenho a mais) e mais gente na
//      Alta que na Média e na Baixa (sem animação na Baixa); trocar a qualidade não remonta a torcida (≤ 25 ms
//      com a CPU 4× mais lenta) e não vaza geometria nem textura;
//   2) a torcida APARECE (os pixels da arquibancada mudam com ela) de dia e de noite;
//   3) som: nada de AudioContext antes do primeiro gesto; o apito do início fica pendente e toca no gesto; um
//      clique cria e retoma (running); 11 gravações (os cantos são decodificados sob demanda) e os 3 laços do leito
//      (murmúrio, agitado, batucada); o grito do gol já sai alto (≤ 0,3 s até 6 dB do pico);
//   4) um GOL ROTEIRIZADO (tools/lib/gol-roteirizado.mjs: não depende da IA nem do goleiro — contraprova B1): a
//      rede estufa ≥ 0,2 m, a bola desenhada vai junto, a câmera CORTA para a câmera do gol (a rede mexe na tela e
//      a torcida enche o fundo do quadro), só "GOL!" (sem autor nem minuto: sem narração — dono, 10/10), placar pulsando, câmera sem tranco entre
//      os cortes, o "GOL!" sai na saída de bola, que sai no mesmo tick de sempre; gol, chuá e apito tocam;
//   5) gol do VISITANTE: a casa cala (barulho ≤ 0,15) e só o setor visitante comemora (contraprova I4);
//   6) treino de condução: o "GOL!" e o efeito da câmera acabam quando a bola volta (contraprova M8);
//   7) som desligado: ganho 0, contexto suspenso, nada toca e fica salvo; abrindo a página já desligada, o gesto
//      não cria AudioContext e nada baixa (contraprova M7); religado em 50%;
//   8) "GOL!" no celular (568×320, 667×375, 844×390) não encosta no analógico, nos botões, no placar nem no
//      minimapa (contraprova M2);
//   9) as contas da GPU são as mesmas do JS: pose da torcida e deslocamento da rede avaliados no shader de verdade
//      (WebGL2, float) × torcida-dados.js/rede-onda.js (contraprova M9);
//  10) a torcida DURANTE O JOGO no celular deitado (844×390, Média; dono, 10/10): 20 instantes de uma partida IA×IA,
//      cada um desenhado com e sem a torcida — ela ocupa ≥ 1% da tela em ≥ 90% deles, e o jogador controlado não
//      fica menor na tela (≥ 33 px de altura: a câmera antiga dava 36 px; ≤ 10% a menos);
//  11) o LADO DE CÁ (11/10): fora do desenho na câmera de TV (celular e PC, 20 instantes), visível do outro lado do
//      campo com a torcida e o túnel no meio; os bancos de reservas (na mesma malha) fora da TV com a bola perto da
//      linha de cá (no celular a cobertura deles aparecia no canto de baixo);
//  12) a FESTA (11/10): faixas/bandeiras/bandeirões e sinalizadores ≤ 2 chamadas de desenho no jogo; onda da bandeira
//      GPU = JS; "debaixo do bandeirão" GPU = JS (12/10); no gol da casa a organizada muda na câmera do gol (bandeirão e
//      sinalizadores); overdraw ≤ 0,5 tela.
// As páginas abrem com ?replay=0: o replay automático (testado em tools/teste-replay.mjs) seguraria a simulação ~10 s
// na saída de bola depois do gol, e os itens 4 e 10 andam o relógio atravessando a saída.
//   node tools/teste-estadio.mjs [--raiz <pasta do jogo>]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));

/** Diferença entre dois PNG numa região (px CSS): média (0–255) ou fração de pixels que mudam > 20. */
async function diferenca(contexto, a, b, reg) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const r = await aux.evaluate(async ({ a, b, reg }) => {
    const ler = async src => { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); return i; };
    const [ia, ib] = [await ler(a), await ler(b)];
    const c = document.getElementById('c'); c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d');
    const k = ia.width / window.innerWidth > 1.5 ? ia.width / reg.larguraCss : 1;
    const R = { x: Math.round(reg.x * k), y: Math.round(reg.y * k), w: Math.max(1, Math.round(reg.w * k)), h: Math.max(1, Math.round(reg.h * k)) };
    const dados = img => { g.drawImage(img, 0, 0); return g.getImageData(R.x, R.y, R.w, R.h).data; };
    const da = dados(ia), db = dados(ib);
    let soma = 0, n = 0, mudou = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2])) / 3;
      soma += d; n++;
      if (d > 20) mudou++;
    }
    return reg.fracao ? mudou / Math.max(1, n) : soma / Math.max(1, n);
  }, { a: a.toString('base64'), b: b.toString('base64'), reg });
  await aux.close();
  return r;
}

const srv = await servidor(0, raiz);
const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
// contagem de AudioContext criados e de sons baixados (nada antes do gesto; nada com o som desligado)
await contexto.addInitScript(() => {
  window.__ctxCriados = 0;
  const C = window.AudioContext;
  if (C) window.AudioContext = class extends C { constructor(...a) { super(...a); window.__ctxCriados++; } };
});
const mp3 = [];
contexto.on('request', r => { if (/\.mp3(\?|$)/.test(r.url())) mp3.push(r.url().split('/').pop()); });
try {
  await pg.goto(`${srv.url}?q=alta&hora=dia&semente=5&replay=0`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  const tem = await pg.evaluate(() => !!window.__golaco.estadio);
  meta('A página tem o estádio (torcida, rede, som)', String(tem), 'true', tem);
  if (!tem) throw new Error('página sem o estádio (versão publicada)');
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  // som: antes de qualquer gesto, nenhum AudioContext
  const somAntes = await pg.evaluate(() => ({ estado: window.__golaco.estadio.som?.estado ?? 'sem som', criados: window.__ctxCriados }));
  meta('Som: nada antes do primeiro gesto (política de reprodução automática)', `${somAntes.estado}, ${somAntes.criados} AudioContext`, 'sem-contexto, 0', somAntes.estado === 'sem-contexto' && somAntes.criados === 0);

  // 1) torcida por qualidade e chamadas de desenho
  const q = await pg.evaluate(() => {
    const g = window.__golaco, r = {};
    for (const nome of ['baixa', 'media', 'alta']) {
      g.definirQualidade(nome);
      g.relogio.avancar(1000 / 60, { desenhar: true });
      r[nome] = { ...g.estadio.torcida };
    }
    // a mesma câmera, com e sem a torcida: quantas chamadas ela custa
    g.cameraLivre({ de: [0, 14, 12], para: [0, 8, -55], fov: 45 });
    g.desenhar(); const com = g.estado().desenhoChamadas;
    g.estadio.mostrarTorcida(false); g.desenhar(); const sem = g.estado().desenhoChamadas;
    g.estadio.mostrarTorcida(true); g.desenhar();
    // a câmera de TV no meio-campo: quantas malhas da torcida vão para a GPU
    g.cameraLivre({ de: [0, 18.3, 40], para: [0, 0, 0], fov: 32 });
    g.desenhar(); const comTV = g.estado().desenhoChamadas;
    g.estadio.mostrarTorcida(false); g.desenhar(); const semTV = g.estado().desenhoChamadas;
    g.estadio.mostrarTorcida(true); g.desenhar();
    g.cameraLivre(null);
    return { ...r, com, sem, meio: comTV - semTV };
  });
  meta('Torcida: Baixa < Média < Alta (Baixa sem animação)', `baixa ${q.baixa.n} (${q.baixa.animada ? 'animada' : 'parada'}) · média ${q.media.n} · alta ${q.alta.n}`, 'crescente; Baixa parada; Média e Alta animadas',
    q.baixa.n < q.media.n && q.media.n < q.alta.n && !q.baixa.animada && q.media.animada && q.alta.animada && q.alta.visivel);
  meta('Torcida: no máximo 3 chamadas de desenho (uma malha instanciada por arquibancada)', `com ${q.com} · sem ${q.sem} (olhando o lado de lá)`, '1 a 3 a mais', q.com - q.sem >= 1 && q.com - q.sem <= 3);
  meta('Torcida: os fundos saem do desenho quando a câmera de TV está no meio-campo (corte pela câmera)', `meio-campo: ${q.meio} chamadas da torcida`, '1 (só o lado de lá)', q.meio === 1);
  // contraprova M4: trocar a qualidade no meio do jogo (a Automática faz isso sozinha) com a CPU 4× mais lenta —
  // a parte da torcida (antes ela era remontada: ~300 ms); a troca do renderizador (sombras, antialias) é a de antes
  {
    const cdp = await contexto.newCDPSession(pg);
    const mem0 = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geo: e.geometrias, tex: e.texturas }; });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    const trocas = await pg.evaluate(() => {
      const g = window.__golaco;
      if (!g.estadio.trocarTorcida) return null;
      return ['baixa', 'media', 'alta', 'media', 'baixa', 'alta'].map(q => g.estadio.trocarTorcida(q));
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: true }); });
    const mem1 = await pg.evaluate(() => { const e = window.__golaco.estado(); return { geo: e.geometrias, tex: e.texturas, n: window.__golaco.estadio.torcida.n }; });
    const pior = trocas ? Math.max(...trocas) : Infinity;
    meta('Trocar a qualidade não remonta a torcida (CPU 4× mais lenta)', trocas ? `pior troca da torcida ${f2(pior)} ms (${trocas.map(t => t.toFixed(1)).join(' · ')}); geometrias ${mem0.geo}→${mem1.geo}, texturas ${mem0.tex}→${mem1.tex}` : 'sem medida (a troca remonta a torcida)', '≤ 5 ms; sem vazamento',
      trocas && pior <= 5 && mem1.geo <= mem0.geo && mem1.tex <= mem0.tex && mem1.n === q.alta.n);
  }

  // 2) torcida aparece (pixels da arquibancada) de dia e de noite
  for (const hora of ['dia', 'noite']) {
    await pg.evaluate(h => { const g = window.__golaco; g.definirHora(h); g.cameraLivre({ de: [0, 14, 12], para: [0, 8, -55], fov: 45 }); g.estadio.mostrarTorcida(true); g.desenhar(); }, hora);
    await pg.evaluate(() => document.documentElement.classList.add('sem-hud'));
    const com = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(false); g.desenhar(); });
    const sem = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(true); g.cameraLivre(null); g.desenhar(); document.documentElement.classList.remove('sem-hud'); });
    const d = await diferenca(contexto, com, sem, { x: 0, y: 120, w: 1280, h: 330, larguraCss: 1280 });
    meta(`Torcida visível na arquibancada (${hora})`, `diferença média ${f2(d)} (0–255)`, '≥ 12', d >= 12);
  }
  await pg.evaluate(() => window.__golaco.definirHora('dia'));

  // 3) o apito do começo da partida: chega antes de qualquer gesto, fica pendente e toca no primeiro gesto
  //    (contraprova I5: o 1º passo limpava o 'saida' e não havia contexto; nunca tocava)
  await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 5 }));
  const pend = await pg.evaluate(() => window.__golaco.estadio.som?.pendente ?? null);
  await pg.mouse.click(640, 400);
  await pg.waitForFunction(() => { const s = window.__golaco.estadio.som; return s && s.decodificados.filter(n => !n.startsWith('canto')).length >= 11 && s.lacos.length >= 3; }, null, { timeout: 30000 }).catch(() => {});
  await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  await pg.waitForTimeout(1200);
  const som1 = await pg.evaluate(() => ({ ...window.__golaco.estadio.som, criados: window.__ctxCriados }));
  meta('Som: o clique cria e retoma o AudioContext', `${som1.estado} (${som1.criados} contexto)`, 'rodando, 1', som1.estado === 'rodando' && som1.criados === 1);
  const fixos = som1.decodificados.filter(n => !n.startsWith('canto'));
  meta('Som: 11 gravações decodificadas (cantos sob demanda) e os 3 laços do leito tocando', `decodificados [${som1.decodificados}] · laços [${som1.lacos}] · níveis ${JSON.stringify(som1.niveis)}`, '11 e 3, murmúrio > 0',
    fixos.length === 11 && som1.lacos.length === 3 && som1.niveis.ambiente > 0.05);
  meta('Apito do início da partida (pendente até o 1º gesto, toca no gesto)', `antes do gesto: pendente ${pend ?? 'nada'}; depois: apito tocou ${som1.tocados.apito ?? 0}×`, 'pendente apito; tocou ≥ 1', pend === 'apito' && (som1.tocados.apito ?? 0) >= 1);
  const apitoReinicio = await pg.evaluate(() => { const g = window.__golaco, a = g.estadio.som.tocados.apito ?? 0; g.reiniciar({ modo: 'partida', semente: 5 }); return (g.estadio.som.tocados.apito ?? 0) - a; });
  meta('Apito no "Reiniciar partida"', `${apitoReinicio} apito`, '1', apitoReinicio === 1);
  // contraprova I1: o grito gravado do gol já sai alto (antes ficava ~15 dB abaixo do murmúrio por 4 s)
  const env = await pg.evaluate(() => window.__golaco.estadio.analisarSom?.('gol') ?? null);
  meta('Grito do gol sai na hora (gravação)', env ? `chega a 6 dB do pico em ${f2(env.t6dB)} s; média dos 2,5 s ${f2(env.media0a2_5Db)} dB (pico ${f2(env.picoDb)} dB)` : 'sem análise',
    '≤ 0,3 s; média ≥ pico − 9 dB', env && env.t6dB <= 0.3 && env.media0a2_5Db >= env.picoDb - 9);

  // 4) gol roteirizado do time 0 (Golaço FC): o caminho todo do jogo até o "GOL!"
  const tocados0 = await pg.evaluate(() => ({ ...(window.__golaco.estadio.som?.tocados ?? {}) }));
  const gol = await golRoteirizado(pg, { semente: 5, time: 0 });
  meta('Gol roteirizado (sem depender da IA nem do goleiro)', gol.ok ? `autor ${gol.autor}, gol no tick ${gol.golTick} (${gol.golTick - gol.tickChute} passos depois do chute), ${gol.movidos} tirados do caminho` : `sem gol (${JSON.stringify(gol)})`, 'gol', gol.ok);
  if (!gol.ok) throw new Error('o gol roteirizado não saiu');
  const hudGol = await pg.evaluate(() => {
    const g = window.__golaco;
    const el = document.getElementById('gol-tela');
    const r0 = el.getBoundingClientRect();
    const debaixo = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
    // nenhum outro texto na tela durante o gol (sem narração): o aviso de lance não aparece
    const aviso = document.getElementById('aviso');
    return {
      visivel: el.classList.contains('visivel'), texto: el.textContent.replace(/\s+/g, ' ').trim(),
      aviso: aviso.classList.contains('visivel') ? aviso.textContent : '',
      pulso: document.querySelector('.placar').classList.contains('gol-pulso'), plano: g.estadio.planoCamera ?? (g.estadio.efeitoCamera ? 'leve' : 'jogo'),
      pega: el.contains(debaixo),
    };
  });
  meta('Gol: só "GOL!" na tela (sem autor, minuto nem aviso de lance: sem narração)', `"${hudGol.texto}"${hudGol.aviso ? `, aviso "${hudGol.aviso}"` : ''}`, 'GOL!', hudGol.visivel && hudGol.texto === 'GOL!' && !hudGol.aviso);
  meta('Gol: placar pulsa e a câmera CORTA para a câmera do gol', `placar ${hudGol.pulso ? 'pulsando' : 'parado'}, câmera ${hudGol.plano}`, 'pulsando, fechado (câmera do gol)', hudGol.pulso && hudGol.plano === 'fechado');
  meta('Gol: o aviso não pega toque nem clique', hudGol.pega ? 'pega' : 'passa direto para o jogo', 'passa direto', !hudGol.pega);
  // a rede: até 0,25 s depois da 1ª batida, a maior bolsa e o quanto a bola desenhada entra (câmera do jogo)
  const somGol0 = await pg.evaluate(() => ({ ...(window.__golaco.estadio.som?.tocados ?? {}) }));
  const lance = await pg.evaluate(() => {
    const g = window.__golaco;
    let n = 0;
    while (g.estadio.rede.batidas === 0 && n < 60) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
    let melhor = { desloc: 0, imp: null, k: -1 }, entra = 0;
    const t0 = g.mundo.tick;
    for (let k = 0; k < 15; k++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      for (const imp of g.estadio.rede.impactos) {
        const d = g.estadio.deslocamentoRede(imp.plano, imp.x, imp.y, imp.z);
        if (d > melhor.desloc) melhor = { desloc: d, imp, k, tick: g.mundo.tick };
      }
      const bolaD = g.estadio.bolaDesenhada, bolaF = g.render.bola;
      entra = Math.max(entra, Math.hypot(bolaD.x - bolaF.x, bolaD.y - bolaF.y, bolaD.z - bolaF.z));
    }
    return { n, t0, ...melhor, entra, batidas: g.estadio.rede.batidas };
  });
  meta('A rede estufa no ponto da batida', lance.imp ? `${f2(lance.desloc)} m para fora (amplitude ${f2(lance.imp.amp)} m, pano ${lance.imp.plano}), ${lance.k + 1} passo(s) depois` : 'sem batida', '≥ 0,2 m', lance.desloc >= 0.2);
  meta('A bola desenhada entra na rede junto', `${f2(lance.entra)} m além do ponto da física`, '≥ 0,12 m', lance.entra >= 0.12);
  // o mesmo instante (o da maior bolsa) com e sem a onda, na câmera do JOGO no gol (a câmera do gol): pixels da
  // caixa do gol que mudam e quanto o ponto da bolsa anda na tela
  const golGeo = await golRoteirizado(pg, { semente: 5, time: 0 });
  const quadroRede = await pg.evaluate(alvo => {
    const g = window.__golaco;
    while (g.mundo.tick < alvo) g.relogio.avancar(1000 / 60, { desenhar: false });
    g.desenhar();
    document.documentElement.classList.add('sem-hud');
    const im = g.estadio.rede.impactos[0];
    const s = im.x > 0 ? 1 : -1;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const x of [52.5, 55.2]) for (const y of [0, 3]) for (const z of [-4.4, 4.4]) { const p = g.naTela(s * x, y, z); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
    const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
    const caixa = { x: cl(x0, 0, 1279), y: cl(y0, 0, 719), w: cl(x1, 1, 1280) - cl(x0, 0, 1279), h: cl(y1, 1, 720) - cl(y0, 0, 719) };
    // ponto da bolsa: parado × estufado (pela normal do pano)
    const d = g.estadio.deslocamentoRede(im.plano, im.x, im.y, im.z);
    const n = im.plano % 4 === 0 ? [s, 0, 0] : im.plano % 4 === 1 ? [0, 1, 0] : [0, 0, im.plano % 4 === 2 ? -1 : 1];
    const a = g.naTela(im.x, im.y, im.z), b = g.naTela(im.x + n[0] * d, im.y + n[1] * d, im.z + n[2] * d);
    return { caixa, px: Math.hypot(b.x - a.x, b.y - a.y), d, plano: g.estadio.planoCamera };
  }, golGeo.golTick + ((lance.tick ?? gol.golTick) - gol.golTick));
  const cheia = await pg.screenshot({ type: 'png' });
  await pg.evaluate(() => { const g = window.__golaco; g.estadio.redeOnda(false); g.desenhar(); });
  const parada = await pg.screenshot({ type: 'png' });
  await pg.evaluate(() => { const g = window.__golaco; g.estadio.redeOnda(true); g.desenhar(); });
  const dRede = await diferenca(contexto, cheia, parada, { ...quadroRede.caixa, fracao: true, larguraCss: 1280 });
  meta('A rede mexe na tela no gol (câmera do jogo: o mesmo instante com × sem a onda)', `câmera ${quadroRede.plano}: a bolsa anda ${f2(quadroRede.px)} px na tela; ${f2(dRede * 100)}% dos pixels da caixa do gol mudam (${quadroRede.caixa.w}×${quadroRede.caixa.h} px)`, '≥ 25 px e ≥ 1%', quadroRede.px >= 25 && dRede >= 0.01);
  // a torcida no quadro da câmera do gol (com × sem ela)
  await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(false); g.desenhar(); });
  const semTorcida = await pg.screenshot({ type: 'png' });
  await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(true); g.desenhar(); document.documentElement.classList.remove('sem-hud'); });
  const dTorc = await diferenca(contexto, cheia, semTorcida, { x: 0, y: 0, w: 1280, h: 720, fracao: true, larguraCss: 1280 });
  meta('Câmera do gol: a torcida enche o fundo do quadro', `${f2(dTorc * 100)}% da tela é torcida`, '≥ 20%', dTorc >= 0.2);
  // a câmera de verdade (quadros da página) do gol até a saída de bola: cortes e tranco; e o apito da saída
  const somGol1 = await pg.evaluate(() => ({ ...(window.__golaco.estadio.som?.tocados ?? {}) }));
  const golCam = await golRoteirizado(pg, { semente: 5, time: 0 });
  const somSaida0 = await pg.evaluate(() => ({ ...(window.__golaco.estadio.som?.tocados ?? {}) }));
  const camEf = await pg.evaluate(async golTick => {
    const g = window.__golaco;
    const ps = [], planos = [];
    let saidaTick = null, visivelNaSaida = null;
    for (let i = 0; i < 260 && (saidaTick == null || g.mundo.tick < saidaTick + 12); i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      ps.push({ ...g.render.camera }); planos.push(g.estadio.planoCamera);
      if (saidaTick == null && g.mundo.partida.estado !== 'gol') { saidaTick = g.mundo.tick; visivelNaSaida = document.getElementById('gol-tela').classList.contains('visivel'); }
    }
    let cortes = 0, maxPasso = 0, maxAcel = 0;
    for (let i = 1; i < ps.length; i++) {
      const p = Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y, ps[i].z - ps[i - 1].z);
      if (p > 1) { cortes++; continue; }
      maxPasso = Math.max(maxPasso, p);
      if (i >= 2 && Math.hypot(ps[i - 1].x - ps[i - 2].x, ps[i - 1].y - ps[i - 2].y, ps[i - 1].z - ps[i - 2].z) <= 1) maxAcel = Math.max(maxAcel, Math.hypot(ps[i].x - 2 * ps[i - 1].x + ps[i - 2].x, ps[i].y - 2 * ps[i - 1].y + ps[i - 2].y, ps[i].z - 2 * ps[i - 1].z + ps[i - 2].z));
    }
    return { cortes, maxPasso, maxAcel, ultimo: planos[planos.length - 1], efeito: g.estadio.efeitoCamera, golTick, saidaTick, visivelNaSaida, fechado: planos.filter(p => p === 'fechado').length };
  }, golCam.golTick);
  const somSaida1 = await pg.evaluate(() => ({ ...(window.__golaco.estadio.som?.tocados ?? {}) }));
  meta('Câmera do gol sem enjoar: só cortes (nada de travelling rápido) e volta na saída', `${camEf.cortes} corte(s); entre eles maior passo ${f2(camEf.maxPasso * 100)} cm/quadro, maior tranco ${f2(camEf.maxAcel * 100)} cm; depois da saída: ${camEf.ultimo}`, '≤ 2 cortes; ≤ 15 cm e ≤ 10 cm; jogo',
    camEf.cortes <= 2 && camEf.maxPasso <= 0.15 && camEf.maxAcel <= 0.1 && camEf.ultimo === 'jogo' && !camEf.efeito);
  meta('O "GOL!" sai na saída de bola', camEf.visivelNaSaida ? 'ainda na tela na saída' : 'saiu', 'saiu', camEf.visivelNaSaida === false);
  // a saída de bola, passo a passo (exato), no mesmo gol roteirizado
  await golRoteirizado(pg, { semente: 5, time: 0 });
  const saida = await pg.evaluate(() => {
    const g = window.__golaco, m = g.mundo, golTick = m.golTick;
    let saidaTick = null;
    for (let i = 0; i < 400 && saidaTick === null; i++) { g.rodarPassos(1, 'demo'); if (m.partida.estado !== 'gol') saidaTick = m.tick; }
    return { golTick, saidaTick };
  });
  meta('A saída de bola não atrasa (o mesmo tick: PARTIDA.golPausa)', `saída ${saida.saidaTick - saida.golTick} ticks depois do gol`, '150 ticks (2,5 s)', saida.saidaTick - saida.golTick === 150);
  await pg.waitForTimeout(300);
  const som2 = await pg.evaluate(() => window.__golaco.estadio.som);
  const dif = (a, b, k) => (a[k] ?? 0) - (b[k] ?? 0);
  // gol e chuá: no 1º gol roteirizado (do gol até 0,25 s depois da batida); apito: na saída de bola do 3º
  const nGol = dif(somGol1, tocados0, 'gol'), nRede = dif(somGol1, tocados0, 'rede'), nApito = dif(somSaida1, somSaida0, 'apito');
  meta('Som: gol, chuá da rede e apito da saída tocaram', `gol ${nGol} · rede ${nRede} · apito na saída ${nApito}`, '≥ 1 cada (gol, rede, apito)', nGol >= 1 && nRede >= 1 && nApito >= 1);
  const torc = await pg.evaluate(() => window.__golaco.estadio.emocao);
  meta('Torcida da casa explodiu no gol', `gols contados ${torc.contagem.gol ?? 0}`, '≥ 1', (torc.contagem.gol ?? 0) >= 1);

  // 5) gol do visitante: a casa cala
  const golFora = await golRoteirizado(pg, { semente: 5, time: 1 });
  const fora = await pg.evaluate(() => {
    const g = window.__golaco;
    for (let i = 0; i < 90; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    return { agito: g.estadio.emocao.agito, casa: g.estadio.emocao.torcida[0], visit: g.estadio.emocao.torcida[1], niveis: g.estadio.som.niveis };
  });
  meta('Gol do visitante: a casa cala, só o setor deles comemora', golFora.ok ? `barulho ${f2(fora.agito)} (laço agitado ${f2(fora.niveis.agito)}); casa lamento ${f2(fora.casa.lamento)}, visitante excita ${f2(fora.visit.excita)}` : 'sem gol',
    'barulho ≤ 0,15; casa lamenta; visitante comemora', golFora.ok && fora.agito <= 0.15 && fora.casa.lamento > 0.3 && fora.visit.excita > 0.8);

  // 6) treino de condução: a bola entra, o "GOL!" e o efeito da câmera acabam quando ela volta ao pé (1 s)
  const treino = await pg.evaluate(async () => {
    const g = window.__golaco;
    const { criarBola } = await import('./js/bola.js');
    g.reiniciar({ modo: 'conducao', semente: 5 });
    for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    const m = g.mundo;
    m.posse = null;
    Object.assign(m.bola, criarBola(51.5, 0.5));
    m.bola.v.x = 9;
    let golT = null, voltaT = null, depois = null;
    for (let i = 0; i < 200 && depois == null; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      if (golT == null && document.getElementById('gol-tela').classList.contains('visivel')) golT = g.mundo.tick;
      if (golT != null && voltaT == null && g.mundo.eventos.some(e => e.tipo === 'recomeco')) {
        voltaT = g.mundo.tick;
        depois = { visivel: document.getElementById('gol-tela').classList.contains('visivel'), efeito: g.estadio.efeitoCamera, plano: g.estadio.planoCamera };
      }
    }
    return { golT, voltaT, depois };
  });
  meta('Treino de condução: o "GOL!" e a câmera acabam quando a bola volta', treino.depois ? `bola de volta ${treino.voltaT - treino.golT} ticks depois do gol; "GOL!" ${treino.depois.visivel ? 'ainda na tela' : 'saiu'}, câmera ${treino.depois.efeito ? 'com efeito' : 'normal'}` : `sem gol/recomeço (${JSON.stringify(treino)})`,
    'saiu e normal', treino.depois && !treino.depois.visivel && !treino.depois.efeito);

  // 7) som desligado: ganho 0, contexto suspenso, nada toca, salvo; religado em 50%
  await pg.evaluate(() => window.__golaco.reiniciar({ modo: 'partida', semente: 5 }));
  await pg.evaluate(() => window.__golaco.definirSom(false));
  await pg.waitForTimeout(600);
  const mudo = await pg.evaluate(() => {
    const g = window.__golaco;
    const antes = { ...g.estadio.som.tocados };
    const pedidos0 = Object.values(g.estadio.emocao.contagem).reduce((a, v) => a + v, 0);
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(1500, 'demo');
    const s = g.estadio.som;
    const soma = o => Object.values(o).reduce((a, v) => a + v, 0);
    return { ganho: s.ganhoMestre, contexto: s.contexto, estado: s.estado, tocou: soma(s.tocados) - soma(antes), pedidos: Object.values(g.estadio.emocao.contagem).reduce((a, v) => a + v, 0) - pedidos0, salvo: JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').som };
  });
  meta('Som desligado: ganho 0, contexto SUSPENSO, nada toca, fica salvo', `ganho ${f2(mudo.ganho)}, contexto ${mudo.contexto}, ${mudo.tocou} sons (de ${mudo.pedidos} pedidos), salvo ${mudo.salvo}`, 'ganho ≤ 0,01, suspended, 0 sons, salvo false',
    mudo.ganho <= 0.01 && mudo.contexto === 'suspended' && mudo.tocou === 0 && mudo.pedidos > 0 && mudo.salvo === false);
  // a página aberta já com o som desligado: o gesto não cria contexto e nada baixa (nem depois dos 4 s)
  const mp3Antes = mp3.length;
  await pg.reload({ waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  await pg.mouse.click(640, 400);
  await pg.keyboard.press('ArrowLeft');
  await pg.waitForTimeout(5500);
  const desl = await pg.evaluate(() => ({ criados: window.__ctxCriados, estado: window.__golaco.estadio.som?.estado, info: document.getElementById('info-som')?.textContent }));
  meta('Aberta com o som desligado: o gesto não liga o Web Audio e nada baixa', `${desl.criados} AudioContext, ${mp3.length - mp3Antes} MP3 baixados em 5,5 s, estado ${desl.estado} ("${desl.info}")`, '0, 0, desligado', desl.criados === 0 && mp3.length === mp3Antes && desl.estado === 'desligado');
  await pg.evaluate(() => { window.__golaco.definirSom(true); window.__golaco.definirVolume(0.5); });
  await pg.waitForTimeout(800);
  const volta2 = await pg.evaluate(() => ({ ganho: window.__golaco.estadio.som.ganhoMestre, contexto: window.__golaco.estadio.som.contexto, vol: JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').volume }));
  meta('Religado em 50% (salvo)', `ganho ${f2(volta2.ganho)}, contexto ${volta2.contexto}, salvo ${volta2.vol}`, '≈ 0,5, running e 0.5', Math.abs(volta2.ganho - 0.5) < 0.03 && volta2.contexto === 'running' && volta2.vol === 0.5);

  // 9) as contas da GPU = as do JS (o shader de verdade, em float)
  const gpu = await pg.evaluate(async () => {
    const TD = await import('./js/render/torcida-dados.js');
    const RO = await import('./js/render/rede-onda.js');
    if (!TD.POSE_GLSL) return { erro: 'sem POSE_GLSL (a pose do shader é escrita à mão)' };
    const cv = document.createElement('canvas');
    const gl = cv.getContext('webgl2');
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return { erro: 'sem WebGL2 com textura float' };
    const N = 4096;
    cv.width = N; cv.height = 1;
    const prog = (frag) => {
      const sh = (tipo, src) => { const s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, frag));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
      return p;
    };
    const texDados = (dados, largura, altura) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, largura, altura, 0, gl.RGBA, gl.FLOAT, dados); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST); return t; };
    const alvo = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, alvo); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 1, 0, gl.RGBA, gl.FLOAT, null);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, alvo, 0);
    const rodar = (p, entrada, linhas) => {
      gl.useProgram(p); gl.viewport(0, 0, N, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texDados(entrada, N, linhas)); gl.uniform1i(gl.getUniformLocation(p, 'uEntrada'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const out = new Float32Array(4 * N); gl.readPixels(0, 0, N, 1, gl.RGBA, gl.FLOAT, out); return out;
    };
    let semente = 12345;
    const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
    // pose: (ex, te, la, pa) e (h, h2, org, t) e (animada)
    const ent = new Float32Array(4 * N * 3);
    for (let i = 0; i < N; i++) {
      const r = [rnd(), rnd(), rnd(), rnd()].map(v => (v < 0.15 ? 0 : v));
      ent.set([r[0], r[1], r[2], r[3]], 4 * i);
      ent.set([rnd(), rnd(), rnd() < 0.2 ? 1 : 0, rnd() * 30], 4 * (N + i));
      ent.set([rnd() < 0.8 ? 1 : 0, 0, 0, 0], 4 * (2 * N + i));
    }
    const pPose = prog(`#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uEntrada; out vec4 cor;
${TD.POSE_GLSL}
void main() { int i = int(gl_FragCoord.x); vec4 a = texelFetch(uEntrada, ivec2(i, 0), 0), b = texelFetch(uEntrada, ivec2(i, 1), 0), c = texelFetch(uEntrada, ivec2(i, 2), 0);
  cor = vec4(torcidaPose(a.x, a.y, a.z, a.w, b.x, b.y, b.z, b.w, c.x), 0.0, 1.0); }`);
    const oPose = rodar(pPose, ent, 3);
    let poseDif = 0, puloDif = 0;
    for (let i = 0; i < N; i++) {
      const a = ent.subarray(4 * i, 4 * i + 4), b = ent.subarray(4 * (N + i), 4 * (N + i) + 4), c = ent[4 * (2 * N + i)];
      const r = TD.poseDoTorcedor({ excita: a[0], tensao: a[1], lamento: a[2], palmas: a[3] }, b[0], b[1], b[2] > 0.5, b[3], c > 0.5);
      if (r.pose !== Math.round(oPose[4 * i])) poseDif++;
      puloDif = Math.max(puloDif, Math.abs(r.pulo - oPose[4 * i + 1]));
    }
    // rede: 4 batidas de verdade, pontos dos 8 panos em τ variados
    const est = RO.criarOndas();
    const bat = [{ plano: 4, x: 54.5, y: 0.9, z: -1.2, vel: 24, sinal: 1 }, { plano: 7, x: 53.6, y: 1.2, z: 3.66, vel: 12, sinal: 1 }, { plano: 5, x: 53.4, y: 2.44, z: 0.8, vel: 9, sinal: -1 }, { plano: 0, x: -54.5, y: 0.5, z: 2.0, vel: 18, sinal: 1 }];
    bat.forEach((b, k) => RO.registrarImpacto(est, b, 1 + 0.05 * k));
    const t = 1.32;
    const ua = new Float32Array(16), ub = new Float32Array(16);
    RO.uniformsRede(est, t, ua, ub);
    const entR = new Float32Array(4 * N);
    const MX = 52.5, ZL = 3.66, HG = 2.44, PR = 2.0;
    for (let i = 0; i < N; i++) {
      const plano = Math.floor(rnd() * 8), s = plano >= 4 ? 1 : -1, k = plano & 3, u = rnd(), v = rnd();
      let x, y, z;
      if (k === 0) { x = s * (MX + PR); y = v * HG; z = -ZL + 2 * ZL * u; }
      else if (k === 1) { x = s * (MX + PR * v); y = HG; z = -ZL + 2 * ZL * u; }
      else { x = s * (MX + PR * u); y = v * HG; z = k === 2 ? -ZL : ZL; }
      entR.set([x, y, z, plano], 4 * i);
    }
    const pRede = prog(`#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uEntrada; out vec4 cor;
${RO.REDE_GLSL}
void main() { vec4 a = texelFetch(uEntrada, ivec2(int(gl_FragCoord.x), 0), 0);
  float d = redeDesloc(a.xyz, a.w); float f = redeFixo(a.xyz, a.w); cor = vec4(d, f, d * f, 1.0); }`);
    gl.useProgram(pRede);
    gl.uniform4fv(gl.getUniformLocation(pRede, 'uRedeA'), ua);
    gl.uniform4fv(gl.getUniformLocation(pRede, 'uRedeB'), ub);
    const oRede = rodar(pRede, entR, 1);
    let redeDif = 0, fixoDif = 0, maxD = 0;
    for (let i = 0; i < N; i++) {
      const [x, y, z, plano] = entR.subarray(4 * i, 4 * i + 4);
      const d = RO.deslocamento(est, plano, x, y, z, t), f = RO.fixo(plano, x, y, z);
      maxD = Math.max(maxD, Math.abs(d * f));
      redeDif = Math.max(redeDif, Math.abs(d * f - oRede[4 * i + 2]));
      fixoDif = Math.max(fixoDif, Math.abs(f - oRede[4 * i + 1]));
    }
    return { N, poseDif, puloDif, redeDif, fixoDif, maxD };
  });
  meta('GPU = JS: pose da torcida (4096 torcedores sorteados)', gpu.erro ?? `${gpu.poseDif} poses diferentes; pulo difere até ${(gpu.puloDif * 1000).toFixed(2)} mm`, '≤ 0,2% (limiar no float) e ≤ 1 mm', !gpu.erro && gpu.poseDif <= 0.002 * gpu.N && gpu.puloDif <= 0.001);
  meta('GPU = JS: deslocamento da rede (4096 pontos dos 8 panos, 4 batidas)', gpu.erro ?? `difere até ${(gpu.redeDif * 1000).toFixed(3)} mm (bolsa até ${f2(gpu.maxD)} m); fixação até ${gpu.fixoDif.toExponential(1)}`, '≤ 0,1 mm (fixação ≤ 0,001)', !gpu.erro && gpu.redeDif <= 1e-4 && gpu.fixoDif <= 1e-3 && gpu.maxD > 0.1);
  // 12) FESTA (pedido de 11/10: "bandeirões, sinalizadores"): (a) as faixas/bandeiras/bandeirões e os sinalizadores
  //     custam no máximo 2 chamadas de desenho a mais no jogo (20 instantes, inclusive a saída com sinalizadores); (b) a
  //     onda da bandeira na GPU = no JS (4096 pontos); (c) no gol da casa, a organizada atrás do gol muda na câmera do
  //     gol (bandeirão abrindo e sinalizadores: o mesmo quadro com × sem a festa); (d) overdraw da fumaça ≤ 0,5 tela.
  {
    const cham = await pg.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ modo: 'partida', semente: 4 });
      const dif = [], tot = [];
      for (let k = 0; k < 20; k++) {
        for (let i = 0; i < (k < 4 ? 30 : 90); i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        g.estadio.mostrarFesta(true); g.desenhar(); const a = g.estado().desenhoChamadas;
        g.estadio.mostrarFesta(false); g.desenhar(); const b = g.estado().desenhoChamadas;
        g.estadio.mostrarFesta(true);
        dif.push(a - b); tot.push(a);
      }
      return { dif, tot, max: Math.max(...dif) };
    });
    const s = [...cham.tot].sort((a, b) => a - b);
    meta('Festa: faixas, bandeiras, bandeirões e sinalizadores custam ≤ 2 chamadas de desenho no jogo', `a mais: [${cham.dif.join(' ')}] (máx ${cham.max}); total no jogo: mediana ${s[10]}, máx ${s[19]} (publicada sem a festa, mesma medida: 26–27)`,
      '≤ 2; mediana ≤ 33', cham.max <= 2 && s[10] <= 33);
    const gpuB = await pg.evaluate(async () => {
      const BD = await import('./js/render/bandeiras-dados.js');
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2');
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) return { erro: 'sem WebGL2 com textura float' };
      const N = 4096;
      cv.width = N; cv.height = 1;
      const sh = (tipo, src) => { const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uEntrada; out vec4 cor;
${BD.BANDEIRA_GLSL}
void main() { int i = int(gl_FragCoord.x); vec4 a = texelFetch(uEntrada, ivec2(i, 0), 0), b = texelFetch(uEntrada, ivec2(i, 1), 0);
  cor = vec4(bandeiraPonto(a.x, a.y, a.z, a.w, b.x), 1.0); }`));
      gl.linkProgram(p);
      let semente = 777;
      const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
      const ent = new Float32Array(4 * N * 2);
      for (let i = 0; i < N; i++) {
        ent.set([rnd() * BD.BANDEIRAS.largura, rnd() * BD.BANDEIRAS.altura, rnd() * 6.283, rnd() * 600], 4 * i);
        ent.set([rnd() < 0.85 ? 1 : 0, 0, 0, 0], 4 * (N + i));
      }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 2, 0, gl.RGBA, gl.FLOAT, ent);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const alvo = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, alvo); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 1, 0, gl.RGBA, gl.FLOAT, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, alvo, 0);
      gl.useProgram(p); gl.viewport(0, 0, N, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(p, 'uEntrada'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const out = new Float32Array(4 * N); gl.readPixels(0, 0, N, 1, gl.RGBA, gl.FLOAT, out);
      let dif = 0, maxOnda = 0;
      for (let i = 0; i < N; i++) {
        const a = ent.subarray(4 * i, 4 * i + 4), an = ent[4 * (N + i)];
        const r = BD.pontoBandeira(a[0], a[1], a[2], a[3], an);
        maxOnda = Math.max(maxOnda, Math.abs(r.ln));
        dif = Math.max(dif, Math.abs(r.la - out[4 * i]), Math.abs(r.lb - out[4 * i + 1]), Math.abs(r.ln - out[4 * i + 2]));
      }
      return { N, dif, maxOnda };
    });
    meta('GPU = JS: onda e balanço da bandeira (4096 pontos do pano)', gpuB.erro ?? `difere até ${(gpuB.dif * 1000).toFixed(2)} mm (onda até ${f2(gpuB.maxOnda)} m)`, '≤ 2 mm (seno de t grande no float)', !gpuB.erro && gpuB.dif <= 0.002 && gpuB.maxOnda > 0.1);
    // debaixo do bandeirão aberto (contraprova de 12/10: bandeiras e torcedores furavam o pano) — a conta da GPU
    // (SOB_GLSL, em torcida.js e bandeiras.js) = a do JS (sobBandeirao) em 4096 pontos em volta dos dois bandeirões
    const gpuS = await pg.evaluate(async () => {
      const BD = await import('./js/render/bandeiras-dados.js');
      if (!BD.SOB_GLSL) return { erro: 'não existe (bandeiras e torcedores furam o bandeirão aberto)' };
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl2');
      if (!gl || !gl.getExtension('EXT_color_buffer_float')) return { erro: 'sem WebGL2 com textura float' };
      const N = 4096, ban = BD.bandeiroes(), mg = BD.BANDEIRAS.sob.bandeira;
      cv.width = N; cv.height = 1;
      const v3 = a => `vec3(${a.map(x => x.toFixed(6)).join(', ')})`;
      const sh = (tipo, src) => { const o = gl.createShader(tipo); gl.shaderSource(o, src); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, '#version 300 es\nvoid main(){ vec2 v = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2)); gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0); }'));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, `#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uEntrada; out vec4 cor;
${BD.SOB_GLSL}
void main() { int i = int(gl_FragCoord.x); vec4 a = texelFetch(uEntrada, ivec2(i, 0), 0);
  vec2 mg = vec2(${mg[0].toFixed(3)}, ${mg[1].toFixed(3)});
  float s = (i % 2 == 0) ? sobBandeirao(a.xyz, ${v3(ban[0].A)}, ${v3(ban[0].U)}, ${v3(ban[0].V)}, a.w, mg)
                         : sobBandeirao(a.xyz, ${v3(ban[1].A)}, ${v3(ban[1].U)}, ${v3(ban[1].V)}, a.w, mg);
  cor = vec4(s, 0.0, 0.0, 1.0); }`));
      gl.linkProgram(p);
      let semente = 4242;
      const rnd = () => { semente = (semente * 1664525 + 1013904223) >>> 0; return semente / 4294967296; };
      const ent = new Float32Array(4 * N);
      for (let i = 0; i < N; i++) {
        const b = ban[i % 2], c = [b.A[0] + b.U[0] / 2 + b.V[0] / 2, b.A[1] + b.V[1] / 2, b.A[2] + b.U[2] / 2 + b.V[2] / 2];
        ent.set([c[0] + (rnd() - 0.5) * 50, c[1] + (rnd() - 0.5) * 16, c[2] + (rnd() - 0.5) * 50, rnd() < 0.1 ? 0 : rnd()], 4 * i);
      }
      const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 1, 0, gl.RGBA, gl.FLOAT, ent);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      const alvo = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, alvo); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, N, 1, 0, gl.RGBA, gl.FLOAT, null);
      const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, alvo, 0);
      gl.useProgram(p); gl.viewport(0, 0, N, 1);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t); gl.uniform1i(gl.getUniformLocation(p, 'uEntrada'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      const out = new Float32Array(4 * N); gl.readPixels(0, 0, N, 1, gl.RGBA, gl.FLOAT, out);
      let dif = 0, dentro = 0;
      for (let i = 0; i < N; i++) {
        const a = ent.subarray(4 * i, 4 * i + 4);
        const js = BD.sobBandeirao([a[0], a[1], a[2]], ban[i % 2], a[3], mg) ? 1 : 0;
        if (js) dentro++;
        if (js !== Math.round(out[4 * i])) dif++;
      }
      return { N, dif, dentro };
    });
    meta('GPU = JS: debaixo do bandeirão aberto (4096 pontos em volta dos dois)', gpuS.erro ?? `${gpuS.dif} diferentes (${gpuS.dentro} debaixo do pano)`, '≤ 0,2% (beirada no float), ≥ 400 debaixo', !gpuS.erro && gpuS.dif <= 0.002 * gpuS.N && gpuS.dentro >= 400);
    // (c) e (d): gol da casa, 2,2 s depois (ainda na câmera do gol, antes da saída de bola)
    const golF = await golRoteirizado(pg, { semente: 5, time: 0 });
    const festaGol = await pg.evaluate(() => {
      const g = window.__golaco;
      for (let i = 0; i < 132; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = 320; off.height = 180;
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      g.estadio.mostrarFesta(true); g.desenhar(); const a = ler();
      const fv = g.estadio.festaVisual, plano = g.estadio.planoCamera, acesos = g.estadio.festa.flares.length;
      const ov = g.estadio.overdrawFumaca();
      g.estadio.mostrarFesta(false); g.desenhar(); const b = ler();
      g.estadio.mostrarFesta(true); g.desenhar();
      let n = 0;
      for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 20) n++;
      return { frac: n / (a.length / 4), fv, plano, acesos, ov };
    });
    meta('Gol da casa: a organizada muda na câmera do gol (bandeirão abrindo e sinalizadores)', golF.ok ? `câmera ${festaGol.plano}; bandeirão ${f2(festaGol.fv.abre)} aberto, ${festaGol.acesos} sinalizadores; ${f2(100 * festaGol.frac)}% dos pixels mudam com a festa` : 'o gol roteirizado não saiu',
      'câmera do gol; ≥ 0,8 aberto, ≥ 3 acesos, ≥ 8% da tela', golF.ok && festaGol.plano === 'fechado' && festaGol.fv.abre >= 0.8 && festaGol.acesos >= 3 && festaGol.frac >= 0.08);
    meta('Overdraw da fumaça e do brilho dos sinalizadores no pico do gol (câmera do gol, PC Alta)', `${f2(festaGol.ov)} tela(s) cheia(s)`, '≤ 0,5', festaGol.ov != null && festaGol.ov <= 0.5);
  }
  meta('Sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
} catch (e) {
  meta('Execução', e.message, 'sem exceção', false);
} finally {
  await navegador.close();
}

// 8) "GOL!" no celular: não encosta no analógico, nos botões (ataque e defesa), no placar, no minimapa nem no menu
try {
  for (const [w, h] of [[568, 320], [667, 375], [844, 390]]) {
    const { navegador: nav, pagina, erros: errosCel } = await abrir({ largura: w, altura: h, dpr: 2, toque: true });
    try {
      await pagina.goto(`${srv.url}?q=baixa&toque=1&entalhe=1&semente=5&prints=1&replay=0`, { waitUntil: 'load' });
      await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
      const r = await pagina.evaluate(async () => {
        const g = window.__golaco;
        g.mostrarEvento({ tipo: 'gol', time: 0 }, { fixo: true });
        for (const a of document.getAnimations()) { a.currentTime = 2000; a.pause(); }
        await new Promise(ok => setTimeout(ok, 200));
        const rr = el => { const b = el.getBoundingClientRect(); return { x0: b.left, y0: b.top, x1: b.right, y1: b.bottom }; };
        const partes = ['.gol-palavra'].map(s => document.querySelector(s)).filter(el => el && el.getBoundingClientRect().width > 0);
        const cruza = [];
        for (const fase of ['ataque', 'defesa']) {
          const tq = document.getElementById('toque');
          tq.classList.toggle('fase-ataque', fase === 'ataque'); tq.classList.toggle('fase-defesa', fase === 'defesa');
          const alvos = [...document.querySelectorAll('.toque .btn-toque, #analogico .analogico-base, .placar, #minimapa, .btn-menu')]
            .filter(b => { const s = getComputedStyle(b); const q = b.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && q.width > 0 && !b.closest('[hidden]'); });
          for (const p of partes) for (const b of alvos) {
            const a = rr(p), c = rr(b);
            const ix = Math.min(a.x1, c.x1) - Math.max(a.x0, c.x0), iy = Math.min(a.y1, c.y1) - Math.max(a.y0, c.y0);
            if (ix > 1 && iy > 1) cruza.push(`${p.className || p.id} × ${(b.id || b.className).slice(0, 20)} (${fase}, ${Math.round(ix)}×${Math.round(iy)} px)`);
          }
        }
        return { cruza, texto: document.getElementById('gol-tela').textContent.replace(/\s+/g, ' ').trim() };
      });
      meta(`"GOL!" no celular ${w}×${h} longe dos controles`, r.cruza.length ? r.cruza.slice(0, 4).join('; ') : `nada encosta ("${r.texto}")`, 'nada encosta', r.cruza.length === 0 && errosCel.length === 0);
    } finally { await nav.close(); }
  }
} catch (e) {
  meta('Execução (celular)', e.message, 'sem exceção', false);
}
// 10) torcida durante o jogo no celular deitado (câmera de TV do celular: CAMERA.celular)
try {
  const { navegador: nav, pagina, erros: errosCel } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(`${srv.url}?q=media&demo=1&semente=4&toque=1&hora=dia&replay=0`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    const r = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const cv = document.querySelector('canvas');
      const off = document.createElement('canvas'); off.width = 211; off.height = 98; // amostra reduzida (1/4)
      const cx = off.getContext('2d', { willReadFrequently: true });
      const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, 0, off.width, off.height).data; };
      const fr = [], alt = [];
      for (let k = 0; k < 20; k++) {
        for (let i = 0; i < 90; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        g.estadio.mostrarTorcida(true); g.desenhar(); const a = ler();
        g.estadio.mostrarTorcida(false); g.desenhar(); const b = ler();
        g.estadio.mostrarTorcida(true);
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 24) n++;
        fr.push(n / (a.length / 4));
        const j = g.render.jogador;
        if (j) { const p0 = g.naTela(j.x, 0, j.z), p1 = g.naTela(j.x, 1.8, j.z); if (p0 && p1) alt.push(Math.abs(p0.y - p1.y)); }
      }
      return { fr, alt };
    });
    const vis = r.fr.filter(f => f >= 0.01).length;
    const med = v => { const s = [...v].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
    meta('Celular deitado: a torcida aparece durante o jogo (20 instantes, ≥ 1% da tela)', `${vis}/${r.fr.length} (mediana ${f2(med(r.fr) * 100)}% da tela)`, '≥ 18/20', vis >= 18 && errosCel.length === 0);
    meta('Celular deitado: o jogador controlado não fica menor', `mediana ${f2(med(r.alt))} px de altura`, '≥ 33 px (antes 36)', med(r.alt) >= 33);
  } finally { await nav.close(); }
} catch (e) {
  meta('Execução (torcida no celular)', e.message, 'sem exceção', false);
}
// 11) LADO DE CÁ (pedido de 11/10): a câmera de TV fica DENTRO da arquibancada do lado de cá — em 20 instantes do jogo
//     (celular Média e PC Alta) nem ela nem a torcida dela vão para a GPU (o teste da caixa daria verdadeiro e os
//     torcedores cobririam a tela); de uma câmera do outro lado do campo, ela e a torcida dela aparecem (os pixels da
//     arquibancada mudam com a torcida) e o túnel fica no meio, na posição de config.js ESTADIO.tunel.
for (const [nome, o, q] of [['celular', { largura: 844, altura: 390, dpr: 2, toque: true }, 'media&toque=1'], ['PC', { largura: 1280, altura: 720 }, 'alta']]) {
  try {
    const { navegador: nav, pagina, erros: errosCa } = await abrir(o);
    try {
      await pagina.goto(`${srv.url}?q=${q}&demo=1&semente=4&hora=dia&replay=0`, { waitUntil: 'load' });
      await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
      const r = await pagina.evaluate(() => {
        const g = window.__golaco;
        g.relogio.usarManual(true);
        let viu = 0, n = 0;
        for (let k = 0; k < 20; k++) {
          for (let i = 0; i < 90; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
          g.desenhar();
          const t = g.estadio.torcida;
          if (t.ladoDeCa || t.grupos.some(x => x.nome.startsWith('torcida-ca') && x.visivel)) viu++;
          n++;
        }
        return { viu, n };
      });
      // do outro lado do campo, olhando para o lado de cá (o túnel no meio): o mesmo quadro com × sem a torcida, lido
      // direto do canvas (a 1/4; a faixa de cima, 5–60% da altura)
      const vis = await pagina.evaluate(async () => {
        const g = window.__golaco;
        g.cameraLivre({ de: [0, 9, -30], para: [0, 6, 55], fov: 40 });
        g.estadio.mostrarTorcida(true); g.desenhar();
        const t = g.estadio.torcida;
        const { ESTADIO } = await import('./js/config.js');
        const tun = g.naTela(ESTADIO.tunel.x, ESTADIO.tunel.altura / 2, ESTADIO.tunel.z);
        const cv = document.querySelector('canvas');
        const off = document.createElement('canvas'); off.width = 211; off.height = 98;
        const cx = off.getContext('2d', { willReadFrequently: true });
        const y0 = Math.round(off.height * 0.05), h = Math.round(off.height * 0.55);
        const ler = () => { cx.drawImage(cv, 0, 0, off.width, off.height); return cx.getImageData(0, y0, off.width, h).data; };
        const a = ler();
        g.estadio.mostrarTorcida(false); g.desenhar(); const b = ler();
        g.estadio.mostrarTorcida(true); g.cameraLivre(null); g.desenhar();
        let n = 0;
        for (let i = 0; i < a.length; i += 4) if ((Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3 > 20) n++;
        return { ladoDeCa: t.ladoDeCa, ca: t.grupos.filter(x => x.nome.startsWith('torcida-ca') && x.visivel).map(x => x.nome), tunelX: tun.x / window.innerWidth, d: n / (a.length / 4) };
      });
      const d = vis.d;
      const bancos = await pagina.evaluate(() => {
        const g = window.__golaco;
        // os bancos de reservas (atrás das placas de cá): com a bola perto da linha de cá, a TV do celular (mais alta e
        // mais atrás) pegava a cobertura deles no canto de baixo — uma placa lisa. Instantes com a cobertura na tela E
        // desenhada (versões sem `bancosVisiveis`: os bancos iam com as placas, sempre desenhados)
        const B = { x: [5, 17], z: [41, 43.6], altura: 2.3 };
        let bancoNaTela = 0, perto = 0;
        for (let k = 0; k < 12000 && perto < 6; k++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          const b = g.estado().bola;
          if (!(b.z > 22 && g.estado().parada == null)) continue;
          perto++;
          g.desenhar();
          let naTela = false;
          for (const s of [-1, 1]) for (const x of B.x) for (const z of B.z) {
            const p = g.naTela(s * x, B.altura, z);
            if (p.x >= 0 && p.x <= window.innerWidth && p.y >= 0 && p.y <= window.innerHeight) naTela = true;
          }
          if (naTela && (g.estadio.bancosVisiveis ?? true)) bancoNaTela++;
          for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        }
        return { bancoNaTela, perto };
      });
      meta(`Lado de cá (${nome}): fora do desenho na câmera de TV, visível do outro lado`, `${r.viu}/${r.n} instantes do jogo com algo do lado de cá no desenho · do outro lado: arquibancada ${vis.ladoDeCa ? 'sim' : 'não'}, torcida [${vis.ca}], ${(100 * d).toFixed(0)}% da faixa de cima é torcida, túnel a ${(100 * vis.tunelX).toFixed(0)}% da largura`,
        '0 no jogo; do outro lado: arquibancada, as 2 faixas da torcida, ≥ 20% e o túnel no meio (45–55%)', r.viu === 0 && vis.ladoDeCa && vis.ca.length === 2 && d >= 0.2 && Math.abs(vis.tunelX - 0.5) <= 0.05 && errosCa.length === 0);
      meta(`Bancos de reservas fora da TV (${nome}): bola perto da linha de cá`, `${bancos.bancoNaTela}/${bancos.perto} instantes com a cobertura dos bancos na tela e desenhada`, '0 (e ≥ 3 instantes medidos)', bancos.bancoNaTela === 0 && bancos.perto >= 3);
    } finally { await nav.close(); }
  } catch (e) {
    meta(`Execução (lado de cá, ${nome})`, e.message, 'sem exceção', false);
  }
}
// ------------------------------------------------------------------------------------------------------------------
// Etapa 4 (bolas paradas): no lateral do humano, a bola fica nas mãos acima da cabeça e as opções aparecem marcadas no
// gramado; com o analógico solto, a 1ª opção é a destacada (pedido do dono, seção 8: "três opções de passe e marcadores")
try {
  const { navegador: nav, pagina, erros: errosLat } = await abrir({ largura: 1280, altura: 720 });
  try {
    await pagina.goto(`${srv.url}?q=media&semente=3&hora=dia&replay=0`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    const r = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      for (let i = 0; i < 150; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.bolaParadaDeTeste('lateral');
      for (let i = 0; i < 400; i++) {
        const pr = g.mundo.parada;
        if (pr && pr.tipo === 'lateral' && pr.cobrador != null && g.mundo.tick >= pr.pronta) break;
        g.relogio.avancar(1000 / 60, { desenhar: false });
      }
      g.relogio.avancar(1000 / 60, { desenhar: true });
      g.relogio.avancar(1000 / 60, { desenhar: true });
      const pr = g.mundo.parada, c = g.mundo.jogadores.find(j => j.id === pr?.cobrador);
      return { tipo: pr?.tipo, meu: c?.time === 0 && g.mundo.controlado[0] === c?.id, y: g.mundo.bola.p.y, marcas: g.marcasLateral };
    });
    meta('Lateral do humano: bola nas mãos e as opções marcadas no gramado (a 1ª em destaque)',
      `${r.tipo}, humano cobra ${r.meu ? 'sim' : 'não'}, bola a ${f2(r.y)} m · ${r.marcas?.visivel ? `${r.marcas.ids.length} marcador(es), destaque na ${r.marcas.mirada + 1}ª` : 'sem marcadores'}`,
      'lateral, sim, ≥ 1,75 m · 1–3, a 1ª', r.tipo === 'lateral' && r.meu && r.y >= 1.75 && r.marcas?.visivel && r.marcas.ids.length >= 1 && r.marcas.ids.length <= 3 && r.marcas.mirada === 0 && errosLat.length === 0);
  } finally { await nav.close(); }
} catch (e) {
  meta('Execução (lateral: marcadores)', e.message, 'sem exceção', false);
}
await srv.fechar();

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-estadio: PASSOU' : '\nteste-estadio: REPROVOU');
process.exit(ok ? 0 : 1);
