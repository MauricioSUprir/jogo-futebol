"use server";
// Life Calendar: eventos, tarefas e planejamento automático do dia.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { exigirUsuario } from "@/lib/servidor/sessao";
import { carregarAgenda, ocupadosDoDia } from "@/lib/servidor/dados";
import {
  chaveParaData,
  dataParaChave,
  diasEntre,
  hoje,
  horaParaMinutos,
  localParaUtc,
  minutosNoFuso,
  minutosParaHora,
  validaChave,
  validaHora,
} from "@/lib/datas";
import { CATEGORIAS_EVENTO } from "@/lib/catalogo";
import { planejarDia } from "@/lib/planejador";
import type { Estado } from "./tipos";

function revalidar() {
  revalidatePath("/");
  revalidatePath("/agenda");
  revalidatePath("/agenda/foco");
}

const opcional = (v: FormDataEntryValue | null) => {
  const s = String(v ?? "").trim();
  return s === "" ? undefined : s;
};

const esquemaEvento = z.object({
  titulo: z.string().trim().min(1, "Dê um título.").max(120),
  categoria: z.string().refine((c) => c in CATEGORIAS_EVENTO, "Categoria inválida."),
  dia: z.string().refine(validaChave, "Data inválida."),
  diaFim: z.string().refine(validaChave, "Data final inválida.").optional(),
  inicio: z.string().refine(validaHora, "Horário inválido.").optional(),
  fim: z.string().refine(validaHora, "Horário final inválido.").optional(),
  local: z.string().trim().max(120).optional(),
  notas: z.string().trim().max(2000).optional(),
  repetir: z.enum(["nenhuma", "diaria", "semanal", "mensal", "anual"]).default("nenhuma"),
  repetirAte: z.string().refine(validaChave, "Data do fim da repetição inválida.").optional(),
});

export async function salvarEvento(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const bruto: Record<string, string | undefined> = {};
  for (const k of ["titulo", "categoria", "dia", "diaFim", "inicio", "fim", "local", "notas", "repetir", "repetirAte"]) bruto[k] = opcional(fd.get(k));
  const r = esquemaEvento.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const diaInteiro = fd.get("diaInteiro") === "on" || !d.inicio;
  const tz = user.timezone;

  let start: Date;
  let end: Date | null = null;
  if (diaInteiro) {
    start = chaveParaData(d.dia);
    if (d.diaFim && d.diaFim > d.dia) {
      if (diasEntre(d.dia, d.diaFim) > 60) return { erro: "Um evento pode durar no máximo 60 dias." };
      end = chaveParaData(d.diaFim);
    }
  } else {
    start = localParaUtc(d.dia, d.inicio!, tz);
    if (d.fim) {
      const diaFim = d.diaFim && d.diaFim >= d.dia ? d.diaFim : d.dia;
      end = localParaUtc(diaFim, d.fim, tz);
      if (end <= start) return { erro: "O fim precisa ser depois do início." };
    }
  }
  if (d.repetirAte && d.repetirAte < d.dia) return { erro: "A repetição precisa terminar depois do início." };

  const dados = {
    title: d.titulo,
    category: d.categoria,
    allDay: diaInteiro,
    start,
    end,
    location: d.local ?? null,
    notes: d.notas ?? null,
    recurrence: d.repetir,
    recurrenceUntil: d.repetir !== "nenhuma" && d.repetirAte ? chaveParaData(d.repetirAte) : null,
  };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.calendarEvent.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Evento não encontrado." };
  } else {
    await db.calendarEvent.create({ data: { ...dados, userId: user.id } });
  }
  revalidar();
  return { ok: id ? "Evento atualizado." : "Evento criado." };
}

export async function excluirEvento(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  // O que outros módulos ligaram ao evento: o checklist da prova sai junto; a consulta e a meta só perdem o vínculo.
  await db.$transaction([
    db.checklistItem.deleteMany({ where: { userId: user.id, eventId: id } }),
    db.healthRecord.updateMany({ where: { userId: user.id, eventId: id }, data: { eventId: null } }),
    db.goal.updateMany({ where: { userId: user.id, eventId: id }, data: { eventId: null } }),
    db.calendarEvent.deleteMany({ where: { id, userId: user.id } }),
  ]);
  revalidar();
}

// ───── Tarefas ─────

const esquemaTarefa = z.object({
  titulo: z.string().trim().min(1, "Dê um título.").max(120),
  duracao: z.coerce.number().int().min(5, "Duração mínima: 5 min.").max(600, "Duração máxima: 10 h."),
  prioridade: z.coerce.number().int().min(1).max(3).default(2),
  prazo: z.string().refine(validaChave, "Prazo inválido.").optional(),
  notas: z.string().trim().max(2000).optional(),
  dia: z.string().refine(validaChave, "Data inválida.").optional(),
  hora: z.string().refine(validaHora, "Horário inválido.").optional(),
});

export async function salvarTarefa(_: Estado, fd: FormData): Promise<Estado> {
  const user = await exigirUsuario();
  const bruto: Record<string, string | undefined> = {};
  for (const k of ["titulo", "duracao", "prioridade", "prazo", "notas", "dia", "hora"]) bruto[k] = opcional(fd.get(k));
  const r = esquemaTarefa.safeParse(bruto);
  if (!r.success) return { erro: r.error.issues[0].message };
  const d = r.data;
  const scheduledStart = d.hora ? localParaUtc(d.dia ?? hoje(user.timezone), d.hora, user.timezone) : null;
  const dados = {
    title: d.titulo,
    durationMin: d.duracao,
    priority: d.prioridade,
    dueDay: d.prazo ? chaveParaData(d.prazo) : null,
    notes: d.notas ?? null,
    scheduledStart,
  };
  const id = String(fd.get("id") ?? "");
  if (id) {
    const n = await db.task.updateMany({ where: { id, userId: user.id }, data: dados });
    if (!n.count) return { erro: "Tarefa não encontrada." };
  } else await db.task.create({ data: { ...dados, userId: user.id } });
  revalidar();
  return { ok: id ? "Tarefa atualizada." : "Tarefa criada." };
}

export async function concluirTarefa(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const id = String(fd.get("id") ?? "");
  const feita = fd.get("feita") !== "0";
  await db.task.updateMany({ where: { id, userId: user.id }, data: { done: feita, doneAt: feita ? new Date() : null } });
  revalidar();
}

export async function excluirTarefa(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.task.deleteMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id } });
  revalidar();
}

export async function tirarDoHorario(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  await db.task.updateMany({ where: { id: String(fd.get("id") ?? ""), userId: user.id }, data: { scheduledStart: null } });
  revalidar();
}

// ───── Planejamento automático ─────

export type EstadoPlano =
  | { erro?: string; dia?: undefined }
  | {
      dia: string;
      itens: { id: string; titulo: string; inicio: string; fim: string }[];
      semLugar: string[];
      livresMin: number;
      erro?: string;
    };

/** Tarefas que podem ser planejadas: pendentes sem horário (ou com horário num dia que já passou). */
async function tarefasParaPlanejar(userId: string, inicioDoDia: Date) {
  return db.task.findMany({
    where: { userId, done: false, OR: [{ scheduledStart: null }, { scheduledStart: { lt: inicioDoDia } }] },
  });
}

export async function planejar(_: EstadoPlano | undefined, fd: FormData): Promise<EstadoPlano> {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const hojeK = hoje(tz);
  const dia = String(fd.get("dia") ?? hojeK);
  if (!validaChave(dia) || dia < hojeK) return { erro: "Escolha hoje ou um dia futuro." };
  const tarefas = await tarefasParaPlanejar(user.id, localParaUtc(hojeK, "00:00", tz));
  if (!tarefas.length) return { erro: "Nenhuma tarefa pendente sem horário. Crie tarefas primeiro." };
  const itens = await carregarAgenda(user, dia, dia);
  const ocupados = ocupadosDoDia(itens, dia, tz);
  const janelaInicio = horaParaMinutos(user.dayStart);
  const janelaFim = horaParaMinutos(user.dayEnd);
  const plano = planejarDia({
    janelaInicio,
    janelaFim,
    ocupados,
    tarefas: tarefas.map((t) => ({ id: t.id, durationMin: t.durationMin, priority: t.priority, dueDay: t.dueDay ? dataParaChave(t.dueDay) : null })),
    agoraMin: dia === hojeK ? minutosNoFuso(new Date(), tz) : null,
  });
  const titulo = new Map(tarefas.map((t) => [t.id, t.title]));
  let livres = 0;
  for (let m = janelaInicio; m < janelaFim; m++) if (!ocupados.some((o) => m >= o.inicio && m < o.fim)) livres++;
  return {
    dia,
    itens: plano.encaixes.map((e) => ({ id: e.id, titulo: titulo.get(e.id) ?? "", inicio: minutosParaHora(e.inicio), fim: minutosParaHora(e.fim) })),
    semLugar: plano.semLugar.map((id) => titulo.get(id) ?? ""),
    livresMin: livres,
  };
}

export async function aplicarPlano(fd: FormData): Promise<void> {
  const user = await exigirUsuario();
  const tz = user.timezone;
  const dia = String(fd.get("dia") ?? "");
  if (!validaChave(dia) || dia < hoje(tz)) return;
  const pares = fd
    .getAll("item")
    .map(String)
    .map((s) => s.split("@"))
    .filter(([id, h]) => id && validaHora(h));
  await db.$transaction(
    pares.map(([id, h]) =>
      db.task.updateMany({ where: { id, userId: user.id, done: false }, data: { scheduledStart: localParaUtc(dia, h, tz) } }),
    ),
  );
  revalidar();
}
