/* ===== pagamento.js — assinatura pelo Mercado Pago =====
   Fluxo: o app pede /pagar -> criamos uma "preapproval" (assinatura recorrente)
   -> o aluno paga no site do Mercado Pago -> o MP avisa nosso /webhook
   -> liberamos o Pro. O app NUNCA vê o token do Mercado Pago.                 */
import crypto from 'node:crypto';

const API = process.env.MP_API || 'https://api.mercadopago.com';
const token = () => process.env.MP_ACCESS_TOKEN || '';
export const pagamentoLigado = () => !!token();

/** Os planos vendidos. Estes valores são a fonte da verdade — o app só mostra. */
export const PLANOS = {
  semanal: { nome: 'StudyLab Pro — Semanal', valor: 5.99, frequencia: 7, unidade: 'days', dias: 7 },
  mensal: { nome: 'StudyLab Pro — Mensal', valor: 29.99, frequencia: 1, unidade: 'months', dias: 30 },
  anual: { nome: 'StudyLab Pro — Anual', valor: 99.99, frequencia: 12, unidade: 'months', dias: 365 },
};

/** Para onde o Mercado Pago avisa. No Railway descobrimos sozinhos. */
export function urlDoWebhook() {
  if (process.env.URL_WEBHOOK) return process.env.URL_WEBHOOK;
  const dominio = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.PUBLIC_DOMAIN;
  return dominio ? `https://${dominio.replace(/^https?:\/\//, '')}/webhook/mercadopago` : undefined;
}

async function mp(rota, { metodo = 'GET', corpo = null, idempotencia = null } = {}) {
  if (!token()) throw Object.assign(new Error('Pagamento não configurado no servidor.'), { status: 503 });
  const r = await fetch(`${API}${rota}`, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token()}`,
      ...(idempotencia ? { 'X-Idempotency-Key': idempotencia } : {}),
    },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const dados = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.error('Mercado Pago', rota, r.status, dados?.message || '');
    throw Object.assign(new Error('Não consegui abrir o pagamento agora. Tente de novo.'), { status: 502 });
  }
  return dados;
}

/** Cria a assinatura e devolve o link de pagamento. */
export async function criarAssinatura({ planoId, usuario }) {
  const plano = PLANOS[planoId];
  if (!plano) throw Object.assign(new Error('Plano desconhecido'), { status: 400 });
  const voltarPara = `${(process.env.URL_APP || 'https://mauriciosuprir.github.io/jogo-futebol/studylab/').replace(/\/$/, '')}/#/planos`;

  const d = await mp('/preapproval', {
    metodo: 'POST',
    corpo: {
      reason: plano.nome,
      external_reference: `${usuario.id}|${planoId}`,
      payer_email: usuario.email,
      back_url: voltarPara,
      status: 'pending',
      auto_recurring: {
        frequency: plano.frequencia,
        frequency_type: plano.unidade,
        transaction_amount: plano.valor,
        currency_id: 'BRL',
      },
    },
  });
  return { id: d.id, link: d.init_point || d.sandbox_init_point, valor: plano.valor, plano: planoId, forma: 'recorrente' };
}

/**
 * Pagamento único (Checkout Pro): abre a tela do Mercado Pago com **Pix e cartão**.
 * Compra N dias de Pro. É o único jeito de aceitar Pix — Pix não tem cobrança
 * automática, então quem paga por Pix compra de novo quando acabar.
 */
export async function criarPagamentoUnico({ planoId, usuario }) {
  const plano = PLANOS[planoId];
  if (!plano) throw Object.assign(new Error('Plano desconhecido'), { status: 400 });
  const app = (process.env.URL_APP || 'https://mauriciosuprir.github.io/jogo-futebol/studylab/').replace(/\/$/, '');
  const voltar = `${app}/#/planos`;

  const d = await mp('/checkout/preferences', {
    metodo: 'POST',
    corpo: {
      items: [{
        id: planoId,
        title: plano.nome,
        description: `${plano.dias} dias de StudyLab Pro`,
        quantity: 1,
        currency_id: 'BRL',
        unit_price: plano.valor,
      }],
      payer: { email: usuario.email || undefined, name: usuario.nome || undefined },
      external_reference: `${usuario.id}|${planoId}`,
      back_urls: { success: voltar, pending: voltar, failure: voltar },
      auto_return: 'approved',
      notification_url: urlDoWebhook(),
      statement_descriptor: 'STUDYLAB',
      payment_methods: {
        // Pix + cartão. Boleto fica de fora porque demora dias para compensar.
        excluded_payment_types: [{ id: 'ticket' }, { id: 'atm' }],
        installments: 1,
      },
    },
  });
  return { id: d.id, link: d.init_point || d.sandbox_init_point, valor: plano.valor, plano: planoId, forma: 'unico' };
}

/**
 * Pix direto: cria a cobrança e devolve o QR Code e o código copia-e-cola,
 * para o aluno pagar SEM sair do StudyLab.
 */
export async function criarPix({ planoId, usuario, email }) {
  const plano = PLANOS[planoId];
  if (!plano) throw Object.assign(new Error('Plano desconhecido'), { status: 400 });
  const destinatario = (email || usuario.email || '').trim();
  if (!destinatario || !destinatario.includes('@')) {
    throw Object.assign(new Error('Informe um e-mail para o Mercado Pago mandar o comprovante.'), { status: 400 });
  }

  const d = await mp('/v1/payments', {
    metodo: 'POST',
    idempotencia: `${usuario.id}-${planoId}-${Date.now()}`,
    corpo: {
      transaction_amount: plano.valor,
      description: `${plano.nome} — ${plano.dias} dias`,
      payment_method_id: 'pix',
      external_reference: `${usuario.id}|${planoId}`,
      notification_url: urlDoWebhook(),
      payer: { email: destinatario, first_name: (usuario.nome || 'Estudante').split(' ')[0] },
    },
  });

  const dados = d.point_of_interaction?.transaction_data || {};
  return {
    id: String(d.id),
    status: d.status,
    valor: plano.valor,
    plano: planoId,
    codigo: dados.qr_code || '',              // copia-e-cola
    qrBase64: dados.qr_code_base64 || '',     // imagem PNG
    link: dados.ticket_url || '',             // "ver no Mercado Pago"
    expiraEm: d.date_of_expiration || null,
  };
}

export const consultarAssinatura = (id) => mp(`/preapproval/${id}`);
export const consultarPagamento = (id) => mp(`/v1/payments/${id}`);

/**
 * Confere a assinatura digital que o Mercado Pago manda no webhook.
 * Sem MP_WEBHOOK_SECRET a checagem é pulada (e o servidor avisa no log).
 */
export function webhookConfere(req, url) {
  const segredo = process.env.MP_WEBHOOK_SECRET || '';
  if (!segredo) return true;
  const assinatura = req.headers['x-signature'] || '';
  const requestId = req.headers['x-request-id'] || '';
  const partes = Object.fromEntries(String(assinatura).split(',').map((p) => p.split('=').map((x) => x.trim())));
  const { ts, v1 } = partes;
  if (!ts || !v1) return false;
  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || '';
  const manifesto = `id:${dataId};request-id:${requestId};ts:${ts};`;
  const esperado = crypto.createHmac('sha256', segredo).update(manifesto).digest('hex');
  try { return crypto.timingSafeEqual(Buffer.from(esperado), Buffer.from(v1)); } catch { return false; }
}

/** Traduz o aviso do Mercado Pago em "libere N dias para o aluno X". */
export async function interpretarAviso({ tipo, id }) {
  if (!id) return null;

  if (tipo === 'subscription_preapproval' || tipo === 'preapproval') {
    const a = await consultarAssinatura(id);
    if (a.status !== 'authorized') return null;
    const [usuarioId, planoId] = String(a.external_reference || '').split('|');
    const plano = PLANOS[planoId];
    if (!usuarioId || !plano) return null;
    return { usuarioId, planoId, dias: plano.dias, valor: plano.valor, referencia: `preapproval:${a.id}` };
  }

  if (tipo === 'subscription_authorized_payment' || tipo === 'payment') {
    const p = await consultarPagamento(id);
    if (p.status !== 'approved') return null;
    const ref = String(p.external_reference || p.metadata?.external_reference || '');
    const [usuarioId, planoId] = ref.split('|');
    const plano = PLANOS[planoId];
    if (!usuarioId || !plano) return null;
    return { usuarioId, planoId, dias: plano.dias, valor: p.transaction_amount ?? plano.valor, referencia: `payment:${p.id}` };
  }

  return null;
}
