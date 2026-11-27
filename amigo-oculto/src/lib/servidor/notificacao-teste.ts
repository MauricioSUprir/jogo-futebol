import "server-only";
import { clienteAdmin } from "@/lib/supabase/admin";
import { emailConfigurado, enviarEmail, htmlDoEmail } from "@/lib/servidor/entrega";
import { urlDoSite } from "@/lib/env";

/**
 * Notificação de teste (Configurações → Notificações): criada SÓ para a própria pessoa que pediu — quem chama passa o
 * id e o e-mail do usuário da sessão, conferidos no servidor. Usa a chave de servidor porque as notificações só nascem
 * pelo banco (os clientes não têm INSERT em notifications). No máximo 3 testes a cada 10 minutos.
 *
 * O e-mail do teste sai daqui mesmo (com o mesmo modelo da fila): a lista de tipos que a fila manda por e-mail
 * (claim_notifications) não inclui 'test'. O push sai pela fila normal (entregarNotificacoes), que respeita as inscrições.
 */
const TITULO = "Notificação de teste";
const CORPO = "Tudo certo! É assim que você vai saber do sorteio, das mensagens anônimas e dos lembretes.";
const LINK = "/notificacoes";

export async function criarNotificacaoTeste(
  usuarioId: string,
  email: string | null,
): Promise<{ id: string; email: "sent" | "failed" | "skipped" } | { erro: "rate_limited" }> {
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
    .insert({ user_id: usuarioId, kind: "test", title: TITULO, body: CORPO, link: LINK })
    .select("id")
    .single();
  if (error) throw error;

  // e-mail: só com servidor de e-mail, com e-mail na conta e com a preferência ligada
  let statusEmail: "sent" | "failed" | "skipped" = "skipped";
  if (email && emailConfigurado()) {
    const { data: ajustes } = await admin.from("user_settings").select("notify_email").eq("user_id", usuarioId).maybeSingle();
    if (ajustes?.notify_email ?? true) {
      try {
        await enviarEmail(email, TITULO, htmlDoEmail(TITULO, CORPO, LINK), `${TITULO}\n\n${CORPO}\n\n${urlDoSite()}${LINK}`);
        statusEmail = "sent";
      } catch {
        statusEmail = "failed";
      }
    }
  }
  await admin.rpc("finish_notification_delivery", { p_id: data.id, p_channel: "email", p_status: statusEmail });
  return { id: data.id, email: statusEmail };
}
