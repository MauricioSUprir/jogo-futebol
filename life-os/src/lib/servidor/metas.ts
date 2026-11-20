// GOALS CENTER — leituras do banco (página, painel, insights e exportação).
import { db } from "@/lib/db";
import type { User } from "@/generated/prisma/client";
import { chaveNoFuso, dataParaChave, diasEntre, inicioDoMes, type ChaveDia } from "@/lib/datas";
import { ordenarMetas, progressoMeta, textoProgresso, type MetaConquista } from "@/lib/metas";
import type { Insight } from "@/lib/insights";

export async function carregarMetas(userId: string) {
  const metas = await db.goal.findMany({
    where: { userId },
    include: { steps: { orderBy: { position: "asc" } } },
    orderBy: { createdAt: "desc" },
  });
  return metas.map((g) => ({
    ...g,
    prazo: g.deadline ? dataParaChave(g.deadline) : null,
    progresso: progressoMeta(g),
    texto: textoProgresso(g),
    criadaEm: g.createdAt.getTime(),
  }));
}

export type MetaCarregada = Awaited<ReturnType<typeof carregarMetas>>[number];

/** Para as conquistas (dia da conclusão na data local). */
export function paraConquistas(metas: MetaCarregada[], tz: string): MetaConquista[] {
  return metas.map((m) => ({
    status: m.status,
    category: m.category,
    year: m.year,
    prazo: m.prazo,
    concluidaEm: m.completedAt ? chaveNoFuso(m.completedAt, tz) : null,
  }));
}

/** As metas ativas de maior prioridade (painel). */
export async function metasEmDestaque(userId: string, n = 3) {
  const ativas = (await carregarMetas(userId)).filter((m) => m.status === "ativo");
  return ordenarMetas(ativas, "prioridade").slice(0, n);
}

export async function insightsMetas(user: User, hojeK: ChaveDia): Promise<Insight[]> {
  const metas = await carregarMetas(user.id);
  const r: Insight[] = [];
  const perto = ordenarMetas(
    metas.filter((m) => m.status === "ativo" && m.prazo && diasEntre(hojeK, m.prazo) >= 0 && diasEntre(hojeK, m.prazo) <= 7 && m.progresso < 100),
    "prazo",
  )[0];
  if (perto) {
    const n = diasEntre(hojeK, perto.prazo!);
    r.push({ tom: "atencao", texto: `A meta "${perto.title}" ${n === 0 ? "vence hoje" : n === 1 ? "vence amanhã" : `vence em ${n} dias`} e está em ${perto.progresso}%.` });
  }
  const mes = inicioDoMes(hojeK);
  const doMes = metas.filter((m) => m.status === "concluido" && m.completedAt && chaveNoFuso(m.completedAt, user.timezone) >= mes).length;
  if (doMes > 0) r.push({ tom: "positivo", texto: `Você concluiu ${doMes} ${doMes === 1 ? "meta" : "metas"} neste mês.` });
  return r.slice(0, 2);
}

export async function exportarMetas(userId: string) {
  const metas = await db.goal.findMany({
    where: { userId },
    include: { steps: { orderBy: { position: "asc" } }, updates: { orderBy: { at: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return { metas };
}
