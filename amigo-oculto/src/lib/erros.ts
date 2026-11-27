/** Códigos que as funções do banco levantam (public.fail) → mensagens para as pessoas. */
const MENSAGENS: Record<string, string> = {
  not_authenticated: "Entre na sua conta para continuar.",
  guest_cannot_create: "Para criar um amigo oculto, finalize seu cadastro (e-mail e senha) em Minha conta.",
  rate_limited: "Muitas ações em pouco tempo. Espere um pouco e tente de novo.",
  draw_date_invalid: "Escolha uma data de sorteio no futuro.",
  invalid_code: "Código de convite não encontrado. Confira as letras e números.",
  join_rejected: "Seu pedido para entrar neste grupo não foi aprovado.",
  event_closed: "Este grupo não está aceitando novos participantes.",
  deadline_passed: "O prazo para entrar neste grupo já terminou.",
  event_full: "O grupo já atingiu o limite de participantes.",
  participant_not_found: "Participante não encontrado.",
  forbidden: "Você não tem permissão para isso.",
  not_pending: "Este pedido já foi respondido.",
  locked_after_draw: "Depois do sorteio isso não pode mais ser alterado.",
  cannot_remove_owner: "O criador do grupo não pode ser removido.",
  event_not_found: "Grupo não encontrado.",
  owner_cannot_leave: "O criador não pode sair do grupo. Você pode arquivar ou excluir o grupo.",
  not_approved: "Essa pessoa ainda não foi aprovada.",
  cannot_demote_owner: "O criador do grupo continua organizador.",
  cannot_mute_admin: "Organizadores não podem ser silenciados.",
  not_drawn: "O sorteio ainda não foi realizado.",
  too_many: "No máximo 50 e-mails por vez.",
  invalid_kind: "Tipo inválido.",
  reminder_too_soon: "Este lembrete já foi enviado há pouco. Tente de novo mais tarde.",
  event_archived: "Este grupo está arquivado.",
  version_conflict: "O sorteio mudou enquanto você confirmava. Atualize a página.",
  event_finished: "Este amigo oculto já foi encerrado.",
  already_drawn: "O sorteio já foi realizado.",
  live_already_started: "A revelação ao vivo já começou: o sorteio não pode mais ser refeito.",
  not_enough_participants: "São necessários pelo menos 3 participantes aprovados para sortear.",
  roster_changed: "A lista de participantes mudou durante o sorteio. Tente de novo.",
  invalid_draw_self: "Sorteio inválido: alguém tiraria a si mesmo.",
  invalid_draw_restriction: "Sorteio inválido: uma restrição seria violada.",
  restriction_other_event: "A restrição precisa ser entre participantes deste grupo.",
  limit_below_count: "O limite não pode ser menor que o número de participantes atual.",
  wishlist_full: "Sua lista chegou a 50 itens. Remova algum para adicionar outro.",
  not_found: "Não encontrado.",
  poll_options: "A enquete precisa de 2 a 8 opções.",
  poll_closed: "Esta enquete já foi encerrada.",
  poll_single: "Esta enquete aceita só uma opção.",
  invalid_target: "Destino inválido.",
  secret_blocked: "As mensagens anônimas desta conversa estão bloqueadas.",
  guess_closed: "Os palpites estão fechados.",
  invalid_guess: "Escolha outra pessoa do grupo.",
  quiz_options: "A pergunta precisa de 2 a 4 opções e uma resposta certa.",
  quiz_full: "Você já criou 10 perguntas.",
  quiz_own: "Você não pode responder às suas próprias perguntas.",
  quiz_answered: "Você já respondeu a esta pergunta.",
  challenge_pending: "Termine (ou pule) o seu desafio atual antes de girar de novo.",
  bingo_finished: "Este bingo já terminou.",
  bingo_empty: "Todos os itens já foram sorteados.",
  bingo_not_called: "Este item ainda não foi chamado.",
  invalid_cell: "Casa inválida.",
  capsule_full: "Você já guardou 5 cápsulas neste grupo.",
  card_anonymous_only_receiver: "Cartão anônimo só pode ir para a pessoa que você tirou.",
  live_not_running: "A revelação ao vivo não está acontecendo.",
  live_not_your_turn: "Ainda não é a sua vez de revelar.",
  reveal_not_authorized: "Essa pessoa não autorizou o organizador a revelar por ela. Ela precisa revelar pelo celular.",
  invalid_mode: "Modo inválido.",
  album_full: "Você já enviou 100 fotos para este álbum.",
  invalid_action: "Ação inválida.",
  invalid_status: "Situação inválida.",
  impossivel: "Com as restrições configuradas não existe nenhuma combinação possível. Remova alguma restrição.",
  poucos_participantes: "São necessários pelo menos 3 participantes aprovados para sortear.",
  duplicado: "Há participantes repetidos.",
  restricao_invalida: "Há uma restrição com alguém que não está mais no grupo.",
  // área D (painel, lista de desejos, conta, notificações, push)
  invalid_subscription: "Não foi possível ativar as notificações neste aparelho. Tente de novo.",
  push_nao_configurado: "As notificações push não estão configuradas neste servidor.",
  desejo_link_invalido: "Use um link que comece com https://.",
  avatar_invalido: "Foto inválida. Envie a imagem de novo.",
};

export function mensagemDeErro(erro: unknown, padrao = "Algo deu errado. Tente de novo."): string {
  if (!erro) return padrao;
  const msg =
    typeof erro === "string"
      ? erro
      : typeof erro === "object" && erro !== null && "message" in erro
        ? String((erro as { message: unknown }).message)
        : "";
  if (MENSAGENS[msg]) return MENSAGENS[msg];
  const codigo = typeof erro === "object" && erro !== null && "codigo" in erro ? String((erro as { codigo: unknown }).codigo) : "";
  if (MENSAGENS[codigo]) return MENSAGENS[codigo];
  if (/JWT|session|Auth session missing/i.test(msg)) return "Sua sessão expirou. Entre de novo.";
  if (/fetch failed|network|Failed to fetch/i.test(msg)) return "Sem conexão com o servidor. Confira a internet.";
  return padrao;
}

export function codigoDeErro(erro: unknown): string | null {
  const msg = typeof erro === "object" && erro !== null && "message" in erro ? String((erro as { message: unknown }).message) : "";
  return MENSAGENS[msg] ? msg : null;
}
