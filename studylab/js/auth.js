/* ===== auth.js — entrar com o Google (ou sem conta) =====
   Usa o Google Identity Services direto no navegador. Enquanto o
   GOOGLE_CLIENT_ID de produto.js estiver vazio, o botão nem aparece e o aluno
   entra sem conta — o app funciona igual, só não sincroniza nada.             */
import { GOOGLE_CLIENT_ID } from './produto.js';
import { entrarComo } from './store.js';
import { temServidor, entrarNoServidor } from './api.js';

const SCRIPT = 'https://accounts.google.com/gsi/client';
export const googleConfigurado = () => !!GOOGLE_CLIENT_ID;

let carregando = null;
function carregarGoogle() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (carregando) return carregando;
  carregando = new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = SCRIPT; s.async = true; s.defer = true;
    s.onload = () => ok();
    s.onerror = () => erro(new Error('Não consegui carregar o login do Google. Verifique sua internet.'));
    document.head.append(s);
  });
  return carregando;
}

/** Lê o miolo do token do Google (nome, e-mail, foto). */
function dadosDoToken(jwt) {
  const meio = jwt.split('.')[1];
  const json = decodeURIComponent(atob(meio.replace(/-/g, '+').replace(/_/g, '/'))
    .split('').map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
  const p = JSON.parse(json);
  return { id: p.sub, nome: p.name || '', email: p.email || '', foto: p.picture || '', token: jwt };
}

/**
 * Desenha o botão oficial do Google dentro de `caixa`.
 * Chama `aoEntrar(dados)` quando o aluno entra.
 */
export async function botaoGoogle(caixa, aoEntrar, aoFalhar) {
  if (!googleConfigurado()) return false;
  try {
    await carregarGoogle();
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        try {
          const d = dadosDoToken(resp.credential);
          entrarComo({ provedor: 'google', ...d });
          // Com servidor, ele confere o token do Google e devolve a sessão + o plano.
          if (temServidor()) await entrarNoServidor(resp.credential);
          aoEntrar?.(d);
        } catch (e) { aoFalhar?.(e); }
      },
    });
    window.google.accounts.id.renderButton(caixa, {
      theme: 'filled_black', size: 'large', shape: 'pill',
      text: 'continue_with', locale: 'pt-BR', width: 280,
    });
    return true;
  } catch (e) { aoFalhar?.(e); return false; }
}

export function sairDoGoogle() {
  try { window.google?.accounts?.id?.disableAutoSelect(); } catch { /* ok */ }
}
