/* ===== views/planos.js — assinatura do StudyLab Pro ===== */
import { h, iso, fmtData, daysBetween, parseISO, today } from '../util.js';
import { st, ehPro, ativarPro, cancelarPro } from '../store.js';
import {
  titulo, cartao, vazio, modal, fecharModal, toast, campo, inp, confirmar,
  RECURSOS_FREE, RECURSOS_PRO, selo,
} from '../ui.js';
import { PLANOS, precoBR, CODIGOS, SERVIDOR } from '../produto.js';
import { temServidor, ativarCodigoNoServidor, cancelarNoServidor, pagarNoServidor, buscarEu, garantirSessao } from '../api.js';

export function render(el) {
  const pintar = () => { el.replaceChildren(); montar(el, pintar); };
  montar(el, pintar);
  // ao voltar do Mercado Pago o plano pode ter mudado — confere com o servidor
  if (temServidor()) garantirSessao().then(() => buscarEu()).then(() => pintar()).catch(() => {});
}

function montar(el, pintar) {
  const s = st();
  const pro = ehPro();

  el.append(titulo('✨ StudyLab Pro', pro ? 'Sua assinatura está ativa.' : 'Libere o Study AI — o tutor que conhece os seus estudos.'));

  if (pro) { assinaturaAtiva(el, pintar); return; }

  /* ---------- o que o Pro entrega ---------- */
  el.append(h('div', { class: 'hero mb' },
    h('div', { class: 'flexb mb' }, h('span', { style: { fontSize: '26px' } }, '🤖'),
      h('h1', { style: { fontSize: '20px' } }, 'O Study AI é do Pro'), selo()),
    h('p', { style: { margin: 0 } },
      'Ele não é um chat qualquer: conhece suas matérias, suas provas, seus erros e seu calendário. '
      + 'Pergunte "o que eu estudo agora?" e ele responde com base no seu desempenho de verdade.'),
    h('div', { class: 'grid g2 mt2' },
      h('div', {},
        h('b', { class: 'small' }, 'Com o Pro'),
        h('ul', { class: 'small', style: { paddingLeft: '18px', margin: '6px 0 0', lineHeight: 1.7 } },
          ...RECURSOS_PRO.map((r) => h('li', {}, r.nome)))),
      h('div', {},
        h('b', { class: 'small' }, 'Sempre grátis'),
        h('ul', { class: 'small muted', style: { paddingLeft: '18px', margin: '6px 0 0', lineHeight: 1.7 } },
          ...RECURSOS_FREE.map((r) => h('li', {}, r.nome)))))));

  /* ---------- planos ---------- */
  el.append(h('div', { class: 'grid g3' }, ...PLANOS.map((p) => cartaoPlano(p, pintar))));

  el.append(h('p', { class: 'tiny muted center mt' },
    'Cancele quando quiser. Sem multa, sem fidelidade. O plano grátis continua completo — só sem o Study AI.'));

  /* ---------- código de acesso ---------- */
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
              toast(`Pro liberado até ${fmtData(d.proAte)}! 🎉`, 'good');
              pintar(); return;
            } catch (err) { toast(err.message, 'bad'); }
            finally { e.target.disabled = false; e.target.textContent = 'Ativar'; }
            return;
          }
          const dias = CODIGOS[c];
          if (!dias) return toast('Código inválido', 'bad');
          ativarPro({ planoId: 'codigo', dias, codigo: c });
          toast(`Pro liberado por ${dias} dias! 🎉`, 'good');
          pintar();
        },
      }, 'Ativar')))));

  if (!temServidor()) {
    el.append(h('div', { class: 'mt2' }, cartao(
      h('b', { class: 'small' }, '⚠️ Aviso para o dono do app'),
      h('p', { class: 'small', style: { marginBottom: 0 } },
        'Este aparelho ainda não está ligado ao servidor do StudyLab, então o pagamento online não aparece e '
        + 'o Pro só é liberado por código — conferido aqui mesmo, o que serve para testes, não para escala. '
        + 'Publique o studylab-server e informe o endereço em Configurações → Área do criador.'))));
  }
}

function cartaoPlano(p, pintar) {
  const c = cartao(
    p.destaque ? h('span', { class: 'chip chip--on', style: { position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)' } }, p.chamada)
      : h('div', { class: 'tiny muted', style: { minHeight: '16px' } }, p.chamada || ''),
    h('div', { class: 'center', style: { padding: '10px 0 4px' } },
      h('b', { style: { fontSize: '15px' } }, p.nome),
      h('div', { style: { margin: '8px 0 2px' } },
        h('b', { style: { fontSize: '30px', letterSpacing: '-1px' } }, precoBR(p.preco)),
        h('span', { class: 'muted small' }, p.periodo)),
      p.economia ? h('span', { class: 'chip ok' }, p.economia) : null),
    h('p', { class: 'tiny muted center' }, p.detalhe),
    h('button', {
      class: `btn btn--blk ${p.destaque ? 'btn--p' : ''}`,
      onclick: () => assinar(p, pintar),
    }, 'Assinar'));
  c.style.position = 'relative';
  if (p.destaque) c.style.borderColor = '#7c5cff88';
  return c;
}

function assinar(p, pintar) {
  const corpo = h('div', {},
    h('div', { class: 'center mb' },
      h('b', { style: { fontSize: '26px' } }, precoBR(p.preco)),
      h('span', { class: 'muted' }, p.periodo),
      h('p', { class: 'tiny muted', style: { margin: '6px 0 0' } }, p.detalhe)));
  const acoes = h('div', { class: 'flexb mt2' }, h('button', { class: 'btn sp', onclick: fecharModal }, 'Fechar'));
  corpo.append(acoes);
  modal(`Assinar o plano ${p.nome}`, corpo);

  if (!temServidor()) {
    corpo.insertBefore(h('p', { class: 'small' },
      'O pagamento online ainda não está ligado neste aparelho. Para liberar o Pro agora, use um código de acesso.'), acoes);
    acoes.append(h('button', {
      class: 'btn btn--p', onclick: () => {
        ativarPro({ planoId: p.id, dias: p.dias, codigo: null });
        fecharModal(); toast(`Pro ${p.nome} ativado para teste`, 'good'); pintar();
      },
    }, '🧪 Ativar em modo teste'));
    return;
  }

  const aviso = h('p', { class: 'small' },
    'Você vai ser levado para o Mercado Pago para pagar com segurança. Assim que o pagamento cair, '
    + 'o Pro é liberado sozinho — não precisa mandar comprovante nem esperar ninguém aprovar.');
  corpo.insertBefore(aviso, acoes);

  const irPagar = async (forma, botao, rotulo) => {
    botao.disabled = true; botao.textContent = 'Abrindo o pagamento…';
    try {
      await garantirSessao();
      const r = await pagarNoServidor(p.id, forma);
      location.href = r.link;
    } catch (e) {
      aviso.textContent = e.message;
      aviso.style.color = 'var(--bad)';
      botao.disabled = false; botao.textContent = rotulo;
    }
  };

  const bPix = h('button', { class: 'btn btn--p btn--blk' },
    '💠 Pagar com Pix ou cartão');
  bPix.onclick = () => irPagar('unico', bPix, '💠 Pagar com Pix ou cartão');

  const bRec = h('button', { class: 'btn btn--blk' }, '🔁 Cartão que renova sozinho');
  bRec.onclick = () => irPagar('recorrente', bRec, '🔁 Cartão que renova sozinho');

  const escolhas = h('div', { class: 'grid', style: { gap: '8px', marginBottom: '10px' } },
    bPix,
    h('p', { class: 'tiny muted center', style: { margin: 0 } },
      `Pix cai na hora. Compra ${p.dias} dias e pronto — quando acabar, você compra de novo.`),
    h('div', { class: 'hr', style: { margin: '6px 0' } }),
    bRec,
    h('p', { class: 'tiny muted center', style: { margin: 0 } },
      'Cobra no cartão automaticamente a cada período, até você cancelar. (Pix não permite cobrança automática.)'));
  corpo.insertBefore(escolhas, acoes);
}

function assinaturaAtiva(el, pintar) {
  const s = st();
  const plano = PLANOS.find((p) => p.id === s.conta.planoId);
  const dias = s.conta.proAte ? daysBetween(today(), parseISO(s.conta.proAte)) : null;
  el.append(h('div', { class: 'hero mb' },
    h('div', { class: 'flexb' },
      h('span', { style: { fontSize: '30px' } }, '✨'),
      h('div', { class: 'grow' },
        h('h1', { style: { fontSize: '20px' } }, `StudyLab Pro ${plano ? '· ' + plano.nome : ''}`),
        h('p', { style: { margin: '4px 0 0' } },
          dias === null ? 'Sem data de término.'
            : dias >= 0 ? `Ativo até ${fmtData(s.conta.proAte)} — faltam ${dias} dia(s).`
              : 'Sua assinatura venceu.')),
      selo())));

  el.append(cartao(
    h('b', {}, '🤖 O que você desbloqueou'),
    h('div', { class: 'list mt' }, ...RECURSOS_PRO.map((r) => h('div', { class: 'row row--flat' },
      h('span', {}, '✅'), h('span', { class: 'grow small' }, r.nome)))),
    h('a', { class: 'btn btn--p btn--blk mt', href: '#/ai' }, '🤖 Abrir o Study AI')));

  el.append(h('div', { class: 'mt2' }, cartao(
    h('b', { class: 'small' }, 'Gerenciar assinatura'),
    h('p', { class: 'tiny muted' }, s.conta.codigo ? `Liberado pelo código ${s.conta.codigo}.` : 'Ativado em modo teste.'),
    h('button', {
      class: 'btn btn--d', onclick: () => confirmar('Cancelar o Pro?', 'Você volta para o plano grátis e perde o Study AI.', async () => {
        if (temServidor()) { try { await cancelarNoServidor(); } catch (e) { return toast(e.message, 'bad'); } }
        else cancelarPro();
        toast('Assinatura cancelada'); pintar();
      }),
    }, 'Cancelar assinatura'))));
}
