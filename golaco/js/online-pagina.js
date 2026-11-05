// Online 1×1 — a parte da PÁGINA (DOM): o transporte (a MessagePort que o Total Match entrega, ou um BroadcastChannel nos
// testes), os avisos na tela (aguardando, instável, pausado, W.O., dessincronia) e a pausa combinada. A lógica da
// sessão é a de js/online.js (puro); o laço que roda os passos fica no main.js (quadroOnline). Carregado por import
// dinâmico só com o pedido do TM modo "online" (ou ?online=<sala>&transporte=bc&lado=0|1 nos testes).
//
// Porta do TM (protocolo no topo de legacy-total-match/js/online3d.js, seção 5): o quadro manda 'tm3d:pronto' (ponte-tm.js)
// e recebe {tipo: 'tm3d:porta', porta} — nela chegam {t:'j', b} (pacote do jogo), {t:'c', m} (controle) e {t:'estado', ...};
// saem {t:'j', b} (transferido), {t:'c', m}, {t:'religar'} e {t:'estado?'}.
import * as O from './online.js';
import { aoTocar } from './toque-botao.js';

// A tela antes do jogo (item 64; contrato "Tela antes do jogo (item 64)" no CONTRATOS.md): a FASE de cada lado vai no byte 19 do
// pacote (o `estado`), em bits definidos AQUI — o online.js (entrada do fecho do hash) fica intocado; os bits 0–2 continuam os
// dele (30 qps, menu, aba escondida). Todo pacote leva a fase: o canal do jogo é sem ordem e sem reenvio, mas a fase só avança
// (tela → pronto → pré-jogo → jogo), então a do outro é o MAIOR valor já recebido — um pacote velho não desfaz nada.
export const E_TELA = 8, E_PRONTO = 16, E_PREJOGO = 32;
/** A fase (0 tela, 1 pronto, 2 pré-jogo, 3 jogo) pelo byte de estado de um pacote. */
export function faseDoEstado(e) {
  if (e & E_PREJOGO) return 2;
  if (e & E_TELA) return e & E_PRONTO ? 1 : 0;
  return 3;
}

const CSS = `
#online-aviso{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);z-index:60;min-width:min(86vw,360px);max-width:92vw;
  background:rgba(5,8,7,.92);color:#fff;border:1px solid rgba(34,197,94,.45);border-radius:14px;padding:14px 18px;text-align:center;
  font:600 15px/1.35 Inter,system-ui,sans-serif;box-shadow:0 10px 30px rgba(0,0,0,.45);pointer-events:auto}
#online-aviso[hidden]{display:none}
#online-aviso small{display:block;font-weight:400;opacity:.8;margin-top:4px;font-size:13px}
#online-aviso .linha{display:flex;gap:8px;justify-content:center;margin-top:12px;flex-wrap:wrap}
#online-aviso button{min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);
  color:#fff;font:600 14px Inter,system-ui,sans-serif;cursor:pointer}
#online-aviso button.primario{background:linear-gradient(180deg,#22c55e,#16a34a);border-color:transparent;color:#04130a}
#online-selo{position:fixed;right:calc(var(--sa-r,env(safe-area-inset-right,0px)) + 10px);top:calc(var(--sa-t,env(safe-area-inset-top,0px)) + 8px);
  z-index:40;font:600 12px Inter,system-ui,sans-serif;color:#fff;background:rgba(5,8,7,.75);border-radius:999px;padding:4px 10px;pointer-events:none}
#online-selo[hidden]{display:none}
html.pausa-aberta #online-selo{display:none}
/* (a comemoração do gol: o cartão do autor mora no mesmo canto — item 31, revisão R3; como os avisos do jogo, o selo espera a cena) */
html.em-comemoracao #online-selo{display:none}
`;

function el(tag, attrs = {}, filhos = []) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'texto') e.textContent = v; else if (k === 'classe') e.className = v; else e.setAttribute(k, v); }
  for (const f of filhos) e.append(f);
  return e;
}
const seg = ms => Math.max(0, Math.ceil(ms / 1000));
const mmss = ms => { const s = seg(ms); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

/**
 * opc: {lado, D, nomes: [anfitrião, convidado], transporte: 'porta' | 'bc', sala, ao: {sair(motivo), wo(vencedor, motivo),
 * dessinc(info), fase(f) — a fase do outro subiu}}. Devolve a página do online (s = a sessão).
 */
export function criarPaginaOnline(opc) {
  const lado = opc.lado === 1 ? 1 : 0;
  const nomes = opc.nomes ?? ['Anfitrião', 'Convidado'];
  const nomeOutro = String(nomes[1 - lado] ?? 'O adversário').slice(0, 40);
  const s = O.criarSessao({ lado, D: opc.D });
  const ao = opc.ao ?? {};

  // ------------------------------------------------------------------ transporte
  let porta = null, bc = null;
  const filaSaida = [];        // o que tentou sair antes da porta existir
  let estadoLig = { estado: 'ligando', rtt: null };
  const ctrlRecebidos = [];
  function aoControle(m) {
    if (!m || typeof m !== 'object') return;
    if (m.tipo === 'acao') O.receberAcao(s, m.n, m.acao);
    else if (m.tipo === 'hash') O.receberHash(s, m.n, m.h);
    else ctrlRecebidos.push(m);
  }
  // a fase do outro: o maior valor recebido (-1 = nenhum pacote ainda)
  let faseRemota = -1;
  function aoMensagem(d) {
    if (!d || typeof d !== 'object') return;
    if (d.t === 'j' && d.b instanceof ArrayBuffer) {
      // (a fase que subiu avisa na hora — a saída conjunta da tela não espera o próximo quadro, que com o 3D atrás é lento)
      if (O.receber(s, d.b, performance.now())) { const f = faseDoEstado(s.estadoRemoto); if (f > faseRemota) { faseRemota = f; ao.fase?.(f); } }
    }
    else if (d.t === 'c') aoControle(d.m);
    else if (d.t === 'estado') estadoLig = { estado: d.estado, rtt: d.rtt ?? null, motivo: d.motivo ?? null };
  }
  function enviar(msg, transf) {
    if (porta) { try { porta.postMessage(msg, transf ?? []); } catch (_) { /* a porta fechou */ } return; }
    if (bc) { try { bc.postMessage({ de: lado, ...msg }); } catch (_) { /* fechado */ } return; }
    if (filaSaida.length < 64) filaSaida.push([msg, transf]);
  }
  if (opc.transporte === 'bc' && typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel('golaco-online-' + (opc.sala ?? 'teste'));
    bc.onmessage = e => { if (e.data && e.data.de !== lado) aoMensagem(e.data); };
    estadoLig = { estado: 'aberto', rtt: null };
  } else {
    window.addEventListener('message', e => {
      const d = e.data;
      if (!d || d.tipo !== 'tm3d:porta') return;
      const p = e.ports?.[0] ?? d.porta;
      if (!p) return;
      try { porta?.close(); } catch (_) { /* já fechada */ }
      porta = p;
      porta.onmessage = ev => aoMensagem(ev.data);
      try { porta.start?.(); } catch (_) { /* start implícito */ }
      for (const [m, t] of filaSaida.splice(0)) enviar(m, t);
      enviar({ t: 'estado?' });
    });
  }
  const enviarControle = m => enviar({ t: 'c', m });
  function enviarPacote(agora, bits) {
    const ab = O.pacote(s, agora, bits);
    enviar({ t: 'j', b: ab }, porta ? [ab] : []);
  }

  // ------------------------------------------------------------------ tela
  if (!document.getElementById('online-css')) document.head.append(el('style', { id: 'online-css', texto: CSS }));
  const aviso = el('div', { id: 'online-aviso', role: 'status', 'aria-live': 'polite', hidden: '' });
  const selo = el('div', { id: 'online-selo', hidden: '' });
  document.body.append(aviso, selo);
  let avisoChave = '';
  function mostrar(chave, titulo, sub = '', botoes = []) {
    const k = chave + '|' + titulo + '|' + sub;
    if (k === avisoChave) return;
    avisoChave = k;
    aviso.replaceChildren(el('div', { texto: titulo }));
    if (sub) aviso.append(el('small', { texto: sub }));
    if (botoes.length) {
      const l = el('div', { classe: 'linha' });
      for (const b of botoes) { const x = el('button', { type: 'button', classe: b.primario ? 'primario' : '', texto: b.texto }); x.addEventListener('click', b.fn); l.append(x); }
      aviso.append(l);
    }
    aviso.hidden = false;
  }
  function esconder() { if (!aviso.hidden) { aviso.hidden = true; avisoChave = ''; } }

  // ------------------------------------------------------------------ pausa combinada (3 por jogador, até 60 s)
  const PAUSAS = 3, PAUSA_MS = 60000, CONTAGEM_MS = 3000;
  let pausasRestam = PAUSAS;
  let pausa = null;            // a MINHA: {desde, volta: ms da volta (contagem) | null}
  let pausaDele = null;        // a do outro (informativa): {desde}
  let esperaWO = 90000;        // sem nada do outro por esse tempo: oferecer o W.O.
  let encerrado = false;

  function pausar(agora) {
    if (pausa || pausasRestam <= 0 || encerrado) return false;
    pausasRestam--;
    pausa = { desde: agora, volta: null };
    enviarControle({ tipo: 'pausa', restam: pausasRestam });
    marcarMenu();
    return true;
  }
  function retomar(agora) {
    if (!pausa || pausa.volta != null) return;
    pausa.volta = agora + CONTAGEM_MS;
    enviarControle({ tipo: 'retoma' });
  }

  /** O outro ainda não começou o jogo: o texto do aviso de espera (pacotes chegando; null = a conexão parou de verdade). */
  function antesDoOutro(c) {
    if (s.ultimoPacote == null || c.semPacoteMs >= O.AGUARDANDO_MS) return null;
    if (faseRemota === 0 || faseRemota === 1) return `${nomeOutro} ainda está antes do jogo.`;
    if (faseRemota === 2) return `${nomeOutro} ainda está no pré-jogo.`;
    return null;
  }
  /**
   * A cada quadro (agora em ms): trata o controle que chegou, a pausa, o W.O. e a dessincronia, e mostra o aviso certo.
   * ctx: {fim: a partida acabou, antes: a tela antes do jogo aberta (sem passos: só a saída do outro e a ligação valem)}.
   * Devolve se a MINHA pausa segura a simulação.
   */
  function quadro(agora, ctx = {}) {
    for (const m of ctrlRecebidos.splice(0)) {
      if (m.tipo === 'pausa') pausaDele = { desde: agora };
      else if (m.tipo === 'retoma') pausaDele = null;
      else if (m.tipo === 'abandono' && !encerrado) { encerrado = true; ao.wo?.(lado, 'saiu'); }
    }
    if (pausa && pausa.volta == null && agora - pausa.desde >= PAUSA_MS) retomar(agora);
    if (pausa && pausa.volta != null && agora >= pausa.volta) { pausa = null; marcarMenu(); }
    if (s.dessinc) {
      encerrado = true;
      selo.hidden = true;
      mostrar('dessinc', 'Os dois aparelhos ficaram diferentes por um erro do jogo.', 'A partida foi encerrada sem resultado: nada conta.',
        [{ texto: 'Voltar ao Total Match', primario: true, fn: () => ao.dessinc?.(s.dessinc) }]);
      return true;
    }
    if (encerrado || ctx.fim) { esconder(); selo.hidden = true; return false; }
    const c = O.estadoConexao(s, agora);
    if (pausa) {
      const falta = pausa.volta != null ? `Voltando em ${seg(pausa.volta - agora)}…` : `Você pausou · ${mmss(PAUSA_MS - (agora - pausa.desde))}`;
      mostrar('pausa', falta, pausa.volta != null ? '' : `${pausasRestam} ${pausasRestam === 1 ? 'pausa restante' : 'pausas restantes'}`,
        pausa.volta != null ? [] : [{ texto: 'Continuar a partida', primario: true, fn: () => retomar(performance.now()) }]);
    } else if (pausaDele) {
      mostrar('pausaDele', `Pausado por ${nomeOutro}`, `até ${mmss(PAUSA_MS - (agora - pausaDele.desde))}`);
    } else if (estadoLig.estado === 'fechado' && s.ultimoPacote != null) {
      mostrar('fechado', `${nomeOutro} saiu da partida.`, 'Vitória por W.O.', [{ texto: 'Voltar ao Total Match', primario: true, fn: () => { encerrado = true; ao.wo?.(lado, 'saiu'); } }]);
    } else if (c.estado === 'aguardando') {
      const semNada = Math.max(c.semPacoteMs, s.ultimoPacote == null ? c.paradoMs : 0);
      const botoes = semNada >= esperaWO ? [
        { texto: 'Encerrar com vitória por W.O.', primario: true, fn: () => { encerrado = true; ao.wo?.(lado, 'sumiu'); } },
        { texto: 'Esperar mais', fn: () => { esperaWO = semNada + 60000; avisoChave = ''; } },
      ] : [];
      // (o outro ainda na tela antes do jogo ou no pré-jogo, com os pacotes chegando: é isso que o aviso diz — "a conexão parou"
      // enganava; o W.O. continua só sem pacote por 90 s)
      const antesOutro = antesDoOutro(c);
      mostrar('aguardando', `Aguardando ${nomeOutro}…`, s.ultimoPacote == null ? 'O outro aparelho ainda está abrindo a partida.' : antesOutro ?? 'A conexão parou. Se não voltar, vocês podem encerrar.', botoes);
      if (c.semPacoteMs >= O.AGUARDANDO_MS && porta && (Math.floor(c.semPacoteMs / 5000) !== quadro.ultReligar)) { quadro.ultReligar = Math.floor(c.semPacoteMs / 5000); enviar({ t: 'religar' }); }
    } else if (c.paradoMs >= 900 && !ctx.antes) {
      mostrar('espera', `Aguardando ${nomeOutro}…`, antesDoOutro(c) ?? '');
    } else esconder();
    // selo pequeno de conexão instável (só quando não há aviso maior)
    const instavel = c.estado === 'instavel' && aviso.hidden;
    selo.hidden = !instavel;
    if (instavel) selo.textContent = 'Conexão instável';
    return !!pausa;
  }

  // ------------------------------------------------------------------ o menu (pausa) do online: Pausar e Sair
  let bPausar = null, bSair = null, sairArmado = 0;
  function montarMenu() {
    const acoes = document.getElementById('menu-acoes');
    if (!acoes || document.getElementById('btn-online-pausar')) return;
    bPausar = el('button', { type: 'button', classe: 'btn', id: 'btn-online-pausar' });
    // (o texto do item no <span class="item-txt">, como os da pausa: o "…" de segurança)
    bPausar.append(el('span', { classe: 'item-txt', texto: 'Pausar a partida' }), ' ', el('small', { classe: 'estado', texto: `${pausasRestam} restantes` }));
    bSair = el('button', { type: 'button', classe: 'btn', id: 'btn-online-sair' });
    const descSair = el('small', { classe: 'desc', id: 'desc-online-sair', texto: 'conta como derrota' });
    const txSair = el('span', { classe: 'item-txt', texto: 'Sair da partida' });
    bSair.append(txSair, ' ', descSair);
    bSair.setAttribute('aria-describedby', 'desc-online-sair');
    // pelo toque, no pointerup do MESMO dedo (aoTocar: com outro dedo parado na tela o click não vem); mouse e teclado pelo click
    aoTocar(bPausar, () => { if (!bPausar.disabled) ao.menuPausar?.(); });
    // sair pede confirmação: o 1º toque arma (3 s), o 2º sai
    aoTocar(bSair, () => {
      const agora = performance.now();
      if (agora - sairArmado < 3000) { sairArmado = 0; ao.menuSair?.(); return; }
      sairArmado = agora;
      // (curto: "Toque de novo para sair" passava da linha com o foco no PC e em 667×375 — F1 da revisão do item 58)
      txSair.textContent = 'Toque de novo: sair';
      setTimeout(() => { if (performance.now() - sairArmado >= 2900) txSair.textContent = 'Sair da partida'; }, 3000);
    });
    // a pausa do item 58: o Pausar logo depois do "Voltar ao jogo" e o Sair por último
    const cont = document.getElementById('btn-continuar');
    if (cont && cont.parentElement === acoes) cont.after(bPausar); else acoes.prepend(bPausar);
    acoes.append(bSair);
  }
  function marcarMenu() {
    if (!bPausar) return;
    bPausar.querySelector('small').textContent = pausasRestam ? `${pausasRestam} ${pausasRestam === 1 ? 'restante' : 'restantes'}` : 'nenhuma restante';
    bPausar.disabled = pausasRestam <= 0 || !!pausa || encerrado;
  }
  montarMenu();

  function sair() {
    if (encerrado) return;
    encerrado = true;
    enviarControle({ tipo: 'abandono' });
  }

  return {
    s, lado, nomeOutro, enviarPacote, enviarControle, quadro, pausar, retomar, sair,
    get pausasRestam() { return pausasRestam; },
    /** A fase do outro (-1 sem pacote; 0 tela, 1 pronto, 2 pré-jogo, 3 jogo) — a tela antes do jogo sai com ela ≥ 1. */
    get faseRemota() { return faseRemota; },
    get pausado() { return !!pausa; },
    get encerrado() { return encerrado; },
    get estadoLigacao() { return estadoLig; },
  };
}
