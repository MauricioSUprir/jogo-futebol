// Controles na página (navegador): teclado no PC, controle (Gamepad API simulada) e toque no
// celular, de verdade (eventos do Chromium, não chamadas diretas).
//  - Movimento (Etapa 1, modo condução): direita = direita NA TELA, cima = para cima/longe da
//    câmera, arrancada, condução curta; menu/ajuda/câmera/máquina/marcador/recomeço.
//  - Ações (Etapa 2, treino de ataque): J passe, K chute, L lançamento (marca de queda), I enfiada,
//    Q trocar, G goleiro (segurar), toque curto que não se perde, barra de força no HUD.
//  - Controle: A passe, B chute, X lançamento, Y enfiada (ataque) / goleiro (defesa), LB trocar,
//    RT correr.
//  - Cavadinha (pedido do dono, 12/10): o MESMO botão de chute duas vezes (K, B do controle, CHUTE do celular) = cavadinha;
//    uma vez = chute, nunca cavadinha; soltar e apertar de novo sem quadro no meio também é dois toques; a repetição
//    automática da tecla não conta; o toque cancelado pelo sistema é soltar (não prende o botão).
//  - Celular: CONDUÇÃO não existe mais; ataque = CHUTE (o maior), PASSE, ENFIADA, LANÇAMENTO e
//    CORRER; defesa = TROCAR, GOLEIRO, PRESSÃO, DIVIDIDA e CORRER (tela limpa, 11/10: 5 botões — o CONTER
//    virou a DIVIDIDA SEGURADA, conferida aqui com toque de verdade: tocar = bote, segurar = CONTER);
//    nenhum botão encosta em outro, no analógico em repouso nem no HUD
//    (e as caixas do HUD não encostam entre si, com o texto de modo mais longo e o placar com o
//    relógio da partida), todos ≥ 48 px e dentro da área segura, em 844×390 e 812×375 (com
//    entalhe) e 667×375, nos tamanhos 70–140%.
//  - Celular em pé (dono, 10/10: "é obrigatório virar o celular pra jogar"): 390×844 e 375×667
//    mostram "Gire o celular" por cima de tudo, o jogo fica parado e o toque não chega aos botões;
//    deitando, a tela some, o jogo anda e nada encosta.
//  - Partida (Etapa 3; a página abre nela): menu com Editar time e Reiniciar partida, sem Recomeçar,
//    Máquina e Marcador; placar com o relógio; R/M/N não mexem na partida; teclas da defesa (J
//    conter, K dividida, O pressão). As cenas de treino pedem modo:'ataque'/'conducao' explícito.
//  - Partida, celular (pedidos do dono de 11/10): PRESSÃO segurado pelo toque — a marca (setas âmbar) aparece sobre
//    quem foi chamado em ≤ 3 quadros e ele chega a ≤ 2,5 m do condutor em 1,5 s; goleiro do humano com a bola no pé —
//    o PEGAR aparece (sem encostar; também nos layouts de 70–140%) e, com o recuo, vira tiro livre indireto; com a
//    bola nas mãos ele anda pelo analógico sem sair da área e o anel dos 8 s aparece nos últimos 5 s.
// Itens que dependem da lógica (Etapa 2: m.controlado, j.carga, m.voo...; Etapa 3: a entrada da
// defesa da Parte 4) saem como AGUARDANDO enquanto ela não existir — nunca como PASSOU.
//   node tools/teste-controles.mjs [--raiz <pasta do jogo>]   (--raiz: mede outra cópia, ex.: a base)
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { golRoteirizado } from './lib/gol-roteirizado.mjs';

const res = [];
const AG = 'aguardando';
const meta = (nome, medido, ok) => res.push({ nome, medido, ok });
const argv = process.argv.slice(2);
const srv = await servidor(0, path.resolve(argv.includes('--raiz') ? argv[argv.indexOf('--raiz') + 1] : RAIZ));

const BIT = { CORRER: 1, MOD: 2, PASSE: 4, ENFIADA: 8, LANCAMENTO: 16, CHUTE: 32, CONTER: 64, DIVIDIDA: 128, PRESSAO: 512, TROCAR: 1024, GOLEIRO: 2048, PEGAR: 4096 };
const AG4 = 'aguardando4';
/** A entrada da Parte 4 posiciona os botões da defesa da Etapa 3 (CONTER, DIVIDIDA, PRESSÃO)? */
const temDefesaE3 = pagina => pagina.evaluate(() => { const b = document.getElementById('btn-dividida'); return !!window.__golaco.entradaEtapa3 || (!!b && b.hasAttribute('style')); });
// defesa do toque (tela limpa, 11/10): 5 botões — o CONTER é a DIVIDIDA segurada e a PRESSÃO fica no 1º anel
const DEFESA_TOQUE = ['correr', 'dividida', 'goleiro', 'pressao', 'trocar'];

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
  const defE3 = await temDefesaE3(pagina);
  // o texto de modo mais longo no painel (o topo se ajusta a ele); o tamanho salvo volta no fim
  await pagina.evaluate(() => window.__golaco.hudModo('Condução curta', 'MEI'));
  const tamSalvo = await pagina.evaluate(() => +getComputedStyle(document.documentElement).getPropertyValue('--toque-escala') || 0.8);
  for (const tam of [0.7, 1, 1.4]) {
    for (const f of ['ataque', 'defesa', 'goleiroPe']) {
      await pagina.evaluate(([tam, f]) => {
        window.__golaco.toqueTamanho(tam);
        const t = document.getElementById('toque');
        t.classList.toggle('fase-ataque', f !== 'defesa'); t.classList.toggle('fase-defesa', f === 'defesa');
        t.classList.toggle('goleiro-pe', f === 'goleiroPe');
      }, [tam, f]);
      const l = await layoutToque(pagina);
      const esperado = f === 'goleiroPe' ? ['chute', 'correr', 'enfiada', 'lancamento', 'passe', 'pegar'] : f === 'ataque' ? ['chute', 'correr', 'enfiada', 'lancamento', 'passe'] : defE3 ? DEFESA_TOQUE : ['correr', 'goleiro', 'trocar'];
      const okIds = JSON.stringify(l.ids) === JSON.stringify(esperado);
      if (!okIds || l.problemas.length) ok = false;
      textos.push(`${Math.round(tam * 100)}% ${f}: ${l.ids.length} botões, menor ${l.menor} px${l.problemas.length ? ' — ' + l.problemas.join('; ') : ''}${okIds ? '' : ' — botões ' + l.ids.join(',')}`);
    }
  }
  // volta ao tamanho de antes (o padrão é 80% desde a tela limpa; a fase verdadeira é reposta pelo próximo passo)
  await pagina.evaluate(t => { window.__golaco.toqueTamanho(t); document.getElementById('toque').classList.remove('goleiro-pe'); window.__golaco.sincronizarFase(); }, tamSalvo);
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
    const novo = async (sem = 2) => pagina.evaluate(s => { const g = window.__golaco; g.reiniciar({ semente: s, modo: 'ataque' }); g.relogio.usarManual(true); return g.estado(); }, sem);
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
    // K duas vezes (dois toques no CHUTE, pedido do dono 12/10): cavadinha; K uma vez (toque rápido): chute, nunca cavadinha
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyK'); await rodar(pagina, 4); await pagina.keyboard.up('KeyK'); await rodar(pagina, 4);
    await pagina.keyboard.down('KeyK'); await rodar(pagina, 4); await pagina.keyboard.up('KeyK');
    const kk = await rodar(pagina, 90);
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.press('KeyK');
    const ku = await rodar(pagina, 90);
    meta('K duas vezes: cavadinha (um chute só); K uma vez: chute, nunca cavadinha', `duas: chutes ${kk.chutes}, voos ${kk.voos.join(',') || '-'} · uma: chutes ${ku.chutes}, voos ${ku.voos.join(',') || '-'}`, sem(kk.chutes === 1 && kk.voos.includes('cavadinha') && ku.chutes === 1 && !ku.voos.includes('cavadinha')));
    // K solto e apertado de novo SEM quadro no meio (toque duplo rápido; num celular a 30 qps, < 33 ms): o passo vê
    // solto e depois apertado — antes as duas bordas se perdiam e virava um aperto só (chute fraco)
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyK'); await rodar(pagina, 4);
    await pagina.keyboard.up('KeyK'); await pagina.keyboard.down('KeyK'); await rodar(pagina, 4);
    await pagina.keyboard.up('KeyK');
    const kr = await rodar(pagina, 90);
    meta('K solto e apertado de novo no mesmo quadro: cavadinha (o reaperto não se perde)', `chutes ${kr.chutes}, voos ${kr.voos.join(',') || '-'}`, sem(kr.chutes === 1 && kr.voos.includes('cavadinha')));
    // K segurado com a repetição automática da tecla (keydown com repeat): um aperto só — chute, nunca cavadinha
    await novo();
    await quadros(pagina, 10);
    await pagina.keyboard.down('KeyK'); await rodar(pagina, 3);
    for (let i = 0; i < 4; i++) { await pagina.keyboard.down('KeyK'); await rodar(pagina, 3); } // repeat: true
    await pagina.keyboard.up('KeyK');
    const kq = await rodar(pagina, 90);
    meta('K segurado com repetição automática da tecla: chute, nunca cavadinha', `chutes ${kq.chutes}, voos ${kq.voos.join(',') || '-'}`, sem(kq.chutes === 1 && kq.voos.includes('chute') && !kq.voos.includes('cavadinha')));
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
    // R no treino de ataque: todos voltam às posições e a câmera CORTA para a jogada nova (sem
    // atravessar o campo num pano de ~1 s com o jogador fora do quadro)
    await novo();
    const rc = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.forcarEntrada({ x: 1, z: 0, botoes: 1 });
      for (let i = 0; i < 150; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.forcarEntrada(null);
      const antes = { cam: g.render.camera.x, j: g.estado().jogador.x };
      return antes;
    });
    await pagina.keyboard.press('KeyR');
    const rc2 = await pagina.evaluate(() => {
      const g = window.__golaco;
      for (let i = 0; i < 2; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const e = g.estado();
      return { cam: g.render.camera.x, j: e.jogador.x, bola: e.bola.x, alvo: g.naTela(e.jogador.x, 0, e.jogador.z), w: innerWidth };
    });
    const naTelaR = rc2.alvo.x > 0 && rc2.alvo.x < rc2.w;
    meta('R no ataque: a câmera corta para a jogada nova (jogador no quadro já)', `antes: câmera x ${rc.cam.toFixed(1)}, jogador ${rc.j.toFixed(1)}; 2 quadros depois do R: câmera ${rc2.cam.toFixed(1)}, jogador ${rc2.j.toFixed(1)} (na tela x ${rc2.alvo.x.toFixed(0)} px)`, rc.j - rc2.j > 8 && Math.abs(rc2.cam - rc2.bola) < 4 && naTelaR);
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
      g.reiniciar({ semente: 4, modo: 'ataque' });
      eixos = [0, 0, 0, 0];
      const res = { x0, x1: e1.jogador.x, kmh: e1.kmh, modo: e1.modo };
      const testar = (i, n = 6) => { botoes = [i]; const m = av(n); botoes = []; av(2); return m; };
      res.faseAtaque = g.fase;
      res.Y_ataque = testar(3); res.B = testar(1); res.X = testar(2); res.LB = testar(4);
      // B duas vezes (dois toques no CHUTE): cavadinha; B uma vez: chute
      const voosDe = seq => {
        g.reiniciar({ semente: 4, modo: 'ataque' });
        const v = new Set();
        const c0 = g.mundo.stats?.chutes ?? 0;
        const passa = n => { for (let i = 0; i < n; i++) { g.relogio.avancar(1000 / 60, { desenhar: false }); if (g.mundo.voo) v.add(g.mundo.voo.tipo); } };
        passa(10);
        for (const [b, n] of seq) { botoes = b ? [1] : []; passa(n); }
        botoes = []; passa(90);
        return { voos: [...v], chutes: (g.mundo.stats?.chutes ?? 0) - c0 };
      };
      res.BB = voosDe([[1, 4], [0, 4], [1, 4]]);
      res.B1 = voosDe([[1, 4]]);
      g.reiniciar({ semente: 4, modo: 'ataque' });
      const p0 = g.mundo.stats?.passes ?? 0;
      botoes = [0]; av(12); botoes = []; av(50);
      res.passesA = (g.mundo.stats?.passes ?? 0) - p0;
      // defesa: Y = goleiro
      g.reiniciar({ semente: 4, modo: 'ataque' });
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
    meta('Controle: B duas vezes = cavadinha; B uma vez = chute', `duas: chutes ${gp.BB.chutes}, voos ${gp.BB.voos.join(',') || '-'} · uma: chutes ${gp.B1.chutes}, voos ${gp.B1.voos.join(',') || '-'}`, sem(gp.BB.chutes === 1 && gp.BB.voos.includes('cavadinha') && gp.B1.chutes === 1 && !gp.B1.voos.includes('cavadinha')));
    meta('Controle: Y = enfiada no ataque e goleiro na defesa', `fase ${gp.faseAtaque}: ${gp.Y_ataque}; fase ${gp.faseDefesa}: ${gp.Y_defesa}`, gp.faseAtaque === 'ataque' && (gp.Y_ataque & BIT.ENFIADA) !== 0 && !(gp.Y_ataque & BIT.GOLEIRO) && gp.faseDefesa === 'defesa' && (gp.Y_defesa & BIT.GOLEIRO) !== 0 && !(gp.Y_defesa & BIT.ENFIADA));

    // partida (Etapa 3): menu por modo, relógio, R/M/N desligados e as teclas da defesa
    const mp = await pagina.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ modo: 'partida', semente: 3 });
      g.relogio.usarManual(true);
      for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.abrirMenu();
      const vis = s => { const b = document.querySelector(s); return !!b && !b.hidden && b.offsetParent !== null; };
      const r = {
        editar: vis('[data-cmd="editar-time"]'), reiniciar: vis('#menu [data-cmd="reiniciar-partida"]'),
        recomecar: vis('[data-cmd="recomecar"]'), maquina: vis('[data-cmd="maquina"]'), marcador: vis('[data-cmd="marcador"]'),
        relogio: vis('#placar-relogio'), textoRelogio: document.getElementById('placar-relogio')?.textContent ?? '', siglas: document.getElementById('sigla-1')?.textContent,
      };
      g.fecharMenu();
      return r;
    });
    meta('Partida: menu com Editar time e Reiniciar partida, sem Recomeçar, Máquina e Marcador',
      `Editar ${mp.editar}, Reiniciar ${mp.reiniciar}, Recomeçar ${mp.recomecar}, Máquina ${mp.maquina}, Marcador ${mp.marcador}`, mp.editar && mp.reiniciar && !mp.recomecar && !mp.maquina && !mp.marcador);
    meta('Partida: placar com o relógio e as siglas do elenco', `relógio "${mp.textoRelogio}", visitante ${mp.siglas}`, mp.relogio && /\d+'/.test(mp.textoRelogio) && mp.siglas === 'VNT');
    const rP0 = await pagina.evaluate(() => window.__golaco.hash());
    await pagina.keyboard.press('KeyR');
    await pagina.keyboard.press('KeyM');
    await pagina.keyboard.press('KeyN');
    const rP = await pagina.evaluate(() => ({ h: window.__golaco.hash(), aviso: document.getElementById('aviso').textContent, marcador: window.__golaco.estado().marcador }));
    meta('Partida: R, M e N não mexem no jogo (só o aviso "Só nos treinos")', `hash ${rP.h === rP0 ? 'igual' : 'mudou'}, aviso "${rP.aviso}", marcador ${rP.marcador}`, rP.h === rP0 && /treinos/i.test(rP.aviso) && !rP.marcador);
    // teclas da defesa (plano 2.8): J segura CONTER, K = DIVIDIDA, O segura PRESSÃO (Parte 4)
    const defE3 = await temDefesaE3(pagina);
    const def = async tecla => {
      await pagina.evaluate(() => { const g = window.__golaco; g.reiniciar({ semente: 4, modo: 'ataque' }); g.relogio.usarManual(true); g.acao('maquina'); for (let i = 0; i < 24; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      await pagina.keyboard.down(tecla);
      const r = await rodar(pagina, 8);
      await pagina.keyboard.up(tecla);
      await rodar(pagina, 2);
      return { mask: r.mask, fase: r.estado.fase };
    };
    const dJ = await def('KeyJ'), dK = await def('KeyK'), dO = await def('KeyO');
    const okDef = dJ.fase === 'defesa' && (dJ.mask & BIT.CONTER) && !(dJ.mask & BIT.PASSE) && (dK.mask & BIT.DIVIDIDA) && !(dK.mask & BIT.CHUTE) && (dO.mask & BIT.PRESSAO);
    meta('Defesa: J = CONTER, K = DIVIDIDA, O = PRESSÃO (sem passe nem chute)', `fase ${dJ.fase}; J ${dJ.mask}, K ${dK.mask}, O ${dO.mask}`, defE3 ? !!okDef : AG4);
    // replay com a tecla que estava SEGURADA quando ele começou (contraprova 13/10): solta e apertada de novo, pula (como
    // na main). O reaperto entre passos (entrada.js) não pode valer fora do laço — sem passo nenhum no replay, a soltura
    // ficava guardada e a tecla segurada no começo nunca mais pulava. Dois caminhos: o "Replay" da pausa (fora do passo)
    // e o replay que começa DENTRO do passo (o do gol na saída de bola, com a comemoração desligada; o do impedimento é
    // o mesmo caminho)
    const pulaComTecla = async (tecla, comecar) => {
      await pagina.keyboard.down(tecla);
      const ini = await comecar();
      await pagina.keyboard.up(tecla);
      const solto = await pagina.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 3; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.replay.estado.ativo; });
      await pagina.keyboard.down(tecla);
      const fim = await pagina.evaluate(() => { const g = window.__golaco; for (let i = 0; i < 6; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); return g.replay.estado.ativo; });
      await pagina.keyboard.up(tecla);
      await pagina.evaluate(() => { const g = window.__golaco; if (g.replay.estado.ativo) g.replay.pular(); for (let i = 0; i < 10; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); });
      return { ini, solto, fim };
    };
    const rpAuto = await pagina.evaluate(() => window.__golaco.replay.automatico());
    // (a tecla desce DEPOIS do mundo novo: o sentido dela é fixado na fase de agora, a mesma do 2º aperto)
    await pagina.evaluate(() => {
      const g = window.__golaco;
      g.reiniciar({ modo: 'partida', semente: 3 }); g.relogio.usarManual(true);
      for (let i = 0; i < 400; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    });
    const rMenu = await pulaComTecla('KeyK', async () => pagina.evaluate(() => {
      const g = window.__golaco;
      for (let i = 0; i < 4; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      g.replay.menu(); g.relogio.avancar(1000 / 60, { desenhar: false });
      return g.replay.estado.ativo;
    }));
    await pagina.evaluate(() => { window.__golaco.comemoracao.ligada(false); window.__golaco.replay.automatico(true); });
    const gr = await golRoteirizado(pagina, { semente: 5 });
    const rGol = await pulaComTecla('KeyJ', async () => pagina.evaluate(() => {
      const g = window.__golaco;
      for (let i = 0; i < 600 && !g.replay.estado.ativo; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return g.replay.estado.ativo;
    }));
    await pagina.evaluate(v => { window.__golaco.comemoracao.ligada(true); window.__golaco.replay.automatico(v); }, rpAuto);
    const txtR = r => `começou ${r.ini}, solta ${r.solto ? 'segue' : 'parou'}, apertada de novo: ${r.fim ? 'NÃO pulou' : 'pulou'}`;
    meta('Replay: a tecla segurada no começo, solta e apertada de novo, pula (pausa: K; gol na saída, dentro do passo: J)',
      `pausa ${txtR(rMenu)} · gol (${gr.ok ? 'roteirizado' : 'sem gol'}) ${txtR(rGol)}`, rMenu.ini && rMenu.solto && !rMenu.fim && gr.ok && rGol.ini && rGol.solto && !rGol.fim);
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
    const novo = async (sem = 2) => pagina.evaluate(s => { const g = window.__golaco; g.reiniciar({ semente: s, modo: 'ataque' }); g.relogio.usarManual(true); return g.estado(); }, sem);
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
    // CHUTE tocado duas vezes (o mesmo botão; pedido do dono 12/10): cavadinha; um toque rápido: chute, nunca cavadinha
    await novo();
    await quadros(pagina, 10);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 14 }]); await rodar(pagina, 4);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 14 }]); await rodar(pagina, 4);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 15 }]); await rodar(pagina, 4);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 15 }]);
    const cc = await rodar(pagina, 90);
    await novo();
    await quadros(pagina, 10);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 16 }]);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 16 }]);
    const cu = await rodar(pagina, 90);
    meta('CHUTE tocado duas vezes: cavadinha (um chute só); um toque: chute, nunca cavadinha', `duas: chutes ${cc.chutes}, voos ${cc.voos.join(',') || '-'} · um: chutes ${cu.chutes}, voos ${cu.voos.join(',') || '-'}`, sem(cc.chutes === 1 && cc.voos.includes('cavadinha') && cu.chutes === 1 && !cu.voos.includes('cavadinha')));
    // o dedo sai e volta ao CHUTE sem quadro no meio: cavadinha (o reaperto vira solto + apertado nos passos)
    await novo();
    await quadros(pagina, 10);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 17 }]); await rodar(pagina, 4);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 17 }]);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 18 }]); await rodar(pagina, 4);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 18 }]);
    const cr = await rodar(pagina, 90);
    meta('CHUTE: dedo sai e volta no mesmo quadro: cavadinha (o reaperto não se perde)', `chutes ${cr.chutes}, voos ${cr.voos.join(',') || '-'}`, sem(cr.chutes === 1 && cr.voos.includes('cavadinha')));
    // toque cancelado pelo sistema (pointercancel: gesto da borda, notificação) = soltar, como sempre foi no CHUTE: o 2º
    // toque cancelado ainda dá a cavadinha (um chute só); um toque só cancelado dá o chute; o botão não fica preso
    await novo();
    await quadros(pagina, 10);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 19 }]); await rodar(pagina, 4);
    await toque('touchEnd', [{ x: bc.x, y: bc.y, id: 19 }]); await rodar(pagina, 4);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 20 }]); await rodar(pagina, 4);
    await toque('touchCancel', []);
    const cx = await rodar(pagina, 90);
    const presoX = await pagina.evaluate(() => document.getElementById('btn-chute').classList.contains('ativo'));
    await novo();
    await quadros(pagina, 10);
    await toque('touchStart', [{ x: bc.x, y: bc.y, id: 21 }]); await rodar(pagina, 20);
    await toque('touchCancel', []);
    const cy = await rodar(pagina, 90);
    meta('CHUTE cancelado pelo sistema = soltar: 2º toque cancelado → cavadinha; toque único cancelado → chute; nada preso', `dois (2º cancelado): chutes ${cx.chutes}, voos ${cx.voos.join(',') || '-'} · um cancelado: chutes ${cy.chutes}, voos ${cy.voos.join(',') || '-'} · aceso depois ${presoX}`, !presoX && sem(cx.chutes === 1 && cx.voos.includes('cavadinha') && cy.chutes === 1 && !cy.voos.includes('cavadinha')));
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
    const defE3c = await temDefesaE3(pagina);
    meta('Sem a bola: TROCAR, GOLEIRO e CORRER (ataque some)', `fase ${d0.fase}, posse ${d0.posse}, botões ${ld.ids.join(', ')}`, d0.fase === 'defesa' && ['correr', 'goleiro', 'trocar'].every(b => ld.ids.includes(b)) && !ld.ids.some(b => ['chute', 'passe', 'enfiada', 'lancamento'].includes(b)));
    meta('Sem a bola: 5 botões (TROCAR, GOLEIRO, PRESSÃO, DIVIDIDA, CORRER) no arco da defesa (≥ 48 px, sem encostar)', `botões ${ld.ids.join(', ')}; menor ${ld.menor} px${ld.problemas.length ? ' — ' + ld.problemas.join('; ') : ''}`,
      defE3c ? JSON.stringify(ld.ids) === JSON.stringify(DEFESA_TOQUE) && ld.problemas.length === 0 : AG4);
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
    // DIVIDIDA de dois sentidos (tela limpa, 11/10): tocar (desce e sobe sem quadro no meio) = DIVIDIDA, sem CONTER;
    // segurar (30 quadros = 0,5 s do relógio do jogo) = CONTER enquanto o dedo fica e nada de DIVIDIDA ao soltar.
    // PRESSÃO segurada chega ao jogo.
    const defesaToque = async () => { await novo(); await pagina.evaluate(() => window.__golaco.acao('maquina')); await quadros(pagina, 20); };
    await defesaToque();
    const bd = await centro('btn-dividida');
    await toque('touchStart', [{ x: bd.x, y: bd.y, id: 17 }]);
    await toque('touchEnd', [{ x: bd.x, y: bd.y, id: 17 }]);
    const dv1 = await rodar(pagina, 4);
    await defesaToque();
    await toque('touchStart', [{ x: bd.x, y: bd.y, id: 18 }]);
    const dv2 = await rodar(pagina, 30);
    const dvAceso = await pagina.evaluate(() => document.getElementById('btn-dividida').classList.contains('ativo'));
    await toque('touchEnd', [{ x: bd.x, y: bd.y, id: 18 }]);
    const dv3 = await rodar(pagina, 4);
    meta('DIVIDIDA: tocar = bote (DIVIDIDA); segurar = CONTER (aceso) e soltar não dá bote',
      `tocada: máscara ${dv1.mask}; segurada 0,5 s: máscara ${dv2.mask}, aceso ${dvAceso}; depois de soltar: ${dv3.mask}`,
      defE3c ? (dv1.mask & BIT.DIVIDIDA) !== 0 && !(dv1.mask & BIT.CONTER) && (dv2.mask & BIT.CONTER) !== 0 && !(dv2.mask & BIT.DIVIDIDA) && dvAceso && !(dv3.mask & (BIT.DIVIDIDA | BIT.CONTER)) : AG4);
    // o sistema toma o toque (touchcancel → pointercancel: gesto da borda, chamada) logo depois de encostar: não é um
    // toque curto — nada de bote (contraprova da tela limpa: o soltar por cancelamento dava DIVIDIDA)
    await defesaToque();
    await toque('touchStart', [{ x: bd.x, y: bd.y, id: 20 }]);
    const dc1 = await rodar(pagina, 3);
    await toque('touchCancel', []);
    const dc2 = await rodar(pagina, 6);
    const dcAceso = await pagina.evaluate(() => document.getElementById('btn-dividida').classList.contains('ativo'));
    meta('DIVIDIDA: toque cancelado pelo sistema não dá bote (nem fica segurado)', `encostado: máscara ${dc1.mask}; depois do cancelamento: ${dc2.mask}, aceso ${dcAceso}`,
      defE3c ? (dc1.mask & BIT.CONTER) !== 0 && !(dc2.mask & (BIT.DIVIDIDA | BIT.CONTER)) && !dcAceso : AG4);
    await defesaToque();
    const bpr = await centro('btn-pressao');
    await toque('touchStart', [{ x: bpr.x, y: bpr.y, id: 19 }]);
    const pr1 = await rodar(pagina, 10);
    await toque('touchEnd', [{ x: bpr.x, y: bpr.y, id: 19 }]);
    meta('PRESSÃO segurada (1º anel) chega ao jogo', `máscara ${pr1.mask}`, defE3c ? (pr1.mask & BIT.PRESSAO) !== 0 : AG4);
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
    // ---- partida (pedidos do dono de 11/10): PRESSÃO com a marca de quem foi chamado; goleiro na mão do humano
    const temCena = await pagina.evaluate(() => typeof window.__golaco.cenaDeTeste === 'function');
    if (!temCena) {
      meta('Partida: PRESSÃO segurado (toque) — a marca aparece sobre quem foi chamado em ≤ 3 quadros e ele persegue', 'sem cenaDeTeste na página', false);
      meta('Partida: goleiro com a bola no pé — PEGAR aparece e, com o recuo, é tiro livre indireto', 'sem cenaDeTeste na página', false);
      meta('Partida: goleiro com a bola nas mãos anda pelo analógico na área; o anel dos 8 s aparece', 'sem cenaDeTeste na página', false);
    } else {
      await pagina.evaluate(() => { const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 3 }); g.relogio.usarManual(true); for (let i = 0; i < 5; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.cenaDeTeste('pressao'); });
      const p0 = await quadros(pagina, 20);
      const semMarca = await pagina.evaluate(() => window.__golaco.indicadores?.pressao == null);
      const bpr = await centro('btn-pressao');
      await toque('touchStart', [{ x: bpr.x, y: bpr.y, id: 21 }]);
      const pr = await pagina.evaluate(() => {
        const g = window.__golaco, out = [];
        for (let k = 0; k < 90; k++) {
          g.relogio.avancar(1000 / 60, { desenhar: k < 4 || k === 89 });
          const m = g.mundo, c = m.pressaoHumano?.[0], id = c && c.tick === m.tick - 1 ? c.id : -1;
          const j = id >= 0 ? m.jogadores.find(o => o.id === id) : null, d0 = m.jogadores.find(o => o.id === m.posse);
          const mk = g.indicadores?.pressao;
          out.push({ id, marca: !!mk, sobre: !!(mk && j && Math.hypot(mk.x - j.x, mk.z - j.z) < 0.6 && mk.y > 1.8), d: j && d0 && d0.time === 1 ? Math.hypot(j.x - d0.x, j.z - d0.z) : null });
        }
        return out;
      });
      await toque('touchEnd', [{ x: bpr.x, y: bpr.y, id: 21 }]);
      const primeiro = pr.findIndex(q => q.marca && q.sobre);
      const dIni = pr.find(q => q.d != null)?.d ?? null, dMin = Math.min(...pr.filter(q => q.d != null).map(q => q.d));
      meta('Partida: PRESSÃO segurado (toque) — a marca aparece sobre quem foi chamado em ≤ 3 quadros e ele persegue',
        `fase ${p0.fase}, marca antes ${semMarca ? 'não' : 'sim'}, aparece no quadro ${primeiro + 1}, chamado ${pr[primeiro]?.id ?? '-'}; distância ao condutor ${dIni?.toFixed(1) ?? '-'} → mín ${Number.isFinite(dMin) ? dMin.toFixed(1) : '-'} m em 1,5 s`,
        p0.fase === 'defesa' && semMarca && primeiro >= 0 && primeiro <= 2 && dIni != null && dMin <= Math.min(2.5, dIni - 2));
      // goleiro com a bola no pé, recuo valendo: o PEGAR aparece (sem encostar) e vira tiro livre indireto do adversário
      await pagina.evaluate(() => { const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 3 }); g.relogio.usarManual(true); for (let i = 0; i < 5; i++) g.relogio.avancar(1000 / 60, { desenhar: false }); g.cenaDeTeste('goleiroPe'); });
      await quadros(pagina, 3);
      const lp = await layoutToque(pagina);
      const bpg = await centro('btn-pegar');
      await toque('touchStart', [{ x: bpg.x, y: bpg.y, id: 22 }]);
      await toque('touchEnd', [{ x: bpg.x, y: bpg.y, id: 22 }]);
      const ep = await quadros(pagina, 3);
      meta('Partida: goleiro com a bola no pé — PEGAR aparece (≥ 48 px, sem encostar) e, com o recuo, é tiro livre indireto',
        `botões ${lp.ids.join(', ')}${lp.problemas.length ? ' — ' + lp.problemas.join('; ') : ''}; depois do toque: parada ${ep.parada?.tipo ?? '-'} do time ${ep.parada?.time ?? '-'}${ep.parada?.direto ? ' (direto)' : ''}`,
        lp.ids.includes('pegar') && lp.problemas.length === 0 && ep.parada?.tipo === 'tiroLivre' && ep.parada?.time === 1 && !ep.parada?.direto);
      // goleiro com a bola nas mãos: anda pelo analógico (para a frente), não sai da área; o anel aparece nos últimos 5 s
      const gm = await pagina.evaluate(() => {
        const g = window.__golaco; g.reiniciar({ modo: 'partida', semente: 3 }); g.relogio.usarManual(true);
        for (let i = 0; i < 5; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        const ids = g.cenaDeTeste('goleiroMao');
        const m = g.mundo, gk = m.jogadores.find(o => o.id === ids.goleiro), lado = m.ataca[0], gx = -lado * 52.5;
        const x0 = gk.x, z0 = gk.z;
        g.forcarEntrada({ x: lado, z: 0, botoes: 0 });
        let fora = 0, anelAntes = false, anel = null;
        for (let k = 0; k < 240; k++) {
          g.relogio.avancar(1000 / 60, { desenhar: k === 100 || k === 239 });
          if (Math.abs(gk.x - gx) > 16.5 || Math.abs(gk.z) > 20.16) fora++;
          if (k === 100) anelAntes = !!g.indicadores?.oito;
        }
        anel = g.indicadores?.oito;
        g.forcarEntrada(null);
        return { andou: Math.hypot(gk.x - x0, gk.z - z0), fora, naMao: m.naMao === gk.id, anelAntes, anel: anel ? { ...anel } : null };
      });
      meta('Partida: goleiro com a bola nas mãos anda pelo analógico na área; o anel dos 8 s aparece (aos 4 s, esvaziando)',
        `andou ${gm.andou.toFixed(1)} m, fora da área ${gm.fora} quadros, bola na mão ${gm.naMao}; anel aos 1,7 s ${gm.anelAntes ? 'sim' : 'não'}, aos 4 s ${gm.anel ? `${gm.anel.segmentos}/${gm.anel.total}` : 'não'}`,
        gm.andou >= 3 && gm.fora === 0 && gm.naMao && !gm.anelAntes && !!gm.anel && gm.anel.segmentos < gm.anel.total && gm.anel.segmentos > 0);
    }
    const m = await centro('btn-menu');
    await pagina.touchscreen.tap(m.x, m.y);
    const menu = await pagina.evaluate(() => !document.getElementById('menu').hidden);
    meta('Botão de menu (toque) abre o menu', String(menu), menu);
    meta('Celular sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}

// ------------------------------------------------------------------ outras telas de celular
// deitado estreito (iPhone SE, sem entalhe) e com entalhe (mini)
for (const t of [
  { largura: 667, altura: 375, entalhe: false, nome: '667×375 deitado' },
  { largura: 812, altura: 375, entalhe: true, nome: '812×375 deitado, entalhe' },
]) {
  const { navegador, pagina, erros } = await abrir({ largura: t.largura, altura: t.altura, dpr: 2, toque: true });
  try {
    await pagina.goto(srv.url + '?q=baixa' + (t.entalhe ? '&entalhe=1' : ''), { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.relogio.usarManual(true); });
    const ep = await quadros(pagina, 2);
    const relVis = await pagina.evaluate(() => { const r = document.getElementById('placar-relogio'); return !!r && !r.hidden && r.offsetWidth > 0; });
    const [okL, txtL] = await conferirTodosLayouts(pagina);
    meta(`${t.nome}: nada encosta (botões, analógico, HUD com o relógio da partida), ≥ 48 px, área segura`, `modo ${ep.modoTreino}, relógio ${relVis}; ${txtL}`, okL && ep.modoTreino === 'partida' && relVis);
    meta(`${t.nome}: sem erro no console`, erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}
// ------------------------------------------------------------------ em pé: gire o celular
for (const t of [
  { largura: 390, altura: 844, entalhe: true, nome: '390×844 em pé, entalhe' },
  { largura: 375, altura: 667, entalhe: false, nome: '375×667 em pé' },
]) {
  const { navegador, pagina, erros } = await abrir({ largura: t.largura, altura: t.altura, dpr: 2, toque: true });
  try {
    await pagina.goto(srv.url + '?q=baixa' + (t.entalhe ? '&entalhe=1' : ''), { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    await pagina.evaluate(() => { window.__golaco.relogio.usarManual(true); });
    // 2 s de jogo em pé, segurando o analógico e tocando onde ficam os botões
    const x0 = Math.round(t.largura * 0.25), y0 = Math.round(t.altura * 0.8);
    const cdp = await pagina.context().newCDPSession(pagina);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + 40, y: y0 - 30, id: 1 }] });
    const em = await pagina.evaluate(() => {
      const g = window.__golaco;
      const h0 = g.hash(), t0 = g.estado().tick;
      for (let i = 0; i < 120; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 119 });
      const el = document.getElementById('girar');
      const r = el.getBoundingClientRect();
      const pontos = [[innerWidth / 2, innerHeight / 2], [innerWidth * 0.85, innerHeight * 0.85], [innerWidth * 0.2, innerHeight * 0.8], [innerWidth - 30, 30]];
      const cobertos = pontos.filter(([x, y]) => { const e = document.elementFromPoint(x, y); return !!e && el.contains(e); }).length;
      return {
        h0, h1: g.hash(), t0, t1: g.estado().tick, vis: getComputedStyle(el).display !== 'none',
        cobre: r.left <= 0 && r.top <= 0 && r.right >= innerWidth && r.bottom >= innerHeight, cobertos, n: pontos.length,
        texto: document.getElementById('girar-titulo').textContent.trim(),
      };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    meta(`${t.nome}: "Gire o celular" por cima de tudo e o jogo parado (2 s, analógico segurado)`,
      `tela ${em.vis ? 'visível' : 'escondida'}, cobre ${em.cobre}, por cima em ${em.cobertos}/${em.n} pontos, tick ${em.t0} → ${em.t1}, hash ${em.h0 === em.h1 ? 'igual' : 'mudou'}, "${em.texto}"`,
      em.vis && em.cobre && em.cobertos === em.n && em.t1 === em.t0 && em.h0 === em.h1 && /gire o celular/i.test(em.texto));
    // deita: a tela some, o jogo anda e o layout deitado continua sem nada encostando
    await pagina.setViewportSize({ width: t.altura, height: t.largura });
    await pagina.waitForTimeout(250);
    const dep = await pagina.evaluate(() => {
      const g = window.__golaco;
      const t0 = g.estado().tick;
      for (let i = 0; i < 60; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 59 });
      return { t0, t1: g.estado().tick, vis: getComputedStyle(document.getElementById('girar')).display !== 'none' };
    });
    const [okL, txtL] = await conferirTodosLayouts(pagina);
    meta(`${t.nome} → deitado (${t.altura}×${t.largura}): a tela some, o jogo anda e nada encosta`,
      `tela ${dep.vis ? 'visível' : 'escondida'}, tick ${dep.t0} → ${dep.t1}; ${txtL}`, !dep.vis && dep.t1 > dep.t0 && okL);
    meta(`${t.nome}: sem erro no console`, erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}
// PC com a janela estreita em pé (sem toque): continua jogando, sem a tela de girar
{
  const { navegador, pagina, erros } = await abrir({ largura: 420, altura: 800, dpr: 1, toque: false });
  try {
    await pagina.goto(srv.url + '?q=baixa', { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    const pc = await pagina.evaluate(() => {
      const g = window.__golaco; g.relogio.usarManual(true);
      const t0 = g.estado().tick;
      for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: i === 29 });
      return { t0, t1: g.estado().tick, vis: getComputedStyle(document.getElementById('girar')).display !== 'none' };
    });
    meta('PC, janela em pé (sem toque): sem "Gire o celular", o jogo anda', `tela ${pc.vis ? 'visível' : 'escondida'}, tick ${pc.t0} → ${pc.t1}`, !pc.vis && pc.t1 > pc.t0);
    meta('PC, janela em pé: sem erro no console', erros.length ? erros.join(' | ') : '0', erros.length === 0);
  } finally { await navegador.close(); }
}
await srv.fechar();

const larg = Math.max(...res.map(r => r.nome.length));
const rot = ok => (ok === AG ? 'AGUARDANDO LÓGICA' : ok === AG4 ? 'AGUARDANDO PARTE 4' : ok ? 'PASSOU  ' : 'REPROVOU');
for (const r of res) console.log(`${rot(r.ok)}  ${r.nome.padEnd(larg)}  ${r.medido}`);
const reprovou = res.filter(r => r.ok !== AG && r.ok !== AG4 && !r.ok);
const aguardando = res.filter(r => r.ok === AG || r.ok === AG4);
if (reprovou.length) console.log('\nteste-controles: REPROVOU');
else if (aguardando.length) console.log(`\nteste-controles: PASSOU na interface; ${aguardando.length} itens AGUARDANDO LÓGICA (não contam como passou)`);
else console.log('\nteste-controles: PASSOU');
process.exit(reprovou.length ? 1 : 0);
