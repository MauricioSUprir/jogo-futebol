// Controles na página (navegador): teclado no PC, controle (Gamepad API simulada) e toque no
// celular, de verdade (eventos do Chromium, não chamadas diretas).
//  - Movimento (Etapa 1, modo condução): direita = direita NA TELA, cima = para cima/longe da
//    câmera, arrancada, condução curta; menu/ajuda/câmera/máquina/marcador/recomeço.
//  - Ações (Etapa 2, treino de ataque): J passe, K chute, L lançamento (marca de queda), I enfiada,
//    Q trocar, G goleiro (segurar), toque curto que não se perde, barra de força no HUD.
//  - Controle: A passe, B chute, X lançamento, Y enfiada (ataque) / goleiro (defesa), LB trocar,
//    RT correr.
//  - Celular: CONDUÇÃO não existe mais; ataque = CHUTE (o maior), PASSE, ENFIADA, LANÇAMENTO e
//    CORRER; defesa = TROCAR, GOLEIRO e CORRER; nenhum botão encosta em outro, no analógico em
//    repouso nem no HUD (e as caixas do HUD não encostam entre si, com o texto de modo mais longo),
//    todos ≥ 48 px e dentro da área segura, em 844×390 e 812×375 (com entalhe), 667×375 e 390×844
//    (em pé, com a ilha no topo), nos tamanhos 70–140%.
// Itens que dependem da lógica da Etapa 2 (m.controlado, j.carga, m.voo...) saem como
// AGUARDANDO LÓGICA enquanto ela não existir — nunca como PASSOU.
//   node tools/teste-controles.mjs
import { servidor, abrir } from './lib/navegador.mjs';

const res = [];
const AG = 'aguardando';
const meta = (nome, medido, ok) => res.push({ nome, medido, ok });
const srv = await servidor();

const BIT = { CORRER: 1, MOD: 2, PASSE: 4, ENFIADA: 8, LANCAMENTO: 16, CHUTE: 32, TROCAR: 1024, GOLEIRO: 2048 };

async function quadros(pagina, n) {
  return pagina.evaluate(n => { const g = window.__golaco; for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: i === n - 1 }); return g.estado(); }, n);
}
/**
 * Avança n quadros e junta o que aconteceu: tipos de voo vistos, marca de queda, barra de força,
 * contagem de passes/chutes, controlados e o maior estado da máscara do controlado.
 */
async function rodar(pagina, n) {
  return pagina.evaluate(n => {
    const g = window.__golaco;
    const m0 = g.mundo;
    const p0 = m0.stats?.passes ?? 0, c0 = m0.stats?.chutes ?? 0;
    const voos = new Set(), ctrl = new Set();
    let trocas = 0, ultimoCtrl = g.estado().controlado;
    let queda = false, barra = false, barraTipo = '', mask = 0, cargaTipo = null, vooAlto = false, golBotoes = 0;
    for (let i = 0; i < n; i++) {
      g.relogio.avancar(1000 / 60, { desenhar: false });
      const m = g.mundo;
      if (m.voo) { voos.add(m.voo.tipo); if (m.voo.alto) vooAlto = true; }
      if (g.render.queda) queda = true;
      const el = document.getElementById('carga');
      if (el && el.classList.contains('visivel')) { barra = true; barraTipo = document.getElementById('carga-tipo').textContent; }
      const e = g.estado();
      ctrl.add(e.controlado);
      if (e.controlado !== ultimoCtrl) { trocas++; ultimoCtrl = e.controlado; }
      if (e.jogador) { mask |= e.jogador.botoes; if (e.jogador.carga) cargaTipo = e.jogador.carga.tipo; }
      for (const j of m.jogadores) {
        // a entrada do time chega a todos do time 0 (botoesTime): a máscara do humano neste passo
        if (j.time === 0) mask |= (j.botoesTime | 0);
        if (j.posicao === 'GOL' && j.time === 0) golBotoes |= (j.botoesTime | 0);
      }
    }
    const m = g.mundo;
    return {
      voos: [...voos], ctrl: [...ctrl], trocas, queda, barra, barraTipo, mask, cargaTipo, vooAlto, golBotoes,
      passes: (m.stats?.passes ?? 0) - p0, chutes: (m.stats?.chutes ?? 0) - c0, estado: g.estado(),
    };
  }, n);
}
/** Deslocamento NA TELA (px) entre duas posições do jogador, com a câmera de agora. */
async function naTela(pagina, a, b) {
  return pagina.evaluate(([a, b]) => {
    const g = window.__golaco;
    const p = g.naTela(a.x, 0, a.z), q = g.naTela(b.x, 0, b.z);
    return { dx: q.x - p.x, dy: q.y - p.y };
  }, [a, b]);
}
const telaTxt = t => `tela dx ${t.dx.toFixed(0)} px, dy ${t.dy.toFixed(0)} px`;

/**
 * Geometria dos botões de toque visíveis: diâmetro ≥ 48, dentro da área segura, nenhum encosta
 * em outro (círculos, folga 4 px) nem nas caixas do HUD. Mede pelo layout (offset*), sem a
 * animação de entrada.
 */
async function layoutToque(pagina) {
  return pagina.evaluate(() => {
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);pointer-events:none';
    document.body.appendChild(sonda);
    const r0 = sonda.getBoundingClientRect();
    sonda.remove();
    const W = innerWidth, H = innerHeight;
    const sa = { l: r0.left, t: r0.top, r: W - r0.right, b: H - r0.bottom };
    const bts = [...document.querySelectorAll('#toque .btn-toque')]
      .filter(e => getComputedStyle(e).display !== 'none' && e.offsetWidth > 0)
      .map(e => ({ id: e.id.replace('btn-', ''), x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + e.offsetHeight / 2, d: Math.min(e.offsetWidth, e.offsetHeight) }));
    const caixas = [...document.querySelectorAll('#hud [data-caixa]')]
      .filter(e => e.offsetParent !== null && getComputedStyle(e).display !== 'none')
      .map(e => ({ nome: e.dataset.caixa, r: e.getBoundingClientRect() }))
      .filter(c => c.r.width > 0 && c.r.height > 0);
    const problemas = [];
    // caixas do HUD entre si (placar, minimapa, painel, menu) e dentro da área segura
    for (let i = 0; i < caixas.length; i++) {
      const a = caixas[i].r;
      if (a.left < sa.l - 0.5 || a.top < sa.t - 0.5 || a.right > W - sa.r + 0.5 || a.bottom > H - sa.b + 0.5) problemas.push(`${caixas[i].nome} fora da área segura`);
      for (let k = i + 1; k < caixas.length; k++) {
        const b = caixas[k].r;
        if (a.left < b.right + 4 && b.left < a.right + 4 && a.top < b.bottom + 4 && b.top < a.bottom + 4) problemas.push(`${caixas[i].nome} encosta em ${caixas[k].nome}`);
      }
    }
    // analógico em repouso (onde o polegar esquerdo descansa) não encosta em botão
    const ba = document.querySelector('.analogico-base')?.getBoundingClientRect();
    const analog = ba && ba.width > 0 ? { x: ba.left + ba.width / 2, y: ba.top + ba.height / 2, d: ba.width } : null;
    for (const b of bts) {
      const r = b.d / 2;
      if (b.d < 48) problemas.push(`${b.id} com ${b.d} px (< 48)`);
      if (b.x - r < sa.l - 0.5 || b.y - r < sa.t - 0.5 || b.x + r > W - sa.r + 0.5 || b.y + r > H - sa.b + 0.5) problemas.push(`${b.id} fora da área segura`);
      for (const c of caixas) {
        const qx = Math.max(c.r.left, Math.min(b.x, c.r.right)), qy = Math.max(c.r.top, Math.min(b.y, c.r.bottom));
        if (Math.hypot(b.x - qx, b.y - qy) < r + 4) problemas.push(`${b.id} encosta em ${c.nome}`);
      }
      if (analog && Math.hypot(b.x - analog.x, b.y - analog.y) - r - analog.d / 2 < 4) problemas.push(`${b.id} encosta no analógico`);
    }
    for (let i = 0; i < bts.length; i++) for (let k = i + 1; k < bts.length; k++) {
      const a = bts[i], b = bts[k];
      const folga = Math.hypot(a.x - b.x, a.y - b.y) - a.d / 2 - b.d / 2;
      if (folga < 4) problemas.push(`${a.id} encosta em ${b.id} (folga ${folga.toFixed(1)} px)`);
    }
    return { ids: bts.map(b => b.id).sort(), diam: Object.fromEntries(bts.map(b => [b.id, b.d])), menor: Math.min(...bts.map(b => b.d)), problemas };
  });
}
/** Confere os dois conjuntos (ataque e defesa) em vários tamanhos. Devolve [ok, texto]. */
async function conferirTodosLayouts(pagina) {
  const textos = [];
  let ok = true;
  // o texto de modo mais longo no painel (o topo se ajusta a ele)
  await pagina.evaluate(() => window.__golaco.hudModo('Condução curta', 'MEI'));
  for (const tam of [0.7, 1, 1.4]) {
    for (const f of ['ataque', 'defesa']) {
      await pagina.evaluate(([tam, f]) => {
        window.__golaco.toqueTamanho(tam);
        const t = document.getElementById('toque');
        t.classList.toggle('fase-ataque', f === 'ataque'); t.classList.toggle('fase-defesa', f === 'defesa');
      }, [tam, f]);
      const l = await layoutToque(pagina);
      const esperado = f === 'ataque' ? ['chute', 'correr', 'enfiada', 'lancamento', 'passe'] : ['correr', 'goleiro', 'trocar'];
      const okIds = JSON.stringify(l.ids) === JSON.stringify(esperado);
      if (!okIds || l.problemas.length) ok = false;
      textos.push(`${Math.round(tam * 100)}% ${f}: ${l.ids.length} botões, menor ${l.menor} px${l.problemas.length ? ' — ' + l.problemas.join('; ') : ''}${okIds ? '' : ' — botões ' + l.ids.join(',')}`);
    }
  }
  // volta ao normal (a fase verdadeira é reposta pelo próximo passo)
  await pagina.evaluate(() => { window.__golaco.toqueTamanho(1); window.__golaco.sincronizarFase(); });
  return [ok, textos.join(' | ')];
}

// ------------------------------------------------------------------ PC: teclado e controle
{
  const { navegador, pagina, erros } = await abrir({ largura: 1280, altura: 720 });
  try {
    await pagina.goto(srv.url + '?q=baixa', { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    // movimento: modo condução (um jogador, Etapa 1)
    await pagina.evaluate(() => { window.__golaco.reiniciar({ semente: 2, modo: 'conducao' }); window.__golaco.relogio.usarManual(true); });
    await pagina.mouse.click(640, 400);
    const e0 = await quadros(pagina, 2);
    await pagina.keyboard.down('KeyW');
    const e1 = await quadros(pagina, 90);
    const tW = await naTela(pagina, e0.jogador, e1.jogador);
    meta('W: anda para cima na tela (z diminui)', `z ${e0.jogador.z.toFixed(2)} → ${e1.jogador.z.toFixed(2)}, ${telaTxt(tW)}, ${e1.kmh.toFixed(1)} km/h, ${e1.modo}`, e1.jogador.z < e0.jogador.z - 2 && tW.dy < -20 && Math.abs(tW.dx) < -tW.dy * 0.3 && e1.kmh > 12 && e1.modo === 'Conduzindo');
    await pagina.keyboard.up('KeyW');
    await pagina.keyboard.down('KeyD');
    await pagina.keyboard.down('Shift');
    const e2 = await quadros(pagina, 120);
    const tD = await naTela(pagina, e1.jogador, e2.jogador);
    meta('D + Shift: arrancada para a direita da tela (x aumenta)', `x ${e1.jogador.x.toFixed(2)} → ${e2.jogador.x.toFixed(2)}, ${telaTxt(tD)}, ${e2.kmh.toFixed(1)} km/h, ${e2.modo}`, e2.jogador.x > e1.jogador.x + 3 && tD.dx > 20 && e2.kmh > 24 && e2.modo === 'Arrancada');
    await pagina.keyboard.up('Shift');
    await pagina.keyboard.down('KeyE');
    const e3 = await quadros(pagina, 90);
    meta('E: condução curta (devagar)', `${e3.kmh.toFixed(1)} km/h, ${e3.modo}`, e3.modo === 'Condução curta' && e3.kmh < 11);
    await pagina.keyboard.up('KeyE');
    await pagina.keyboard.up('KeyD');
    await pagina.keyboard.press('Escape');
    const menu = await pagina.evaluate(() => !document.getElementById('menu').hidden);
    const t0 = (await quadros(pagina, 30)).tick;
    const t1 = (await quadros(pagina, 30)).tick;
    await pagina.keyboard.press('Escape');
    const menuFechou = await pagina.evaluate(() => document.getElementById('menu').hidden);
    meta('Esc abre o menu e pausa; Esc fecha', `menu ${menu ? 'aberto' : 'fechado'}, ticks parados ${t0 === t1}, fechou ${menuFechou}`, menu && t0 === t1 && menuFechou);
    await pagina.keyboard.press('KeyH');
    const ajuda = await pagina.evaluate(() => !document.getElementById('ajuda').hidden);
    const ajudaTexto = await pagina.evaluate(() => document.getElementById('ajuda').textContent);
    await pagina.keyboard.press('KeyH');
    const ajudaFechou = await pagina.evaluate(() => document.getElementById('ajuda').hidden);
    const okAjuda = ['Passe', 'Chute', 'enfiada', 'Lançamento', 'Trocar', 'goleiro sai', 'LB', 'TROCAR', 'GOLEIRO'].every(t => ajudaTexto.includes(t)) && !ajudaTexto.includes('CONDUÇÃO');
    meta('H abre e fecha a ajuda (com os botões novos, sem CONDUÇÃO)', `${ajuda} / ${ajudaFechou}, texto novo ${okAjuda}`, ajuda && ajudaFechou && okAjuda);
    await pagina.keyboard.press('KeyC');
    await quadros(pagina, 2);
    const cam = await pagina.evaluate(() => window.__golaco.camera);
    await pagina.keyboard.press('KeyC');
    await quadros(pagina, 2);
    const cam2 = await pagina.evaluate(() => window.__golaco.camera);
    meta('C alterna a câmera', `${cam} → ${cam2}`, cam === 'aproximada' && cam2 === 'tv');
    await pagina.keyboard.press('KeyN');
    const eN = await quadros(pagina, 3);
    await pagina.keyboard.press('KeyM');
    const eM = await quadros(pagina, 3);
    meta('N liga o marcador; M lança a bola (máquina)', `marcador ${eN.marcador}, posse depois da máquina ${eM.posse}`, eN.marcador && eM.posse === null);
    await pagina.keyboard.press('KeyR');
    const eR = await quadros(pagina, 3);
    meta('R: bola no pé', `posse ${eR.posse}`, eR.posse === eR.controlado);

    // ações: treino de ataque (padrão da Etapa 2)
    const novo = async (sem = 2) => pagina.evaluate(s => { const g = window.__golaco; g.reiniciar({ semente: s }); g.relogio.usarManual(true); return g.estado(); }, sem);
    const logica = (await novo()).logicaEtapa2;
    const sem = t => (logica ? t : AG);
    // J segurado: máscara, carga e barra; soltar: passe
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyJ');
    const j1 = await rodar(pagina, 18);
    await pagina.keyboard.up('KeyJ');
    const j2 = await rodar(pagina, 60);
    meta('J segurado: bit PASSE na máscara do controlado', `máscara ${j1.mask}`, (j1.mask & BIT.PASSE) !== 0);
    meta('J: barra de força perto do jogador ("PASSE")', `carga ${j1.cargaTipo}, barra ${j1.barra} "${j1.barraTipo}"`, sem(j1.cargaTipo === 'passe' && j1.barra && j1.barraTipo === 'PASSE'));
    meta('J solto: sai o passe (troca para quem recebe)', `passes ${j2.passes}, voos ${j2.voos.join(',') || '-'}, controlados ${j2.ctrl.join(',')}`, sem(j2.passes >= 1 && j2.voos.includes('passe')));
    // toque curtíssimo (desce e sobe sem quadro no meio) não se perde
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.press('KeyJ');
    const jc = await rodar(pagina, 60);
    meta('J apertado e solto no mesmo quadro: o passe sai assim mesmo', `passes ${jc.passes}, máscara vista ${jc.mask}`, sem(jc.passes >= 1));
    // K: chute
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyK');
    const k1 = await rodar(pagina, 24);
    await pagina.keyboard.up('KeyK');
    const k2 = await rodar(pagina, 60);
    meta('K segurado/solto: bit CHUTE, barra "CHUTE" e o chute sai', `máscara ${k1.mask}, carga ${k1.cargaTipo}, barra "${k1.barraTipo}", chutes ${k2.chutes}, voos ${k2.voos.join(',') || '-'}`, (k1.mask & BIT.CHUTE) !== 0 && sem(k1.cargaTipo === 'chute' && k1.barraTipo === 'CHUTE' && k2.chutes >= 1));
    // L: lançamento (bola alta → anel de queda no gramado)
    await novo();
    await pagina.evaluate(() => window.__golaco.forcarEntrada({ x: 0.7, z: -0.7, botoes: 0 }));
    await rodar(pagina, 20);
    await pagina.evaluate(() => window.__golaco.forcarEntrada(null));
    await pagina.keyboard.down('KeyL');
    const l1 = await rodar(pagina, 30);
    await pagina.keyboard.up('KeyL');
    const l2 = await rodar(pagina, 90);
    meta('L: lançamento pelo alto com a marca de queda no gramado', `máscara ${l1.mask}, voos ${l2.voos.join(',') || '-'}, alto ${l2.vooAlto}, marca ${l2.queda}`, (l1.mask & BIT.LANCAMENTO) !== 0 && sem(l2.voos.some(t => t === 'lancamento' || t === 'cruzamento') && l2.vooAlto && l2.queda));
    // I: enfiada
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyI');
    const i1 = await rodar(pagina, 15);
    await pagina.keyboard.up('KeyI');
    const i2 = await rodar(pagina, 60);
    meta('I: bola enfiada', `máscara ${i1.mask}, voos ${i2.voos.join(',') || '-'}`, (i1.mask & BIT.ENFIADA) !== 0 && sem(i2.voos.some(t => /^enfiada/.test(t))));
    // Q: trocar (sem a bola: máquina tira a bola do pé)
    await novo();
    await pagina.evaluate(() => window.__golaco.acao('maquina'));
    const q0 = await quadros(pagina, 20);
    // segurado por 8 quadros (~130 ms, um aperto normal): troca UMA vez, para o "próximo da troca"
    await pagina.keyboard.down('KeyQ');
    const q1 = await rodar(pagina, 8);
    await pagina.keyboard.up('KeyQ');
    meta('Q segurado: troca uma vez só, para o "próximo da troca"', `máscara ${q1.mask}, fase ${q0.fase}, controlado ${q0.controlado} → ${q1.estado.controlado} (próximo era ${q0.proximaTroca}), trocas ${q1.trocas}${q1.trocas > 1 ? ' — o controle pisca entre dois jogadores com o botão segurado (borda do TROCAR medida por jogador na lógica)' : ''}`, (q1.mask & BIT.TROCAR) !== 0 && sem(q1.trocas === 1 && q1.estado.controlado === q0.proximaTroca));
    // G segurado: o botão chega ao goleiro do meu time
    await novo();
    await pagina.keyboard.down('KeyG');
    const g1 = await rodar(pagina, 10);
    await pagina.keyboard.up('KeyG');
    meta('G segurado: bit GOLEIRO (chega ao goleiro do time)', `máscara ${g1.mask}, botões do goleiro ${g1.golBotoes}`, (g1.mask & BIT.GOLEIRO) !== 0 && sem((g1.golBotoes & BIT.GOLEIRO) !== 0));

    // controle (Gamepad API simulada)
    const gp = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ semente: 4, modo: 'conducao' });
      const bt = n => Array.from({ length: 17 }, (_, i) => ({ pressed: n.includes(i), value: n.includes(i) ? 1 : 0, touched: false }));
      let botoes = [7], eixos = [0.9, 0.05, 0, 0];
      navigator.getGamepads = () => [{ connected: true, mapping: 'standard', axes: eixos, buttons: bt(botoes) }];
      const av = n => {
        let mask = 0;
        for (let i = 0; i < n; i++) {
          g.relogio.avancar(1000 / 60, { desenhar: false });
          mask |= g.estado().jogador?.botoes ?? 0;
          for (const j of g.mundo.jogadores) if (j.time === 0) mask |= (j.botoesTime | 0);
        }
        return mask;
      };
      const x0 = g.estado().jogador.x;
      av(120);
      const e1 = g.estado();
      // ataque: A passe, Y enfiada, B chute, X lançamento, LB trocar
      g.reiniciar({ semente: 4 });
      eixos = [0, 0, 0, 0];
      const res = { x0, x1: e1.jogador.x, kmh: e1.kmh, modo: e1.modo };
      const testar = (i, n = 6) => { botoes = [i]; const m = av(n); botoes = []; av(2); return m; };
      res.faseAtaque = g.fase;
      res.Y_ataque = testar(3); res.B = testar(1); res.X = testar(2); res.LB = testar(4);
      g.reiniciar({ semente: 4 });
      const p0 = g.mundo.stats?.passes ?? 0;
      botoes = [0]; av(12); botoes = []; av(50);
      res.passesA = (g.mundo.stats?.passes ?? 0) - p0;
      // defesa: Y = goleiro
      g.reiniciar({ semente: 4 });
      g.acao('maquina');
      av(20);
      res.faseDefesa = g.fase;
      res.Y_defesa = testar(3, 8);
      navigator.getGamepads = () => [];
      return res;
    });
    meta('Controle: analógico + RT = arrancada', `x ${gp.x0.toFixed(2)} → ${gp.x1.toFixed(2)}, ${gp.kmh.toFixed(1)} km/h, ${gp.modo}`, gp.x1 > gp.x0 + 3 && gp.kmh > 24 && gp.modo === 'Arrancada');
    meta('Controle: B chute, X lançamento, LB trocar', `B ${gp.B}, X ${gp.X}, LB ${gp.LB}`, (gp.B & BIT.CHUTE) && (gp.X & BIT.LANCAMENTO) && (gp.LB & BIT.TROCAR) ? true : false);
    meta('Controle: A = passe', `passes ${gp.passesA}`, sem(gp.passesA >= 1));
    meta('Controle: Y = enfiada no ataque e goleiro na defesa', `fase ${gp.faseAtaque}: ${gp.Y_ataque}; fase ${gp.faseDefesa}: ${gp.Y_defesa}`, gp.faseAtaque === 'ataque' && (gp.Y_ataque & BIT.ENFIADA) !== 0 && !(gp.Y_ataque & BIT.GOLEIRO) && gp.faseDefesa === 'defesa' && (gp.Y_defesa & BIT.GOLEIRO) !== 0 && !(gp.Y_defesa & BIT.ENFIADA));
    meta('PC sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}

// ------------------------------------------------------------------ celular deitado: toque
{
  const { navegador, contexto, pagina, erros } = await abrir({ largura: 844, altura: 390, dpr: 2, toque: true });
  try {
    await pagina.goto(srv.url + '?q=baixa&entalhe=1', { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.reiniciar({ semente: 2, modo: 'conducao' }); window.__golaco.relogio.usarManual(true); });
    const visivel = await pagina.evaluate(() => !document.getElementById('toque').hidden);
    meta('Celular: controles de toque aparecem sozinhos', String(visivel), visivel);
    const semMod = await pagina.evaluate(() => !document.getElementById('btn-mod') && ![...document.querySelectorAll('#toque button')].some(b => /CONDU/i.test(b.textContent)));
    meta('Celular: o botão CONDUÇÃO não existe mais', String(semMod), semMod);
    await quadros(pagina, 2);
    const l0 = await layoutToque(pagina);
    const maior = Object.entries(l0.diam).sort((a, b) => b[1] - a[1])[0]?.[0];
    meta('Ataque: CHUTE (o maior), PASSE, ENFIADA, LANÇAMENTO e CORRER', `${l0.ids.join(', ')}; maior ${maior} (${l0.diam.chute} px)`, JSON.stringify(l0.ids) === JSON.stringify(['chute', 'correr', 'enfiada', 'lancamento', 'passe']) && maior === 'chute');
    const [okL, txtL] = await conferirTodosLayouts(pagina);
    meta('844×390 com entalhe: nenhum botão encosta, ≥ 48 px, dentro da área segura', txtL, okL);

    const cdp = await contexto.newCDPSession(pagina);
    const toque = (type, pontos) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pontos });
    const centro = id => pagina.evaluate(id => { const b = document.getElementById(id); return { x: b.offsetLeft + b.offsetWidth / 2, y: b.offsetTop + b.offsetHeight / 2 }; }, id);
    const e0 = await quadros(pagina, 2);
    // dedo 1 encosta na metade esquerda e arrasta para a direita
    await toque('touchStart', [{ x: 200, y: 260, id: 1 }]);
    for (let k = 1; k <= 6; k++) await toque('touchMove', [{ x: 200 + k * 12, y: 260, id: 1 }]);
    const e1 = await quadros(pagina, 90);
    const ativo = await pagina.evaluate(() => document.getElementById('analogico').classList.contains('ativo'));
    const tt1 = await naTela(pagina, e0.jogador, e1.jogador);
    meta('Analógico flutuante: arrastar para a direita anda para a direita da tela', `x ${e0.jogador.x.toFixed(2)} → ${e1.jogador.x.toFixed(2)}, ${telaTxt(tt1)}, ${e1.kmh.toFixed(1)} km/h, base ativa ${ativo}`, e1.jogador.x > e0.jogador.x + 2 && tt1.dx > 20 && Math.abs(tt1.dy) < tt1.dx * 0.3 && e1.kmh > 12 && ativo);
    // dedo 2 no CORRER (com o dedo 1 ainda no analógico)
    const r = await centro('btn-correr');
    await toque('touchStart', [{ x: 272, y: 260, id: 1 }, { x: r.x, y: r.y, id: 2 }]);
    const e2 = await quadros(pagina, 120);
    meta('Dois dedos: analógico + CORRER = arrancada', `${e2.kmh.toFixed(1)} km/h, ${e2.modo}`, e2.kmh > 24 && e2.modo === 'Arrancada');
    await toque('touchEnd', []);
    const e3 = await quadros(pagina, 120);
    meta('Soltar os dedos: o jogador para', `${e3.kmh.toFixed(1)} km/h`, e3.kmh < 3);
    // arrastar para CIMA: o jogador vai para longe da câmera (sobe na tela)
    await toque('touchStart', [{ x: 200, y: 280, id: 3 }]);
    for (let k = 1; k <= 6; k++) await toque('touchMove', [{ x: 200, y: 280 - k * 12, id: 3 }]);
    const e4 = await quadros(pagina, 90);
    const tt4 = await naTela(pagina, e3.jogador, e4.jogador);
    meta('Analógico para cima: o jogador sobe na tela (longe da câmera)', `z ${e3.jogador.z.toFixed(2)} → ${e4.jogador.z.toFixed(2)}, ${telaTxt(tt4)}`, e4.jogador.z < e3.jogador.z - 2 && tt4.dy < -20 && Math.abs(tt4.dx) < -tt4.dy * 0.3);
    await toque('touchEnd', []);

    // ações no treino de ataque
    const novo = async (sem = 2) => pagina.evaluate(s => { const g = window.__golaco; g.reiniciar({ semente: s }); g.relogio.usarManual(true); return g.estado(); }, sem);
    const logica = (await novo()).logicaEtapa2;
    const sem = t => (logica ? t : AG);
    await quadros(pagina, 10);
    // PASSE: toque rápido (desce e sobe sem quadro no meio)
    const bp = await centro('btn-passe');
    await toque('touchStart', [{ x: bp.x, y: bp.y, id: 10 }]);
    await toque('touchEnd', [{ x: bp.x, y: bp.y, id: 10 }]);
    const p1 = await rodar(pagina, 60);
    meta('PASSE: toque rápido faz o passe', `máscara vista ${p1.mask}, passes ${p1.passes}, voos ${p1.voos.join(',') || '-'}`, (p1.mask & BIT.PASSE) !== 0 && sem(p1.passes >= 1));
    // CHUTE segurado: botão aceso, barra "CHUTE" perto do jogador; soltar chuta
    await novo();
    await quadros(pagina, 10);
    const bc = await centro('btn-chute');
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 11 }]);
    const c1 = await rodar(pagina, 30);
    const aceso = await pagina.evaluate(() => document.getElementById('btn-chute').classList.contains('ativo'));
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 11 }]);
    const c2 = await rodar(pagina, 60);
    meta('CHUTE segurado: aceso, barra de força "CHUTE"; solto: chuta', `aceso ${aceso}, máscara ${c1.mask}, barra "${c1.barraTipo}", chutes ${c2.chutes}`, aceso && (c1.mask & BIT.CHUTE) !== 0 && sem(c1.barraTipo === 'CHUTE' && c2.chutes >= 1));
    // ENFIADA e LANÇAMENTO chegam à máscara
    await novo();
    const be = await centro('btn-enfiada'), bl = await centro('btn-lancamento');
    await toque('touchStart', [{ x: be.x, y: be.y, id: 12 }]);
    const en = await rodar(pagina, 6);
    await toque('touchEnd', [{ x: be.x, y: be.y, id: 12 }]);
    await rodar(pagina, 4);
    await novo();
    await toque('touchStart', [{ x: bl.x, y: bl.y, id: 13 }]);
    const la = await rodar(pagina, 6);
    await toque('touchEnd', [{ x: bl.x, y: bl.y, id: 13 }]);
    meta('ENFIADA e LANÇAMENTO chegam ao jogador', `enfiada ${en.mask}, lançamento ${la.mask}`, (en.mask & BIT.ENFIADA) !== 0 && (la.mask & BIT.LANCAMENTO) !== 0);
    // defesa: sem a bola os botões viram TROCAR, GOLEIRO e CORRER
    await novo();
    await pagina.evaluate(() => window.__golaco.acao('maquina'));
    const d0 = await quadros(pagina, 20);
    const ld = await layoutToque(pagina);
    meta('Sem a bola: TROCAR, GOLEIRO e CORRER (ataque some)', `fase ${d0.fase}, posse ${d0.posse}, botões ${ld.ids.join(', ')}`, d0.fase === 'defesa' && JSON.stringify(ld.ids) === JSON.stringify(['correr', 'goleiro', 'trocar']));
    const bt = await centro('btn-trocar');
    await toque('touchStart', [{ x: bt.x, y: bt.y, id: 14 }]);
    await toque('touchEnd', [{ x: bt.x, y: bt.y, id: 14 }]);
    const t1 = await rodar(pagina, 4);
    meta('TROCAR (toque rápido): passa para o próximo da troca', `máscara ${t1.mask}, controlado ${d0.controlado} → ${t1.estado.controlado} (próximo ${d0.proximaTroca}), trocas ${t1.trocas}`, (t1.mask & BIT.TROCAR) !== 0 && sem(t1.trocas === 1 && t1.estado.controlado === d0.proximaTroca));
    const bg = await centro('btn-goleiro');
    await toque('touchStart', [{ x: bg.x, y: bg.y, id: 15 }]);
    const g1 = await rodar(pagina, 10);
    const gAceso = await pagina.evaluate(() => document.getElementById('btn-goleiro').classList.contains('ativo'));
    await toque('touchEnd', [{ x: bg.x, y: bg.y, id: 15 }]);
    meta('GOLEIRO segurado: aceso e o botão chega ao goleiro', `aceso ${gAceso}, máscara ${g1.mask}, goleiro ${g1.golBotoes}`, gAceso && (g1.mask & BIT.GOLEIRO) !== 0 && sem((g1.golBotoes & BIT.GOLEIRO) !== 0));
    // chute carregando não some debaixo do dedo quando a posse muda
    await novo();
    await quadros(pagina, 4);
    const bc2 = await centro('btn-chute');
    await toque('touchStart', [{ x: bc2.x, y: bc2.y, id: 16 }]);
    await pagina.evaluate(() => window.__golaco.acao('maquina'));
    const s1 = await quadros(pagina, 24);
    const durante = await pagina.evaluate(() => getComputedStyle(document.getElementById('btn-chute')).display !== 'none');
    await toque('touchEnd', [{ x: bc2.x, y: bc2.y, id: 16 }]);
    const s2 = await quadros(pagina, 2);
    const depois = await pagina.evaluate(() => document.getElementById('toque').dataset.fase);
    meta('Botão segurado segura a troca ataque → defesa até soltar', `fase do mundo ${s1.fase}, CHUTE visível ${durante}, depois de soltar: ${depois} (mundo ${s2.fase})`, s1.fase === 'defesa' && durante && (s2.fase === 'ataque' || depois === 'defesa'));
    const m = await centro('btn-menu');
    await pagina.touchscreen.tap(m.x, m.y);
    const menu = await pagina.evaluate(() => !document.getElementById('menu').hidden);
    meta('Botão de menu (toque) abre o menu', String(menu), menu);
    meta('Celular sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}

// ------------------------------------------------------------------ outras telas de celular
// em pé com a ilha/entalhe no topo; deitado estreito (iPhone SE, sem entalhe) e com entalhe (mini)
for (const t of [
  { largura: 390, altura: 844, entalhe: true, nome: '390×844 em pé, entalhe' },
  { largura: 667, altura: 375, entalhe: false, nome: '667×375 deitado' },
  { largura: 812, altura: 375, entalhe: true, nome: '812×375 deitado, entalhe' },
]) {
  const { navegador, pagina, erros } = await abrir({ largura: t.largura, altura: t.altura, dpr: 2, toque: true });
  try {
    await pagina.goto(srv.url + '?q=baixa' + (t.entalhe ? '&entalhe=1' : ''), { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.relogio.usarManual(true); });
    await quadros(pagina, 2);
    const [okL, txtL] = await conferirTodosLayouts(pagina);
    meta(`${t.nome}: nada encosta (botões, analógico, HUD), ≥ 48 px, área segura`, txtL, okL);
    meta(`${t.nome}: sem erro no console`, erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}
await srv.fechar();

const larg = Math.max(...res.map(r => r.nome.length));
const rot = ok => (ok === AG ? 'AGUARDANDO LÓGICA' : ok ? 'PASSOU  ' : 'REPROVOU');
for (const r of res) console.log(`${rot(r.ok)}  ${r.nome.padEnd(larg)}  ${r.medido}`);
const reprovou = res.filter(r => r.ok !== AG && !r.ok);
const aguardando = res.filter(r => r.ok === AG);
if (reprovou.length) console.log('\nteste-controles: REPROVOU');
else if (aguardando.length) console.log(`\nteste-controles: PASSOU na interface; ${aguardando.length} itens AGUARDANDO LÓGICA (não contam como passou)`);
else console.log('\nteste-controles: PASSOU');
process.exit(reprovou.length ? 1 : 0);
