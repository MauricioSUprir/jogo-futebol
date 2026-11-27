"use client";
import { clienteNavegador } from "@/lib/supabase/navegador";

const TIPOS = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];

/** Reduz e converte a foto no próprio aparelho (WebP, lado maior ≤ `max`), antes de enviar. */
export async function prepararImagem(arquivo: File, max = 1600, qualidade = 0.85): Promise<{ blob: Blob; largura: number; altura: number }> {
  if (!TIPOS.includes(arquivo.type) && !/\.(jpe?g|png|webp|gif|heic|heif)$/i.test(arquivo.name)) {
    throw new Error("Escolha uma imagem (JPG, PNG, WebP ou GIF).");
  }
  if (arquivo.size > 25 * 1024 * 1024) throw new Error("A imagem é muito grande (máximo 25 MB).");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new Error("Não foi possível abrir esta imagem. Tente outra (JPG ou PNG).");
  }
  const escala = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/webp", qualidade));
  if (!blob) throw new Error("Não foi possível preparar a imagem.");
  return { blob, largura, altura };
}

/**
 * Envia para o bucket público `media` (foto de perfil, capa, lista de desejos) na pasta do próprio usuário.
 * Devolve o caminho para gravar no banco (ex.: "<uid>/capa-<uuid>.webp").
 */
export async function enviarMidia(arquivo: File, prefixo: "avatar" | "capa" | "desejo", max = 1600): Promise<string> {
  const supabase = clienteNavegador();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Entre na sua conta para enviar fotos.");
  const { blob } = await prepararImagem(arquivo, max);
  const caminho = `${data.user.id}/${prefixo}-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("media").upload(caminho, blob, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw new Error("Não foi possível enviar a foto. Tente de novo.");
  return caminho;
}

/** Envia para o álbum privado do grupo: "<eventId>/<uid>/<uuid>.webp". */
export async function enviarFotoAlbum(arquivo: File, eventoId: string): Promise<{ caminho: string; largura: number; altura: number }> {
  const supabase = clienteNavegador();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Entre na sua conta para enviar fotos.");
  const { blob, largura, altura } = await prepararImagem(arquivo, 2000, 0.86);
  const caminho = `${eventoId}/${data.user.id}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from("album").upload(caminho, blob, { contentType: "image/webp" });
  if (error) throw new Error("Não foi possível enviar a foto para o álbum.");
  return { caminho, largura, altura };
}
