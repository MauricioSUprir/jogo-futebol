"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarNotificacoes, pushConfigurado } from "@/lib/servidor/entrega";
import { criarNotificacaoTeste } from "@/lib/servidor/notificacao-teste";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";

const esquemaInscricao = z.object({
  endpoint: z.string().max(1000).regex(/^https:\/\/\S+$/),
  p256dh: z.string().min(1).max(200),
  auth: z.string().min(1).max(100),
  userAgent: z.string().max(300).optional(),
});

/** Grava a inscrição de push deste aparelho (o navegador já deu a permissão e criou a inscrição). */
export async function salvarInscricaoPush(entrada: z.input<typeof esquemaInscricao>): Promise<Resultado> {
  if (!pushConfigurado()) return falha("push_nao_configurado");
  const v = validar(esquemaInscricao, entrada);
  if (!v.ok) return falha("invalid_subscription");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: v.dados.endpoint,
    p_p256dh: v.dados.p256dh,
    p_auth: v.dados.auth,
    p_user_agent: v.dados.userAgent,
  });
  if (error) return falha(error, "Não foi possível ativar as notificações neste aparelho.");
  revalidatePath("/conta/configuracoes");
  return sucesso("Notificações push ativadas neste aparelho.");
}

/** Remove a inscrição deste aparelho (o navegador já cancelou a dele). */
export async function removerInscricaoPush(endpoint: string): Promise<Resultado> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 1000) return falha("invalid_subscription");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", usuario.id).eq("endpoint", endpoint);
  if (error) return falha(error);
  revalidatePath("/conta/configuracoes");
  return sucesso("Notificações push desativadas neste aparelho.");
}

/** Desliga o push em todos os aparelhos da conta. */
export async function removerTodasInscricoesPush(): Promise<Resultado> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("push_subscriptions").delete().eq("user_id", usuario.id);
  if (error) return falha(error);
  revalidatePath("/conta/configuracoes");
  return sucesso("Push desativado em todos os aparelhos.");
}

type ResultadoTeste = { push: string; email: string };

/**
 * Notificação de teste só para quem pediu: nasce no banco (aparece no sino em tempo real), sai por e-mail (se o servidor
 * tiver e-mail e a pessoa deixou ligado) e, pela fila de entrega, por push (se algum aparelho estiver inscrito). O
 * resultado diz o que realmente aconteceu em cada canal.
 */
export async function enviarNotificacaoTeste(): Promise<Resultado<ResultadoTeste>> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  let id: string;
  try {
    const r = await criarNotificacaoTeste(usuario.id, usuario.is_anonymous ? null : (usuario.email ?? null));
    if ("erro" in r) return falha(r.erro);
    id = r.id;
  } catch (e) {
    return falha(e, "Não foi possível criar a notificação de teste.");
  }
  try {
    // a fila entrega em ordem de chegada: até 3 lotes para alcançar a de teste mesmo com outras na frente
    const supabase = await clienteServidor();
    for (let i = 0; i < 3; i++) {
      await entregarNotificacoes(50);
      const { data } = await supabase.from("notifications").select("email_status, push_status").eq("id", id).maybeSingle();
      if (!data || data.push_status !== "pending") break;
    }
  } catch {
    // a notificação já está no sino; o cron tenta de novo
  }
  const supabase = await clienteServidor();
  const { data } = await supabase.from("notifications").select("email_status, push_status").eq("id", id).maybeSingle();
  const dados: ResultadoTeste = { push: data?.push_status ?? "pending", email: data?.email_status ?? "pending" };
  revalidatePath("/notificacoes");
  return sucesso(textoDoTeste(dados), dados);
}

function textoDoTeste({ push, email }: ResultadoTeste) {
  const partes = ["A notificação de teste chegou ao sino."];
  if (push === "sent") partes.push("Push enviado.");
  else if (push === "failed") partes.push("O push não foi aceito pelo aparelho (tente desativar e ativar de novo).");
  else partes.push("Push: nenhum aparelho ativado.");
  if (email === "sent") partes.push("E-mail enviado.");
  else if (email === "failed") partes.push("O e-mail falhou no servidor de envio.");
  else partes.push("E-mail não enviado (desligado ou sem servidor de e-mail).");
  return partes.join(" ");
}
