import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";

/**
 * Notificação de teste (Configurações → Notificações): criada SÓ para a própria pessoa que pediu — quem chama passa o
 * id do usuário da sessão, conferido no servidor. Usa a chave de servidor porque as notificações só nascem pelo banco
 * (os clientes não têm INSERT em notifications). No máximo 3 testes a cada 10 minutos.
 */
export async function criarNotificacaoTeste(usuarioId: string): Promise<{ id: string } | { erro: "rate_limited" }> {
  const admin = clienteAdmin();
  const desde = new Date(Date.now() - 10 * 60_000).toISOString();
  const { count, error: erroContagem } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", usuarioId)
    .eq("kind", "test")
    .gte("created_at", desde);
  if (erroContagem) throw erroContagem;
  if ((count ?? 0) >= 3) return { erro: "rate_limited" };
  const { data, error } = await admin
    .from("notifications")
    .insert({
      user_id: usuarioId,
      kind: "test",
      title: "Notificação de teste",
      body: "Tudo certo! É assim que você vai saber do sorteio, das mensagens anônimas e dos lembretes.",
      link: "/notificacoes",
    })
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

