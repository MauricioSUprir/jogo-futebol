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

/** Planos e preços mostrados na tela de assinatura.
 *  Dois níveis: Pro e Plus. Os PREÇOS DE VERDADE ficam no servidor
 *  (studylab-server/src/pagamento.js) — aqui é só o que a tela mostra,
 *  então mantenha os dois arquivos iguais. */
export const PLANOS = [
  {
    id: 'pro_semanal', nivel: 'pro', nome: 'Pro Semanal', preco: 7.90, periodo: '/semana',
    chamada: 'Para experimentar', dias: 7,
    detalhe: '7 dias de Pro. Pague com Pix ou cartão.',
  },
  {
    id: 'pro_mensal', nivel: 'pro', nome: 'Pro Mensal', preco: 24.90, periodo: '/mês',
    chamada: 'O mais escolhido', dias: 30, destaque: true,
    detalhe: '30 dias de Pro. Pix, cartão ou cobrança automática.',
  },
  {
    id: 'pro_anual', nivel: 'pro', nome: 'Pro Anual', preco: 199.90, periodo: '/ano', dias: 365,
    chamada: 'Melhor custo', economia: 'economiza 33%',
    detalhe: '365 dias de Pro. Sai por R$ 16,66 por mês.',
  },
  {
    id: 'plus_mensal', nivel: 'plus', nome: 'Plus Mensal', preco: 44.90, periodo: '/mês',
    chamada: 'Tudo liberado', dias: 30,
    detalhe: '30 dias de Plus: mais perguntas, mais fotos e os recursos avançados.',
  },
  {
    id: 'plus_anual', nivel: 'plus', nome: 'Plus Anual', preco: 379.90, periodo: '/ano', dias: 365,
    chamada: 'Melhor do Plus', economia: 'economiza 29%',
    detalhe: '365 dias de Plus. Sai por R$ 31,66 por mês.',
  },
];

/** O que cada nível permite no Study AI — espelho dos limites do servidor,
 *  usado só para mostrar na tela (quem manda de verdade é o servidor). */
export const LIMITES_PLANO = {
  pro: { dia: 30, mes: 400, fotosDia: 5, fotosPergunta: 2 },
  plus: { dia: 80, mes: 1000, fotosDia: 25, fotosPergunta: 4 },
};

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
  STUDYLAB30: { dias: 30, nivel: 'pro' },
  PROFESSOR: { dias: 365, nivel: 'plus' },
  TESTE7: { dias: 7, nivel: 'pro' },
};
