/* ===== produto.js — as configurações COMERCIAIS do StudyLab =====
   É o único arquivo que você precisa mexer para ligar login e cobrança.
   Enquanto estiver vazio, o app funciona normalmente: entra sem conta e o
   Study AI aparece bloqueado, convidando a assinar.                          */

/** Client ID do Google (console.cloud.google.com → Credenciais → OAuth 2.0).
 *  Lembre de autorizar a origem: https://mauriciosuprir.github.io */
export const GOOGLE_CLIENT_ID = '';

/** Endereço do servidor do StudyLab — o código dele está em `studylab-server/`.
 *  Depois de publicar no Railway, cole aqui a URL que ele te der.
 *  Ex.: 'https://studylab-server-production.up.railway.app'
 *  Vazio = o app funciona sozinho, com conta local e Pro só por código. */
export const SERVIDOR = '';

/** Planos e preços mostrados na tela de assinatura. */
export const PLANOS = [
  {
    id: 'semanal', nome: 'Semanal', preco: 5.99, periodo: '/semana',
    chamada: 'Para experimentar', dias: 7,
    detalhe: '7 dias de Pro. Pague com Pix ou cartão.',
  },
  {
    id: 'mensal', nome: 'Mensal', preco: 29.99, periodo: '/mês',
    chamada: 'O mais escolhido', dias: 30, destaque: true,
    detalhe: '30 dias de Pro. Pix, cartão ou cobrança automática.',
  },
  {
    id: 'anual', nome: 'Anual', preco: 99.99, periodo: '/ano', dias: 365,
    chamada: 'Melhor custo', economia: 'economiza 72%',
    detalhe: '365 dias de Pro. Sai por R$ 8,33 por mês.',
  },
];

/** Aparece nos Termos e na Política de Privacidade. TROQUE pelo seu e-mail. */
export const EMAIL_CONTATO = 'contato@studylab.app';

/** Quem responde legalmente pelo app (nome ou razão social). TROQUE. */
export const RESPONSAVEL = 'StudyLab';

export const precoBR = (v) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Códigos de acesso que liberam o Pro sem pagamento online (testes, cortesia,
 *  venda por PIX). Formato: CODIGO: dias de Pro. Apague o que não usar.
 *  Aviso honesto: isso é conferido no aparelho, então serve para uso controlado
 *  — quando o servidor existir, a validação passa a ser feita lá. */
export const CODIGOS = {
  STUDYLAB30: 30,
  PROFESSOR: 365,
  TESTE7: 7,
};
