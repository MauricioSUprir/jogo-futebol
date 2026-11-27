/** Mensagem do chat coletivo como vem do banco (a interface junta o autor pelo mapa de perfis). */
export type MensagemChat = {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
};

export type PerfilResumo = { nome: string; apelido: string | null; avatar: string | null; participanteId: string | null; admin: boolean };

export const PAGINA_CHAT = 50;
