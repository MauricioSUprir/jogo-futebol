// Sessões no banco (revogáveis), cookie httpOnly com um token aleatório; o banco guarda só o SHA-256.
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { sha256, tokenAleatorio } from "@/lib/seguranca/cifra";
import { dadosDaRequisicao } from "./requisicao";
import type { User } from "@/generated/prisma/client";

export const COOKIE_SESSAO = "lifeos_sessao";
export const DIAS_SESSAO = 30;
const MINUTOS_PENDENTE = 5;
const RENOVAR_A_CADA_MS = 10 * 60_000;

function cookieSeguro(): boolean {
  return process.env.LIFEOS_COOKIE_SECURE !== "0" && process.env.NODE_ENV === "production";
}

export async function criarSessao(userId: string, mfaPending = false): Promise<void> {
  const token = tokenAleatorio(32);
  const { ip, userAgent } = await dadosDaRequisicao();
  const expiresAt = new Date(Date.now() + (mfaPending ? MINUTOS_PENDENTE * 60_000 : DIAS_SESSAO * 86_400_000));
  await db.session.create({ data: { id: sha256(token), userId, expiresAt, mfaPending, ip, userAgent } });
  const c = await cookies();
  c.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: cookieSeguro(),
    sameSite: "lax",
    path: "/",
    maxAge: DIAS_SESSAO * 86_400,
  });
}

/** Troca a sessão pendente (senha ok) por uma completa (código ok). */
export async function completarSessao(sessaoId: string, userId: string): Promise<void> {
  await db.session.delete({ where: { id: sessaoId } }).catch(() => {});
  await criarSessao(userId, false);
}

export async function idDaSessaoAtual(): Promise<string | null> {
  const token = (await cookies()).get(COOKIE_SESSAO)?.value;
  return token ? sha256(token) : null;
}

export interface Sessao {
  id: string;
  mfaPending: boolean;
  user: User;
}

/** A sessão desta requisição (uma consulta por requisição). */
export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const id = await idDaSessaoAtual();
  if (!id) return null;
  const s = await db.session.findUnique({ where: { id }, include: { user: true } });
  if (!s) return null;
  if (s.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  if (!s.mfaPending && Date.now() - s.lastSeenAt.getTime() > RENOVAR_A_CADA_MS) {
    await db.session.update({
      where: { id },
      data: { lastSeenAt: new Date(), expiresAt: new Date(Date.now() + DIAS_SESSAO * 86_400_000) },
    });
  }
  return { id: s.id, mfaPending: s.mfaPending, user: s.user };
});

/** Usuário logado (com os dois fatores, se ligados); senão manda para o login. */
export async function exigirUsuario(): Promise<User> {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (s.mfaPending) redirect("/entrar/verificar");
  return s.user;
}

export async function encerrarSessaoAtual(): Promise<void> {
  const id = await idDaSessaoAtual();
  if (id) await db.session.delete({ where: { id } }).catch(() => {});
  (await cookies()).delete(COOKIE_SESSAO);
}
