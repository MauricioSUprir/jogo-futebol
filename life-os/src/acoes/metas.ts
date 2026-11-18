"use server";
// GOALS CENTER: metas com etapas ou número, progresso, prazo na agenda, concluir, pausar e reabrir.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, hoje, validaChave } from "@/lib/datas";
import { CATEGORIAS_META, metaCumprida } from "@/lib/metas";
import type { Estado } from "./tipos";

function revalidar(id?: string, agenda = false) {
  revalidatePath("/");
  revalidatePath("/metas");
  if (id) revalidatePath(`/metas/${id}`);
  if (agenda) {
    revalidatePath("/agenda");
    revalidatePath("/agenda/foco");
  }
}

const texto = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};
const idDe = (fd: FormData, campo = "id") => String(fd.get(campo) ?? "");

type Tx = Prisma.TransactionClient;

/** O prazo da meta vira evento de dia inteiro na agenda (categoria "meta"); sem prazo, o evento sai. */
async function sincronizarPrazo(tx: Tx, userId: string, meta: { id: string; title: string; deadline: Date | null; eventId: string | null; status: string }) {
  const existe = meta.eventId ? await tx.calendarEvent.findFirst({ where: { id: meta.eventId, userId }, select: { id: true } }) : null;
  if (!meta.deadline || meta.status === "concluido") {
    if (existe) await tx.calendarEvent.delete({ where: { id: existe.id } });
    if (meta.eventId) await tx.goal.update({ where: { id: meta.id }, data: { eventId: null } });
    return;
  }
  const dados = { title: `Meta: ${meta.title}`, category: "meta", allDay: true, start: meta.deadline, end: null, notes: "Prazo de uma meta do Goals Center." };
  if (existe) await tx.calendarEvent.update({ where: { id: existe.id }, data: dados });
  else {
    const ev = await tx.calendarEvent.create({ data: { ...dados, userId } });
    await tx.goal.update({ where: { id: meta.id }, data: { eventId: ev.id } });
  }
}

const esquemaMeta = z
  .object({
    titulo: z.string().min(1, "Dê um nome à meta.").max(120),
    categoria: z.string().refine((c) => c in CATEGORIAS_META, "Categoria inválida."),
    descricao: z.string().max(2000).optional(),
    porque: z.string().max(500).optional(),
    prazo: z.string().refine(validaChave, "Prazo inválido.").optional(),
    ano: z.coerce.number().int().min(2000).max(2100).optional(),
    prioridade: z.coerce.number().int().min(1).max(3).default(2),
    medida: z.enum(["etapas", "numero"]).default("etapas"),
    alvo: z.coerce.number().positive("O alvo precisa ser maior que zero.").max(1e9).optional(),
    atual: z.coerce.number().min(0, "O valor atual não pode ser negativo.").max(1e9).optional(),
    unidade: z.string().max(30).optional(),
  })
  .refine((d) => d.medida !== "numero" || d.alvo !== undefined, { message: "Diga o alvo da meta (ex.: 50)." });

export async function salvarMeta(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const campos = ["titulo", "categoria", "descricao", "porque", "prazo", "prioridade", "medida", "alvo", "atual", "unidade"];
  const b: Record<string, string | undefined> = Object.fromEntries(campos.map((k) => [k, texto(fd.get(k))]));
  if (fd.get("anual") === "on") b.ano = texto(fd.get("ano")) ?? String(Number(hoje(user.timezone).slice(0, 4)));
  const r = esquemaMeta.safeParse(b);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const dados = {
    title: d.titulo,
    category: d.categoria,
    description: d.descricao ?? null,
    why: d.porque ?? null,
    deadline: d.prazo ? chaveParaData(d.prazo) : null,
    year: d.ano ?? null,
    priority: d.prioridade,
    measure: d.medida,
    target: d.medida === "numero" ? d.alvo! : null,
    unit: d.medida === "numero" ? (d.unidade ?? null) : null,
  };
  const id = idDe(fd);
  const etapas = String(fd.get("etapas") ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 30)
    .map((t) => t.slice(0, 120));
  const resultado = await db.$transaction(async (tx) => {
    if (id) {
      const atual = await tx.goal.findFirst({ where: { id, userId: user.id } });
      if (!atual) return null;
      const g = await tx.goal.update({ where: { id }, data: dados });
      await sincronizarPrazo(tx, user.id, g);
      return g.id;
    }
    const total = await tx.goal.count({ where: { userId: user.id } });
    const g = await tx.goal.create({
      data: {
        ...dados,
        userId: user.id,
        current: d.medida === "numero" ? (d.atual ?? 0) : 0,
        position: total,
        steps: d.medida === "etapas" ? { create: etapas.map((t, i) => ({ title: t, position: i })) } : undefined,
      },
    });
    await sincronizarPrazo(tx, user.id, g);
    return g.id;
  });
  if (!resultado) return { erro: "Meta não encontrada." };
  revalidar(resultado, true);
  return { ok: id ? "Meta atualizada." : "Meta criada." };
}

/** Conclui sozinha quando bate o alvo ou termina as etapas (a tela mostra a confirmação e o botão Reabrir). */
async function talvezConcluir(tx: Tx, userId: string, goalId: string): Promise<boolean> {
  const g = await tx.goal.findFirst({ where: { id: goalId, userId }, include: { steps: true } });
  if (!g || g.status !== "ativo") return false;
  if (!metaCumprida({ measure: g.measure, target: g.target, current: g.current, steps: g.steps })) return false;
  const c = await tx.goal.update({ where: { id: g.id }, data: { status: "concluido", completedAt: new Date() } });
  await sincronizarPrazo(tx, userId, c);
  return true;
}

export async function adicionarEtapa(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const goalId = idDe(fd, "meta");
  const titulo = texto(fd.get("titulo"))?.slice(0, 120);
  if (!titulo) return { erro: "Escreva a etapa." };
  const prazo = texto(fd.get("prazo"));
  if (prazo && !validaChave(prazo)) return { erro: "Prazo inválido." };
  const g = await db.goal.findFirst({ where: { id: goalId, userId: user.id }, select: { id: true, measure: true } });
  if (!g) return { erro: "Meta não encontrada." };
  const total = await db.goalStep.count({ where: { goalId } });
  await db.goalStep.create({ data: { goalId, title: titulo, position: total, dueDay: prazo ? chaveParaData(prazo) : null } });
  if (g.measure !== "etapas") await db.goal.update({ where: { id: goalId }, data: { measure: "etapas" } });
  revalidar(goalId);
  return { ok: "Etapa adicionada." };
}

export async function alternarEtapa(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const passo = await db.goalStep.findFirst({ where: { id: idDe(fd), goal: { userId: user.id } } });
  if (!passo) return;
  const feito = fd.get("valor") === "1";
  await db.$transaction(async (tx) => {
    await tx.goalStep.update({ where: { id: passo.id }, data: { done: feito, doneAt: feito ? new Date() : null } });
    if (feito) {
      await tx.goalUpdate.create({ data: { goalId: passo.goalId, note: `Etapa concluída: ${passo.title}` } });
      await talvezConcluir(tx, user.id, passo.goalId);
    }
  });
  revalidar(passo.goalId, true);
}

export async function excluirEtapa(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const passo = await db.goalStep.findFirst({ where: { id: idDe(fd), goal: { userId: user.id } }, select: { id: true, goalId: true } });
  if (!passo) return;
  await db.goalStep.delete({ where: { id: passo.id } });
  revalidar(passo.goalId);
}

const esquemaProgresso = z.object({
  modo: z.enum(["somar", "definir"]).default("somar"),
  valor: z.coerce.number().min(-1e9).max(1e9).optional(),
  nota: z.string().max(500).optional(),
});

export async function registrarProgresso(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const goalId = idDe(fd, "meta");
  const r = esquemaProgresso.safeParse({ modo: texto(fd.get("modo")), valor: texto(fd.get("valor")), nota: texto(fd.get("nota")) });
  if (!r.success) return { erro: r.error.issues[0].message };
  const g = await db.goal.findFirst({ where: { id: goalId, userId: user.id } });
  if (!g) return { erro: "Meta não encontrada." };
  if (g.measure === "numero" && r.data.valor === undefined) return { erro: "Diga o valor." };
  if (g.measure !== "numero" && !r.data.nota) return { erro: "Escreva o que avançou." };
  let concluiu = false;
  await db.$transaction(async (tx) => {
    let valor: number | null = null;
    if (g.measure === "numero" && r.data.valor !== undefined) {
      valor = Math.max(0, r.data.modo === "definir" ? r.data.valor : g.current + r.data.valor);
      await tx.goal.update({ where: { id: g.id }, data: { current: valor } });
    }
    await tx.goalUpdate.create({ data: { goalId: g.id, value: valor, note: r.data.nota ?? null } });
    concluiu = await talvezConcluir(tx, user.id, g.id);
  });
  revalidar(g.id, concluiu);
  return { ok: concluiu ? "Meta concluída! Parabéns." : "Progresso registrado." };
}

export async function mudarStatusMeta(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const acao = String(fd.get("acao") ?? "");
  const status = { concluir: "concluido", pausar: "pausado", retomar: "ativo", reabrir: "ativo" }[acao];
  if (!status) return;
  const id = idDe(fd);
  await db.$transaction(async (tx) => {
    const g = await tx.goal.findFirst({ where: { id, userId: user.id } });
    if (!g) return;
    const novo = await tx.goal.update({
      where: { id },
      data: { status, completedAt: status === "concluido" ? (g.completedAt ?? new Date()) : null },
    });
    await tx.goalUpdate.create({ data: { goalId: id, note: { concluir: "Meta concluída.", pausar: "Meta pausada.", retomar: "Meta retomada.", reabrir: "Meta reaberta." }[acao] } });
    await sincronizarPrazo(tx, user.id, novo);
  });
  revalidar(id, true);
}

export async function excluirMeta(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const g = await db.goal.findFirst({ where: { id: idDe(fd), userId: user.id } });
  if (!g) return;
  await db.$transaction(async (tx) => {
    if (g.eventId) await tx.calendarEvent.deleteMany({ where: { id: g.eventId, userId: user.id } });
    await tx.goal.delete({ where: { id: g.id } });
  });
  revalidar(undefined, true);
  redirect("/metas");
}
