"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { sugestoesIa, ideias } from "@/db/schema";
import { contarVideosComMetricas, topVideosParaIa } from "@/lib/analytics";
import { gerarSugestoes } from "@/lib/ai";

export async function gerarSugestoesAction(tema: string) {
  const t = tema.trim();
  if (!t) return { ok: false as const, erro: "Informe um tema." };

  const [count, videos] = await Promise.all([contarVideosComMetricas(), topVideosParaIa(10)]);
  const temSuficiente = count >= 5;

  try {
    const { resposta, payloadEntrada } = await gerarSugestoes({ tema: t, temSuficiente, videos });
    const [row] = await db
      .insert(sugestoesIa)
      .values({ tema: t, payloadEntrada, resposta })
      .returning();
    revalidatePath("/sugestoes");
    return { ok: true as const, id: row.id, resposta, temSuficiente };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Falha ao gerar sugestões.";
    return { ok: false as const, erro: msg };
  }
}

const criarIdeiasSchema = z.object({
  sugestaoId: z.string().uuid(),
  itens: z
    .array(
      z.object({
        titulo: z.string().min(1),
        gancho: z.string().optional().nullable(),
        resumo: z.string().optional().nullable(),
      }),
    )
    .min(1),
});

/** Transforma sugestões selecionadas em cards de ideia (1 clique). */
export async function criarIdeiasDaSugestao(input: z.infer<typeof criarIdeiasSchema>) {
  const parsed = criarIdeiasSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: "Dados inválidos" };
  const { sugestaoId, itens } = parsed.data;

  await db.insert(ideias).values(
    itens.map((i) => ({
      titulo: i.titulo,
      gancho: i.gancho || null,
      resumo: i.resumo || null,
      origem: "sugestão da IA",
      tags: ["ia"],
      status: "ideia" as const,
      sugestaoIaId: sugestaoId,
    })),
  );

  revalidatePath("/ideias");
  return { ok: true as const, criadas: itens.length };
}
