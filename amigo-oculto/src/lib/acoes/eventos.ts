"use server";
import { revalidatePath } from "next/cache";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { entregarEmSegundoPlano } from "@/lib/servidor/entrega";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";
import {
  argumentosCriarEvento,
  colunasDoEvento,
  esquemaEvento,
  normalizarCodigo,
  type DadosEvento,
} from "@/lib/validacao/evento";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Cria o amigo oculto (o criador entra como organizador) e devolve o id. Convidado anônimo não cria. */
export async function criarEvento(entrada: unknown): Promise<Resultado<{ id: string }>> {
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta para criar um amigo oculto." };
  if (usuario.is_anonymous) return falha("guest_cannot_create");
  const v = validar(esquemaEvento(), entrada);
  if (!v.ok) return v.resultado;
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("create_event", argumentosCriarEvento(v.dados));
  if (error || !data) return falha(error, "Não foi possível criar o amigo oculto agora. Tente de novo.");
  revalidatePath("/painel");
  return sucesso("Amigo oculto criado!", { id: data });
}

/** Edição pelo organizador: mesmo esquema da criação; depois do sorteio, só os campos liberados. */
export async function editarEvento(eventoId: string, entrada: unknown): Promise<Resultado> {
  if (!UUID.test(eventoId)) return falha("event_not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const [{ data: eu }, { data: evento }, { count: ocupados }] = await Promise.all([
    supabase.from("participants").select("role, status").eq("event_id", eventoId).eq("user_id", usuario.id).maybeSingle(),
    supabase.from("events").select("*").eq("id", eventoId).maybeSingle(),
    supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", eventoId).in("status", ["approved", "pending"]),
  ]);
  if (!evento) return falha("event_not_found");
  if (!eu || eu.status !== "approved" || eu.role !== "admin") return falha("forbidden");
  const sorteado = evento.status !== "open";
  const v = validar(
    esquemaEvento({
      original: { revelacaoEm: evento.reveal_at, prazoEntrada: evento.join_deadline, sorteioEm: evento.draw_at },
      ocupados: sorteado ? undefined : (ocupados ?? 0),
    }),
    entrada,
  );
  if (!v.ok) return v.resultado;
  const dados: DadosEvento = v.dados;
  const { error } = await supabase.from("events").update(colunasDoEvento(dados, { sorteado })).eq("id", eventoId);
  if (error) return falha(error, "Não foi possível salvar as mudanças.");
  revalidatePath(`/grupo/${eventoId}`, "layout");
  revalidatePath("/painel");
  // mudanças de regras, valor, data ou local avisam o grupo (trigger no banco)
  entregarEmSegundoPlano();
  return sucesso("Alterações salvas. O grupo foi avisado do que mudou.");
}

/** Entrar no grupo pelo código (logado com conta ou como convidado). */
export async function participarDoGrupo(
  codigo: string,
  mensagem?: string | null,
): Promise<Resultado<{ eventoId: string; status: "approved" | "pending" | "rejected" }>> {
  const c = normalizarCodigo(codigo);
  if (!c) return falha("invalid_code");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const texto = typeof mensagem === "string" ? mensagem.trim().slice(0, 300) : "";
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("join_event", { p_code: c, p_message: texto || undefined });
  if (error || !data) return falha(error, "Não foi possível entrar no grupo agora.");
  const r = data as { event_id: string; status: "approved" | "pending" | "rejected" };
  revalidatePath("/painel");
  revalidatePath(`/convite/${c}`);
  entregarEmSegundoPlano(); // avisa os organizadores (entrada ou pedido)
  return sucesso(r.status === "pending" ? "Pedido enviado! O organizador vai responder." : "Você entrou no grupo!", {
    eventoId: r.event_id,
    status: r.status,
  });
}

export type GrupoPublico = {
  id: string;
  name: string;
  description: string | null;
  cover_path: string | null;
  theme: string;
  reveal_at: string | null;
  gift_min: number | null;
  gift_max: number | null;
  invite_code: string;
  requires_approval: boolean;
  max_participants: number | null;
  created_at: string;
  participant_count: number;
  owner_name: string | null;
};

const POR_PAGINA_PUBLICOS = 12;

/** Grupos públicos (com busca por nome), de 12 em 12. Funciona sem login. */
export async function buscarGruposPublicos(busca: string, deslocamento: number): Promise<Resultado<{ itens: GrupoPublico[]; temMais: boolean }>> {
  const q = typeof busca === "string" ? busca.trim().slice(0, 80) : "";
  const desde = Number.isInteger(deslocamento) && deslocamento >= 0 ? Math.min(deslocamento, 5000) : 0;
  const supabase = await clienteServidor();
  const { data, error } = await supabase.rpc("search_public_events", {
    p_query: q || undefined,
    p_limit: POR_PAGINA_PUBLICOS + 1,
    p_offset: desde,
  });
  if (error) return falha(error, "Não foi possível carregar os grupos públicos.");
  const lista = (data ?? []) as unknown as GrupoPublico[];
  return sucesso(undefined, { itens: lista.slice(0, POR_PAGINA_PUBLICOS), temMais: lista.length > POR_PAGINA_PUBLICOS });
}
