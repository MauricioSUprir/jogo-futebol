"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { clienteServidor } from "@/lib/supabase/servidor";
import { clienteAdmin } from "@/lib/supabase/admin";
import { urlDoSite } from "@/lib/env";
import { falha, objetoDoForm, sucesso, validar, type Resultado } from "@/lib/acoes/resultado";
import { usuarioAtual } from "@/lib/servidor/sessao";

/** Só caminhos internos (evita redirecionamento aberto). */
function destinoSeguro(proximo: string | undefined | null, padrao = "/painel") {
  if (!proximo || !proximo.startsWith("/") || proximo.startsWith("//") || proximo.startsWith("/\\")) return padrao;
  return proximo;
}

async function origem() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return process.env.NEXT_PUBLIC_SITE_URL ? urlDoSite() : host ? `${proto}://${host}` : urlDoSite();
}

const esquemaEntrar = z.object({
  email: z.email("Informe um e-mail válido.").max(254),
  senha: z.string().min(1, "Informe a senha.").max(200),
  proximo: z.string().optional(),
});

export async function entrar(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(esquemaEntrar, objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: v.dados.email.trim().toLowerCase(), password: v.dados.senha });
  if (error) {
    if (/confirm/i.test(error.message)) return { ok: false, erro: "Confirme seu e-mail antes de entrar (veja sua caixa de entrada)." };
    if (/rate|too many/i.test(error.message)) return { ok: false, erro: "Muitas tentativas. Aguarde alguns minutos." };
    return { ok: false, erro: "E-mail ou senha incorretos." };
  }
  redirect(destinoSeguro(v.dados.proximo));
}

const esquemaCadastro = z
  .object({
    nome: z.string().trim().min(2, "Digite seu nome.").max(60, "Use até 60 caracteres."),
    email: z.email("Informe um e-mail válido.").max(254),
    senha: z
      .string()
      .min(8, "A senha precisa de pelo menos 8 caracteres.")
      .max(72, "Use até 72 caracteres.")
      .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
      .regex(/[0-9]/, "Use pelo menos um número."),
    confirmar: z.string(),
    termos: z.literal("1", { message: "Aceite os termos para continuar." }),
    proximo: z.string().optional(),
  })
  .refine((d) => d.senha === d.confirmar, { message: "As senhas não conferem.", path: ["confirmar"] });

export async function cadastrar(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(esquemaCadastro, objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const supabase = await clienteServidor();
  const destino = destinoSeguro(v.dados.proximo);
  const { data, error } = await supabase.auth.signUp({
    email: v.dados.email.trim().toLowerCase(),
    password: v.dados.senha,
    options: {
      data: { display_name: v.dados.nome },
      emailRedirectTo: `${await origem()}/auth/callback?proximo=${encodeURIComponent(destino)}`,
    },
  });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { ok: false, erro: "Este e-mail já tem conta. Entre ou recupere a senha." };
    if (/weak|pwned|password/i.test(error.message)) return { ok: false, erro: "Escolha uma senha mais forte (evite senhas conhecidas)." };
    return falha(error, "Não foi possível criar a conta agora.");
  }
  if (data.session) redirect(destino);
  return sucesso("Conta criada! Enviamos um link de confirmação para o seu e-mail.");
}

export async function recuperarSenha(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(z.object({ email: z.email("Informe um e-mail válido.").max(254) }), objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const supabase = await clienteServidor();
  await supabase.auth.resetPasswordForEmail(v.dados.email.trim().toLowerCase(), {
    redirectTo: `${await origem()}/auth/callback?proximo=/atualizar-senha`,
  });
  // Mesma resposta exista ou não a conta (não revela quem tem cadastro).
  return sucesso("Se houver uma conta com este e-mail, você vai receber um link para criar uma nova senha.");
}

const esquemaNovaSenha = z
  .object({
    senha: z
      .string()
      .min(8, "A senha precisa de pelo menos 8 caracteres.")
      .max(72)
      .regex(/[A-Za-z]/, "Use pelo menos uma letra.")
      .regex(/[0-9]/, "Use pelo menos um número."),
    confirmar: z.string(),
  })
  .refine((d) => d.senha === d.confirmar, { message: "As senhas não conferem.", path: ["confirmar"] });

export async function atualizarSenha(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(esquemaNovaSenha, objetoDoForm(form));
  if (!v.ok) return v.resultado;
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser({ password: v.dados.senha });
  if (error) {
    if (/same/i.test(error.message)) return { ok: false, erro: "A nova senha precisa ser diferente da atual." };
    return falha(error, "Não foi possível trocar a senha. Abra o link do e-mail de novo.");
  }
  return sucesso("Senha atualizada!");
}

/** Convidado (login anônimo) vira conta completa: e-mail + senha, mantendo grupos, lista e mensagens. */
export async function salvarContaConvidado(_: unknown, form: FormData): Promise<Resultado> {
  const v = validar(
    z
      .object({
        email: z.email("Informe um e-mail válido.").max(254),
        senha: z.string().min(8, "A senha precisa de pelo menos 8 caracteres.").max(72).regex(/[A-Za-z]/, "Use pelo menos uma letra.").regex(/[0-9]/, "Use pelo menos um número."),
      }),
    objetoDoForm(form),
  );
  if (!v.ok) return v.resultado;
  const usuario = await usuarioAtual();
  if (!usuario?.is_anonymous) return { ok: false, erro: "Sua conta já está completa." };
  const supabase = await clienteServidor();
  const { error } = await supabase.auth.updateUser(
    { email: v.dados.email.trim().toLowerCase(), password: v.dados.senha },
    { emailRedirectTo: `${await origem()}/auth/callback?proximo=/conta` },
  );
  if (error) {
    if (/already|registered|exists/i.test(error.message)) return { ok: false, erro: "Este e-mail já tem uma conta. Use outro." };
    return falha(error, "Não foi possível salvar sua conta agora.");
  }
  return sucesso("Pronto! Se pedirmos, confirme pelo link enviado ao seu e-mail.");
}

export async function sair() {
  const supabase = await clienteServidor();
  await supabase.auth.signOut();
  redirect("/");
}

/** Exclusão da conta (LGPD). Bloqueada enquanto a pessoa estiver num sorteio em andamento ou organizar grupo ativo. */
export async function excluirConta(_: unknown, form: FormData): Promise<Resultado> {
  if (form.get("confirmacao") !== "EXCLUIR") return { ok: false, erro: "Digite EXCLUIR para confirmar.", campos: { confirmacao: "Digite EXCLUIR." } };
  const usuario = await usuarioAtual();
  if (!usuario) return { ok: false, erro: "Entre na sua conta." };
  const supabase = await clienteServidor();
  const { data: meus } = await supabase
    .from("participants")
    .select("status, events!inner(status, archived_at, owner_id, name)")
    .eq("user_id", usuario.id);
  for (const p of meus ?? []) {
    const ev = p.events as unknown as { status: string; archived_at: string | null; owner_id: string | null; name: string };
    if (p.status === "approved" && ev.status === "drawn" && !ev.archived_at) {
      return { ok: false, erro: `Você está no sorteio de "${ev.name}". Exclua a conta depois que o evento terminar.` };
    }
    if (ev.owner_id === usuario.id && !ev.archived_at && ev.status !== "finished") {
      return { ok: false, erro: `Você organiza "${ev.name}". Arquive ou exclua o grupo antes.` };
    }
  }
  const { error } = await clienteAdmin().auth.admin.deleteUser(usuario.id);
  if (error) return falha(error, "Não foi possível excluir a conta agora.");
  await supabase.auth.signOut();
  redirect("/?conta=excluida");
}
