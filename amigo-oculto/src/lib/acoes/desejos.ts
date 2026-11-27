"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { falha, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";
import {
  LIMITE_CORES,
  LIMITE_DESEJOS,
  LIMITE_ETIQUETAS,
  normalizarEtiquetas,
  normalizarLink,
  precoDeTexto,
} from "@/components/desejos/regras";

function revalidar() {
  revalidatePath("/lista-de-desejos");
  revalidatePath("/painel");
}

/** Foto enviada pelo próprio usuário para a lista (bucket público "media", pasta dele). */
function fotoDoUsuario(caminho: string | null | undefined, uid: string) {
  if (!caminho) return true;
  return caminho.length <= 500 && caminho.startsWith(`${uid}/desejo-`) && /^[0-9a-f-]+\/desejo-[0-9a-f-]+\.webp$/i.test(caminho);
}

async function apagarFotos(caminhos: (string | null | undefined)[]) {
  const lista = caminhos.filter((c): c is string => !!c && !/^https:\/\//.test(c));
  if (!lista.length) return;
  const supabase = await clienteServidor();
  await supabase.storage.from("media").remove(lista); // falhar aqui não desfaz a mudança na lista
}

const esquemaDesejo = z.object({
  id: z.uuid().optional(),
  titulo: z.string().trim().min(1, "Dê um nome ao presente.").max(120, "Use até 120 caracteres."),
  observacao: z.string().trim().max(500, "Use até 500 caracteres.").optional().default(""),
  link: z.string().trim().max(1000, "Link muito longo.").optional().default(""),
  preco: z.string().trim().max(20).optional().default(""),
  imagem: z.string().max(500).nullable().optional(),
});

export type EntradaDesejo = z.input<typeof esquemaDesejo>;

/** Cria ou edita um item da lista de desejos. */
export async function salvarDesejo(entrada: EntradaDesejo): Promise<Resultado<{ id: string }>> {
  const v = validar(esquemaDesejo, entrada);
  if (!v.ok) return v.resultado;
  const d = v.dados;
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");

  const link = d.link ? normalizarLink(d.link) : null;
  if (d.link && !link) return { ok: false, erro: "Confira os campos destacados.", campos: { link: "Use um link que comece com https://." } };
  const preco = precoDeTexto(d.preco);
  if (preco !== null && (Number.isNaN(preco) || preco > 99_999_999)) {
    return { ok: false, erro: "Confira os campos destacados.", campos: { preco: "Informe um valor em reais, por exemplo 89,90." } };
  }
  if (!fotoDoUsuario(d.imagem, usuario.id)) return falha("avatar_invalido");

  const supabase = await clienteServidor();
  const linha = {
    title: d.titulo,
    notes: d.observacao || null,
    url: link,
    price_estimate: preco,
    image_path: d.imagem ?? null,
  };

  if (d.id) {
    const { data: antes } = await supabase.from("wishlist_items").select("image_path").eq("id", d.id).eq("user_id", usuario.id).maybeSingle();
    if (!antes) return falha("not_found");
    const { error } = await supabase.from("wishlist_items").update(linha).eq("id", d.id).eq("user_id", usuario.id);
    if (error) {
      if (linha.image_path && linha.image_path !== antes.image_path) await apagarFotos([linha.image_path]);
      return falha(error, "Não foi possível salvar o item.");
    }
    if (antes.image_path && antes.image_path !== linha.image_path) await apagarFotos([antes.image_path]);
    revalidar();
    return sucesso("Item atualizado.", { id: d.id });
  }

  const { data: ultimo } = await supabase
    .from("wishlist_items")
    .select("position")
    .eq("user_id", usuario.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data, error } = await supabase
    .from("wishlist_items")
    .insert({ ...linha, user_id: usuario.id, position: (ultimo?.position ?? -1) + 1 })
    .select("id")
    .single();
  if (error) {
    await apagarFotos([linha.image_path]);
    return falha(error, "Não foi possível adicionar o item.");
  }
  revalidar();
  return sucesso("Adicionado à sua lista!", { id: data.id });
}

export async function excluirDesejo(id: string): Promise<Resultado> {
  if (!z.uuid().safeParse(id).success) return falha("not_found");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data, error } = await supabase.from("wishlist_items").delete().eq("id", id).eq("user_id", usuario.id).select("image_path");
  if (error) return falha(error, "Não foi possível remover o item.");
  await apagarFotos((data ?? []).map((d) => d.image_path));
  revalidar();
  return sucesso("Item removido.");
}

/** Nova ordem de preferência: `ids` do mais desejado para o menos. */
export async function reordenarDesejos(ids: string[]): Promise<Resultado> {
  if (!Array.isArray(ids) || ids.length > LIMITE_DESEJOS || !ids.every((i) => z.uuid().safeParse(i).success)) return falha("invalid_action");
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data: meus, error } = await supabase.from("wishlist_items").select("id, position").eq("user_id", usuario.id);
  if (error) return falha(error);
  const atuais = new Map((meus ?? []).map((m) => [m.id, m.position]));
  if (ids.length !== atuais.size || new Set(ids).size !== ids.length || !ids.every((i) => atuais.has(i))) {
    return { ok: false, erro: "Sua lista mudou em outra aba. Atualize a página e tente de novo." };
  }
  const mudar = ids.map((id, posicao) => ({ id, posicao })).filter((x) => atuais.get(x.id) !== x.posicao);
  const resultados = await Promise.all(
    mudar.map((x) => supabase.from("wishlist_items").update({ position: x.posicao }).eq("id", x.id).eq("user_id", usuario.id)),
  );
  const erro = resultados.find((r) => r.error)?.error;
  if (erro) return falha(erro, "Não foi possível salvar a nova ordem.");
  revalidar();
  return sucesso("Ordem salva.");
}

const lista = (limite: number, tamanho = 40) =>
  z
    .array(z.string().max(200))
    .max(100)
    .optional()
    .default([])
    .transform((l) => normalizarEtiquetas(l, limite, tamanho));

const tamanho = z.string().trim().max(10, "Use até 10 caracteres.").optional().default("");

const esquemaPreferencias = z.object({
  hobbies: lista(LIMITE_ETIQUETAS),
  interesses: lista(LIMITE_ETIQUETAS),
  cores: lista(LIMITE_CORES, 30),
  naoQuero: lista(LIMITE_ETIQUETAS, 60),
  camiseta: tamanho,
  calca: tamanho,
  calcado: tamanho,
  observacoes: z.string().trim().max(1000, "Use até 1000 caracteres.").optional().default(""),
});

export type EntradaPreferencias = z.input<typeof esquemaPreferencias>;

/** Preferências de presente: hobbies, interesses, cores, tamanhos (opcionais), o que não quer e observações. */
export async function salvarPreferencias(entrada: EntradaPreferencias): Promise<Resultado> {
  const v = validar(esquemaPreferencias, entrada);
  if (!v.ok) return v.resultado;
  const d = v.dados;
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("gift_preferences").upsert(
    {
      user_id: usuario.id,
      hobbies: d.hobbies,
      interests: d.interesses,
      favorite_colors: d.cores,
      dislikes: d.naoQuero,
      shirt_size: d.camiseta || null,
      pants_size: d.calca || null,
      shoe_size: d.calcado || null,
      notes: d.observacoes || null,
    },
    { onConflict: "user_id" },
  );
  if (error) return falha(error, "Não foi possível salvar suas preferências.");
  revalidar();
  return sucesso("Preferências salvas!");
}
