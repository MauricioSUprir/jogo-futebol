import { db } from "@/lib/db";
import { arquivo, naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { dataParaChave, hoje, horaNoFuso } from "@/lib/datas";
import { linhaCsv } from "@/lib/ics";
import { BEBIDAS } from "@/lib/agua";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  const regs = await db.waterEntry.findMany({ where: { userId: user.id }, orderBy: { at: "asc" } });
  const linhas = [
    linhaCsv(["dia", "hora", "ml", "bebida", "tipo"]),
    ...regs.map((r) => linhaCsv([dataParaChave(r.day), horaNoFuso(r.at, user.timezone), r.amountMl, BEBIDAS[r.beverage] ?? r.beverage, r.kind])),
  ];
  // BOM para o Excel abrir com acentos.
  return arquivo("\uFEFF" + linhas.join("\r\n") + "\r\n", `life-os-agua-${hoje(user.timezone)}.csv`, "text/csv; charset=utf-8");
}
