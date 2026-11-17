// Limite de tentativas de login (por usuário e por IP), contado no banco.
import { db } from "@/lib/db";

export const JANELA_MIN = 15;
export const MAX_POR_USUARIO = 5;
export const MAX_POR_IP = 20;

export async function bloqueio(username: string, ip: string | null, kind: "senha" | "codigo"): Promise<number | null> {
  let desde = new Date(Date.now() - JANELA_MIN * 60_000);
  // Um acerto zera a contagem (as falhas antes dele não contam mais).
  const acerto = await db.loginAttempt.findFirst({
    where: { username, kind, success: true, at: { gte: desde } },
    orderBy: { at: "desc" },
    select: { at: true },
  });
  if (acerto) desde = acerto.at;
  const falhas = await db.loginAttempt.findMany({
    where: { username, kind, success: false, at: { gt: desde } },
    orderBy: { at: "asc" },
    select: { at: true },
  });
  if (falhas.length >= MAX_POR_USUARIO) {
    const libera = falhas[falhas.length - MAX_POR_USUARIO].at.getTime() + JANELA_MIN * 60_000;
    return Math.max(1, Math.ceil((libera - Date.now()) / 60_000));
  }
  if (ip) {
    const n = await db.loginAttempt.count({ where: { ip, success: false, at: { gte: desde } } });
    if (n >= MAX_POR_IP) return JANELA_MIN;
  }
  return null;
}

export async function anotarTentativa(username: string, ip: string | null, kind: "senha" | "codigo", success: boolean) {
  await db.loginAttempt.create({ data: { username, ip, kind, success } });
  // limpeza simples: tentativas com mais de 30 dias
  if (Math.random() < 0.05) {
    await db.loginAttempt.deleteMany({ where: { at: { lt: new Date(Date.now() - 30 * 86_400_000) } } });
  }
}
