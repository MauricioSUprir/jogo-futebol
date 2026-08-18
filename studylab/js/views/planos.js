/* ===== views/planos.js — assinatura do StudyLab (Pro e Plus) ===== */
import { h, iso, fmtData, daysBetween, parseISO, today } from '../util.js';
import { st, ehPro, ehPlus, nivelPlano, ativarPro, cancelarPro } from '../store.js';
import {
  titulo, cartao, vazio, modal, fecharModal, toast, campo, inp, confirmar,
  RECURSOS_FREE, RECURSOS_PRO, RECURSOS_PLUS, selo,
} from '../ui.js';
import { PLANOS, LIMITES_PLANO, precoBR, CODIGOS, SERVIDOR } from '../produto.js';
import { temServidor, ativarCodigoNoServidor, cancelarNoServidor, buscarEu, garantirSessao } from '../api.js';
import { abrirPagamento } from './pagamento.js';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
  // ao voltar do Mercado Pago o plano pode ter mudado — confere com o servidor
  if (temServidor()) garantirSessao().then(() => buscarEu()).then(() => pintar()).catch(() => {});
}

function montar(el, pintar) {
  const s = st();

  el.append(titulo('✨ StudyLab Pro e Plus',
    ehPro() ? 'Sua assinatura está ativa.' : 'Libere o Study AI — o tutor que conhece os seus estudos.'));

  if (ehPro()) { assinaturaAtiva(el, pintar); return; }

  /* ---------- o que os planos entregam ---------- */
  el.append(h('div', { class: 'hero mb' },
    h('div', { class: 'flexb mb' }, h('span', { style: { fontSize: '26px' } }, '🤖'),
      h('h1', { style: { fontSize: '20px' } }, 'O Study AI é dos planos pagos'), selo()),
    h('p', { style: { margin: 0 } },
      'Ele não é um chat qualquer: conhece suas matérias, suas provas, seus erros, seu calendário e o que você '
      + 'escreveu na Minha Escola. Pergunte "o que eu estudo agora?" e ele responde com base no seu desempenho de verdade.')));

  /* ---------- os dois níveis ---------- */
  el.append(h('div', { class: 'grid g2' },
    cartaoNivel('pro', pintar),
    cartaoNivel('plus', pintar)));

  /* ---------- comparação rápida ---------- */
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '⚖️ Grátis, Pro ou Plus?'),
    h('div', { class: 'grid g3 mt' },
      h('div', {},
        h('b', { class: 'small' }, 'Sempre grátis'),
        lista(RECURSOS_FREE.map((r) => r.nome), true)),
      h('div', {},
        h('div', { class: 'flexb' }, h('b', { class: 'small' }, 'Pro'), selo('pro')),
        lista([
          `${LIMITES_PLANO.pro.dia} perguntas por dia ao Study AI`,
          `${LIMITES_PLANO.pro.fotosDia} fotos por dia (${LIMITES_PLANO.pro.fotosPergunta} por pergunta)`,
          ...RECURSOS_PRO.map((r) => r.nome),
        ])),
      h('div', {},
        h('div', { class: 'flexb' }, h('b', { class: 'small' }, 'Plus'), selo('plus')),
        lista([
          'Tudo do Pro, e mais:',
          `${LIMITES_PLANO.plus.dia} perguntas por dia (${LIMITES_PLANO.plus.mes}/mês)`,
          `${LIMITES_PLANO.plus.fotosDia} fotos por dia (${LIMITES_PLANO.plus.fotosPergunta} por pergunta)`,
          ...RECURSOS_PLUS.map((r) => r.nome),
        ]))))));

  el.append(h('p', { class: 'tiny muted center mt' },
    'Cancele quando quiser. Sem multa, sem fidelidade. O plano grátis continua completo — só sem o Study AI. ',
    h('a', { href: '#/termos' }, 'Termos'), ' · ',
    h('a', { href: '#/termos?aba=privacidade' }, 'Privacidade')));

  cartaoCodigo(el, pintar);

  if (!temServidor()) {
    el.append(h('div', { class: 'mt2' }, cartao(
      h('b', { class: 'small' }, '⚠️ Aviso para o dono do app'),
      h('p', { class: 'small', style: { marginBottom: 0 } },
        'Este aparelho ainda não está ligado ao servidor do StudyLab, então o pagamento online não aparece e '
        + 'o plano só é liberado por código — conferido aqui mesmo, o que serve para testes, não para escala. '
        + 'Publique o studylab-server e informe o endereço em Configurações → Área do criador.'))));
  }
}

const lista = (itens, muted = false) => h('ul', {
  class: `small ${muted ? 'muted' : ''}`,
  style: { paddingLeft: '18px', margin: '6px 0 0', lineHeight: 1.7 },
}, ...itens.map((t) => h('li', {}, t)));

/** Um cartão por nível, com as opções de período dentro dele. */
function cartaoNivel(nivel, pintar) {
  const opcoes = PLANOS.filter((p) => p.nivel === nivel);
  let escolhido = opcoes.find((p) => p.periodo === '/mês') || opcoes[0];
  const L = LIMITES_PLANO[nivel];
  const ehPlusCard = nivel === 'plus';

  const preco = h('div', { style: { margin: '8px 0 2px' } });
  const detalhe = h('p', { class: 'tiny muted center', style: { minHeight: '30px' } });
  const economia = h('div', { class: 'center', style: { minHeight: '22px' } });
  const pintarPreco = () => {
    preco.replaceChildren(
      h('b', { style: { fontSize: '30px', letterSpacing: '-1px' } }, precoBR(escolhido.preco)),
      h('span', { class: 'muted small' }, escolhido.periodo));
    detalhe.textContent = escolhido.detalhe;
    economia.replaceChildren(escolhido.economia ? h('span', { class: 'chip ok' }, escolhido.economia) : '');
  };

  const pills = h('div', { class: 'chips', style: { justifyContent: 'center' } },
    ...opcoes.map((p) => {
      const b = h('button', {
        class: `chip ${p.id === escolhido.id ? 'chip--on' : ''}`, style: { cursor: 'pointer' },
        onclick: () => {
          escolhido = p;
          for (const irmao of pills.children) irmao.classList.toggle('chip--on', irmao === b);
          pintarPreco();
        },
      }, p.periodo.replace('/', ''));
      return b;
    }));

  const beneficios = ehPlusCard
    ? ['Tudo do Pro, e mais:',
      `${L.dia} perguntas por dia (${L.mes}/mês)`,
      `${L.fotosDia} fotos por dia — ${L.fotosPergunta} por pergunta`,
      '✍️ Correção de redação com nota',
      '🗓️ Plano de estudos da semana pela IA',
      '📊 Análise dos seus simulados']
    : ['Study AI completo, com os seus dados',
      `${L.dia} perguntas por dia (${L.mes}/mês)`,
      `${L.fotosDia} fotos por dia — ${L.fotosPergunta} por pergunta`,
      '📗 Me explica · professor socrático',
      '🎯 Questões, simulados e flashcards por IA',
      '📚 Resumos, mapas mentais, PDF e foto'];

  pintarPreco();
  const c = cartao(
    h('div', { class: 'center' },
      h('div', { class: 'flexb', style: { justifyContent: 'center' } },
        h('b', { style: { fontSize: '16px' } }, ehPlusCard ? 'StudyLab Plus' : 'StudyLab Pro'), selo(nivel)),
      h('div', { class: 'tiny muted' }, ehPlusCard ? 'Para quem usa a IA todo dia' : 'O mais escolhido'),
      preco, economia),
    pills,
    lista(beneficios),
    detalhe,
    h('button', {
      class: `btn btn--blk mt ${ehPlusCard ? '' : 'btn--p'}`,
      style: ehPlusCard ? { background: 'linear-gradient(135deg,#7c5cff,#22d3ee)', color: '#fff', border: 'none' } : {},
      onclick: () => assinar(escolhido, pintar),
    }, `Assinar o ${ehPlusCard ? 'Plus' : 'Pro'}`));
  c.style.position = 'relative';
  if (!ehPlusCard) c.style.borderColor = '#7c5cff88';
  return c;
}

function cartaoCodigo(el, pintar) {
  const codigo = inp({ placeholder: 'Tem um código? Digite aqui', style: { textTransform: 'uppercase' } });
  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', {}, '🎟️ Código de acesso'),
    h('p', { class: 'tiny muted' }, 'Recebeu um código de teste, cortesia ou de uma compra combinada? Use aqui.'),
    h('div', { class: 'flexb' }, codigo,
      h('button', {
        class: 'btn btn--p', onclick: async (e) => {
          const c = codigo.value.trim().toUpperCase();
          if (!c) return toast('Digite o código', 'bad');
          if (temServidor()) {
            e.target.disabled = true; e.target.textContent = 'Conferindo…';
            try {
              await garantirSessao();
              const d = await ativarCodigoNoServidor(c);
              toast(`${d.plano === 'plus' ? 'Plus' : 'Pro'} liberado até ${fmtData(d.proAte)}! 🎉`, 'good');
              pintar(); return;
            } catch (err) { toast(err.message, 'bad'); }
            finally { e.target.disabled = false; e.target.textContent = 'Ativar'; }
            return;
          }
          const info = CODIGOS[c];
          if (!info) return toast('Código inválido', 'bad');
          const dias = typeof info === 'number' ? info : info.dias;
          const nivel = typeof info === 'number' ? 'pro' : (info.nivel || 'pro');
          ativarPro({ planoId: 'codigo', dias, codigo: c, nivel });
          toast(`${nivel === 'plus' ? 'Plus' : 'Pro'} liberado por ${dias} dias! 🎉`, 'good');
          pintar();
        },
      }, 'Ativar')))));
}

function assinar(p, pintar) {
  // Com servidor: vai direto para a tela de pagamento (Pix aqui mesmo, ou cartão).
  if (temServidor()) { abrirPagamento(p, pintar); return; }

  // Sem servidor ainda: só dá para liberar por código, e o app diz isso na cara.
  modal(`Assinar o plano ${p.nome}`, h('div', {},
    h('div', { class: 'center mb' },
      h('b', { style: { fontSize: '26px' } }, precoBR(p.preco)),
      h('span', { class: 'muted' }, p.periodo),
      h('p', { class: 'tiny muted', style: { margin: '6px 0 0' } }, p.detalhe)),
    h('p', { class: 'small' },
      'O pagamento ainda não está ligado neste aparelho — falta informar o endereço do servidor '
      + 'em Configurações → Área do criador. Enquanto isso, dá para liberar por código de acesso.'),
    h('div', { class: 'flexb mt2' },
      h('button', { class: 'btn sp', onclick: fecharModal }, 'Fechar'),
      h('button', {
        class: 'btn btn--p', onclick: () => {
          ativarPro({ planoId: p.id, dias: p.dias, codigo: null, nivel: p.nivel });
          fecharModal(); toast(`${p.nome} ativado para teste`, 'good'); pintar();
        },
      }, '🧪 Ativar em modo teste'))));
}

function assinaturaAtiva(el, pintar) {
  const s = st();
  const nivel = nivelPlano();
  const plano = PLANOS.find((p) => p.id === s.conta.planoId);
  const dias = s.conta.proAte ? daysBetween(today(), parseISO(s.conta.proAte)) : null;
  const L = LIMITES_PLANO[nivel] || LIMITES_PLANO.pro;

  el.append(h('div', { class: 'hero mb' },
    h('div', { class: 'flexb' },
      h('span', { style: { fontSize: '30px' } }, '✨'),
      h('div', { class: 'grow' },
        h('h1', { style: { fontSize: '20px' } }, `StudyLab ${nivel === 'plus' ? 'Plus' : 'Pro'} ${plano ? '· ' + plano.nome : ''}`),
        h('p', { style: { margin: '4px 0 0' } },
          dias === null ? 'Sem data de término.'
            : dias >= 0 ? `Ativo até ${fmtData(s.conta.proAte)} — faltam ${dias} dia(s).`
              : 'Sua assinatura venceu.')),
      selo(nivel))));

  el.append(cartao(
    h('b', {}, '🤖 O que você desbloqueou'),
    h('div', { class: 'list mt' },
      linhaOk(`${L.dia} perguntas por dia ao Study AI (${L.mes}/mês)`),
      linhaOk(`${L.fotosDia} fotos por dia — ${L.fotosPergunta} por pergunta`),
      ...RECURSOS_PRO.map((r) => linhaOk(r.nome)),
      ...(nivel === 'plus' ? RECURSOS_PLUS.map((r) => linhaOk(r.nome)) : [])),
    h('a', { class: 'btn btn--p btn--blk mt', href: '#/ai' }, '🤖 Abrir o Study AI')));

  /* quem é Pro vê o convite para subir ao Plus */
  if (nivel === 'pro') {
    const plus = PLANOS.find((p) => p.id === 'plus_mensal');
    el.append(h('div', { class: 'mt2' }, cartao(
      h('div', { class: 'flexb' }, h('b', {}, '⬆️ Subir para o Plus'), selo('plus')),
      lista([
        `${LIMITES_PLANO.plus.dia} perguntas por dia (contra ${LIMITES_PLANO.pro.dia} do Pro)`,
        `${LIMITES_PLANO.plus.fotosDia} fotos por dia (contra ${LIMITES_PLANO.pro.fotosDia})`,
        ...RECURSOS_PLUS.map((r) => r.nome),
      ]),
      h('button', {
        class: 'btn btn--blk mt',
        style: { background: 'linear-gradient(135deg,#7c5cff,#22d3ee)', color: '#fff', border: 'none' },
        onclick: () => assinar(plus, pintar),
      }, `Assinar o Plus — ${precoBR(plus.preco)}/mês`))));
  }

  cartaoCodigo(el, pintar);

  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', { class: 'small' }, 'Gerenciar assinatura'),
    h('p', { class: 'tiny muted' }, s.conta.codigo ? `Liberado pelo código ${s.conta.codigo}.` : plano ? `Plano ${plano.nome}.` : 'Ativado em modo teste.'),
    h('button', {
      class: 'btn btn--d', onclick: () => confirmar('Cancelar a assinatura?', 'Você volta para o plano grátis e perde o Study AI.', async () => {
        if (temServidor()) { try { await cancelarNoServidor(); } catch (e) { return toast(e.message, 'bad'); } }
        else cancelarPro();
        toast('Assinatura cancelada'); pintar();
      }),
    }, 'Cancelar assinatura'))));
}

const linhaOk = (texto) => h('div', { class: 'row row--flat' },
  h('span', {}, '✅'), h('span', { class: 'grow small' }, texto));
