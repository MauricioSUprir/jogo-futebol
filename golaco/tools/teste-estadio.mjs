// Estádio no navegador (Chromium): rede que balança, efeito de gol, torcida e som.
//   1) a página abre sem erro no console, com a torcida na cena (1 InstancedMesh, ≤ 1 chamada de desenho
//      a mais por ela) e mais gente na Alta que na Média e na Baixa (sem animação na Baixa);
//   2) a torcida APARECE (os pixels da arquibancada mudam com ela) de dia e de noite;
//   3) um gol de verdade (semente 6, a IA jogando pelos dois): a rede estufa ≥ 0,2 m no ponto da batida, os
//      pixels da rede mudam (o mesmo instante com e sem a onda) e a bola desenhada vai junto no bojo;
//   4) o gol: "GOL!" com o autor (do elenco) e o minuto, placar pulsando, câmera com zoom/tremor por ≤ 2,4 s,
//      o aviso não pega toque nem clique e some ANTES da saída de bola (que sai no mesmo tick de sempre);
//   5) som: nada de AudioContext antes do primeiro gesto; um clique cria e retoma (running); os laços tocam;
//      gol, chuá da rede, apito da saída tocam nos eventos; desligado (mudo): ganho 0 e nada toca.
//   node tools/teste-estadio.mjs [--raiz <pasta do jogo>]
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const raiz = path.resolve(args.includes('--raiz') ? args[args.indexOf('--raiz') + 1] : RAIZ);
const res = [];
const meta = (nome, medido, alvo, ok) => res.push({ nome, medido, alvo, ok: !!ok });
const f2 = v => (Number.isFinite(v) ? v.toFixed(2) : String(v));

/** Diferença média (0–255) entre dois PNG numa região (px CSS), opcionalmente sem um círculo. */
async function diferenca(contexto, a, b, reg, semCirculo = null) {
  const aux = await contexto.newPage();
  await aux.setContent('<canvas id="c"></canvas>');
  const r = await aux.evaluate(async ({ a, b, reg, semCirculo }) => {
    const ler = async src => { const i = new Image(); i.src = 'data:image/png;base64,' + src; await i.decode(); return i; };
    const [ia, ib] = [await ler(a), await ler(b)];
    const c = document.getElementById('c'); c.width = ia.width; c.height = ia.height;
    const g = c.getContext('2d');
    const dados = img => { g.drawImage(img, 0, 0); return g.getImageData(reg.x, reg.y, reg.w, reg.h).data; };
    const da = dados(ia), db = dados(ib);
    let soma = 0, n = 0, mudou = 0;
    for (let y = 0; y < reg.h; y++) for (let x = 0; x < reg.w; x++) {
      if (semCirculo && Math.hypot(reg.x + x - semCirculo.x, reg.y + y - semCirculo.y) < semCirculo.r) continue;
      const k = (y * reg.w + x) * 4;
      const d = (Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2])) / 3;
      soma += d; n++;
      if (d > 20) mudou++;
    }
    return reg.fracao ? mudou / Math.max(1, n) : soma / Math.max(1, n);
  }, { a: a.toString('base64'), b: b.toString('base64'), reg, semCirculo });
  await aux.close();
  return r;
}

const srv = await servidor(0, raiz);
const { navegador, contexto, pagina: pg, erros } = await abrir({ largura: 1280, altura: 720 });
try {
  await pg.goto(`${srv.url}?q=alta&hora=dia&semente=5`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
  const tem = await pg.evaluate(() => !!window.__golaco.estadio);
  meta('A página tem o estádio (torcida, rede, som)', String(tem), 'true', tem);
  if (!tem) throw new Error('página sem o estádio (versão publicada)');
  await pg.evaluate(() => window.__golaco.relogio.usarManual(true));
  // som: antes de qualquer gesto, nenhum AudioContext
  const somAntes = await pg.evaluate(() => window.__golaco.estadio.som?.estado ?? 'sem som');
  meta('Som: nada antes do primeiro gesto (política de reprodução automática)', somAntes, 'sem-contexto', somAntes === 'sem-contexto');

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

  // 2) torcida aparece (pixels da arquibancada) de dia e de noite
  for (const hora of ['dia', 'noite']) {
    await pg.evaluate(h => { const g = window.__golaco; g.definirHora(h); g.cameraLivre({ de: [0, 14, 12], para: [0, 8, -55], fov: 45 }); g.estadio.mostrarTorcida(true); g.desenhar(); }, hora);
    await pg.evaluate(() => document.documentElement.classList.add('sem-hud'));
    const com = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(false); g.desenhar(); });
    const sem = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.mostrarTorcida(true); g.cameraLivre(null); g.desenhar(); document.documentElement.classList.remove('sem-hud'); });
    const d = await diferenca(contexto, com, sem, { x: 0, y: 120, w: 1280, h: 330 });
    meta(`Torcida visível na arquibancada (${hora})`, `diferença média ${f2(d)} (0–255)`, '≥ 12', d >= 12);
  }
  await pg.evaluate(() => window.__golaco.definirHora('dia'));

  // 5a) primeiro gesto: o contexto nasce e roda; os sons baixam e os laços começam
  await pg.mouse.click(640, 400);
  await pg.waitForTimeout(300);
  await pg.evaluate(() => window.__golaco.estadio.baixarSons());
  await pg.waitForFunction(() => { const s = window.__golaco.estadio.som; return s && s.decodificados.length >= 9 && s.lacos.length >= 3; }, null, { timeout: 30000 }).catch(() => {});
  // alguns quadros com o relógio de verdade (os ganhos dos laços sobem)
  await pg.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
  await pg.waitForTimeout(1200);
  const som1 = await pg.evaluate(() => window.__golaco.estadio.som);
  meta('Som: o clique cria e retoma o AudioContext', som1.estado, 'rodando', som1.estado === 'rodando');
  meta('Som: 9 gravações decodificadas e os 3 laços tocando', `decodificados [${som1.decodificados}] · laços [${som1.lacos}] · níveis ${JSON.stringify(som1.niveis)}`, '9 e 3, murmúrio > 0',
    som1.decodificados.length === 9 && som1.lacos.length === 3 && som1.niveis.ambiente > 0.05);

  // 3) e 4) um gol DE VERDADE: partida com a semente 6 e a IA jogando pelo humano (entradaDemoPartida, a
  //    mesma conta do Node): o nº 9 do Golaço FC marca aos ~21 s (tools: acha-gol). Nada é empurrado à mão.
  const prep = await pg.evaluate(() => {
    const g = window.__golaco;
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(1150, 'demo');
    return { tocados0: { ...(g.estadio.som?.tocados ?? {}) }, placar: g.estado().placar };
  });
  const lance = await pg.evaluate(() => {
    const g = window.__golaco, m = g.mundo;
    let golTick = null, autor = null, n = 0;
    for (; n < 600 && g.estadio.rede.batidas === 0; n++) {
      g.rodarPassos(1, 'demo');
      if (golTick === null && m.partida.estado === 'gol') { golTick = m.golTick; autor = m.eventos.find(e => e.tipo === 'gol')?.autor ?? null; }
    }
    // o HUD logo depois do gol (o "GOL!" fica 2,4 s na tela)
    const el = document.getElementById('gol-tela');
    const r0 = el.getBoundingClientRect();
    const debaixo = document.elementFromPoint(r0.left + r0.width / 2, r0.top + r0.height / 2);
    const hudGol = {
      visivel: el.classList.contains('visivel'), texto: el.textContent.replace(/\s+/g, ' ').trim(),
      pulso: document.querySelector('.placar').classList.contains('gol-pulso'), camera: g.estadio.efeitoCamera,
      pega: el.contains(debaixo), minuto: g.estado().relogio.minuto,
    };
    // até 0,25 s depois da 1ª batida: a maior bolsa (de todas as batidas) e o quanto a bola desenhada entra
    let melhor = { desloc: 0, imp: null, passo: 0 }, entra = 0;
    for (let k = 0; k < 15; k++) {
      g.rodarPassos(1, 'demo');
      g.desenhar();
      for (const imp of g.estadio.rede.impactos) {
        const d = g.estadio.deslocamentoRede(imp.plano, imp.x, imp.y, imp.z);
        if (d > melhor.desloc) melhor = { desloc: d, imp, passo: k };
      }
      const bolaD = g.estadio.bolaDesenhada, bolaF = g.render.bola;
      entra = Math.max(entra, Math.hypot(bolaD.x - bolaF.x, bolaD.y - bolaF.y, bolaD.z - bolaF.z));
    }
    return { hudGol, n, golTick: golTick ?? m.golTick, autor, imp: melhor.imp, desloc: melhor.desloc, passoMax: melhor.passo, entra, placar: g.estado().placar, batidas: g.estadio.rede.batidas };
  });
  // o instante da maior bolsa de novo (tudo é determinístico: a mesma semente e os mesmos passos)
  await pg.evaluate(alvo => {
    const g = window.__golaco;
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(alvo, 'demo');
    g.desenhar();
  }, 1150 + lance.n + lance.passoMax + 1);
  meta('Gol de verdade (semente 6, IA × IA): a bola bate na rede', lance.imp ? `${lance.batidas} batidas; a maior no pano ${lance.imp.plano} em (${f2(lance.imp.x)}, ${f2(lance.imp.y)}, ${f2(lance.imp.z)}), placar ${lance.placar.join('×')}` : `nenhuma batida em ${lance.n} passos`, 'batida e gol', !!lance.imp && lance.golTick != null);
  meta('A rede estufa no ponto da batida', `${f2(lance.desloc)} m para fora (amplitude ${f2(lance.imp?.amp)} m), ${lance.passoMax + 1} passo(s) depois`, '≥ 0,2 m', lance.desloc >= 0.2);
  meta('A bola desenhada entra na rede junto', `${f2(lance.entra)} m além do ponto da física`, '≥ 0,12 m', lance.entra >= 0.12);
  // o MESMO instante com e sem a onda da rede (só o desenho muda): os pixels da rede mudam
  if (lance.imp) {
    const s = lance.imp.x > 0 ? 1 : -1;
    const cam = { de: [s * 44, 3.0, 8.5], para: [s * 53.5, 1.2, 0], fov: 46 };
    const caixa = await pg.evaluate(({ c, s }) => {
      const g = window.__golaco; g.cameraLivre(c); document.documentElement.classList.add('sem-hud'); g.desenhar();
      // a caixa do gol na tela (região da rede)
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const x of [52.5, 55.2]) for (const y of [0, 3]) for (const z of [-4.4, 4.4]) { const p = g.naTela(s * x, y, z); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      const cl = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
      return { x: cl(x0, 0, 1279), y: cl(y0, 0, 719), w: cl(x1, 1, 1280) - cl(x0, 0, 1279), h: cl(y1, 1, 720) - cl(y0, 0, 719) };
    }, { c: cam, s });
    const cheia = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.redeOnda(false); g.desenhar(); });
    const parada = await pg.screenshot({ type: 'png' });
    await pg.evaluate(() => { const g = window.__golaco; g.estadio.redeOnda(true); g.cameraLivre(null); document.documentElement.classList.remove('sem-hud'); g.desenhar(); });
    const d = await diferenca(contexto, cheia, parada, { ...caixa, fracao: true });
    meta('A rede mexe na tela (o mesmo instante com × sem a onda)', `${f2(d * 100)}% dos pixels da caixa do gol mudam (${caixa.w}×${caixa.h} px)`, '≥ 1%', d >= 0.01);
  }
  const gol = lance.hudGol;
  const nomeAutor = lance.autor != null ? await pg.evaluate(async id => { const { fichaDe } = await import('./js/elenco.js'); return fichaDe(id)?.nome ?? null; }, lance.autor) : null;

  meta('Gol: "GOL!" com o autor e o minuto', `"${gol.texto}"`, `GOL!, ${nomeAutor}, ${gol.minuto}'`, gol.visivel && /GOL!/.test(gol.texto) && !!nomeAutor && gol.texto.includes(nomeAutor) && gol.texto.includes(`${gol.minuto}'`));
  meta('Gol: placar pulsa e a câmera faz o efeito', `placar ${gol.pulso ? 'pulsando' : 'parado'}, câmera ${gol.camera ? 'com efeito' : 'sem efeito'}`, 'pulsando, com efeito', gol.pulso && gol.camera);
  meta('Gol: o aviso não pega toque nem clique', gol.pega ? 'pega' : 'passa direto para o jogo', 'passa direto', !gol.pega);
  // a câmera: alguns quadros de verdade (zoom e tremor pequenos) e volta
  // (de novo o gol, agora com o relógio da página e o desenho: a câmera segue o lance)
  const camEf = await pg.evaluate(golTick => {
    const g = window.__golaco, m = g.mundo;
    g.pausar(true);
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(golTick - 90, 'demo');
    for (let i = 0; i < 90; i++) { g.rodarPassos(1, 'demo'); g.relogio.avancar(1000 / 60, { desenhar: false }); }
    // a partir do gol: 2 s de quadros (a saída de bola, com o corte de câmera, é só aos 2,5 s)
    const ps = [];
    let ativo0 = g.estadio.efeitoCamera;
    for (let i = 0; i < 120; i++) { g.rodarPassos(1, 'demo'); g.relogio.avancar(1000 / 60, { desenhar: false }); ps.push({ ...g.render.camera }); }
    let maxPasso = 0, maxAcel = 0;
    for (let i = 1; i < ps.length; i++) maxPasso = Math.max(maxPasso, Math.hypot(ps[i].x - ps[i - 1].x, ps[i].y - ps[i - 1].y, ps[i].z - ps[i - 1].z));
    for (let i = 2; i < ps.length; i++) maxAcel = Math.max(maxAcel, Math.hypot(ps[i].x - 2 * ps[i - 1].x + ps[i - 2].x, ps[i].y - 2 * ps[i - 1].y + ps[i - 2].y));
    for (let i = 0; i < 40; i++) { g.rodarPassos(1, 'demo'); g.relogio.avancar(1000 / 60, { desenhar: false }); }
    const r = { ativo0, maxPasso, maxAcel, ativo: g.estadio.efeitoCamera, tick: m.tick };
    g.pausar(false);
    return r;
  }, lance.golTick);
  meta('Câmera do gol sem enjoar: tremor pequeno e volta ao normal', `com efeito ${camEf.ativo0}; maior passo ${f2(camEf.maxPasso * 100)} cm/quadro, maior tranco ${f2(camEf.maxAcel * 100)} cm; depois de 2,7 s: ${camEf.ativo ? 'ainda com efeito' : 'normal'}`, '≤ 15 cm, ≤ 10 cm e normal', camEf.ativo0 && camEf.maxPasso <= 0.15 && camEf.maxAcel <= 0.1 && !camEf.ativo);
  // o aviso some antes da saída de bola; a saída sai no mesmo tick de sempre (golPausa)
  await pg.waitForTimeout(2600);
  const depois = await pg.evaluate(golTick => {
    const g = window.__golaco;
    const visivel = document.getElementById('gol-tela').classList.contains('visivel');
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(golTick, 'demo');
    const m = g.mundo;
    let saidaTick = null;
    for (let i = 0; i < 400 && saidaTick === null; i++) { g.rodarPassos(1, 'demo'); if (m.partida.estado !== 'gol') saidaTick = m.tick; }
    return { visivel, saidaTick, golTick };
  }, lance.golTick);
  meta('O "GOL!" some antes da saída de bola', depois.visivel ? 'ainda na tela depois de 2,6 s' : 'sumiu (2,4 s)', 'sumiu', !depois.visivel);
  meta('A saída de bola não atrasa (o mesmo tick: PARTIDA.golPausa)', `saída ${depois.saidaTick - depois.golTick} ticks depois do gol`, '150 ticks (2,5 s)', depois.saidaTick - depois.golTick === 150);
  await pg.waitForTimeout(300);
  const som2 = await pg.evaluate(() => window.__golaco.estadio.som);
  const novo = k => (som2.tocados[k] ?? 0) - (prep.tocados0[k] ?? 0);
  meta('Som: gol, chuá da rede e apito da saída tocaram', `gol ${novo('gol')} · rede ${novo('rede')} · apito ${novo('apito')} · chute ${novo('chute')}`, '≥ 1 cada (gol, rede, apito)', novo('gol') >= 1 && novo('rede') >= 1 && novo('apito') >= 1);
  const torc = await pg.evaluate(() => window.__golaco.estadio.emocao);
  meta('Torcida da casa explodiu no gol', `gols contados ${torc.contagem.gol ?? 0}`, '≥ 1', (torc.contagem.gol ?? 0) >= 1);

  // 5b) mudo: ganho 0 e nada toca
  await pg.evaluate(() => window.__golaco.definirSom(false));
  await pg.waitForTimeout(400);
  const mudo = await pg.evaluate(() => {
    const g = window.__golaco;
    const antes = { ...g.estadio.som.tocados };
    // reinicia (saída de bola = apito) e joga 25 s: com o som desligado nada pode tocar
    g.reiniciar({ modo: 'partida', semente: 6 });
    g.rodarPassos(1500, 'demo');
    const s = g.estadio.som;
    const soma = o => Object.values(o).reduce((a, v) => a + v, 0);
    return { ganho: s.ganhoMestre, tocou: soma(s.tocados) - soma(antes), disparos: Object.values(g.estadio.emocao.contagem).reduce((a, v) => a + v, 0), salvo: JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').som };
  });
  meta('Mudo: ganho 0, nada toca e a escolha fica salva', `ganho ${f2(mudo.ganho)}, ${mudo.tocou} sons (de ${mudo.disparos} pedidos), salvo ${mudo.salvo}`, 'ganho ≤ 0,01, 0 sons, salvo false', mudo.ganho <= 0.01 && mudo.tocou === 0 && mudo.disparos > 0 && mudo.salvo === false);
  await pg.evaluate(() => { window.__golaco.definirSom(true); window.__golaco.definirVolume(0.5); });
  await pg.waitForTimeout(400);
  const volta2 = await pg.evaluate(() => ({ ganho: window.__golaco.estadio.som.ganhoMestre, vol: JSON.parse(localStorage.getItem('golaco.prefs.v1') || '{}').volume }));
  meta('Volume: religado em 50% (salvo)', `ganho ${f2(volta2.ganho)}, salvo ${volta2.vol}`, '≈ 0,5 e 0.5', Math.abs(volta2.ganho - 0.5) < 0.03 && volta2.vol === 0.5);
  meta('Sem erro no console', erros.length ? erros.slice(0, 3).join(' | ') : '0', '0', erros.length === 0);
} catch (e) {
  meta('Execução', e.message, 'sem exceção', false);
} finally {
  await navegador.close();
  await srv.fechar();
}

const larg = Math.max(...res.map(r => r.nome.length));
for (const r of res) console.log(`${r.ok ? 'PASSOU  ' : 'REPROVOU'}  ${r.nome.padEnd(larg)}  ${r.medido}   (alvo: ${r.alvo})`);
const ok = res.length > 0 && res.every(r => r.ok);
console.log(ok ? '\nteste-estadio: PASSOU' : '\nteste-estadio: REPROVOU');
process.exit(ok ? 0 : 1);
