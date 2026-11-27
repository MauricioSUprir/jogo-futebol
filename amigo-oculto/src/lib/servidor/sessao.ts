import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { clienteServidor } from "@/lib/supabase/servidor";

/** Usuário da requisição (conferido no servidor de autenticação) — uma vez por requisição. */
export const usuarioAtual = cache(async () => {
  const supabase = await clienteServidor();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
});

export const perfilAtual = cache(async () => {
  const usuario = await usuarioAtual();
  if (!usuario) return null;
  const supabase = await clienteServidor();
  const { data } = await supabase.from("profiles").select("*").eq("id", usuario.id).maybeSingle();
  return data;
});

/** Para páginas que exigem conta: manda para /entrar (voltando para `destino` depois). */
export async function exigirUsuario(destino?: string) {
  const usuario = await usuarioAtual();
  if (!usuario) redirect(`/entrar${destino ? `?proximo=${encodeURIComponent(destino)}` : ""}`);
  return usuario;
}
