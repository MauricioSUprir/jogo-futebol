// Preferências do usuário (User.prefs, JSON). Cada módulo guarda as suas numa chave própria
// ("painel", "estudos"…); salvar uma chave nunca apaga as outras.
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";

export type Prefs = Record<string, unknown>;

export function lerPrefs(user: Pick<User, "prefs">): Prefs {
  const p = user.prefs;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Prefs) : {};
}

export function lerPref<T>(user: Pick<User, "prefs">, chave: string): Partial<T> {
  const v = lerPrefs(user)[chave];
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Partial<T>) : {};
}

/** Grava uma chave das preferências mantendo as outras (lê e grava numa transação). */
export async function salvarPref(userId: string, chave: string, valor: unknown): Promise<void> {
  await db.$transaction(async (tx) => {
    const u = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { prefs: true } });
    const atual = lerPrefs(u);
    await tx.user.update({ where: { id: userId }, data: { prefs: { ...atual, [chave]: valor } as object } });
  });
}
