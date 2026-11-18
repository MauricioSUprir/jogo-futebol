"use server";
// Sleep Lab: registrar, editar e apagar noites; configurar meta, horários, dias de aula e lembrete.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, diasEntre, hoje, validaChave, validaHora } from "@/lib/datas";
import { NA_CAMA_MAX, NA_CAMA_MIN, diasParaBits, instantesDaNoite, minutosNaCama } from "@/lib/sono";
import type { Estado } from "./tipos";

function revalidar() {
  for (const p of ["/", "/saude", "/saude/central", "/sono"]) revalidatePath(p);
}

const vazio = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};

const inteiroOpcional = (min: number, max: number, msg: string) =>
  z.preprocess((v) => (v === undefined ? null : Number(v)), z.number({ message: msg }).int(msg).min(min, msg).max(max, msg).nullable());

const esquemaNoite = z.object({
  dia: z.string().refine(validaChave, "Data inválida."),
  deitou: z.string().refine(validaHora, "Horário de dormir inválido."),
  acordou: z.string().refine(validaHora, "Horário de acordar inválido."),
  latencia: inteiroOpcional(0, 240, "Tempo até dormir: de 0 a 240 min."),
  despertares: inteiroOpcional(0, 30, "Despertares: de 0 a 30."),
  qualidade: inteiroOpcional(1, 5, "Qualidade: de 1 a 5."),
  notas: z.string().max(2000, "Diário de sono: no máximo 2.000 caracteres.").optional(),
});

export async function salvarNoite(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const bruto: Record<string, string | undefined> = {};
  for (const k of ["dia", "deitou", "acordou", "latencia", "despertares", "qualidade", "notas"]) bruto[k] = vazio(fd.get(k));
  const r = esquemaNoite.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const tz = user.timezone;
  const hojeK = hoje(tz);
  if (diasEntre(d.dia, hojeK) < 0) return { erro: "Não dá para registrar uma noite que ainda não terminou." };
  if (diasEntre(d.dia, hojeK) > 60) return { erro: "Só dá para registrar até 60 dias atrás." };
  const { deitou, acordou } = instantesDaNoite(d.dia, d.deitou, d.acordou, tz);
  if (acordou.getTime() > Date.now() + 5 * 60_000) return { erro: "Esse horário de acordar ainda não chegou." };
  const naCama = minutosNaCama({ deitou, acordou });
  if (naCama < NA_CAMA_MIN) return { erro: "Uma noite precisa ter pelo menos 1 hora." };
  if (naCama > NA_CAMA_MAX) return { erro: "Uma noite pode ter no máximo 16 horas na cama." };
  if (d.latencia !== null && d.latencia >= naCama) return { erro: "O tempo até dormir precisa ser menor que o tempo na cama." };

  // O registro rápido manda só horários e qualidade: os campos que não vieram no formulário ficam como estavam.
  const dados = {
    bedtime: deitou,
    wakeTime: acordou,
    quality: d.qualidade,
    ...(fd.has("latencia") ? { latencyMin: d.latencia } : {}),
    ...(fd.has("despertares") ? { awakenings: d.despertares } : {}),
    ...(fd.has("notas") ? { notes: d.notas?.trim() || null } : {}),
  };
  const dia = chaveParaData(d.dia);
  const id = String(fd.get("id") ?? "");
  await db.$transaction(async (tx) => {
    // Editando e trocando o dia: a noite antiga sai (uma noite por dia; a nova substitui a que houver).
    if (id) await tx.sleepLog.deleteMany({ where: { id, userId: user.id, NOT: { day: dia } } });
    await tx.sleepLog.upsert({
      where: { userId_day: { userId: user.id, day: dia } },
      create: { userId: user.id, day: dia, ...dados },
      update: dados,
    });
  });
  revalidar();
  return { ok: "Noite registrada." };
}

export async function excluirNoite(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.sleepLog.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

const esquemaConfig = z.object({
  meta: z.coerce.number({ message: "Meta inválida." }).min(4, "Meta mínima: 4 h.").max(14, "Meta máxima: 14 h."),
  dormir: z.string().refine(validaHora, "Horário de dormir inválido."),
  acordar: z.string().refine(validaHora, "Horário de acordar inválido."),
  lembrete: z.coerce.number({ message: "Lembrete inválido." }).int().min(0, "Lembrete: de 0 a 180 min.").max(180, "Lembrete: de 0 a 180 min."),
});

export async function salvarConfigSono(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaConfig.safeParse({
    meta: String(fd.get("meta") ?? "").replace(",", "."),
    dormir: fd.get("dormir"),
    acordar: fd.get("acordar"),
    lembrete: fd.get("lembrete"),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  const dias = fd.getAll("diasAula").map((x) => Number(x)).filter((x) => Number.isInteger(x));
  const dados = {
    targetMin: Math.round(r.data.meta * 60),
    bedtime: r.data.dormir,
    wake: r.data.acordar,
    schoolDays: diasParaBits(dias),
    remindMin: r.data.lembrete,
  };
  await db.sleepSettings.upsert({ where: { userId: user.id }, create: { userId: user.id, ...dados }, update: dados });
  revalidar();
  return { ok: "Configuração salva." };
}
