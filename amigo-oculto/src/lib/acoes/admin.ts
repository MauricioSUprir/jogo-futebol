"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { emailConfigurado, entregarEmSegundoPlano, enviarEmail, htmlDoEmail } from "@/lib/servidor/entrega";
import { urlDoSite } from "@/lib/env";
import { dataHora } from "@/lib/formatos";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";
import { mensagemDeErro } from "@/lib/erros";

/**
 * Ações do painel do organizador. Toda ação confere a sessão; as funções do banco conferem de novo se quem chama é
 * organizador do grupo (RLS e SECURITY DEFINER). Nada aqui lê ou devolve pares do sorteio.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

async function organizador(eventoId: string) {
  if (!uuid(eventoId)) return { ok: false, erro: falha("event_not_found") } as const;
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: falha("not_authenticated") } as const;
  const supabase = await clienteServidor();
  const { data: eu } = await supabase
    .from("participants")
    .select("id, role, status")
    .eq("event_id", eventoId)
    .eq("user_id", usuario.id)
    .maybeSingle();
  if (!eu || eu.status !== "approved" || eu.role !== "admin") return { ok: false, erro: falha("forbidden") } as const;
  return { ok: true, supabase, usuario, eu } as const;
}

function atualizar(eventoId: string) {
  revalidatePath(`/grupo/${eventoId}`, "layout");
  revalidatePath("/painel");
}

// ---------------------------------------------------------------------------------------------------------------------
// Participantes
// ---------------------------------------------------------------------------------------------------------------------
export async function responderPedido(eventoId: string, participanteId: string, aprovar: boolean): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(participanteId)) return falha("participant_not_found");
  const { error } = await o.supabase.rpc("approve_participant", { p_participant: participanteId, p_approve: !!aprovar });
  if (error) return falha(error);
  atualizar(eventoId);
  entregarEmSegundoPlano();
  return sucesso(aprovar ? "Pedido aprovado. A pessoa já está no grupo." : "Pedido recusado.");
}

export async function aprovarTodosPedidos(eventoId: string): Promise<Resultado<{ aprovados: number }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const { data: pendentes } = await o.supabase.from("participants").select("id").eq("event_id", eventoId).eq("status", "pending").order("created_at");
  let aprovados = 0;
  let ultimoErro: unknown = null;
  for (const p of pendentes ?? []) {
    const { error } = await o.supabase.rpc("approve_participant", { p_participant: p.id, p_approve: true });
    if (error) ultimoErro = error;
    else aprovados++;
  }
  atualizar(eventoId);
  if (aprovados > 0) entregarEmSegundoPlano();
  if (ultimoErro && aprovados === 0) return falha(ultimoErro);
  const resto = (pendentes?.length ?? 0) - aprovados;
  return sucesso(
    resto > 0 ? `${aprovados} aprovado(s); ${resto} ficaram pendentes: ${mensagemDeErro(ultimoErro)}` : `${aprovados} pedido(s) aprovado(s).`,
    { aprovados },
  );
}

export async function removerParticipante(eventoId: string, participanteId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(participanteId)) return falha("participant_not_found");
  const { error } = await o.supabase.rpc("remove_participant", { p_participant: participanteId });
  if (error) return falha(error);
  atualizar(eventoId);
  entregarEmSegundoPlano();
  return sucesso("Participante removido. A pessoa foi avisada.");
}

export async function definirPapel(eventoId: string, participanteId: string, papel: "admin" | "member"): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(participanteId) || (papel !== "admin" && papel !== "member")) return falha("invalid_action");
  const { error } = await o.supabase.rpc("set_participant_role", { p_participant: participanteId, p_role: papel });
  if (error) return falha(error);
  atualizar(eventoId);
  if (papel === "admin") entregarEmSegundoPlano();
  return sucesso(papel === "admin" ? "Agora essa pessoa também organiza o grupo." : "A pessoa voltou a ser participante.");
}

/** Silencia no chat por `minutos` (0 = tirar o silêncio). */
export async function silenciarParticipante(eventoId: string, participanteId: string, minutos: number): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(participanteId)) return falha("participant_not_found");
  const m = Math.max(0, Math.min(60 * 24 * 30, Math.floor(Number(minutos) || 0)));
  const { error } = await o.supabase.rpc("mute_participant", { p_participant: participanteId, p_minutes: m });
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso(m === 0 ? "A pessoa pode falar no chat de novo." : "Participante silenciado no chat.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Restrições
// ---------------------------------------------------------------------------------------------------------------------
const esquemaRestricao = z
  .object({
    dador: z.string().regex(UUID, "Escolha quem não pode tirar."),
    recebedor: z.string().regex(UUID, "Escolha quem não pode ser tirado."),
    mutuo: z.boolean(),
    observacao: z
      .string()
      .trim()
      .max(120, "Use até 120 caracteres na observação.")
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((d) => d.dador !== d.recebedor, { message: "Escolha duas pessoas diferentes.", path: ["recebedor"] });

export async function adicionarRestricao(eventoId: string, entrada: unknown): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const v = validar(esquemaRestricao, entrada);
  if (!v.ok) return v.resultado;
  const { dador, recebedor, mutuo, observacao } = v.dados;
  // só entre aprovados (quem ainda está pendente pode ficar de fora do sorteio)
  const { data: pessoas } = await o.supabase
    .from("participants")
    .select("id, status")
    .eq("event_id", eventoId)
    .in("id", [dador, recebedor]);
  if ((pessoas ?? []).filter((p) => p.status === "approved").length !== 2) {
    return { ok: false, erro: "As restrições valem só entre participantes já aprovados." };
  }
  const { data: existentes } = await o.supabase
    .from("restrictions")
    .select("id, giver_id, receiver_id, mutual")
    .eq("event_id", eventoId)
    .or(`and(giver_id.eq.${dador},receiver_id.eq.${recebedor}),and(giver_id.eq.${recebedor},receiver_id.eq.${dador})`);
  for (const r of existentes ?? []) {
    if (r.giver_id === dador || r.mutual) return { ok: false, erro: "Essa restrição já existe." };
    if (mutuo) {
      return { ok: false, erro: "Já existe uma restrição entre essas pessoas no outro sentido. Exclua-a e crie de novo como mútua." };
    }
  }
  const { error } = await o.supabase
    .from("restrictions")
    .insert({ event_id: eventoId, giver_id: dador, receiver_id: recebedor, mutual: mutuo, note: observacao });
  if (error) {
    if (error.code === "23505") return { ok: false, erro: "Essa restrição já existe." };
    return falha(error, "Não foi possível salvar a restrição.");
  }
  atualizar(eventoId);
  return sucesso("Restrição adicionada.");
}

export async function excluirRestricao(eventoId: string, restricaoId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(restricaoId)) return falha("not_found");
  const { data, error } = await o.supabase.from("restrictions").delete().eq("id", restricaoId).eq("event_id", eventoId).select("id");
  if (error) return falha(error);
  if (!data?.length) return falha("locked_after_draw");
  atualizar(eventoId);
  return sucesso("Restrição excluída.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------------------------------------------------
export async function gerarNovoCodigo(eventoId: string): Promise<Resultado<{ codigo: string }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const { data, error } = await o.supabase.rpc("regenerate_invite_code", { p_event: eventoId });
  if (error || !data) return falha(error);
  atualizar(eventoId);
  return sucesso("Código novo gerado. O link antigo parou de funcionar.", { codigo: data });
}

/** Separa e-mails digitados com vírgula, ponto e vírgula, espaço ou quebra de linha. */
function separarEmails(texto: string) {
  const todos = texto
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const validos: string[] = [];
  const invalidos: string[] = [];
  for (const e of todos) {
    if (z.email().safeParse(e).success && e.length <= 254) {
      if (!validos.includes(e)) validos.push(e);
    } else invalidos.push(e);
  }
  return { validos, invalidos };
}

export async function convidarPorEmail(
  eventoId: string,
  texto: string,
): Promise<Resultado<{ registrados: number; enviados: number; falhas: number; emailLigado: boolean; invalidos: string[] }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const { validos, invalidos } = separarEmails(typeof texto === "string" ? texto : "");
  if (validos.length === 0) {
    return { ok: false, erro: invalidos.length ? `Nenhum e-mail válido. Confira: ${invalidos.slice(0, 3).join(", ")}` : "Digite pelo menos um e-mail.", campos: { emails: "Digite e-mails válidos." } };
  }
  if (validos.length > 50) return falha("too_many");
  const { data: n, error } = await o.supabase.rpc("invite_emails", { p_event: eventoId, p_emails: validos });
  if (error) return falha(error);

  // E-mail de verdade só se houver provedor configurado; sem ele, o convite fica registrado e quem já tem conta é
  // avisado pela notificação do app (o banco cria) — nada finge ter enviado.
  let enviados = 0;
  let falhas = 0;
  const ligado = emailConfigurado();
  if (ligado) {
    const [{ data: ev }, { data: perfil }] = await Promise.all([
      o.supabase.from("events").select("name, invite_code, reveal_at, location").eq("id", eventoId).single(),
      o.supabase.from("profiles").select("display_name").eq("id", o.usuario.id).maybeSingle(),
    ]);
    if (ev) {
      const link = `/convite/${ev.invite_code}`;
      const titulo = `Convite para o amigo oculto ${ev.name}`;
      const partes = [
        `${perfil?.display_name ?? "O organizador"} convidou você para participar do amigo oculto "${ev.name}".`,
        ev.reveal_at ? `Revelação: ${dataHora(ev.reveal_at)}.` : null,
        ev.location ? `Local: ${ev.location}.` : null,
        `Código do convite: ${ev.invite_code}.`,
      ].filter(Boolean);
      const corpo = partes.join(" ");
      const html = htmlDoEmail(titulo, corpo, link);
      const textoEmail = `${titulo}\n\n${corpo}\n\n${urlDoSite()}${link}`;
      // poucos de cada vez para não estourar o provedor
      for (let i = 0; i < validos.length; i += 5) {
        const lote = validos.slice(i, i + 5);
        const r = await Promise.allSettled(lote.map((para) => enviarEmail(para, titulo, html, textoEmail)));
        for (const x of r) if (x.status === "fulfilled") enviados++;
        else falhas++;
      }
    }
  }
  atualizar(eventoId);
  entregarEmSegundoPlano(); // notificações do app para quem já tem conta
  const registrados = n ?? validos.length;
  const mensagem = ligado
    ? falhas
      ? `${enviados} convite(s) enviado(s) por e-mail; ${falhas} não saíram. Mande o link pelo WhatsApp para esses.`
      : `${enviados} convite(s) enviado(s) por e-mail.`
    : `${registrados} convite(s) registrado(s). O envio de e-mails não está configurado neste site: quem já tem conta com esses e-mails foi avisado no app; para os outros, mande o link.`;
  return sucesso(mensagem, { registrados, enviados, falhas, emailLigado: ligado, invalidos });
}

export async function revogarConvite(eventoId: string, conviteId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(conviteId)) return falha("not_found");
  const { error } = await o.supabase
    .from("event_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", conviteId)
    .eq("event_id", eventoId);
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso("Convite revogado.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------------------------------------------------
const esquemaAviso = z.object({
  titulo: z.string().trim().min(1, "Dê um título ao aviso.").max(120, "Use até 120 caracteres no título."),
  corpo: z
    .string()
    .trim()
    .max(2000, "Use até 2000 caracteres.")
    .optional()
    .transform((v) => (v ? v : null)),
  fixado: z.boolean().optional().default(false),
});

export async function publicarAviso(eventoId: string, entrada: unknown): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const v = validar(esquemaAviso, entrada);
  if (!v.ok) return v.resultado;
  const { error } = await o.supabase
    .from("announcements")
    .insert({ event_id: eventoId, author_id: o.usuario.id, title: v.dados.titulo, body: v.dados.corpo, pinned: v.dados.fixado });
  if (error) return falha(error, "Não foi possível publicar o aviso.");
  atualizar(eventoId);
  entregarEmSegundoPlano(); // todos do grupo são avisados (trigger no banco)
  return sucesso("Aviso publicado. Todo o grupo foi notificado.");
}

export async function editarAviso(eventoId: string, avisoId: string, entrada: unknown): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(avisoId)) return falha("not_found");
  const v = validar(esquemaAviso, entrada);
  if (!v.ok) return v.resultado;
  const { data, error } = await o.supabase
    .from("announcements")
    .update({ title: v.dados.titulo, body: v.dados.corpo, pinned: v.dados.fixado })
    .eq("id", avisoId)
    .eq("event_id", eventoId)
    .select("id");
  if (error) return falha(error);
  if (!data?.length) return falha("not_found");
  atualizar(eventoId);
  return sucesso("Aviso atualizado.");
}

export async function fixarAviso(eventoId: string, avisoId: string, fixado: boolean): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(avisoId)) return falha("not_found");
  const { error } = await o.supabase.from("announcements").update({ pinned: !!fixado }).eq("id", avisoId).eq("event_id", eventoId);
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso(fixado ? "Aviso fixado no topo." : "Aviso desafixado.");
}

export async function excluirAviso(eventoId: string, avisoId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(avisoId)) return falha("not_found");
  const { error } = await o.supabase.from("announcements").delete().eq("id", avisoId).eq("event_id", eventoId);
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso("Aviso excluído.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Lembretes
// ---------------------------------------------------------------------------------------------------------------------
const TIPOS_LEMBRETE = ["buy_gift", "view_result", "rsvp", "wishlist"] as const;

export async function enviarLembrete(eventoId: string, tipo: string): Promise<Resultado<{ recebidos: number }>> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!(TIPOS_LEMBRETE as readonly string[]).includes(tipo)) return falha("invalid_kind");
  const { data, error } = await o.supabase.rpc("send_reminder", { p_event: eventoId, p_kind: tipo });
  if (error) return falha(error);
  const n = data ?? 0;
  if (n > 0) entregarEmSegundoPlano();
  atualizar(eventoId);
  return sucesso(
    n === 0 ? "Ninguém precisava deste lembrete agora: todos já estão em dia." : `Lembrete enviado para ${n} pessoa${n === 1 ? "" : "s"}.`,
    { recebidos: n },
  );
}

// ---------------------------------------------------------------------------------------------------------------------
// Moderação
// ---------------------------------------------------------------------------------------------------------------------
export async function resolverDenuncia(eventoId: string, denunciaId: string, acao: "dismissed" | "deleted" | "muted"): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(denunciaId)) return falha("not_found");
  if (!["dismissed", "deleted", "muted"].includes(acao)) return falha("invalid_action");
  const { error } = await o.supabase.rpc("resolve_report", { p_report: denunciaId, p_action: acao });
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso(
    acao === "dismissed" ? "Denúncia arquivada; o conteúdo foi mantido." : acao === "deleted" ? "Conteúdo removido." : "Conteúdo removido e remetente silenciado.",
  );
}

export async function apagarMensagemChat(eventoId: string, mensagemId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  if (!uuid(mensagemId)) return falha("not_found");
  const { error } = await o.supabase.rpc("delete_chat_message", { p_message: mensagemId });
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso("Mensagem apagada do chat.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Encerrar, arquivar, excluir
// ---------------------------------------------------------------------------------------------------------------------
export async function encerrarEvento(eventoId: string): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const { error } = await o.supabase.rpc("finish_event", { p_event: eventoId });
  if (error) return falha(error);
  atualizar(eventoId);
  entregarEmSegundoPlano();
  return sucesso("Amigo oculto encerrado. O álbum de memórias foi aberto para todos.");
}

export async function arquivarEvento(eventoId: string, arquivar: boolean): Promise<Resultado> {
  const o = await organizador(eventoId);
  if (!o.ok) return o.erro;
  const { error } = await o.supabase.rpc("archive_event", { p_event: eventoId, p_archive: !!arquivar });
  if (error) return falha(error);
  atualizar(eventoId);
  return sucesso(arquivar ? "Grupo arquivado." : "Grupo desarquivado.");
}

/** Só o criador; precisa digitar o nome do grupo. Leva ao painel. */
export async function excluirEvento(eventoId: string, confirmacao: string): Promise<Resultado> {
  if (!uuid(eventoId)) return falha("event_not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data: ev } = await supabase.from("events").select("name, owner_id").eq("id", eventoId).maybeSingle();
  if (!ev) return falha("event_not_found");
  if (ev.owner_id !== usuario.id) return falha("forbidden");
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");
  if (typeof confirmacao !== "string" || norm(confirmacao) !== norm(ev.name)) {
    return { ok: false, erro: "Digite o nome do grupo exatamente como aparece para confirmar.", campos: { confirmacao: "O nome não confere." } };
  }
  const { error } = await supabase.rpc("delete_event", { p_event: eventoId });
  if (error) return falha(error);
  revalidatePath("/painel");
  redirect("/painel?grupo=excluido");
}
