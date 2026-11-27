"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { usuarioAtual } from "@/lib/servidor/sessao";
import { SUPABASE_ANON_KEY, SUPABASE_URL, urlDoSite } from "@/lib/env";
import { falha, objetoDoForm, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";
import { excluirConta } from "@/lib/acoes/contas";

async function origem() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return urlDoSite();
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : urlDoSite();
}

// ---------------------------------------------------------------------------------------------------------------------
// Perfil
// ---------------------------------------------------------------------------------------------------------------------
const esquemaPerfil = z.object({
  nome: z.string().trim().min(1, "Digite seu nome.").max(60, "Use até 60 caracteres."),
  apelido: z.string().trim().max(40, "Use até 40 caracteres.").optional().default(""),
  bio: z.string().trim().max(280, "Use até 280 caracteres.").optional().default(""),
});

export async function atualizarPerfil(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(esquemaPerfil, objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: v.dados.nome, nickname: v.dados.apelido || null, bio: v.dados.bio || null })
    .eq("id", usuario.id);
  if (error) return falha(error, "Não foi possível salvar o perfil.");
  revalidatePath("/", "layout");
  return sucesso("Perfil atualizado!");
}

/** Foto de perfil: o caminho que o navegador acabou de enviar para a pasta da pessoa (ou null para remover). */
export async function definirFotoPerfil(caminho: string | null): Promise<Resultado> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  if (caminho !== null && (typeof caminho !== "string" || caminho.length > 500 || !new RegExp(`^${usuario.id}/avatar-[0-9a-f-]+\\.webp$`, "i").test(caminho))) {
    return falha("avatar_invalido");
  }
  const supabase = await clienteServidor();
  const { data: antes } = await supabase.from("profiles").select("avatar_path").eq("id", usuario.id).maybeSingle();
  const { error } = await supabase.from("profiles").update({ avatar_path: caminho }).eq("id", usuario.id);
  if (error) return falha(error, "Não foi possível salvar a foto.");
  const velho = antes?.avatar_path;
  if (velho && velho !== caminho && velho.startsWith(`${usuario.id}/`)) {
    await supabase.storage.from("media").remove([velho]); // a foto antiga não fica pública à toa
  }
  revalidatePath("/", "layout");
  return sucesso(caminho ? "Foto atualizada!" : "Foto removida.");
}

// ---------------------------------------------------------------------------------------------------------------------
// E-mail e senha (contas completas)
// ---------------------------------------------------------------------------------------------------------------------
export async function alterarEmail(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(z.object({ email: z.email("Informe um e-mail válido.").max(254) }), objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  if (usuario.is_anonymous) return { ok: false, erro: "Salve sua conta primeiro (seção acima)." };
  const novo = v.dados.email.trim().toLowerCase();
  if (novo === (usuario.email ?? "").toLowerCase()) return { ok: false, erro: "Este já é o seu e-mail.", campos: { email: "Este já é o seu e-mail." } };
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ email: novo }, { emailRedirectTo: `${await origem()}/auth/callback?proximo=/conta` });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { ok: false, erro: "Este e-mail já tem uma conta.", campos: { email: "Este e-mail já tem uma conta." } };
    if (/rate|too many|seconds/i.test(error.message)) return falha("rate_limited");
    return falha(error, "Não foi possível trocar o e-mail agora.");
  }
  revalidatePath("/conta");
  return sucesso("Enviamos um link de confirmação. O e-mail só muda depois de você confirmar (olhe também o endereço atual).");
}

const senhaForte = z
  .string()
  .min(8, "A senha precisa de pelo menos 8 caracteres.")
  .max(72, "Use até 72 caracteres.")
  .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
  .regex(/[0-9]/, "Use pelo menos um número.");

export async function alterarSenha(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(
    z
      .object({ atual: z.string().max(200).optional().default(""), nova: senhaForte, confirmar: z.string() })
      .refine((d) => d.nova === d.confirmar, { message: "As senhas não conferem.", path: ["confirmar"] }),
    objetoDoForm(form),
  );
  if (!v.ok) return v.resultado;
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  if (usuario.is_anonymous || !usuario.email) return { ok: false, erro: "Salve sua conta primeiro (seção acima)." };

  // Quem já entra com senha confirma a atual (num cliente à parte, que não mexe na sessão desta página).
  const temSenha = (usuario.identities ?? []).some((i) => i.provider === "email");
  if (temSenha) {
    if (!v.dados.atual) return { ok: false, erro: "Confira os campos destacados.", campos: { atual: "Digite a senha atual." } };
    const conferir = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const { error } = await conferir.auth.signInWithPassword({ email: usuario.email, password: v.dados.atual });
    if (error) {
      if (/rate|too many/i.test(error.message)) return falha("rate_limited");
      return { ok: false, erro: "A senha atual não confere.", campos: { atual: "A senha atual não confere." } };
    }
    await conferir.auth.signOut({ scope: "local" });
  }

  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ password: v.dados.nova });
  if (error) {
    if (/same/i.test(error.message)) return { ok: false, erro: "A nova senha precisa ser diferente da atual.", campos: { nova: "Use uma senha diferente da atual." } };
    if (/reauth/i.test(error.message)) return { ok: false, erro: "Por segurança, saia e entre de novo antes de trocar a senha." };
    if (/weak|pwned/i.test(error.message)) return { ok: false, erro: "Escolha uma senha mais forte (evite senhas conhecidas).", campos: { nova: "Senha fraca." } };
    return falha(error, "Não foi possível trocar a senha agora.");
  }
  return sucesso(temSenha ? "Senha alterada!" : "Senha criada! Agora você também entra com e-mail e senha.");
}

// ---------------------------------------------------------------------------------------------------------------------
// Configurações (user_settings): aparência, efeitos e e-mail
// ---------------------------------------------------------------------------------------------------------------------
async function salvarAjustes(campos: {
  color_mode?: "system" | "light" | "dark";
  sound_effects?: boolean;
  vibration?: boolean;
  reduce_motion?: boolean;
  notify_email?: boolean;
}): Promise<Resultado> {
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { error } = await supabase.from("user_settings").upsert({ user_id: usuario.id, ...campos }, { onConflict: "user_id" });
  if (error) return falha(error, "Não foi possível salvar.");
  revalidatePath("/", "layout");
  return sucesso("Salvo!");
}

export async function salvarAparencia(modo: "system" | "light" | "dark"): Promise<Resultado> {
  if (!["system", "light", "dark"].includes(modo)) return falha("invalid_mode");
  return salvarAjustes({ color_mode: modo });
}

export async function salvarEfeitos(efeitos: { som: boolean; vibracao: boolean; menosMovimento: boolean }): Promise<Resultado> {
  const v = z.object({ som: z.boolean(), vibracao: z.boolean(), menosMovimento: z.boolean() }).safeParse(efeitos);
  if (!v.success) return falha("invalid_action");
  return salvarAjustes({ sound_effects: v.data.som, vibration: v.data.vibracao, reduce_motion: v.data.menosMovimento });
}

export async function salvarEmailNotificacoes(ligado: boolean): Promise<Resultado> {
  if (typeof ligado !== "boolean") return falha("invalid_action");
  return salvarAjustes({ notify_email: ligado });
}

// ---------------------------------------------------------------------------------------------------------------------
// Exclusão da conta (LGPD)
// ---------------------------------------------------------------------------------------------------------------------
/**
 * Antes de chamar a exclusão (excluirConta, que confere as regras e apaga o usuário), apaga as fotos da pessoa no
 * bucket público (perfil e lista de desejos) — sem isso os arquivos continuariam acessíveis pelo link. Só apaga se as
 * mesmas regras da exclusão deixarem (nada de perder as fotos e continuar com a conta).
 */
export async function excluirMinhaConta(estado: unknown, form: FormData): Promise<Resultado> {
  if (form.get("confirmacao") !== "EXCLUIR") return { ok: false, erro: "Digite EXCLUIR para confirmar.", campos: { confirmacao: "Digite EXCLUIR." } };
  const usuario = await usuarioAtual();
  if (!usuario) return falha("not_authenticated");
  const supabase = await clienteServidor();
  const { data: meus, error: erroLeitura } = await supabase
    .from("participants")
    .select("status, events!participants_event_id_fkey!inner(status, archived_at, owner_id)")
    .eq("user_id", usuario.id);
  if (erroLeitura) return falha(erroLeitura, "Não foi possível conferir seus grupos agora. Tente de novo.");
  const bloqueio = (meus ?? []).some((p) => {
    const ev = p.events as unknown as { status: string; archived_at: string | null; owner_id: string | null };
    return (p.status === "approved" && ev.status === "drawn" && !ev.archived_at) || (ev.owner_id === usuario.id && !ev.archived_at && ev.status !== "finished");
  });
  if (!bloqueio) {
    const { data: arquivos } = await supabase.storage.from("media").list(usuario.id, { limit: 1000 });
    const caminhos = (arquivos ?? []).filter((a) => a.name && a.id).map((a) => `${usuario.id}/${a.name}`);
    if (caminhos.length) await supabase.storage.from("media").remove(caminhos);
  }
  return excluirConta(estado, form);
}
