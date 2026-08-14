"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { config } from "@/db/schema";
import { requireAdmin } from "@/lib/guard";

export async function salvarConfig(input: { palavrasPorMin: number }) {
  await requireAdmin();
  const schema = z.object({ palavrasPorMin: z.coerce.number().int().min(60).max(400) });
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false as const, erro: "Valor inválido (60–400)." };

  const [existente] = await db.select().from(config).limit(1);
  if (existente) {
    await db.update(config).set({ palavrasPorMin: parsed.data.palavrasPorMin }).where(eq(config.id, existente.id));
  } else {
    await db.insert(config).values({ palavrasPorMin: parsed.data.palavrasPorMin });
  }
  revalidatePath("/config");
  return { ok: true as const };
}
