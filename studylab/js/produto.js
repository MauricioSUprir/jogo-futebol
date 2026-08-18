/* ===== produto.js — as configurações COMERCIAIS do StudyLab =====
   É o único arquivo que você precisa mexer para ligar login e cobrança.
   Enquanto estiver vazio, o app funciona normalmente: entra sem conta e o
   Study AI aparece bloqueado, convidando a assinar.                          */

/** Client ID do Google (console.cloud.google.com → Credenciais → OAuth 2.0).
 *  Lembre de autorizar a origem: https://mauriciosuprir.github.io */
export const GOOGLE_CLIENT_ID = '';

/** Endereço do servidor do StudyLab (o que guarda a chave da Claude API e
 *  confere quem é assinante). Ex.: 'https://api.studylab.app'.
 *  Vazio = Study AI fica indisponível para todo mundo. */
export const SERVIDOR = '';

/** Planos e preços mostrados na tela de assinatura. */
export const PLANOS = [
  {
    id: 'semanal', nome: 'Semanal', preco: 5.99, periodo: '/semana',
    chamada: 'Para experimentar', dias: 7,
    detalhe: 'Cobrado toda semana. Cancela quando quiser.',
  },
  {
    id: 'mensal', nome: 'Mensal', preco: 29.99, periodo: '/mês',
    chamada: 'O mais escolhido', dias: 30, destaque: true,
    detalhe: 'Cobrado todo mês. Cancela quando quiser.',
  },
  {
    id: 'anual', nome: 'Anual', preco: 99.99, periodo: '/ano', dias: 365,
    chamada: 'Melhor custo', economia: 'economiza 72%',
    detalhe: 'Um pagamento por ano. Sai por R$ 8,33 por mês.',
  },
];

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
