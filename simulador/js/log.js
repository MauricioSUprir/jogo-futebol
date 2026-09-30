// Registro de diagnóstico: guarda as últimas mensagens em memória (sem enviar nada para fora)
// e captura erros não tratados. O painel "Diagnóstico" mostra e copia este conteúdo.
const MAX = 200;
const buf = [];
const listeners = new Set();
const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

function push(level, args) {
  const msg = args.map((a) => (a instanceof Error ? `${a.message}\n${a.stack || ''}` : typeof a === 'object' ? safeJSON(a) : String(a))).join(' ');
  const e = { t: ((typeof performance !== 'undefined' ? performance.now() : 0) - t0) / 1000, level, msg };
  buf.push(e);
  if (buf.length > MAX) buf.shift();
  for (const l of listeners) { try { l(e); } catch { /* ouvinte com erro não derruba o log */ } }
  const c = level === 'erro' ? console.error : level === 'aviso' ? console.warn : console.log;
  c('[LAL]', msg);
}
function safeJSON(o) { try { return JSON.stringify(o); } catch { return String(o); } }

export const log = {
  info: (...a) => push('info', a),
  warn: (...a) => push('aviso', a),
  error: (...a) => push('erro', a),
  entries: () => buf.slice(),
  errorCount: () => buf.filter((e) => e.level === 'erro').length,
  onEntry: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
  dump: () => buf.map((e) => `${e.t.toFixed(2).padStart(8)}s ${e.level.padEnd(5)} ${e.msg}`).join('\n'),
};

export function installGlobalHandlers(onFatal) {
  window.addEventListener('error', (ev) => {
    // "Script error." sem detalhes vem de scripts de outra origem (extensões); não é nosso
    if (!ev.error && (!ev.message || ev.message === 'Script error.')) { log.warn('Erro externo ignorado'); return; }
    log.error(ev.error || ev.message);
    onFatal?.(ev.error || new Error(ev.message));
  });
  window.addEventListener('unhandledrejection', (ev) => {
    log.error('Promessa rejeitada:', ev.reason);
  });
}
