"use server";
// Hydro Track: registrar, desfazer, configurar meta e marcar dia de treino.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { configAgua } from "@/lib/servidor/dados";
import { chaveParaData, hoje, localParaUtc, validaChave, validaHora, diasEntre } from "@/lib/datas";
import { BEBIDAS } from "@/lib/agua";
import type { Estado } from "./tipos";

function revalidar() {
  revalidatePath("/");
  revalidatePath("/agua");
  revalidatePath("/habitos");
}

/** Garante a meta "congelada" do dia (mudar a meta depois não reescreve o histórico). */
async function garantirDia(userId: string, dia: string) {
  const cfg = await configAgua(userId);
  await db.waterDay.upsert({
    where: { userId_day: { userId, day: chaveParaData(dia) } },
    create: { userId, day: chaveParaData(dia), goalMl: cfg.goalMl },
    update: {},
  });
}

const esquemaRegistro = z.object({
  ml: z.coerce.number().int().min(10, "Mínimo de 10 ml.").max(5000, "Máximo de 5 L por registro."),
  bebida: z.string().refine((b) => b in BEBIDAS).default("agua"),
  tipo: z.enum(["copo", "garrafa", "rapido", "personalizado"]).default("rapido"),
  dia: z.string().optional(),
  hora: z.string().optional(),
});

async function registrar(fd: FormData): Promise<string | null> {
  const user = await exigirUsuario();
  const r = esquemaRegistro.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => v !== "")));
  if (!r.success) return r.error.issues[0].message;
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const dia = r.data.dia && validaChave(r.data.dia) ? r.data.dia : hojeK;
  if (diasEntre(dia, hojeK) < 0) return "Não dá para registrar no futuro.";
  if (diasEntre(dia, hojeK) > 30) return "Só dá para registrar até 30 dias atrás.";
  const at = r.data.hora && validaHora(r.data.hora) ? localParaUtc(dia, r.data.hora, tz) : dia === hojeK ? new Date() : localParaUtc(dia, "12:00", tz);
  if (at.getTime() > Date.now() + 60_000) return "Esse horário ainda não chegou.";
  await garantirDia(user.id, dia);
  await db.waterEntry.create({
    data: { userId: user.id, day: chaveParaData(dia), at, amountMl: r.data.ml, beverage: r.data.bebida, kind: r.data.tipo },
  });
  revalidar();
  return null;
}

/** Botões rápidos (+copo, +garrafa, +200 ml…). */
export async function adicionarAgua(fd: FormData): Promise<void> {
  await registrar(fd);
}

/** Registro personalizado (quantidade, bebida, horário). */
export async function registrarBebida(_: Estado, fd: FormData): Promise<Estado> {
  const erro = await registrar(fd);
  return erro ? { erro } : { ok: "Registrado." };
}

export async function removerAgua(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.waterEntry.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

export async function desfazerUltimaAgua(): Promise<void> {
  const user = await exigirUsuario();
  const ultima = await db.waterEntry.findFirst({
    where: { userId: user.id, day: chaveParaData(hoje(user.timezone)) },
    orderBy: { at: "desc" },
  });
  if (ultima) await db.waterEntry.delete({ where: { id: ultima.id } });
  revalidar();
}

const esquemaConfig = z.object({
  meta: z.coerce.number().int().min(250, "Meta mínima: 250 ml.").max(8000, "Meta máxima: 8 L."),
  copo: z.coerce.number().int().min(50).max(2000),
  garrafa: z.coerce.number().int().min(100).max(3000),
  rapidos: z.string().default(""),
});

export async function salvarConfigAgua(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaConfig.safeParse(Object.fromEntries(fd));
  if (!r.success) return { erro: r.error.issues[0].message };
  const rapidos = [
    ...new Set(
      r.data.rapidos
        .split(/[,;\s]+/)
        .map((x) => Math.round(Number(x)))
        .filter((x) => Number.isFinite(x) && x >= 10 && x <= 3000),
    ),
  ].slice(0, 4);
  await db.waterSettings.upsert({
    where: { userId: user.id },
    create: { userId: user.id, goalMl: r.data.meta, glassMl: r.data.copo, bottleMl: r.data.garrafa, quickAmounts: rapidos },
    update: { goalMl: r.data.meta, glassMl: r.data.copo, bottleMl: r.data.garrafa, quickAmounts: rapidos },
  });
  // A meta nova vale a partir de hoje (o histórico mantém a meta de cada dia).
  const dia = chaveParaData(hoje(user.timezone));
  await db.waterDay.upsert({
    where: { userId_day: { userId: user.id, day: dia } },
    create: { userId: user.id, day: dia, goalMl: r.data.meta },
    update: { goalMl: r.data.meta },
  });
  revalidar();
  return { ok: "Configuração salva." };
}

export async function marcarDiaTreino(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const dia = String(fd.get("dia") ?? "");
  if (!validaChave(dia)) return;
  const valor = fd.get("valor") === "1";
  await garantirDia(user.id, dia);
  await db.waterDay.update({ where: { userId_day: { userId: user.id, day: chaveParaData(dia) } }, data: { trainingDay: valor } });
  revalidar();
}
