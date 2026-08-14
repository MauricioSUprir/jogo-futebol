"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { conteudos } from "@/db/schema";

const colunaZ = z.enum(["ideia", "roteiro", "gravar", "editar", "agendado", "publicado"]);
const plataformaZ = z.enum(["youtube", "instagram", "tiktok"]);
const formatoZ = z.enum(["short", "reel", "video_longo"]);

/** Move um card para uma coluna e o insere no topo; renumera ordem. */
export async function moverConteudo(id: string, coluna: z.infer<typeof colunaZ>) {
  const col = colunaZ.parse(coluna);
  // Empurra todos os cards existentes da coluna 1 posição para baixo.
  await db
    .update(conteudos)
    .set({ ordem: sql`${conteudos.ordem} + 1`, updatedAt: new Date() })
    .where(eq(conteudos.statusPipeline, col));
  const patch: Record<string, unknown> = { statusPipeline: col, ordem: 0, updatedAt: new Date() };
  // Ao marcar como publicado, registra data de publicação se ainda não houver.
  if (col === "publicado") {
    patch.dataPublicacao = sql`COALESCE(${conteudos.dataPublicacao}, CURRENT_DATE)`;
  }
  await db.update(conteudos).set(patch).where(eq(conteudos.id, id));
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  return { ok: true as const };
}

const criarConteudoSchema = z.object({
  tituloFinal: z.string().min(1).max(200),
  formato: formatoZ.default("short"),
  plataformas: z.array(plataformaZ).default([]),
  dataPrevista: z.string().optional().nullable(),
  responsavel: z.string().optional().nullable(),
  pilarId: z.string().uuid().optional().nullable(),
});

export async function criarConteudo(input: z.infer<typeof criarConteudoSchema>) {
  const parsed = criarConteudoSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  const d = parsed.data;
  const [row] = await db
    .insert(conteudos)
    .values({
      tituloFinal: d.tituloFinal,
      formato: d.formato,
      plataformas: d.plataformas,
      dataPrevista: d.dataPrevista || null,
      responsavel: d.responsavel || null,
      pilarId: d.pilarId || null,
      statusPipeline: "ideia",
      checklist: {},
    })
    .returning();
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  return { ok: true as const, id: row.id };
}

const atualizarSchema = z.object({
  id: z.string().uuid(),
  tituloFinal: z.string().min(1).max(200).optional(),
  formato: formatoZ.optional(),
  plataformas: z.array(plataformaZ).optional(),
  dataPrevista: z.string().nullable().optional(),
  responsavel: z.string().nullable().optional(),
  pilarId: z.string().uuid().nullable().optional(),
  checklist: z.record(z.boolean()).optional(),
});

export async function atualizarConteudo(input: z.infer<typeof atualizarSchema>) {
  const parsed = atualizarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  const { id, ...rest } = parsed.data;
  const patch: Record<string, unknown> = { updatedAt: new Date() };
  for (const [k, v] of Object.entries(rest)) {
    if (v !== undefined) patch[k] = v === "" ? null : v;
  }
  await db.update(conteudos).set(patch).where(eq(conteudos.id, id));
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  return { ok: true as const };
}

export async function excluirConteudo(id: string) {
  await db.delete(conteudos).where(eq(conteudos.id, id));
  revalidatePath("/pipeline");
  revalidatePath("/calendario");
  return { ok: true as const };
}
