// Atualização automática: o deploy grava a versão em versao.json; ao voltar para o jogo (da tela de início ou de outro
// app) e a cada 5 minutos, compara com a versão aberta e, se mudou, recarrega (o service worker sw.js traz tudo novo).
const URL_VERSAO = new URL('../versao.json', import.meta.url);

async function lerVersao() {
  try { const r = await fetch(`${URL_VERSAO}?t=${Date.now()}`, { cache: 'no-store' }); return r.ok ? (await r.json()).v : null; } catch { return null; }
}

/** podeRecarregar(): false no meio de uma ação (o jogo decide); recarrega na próxima volta ao app. */
export async function iniciarAtualizacao({ podeRecarregar = () => true } = {}) {
  if ('serviceWorker' in navigator) {
    try { await navigator.serviceWorker.register(new URL('../sw.js', import.meta.url), { updateViaCache: 'none' }); } catch { /* sem service worker */ }
  }
  const aberta = await lerVersao();
  if (!aberta || aberta === 'dev') return;                       // rodando local: nada a comparar
  let pendente = false;
  const checar = async (voltou) => {
    const v = await lerVersao();
    if (v && v !== aberta) pendente = true;
    if (pendente && (voltou || podeRecarregar())) location.reload();
  };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') checar(true); });
  addEventListener('pageshow', (e) => { if (e.persisted) checar(true); });
  setInterval(() => checar(false), 5 * 60 * 1000);
}
