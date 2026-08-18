/* ===== views/pagamento.js — a tela de pagamento, dentro do próprio app =====
   Pix: mostra o QR Code e o código copia-e-cola aqui mesmo e fica olhando o
   pagamento até cair — quando cai, libera o Pro na hora.
   Cartão: abre o Mercado Pago (é lá que os dados do cartão são digitados).   */
import { h, fmtData } from '../util.js';
import { st } from '../store.js';
import { toast, inp, campo, confirmar } from '../ui.js';
import { precoBR } from '../produto.js';
import {
  garantirSessao, criarPixNoServidor, consultarPagamentoNoServidor, pagarNoServidor, buscarEu,
  chavePublicaDoServidor, pagarComCartaoNoServidor,
} from '../api.js';

/* O formulário de cartão é o do próprio Mercado Pago (SDK deles). O número do
   cartão nunca passa pelo StudyLab: o formulário devolve só um "token". */
let sdkMP = null;
function carregarSdkMP() {
  if (window.MercadoPago) return Promise.resolve();
  if (sdkMP) return sdkMP;
  sdkMP = new Promise((ok, erro) => {
    const s = document.createElement('script');
    s.src = 'https://sdk.mercadopago.com/js/v2';
    s.onload = () => ok();
    s.onerror = () => { sdkMP = null; erro(new Error('Não consegui carregar o formulário de cartão.')); };
    document.head.append(s);
  });
  return sdkMP;
}

export function abrirPagamento(plano, aoLiberar) {
  const tela = h('div', { class: 'focus-full', style: { alignContent: 'start', paddingTop: '18px', overflowY: 'auto' } });
  document.body.append(tela);
  document.body.style.overflow = 'hidden';
  let pararRelogio = null;

  const fechar = () => {
    clearInterval(pararRelogio);
    tela.remove();
    document.body.style.overflow = '';
    aoLiberar?.();
  };

  const caixa = (...kids) => h('div', { style: { width: 'min(440px,100%)', textAlign: 'left' } },
    h('div', { class: 'flexb mb' },
      h('button', { class: 'icon-btn', onclick: fechar }, '✕'),
      h('b', { class: 'small' }, 'Pagamento'),
      h('span', { class: 'sp chip chip--on' }, `${plano.nome} · ${precoBR(plano.preco)}`)),
    ...kids);

  /* ---------- 1. escolher a forma ---------- */
  function escolherForma() {
    tela.replaceChildren(caixa(
      h('div', { class: 'card' },
        h('b', {}, 'Como você quer pagar?'),
        h('p', { class: 'tiny muted' }, `${plano.dias} dias de StudyLab ${plano.nivel === 'plus' ? 'Plus' : 'Pro'}.`),

        h('button', {
          class: 'card card--flat mt', style: { display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' },
          onclick: () => pedirEmail(),
        },
          h('div', { class: 'flexb' }, h('span', { style: { fontSize: '22px' } }, '💠'),
            h('div', { class: 'grow' }, h('b', { class: 'small' }, 'Pix'),
              h('div', { class: 'tiny muted' }, 'QR Code aqui mesmo · cai na hora')),
            h('span', {}, '›'))),

        h('button', {
          class: 'card card--flat mt', style: { display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer' },
          onclick: () => cartao(),
        },
          h('div', { class: 'flexb' }, h('span', { style: { fontSize: '22px' } }, '💳'),
            h('div', { class: 'grow' }, h('b', { class: 'small' }, 'Cartão de crédito'),
              h('div', { class: 'tiny muted' }, 'abre o Mercado Pago para digitar o cartão')),
            h('span', {}, '›'))),

        h('p', { class: 'tiny muted mt' },
          'O StudyLab não guarda nem vê os dados do seu cartão nem a sua chave Pix. Quem processa é o Mercado Pago.'),
        h('p', { class: 'tiny muted' },
          'Ao pagar você aceita os ', h('a', { href: '#/termos', onclick: fechar }, 'Termos'),
          '. Dá para cancelar quando quiser e desistir em até 7 dias. ',
          h('b', {}, 'Menor de 18? O pagamento deve ser feito por um responsável.')))));
  }

  /* ---------- 2. e-mail (o Mercado Pago exige, para o comprovante) ---------- */
  function pedirEmail() {
    const jaTem = (st().conta.email || '').includes('@');
    if (jaTem) return gerarPix(st().conta.email);
    const campoEmail = inp({ type: 'email', placeholder: 'voce@email.com' });
    tela.replaceChildren(caixa(
      h('div', { class: 'card' },
        h('b', {}, '💠 Pagar com Pix'),
        h('p', { class: 'small muted' }, 'O Mercado Pago manda o comprovante para este e-mail. Só isso.'),
        campo('Seu e-mail', campoEmail),
        h('div', { class: 'flexb mt' },
          h('button', { class: 'btn', onclick: escolherForma }, '‹ Voltar'),
          h('button', {
            class: 'btn btn--p sp', onclick: () => {
              const v = campoEmail.value.trim();
              if (!v.includes('@')) return toast('Digite um e-mail válido', 'bad');
              gerarPix(v);
            },
          }, 'Gerar o Pix')))));
    setTimeout(() => campoEmail.focus(), 60);
  }

  /* ---------- 3. QR Code + código, olhando o pagamento ---------- */
  async function gerarPix(email) {
    tela.replaceChildren(caixa(h('div', { class: 'card center' },
      h('p', { class: 'muted' }, 'Gerando seu Pix…'))));
    let pix;
    try {
      await garantirSessao();
      pix = await criarPixNoServidor(plano.id, email);
    } catch (e) {
      tela.replaceChildren(caixa(h('div', { class: 'card' },
        h('b', {}, '😕 Não consegui gerar o Pix'),
        h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message),
        h('button', { class: 'btn btn--blk mt', onclick: escolherForma }, 'Tentar de outro jeito'))));
      return;
    }

    const situacao = h('div', { class: 'flexb tiny muted', style: { justifyContent: 'center', gap: '6px' } },
      h('span', { class: 'typing' }, h('i'), h('i'), h('i')), h('span', {}, 'esperando o pagamento…'));

    tela.replaceChildren(caixa(h('div', { class: 'card' },
      h('div', { class: 'center' },
        h('b', {}, '💠 Pague com Pix'),
        h('p', { class: 'tiny muted' }, `${plano.dias} dias de ${plano.nivel === 'plus' ? 'Plus' : 'Pro'} · ${precoBR(plano.preco)}`),
        pix.qrBase64
          ? h('img', {
            src: `data:image/png;base64,${pix.qrBase64}`, alt: 'QR Code do Pix',
            style: { width: '220px', maxWidth: '100%', borderRadius: '12px', background: '#fff', padding: '8px', margin: '10px auto', display: 'block' },
          })
          : h('p', { class: 'small muted' }, 'Use o código abaixo no app do seu banco.')),

      h('p', { class: 'tiny muted center' }, 'Abra o app do banco → Pix → Ler QR Code'),
      h('div', { class: 'card card--flat center', style: { marginTop: '10px' } },
        h('div', { class: 'small' }, '✅ O valor já vem preenchido: ',
          h('b', { style: { color: 'var(--ok)' } }, precoBR(pix.valorNoCodigo ?? plano.preco))),
        h('div', { class: 'tiny muted' }, 'Você não digita nada — o banco mostra o valor e você só confirma.')),
      h('div', { class: 'hr' }),
      h('div', { class: 'tiny muted' }, 'Ou copie o código Pix:'),
      h('div', {
        class: 'card card--flat', style: { wordBreak: 'break-all', fontSize: '11px', maxHeight: '78px', overflow: 'auto', marginTop: '6px' },
      }, pix.codigo),
      h('button', {
        class: 'btn btn--p btn--blk mt', onclick: async (e) => {
          try { await navigator.clipboard.writeText(pix.codigo); toast('Código Pix copiado!', 'good'); }
          catch { toast('Selecione o código acima e copie', 'bad'); }
          e.target.textContent = '✅ Código copiado';
          setTimeout(() => { e.target.textContent = '📋 Copiar código Pix'; }, 2500);
        },
      }, '📋 Copiar código Pix'),
      pix.link ? h('a', { class: 'btn btn--blk mt', href: pix.link, target: '_blank', rel: 'noopener' }, 'Abrir no Mercado Pago') : null,
      h('div', { class: 'hr' }),
      situacao,
      h('p', { class: 'tiny muted center mt' },
        'Assim que o pagamento cair, esta tela muda sozinha e o Study AI é liberado. Pode deixar aberta.'),
      h('button', { class: 'btn btn--sm mt', onclick: () => confirmar('Cancelar o pagamento?', 'A cobrança expira sozinha se você não pagar.', fechar) }, 'Cancelar'))));

    /* olha o pagamento a cada 4 segundos, por até 15 minutos */
    let tentativas = 0;
    pararRelogio = setInterval(async () => {
      tentativas++;
      if (tentativas > 225) { clearInterval(pararRelogio); situacao.replaceChildren(h('span', {}, '⌛ O tempo do Pix acabou. Gere um novo.')); return; }
      try {
        const r = await consultarPagamentoNoServidor(pix.id);
        if (r.status === 'approved') { clearInterval(pararRelogio); confirmado(r); }
        else if (['rejected', 'cancelled', 'refunded'].includes(r.status)) {
          clearInterval(pararRelogio);
          situacao.replaceChildren(h('span', { style: { color: 'var(--bad)' } }, '❌ O pagamento não foi concluído.'));
        }
      } catch { /* internet oscilou: tenta de novo no próximo ciclo */ }
    }, 4000);
  }

  /* ---------- 4. deu certo ---------- */
  function confirmado(r) {
    buscarEu().catch(() => {});
    tela.replaceChildren(caixa(h('div', { class: 'card center' },
      h('div', { style: { fontSize: '52px' } }, '🎉'),
      h('h2', { style: { fontSize: '20px' } }, 'Pagamento confirmado!'),
      h('p', { class: 'muted' }, r.proAte ? `Sua assinatura está ativa até ${fmtData(r.proAte)}.` : 'Sua assinatura está ativa.'),
      h('a', { class: 'btn btn--p btn--blk btn--xl mt2', href: '#/ai', onclick: fechar }, '🤖 Abrir o Study AI'),
      h('button', { class: 'btn btn--blk mt', onclick: fechar }, 'Voltar ao app'))));
  }

  /* ---------- cartão ---------- */
  async function cartao() {
    tela.replaceChildren(caixa(h('div', { class: 'card center' }, h('p', { class: 'muted' }, 'Preparando o pagamento…'))));
    let chave = '';
    try {
      await garantirSessao();
      chave = (await chavePublicaDoServidor()).chave || '';
    } catch { /* sem chave pública: cai no checkout do Mercado Pago */ }
    if (chave) return cartaoNoApp(chave);
    return cartaoNoMercadoPago();
  }

  /** Formulário do cartão aqui dentro (Brick do Mercado Pago). */
  async function cartaoNoApp(chave) {
    const caixaForm = h('div', { id: 'mp-cartao', style: { minHeight: '260px' } });
    const erroEl = h('p', { class: 'tiny', style: { color: 'var(--bad)' } });
    tela.replaceChildren(caixa(h('div', { class: 'card' },
      h('b', {}, '💳 Pagar com cartão'),
      h('p', { class: 'tiny muted' }, `${plano.dias} dias de ${plano.nivel === 'plus' ? 'Plus' : 'Pro'} · ${precoBR(plano.preco)}`),
      caixaForm, erroEl,
      h('p', { class: 'tiny muted' }, 'O formulário é do Mercado Pago. O número do cartão não passa pelo StudyLab.'),
      h('button', { class: 'btn btn--sm mt', onclick: escolherForma }, '‹ Escolher outra forma'))));

    try {
      await carregarSdkMP();
      const mp = new window.MercadoPago(chave, { locale: 'pt-BR' });
      await mp.bricks().create('cardPayment', 'mp-cartao', {
        initialization: { amount: plano.preco, payer: { email: st().conta.email || '' } },
        customization: { visual: { style: { theme: 'dark' } }, paymentMethods: { maxInstallments: 1 } },
        callbacks: {
          onReady: () => {},
          onError: (e) => { erroEl.textContent = e?.message || 'Confira os dados do cartão.'; },
          onSubmit: async (dados) => {
            erroEl.textContent = '';
            try {
              const r = await pagarComCartaoNoServidor(plano.id, {
                token: dados.token,
                metodo: dados.payment_method_id,
                emissor: dados.issuer_id,
                parcelas: dados.installments,
                email: dados.payer?.email,
                documento: dados.payer?.identification
                  ? { tipo: dados.payer.identification.type, numero: dados.payer.identification.number }
                  : null,
              });
              if (r.status === 'approved') confirmado(r);
              else if (r.status === 'in_process') aguardando();
              else erroEl.textContent = 'O pagamento foi recusado pelo banco. Tente outro cartão ou pague com Pix.';
            } catch (e) { erroEl.textContent = e.message; }
          },
        },
      });
    } catch (e) {
      erroEl.textContent = `${e.message} Vou te levar para o Mercado Pago.`;
      setTimeout(cartaoNoMercadoPago, 1200);
    }
  }

  /** Plano B: o checkout do Mercado Pago, em outra tela. */
  async function cartaoNoMercadoPago() {
    tela.replaceChildren(caixa(h('div', { class: 'card center' }, h('p', { class: 'muted' }, 'Abrindo o Mercado Pago…'))));
    try {
      const r = await pagarNoServidor(plano.id, 'unico');
      location.href = r.link;
    } catch (e) {
      tela.replaceChildren(caixa(h('div', { class: 'card' },
        h('b', {}, '😕 Não consegui abrir o pagamento'),
        h('p', { class: 'small', style: { color: 'var(--bad)' } }, e.message),
        h('button', { class: 'btn btn--blk mt', onclick: escolherForma }, '‹ Voltar'))));
    }
  }

  /** Cartão em análise: o banco ainda vai responder. */
  function aguardando() {
    tela.replaceChildren(caixa(h('div', { class: 'card center' },
      h('div', { style: { fontSize: '44px' } }, '⏳'),
      h('h2', { style: { fontSize: '18px' } }, 'Pagamento em análise'),
      h('p', { class: 'muted small' }, 'O banco ainda está confirmando. Assim que aprovar, o Pro é liberado sozinho — '
        + 'pode fechar esta tela e voltar depois.'),
      h('button', { class: 'btn btn--p btn--blk mt2', onclick: fechar }, 'Entendi'))));
  }

  escolherForma();
}
