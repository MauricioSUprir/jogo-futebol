/* ===== views/amigos.js — amigos, pedidos, chat com emojis e o foguinho =====
   #/amigos          → lista (Amigos · Pedidos · Adicionar)
   #/amigos/<id>     → conversa com o amigo
   Só amigos aceitos conversam e duelam. Links e números de telefone saem das
   mensagens (o servidor tira). Bloquear e denunciar ficam no menu da conversa. */
import { h } from '../util.js';
import { st } from '../store.js';
import { titulo, toast, confirmar, inp, modal, fecharModal, segmento, vazio } from '../ui.js';
import { temServidor } from '../api.js';
import * as S from '../social.js';
import { abrirDesafio } from '../duelo-tela.js';

const EMOJIS = ['😀', '😂', '🥹', '😍', '😎', '🤓', '🤔', '😴', '😭', '😡', '🥳', '🤯', '👍', '👎', '👏', '🙏', '💪', '🫡',
  '🔥', '✨', '⭐', '💯', '❤️', '💜', '💙', '🧠', '📚', '📝', '✏️', '🎯', '⏰', '🏆', '⚔️', '🎉', '☕', '🍕', '⚽', '🎮', '🎧', '👀'];

let aba = 'amigos';
let cache = null;          // última lista de amigos

export function render(el, { id } = {}) {
  if (!temServidor()) { el.append(titulo('👥 Amigos'), vazio('Sem servidor', 'Os amigos precisam do servidor do MindTrack.')); return; }
  if (!st().social?.apelido) return criarPerfil(el);
  return id ? conversa(el, id) : lista(el);
}

/* ==================== perfil de amigos (uma vez) ==================== */
function criarPerfil(el) {
  el.append(titulo('👥 Amigos', 'Estude junto: chat, foguinho de estudo e duelos de quiz ao vivo.'));
  const caixa = h('div', { class: 'card amg-perfil' }, h('p', { class: 'muted small' }, 'Carregando…'));
  el.append(caixa);
  S.meuPerfil().then(({ perfil, avatares }) => {
    if (perfil) { S.guardarMeuPerfil(perfil); el.replaceChildren(); lista(el); S.conectar(); return; }
    let avatar = avatares[0];
    const apelido = inp({ placeholder: 'ex.: gui.estuda', autocapitalize: 'none', autocomplete: 'off', maxlength: 20 });
    const nome = inp({ value: st().perfil.nome || st().conta.nome || '', placeholder: 'Seu nome', maxlength: 40 });
    const grade = h('div', { class: 'amg-avatares' }, ...avatares.map((a) => h('button', {
      class: `amg-av${a === avatar ? ' on' : ''}`, type: 'button', 'aria-label': `avatar ${a}`,
      onclick: (e) => { avatar = a; grade.querySelectorAll('.amg-av').forEach((b) => b.classList.toggle('on', b === e.currentTarget)); },
    }, a)));
    const salvar = h('button', {
      class: 'btn btn--p btn--blk mt', onclick: async () => {
        salvar.disabled = true;
        try {
          const { perfil: p } = await S.salvarPerfil({ apelido: apelido.value.trim().toLowerCase(), nome: nome.value.trim(), avatar });
          S.guardarMeuPerfil(p);
          S.contarAtividade(); S.conectar();
          toast(`Pronto, @${p.apelido}! Agora é só chamar seus amigos. 🙌`, 'good');
          el.replaceChildren(); lista(el);
        } catch (e) { toast(e.message, 'bad'); salvar.disabled = false; }
      },
    }, 'Criar meu perfil');
    caixa.replaceChildren(
      h('h2', {}, 'Crie seu perfil de amigos'),
      h('p', { class: 'small muted' }, 'Seus amigos te acham pelo apelido. Só quem você aceitar pode falar com você.'),
      h('label', { class: 'f' }, h('span', {}, 'Apelido (3 a 20 letras, números, ponto ou _)'), apelido),
      h('label', { class: 'f' }, h('span', {}, 'Nome que aparece'), nome),
      h('div', { class: 'f' }, h('span', { class: 'small', style: { fontWeight: 700 } }, 'Escolha seu avatar'), grade),
      salvar);
  }).catch((e) => caixa.replaceChildren(h('p', { class: 'small' }, e.message)));
}

/* ==================== lista ==================== */
function lista(el) {
  const meu = st().social;
  const topo = h('div', { class: 'card amg-eu' },
    h('span', { class: 'amg-avatar amg-avatar--g' }, meu.avatar),
    h('div', { class: 'grow' }, h('b', {}, meu.nome), h('div', { class: 'tiny muted' }, `@${meu.apelido}`)),
    h('span', { class: 'amg-fogo', title: 'Sua sequência de estudo' }, `🔥 ${st().jogo.streak || 0}`));
  const corpo = h('div', { class: 'mt' });
  const segs = h('div', {});
  el.append(titulo('👥 Amigos', 'Chat, foguinho de estudo e duelos de quiz ao vivo.'), topo, segs, corpo);

  const pintar = () => {
    const pedidos = cache?.recebidos?.length || 0;
    segs.replaceChildren(segmento([
      { v: 'amigos', t: `Amigos${cache ? ` (${cache.amigos.length})` : ''}` },
      { v: 'pedidos', t: `Pedidos${pedidos ? ` · ${pedidos}` : ''}` },
      { v: 'adicionar', t: '+ Adicionar' },
    ], aba, (v) => { aba = v; pintar(); }));
    corpo.replaceChildren();
    if (aba === 'adicionar') return abaAdicionar(corpo, recarregar);
    if (!cache) { corpo.append(h('p', { class: 'small muted' }, 'Carregando…')); return; }
    if (aba === 'pedidos') return abaPedidos(corpo, recarregar);
    abaAmigos(corpo);
  };
  const recarregar = () => S.listarAmigos().then((d) => { cache = d; pintar(); }).catch((e) => toast(e.message, 'bad'));

  pintar(); recarregar();
  const parar = [
    S.ouvir('mensagem', recarregar), S.ouvir('amizade', recarregar), S.ouvir('amigo:online', recarregar),
  ];
  const relogio = setInterval(recarregar, 45000);
  return () => { parar.forEach((f) => f()); clearInterval(relogio); };
}

function linhaAmigo(a) {
  const prev = a.ultima ? `${a.ultima.de === a.id ? '' : 'Você: '}${a.ultima.texto}` : `@${a.apelido}`;
  return h('div', { class: `row amg-linha${a.naoLidas ? ' amg-linha--nova' : ''}` },
    h('a', { href: `#/amigos/${a.id}`, class: 'amg-linha__link' },
      h('span', { class: `amg-avatar${a.online ? ' amg-avatar--on' : ''}` }, a.avatar),
      h('div', { class: 'grow', style: { minWidth: 0 } },
        h('div', { class: 'ttl' }, a.nome,
          a.sequencia ? h('span', { class: 'amg-fogo amg-fogo--p', title: 'Sequência de estudo' }, `🔥${a.sequencia}`) : null,
          a.fogoJuntos ? h('span', { class: 'chip amg-juntos', title: 'Dias seguidos em que vocês dois estudaram' }, `🔥 ${a.fogoJuntos} juntos`) : null),
        h('div', { class: 'sub amg-prev' }, prev)),
      a.naoLidas ? h('span', { class: 'amg-badge' }, String(a.naoLidas)) : null),
    h('button', {
      class: 'btn btn--sm', title: a.online ? 'Desafiar para um duelo de quiz' : 'Seu amigo precisa estar com o app aberto',
      disabled: !a.online, onclick: () => abrirDesafio(a),
    }, '⚔️ Duelo'));
}

function abaAmigos(corpo) {
  if (!cache.amigos.length) {
    corpo.append(vazio('Nenhum amigo ainda', 'Toque em "+ Adicionar" e procure pelo apelido ou nome dos seus colegas.'));
    return;
  }
  const online = cache.amigos.filter((a) => a.online).length;
  corpo.append(h('p', { class: 'tiny muted' }, `${online} online agora · o ⚔️ Duelo funciona com quem está online`),
    h('div', { class: 'list' }, ...cache.amigos.map(linhaAmigo)));
}

function abaPedidos(corpo, recarregar) {
  const { recebidos, enviados } = cache;
  if (!recebidos.length && !enviados.length) { corpo.append(vazio('Nenhum pedido', 'Quando alguém te adicionar, aparece aqui.')); return; }
  if (recebidos.length) {
    corpo.append(h('h3', { class: 'amg-h3' }, 'Querem ser seus amigos'), h('div', { class: 'list' }, ...recebidos.map((p) => h('div', { class: 'row' },
      h('span', { class: 'amg-avatar' }, p.avatar),
      h('div', { class: 'grow' }, h('div', { class: 'ttl' }, p.nome), h('div', { class: 'sub' }, `@${p.apelido}`)),
      h('button', { class: 'btn btn--sm btn--p', onclick: async () => { await S.responderPedido(p.id, true).catch((e) => toast(e.message, 'bad')); toast(`Agora você e @${p.apelido} são amigos! 🎉`, 'good'); recarregar(); } }, 'Aceitar'),
      h('button', { class: 'btn btn--sm', onclick: async () => { await S.responderPedido(p.id, false).catch(() => {}); recarregar(); } }, 'Recusar')))));
  }
  if (enviados.length) {
    corpo.append(h('h3', { class: 'amg-h3 mt2' }, 'Esperando aceitarem'), h('div', { class: 'list' }, ...enviados.map((p) => h('div', { class: 'row row--flat' },
      h('span', { class: 'amg-avatar' }, p.avatar),
      h('div', { class: 'grow' }, h('div', { class: 'ttl' }, p.nome), h('div', { class: 'sub' }, `@${p.apelido} · pedido enviado`))))));
  }
}

function abaAdicionar(corpo, recarregar) {
  const busca = inp({ placeholder: 'Procure pelo apelido ou nome', autocapitalize: 'none', autocomplete: 'off', 'aria-label': 'Procurar amigos' });
  const res = h('div', { class: 'list mt' });
  let timer = null;
  const procurar = () => {
    clearTimeout(timer);
    const q = busca.value.trim();
    if (q.length < 2) { res.replaceChildren(h('p', { class: 'tiny muted' }, 'Digite pelo menos 2 letras.')); return; }
    timer = setTimeout(async () => {
      try {
        const { resultados } = await S.buscar(q);
        if (!resultados.length) { res.replaceChildren(h('p', { class: 'small muted' }, 'Ninguém com esse nome. Peça o apelido ao seu colega!')); return; }
        res.replaceChildren(...resultados.map((p) => {
          const rotulo = { nenhuma: '+ Adicionar', enviado: 'Pedido enviado', recebido: 'Aceitar', amigos: 'Amigos ✓' }[p.relacao];
          const b = h('button', {
            class: `btn btn--sm ${p.relacao === 'nenhuma' || p.relacao === 'recebido' ? 'btn--p' : ''}`,
            disabled: ['enviado', 'amigos'].includes(p.relacao),
            onclick: async () => {
              b.disabled = true;
              try {
                const r = await S.pedirAmizade(p.apelido);
                b.textContent = r.status === 'amigos' ? 'Amigos ✓' : 'Pedido enviado';
                toast(r.status === 'amigos' ? `Agora vocês são amigos! 🎉` : `Pedido enviado para @${p.apelido}`, 'good');
                recarregar();
              } catch (e) { toast(e.message, 'bad'); b.disabled = false; }
            },
          }, rotulo);
          return h('div', { class: 'row' }, h('span', { class: `amg-avatar${p.online ? ' amg-avatar--on' : ''}` }, p.avatar),
            h('div', { class: 'grow' }, h('div', { class: 'ttl' }, p.nome), h('div', { class: 'sub' }, `@${p.apelido}`)), b);
        }));
      } catch (e) { res.replaceChildren(h('p', { class: 'small' }, e.message)); }
    }, 300);
  };
  busca.addEventListener('input', procurar);
  corpo.append(h('div', { class: 'card' },
    busca, res,
    h('p', { class: 'tiny muted mt' }, `🔒 Seu apelido é @${st().social.apelido}. Só quem você aceitar pode conversar e duelar com você.`)));
  setTimeout(() => busca.focus(), 50);
}

/* ==================== conversa ==================== */
function conversa(el, amigoId) {
  const msgs = h('div', { class: 'amg-msgs', role: 'log', 'aria-live': 'polite' });
  const cab = h('div', { class: 'amg-cab' });
  const campoTxt = h('textarea', { class: 'inp amg-txt', rows: 1, placeholder: 'Mensagem', maxlength: 500, 'aria-label': 'Mensagem' });
  const painel = h('div', { class: 'amg-emojis', hidden: true }, ...EMOJIS.map((e) => h('button', {
    type: 'button', onclick: () => { campoTxt.value += e; campoTxt.focus(); },
  }, e)));
  let amigo = null;
  let lidas = false;

  const bolha = (m) => h('div', { class: `msg ${m.de === amigoId ? 'ai' : 'me'}`, 'data-id': m.id },
    m.texto, h('span', { class: 'amg-hora' }, new Date(m.em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })));
  const rolar = () => { msgs.scrollTop = msgs.scrollHeight; };

  const enviar = async () => {
    const t = campoTxt.value.trim();
    if (!t) return;
    campoTxt.value = ''; painel.hidden = true;
    try { await S.mandarMensagem(amigoId, t); } catch (e) { toast(e.message, 'bad'); campoTxt.value = t; }
  };
  campoTxt.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(); } });

  const menu = () => modal(`@${amigo?.apelido || ''}`, h('div', { class: 'list' },
    amigo?.online ? h('button', { class: 'btn btn--blk btn--p', onclick: () => { fecharModal(); abrirDesafio(amigo); } }, '⚔️ Desafiar para um duelo') : null,
    h('button', { class: 'btn btn--blk', onclick: () => { fecharModal(); confirmar('Desfazer a amizade?', 'Vocês não vão mais conversar nem duelar.', async () => { await S.desfazerAmizade(amigoId); location.hash = '#/amigos'; }); } }, 'Desfazer amizade'),
    h('button', { class: 'btn btn--blk btn--d', onclick: () => { fecharModal(); confirmar('Bloquear?', 'A pessoa não vai mais te achar nem falar com você.', async () => { await S.bloquear(amigoId); toast('Bloqueado.'); location.hash = '#/amigos'; }); } }, '🚫 Bloquear'),
    h('button', { class: 'btn btn--blk btn--d', onclick: () => {
      fecharModal();
      const motivo = h('textarea', { class: 'inp', placeholder: 'O que aconteceu? (opcional)', style: { minHeight: '80px' } });
      modal('Denunciar', h('div', {}, h('p', { class: 'small muted' }, 'A denúncia fica guardada para a equipe do MindTrack ver. Se for algo grave, conte também para um adulto de confiança.'), motivo,
        h('button', { class: 'btn btn--p btn--blk mt', onclick: async () => { await S.denunciar(amigoId, motivo.value).catch(() => {}); fecharModal(); toast('Denúncia enviada. Obrigado por avisar.', 'good'); } }, 'Enviar denúncia')));
    } }, '🚩 Denunciar')));

  el.append(h('div', { class: 'amg-chat' },
    cab, msgs,
    painel,
    h('div', { class: 'amg-enviar' },
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Emojis', onclick: () => { painel.hidden = !painel.hidden; } }, '😀'),
      campoTxt,
      h('button', { class: 'btn btn--p', onclick: enviar }, 'Enviar'))));

  const pintarCab = () => cab.replaceChildren(
    h('a', { class: 'icon-btn', href: '#/amigos', 'aria-label': 'Voltar' }, '‹'),
    h('span', { class: `amg-avatar${amigo?.online ? ' amg-avatar--on' : ''}` }, amigo?.avatar || '🙂'),
    h('div', { class: 'grow' },
      h('b', {}, amigo?.nome || 'Amigo'),
      h('div', { class: 'tiny muted' }, amigo ? `${amigo.online ? 'online' : 'offline'} · 🔥 ${amigo.sequencia} · 🔥 ${amigo.fogoJuntos} juntos` : '')),
    amigo?.online ? h('button', { class: 'btn btn--sm', onclick: () => abrirDesafio(amigo) }, '⚔️') : null,
    h('button', { class: 'icon-btn', 'aria-label': 'Mais opções', onclick: menu }, '⋯'));

  const marcar = () => { S.marcarLidas(amigoId).catch(() => {}); };
  S.listarAmigos().then((d) => { amigo = d.amigos.find((a) => a.id === amigoId) || null; if (!amigo) { toast('Vocês não são amigos.', 'bad'); location.hash = '#/amigos'; } pintarCab(); }).catch(() => {});
  S.mensagens(amigoId).then(({ mensagens }) => {
    msgs.replaceChildren(...(mensagens.length ? mensagens.map(bolha) : [h('p', { class: 'tiny muted center' }, 'Diga oi! 👋')]));
    rolar(); marcar(); lidas = true;
  }).catch((e) => msgs.replaceChildren(h('p', { class: 'small' }, e.message)));
  pintarCab();

  const parar = [
    S.ouvir('mensagem', (m) => {
      if (m.de !== amigoId && m.para !== amigoId) return;
      if (msgs.querySelector(`[data-id="${m.id}"]`)) return;
      msgs.querySelector('.center')?.remove();
      msgs.append(bolha(m)); rolar();
      if (m.de === amigoId && lidas) marcar();
    }),
    S.ouvir('amigo:online', (d) => { if (d.id === amigoId && amigo) { amigo.online = d.online; pintarCab(); } }),
  ];
  setTimeout(() => campoTxt.focus(), 50);
  return () => parar.forEach((f) => f());
}

