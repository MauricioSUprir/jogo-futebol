"use server";
// Conta, login, verificação em duas etapas, sessões e perfil.
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/lib/db";
import { conferirSenha, gerarHashSenha, HASH_FICTICIO, problemaNaSenha } from "@/lib/seguranca/senha";
import { cifrar, decifrar, sha256 } from "@/lib/seguranca/cifra";
import {
  conferirTotp,
  gerarCodigosRecuperacao,
  gerarSegredo,
  normalizarCodigoRecuperacao,
  uriOtpauth,
} from "@/lib/seguranca/totp";
import { completarSessao, criarSessao, encerrarSessaoAtual, exigirUsuario, idDaSessaoAtual, sessaoAtual } from "@/lib/servidor/sessao";
import { anotarTentativa, bloqueio } from "@/lib/servidor/limite";
import { registrarAcesso } from "@/lib/servidor/registro";
import { salvarPref } from "@/lib/servidor/prefs";
import { dadosDaRequisicao } from "@/lib/servidor/requisicao";
import { fusoValido, horaParaMinutos, validaHora } from "@/lib/datas";
import type { Estado } from "./tipos";
import { CARTOES_PAINEL } from "@/lib/catalogo";

function destinoSeguro(de: unknown): string {
  if (typeof de !== "string" || !de.startsWith("/") || de.startsWith("//") || de.startsWith("/entrar")) return "/";
  return de;
}

function iguaisSemVazar(a: string, b: string): boolean {
  const ha = Buffer.from(sha256(a), "hex");
  const hb = Buffer.from(sha256(b), "hex");
  return timingSafeEqual(ha, hb);
}

const esquemaConta = z.object({
  token: z.string().min(1, "Informe o código de configuração."),
  nome: z.string().trim().min(1, "Informe seu nome.").max(60),
  usuario: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._-]{3,32}$/, "Usuário: 3 a 32 letras minúsculas, números, ponto, hífen ou _."),
  senha: z.string(),
  confirma: z.string(),
  fuso: z.string().refine(fusoValido, "Fuso horário inválido."),
});

export async function configurarConta(_: Estado, fd: FormData): Promise<Estado> {
  if ((await db.user.count()) > 0) redirect("/entrar");
  const tokenServidor = process.env.LIFEOS_SETUP_TOKEN;
  if (!tokenServidor) return { erro: "O servidor ainda não tem LIFEOS_SETUP_TOKEN no .env. Defina e reinicie." };

  const r = esquemaConta.safeParse(Object.fromEntries(fd));
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  if (!iguaisSemVazar(d.token, tokenServidor)) return { erro: "Código de configuração incorreto." };
  const problema = problemaNaSenha(d.senha);
  if (problema) return { erro: problema };
  if (d.senha !== d.confirma) return { erro: "As senhas não são iguais." };

  const passwordHash = await gerarHashSenha(d.senha);
  let userId: string;
  try {
    userId = await db.$transaction(
      async (tx) => {
        if ((await tx.user.count()) > 0) throw new Error("ja-existe");
        const u = await tx.user.create({
          data: { username: d.usuario, displayName: d.nome, passwordHash, timezone: d.fuso, waterSettings: { create: {} } },
        });
        return u.id;
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    redirect("/entrar");
  }
  await registrarAcesso(userId, "conta_criada");
  await criarSessao(userId);
  redirect("/");
}

export async function entrar(_: Estado, fd: FormData): Promise<Estado> {
  const usuario = String(fd.get("usuario") ?? "").trim().toLowerCase().slice(0, 64);
  const senha = String(fd.get("senha") ?? "").slice(0, 200);
  const de = destinoSeguro(fd.get("de"));
  if (!usuario || !senha) return { erro: "Preencha usuário e senha." };

  const { ip } = await dadosDaRequisicao();
  const minutos = await bloqueio(usuario, ip, "senha");
  const user = await db.user.findUnique({ where: { username: usuario } });
  if (minutos) {
    await registrarAcesso(user?.id ?? null, "bloqueado", "senha");
    return { erro: `Muitas tentativas. Tente de novo em ${minutos} min.` };
  }
  const ok = await conferirSenha(senha, user?.passwordHash ?? HASH_FICTICIO);
  if (!user || !ok) {
    await anotarTentativa(usuario, ip, "senha", false);
    if (user) await registrarAcesso(user.id, "senha_errada");
    return { erro: "Usuário ou senha incorretos." };
  }
  await anotarTentativa(usuario, ip, "senha", true);

  if (user.totpEnabled) {
    await criarSessao(user.id, true);
    redirect(`/entrar/verificar${de !== "/" ? `?de=${encodeURIComponent(de)}` : ""}`);
  }
  await criarSessao(user.id);
  await registrarAcesso(user.id, "entrou");
  redirect(de);
}

export async function verificarCodigo(_: Estado, fd: FormData): Promise<Estado> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (!s.mfaPending) redirect("/");
  const user = s.user;
  const bruto = String(fd.get("codigo") ?? "").trim().slice(0, 32);
  const de = destinoSeguro(fd.get("de"));
  const { ip } = await dadosDaRequisicao();

  const minutos = await bloqueio(user.username, ip, "codigo");
  if (minutos) {
    await registrarAcesso(user.id, "bloqueado", "código");
    return { erro: `Muitas tentativas. Tente de novo em ${minutos} min.` };
  }

  let aceito = false;
  let evento = "entrou";
  const ehRecuperacao = /[a-z]/i.test(bruto) || normalizarCodigoRecuperacao(bruto).length === 10;
  if (ehRecuperacao) {
    const hash = sha256(normalizarCodigoRecuperacao(bruto));
    const usado = await db.recoveryCode.updateMany({
      where: { userId: user.id, codeHash: hash, usedAt: null },
      data: { usedAt: new Date() },
    });
    aceito = usado.count === 1;
    evento = "entrou_codigo_recuperacao";
  } else if (user.totpSecretEnc) {
    const passo = conferirTotp(decifrar(user.totpSecretEnc), bruto, Date.now(), user.totpLastStep);
    if (passo !== null) {
      // Gravação condicional: duas abas com o mesmo código não entram as duas.
      const r = await db.user.updateMany({
        where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: passo } }] },
        data: { totpLastStep: passo },
      });
      aceito = r.count === 1;
    }
  }

  if (!aceito) {
    await anotarTentativa(user.username, ip, "codigo", false);
    await registrarAcesso(user.id, "codigo_errado");
    return { erro: "Código incorreto ou já usado." };
  }
  await anotarTentativa(user.username, ip, "codigo", true);
  await completarSessao(s.id, user.id);
  await registrarAcesso(user.id, evento);
  redirect(de);
}

export async function sair(): Promise<void> {
  const s = await sessaoAtual();
  await encerrarSessaoAtual();
  // A chave do diário (senha extra) sai junto com a sessão.
  (await cookies()).set("lifeos_diario", "", { path: "/mente", maxAge: 0 });
  if (s) await registrarAcesso(s.user.id, "saiu");
  redirect("/entrar");
}

// ───── Segurança (logado) ─────

export async function trocarSenha(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const atual = String(fd.get("atual") ?? "");
  const nova = String(fd.get("nova") ?? "");
  const confirma = String(fd.get("confirma") ?? "");
  if (!(await conferirSenha(atual, user.passwordHash))) return { erro: "A senha atual está errada." };
  const problema = problemaNaSenha(nova);
  if (problema) return { erro: problema };
  if (nova !== confirma) return { erro: "As senhas novas não são iguais." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await gerarHashSenha(nova) } });
  const atualId = await idDaSessaoAtual();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: atualId ?? "" } } });
  await registrarAcesso(user.id, "senha_trocada");
  revalidatePath("/configuracoes/seguranca");
  return { ok: "Senha trocada. As outras sessões foram encerradas." };
}

export type EstadoDoisFatores =
  | { etapa: "inicio"; erro?: string }
  | { etapa: "configurar"; segredo: string; qr: string; erro?: string }
  | { etapa: "codigos"; codigos: string[] };

export async function iniciarDoisFatores(): Promise<EstadoDoisFatores> {
  const user = await exigirUsuario();
  if (user.totpEnabled) return { etapa: "inicio", erro: "A verificação em duas etapas já está ligada." };
  const segredo = gerarSegredo();
  await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: cifrar(segredo), totpLastStep: null } });
  const qr = await QRCode.toString(uriOtpauth(segredo, user.username), {
    type: "svg",
    margin: 1,
    color: { dark: "#080b12", light: "#f8fafc" },
    errorCorrectionLevel: "M",
  });
  return { etapa: "configurar", segredo, qr };
}

export async function confirmarDoisFatores(prev: EstadoDoisFatores, fd: FormData): Promise<EstadoDoisFatores> {
  const user = await exigirUsuario();
  if (prev.etapa !== "configurar" || !user.totpSecretEnc || user.totpEnabled) return { etapa: "inicio" };
  const passo = conferirTotp(decifrar(user.totpSecretEnc), String(fd.get("codigo") ?? ""), Date.now(), null);
  if (passo === null) return { ...prev, erro: "Código incorreto. Confira se o relógio do celular está certo." };
  const codigos = gerarCodigosRecuperacao();
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { totpEnabled: true, totpLastStep: passo } }),
    db.recoveryCode.deleteMany({ where: { userId: user.id } }),
    db.recoveryCode.createMany({ data: codigos.map((c) => ({ userId: user.id, codeHash: sha256(normalizarCodigoRecuperacao(c)) })) }),
  ]);
  await registrarAcesso(user.id, "dois_fatores_ligado");
  revalidatePath("/configuracoes/seguranca");
  return { etapa: "codigos", codigos };
}

async function conferirSenhaECodigo(userId: string, fd: FormData): Promise<string | null> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await conferirSenha(String(fd.get("senha") ?? ""), user.passwordHash))) return "Senha incorreta.";
  if (user.totpEnabled && user.totpSecretEnc) {
    const passo = conferirTotp(decifrar(user.totpSecretEnc), String(fd.get("codigo") ?? ""), Date.now(), user.totpLastStep);
    if (passo === null) return "Código do autenticador incorreto.";
    await db.user.update({ where: { id: userId }, data: { totpLastStep: passo } });
  }
  return null;
}

export async function desligarDoisFatores(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const erro = await conferirSenhaECodigo(user.id, fd);
  if (erro) return { erro };
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { totpEnabled: false, totpSecretEnc: null, totpLastStep: null } }),
    db.recoveryCode.deleteMany({ where: { userId: user.id } }),
  ]);
  await registrarAcesso(user.id, "dois_fatores_desligado");
  revalidatePath("/configuracoes/seguranca");
  return { ok: "Verificação em duas etapas desligada." };
}

export async function novosCodigosRecuperacao(
  _: { erro?: string; codigos?: string[] } | undefined,
  fd: FormData,
): Promise<{ erro?: string; codigos?: string[] }> {
  const user = await exigirUsuario();
  if (!user.totpEnabled) return { erro: "Ligue a verificação em duas etapas primeiro." };
  const erro = await conferirSenhaECodigo(user.id, fd);
  if (erro) return { erro };
  const codigos = gerarCodigosRecuperacao();
  await db.$transaction([
    db.recoveryCode.deleteMany({ where: { userId: user.id } }),
    db.recoveryCode.createMany({ data: codigos.map((c) => ({ userId: user.id, codeHash: sha256(normalizarCodigoRecuperacao(c)) })) }),
  ]);
  await registrarAcesso(user.id, "codigos_recuperacao_novos");
  revalidatePath("/configuracoes/seguranca");
  return { codigos };
}

export async function encerrarSessao(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const atual = await idDaSessaoAtual();
  if (id === atual) return sair();
  await db.session.deleteMany({ where: { id, userId: user.id } });
  await registrarAcesso(user.id, "sessao_encerrada");
  revalidatePath("/configuracoes/seguranca");
}

export async function encerrarOutrasSessoes(): Promise<void> {
  const user = await exigirUsuario();
  const atual = await idDaSessaoAtual();
  await db.session.deleteMany({ where: { userId: user.id, NOT: { id: atual ?? "" } } });
  await registrarAcesso(user.id, "outras_sessoes_encerradas");
  revalidatePath("/configuracoes/seguranca");
}

// ───── Perfil ─────

const esquemaPerfil = z.object({
  nome: z.string().trim().min(1, "Informe seu nome.").max(60),
  fuso: z.string().refine(fusoValido, "Fuso horário inválido."),
  inicioDia: z.string().refine(validaHora, "Hora de início inválida."),
  fimDia: z.string().refine(validaHora, "Hora de fim inválida."),
});

export async function salvarPerfil(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaPerfil.safeParse(Object.fromEntries(fd));
  if (!r.success) return { erro: r.error.issues[0].message };
  if (horaParaMinutos(r.data.fimDia) - horaParaMinutos(r.data.inicioDia) < 60) return { erro: "O dia precisa ter pelo menos 1 hora." };
  await db.user.update({
    where: { id: user.id },
    data: { displayName: r.data.nome, timezone: r.data.fuso, dayStart: r.data.inicioDia, dayEnd: r.data.fimDia },
  });
  await registrarAcesso(user.id, "perfil_alterado");
  revalidatePath("/", "layout");
  return { ok: "Perfil salvo." };
}

export async function salvarPainel(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const ordem = String(fd.get("ordem") ?? "")
    .split(",")
    .filter((c): c is (typeof CARTOES_PAINEL)[number] => (CARTOES_PAINEL as readonly string[]).includes(c));
  const ocultos = CARTOES_PAINEL.filter((c) => fd.get("ver_" + c) !== "on");
  const completa = [...new Set([...ordem, ...CARTOES_PAINEL])];
  await salvarPref(user.id, "painel", { ordem: completa, ocultos });
  revalidatePath("/");
}
