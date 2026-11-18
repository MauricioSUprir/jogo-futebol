"use server";
// Check-in do dia (energia, humor, estresse, disposição, emoções e observações de saúde).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, diasEntre, hoje, validaChave } from "@/lib/datas";
import { EMOCOES } from "@/lib/checkin";
import type { Estado } from "./tipos";

const nota = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === undefined || v === null ? null : Number(v)), z.number().int().min(min).max(max).nullable());

const esquema = z.object({
  dia: z.string().optional(),
  energia: nota(1, 10),
  humor: nota(1, 5),
  estresse: nota(1, 5),
  disposicao: nota(1, 4),
  notas: z.string().max(2000, "Observações: no máximo 2.000 caracteres.").optional(),
});

export async function salvarCheckin(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquema.safeParse({
    dia: fd.get("dia") ?? undefined,
    energia: fd.get("energia"),
    humor: fd.get("humor"),
    estresse: fd.get("estresse"),
    disposicao: fd.get("disposicao"),
    notas: fd.get("notas") ?? undefined,
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const hojeK = hoje(user.timezone);
  const dia = r.data.dia && validaChave(r.data.dia) ? r.data.dia : hojeK;
  if (diasEntre(dia, hojeK) < 0) return { erro: "Não dá para registrar no futuro." };
  if (diasEntre(dia, hojeK) > 60) return { erro: "Só dá para registrar até 60 dias atrás." };
  const emocoes = fd
    .getAll("emocoes")
    .map(String)
    .filter((e) => (EMOCOES as readonly string[]).includes(e));
  // Só os campos que vieram no formulário mudam (o diário de saúde não apaga o humor e vice-versa).
  const dados: Record<string, unknown> = {};
  if (fd.has("energia")) dados.energy = r.data.energia;
  if (fd.has("humor")) dados.mood = r.data.humor;
  if (fd.has("estresse")) dados.stress = r.data.estresse;
  if (fd.has("disposicao")) dados.disposition = r.data.disposicao;
  if (fd.has("notas")) dados.notes = r.data.notas?.trim() || null;
  if (fd.has("emocoes-enviadas")) dados.emotions = emocoes;
  if (Object.keys(dados).length === 0) return { erro: "Nada para salvar." };
  await db.dailyCheckin.upsert({
    where: { userId_day: { userId: user.id, day: chaveParaData(dia) } },
    create: { userId: user.id, day: chaveParaData(dia), ...dados },
    update: dados,
  });
  for (const p of ["/", "/saude", "/saude/central", "/mente", "/sono"]) revalidatePath(p);
  return { ok: "Check-in salvo." };
}
