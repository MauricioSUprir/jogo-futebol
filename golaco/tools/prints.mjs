// Prints (navegador), com o HUD: a PARTIDA 11×11 (a página abre nela) no PC 1280×720 Alta e no
// celular 844×390 dpr 2 Média (toque, entalhe simulado), de dia e de noite — com a bola, em DEFESA
// (TROCAR/GOLEIRO/CONTER/DIVIDIDA/PRESSÃO/CORRER e o "próximo da troca"), num escanteio e no
// intervalo; o "Editar time" nas 3 abas no PC, no celular deitado e em pé, e com uma substituição
// pendente; do treino de ataque (?modo=ataque): lançamento de verdade (marca de queda no gramado)
// e a barra de força do chute; extras: câmera aproximada, qualidade baixa, celular em pé, menu e
// ajuda, e conferências com a câmera livre (manequim de perto, uniformes dos goleiros e o gol); o goleiro
// mergulhando (voo, contato, queda), o salto, a bola segura nas mãos e a recepção com o analógico já para o lado
// (pedido de 10/10); o impedimento com a linha do lance parada, a linha viva e o relógio nos acréscimos (Etapa 4).
// Roda a simulação com o relógio manual (?demo=1: a IA joga pelo humano) e salva em tools/saida/.
// Confere também: erros no console e caixas do HUD/botões que se sobrepõem ou passam da área
// segura (botões de toque conferidos como círculos).
//   node tools/prints.mjs [--so pc-dia,celular-noite] [--segundos 5] [--caixas]
import fs from 'node:fs';
import path from 'node:path';
import { servidor, abrir, RAIZ } from './lib/navegador.mjs';
import { acharGol } from './lib/acha-gol.mjs';
import { acharImpedimento } from './lib/acha-impedimento.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const so = arg('--so', '') ? new Set(arg('--so', '').split(',')) : null;
const segundos = +arg('--segundos', 5);
const SAIDA = path.join(RAIZ, 'tools', 'saida');
fs.mkdirSync(SAIDA, { recursive: true });

const PC = { largura: 1280, altura: 720, dpr: 1, toque: false };
const CEL = { largura: 844, altura: 390, dpr: 2, toque: true };
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
  // Editar time: 3 abas no PC (Alta, dia) e no celular deitado (Média, noite)
  { nome: 'pc-editor-escalacao', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'escalacao' },
  { nome: 'pc-editor-formacao', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'formacao' },
  { nome: 'pc-editor-taticas', ...PC, url: 'q=alta&hora=dia&demo=1', editor: 'taticas' },
  { nome: 'celular-editor-escalacao', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'escalacao' },
  { nome: 'celular-editor-formacao', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'formacao' },
  { nome: 'celular-editor-taticas', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', editor: 'taticas' },
  { nome: 'celular-editor-substituicao', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', editor: 'substituicao' },
  // treino de ataque: lançamento de verdade (L segurado: anel de queda, câmera com a bola longe)
  { nome: 'pc-lancamento', ...PC, url: 'q=alta&hora=dia&modo=ataque', prep: 'lancamento' },
  // chute carregando: barra de força perto do jogador
  { nome: 'celular-carga', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&modo=ataque', prep: 'carga' },
  { nome: 'pc-aproximada', ...PC, url: 'q=alta&hora=dia&camera=aproximada&demo=1' },
  { nome: 'celular-baixa', ...CEL, url: 'q=baixa&hora=dia&toque=1&entalhe=1&demo=1' },
  // em pé, com a ilha no topo: a tela "Gire o celular" (o jogo só roda deitado — dono, 10/10)
  { nome: 'celular-retrato', largura: 390, altura: 844, dpr: 2, toque: true, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1' },
  // "GOL!" grande e verde (o aviso que aparece por 2 s quando a bola entra)
  { nome: 'celular-gol', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', depois: 'gol' },
  // gol DE VERDADE (semente: 'gol' = a 1ª semente com gol e batida na rede, achada em Node por acharGol — a IA
  // jogando pelos dois; nada de semente fixa, que deixa de ter gol quando a IA ou o goleiro mudam): a rede
  // estufada (0,1 s depois da batida) na câmera do gol (o corte da transmissão), a torcida atrás do gol
  // explodindo e o "GOL!"; e o ataque que vira gol, 0,4 s antes, na câmera de TV
  { nome: 'pc-dia-ataque', ...PC, semente: 'gol', url: 'q=alta&hora=dia&demo=1', prep: 'antesDoGol' },
  { nome: 'pc-noite-ataque', ...PC, semente: 'gol', url: 'q=alta&hora=noite&demo=1', prep: 'antesDoGol' },
  { nome: 'celular-dia-ataque', ...CEL, semente: 'gol', url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'antesDoGol' },
  { nome: 'celular-noite-ataque', ...CEL, semente: 'gol', url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'antesDoGol' },
  { nome: 'pc-gol-rede', ...PC, semente: 'gol', url: 'q=alta&hora=dia&demo=1', prep: 'golRede' },
  { nome: 'pc-gol-rede-noite', ...PC, semente: 'gol', url: 'q=alta&hora=noite&demo=1', prep: 'golRede' },
  { nome: 'celular-gol-rede-dia', ...CEL, semente: 'gol', url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'golRede' },
  { nome: 'celular-gol-rede', ...CEL, semente: 'gol', url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'golRede' },
  // (câmeras livres "do gol": x espelhado pelo lado do gol e o olhar no z da batida)
  { nome: 'pc-gol-rede-perto', ...PC, semente: 'gol', url: 'q=alta&hora=dia&demo=1', prep: 'golRede', livre: { de: [45.5, 2.6, 7.5], para: [53.8, 1.1, -1.2], fov: 42, doGol: true } },
  { nome: 'celular-gol-rede-perto', ...CEL, semente: 'gol', url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'golRede', livre: { de: [45.5, 2.6, 7.5], para: [53.8, 1.1, -1.2], fov: 42, doGol: true } },
  // por trás do gol (entre as placas e a arquibancada): a bolsa da rede de fundo vem na direção da câmera
  { nome: 'pc-gol-rede-atras', ...PC, semente: 'gol', url: 'q=alta&hora=dia&demo=1', prep: 'golRede', livre: { de: [59.6, 2.3, 0.6], para: [53.2, 1.0, -2.6], fov: 52, doGol: true } },
  // o "GOL!" no menor celular deitado (568×320): entre o analógico e os botões
  // Etapa 4: o impedimento (semente: 'imped' = o 1º impedimento de verdade, achado em Node) com a linha DO LANCE
  // parada no gramado, a linha viva com a bola no ataque e o relógio nos acréscimos ("45+1'", "1º T +N")
  { nome: 'pc-impedimento', ...PC, semente: 'imped', url: 'q=alta&hora=dia&demo=1', prep: 'impedimento' },
  { nome: 'celular-impedimento-noite', ...CEL, semente: 'imped', url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'impedimento' },
  { nome: 'pc-linha-viva', ...PC, url: 'q=alta&hora=noite&demo=1', prep: 'linhaViva' },
  { nome: 'celular-linha-viva', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'linhaViva' },
  { nome: 'celular-acrescimo', ...CEL, semente: 5, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1&min=0.25', prep: 'acrescimo' },
  { nome: 'celular-568-acrescimo', largura: 568, altura: 320, dpr: 2, toque: true, semente: 2, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1&min=0.25', prep: 'acrescimo' },
  // Etapa 4, faltas: o pênalti montado (todos fora da área e da meia-lua, o goleiro na linha), o cartão amarelo em cima
  // de quem fez a falta e o "Editar time" com um expulso do time (a vaga vazia, tracejada, com o cartão vermelho)
  { nome: 'pc-penalti', ...PC, url: 'q=alta&hora=noite&demo=1', prep: 'penalti' },
  { nome: 'celular-penalti', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'penalti' },
  { nome: 'pc-cartao', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'cartao' },
  { nome: 'celular-cartao-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', prep: 'cartao' },
  { nome: 'pc-editor-expulso', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'expulso', editor: 'escalacao' },
  // pedidos de 11/10 (regras e controles): o PRESSÃO segurado com a marca âmbar sobre quem foi chamado e o goleiro do
  // humano andando com a bola nas mãos (analógico), com o anel dos 8 s esvaziando — sem demo (o humano joga pela entrada)
  { nome: 'celular-pressao', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', prep: 'pressao' },
  { nome: 'pc-pressao-noite', ...PC, url: 'q=alta&hora=noite', prep: 'pressao' },
  { nome: 'celular-goleiro-mao', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', prep: 'goleiroMao' },
  { nome: 'celular-goleiro-mao-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1', prep: 'goleiroMao' },
  { nome: 'pc-goleiro-mao', ...PC, url: 'q=alta&hora=dia', prep: 'goleiroMao' },
  { nome: 'celular-568-gol', largura: 568, altura: 320, dpr: 2, toque: true, semente: 'gol', url: 'q=media&hora=dia&toque=1&entalhe=1&demo=1', prep: 'golRede' },
  // torcida de perto (câmera livre): lado de lá com o mosaico, e o fundo da organizada
  { nome: 'pc-torcida', ...PC, url: 'q=alta&hora=dia&demo=1', livre: { de: [0, 14, 10], para: [0, 9, -55], fov: 42 } },
  { nome: 'celular-torcida-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&demo=1', livre: { de: [30, 8, 14], para: [70, 8, -5], fov: 48 } },
  { nome: 'pc-menu', ...PC, url: 'q=alta&hora=dia', depois: 'menu' },
  { nome: 'celular-menu', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1', depois: 'menu' },
  { nome: 'celular-ajuda', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1', depois: 'ajuda' },
  // conferência de perto (câmera livre): manequim, goleiros dos dois times e o gol
  { nome: 'pc-manequim', ...PC, url: 'q=alta&hora=dia&demo=1', livre: { rel: [0, 1.2, 6], fov: 22 } },
  { nome: 'pc-goleiros', ...PC, url: 'q=alta&hora=dia', prep: 'goleiros' },
  { nome: 'pc-gol', ...PC, url: 'q=alta&hora=noite', livre: { de: [38, 5, 14], para: [52.5, 1.2, 0], fov: 40 } },
  // transição defensiva (PR "IA intensa"): o time da IA perde a bola com gente à frente dela e volta
  // correndo — três quadros da MESMA jogada (mesma semente), câmera fixa baixa de lado: logo depois da perda,
  // 1,5 s e 3 s depois, com o RASTRO (linha amarela) de quem estava à frente da bola desde a perda, um círculo
  // na bola e a linha da bola na hora da perda (tracejada)
  { nome: 'pc-transicao-1', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'transicao:0.3', depois: 'rastro' },
  { nome: 'pc-transicao-2', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'transicao:1.5', depois: 'rastro' },
  { nome: 'pc-transicao-3', ...PC, url: 'q=alta&hora=dia&demo=1', prep: 'transicao:3.0', depois: 'rastro' },
  // pedido de 10/10: o goleiro pula (no voo e no contato) e a recepção com o analógico já para o lado (treino de
  // ataque: um chute no canto / uma bola rolando para o controlado)
  { nome: 'pc-mergulho-voo', ...PC, url: 'q=alta&hora=dia&modo=ataque', prep: 'mergulho:voo' },
  { nome: 'pc-mergulho-contato-noite', ...PC, url: 'q=alta&hora=noite&modo=ataque', prep: 'mergulho:contato' },
  { nome: 'celular-mergulho-contato', ...CEL, url: 'q=media&hora=dia&toque=1&entalhe=1&modo=ataque', prep: 'mergulho:contato' },
  { nome: 'celular-mergulho-queda-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&modo=ataque', prep: 'mergulho:queda' },
  { nome: 'pc-salto-contato', ...PC, url: 'q=alta&hora=dia&modo=ataque', prep: 'mergulho:contato:alta' },
  { nome: 'pc-goleiro-segura', ...PC, url: 'q=alta&hora=dia&modo=ataque', prep: 'mergulho:segura:corpo' },
  { nome: 'pc-recepcao', ...PC, url: 'q=alta&hora=dia&modo=ataque&camera=aproximada', prep: 'recepcao' },
  { nome: 'celular-recepcao-noite', ...CEL, url: 'q=media&hora=noite&toque=1&entalhe=1&modo=ataque&camera=aproximada', prep: 'recepcao' },
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
async function preparar(pagina, prep, gol = null) {
  return pagina.evaluate(({ prep, gol }) => {
    const g = window.__golaco;
    const av = (n, e) => { for (let i = 0; i < n; i++) { if (e) g.forcarEntrada(typeof e === 'function' ? e(i) : e); g.relogio.avancar(1000 / 60, { desenhar: false }); } };
    if (prep === 'ataque') {
      // segue jogando (demo) até o meu time estar com a bola no pé do controlado (na partida, com a
      // bola rolando: fora da saída de bola e das outras paradas)
      for (let i = 0; i < 3600; i++) {
        const e = g.estado();
        const rolando = !e.relogio || ((!e.parada || e.parada.rolou) && e.relogio.estado === 'jogo');
        if (e.fase === 'ataque' && e.posse != null && e.posse === e.controlado && rolando) break;
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
    if (prep.startsWith('transicao')) {
      // joga (demo) até o time 1 (o da IA) perder a bola em jogo corrido do meio para a frente, com ≥ 4 de
      // linha à frente dela; avança `apos` s e põe a câmera alta de lado sobre a bola e quem volta
      const apos = +prep.split(':')[1];
      const m = () => g.mundo;
      const timeBola = () => { const w = m(), id = w.naMao ?? w.posse; if (id != null) return w.jogadores.find(j => j.id === id)?.time ?? null; return w.voo?.time ?? null; };
      let tAnt = null, n = 0, achou = null;
      for (; n < 60 * 60 * 6 && !achou; n++) {
        g.relogio.avancar(1000 / 60, { desenhar: false });
        const w = m(), tb = timeBola();
        const rol = w.partida?.estado === 'jogo' && !(w.parada && !w.parada.rolou);
        if (tb != null && tAnt === 1 && tb === 0 && rol && w.posse != null) {
          const l = w.ataca[1], ub = w.bola.p.x * l;
          const frente = w.jogadores.filter(j => j.time === 1 && j.posicao !== 'GOL' && j.x * l - ub > 3);
          // (perdeu do meio para a frente: quem passou da bola tem de voltar)
          if (frente.length >= 4 && ub > -10) {
            // câmera fixa (a mesma nos dois quadros): sobre a bola e quem está à frente dela, na hora da perda,
            // puxada 12 m para o gol do time 1 (para onde eles voltam)
            const cx = (w.bola.p.x + frente.reduce((s, j) => s + j.x, 0) / frente.length) / 2 - l * 12;
            const cz = (w.bola.p.z + frente.reduce((s, j) => s + j.z, 0) / frente.length) / 2;
            achou = { ids: frente.map(j => j.id), tick: w.tick, cx, cz };
          }
        }
        if (tb != null) tAnt = tb;
      }
      if (!achou) return 'transição: NÃO achou';
      // rastro de quem estava à frente (a cada 0,1 s) e a linha da bola na hora da perda
      const rastro = achou.ids.map(id => { const j = m().jogadores.find(q => q.id === id); return [{ x: j.x, z: j.z }]; });
      const bola0 = { x: m().bola.p.x, z: m().bola.p.z };
      const passos = Math.round(apos * 60);
      for (let k = 1; k <= passos; k++) {
        av(1);
        if (k % 6 === 0 || k === passos) achou.ids.forEach((id, q) => { const j = m().jogadores.find(o => o.id === id); rastro[q].push({ x: j.x, z: j.z }); });
      }
      const w = m(), l = w.ataca[1], b = w.bola.p;
      const vs = achou.ids.map(id => w.jogadores.find(j => j.id === id));
      window.__rastro = { pontos: rastro, bola0, bola: { x: b.x, z: b.z }, apos };
      // câmera fixa (a mesma nos três quadros): baixa e de lado, do lado da TV (+x à direita), ~45 m da jogada
      g.cameraLivre({ de: [achou.cx, 22, achou.cz + 38], para: [achou.cx, 0, achou.cz - 2], fov: 50 });
      const ub = b.x * l;
      const atras = w.jogadores.filter(j => j.time === 1 && j.posicao !== 'GOL' && j.x * l < ub).length;
      const vel = vs.map(j => (-j.vx * l).toFixed(1)).join(' / ');
      return `transição em ${(n / 60).toFixed(0)} s, +${apos} s: time 1 com ${atras} de 10 atrás da bola; quem estava à frente volta a ${vel} m/s; ramos ${vs.map(j => j.ia?.ramo).join(', ')}`;
    }
    if (prep.startsWith('mergulho')) {
      // chute no canto (rasteiro/meia altura, a ~2,4 m do goleiro) e espera a fase pedida do mergulho
      const fase = prep.split(':')[1], alta = prep.split(':')[2] === 'alta', corpo = prep.split(':')[2] === 'corpo';
      const m = g.mundo, gk = m.jogadores.find(j => j.posicao === 'GOL' && j.time === 1);
      const de = m.jogadores.find(j => j.id === m.controlado[0]);
      const b = m.bola;
      // (alta: bola por cima do goleiro, perto do corpo — o salto com as mãos acima da cabeça; corpo: na altura
      // do peito, perto — a defesa em pé, para ver a bola segura nas mãos depois)
      const sx = gk.x - 17, sz = gk.z - 3, pz = gk.z + (alta ? 0.55 : corpo ? 0.3 : 2.1), py = alta ? 2.25 : corpo ? 1.0 : 0.9, v = 19;
      const kx = (52.5 - sx) / (gk.x - sx), zLinha = sz + (pz - sz) * kx;
      const ux0 = 52.5 - sx, uz0 = zLinha - sz, D = Math.hypot(ux0, uz0), Dg = Math.hypot(gk.x - sx, pz - sz);
      let lo = -0.2, hi = 0.6;
      for (let k = 0; k < 30; k++) { const el = (lo + hi) / 2, t = Dg / (v * Math.cos(el)); if (0.11 + v * Math.sin(el) * t - 4.905 * t * t < py) lo = el; else hi = el; }
      const el = (lo + hi) / 2;
      b.p.x = sx; b.p.y = 0.11; b.p.z = sz;
      b.v.x = (ux0 / D) * v * Math.cos(el); b.v.y = v * Math.sin(el); b.v.z = (uz0 / D) * v * Math.cos(el);
      b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = false;
      m.posse = null; m.naMao = null;
      if (de && de.cond) { de.cond.toque = null; de.cond.busca = false; }
      m.voo = { tipo: 'chute', de: de ? de.id : 0, time: 0, tick0: m.tick, tickChave: m.tick };
      for (let i = 0; i < 150; i++) {
        av(1);
        const d = gk.mergulho;
        if (d && d.tc != null) {
          if (fase === 'voo' && m.tick >= d.tc - 4) break;
          if (fase === 'contato' && m.tick >= d.tc) break;
          if (fase === 'queda' && m.tick >= d.tc + 12) break;
          if (fase === 'segura' && m.tick >= d.fim + 8) break;
        }
      }
      g.cameraLivre({ de: [gk.x - 7.5, 1.5, gk.z - 3.5], para: [gk.x - 0.2, 0.75, gk.z + 1.1], fov: 38 });
      const d = gk.mergulho;
      return `goleiro ${gk.id}: ${d ? `${d.tipo}, ${m.tick - d.tick0} ticks (contato no ${d.tc - d.tick0}), ${d.sucesso ? d.encaixe ? 'encaixe' : 'espalmada' : 'batido'}` : 'sem mergulho'}${m.naMao === gk.id ? ', bola na mão' : ''}`;
    }
    if (prep === 'recepcao') {
      // bola rolando para o controlado (de frente, 12 m, 10 m/s) com o analógico já para o lado (90°)
      const m = g.mundo, j = m.jogadores.find(q => q.id === m.controlado[0]);
      const a = j.rumo, b = m.bola;
      b.p.x = j.x + Math.cos(a) * 12 + Math.sin(a) * 0.8; b.p.y = 0.11; b.p.z = j.z + Math.sin(a) * 12 - Math.cos(a) * 0.8;
      const dx = j.x - b.p.x, dz = j.z - b.p.z, l = Math.hypot(dx, dz);
      b.v.x = (dx / l) * 10; b.v.y = 0; b.v.z = (dz / l) * 10; b.w.x = 0; b.w.y = 0; b.w.z = 0; b.rolando = true;
      m.posse = null; m.naMao = null; m.voo = null;
      if (j.cond) { j.cond.toque = null; j.cond.busca = false; j.cond.longeDesde = -1; }
      const e = { x: -Math.sin(a), z: Math.cos(a), botoes: 0 };
      let dist = 99, i = 0;
      for (; i < 200; i++) { av(1, e); dist = Math.hypot(m.bola.p.x - j.x, m.bola.p.z - j.z); if (dist < 1.0 || m.posse === j.id) break; }
      g.forcarEntrada(e);
      return `recepção: bola a ${dist.toFixed(2)} m em ${(i / 60).toFixed(2)} s, plano ${j.recep && j.recep.ativo ? j.recep.modo : '-'}, analógico (${e.x.toFixed(2)}, ${e.z.toFixed(2)})`;
    }
    if (prep === 'antesDoGol') {
      // a jogada que vira gol (achada por acharGol), 0,4 s antes: o ataque perto da área
      while (g.mundo.tick < gol.golTick - 24) g.relogio.avancar(1000 / 60, { desenhar: false });
      const e = g.estado();
      return `tick ${g.mundo.tick}, bola em (${e.bola.x.toFixed(1)}, ${e.bola.z.toFixed(1)}), torcida da casa: tensão ${g.estadio.emocao.torcida[0].tensao.toFixed(2)}, barulho ${g.estadio.emocao.agito.toFixed(2)}`;
    }
    if (prep === 'golRede') {
      // anda até a 1ª batida da bola na rede (guardando o evento do gol) e mais 6 passos: a bolsa no máximo
      let golEv = null, n = 0;
      while (n < 4000 && g.estadio.rede.batidas === 0) {
        g.relogio.avancar(1000 / 60, { desenhar: false }); n++;
        const ev = g.mundo.eventos.find(e => e.tipo === 'gol');
        if (ev && !golEv) golEv = { ...ev };
      }
      for (let i = 0; i < 6; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      // o autor de verdade (último toque pelos eventos, autor-gol.js), como o "GOL!" do jogo
      window.__golPrint = golEv ? { ...golEv, autor: g.estadio.autorGol?.id ?? golEv.autor } : null;
      const im0 = g.estadio.rede.impactos[0];
      window.__golLado = im0 ? { s: im0.x > 0 ? 1 : -1, z: im0.z } : { s: 1, z: 0 };
      const r = g.estadio.rede;
      const im = r.impactos[0];
      return `gol ${golEv ? `do time ${golEv.time} (autor ${window.__golPrint.autor})` : 'NÃO houve'} no tick ${g.mundo.tick - 6}, câmera ${g.estadio.planoCamera}, batidas ${r.batidas}${im ? `, pano ${im.plano} em (${im.x.toFixed(1)}, ${im.y.toFixed(2)}, ${im.z.toFixed(2)})` : ''}, placar ${g.estado().placar.join('×')}, torcida da casa excita ${g.estadio.emocao.torcida[0].excita.toFixed(2)}`;
    }
    if (prep === 'impedimento') {
      // até o 1º apito de impedimento DESTA partida (a semente que tem um, achada em Node; o lance é procurado aqui:
      // a página com os prints não refaz passo a passo o laço do Node) e mais 0,25 s: a linha do lance parada
      let n = 0;
      while (n < 30000 && !g.mundo.eventos.some(e => e.tipo === 'impedimento')) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
      for (let i = 0; i < 15; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      const ui = g.mundo.partida.ultimoImped;
      return ui ? `impedimento no tick ${ui.tick}: jogador ${ui.id} (time ${ui.time}), linha em x = ${ui.linhaX.toFixed(2)}, parada ${g.mundo.parada?.tipo}` : 'NENHUM impedimento';
    }
    if (prep === 'linhaViva') {
      // bola no campo de ataque de quem tem a bola (≥ 12 m além do meio) e a linha aparecendo (0,4 s)
      const m = g.mundo;
      const dono = () => { const id = m.naMao ?? m.posse; return id == null ? null : m.jogadores.find(j => j.id === id); };
      // (o ataque tem que durar: com a bola de volta no campo de quem a tem, a linha some — de propósito)
      let n = 0, l = null;
      for (let tentativa = 0; tentativa < 12 && n < 14400; tentativa++) {
        for (; n < 14400; n++) {
          const d = dono();
          if (d && m.partida.estado === 'jogo' && !(m.parada && !m.parada.rolou) && m.bola.p.x * m.ataca[d.time] > 12) break;
          g.relogio.avancar(1000 / 60, { desenhar: false });
        }
        // (a linha anda no quadro mesmo sem desenhar a cena: sem 24 renders seguidos, que entupiam a GPU do print)
        for (let i = 0; i < 24; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
        n += 24;
        l = g.linhaImpedimento;
        if (l?.visivel && l.opacidade > 0.3) break;
      }
      return `linha viva: ${l?.visivel ? `x = ${l.x.toFixed(2)}, opacidade ${l.opacidade.toFixed(2)}` : 'NÃO apareceu'} (tick ${m.tick})`;
    }
    if (prep === 'acrescimo') {
      // 1º tempo de 0,25 min reais: anda até o acréscimo anunciado e 1,5 min de jogo dentro dele ("45+1'")
      const m = g.mundo, p = m.partida;
      while (p.acrescimo == null && m.tick < 4000) g.relogio.avancar(1000 / 60, { desenhar: false });
      const alvo = p.tick0Tempo + p.ticksPorTempo + Math.round(Math.max(0.5, Math.min(1.5, p.acrescimo - 0.4)) * p.ticksPorTempo / 45);
      while (m.tick < alvo && p.estado !== 'intervalo') g.relogio.avancar(1000 / 60, { desenhar: false });
      return `acréscimo de ${p.acrescimo} min, tick ${m.tick}, relógio "${document.getElementById('relogio')?.textContent}" / "${document.getElementById('relogio-tempo')?.textContent}"`;
    }
    if (prep === 'penalti') {
      // falta na área (gancho faltaDeTeste) e a montagem do pênalti: até a cobrança ficar pronta
      const r = g.faltaDeTeste({ area: true, cartao: null });
      let n = 0;
      while (n < 600 && !(g.mundo.parada && g.mundo.parada.tipo === 'penalti' && g.mundo.parada.cobrador != null && g.mundo.tick >= g.mundo.parada.pronta)) { g.relogio.avancar(1000 / 60, { desenhar: false }); n++; }
      const pr = g.mundo.parada;
      return `pênalti: ${r?.parada}, cobrador ${pr?.cobrador}, canto ${pr?.miraZ}, palpite do goleiro ${pr?.palpite}`;
    }
    if (prep === 'cartao') {
      // falta com amarelo: o cartão em cima de quem fez (0,3 s depois do apito)
      const r = g.faltaDeTeste({ cartao: 'amarelo' });
      for (let i = 0; i < 18; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return `cartão ${r?.cartao} para ${r?.def} (parada ${r?.parada})`;
    }
    if (prep === 'expulso') {
      // o controlado (time 0) faz falta para vermelho: sai do campo; o editor mostra a vaga vazia
      const r = g.faltaDeTeste({ cartao: 'vermelho', doMeu: true });
      for (let i = 0; i < 30; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
      return `vermelho para ${r?.def}: em campo ${g.mundo.jogadores.filter(j => j.time === 0).length}`;
    }
    if (prep === 'pressao') {
      // jogo de verdade (o humano parado, os companheiros pela IA) até o adversário ter a bola no pé há 0,3 s na
      // frente do nosso bloco, sem ninguém nosso a menos de 5 m; aí PRESSÃO segurado: quem chega primeiro dispara e
      // leva a marca — o print sai quando ele chega a ≤ 3 m do condutor (no máximo 2,5 s segurando)
      const m = g.mundo, lado = m.ataca[0], gx = -lado * 52.5;
      const dono = () => { const d = m.posse != null && m.naMao == null ? m.jogadores.find(o => o.id === m.posse) : null; return d && d.time !== 0 ? d : null; };
      const nosso = () => { const d = dono(); if (!d) return Infinity; let b = Infinity; for (const o of m.jogadores) if (o.time === 0 && o.posicao !== 'GOL') b = Math.min(b, Math.hypot(o.x - d.x, o.z - d.z)); return b; };
      const perto = () => {
        const c = m.pressaoHumano?.[0], j = c ? m.jogadores.find(o => o.id === c.id) : null, d = dono();
        return j && d ? Math.hypot(j.x - d.x, j.z - d.z) : Infinity;
      };
      let desde = -1, n = 0;
      for (; n < 60 * 60 * 4; n++) {
        const d = dono(), rolando = (!m.parada || m.parada.rolou) && m.partida?.estado === 'jogo';
        desde = d && rolando && Math.abs(d.x - gx) > 30 ? (desde < 0 ? m.tick : desde) : -1;
        if (desde >= 0 && m.tick - desde >= 18 && g.fase === 'defesa' && nosso() >= 5) break;
        av(1, { x: 0, z: 0, botoes: 0 });
      }
      const dIni = nosso();
      let k = 0;
      for (; k < 150 && dono() && !(k >= 20 && perto() <= 3); k++) av(1, { x: 0, z: 0, botoes: 512 });
      const c = m.pressaoHumano?.[0];
      return `${(n / 60).toFixed(1)} s de jogo; condutor ${dono()?.id ?? '-'} (o nosso mais perto a ${dIni.toFixed(1)} m), chamado ${c?.id ?? '-'} a ${perto().toFixed(1)} m depois de ${(k / 60).toFixed(2)} s segurando`;
    }
    if (prep === 'goleiroMao') {
      // o goleiro do humano com a bola nas mãos anda pelo analógico 4,2 s (o anel aparece nos últimos 5 s dos 8)
      const r = g.cenaDeTeste('goleiroMao');
      const m = g.mundo, lado = m.ataca[0];
      av(252, { x: lado * 0.9, z: 0.35, botoes: 0 });
      const gk = m.jogadores.find(o => o.id === r?.goleiro);
      return `goleiro ${r?.goleiro} em ${gk?.x.toFixed(1)}, ${gk?.z.toFixed(1)}, bola na mão ${m.naMao === r?.goleiro}, anel ${g.indicadores?.oito ? `${g.indicadores.oito.segmentos}/${g.indicadores.oito.total}` : 'não'}`;
    }
    if (prep === 'goleiros') {
      av(30);
      // câmera livre de frente para o goleiro do time 1 (laranja) com zagueiros brancos
      const gol1 = g.mundo.jogadores.find(j => j.posicao === 'GOL' && j.time === 1);
      if (gol1) g.cameraLivre({ de: [gol1.x - 9, 2.6, gol1.z + 6], para: [gol1.x - 1, 1.0, gol1.z], fov: 30 });
      return gol1 ? `goleiro ${gol1.id} em ${gol1.x.toFixed(1)}, ${gol1.z.toFixed(1)}` : 'sem goleiro no mundo';
    }
    return '';
  }, { prep, gol });
}

const srv = await servidor();
// a 1ª semente com gol de verdade (só se alguma cena pedir)
let GOL = null;
if (CENAS.some(c => c.semente === 'gol' && (!so || so.has(c.nome)))) {
  GOL = await acharGol({ pastaJs: path.join(RAIZ, 'js') });
  console.log(GOL ? `gol de verdade: semente ${GOL.semente}, tick ${GOL.golTick} (time ${GOL.time}, autor ${GOL.autor})` : 'NENHUM gol de verdade nas sementes 1–40: cenas do gol puladas');
}
let IMPED = null;
if (CENAS.some(c => c.semente === 'imped' && (!so || so.has(c.nome)))) {
  IMPED = await acharImpedimento({ pastaJs: path.join(RAIZ, 'js') });
  console.log(IMPED ? `impedimento de verdade: semente ${IMPED.semente}, tick ${IMPED.tick} (jogador ${IMPED.id})` : 'NENHUM impedimento nas sementes 1–40: cenas do impedimento puladas');
}
let falhas = 0;
for (const c of CENAS) {
  if (so && !so.has(c.nome)) continue;
  if (c.semente === 'gol' && !GOL) continue;
  if (c.semente === 'imped' && !IMPED) continue;
  const t0 = Date.now();
  const { navegador, pagina, erros } = await abrir({ largura: c.largura, altura: c.altura, dpr: c.dpr, toque: c.toque });
  try {
    await pagina.goto(`${srv.url}?prints=1&semente=${c.semente === 'gol' ? GOL.semente : c.semente === 'imped' ? IMPED.semente : (c.semente ?? 3)}&${c.url}`, { waitUntil: 'load' });
    await pagina.waitForFunction(() => window.__golaco && window.__golaco.pronto, null, { timeout: 120000 });
    // N segundos de simulação a 60 Hz com relógio manual (sem render: mais rápido)
    await pagina.evaluate(seg => {
      const g = window.__golaco;
      g.relogio.usarManual(true);
      const n = Math.round(seg * 60);
      for (let i = 0; i < n; i++) g.relogio.avancar(1000 / 60, { desenhar: false });
    }, c.prep === 'lancamento' || c.prep === 'carga' || c.prep === 'goleiros' || c.prep === 'golRede' || c.prep === 'antesDoGol' || c.prep === 'impedimento' || c.prep === 'acrescimo' ? 0 : /^(mergulho|recepcao)/.test(c.prep ?? '') ? 0.5 : c.prep === 'penalti' || c.prep === 'cartao' || c.prep === 'expulso' || c.prep === 'pressao' || c.prep === 'goleiroMao' ? 2 : segundos);
    const nota = c.prep ? await preparar(pagina, c.prep, c.semente === 'imped' ? IMPED : GOL) : '';
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
      await pagina.evaluate(() => { const c = document.querySelector('#editar-time .ed-corpo'); if (c) c.scrollTop = 0; });
      notaEd = await pagina.evaluate(() => { const r = window.__golaco.editor.rascunho; return `editor ${window.__golaco.editor.aba} (${window.__golaco.editor.modo}): ${r.formacao}, subst. ${r.substituicoes.length}, escolhido ${r.escolhido ?? '-'}`; });
    }
    // alguns quadros com desenho (a mola da câmera e os botões assentam), o último é o print
    // (no gol: o "GOL!" de verdade forçado por cima dos prints; o desenho fica parado
    // no instante da rede estufada enquanto a animação do aviso chega no ponto)
    if (c.prep === 'golRede') await pagina.evaluate(() => window.__golaco.desenhar());
    else await pagina.evaluate(() => { const g = window.__golaco; g.relogio.avancar(1000 / 60, { desenhar: true }); });
    if (c.livre) {
      await pagina.evaluate(l => {
        const g = window.__golaco;
        const j = g.estado().jogador;
        let de = l.rel ? [j.x + l.rel[0], l.rel[1], j.z + l.rel[2]] : l.de;
        let para = l.rel ? [j.x, 0.9, j.z] : l.para;
        // câmera "do gol": espelha pelo lado do gol e olha para o z da batida
        if (l.doGol && window.__golLado) { const { s, z } = window.__golLado; de = [s * de[0], de[1], de[2]]; para = [s * para[0], para[1], z]; }
        g.cameraLivre({ de, para, fov: l.fov });
      }, c.livre);
    }
    if (c.depois === 'rastro') {
      // rastro da transição por cima do desenho (SVG; os pontos do mundo pela câmera de verdade: naTela)
      await pagina.evaluate(() => {
        const g = window.__golaco, R = window.__rastro;
        g.desenhar();
        if (!R) return;
        const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
        svg.setAttribute('style', 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:50');
        const el = (t, a) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); svg.appendChild(e); return e; };
        // linha da bola na hora da perda (de lado a lado do campo)
        const a = g.naTela(R.bola0.x, 0, -34), b = g.naTela(R.bola0.x, 0, 34);
        el('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: '#ffffff', 'stroke-width': 2, 'stroke-dasharray': '8 6', opacity: 0.8 });
        for (const pts of R.pontos) {
          const tela = pts.map(p => g.naTela(p.x, 0.05, p.z));
          el('polyline', { points: tela.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), fill: 'none', stroke: '#ffd400', 'stroke-width': 4, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: 0.9 });
          const f = tela[tela.length - 1];
          el('circle', { cx: f.x, cy: f.y, r: 5, fill: '#ffd400' });
        }
        const bt = g.naTela(R.bola.x, 0.1, R.bola.z);
        el('circle', { cx: bt.x, cy: bt.y, r: 14, fill: 'none', stroke: '#ffffff', 'stroke-width': 3 });
        const txt = el('text', { x: 24, y: 120, fill: '#ffffff', 'font-size': 22, 'font-family': 'sans-serif', 'font-weight': 700, stroke: '#000', 'stroke-width': 0.8 });
        txt.textContent = `${R.apos.toFixed(1).replace('.', ',')} s depois da perda — rastro de quem estava à frente da bola (linha tracejada: a bola na perda)`;
        document.body.appendChild(svg);
      });
    }
    if (c.depois === 'menu') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirMenu(); });
    if (c.depois === 'ajuda') await pagina.evaluate(() => { document.documentElement.classList.remove('modo-prints'); window.__golaco.abrirAjuda(); });
    if (c.depois === 'gol') {
      await pagina.evaluate(() => {
        document.documentElement.classList.remove('modo-prints');
        window.__golaco.mostrarEvento({ tipo: 'gol', time: 0, autor: 9 }, { fixo: true });
        // o relógio das animações CSS do headless anda devagar: a animação do aviso é posta em 0,9 s e parada
        for (const el of [document.getElementById('gol-tela'), document.querySelector('.placar')]) for (const an of el.getAnimations({ subtree: true })) { an.currentTime = 900; an.pause(); }
      });
    }
    await pagina.evaluate(() => window.__golaco.desenhar());
    await pagina.waitForTimeout(250); // animação de entrada dos botões
    if (c.prep === 'golRede') {
      // o "GOL!" de verdade por cima do instante da rede estufada; mostrado logo antes do
      // print (o desenho do headless é lento e o aviso some em 2,4 s); o relógio das animações CSS do headless
      // anda devagar: a animação é posta em 0,9 s e parada
      await pagina.evaluate(() => {
        document.documentElement.classList.remove('modo-prints');
        if (window.__golPrint) window.__golaco.mostrarEvento(window.__golPrint, { fixo: true });
        for (const el of [document.getElementById('gol-tela'), document.querySelector('.placar')]) for (const an of el.getAnimations({ subtree: true })) { an.currentTime = 900; an.pause(); }
      });
    }
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
