"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pilares } from "@/db/schema";
import { requireAdmin } from "@/lib/guard";

const pilarSchema = z.object({
  nome: z.string().min(1).max(80),
  descricao: z.string().max(300).optional().nullable(),
  cor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#6366f1"),
});

export async function criarPilar(input: z.infer<typeof pilarSchema>) {
  await requireAdmin();
  const parsed = pilarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  await db.insert(pilares).values({
    nome: parsed.data.nome,
    descricao: parsed.data.descricao || null,
    cor: parsed.data.cor,
  });
  revalidatePath("/pilares");
  return { ok: true as const };
}

export async function atualizarPilar(id: string, input: z.infer<typeof pilarSchema>) {
  await requireAdmin();
  const parsed = pilarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  await db
    .update(pilares)
    .set({ nome: parsed.data.nome, descricao: parsed.data.descricao || null, cor: parsed.data.cor })
    .where(eq(pilares.id, id));
  revalidatePath("/pilares");
  return { ok: true as const };
}

export async function excluirPilar(id: string) {
  await requireAdmin();
  await db.delete(pilares).where(eq(pilares.id, id));
  revalidatePath("/pilares");
  return { ok: true as const };
}
