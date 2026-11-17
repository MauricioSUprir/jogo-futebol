"use server";
// Habit Tracker: criar, editar, marcar, descanso, arquivar, excluir, ordenar.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { chaveParaData, diasEntre, hoje, validaChave } from "@/lib/datas";
import { CORES_HABITO, ICONES_HABITO, SUGESTOES_HABITO } from "@/lib/catalogo";
import type { Estado } from "./tipos";

function revalidar(id?: string) {
  revalidatePath("/");
  revalidatePath("/habitos");
  if (id) revalidatePath(`/habitos/${id}`);
}

const esquemaHabito = z.object({
  nome: z.string().trim().min(1, "Dê um nome ao hábito.").max(60, "Nome com no máximo 60 caracteres."),
  icone: z.enum(ICONES_HABITO).default("check"),
  cor: z.string().refine((c) => c in CORES_HABITO).default("azul"),
  frequencia: z.enum(["diario", "dias", "semanal"]).default("diario"),
  vezesSemana: z.coerce.number().int().min(1).max(7).default(3),
  metaDia: z.coerce.number().int().min(1).max(20).default(1),
});

export async function salvarHabito(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const r = esquemaHabito.safeParse(Object.fromEntries(fd));
  if (!r.success) return { erro: r.error.issues[0].message };
  const dias = fd
    .getAll("dias")
    .map(Number)
    .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  const weekdays = dias.reduce((m, d) => m | (1 << d), 0);
  if (r.data.frequencia === "dias" && weekdays === 0) return { erro: "Escolha pelo menos um dia da semana." };
  const agua = fd.get("agua") === "on";
  const dados = {
    name: r.data.nome,
    icon: r.data.icone,
    color: r.data.cor,
    frequency: agua ? "diario" : r.data.frequencia,
    weekdays: r.data.frequencia === "dias" && !agua ? weekdays : 127,
    timesPerWeek: r.data.vezesSemana,
    targetPerDay: agua ? 1 : r.data.metaDia,
    source: agua ? "agua" : null,
  };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.habit.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Hábito não encontrado." };
    revalidar(id);
    return { ok: "Hábito atualizado." };
  }
  const ultimo = await db.habit.aggregate({ where: { userId: user.id }, _max: { position: true } });
  await db.habit.create({
    data: { ...dados, userId: user.id, position: (ultimo._max.position ?? 0) + 1, startDay: chaveParaData(hoje(user.timezone)) },
  });
  revalidar();
  return { ok: "Hábito criado." };
}

/** acao: "alternar" (feito/não feito), "mais", "menos", "descanso" (liga/desliga o dia de descanso). */
export async function marcarHabito(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const acao = String(fd.get("acao") ?? "alternar");
  const hojeK = hoje(user.timezone);
  const diaPedido = String(fd.get("dia") ?? hojeK);
  if (!validaChave(diaPedido) || diasEntre(diaPedido, hojeK) < 0 || diasEntre(diaPedido, hojeK) > 60) return;
  const h = await db.habit.findFirst({ where: { id, userId: user.id } });
  if (!h || h.source === "agua") return; // o hábito da água se marca sozinho
  const dia = chaveParaData(diaPedido);
  // Marcar um dia antes do início do hábito puxa o início para trás.
  if (dia < h.startDay) await db.habit.update({ where: { id }, data: { startDay: dia } });
  const atual = await db.habitLog.findUnique({ where: { habitId_day: { habitId: id, day: dia } } });
  const count = atual?.count ?? 0;
  let novo = { count, skipped: atual?.skipped ?? false };
  if (acao === "alternar") novo = { count: count >= h.targetPerDay ? 0 : h.targetPerDay, skipped: false };
  else if (acao === "mais") novo = { count: Math.min(count + 1, 99), skipped: false };
  else if (acao === "menos") novo = { count: Math.max(count - 1, 0), skipped: novo.skipped };
  else if (acao === "descanso") novo = { count: 0, skipped: !novo.skipped };
  if (novo.count === 0 && !novo.skipped) await db.habitLog.deleteMany({ where: { habitId: id, day: dia } });
  else
    await db.habitLog.upsert({
      where: { habitId_day: { habitId: id, day: dia } },
      create: { habitId: id, day: dia, ...novo },
      update: novo,
    });
  revalidar(id);
}

export async function arquivarHabito(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const arquivar = fd.get("arquivar") !== "0";
  await db.habit.updateMany({ where: { id, userId: user.id }, data: { archived: arquivar } });
  revalidar(id);
}

export async function excluirHabito(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.habit.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
  redirect("/habitos");
}

export async function moverHabito(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const dir = fd.get("dir") === "cima" ? -1 : 1;
  const lista = await db.habit.findMany({ where: { userId: user.id, archived: false }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  const i = lista.findIndex((h) => h.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= lista.length) return;
  [lista[i], lista[j]] = [lista[j], lista[i]];
  await db.$transaction(lista.map((h, k) => db.habit.update({ where: { id: h.id }, data: { position: k } })));
  revalidar();
}

export async function criarSugestoes(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const escolhidas = fd.getAll("s").map(Number).filter((i) => i >= 0 && i < SUGESTOES_HABITO.length);
  const startDay = chaveParaData(hoje(user.timezone));
  const existentes = new Set((await db.habit.findMany({ where: { userId: user.id }, select: { name: true } })).map((h) => h.name));
  const novas = escolhidas.map((i) => SUGESTOES_HABITO[i]).filter((s) => !existentes.has(s.name));
  await db.habit.createMany({
    data: novas.map((s, k) => ({
      userId: user.id,
      name: s.name,
      icon: s.icon,
      color: s.color,
      source: "source" in s ? s.source : null,
      position: k,
      startDay,
    })),
  });
  revalidar();
}
