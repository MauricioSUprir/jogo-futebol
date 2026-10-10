// Prints (navegador), com o HUD: a PARTIDA 11×11 (a página abre nela) no PC 1280×720 Alta e no
// celular 844×390 dpr 2 Média (toque, entalhe simulado), de dia e de noite — com a bola, em DEFESA
// (TROCAR/GOLEIRO/CONTER/DIVIDIDA/PRESSÃO/CORRER e o "próximo da troca"), num escanteio e no
// intervalo; o "Editar time" nas 3 abas no PC, no celular deitado e em pé, e com uma substituição
// pendente; do treino de ataque (?modo=ataque): lançamento de verdade (marca de queda no gramado)
// e a barra de força do chute; extras: câmera aproximada, qualidade baixa, celular em pé, menu e
// ajuda, e conferências com a câmera livre (manequim de perto, uniformes dos goleiros e o gol).
// Roda a simulação com o relógio manual (?demo=1: a IA joga pelo humano) e salva em tools/saida/.
// Confere também: erros no console e caixas do HUD/botões que se sobrepõem ou passam da área
// segura (botões de toque conferidos como círculos).
//   node tools/prints.mjs [--so pc-dia,celular-noite] [--segundos 5] [--caixas]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const segundos = +arg('--segundos', 5);
const SAIDA = path.join(RAIZ, 'tools', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

const PC = { largura: 1280, altura: 720, dpr: 1, toque: false };
const CEL = { largura: 844, altura: 390, dpr: 2, toque: true };
const RET = { largura: 390, altura: 844, dpr: 2, toque: true };
const CENAS = [
  // partida 11×11 (padrão da página)
  { nome: 'pc-dia', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'ataque' },
  { nome: 'pc-noite', ...PC, url: 'q=alta&hora=noite&demo=1', prep: 'ataque' },
  { nome: 'celular-dia', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'ataque' },
  { nome: 'celular-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'ataque' },
  // sem a bola: os botões da defesa (e o "próximo da troca")
  { nome: 'celular-defesa', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'defesa' },
  { nome: 'pc-defesa-noite', ...PC, url: 'q=alta&hora=noite&demo=1', prep: 'defesa' },
  // bola parada e intervalo
  { nome: 'pc-escanteio', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'escanteio' },
  { nome: 'celular-escanteio-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'escanteio' },
  { nome: 'pc-intervalo-noite', ...PC, url: 'q=alta&hora=noite&demo=1&min=0.25', prep: 'intervalo' },
  { nome: 'celular-intervalo', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1&min=0.25', prep: 'intervalo' },
  // Editar time: 3 abas no PC (Alta, dia), no celular deitado (Média, noite) e em pé (Média, dia)
  { nome: 'pc-editor-escalacao', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'escalacao' },
  { nome: 'pc-editor-formacao', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'formacao' },
  { nome: 'pc-editor-taticas', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'taticas' },
  { nome: 'celular-editor-escalacao', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'escalacao' },
  { nome: 'celular-editor-formacao', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'formacao' },
  { nome: 'celular-editor-taticas', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'taticas' },
  { nome: 'celular-editor-substituicao', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', editor: 'substituicao' },
  { nome: 'retrato-editor-escalacao', ...RET, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', editor: 'escalacao' },
  { nome: 'retrato-editor-formacao', ...RET, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', editor: 'formacao' },
  { nome: 'retrato-editor-taticas', ...RET, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', editor: 'taticas' },
  // treino de ataque: lançamento de verdade (L segurado: anel de queda, câmera com a bola longe)
  { nome: 'pc-lancamento', ...PC, url: 'q=alta&hora=dia&modo=ataque', prep: 'lancamento' },
  // chute carregando: barra de força perto do jogador
  { nome: 'celular-carga', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&modo=ataque', prep: 'carga' },
  { nome: 'pc-aproximada', ...PC, url: 'q=alta&hora=dia&camera=aproximada&demo=1' },
  { nome: 'celular-baixa', ...CEL, url: 'q=baixa&hora=dia&toque=1&entalhe=1&demo=1' },
  // em pé, com a ilha no topo (?entalhe=1 em pé simula a margem segura de cima e a de baixo)
  { nome: 'celular-retrato', largura: 390, altura: 844, dpr: 2, toque: true, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1' },
  // "GOL!" grande e verde (o aviso que aparece por 2 s quando a bola entra)
  { nome: 'celular-gol', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', depois: 'gol' },
  { nome: 'pc-menu', ...PC, url: 'q=alta&hora=dia', depois: 'menu' },
  { nome: 'celular-menu', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1', depois: 'menu' },
  { nome: 'celular-ajuda', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', depois: 'ajuda' },
  // conferência de perto (câmera livre): manequim, goleiros dos dois times e o gol
  { nome: 'pc-manequim', ...PC, url: 'q=alta&hora=dia&demo=1', livre: { rel: [0, 1.2, 6], fov: 22 } },
  { nome: 'pc-goleiros', ...PC, url: 'q=alta&hora=dia', prep: 'goleiros' },
  { nome: 'pc-gol', ...PC, url: 'q=alta&hora=noite', livre: { de: [38, 5, 14], para: [52.5, 1.2, 0], fov: 40 } },
];

/** Caixas do HUD e botões: nenhum encosta em outro e todos ficam dentro da área segura. */
async function conferirLayout(pagina) {
  return pagina.evaluate(() => {
    const sonda = document.createElement('div');
    sonda.style.cssText = 'position:fixed;left:var(--sa-l);right:var(--sa-r);top:var(--sa-t);bottom:var(--sa-b);pointer-events:none';
    document.body.appendChild(sonda);
    const r0 = sonda.getBoundingClientRect();
    sonda.remove();
    const W = innerWidth, H = innerHeight;
    const sa = { l: r0.left, t: r0.top, r: W - r0.right, b: H - r0.bottom };
    const visivel = e => e.offsetParent !== null && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden';
    // botões de toque: círculos pelo layout (sem a animação de entrada); o resto: retângulos
    const formas = [...document.querySelectorAll('[data-caixa]')].filter(visivel).map(e => {
      if (e.classList.contains('btn-toque')) {
        const d = Math.min(e.offsetWidth, e.offsetHeight);
        return { nome: e.dataset.caixa, c: { x: e.offsetLeft + e.offsetWidth / 2, y: e.offsetTop + e.offsetHeight / 2, r: d / 2 } };
      }
      return { nome: e.dataset.caixa, r: e.getBoundingClientRect() };
    }).filter(f => f.c ? f.c.r > 0 : f.r.width > 0 && f.r.height > 0);
    const caixa = f => (f.c ? { left: f.c.x - f.c.r, top: f.c.y - f.c.r, right: f.c.x + f.c.r, bottom: f.c.y + f.c.r } : f.r);
    const folga = 4;
    const distRet = (c, r) => { const qx = Math.max(r.left, Math.min(c.x, r.right)), qy = Math.max(r.top, Math.min(c.y, r.bottom)); return Math.hypot(c.x - qx, c.y - qy) - c.r; };
    const problemas = [];
    for (let i = 0; i < formas.length; i++) {
      const a = formas[i], ra = caixa(a);
      if (ra.left < sa.l - 0.5 || ra.top < sa.t - 0.5 || ra.right > W - sa.r + 0.5 || ra.bottom > H - sa.b + 0.5) problemas.push(`${a.nome} fora da área segura`);
      if (a.c && a.c.r * 2 < 48) problemas.push(`${a.nome} menor que 48 px`);
      for (let k = i + 1; k < formas.length; k++) {
        const b = formas[k], rb = caixa(b);
        let encosta;
        if (a.c && b.c) encosta = Math.hypot(a.c.x - b.c.x, a.c.y - b.c.y) - a.c.r - b.c.r < folga;
        else if (a.c) encosta = distRet(a.c, rb) < folga;
        else if (b.c) encosta = distRet(b.c, ra) < folga;
        else encosta = ra.left < rb.right + folga && rb.left < ra.right + folga && ra.top < rb.bottom + folga && rb.top < ra.bottom + folga;
        if (encosta) problemas.push(`${a.nome} encosta em ${b.nome}`);
      }
    }
    return { caixas: formas.map(f => { const r = caixa(f); return `${f.nome} ${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right - r.left)}×${Math.round(r.bottom - r.top)}`; }), problemas, sa };
  });
}

/** Preparações de cena (no navegador, relógio manual). Devolvem um texto curto do que houve. */
async function preparar(pagina, prep) {
  return pagina.evaluate(prep => {
    const g = window.__golaco;
    const av = (n, e) => { for (let i = 0; i < n; i++) { if (e) g.forcarEntrada(typeof e === 'function' ? e(i) : e); g.relogio.avancar(1000 / 60, { desenhar: false }); } };
    if (prep === 'ataque') {
      // segue jogando (demo) até o meu time estar com a bola no pé do controlado
      for (let i = 0; i < 1800; i++) {
        const e = g.estado();
        if (e.fase === 'ataque' && e.posse != null && e.posse === e.controlado) break;
        g.relogio.avancar(1000 / 60, { desenhar: false });
      }
      const e = g.estado();
      return `fase ${e.fase}, posse ${e.posse}, controlado ${e.controlado}`;
    }
    if (prep === 'defesa') {
      // joga (demo) até o adversário ficar com a bola no pé; no treino, sem isso em 40 s, a máquina
      // tira a bola do pé
      const comAdversario = () => { const e = g.estado(); return g.fase === 'defesa' && e.posse != null && g.mundo.jogadores.find(j => j.id === e.posse)?.time === 1; };
      for (let i = 0; i < 3600 && !comAdversario(); i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      let como = 'jogada';
      if (g.fase !== 'defesa' && g.estado().modoTreino !== 'partida') { g.acao('maquina'); av(20); como = 'máquina de passes'; }
      av(6);
      return `fase ${g.fase} (${como}), posse ${g.estado().posse}, próximo da troca ${g.estado().proximaTroca}`;
    }
    if (prep === 'escanteio' || prep === 'intervalo') {
      // partida (demo): joga até a parada pedida (escanteio) ou o intervalo; o escanteio pode demorar
      const achou = () => (prep === 'escanteio' ? g.estado().parada?.tipo === 'escanteio' && g.mundo.tick - g.estado().parada.desde > 40 : g.estado().relogio?.estado === 'intervalo');
      let n = 0;
      for (; n < 60 * 60 * 6 && !achou(); n++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const e = g.estado();
      if (prep === 'intervalo' && achou()) {
        g.mostrarFaixa({ titulo: 'Intervalo', placar: `${document.getElementById('sigla-0').textContent} ${e.placar[0]} × ${e.placar[1]} ${document.getElementById('sigla-1').textContent}` });
      }
      return `${prep}: ${achou() ? 'achou' : 'NÃO achou'} em ${(n / 60).toFixed(0)} s, relógio ${e.relogio?.minuto}' (${e.relogio?.estado}), parada ${e.parada?.tipo ?? '-'}, placar ${e.placar.join('×')}`;
    }
    if (prep === 'lancamento') {
      av(20, { x: 0.75, z: -0.66, botoes: 0 });
      av(32, { x: 0.75, z: -0.66, botoes: 16 });  // LANCAMENTO segurado ~0,53 s
      let n = 0;
      g.forcarEntrada({ x: 0, z: 0, botoes: 0 });
      // espera o meio do voo (bola no alto, marca de queda no gramado)
      const meio = () => { const v = g.mundo.voo; return v && v.alto && g.mundo.tick >= ((v.tick0 ?? g.mundo.tick) + (v.tickChegada ?? g.mundo.tick)) / 2; };
      while (n < 180 && !meio()) { av(1); n++; }
      g.forcarEntrada(null);
      const v = g.mundo.voo;
      return `voo ${v ? v.tipo : '-'} alto ${v ? v.alto : '-'}, marca ${g.render.queda ? 'visível' : 'não'}, bola a ${g.render.bola.y.toFixed(1)} m`;
    }
    if (prep === 'carga') {
      av(30, { x: 0.8, z: -0.2, botoes: 0 });
      av(27, { x: 0.8, z: -0.2, botoes: 32 });     // CHUTE segurado 0,45 s (~56%)
      const c = g.estado().jogador?.carga;
      g.forcarEntrada({ x: 0.8, z: -0.2, botoes: 32 }); // segue segurando no print
      return `carga ${c ? c.tipo : '-'}`;
    }
    if (prep === 'goleiros') {
      av(30);
      // câmera livre de frente para o goleiro do time 1 (laranja) com zagueiros brancos
      const gol1 = g.mundo.jogadores.find(j => j.posicao === 'GOL' && j.time === 1);
      if (gol1) g.cameraLivre({ de: [gol1.x - 9, 2.6, gol1.z + 6], para: [gol1.x - 1, 1.0, gol1.z], fov: 30 });
      return gol1 ? `goleiro ${gol1.id} em ${gol1.x.toFixed(1)}, ${gol1.z.toFixed(1)}` : 'sem goleiro no mundo';
    }
    return '';
  }, prep);
}

const srv = await servidor();
let falhas = 0;
for (const c of CENAS) {
  if (so && !so.has(c.nome)) continue;
  const t0 = Date.now();
  const { navegador, pagina, erros } = await abrir({ largura: c.largura, altura: c.altura, dpr: c.dpr, toque: c.toque });
  try {
    await pagina.goto(`${srv.url}?prints=1&semente=3&${c.url}`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    // N segundos de simulação a 60 Hz com relógio manual (sem render: mais rápido)
    await pagina.evaluate(seg => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const n = Math.round(seg * 60);
      for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    }, c.prep === 'lancamento' || c.prep === 'carga' || c.prep === 'goleiros' ? 0.5 : segundos);
    const nota = c.prep ? await preparar(pagina, c.prep) : '';
    let notaEd = '';
    if (c.editor) {
      // "Editar time" pela pausa (cliques de verdade); a aba e, na substituição, 9 → 22
      notaEd = await pagina.evaluate(() => { const g = window.__golaco; document.documentElement.classList.remove('modo-prints'); g.abrirMenu(); return ''; });
      await pagina.click('[data-cmd="editar-time"]');
      if (c.editor === 'substituicao') {
        await pagina.click('#editar-time [data-jogador="9"]');
        await pagina.click('#editar-time [data-jogador="22"]');
        await pagina.click('#editar-time [data-jogador="10"]');
      } else if (c.editor !== 'escalacao') await pagina.click(`#editar-time [data-aba="${c.editor}"]`);
      if (c.editor === 'formacao') await pagina.click('#editar-time [data-formacao="4-2-3-1"]');
      if (c.editor === 'taticas') { await pagina.click('#editar-time [data-tatica="mentalidade"][data-passo="+1"]'); await pagina.click('#editar-time [data-tatica="linha"][data-passo="+1"]'); }
      notaEd = await pagina.evaluate(() => { const r = window.__golaco.editor.rascunho; return `editor ${window.__golaco.editor.aba} (${window.__golaco.editor.modo}): ${r.formacao}, subst. ${r.substituicoes.length}, escolhido ${r.escolhido ?? '-'}`; });
    }
    // alguns quadros com desenho (a mola da câmera e os botões assentam), o último é o print
    await pagina.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: true }); });
    if (c.livre) {
      await pagina.evaluate(l => {
        const g = window.__golaco;
        const j = g.estado().jogador;
        const de = l.rel ? [j.x + l.rel[0], l.rel[1], j.z + l.rel[2]] : l.de;
        const para = l.rel ? [j.x, 0.9, j.z] : l.para;
        g.cameraLivre({ de, para, fov: l.fov });
      }, c.livre);
    }
    if (c.depois === 'menu') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirMenu(); });
    if (c.depois === 'ajuda') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirAjuda(); });
    if (c.depois === 'gol') {
      await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.mostrarEvento({ tipo: 'gol', time: 0 }); });
      await pagina.waitForTimeout(400); // transição do "GOL!"
    }
    await pagina.evaluate(() => window.__golaco.desenhar());
    await pagina.waitForTimeout(250); // animação de entrada dos botões
    const arq = path.join(SAIDA, `${c.nome}.png`);
    await pagina.screenshot({ path: arq });
    const lay = c.depois || c.editor ? { problemas: [], caixas: [] } : await conferirLayout(pagina);
    const est = await pagina.evaluate(() => {
      const g = window.__golaco;
      const e = g.estado();
      // altura do jogador controlado na tela (px CSS): pés → 1,8 m
      const j = g.render.jogador, a = g.naTela(j.x, 0, j.z), b = g.naTela(j.x, 1.8, j.z);
      e.alturaTela = Math.hypot(a.x - b.x, a.y - b.y);
      e.botoesToque = [...document.querySelectorAll('#toque .btn-toque')].filter(b => !document.getElementById('toque').hidden && getComputedStyle(b).display !== 'none').map(b => b.id.replace('btn-', '')).join(',');
      return e;
    });
    const ok = erros.length === 0 && lay.problemas.length === 0;
    if (!ok) falhas++;
    console.log(`${ok ? 'OK  ' : 'FALHA'} ${c.nome.padEnd(16)} ${path.relative(RAIZ, arq)}  (${((Date.now() - t0) / 1000).toFixed(1)} s, ${est.desenhoChamadas} chamadas, ${est.jogadores} jogadores, ${est.modoTreino}${est.relogio ? ` ${est.relogio.minuto}'` : ''}, controlado ${est.controlado} ${est.alturaTela.toFixed(0)} px, ${est.modo}, fase ${est.fase}${est.botoesToque ? ', botões ' + est.botoesToque : ''}, q=${est.qualidade})${nota ? '\n      ' + nota : ''}${notaEd ? '\n      ' + notaEd : ''}`);
    for (const e of erros) console.log('      erro no console:', e);
    for (const p of lay.problemas) console.log('      layout:', p);
    if (args.includes('--caixas')) for (const cx of lay.caixas) console.log('      caixa:', cx);
  } catch (e) {
    falhas++;
    console.log(`FALHA ${c.nome}: ${e.message}`);
    for (const er of erros) console.log('      erro no console:', er);
  } finally {
    await navegador.close();
  }
}
await srv.fechar();
console.log(falhas ? `\nprints: ${falhas} com problema` : '\nprints: todos OK');
process.exit(falhas ? 1 : 0);
