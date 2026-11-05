/* ===== duelo-tela.js — o duelo de quiz em tempo real, em tela cheia =====
   Quem manda é o servidor: esta tela só mostra o que chega pelo tempo real
   (convite → contagem → pergunta → quem respondeu → revelar → … → fim) e manda
   a resposta. Funciona de qualquer tela do app: o convite aparece onde o aluno estiver. */
import { h } from './util.js';
import { st } from './store.js';
import { toast, modal, fecharModal, liberado } from './ui.js';
import * as S from './social.js';

let tela = null;        // o overlay aberto
let estado = null;      // { id, eu, outro, jogadores, total, i, placar }
let relogio = null;

const meuId = () => st().conta.id;
const fecharTela = () => { clearInterval(relogio); tela?.remove(); tela = null; estado = null; document.body.style.overflow = ''; };

function abrirTela() {
  if (tela) return tela;
  tela = h('div', { class: 'duelo', role: 'dialog', 'aria-label': 'Duelo de quiz' });
  document.body.append(tela);
  document.body.style.overflow = 'hidden';
  return tela;
}

function placar() {
  const { jogadores, placar: p } = estado;
  const outro = Object.keys(jogadores).find((x) => x !== meuId());
  const lado = (id, quem) => h('div', { class: `duelo__lado duelo__lado--${quem}` },
    h('span', { class: 'duelo__av' }, jogadores[id]?.avatar || '🙂'),
    h('div', {}, h('b', {}, quem === 'eu' ? 'Você' : `@${jogadores[id]?.apelido || 'amigo'}`), h('div', { class: 'duelo__pts', 'data-id': id }, String(p?.[id] || 0))),
    h('span', { class: 'duelo__ok', 'data-ok': id, hidden: true }, '✓'));
  return h('div', { class: 'duelo__placar' }, lado(meuId(), 'eu'), h('span', { class: 'duelo__vs' }, 'VS'), lado(outro, 'ele'));
}

const sair = () => {
  if (!estado) return fecharTela();
  if (confirm('Sair do duelo? Seu amigo ganha.')) { S.sairDuelo(estado.id).catch(() => {}); fecharTela(); }
};

/* ---------- eventos do servidor ---------- */
function ligar() {
  S.ouvir('duelo:convite', (d) => {
    if (d.de === meuId()) return;
    const quem = d.jogadores[d.de];
    modal('⚔️ Desafio!', h('div', { class: 'center' },
      h('div', { style: { fontSize: '54px' } }, quem?.avatar || '🙂'),
      h('p', {}, h('b', {}, `@${quem?.apelido}`), ' te chamou para um duelo de quiz', d.tema ? ` sobre ${d.tema}` : d.materia ? ` de ${d.materia}` : '', '!'),
      h('p', { class: 'tiny muted' }, '5 perguntas · 15 segundos cada · ganha quem acertar mais e mais rápido'),
      h('div', { class: 'flexb', style: { justifyContent: 'center' } },
        h('button', { class: 'btn', onclick: () => { S.recusarDuelo(d.id).catch(() => {}); fecharModal(); } }, 'Agora não'),
        h('button', { class: 'btn btn--p', onclick: async () => { fecharModal(); try { await S.aceitarDuelo(d.id); } catch (e) { toast(e.message, 'bad'); } } }, 'Aceitar ⚔️'))));
  });

  S.ouvir('duelo:preparando', (d) => {
    estado = { id: d.id, jogadores: d.jogadores, total: d.total, placar: d.placar };
    fecharModal();
    abrirTela().replaceChildren(h('div', { class: 'duelo__centro' }, h('div', { class: 'duelo__giro' }, '⚔️'), h('p', {}, d.tema ? 'A IA está criando as perguntas…' : 'Preparando as perguntas…')));
  });

  S.ouvir('duelo:inicio', (d) => {
    estado = { id: d.id, jogadores: d.jogadores, total: d.total, placar: d.placar };
    fecharModal();
    const t = abrirTela();
    let n = Math.max(1, Math.round(d.comecaEm / 1000));
    const num = h('div', { class: 'duelo__conta' }, String(n));
    t.replaceChildren(placar(), h('div', { class: 'duelo__centro' }, h('p', { class: 'muted' }, d.tema || d.materia || 'Conhecimentos gerais'), num, h('p', {}, 'Prepare-se!')));
    clearInterval(relogio);
    relogio = setInterval(() => { n--; if (n > 0) num.textContent = String(n); else { num.textContent = 'Já!'; clearInterval(relogio); } }, 1000);
  });

  S.ouvir('duelo:pergunta', (d) => {
    if (!estado || d.id !== estado.id) return;
    estado.i = d.i;
    const t = abrirTela();
    const barra = h('i', {});
    const opcoes = d.opcoes.map((o, k) => h('button', {
      class: 'duelo__op', 'data-k': k, onclick: async (e) => {
        if (tela.querySelector('.duelo__op.escolhida')) return;
        e.currentTarget.classList.add('escolhida');
        tela.querySelectorAll('.duelo__op').forEach((b) => { b.disabled = true; });
        try { await S.responderDuelo(d.id, d.i, k); } catch (err) { toast(err.message, 'bad'); }
      },
    }, h('span', { class: 'duelo__letra' }, 'ABCD'[k]), o));
    t.replaceChildren(placar(),
      h('div', { class: 'duelo__perg' },
        h('div', { class: 'duelo__info' }, h('span', {}, `Pergunta ${d.i + 1} de ${d.total}`), h('span', {}, d.materia || '')),
        h('div', { class: 'duelo__tempo' }, barra),
        h('h2', {}, d.enunciado),
        h('div', { class: 'duelo__ops' }, ...opcoes)),
      h('button', { class: 'duelo__sair', onclick: sair }, 'Sair'));
    const fim = Date.now() + d.tempo;
    clearInterval(relogio);
    relogio = setInterval(() => {
      const resta = Math.max(0, fim - Date.now());
      barra.style.width = `${(resta / d.tempo) * 100}%`;
      if (!resta) clearInterval(relogio);
    }, 100);
  });

  S.ouvir('duelo:respondeu', (d) => {
    if (!estado || d.id !== estado.id) return;
    const ok = tela?.querySelector(`[data-ok="${d.quem}"]`);
    if (ok) ok.hidden = false;
  });

  S.ouvir('duelo:revelar', (d) => {
    if (!estado || d.id !== estado.id || !tela) return;
    clearInterval(relogio);
    estado.placar = d.placar;
    tela.querySelectorAll('.duelo__op').forEach((b) => {
      const k = Number(b.dataset.k);
      b.disabled = true;
      if (k === d.correta) b.classList.add('certa');
      else if (b.classList.contains('escolhida')) b.classList.add('errada');
      const outro = Object.keys(d.respostas || {}).find((x) => x !== meuId());
      if (outro && d.respostas[outro]?.opcao === k) b.append(h('span', { class: 'duelo__marca' }, estado.jogadores[outro]?.avatar || '👤'));
    });
    for (const [id, pts] of Object.entries(d.placar)) {
      const el = tela.querySelector(`.duelo__pts[data-id="${id}"]`);
      if (el) el.textContent = String(pts);
    }
    const minha = d.respostas?.[meuId()];
    tela.querySelectorAll('.duelo__fb').forEach((e) => e.remove());
    tela.querySelector('.duelo__perg')?.append(h('p', { class: `duelo__fb ${minha?.certo ? 'ok' : 'nao'}` },
      minha ? (minha.certo ? `Certo! +${minha.pontos}` : 'Errou!') : 'Tempo esgotado!', d.explicacao ? h('small', {}, d.explicacao) : null));
  });

  S.ouvir('duelo:fim', (d) => {
    if (!estado || d.id !== estado.id) return;
    clearInterval(relogio);
    const eu = meuId();
    const outro = Object.keys(estado.jogadores).find((x) => x !== eu);
    const ganhei = d.vencedor === eu, empate = !d.vencedor;
    const t = abrirTela();
    t.replaceChildren(h('div', { class: 'duelo__centro duelo__fim' },
      h('div', { class: 'duelo__trofeu' }, empate ? '🤝' : ganhei ? '🏆' : '😅'),
      h('h2', {}, empate ? 'Empate!' : ganhei ? 'Você venceu!' : `@${estado.jogadores[outro]?.apelido} venceu!`),
      d.desistiu ? h('p', { class: 'muted' }, d.desistiu === eu ? 'Você saiu do duelo.' : 'Seu amigo saiu do duelo.') : null,
      h('div', { class: 'duelo__final' },
        h('div', {}, h('b', {}, String(d.placar[eu] || 0)), h('span', {}, `Você · ${d.acertos[eu] || 0}/${d.total} certas`)),
        h('div', {}, h('b', {}, String(d.placar[outro] || 0)), h('span', {}, `@${estado.jogadores[outro]?.apelido} · ${d.acertos[outro] || 0}/${d.total}`))),
      h('div', { class: 'flexb', style: { justifyContent: 'center' } },
        h('button', { class: 'btn', onclick: fecharTela }, 'Fechar'),
        h('button', { class: 'btn btn--p', onclick: () => { const amigo = { id: outro, apelido: estado.jogadores[outro]?.apelido, avatar: estado.jogadores[outro]?.avatar, online: true }; fecharTela(); abrirDesafio(amigo); } }, 'Revanche ⚔️'))));
    if (ganhei) S.contarAtividade();
  });

  S.ouvir('duelo:cancelado', (d) => {
    if (estado && d.id !== estado.id) return;
    fecharModal(); fecharTela();
    toast(d.motivo || 'Duelo cancelado.');
  });
}

/* ---------- desafiar um amigo ---------- */
export async function abrirDesafio(amigo) {
  let materias = [];
  try { materias = (await S.materiasDuelo()).materias; } catch { /* segue com a lista vazia */ }
  const porta = liberado('ia_duelo');
  const tema = h('input', { class: 'inp', placeholder: 'Ex.: Revolução Francesa, frações, verbo to be…', maxlength: 80, disabled: !porta.ok });
  let materia = '';
  const chips = h('div', { class: 'chips' }, ...['', ...materias].map((m) => h('button', {
    class: `chip ${m === materia ? 'chip--on' : ''}`, type: 'button', style: { cursor: 'pointer' },
    onclick: (e) => { materia = m; chips.querySelectorAll('.chip').forEach((c) => c.classList.toggle('chip--on', c === e.currentTarget)); },
  }, m || '🎲 Misturado')));
  modal(`⚔️ Desafiar @${amigo.apelido}`, h('div', {},
    h('p', { class: 'small muted', style: { marginTop: 0 } }, '5 perguntas, 15 segundos cada. Ganha quem acertar mais — e mais rápido.'),
    h('b', { class: 'small' }, 'Matéria'), chips,
    h('div', { class: 'mt' }, h('b', { class: 'small' }, 'Ou um tema livre (a IA cria as perguntas) '), porta.ok ? null : h('span', { class: 'pro-tag' }, 'PRO')),
    tema,
    h('button', {
      class: 'btn btn--p btn--blk mt', onclick: async (e) => {
        e.currentTarget.disabled = true;
        try {
          const { duelo } = await S.desafiar(amigo.id, { materia, tema: porta.ok ? tema.value.trim() : '' });
          fecharModal();
          estado = { id: duelo.id, jogadores: {}, total: 5, placar: {} };
          abrirTela().replaceChildren(h('div', { class: 'duelo__centro' },
            h('div', { class: 'duelo__giro' }, amigo.avatar || '⚔️'),
            h('p', {}, `Esperando @${amigo.apelido} aceitar…`),
            h('button', { class: 'btn', onclick: () => { S.recusarDuelo(duelo.id).catch(() => {}); fecharTela(); } }, 'Cancelar')));
        } catch (err) { toast(err.message, 'bad'); e.currentTarget.disabled = false; }
      },
    }, 'Mandar desafio'),
    porta.ok ? null : h('p', { class: 'tiny muted mt' }, 'Tema livre é do MindTrack Pro. As matérias acima são grátis.')));
}

let ligado = false;
/** Chamado uma vez no boot do app: liga o tempo real e os avisos do duelo. */
export function iniciarSocial() {
  if (ligado) return;
  ligado = true;
  ligar();
  // avisos de amizade e mensagem fora da conversa aberta
  S.ouvir('mensagem', (m) => {
    if (m.de === meuId()) return;
    if (location.hash === `#/amigos/${m.de}`) return;
    toast(`💬 ${m.texto.slice(0, 60)}`, '');
  });
  S.ouvir('amizade', (d) => {
    if (d.tipo === 'pedido') toast(`👋 @${d.de.apelido} quer ser seu amigo`, 'good');
    if (d.tipo === 'aceita') toast(`🎉 @${d.de.apelido} aceitou sua amizade`, 'good');
  });
  S.conectar();
  S.contarAtividade();
}
