// Leitura dos check-ins do dia (usada pelo painel, Health Center, Mind Center e Sleep Lab).
import { db } from "@/lib/db";
import { chaveParaData, dataParaChave, type ChaveDia } from "@/lib/datas";
import type { Checkin } from "@/lib/checkin";

export async function checkinsDoPeriodo(userId: string, de: ChaveDia, ate: ChaveDia): Promise<Map<ChaveDia, Checkin>> {
  const linhas = await db.dailyCheckin.findMany({
    where: { userId, day: { gte: chaveParaData(de), lte: chaveParaData(ate) } },
    orderBy: { day: "asc" },
  });
  return new Map(
    linhas.map((c) => [
      dataParaChave(c.day),
      {
        dia: dataParaChave(c.day),
        energia: c.energy,
        humor: c.mood,
        estresse: c.stress,
        disposicao: c.disposition,
        emocoes: c.emotions,
        notas: c.notes,
      },
    ]),
  );
}
