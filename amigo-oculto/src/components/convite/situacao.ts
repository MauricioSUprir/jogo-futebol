import { dataHora } from "@/lib/formatos";

/** Por que o convite está (ou não) aceitando gente nova — as mesmas regras de join_event, em palavras. */
export function situacaoDoConvite(e: {
  status: string;
  archived: boolean;
  join_deadline: string | null;
  max_participants: number | null;
  participant_count: number;
}): { aceitando: boolean; motivo: string | null } {
  if (e.archived) return { aceitando: false, motivo: "Este grupo foi arquivado pelo organizador." };
  if (e.status === "finished") return { aceitando: false, motivo: "Este amigo oculto já terminou." };
  if (e.status === "drawn") return { aceitando: false, motivo: "O sorteio já foi realizado: o grupo não aceita mais participantes." };
  if (e.join_deadline && new Date(e.join_deadline) <= new Date()) {
    return { aceitando: false, motivo: `O prazo para entrar terminou em ${dataHora(e.join_deadline)}.` };
  }
  if (e.max_participants !== null && e.participant_count >= e.max_participants) {
    return { aceitando: false, motivo: `O grupo atingiu o limite de ${e.max_participants} participantes.` };
  }
  return { aceitando: true, motivo: null };
}
