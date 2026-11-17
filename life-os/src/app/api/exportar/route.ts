// Exportação completa (JSON) de tudo o que é do usuário. Sem senha, segredos nem sessões.
import { db } from "@/lib/db";
import { arquivo, naoAutenticado, usuarioDaRota } from "@/lib/servidor/rota";
import { registrarAcesso } from "@/lib/servidor/registro";
import { hoje } from "@/lib/datas";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await usuarioDaRota();
  if (!user) return naoAutenticado();
  const [agua, configAgua, diasAgua, habitos, eventos, tarefas] = await Promise.all([
    db.waterEntry.findMany({ where: { userId: user.id }, orderBy: { at: "asc" } }),
    db.waterSettings.findUnique({ where: { userId: user.id } }),
    db.waterDay.findMany({ where: { userId: user.id }, orderBy: { day: "asc" } }),
    db.habit.findMany({ where: { userId: user.id }, include: { logs: { orderBy: { day: "asc" } } }, orderBy: { position: "asc" } }),
    db.calendarEvent.findMany({ where: { userId: user.id }, orderBy: { start: "asc" } }),
    db.task.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);
  const dados = {
    formato: "life-os/v1",
    exportadoEm: new Date().toISOString(),
    perfil: { usuario: user.username, nome: user.displayName, fuso: user.timezone, inicioDia: user.dayStart, fimDia: user.dayEnd },
    agua: { config: configAgua && { meta: configAgua.goalMl, copo: configAgua.glassMl, garrafa: configAgua.bottleMl, rapidos: configAgua.quickAmounts }, dias: diasAgua, registros: agua },
    habitos,
    eventos,
    tarefas,
  };
  await registrarAcesso(user.id, "dados_exportados", "JSON");
  return arquivo(JSON.stringify(dados, null, 2), `life-os-${hoje(user.timezone)}.json`, "application/json; charset=utf-8");
}
