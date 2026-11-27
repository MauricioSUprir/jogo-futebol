"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";

/**
 * Álbum de memórias (privado). A foto sobe do navegador direto para o Storage (bucket `album`, pasta
 * <evento>/<usuário>/); aqui só registramos, editamos, apagamos e denunciamos — sempre com o RLS de quem chama.
 */

const id = z.uuid("Identificador inválido.");
const NAO_LOGADO: Resultado<never> = { ok: false, erro: "Entre na sua conta para continuar." };
const legenda = z.string().trim().max(200, "Use até 200 caracteres.");

async function cliente() {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  return { usuario, supabase: await clienteServidor() };
}

export async function registrarFotoAlbum(
  eventoId: string,
  foto: { caminho: string; largura: number; altura: number; legenda?: string },
): Promise<Resultado> {
  const v = validar(
    z.object({
      eventoId: id,
      caminho: z.string().min(10).max(300),
      largura: z.number().int().min(1).max(10000),
      altura: z.number().int().min(1).max(10000),
      legenda: legenda.optional(),
    }),
    { eventoId, ...foto },
  );
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  if (!v.dados.caminho.startsWith(`${eventoId}/${s.usuario.id}/`)) return { ok: false, erro: "Envio inválido." };
  const { error } = await s.supabase.from("album_photos").insert({
    event_id: eventoId,
    uploader_id: s.usuario.id,
    storage_path: v.dados.caminho,
    width: v.dados.largura,
    height: v.dados.altura,
    caption: v.dados.legenda ? v.dados.legenda : null,
  });
  if (error) {
    // não deixa o arquivo órfão no Storage
    await s.supabase.storage.from("album").remove([v.dados.caminho]);
    return falha(error, "Não foi possível guardar a foto no álbum.");
  }
  revalidatePath(`/grupo/${eventoId}/album`);
  return sucesso();
}

export async function editarLegendaFoto(eventoId: string, fotoId: string, texto: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, fotoId: id, texto: legenda }), { eventoId, fotoId, texto });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase
    .from("album_photos")
    .update({ caption: v.dados.texto || null })
    .eq("id", fotoId)
    .eq("event_id", eventoId)
    .select("id");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: "Só quem enviou a foto pode mudar a legenda." };
  revalidatePath(`/grupo/${eventoId}/album`);
  return sucesso("Legenda salva.");
}

export async function excluirFotoAlbum(eventoId: string, fotoId: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, fotoId: id }), { eventoId, fotoId });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { data, error } = await s.supabase.from("album_photos").delete().eq("id", fotoId).eq("event_id", eventoId).select("storage_path");
  if (error) return falha(error);
  if (!data?.length) return { ok: false, erro: "Só quem enviou a foto (ou o organizador) pode excluí-la." };
  await s.supabase.storage.from("album").remove(data.map((f) => f.storage_path));
  revalidatePath(`/grupo/${eventoId}/album`);
  return sucesso("Foto excluída.");
}

export async function denunciarFoto(eventoId: string, fotoId: string, motivo: string): Promise<Resultado> {
  const v = validar(z.object({ eventoId: id, fotoId: id, motivo: z.string().trim().max(300, "Use até 300 caracteres.") }), {
    eventoId,
    fotoId,
    motivo,
  });
  if (!v.ok) return v.resultado;
  const s = await cliente();
  if (!s) return NAO_LOGADO;
  const { error } = await s.supabase.rpc("report_content", { p_kind: "photo", p_target: fotoId, p_reason: v.dados.motivo || undefined });
  if (error) return falha(error);
  return sucesso("Denúncia enviada aos organizadores. Obrigado por cuidar do grupo.");
}
