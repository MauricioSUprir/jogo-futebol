"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ideias, conteudos } from "@/db/schema";
import { auth } from "@/auth";

const plataformaZ = z.enum(["youtube", "instagram", "tiktok"]);

const criarIdeiaSchema = z.object({
  titulo: z.string().min(1, "Título obrigatório").max(200),
  gancho: z.string().max(300).optional().nullable(),
  resumo: z.string().max(500).optional().nullable(),
  origem: z.string().max(200).optional().nullable(),
  pilarId: z.string().uuid().optional().nullable(),
  plataformas: z.array(plataformaZ).default([]),
  tags: z.array(z.string()).default([]),
  status: z.enum(["ideia", "aprovada", "descartada"]).default("ideia"),
});

export type CriarIdeiaInput = z.infer<typeof criarIdeiaSchema>;

export async function criarIdeia(input: CriarIdeiaInput) {
  const parsed = criarIdeiaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  }
  const d = parsed.data;
  const [row] = await db
    .insert(ideias)
    .values({
      titulo: d.titulo,
      gancho: d.gancho || null,
      resumo: d.resumo || null,
      origem: d.origem || null,
      pilarId: d.pilarId || null,
      plataformas: d.plataformas,
      tags: d.tags,
      status: d.status,
    })
    .returning();
  revalidatePath("/ideias");
  return { ok: true as const, id: row.id };
}

export async function atualizarStatusIdeia(
  id: string,
  status: "ideia" | "aprovada" | "descartada",
) {
  await db.update(ideias).set({ status }).where(eq(ideias.id, id));
  revalidatePath("/ideias");
  return { ok: true as const };
}

export async function excluirIdeia(id: string) {
  await db.delete(ideias).where(eq(ideias.id, id));
  revalidatePath("/ideias");
  return { ok: true as const };
}

/** Promove uma ideia para o pipeline criando um conteúdo na coluna "roteiro". */
export async function promoverParaPipeline(id: string) {
  const session = await auth();
  const [ideia] = await db.select().from(ideias).where(eq(ideias.id, id)).limit(1);
  if (!ideia) return { ok: false as const, erro: "Ideia não encontrada" };

  const [conteudo] = await db
    .insert(conteudos)
    .values({
      ideiaId: ideia.id,
      tituloFinal: ideia.titulo,
      statusPipeline: "roteiro",
      plataformas: ideia.plataformas,
      pilarId: ideia.pilarId,
      responsavel: session?.user?.name ?? null,
      checklist: {},
    })
    .returning();

  await db.update(ideias).set({ status: "aprovada" }).where(eq(ideias.id, id));
  revalidatePath("/ideias");
  revalidatePath("/pipeline");
  return { ok: true as const, conteudoId: conteudo.id };
}
