"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { roteiros } from "@/db/schema";

const blocosZ = z.object({
  gancho: z.string().default(""),
  contexto: z.string().default(""),
  desenvolvimento: z.string().default(""),
  climax: z.string().default(""),
  cta: z.string().default(""),
});

const salvarSchema = z.object({
  conteudoId: z.string().uuid(),
  blocos: blocosZ,
  legenda: z.string().optional().nullable(),
  hashtags: z.array(z.string()).default([]),
});

/** Cria uma NOVA versão do roteiro (nunca sobrescreve). */
export async function salvarNovaVersao(input: z.infer<typeof salvarSchema>) {
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: parsed.error.issues[0]?.message ?? "Inválido" };
  const d = parsed.data;

  const [ultima] = await db
    .select({ versao: roteiros.versao })
    .from(roteiros)
    .where(eq(roteiros.conteudoId, d.conteudoId))
    .orderBy(desc(roteiros.versao))
    .limit(1);
  const proxima = (ultima?.versao ?? 0) + 1;

  const [row] = await db
    .insert(roteiros)
    .values({
      conteudoId: d.conteudoId,
      versao: proxima,
      blocos: d.blocos,
      legenda: d.legenda || null,
      hashtags: d.hashtags,
    })
    .returning();

  revalidatePath(`/roteiros/${d.conteudoId}`);
  return { ok: true as const, versao: row.versao, id: row.id };
}
