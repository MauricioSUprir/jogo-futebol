"use server";
// MIND CENTER: diário cifrado, "coisas boas do dia" e a senha extra do diário.
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { acessoAoDiario, type AcessoDiario } from "@/lib/servidor/mente";
import { anotarTentativa, bloqueio } from "@/lib/servidor/limite";
import { registrarAcesso } from "@/lib/servidor/registro";
import { dadosDaRequisicao } from "@/lib/servidor/requisicao";
import { chaveParaData, diasEntre, hoje, validaChave } from "@/lib/datas";
import { cifrar, decifrar } from "@/lib/seguranca/cifra";
import { problemaNaSenha } from "@/lib/seguranca/senha";
import {
  COOKIE_DIARIO,
  MINUTOS_DESTRANCADO,
  chaveConfere,
  chaveDaSenha,
  criarVerificador,
  embrulharChave,
  novoSal,
} from "@/lib/seguranca/diario";
import { tipoValido } from "@/lib/mente";
import type { Estado } from "./tipos";

function revalidar() {
  revalidatePath("/");
  revalidatePath("/saude");
  revalidatePath("/mente");
}

function cookieSeguro(): boolean {
  return process.env.LIFEOS_COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production";
}

async function gravarCookie(userId: string, chave: Buffer) {
  (await cookies()).set(COOKIE_DIARIO, embrulharChave(userId, chave), {
    httpOnly: true,
    secure: cookieSeguro(),
    sameSite: "strict",
    path: "/mente",
    maxAge: MINUTOS_DESTRANCADO * 60,
  });
}

async function apagarCookie() {
  (await cookies()).set(COOKIE_DIARIO, "", { httpOnly: true, secure: cookieSeguro(), sameSite: "strict", path: "/mente", maxAge: 0 });
}

/** Dia do formulário (padrão hoje), até 60 dias atrás e nunca no futuro. */
function diaDoForm(fd: FormData, tz: string): string | { erro: string } {
  const hojeK = hoje(tz);
  const bruto = String(fd.get("dia") ?? "");
  const dia = validaChave(bruto) ? bruto : hojeK;
  if (diasEntre(dia, hojeK) < 0) return { erro: "Não dá para registrar no futuro." };
  if (diasEntre(dia, hojeK) > 60) return { erro: "Só dá para registrar até 60 dias atrás." };
  return dia;
}

const NAO_ABERTO = "O diário está trancado. Destranque com a senha do diário para escrever.";

async function cifrarEntrada(acesso: AcessoDiario, titulo: string | null, texto: string) {
  return {
    titleEnc: titulo ? cifrar(titulo, acesso.chave) : null,
    bodyEnc: cifrar(texto, acesso.chave),
    locked: acesso.temSenha,
  };
}

const esquemaEntrada = z.object({
  tipo: z.string().refine(tipoValido, "Tipo de entrada inválido."),
  titulo: z.string().trim().max(120, "Título: no máximo 120 caracteres.").optional(),
  texto: z.string().trim().min(1, "Escreva alguma coisa.").max(20_000, "Texto: no máximo 20.000 caracteres."),
});

export async function salvarEntrada(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const acesso = await acessoAoDiario(user.id);
  if (!acesso.aberto) return { erro: NAO_ABERTO };
  const r = esquemaEntrada.safeParse({ tipo: fd.get("tipo") ?? "diario", titulo: fd.get("titulo") ?? undefined, texto: fd.get("texto") ?? "" });
  if (!r.success) return { erro: r.error.issues[0].message };
  const dia = diaDoForm(fd, user.timezone);
  if (typeof dia !== "string") return dia;
  const dados = { ...(await cifrarEntrada(acesso, r.data.titulo || null, r.data.texto)), kind: r.data.tipo, day: chaveParaData(dia) };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.journalEntry.updateMany({ where: { id, userId: user.id }, data: dados });
    if (n.count === 0) return { erro: "Entrada não encontrada." };
  } else {
    await db.journalEntry.create({ data: { userId: user.id, ...dados } });
  }
  if (acesso.temSenha && acesso.chave) await gravarCookie(user.id, acesso.chave); // escrever renova os 15 min
  revalidar();
  return { ok: id ? "Entrada atualizada." : "Entrada salva." };
}

/** "3 coisas boas do dia": uma entrada do tipo "positivo", uma coisa por linha. */
export async function salvarCoisasBoas(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const acesso = await acessoAoDiario(user.id);
  if (!acesso.aberto) return { erro: NAO_ABERTO };
  const itens = fd
    .getAll("coisa")
    .map((v) => String(v).trim().replace(/\s+/g, " "))
    .filter(Boolean);
  if (itens.length === 0) return { erro: "Escreva pelo menos uma coisa boa." };
  if (itens.some((i) => i.length > 300)) return { erro: "Cada coisa: no máximo 300 caracteres." };
  const dia = diaDoForm(fd, user.timezone);
  if (typeof dia !== "string") return dia;
  await db.journalEntry.create({
    data: { userId: user.id, day: chaveParaData(dia), kind: "positivo", ...(await cifrarEntrada(acesso, null, itens.slice(0, 5).join("\n"))) },
  });
  if (acesso.temSenha && acesso.chave) await gravarCookie(user.id, acesso.chave);
  revalidar();
  return { ok: "Coisas boas guardadas." };
}

export async function excluirEntrada(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.journalEntry.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

// ───── Senha extra ─────

/** Confere a senha do diário com limite de tentativas (a mesma contagem do login, numa chave própria). */
async function conferirSenhaDoDiario(userId: string, username: string, senha: string): Promise<{ chave: Buffer } | { erro: string }> {
  const trava = await db.journalLock.findUnique({ where: { userId } });
  if (!trava) return { erro: "O diário não tem senha extra." };
  const { ip } = await dadosDaRequisicao();
  const chaveLimite = `diario:${username}`;
  const minutos = await bloqueio(chaveLimite, ip, "diario");
  if (minutos) {
    await registrarAcesso(userId, "diario_bloqueado");
    return { erro: `Muitas tentativas. Tente de novo em ${minutos} min.` };
  }
  const chave = await chaveDaSenha(senha, trava.salt);
  if (!chaveConfere(trava.verifier, chave)) {
    await anotarTentativa(chaveLimite, ip, "diario", false);
    await registrarAcesso(userId, "diario_senha_errada");
    return { erro: "Senha do diário incorreta." };
  }
  await anotarTentativa(chaveLimite, ip, "diario", true);
  return { chave };
}

/** Recifra todas as entradas de uma chave para outra (indefinida = a do servidor), numa transação. */
async function recifrarTudo(userId: string, de: Buffer | undefined, para: Buffer | undefined, locked: boolean, trava: () => Promise<unknown>) {
  const entradas = await db.journalEntry.findMany({ where: { userId } });
  const novas = entradas.map((e) => ({
    id: e.id,
    titleEnc: e.titleEnc ? cifrar(decifrar(e.titleEnc, de), para) : null,
    bodyEnc: cifrar(decifrar(e.bodyEnc, de), para),
  }));
  await db.$transaction(async (tx) => {
    for (const n of novas) await tx.journalEntry.update({ where: { id: n.id }, data: { titleEnc: n.titleEnc, bodyEnc: n.bodyEnc, locked } });
    await trava();
  });
}

const esquemaNova = z
  .object({ senha: z.string(), confirma: z.string() })
  .refine((d) => d.senha === d.confirma, { message: "As senhas não conferem." });

export async function ligarSenhaDiario(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  if (fd.get("entendi") !== "1") return { erro: "Confirme que entendeu: esquecendo a senha, as entradas não voltam." };
  const r = esquemaNova.safeParse({ senha: fd.get("senha") ?? "", confirma: fd.get("confirma") ?? "" });
  if (!r.success) return { erro: r.error.issues[0].message };
  const problema = problemaNaSenha(r.data.senha);
  if (problema) return { erro: problema };
  if (await db.journalLock.findUnique({ where: { userId: user.id } })) return { erro: "O diário já tem senha extra." };
  const sal = novoSal();
  const chave = await chaveDaSenha(r.data.senha, sal);
  try {
    await recifrarTudo(user.id, undefined, chave, true, () =>
      db.journalLock.create({ data: { userId: user.id, salt: sal, verifier: criarVerificador(chave) } }),
    );
  } catch {
    return { erro: "Não deu para ligar a senha agora. Nada foi mudado; tente de novo." };
  }
  await registrarAcesso(user.id, "diario_senha_ligada");
  await gravarCookie(user.id, chave);
  revalidar();
  return { ok: "Senha extra ligada. O diário fica aberto por 15 minutos e depois tranca sozinho." };
}

export async function destrancarDiario(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = await conferirSenhaDoDiario(user.id, user.username, String(fd.get("senha") ?? ""));
  if ("erro" in r) return { erro: r.erro };
  await gravarCookie(user.id, r.chave);
  await registrarAcesso(user.id, "diario_destrancado");
  revalidar();
  return { ok: "Diário aberto por 15 minutos." };
}

export async function trancarDiario(): Promise<void> {
  await exigirUsuario();
  await apagarCookie();
  revalidar();
}

export async function trocarSenhaDiario(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaNova.safeParse({ senha: fd.get("nova") ?? "", confirma: fd.get("confirma") ?? "" });
  if (!r.success) return { erro: r.error.issues[0].message };
  const problema = problemaNaSenha(r.data.senha);
  if (problema) return { erro: problema };
  const atual = await conferirSenhaDoDiario(user.id, user.username, String(fd.get("atual") ?? ""));
  if ("erro" in atual) return { erro: atual.erro };
  const sal = novoSal();
  const nova = await chaveDaSenha(r.data.senha, sal);
  try {
    await recifrarTudo(user.id, atual.chave, nova, true, () =>
      db.journalLock.update({ where: { userId: user.id }, data: { salt: sal, verifier: criarVerificador(nova) } }),
    );
  } catch {
    return { erro: "Não deu para trocar a senha agora. Nada foi mudado; tente de novo." };
  }
  await registrarAcesso(user.id, "diario_senha_trocada");
  await gravarCookie(user.id, nova);
  revalidar();
  return { ok: "Senha do diário trocada." };
}

export async function tirarSenhaDiario(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const atual = await conferirSenhaDoDiario(user.id, user.username, String(fd.get("atual") ?? ""));
  if ("erro" in atual) return { erro: atual.erro };
  try {
    await recifrarTudo(user.id, atual.chave, undefined, false, () => db.journalLock.delete({ where: { userId: user.id } }));
  } catch {
    return { erro: "Não deu para tirar a senha agora. Nada foi mudado; tente de novo." };
  }
  await registrarAcesso(user.id, "diario_senha_desligada");
  await apagarCookie();
  revalidar();
  return { ok: "Senha extra desligada. O diário continua cifrado com a chave do servidor." };
}

/** Esqueceu a senha: apaga todas as entradas e a senha extra (os check-ins ficam). */
export async function apagarDiario(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  if (String(fd.get("confirmacao") ?? "").trim().toUpperCase() !== "APAGAR") return { erro: 'Digite APAGAR para confirmar.' };
  await db.$transaction([db.journalEntry.deleteMany({ where: { userId: user.id } }), db.journalLock.deleteMany({ where: { userId: user.id } })]);
  await registrarAcesso(user.id, "diario_apagado");
  await apagarCookie();
  revalidar();
  return { ok: "Diário apagado. Você pode começar de novo." };
}
