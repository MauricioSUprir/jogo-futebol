/* ===== vitrine.js — modo teste com tempo limitado (pedido de 07/11) =====
   Até as 22h de 07/11 (horário de Brasília), quem abre o site usa o app por 2 minutos e depois
   ele bloqueia. Junto, proteções contra cópia: marca d'água, tela preta quando a pessoa sai do
   app ou aperta Print, sem copiar texto, sem salvar imagem e sem imprimir.
   Nenhum site consegue impedir de verdade o print do sistema nem a foto com outro aparelho:
   isto só dificulta e marca o que for capturado.
   Depois do horário o arquivo não faz nada (o site volta ao normal sozinho, sem publicar de novo).
   A equipe entra sem limite abrindo o site uma vez com ?equipe no endereço. */
(function () {
  'use strict';
  var FIM = Date.parse('2026-11-08T01:00:00Z'); // 22h00 de 07/11 em Brasília (UTC−3)
  var LIMITE_MS = 2 * 60 * 1000;
  var CHAVE_INICIO = 'mt.vitrine.inicio';
  var CHAVE_EQUIPE = 'mt.vitrine.equipe';

  if (!(Date.now() < FIM)) return;

  var ls = null;
  try { ls = window.localStorage; } catch (e) { ls = null; }
  function ler(k) { try { return ls ? ls.getItem(k) : null; } catch (e) { return null; } }
  function gravar(k, v) { try { if (ls) ls.setItem(k, v); } catch (e) { /* segue */ } }

  // a equipe: ?equipe no endereço libera este aparelho até o fim do modo teste
  try {
    var q = new URLSearchParams(location.search);
    if (q.has('equipe')) {
      gravar(CHAVE_EQUIPE, '1');
      q.delete('equipe');
      var resto = q.toString();
      history.replaceState(null, '', location.pathname + (resto ? '?' + resto : '') + location.hash);
    }
  } catch (e) { /* segue */ }
  if (ler(CHAVE_EQUIPE) === '1') return;

  var inicio = Number(ler(CHAVE_INICIO));
  if (!inicio || !isFinite(inicio) || inicio > Date.now()) {
    inicio = Date.now();
    gravar(CHAVE_INICIO, String(inicio));
  }

  // ---------- estilos (entram já, antes da página aparecer) ----------
  var marca = 'MindTrack AI · modo teste · uso pessoal';
  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="340" height="200">' +
    '<text x="0" y="110" transform="rotate(-24 170 100)" font-family="Inter,Arial,sans-serif" font-size="15" ' +
    'font-weight="700" fill="rgba(120,120,120,0.16)">' + marca + '</text></svg>';
  var css =
    'html.vt-ativo,html.vt-ativo body{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}' +
    'html.vt-ativo input,html.vt-ativo textarea,html.vt-ativo [contenteditable]{-webkit-user-select:text;user-select:text}' +
    'html.vt-ativo img{-webkit-user-drag:none;pointer-events:auto}' +
    '.vt-marca{position:fixed;inset:0;z-index:2147483600;pointer-events:none;' +
    'background-image:url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")}' +
    '.vt-relogio{position:fixed;top:calc(env(safe-area-inset-top,0px) + 8px);left:50%;transform:translateX(-50%);' +
    'z-index:2147483601;pointer-events:none;font:700 12.5px Inter,system-ui,sans-serif;color:#fff;' +
    'background:rgba(10,11,16,.82);border:1px solid rgba(62,201,245,.6);border-radius:99px;padding:5px 12px;' +
    'letter-spacing:.02em;box-shadow:0 4px 14px rgba(0,0,0,.25)}' +
    '.vt-relogio.vt-fim-perto{border-color:#f87171;color:#fecaca}' +
    '.vt-capa,.vt-bloqueio{position:fixed;inset:0;z-index:2147483646;display:none;align-items:center;' +
    'justify-content:center;flex-direction:column;gap:10px;text-align:center;padding:24px;' +
    'background:#050608;color:#f3ead7;font-family:Inter,system-ui,sans-serif}' +
    '.vt-capa.vt-on,.vt-bloqueio.vt-on{display:flex}' +
    '.vt-bloqueio{z-index:2147483647}' +
    '.vt-bloqueio h1{margin:0;font:800 26px Inter,system-ui,sans-serif;color:#fff}' +
    '.vt-bloqueio p{margin:0;max-width:34ch;font-size:15px;line-height:1.5;color:#c9c2b2}' +
    '.vt-bloqueio b{color:#3ec9f5}' +
    '.vt-capa p{margin:0;font-size:15px;color:#a9a396}' +
    'html.vt-encerrado body>*:not(.vt-bloqueio):not(.vt-marca){display:none!important}' +
    '@media print{html.vt-ativo body{display:none!important}}';
  var estilo = document.createElement('style');
  estilo.textContent = css;
  (document.head || document.documentElement).appendChild(estilo);
  document.documentElement.classList.add('vt-ativo');

  // ---------- peças da tela ----------
  var relogio, capa, bloqueio;
  function montar() {
    var corpo = document.body;
    if (!corpo || relogio) return;
    var m = document.createElement('div'); m.className = 'vt-marca'; m.setAttribute('aria-hidden', 'true');
    relogio = document.createElement('div'); relogio.className = 'vt-relogio'; relogio.setAttribute('role', 'timer');
    capa = document.createElement('div'); capa.className = 'vt-capa';
    capa.innerHTML = '<p>Conteúdo protegido. Volte para o app para continuar.</p>';
    bloqueio = document.createElement('div'); bloqueio.className = 'vt-bloqueio'; bloqueio.setAttribute('role', 'alert');
    bloqueio.innerHTML = '<h1>Seu tempo de teste acabou</h1>' +
      '<p>Obrigado por conhecer o <b>MindTrack AI</b>. O acesso de teste dura 2 minutos por pessoa.</p>';
    corpo.appendChild(m); corpo.appendChild(relogio); corpo.appendChild(capa); corpo.appendChild(bloqueio);
    tique();
  }

  // ---------- os 2 minutos ----------
  var encerrado = false;
  function encerrar() {
    if (encerrado) return;
    encerrado = true;
    document.documentElement.classList.add('vt-encerrado');
    if (bloqueio) bloqueio.classList.add('vt-on');
    if (relogio) relogio.style.display = 'none';
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) { /* segue */ }
  }
  function tique() {
    var agora = Date.now();
    if (agora >= FIM) { location.reload(); return; } // passou das 22h: volta ao normal
    var resta = LIMITE_MS - (agora - inicio);
    if (resta <= 0) { encerrar(); return; }
    if (relogio) {
      var s = Math.ceil(resta / 1000);
      relogio.textContent = 'Modo teste · ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
      relogio.classList.toggle('vt-fim-perto', s <= 20);
    }
  }
  setInterval(tique, 500);

  // ---------- proteções contra cópia ----------
  function cobrir() { if (capa && !encerrado) capa.classList.add('vt-on'); }
  function descobrir() { if (capa) capa.classList.remove('vt-on'); }
  document.addEventListener('visibilitychange', function () { if (document.hidden) cobrir(); else descobrir(); });
  window.addEventListener('blur', cobrir);
  window.addEventListener('focus', descobrir);
  window.addEventListener('pagehide', cobrir);
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('input,textarea,[contenteditable]')) return;
    e.preventDefault();
  });
  document.addEventListener('dragstart', function (e) { e.preventDefault(); });
  ['copy', 'cut'].forEach(function (tipo) {
    document.addEventListener(tipo, function (e) {
      var t = e.target;
      if (t && t.closest && t.closest('input,textarea')) return;
      e.preventDefault();
    });
  });
  function limparArea() {
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(marca).catch(function () {}); } catch (e) { /* segue */ }
  }
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    if (k === 'printscreen' || (e.metaKey && e.shiftKey) || (mod && (k === 'p' || k === 's'))) {
      cobrir();
      limparArea();
      if (k !== 'printscreen') e.preventDefault();
      setTimeout(descobrir, 1500);
    }
  }, true);
  document.addEventListener('keyup', function (e) {
    if ((e.key || '').toLowerCase() === 'printscreen') { cobrir(); limparArea(); setTimeout(descobrir, 1500); }
  }, true);
  window.addEventListener('beforeprint', cobrir);
  window.addEventListener('afterprint', descobrir);

  if (document.body) montar();
  else document.addEventListener('DOMContentLoaded', montar);
})();
