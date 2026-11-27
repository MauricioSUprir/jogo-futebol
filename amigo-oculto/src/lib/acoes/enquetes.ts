"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, type Resultado } from "@/lib/acoes/resultado";
import { deInputLocal } from "@/lib/formatos";

/** Enquetes do grupo: criar, votar, encerrar e excluir (as regras de quem pode estão nas funções do banco e no RLS). */

const id = z.uuid("Identificador inválido.");

const esquemaEnquete = z
  .object({
    eventoId: id,
    pergunta: z.string().trim().min(3, "A pergunta precisa de pelo menos 3 caracteres.").max(200, "Use até 200 caracteres."),
    categoria: z.enum(["geral", "presente"]),
    multipla: z.boolean(),
    encerraEm: z.string().optional(),
    opcoes: z
      .array(z.string().trim().max(100, "Cada opção pode ter até 100 caracteres."))
      .transform((l) => l.filter(Boolean))
      .pipe(z.array(z.string()).min(2, "Escreva pelo menos 2 opções.").max(8, "No máximo 8 opções.")),
  })
  .refine((d) => new Set(d.opcoes.map((o) => o.toLocaleLowerCase("pt-BR"))).size === d.opcoes.length, {
    message: "Há opções repetidas.",
    path: ["opcoes"],
  });

export async function criarEnquete(_: unknown, form: FormData): Promise<Resultado<string>> {
  const bruto = {
    eventoId: String(form.get("eventoId") ?? ""),
    pergunta: String(form.get("pergunta") ?? ""),
    categoria: String(form.get("categoria") ?? "geral"),
    multipla: form.get("multipla") === "1",
    encerraEm: String(form.get("encerraEm") ?? "") || undefined,
    opcoes: form.getAll("opcao").map(String),
  };
  const v = esquemaEnquete.safeParse(bruto);
  if (!v.success) {
    const campos: Record<string, string> = {};
    for (const i of v.error.issues) {
      const chave = String(i.path[0] ?? "_");
      campos[chave] ??= i.message;
    }
    return { ok: false, erro: "Confira os campos destacados.", campos };
  }
  let encerra: string | null = null;
  if (v.data.encerraEm) {
    encerra = deInputLocal(v.data.encerraEm);
    if (!encerra) return { ok: false, erro: "Confira os campos destacados.", campos: { encerraEm: "Data inválida." } };
    if (new Date(encerra).getTime() < Date.now() + 5 * 60_000) {
      return { ok: false, erro: "Confira os campos destacados.", campos: { encerraEm: "Escolha um horário daqui a pelo menos 5 minutos." } };
    }
  }
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta para continuar." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("create_poll", {
    p_event: v.data.eventoId,
    p_question: v.data.pergunta,
    p_options: v.data.opcoes,
    p_multiple: v.data.multipla,
    p_closes_at: encerra ?? undefined,
    p_category: v.data.categoria,
  });
  if (error) {
    if (error.message === "forbidden") return { ok: false, erro: "Quem está silenciado (ou num grupo arquivado) não pode criar enquetes." };
    return falha(error, "Não foi possível criar a enquete.");
  }
  revalidatePath(`/grupo/${v.data.eventoId}/enquetes`);
  return sucesso("Enquete criada!", data);
}

export async function votarEnquete(eventoId: string, enqueteId: string, opcoes: string[]): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || !id.safeParse(enqueteId).success || !z.array(id).max(8).safeParse(opcoes).success) {
    return { ok: false, erro: "Voto inválido." };
  }
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta para continuar." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("vote_poll", { p_poll: enqueteId, p_options: opcoes });
  if (error) return falha(error, "Não foi possível registrar o voto.");
  revalidatePath(`/grupo/${eventoId}/enquetes`);
  return sucesso(opcoes.length ? "Voto registrado!" : "Voto retirado.");
}

export async function encerrarEnquete(eventoId: string, enqueteId: string): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || !id.safeParse(enqueteId).success) return { ok: false, erro: "Pedido inválido." };
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta para continuar." };
  const supabase = await clienteServidor();
  const { error } = await supabase.rpc("close_poll", { p_poll: enqueteId });
  if (error) return falha(error, "Não foi possível encerrar a enquete.");
  revalidatePath(`/grupo/${eventoId}/enquetes`);
  return sucesso("Enquete encerrada.");
}

export async function excluirEnquete(eventoId: string, enqueteId: string): Promise<Resultado> {
  if (!id.safeParse(eventoId).success || !id.safeParse(enqueteId).success) return { ok: false, erro: "Pedido inválido." };
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta para continuar." };
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("polls").delete().eq("id", enqueteId).eq("event_id", eventoId).select("id");
  if (error) return falha(error, "Não foi possível excluir a enquete.");
  if (!data?.length) return falha("forbidden");
  revalidatePath(`/grupo/${eventoId}/enquetes`);
  return sucesso("Enquete excluída.");
}
