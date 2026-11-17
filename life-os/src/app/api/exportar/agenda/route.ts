import { db } from "@/lib/db";
import { arquivo, naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { gerarIcs } from "@/lib/ics";
import { categoriaEvento } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  const [eventos, tarefas] = await Promise.all([
    db.calendarEvent.findMany({ where: { userId: user.id } }),
    db.task.findMany({ where: { userId: user.id, scheduledStart: { not: null } } }),
  ]);
  const ics = gerarIcs([
    ...eventos.map((e) => ({
      uid: e.id,
      titulo: e.title,
      categoria: categoriaEvento(e.category).nome,
      diaInteiro: e.allDay,
      inicio: e.start,
      fim: e.end,
      local: e.location,
      notas: e.notes,
      recorrencia: e.recurrence,
      repetirAte: e.recurrenceUntil,
    })),
    ...tarefas.map((t) => ({
      uid: t.id,
      titulo: t.title,
      categoria: "Tarefa",
      diaInteiro: false,
      inicio: t.scheduledStart!,
      fim: new Date(t.scheduledStart!.getTime() + t.durationMin * 60_000),
      notas: t.notes,
    })),
  ]);
  return arquivo(ics, "life-os-agenda.ics", "text/calendar; charset=utf-8");
}
